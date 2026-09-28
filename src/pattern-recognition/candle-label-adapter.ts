import { clamp } from '../core/integrity.js';
import type { FootprintBar } from '../footprint/types.js';
import type { MarketBattleSnapshot } from '../models/market-battle.js';
import type { WindowSnapshot } from '../models/signals.js';
import {
  classifyCandleStructure,
  emptyClassification,
  metricsFromLabeledFields,
  stopHuntKind,
} from './candle-classification.js';
import type { CandleClassification } from './candle-classification-types.js';
import type { FootprintBarLike, LabeledCandle } from './pattern-types.js';

const EMPTY_METRICS = {
  aggressiveBuyPower: null,
  aggressiveSellPower: null,
  passiveBuyerDefense: null,
  passiveSellerDefense: null,
  upsideBattleSpread: null,
  downsideBattleSpread: null,
  bidWithdrawal: null,
  askWithdrawal: null,
  bidReplenishment: null,
  askReplenishment: null,
  bidConsumption: null,
  askConsumption: null,
  bidSurvival: null,
  askSurvival: null,
  sweepQuality: null,
} as const;

/**
 * Maps a completed footprint bar to structured classification + legacy flat label.
 * Causal only — never inspects future bars.
 */
export function labelFootprintBar(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  timeframe: string,
  metrics?: Partial<LabeledCandle>,
): LabeledCandle {
  const classification = classifyCandleStructure(bar, {
    prior,
    metrics: metricsFromLabeledFields(metrics),
  });

  const conf =
    metrics?.labelConfidence ??
    classification.specialEvent.confidence ??
    classification.primaryState.confidence;

  return {
    timestamp: bar.time,
    symbol: bar.symbol,
    timeframe,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: volumeOf(bar),
    label: classification.primaryDisplayLabel,
    labelConfidence: conf,
    classification,
    ...EMPTY_METRICS,
    ...pickMetrics(metrics),
    sweepQuality: metrics?.sweepQuality ?? sweepQualityOf(bar, prior, classification),
  };
}

export function labelFootprintBars(
  bars: FootprintBarLike[],
  timeframe: string,
  options?: { lastIsLive?: boolean },
): { finalized: LabeledCandle[]; preview: LabeledCandle | null } {
  const finalized: LabeledCandle[] = [];
  const end = options?.lastIsLive && bars.length ? bars.length - 1 : bars.length;
  for (let i = 0; i < end; i++) {
    finalized.push(labelFootprintBar(bars[i]!, bars.slice(0, i), timeframe));
  }
  const preview =
    options?.lastIsLive && bars.length
      ? labelFootprintBar(bars[bars.length - 1]!, bars.slice(0, bars.length - 1), timeframe)
      : null;
  return { finalized, preview };
}

export function metricsFromWindowSnapshot(snap: WindowSnapshot | null | undefined): Partial<LabeledCandle> {
  if (!snap) return {};
  const battle = snap.marketBattle;
  const lr = snap.liquidityResponse;
  return {
    labelConfidence: Number.isFinite(snap.confidence) ? clamp(snap.confidence, 0, 1) : null,
    aggressiveBuyPower: battle?.upside.aggressive.power ?? null,
    aggressiveSellPower: battle?.downside.aggressive.power ?? null,
    passiveBuyerDefense: battle?.downside.passive.defensePower ?? null,
    passiveSellerDefense: battle?.upside.passive.defensePower ?? null,
    upsideBattleSpread: battle?.upsideBattleScore ?? null,
    downsideBattleSpread: battle?.downsideBattleScore ?? null,
    bidWithdrawal: intensityToScore(lr?.bidWithdrawal) ?? null,
    askWithdrawal: intensityToScore(lr?.askWithdrawal) ?? null,
    bidReplenishment: intensityToScore(lr?.bidReplenishment) ?? null,
    askReplenishment: intensityToScore(lr?.askReplenishment) ?? null,
    bidConsumption: intensityToScore(lr?.bidConsumption) ?? null,
    askConsumption: intensityToScore(lr?.askConsumption) ?? null,
    bidSurvival: battle?.downside.passive.survival ?? null,
    askSurvival: battle?.upside.passive.survival ?? null,
    upsideFuel: snap.marketFuel?.upsideFuel ?? null,
    downsideFuel: snap.marketFuel?.downsideFuel ?? null,
    fuelImbalance: snap.marketFuel?.fuelImbalance ?? null,
    fuelState: snap.marketFuel?.state ?? null,
    upsideFuelVelocity: snap.marketFuel?.upsideFuelVelocity ?? null,
    downsideFuelVelocity: snap.marketFuel?.downsideFuelVelocity ?? null,
  };
}

export function metricsFromBattle(battle: MarketBattleSnapshot | null | undefined): Partial<LabeledCandle> {
  if (!battle) return {};
  return {
    aggressiveBuyPower: battle.upside.aggressive.power,
    aggressiveSellPower: battle.downside.aggressive.power,
    passiveBuyerDefense: battle.downside.passive.defensePower,
    passiveSellerDefense: battle.upside.passive.defensePower,
    upsideBattleSpread: battle.upsideBattleScore,
    downsideBattleSpread: battle.downsideBattleScore,
    bidSurvival: battle.downside.passive.survival,
    askSurvival: battle.upside.passive.survival,
  };
}

function volumeOf(bar: FootprintBarLike): number {
  if (typeof bar.volume === 'number' && Number.isFinite(bar.volume)) return bar.volume;
  return (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
}

function sweepQualityOf(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  classification: CandleClassification,
): number | null {
  const kind =
    classification.specialEvent.type === 'STOP_HUNT_HIGH'
      ? 'HIGH'
      : classification.specialEvent.type === 'STOP_HUNT_LOW'
        ? 'LOW'
        : stopHuntKind(bar, prior);
  if (!kind) return null;
  const { support, resistance } = priorSwingLevels(prior);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  let base = 0;
  if (kind === 'HIGH' && resistance != null) {
    const swept = Math.max(0, bar.high - resistance);
    const rejected = Math.max(0, bar.high - bar.close);
    base = clamp((swept / range) * 0.45 + (rejected / range) * 0.4 + (1 - closePos) * 0.15, 0, 1);
  } else if (kind === 'LOW' && support != null) {
    const swept = Math.max(0, support - bar.low);
    const rejected = Math.max(0, bar.close - bar.low);
    base = clamp((swept / range) * 0.45 + (rejected / range) * 0.4 + closePos * 0.15, 0, 1);
  } else {
    const wick = kind === 'LOW' ? closePos : 1 - closePos;
    base = clamp(wick, 0, 1);
  }
  // Absorption / reclaim bonus for true stop runs.
  const buy = bar.totalBuy ?? 0;
  const sell = bar.totalSell ?? 0;
  const vol = buy + sell;
  const deltaPct = vol > 0 ? (buy - sell) / vol : 0;
  const flowBonus =
    kind === 'LOW'
      ? deltaPct <= -0.12 && closePos >= 0.58
        ? 0.08
        : 0
      : deltaPct >= 0.12 && closePos <= 0.42
        ? 0.08
        : 0;
  return clamp(base + flowBonus, 0, 1) * 100;
}

function priorSwingLevels(prior: FootprintBarLike[]): { support: number | null; resistance: number | null } {
  if (!prior.length) return { support: null, resistance: null };
  const recent = prior.slice(-24);
  const atrLook = recent.slice(-8);
  let atrSum = 0;
  for (const b of atrLook) atrSum += Math.max(b.high - b.low, 0);
  const last = recent[recent.length - 1]!;
  const atr = atrLook.length ? atrSum / atrLook.length : Math.max(last.high - last.low, 1);
  const tol = Math.max(atr * 0.28, (last.close || 1) * 0.0008);

  const pivotLows: number[] = [];
  const pivotHighs: number[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const p = recent[i]!;
    const l = recent[i - 1]!;
    const r = recent[i + 1]!;
    if (p.low <= l.low && p.low <= r.low) pivotLows.push(p.low);
    if (p.high >= l.high && p.high >= r.high) pivotHighs.push(p.high);
  }

  const window16 = prior.slice(-16);
  let absHigh = -Infinity;
  let absLow = Infinity;
  for (const b of window16) {
    if (b.high > absHigh) absHigh = b.high;
    if (b.low < absLow) absLow = b.low;
  }
  if (!Number.isFinite(absHigh) || !Number.isFinite(absLow)) return { support: null, resistance: null };

  return {
    support: pickClusterLevel(pivotLows, absLow, tol, 'support'),
    resistance: pickClusterLevel(pivotHighs, absHigh, tol, 'resistance'),
  };
}

function pickClusterLevel(
  pivots: number[],
  extreme: number,
  tol: number,
  side: 'support' | 'resistance',
): number {
  const points = pivots.slice();
  if (Number.isFinite(extreme)) points.push(extreme);
  if (!points.length) return extreme;
  const sorted = [...points].sort((a, b) => a - b);
  type Cluster = { sum: number; count: number; min: number; max: number };
  const clusters: Cluster[] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && p - last.max <= tol) {
      last.sum += p;
      last.count += 1;
      last.max = p;
    } else {
      clusters.push({ sum: p, count: 1, min: p, max: p });
    }
  }
  let best = clusters[0]!;
  for (const c of clusters) {
    if (c.count > best.count) best = c;
    else if (c.count === best.count) {
      const bestMean = best.sum / best.count;
      const mean = c.sum / c.count;
      if (side === 'support' ? mean < bestMean : mean > bestMean) best = c;
    }
  }
  const mean = best.sum / best.count;
  return Math.abs(extreme - mean) <= tol * 1.25 ? extreme : mean;
}

function intensityToScore(label: string | undefined): number | null {
  if (!label) return null;
  if (label === 'EXTREME') return 90;
  if (label === 'HIGH') return 75;
  if (label === 'NORMAL') return 45;
  if (label === 'LOW') return 25;
  return null;
}

function pickMetrics(metrics?: Partial<LabeledCandle>): Partial<LabeledCandle> {
  if (!metrics) return {};
  const out: Partial<LabeledCandle> = {};
  for (const key of Object.keys(EMPTY_METRICS) as (keyof typeof EMPTY_METRICS)[]) {
    const value = metrics[key];
    if (value !== undefined) out[key] = value as never;
  }
  if (metrics.labelConfidence !== undefined) out.labelConfidence = metrics.labelConfidence;
  if (metrics.upsideFuel !== undefined) out.upsideFuel = metrics.upsideFuel;
  if (metrics.downsideFuel !== undefined) out.downsideFuel = metrics.downsideFuel;
  if (metrics.fuelImbalance !== undefined) out.fuelImbalance = metrics.fuelImbalance;
  if (metrics.fuelState !== undefined) out.fuelState = metrics.fuelState;
  if (metrics.upsideFuelVelocity !== undefined) out.upsideFuelVelocity = metrics.upsideFuelVelocity;
  if (metrics.downsideFuelVelocity !== undefined) out.downsideFuelVelocity = metrics.downsideFuelVelocity;
  return out;
}

/** Test helper: build a labeled candle without footprint geometry. */
export function labeledCandle(
  partial: Pick<LabeledCandle, 'timestamp' | 'symbol' | 'timeframe' | 'label'> & Partial<LabeledCandle>,
): LabeledCandle {
  const price = partial.close ?? partial.open ?? 100;
  const classification =
    partial.classification ??
    classificationFromFlatLabel(partial.label, {
      open: partial.open ?? price,
      high: partial.high ?? price,
      low: partial.low ?? price,
      close: partial.close ?? price,
    });
  return {
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
    labelConfidence: 0.8,
    ...EMPTY_METRICS,
    ...partial,
    label: partial.label,
    classification,
  };
}

/** Build a minimal classification whose primaryDisplayLabel matches a flat label (tests / fixtures). */
export function classificationFromFlatLabel(
  label: LabeledCandle['label'],
  ohlc?: { open: number; high: number; low: number; close: number },
): CandleClassification {
  const base = emptyClassification();
  const move = ohlc ? ohlc.close - ohlc.open : 0;
  const direction = move > 0 ? 'UP' : move < 0 ? 'DOWN' : 'NONE';

  switch (label) {
    case 'BUYER_IN_CONTROL':
      return {
        ...base,
        primaryState: { control: 'BUYER_IN_CONTROL', confidence: 0.8 },
        outcome: { type: 'PRICE_FOLLOWED', direction: 'UP', confidence: 0.8 },
        primaryDisplayLabel: 'BUYER_IN_CONTROL',
      };
    case 'SELLER_IN_CONTROL':
      return {
        ...base,
        primaryState: { control: 'SELLER_IN_CONTROL', confidence: 0.8 },
        outcome: { type: 'PRICE_FOLLOWED', direction: 'DOWN', confidence: 0.8 },
        primaryDisplayLabel: 'SELLER_IN_CONTROL',
      };
    case 'STOP_HUNT_LOW':
      return {
        ...base,
        primaryState: { control: 'BALANCED', confidence: 0.55 },
        specialEvent: { type: 'STOP_HUNT_LOW', confidence: 0.85 },
        outcome: { type: 'REVERSAL', direction: 'UP', confidence: 0.8 },
        primaryDisplayLabel: 'STOP_HUNT_LOW',
      };
    case 'STOP_HUNT_HIGH':
      return {
        ...base,
        primaryState: { control: 'BALANCED', confidence: 0.55 },
        specialEvent: { type: 'STOP_HUNT_HIGH', confidence: 0.85 },
        outcome: { type: 'REVERSAL', direction: 'DOWN', confidence: 0.8 },
        primaryDisplayLabel: 'STOP_HUNT_HIGH',
      };
    case 'BUYER_ABSORBED':
      return {
        ...base,
        primaryState: { control: 'BALANCED', confidence: 0.5 },
        specialEvent: { type: 'BUYER_ABSORBED', confidence: 0.8 },
        outcome: { type: 'NO_FOLLOW_THROUGH', direction: 'NONE', confidence: 0.7 },
        primaryDisplayLabel: 'BUYER_ABSORBED',
      };
    case 'SELLER_ABSORBED':
      return {
        ...base,
        primaryState: { control: 'BALANCED', confidence: 0.5 },
        specialEvent: { type: 'SELLER_ABSORBED', confidence: 0.8 },
        outcome: { type: 'NO_FOLLOW_THROUGH', direction: 'NONE', confidence: 0.7 },
        primaryDisplayLabel: 'SELLER_ABSORBED',
      };
    case 'ASKS_PULLED':
      return {
        ...base,
        primaryState: { control: 'UNCLEAR', confidence: 0.4 },
        liquidityBehavior: {
          ...base.liquidityBehavior,
          askPulling: { score: 88, state: 'EXTREME', percentile: 92, zScore: 2.1, rawValue: null },
          dominantEvent: 'ASKS_PULLED',
          dataQuality: 'PARTIAL_DATA',
        },
        outcome: { type: 'PRICE_FOLLOWED', direction: direction === 'NONE' ? 'UP' : direction, confidence: 0.75 },
        primaryDisplayLabel: 'ASKS_PULLED',
      };
    case 'BIDS_PULLED':
      return {
        ...base,
        primaryState: { control: 'UNCLEAR', confidence: 0.4 },
        liquidityBehavior: {
          ...base.liquidityBehavior,
          bidPulling: { score: 88, state: 'EXTREME', percentile: 92, zScore: 2.1, rawValue: null },
          dominantEvent: 'BIDS_PULLED',
          dataQuality: 'PARTIAL_DATA',
        },
        outcome: { type: 'PRICE_FOLLOWED', direction: direction === 'NONE' ? 'DOWN' : direction, confidence: 0.75 },
        primaryDisplayLabel: 'BIDS_PULLED',
      };
    default:
      return { ...base, primaryDisplayLabel: 'UNCLASSIFIED' };
  }
}

export function isFootprintBar(bar: FootprintBarLike): bar is FootprintBar {
  return Array.isArray((bar as FootprintBar).levels);
}
