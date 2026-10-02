/**
 * Displacement + candle delta + CVD — pure helpers.
 *
 * Definitions (do not conflate):
 * - Volume: how much traded
 * - Delta: aggressiveBuy − aggressiveSell this candle
 * - CVD: running sum of candle deltas
 * - Range: high − low
 * - Displacement: close − open (directional body), usually in bps
 */

export type DisplacementDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type CvdResetMode = 'SESSION' | 'UTC_DAY' | 'ROLLING_WINDOW' | 'FROM_LOADED_HISTORY';

export type FlowDataQuality = 'GOOD' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';

export interface OhlcLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AggressiveFlowLike {
  /** Aggressive buy notional (quote USD). */
  aggressiveBuy?: number;
  /** Aggressive sell notional (quote USD). */
  aggressiveSell?: number;
  totalBuy?: number;
  totalSell?: number;
  /** When false / missing with zero flow → CVD does not invent a side. */
  hasFootprint?: boolean;
  /** Explicit quality override for this bar's aggressor data. */
  flowQuality?: FlowDataQuality;
  time?: number;
}

export interface DisplacementMetrics {
  displacementRaw: number;
  displacementPct: number;
  displacementBps: number;
  rangeRaw: number;
  rangeBps: number;
  bodyEfficiency: number;
  displacementATR: number | null;
  direction: DisplacementDirection;
}

export interface CandleFlowMetrics extends DisplacementMetrics {
  aggressiveBuy: number;
  aggressiveSell: number;
  delta: number;
  cvd: number;
  cvdChange: number;
  dataQuality: FlowDataQuality;
  cvdResetMode: CvdResetMode;
  cvdStartTimestamp: number | null;
  incomplete: boolean;
}

export interface CvdAccumulateOptions {
  resetMode?: CvdResetMode;
  /** SESSION / UTC_DAY boundary helper; unix ms. Default Date.now()-based for live. */
  asOfMs?: number;
  /** Rolling window length in bars (ROLLING_WINDOW only). */
  rollingBars?: number;
  /** Treat |bps| below this as NEUTRAL. Default 1 bp. */
  neutralBps?: number;
  /** Optional ATR series aligned to bars (same length) for displacementATR. */
  atrByIndex?: Array<number | null | undefined>;
  /** Mark the last bar as the live / incomplete candle. */
  lastIsLive?: boolean;
}

const EPS = 1e-12;

export function aggressiveVolumes(bar: AggressiveFlowLike): { buy: number; sell: number } {
  const buy = Number(bar.aggressiveBuy ?? bar.totalBuy ?? 0);
  const sell = Number(bar.aggressiveSell ?? bar.totalSell ?? 0);
  return {
    buy: Number.isFinite(buy) && buy > 0 ? buy : 0,
    sell: Number.isFinite(sell) && sell > 0 ? sell : 0,
  };
}

export function candleDelta(bar: AggressiveFlowLike): number {
  const { buy, sell } = aggressiveVolumes(bar);
  return buy - sell;
}

export function displacementDirection(bps: number, neutralBps = 1): DisplacementDirection {
  if (!Number.isFinite(bps)) return 'NEUTRAL';
  if (bps > neutralBps) return 'BULLISH';
  if (bps < -neutralBps) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Primary displacement = close − open.
 * Range = high − low (stored separately — never returned as displacement).
 */
export function computeDisplacement(
  bar: OhlcLike,
  opts?: { atr?: number | null; neutralBps?: number },
): DisplacementMetrics {
  const open = Number(bar.open);
  const high = Number(bar.high);
  const low = Number(bar.low);
  const close = Number(bar.close);
  const atr = opts?.atr;
  const neutralBps = opts?.neutralBps ?? 1;

  if (![open, high, low, close].every((n) => Number.isFinite(n)) || open <= 0) {
    return {
      displacementRaw: 0,
      displacementPct: 0,
      displacementBps: 0,
      rangeRaw: 0,
      rangeBps: 0,
      bodyEfficiency: 0,
      displacementATR: null,
      direction: 'NEUTRAL',
    };
  }

  const displacementRaw = close - open;
  const displacementPct = (displacementRaw / open) * 100;
  const displacementBps = (displacementRaw / open) * 10_000;
  const rangeRaw = Math.max(0, high - low);
  const rangeBps = (rangeRaw / open) * 10_000;
  const bodyEfficiency = Math.abs(displacementRaw) / Math.max(rangeRaw, EPS);
  const displacementATR =
    atr != null && Number.isFinite(atr) && atr > 0 ? displacementRaw / atr : null;

  return {
    displacementRaw,
    displacementPct,
    displacementBps,
    rangeRaw,
    rangeBps,
    bodyEfficiency: Math.min(1, Math.max(0, bodyEfficiency)),
    displacementATR,
    direction: displacementDirection(displacementBps, neutralBps),
  };
}

export function flowDataQuality(bar: AggressiveFlowLike): FlowDataQuality {
  if (bar.flowQuality) return bar.flowQuality;
  const { buy, sell } = aggressiveVolumes(bar);
  if (bar.hasFootprint === false && buy + sell <= 0) return 'UNAVAILABLE';
  if (buy + sell <= 0) return 'UNAVAILABLE';
  if (bar.hasFootprint === false) return 'PARTIAL';
  return 'GOOD';
}

/** UTC day open (00:00:00Z) in unix seconds for a bar open time (seconds). */
export function utcDayStartSec(barTimeSec: number): number {
  const d = new Date(barTimeSec * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

/**
 * Whether CVD should reset before applying this bar's delta.
 * SESSION currently aliases UTC_DAY (24/7 crypto default).
 */
export function shouldResetCvd(
  mode: CvdResetMode,
  barTimeSec: number,
  prevBarTimeSec: number | null,
  rollingBars: number,
  index: number,
): boolean {
  if (mode === 'FROM_LOADED_HISTORY') return index === 0;
  if (mode === 'ROLLING_WINDOW') {
    // Window is applied by only summing the last N bars; no mid-stream reset flag.
    return false;
  }
  if (mode === 'UTC_DAY' || mode === 'SESSION') {
    if (prevBarTimeSec == null) return true;
    return utcDayStartSec(barTimeSec) !== utcDayStartSec(prevBarTimeSec);
  }
  return index === 0;
}

export interface AnnotatedFlowBar extends CandleFlowMetrics {
  time: number;
}

/**
 * Reconstruct CVD oldest → newest. No lookahead: bar i only sees deltas ≤ i.
 * Bars with UNAVAILABLE flow contribute 0 delta (CVD carries) rather than fabricating sides.
 */
export function annotateBarsWithDisplacementCvd<T extends OhlcLike & AggressiveFlowLike & { time: number }>(
  bars: T[],
  options: CvdAccumulateOptions = {},
): Array<T & AnnotatedFlowBar> {
  const mode: CvdResetMode = options.resetMode ?? 'UTC_DAY';
  const neutralBps = options.neutralBps ?? 1;
  const rollingBars = Math.max(1, options.rollingBars ?? 96);
  const lastIsLive = !!options.lastIsLive;

  const deltas: number[] = [];
  const qualities: FlowDataQuality[] = [];
  for (let i = 0; i < bars.length; i++) {
    const q = flowDataQuality(bars[i]!);
    qualities.push(q);
    deltas.push(q === 'UNAVAILABLE' ? 0 : candleDelta(bars[i]!));
  }

  let cvd = 0;
  let cvdStart: number | null = bars[0]?.time ?? null;
  let prevTime: number | null = null;
  const out: Array<T & AnnotatedFlowBar> = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const reset = shouldResetCvd(mode, bar.time, prevTime, rollingBars, i);
    if (reset) {
      cvd = 0;
      cvdStart = bar.time;
    }

    if (mode === 'ROLLING_WINDOW') {
      const from = Math.max(0, i - rollingBars + 1);
      // Recompute window sum without future bars.
      let sum = 0;
      for (let j = from; j <= i; j++) sum += deltas[j]!;
      cvd = sum;
      cvdStart = bars[from]?.time ?? bar.time;
    } else {
      cvd += deltas[i]!;
    }

    const disp = computeDisplacement(bar, {
      atr: options.atrByIndex?.[i],
      neutralBps,
    });
    const { buy, sell } = aggressiveVolumes(bar);
    const delta = deltas[i]!;
    const incomplete = lastIsLive && i === bars.length - 1;

    out.push({
      ...bar,
      ...disp,
      aggressiveBuy: buy,
      aggressiveSell: sell,
      delta,
      cvd,
      cvdChange: delta,
      dataQuality: qualities[i]!,
      cvdResetMode: mode,
      cvdStartTimestamp: cvdStart,
      incomplete,
      time: bar.time,
    });

    prevTime = bar.time;
  }

  return out;
}

/** Row-level footprint delta — never called CVD. */
export function rowDelta(buyAtPrice: number, sellAtPrice: number): number {
  return (buyAtPrice || 0) - (sellAtPrice || 0);
}

export function reconcileCandleFlow(bar: AggressiveFlowLike, eps = 1e-6): {
  ok: boolean;
  executed: number;
  delta: number;
  sumSides: number;
} {
  const { buy, sell } = aggressiveVolumes(bar);
  const executed = buy + sell;
  const delta = buy - sell;
  const sumSides = buy + sell;
  return {
    ok: Math.abs(sumSides - executed) <= eps,
    executed,
    delta,
    sumSides,
  };
}

export function formatDisplacementBps(bps: number): string {
  if (!Number.isFinite(bps)) return '0 bp';
  const sign = bps > 0 ? '+' : bps < 0 ? '−' : '';
  const abs = Math.abs(bps);
  const txt = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${txt} bp`;
}

export function formatSignedNotional(n: number, fmtAbs: (v: number) => string): string {
  if (!Number.isFinite(n)) return '0';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${fmtAbs(Math.abs(n))}`;
}
