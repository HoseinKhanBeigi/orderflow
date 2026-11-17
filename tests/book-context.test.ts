import { describe, expect, it } from 'vitest';
import {
  BOOK_MIN_SAMPLES,
  BookFlowRecorder,
  bookAllows,
  bookContext,
  classifyBookSide,
  decideEntry,
  type BookContext,
  type BookLevelMark,
  type BookSideFlows,
  type EntryRead,
} from '../src/entry-signal/index.js';

const KEY = 'perp:TEST';
const T0 = Date.UTC(2026, 10, 17, 10, 0, 0);

/** A book around 100: bids 99.9..99.5, asks 100.1..100.5, sizes in USD. */
function book(bids: number[], asks: number[], event: (price: number) => string = () => 'NONE'): BookLevelMark[] {
  const out: BookLevelMark[] = [];
  bids.forEach((size, i) => {
    const price = Number((99.9 - i * 0.1).toFixed(1));
    out.push({ price, restingBid: size, restingAsk: 0, event: event(price) });
  });
  asks.forEach((size, i) => {
    const price = Number((100.1 + i * 0.1).toFixed(1));
    out.push({ price, restingBid: 0, restingAsk: size, event: event(price) });
  });
  return out;
}

const flat = [100_000, 100_000, 100_000, 100_000, 100_000];

function side(over: Partial<BookSideFlows>): BookSideFlows {
  return { depthStart: 500_000, depthEnd: 500_000, consumed: 0, cancelled: 0, added: 0, refilled: 0, ...over };
}

describe('BookFlowRecorder', () => {
  it('a drop with a consume event is eaten, a drop without one is pulled', () => {
    const rec = new BookFlowRecorder();
    rec.update(KEY, T0, book(flat, flat));
    rec.update(KEY, T0 + 1000, book([60_000, ...flat.slice(1)], flat, (p) => (p === 99.9 ? 'CONSUME_BID' : 'NONE')));
    rec.update(KEY, T0 + 2000, book([60_000, 70_000, ...flat.slice(2)], flat, () => 'WITHDRAW_BID'));
    const c = rec.candles(KEY, 1).get(T0 / 1000)!;
    expect(c.bids.consumed).toBe(40_000);
    expect(c.bids.cancelled).toBe(30_000);
    expect(c.asks.consumed + c.asks.cancelled).toBe(0);
  });

  it('size coming back at a level just eaten is a refill', () => {
    const rec = new BookFlowRecorder();
    rec.update(KEY, T0, book(flat, flat));
    rec.update(KEY, T0 + 1000, book([40_000, ...flat.slice(1)], flat, (p) => (p === 99.9 ? 'CONSUME_BID' : 'NONE')));
    rec.update(KEY, T0 + 2000, book(flat, flat, () => 'REPLENISH_BID'));
    const c = rec.candles(KEY, 1).get(T0 / 1000)!;
    expect(c.bids.consumed).toBe(60_000);
    expect(c.bids.refilled).toBe(60_000);
    expect(c.bids.added).toBe(60_000);
  });

  it('levels far from price are ignored', () => {
    const rec = new BookFlowRecorder();
    const far = (size: number): BookLevelMark => ({ price: 90, restingBid: size, restingAsk: 0, event: 'WITHDRAW_BID' });
    rec.update(KEY, T0, [...book(flat, flat), far(1_000_000)]);
    rec.update(KEY, T0 + 1000, [...book(flat, flat), far(0)]);
    expect(rec.candles(KEY, 1).get(T0 / 1000)!.bids.cancelled).toBe(0);
  });

  it('minutes roll up into the chart timeframe', () => {
    const rec = new BookFlowRecorder();
    for (let m = 0; m < 15; m++) {
      rec.update(KEY, T0 + m * 60_000, book(flat, flat));
      rec.update(KEY, T0 + m * 60_000 + 1000, book([90_000, ...flat.slice(1)], flat, () => 'CONSUME_BID'));
      rec.update(KEY, T0 + m * 60_000 + 2000, book(flat, flat, () => 'REPLENISH_BID'));
    }
    const candles = rec.candles(KEY, 15);
    expect(candles.size).toBe(1);
    const c = candles.get(T0 / 1000)!;
    expect(c.bids.consumed).toBe(150_000);
    expect(c.samples).toBe(45);
  });
});

describe('classifyBookSide', () => {
  it('eaten and refilled is DEFENDING', () => {
    expect(classifyBookSide(side({ consumed: 200_000, refilled: 150_000, added: 150_000 }))).toBe('DEFENDING');
  });
  it('eaten and not refilled is GIVING_WAY', () => {
    expect(classifyBookSide(side({ consumed: 200_000, refilled: 20_000, added: 20_000 }))).toBe('GIVING_WAY');
  });
  it('net pulled without trading is PULLING', () => {
    expect(classifyBookSide(side({ cancelled: 300_000, added: 100_000 }))).toBe('PULLING');
  });
  it('re-quoting that cancels and re-adds the same size is not pulling', () => {
    expect(classifyBookSide(side({ cancelled: 2_000_000, added: 2_000_000 }))).toBe('QUIET');
  });
  it('net new orders with little eaten is STACKING', () => {
    expect(classifyBookSide(side({ added: 400_000, cancelled: 100_000 }))).toBe('STACKING');
  });
  it('a candle watched too briefly has no context', () => {
    const flows = { bids: side({}), asks: side({}), samples: BOOK_MIN_SAMPLES - 1 };
    expect(bookContext(flows)).toBeNull();
  });
});

describe('bookAllows', () => {
  const ctx = (bids: BookContext['bids'], asks: BookContext['asks']): BookContext => ({
    bids, asks, samples: 50, flows: { bids: side({}), asks: side({}), samples: 50 },
  });
  it('no book data never blocks', () => {
    expect(bookAllows(null, 'buy', 8)).toBe(true);
  });
  it('a buy fade is blocked while bids pull or give way', () => {
    expect(bookAllows(ctx('PULLING', 'QUIET'), 'buy', 8)).toBe(false);
    expect(bookAllows(ctx('GIVING_WAY', 'QUIET'), 'buy', 4)).toBe(false);
    expect(bookAllows(ctx('DEFENDING', 'QUIET'), 'buy', 4)).toBe(true);
  });
  it('a sell join is blocked into defending bids', () => {
    expect(bookAllows(ctx('DEFENDING', 'QUIET'), 'sell', 2)).toBe(false);
    expect(bookAllows(ctx('PULLING', 'QUIET'), 'sell', 2)).toBe(true);
  });
});

describe('decideEntry with book context', () => {
  // 15 Nov 21:15 shape: downtrend, flat PAIR candle that state 8 reads as the sellers failing.
  const base = {
    chip: 'PAIR', upside: 'CONTESTED', downside: 'CONTESTED', prog: 0, absProg: 0, strength: 'NORMAL',
    deltaSide: 'NONE', highDelta: false, hunt: null, agg: null, pas: null, askRepl: null, bidRepl: null,
    delta: null, close: null, high: null, low: null, atFloor: false, atCeiling: false, failDown: false, failUp: false,
  } as const;
  const read = (over: Partial<EntryRead>): EntryRead => ({ ...base, ...over }) as EntryRead;
  const down = (close: number) => read({
    close, deltaSide: 'SELL', prog: 0.2, agg: -0.05, pas: -0.6, chip: 'ASKS', strength: 'WEAK', upside: 'ASKS_HOLD', downside: 'SELLERS_WIN',
  });
  const priors = [down(3.514), down(3.508), down(3.497), down(3.492), down(3.496), down(3.485)];
  const pause = (book: BookContext | null) => read({
    close: 3.486, deltaSide: 'BUY', prog: 0.03, strength: 'WEAK', agg: 0.04, pas: 0.14, chip: 'PAIR',
    upside: 'BUYERS_WIN', downside: 'BIDS_HOLD', book,
  });
  const ctx = (bids: BookContext['bids']): BookContext => ({
    bids, asks: 'QUIET', samples: 50, flows: { bids: side({}), asks: side({}), samples: 50 },
  });

  it('without book data the candle rule decides (unchanged)', () => {
    expect(decideEntry(pause(null), priors[5]!, priors, null)).toEqual({ side: 'buy', state: 8 });
  });
  it('bids pulling under the buy stops it', () => {
    expect(decideEntry(pause(ctx('PULLING')), priors[5]!, priors, null)).toBeNull();
  });
  it('bids defending lets it stand', () => {
    expect(decideEntry(pause(ctx('DEFENDING')), priors[5]!, priors, null)).toEqual({ side: 'buy', state: 8 });
  });
});
