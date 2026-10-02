/**
 * Swing High / Low structure — short-term turning points, not proven S/R.
 * Never: SWING HIGH = SHORT or SWING LOW = LONG.
 *
 * Confirmation: a pivot at i is known only after rightBars closes (confirmedAt).
 * No lookahead: at time T only swings with confirmedAt <= T exist.
 */

export const SWING_STRUCTURE_VERSION = 'SWING_STRUCTURE_V1';

export type SwingType = 'SWING_HIGH' | 'SWING_LOW';
export type SwingClass = 'MINOR' | 'MAJOR';
export type SwingState =
  | 'ACTIVE'
  | 'TESTING'
  | 'REJECTED'
  | 'BREAKING'
  | 'BROKEN'
  | 'RETESTING'
  | 'INVALIDATED';

export type StructureState =
  | 'BULLISH_STRUCTURE'
  | 'BEARISH_STRUCTURE'
  | 'RANGE'
  | 'TRANSITION'
  | 'UNKNOWN';

export type StructureStep = 'HH' | 'HL' | 'LH' | 'LL' | 'EQH' | 'EQL';

export type SwingLocationState =
  | 'NEAR_SWING_HIGH'
  | 'AT_SWING_HIGH'
  | 'BELOW_SWING_HIGH'
  | 'ABOVE_SWING_HIGH'
  | 'NEAR_SWING_LOW'
  | 'AT_SWING_LOW'
  | 'ABOVE_SWING_LOW'
  | 'BELOW_SWING_LOW'
  | 'BETWEEN_SWINGS'
  | 'UNKNOWN';

export type SwingInteractionState =
  | 'NONE'
  | 'APPROACHING_SWING_HIGH'
  | 'TOUCHED_SWING_HIGH'
  | 'WICKED_ABOVE_SWING_HIGH'
  | 'CLOSED_ABOVE_SWING_HIGH'
  | 'ACCEPTED_ABOVE_SWING_HIGH'
  | 'SWING_HIGH_REJECTION'
  | 'APPROACHING_SWING_LOW'
  | 'TOUCHED_SWING_LOW'
  | 'WICKED_BELOW_SWING_LOW'
  | 'CLOSED_BELOW_SWING_LOW'
  | 'ACCEPTED_BELOW_SWING_LOW'
  | 'SWING_LOW_REJECTION';

export type BosChochEvent =
  | 'NONE'
  | 'BULLISH_BOS'
  | 'BEARISH_BOS'
  | 'BULLISH_CHOCH'
  | 'BEARISH_CHOCH';

export type SwingHistoricalConfluence =
  | 'NONE'
  | 'SWING_HIGH_AT_RESISTANCE'
  | 'SWING_LOW_AT_SUPPORT';

export type SwingLiveConfluence =
  | 'NONE'
  | 'LIVE_ASK_AT_SWING_HIGH'
  | 'LIVE_BID_AT_SWING_LOW';

export interface SwingBarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SwingPoint {
  id: string;
  type: SwingType;
  price: number;
  pivotTime: number;
  confirmedAt: number;
  timeframe: string;
  leftBars: number;
  rightBars: number;
  significance: number;
  class: SwingClass;
  state: SwingState;
  testCount: number;
  lastInteractionAt: number | null;
  /** Pending pivots are internal-only until confirmed. */
  pending?: boolean;
}

export interface SwingSignificanceComponents {
  prominence: number;
  reaction: number;
  separation: number;
  duration: number;
  timeframe: number;
}

export interface SwingCurrentContext {
  location: SwingLocationState;
  distanceToSwingHighBps: number | null;
  distanceToSwingLowBps: number | null;
  interaction: SwingInteractionState;
  bosChoch: BosChochEvent;
  confluenceHistorical: SwingHistoricalConfluence;
  confluenceLive: SwingLiveConfluence;
}

export interface SwingStructureSnapshot {
  version: typeof SWING_STRUCTURE_VERSION;
  timestamp: number;
  timeframe: string;
  structure: StructureState;
  structureSteps: StructureStep[];
  swings: SwingPoint[];
  recentSwingHigh: SwingPoint | null;
  recentSwingLow: SwingPoint | null;
  pendingSwingHigh: SwingPoint | null;
  pendingSwingLow: SwingPoint | null;
  currentContext: SwingCurrentContext | null;
}

export interface SwingStructureConfig {
  leftBars: number;
  rightBars: number;
  nearThresholdBps: number;
  atThresholdBps: number;
  nearAtrFraction: number;
  /** Min significance to keep on chart / recent. */
  minSignificance: number;
  majorMinSignificance: number;
  /** Min bars between same-type swings kept. */
  minBarsBetweenSwings: number;
  /** Min move-away in ATR fractions after pivot. */
  minMoveAwayAtr: number;
  acceptBeyondBps: number;
  acceptConfirmCloses: number;
  fadeBrokenAfterBars: number;
  maxVisibleHighs: number;
  maxVisibleLows: number;
  confluenceBps: number;
  atrPeriod: number;
  /** Seconds per bar for confirmedAt close time. */
  barSeconds: number;
  timeframeLabel: string;
  timeframeImportance: number;
}

export const DEFAULT_SWING_STRUCTURE_CONFIG: SwingStructureConfig = {
  leftBars: 3,
  rightBars: 3,
  nearThresholdBps: 10,
  atThresholdBps: 3,
  nearAtrFraction: 0.15,
  minSignificance: 42,
  majorMinSignificance: 68,
  minBarsBetweenSwings: 2,
  minMoveAwayAtr: 0.25,
  acceptBeyondBps: 5,
  acceptConfirmCloses: 1,
  fadeBrokenAfterBars: 8,
  maxVisibleHighs: 3,
  maxVisibleLows: 3,
  confluenceBps: 12,
  atrPeriod: 14,
  barSeconds: 15 * 60,
  timeframeLabel: '15m',
  timeframeImportance: 70,
};

export interface EvaluateSwingStructureInput {
  bars: SwingBarLike[];
  asOf: number;
  currentPrice?: number | null;
  currentBar?: SwingBarLike | null;
  config?: Partial<SwingStructureConfig>;
  historicalResistance?: { low: number; high: number } | null;
  historicalSupport?: { low: number; high: number } | null;
  liveAsk?: { price: number; strength?: number } | null;
  liveBid?: { price: number; strength?: number } | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function distanceBps(price: number, level: number): number {
  if (!(level > 0) || !Number.isFinite(price)) return 0;
  return (Math.abs(price - level) / level) * 10_000;
}

export function mergeSwingConfig(partial?: Partial<SwingStructureConfig>): SwingStructureConfig {
  return { ...DEFAULT_SWING_STRUCTURE_CONFIG, ...partial };
}

/** Bars fully closed by asOf (open + barSeconds <= asOf). */
export function completedSwingBars(bars: SwingBarLike[], asOf: number, barSeconds: number): SwingBarLike[] {
  return bars
    .filter((b) => Number.isFinite(b.time) && b.time + barSeconds <= asOf)
    .sort((a, b) => a.time - b.time);
}

function atrOf(bars: SwingBarLike[], period: number): number {
  if (bars.length < 2) {
    const b = bars[bars.length - 1];
    return b ? Math.max(b.high - b.low, b.close * 0.002) : 0.01;
  }
  const n = Math.min(period, bars.length - 1);
  let sum = 0;
  for (let i = bars.length - n; i < bars.length; i++) {
    const cur = bars[i]!;
    const prev = bars[i - 1] ?? cur;
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    sum += tr;
  }
  return Math.max(sum / n, bars[bars.length - 1]!.close * 0.0005);
}

export function effectiveNearBps(cfg: SwingStructureConfig, atr: number, refPrice: number): number {
  const atrBps = refPrice > 0 ? (atr / refPrice) * 10_000 * cfg.nearAtrFraction : cfg.nearThresholdBps;
  return Math.max(cfg.nearThresholdBps, atrBps);
}

/**
 * Detect confirmed swings from completed bars only.
 * Pivot at i confirmed when bars[i+rightBars] exists → confirmedAt = close of that bar.
 */
export function detectConfirmedSwings(
  completed: SwingBarLike[],
  cfg: SwingStructureConfig,
): SwingPoint[] {
  const L = Math.max(1, cfg.leftBars);
  const R = Math.max(1, cfg.rightBars);
  if (completed.length < L + R + 1) return [];

  const atr = atrOf(completed, cfg.atrPeriod);
  const swings: SwingPoint[] = [];

  for (let i = L; i < completed.length - R; i++) {
    const p = completed[i]!;
    const left = completed.slice(i - L, i);
    const right = completed.slice(i + 1, i + 1 + R);
    if (left.length < L || right.length < R) continue;

    const confirmedAt = right[right.length - 1]!.time + cfg.barSeconds;
    const isHigh =
      left.every((b) => p.high > b.high) && right.every((b) => p.high >= b.high);
    const isLow =
      left.every((b) => p.low < b.low) && right.every((b) => p.low <= b.low);

    if (isHigh) {
      swings.push(
        makeSwing({
          type: 'SWING_HIGH',
          price: p.high,
          pivotTime: p.time,
          confirmedAt,
          cfg,
          pivotIndex: i,
          completed,
          atr,
        }),
      );
    }
    if (isLow) {
      swings.push(
        makeSwing({
          type: 'SWING_LOW',
          price: p.low,
          pivotTime: p.time,
          confirmedAt,
          cfg,
          pivotIndex: i,
          completed,
          atr,
        }),
      );
    }
  }

  return swings;
}

/** Internal pending pivots that lack rightBars confirmation — not for trader UI. */
export function detectPendingSwings(
  completed: SwingBarLike[],
  cfg: SwingStructureConfig,
): { pendingSwingHigh: SwingPoint | null; pendingSwingLow: SwingPoint | null } {
  const L = Math.max(1, cfg.leftBars);
  const R = Math.max(1, cfg.rightBars);
  if (completed.length < L + 1) return { pendingSwingHigh: null, pendingSwingLow: null };

  const atr = atrOf(completed, cfg.atrPeriod);
  let pendingSwingHigh: SwingPoint | null = null;
  let pendingSwingLow: SwingPoint | null = null;

  // Candidate pivots in the last R bars that don't yet have full right confirmation.
  const start = Math.max(L, completed.length - R);
  for (let i = start; i < completed.length; i++) {
    const p = completed[i]!;
    const left = completed.slice(i - L, i);
    if (left.length < L) continue;
    const rightAvail = completed.slice(i + 1);
    if (rightAvail.length >= R) continue; // would already be confirmed

    const leftHighOk = left.every((b) => p.high > b.high);
    const leftLowOk = left.every((b) => p.low < b.low);
    const rightHighOk = rightAvail.every((b) => p.high >= b.high);
    const rightLowOk = rightAvail.every((b) => p.low <= b.low);

    if (leftHighOk && rightHighOk) {
      pendingSwingHigh = makeSwing({
        type: 'SWING_HIGH',
        price: p.high,
        pivotTime: p.time,
        confirmedAt: p.time + cfg.barSeconds * (R + 1), // estimated
        cfg,
        pivotIndex: i,
        completed,
        atr,
        pending: true,
      });
    }
    if (leftLowOk && rightLowOk) {
      pendingSwingLow = makeSwing({
        type: 'SWING_LOW',
        price: p.low,
        pivotTime: p.time,
        confirmedAt: p.time + cfg.barSeconds * (R + 1),
        cfg,
        pivotIndex: i,
        completed,
        atr,
        pending: true,
      });
    }
  }

  return { pendingSwingHigh, pendingSwingLow };
}

function makeSwing(input: {
  type: SwingType;
  price: number;
  pivotTime: number;
  confirmedAt: number;
  cfg: SwingStructureConfig;
  pivotIndex: number;
  completed: SwingBarLike[];
  atr: number;
  pending?: boolean;
}): SwingPoint {
  const components = scoreSignificance(input);
  const significance = Math.round(
    components.prominence * 0.28 +
      components.reaction * 0.28 +
      components.separation * 0.18 +
      components.duration * 0.1 +
      components.timeframe * 0.16,
  );
  return {
    id: `${input.type}:${input.pivotTime}:${input.confirmedAt}:${input.price.toFixed(6)}`,
    type: input.type,
    price: input.price,
    pivotTime: input.pivotTime,
    confirmedAt: input.confirmedAt,
    timeframe: input.cfg.timeframeLabel,
    leftBars: input.cfg.leftBars,
    rightBars: input.cfg.rightBars,
    significance: clamp(significance, 0, 100),
    class: significance >= input.cfg.majorMinSignificance ? 'MAJOR' : 'MINOR',
    state: 'ACTIVE',
    testCount: 0,
    lastInteractionAt: null,
    pending: input.pending || undefined,
  };
}

export function scoreSignificance(input: {
  type: SwingType;
  price: number;
  pivotIndex: number;
  completed: SwingBarLike[];
  atr: number;
  cfg: SwingStructureConfig;
}): SwingSignificanceComponents {
  const { type, price, pivotIndex, completed, atr, cfg } = input;
  const L = cfg.leftBars;
  const R = cfg.rightBars;
  const left = completed.slice(Math.max(0, pivotIndex - L), pivotIndex);
  const right = completed.slice(pivotIndex + 1, pivotIndex + 1 + R);
  const p = completed[pivotIndex]!;

  let prominence = 50;
  if (type === 'SWING_HIGH' && left.length) {
    const maxLeft = Math.max(...left.map((b) => b.high));
    prominence = clamp(((price - maxLeft) / Math.max(atr, 1e-9)) * 35 + 45, 0, 100);
  } else if (type === 'SWING_LOW' && left.length) {
    const minLeft = Math.min(...left.map((b) => b.low));
    prominence = clamp(((minLeft - price) / Math.max(atr, 1e-9)) * 35 + 45, 0, 100);
  }

  let reaction = 40;
  if (right.length) {
    if (type === 'SWING_HIGH') {
      const minRight = Math.min(...right.map((b) => b.low));
      reaction = clamp(((price - minRight) / Math.max(atr, 1e-9)) * 30 + 35, 0, 100);
    } else {
      const maxRight = Math.max(...right.map((b) => b.high));
      reaction = clamp(((maxRight - price) / Math.max(atr, 1e-9)) * 30 + 35, 0, 100);
    }
  }

  // Separation: distance to previous same-type extreme in lookback.
  let separation = 50;
  const look = completed.slice(Math.max(0, pivotIndex - 20), pivotIndex);
  if (look.length) {
    if (type === 'SWING_HIGH') {
      const priorMax = Math.max(...look.map((b) => b.high));
      separation = clamp(Math.abs(price - priorMax) / Math.max(atr, 1e-9) * 25 + 40, 0, 100);
    } else {
      const priorMin = Math.min(...look.map((b) => b.low));
      separation = clamp(Math.abs(price - priorMin) / Math.max(atr, 1e-9) * 25 + 40, 0, 100);
    }
  }

  const barsSinceStart = pivotIndex;
  const duration = clamp(40 + Math.min(barsSinceStart, 40), 0, 100);
  const timeframe = clamp(cfg.timeframeImportance, 0, 100);

  void p;
  return { prominence, reaction, separation, duration, timeframe };
}

export function filterNoiseSwings(swings: SwingPoint[], cfg: SwingStructureConfig): SwingPoint[] {
  const sorted = [...swings].sort((a, b) => a.confirmedAt - b.confirmedAt || a.pivotTime - b.pivotTime);
  const kept: SwingPoint[] = [];
  for (const s of sorted) {
    if (s.significance < cfg.minSignificance) continue;
    const lastSame = [...kept].reverse().find((x) => x.type === s.type);
    if (lastSame) {
      const barGap = Math.abs(s.pivotTime - lastSame.pivotTime) / Math.max(cfg.barSeconds, 1);
      if (barGap < cfg.minBarsBetweenSwings && s.significance <= lastSame.significance + 5) {
        continue;
      }
      // Prefer more significant nearby swing of same type.
      if (barGap < cfg.minBarsBetweenSwings && s.significance > lastSame.significance + 5) {
        const idx = kept.indexOf(lastSame);
        if (idx >= 0) kept.splice(idx, 1);
      }
    }
    kept.push(s);
  }
  return kept;
}

/** Advance swing states using price action after confirmation (causal). */
export function updateSwingStates(
  swings: SwingPoint[],
  completed: SwingBarLike[],
  cfg: SwingStructureConfig,
): SwingPoint[] {
  return swings.map((s) => {
    const after = completed.filter((b) => b.time >= s.confirmedAt - cfg.barSeconds + 1);
    // Bars that open at/after confirmation close.
    const post = completed.filter((b) => b.time + cfg.barSeconds > s.confirmedAt);
    let state: SwingState = 'ACTIVE';
    let testCount = 0;
    let lastInteractionAt: number | null = null;
    let closedBeyond = 0;
    let wickedBeyond = false;
    let reclaimed = false;

    for (const b of post) {
      const near = distanceBps(b.close, s.price) <= cfg.nearThresholdBps * 1.5;
      if (s.type === 'SWING_HIGH') {
        if (b.high >= s.price) {
          testCount += 1;
          lastInteractionAt = b.time;
          if (b.high > s.price && b.close < s.price) {
            wickedBeyond = true;
            reclaimed = true;
          }
          if (b.close > s.price) {
            closedBeyond += 1;
            const beyond = distanceBps(b.close, s.price);
            if (beyond >= cfg.acceptBeyondBps) state = 'BREAKING';
            else state = 'TESTING';
          } else if (near || b.high >= s.price) {
            if (state === 'ACTIVE' || state === 'REJECTED') state = 'TESTING';
          }
        }
        if (closedBeyond >= cfg.acceptConfirmCloses && b.close > s.price) {
          const beyond = distanceBps(b.close, s.price);
          if (beyond >= cfg.acceptBeyondBps) state = 'BROKEN';
        }
        if (wickedBeyond && reclaimed && closedBeyond === 0) state = 'REJECTED';
      } else {
        if (b.low <= s.price) {
          testCount += 1;
          lastInteractionAt = b.time;
          if (b.low < s.price && b.close > s.price) {
            wickedBeyond = true;
            reclaimed = true;
          }
          if (b.close < s.price) {
            closedBeyond += 1;
            const beyond = distanceBps(b.close, s.price);
            if (beyond >= cfg.acceptBeyondBps) state = 'BREAKING';
            else state = 'TESTING';
          } else if (near || b.low <= s.price) {
            if (state === 'ACTIVE' || state === 'REJECTED') state = 'TESTING';
          }
        }
        if (closedBeyond >= cfg.acceptConfirmCloses && b.close < s.price) {
          const beyond = distanceBps(b.close, s.price);
          if (beyond >= cfg.acceptBeyondBps) state = 'BROKEN';
        }
        if (wickedBeyond && reclaimed && closedBeyond === 0) state = 'REJECTED';
      }
    }

    // Retest after break.
    if (state === 'BROKEN') {
      for (const b of post) {
        if (s.type === 'SWING_HIGH' && b.low <= s.price && b.close > s.price) {
          state = 'RETESTING';
          lastInteractionAt = b.time;
        }
        if (s.type === 'SWING_LOW' && b.high >= s.price && b.close < s.price) {
          state = 'RETESTING';
          lastInteractionAt = b.time;
        }
      }
    }

    void after;
    return { ...s, state, testCount, lastInteractionAt };
  });
}

export function classifyStructureSequence(swings: SwingPoint[]): {
  structure: StructureState;
  steps: StructureStep[];
} {
  const ordered = [...swings]
    .filter((s) => !s.pending)
    .sort((a, b) => a.confirmedAt - b.confirmedAt || a.pivotTime - b.pivotTime);
  if (ordered.length < 2) return { structure: 'UNKNOWN', steps: [] };

  const highs = ordered.filter((s) => s.type === 'SWING_HIGH');
  const lows = ordered.filter((s) => s.type === 'SWING_LOW');
  const steps: StructureStep[] = [];

  for (let i = 1; i < highs.length; i++) {
    const a = highs[i - 1]!;
    const b = highs[i]!;
    if (b.price > a.price * 1.00005) steps.push('HH');
    else if (b.price < a.price * 0.99995) steps.push('LH');
    else steps.push('EQH');
  }
  for (let i = 1; i < lows.length; i++) {
    const a = lows[i - 1]!;
    const b = lows[i]!;
    if (b.price > a.price * 1.00005) steps.push('HL');
    else if (b.price < a.price * 0.99995) steps.push('LL');
    else steps.push('EQL');
  }

  const recentHighs = highs.slice(-2);
  const recentLows = lows.slice(-2);
  const hh = recentHighs.length === 2 && recentHighs[1]!.price > recentHighs[0]!.price;
  const lh = recentHighs.length === 2 && recentHighs[1]!.price < recentHighs[0]!.price;
  const hl = recentLows.length === 2 && recentLows[1]!.price > recentLows[0]!.price;
  const ll = recentLows.length === 2 && recentLows[1]!.price < recentLows[0]!.price;

  let structure: StructureState = 'UNKNOWN';
  if (hh && hl) structure = 'BULLISH_STRUCTURE';
  else if (lh && ll) structure = 'BEARISH_STRUCTURE';
  else if ((hh && ll) || (lh && hl)) structure = 'TRANSITION';
  else if (recentHighs.length >= 1 && recentLows.length >= 1) structure = 'RANGE';

  return { structure, steps };
}

export function selectRecentSwings(
  swings: SwingPoint[],
  cfg: SwingStructureConfig,
): { recentSwingHigh: SwingPoint | null; recentSwingLow: SwingPoint | null; visible: SwingPoint[] } {
  const activeish = swings.filter(
    (s) => !s.pending && s.state !== 'INVALIDATED' && s.significance >= cfg.minSignificance,
  );
  const highs = activeish
    .filter((s) => s.type === 'SWING_HIGH')
    .sort((a, b) => b.confirmedAt - a.confirmedAt);
  const lows = activeish
    .filter((s) => s.type === 'SWING_LOW')
    .sort((a, b) => b.confirmedAt - a.confirmedAt);

  const visibleHighs = highs.slice(0, cfg.maxVisibleHighs);
  const visibleLows = lows.slice(0, cfg.maxVisibleLows);

  // Prefer ACTIVE/TESTING major for "recent", else latest.
  const pick = (list: SwingPoint[]): SwingPoint | null => {
    if (!list.length) return null;
    const prefer = list.find((s) => s.state === 'ACTIVE' || s.state === 'TESTING' || s.state === 'REJECTED');
    return prefer ?? list[0]!;
  };

  return {
    recentSwingHigh: pick(highs),
    recentSwingLow: pick(lows),
    visible: [...visibleHighs, ...visibleLows].sort((a, b) => a.pivotTime - b.pivotTime),
  };
}

export function classifySwingLocation(input: {
  price: number;
  swingHigh: number | null;
  swingLow: number | null;
  nearBps: number;
  atBps: number;
}): SwingLocationState {
  const { price, swingHigh, swingLow, nearBps, atBps } = input;
  if (swingHigh == null && swingLow == null) return 'UNKNOWN';

  if (swingHigh != null) {
    const dH = distanceBps(price, swingHigh);
    if (dH <= atBps) return 'AT_SWING_HIGH';
    if (price > swingHigh) return 'ABOVE_SWING_HIGH';
    if (dH <= nearBps) return 'NEAR_SWING_HIGH';
  }
  if (swingLow != null) {
    const dL = distanceBps(price, swingLow);
    if (dL <= atBps) return 'AT_SWING_LOW';
    if (price < swingLow) return 'BELOW_SWING_LOW';
    if (dL <= nearBps) return 'NEAR_SWING_LOW';
  }
  if (swingHigh != null && price > swingHigh) return 'ABOVE_SWING_HIGH';
  if (swingLow != null && price < swingLow) return 'BELOW_SWING_LOW';
  if (swingHigh != null && swingLow != null) return 'BETWEEN_SWINGS';
  if (swingHigh != null) return 'BELOW_SWING_HIGH';
  if (swingLow != null) return 'ABOVE_SWING_LOW';
  return 'UNKNOWN';
}

export function classifySwingInteraction(input: {
  bar: SwingBarLike;
  swingHigh: number | null;
  swingLow: number | null;
  nearBps: number;
  acceptBeyondBps: number;
  priorClosedAboveHigh?: boolean;
  priorClosedBelowLow?: boolean;
}): SwingInteractionState {
  const { bar, swingHigh, swingLow, nearBps, acceptBeyondBps } = input;

  if (swingHigh != null) {
    const dClose = distanceBps(bar.close, swingHigh);
    if (bar.high > swingHigh && bar.close < swingHigh) return 'SWING_HIGH_REJECTION';
    if (bar.close > swingHigh && distanceBps(bar.close, swingHigh) >= acceptBeyondBps) {
      return input.priorClosedAboveHigh ? 'ACCEPTED_ABOVE_SWING_HIGH' : 'CLOSED_ABOVE_SWING_HIGH';
    }
    if (bar.high > swingHigh && bar.close >= swingHigh) return 'WICKED_ABOVE_SWING_HIGH';
    if (bar.high >= swingHigh) return 'TOUCHED_SWING_HIGH';
    if (bar.close < swingHigh && dClose <= nearBps) return 'APPROACHING_SWING_HIGH';
  }

  if (swingLow != null) {
    const dClose = distanceBps(bar.close, swingLow);
    if (bar.low < swingLow && bar.close > swingLow) return 'SWING_LOW_REJECTION';
    if (bar.close < swingLow && distanceBps(bar.close, swingLow) >= acceptBeyondBps) {
      return input.priorClosedBelowLow ? 'ACCEPTED_BELOW_SWING_LOW' : 'CLOSED_BELOW_SWING_LOW';
    }
    if (bar.low < swingLow && bar.close <= swingLow) return 'WICKED_BELOW_SWING_LOW';
    if (bar.low <= swingLow) return 'TOUCHED_SWING_LOW';
    if (bar.close > swingLow && dClose <= nearBps) return 'APPROACHING_SWING_LOW';
  }

  return 'NONE';
}

export function detectBosChoch(input: {
  structure: StructureState;
  recentSwingHigh: SwingPoint | null;
  recentSwingLow: SwingPoint | null;
  close: number;
  acceptBeyondBps: number;
}): BosChochEvent {
  const { structure, recentSwingHigh, recentSwingLow, close, acceptBeyondBps } = input;
  if (recentSwingHigh && close > recentSwingHigh.price) {
    const beyond = distanceBps(close, recentSwingHigh.price) >= acceptBeyondBps;
    if (!beyond) return 'NONE';
    // Wick-only already excluded by using close.
    return structure === 'BEARISH_STRUCTURE' ? 'BULLISH_CHOCH' : 'BULLISH_BOS';
  }
  if (recentSwingLow && close < recentSwingLow.price) {
    const beyond = distanceBps(close, recentSwingLow.price) >= acceptBeyondBps;
    if (!beyond) return 'NONE';
    return structure === 'BULLISH_STRUCTURE' ? 'BEARISH_CHOCH' : 'BEARISH_BOS';
  }
  return 'NONE';
}

export function swingHistoricalConfluence(input: {
  swingHigh: number | null;
  swingLow: number | null;
  resistance?: { low: number; high: number } | null;
  support?: { low: number; high: number } | null;
  confluenceBps: number;
}): SwingHistoricalConfluence {
  const { swingHigh, swingLow, resistance, support, confluenceBps } = input;
  if (swingHigh != null && resistance) {
    const mid = (resistance.low + resistance.high) / 2;
    if (swingHigh >= resistance.low && swingHigh <= resistance.high) return 'SWING_HIGH_AT_RESISTANCE';
    if (distanceBps(swingHigh, mid) <= confluenceBps) return 'SWING_HIGH_AT_RESISTANCE';
  }
  if (swingLow != null && support) {
    const mid = (support.low + support.high) / 2;
    if (swingLow >= support.low && swingLow <= support.high) return 'SWING_LOW_AT_SUPPORT';
    if (distanceBps(swingLow, mid) <= confluenceBps) return 'SWING_LOW_AT_SUPPORT';
  }
  return 'NONE';
}

export function swingLiveConfluence(input: {
  swingHigh: number | null;
  swingLow: number | null;
  liveAsk?: { price: number } | null;
  liveBid?: { price: number } | null;
  confluenceBps: number;
}): SwingLiveConfluence {
  const { swingHigh, swingLow, liveAsk, liveBid, confluenceBps } = input;
  if (swingHigh != null && liveAsk?.price != null && distanceBps(liveAsk.price, swingHigh) <= confluenceBps) {
    return 'LIVE_ASK_AT_SWING_HIGH';
  }
  if (swingLow != null && liveBid?.price != null && distanceBps(liveBid.price, swingLow) <= confluenceBps) {
    return 'LIVE_BID_AT_SWING_LOW';
  }
  return 'NONE';
}

export function emptySwingStructure(timestamp = 0, timeframe = '15m'): SwingStructureSnapshot {
  return {
    version: SWING_STRUCTURE_VERSION,
    timestamp,
    timeframe,
    structure: 'UNKNOWN',
    structureSteps: [],
    swings: [],
    recentSwingHigh: null,
    recentSwingLow: null,
    pendingSwingHigh: null,
    pendingSwingLow: null,
    currentContext: null,
  };
}

export function evaluateSwingStructure(input: EvaluateSwingStructureInput): SwingStructureSnapshot {
  const cfg = mergeSwingConfig(input.config);
  const completed = completedSwingBars(input.bars, input.asOf, cfg.barSeconds);
  if (!completed.length) return emptySwingStructure(input.asOf, cfg.timeframeLabel);

  let swings = detectConfirmedSwings(completed, cfg);
  // Causal filter: only swings confirmed by asOf.
  swings = swings.filter((s) => s.confirmedAt <= input.asOf);
  swings = filterNoiseSwings(swings, cfg);
  swings = updateSwingStates(swings, completed, cfg);

  const { structure, steps } = classifyStructureSequence(swings);
  const { recentSwingHigh, recentSwingLow, visible } = selectRecentSwings(swings, cfg);
  const pending = detectPendingSwings(completed, cfg);

  const price =
    input.currentPrice ??
    input.currentBar?.close ??
    completed[completed.length - 1]?.close ??
    null;

  let currentContext: SwingCurrentContext | null = null;
  if (price != null && Number.isFinite(price)) {
    const atr = atrOf(completed, cfg.atrPeriod);
    const nearBps = effectiveNearBps(cfg, atr, price);
    const sh = recentSwingHigh?.price ?? null;
    const sl = recentSwingLow?.price ?? null;
    const bar =
      input.currentBar ??
      ({
        time: input.asOf,
        open: price,
        high: price,
        low: price,
        close: price,
      } satisfies SwingBarLike);

    const location = classifySwingLocation({
      price,
      swingHigh: sh,
      swingLow: sl,
      nearBps,
      atBps: cfg.atThresholdBps,
    });

    const prior = completed[completed.length - 1];
    const interaction = classifySwingInteraction({
      bar,
      swingHigh: sh,
      swingLow: sl,
      nearBps,
      acceptBeyondBps: cfg.acceptBeyondBps,
      priorClosedAboveHigh: prior != null && sh != null && prior.close > sh,
      priorClosedBelowLow: prior != null && sl != null && prior.close < sl,
    });

    const bosChoch = detectBosChoch({
      structure,
      recentSwingHigh,
      recentSwingLow,
      close: bar.close,
      acceptBeyondBps: cfg.acceptBeyondBps,
    });

    currentContext = {
      location,
      distanceToSwingHighBps: sh != null ? distanceBps(price, sh) : null,
      distanceToSwingLowBps: sl != null ? distanceBps(price, sl) : null,
      interaction,
      bosChoch,
      confluenceHistorical: swingHistoricalConfluence({
        swingHigh: sh,
        swingLow: sl,
        resistance: input.historicalResistance,
        support: input.historicalSupport,
        confluenceBps: cfg.confluenceBps,
      }),
      confluenceLive: swingLiveConfluence({
        swingHigh: sh,
        swingLow: sl,
        liveAsk: input.liveAsk,
        liveBid: input.liveBid,
        confluenceBps: cfg.confluenceBps,
      }),
    };
  }

  return {
    version: SWING_STRUCTURE_VERSION,
    timestamp: input.asOf,
    timeframe: cfg.timeframeLabel,
    structure,
    structureSteps: steps,
    swings: visible,
    recentSwingHigh,
    recentSwingLow,
    pendingSwingHigh: pending.pendingSwingHigh,
    pendingSwingLow: pending.pendingSwingLow,
    currentContext,
  };
}

export function swingLocationBadge(ctx: SwingCurrentContext | null): string {
  if (!ctx) return '';
  const loc = ctx.location;
  if (loc === 'NEAR_SWING_HIGH' || loc === 'AT_SWING_HIGH') {
    const d = ctx.distanceToSwingHighBps;
    return `${loc.replaceAll('_', ' ')}${d != null ? ` · ${d.toFixed(0)} bps` : ''}`;
  }
  if (loc === 'NEAR_SWING_LOW' || loc === 'AT_SWING_LOW') {
    const d = ctx.distanceToSwingLowBps;
    return `${loc.replaceAll('_', ' ')}${d != null ? ` · ${d.toFixed(0)} bps` : ''}`;
  }
  if (loc === 'ABOVE_SWING_HIGH' || loc === 'BELOW_SWING_LOW' || loc === 'BETWEEN_SWINGS') {
    return loc.replaceAll('_', ' ');
  }
  return '';
}
