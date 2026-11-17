/**
 * Book context: what the resting order book did during each candle, per side.
 *
 * Every change in resting size at a price is one of three flows:
 *   added      new orders (a refill is an add at a level that was just eaten)
 *   cancelled  orders pulled without trading
 *   consumed   orders filled by aggressive trades
 *
 * The recorder samples the live book level marks (top levels each side, quote USD,
 * with the last event per level), turns successive samples into those flows for the
 * levels near price, and keeps them in 1-minute buckets. Candles of any timeframe are
 * sums of their minutes. Nothing is persisted: only minutes seen since the page opened
 * have book context, and every other candle keeps the engine's candle-only rules.
 *
 * Thresholds below are starting points, not fitted values. Book history cannot be
 * downloaded, so they have not been backtested.
 */

export type BookSideState = 'DEFENDING' | 'GIVING_WAY' | 'PULLING' | 'STACKING' | 'MIXED' | 'QUIET';

export interface BookSideFlows {
  /** Resting USD near price at the first sample of the period. */
  depthStart: number;
  /** Resting USD near price at the last sample of the period. */
  depthEnd: number;
  consumed: number;
  cancelled: number;
  added: number;
  /** Part of `added` that came back at a level eaten within REFILL_WINDOW_MS. */
  refilled: number;
}

export interface BookCandle {
  bids: BookSideFlows;
  asks: BookSideFlows;
  /** Book samples that produced flows. Few samples means the candle was barely watched. */
  samples: number;
}

export interface BookContext {
  bids: BookSideState;
  asks: BookSideState;
  samples: number;
  flows: BookCandle;
}

/** One price level from the live liquidity-response snapshot (`levels`). */
export interface BookLevelMark {
  price: number;
  restingBid: number;
  restingAsk: number;
  event: string;
}

/** Only levels within this fraction of mid count. Far levels are mostly re-quoting noise. */
export const BOOK_BAND = 0.005;
/** Size added back at a level eaten within this window is a refill. */
export const REFILL_WINDOW_MS = 30_000;
/** A candle needs at least this many samples before its book is read. */
export const BOOK_MIN_SAMPLES = 10;
/** Eaten at least this share of starting depth: the side was really hit. */
export const BOOK_HIT = 0.15;
/** Refilled at least this share of what was eaten: someone is holding the price. */
export const BOOK_DEFEND_REFILL = 0.6;
/** Refilled under this share of what was eaten: the side is being broken through. */
export const BOOK_GIVE_REFILL = 0.3;
/** Net pulled or net stacked, as a share of starting depth, to count. */
export const BOOK_NET_MOVE = 0.25;

const MINUTE_MS = 60_000;

function emptySide(): BookSideFlows {
  return { depthStart: 0, depthEnd: 0, consumed: 0, cancelled: 0, added: 0, refilled: 0 };
}

function emptyCandle(): BookCandle {
  return { bids: emptySide(), asks: emptySide(), samples: 0 };
}

interface LevelMemory {
  size: number;
  /** Eaten size not yet refilled, and when it was last eaten. */
  eaten: number;
  eatenAt: number;
}

interface SeriesState {
  bids: Map<number, LevelMemory>;
  asks: Map<number, LevelMemory>;
  /** Minute open time in seconds → flows. */
  minutes: Map<number, BookCandle>;
}

function isConsume(event: string, side: 'bid' | 'ask'): boolean {
  return side === 'bid'
    ? event === 'CONSUME_BID' || event === 'ABSORPTION_BID'
    : event === 'CONSUME_ASK' || event === 'ABSORPTION_ASK';
}

export class BookFlowRecorder {
  private readonly series = new Map<string, SeriesState>();

  constructor(private readonly maxMinutes = 1440) {}

  /**
   * Feed one book sample. `key` separates symbol and market, e.g. "perp:NEARUSDT".
   * Levels seen for the first time, or that left the near band, produce no flow:
   * their change cannot be told apart from the band moving with price.
   */
  update(key: string, nowMs: number, marks: readonly BookLevelMark[]): void {
    if (!marks?.length) return;
    let bestBid = 0;
    let bestAsk = Infinity;
    for (const m of marks) {
      if (m.restingBid > 0 && m.price > bestBid) bestBid = m.price;
      if (m.restingAsk > 0 && m.price < bestAsk) bestAsk = m.price;
    }
    if (!(bestBid > 0) || !Number.isFinite(bestAsk) || bestAsk < bestBid) return;
    const mid = (bestBid + bestAsk) / 2;
    const lo = mid * (1 - BOOK_BAND);
    const hi = mid * (1 + BOOK_BAND);

    let state = this.series.get(key);
    if (!state) {
      state = { bids: new Map(), asks: new Map(), minutes: new Map() };
      this.series.set(key, state);
    }
    const minute = Math.floor(nowMs / MINUTE_MS) * 60;
    let bucket = state.minutes.get(minute);
    const fresh = !bucket;
    if (!bucket) {
      bucket = emptyCandle();
      state.minutes.set(minute, bucket);
      this.trim(state);
    }

    let depthBid = 0;
    let depthAsk = 0;
    const seenBid = new Set<number>();
    const seenAsk = new Set<number>();
    for (const m of marks) {
      if (m.price < lo || m.price > hi) continue;
      if (m.restingBid > 0 || state.bids.has(m.price)) {
        seenBid.add(m.price);
        depthBid += Math.max(0, m.restingBid);
        this.flow(state.bids, m.price, Math.max(0, m.restingBid), m.event, 'bid', nowMs, bucket.bids);
      }
      if (m.restingAsk > 0 || state.asks.has(m.price)) {
        seenAsk.add(m.price);
        depthAsk += Math.max(0, m.restingAsk);
        this.flow(state.asks, m.price, Math.max(0, m.restingAsk), m.event, 'ask', nowMs, bucket.asks);
      }
    }
    // Levels that left the band are forgotten, not counted as pulled.
    for (const price of [...state.bids.keys()]) if (!seenBid.has(price)) state.bids.delete(price);
    for (const price of [...state.asks.keys()]) if (!seenAsk.has(price)) state.asks.delete(price);

    if (fresh) {
      bucket.bids.depthStart = depthBid;
      bucket.asks.depthStart = depthAsk;
    }
    bucket.bids.depthEnd = depthBid;
    bucket.asks.depthEnd = depthAsk;
    bucket.samples += 1;
  }

  private flow(
    levels: Map<number, LevelMemory>,
    price: number,
    size: number,
    event: string,
    side: 'bid' | 'ask',
    nowMs: number,
    out: BookSideFlows,
  ): void {
    const prev = levels.get(price);
    if (!prev) {
      if (size > 0) levels.set(price, { size, eaten: 0, eatenAt: 0 });
      return;
    }
    const d = size - prev.size;
    if (d > 0) {
      out.added += d;
      if (prev.eaten > 0 && nowMs - prev.eatenAt <= REFILL_WINDOW_MS) {
        const refill = Math.min(d, prev.eaten);
        out.refilled += refill;
        prev.eaten -= refill;
      }
    } else if (d < 0) {
      if (isConsume(event, side)) {
        out.consumed += -d;
        prev.eaten = (nowMs - prev.eatenAt <= REFILL_WINDOW_MS ? prev.eaten : 0) + -d;
        prev.eatenAt = nowMs;
      } else {
        out.cancelled += -d;
      }
    }
    prev.size = size;
    if (size <= 0 && prev.eaten <= 0) levels.delete(price);
  }

  private trim(state: SeriesState): void {
    if (state.minutes.size <= this.maxMinutes) return;
    const ordered = [...state.minutes.keys()].sort((a, b) => a - b);
    for (const t of ordered.slice(0, state.minutes.size - this.maxMinutes)) state.minutes.delete(t);
  }

  /** Flows rolled up to candles of `tfMinutes`, keyed by candle open time in seconds. */
  candles(key: string, tfMinutes: number): Map<number, BookCandle> {
    const out = new Map<number, BookCandle>();
    const state = this.series.get(key);
    if (!state) return out;
    const span = Math.max(1, Math.round(tfMinutes)) * 60;
    const minutes = [...state.minutes.keys()].sort((a, b) => a - b);
    for (const t of minutes) {
      const m = state.minutes.get(t)!;
      const bar = t - (t % span);
      let c = out.get(bar);
      if (!c) {
        c = emptyCandle();
        c.bids.depthStart = m.bids.depthStart;
        c.asks.depthStart = m.asks.depthStart;
        out.set(bar, c);
      }
      addSide(c.bids, m.bids);
      addSide(c.asks, m.asks);
      c.samples += m.samples;
    }
    return out;
  }

  /** Book context per candle, only for candles watched long enough to read. */
  contexts(key: string, tfMinutes: number): Map<number, BookContext> {
    const out = new Map<number, BookContext>();
    for (const [time, c] of this.candles(key, tfMinutes)) {
      const ctx = bookContext(c);
      if (ctx) out.set(time, ctx);
    }
    return out;
  }
}

function addSide(into: BookSideFlows, from: BookSideFlows): void {
  into.depthEnd = from.depthEnd;
  into.consumed += from.consumed;
  into.cancelled += from.cancelled;
  into.added += from.added;
  into.refilled += from.refilled;
}

/**
 * One side's behaviour over the candle.
 * DEFENDING   eaten, and most of it came back.
 * GIVING_WAY  eaten, and little came back.
 * PULLING     more left without trading than new orders arrived (re-quoting nets out).
 * STACKING    new orders built up net, and little was eaten.
 * MIXED       real activity that fits none of those.
 * QUIET       not much happened.
 */
export function classifyBookSide(f: BookSideFlows): BookSideState {
  const base = Math.max(f.depthStart, f.depthEnd);
  if (!(base > 0)) return 'QUIET';
  const hit = f.consumed / base;
  const refillShare = f.consumed > 0 ? f.refilled / f.consumed : 0;
  const fresh = f.added - f.refilled;
  const netPull = (f.cancelled - fresh) / base;
  if (hit >= BOOK_HIT && refillShare >= BOOK_DEFEND_REFILL) return 'DEFENDING';
  if (hit >= BOOK_HIT && refillShare < BOOK_GIVE_REFILL) return 'GIVING_WAY';
  if (netPull >= BOOK_NET_MOVE) return 'PULLING';
  if (-netPull >= BOOK_NET_MOVE && hit < BOOK_HIT) return 'STACKING';
  if (hit >= BOOK_HIT || Math.abs(netPull) >= BOOK_NET_MOVE / 2) return 'MIXED';
  return 'QUIET';
}

/** Null when the candle was not watched long enough. */
export function bookContext(c: BookCandle | null | undefined): BookContext | null {
  if (!c || c.samples < BOOK_MIN_SAMPLES) return null;
  return { bids: classifyBookSide(c.bids), asks: classifyBookSide(c.asks), samples: c.samples, flows: c };
}

const SHORT: Record<BookSideState, string> = {
  DEFENDING: 'DEF',
  GIVING_WAY: 'GIVE',
  PULLING: 'PULL',
  STACKING: 'STACK',
  MIXED: 'MIX',
  QUIET: 'QUIET',
};

export function bookContextLabel(ctx: BookContext): string {
  return `B ${SHORT[ctx.bids]} · A ${SHORT[ctx.asks]}`;
}

function usd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(a / 1e3)}K`;
  return `${Math.round(a)}`;
}

export function bookContextTip(ctx: BookContext): string {
  const line = (name: string, s: BookSideState, f: BookSideFlows) =>
    `${name} ${s.toLowerCase().replace('_', ' ')}: eaten ${usd(f.consumed)} · refilled ${usd(f.refilled)} · pulled ${usd(f.cancelled)} · added ${usd(f.added - f.refilled)} · depth ${usd(f.depthStart)}→${usd(f.depthEnd)}`;
  return [
    'Book (live, near price)',
    line('Bids', ctx.bids, ctx.flows.bids),
    line('Asks', ctx.asks, ctx.flows.asks),
    `${ctx.samples} samples`,
  ].join('\n');
}

/**
 * Whether the book lets an entry stand. With no book context the entry stands.
 * A buy that fades sellers needs bids that are not pulling or giving way; a sell is the mirror.
 * A join (state 2) stays quiet when the book on the other side is defending.
 */
export function bookAllows(ctx: BookContext | null | undefined, side: 'buy' | 'sell', state: number): boolean {
  if (!ctx) return true;
  const own = side === 'buy' ? ctx.bids : ctx.asks;
  const other = side === 'buy' ? ctx.asks : ctx.bids;
  if (state === 2) return other !== 'DEFENDING';
  return own !== 'PULLING' && own !== 'GIVING_WAY';
}
