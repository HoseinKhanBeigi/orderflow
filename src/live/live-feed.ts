import WebSocket from 'ws';
import { OrderFlowEngine } from '../engine/order-flow-engine.js';
import { BinanceFuturesAdapter, BinanceSpotAdapter } from '../exchange/binance-adapters.js';
import {
  BINANCE_FUTURES_WS,
  BINANCE_FUTURES_WS_RAW,
  BINANCE_SPOT_WS,
  streamName,
  unwrapBinancePayload,
} from '../exchange/types.js';
import {
  EXCHANGE_LABELS,
  fetchVenueDepth,
  parseExchangesEnv,
  type ExchangeId,
  type VenueDepth,
} from '../exchange/venues.js';
import type { LiquidationEvent, MarketTrade, MarketType } from '../models/trade.js';
import type { WindowSnapshot } from '../models/signals.js';
import { isVolatileWindow } from '../analysis/alerts.js';
import type { PassiveLiquiditySnapshot } from '../models/passive-liquidity.js';
import type { BinanceAggTrade, BinanceDepthDelta, BinanceForceOrder, BinanceTrade } from '../exchange/types.js';
import { DEFAULT_WATCHLIST, minUsdFor, type WatchCoin } from './watchlist.js';
import { safeCloseWebSocket } from './json-socket.js';
import { VenueTradeFan } from './venue-trades.js';

export interface LiveFeedConfig {
  coins: WatchCoin[];
  market: MarketType;
  summaryMs: number;
  exchanges?: ExchangeId[];
  /**
   * Venues whose trades feed the analysis engine (flow, footprint aggression,
   * market battle). Defaults to Binance alone.
   *
   * Caveat before widening this: the order book is Binance-only, so adding
   * venues here scales the *attack* side without scaling *defense*, which
   * inflates attack-vs-defense ratios. Prefer `engineTradeFallback` unless you
   * also have depth for the extra venues.
   */
  engineTradeVenues?: ExchangeId[];
  /**
   * Venue to fall back to when the primary stops delivering trades for this
   * long. Keeps flow analysis alive through a Binance outage or geo-block.
   * Set to 0 to disable.
   */
  engineTradeFallbackMs?: number;
  engineTradeFallback?: ExchangeId;
  /**
   * Override REST depth snapshots (browser builds proxy through `/api/depth`
   * to avoid exchange CORS). Defaults to direct `fetchVenueDepth`.
   */
  fetchDepth?: (
    exchange: ExchangeId,
    symbol: string,
    market: MarketType,
    limit?: number,
  ) => Promise<VenueDepth>;
}

export interface TapeItem {
  id: string;
  symbol: string;
  timestamp: number;
  side: 'BUY' | 'SELL';
  price: number;
  quoteValue: number;
  tag: string;
  relativeClass: string;
  tier: number | null;
  exchange?: ExchangeId;
  market?: MarketType;
}

/**
 * Passive liquidity is window-independent and large, so it travels in its own
 * event instead of being repeated inside every window of every summary.
 */
export type WireWindowSnapshot = Omit<WindowSnapshot, 'passiveLiquidity'>;

export interface LiveSummary {
  timestamp: number;
  symbol: string;
  market: MarketType;
  price: number;
  tradeCount: number;
  windows: Record<'10s' | '30s' | '1m' | '5m' | '15m', WireWindowSnapshot>;
}

export interface CoinOverview {
  symbol: string;
  label: string;
  price: number;
  delta10s: number;
  state10s: string;
}

export type LiveFeedEvent =
  | { type: 'status'; connected: boolean; message: string }
  | { type: 'trade'; trade: TapeItem }
  | { type: 'summary'; summary: LiveSummary }
  | { type: 'overview'; coins: CoinOverview[] }
  | {
      type: 'burst';
      symbol: string;
      side: 'BUY' | 'SELL';
      totalQuoteValue: number;
      tradeCount: number;
      durationMs: number;
    }
  | { type: 'alert'; symbol: string; alertType: string; message: string }
  | {
      type: 'large_trade';
      symbol: string;
      side: 'BUY' | 'SELL';
      quoteValue: number;
      price: number;
      tier: number | null;
      relativeClass: string;
    }
  | {
      type: 'book';
      symbol: string;
      bids: { price: number; quantity: number; quoteValue: number }[];
      asks: { price: number; quantity: number; quoteValue: number }[];
      mid: number;
      spread: number;
      bidTotal: number;
      askTotal: number;
    }
  | {
      type: 'state_change';
      symbol: string;
      window: string;
      state: string;
      delta: number;
      previousState: string | null;
    }
  | {
      type: 'move_potential';
      symbol: string;
      events: string[];
    }
  | {
      type: 'passive_liquidity';
      symbol: string;
      snapshot: PassiveLiquiditySnapshot;
    };

export type LiveFeedListener = (event: LiveFeedEvent) => void;

/**
 * Every normalized trade, before the watchlist `minUsd` tape filter.
 * The footprint recorder needs the full stream, not just large prints.
 */
/** Levels kept and drawn on the footprint ladder. Binance REST depth supports 500. */
const BOOK_DEPTH = 500;

export type RawTradeListener = (trade: MarketTrade, exchange: ExchangeId) => void;
export type RawLiquidationListener = (liq: LiquidationEvent) => void;

function stripPassive(snapshot: WindowSnapshot): WireWindowSnapshot {
  const { passiveLiquidity: _passiveLiquidity, ...wire } = snapshot;
  return wire;
}

export class LiveBinanceFeed {
  readonly engine: OrderFlowEngine;
  readonly coins: WatchCoin[];
  readonly exchanges: ExchangeId[];
  private readonly sockets: WebSocket[] = [];
  private closed = false;
  private lastSummary = 0;
  private readonly lastBookEmit = new Map<string, number>();
  /** Diffs received before the REST depth snapshot is applied. */
  private readonly depthBuffers = new Map<string, BinanceDepthDelta[]>();
  private readonly depthSynced = new Set<string>();
  private readonly depthSyncing = new Set<string>();
  private readonly tradeCount = new Map<string, number>();
  private readonly lastMoveEvents = new Map<string, string>();
  private readonly lastStates = new Map<string, Partial<Record<'10s' | '1m' | '5m', string>>>();
  private readonly listeners = new Set<LiveFeedListener>();
  private readonly rawTradeListeners = new Set<RawTradeListener>();
  private readonly rawLiqListeners = new Set<RawLiquidationListener>();
  private readonly spot = new BinanceSpotAdapter();
  private readonly futures = new BinanceFuturesAdapter();
  private readonly venueUp: Partial<Record<ExchangeId, boolean>> = {};
  private venues: VenueTradeFan | null = null;
  /** Venues whose trades reach the analysis engine. */
  private readonly engineTradeVenues: ExchangeId[];
  private readonly lastEngineTradeAt = new Map<ExchangeId, number>();
  private readonly startedAt = Date.now();
  private fallbackAnnounced = false;

  constructor(readonly config: LiveFeedConfig) {
    this.engine = new OrderFlowEngine();
    this.coins = config.coins;
    this.exchanges = config.exchanges?.length ? config.exchanges : parseExchangesEnv();
    this.engineTradeVenues = config.engineTradeVenues?.length ? config.engineTradeVenues : ['binance'];
    for (const coin of this.coins) {
      this.engine.getSymbol(coin.symbol, config.market);
      this.tradeCount.set(coin.symbol, 0);
      this.lastStates.set(coin.symbol, {});
    }

    this.engine.on((ev) => {
      if (ev.kind === 'large_trade') {
        const e = ev.event;
        this.emit({
          type: 'large_trade',
          symbol: e.symbol,
          side: e.type.includes('BUY') ? 'BUY' : 'SELL',
          quoteValue: e.quoteValue,
          price: e.price,
          tier: e.tier,
          relativeClass: e.relativeClass,
        });
      }
      if (ev.kind === 'burst') {
        this.emit({
          type: 'burst',
          symbol: ev.symbol,
          side: ev.burst.side,
          totalQuoteValue: ev.burst.totalQuoteValue,
          tradeCount: ev.burst.tradeCount,
          durationMs: ev.burst.endTime - ev.burst.startTime,
        });
      }
      if (ev.kind === 'alert') {
        this.emit({
          type: 'alert',
          symbol: ev.alert.symbol,
          alertType: ev.alert.type,
          message: ev.alert.message,
        });
      }
      if (ev.kind === 'move_potential' && ev.events.length) {
        const sig = [...ev.events].sort().join(',');
        if (sig !== this.lastMoveEvents.get(ev.symbol)) {
          this.lastMoveEvents.set(ev.symbol, sig);
          this.emit({ type: 'move_potential', symbol: ev.symbol, events: ev.events });
        }
      }
    });
  }

  on(listener: LiveFeedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onAnyTrade(listener: RawTradeListener): () => void {
    this.rawTradeListeners.add(listener);
    return () => this.rawTradeListeners.delete(listener);
  }

  onAnyLiquidation(listener: RawLiquidationListener): () => void {
    this.rawLiqListeners.add(listener);
    return () => this.rawLiqListeners.delete(listener);
  }

  start(): void {
    this.closed = false;
    this.connect();
    const extra = this.exchanges.filter((id) => id !== 'binance');
    if (extra.length) {
      this.venues = new VenueTradeFan(
        this.coins,
        this.config.market,
        extra,
        (trade, exchange) => this.handleVenueTrade(trade, exchange),
        (exchange, connected) => this.setVenueUp(exchange, connected),
      );
      this.venues.start();
    }
  }

  stop(): void {
    this.closed = true;
    this.venues?.stop();
    this.venues = null;
    this.closeSockets();
    this.emit({ type: 'status', connected: false, message: 'Stopped' });
  }

  private closeSockets(): void {
    for (const ws of this.sockets.splice(0)) {
      safeCloseWebSocket(ws);
    }
  }

  private connect(): void {
    this.closeSockets();
    this.resetDepthSync();
    this.emit({ type: 'status', connected: false, message: 'Connecting…' });
    const { market } = this.config;
    const tradeChannel = market === 'spot' ? 'aggTrade' : 'trade';

    if (market === 'spot') {
      this.openCombined(BINANCE_SPOT_WS, this.coins, tradeChannel, 'spot');
      this.openSocket(`${BINANCE_SPOT_WS}?streams=${this.depthList(this.coins)}`, 'spot book');
    } else {
      const crypto = this.coins.filter((c) => c.venue !== 'equity');
      const equity = this.coins.filter((c) => c.venue === 'equity');
      if (crypto.length) {
        this.openCombined(BINANCE_FUTURES_WS, crypto, 'trade', 'crypto perp');
        this.openSocket(`${BINANCE_FUTURES_WS}?streams=${this.depthList(crypto)}`, 'crypto book');
        this.openSocket(`${BINANCE_FUTURES_WS}?streams=!forceOrder@arr`, 'liquidations');
      }
      // TradFi equity perps (https://www.binance.com/en/futures/AMZNUSDT) need /ws/, not combined /stream.
      if (equity.length) {
        this.openRawCombined(equity, 'trade', 'equity perp');
        this.openSocket(`${BINANCE_FUTURES_WS}?streams=${this.depthList(equity)}`, 'equity book');
      }
    }

    this.coins.forEach((coin, i) => {
      setTimeout(() => {
        if (!this.closed) void this.syncSymbolBook(coin.symbol);
      }, i * 200);
    });
  }

  private resetDepthSync(): void {
    this.depthBuffers.clear();
    this.depthSynced.clear();
    this.depthSyncing.clear();
  }

  private streamList(coins: WatchCoin[], tradeChannel: string): string {
    // Book depth is a separate socket. bookTicker is top-of-book and must
    // never be applied as a full snapshot — LocalOrderBook.applySnapshot clears
    // all levels, which wiped the ladder between depth updates and poisoned
    // passive / market-battle confidence.
    return coins.map((c) => streamName(c.symbol, tradeChannel)).join('/');
  }

  private depthList(coins: WatchCoin[]): string {
    return coins.map((c) => streamName(c.symbol, 'depth@100ms')).join('/');
  }

  private openCombined(base: string, coins: WatchCoin[], tradeChannel: string, label: string): void {
    this.openSocket(`${base}?streams=${this.streamList(coins, tradeChannel)}`, label);
  }

  private openRawCombined(coins: WatchCoin[], tradeChannel: string, label: string): void {
    this.openSocket(`${BINANCE_FUTURES_WS_RAW}/${this.streamList(coins, tradeChannel)}`, label);
  }

  private openSocket(url: string, label: string): void {
    const ws = new WebSocket(url);
    this.sockets.push(ws);

    ws.on('open', () => this.setVenueUp('binance', true));

    ws.on('message', (raw) => this.onSocketMessage(raw));

    ws.on('close', () => {
      const idx = this.sockets.indexOf(ws);
      if (idx >= 0) this.sockets.splice(idx, 1);
      if (this.closed) return;
      if (this.sockets.length === 0) this.setVenueUp('binance', false);
      setTimeout(() => {
        if (!this.closed) this.openSocket(url, label);
      }, 2_000);
    });

    ws.on('error', () => {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          safeCloseWebSocket(ws);
        }
      } catch {
        /* ignore */
      }
    });
  }

  private onSocketMessage(raw: WebSocket.RawData): void {
    const { market } = this.config;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }
    const stream = String(msg.stream ?? '');
    const data = unwrapBinancePayload(msg);
    if (!data) return;
    const event = data.e as string | undefined;
    const symbol = String(data.s ?? stream.split('@')[0] ?? '').toUpperCase();

    if (event === 'depthUpdate' && Array.isArray(data.b) && Array.isArray(data.a)) {
      this.onDepthDiff(data as unknown as BinanceDepthDelta);
    }

    if (event === 'forceOrder' || stream.includes('forceOrder')) {
      const raw = (data.o ? data : { e: 'forceOrder', E: Date.now(), o: data }) as unknown as BinanceForceOrder;
      if (raw?.o?.s) {
        const liq = this.futures.normalizeForceOrder(raw);
        if (this.coins.some((c) => c.symbol === liq.symbol)) {
          this.engine.ingestLiquidation(liq);
          for (const listener of this.rawLiqListeners) {
            try {
              listener(liq);
            } catch (err) {
              console.error('[feed] liquidation listener failed:', err instanceof Error ? err.message : err);
            }
          }
        }
      }
    }

    if (!symbol) return;

    if (event === 'aggTrade') {
      const trade =
        market === 'spot'
          ? this.spot.normalizeAggTrade(data as unknown as BinanceAggTrade)
          : this.futures.normalizeAggTrade(data as unknown as BinanceAggTrade);
      this.handleTrade(trade);
    }

    if (event === 'trade') {
      const trade =
        market === 'spot'
          ? this.spot.normalizeTrade(data as unknown as BinanceTrade)
          : this.futures.normalizeTrade(data as unknown as BinanceTrade);
      this.handleTrade(trade);
    }

    // Ignore bookTicker if it arrives on a shared socket — top-of-book only.
    if (event === 'bookTicker' || stream.includes('bookTicker')) return;

    const now = Date.now();
    if (now - this.lastSummary >= this.config.summaryMs) {
      this.lastSummary = now;
      this.emitAllSummaries(now);
    }
  }

  /**
   * Whether this venue's trades should reach the analysis engine.
   *
   * Normally only the configured venues do. If the primary has gone silent for
   * longer than the fallback window, the fallback venue is admitted too, so a
   * blocked or broken primary degrades the read instead of blanking it.
   */
  private feedsEngine(exchange: ExchangeId): boolean {
    if (this.engineTradeVenues.includes(exchange)) return true;
    const fallback = this.config.engineTradeFallback;
    const windowMs = this.config.engineTradeFallbackMs ?? 0;
    if (!fallback || windowMs <= 0 || exchange !== fallback) return false;
    const primaryAt = Math.max(
      0,
      ...this.engineTradeVenues.map((id) => this.lastEngineTradeAt.get(id) ?? 0),
    );
    // Never seen a primary trade, or it stopped: let the fallback through.
    const silent = primaryAt === 0 ? this.startedAt : primaryAt;
    if (Date.now() - silent <= windowMs) return false;
    if (!this.fallbackAnnounced) {
      this.fallbackAnnounced = true;
      console.warn(
        `[feed] ${this.config.market}: no trades from ${this.engineTradeVenues.join('/')} for ` +
          `${Math.round(windowMs / 1000)}s — feeding the engine from ${fallback} instead.`,
      );
    }
    return true;
  }

  private onDepthDiff(msg: BinanceDepthDelta): void {
    const symbol = String(msg.s || '').toUpperCase();
    if (!symbol || !this.coins.some((c) => c.symbol === symbol)) return;
    if (!this.depthSynced.has(symbol)) {
      const buf = this.depthBuffers.get(symbol) ?? [];
      buf.push(msg);
      if (buf.length > 800) buf.splice(0, buf.length - 800);
      this.depthBuffers.set(symbol, buf);
      if (!this.depthSyncing.has(symbol)) void this.syncSymbolBook(symbol);
      return;
    }
    this.applyDepthDiff(msg);
  }

  /**
   * Binance has no depth500 websocket. Seed REST `/depth?limit=500`, then
   * apply `@depth@100ms` diffs so the ladder stays 500 levels deep.
   */
  private async syncSymbolBook(symbol: string): Promise<void> {
    if (this.closed || this.depthSyncing.has(symbol)) return;
    if (!this.coins.some((c) => c.symbol === symbol)) return;
    this.depthSyncing.add(symbol);
    this.depthSynced.delete(symbol);
    const market = this.config.market === 'spot' ? 'spot' : 'perp';
    try {
      const fetchDepth = this.config.fetchDepth ?? fetchVenueDepth;
      const raw = await fetchDepth('binance', symbol, market, BOOK_DEPTH);
      if (this.closed) return;
      if (!raw.bids.length && !raw.asks.length) throw new Error('empty depth');
      const adapter = market === 'spot' ? this.spot : this.futures;
      const snapshot = adapter.normalizeDepthSnapshot(
        symbol,
        { lastUpdateId: raw.lastUpdateId ?? 0, bids: raw.bids, asks: raw.asks },
        Date.now(),
      );
      const lastId = snapshot.lastUpdateId ?? 0;
      const buffered = this.depthBuffers.get(symbol) ?? [];
      const start = buffered.findIndex((e) =>
        market === 'spot' ? e.U <= lastId + 1 && e.u >= lastId + 1 : e.U <= lastId && e.u >= lastId,
      );
      this.engine.ingestBookSnapshot(snapshot);
      this.engine.getSymbol(symbol, market).book.retainNearest(BOOK_DEPTH);
      this.depthBuffers.set(symbol, []);

      if (start < 0) {
        const newer = buffered.filter((e) => e.u > lastId);
        if (newer.length === 0) {
          this.depthSynced.add(symbol);
          this.emitLocalBook(symbol, true);
          return;
        }
        this.depthBuffers.set(symbol, newer.slice(-800));
        setTimeout(() => {
          if (!this.closed) void this.syncSymbolBook(symbol);
        }, 400);
        return;
      }

      this.depthSynced.add(symbol);
      for (const ev of buffered.slice(start)) {
        if (!this.depthSynced.has(symbol)) break;
        if (!this.applyDepthDiff(ev, false)) break;
      }
      if (this.depthSynced.has(symbol)) this.emitLocalBook(symbol, true);
      else {
        setTimeout(() => {
          if (!this.closed) void this.syncSymbolBook(symbol);
        }, 400);
      }
    } catch (err) {
      console.warn(
        `[feed] depth ${BOOK_DEPTH} snapshot failed for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
      setTimeout(() => {
        if (!this.closed) void this.syncSymbolBook(symbol);
      }, 2_000);
    } finally {
      this.depthSyncing.delete(symbol);
    }
  }

  private applyDepthDiff(msg: BinanceDepthDelta, resync = true): boolean {
    const market = this.config.market === 'spot' ? 'spot' : 'perp';
    const delta = market === 'spot' ? this.spot.normalizeDepthDelta(msg) : this.futures.normalizeDepthDelta(msg);
    const book = this.engine.getSymbol(delta.symbol, market).book;
    const prevId = book.lastUpdateId;
    if (msg.pu != null && prevId && msg.pu > prevId) {
      this.depthSynced.delete(delta.symbol);
      if (resync && !this.depthSyncing.has(delta.symbol)) void this.syncSymbolBook(delta.symbol);
      return false;
    }
    this.engine.ingestBookDelta(delta);
    if (book.stale) {
      book.stale = false;
      this.depthSynced.delete(delta.symbol);
      if (resync && !this.depthSyncing.has(delta.symbol)) void this.syncSymbolBook(delta.symbol);
      return false;
    }
    book.retainNearest(BOOK_DEPTH);
    this.emitLocalBook(delta.symbol);
    return true;
  }

  private emitLocalBook(symbol: string, force = false): void {
    const now = Date.now();
    if (!force && now - (this.lastBookEmit.get(symbol) ?? 0) < 300) return;
    this.lastBookEmit.set(symbol, now);
    const market = this.config.market === 'spot' ? 'spot' : 'perp';
    const book = this.engine.getSymbol(symbol, market).book;
    const bids = book.sortedLevels('bid').slice(0, BOOK_DEPTH);
    const asks = book.sortedLevels('ask').slice(0, BOOK_DEPTH);
    if (!bids.length && !asks.length) return;
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
    this.emit({
      type: 'book',
      symbol,
      bids,
      asks,
      mid,
      spread: bestBid && bestAsk ? bestAsk - bestBid : 0,
      bidTotal: bids.reduce((s, l) => s + l.quoteValue, 0),
      askTotal: asks.reduce((s, l) => s + l.quoteValue, 0),
    });
  }

  private handleTrade(trade: MarketTrade, exchange: ExchangeId = 'binance'): void {
    if (!this.coins.some((c) => c.symbol === trade.symbol)) return;
    if (this.feedsEngine(exchange)) {
      this.engine.ingestTrade(trade);
      this.lastEngineTradeAt.set(exchange, Date.now());
    }
    const seqKey = `${exchange}:${trade.symbol}`;
    const next = (this.tradeCount.get(seqKey) ?? 0) + 1;
    this.tradeCount.set(seqKey, next);
    if (exchange === 'binance') this.tradeCount.set(trade.symbol, next);

    for (const listener of this.rawTradeListeners) {
      try {
        listener(trade, exchange);
      } catch (err) {
        console.error('[feed] raw trade listener failed:', err instanceof Error ? err.message : err);
      }
    }

    const floor = minUsdFor(trade.symbol, this.coins);
    if (trade.quoteValue < floor) return;

    let relativeClass = 'NORMAL';
    let tier: number | null = null;
    let tag = '';
    if (exchange === 'binance') {
      const engine = this.engine.getSymbol(trade.symbol, this.config.market);
      const rel = engine.largeTrades.relativeSize(trade.quoteValue);
      tier = engine.largeTrades.absoluteTier(trade.quoteValue);
      relativeClass = rel.classification;
      tag = relativeClass !== 'NORMAL' ? relativeClass : '';
      if (tier) tag = tag ? `${tag} T${tier}` : `T${tier}`;
    }

    this.emit({
      type: 'trade',
      trade: {
        id: `${exchange}-${trade.symbol}-${trade.tradeId ?? trade.timestamp}-${next}`,
        symbol: trade.symbol,
        timestamp: trade.timestamp,
        side: trade.side,
        price: trade.price,
        quoteValue: trade.quoteValue,
        tag,
        relativeClass,
        tier,
        exchange,
        market: this.config.market,
      },
    });
  }

  private handleVenueTrade(trade: MarketTrade, exchange: ExchangeId): void {
    if (this.coins.some((c) => c.symbol === trade.symbol && c.venue === 'equity')) return;
    this.handleTrade(trade, exchange);
  }

  private setVenueUp(exchange: ExchangeId, connected: boolean): void {
    this.venueUp[exchange] = connected;
    const live = this.exchanges.filter((id) => this.venueUp[id]).map((id) => EXCHANGE_LABELS[id]);
    this.emit({
      type: 'status',
      connected: live.length > 0,
      message: live.length
        ? `Live · ${live.join(' · ')}`
        : `Disconnected (${EXCHANGE_LABELS[exchange]}) — reconnecting…`,
    });
  }

  private emitAllSummaries(now: number): void {
    const overview: CoinOverview[] = [];

    for (const coin of this.coins) {
      const engine = this.engine.getSymbol(coin.symbol, this.config.market);
      const full = {
        '10s': engine.snapshot('10s', now),
        '30s': engine.snapshot('30s', now),
        '1m': engine.snapshot('1m', now),
        '5m': engine.snapshot('5m', now),
        '15m': engine.snapshot('15m', now),
      };
      const windows = {
        '10s': stripPassive(full['10s']),
        '30s': stripPassive(full['30s']),
        '1m': stripPassive(full['1m']),
        '5m': stripPassive(full['5m']),
        '15m': stripPassive(full['15m']),
      };

      const passive = full['1m'].passiveLiquidity;
      if (passive.mid > 0) {
        this.emit({ type: 'passive_liquidity', symbol: coin.symbol, snapshot: passive });
      }

      const states = this.lastStates.get(coin.symbol) ?? {};
      for (const key of ['10s', '1m', '5m'] as const) {
        // Use the full window for alerts — WireWindowSnapshot omits passiveLiquidity.
        const w = full[key];
        const prev = states[key] ?? null;
        if (w.state !== prev && w.state !== 'NO_SIGNAL' && isVolatileWindow(w)) {
          this.emit({
            type: 'state_change',
            symbol: coin.symbol,
            window: key,
            state: w.state,
            delta: w.delta,
            previousState: prev,
          });
        }
        states[key] = w.state;
      }
      this.lastStates.set(coin.symbol, states);

      overview.push({
        symbol: coin.symbol,
        label: coin.label,
        price: windows['10s'].price,
        delta10s: windows['10s'].delta,
        state10s: windows['10s'].state,
      });

      this.emit({
        type: 'summary',
        summary: {
          timestamp: now,
          symbol: coin.symbol,
          market: this.config.market,
          price: windows['10s'].price,
          tradeCount: this.tradeCount.get(coin.symbol) ?? 0,
          windows,
        },
      });
    }

    this.emit({ type: 'overview', coins: overview });
  }

  private emit(event: LiveFeedEvent): void {
    const tagged = { ...event, market: this.config.market === 'spot' ? 'spot' : 'perp' };
    for (const l of this.listeners) l(tagged as LiveFeedEvent);
  }
}

export { DEFAULT_WATCHLIST };
export function defaultMinUsd(symbol: string): number {
  return minUsdFor(symbol);
}
