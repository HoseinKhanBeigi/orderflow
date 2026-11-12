import { describe, expect, it } from 'vitest';
import {
  barBattleVerdict,
  decideEntry,
  entryMarks,
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

  it('4: the low was hunted, then price responded on ordinary delta', () => {
    const prev = read({ hunt: 'LOW' });
    const cur = read({ strength: 'NORMAL', deltaSide: 'BUY', prog: 0.9, ...closedHigh });
    const priors = [read({ chip: 'SELLERS', downside: 'SELLERS_WIN' }), read(), read(), read(), read({ chip: 'SELLERS' }), prev];
    expect(decideEntry(cur, prev, priors, null)).toEqual({ side: 'buy', state: 4 });
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
      expect(mark.short).toMatch(/^[BS][1-5]$/);
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
