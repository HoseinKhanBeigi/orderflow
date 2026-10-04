/**
 * Browser-side live hub: Binance WebSockets + in-memory engines.
 * Same event shapes as the Node `/ws` server so `public/app.js` can reuse them.
 */
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { EXCHANGE_LABELS, type ExchangeId } from '../exchange/venues.js';
import { FootprintAggregator } from '../footprint/aggregator.js';
import { toWire, type FootprintBar } from '../footprint/types.js';
import { LiveBinanceFeed } from '../live/live-feed.js';
import {
  DEFAULT_ACTIVE_SYMBOLS,
  FULL_WATCHLIST_CATALOG,
  resolveWatchlist,
  type WatchCoin,
} from '../live/watchlist.js';
import type { WindowSnapshot } from '../models/signals.js';
import {
  PatternLiveHub,
  historyPatternView,
  toCurrentPattern,
  type NextStatePrediction,
  type PatternCandidate,
  type PatternMarker,
  type PatternSnapshot,
} from '../pattern-recognition/index.js';
import { DEFAULT_IMBALANCE_RATIO, SpotFlowEngine } from '../spot/index.js';

const WATCHLIST_KEY = 'orderflow.activeWatchlist';
const FOOTPRINT_PUSH_MS = 250;
const FOOTPRINT_TICK_MS = 1_000;
const SPOT_FLOW_MS = 2_000;

type Listener = (ev: object) => void;

interface FootprintSub {
  symbols: string[];
  exchanges: ExchangeId[];
  market: 'spot' | 'perp';
}

function loadActiveSymbols(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [...DEFAULT_ACTIVE_SYMBOLS];
    const parsed = JSON.parse(raw) as { symbols?: unknown };
    const symbols = Array.isArray(parsed.symbols)
      ? parsed.symbols.map((s) => String(s ?? '').toUpperCase()).filter(Boolean)
      : [];
    if (!symbols.length) return [...DEFAULT_ACTIVE_SYMBOLS];
    // Ensure BTC is available for users who saved an older default watchlist.
    if (!symbols.includes('BTCUSDT')) {
      symbols.unshift('BTCUSDT');
      saveActiveSymbols(symbols);
    }
    return symbols;
  } catch {
    return [...DEFAULT_ACTIVE_SYMBOLS];
  }
}

function saveActiveSymbols(symbols: string[]): void {
  localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify({ symbols, updatedAt: new Date().toISOString() }),
  );
}

function compactCandidate(p: PatternCandidate) {
  return {
    id: p.id,
    version: p.patternVersion,
    direction: p.direction,
    title: p.title,
    badge: p.badge,
    status: p.status,
    confidence: p.confidence,
    progress: Math.round(p.progress * 100),
    startTimestamp: p.startTimestamp,
    confirmedTimestamp: p.confirmedTimestamp,
    barsUsed: p.barsUsed,
    stage: p.stage,
    totalStages: p.totalStages,
    matchedLabels: p.matchedLabels,
    evidence: {
      labelConfidence: p.evidence.labelConfidence,
      sweepQuality: p.evidence.sweepQuality,
      controlShift: p.evidence.controlShift,
      supportingEvidence: p.evidence.supportingEvidence,
      stageCompletion: p.evidence.components.stageCompletion,
    },
  };
}

function compactNextState(next: NextStatePrediction | null) {
  if (!next) return null;
  return {
    status: next.status,
    prediction: next.prediction,
    probability: next.probability,
    secondPrediction: next.secondPrediction,
    secondProbability: next.secondProbability,
    margin: next.margin,
    confidence: next.confidence,
    confidenceScore: next.confidenceScore,
    sampleCount: next.sampleCount,
    sequenceDepth: next.sequenceDepth,
    distribution: next.distribution,
  };
}

function compactMarker(m: PatternMarker) {
  return {
    t: m.time,
    badge: m.badge,
    id: m.patternId,
    title: m.title,
    status: m.status,
    confidence: m.confidence,
    direction: m.direction,
    stage: m.stage,
    totalStages: m.totalStages,
    progress: Math.round(m.progress * 100),
    matchedLabels: m.matchedLabels,
    barsUsed: m.barsUsed,
  };
}

function compactPatternSnapshot(snap: PatternSnapshot) {
  return {
    timeframe: snap.timeframe,
    currentLabel: snap.currentLabel,
    primary: snap.primaryPattern ? compactCandidate(snap.primaryPattern) : null,
    currentPattern: toCurrentPattern(snap.primaryPattern),
    nextState: compactNextState(snap.nextState),
    markers: snap.markers.map(compactMarker),
  };
}

class BrowserOrderFlowHub {
  private coins: WatchCoin[] = resolveWatchlist(loadActiveSymbols());
  private perpFeed: LiveBinanceFeed | null = null;
  private spotFeed: LiveBinanceFeed | null = null;
  private readonly perpAgg = new FootprintAggregator({ market: 'perp' });
  private readonly spotAgg = new FootprintAggregator({ market: 'spot' });
  private readonly spotHub = new SpotFlowEngine(DEFAULT_IMBALANCE_RATIO);
  private readonly patternHub = new PatternLiveHub();
  private readonly listeners = new Set<Listener>();
  private footprintSub: FootprintSub | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private started = false;
  private restartChain: Promise<void> = Promise.resolve();

  getConfig() {
    return {
      coins: this.coins,
      catalog: FULL_WATCHLIST_CATALOG,
      crypto: this.coins.filter((c) => c.venue === 'crypto'),
      stocks: this.coins.filter((c) => c.venue === 'equity'),
      market: 'perp' as const,
      markets: ['perp', 'spot'] as const,
      stockSource: 'binance-perp',
      exchanges: ['binance'] as ExchangeId[],
      spotExchanges: ['binance'] as ExchangeId[],
      exchangeLabels: EXCHANGE_LABELS,
      imbalanceRatio: DEFAULT_IMBALANCE_RATIO,
      history: { enabled: false, retentionDays: 0 },
      watchlist: { lockedByEnv: false, path: 'localStorage' },
      tiers: DEFAULT_CONFIG.largeTradeThresholds,
      relative: {
        large: DEFAULT_CONFIG.relative.largePercentile,
        veryLarge: DEFAULT_CONFIG.relative.veryLargePercentile,
        extreme: DEFAULT_CONFIG.relative.extremePercentile,
      },
      clientMode: true,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(ev: object): void {
    for (const listener of this.listeners) {
      try {
        listener(ev);
      } catch (err) {
        console.error('[client] listener failed', err);
      }
    }
  }

  handleMessage(msg: { type?: string; symbol?: unknown; symbols?: unknown; exchange?: unknown; market?: unknown }): void {
    if (msg.type !== 'sub_footprint') return;
    const requested = Array.isArray(msg.symbols)
      ? msg.symbols.map((s) => String(s ?? '').toUpperCase())
      : [String(msg.symbol ?? '').toUpperCase()];
    const symbols = [...new Set(requested)].filter((symbol) => this.coins.some((c) => c.symbol === symbol));
    if (!symbols.length) return;
    const market = String(msg.market ?? '').toLowerCase() === 'spot' ? 'spot' : 'perp';
    const exchangeRaw = String(msg.exchange ?? 'binance').toLowerCase();
    const exchanges: ExchangeId[] =
      exchangeRaw === 'all' ? ['binance'] : exchangeRaw === 'binance' ? ['binance'] : ['binance'];
    this.footprintSub = { symbols, market, exchanges };
    this.pushLiveFootprint();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.createFeeds();
    this.perpFeed?.start();
    this.spotFeed?.start();
    this.timers.push(setInterval(() => this.pushLiveFootprint(), FOOTPRINT_PUSH_MS));
    this.timers.push(
      setInterval(() => {
        this.broadcastFootprintTicks('perp');
        this.broadcastFootprintTicks('spot');
      }, FOOTPRINT_TICK_MS),
    );
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        for (const coin of this.coins.filter((c) => c.venue === 'crypto')) {
          this.emit({ type: 'spot_flow', market: 'spot', snapshot: this.spotHub.snapshot(coin.symbol, 'all', now) });
        }
      }, SPOT_FLOW_MS),
    );
  }

  stop(): void {
    this.started = false;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.perpFeed?.stop();
    this.spotFeed?.stop();
    this.perpFeed = null;
    this.spotFeed = null;
  }

  setWatchlist(symbols: string[]): { coins: WatchCoin[]; restartRequired: boolean } {
    const next = resolveWatchlist(symbols);
    if (!next.length) throw new Error('Pick at least one coin');
    saveActiveSymbols(next.map((c) => c.symbol));
    this.coins = next;
    this.restartFeeds('watchlist');
    return { coins: this.coins, restartRequired: false };
  }

  /** Same payload as Node `/api/patterns` — runs fully in the browser. */
  recognizePatterns(body: {
    symbol?: string;
    market?: string;
    tf?: number;
    lastIsLive?: boolean;
    bars?: Array<{
      t: number;
      o: number;
      h: number;
      l: number;
      c: number;
      tb?: number;
      ts?: number;
      n?: number;
      bt?: number;
      st?: number;
      lb?: number;
      ls?: number;
      lv?: [number, number, number][];
    }>;
  }) {
    const symbol = String(body.symbol ?? 'BTCUSDT').toUpperCase();
    const market = String(body.market ?? '').toLowerCase() === 'spot' ? 'spot' : 'perp';
    const tf = Math.max(1, Math.min(1440, Math.floor(Number(body.tf) || 15)));
    const bars: FootprintBar[] = (body.bars ?? []).slice(-400).map((w) => ({
      symbol,
      exchange: 'binance' as const,
      market,
      time: w.t,
      open: w.o,
      high: w.h,
      low: w.l,
      close: w.c,
      totalBuy: w.tb ?? 0,
      totalSell: w.ts ?? 0,
      trades: w.n ?? 0,
      buyTrades: w.bt,
      sellTrades: w.st,
      largestBuy: w.lb,
      largestSell: w.ls,
      levels: (w.lv ?? []).map(([price, buy, sell]) => ({ price, buy, sell })),
    }));
    const view = historyPatternView(bars, tf, { lastIsLive: Boolean(body.lastIsLive) });
    return {
      symbol,
      tf,
      currentLabel: view.snapshot?.currentLabel ?? null,
      primary: view.snapshot?.primaryPattern ? compactCandidate(view.snapshot.primaryPattern) : null,
      currentPattern: toCurrentPattern(view.snapshot?.primaryPattern ?? null),
      nextState: compactNextState(view.snapshot?.nextState ?? null),
      markers: view.markers.map(compactMarker),
    };
  }

  private restartFeeds(reason: string): void {
    this.restartChain = this.restartChain
      .catch(() => undefined)
      .then(async () => {
        try {
          this.perpFeed?.stop();
        } catch {
          /* ignore */
        }
        try {
          this.spotFeed?.stop();
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 50));
        if (!this.started) return;
        this.createFeeds();
        this.perpFeed?.start();
        this.spotFeed?.start();
        this.emit({
          type: 'watchlist',
          coins: this.coins,
          active: this.coins.map((c) => c.symbol),
          reason,
        });
      });
  }

  private createFeeds(): void {
    const cryptoCoins = this.coins.filter((c) => c.venue === 'crypto');

    const noRestDepth = async () => ({ bids: [] as [string, string][], asks: [] as [string, string][] });

    this.perpFeed = new LiveBinanceFeed({
      coins: this.coins,
      market: 'perp',
      summaryMs: 2_000,
      exchanges: ['binance'],
      engineTradeVenues: ['binance'],
      engineTradeFallbackMs: 0,
      depthMode: 'partial-ws',
      fetchDepth: noRestDepth,
    });
    this.spotFeed = new LiveBinanceFeed({
      coins: cryptoCoins,
      market: 'spot',
      summaryMs: 2_000,
      exchanges: ['binance'],
      engineTradeVenues: ['binance'],
      engineTradeFallbackMs: 0,
      depthMode: 'partial-ws',
      fetchDepth: noRestDepth,
    });

    this.perpFeed.onAnyTrade((trade, exchange) => {
      this.perpAgg.ingest(trade, exchange);
    });
    this.spotFeed.onAnyTrade((trade, exchange) => {
      if (!this.spotHub.ingestTrade(trade, exchange)) return;
      this.spotAgg.ingest(trade, exchange);
    });

    this.perpFeed.on((ev) => {
      if (ev.type === 'summary') {
        this.spotHub.setFuturesWindow(ev.summary.symbol, ev.summary.windows['1m'] as WindowSnapshot);
      }
      this.emit({ ...ev, market: 'perp' });
    });
    this.spotFeed.on((ev) => {
      if (ev.type === 'book') {
        this.spotHub.ingestBook({
          symbol: ev.symbol,
          marketType: 'spot',
          timestamp: Date.now(),
          bids: ev.bids,
          asks: ev.asks,
        });
      }
      if (ev.type === 'summary') {
        this.spotHub.ingestBinanceWindow(ev.summary.symbol, ev.summary.windows['1m'] as WindowSnapshot);
      }
      this.emit({ ...ev, market: 'spot' });
    });
  }

  private aggFor(market: 'spot' | 'perp'): FootprintAggregator {
    return market === 'spot' ? this.spotAgg : this.perpAgg;
  }

  private pushLiveFootprint(): void {
    const sub = this.footprintSub;
    if (!sub) return;
    const rec = this.aggFor(sub.market);
    for (const symbol of sub.symbols) {
      const bars: Array<{ exchange: ExchangeId; bar: ReturnType<typeof toWire> }> = [];
      for (const exchange of sub.exchanges) {
        const bar = rec.currentBar(symbol, exchange);
        if (bar) bars.push({ exchange, bar: toWire(bar) });
      }
      if (!bars.length) continue;
      this.emit({ type: 'footprint_live', symbol, market: sub.market, bars });
    }
  }

  private broadcastFootprintTicks(market: 'spot' | 'perp'): void {
    const rec = this.aggFor(market);
    rec.closeStale();
    const closed = rec.peekClosed();
    if (closed.length) {
      const { alerts, dirty } = this.patternHub.observeClosed(closed);
      for (const alert of alerts) {
        this.emit({ type: 'pattern_alert', market, alert });
      }
      for (const symbol of dirty) {
        const snapshots = this.patternHub.snapshotsForSymbol(symbol, market);
        if (!snapshots.length) continue;
        this.emit({
          type: 'pattern_snapshot',
          market,
          symbol,
          snapshots: snapshots.map(compactPatternSnapshot),
        });
      }
    }
    const bars: Array<{ symbol: string; exchange: ExchangeId; bar: ReturnType<typeof toWire> }> = [];
    for (const coin of this.coins) {
      if (market === 'spot' && coin.venue === 'equity') continue;
      const bar = rec.currentBar(coin.symbol, 'binance');
      if (bar) bars.push({ symbol: coin.symbol, exchange: 'binance', bar: toWire(bar) });
    }
    if (!bars.length) return;
    this.emit({ type: 'footprint_tick', market, bars });
  }
}

const hub = new BrowserOrderFlowHub();

declare global {
  interface Window {
    OrderFlowClient: {
      getConfig: () => ReturnType<BrowserOrderFlowHub['getConfig']>;
      start: () => void;
      stop: () => void;
      subscribe: (listener: Listener) => () => void;
      handleMessage: (msg: Parameters<BrowserOrderFlowHub['handleMessage']>[0]) => void;
      setWatchlist: (symbols: string[]) => { coins: WatchCoin[]; restartRequired: boolean };
      recognizePatterns: (body: Parameters<BrowserOrderFlowHub['recognizePatterns']>[0]) => ReturnType<
        BrowserOrderFlowHub['recognizePatterns']
      >;
      catalog: typeof FULL_WATCHLIST_CATALOG;
    };
  }
}

globalThis.window.OrderFlowClient = {
  getConfig: () => hub.getConfig(),
  start: () => hub.start(),
  stop: () => hub.stop(),
  subscribe: (listener: Listener) => hub.subscribe(listener),
  handleMessage: (msg: Parameters<BrowserOrderFlowHub['handleMessage']>[0]) => hub.handleMessage(msg),
  setWatchlist: (symbols: string[]) => hub.setWatchlist(symbols),
  recognizePatterns: (body) => hub.recognizePatterns(body),
  catalog: FULL_WATCHLIST_CATALOG,
};
