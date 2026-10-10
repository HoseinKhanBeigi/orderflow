/**
 * Footprint + price evidence for a level interaction.
 * Reuses displacement and effort/result helpers — no second formulas.
 * Does not invent time-beyond-level from OHLC or bid/ask defense from tape.
 */

import { computeDisplacement, flowDataQuality, type FlowDataQuality } from '../footprint/displacement-cvd.js';
import { tickSize } from '../footprint/tick-size.js';
import { effortScores, resultScore } from '../market-sequence/adapters.js';
import { deriveEffortResult } from '../market-sequence/label-selector.js';
import type { LevelInteractionConfig } from './config.js';
import type { InteractionBar, InteractionLevel, LevelEvidence, LevelEventType } from './types.js';

export type LevelSide = 'HIGH' | 'LOW';

export function levelSide(type: InteractionLevel['type']): LevelSide {
  if (
    type === 'HISTORICAL_SUPPORT' ||
    type === 'SWING_LOW' ||
    type === 'PREV_15M_LOW'
  ) {
    return 'LOW';
  }
  return 'HIGH';
}

export function zoneBounds(level: InteractionLevel): { lo: number; hi: number; mid: number } {
  const lo = level.zoneLow ?? level.price;
  const hi = level.zoneHigh ?? level.price;
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), mid: (lo + hi) / 2 };
}

/** Far-side boundary: resistance high, support low. */
export function farBoundary(level: InteractionLevel): number {
  const z = zoneBounds(level);
  return levelSide(level.type) === 'HIGH' ? z.hi : z.lo;
}

export function priorAtr(bars: InteractionBar[], index: number, cfg: LevelInteractionConfig): number | null {
  const start = Math.max(0, index - cfg.atrLookback);
  const end = index; // prior completed only
  if (end - start < cfg.minAtrBars) return null;
  let sum = 0;
  let n = 0;
  let prevClose: number | null = start > 0 ? bars[start - 1]?.close ?? null : null;
  for (let i = start; i < end; i++) {
    const b = bars[i];
    if (!b || !Number.isFinite(b.high) || !Number.isFinite(b.low)) continue;
    const tr = prevClose != null
      ? Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose))
      : b.high - b.low;
    if (tr > 0 && Number.isFinite(tr)) {
      sum += tr;
      n += 1;
    }
    prevClose = b.close;
  }
  if (n < cfg.minAtrBars || !(sum > 0)) return null;
  return sum / n;
}

export function penetrationTolerance(
  price: number,
  atr: number | null,
  cfg: LevelInteractionConfig,
): number {
  const tick = tickSize(price);
  const fromAtr = atr != null && atr > 0 ? atr * cfg.atrPenetration : 0;
  const fromBps = price > 0 ? price * (cfg.bpsPenetration / 10_000) : 0;
  return Math.max(tick, fromAtr, fromBps, cfg.minPenetrationPrice);
}

export function volumeBeyondLevel(
  bar: InteractionBar,
  boundary: number,
  side: LevelSide,
): { ratio: number | null; beyond: number; total: number } {
  const levels = bar.levels ?? [];
  if (!levels.length) return { ratio: null, beyond: 0, total: 0 };
  let beyond = 0;
  let total = 0;
  for (const lv of levels) {
    const vol = (lv.buy || 0) + (lv.sell || 0);
    if (!(vol > 0)) continue;
    total += vol;
    if (side === 'HIGH' && lv.price > boundary) beyond += vol;
    if (side === 'LOW' && lv.price < boundary) beyond += vol;
  }
  if (!(total > 0)) return { ratio: null, beyond, total };
  return { ratio: beyond / total, beyond, total };
}

export function imbalanceBeyond(
  bar: InteractionBar,
  boundary: number,
  side: LevelSide,
  ratio: number,
): number | null {
  const levels = bar.levels ?? [];
  if (!levels.length) return null;
  let count = 0;
  for (const lv of levels) {
    const onFar = side === 'HIGH' ? lv.price > boundary : lv.price < boundary;
    if (!onFar) continue;
    const buy = lv.buy || 0;
    const sell = lv.sell || 0;
    if (buy >= sell * ratio && buy > 0) count += 1;
    else if (sell >= buy * ratio && sell > 0) count += 1;
  }
  return count;
}

export function aggressiveVolumes(bar: InteractionBar): { buy: number; sell: number } {
  const buy = Number(bar.aggressiveBuy ?? bar.totalBuy ?? 0);
  const sell = Number(bar.aggressiveSell ?? bar.totalSell ?? 0);
  return {
    buy: Number.isFinite(buy) && buy > 0 ? buy : 0,
    sell: Number.isFinite(sell) && sell > 0 ? sell : 0,
  };
}

export function barIsValid(bar: InteractionBar): boolean {
  return [bar.open, bar.high, bar.low, bar.close].every((n) => Number.isFinite(n) && n > 0)
    && bar.high >= Math.max(bar.open, bar.close)
    && bar.low <= Math.min(bar.open, bar.close);
}

export function isNarrowOrQuiet(
  bar: InteractionBar,
  atr: number | null,
  cfg: LevelInteractionConfig,
): boolean {
  const range = bar.high - bar.low;
  if (atr != null && atr > 0 && range < atr * cfg.minRangeAtr) return true;
  const { buy, sell } = aggressiveVolumes(bar);
  if (cfg.minAttemptVolume > 0 && buy + sell < cfg.minAttemptVolume) return true;
  return false;
}

export function collectEvidence(
  bar: InteractionBar,
  level: InteractionLevel,
  atr: number | null,
  cfg: LevelInteractionConfig,
  consecutiveBeyond: number,
  consecutiveOriginal: number,
): LevelEvidence {
  const side = levelSide(level.type);
  const boundary = farBoundary(level);
  const tol = penetrationTolerance(bar.close || level.price, atr, cfg);
  const disp = computeDisplacement(bar, { atr });
  const { buy, sell } = aggressiveVolumes(bar);
  const vol = buy + sell;
  const delta = vol > 0 ? buy - sell : null;
  const deltaRatio = vol > 0 && delta != null ? (delta / vol) * 100 : null;
  const quality = flowDataQuality({
    aggressiveBuy: buy,
    aggressiveSell: sell,
    hasFootprint: bar.hasFootprint ?? Boolean(bar.levels?.length || vol > 0),
  }) as FlowDataQuality;

  const closeBeyond =
    side === 'HIGH' ? bar.close >= boundary + tol : bar.close <= boundary - tol;
  const penetrated =
    side === 'HIGH' ? bar.high >= boundary + tol : bar.low <= boundary - tol;
  const wickOnly = penetrated && !closeBeyond;
  const bodyBeyond =
    side === 'HIGH'
      ? Math.min(bar.open, bar.close) > boundary
      : Math.max(bar.open, bar.close) < boundary;

  const volBeyond = volumeBeyondLevel(bar, boundary, side);
  const efforts = effortScores(buy, sell, delta ?? 0);
  const upResult = resultScore(disp.displacementBps, 'UP');
  const downResult = resultScore(disp.displacementBps, 'DOWN');
  const effort = deriveEffortResult(efforts.buyEffort, efforts.sellEffort, upResult, downResult, {
    effortHigh: cfg.effortHigh,
    resultStrong: cfg.resultStrong,
    resultWeak: cfg.resultWeak,
    maxBarsBetweenStages: 8,
    maxSequenceBars: 24,
    expansionDispBps: 18,
    maxActiveSequences: 32,
  });

  const effortSide: LevelEvidence['effortSide'] =
    efforts.buyEffort >= cfg.effortHigh && efforts.buyEffort >= efforts.sellEffort
      ? 'BUYERS'
      : efforts.sellEffort >= cfg.effortHigh
        ? 'SELLERS'
        : 'UNCLEAR';

  const followThrough =
    side === 'HIGH' ? disp.displacementBps > 0 && bar.close > bar.open
      : disp.displacementBps < 0 && bar.close < bar.open;

  const ask = bar.askDefense;
  const bid = bar.bidDefense;

  return {
    closeBeyond,
    penetrated,
    wickOnly,
    bodyBeyond,
    consecutiveClosesBeyond: consecutiveBeyond,
    consecutiveClosesOriginal: consecutiveOriginal,
    volumeBeyondRatio: volBeyond.ratio,
    timeBeyondMs: bar.timeBeyondMs ?? null,
    delta,
    deltaRatio,
    displacementBps: disp.displacementBps,
    displacementAtr: disp.displacementATR,
    bodyEfficiency: disp.bodyEfficiency,
    effortSide,
    effortEffective: effort === 'BUYERS_EFFECTIVE' || effort === 'SELLERS_EFFECTIVE',
    imbalanceBeyond: imbalanceBeyond(bar, boundary, side, cfg.imbalanceRatio),
    askDefense: ask != null && Number.isFinite(ask) ? ask : null,
    bidDefense: bid != null && Number.isFinite(bid) ? bid : null,
    followThrough,
    dataQuality: quality === 'GOOD' ? 'GOOD' : quality === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PARTIAL',
  };
}

/** Acceptance is not part of this engine. Kept only so callers cannot reintroduce it. */
export function canConfirmAcceptance(): false {
  return false;
}

export function canConfirmFailure(
  ev: LevelEvidence,
  hadAttempt: boolean,
  returned: boolean,
  incomplete: boolean,
): boolean {
  if (incomplete) return false;
  if (!hadAttempt) return false;
  if (!returned) return false;
  if (ev.closeBeyond) return false;
  return ev.penetrated || returned;
}

export function canConfirmReclaim(
  ev: LevelEvidence,
  cfg: LevelInteractionConfig,
  hadLossOrAcceptedBreak: boolean,
  barsSinceLoss: number,
  incomplete: boolean,
): boolean {
  if (incomplete) return false;
  if (!hadLossOrAcceptedBreak) return false;
  if (barsSinceLoss > cfg.reclaimWindowBars) return false;
  if (ev.closeBeyond) return false;
  return ev.consecutiveClosesOriginal >= cfg.minConsecutiveCloses;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Confidence is supporting evidence, not confirmation.
 * Price behavior is a gate — it is not added as a bonus on top of itself.
 */
export function eventConfidence(
  eventType: LevelEventType,
  ev: LevelEvidence,
  level: InteractionLevel,
  cfg: LevelInteractionConfig,
): number {
  const w = cfg.weights;
  const parts: Array<{ w: number; v: number }> = [];

  const significance = clamp01((level.strength ?? level.confidence ?? 55) / 100);
  parts.push({ w: w.levelSignificance, v: significance });

  const vol = ev.volumeBeyondRatio != null ? clamp01(ev.volumeBeyondRatio / 0.55) : null;
  const time = ev.timeBeyondMs != null ? clamp01(ev.timeBeyondMs / 60_000) : null;
  if (vol != null || time != null) {
    const tv = Math.max(vol ?? 0, time ?? 0);
    parts.push({ w: w.timeVolumeBeyond, v: tv });
  }

  // One flow score: do not add delta + delta-ratio + imbalance.
  if (ev.deltaRatio != null) {
    const flow = clamp01(Math.abs(ev.deltaRatio) / 50);
    const imb = ev.imbalanceBeyond != null ? clamp01(ev.imbalanceBeyond / 3) : 0;
    parts.push({ w: w.aggressiveFlow, v: Math.max(flow, imb * 0.7) });
  }

  const effort = ev.effortEffective ? 0.85 : ev.effortSide !== 'UNCLEAR' ? 0.45 : 0.2;
  parts.push({ w: w.effortResult, v: effort });

  const defense = eventType.endsWith('_UP') ? ev.askDefense : ev.bidDefense;
  if (defense != null) {
    parts.push({ w: w.passiveDefense, v: clamp01(defense / 100) });
  }

  parts.push({ w: w.followThrough, v: ev.followThrough ? 0.9 : 0.25 });

  const weightSum = parts.reduce((s, p) => s + p.w, 0);
  if (!(weightSum > 0)) return 50;
  const raw = parts.reduce((s, p) => s + (p.w / weightSum) * p.v, 0);
  let score = Math.round(40 + raw * 55);
  if (ev.dataQuality === 'UNAVAILABLE') score -= 8;
  if (defense == null) score -= 4;
  if (eventType.startsWith('RECLAIM') && ev.deltaRatio == null) {
    // Price-based reclaim is still valid without delta.
    score = Math.max(score, 58);
  }
  return Math.max(35, Math.min(95, score));
}

export function eventReasons(
  eventType: LevelEventType,
  ev: LevelEvidence,
  level: InteractionLevel,
): string[] {
  const side = eventType.endsWith('_UP') ? 'above' : 'below';
  const name = level.type.replace(/_/g, ' ').toLowerCase();
  const out: string[] = [];
  if (eventType.startsWith('FAIL')) {
    out.push(`Break attempt ${side} ${name} failed to hold`);
    out.push('Price returned without holding beyond the level');
    if (ev.deltaRatio != null && Math.abs(ev.deltaRatio) >= 25) {
      out.push(`Strong ${ev.deltaRatio > 0 ? 'positive' : 'negative'} delta did not hold the break`);
    }
    if (eventType === 'FAIL_UP' && ev.askDefense != null && ev.askDefense >= 60) {
      out.push('Ask defense present during the failed break');
    }
    if (eventType === 'FAIL_DOWN' && ev.bidDefense != null && ev.bidDefense >= 60) {
      out.push('Bid defense present during the failed break');
    }
  } else {
    out.push(`Returned across ${name} after a prior loss/break`);
    out.push(`${ev.consecutiveClosesOriginal} close${ev.consecutiveClosesOriginal === 1 ? '' : 's'} back on the original side`);
    if (ev.followThrough) out.push('Price response after the reclaim');
  }
  return out;
}

export function eventInvalidation(eventType: LevelEventType): string[] {
  if (eventType.startsWith('FAIL')) {
    return ['Immediate continuation through the level', 'A later confirmed hold beyond the same level'];
  }
  return ['Loss of the reclaimed side within the reclaim window', 'Failed to hold the original side'];
}
