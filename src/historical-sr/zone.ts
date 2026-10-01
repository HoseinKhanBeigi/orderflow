/**
 * Historical S/R zones — areas, not exact ticks.
 * Location vs interaction kept separate; geometry versions are causal.
 */

import type {
  HistoricalBarLike,
  HistoricalLevelType,
  HistoricalZoneInteractionState,
  HistoricalZoneLocationState,
  HistoricalZonePressureState,
  HistoricalZoneVersion,
} from './types.js';

export interface ZoneGeometry {
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
}

export interface ZoneWidthConfig {
  zoneAtrFraction: number;
  zoneMinBps: number;
  /** Extra ATR scale by timeframe (1 = default). */
  timeframeWidthFactor?: number;
}

export function timeframeWidthFactor(tf: string): number {
  const m = /^(\d+)m$/i.exec(tf);
  if (m) {
    const mins = Number(m[1]);
    if (mins <= 1) return 0.85;
    if (mins <= 5) return 0.95;
    if (mins <= 15) return 1;
    if (mins <= 30) return 1.1;
    return 1.15;
  }
  const h = /^(\d+)h$/i.exec(tf);
  if (h) {
    const hours = Number(h[1]);
    if (hours <= 1) return 1.25;
    if (hours <= 4) return 1.45;
    return 1.6;
  }
  if (/^1d$/i.test(tf)) return 1.75;
  return 1;
}

export function zoneHalfWidthOf(
  price: number,
  atr: number,
  config: ZoneWidthConfig,
  sourceTimeframe = '15m',
): number {
  const tf = config.timeframeWidthFactor ?? timeframeWidthFactor(sourceTimeframe);
  const fromAtr = atr * config.zoneAtrFraction * tf;
  const fromBps = price * (config.zoneMinBps / 10_000);
  return Math.max(fromAtr, fromBps, price * 1e-6);
}

export function zoneMetrics(centerPrice: number, zoneLow: number, zoneHigh: number): {
  width: number;
  widthBps: number;
} {
  const width = Math.max(0, zoneHigh - zoneLow);
  const widthBps = centerPrice > 0 ? (width / centerPrice) * 10_000 : 0;
  return { width, widthBps };
}

export function makeZoneGeometry(
  centerPrice: number,
  atr: number,
  config: ZoneWidthConfig,
  sourceTimeframe: string,
): ZoneGeometry & { width: number; widthBps: number } {
  const half = zoneHalfWidthOf(centerPrice, atr, config, sourceTimeframe);
  const zoneLow = centerPrice - half;
  const zoneHigh = centerPrice + half;
  return { centerPrice, zoneLow, zoneHigh, ...zoneMetrics(centerPrice, zoneLow, zoneHigh) };
}

export type ZoneCenterMethod = 'WEIGHTED_AVG' | 'MEDIAN' | 'STRONGEST';

export function mergeZoneCenter(
  method: ZoneCenterMethod,
  currentCenter: number,
  currentWeight: number,
  newPivot: number,
  newWeight = 1,
): number {
  if (method === 'STRONGEST') return newWeight >= currentWeight ? newPivot : currentCenter;
  if (method === 'MEDIAN') return (currentCenter + newPivot) / 2;
  const w = Math.max(1, currentWeight);
  return (currentCenter * w + newPivot * newWeight) / (w + newWeight);
}

export function expandZoneBounds(
  zone: ZoneGeometry,
  pivot: number,
  half: number,
): ZoneGeometry {
  return {
    centerPrice: zone.centerPrice,
    zoneLow: Math.min(zone.zoneLow, pivot - half),
    zoneHigh: Math.max(zone.zoneHigh, pivot + half),
  };
}

export function appendZoneVersion(
  versions: HistoricalZoneVersion[] | undefined,
  next: Omit<HistoricalZoneVersion, 'version'>,
): HistoricalZoneVersion[] {
  const prev = versions ?? [];
  const last = prev[prev.length - 1];
  if (
    last &&
    last.timestamp === next.timestamp &&
    last.zoneLow === next.zoneLow &&
    last.zoneHigh === next.zoneHigh &&
    last.centerPrice === next.centerPrice
  ) {
    return prev;
  }
  if (
    last &&
    last.zoneLow === next.zoneLow &&
    last.zoneHigh === next.zoneHigh &&
    Math.abs(last.centerPrice - next.centerPrice) < 1e-12
  ) {
    return prev;
  }
  return [
    ...prev,
    {
      version: (last?.version ?? 0) + 1,
      ...next,
    },
  ];
}

/** Geometry known at T — last revision with timestamp ≤ T. */
export function zoneGeometryAsOf(
  versions: HistoricalZoneVersion[] | undefined,
  fallback: ZoneGeometry,
  timestamp: number,
): ZoneGeometry {
  const known = (versions ?? []).filter((v) => v.timestamp <= timestamp);
  const last = known[known.length - 1];
  if (!last) return fallback;
  return {
    centerPrice: last.centerPrice,
    zoneLow: last.zoneLow,
    zoneHigh: last.zoneHigh,
  };
}

function bps(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(a - b) / a) * 10_000;
}

/**
 * Location of a price relative to a zone (primary location — one state).
 * Uses zone boundaries, not center tick.
 */
export function classifyZoneLocation(input: {
  type: HistoricalLevelType;
  price: number;
  zoneLow: number;
  zoneHigh: number;
  nearBps: number;
  /** Previous close — used to detect ENTERING. */
  priorPrice?: number | null;
}): HistoricalZoneLocationState {
  const { type, price, zoneLow, zoneHigh, nearBps } = input;
  const inside = price >= zoneLow && price <= zoneHigh;
  const prior = input.priorPrice;

  if (type === 'SUPPORT') {
    if (inside) {
      if (prior != null && prior > zoneHigh) return 'ENTERING_SUPPORT';
      return 'INSIDE_SUPPORT';
    }
    if (price < zoneLow) return 'BELOW_SUPPORT';
    const dist = bps(price, zoneHigh);
    if (dist <= nearBps) {
      if (prior != null && prior > price && price > zoneHigh) return 'ENTERING_SUPPORT';
      return 'NEAR_SUPPORT';
    }
    return 'ABOVE_SUPPORT';
  }

  // Resistance
  if (inside) {
    if (prior != null && prior < zoneLow) return 'ENTERING_RESISTANCE';
    return 'INSIDE_RESISTANCE';
  }
  if (price > zoneHigh) return 'ABOVE_RESISTANCE';
  const dist = bps(price, zoneLow);
  if (dist <= nearBps) {
    if (prior != null && prior < price && price < zoneLow) return 'ENTERING_RESISTANCE';
    return 'NEAR_RESISTANCE';
  }
  return 'BELOW_RESISTANCE';
}

export function zoneLocationLabel(state: HistoricalZoneLocationState): string {
  return state.replace(/_/g, ' ');
}

/**
 * Interaction classification for one completed bar vs a zone.
 */
export function classifyZoneInteraction(input: {
  type: HistoricalLevelType;
  zoneLow: number;
  zoneHigh: number;
  centerPrice: number;
  bar: HistoricalBarLike;
  atr: number;
  breakBeyondAtrFraction: number;
  approachBps: number;
  /** Prior bar beyond-zone close count (provisional break). */
  beyondCloses: number;
  breakConfirmCloses: number;
  levelBroken?: boolean;
}): HistoricalZoneInteractionState {
  const { type, zoneLow, zoneHigh, centerPrice, bar, atr } = input;
  if (input.levelBroken) return 'BROKEN';

  const breakDist = atr * input.breakBeyondAtrFraction;
  const bodyLow = Math.min(bar.open, bar.close);
  const bodyHigh = Math.max(bar.open, bar.close);
  const wickIn =
    (bar.low <= zoneHigh && bar.low >= zoneLow) ||
    (bar.high >= zoneLow && bar.high <= zoneHigh) ||
    (bar.low < zoneLow && bar.high > zoneHigh);
  const bodyIn = bodyLow <= zoneHigh && bodyHigh >= zoneLow;
  const closeIn = bar.close >= zoneLow && bar.close <= zoneHigh;
  const near = bps(bar.close, centerPrice) <= input.approachBps * 1.5;

  if (type === 'SUPPORT') {
    const closeThrough = bar.close < zoneLow - breakDist;
    const wickThrough = bar.low < zoneLow - breakDist * 0.25;
    if (closeThrough) {
      if (input.beyondCloses + 1 < input.breakConfirmCloses) return 'BREAKING';
      return 'ACCEPTED_THROUGH';
    }
    if (wickIn || bodyIn || closeIn) {
      if ((wickThrough || wickIn) && bar.close > zoneLow && bar.close >= centerPrice - atr * 0.05) {
        return wickThrough && bar.close > zoneHigh * 0.999 ? 'REJECTED' : 'HELD';
      }
      if (bodyIn && closeIn) return 'BODY_TOUCH';
      if (bodyIn) return 'BODY_TOUCH';
      if (wickIn) return 'WICK_TOUCH';
      return 'ENTERED';
    }
    if (near) return 'APPROACHING';
    return 'NONE';
  }

  const closeThrough = bar.close > zoneHigh + breakDist;
  const wickThrough = bar.high > zoneHigh + breakDist * 0.25;
  if (closeThrough) {
    if (input.beyondCloses + 1 < input.breakConfirmCloses) return 'BREAKING';
    return 'ACCEPTED_THROUGH';
  }
  if (wickIn || bodyIn || closeIn) {
    if ((wickThrough || wickIn) && bar.close < zoneHigh && bar.close <= centerPrice + atr * 0.05) {
      return wickThrough ? 'REJECTED' : 'HELD';
    }
    if (bodyIn) return 'BODY_TOUCH';
    if (wickIn) return 'WICK_TOUCH';
    return 'ENTERED';
  }
  if (near) return 'APPROACHING';
  return 'NONE';
}

/** Map zone interaction → legacy HistoricalInteraction for existing callers. */
export function toLegacyInteraction(
  state: HistoricalZoneInteractionState,
): import('./types.js').HistoricalInteraction {
  switch (state) {
    case 'APPROACHING':
      return 'APPROACH';
    case 'WICK_TOUCH':
      return 'WICK_TOUCH';
    case 'BODY_TOUCH':
    case 'ENTERED':
      return 'BODY_TOUCH';
    case 'REJECTED':
    case 'HELD':
      return 'REJECTION';
    case 'BREAKING':
      return 'CLOSE_THROUGH';
    case 'BROKEN':
    case 'ACCEPTED_THROUGH':
      return 'BREAK';
    case 'RETESTING':
      return 'RETEST';
    case 'TOUCHED':
      return 'TOUCH';
    case 'FLIPPED':
      return 'NONE';
    default:
      return 'NONE';
  }
}

export function isContactInteraction(state: HistoricalZoneInteractionState): boolean {
  return (
    state !== 'NONE' &&
    state !== 'APPROACHING' &&
    state !== 'FLIPPED'
  );
}

export function priceInsideZone(price: number, zoneLow: number, zoneHigh: number): boolean {
  return price >= zoneLow && price <= zoneHigh;
}

export function barTouchesZone(bar: HistoricalBarLike, zoneLow: number, zoneHigh: number): boolean {
  return bar.low <= zoneHigh && bar.high >= zoneLow;
}

/**
 * Interaction session: multiple candles inside/near one visit = one test.
 * A new session starts after price leaves the zone by `leaveBps` and returns.
 */
export function updateInteractionSession(input: {
  activeSessionId: string | null;
  sessionStartedAt: number | null;
  lastInsideAt: number | null;
  bar: HistoricalBarLike;
  zoneLow: number;
  zoneHigh: number;
  leaveBps: number;
  touching: boolean;
}): {
  activeSessionId: string | null;
  sessionStartedAt: number | null;
  lastInsideAt: number | null;
  /** True when this bar opens a brand-new independent test. */
  newSession: boolean;
} {
  const mid = (input.zoneLow + input.zoneHigh) / 2;
  const leaveDist = mid * (input.leaveBps / 10_000);
  const farAway =
    input.bar.high < input.zoneLow - leaveDist || input.bar.low > input.zoneHigh + leaveDist;

  if (farAway) {
    return {
      activeSessionId: null,
      sessionStartedAt: null,
      lastInsideAt: input.lastInsideAt,
      newSession: false,
    };
  }

  if (input.touching) {
    if (input.activeSessionId == null) {
      const id = `sess:${input.bar.time}`;
      return {
        activeSessionId: id,
        sessionStartedAt: input.bar.time,
        lastInsideAt: input.bar.time,
        newSession: true,
      };
    }
    return {
      activeSessionId: input.activeSessionId,
      sessionStartedAt: input.sessionStartedAt,
      lastInsideAt: input.bar.time,
      newSession: false,
    };
  }

  return {
    activeSessionId: input.activeSessionId,
    sessionStartedAt: input.sessionStartedAt,
    lastInsideAt: input.lastInsideAt,
    newSession: false,
  };
}

export function classifyZonePressure(input: {
  type: HistoricalLevelType;
  sessionTouchBars: number;
  avgPullbackAtr: number;
  held: boolean;
}): HistoricalZonePressureState {
  if (!input.held) return 'NONE';
  if (input.sessionTouchBars >= 3 && input.avgPullbackAtr < 0.45) {
    return input.type === 'RESISTANCE' ? 'RESISTANCE_UNDER_PRESSURE' : 'SUPPORT_UNDER_PRESSURE';
  }
  return 'NONE';
}

export function pickPrimaryZone<T extends {
  type: HistoricalLevelType;
  centerPrice: number;
  strengthScore: number;
  knownAt: number;
  sourceTimeframe: string;
}>(
  zones: T[],
  price: number,
): T | null {
  if (!zones.length) return null;
  return [...zones].sort((a, b) => {
    const da = Math.abs(a.centerPrice - price);
    const db = Math.abs(b.centerPrice - price);
    if (da !== db) return da - db;
    if (b.strengthScore !== a.strengthScore) return b.strengthScore - a.strengthScore;
    return b.knownAt - a.knownAt;
  })[0] ?? null;
}

export function multiTfZoneConfluenceLabel(
  type: HistoricalLevelType,
  timeframes: string[],
): string | null {
  const unique = [...new Set(timeframes)];
  if (unique.length < 2) return null;
  return type === 'SUPPORT'
    ? 'MULTI_TIMEFRAME_SUPPORT_CONFLUENCE'
    : 'MULTI_TIMEFRAME_RESISTANCE_CONFLUENCE';
}

/** Compact trader badge for nearest zone. */
export function zoneInteractionBadge(
  location: HistoricalZoneLocationState,
  interaction: HistoricalZoneInteractionState,
): string {
  if (interaction === 'REJECTED') {
    return location.includes('SUPPORT') ? 'SUPPORT REJECTED' : 'RESISTANCE REJECTED';
  }
  if (interaction === 'BREAKING' || interaction === 'ACCEPTED_THROUGH') {
    return location.includes('SUPPORT') ? 'SUPPORT BREAKING' : 'RESISTANCE BREAKING';
  }
  if (interaction === 'HELD') {
    return location.includes('SUPPORT') ? 'SUPPORT HELD' : 'RESISTANCE HELD';
  }
  if (location === 'INSIDE_SUPPORT' || location === 'ENTERING_SUPPORT') return 'INSIDE SUPPORT';
  if (location === 'INSIDE_RESISTANCE' || location === 'ENTERING_RESISTANCE') return 'INSIDE RESISTANCE';
  if (location === 'NEAR_SUPPORT') return 'NEAR SUPPORT';
  if (location === 'NEAR_RESISTANCE') return 'NEAR RESISTANCE';
  return zoneLocationLabel(location);
}
