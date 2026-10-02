/**
 * Previous completed 15m candle references — short-term levels, not proven S/R.
 * Never: P15 HIGH = SHORT or P15 LOW = LONG.
 */

export const PREVIOUS_15M_VERSION = 'PREVIOUS_15M_V1';
export const P15_TIMEFRAME_MINUTES = 15;
export const P15_BUCKET_SECONDS = P15_TIMEFRAME_MINUTES * 60;

export type P15LocationState =
  | 'ABOVE_P15_HIGH'
  | 'NEAR_P15_HIGH'
  | 'AT_P15_HIGH'
  | 'INSIDE_P15_RANGE'
  | 'AT_P15_LOW'
  | 'NEAR_P15_LOW'
  | 'BELOW_P15_LOW'
  | 'UNKNOWN';

export type P15InteractionState =
  | 'NONE'
  | 'APPROACHING_P15_HIGH'
  | 'TOUCHED_P15_HIGH'
  | 'WICKED_ABOVE_P15_HIGH'
  | 'CLOSED_ABOVE_P15_HIGH'
  | 'ACCEPTED_ABOVE_P15_HIGH'
  | 'P15_HIGH_REJECTION'
  | 'APPROACHING_P15_LOW'
  | 'TOUCHED_P15_LOW'
  | 'WICKED_BELOW_P15_LOW'
  | 'CLOSED_BELOW_P15_LOW'
  | 'ACCEPTED_BELOW_P15_LOW'
  | 'P15_LOW_REJECTION';

export type P15DataStatus = 'OK' | 'P15_DATA_UNAVAILABLE';

export type P15MidSide = 'ABOVE_P15_MID' | 'BELOW_P15_MID' | 'AT_P15_MID' | 'UNKNOWN';

export interface Previous15mBarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Previous15mReference {
  timeframe: '15m';
  sourceCandleOpenTime: number;
  sourceCandleCloseTime: number;
  high: number;
  low: number;
  open: number;
  close: number;
  mid: number;
  range: number;
  rangeBps: number;
}

export interface P15CurrentContext {
  location: P15LocationState;
  midSide: P15MidSide;
  distanceToHighBps: number | null;
  distanceToLowBps: number | null;
  interaction: P15InteractionState;
  confluenceHistorical:
    | 'NONE'
    | 'P15_HIGH_AT_HISTORICAL_RESISTANCE'
    | 'P15_LOW_AT_HISTORICAL_SUPPORT';
  confluenceLive: 'NONE' | 'LIVE_ASK_AT_P15_HIGH' | 'LIVE_BID_AT_P15_LOW';
}

export interface Previous15mSnapshot {
  version: typeof PREVIOUS_15M_VERSION;
  timestamp: number;
  status: P15DataStatus;
  previous15m: Previous15mReference | null;
  currentContext: P15CurrentContext | null;
}

export interface Previous15mConfig {
  nearThresholdBps: number;
  atThresholdBps: number;
  /** Closes above/below for acceptance. */
  acceptConfirmCloses: number;
  confluenceBps: number;
  /** Optional ATR scale for near threshold. */
  nearAtrFraction: number;
}

export const DEFAULT_PREVIOUS_15M_CONFIG: Previous15mConfig = {
  nearThresholdBps: 10,
  atThresholdBps: 3,
  acceptConfirmCloses: 1,
  confluenceBps: 12,
  nearAtrFraction: 0.15,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function p15BucketOpenTime(unixSeconds: number): number {
  return unixSeconds - (unixSeconds % P15_BUCKET_SECONDS);
}

export function distanceBps(price: number, level: number): number {
  if (!(price > 0) || !(level > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(price - level) / level) * 10_000;
}

/**
 * Completed 15m bars only — excludes the in-progress bucket at `asOf`.
 * Input may be 1m or already-15m bars; callers should pass 15m-aligned bars.
 */
export function completed15mBars(
  bars: Previous15mBarLike[],
  asOfUnixSeconds: number,
): Previous15mBarLike[] {
  const liveOpen = p15BucketOpenTime(asOfUnixSeconds);
  return bars
    .filter((b) => b.time < liveOpen)
    .slice()
    .sort((a, b) => a.time - b.time);
}

/**
 * Immediately previous completed 15m candle at timestamp T (no lookahead).
 */
export function selectPreviousCompleted15m(
  bars15m: Previous15mBarLike[],
  asOfUnixSeconds: number,
): Previous15mBarLike | null {
  const completed = completed15mBars(bars15m, asOfUnixSeconds);
  return completed.length ? completed[completed.length - 1]! : null;
}

export function buildPrevious15mReference(bar: Previous15mBarLike): Previous15mReference {
  const range = Math.max(0, bar.high - bar.low);
  const mid = (bar.high + bar.low) / 2;
  const rangeBps = bar.low > 0 ? (range / bar.low) * 10_000 : 0;
  return {
    timeframe: '15m',
    sourceCandleOpenTime: bar.time,
    sourceCandleCloseTime: bar.time + P15_BUCKET_SECONDS,
    high: bar.high,
    low: bar.low,
    open: bar.open,
    close: bar.close,
    mid,
    range,
    rangeBps: Math.round(rangeBps * 10) / 10,
  };
}

export function effectiveNearBps(
  config: Previous15mConfig,
  atr: number | null | undefined,
  price: number,
): number {
  if (!(atr != null && atr > 0 && price > 0)) return config.nearThresholdBps;
  const fromAtr = (atr / price) * 10_000 * config.nearAtrFraction;
  return clamp(Math.max(config.nearThresholdBps, fromAtr), config.atThresholdBps, 40);
}

export function classifyP15Location(input: {
  price: number;
  high: number;
  low: number;
  nearBps: number;
  atBps: number;
}): P15LocationState {
  const { price, high, low, nearBps, atBps } = input;
  if (!(price > 0) || !(high > 0) || !(low > 0)) return 'UNKNOWN';
  const dH = distanceBps(price, high);
  const dL = distanceBps(price, low);

  if (dH <= atBps) return 'AT_P15_HIGH';
  if (dL <= atBps) return 'AT_P15_LOW';
  if (price > high) return 'ABOVE_P15_HIGH';
  if (price < low) return 'BELOW_P15_LOW';
  if (dH <= nearBps) return 'NEAR_P15_HIGH';
  if (dL <= nearBps) return 'NEAR_P15_LOW';
  if (price >= low && price <= high) return 'INSIDE_P15_RANGE';
  return 'UNKNOWN';
}

export function classifyP15Mid(price: number, mid: number, atBps: number): P15MidSide {
  if (!(price > 0) || !(mid > 0)) return 'UNKNOWN';
  const d = distanceBps(price, mid);
  if (d <= atBps) return 'AT_P15_MID';
  return price >= mid ? 'ABOVE_P15_MID' : 'BELOW_P15_MID';
}

/**
 * Interaction of the *current* (possibly live) bar vs fixed P15 high/low.
 */
export function classifyP15Interaction(input: {
  bar: Previous15mBarLike;
  high: number;
  low: number;
  nearBps: number;
  /** Prior closes already accepted beyond (optional). */
  closesAboveHigh?: number;
  closesBelowLow?: number;
  acceptConfirmCloses?: number;
}): P15InteractionState {
  const { bar, high, low, nearBps } = input;
  const acceptN = input.acceptConfirmCloses ?? 1;
  const closesAbove = input.closesAboveHigh ?? 0;
  const closesBelow = input.closesBelowLow ?? 0;

  const wickAbove = bar.high > high;
  const wickBelow = bar.low < low;
  const closeAbove = bar.close > high;
  const closeBelow = bar.close < low;
  const touchHigh = bar.high >= high || distanceBps(bar.close, high) <= nearBps;
  const touchLow = bar.low <= low || distanceBps(bar.close, low) <= nearBps;

  // Rejection / false break takes precedence over acceptance on same bar.
  if (wickAbove && bar.close < high) return 'P15_HIGH_REJECTION';
  if (wickBelow && bar.close > low) return 'P15_LOW_REJECTION';

  if (closeAbove) {
    if (closesAbove + 1 >= acceptN) return 'ACCEPTED_ABOVE_P15_HIGH';
    return 'CLOSED_ABOVE_P15_HIGH';
  }
  if (closeBelow) {
    if (closesBelow + 1 >= acceptN) return 'ACCEPTED_BELOW_P15_LOW';
    return 'CLOSED_BELOW_P15_LOW';
  }

  if (wickAbove) return 'WICKED_ABOVE_P15_HIGH';
  if (wickBelow) return 'WICKED_BELOW_P15_LOW';
  if (touchHigh) return 'TOUCHED_P15_HIGH';
  if (touchLow) return 'TOUCHED_P15_LOW';

  if (distanceBps(bar.close, high) <= nearBps * 1.5 && bar.close <= high) {
    return 'APPROACHING_P15_HIGH';
  }
  if (distanceBps(bar.close, low) <= nearBps * 1.5 && bar.close >= low) {
    return 'APPROACHING_P15_LOW';
  }
  return 'NONE';
}

export function p15HistoricalConfluence(input: {
  high: number;
  low: number;
  historicalResistance?: { zoneLow: number; zoneHigh: number; center?: number } | null;
  historicalSupport?: { zoneLow: number; zoneHigh: number; center?: number } | null;
  confluenceBps: number;
}): P15CurrentContext['confluenceHistorical'] {
  const res = input.historicalResistance;
  if (res) {
    const inside =
      input.high >= res.zoneLow && input.high <= res.zoneHigh;
    const near =
      distanceBps(input.high, res.center ?? (res.zoneLow + res.zoneHigh) / 2) <= input.confluenceBps;
    if (inside || near) return 'P15_HIGH_AT_HISTORICAL_RESISTANCE';
  }
  const sup = input.historicalSupport;
  if (sup) {
    const inside = input.low >= sup.zoneLow && input.low <= sup.zoneHigh;
    const near =
      distanceBps(input.low, sup.center ?? (sup.zoneLow + sup.zoneHigh) / 2) <= input.confluenceBps;
    if (inside || near) return 'P15_LOW_AT_HISTORICAL_SUPPORT';
  }
  return 'NONE';
}

export function p15LiveConfluence(input: {
  high: number;
  low: number;
  liveAsk?: { price: number } | null;
  liveBid?: { price: number } | null;
  confluenceBps: number;
}): P15CurrentContext['confluenceLive'] {
  if (input.liveAsk && distanceBps(input.liveAsk.price, input.high) <= input.confluenceBps) {
    return 'LIVE_ASK_AT_P15_HIGH';
  }
  if (input.liveBid && distanceBps(input.liveBid.price, input.low) <= input.confluenceBps) {
    return 'LIVE_BID_AT_P15_LOW';
  }
  return 'NONE';
}

export interface EvaluatePrevious15mInput {
  /** 15m-aligned bars (or any bars already bucketing as 15m). */
  bars15m: Previous15mBarLike[];
  /** Evaluation time (unix seconds). */
  asOf: number;
  /** Current price / live bar for location + interaction. */
  currentPrice: number;
  currentBar?: Previous15mBarLike | null;
  atr?: number | null;
  config?: Partial<Previous15mConfig>;
  historicalResistance?: { zoneLow: number; zoneHigh: number; center?: number } | null;
  historicalSupport?: { zoneLow: number; zoneHigh: number; center?: number } | null;
  liveAsk?: { price: number } | null;
  liveBid?: { price: number } | null;
}

export function evaluatePrevious15m(input: EvaluatePrevious15mInput): Previous15mSnapshot {
  const config: Previous15mConfig = { ...DEFAULT_PREVIOUS_15M_CONFIG, ...(input.config ?? {}) };
  const prev = selectPreviousCompleted15m(input.bars15m, input.asOf);
  if (!prev) {
    return {
      version: PREVIOUS_15M_VERSION,
      timestamp: input.asOf,
      status: 'P15_DATA_UNAVAILABLE',
      previous15m: null,
      currentContext: null,
    };
  }

  const ref = buildPrevious15mReference(prev);
  const nearBps = effectiveNearBps(config, input.atr, input.currentPrice);
  const location = classifyP15Location({
    price: input.currentPrice,
    high: ref.high,
    low: ref.low,
    nearBps,
    atBps: config.atThresholdBps,
  });
  const midSide = classifyP15Mid(input.currentPrice, ref.mid, config.atThresholdBps);
  const bar = input.currentBar ?? {
    time: input.asOf,
    open: input.currentPrice,
    high: input.currentPrice,
    low: input.currentPrice,
    close: input.currentPrice,
  };
  const interaction = classifyP15Interaction({
    bar,
    high: ref.high,
    low: ref.low,
    nearBps,
    acceptConfirmCloses: config.acceptConfirmCloses,
  });

  return {
    version: PREVIOUS_15M_VERSION,
    timestamp: input.asOf,
    status: 'OK',
    previous15m: ref,
    currentContext: {
      location,
      midSide,
      distanceToHighBps: Math.round(distanceBps(input.currentPrice, ref.high) * 10) / 10,
      distanceToLowBps: Math.round(distanceBps(input.currentPrice, ref.low) * 10) / 10,
      interaction,
      confluenceHistorical: p15HistoricalConfluence({
        high: ref.high,
        low: ref.low,
        historicalResistance: input.historicalResistance,
        historicalSupport: input.historicalSupport,
        confluenceBps: config.confluenceBps,
      }),
      confluenceLive: p15LiveConfluence({
        high: ref.high,
        low: ref.low,
        liveAsk: input.liveAsk,
        liveBid: input.liveBid,
        confluenceBps: config.confluenceBps,
      }),
    },
  };
}

/** Compact badge for UI. */
export function p15LocationBadge(ctx: P15CurrentContext | null): string {
  if (!ctx) return 'P15 UNAVAILABLE';
  const loc = ctx.location.replace(/_/g, ' ');
  if (ctx.location === 'NEAR_P15_HIGH' || ctx.location === 'AT_P15_HIGH') {
    return `${loc} · ${ctx.distanceToHighBps ?? '—'} bps`;
  }
  if (ctx.location === 'NEAR_P15_LOW' || ctx.location === 'AT_P15_LOW') {
    return `${loc} · ${ctx.distanceToLowBps ?? '—'} bps`;
  }
  if (ctx.location === 'ABOVE_P15_HIGH') {
    return `${loc} · ${ctx.distanceToHighBps ?? '—'} bps`;
  }
  if (ctx.location === 'BELOW_P15_LOW') {
    return `${loc} · ${ctx.distanceToLowBps ?? '—'} bps`;
  }
  return loc;
}

export function emptyPrevious15m(timestamp = 0): Previous15mSnapshot {
  return {
    version: PREVIOUS_15M_VERSION,
    timestamp,
    status: 'P15_DATA_UNAVAILABLE',
    previous15m: null,
    currentContext: null,
  };
}
