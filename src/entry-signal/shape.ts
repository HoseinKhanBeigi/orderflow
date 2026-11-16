/**
 * Shape context for an entry. Closed bars only. The current bar can break
 * the shape. It is not used to draw the shape it is measured against.
 *
 * A box is a range: the candles before this one stayed between two prices
 * and touched both sides. An M is two nearby highs, then a close under the
 * valley between them. A W is the mirror.
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
const PIVOT_LOOK = 24;
const SHAPE_HOLD_BARS = 4;

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
    ? 'Range box. The close is at the top of the box.'
    : place === 'LOW'
      ? 'Range box. The close is at the bottom of the box.'
      : 'Range box. The close is in the middle of the box.';
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
  let high = -Infinity;
  let low = Infinity;
  for (const bar of window) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }
  const height = high - low;
  const scale = meanRange(bars, index);
  if (!(scale > 0) || height > scale * 3.2 || height < scale * 0.8) return null;
  const top = low + height * 0.75;
  const bottom = low + height * 0.25;
  let highs = 0;
  let lows = 0;
  for (const bar of window) {
    if (bar.high >= top) highs += 1;
    if (bar.low <= bottom) lows += 1;
  }
  if (highs < 2 || lows < 2) return null;
  return { high, low };
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
  const scale = meanRange(bars, index);
  if (!(scale > 0)) return null;
  const from = Math.max(1, index - PIVOT_LOOK);
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  for (let i = from; i <= index - 1; i++) {
    const bar = bars[i]!;
    const prev = bars[i - 1]!;
    const next = bars[i + 1]!;
    if (bar.high > prev.high && bar.high > next.high) highs.push({ index: i, price: bar.high });
    if (bar.low < prev.low && bar.low < next.low) lows.push({ index: i, price: bar.low });
  }
  const close = bars[index]!.close;
  if (kind === 'M') {
    if (highs.length < 2) return null;
    const right = highs[highs.length - 1]!;
    const left = highs[highs.length - 2]!;
    if (index - right.index > SHAPE_HOLD_BARS) return null;
    if (Math.abs(left.price - right.price) > Math.max(scale * 0.45, right.price * 0.003)) return null;
    const between = lows.filter((pivot) => pivot.index > left.index && pivot.index < right.index);
    if (!between.length) return null;
    const neck = Math.min(...between.map((pivot) => pivot.price));
    if (!(close < neck)) return null;
    const prevClose = bars[index - 1]!.close;
    return {
      kind: 'M',
      note: 'M pattern. Two highs, then the close left the valley between them.',
      buyOk: false,
      sellOk: true,
      fresh: !(prevClose < neck),
    };
  }
  if (lows.length < 2) return null;
  const right = lows[lows.length - 1]!;
  const left = lows[lows.length - 2]!;
  if (index - right.index > SHAPE_HOLD_BARS) return null;
  if (Math.abs(left.price - right.price) > Math.max(scale * 0.45, right.price * 0.003)) return null;
  const between = highs.filter((pivot) => pivot.index > left.index && pivot.index < right.index);
  if (!between.length) return null;
  const neck = Math.max(...between.map((pivot) => pivot.price));
  if (!(close > neck)) return null;
  const prevClose = bars[index - 1]!.close;
  return {
    kind: 'W',
    note: 'W pattern. Two lows, then the close left the peak between them.',
    buyOk: true,
    sellOk: false,
    fresh: !(prevClose > neck),
  };
}

function meanRange(bars: ShapeBar[], index: number): number {
  const from = Math.max(0, index - 8);
  let sum = 0;
  let n = 0;
  for (let i = from; i < index; i++) {
    const span = bars[i]!.high - bars[i]!.low;
    if (span > 0) {
      sum += span;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}
