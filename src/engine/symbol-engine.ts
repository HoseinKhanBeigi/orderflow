import type { EngineConfig } from '../config/types.js';
import { IntegrityMonitor } from '../core/integrity.js';
import { AbsorptionEngine } from '../analysis/absorption-engine.js';
import { buildAlerts } from '../analysis/alerts.js';
import { ConfidenceEngine } from '../analysis/confidence-engine.js';
import { FlowScoreEngine } from '../analysis/flow-score-engine.js';
import { LargeParticipantFlowEngine } from '../analysis/large-participant-flow-engine.js';
import { PriceImpactEngine } from '../analysis/price-impact-engine.js';
import { StateClassifier } from '../analysis/state-classifier.js';
import { BurstDetector } from '../flow/burst-detector.js';
import { FlowClusterDetector } from '../flow/cluster-detector.js';
import { CVDEngine } from '../flow/cvd-engine.js';
import { LargeTradeDetector } from '../flow/large-trade-detector.js';
import { detectPersistentFlow } from '../flow/persistent-flow.js';
import { buildNetAggression } from '../flow/net-aggression.js';
import { RollingFlowEngine } from '../flow/rolling-flow-engine.js';
import { LargeTradeTape } from '../flow/tape.js';
import { ConsumptionEngine } from '../liquidity/consumption-engine.js';
import { DefenseEngine } from '../liquidity/defense-engine.js';
import { IcebergLikeDetector } from '../liquidity/iceberg-detector.js';
import { LiquidityEngine } from '../liquidity/liquidity-engine.js';
import { LocalOrderBook } from '../liquidity/local-order-book.js';
import { MovePotentialEngine } from '../movement/move-potential-engine.js';
import { PassiveFlowEngine } from '../passive-flow/passive-flow-engine.js';
import { FlowWinnerEngine } from '../flow-battle/flow-winner-engine.js';
import { MarketBattleEngine } from '../market-battle/engine.js';
import { MarketFuelEngine } from '../market-fuel/engine.js';
import {
  evaluateTradeDecision,
  emptyTradeDecisionWait,
} from '../trade-decision/index.js';
import { AggressiveFlowEngine } from '../aggressive-flow/engine.js';
import {
  LocationContextEngine,
  type LocationBarLike,
} from '../location-context/index.js';
import { emptyLocationContext } from '../models/location-context.js';
import { evaluateStructureDefense, emptyLiveDefense } from '../live-defense/index.js';
import {
  evaluatePathContext,
  emptyPathContext,
  type PathZoneRef,
} from '../path-context/index.js';
import {
  evaluateLiquidationFlow,
  LiquidationFlowHistory,
} from '../liquidation-flow/index.js';
import {
  evaluateFailureReclaim,
  emptyFailureReclaim,
  type ReferenceLevel,
  type FailureReclaimSnapshot,
} from '../failure-reclaim/index.js';
import { emptyPassiveMetrics } from '../models/passive.js';
import { LiquidityResponseEngine } from '../liquidity-response/engine.js';
import { PassiveLiquidityEngine } from '../passive-liquidity/engine.js';
import type { PassiveLiquiditySnapshot } from '../models/passive-liquidity.js';
import type {
  AlertEvent,
  MultiWindowSnapshot,
  WindowSnapshot,
} from '../models/signals.js';
import type { LargeAggressiveTradeEvent, LargeTradeCluster, TapeFilter, TapeEntry } from '../models/flow.js';
import type { FlowBurst } from '../models/flow.js';
import type { IcebergLikeFlag, MovePotentialEventType } from '../models/liquidity.js';
import type {
  AccelerationLabel,
  LiquidationEvent,
  MarketTrade,
  MarketType,
  OrderBookDelta,
  OrderBookSnapshot,
  WindowId,
} from '../models/trade.js';
import { WINDOW_MS } from '../models/trade.js';

export type EngineListener = (event: EngineEvent) => void;

export type EngineEvent =
  | { kind: 'large_trade'; event: LargeAggressiveTradeEvent }
  | { kind: 'burst'; burst: FlowBurst; symbol: string }
  | { kind: 'cluster'; cluster: LargeTradeCluster; symbol: string }
  | { kind: 'iceberg_like'; flag: IcebergLikeFlag; symbol: string }
  | { kind: 'alert'; alert: AlertEvent }
  | { kind: 'snapshot'; snapshot: WindowSnapshot }
  | { kind: 'move_potential'; symbol: string; events: MovePotentialEventType[] };

interface SamePriceBuf {
  side: 'BUY' | 'SELL';
  prices: number[];
  notionals: number[];
}

export class SymbolEngine {
  readonly book = new LocalOrderBook();
  readonly integrity: IntegrityMonitor;
  readonly rolling: RollingFlowEngine;
  readonly largeTrades: LargeTradeDetector;
  readonly bursts: BurstDetector;
  readonly clusters: FlowClusterDetector;
  readonly cvd: CVDEngine;
  readonly tape: LargeTradeTape;
  readonly liquidity: LiquidityEngine;
  readonly consumption: ConsumptionEngine;
  readonly iceberg: IcebergLikeDetector;
  readonly priceImpact: PriceImpactEngine;
  readonly absorption: AbsorptionEngine;
  readonly participant: LargeParticipantFlowEngine;
  readonly directional: FlowScoreEngine;
  readonly confidence: ConfidenceEngine;
  readonly states: StateClassifier;
  readonly movePotential: MovePotentialEngine;
  readonly passive: PassiveFlowEngine;
  readonly defense: DefenseEngine;
  readonly flowWinner: FlowWinnerEngine;
  readonly liquidityResponse: LiquidityResponseEngine;
  readonly passiveLiquidity: PassiveLiquidityEngine;
  readonly marketBattle: MarketBattleEngine;
  readonly marketFuel: MarketFuelEngine;
  readonly aggressiveFlow: AggressiveFlowEngine;
  readonly locationContext = new LocationContextEngine();
  private readonly liquidationFlowHistory = new Map<WindowId, LiquidationFlowHistory>();
  private failureReclaimPrior: FailureReclaimSnapshot | null = null;

  private readonly listeners = new Set<EngineListener>();
  /**
   * The passive liquidity snapshot is window-independent, so it is computed once
   * per timestamp and shared across every window in a multi-window emit.
   */
  private passiveCache: { at: number; snapshot: PassiveLiquiditySnapshot } | null = null;
  private sequenceGaps = 0;
  private reconnects = 0;
  private lastBuyVolume = 0;
  private lastSellVolume = 0;
  private lastDeltaSign = 0;
  private recentFlip = false;
  private priorAccelBuy: AccelerationLabel = 'NONE';
  private priorAccelSell: AccelerationLabel = 'NONE';
  private readonly samePrice: SamePriceBuf = { side: 'BUY', prices: [], notionals: [] };
  private lastIceberg: IcebergLikeFlag | null = null;
  private lastBurst: FlowBurst | null = null;
  private lastNow = 0;
  private lastLargeBuyCount = 0;
  private lastLargeSellCount = 0;
  private readonly lastVolatile = new Map<WindowId, boolean>();

  constructor(
    readonly symbol: string,
    readonly marketType: MarketType,
    readonly config: EngineConfig,
  ) {
    this.integrity = new IntegrityMonitor(
      config.integrity.duplicateWindow,
      config.integrity.maxOutOfOrderMs,
    );
    this.rolling = new RollingFlowEngine(config);
    this.largeTrades = new LargeTradeDetector(config);
    this.bursts = new BurstDetector(config.burst);
    this.clusters = new FlowClusterDetector(config.cluster);
    this.cvd = new CVDEngine(config.cvdSlopeMs);
    this.tape = new LargeTradeTape(config.tapeCapacity);
    this.liquidity = new LiquidityEngine(config.pressure);
    this.consumption = new ConsumptionEngine(60_000);
    this.iceberg = new IcebergLikeDetector(config.iceberg);
    this.priceImpact = new PriceImpactEngine(config.priceImpact);
    this.absorption = new AbsorptionEngine(config.absorption, config.samePrice);
    this.participant = new LargeParticipantFlowEngine(config.participantWeights);
    this.directional = new FlowScoreEngine(config.directionalWeights);
    this.confidence = new ConfidenceEngine(config.confidence);
    this.states = new StateClassifier(config.vacuum, config.exhaustion);
    this.movePotential = new MovePotentialEngine(config);
    this.passive = new PassiveFlowEngine();
    this.defense = new DefenseEngine(config.flowBattle);
    this.flowWinner = new FlowWinnerEngine(config.flowBattle, this.defense);
    this.liquidityResponse = new LiquidityResponseEngine(config.liquidityResponse);
    this.passiveLiquidity = new PassiveLiquidityEngine(
      symbol,
      config.passiveLiquidity,
      config.liquidityResponse.percentileBands,
    );
    this.marketBattle = new MarketBattleEngine();
    this.marketFuel = new MarketFuelEngine(config.marketFuel);
    this.aggressiveFlow = new AggressiveFlowEngine(
      config.marketBattle,
      60_000,
      config.historicalBaselineSamples,
    );
  }

  on(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ingestTrade(trade: MarketTrade): void {
    if (trade.symbol !== this.symbol) return;
    this.integrity.clearTransient();
    if (!this.integrity.acceptTradeId(trade.tradeId, trade.timestamp, Date.now())) return;

    this.lastNow = trade.timestamp;

    const relative = this.largeTrades.relativeSize(trade.quoteValue);
    this.largeTrades.observe(trade);
    const isLarge = this.largeTrades.isLarge(trade, relative);

    if (isLarge) {
      if (trade.isAggressiveBuy) this.lastLargeBuyCount += 1;
      else this.lastLargeSellCount += 1;
      this.tape.push({
        timestamp: trade.timestamp,
        side: trade.side,
        price: trade.price,
        quoteValue: trade.quoteValue,
        relativeClass: relative.classification,
        symbol: trade.symbol,
      });
      const event = this.largeTrades.maybeEvent(trade, relative);
      if (event) this.emit({ kind: 'large_trade', event });
    }

    this.rolling.onTrade(
      trade.timestamp,
      trade.side,
      trade.quoteValue,
      trade.price,
      isLarge,
      Boolean(trade.isForced),
    );
    this.cvd.onTrade(
      trade.timestamp,
      trade.isAggressiveBuy ? trade.quoteValue : 0,
      trade.isAggressiveSell ? trade.quoteValue : 0,
      trade.price,
    );

    const burst = this.bursts.onTrade(trade, relative.vsMedian);
    if (burst) {
      this.lastBurst = burst;
      this.emit({ kind: 'burst', burst, symbol: this.symbol });
    }
    const cluster = this.clusters.onTrade(trade, isLarge);
    if (cluster) this.emit({ kind: 'cluster', cluster, symbol: this.symbol });

    this.trackSamePrice(trade);

    this.liquidityResponse.onTrade(trade, isLarge);
    this.passiveLiquidity.onTrade(trade);
    this.aggressiveFlow.onTrade(trade.timestamp, trade.side, trade.quoteValue, trade.price, isLarge);

    if (!this.book.empty()) {
      const flag = this.iceberg.onTrade(trade, this.book);
      if (flag) {
        this.lastIceberg = flag;
        this.emit({ kind: 'iceberg_like', flag, symbol: this.symbol });
      }
    }

    this.updateLiquidityPath(trade.timestamp);
    this.updateFlip(trade.timestamp);
  }

  ingestBookSnapshot(snapshot: OrderBookSnapshot): void {
    this.book.applySnapshot(snapshot);
    this.integrity.lastBookTimestamp = snapshot.timestamp;
    this.integrity.lastBookReceivedAt = Date.now();
    this.integrity.flags.delete('staleBook');
    this.integrity.flags.delete('missingData');
    this.checkSpread();
    this.rolling.touchPrice(snapshot.timestamp, this.book.mid());
    this.updateLiquidityPath(snapshot.timestamp);
  }

  ingestBookDelta(delta: OrderBookDelta): void {
    const result = this.book.applyDelta(delta);
    this.integrity.lastBookTimestamp = delta.timestamp;
    this.integrity.lastBookReceivedAt = Date.now();
    // A delta that lands on a populated book proves data is flowing again.
    // Without this the flag set by one empty-book moment never clears on
    // symbols that are fed by deltas rather than repeated snapshots.
    if (!this.book.empty()) this.integrity.flags.delete('missingData');
    if (result.gap) {
      this.integrity.noteSequenceGap(delta.timestamp);
      // Incremental state is no longer trustworthy: stop attributing book
      // changes until a fresh snapshot restores continuity.
      this.sequenceGaps += 1;
      this.passiveLiquidity.noteReset(delta.timestamp);
    }
    this.checkSpread();
    this.rolling.touchPrice(delta.timestamp, this.book.mid());
    this.updateLiquidityPath(delta.timestamp);
  }

  ingestLiquidation(liq: LiquidationEvent): void {
    this.ingestTrade({
      symbol: liq.symbol,
      marketType: liq.marketType,
      timestamp: liq.timestamp,
      price: liq.price,
      quantity: liq.quantity,
      quoteValue: liq.quoteValue,
      side: liq.side,
      isAggressiveBuy: liq.side === 'BUY',
      isAggressiveSell: liq.side === 'SELL',
      isForced: true,
    });
  }

  noteReconnect(now: number): void {
    this.integrity.noteReconnect(now);
    this.liquidityResponse.noteReset(now);
    this.reconnects += 1;
    this.passiveLiquidity.noteReset(now);
  }

  snapshot(window: WindowId, now = this.lastNow): WindowSnapshot {
    this.refreshIntegrity(now);
    const view = this.rolling.view(window, now);
    const agg = view.agg;
    const priceEnd = agg.priceClose || this.book.mid() || 0;
    const priceStart = agg.priceOpen || priceEnd;
    const impact = this.priceImpact.measure(priceStart, priceEnd, view.delta.delta);
    const pressure = this.liquidity.pressure(agg.buyVolume, agg.sellVolume, this.book);
    const rates = this.consumption.rates();
    const burstNow = this.bursts.current(now);
    const buyBurst = Boolean(burstNow && burstNow.side === 'BUY');
    const sellBurst = Boolean(burstNow && burstNow.side === 'SELL');
    const persistent = detectPersistentFlow(
      agg,
      view.windowMs,
      view.flowMultipleBuy,
      view.flowMultipleSell,
      this.config.persistent,
    );

    const sameBuy = this.samePrice.side === 'BUY' && this.absorption.samePriceHit(
      'BUY',
      this.samePrice.prices,
      this.samePrice.notionals,
      priceStart,
      priceEnd,
    );
    const sameSell = this.samePrice.side === 'SELL' && this.absorption.samePriceHit(
      'SELL',
      this.samePrice.prices,
      this.samePrice.notionals,
      priceStart,
      priceEnd,
    );

    const absorption = this.absorption.detect({
      delta: view.delta.delta,
      deltaPercent: view.delta.deltaPercent,
      flowMultipleBuy: Number.isFinite(view.flowMultipleBuy) ? view.flowMultipleBuy : 99,
      flowMultipleSell: Number.isFinite(view.flowMultipleSell) ? view.flowMultipleSell : 99,
      priceChangePercent: impact.percentagePriceChange,
      impactEfficiency: impact.efficiency,
      buyBurst,
      sellBurst,
      persistentBuy: persistent.persistentBuyFlow,
      persistentSell: persistent.persistentSellFlow,
      askReplenishmentRatio: this.consumption.replenishmentRatio('ask'),
      bidReplenishmentRatio: this.consumption.replenishmentRatio('bid'),
      samePriceBuy: sameBuy,
      samePriceSell: sameSell,
      icebergSellAbsorption: this.lastIceberg?.type === 'ICEBERG_LIKE_SELL_ABSORPTION',
      icebergBuyAbsorption: this.lastIceberg?.type === 'ICEBERG_LIKE_BUY_ABSORPTION',
    });

    const largeBuy = this.isUnusualLarge(
      view.flowMultipleBuy,
      view.buyFlowPercentile,
      agg.largeBuyVolume,
      agg.largestBuy,
    );
    const largeSell = this.isUnusualLarge(
      view.flowMultipleSell,
      view.sellFlowPercentile,
      agg.largeSellVolume,
      agg.largestSell,
    );

    const cvd = this.cvd.snapshot(now);
    const participant = this.participant.score({
      largeBuyCount: this.lastLargeBuyCount,
      largeSellCount: this.lastLargeSellCount,
      largeBuyVolume: agg.largeBuyVolume,
      largeSellVolume: agg.largeSellVolume,
      buyVolume: agg.buyVolume,
      sellVolume: agg.sellVolume,
      largeBuyShare: view.shares.largeBuyFlowShare,
      largeSellShare: view.shares.largeSellFlowShare,
      maxPercentileRank: Math.max(view.buyFlowPercentile, view.sellFlowPercentile),
      buyBurstStrength: buyBurst ? burstNow?.strength ?? 0.6 : 0,
      sellBurstStrength: sellBurst ? burstNow?.strength ?? 0.6 : 0,
      persistentBuy: persistent.persistentBuyFlow,
      persistentSell: persistent.persistentSellFlow,
      deltaPercent: view.delta.deltaPercent,
      impactEfficiency: impact.efficiency,
      askConsumption: rates.askConsumptionRate,
      bidConsumption: rates.bidConsumptionRate,
      buyPressure: pressure.buyPressure,
      sellPressure: pressure.sellPressure,
    });

    const directional = this.directional.score({
      deltaPercent: view.delta.deltaPercent,
      largeBuyShare: view.shares.largeBuyFlowShare,
      largeSellShare: view.shares.largeSellFlowShare,
      buyBurstStrength: buyBurst ? burstNow?.strength ?? 0.6 : 0,
      sellBurstStrength: sellBurst ? burstNow?.strength ?? 0.6 : 0,
      persistentBuy: persistent.persistentBuyFlow,
      persistentSell: persistent.persistentSellFlow,
      cvdSlopeSign: Math.sign(cvd.slope),
      askConsumption: rates.askConsumptionRate,
      bidConsumption: rates.bidConsumptionRate,
      priceChangePercent: impact.percentagePriceChange,
      impactEfficiency: impact.efficiency,
      accelerationBuy: view.largeBuyFlowAcceleration,
      accelerationSell: view.largeSellFlowAcceleration,
    });

    const conf = this.confidence.score({
      flags: this.integrity.flags,
      tradeCount: agg.buyCount + agg.sellCount,
      bookEmpty: this.book.empty(),
      spreadBps: this.book.spreadBps(),
      maxSpreadBps: this.config.integrity.maxSpreadBps,
      deltaPercent: view.delta.deltaPercent,
      priceChangePercent: impact.percentagePriceChange,
      impactEfficiency: impact.efficiency,
      recentFlip: this.recentFlip,
    });

    const state = this.states.classify({
      window,
      absorption,
      buyBurst,
      sellBurst,
      persistentBuy: persistent.persistentBuyFlow,
      persistentSell: persistent.persistentSellFlow,
      largeBuy,
      largeSell,
      flowMultipleBuy: view.flowMultipleBuy,
      flowMultipleSell: view.flowMultipleSell,
      buyPressure: pressure.buyPressure,
      sellPressure: pressure.sellPressure,
      priceChangePercent: impact.percentagePriceChange,
      impactEfficiency: impact.efficiency,
      accelerationBuy: view.largeBuyFlowAcceleration,
      accelerationSell: view.largeSellFlowAcceleration,
      priorAccelerationBuy: this.priorAccelBuy,
      priorAccelerationSell: this.priorAccelSell,
    });

    this.priorAccelBuy = view.largeBuyFlowAcceleration;
    this.priorAccelSell = view.largeSellFlowAcceleration;

    const band = this.config.pressure.nearBandPct;
    const mid = this.book.mid() || priceEnd;
    const visibleAsk = this.book.notionalWithin('ask', mid, band);
    const visibleBid = this.book.notionalWithin('bid', mid, band);
    const liqWin = this.passive.window(now, WINDOW_MS[window]);
    const metrics = {
      ...emptyPassiveMetrics(),
      passiveBuyExecutedVolume: agg.sellVolume,
      passiveSellExecutedVolume: agg.buyVolume,
      bidLiquidityAdded: liqWin.bidLiquidityAdded,
      askLiquidityAdded: liqWin.askLiquidityAdded,
      bidLiquidityRemoved: liqWin.bidLiquidityRemoved,
      askLiquidityRemoved: liqWin.askLiquidityRemoved,
      bidLiquidityConsumed: rates.bidConsumptionRate,
      askLiquidityConsumed: rates.askConsumptionRate,
      bidLiquidityReplenished: rates.bidReplenishmentRate,
      askLiquidityReplenished: rates.askReplenishmentRate,
      bidLiquidityInitial: liqWin.bidLiquidityInitial,
      askLiquidityInitial: liqWin.askLiquidityInitial,
      bidLiquidityFinal: liqWin.bidLiquidityFinal || visibleBid,
      askLiquidityFinal: liqWin.askLiquidityFinal || visibleAsk,
    };
    const flowBattle = this.flowWinner.analyze({
      price: priceEnd,
      aggressiveBuy: agg.buyVolume,
      aggressiveSell: agg.sellVolume,
      delta: view.delta.delta,
      priceChangePercent: impact.percentagePriceChange,
      impact: impact.efficiency,
      flowMultipleBuy: Number.isFinite(view.flowMultipleBuy) ? view.flowMultipleBuy : 1,
      flowMultipleSell: Number.isFinite(view.flowMultipleSell) ? view.flowMultipleSell : 1,
      buyBurst,
      sellBurst,
      persistentBuy: persistent.persistentBuyFlow,
      persistentSell: persistent.persistentSellFlow,
      windowMs: WINDOW_MS[window],
      absorption,
      iceberg: this.lastIceberg,
      visibleAsk,
      visibleBid,
      metrics,
    });

    const liquidityResponse = this.liquidityResponse.snapshot({
      now,
      windowMs: WINDOW_MS[window],
      buy: agg.buyVolume,
      sell: agg.sellVolume,
      buyCount: agg.buyCount,
      sellCount: agg.sellCount,
      largeBuyCount: this.lastLargeBuyCount,
      largeSellCount: this.lastLargeSellCount,
      priceStart,
      priceEnd,
      priceHigh: agg.priceHigh || Math.max(priceStart, priceEnd),
      priceLow: agg.priceLow || Math.min(priceStart, priceEnd),
      cvdDirection: cvd.direction,
      shortLiquidationUsd: agg.forcedBuyVolume,
      longLiquidationUsd: agg.forcedSellVolume,
      flags: this.integrity.flags,
      bookEmpty: this.book.empty(),
      // Ages are measured against local receive time. Exchange event time comes
      // from a different clock, so subtracting it from Date.now() reports skew
      // as staleness.
      lastTradeAgeMs: this.integrity.lastTradeReceivedAt
        ? Math.max(0, now - this.integrity.lastTradeReceivedAt)
        : 0,
      lastBookAgeMs: this.integrity.lastBookReceivedAt
        ? Math.max(0, now - this.integrity.lastBookReceivedAt)
        : 0,
      exchangeCount: 1,
      oiExpected: this.marketType === 'perp',
      liquidationExpected: this.marketType === 'perp',
    });

    const netAggression = buildNetAggression({
      window,
      buyVolume: agg.buyVolume,
      sellVolume: agg.sellVolume,
      buyCount: agg.buyCount,
      sellCount: agg.sellCount,
      largeBuyVolume: agg.largeBuyVolume,
      largeSellVolume: agg.largeSellVolume,
      buyPercentile: view.buyFlowPercentile,
      sellPercentile: view.sellFlowPercentile,
      netMagnitudePercentile: liquidityResponse.norms.delta.percentile,
    });

    const passiveLiquidity = this.passiveLiquiditySnapshot(now);
    const tradeDataMissing =
      this.integrity.lastTradeReceivedAt === 0 ||
      this.integrity.flags.has('missingData');
    const tradeAgeMs = this.integrity.tradeAgeMs(now);
    const staleAfterMs = this.tradeStaleThresholdMs();
    const tradeDataLowConfidence = !tradeDataMissing && tradeAgeMs > staleAfterMs;

    const aggressiveFlow = this.aggressiveFlow.snapshot(window, now, {
      tradeDataMissing,
      tradeStale: tradeDataLowConfidence,
    });

    const marketBattle = this.marketBattle.analyze({
      window,
      priceChangePercent: impact.percentagePriceChange,
      priceImpactEfficiency: impact.efficiency,
      confidence: conf,
      tradeDataMissing,
      tradeDataLowConfidence,
      tradeAgeMs: Number.isFinite(tradeAgeMs) ? tradeAgeMs : 0,
      staleAfterMs,
      medianTradeGapMs: this.integrity.medianTradeGapMs(),
      flowBattle,
      liquidityResponse,
      passiveLiquidity,
      netAggression,
      aggressiveFlow,
    });

    const marketFuel = this.marketFuel.snapshot({
      symbol: this.symbol,
      window,
      now,
      aggressiveFlow,
      forcedBuyVolume: agg.forcedBuyVolume,
      forcedSellVolume: agg.forcedSellVolume,
      liquidationFeed: this.marketType === 'perp' ? 'live' : 'not_expected',
      buyBurst,
      sellBurst,
      tradeDataMissing,
      tradeStale: tradeDataLowConfidence,
      sampleConfidence: conf,
    });

    let liqHist = this.liquidationFlowHistory.get(window);
    if (!liqHist) {
      liqHist = new LiquidationFlowHistory();
      this.liquidationFlowHistory.set(window, liqHist);
    }
    liqHist.pushSample(agg.forcedBuyVolume, agg.forcedSellVolume);
    const liquidationFlow = evaluateLiquidationFlow({
      timestamp: now,
      symbol: this.symbol,
      totalAggressiveBuy: agg.buyVolume,
      totalAggressiveSell: agg.sellVolume,
      shortLiquidationBuy: agg.forcedBuyVolume,
      longLiquidationSell: agg.forcedSellVolume,
      feed: this.marketType === 'perp' ? 'live' : 'not_expected',
      buyEffort: marketBattle.upside.aggressive.power ?? marketBattle.upside.aggressive.score,
      sellEffort: marketBattle.downside.aggressive.power ?? marketBattle.downside.aggressive.score,
      askDefense: marketBattle.upside.passive.defensePower ?? marketBattle.upside.passive.strength,
      bidDefense: marketBattle.downside.passive.defensePower ?? marketBattle.downside.passive.strength,
      upResult: marketBattle.upside.price.efficiencyScore,
      downResult: marketBattle.downside.price.efficiencyScore,
      forcedBuyHistory: liqHist.buyHistory(),
      forcedSellHistory: liqHist.sellHistory(),
    });

    const snap: WindowSnapshot = {
      symbol: this.symbol,
      marketType: this.marketType,
      price: priceEnd,
      window,
      aggressiveBuyVolume: agg.buyVolume,
      aggressiveSellVolume: agg.sellVolume,
      buyTradeCount: agg.buyCount,
      sellTradeCount: agg.sellCount,
      averageBuySize: view.shares.averageBuySize,
      averageSellSize: view.shares.averageSellSize,
      delta: view.delta.delta,
      deltaPercent: view.delta.deltaPercent,
      largeBuyVolume: agg.largeBuyVolume,
      largeSellVolume: agg.largeSellVolume,
      largeBuyFlowShare: view.shares.largeBuyFlowShare,
      largeSellFlowShare: view.shares.largeSellFlowShare,
      largestBuy: agg.largestBuy,
      largestSell: agg.largestSell,
      buyBurstDetected: buyBurst,
      sellBurstDetected: sellBurst,
      persistentBuyFlow: persistent.persistentBuyFlow,
      persistentSellFlow: persistent.persistentSellFlow,
      priceStart,
      priceEnd,
      absolutePriceChange: impact.absolutePriceChange,
      priceChangePercent: impact.percentagePriceChange,
      priceImpactEfficiency: impact.efficiency,
      flowMultipleBuy: view.flowMultipleBuy,
      flowMultipleSell: view.flowMultipleSell,
      forcedBuyVolume: agg.forcedBuyVolume,
      forcedSellVolume: agg.forcedSellVolume,
      buyPressure: pressure.buyPressure,
      sellPressure: pressure.sellPressure,
      askReplenishmentRate: rates.askReplenishmentRate,
      bidReplenishmentRate: rates.bidReplenishmentRate,
      askConsumptionRate: rates.askConsumptionRate,
      bidConsumptionRate: rates.bidConsumptionRate,
      largeBuyFlowAcceleration: view.largeBuyFlowAcceleration,
      largeSellFlowAcceleration: view.largeSellFlowAcceleration,
      absorption,
      largeFlowDirectionalScore: directional,
      largeParticipantFlowScore: participant.largeParticipantFlowScore,
      confidence: conf,
      state,
      flowBattle,
      liquidityResponse,
      passiveLiquidity,
      passiveStrength: passiveLiquidity.strength,
      wallMap: passiveLiquidity.wallMap,
      netAggression,
      marketBattle,
      marketFuel,
      locationContext: emptyLocationContext(this.symbol, now),
      liveDefense: emptyLiveDefense(now, priceEnd || priceStart),
      pathContext: emptyPathContext(now, priceEnd || priceStart),
      liquidationFlow,
      failureReclaim: emptyFailureReclaim(now),
      tradeDecision: emptyTradeDecisionWait(this.symbol, window, now),
      movePotential: this.movePotential.evaluate({
        symbol: this.symbol,
        book: this.book,
        buyVolume: agg.buyVolume,
        sellVolume: agg.sellVolume,
        priceHigh: agg.priceHigh,
        priceLow: agg.priceLow,
        impactEfficiency: impact.efficiency,
        absorption,
        dataQualityScore: conf,
      }),
    };

    const locBar: LocationBarLike = {
      time: Math.floor(now / 1000),
      open: priceStart || priceEnd,
      high: agg.priceHigh || Math.max(priceStart, priceEnd),
      low: agg.priceLow || Math.min(priceStart, priceEnd),
      close: priceEnd || priceStart,
      totalBuy: agg.buyVolume,
      totalSell: agg.sellVolume,
    };
    const priorLoc: LocationBarLike[] = [];
    // Historical structure only — do NOT inject live order-book walls (cross-contamination).
    const external: Array<{
      price: number;
      type: 'SUPPORT' | 'RESISTANCE';
      source: 'STRUCTURE_SWING';
      strength: number;
      knownAt: number;
    }> = [];
    const structure = liquidityResponse.structure;
    if (structure?.swingLow != null) {
      external.push({
        price: structure.swingLow,
        type: 'SUPPORT',
        source: 'STRUCTURE_SWING',
        strength: 72,
        knownAt: locBar.time,
      });
    }
    if (structure?.swingHigh != null) {
      external.push({
        price: structure.swingHigh,
        type: 'RESISTANCE',
        source: 'STRUCTURE_SWING',
        strength: 72,
        knownAt: locBar.time,
      });
    }
    snap.locationContext = this.locationContext.evaluate({
      symbol: this.symbol,
      bar: locBar,
      prior: priorLoc,
      externalLevels: external,
      reaction: {
        buyEffort: marketBattle.upside.aggressive.power,
        sellEffort: marketBattle.downside.aggressive.power,
        sellerDefense: marketBattle.upside.passive.defensePower,
        buyerDefense: marketBattle.downside.passive.defensePower,
        upResult: marketBattle.upside.price.efficiencyScore,
        downResult: marketBattle.downside.price.efficiencyScore,
      },
    });

    const loc = snap.locationContext;
    snap.liveDefense = evaluateStructureDefense({
      timestamp: now,
      currentPrice: priceEnd || priceStart,
      wallMap: passiveLiquidity.wallMap,
      nearestSupport: loc.nearestSupport
        ? { price: loc.nearestSupport.price, strength: loc.nearestSupport.strength, distanceBps: loc.nearestSupport.distanceBps }
        : null,
      nearestResistance: loc.nearestResistance
        ? {
            price: loc.nearestResistance.price,
            strength: loc.nearestResistance.strength,
            distanceBps: loc.nearestResistance.distanceBps,
          }
        : null,
      locationState: loc.locationContext,
      buyAttack: marketBattle.upside.aggressive.power,
      sellAttack: marketBattle.downside.aggressive.power,
      upResult: marketBattle.upside.price.efficiencyScore,
      downResult: marketBattle.downside.price.efficiencyScore,
      sellersAbsorbed: liquidityResponse.absorption?.kind === 'SELL_ABSORPTION',
      buyersAbsorbed: liquidityResponse.absorption?.kind === 'BUY_ABSORPTION',
    });

    // Failure/reclaim uses structural levels only — not live book walls.
    const frLevels: ReferenceLevel[] = [];
    if (structure?.swingLow != null) {
      frLevels.push({
        id: `SWING_LOW:${structure.swingLow}`,
        type: 'SWING_LOW',
        price: structure.swingLow,
        significance: 75,
      });
    }
    if (structure?.swingHigh != null) {
      frLevels.push({
        id: `SWING_HIGH:${structure.swingHigh}`,
        type: 'SWING_HIGH',
        price: structure.swingHigh,
        significance: 75,
      });
    }
    if (loc.nearestSupport?.price) {
      frLevels.push({
        id: `HSR_SUP:${loc.nearestSupport.price}`,
        type: 'HISTORICAL_SUPPORT',
        price: loc.nearestSupport.price,
        significance: loc.nearestSupport.strength ?? 60,
      });
    }
    if (loc.nearestResistance?.price) {
      frLevels.push({
        id: `HSR_RES:${loc.nearestResistance.price}`,
        type: 'HISTORICAL_RESISTANCE',
        price: loc.nearestResistance.price,
        significance: loc.nearestResistance.strength ?? 60,
      });
    }
    const buyerControl =
      marketBattle.summary.state === 'BUYERS_IN_CONTROL' ||
      marketBattle.summary.state === 'PASSIVE_BUYERS_DEFENDING'
        ? Math.max(marketBattle.upside.battleScore, marketBattle.downside.passive.defensePower)
        : marketBattle.upside.aggressive.power;
    const sellerControl =
      marketBattle.summary.state === 'SELLERS_IN_CONTROL' ||
      marketBattle.summary.state === 'PASSIVE_SELLERS_DEFENDING'
        ? Math.max(marketBattle.downside.battleScore, marketBattle.upside.passive.defensePower)
        : marketBattle.downside.aggressive.power;
    snap.failureReclaim =
      frLevels.length > 0
        ? evaluateFailureReclaim({
            timestamp: now,
            bar: locBar,
            atr: Math.abs((agg.priceHigh || priceEnd) - (agg.priceLow || priceEnd)) || null,
            levels: frLevels,
            flow: {
              buyEffort: marketBattle.upside.aggressive.power,
              sellEffort: marketBattle.downside.aggressive.power,
              askDefense: marketBattle.upside.passive.defensePower,
              bidDefense: marketBattle.downside.passive.defensePower,
              upResult: marketBattle.upside.price.efficiencyScore,
              downResult: marketBattle.downside.price.efficiencyScore,
              buyerControl,
              sellerControl,
              buyerAbsorbed: absorption.type === 'BUYER_ABSORPTION',
              sellerAbsorbed: absorption.type === 'SELLER_ABSORPTION',
              forcedBuyAbsorbed: liquidationFlow.alert === 'SHORT_LIQUIDATION_BUY_FLOW_ABSORBED',
              forcedSellAbsorbed: liquidationFlow.alert === 'LONG_LIQUIDATION_SELL_FLOW_ABSORBED',
            },
            prior: this.failureReclaimPrior,
          })
        : emptyFailureReclaim(now);
    if (snap.failureReclaim.machineState !== 'NO_SETUP') {
      this.failureReclaimPrior = snap.failureReclaim;
    }

    const px = priceEnd || priceStart;
    const toZone = (
      side: 'SUPPORT' | 'RESISTANCE',
      view: { price: number; strength: number } | null | undefined,
    ): PathZoneRef[] => {
      if (!view || !(view.price > 0)) return [];
      const half = view.price * 0.0008;
      return [
        {
          center: view.price,
          zoneLow: view.price - half,
          zoneHigh: view.price + half,
          strength: view.strength,
          major: view.strength >= 62,
          timeframe: window,
        },
      ];
    };
    const dq = passiveLiquidity.dataQuality;
    const liveBookQuality =
      !dq?.trustworthy || /stale|gap|reconnect/i.test((dq.reasons ?? []).join(' '))
        ? (/stale/i.test((dq?.reasons ?? []).join(' ')) ? 'STALE' : 'PARTIAL')
        : dq.score >= 60
          ? 'GOOD'
          : 'UNKNOWN';
    if (String(marketBattle.dataHealth?.status || '').includes('STALE')) {
      // Prefer trade/book staleness signal from battle health.
    }
    const bookQ = String(marketBattle.dataHealth?.status || '').includes('STALE')
      ? 'STALE'
      : liveBookQuality;

    snap.pathContext = evaluatePathContext({
      currentPrice: px,
      timestamp: now,
      historicalResistances: toZone('RESISTANCE', loc.nearestResistance),
      historicalSupports: toZone('SUPPORT', loc.nearestSupport),
      higherTfAvailable: false,
      higherTfResistances: null,
      higherTfSupports: null,
      minorLevelsHidden: true,
      historyInsufficient: !loc.nearestResistance && !loc.nearestSupport && (loc.dataQuality === 'INSUFFICIENT_DATA'),
      liveAsk: snap.liveDefense.relevantAsk
        ? {
            price: snap.liveDefense.relevantAsk.price,
            strength: snap.liveDefense.relevantAsk.strength,
            notional: null,
            trend: snap.liveDefense.relevantAsk.trend ?? null,
          }
        : null,
      liveBid: snap.liveDefense.relevantBid
        ? {
            price: snap.liveDefense.relevantBid.price,
            strength: snap.liveDefense.relevantBid.strength,
            notional: null,
            trend: snap.liveDefense.relevantBid.trend ?? null,
          }
        : null,
      askLiquidityPresent: !!snap.liveDefense.relevantAsk || (passiveLiquidity.wallMap?.asks?.length ?? 0) > 0,
      bidLiquidityPresent: !!snap.liveDefense.relevantBid || (passiveLiquidity.wallMap?.bids?.length ?? 0) > 0,
      liveBookQuality: bookQ,
      locationState: loc.locationContext,
      interactionState: loc.candleInteraction,
      buyAttack: marketBattle.upside.aggressive.power,
      sellAttack: marketBattle.downside.aggressive.power,
      upResult: marketBattle.upside.price.efficiencyScore,
      downResult: marketBattle.downside.price.efficiencyScore,
    });

    snap.tradeDecision = evaluateTradeDecision(snap, this.config.tradeDecision, { now });

    const alerts = buildAlerts(snap, this.config.alerts, now);
    const volatile = alerts.length > 0;
    const wasVolatile = this.lastVolatile.get(window) ?? false;
    this.lastVolatile.set(window, volatile);
    if (volatile && !wasVolatile) {
      for (const alert of alerts) this.emit({ kind: 'alert', alert });
    }
    if (snap.movePotential.liquidity.events.length) {
      this.emit({
        kind: 'move_potential',
        symbol: this.symbol,
        events: snap.movePotential.liquidity.events,
      });
    }
    return snap;
  }

  multiWindow(now = this.lastNow): MultiWindowSnapshot {
    const windows: MultiWindowSnapshot['windows'] = {};
    let price = 0;
    for (const id of this.config.windows) {
      windows[id] = this.snapshot(id, now);
      price = windows[id]!.price;
    }
    return {
      symbol: this.symbol,
      marketType: this.marketType,
      price,
      timestamp: now,
      windows,
    };
  }

  queryTape(filter: TapeFilter = {}): TapeEntry[] {
    return this.tape.query({ ...filter, symbol: filter.symbol ?? this.symbol });
  }

  formatTape(filter: TapeFilter = {}): string {
    return this.tape.format({ ...filter, symbol: filter.symbol ?? this.symbol });
  }

  seedTradeSizeBaseline(values: number[]): void {
    for (const v of values) this.largeTrades.distribution.add(v);
  }

  seedFlowBaseline(side: 'BUY' | 'SELL', perSecondVolumes: number[]): void {
    this.rolling.seedBaseline(side, perSecondVolumes);
  }

  seedImpactBaseline(impactsPerMillion: number[]): void {
    this.priceImpact.seed(impactsPerMillion);
  }

  private passiveLiquiditySnapshot(now: number): PassiveLiquiditySnapshot {
    if (this.passiveCache && this.passiveCache.at === now) return this.passiveCache.snapshot;
    const snapshot = this.passiveLiquidity.snapshot({
      now,
      reconnects: this.reconnects,
      sequenceGaps: this.sequenceGaps,
      sequenceContinuous: !this.integrity.flags.has('sequenceGap'),
      bookEmpty: this.book.empty(),
      exchangeTimestamp: this.book.timestamp,
    });
    this.passiveCache = { at: now, snapshot };
    return snapshot;
  }

  private isUnusualLarge(
    flowMultiple: number,
    percentile: number,
    largeVolume: number,
    largest: number,
  ): boolean {
    const absTier = this.largeTrades.absoluteTier(largest) !== null;
    const rel = this.largeTrades.classifyPercentile(percentile);
    const multiple = Number.isFinite(flowMultiple) && flowMultiple >= 3;
    return (absTier && largeVolume > 0) || rel === 'LARGE' || rel === 'VERY_LARGE' || rel === 'EXTREME' || multiple;
  }

  private trackSamePrice(trade: MarketTrade): void {
    if (this.samePrice.side !== trade.side) {
      this.samePrice.side = trade.side;
      this.samePrice.prices = [];
      this.samePrice.notionals = [];
    }
    const last = this.samePrice.prices[this.samePrice.prices.length - 1];
    if (last !== undefined) {
      const bps = (Math.abs(trade.price - last) / last) * 10_000;
      if (bps > this.config.samePrice.maxPriceDeviationBps) {
        this.samePrice.prices = [];
        this.samePrice.notionals = [];
      }
    }
    this.samePrice.prices.push(trade.price);
    this.samePrice.notionals.push(trade.quoteValue);
    if (this.samePrice.prices.length > 64) {
      this.samePrice.prices.shift();
      this.samePrice.notionals.shift();
    }
  }

  private updateLiquidityPath(now: number): void {
    if (this.book.empty()) {
      this.integrity.noteMissingData();
      return;
    }
    const mid = this.book.mid();
    const band = this.config.pressure.nearBandPct;
    const ask = this.book.notionalWithin('ask', mid, band);
    const bid = this.book.notionalWithin('bid', mid, band);
    const view = this.rolling.view('1s', now || this.lastNow);
    const buyDelta = Math.max(0, view.agg.buyVolume - this.lastBuyVolume);
    const sellDelta = Math.max(0, view.agg.sellVolume - this.lastSellVolume);
    this.lastBuyVolume = view.agg.buyVolume;
    this.lastSellVolume = view.agg.sellVolume;
    this.consumption.observe(now, bid, ask, buyDelta, sellDelta);
    this.passive.observe(now, bid, ask);
    this.passiveLiquidity.onBook(now, this.book);
    this.movePotential.observe(now, this.book, buyDelta, sellDelta);
    this.liquidityResponse.onBook(now, this.book, buyDelta, sellDelta);
  }

  private updateFlip(now: number): void {
    const view = this.rolling.view('5s', now);
    const sign = Math.sign(view.delta.deltaPercent);
    if (sign !== 0 && this.lastDeltaSign !== 0 && sign !== this.lastDeltaSign) {
      this.recentFlip = true;
    } else if (sign !== 0) {
      this.recentFlip = false;
    }
    if (sign !== 0) this.lastDeltaSign = sign;
  }

  /**
   * How long a symbol may go without a print before its flow read is stale.
   *
   * A flat threshold assumes every symbol trades like BTC. Thin books can
   * legitimately go tens of seconds between prints, so scale off the symbol's
   * own observed cadence and keep the configured value as the floor.
   */
  private tradeStaleThresholdMs(): number {
    const floor = this.config.marketBattle.tradeStaleMs;
    const median = this.integrity.medianTradeGapMs();
    if (median <= 0) return floor;
    return Math.min(
      this.config.marketBattle.maxTradeStaleMs,
      Math.max(floor, median * this.config.marketBattle.tradeStaleGapMultiple),
    );
  }

  private refreshIntegrity(now: number): void {
    if (!this.book.empty() && now - this.book.timestamp > this.config.integrity.bookStaleMs) {
      this.integrity.noteStaleBook();
    }
    this.checkSpread();
  }

  private checkSpread(): void {
    const spread = this.book.spreadBps();
    if (Number.isFinite(spread) && spread > this.config.integrity.maxSpreadBps) {
      this.integrity.noteWideSpread();
    }
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
