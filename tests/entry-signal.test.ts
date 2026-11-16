import { describe, expect, it } from 'vitest';
import {
  barBattleVerdict,
  barEntryRead,
  couldntMarks,
  decideEntry,
  entryMarks,
  entryPullbackPrice,
  levelMarks,
  maybeMarks,
  shapeAt,
  shapeMarks,
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
    high: null,
    low: null,
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
  it('1: a small up close does not answer a strong sell, so that candle stays a sell', () => {
    const priors = [3.33, 3.32, 3.30, 3.28, 3.26, 3.24].map((close) => read({
      close, deltaSide: 'SELL', delta: -400_000, agg: -0.2, pas: -0.3, chip: 'ASKS', ...closedLow,
    }));
    const cur = read({
      close: 3.242, strength: 'STRONG', deltaSide: 'SELL', delta: -630_000, prog: -0.14,
      agg: -0.09, pas: 0.58, ...closedHigh,
    });
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'sell', state: 2 });
  });

  it('1: heavy selling that lost the close → buy, after sellers were the setup', () => {
    const cur = read({ strength: 'STRONG', deltaSide: 'SELL', prog: 0.1, ...closedHigh });
    const priors = sideTries('SELL', 6);
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'buy', state: 1 });
  });

  it('1: high buy effort with a low response is a sell even when the close is higher', () => {
    const priors = [3.10, 3.11, 3.12, 3.13, 3.14, 3.15].map((close) => read({
      close, deltaSide: 'BUY', delta: 200_000, agg: 0.2, pas: 0.2, chip: 'BIDS', ...closedHigh,
    }));
    const cur = read({
      close: 3.157, strength: 'STRONG', deltaSide: 'BUY', delta: 543_000, prog: 0.22,
      agg: 0.15, pas: -0.3, ...closedLow,
    });
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'sell', state: 1 });
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

  it('2: a flat window is pinned, so a strong sell there is not the join', () => {
    const priors = [3.130, 3.132, 3.129, 3.131, 3.128, 3.130].map((close) => read({
      close, deltaSide: 'SELL', downside: 'SELLERS_WIN', upside: 'ASKS_HOLD', agg: -0.2, pas: -0.2, chip: 'SELLERS',
    }));
    const cur = read({
      close: 3.127, strength: 'STRONG', deltaSide: 'SELL', prog: 0.88, agg: -0.2, pas: -0.3, chip: 'SELLERS', ...closedLow,
    });
    expect(decideEntry(cur, priors[5]!, priors, null)).toBeNull();
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

  it('3: a bounce buy inside a bearish swing stays quiet', () => {
    const priors = Array.from({ length: 16 }, (_, i) => read({
      close: 3.4 - i * 0.01,
      deltaSide: 'SELL', strength: 'STRONG', prog: 0.7, agg: -0.4, pas: -0.3,
    }));
    const cur = read({ strength: 'STRONG', deltaSide: 'BUY', prog: 0.1, agg: 0.25, pas: -0.45, close: 3.24, ...closedLow });
    expect(decideEntry(cur, priors[15]!, priors, null)).toBeNull();
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

  it('7: 16 Nov 09:15, same sell effort but the close is still lower: no buy', () => {
    const prev = read({ close: 3.181, deltaSide: 'SELL', delta: -275_000, prog: 0.53, strength: 'NORMAL', agg: -0.2, ...closedLow });
    const cur = read({
      close: 3.176, deltaSide: 'SELL', delta: -221_000, prog: 0.19, strength: 'NORMAL', agg: -0.11, pas: 0.53, chip: 'BIDS', ...closedHigh,
    });
    const priors = [...sideTries('SELL', 5, { prog: 0.4 }), prev];
    expect(decideEntry(cur, prev, priors, null)).not.toEqual({ side: 'buy', state: 7 });
  });

  it('6: a side that is still progressing is left alone', () => {
    const prev = read({ deltaSide: 'SELL', prog: 0.96, strength: 'STRONG', agg: -0.27, pas: -0.5, ...closedLow });
    const cur = read({ deltaSide: 'SELL', prog: 0.76, strength: 'NORMAL', agg: -0.15, pas: -0.4, ...closedLow });
    const priors = [read({ deltaSide: 'BUY', prog: 0.8, ...closedHigh }), read(), read(), read(), read(), prev];
    expect(decideEntry(cur, prev, priors, null)?.state).not.toBe(6);
  });

  it('8: a sell-delta uptick that does not answer the drop stays a sell', () => {
    const priors = [3.33, 3.31, 3.28, 3.26, 3.24, 3.21].map((close) => read({
      close, deltaSide: 'SELL', delta: -500_000, prog: 0.4, agg: -0.2, pas: -0.3, chip: 'ASKS', strength: 'STRONG', ...closedLow,
    }));
    const cur = read({
      close: 3.219, deltaSide: 'SELL', prog: -0.36, strength: 'NORMAL', agg: -0.04, pas: 0.89, ...closedHigh,
    });
    expect(decideEntry(cur, priors[5]!, priors, null)).toEqual({ side: 'sell', state: 2 });
  });

  it('8: a flat window is not a downtrend, so the uptick is not a buy', () => {
    const flat = [3.332, 3.335, 3.346, 3.335, 3.331, 3.329].map((close) => read({
      close, deltaSide: 'SELL', delta: -400_000, high: close + 0.01, low: close - 0.02,
      agg: -0.2, pas: -0.4, chip: 'ASKS', strength: 'STRONG', ...closedLow,
    }));
    const cur = read({
      close: 3.334, high: 3.343, low: 3.316, deltaSide: 'BUY', delta: 189_000,
      prog: 0.28, strength: 'NORMAL', agg: 0.07, pas: 0.27, chip: 'BUYERS', ...closedHigh,
    });
    expect(decideEntry(cur, flat[5]!, flat, null)?.side).not.toBe('buy');
  });

  it('3: the bounce is given back on the next candle, so that candle is the sell', () => {
    const sells = [
      read({ deltaSide: 'SELL', delta: -445_000, high: 3.351, low: 3.332, close: 3.335 }),
      read({ deltaSide: 'SELL', delta: -579_000, high: 3.348, low: 3.326, close: 3.331 }),
      read({ deltaSide: 'SELL', delta: -740_000, high: 3.332, low: 3.299, close: 3.329 }),
    ];
    const bounce = read({
      deltaSide: 'BUY', delta: 189_000, high: 3.343, low: 3.316, close: 3.334, upside: 'BUYERS_WIN', downside: 'BIDS_HOLD',
    });
    const cur = read({
      deltaSide: 'SELL', delta: -198_000, agg: -0.1, prog: 0.1, high: 3.341, low: 3.320, close: 3.331,
    });
    const priors = [read({ close: 3.335, deltaSide: 'NONE', delta: -2_000 }), read({ close: 3.346, deltaSide: 'BUY', delta: 57_000, high: 3.346 }), ...sells, bounce];
    expect(decideEntry(cur, bounce, priors, null)).toEqual({ side: 'sell', state: 3 });
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

  it('8: 13 Nov 14:00 is a pause, 14:15 buyers take the close and that is the buy', () => {
    const down = (close: number) => read({
      close, deltaSide: 'SELL', prog: 0.2, agg: -0.05, pas: -0.6, chip: 'ASKS', strength: 'WEAK', ...closedLow,
    });
    const priors = [down(3.52), down(3.514), down(3.508), down(3.497), down(3.492), down(3.496), down(3.485)];
    const cur = read({
      close: 3.484, deltaSide: 'BUY', prog: -0.03, strength: 'WEAK', agg: 0.03, pas: 0.14, chip: 'PAIR', ...closedHigh,
    });
    // Flat, two-sided: sellers could not extend, but buyers did not show up either.
    expect(decideEntry(cur, priors[6]!, priors, null)).toBeNull();
    const later = read({
      close: 3.497, deltaSide: 'BUY', prog: 0.4, strength: 'NORMAL', agg: 0.2, pas: 0.35, chip: 'BUYERS', ...closedHigh,
    });
    expect(decideEntry(later, cur, [...priors.slice(1), cur], null)).toEqual({ side: 'buy', state: 8 });
  });

  it('8: 15 Nov 21:15 pause, then sellers come back: no buy', () => {
    const down = (close: number) => read({
      close, deltaSide: 'SELL', prog: 0.2, agg: -0.05, pas: -0.6, chip: 'ASKS', strength: 'WEAK', ...closedLow,
    });
    const priors = [down(3.52), down(3.514), down(3.508), down(3.497), down(3.492), down(3.496), down(3.485)];
    const pause = read({
      close: 3.486, deltaSide: 'BUY', prog: 0.03, strength: 'NORMAL', agg: 0.04, pas: 0.26, chip: 'PAIR', ...closedHigh,
    });
    expect(decideEntry(pause, priors[6]!, priors, null)).toBeNull();
    const sellersBack = read({
      close: 3.473, deltaSide: 'SELL', prog: 0.43, strength: 'NORMAL', agg: -0.11, pas: -1, chip: 'SELLERS', ...closedLow,
    });
    expect(decideEntry(sellersBack, pause, [...priors.slice(1), pause], null)?.side).not.toBe('buy');
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

describe('maybe', () => {
  it('warns of a sell on a strong bounce that has not turned a drop', () => {
    const bars: EntryBar[] = [];
    for (let i = 0; i < 16; i++) {
      const close = 3.4 - i * 0.012;
      bars.push({ time: i, open: close + 0.004, high: close + 0.008, low: close - 0.004, close, totalBuy: 30, totalSell: 70 });
    }
    const bounce = 3.23;
    bars.push({ time: 16, open: bounce - 0.02, high: bounce + 0.004, low: bounce - 0.024, close: bounce, totalBuy: 80, totalSell: 20 });
    const progress = bars.map((bar, i) => ({
      deltaSide: i === 16 ? 'BUY' as const : 'SELL' as const,
      deltaStrengthState: 'NORMAL',
      directionalProgressATR: i === 16 ? 1.2 : 0.4,
    }));
    expect(maybeMarks(bars, null, progress).get(16)?.text).toBe('MAYBE SELL');
  });

  it('16 Nov 09:00 and 09:15, the rise has stalled and both closes are lower: no buy', () => {
    const ohlc: Array<[number, number, number, number, number]> = [
      [5 * 60, 3.145, 3.155, 3.123, 3.127],
      [5 * 60 + 15, 3.128, 3.142, 3.122, 3.13],
      [5 * 60 + 30, 3.129, 3.166, 3.125, 3.165],
      [5 * 60 + 45, 3.165, 3.209, 3.156, 3.197],
      [6 * 60, 3.197, 3.216, 3.185, 3.194],
      [6 * 60 + 15, 3.195, 3.211, 3.184, 3.21],
      [6 * 60 + 30, 3.21, 3.222, 3.195, 3.212],
      [6 * 60 + 45, 3.211, 3.225, 3.197, 3.21],
      [7 * 60, 3.209, 3.209, 3.189, 3.202],
      [7 * 60 + 15, 3.203, 3.205, 3.181, 3.203],
      [7 * 60 + 30, 3.202, 3.211, 3.173, 3.183],
      [7 * 60 + 45, 3.183, 3.201, 3.177, 3.188],
      [8 * 60, 3.188, 3.188, 3.164, 3.164],
      [8 * 60 + 15, 3.165, 3.176, 3.16, 3.173],
      [8 * 60 + 30, 3.172, 3.174, 3.157, 3.166],
      [8 * 60 + 45, 3.166, 3.187, 3.165, 3.181],
      [9 * 60, 3.181, 3.181, 3.16, 3.166],
      [9 * 60 + 15, 3.165, 3.165, 3.147, 3.16],
      [9 * 60 + 30, 3.16, 3.16, 3.14, 3.141],
    ];
    const bars: EntryBar[] = ohlc.map(([time, open, high, low, close]) => {
      const sellCandle = close < open;
      const heavy = time === 9 * 60 || time === 9 * 60 + 15;
      const win = heavy ? 997_000 : 400_000;
      const lose = heavy ? 722_000 : 150_000;
      return {
        time,
        open,
        high,
        low,
        close,
        totalBuy: sellCandle ? lose : win,
        totalSell: sellCandle ? win : lose,
      };
    });
    const progress = annotateDeltaProgress(bars);
    const maybe = maybeMarks(bars, null, progress);
    const entries = entryMarks(bars, null, progress);
    for (const time of [9 * 60, 9 * 60 + 15]) {
      expect(maybe.get(time)?.side).not.toBe('buy');
      expect(entries.get(time)?.side).not.toBe('buy');
    }
  });
});

describe('entry price', () => {
  const prior: EntryBar[] = Array.from({ length: 8 }, (_, i) => ({
    time: i,
    open: 3.2,
    high: 3.22,
    low: 3.18,
    close: 3.2,
  }));
  const bar: EntryBar = { time: 9, open: 3.2, high: 3.23, low: 3.17, close: 3.2 };

  it('puts a buy a little under the close and a sell a little over it', () => {
    const buy = entryPullbackPrice(bar, prior, 'buy');
    const sell = entryPullbackPrice(bar, prior, 'sell');
    expect(buy).toBeLessThan(bar.close);
    expect(sell).toBeGreaterThan(bar.close);
    expect(bar.close - buy!).toBeLessThanOrEqual(0.04 * 0.3 + 1e-9);
    expect(sell! - bar.close).toBeLessThanOrEqual(0.04 * 0.3 + 1e-9);
  });

  it('still steps under the close when the buy candle closed on its low', () => {
    const lowClose: EntryBar = { ...bar, low: 3.2, close: 3.2 };
    const buy = entryPullbackPrice(lowClose, prior, 'buy');
    expect(buy).toBeLessThan(lowClose.close);
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

function shapeBar(high: number, low: number, close: number, time: number): EntryBar {
  return { time, open: close, high, low, close };
}

describe('shape context', () => {
  const range: EntryBar[] = [
    shapeBar(10.18, 10.02, 10.16, 0),
    shapeBar(10.38, 10.2, 10.36, 1),
    shapeBar(10.22, 10.04, 10.08, 2),
    shapeBar(10.4, 10.22, 10.34, 3),
    shapeBar(10.2, 10.02, 10.1, 4),
    shapeBar(10.39, 10.24, 10.36, 5),
    shapeBar(10.18, 10.05, 10.12, 6),
    shapeBar(10.4, 10.22, 10.2, 7),
  ];

  it('reads a range box and only allows a buy at the bottom and a sell at the top', () => {
    const top = shapeAt([...range, shapeBar(10.4, 10.22, 10.36, 8)], 8);
    const bottom = shapeAt([...range, shapeBar(10.2, 10.02, 10.06, 8)], 8);
    const middle = shapeAt([...range, shapeBar(10.28, 10.12, 10.2, 8)], 8);
    expect(top.kind).toBe('BOX');
    expect(top.buyOk).toBe(false);
    expect(top.sellOk).toBe(true);
    expect(bottom.buyOk).toBe(true);
    expect(bottom.sellOk).toBe(false);
    expect(middle.buyOk).toBe(false);
    expect(middle.sellOk).toBe(false);
  });

  it('does not call a staircase a box', () => {
    const bars: EntryBar[] = [];
    for (let i = 0; i < 9; i++) {
      const close = 10 + i * 0.2;
      bars.push(shapeBar(close + 0.08, close - 0.06, close, i));
    }
    expect(shapeAt(bars, 8).kind).not.toBe('BOX');
  });

  it('reads an M once the close leaves the valley, and keeps buys quiet', () => {
    const bars = [
      shapeBar(9.2, 9.0, 9.1, 0),
      shapeBar(9.4, 9.1, 9.3, 1),
      shapeBar(9.7, 9.3, 9.6, 2),
      shapeBar(10.0, 9.5, 9.8, 3),
      shapeBar(9.7, 9.4, 9.5, 4),
      shapeBar(9.6, 9.3, 9.4, 5),
      shapeBar(9.55, 9.2, 9.45, 6),
      shapeBar(9.7, 9.4, 9.6, 7),
      shapeBar(9.85, 9.5, 9.8, 8),
      shapeBar(10.05, 9.6, 9.9, 9),
      shapeBar(9.7, 9.3, 9.4, 10),
      shapeBar(9.4, 9.1, 9.15, 11),
    ];
    const before = shapeAt(bars.slice(0, 11), 10);
    const broken = shapeAt(bars, 11);
    expect(before.kind).not.toBe('M');
    expect(broken.kind).toBe('M');
    expect(broken.buyOk).toBe(false);
    expect(broken.sellOk).toBe(true);
    expect(broken.fresh).toBe(true);
    const labels = shapeMarks(bars, null);
    expect(labels.get(11)?.short).toBe('M');
  });

  it('reads a W once the close leaves the peak, and keeps sells quiet', () => {
    const bars = [
      shapeBar(10.2, 10.0, 10.1, 0),
      shapeBar(10.1, 9.7, 9.8, 1),
      shapeBar(9.9, 9.4, 9.5, 2),
      shapeBar(9.6, 9.0, 9.2, 3),
      shapeBar(9.7, 9.3, 9.6, 4),
      shapeBar(9.85, 9.5, 9.7, 5),
      shapeBar(10.0, 9.7, 9.85, 6),
      shapeBar(9.8, 9.4, 9.5, 7),
      shapeBar(9.6, 9.2, 9.3, 8),
      shapeBar(9.55, 9.05, 9.2, 9),
      shapeBar(9.7, 9.3, 9.6, 10),
      shapeBar(10.15, 9.7, 10.05, 11),
    ];
    const broken = shapeAt(bars, 11);
    expect(broken.kind).toBe('W');
    expect(broken.buyOk).toBe(true);
    expect(broken.sellOk).toBe(false);
  });

  it('does not mark the 16 Nov BTC 15m selloff, bounce, or wick turns as a box, M, or W', () => {
    const bars = btc15m.map(([high, low, close], time) => shapeBar(high, low, close, time));
    expect(shapeAt(bars, 64).kind).not.toBe('M');
    expect(shapeAt(bars, 57).kind).not.toBe('W');
    expect(shapeAt(bars, 70).kind).not.toBe('BOX');
    expect(shapeAt(bars, 75).kind).not.toBe('BOX');
    expect(shapeAt(bars, 78).kind).not.toBe('W');
    const marked = [...shapeMarks(bars, null).entries()].map(([time, mark]) => `${time}:${mark.short}`);
    expect(marked).toEqual(['28:W']);
  });
});

/** BTCUSDT 15m, 15 Nov 15:30 through 16 Nov 11:15 local. High, low, close. */
const btc15m: Array<[number, number, number]> = [
  [65387, 65121, 65327], [65496, 65280, 65445], [65529, 65364, 65464], [65547, 65372, 65480],
  [65587, 65450, 65521], [65777, 65439, 65531], [65542, 65335, 65472], [65535, 65395, 65406],
  [65406, 65057, 65273], [65514, 64824, 64870], [65000, 64433, 64611], [64947, 64611, 64741],
  [64833, 64438, 64654], [64771, 64559, 64608], [64763, 64576, 64674], [64788, 64622, 64720],
  [64720, 64522, 64585], [64778, 64240, 64738], [64916, 64433, 64710], [64714, 64485, 64674],
  [64800, 64636, 64695], [64903, 64695, 64843], [64843, 64478, 64578], [64585, 64354, 64541],
  [64640, 64467, 64538], [64782, 64504, 64507], [64662, 64500, 64595], [64710, 64541, 64701],
  [65208, 64668, 65025], [65028, 64872, 64948], [64968, 64869, 64968], [65007, 64914, 64916],
  [64916, 64657, 64672], [64940, 64670, 64854], [65100, 64855, 65001], [65174, 64954, 65103],
  [65141, 64976, 64984], [65011, 64856, 65005], [65020, 64902, 65008], [65340, 64984, 64984],
  [65176, 64906, 65150], [65240, 65117, 65167], [65247, 65110, 65114], [65206, 65065, 65192],
  [65475, 65020, 65020], [65176, 64777, 65089], [65358, 64962, 65290], [65350, 65121, 65310],
  [65366, 65036, 65044], [65088, 64913, 64966], [65065, 64628, 64728], [65029, 64707, 64891],
  [64951, 64700, 64859], [64916, 64620, 64838], [64964, 64663, 64750], [64850, 64519, 64538],
  [65000, 64534, 64925], [65330, 64865, 65182], [65334, 65046, 65123], [65228, 64961, 65153],
  [65209, 65001, 65146], [65210, 65013, 65062], [65066, 64856, 65002], [65130, 64832, 65079],
  [65158, 64783, 64915], [65099, 64863, 65023], [65027, 64835, 64835], [64844, 64756, 64787],
  [64787, 64594, 64600], [64888, 64600, 64841], [64864, 64612, 64689], [64707, 64315, 64445],
  [64549, 64260, 64288], [64486, 64271, 64440], [64654, 64423, 64565], [64731, 64552, 64682],
  [64800, 64444, 64467], [64766, 64395, 64714], [65029, 64667, 64911], [65048, 64857, 65002],
];
