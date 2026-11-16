/**
 * Shape context for an entry. Closed bars only. The current bar can break
 * the shape. It is not used to draw the shape it is measured against.
 *
 * A box is a sideways range: the candles before this one overlap between a
 * flat ceiling and a flat floor, and no single candle made that range.
 * An M is two similar swing highs with a real dip between them, then a close
 * under that dip. A W is the mirror. A one-bar wick is not a swing.
 */

export interface ShapeBar {
  high: number;
  low: number;
  close: number;
}

export type ShapeKind = 'BOX' | 'M' | 'W';

export interface ShapeRead {
  kind: ShapeKind | null;
  note: string;
  buyOk: boolean;
  sellOk: boolean;
  /** First closed candle of this shape. The chart labels that candle once. */
  fresh: boolean;
}

const BOX_BARS = 8;
const PIVOT_SPAN = 2;
const PIVOT_LOOK = 20;
const MIN_PIVOT_GAP = 5;
const MAX_PIVOT_GAP = 14;
const BREAK_WINDOW = 8;
const SHAPE_HOLD_BARS = 3;

const OPEN: ShapeRead = { kind: null, note: '', buyOk: true, sellOk: true, fresh: false };

export function shapeAt(bars: ShapeBar[], index: number): ShapeRead {
  if (!bars || index < 0 || index >= bars.length) return OPEN;
  const reversal = reversalAt(bars, index);
  if (reversal) return reversal;
  const box = boxAt(bars, index);
  if (box) return box;
  return OPEN;
}

export interface ShapeMark {
  kind: ShapeKind;
  text: string;
  short: string;
  color: string;
  tip: string;
}

/** One label on the candle where a box, an M, or a W first shows. The open candle is skipped. */
export function shapeMarks(bars: ShapeBar[], liveTime: number | null): Map<number, ShapeMark> {
  const marks = new Map<number, ShapeMark>();
  if (!bars || bars.length < BOX_BARS) return marks;
  const lastIsLive = liveTime != null && (bars[bars.length - 1] as { time?: number }).time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  for (let index = BOX_BARS; index < last; index++) {
    const shape = shapeAt(bars, index);
    if (!shape.fresh || !shape.kind) continue;
    const time = (bars[index] as { time?: number }).time;
    if (time == null) continue;
    marks.set(time, shapeMark(shape.kind, shape.note));
  }
  return marks;
}

function shapeMark(kind: ShapeKind, note: string): ShapeMark {
  if (kind === 'BOX') {
    return { kind, text: 'BOX', short: 'BOX', color: '#94a3b8', tip: note };
  }
  if (kind === 'M') {
    return { kind, text: 'M', short: 'M', color: '#fca5a5', tip: note };
  }
  return { kind, text: 'W', short: 'W', color: '#86efac', tip: note };
}

function boxAt(bars: ShapeBar[], index: number): ShapeRead | null {
  const box = boxWindow(bars, index);
  if (!box) return null;
  const place = placeInBox(bars[index]!.close, box);
  if (place === 'OUT') return null;
  const prev = index > 0 ? boxWindow(bars, index - 1) : null;
  const prevInside = prev != null && placeInBox(bars[index - 1]!.close, prev) !== 'OUT';
  const note = place === 'HIGH'
    ? 'Range box. Price has been sideways, and the close is at the top.'
    : place === 'LOW'
      ? 'Range box. Price has been sideways, and the close is at the bottom.'
      : 'Range box. Price has been sideways, and the close is in the middle.';
  return {
    kind: 'BOX',
    note,
    buyOk: place === 'LOW',
    sellOk: place === 'HIGH',
    fresh: !prevInside,
  };
}

function boxWindow(bars: ShapeBar[], index: number): { high: number; low: number } | null {
  if (index < BOX_BARS) return null;
  const window = bars.slice(index - BOX_BARS, index);
  const highs = window.map((bar) => bar.high);
  const lows = window.map((bar) => bar.low);
  const high = nth(highs, 1, true);
  const low = nth(lows, 1, false);
  const height = high - low;
  const scale = medianRange(bars, index);
  if (!(scale > 0) || height < scale * 1.4 || height > scale * 3) return null;
  const first = window[0]!.close;
  const last = window[window.length - 1]!.close;
  if (Math.abs(last - first) > height * 0.28) return null;
  let widest = 0;
  for (const bar of window) widest = Math.max(widest, bar.high - bar.low);
  if (widest > height * 0.5) return null;
  const top = high - height * 0.18;
  const bottom = low + height * 0.18;
  const ceiling: number[] = [];
  const floor: number[] = [];
  let inside = 0;
  for (let i = 0; i < window.length; i++) {
    const bar = window[i]!;
    if (bar.high >= top) ceiling.push(i);
    if (bar.low <= bottom) floor.push(i);
    if (bar.close <= high && bar.close >= low) inside += 1;
  }
  if (ceiling.length < 2 || floor.length < 2) return null;
  if (ceiling[ceiling.length - 1]! - ceiling[0]! < 2) return null;
  if (floor[floor.length - 1]! - floor[0]! < 2) return null;
  if (inside < 6) return null;
  if (!alternates(ceiling, floor)) return null;
  return { high, low };
}

function alternates(ceiling: number[], floor: number[]): boolean {
  const points = [
    ...ceiling.map((index) => ({ index, side: 'H' as const })),
    ...floor.map((index) => ({ index, side: 'L' as const })),
  ].sort((a, b) => a.index - b.index || (a.side < b.side ? -1 : 1));
  let seq = '';
  for (const point of points) {
    if (!seq.endsWith(point.side)) seq += point.side;
  }
  return seq.includes('LHL') || seq.includes('HLH');
}

function placeInBox(close: number, box: { high: number; low: number }): 'HIGH' | 'MID' | 'LOW' | 'OUT' {
  const height = box.high - box.low;
  if (!(height > 0) || !(close > 0)) return 'OUT';
  if (close > box.high || close < box.low) return 'OUT';
  const t = (close - box.low) / height;
  if (t >= 0.7) return 'HIGH';
  if (t <= 0.3) return 'LOW';
  return 'MID';
}

interface Pivot {
  index: number;
  price: number;
}

function reversalAt(bars: ShapeBar[], index: number): ShapeRead | null {
  const m = patternBreak(bars, index, 'M');
  if (m) return m;
  return patternBreak(bars, index, 'W');
}

function patternBreak(bars: ShapeBar[], index: number, kind: 'M' | 'W'): ShapeRead | null {
  const scale = medianRange(bars, index);
  if (!(scale > 0) || index < PIVOT_SPAN * 2) return null;
  const from = Math.max(PIVOT_SPAN, index - PIVOT_LOOK);
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  for (let i = from; i <= index - PIVOT_SPAN; i++) {
    if (isSwing(bars, i, 'high')) highs.push({ index: i, price: bars[i]!.high });
    if (isSwing(bars, i, 'low')) lows.push({ index: i, price: bars[i]!.low });
  }
  const close = bars[index]!.close;
  if (kind === 'M') {
    const pair = lastPair(highs);
    if (!pair) return null;
    const [left, right] = pair;
    const between = lows.filter((pivot) => pivot.index > left.index && pivot.index < right.index);
    if (!between.length) return null;
    const neck = Math.min(...between.map((pivot) => pivot.price));
    const depth = Math.min(left.price, right.price) - neck;
    if (!sameLevel(left.price, right.price, depth, scale)) return null;
    if (!dominant(bars, left.index, right.index, 'high', left.price, right.price, scale)) return null;
    const brokeAt = breakStart(bars, right.index + 1, index, neck, 'under');
    if (brokeAt < 0) return null;
    return {
      kind: 'M',
      note: 'M pattern. Two similar highs, then the close left the dip between them.',
      buyOk: false,
      sellOk: true,
      fresh: !(bars[index - 1]!.close < neck),
    };
  }
  const pair = lastPair(lows);
  if (!pair) return null;
  const [left, right] = pair;
  const between = highs.filter((pivot) => pivot.index > left.index && pivot.index < right.index);
  if (!between.length) return null;
  const neck = Math.max(...between.map((pivot) => pivot.price));
  const depth = neck - Math.max(left.price, right.price);
  if (!sameLevel(left.price, right.price, depth, scale)) return null;
  if (!dominant(bars, left.index, right.index, 'low', left.price, right.price, scale)) return null;
  const brokeAt = breakStart(bars, right.index + 1, index, neck, 'over');
  if (brokeAt < 0) return null;
  return {
    kind: 'W',
    note: 'W pattern. Two similar lows, then the close left the peak between them.',
    buyOk: true,
    sellOk: false,
    fresh: !(bars[index - 1]!.close > neck),
  };
}

function isSwing(bars: ShapeBar[], index: number, side: 'high' | 'low'): boolean {
  const price = side === 'high' ? bars[index]!.high : bars[index]!.low;
  for (let step = 1; step <= PIVOT_SPAN; step++) {
    const left = bars[index - step];
    const right = bars[index + step];
    if (!left || !right) return false;
    if (side === 'high') {
      if (!(price > left.high && price > right.high)) return false;
    } else if (!(price < left.low && price < right.low)) return false;
  }
  return true;
}

function lastPair(pivots: Pivot[]): [Pivot, Pivot] | null {
  if (pivots.length < 2) return null;
  const right = pivots[pivots.length - 1]!;
  const left = pivots[pivots.length - 2]!;
  const gap = right.index - left.index;
  if (gap < MIN_PIVOT_GAP || gap > MAX_PIVOT_GAP) return null;
  return [left, right];
}

function sameLevel(left: number, right: number, depth: number, scale: number): boolean {
  if (!(depth >= scale * 1.3) || !(depth > 0)) return false;
  const skew = Math.abs(left - right);
  return skew <= depth * 0.3 && skew <= scale * 0.75;
}

/** Both turns are the real extreme of that span, not two minor wicks under a larger high. */
function dominant(
  bars: ShapeBar[],
  from: number,
  to: number,
  side: 'high' | 'low',
  left: number,
  right: number,
  scale: number,
): boolean {
  let extreme = side === 'high' ? -Infinity : Infinity;
  for (let i = from; i <= to; i++) {
    const price = side === 'high' ? bars[i]!.high : bars[i]!.low;
    extreme = side === 'high' ? Math.max(extreme, price) : Math.min(extreme, price);
  }
  const room = scale * 0.35;
  if (side === 'high') return extreme - Math.max(left, right) <= room;
  return Math.min(left, right) - extreme <= room;
}

/** First bar of the current break. A close back through the neckline ends it. */
function breakStart(
  bars: ShapeBar[],
  from: number,
  index: number,
  neck: number,
  side: 'under' | 'over',
): number {
  let brokeAt = -1;
  for (let i = from; i <= index; i++) {
    const beyond = side === 'under' ? bars[i]!.close < neck : bars[i]!.close > neck;
    if (!beyond) brokeAt = -1;
    else if (brokeAt < 0) brokeAt = i;
  }
  if (brokeAt < 0 || brokeAt - from > BREAK_WINDOW || index - brokeAt >= SHAPE_HOLD_BARS) return -1;
  return brokeAt;
}

function medianRange(bars: ShapeBar[], index: number): number {
  const spans: number[] = [];
  for (let i = Math.max(0, index - 8); i < index; i++) {
    const span = bars[i]!.high - bars[i]!.low;
    if (span > 0) spans.push(span);
  }
  if (!spans.length) return 0;
  spans.sort((a, b) => a - b);
  return spans[Math.floor((spans.length - 1) / 2)]!;
}

function nth(values: number[], n: number, high: boolean): number {
  const sorted = [...values].sort((a, b) => high ? b - a : a - b);
  return sorted[Math.min(n, sorted.length - 1)]!;
}
