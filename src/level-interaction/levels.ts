/**
 * Meaningful levels only. Reuses the causal 5-bar swing confirmation
 * from CausalStructure (pivot at i known at i+2). A swing high is not
 * automatically strong resistance — strength is scored separately.
 */

import type { LevelInteractionConfig } from './config.js';
import type { InteractionBar, InteractionLevel, InteractionLevelType } from './types.js';
import { priorAtr } from './evidence.js';

const PERIOD_15M = 15 * 60;

export interface ConfirmedSwing {
  index: number;
  time: number;
  price: number;
  knownAt: number;
  kind: 'HIGH' | 'LOW';
}

/**
 * Same confirmation rule as `CausalStructure`: a pivot at bar i is known
 * only after bars i+1 and i+2 have closed.
 */
export function confirmedSwings(bars: InteractionBar[], upto: number): ConfirmedSwing[] {
  const out: ConfirmedSwing[] = [];
  const lastConfirmable = Math.min(upto - 2, bars.length - 3);
  for (let i = 2; i <= lastConfirmable; i++) {
    const a = bars[i - 2];
    const b = bars[i - 1];
    const c = bars[i];
    const d = bars[i + 1];
    const e = bars[i + 2];
    if (!a || !b || !c || !d || !e) continue;
    const knownAt = e.time;
    if (c.high >= a.high && c.high >= b.high && c.high >= d.high && c.high >= e.high) {
      out.push({ index: i, time: c.time, price: c.high, knownAt, kind: 'HIGH' });
    }
    if (c.low <= a.low && c.low <= b.low && c.low <= d.low && c.low <= e.low) {
      out.push({ index: i, time: c.time, price: c.low, knownAt, kind: 'LOW' });
    }
  }
  return out;
}

function clusterSwings(
  swings: ConfirmedSwing[],
  kind: 'HIGH' | 'LOW',
  atr: number | null,
  cfg: LevelInteractionConfig,
  timeframe: string,
  atTime: number,
): InteractionLevel[] {
  const pad = atr != null && atr > 0 ? atr * cfg.zonePadAtr : 0;
  const merge = atr != null && atr > 0 ? atr * cfg.zoneMergeAtr : 0;
  const items = swings.filter((s) => s.kind === kind && s.knownAt <= atTime);
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.price - b.price);
  const groups: ConfirmedSwing[][] = [];
  let cur: ConfirmedSwing[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    const prev = cur[cur.length - 1]!;
    if (merge > 0 && s.price - prev.price <= merge) cur.push(s);
    else {
      groups.push(cur);
      cur = [s];
    }
  }
  groups.push(cur);

  const type: InteractionLevelType = kind === 'HIGH' ? 'HISTORICAL_RESISTANCE' : 'HISTORICAL_SUPPORT';
  return groups.map((g) => {
    const prices = g.map((x) => x.price);
    const lo = Math.min(...prices) - pad;
    const hi = Math.max(...prices) + pad;
    const latest = g.reduce((a, b) => (a.knownAt >= b.knownAt ? a : b));
    const tests = g.length;
    return {
      id: `${type}:${latest.time}:${latest.price}`,
      type,
      price: kind === 'HIGH' ? Math.max(...prices) : Math.min(...prices),
      zoneLow: lo,
      zoneHigh: hi,
      timeframe,
      createdAt: Math.min(...g.map((x) => x.time)),
      knownAt: latest.knownAt,
      strength: Math.min(90, 45 + tests * 12),
      confidence: Math.min(88, 50 + tests * 10),
    };
  });
}

export function timeframeMinutes(tf: string): number {
  const m = /^(\d+)/.exec(tf);
  if (!m) return 15;
  return Number(m[1]);
}

export function previous15mLevel(
  bars: InteractionBar[],
  index: number,
  timeframe: string,
): InteractionLevel[] {
  // On 15m+ charts the previous 15m high/low is just the last bar — not a
  // meaningful structural level. Keep it for 1m/5m (and similar) only.
  if (timeframeMinutes(timeframe) >= 15) return [];
  const cur = bars[index];
  if (!cur) return [];
  const periodStart = cur.time - (cur.time % PERIOD_15M);
  const prevStart = periodStart - PERIOD_15M;
  let hi = -Infinity;
  let lo = Infinity;
  let lastT = 0;
  for (let i = 0; i < index; i++) {
    const b = bars[i];
    if (!b) continue;
    if (b.time < prevStart || b.time >= periodStart) continue;
    if (b.high > hi) hi = b.high;
    if (b.low < lo) lo = b.low;
    lastT = b.time;
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi <= 0) return [];
  const knownAt = periodStart;
  return [
    {
      id: `PREV_15M_HIGH:${knownAt}:${hi}`,
      type: 'PREV_15M_HIGH',
      price: hi,
      timeframe,
      createdAt: lastT,
      knownAt,
      strength: 48,
      confidence: 52,
    },
    {
      id: `PREV_15M_LOW:${knownAt}:${lo}`,
      type: 'PREV_15M_LOW',
      price: lo,
      timeframe,
      createdAt: lastT,
      knownAt,
      strength: 48,
      confidence: 52,
    },
  ];
}

export function swingLevels(
  swings: ConfirmedSwing[],
  atTime: number,
  timeframe: string,
): InteractionLevel[] {
  const out: InteractionLevel[] = [];
  const highs = swings.filter((s) => s.kind === 'HIGH' && s.knownAt <= atTime);
  const lows = swings.filter((s) => s.kind === 'LOW' && s.knownAt <= atTime);
  const lastH = highs[highs.length - 1];
  const lastL = lows[lows.length - 1];
  if (lastH) {
    out.push({
      id: `SWING_HIGH:${lastH.time}:${lastH.price}`,
      type: 'SWING_HIGH',
      price: lastH.price,
      timeframe,
      createdAt: lastH.time,
      knownAt: lastH.knownAt,
      strength: 50,
      confidence: 50,
    });
  }
  if (lastL) {
    out.push({
      id: `SWING_LOW:${lastL.time}:${lastL.price}`,
      type: 'SWING_LOW',
      price: lastL.price,
      timeframe,
      createdAt: lastL.time,
      knownAt: lastL.knownAt,
      strength: 50,
      confidence: 50,
    });
  }
  return out;
}

export function collectLevelsKnownAt(
  bars: InteractionBar[],
  index: number,
  cfg: LevelInteractionConfig,
  timeframe: string,
  extras: InteractionLevel[] = [],
): InteractionLevel[] {
  const bar = bars[index];
  if (!bar) return extras.filter((l) => l.knownAt <= (bars[index - 1]?.time ?? 0));
  const atTime = bar.time;
  const swings = confirmedSwings(bars, index);
  const atr = priorAtr(bars, index, cfg);
  const hist = [
    ...clusterSwings(swings, 'HIGH', atr, cfg, timeframe, atTime),
    ...clusterSwings(swings, 'LOW', atr, cfg, timeframe, atTime),
  ];
  const recentSwings = swings.slice(-cfg.swingLookback);
  const swingsLv = swingLevels(recentSwings, atTime, timeframe);
  const prev15 = previous15mLevel(bars, index, timeframe);
  const extra = extras.filter((l) => l.knownAt <= atTime);
  const all = [...hist, ...swingsLv, ...prev15, ...extra];
  const dedup = new Map<string, InteractionLevel>();
  for (const lv of all) {
    if (lv.knownAt > atTime) continue;
    const key = `${lv.type}:${lv.price.toFixed(6)}`;
    const prev = dedup.get(key);
    if (!prev || lv.knownAt >= prev.knownAt) dedup.set(key, lv);
  }
  return [...dedup.values()].slice(-cfg.maxTrackedLevels);
}

export function levelsNearPrice(
  levels: InteractionLevel[],
  price: number,
  atr: number | null,
): InteractionLevel[] {
  const band = atr != null && atr > 0 ? atr * 2.5 : price * 0.008;
  return levels.filter((l) => {
    const lo = (l.zoneLow ?? l.price) - band;
    const hi = (l.zoneHigh ?? l.price) + band;
    return price >= lo && price <= hi;
  });
}
