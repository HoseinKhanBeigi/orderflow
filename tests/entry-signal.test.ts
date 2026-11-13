import { describe, expect, it } from 'vitest';
import {
  barBattleVerdict,
  barEntryRead,
  couldntMarks,
  decideEntry,
  entryMarks,
  levelMarks,
  trapMarks,
  type EntryBar,
  type EntryRead,
} from '../src/entry-signal/index.js';
import { annotateDeltaProgress } from '../src/footprint/delta-progress.js';

function read(over: Partial<EntryRead> = {}): EntryRead {
  const base: EntryRead = {
    chip: 'PAIR',
    upside: 'CONTESTED',
    downside: 'CONTESTED',
    prog: 0,
    absProg: 0,
    strength: 'NORMAL',
    deltaSide: 'NONE',
    highDelta: false,
    hunt: null,
    agg: null,
    pas: null,
    askRepl: null,
    bidRepl: null,
    delta: null,
    close: null,
    atFloor: false,
    atCeiling: false,
    failDown: false,
    failUp: false,
  };
  const out = { ...base, ...over };
  if (over.prog !== undefined && over.absProg === undefined) out.absProg = over.prog == null ? null : Math.abs(over.prog);
  if (over.strength && over.highDelta === undefined) out.highDelta = over.strength === 'STRONG' || over.strength === 'EXTREME';
  return out;
}

/** Six-candle setup. The state reads these before the signal candle. */
function sideTries(side: 'BUY' | 'SELL', n: number, over: Partial<EntryRead> = {}): EntryRead[] {
  return Array.from({ length: n }, () => read({ deltaSide: side, ...over }));
}

/** Closed high in range: upside BUYERS_WIN, downside BIDS_HOLD. */
const closedHigh = { upside: 'BUYERS_WIN', downside: 'BIDS_HOLD' } as const;
/** Closed low in range: upside ASKS_HOLD, downside SELLERS_WIN. */
const closedLow = { upside: 'ASKS_HOLD', downside: 'SELLERS_WIN' } as const;

describe('barBattleVerdict', () => {
  it('reads the close position in range', () => {
    const top = barBattleVerdict({ time: 0, open: 100, high: 110, low: 100, close: 109, totalBuy: 70, totalSell: 30 })!;
    expect(top.up.outcome).toBe('BUYERS_WIN');
    expect(top.down.outcome).toBe('BIDS_HOLD');
    expect(top.stronger).toBe('UP');

    const mid = barBattleVerdict({ time: 0, open: 100, high: 110, low: 100, close: 105, totalBuy: 51, totalSell: 49 })!;
    expect(mid.up.outcome).toBe('CONTESTED');
    expect(mid.stronger).toBe('EVEN');
  });

  it('returns null with no volume', () => {
    expect(barBattleVerdict({ time: 0, open: 1, high: 1, low: 1, close: 1 })).toBeNull();
  });
});

describe('decideEntry states', () => {
  it('1: heavy selling that lost the close → buy, after sellers were the setup', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = sideTries('SELL', 6);
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 1 });
  });

  it('1: heavy buying that lost the close → sell, after buyers were the setup', () => {
    const cur = read({ strength: 'EXTREME', deltaSide: 'BUY', prog: 0.1, ...closedLow });
    const priors = sideTries('BUY', 6);
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'sell', state: 1 });
  });

  it('1: one absorbed sell with buyers owning the setup is not a buy', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = sideTries('BUY', 6);
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('1: not repeated when the previous candle lost the same way', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = [...sideTries('SELL', 5), prev];
    expect(decideEntry(cur, prev, priors, null)).toBeNull();
  });

  it('2: strong buying that moved price, with buyers already owning the priors', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', ...closedHigh });
    const priors = [read({ chip: 'BUYERS' }), read({ chip: 'BUYERS' }), read({ chip: 'SELLERS' }), read(), read(), read()];
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 2 });
  });

  it('3: effort flipped, asks refilled, and price stopped', () => {
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.7, agg: -0.4, pas: -0.3 });
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.25, pas: -0.45, ...closedLow });
    const priors = [...sideTries('SELL', 5), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'buy', state: 3 });
  });

  it('3: a flip the book accepted is not an entry', () => {
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.7, agg: -0.4, pas: -0.3 });
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.25, pas: 0.4, ...closedHigh });
    const priors = [...sideTries('SELL', 5), prev];
    expect(decideEntry(cur, prev, priors, null)).toBeNull();
  });

  it('3: one accepted sell, with no earlier sell in the setup, is not the flip', () => {
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.7, agg: -0.4, pas: -0.3 });
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.25, pas: -0.45, ...closedLow });
    const priors = [read(), read(), read(), read(), read(), prev];
    expect(decideEntry(cur, prev, priors, null)).toBeNull();
  });

  it('1: a balanced tape is not a fade', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.03, pas: -0.4, ...closedLow });
    const priors = sideTries('BUY', 6);
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('2: asks refilled more than bids, so the buy effort was not accepted', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', agg: 0.4, pas: -0.35, ...closedHigh });
    const priors = [
      read({ chip: 'BUYERS', upside: 'BUYERS_WIN' }),
      read({ chip: 'BUYERS', upside: 'BUYERS_WIN' }),
      read({ chip: 'BUYERS', upside: 'BUYERS_WIN' }),
      read({ upside: 'BUYERS_WIN' }),
      read(),
      read(),
    ];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('4: a response the book refilled against is not taken', () => {
    const prev = read({ hunt: 'LOW' });
    const cur = read({ strength: 'NORMAL', deltaSide: 'BUY', prog: 0.9, agg: 0.2, pas: -0.55, ...closedHigh });
    const priors = [read({ chip: 'SELLERS', downside: 'SELLERS_WIN' }), read(), read(), read(), read({ chip: 'SELLERS' }), prev];
    expect(decideEntry(cur, prev, priors, null)).toBeNull();
  });

  it('5: the last sell still owned the book, so the buy is not state 5', () => {
    const failedSell = read({ strength: 'NORMAL', deltaSide: 'SELL', prog: 0.24, chip: 'SELLERS', agg: -0.2, pas: -0.25, ...closedLow });
    const priors = [failedSell, failedSell, failedSell, failedSell, failedSell, failedSell];
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.66, chip: 'ASKS', agg: 0.22, pas: -0.4, ...closedLow });
    expect(decideEntry(cur, failedSell, priors, null)?.state).not.toBe(5);
  });

  it('5: sellers tried across the recent candles and could not keep pushing, then buyers take it', () => {
    const failedSell = read({ strength: 'NORMAL', deltaSide: 'SELL', prog: 0.24, chip: 'SELLERS', ...closedLow });
    const bidsHeld = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.66, chip: 'BIDS', ...closedHigh });
    const priors = [failedSell, failedSell, failedSell, failedSell, failedSell, bidsHeld];
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.66, chip: 'ASKS', ...closedLow });
    expect(decideEntry(cur, bidsHeld, priors, { side: 'buy' })).toEqual({ side: 'buy', state: 5 });
  });

  it('5: a sell campaign that kept extending is not a buy', () => {
    const pushed = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.9, chip: 'SELLERS', ...closedLow });
    const priors = [pushed, pushed, pushed, pushed, pushed, pushed];
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', ...closedHigh });
    expect(decideEntry(cur, pushed, priors, null)?.state).not.toBe(5);
  });

  it('6: the buy stops progressing, so the sell is open before the down candles', () => {
    const movedSell = read({ deltaSide: 'SELL', prog: 0.99, strength: 'STRONG', ...closedLow });
    const prev = read({ deltaSide: 'BUY', prog: 0.87, strength: 'STRONG', agg: 0.18, pas: 0.85, chip: 'BUYERS', ...closedHigh });
    const cur = read({ deltaSide: 'BUY', prog: -0.14, strength: 'NORMAL', agg: 0.18, pas: -0.09 });
    const priors = [movedSell, movedSell, read(), read(), read(), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'sell', state: 6 });
  });

  it('6: the sell stops progressing, so the buy is open before the next candles', () => {
    const movedBuy = read({ deltaSide: 'BUY', prog: 0.87, strength: 'STRONG', ...closedHigh });
    const prev = read({ deltaSide: 'SELL', prog: 0.96, strength: 'STRONG', agg: -0.27, pas: -0.88, chip: 'SELLERS', ...closedLow });
    const cur = read({ deltaSide: 'SELL', prog: 0.24, strength: 'NORMAL', agg: -0.05, pas: -0.29 });
    const priors = [movedBuy, read(), read(), read(), read(), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'buy', state: 6 });
  });

  it('7: same buy effort, response fades, sell is marked on that candle', () => {
    const prev = read({ deltaSide: 'BUY', delta: 497_000, prog: 0.9, strength: 'STRONG' });
    const cur = read({ deltaSide: 'BUY', delta: 410_000, prog: 0.3, strength: 'STRONG', ...closedHigh });
    const priors = [...sideTries('BUY', 5, { prog: 0.4 }), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'sell', state: 7 });
  });

  it('7: effort and response both still growing is not a fade', () => {
    const prev = read({ deltaSide: 'BUY', delta: 300_000, prog: 0.6, strength: 'NORMAL' });
    const cur = read({ deltaSide: 'BUY', delta: 500_000, prog: 0.95, strength: 'STRONG' });
    const priors = [...sideTries('BUY', 5), prev];
    expect(decideEntry(cur, prev, priors, null)).not.toEqual({ side: 'sell', state: 7 });
  });

  it('7: same sell effort, response fades, buy is marked on that candle', () => {
    const prev = read({ deltaSide: 'SELL', delta: -800_000, prog: 0.96, strength: 'STRONG' });
    const cur = read({ deltaSide: 'SELL', delta: -700_000, prog: 0.3, strength: 'STRONG', ...closedLow });
    const priors = [...sideTries('SELL', 5, { prog: 0.4 }), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'buy', state: 7 });
  });

  it('6: a side that is still progressing is left alone', () => {
    const prev = read({ deltaSide: 'SELL', prog: 0.96, strength: 'STRONG', agg: -0.27, pas: -0.5, ...closedLow });
    const cur = read({ deltaSide: 'SELL', prog: 0.76, strength: 'NORMAL', agg: -0.15, pas: -0.4, ...closedLow });
    const priors = [read({ deltaSide: 'BUY', prog: 0.8, ...closedHigh }), read(), read(), read(), read(), prev];
    expect(decideEntry(cur, prev, priors, null)?.state).not.toBe(6);
  });

  it('4: the low was hunted, then price responded on ordinary delta', () => {
    const prev = read({ hunt: 'LOW' });
    const cur = read({ strength: 'NORMAL', deltaSide: 'BUY', prog: 0.9, ...closedHigh });
    const priors = [read({ chip: 'SELLERS', downside: 'SELLERS_WIN' }), read(), read(), read(), read({ chip: 'SELLERS' }), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'buy', state: 4 });
  });

  it('1: an uptrend blocks the seller fade, even when the sell lost the close', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = [3.5, 3.51, 3.52, 3.53, 3.54, 3.55].map((close) => read({
      close, deltaSide: 'SELL', pas: -0.3, chip: 'ASKS', agg: -0.2, ...closedLow,
    }));
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('1: a buyer trap in the window is not a buy', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = [...sideTries('SELL', 5), read({ deltaSide: 'SELL', hunt: 'HIGH' })];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('1: a downtrend with asks still fades the absorbed sell', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5].map((close) => read({
      close, deltaSide: 'SELL', pas: -0.4, chip: 'ASKS', agg: -0.2, ...closedLow,
    }));
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 1 });
  });

  it('2: a held ceiling keeps the buy join quiet', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', agg: 0.3, pas: 0.2, ...closedHigh });
    const priors = [read({ chip: 'BUYERS', atCeiling: true }), read({ chip: 'BUYERS' }), read({ chip: 'SELLERS' }), read(), read(), read()];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('1: a held ceiling is not a buy', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = [...sideTries('SELL', 5), read({ deltaSide: 'SELL', atCeiling: true })];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('2: buyers were trapped at the high, so the join stays quiet', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', agg: 0.3, pas: 0.2, ...closedHigh });
    const priors = [read({ chip: 'BUYERS', hunt: 'HIGH' }), read({ chip: 'BUYERS' }), read({ chip: 'SELLERS' }), read(), read(), read()];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('2: buyers already lost the close inside the uptrend, so the next push is not a join', () => {
    const priors = [3.5, 3.51, 3.52, 3.53, 3.54, 3.53].map((close, i) => read({
      close,
      deltaSide: 'BUY',
      prog: i === 5 ? 0.2 : 0.6,
      agg: 0.2,
      pas: 0.3,
      chip: 'BIDS',
      ...(i === 5 ? closedLow : closedHigh),
    }));
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.8, chip: 'BUYERS', agg: 0.3, pas: 0.2, close: 3.55, ...closedHigh });
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('2: buyers pushing inside a downtrend are not a buy', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.7, chip: 'BUYERS', agg: 0.4, pas: 0.2, ...closedHigh });
    const priors = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5].map((close) => read({
      close, chip: 'BUYERS', upside: 'BUYERS_WIN', deltaSide: 'BUY', pas: 0.3, agg: 0.2, ...closedHigh,
    }));
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('7: same buy effort is not a sell when the window drifted down', () => {
    const priors = [3.55, 3.54, 3.53, 3.52, 3.51].map((close) => read({
      close, deltaSide: 'BUY', prog: 0.4, pas: 0.2, ...closedHigh,
    }));
    const prev = read({ close: 3.5, deltaSide: 'BUY', delta: 497_000, prog: 0.9, strength: 'STRONG', pas: 0.2 });
    const cur = read({ deltaSide: 'BUY', delta: 410_000, prog: 0.3, strength: 'STRONG' });
    expect(decideEntry(cur, prev, [...priors, prev], null)).toBeNull();
  });

  it('8: downside trend, sellers and asks cannot push down, buyers take the close', () => {
    const sellMoved = read({ deltaSide: 'SELL', prog: 0.7, agg: -0.3, pas: -0.4, chip: 'ASKS', strength: 'NORMAL', ...closedLow });
    const sellWeak = read({ deltaSide: 'SELL', prog: 0.2, agg: -0.12, pas: -0.2, chip: 'SELLERS', strength: 'NORMAL', ...closedLow });
    const priors = [sellMoved, sellMoved, sellWeak, sellWeak, sellWeak, sellWeak];
    const cur = read({ deltaSide: 'BUY', prog: 0.2, strength: 'NORMAL', agg: 0.28, pas: 0.14, chip: 'BUYERS', ...closedHigh });
    expect(decideEntry(cur, sellWeak, priors, null)).toEqual({ side: 'buy', state: 8 });
  });

  it('8: upside trend, buyers and bids cannot push up, sellers take the close', () => {
    const buyMoved = read({ deltaSide: 'BUY', prog: 0.7, agg: 0.3, pas: 0.4, chip: 'BIDS', strength: 'NORMAL', ...closedHigh });
    const buyWeak = read({ deltaSide: 'BUY', prog: 0.2, agg: 0.12, pas: 0.2, chip: 'BUYERS', strength: 'NORMAL', ...closedHigh });
    const priors = [buyMoved, buyMoved, buyWeak, buyWeak, buyWeak, buyWeak];
    const cur = read({ deltaSide: 'SELL', prog: 0.2, strength: 'NORMAL', agg: -0.28, pas: -0.14, chip: 'SELLERS', ...closedLow });
    expect(decideEntry(cur, buyWeak, priors, null)).toEqual({ side: 'sell', state: 8 });
  });

  it('8: sellers never showed asks, so the downtrend failure is not a buy', () => {
    const sellMoved = read({ deltaSide: 'SELL', prog: 0.7, agg: -0.3, pas: 0.4, chip: 'BIDS', strength: 'NORMAL', ...closedHigh });
    const priors = [sellMoved, sellMoved, sellMoved, sellMoved, sellMoved, sellMoved];
    const cur = read({ deltaSide: 'BUY', prog: 0.2, strength: 'NORMAL', agg: 0.28, pas: 0.14, chip: 'BUYERS', ...closedHigh });
    expect(decideEntry(cur, sellMoved, priors, null)?.state).not.toBe(8);
  });

  it('8: 14:00, weak delta closes back up after sellers and asks could not extend the drop', () => {
    const down = (close: number) => read({
      close, deltaSide: 'SELL', prog: 0.2, agg: -0.05, pas: -0.6, chip: 'ASKS', strength: 'WEAK', ...closedLow,
    });
    const priors = [down(3.514), down(3.508), down(3.497), down(3.492), down(3.496), down(3.485)];
    const cur = read({
      close: 3.484, deltaSide: 'BUY', prog: -0.03, strength: 'WEAK', agg: 0.03, pas: 0.14, chip: 'PAIR', ...closedHigh,
    });
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 8 });
    const later = read({
      close: 3.497, deltaSide: 'BUY', prog: 0.4, strength: 'NORMAL', agg: 0.2, pas: 0.35, chip: 'BUYERS', ...closedHigh,
    });
    expect(decideEntry(later, cur, [...priors.slice(1), cur], { side: 'buy' })).toBeNull();
  });

  it('8: a drifting downtrend whose asks showed, then buyers take an ordinary close', () => {
    const down = (close: number) => read({
      close, deltaSide: 'SELL', prog: 0.15, agg: -0.04, pas: -0.25, chip: 'ASKS', strength: 'WEAK', ...closedLow,
    });
    const priors = [down(3.52), down(3.51), down(3.505), down(3.50), down(3.495), down(3.485)];
    const cur = read({ close: 3.484, deltaSide: 'BUY', prog: 0.12, strength: 'NORMAL', agg: 0.28, pas: 0.14, chip: 'BUYERS', ...closedHigh });
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 8 });
  });

  it('8: a high-delta flip after a sell that just moved is not this context', () => {
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.7, agg: -0.4, pas: -0.3 });
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.25, pas: 0.4, ...closedHigh });
    const priors = [...sideTries('SELL', 5), prev];
    expect(decideEntry(cur, prev, priors, null)?.state).not.toBe(8);
  });

  it('missing progress is unknown, not "price stopped"', () => {
    const prev = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.7 });
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: null });
    expect(decideEntry(cur, prev, [prev], null)).toBeNull();
  });
});

describe('state 2 delta side (regression)', () => {
  // 11/10 17:00: SELL Δ EXTREME, price moved with the sellers, but the candle
  // closed in the upper part of its range. The setup was already sellers.
  const heavySellClosedHigh = read({ strength: 'EXTREME', deltaSide: 'SELL', prog: 0.88, chip: 'PAIR', ...closedHigh });
  const sellSetup = sideTries('SELL', 6);

  it('a SELL-delta candle is never BUY 2', () => {
    const signal = decideEntry(heavySellClosedHigh, sellSetup[5]!, sellSetup, null);
    expect(signal).not.toEqual({ side: 'buy', state: 2 });
    expect(signal).toEqual({ side: 'buy', state: 1 });
  });

  it('a BUY-delta candle closing high gets BUY 2 when two setup candles already won', () => {
    const cur = read({ strength: 'EXTREME', deltaSide: 'BUY', prog: 0.88, chip: 'PAIR', ...closedHigh });
    const priors = [read({ upside: 'BUYERS_WIN' }), read({ upside: 'BUYERS_WIN' }), read(), read(), read(), read()];
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 2 });
  });

  it('one prior win in the setup is not BUY 2', () => {
    const cur = read({ strength: 'EXTREME', deltaSide: 'BUY', prog: 0.88, chip: 'PAIR', ...closedHigh });
    const priors = [read({ upside: 'BUYERS_WIN' }), read(), read(), read(), read(), read()];
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
  });

  it('a BUY-delta candle closing low is never SELL 2', () => {
    const cur = read({ strength: 'EXTREME', deltaSide: 'BUY', prog: 0.88, chip: 'PAIR', ...closedLow });
    const p = sideTries('BUY', 6);
    expect(decideEntry(cur, p[5]!, p, null)).toEqual({ side: 'sell', state: 1 });
  });
});

function syntheticBars(n: number, seed = 7): EntryBar[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
  const bars: EntryBar[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const open = price;
    const move = (rnd() - 0.5) * 2;
    const close = open + move;
    const high = Math.max(open, close) + rnd() * 0.8;
    const low = Math.min(open, close) - rnd() * 0.8;
    const vol = 1000 + rnd() * 4000 * (rnd() < 0.1 ? 4 : 1);
    const buyShare = Math.min(0.95, Math.max(0.05, 0.5 + move * 0.25 + (rnd() - 0.5) * 0.4));
    bars.push({ time: i * 900, open, high, low, close, totalBuy: vol * buyShare, totalSell: vol * (1 - buyShare) });
    price = close;
  }
  return bars;
}

describe('floor, ceiling, and failure', () => {
  it('marks the second defense of a low as the floor, and a break that closes back as fail down', () => {
    const held = (time: number): EntryBar => ({
      time, open: 104, high: 110, low: 100, close: 108, totalBuy: 60, totalSell: 40,
    });
    const bars = [0, 1, 2, 3, 4, 5].map(held);
    const progress = bars.map(() => ({ deltaSide: 'BUY' as const, deltaStrengthState: 'NORMAL', directionalProgressATR: 0.2 }));
    const floor = barEntryRead(bars, 5, progress);
    expect(floor.atFloor).toBe(true);
    expect(floor.failDown).toBe(false);
    const broken = [...bars, { time: 6, open: 104, high: 109, low: 97, close: 106, totalBuy: 55, totalSell: 45 }];
    const brokeProgress = [...progress, progress[0]!];
    const fail = barEntryRead(broken, 6, brokeProgress);
    expect(fail.failDown).toBe(true);
    expect(levelMarks(broken, null, brokeProgress).get(6)?.short).toBe('FAIL ↓');
  });

  it('does not call the first touch of a low a floor', () => {
    const bars = [0, 1, 2, 3, 4].map((time) => ({
      time, open: 100 + time, high: 112 + time, low: 100 + time, close: 108 + time, totalBuy: 50, totalSell: 50,
    }));
    const progress = bars.map(() => ({ deltaSide: 'BUY' as const, deltaStrengthState: 'NORMAL', directionalProgressATR: 0.3 }));
    expect(barEntryRead(bars, 4, progress).atFloor).toBe(false);
  });
});

describe('sell trap and buy trap', () => {
  function leg(time: number, close: number, lowClose: boolean): EntryBar {
    return {
      time,
      open: close,
      high: lowClose ? close + 0.016 : close + 0.004,
      low: lowClose ? close - 0.004 : close - 0.016,
      close,
      totalBuy: lowClose ? 40 : 70,
      totalSell: lowClose ? 60 : 30,
    };
  }

  it('labels S TRAP when a downtrend takes the prior low and closes back up', () => {
    const closes = [3.55, 3.53, 3.51, 3.49, 3.47, 3.45];
    const bars = closes.map((close, i) => leg(i, close, true));
    bars.push({ time: 6, open: 3.44, high: 3.47, low: 3.42, close: 3.462, totalBuy: 70, totalSell: 30 });
    const progress = bars.map(() => ({ deltaSide: 'SELL' as const, deltaStrengthState: 'NORMAL', directionalProgressATR: 0.4 }));
    const marks = trapMarks(bars, null, progress);
    expect(marks.get(6)?.short).toBe('S TRAP');
    expect(marks.has(5)).toBe(false);
  });

  it('does not label a low sweep that is not a downtrend', () => {
    const closes = [3.45, 3.47, 3.49, 3.51, 3.53, 3.55];
    const bars = closes.map((close, i) => leg(i, close, false));
    bars.push({ time: 6, open: 3.54, high: 3.57, low: 3.4, close: 3.56, totalBuy: 30, totalSell: 70 });
    const progress = bars.map(() => ({ deltaSide: 'BUY' as const, deltaStrengthState: 'NORMAL', directionalProgressATR: 0.5 }));
    expect(trapMarks(bars, null, progress).size).toBe(0);
  });

  it('labels B TRAP when an uptrend takes the prior high and closes back down', () => {
    const closes = [3.45, 3.47, 3.49, 3.51, 3.53, 3.55];
    const bars = closes.map((close, i) => leg(i, close, false));
    bars.push({ time: 6, open: 3.56, high: 3.6, low: 3.53, close: 3.542, totalBuy: 30, totalSell: 70 });
    const progress = bars.map(() => ({ deltaSide: 'BUY' as const, deltaStrengthState: 'NORMAL', directionalProgressATR: 0.5 }));
    expect(trapMarks(bars, null, progress).get(6)?.short).toBe('B TRAP');
  });
});

describe("sellers can't and buyers can't", () => {
  function downBar(time: number, close: number, highClose: boolean): EntryBar {
    return {
      time,
      open: close + 0.01,
      high: highClose ? close + 0.004 : close + 0.02,
      low: highClose ? close - 0.02 : close - 0.004,
      close,
      totalBuy: highClose ? 70 : 40,
      totalSell: highClose ? 30 : 60,
    };
  }

  it("labels sellers can't on the close that comes back up, and not on the next one", () => {
    const closes = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5, 3.505, 3.51];
    const bars = closes.map((close, i) => downBar(i, close, i >= 6));
    const marks = couldntMarks(bars, null, bars.map(() => ({ deltaSide: 'SELL', deltaStrengthState: 'WEAK', directionalProgressATR: 0.2 })));
    expect(marks.get(6)?.text).toBe("SELLERS CAN'T");
    expect(marks.has(7)).toBe(false);
    expect(marks.has(5)).toBe(false);
  });

  it("does not label sellers can't when the close is still lower, even if it finished off the low", () => {
    const closes = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5, 3.48];
    const bars = closes.map((close, i) => downBar(i, close, i === 6));
    const marks = couldntMarks(bars, null, bars.map(() => ({ deltaSide: 'SELL', deltaStrengthState: 'WEAK', directionalProgressATR: 0.2 })));
    expect(marks.has(6)).toBe(false);
  });

  it("does not label sellers can't while the close is still falling", () => {
    const closes = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5, 3.49];
    const bars = closes.map((close, i) => downBar(i, close, false));
    const marks = couldntMarks(bars, null, bars.map(() => ({ deltaSide: 'SELL', deltaStrengthState: 'NORMAL', directionalProgressATR: 0.6 })));
    expect(marks.size).toBe(0);
  });

  it("labels buyers can't when an uptrend close comes back down", () => {
    const upBar = (time: number, close: number, lowClose: boolean): EntryBar => ({
      time,
      open: close - 0.01,
      high: lowClose ? close + 0.02 : close + 0.004,
      low: lowClose ? close - 0.004 : close - 0.02,
      close,
      totalBuy: lowClose ? 30 : 70,
      totalSell: lowClose ? 70 : 30,
    });
    const closes = [3.5, 3.51, 3.52, 3.53, 3.54, 3.55, 3.545];
    const bars = closes.map((close, i) => upBar(i, close, i === 6));
    const marks = couldntMarks(bars, null, bars.map(() => ({ deltaSide: 'BUY', deltaStrengthState: 'NORMAL', directionalProgressATR: 0.6 })));
    expect(marks.get(6)?.text).toBe("BUYERS CAN'T");
  });

  it('skips the live candle', () => {
    const closes = [3.55, 3.54, 3.53, 3.52, 3.51, 3.5, 3.505];
    const bars = closes.map((close, i) => downBar(i, close, i === 6));
    const marks = couldntMarks(bars, 6, bars.map(() => ({ deltaSide: 'SELL', deltaStrengthState: 'WEAK', directionalProgressATR: 0.2 })));
    expect(marks.has(6)).toBe(false);
  });
});

describe('state 5 on the chart', () => {
  it('still labels the buyer candle after the bids-held fade', () => {
    const bar = (time: number, closeHigh: boolean, sellHeavy: boolean): EntryBar => ({
      time,
      open: 100,
      high: 110,
      low: 100,
      close: closeHigh ? 108 : 102,
      totalBuy: sellHeavy ? 40 : 65,
      totalSell: sellHeavy ? 60 : 35,
    });
    const row = (side: 'BUY' | 'SELL', strength: string, prog: number) => ({
      deltaSide: side,
      deltaStrengthState: strength,
      directionalProgressATR: prog,
    });
    const bars = [
      bar(0, true, false),
      bar(1, true, false),
      bar(2, false, true),
      bar(3, false, true),
      bar(4, false, true),
      bar(5, false, true),
      bar(6, true, true),
      bar(7, false, false),
    ];
    const progress = [
      row('BUY', 'NORMAL', 0.2),
      row('BUY', 'NORMAL', 0.2),
      row('SELL', 'NORMAL', 0.3),
      row('SELL', 'NORMAL', 0.24),
      row('SELL', 'NORMAL', 0.24),
      row('SELL', 'NORMAL', 0.2),
      row('SELL', 'STRONG', 0.66),
      row('BUY', 'STRONG', 0.66),
    ];
    const marks = entryMarks(bars, null, progress);
    expect(marks.get(6)?.short).toBe('B1');
    expect(marks.get(7)?.short).toBe('B5');
  });
});

describe('entryMarks', () => {
  const bars = syntheticBars(400);
  const full = entryMarks(bars, null, annotateDeltaProgress(bars));

  it('produces marks on synthetic data', () => {
    expect(full.size).toBeGreaterThan(5);
    for (const mark of full.values()) {
      expect(mark.short).toMatch(/^[BS][1-8]$/);
    }
  });

  it('never changes a past mark when later candles arrive (no lookahead)', () => {
    for (const cut of [60, 150, 275]) {
      const prefix = bars.slice(0, cut);
      const partial = entryMarks(prefix, null, annotateDeltaProgress(prefix));
      const expected = [...full].filter(([t]) => t < prefix[cut - 1]!.time + 1);
      expect([...partial]).toEqual(expected);
    }
  });

  it('skips the live candle', () => {
    const live = bars[bars.length - 1]!.time;
    const marks = entryMarks(bars, live, annotateDeltaProgress(bars, { lastIsLive: true }));
    expect(marks.has(live)).toBe(false);
  });
});
