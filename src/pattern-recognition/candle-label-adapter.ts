import { clamp } from '../core/integrity.js';
import type { FootprintBar } from '../footprint/types.js';
import type { MarketBattleSnapshot } from '../models/market-battle.js';
import type { WindowSnapshot } from '../models/signals.js';
import type { CandleLabel, FootprintBarLike, LabeledCandle } from './pattern-types.js';

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
 * Maps a completed footprint bar to the pattern alphabet using the same
 * causal heuristics as the footprint chart (`strategyStoryForBar`), without
 * looking at future bars.
 */
export function labelFootprintBar(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  timeframe: string,
  metrics?: Partial<LabeledCandle>,
): LabeledCandle {
  const classified = classifyBar(bar, prior);
  return {
    timestamp: bar.time,
    symbol: bar.symbol,
    timeframe,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: volumeOf(bar),
    label: classified.label,
    labelConfidence: classified.confidence,
    ...EMPTY_METRICS,
    ...pickMetrics(metrics),
    sweepQuality: metrics?.sweepQuality ?? classified.sweepQuality,
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

interface Classified {
  label: CandleLabel;
  confidence: number;
  sweepQuality: number | null;
}

function classifyBar(bar: FootprintBarLike, prior: FootprintBarLike[]): Classified {
  const hunt = stopHuntKind(bar, prior);
  if (hunt === 'HIGH') {
    return { label: 'STOP_HUNT_HIGH', confidence: huntConfidence(bar, prior, 'HIGH'), sweepQuality: sweepQualityOf(bar, prior, 'HIGH') };
  }
  if (hunt === 'LOW') {
    return { label: 'STOP_HUNT_LOW', confidence: huntConfidence(bar, prior, 'LOW'), sweepQuality: sweepQualityOf(bar, prior, 'LOW') };
  }

  const vac = vacuumKind(bar, prior);
  if (vac === 'UPSIDE') {
    return { label: 'ASKS_PULLED', confidence: vacuumConfidence(bar, prior), sweepQuality: null };
  }
  if (vac === 'DOWNSIDE') {
    return { label: 'BIDS_PULLED', confidence: vacuumConfidence(bar, prior), sweepQuality: null };
  }

  const absorbed = barAbsorbed(bar);
  if (absorbed === 'SELLERS') {
    return { label: 'SELLER_ABSORBED', confidence: absorbConfidence(bar), sweepQuality: null };
  }
  if (absorbed === 'BUYERS') {
    return { label: 'BUYER_ABSORBED', confidence: absorbConfidence(bar), sweepQuality: null };
  }

  const win = barWinner(bar);
  if (win === 'AGGRESSIVE_BUYERS') {
    return { label: 'BUYER_IN_CONTROL', confidence: controlConfidence(bar), sweepQuality: null };
  }
  if (win === 'AGGRESSIVE_SELLERS') {
    return { label: 'SELLER_IN_CONTROL', confidence: controlConfidence(bar), sweepQuality: null };
  }
  if (win === 'PASSIVE_SELLERS') {
    return { label: 'BUYER_ABSORBED', confidence: Math.min(0.72, absorbConfidence(bar)), sweepQuality: null };
  }
  if (win === 'PASSIVE_BUYERS') {
    return { label: 'SELLER_ABSORBED', confidence: Math.min(0.72, absorbConfidence(bar)), sweepQuality: null };
  }

  return { label: 'UNCLASSIFIED', confidence: 0.35, sweepQuality: null };
}

function volumeOf(bar: FootprintBarLike): number {
  if (typeof bar.volume === 'number' && Number.isFinite(bar.volume)) return bar.volume;
  return (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
}

function barWinner(bar: FootprintBarLike): string {
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const mid = (bar.high + bar.low) / 2 || bar.close;
  const move = mid ? (bar.close - bar.open) / mid : 0;
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const stalled = Math.abs(move) < 0.00045 || (range > 0 && body / range < 0.3);
  if (delta > 0 && stalled) return 'PASSIVE_SELLERS';
  if (delta < 0 && stalled) return 'PASSIVE_BUYERS';
  if (delta > 0 && move > 0) return 'AGGRESSIVE_BUYERS';
  if (delta < 0 && move < 0) return 'AGGRESSIVE_SELLERS';
  return 'BALANCED';
}

function barAbsorbed(bar: FootprintBarLike): 'SELLERS' | 'BUYERS' | null {
  const vol = volumeOf(bar);
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const dominated = vol > 0 && Math.abs(delta / vol) >= 0.25;
  if (dominated && delta < 0 && closePos >= 0.55) return 'SELLERS';
  if (dominated && delta > 0 && closePos <= 0.45) return 'BUYERS';
  return null;
}

function priorSwingLevels(prior: FootprintBarLike[]): { support: number | null; resistance: number | null } {
  if (!prior.length) return { support: null, resistance: null };
  const recent = prior.slice(-16);
  let resistance = -Infinity;
  let support = Infinity;
  for (const b of recent) {
    if (b.high > resistance) resistance = b.high;
    if (b.low < support) support = b.low;
  }
  if (!Number.isFinite(resistance) || !Number.isFinite(support)) return { support: null, resistance: null };
  return { support, resistance };
}

function recentBarAtr(prior: FootprintBarLike[], bar: FootprintBarLike): number {
  const look = prior.slice(-8);
  if (!look.length) return Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
  let s = 0;
  for (const b of look) s += Math.max(b.high - b.low, 0);
  return s / look.length || Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
}

function vacuumKind(bar: FootprintBarLike, prior: FootprintBarLike[]): 'UPSIDE' | 'DOWNSIDE' | null {
  const buy = bar.totalBuy ?? 0;
  const sell = bar.totalSell ?? 0;
  const vol = buy + sell;
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  const atr = recentBarAtr(prior, bar);
  const closePos = (bar.close - bar.low) / range;
  const move = bar.close - bar.open;
  const expanded = range >= atr * 1.15;
  const ran = Math.abs(move) >= atr * 0.45;
  if (!expanded && !ran) return null;
  const deltaPct = vol > 0 ? (buy - sell) / vol : move > 0 ? 0.3 : move < 0 ? -0.3 : 0;
  if (deltaPct >= 0.18 && move > 0 && closePos >= 0.62) return 'UPSIDE';
  if (deltaPct <= -0.18 && move < 0 && closePos <= 0.38) return 'DOWNSIDE';
  if (move > 0 && closePos >= 0.72 && range >= atr * 1.35) return 'UPSIDE';
  if (move < 0 && closePos <= 0.28 && range >= atr * 1.35) return 'DOWNSIDE';
  return null;
}

function stopHuntKind(bar: FootprintBarLike, prior: FootprintBarLike[]): 'HIGH' | 'LOW' | null {
  const { support, resistance } = priorSwingLevels(prior);
  if (support == null || resistance == null || resistance <= support) return null;
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  const closePos = (bar.close - bar.low) / range;
  const band = Math.max((resistance - support) * 0.08, atr * 0.35);
  if (bar.high >= resistance + band * 0.2 && bar.close < resistance && closePos <= 0.42) return 'HIGH';
  if (bar.low <= support - band * 0.2 && bar.close > support && closePos >= 0.58) return 'LOW';
  return null;
}

function huntConfidence(bar: FootprintBarLike, _prior: FootprintBarLike[], kind: 'HIGH' | 'LOW'): number {
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const extremity = kind === 'LOW' ? closePos : 1 - closePos;
  return clamp(0.55 + extremity * 0.4, 0.5, 0.98);
}

function sweepQualityOf(bar: FootprintBarLike, prior: FootprintBarLike[], kind: 'HIGH' | 'LOW'): number {
  const { support, resistance } = priorSwingLevels(prior);
  const range = Math.max(bar.high - bar.low, 1e-9);
  if (kind === 'HIGH' && resistance != null) {
    const swept = Math.max(0, bar.high - resistance);
    const rejected = Math.max(0, bar.high - bar.close);
    return clamp((swept / range) * 0.5 + (rejected / range) * 0.5, 0, 1) * 100;
  }
  if (kind === 'LOW' && support != null) {
    const swept = Math.max(0, support - bar.low);
    const rejected = Math.max(0, bar.close - bar.low);
    return clamp((swept / range) * 0.5 + (rejected / range) * 0.5, 0, 1) * 100;
  }
  const closePos = (bar.close - bar.low) / range;
  const wick = kind === 'LOW' ? closePos : 1 - closePos;
  return clamp(wick, 0, 1) * 100;
}

function vacuumConfidence(bar: FootprintBarLike, prior: FootprintBarLike[]): number {
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  const stretch = atr > 0 ? range / atr : 1;
  return clamp(0.5 + (stretch - 1) * 0.25, 0.45, 0.95);
}

function absorbConfidence(bar: FootprintBarLike): number {
  const vol = volumeOf(bar);
  const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
  const imb = vol > 0 ? delta / vol : 0;
  const range = Math.max(bar.high - bar.low, 1e-9);
  const body = Math.abs(bar.close - bar.open) / range;
  return clamp(0.45 + imb * 0.4 + (1 - body) * 0.15, 0.4, 0.96);
}

function controlConfidence(bar: FootprintBarLike): number {
  const vol = volumeOf(bar);
  const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
  const imb = vol > 0 ? delta / vol : 0;
  return clamp(0.5 + imb * 0.45, 0.45, 0.97);
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
  return out;
}

/** Test helper: build a labeled candle without footprint geometry. */
export function labeledCandle(
  partial: Pick<LabeledCandle, 'timestamp' | 'symbol' | 'timeframe' | 'label'> & Partial<LabeledCandle>,
): LabeledCandle {
  const price = partial.close ?? partial.open ?? 100;
  return {
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
    labelConfidence: 0.8,
    ...EMPTY_METRICS,
    ...partial,
  };
}

export function isFootprintBar(bar: FootprintBarLike): bar is FootprintBar {
  return Array.isArray((bar as FootprintBar).levels);
}
