import { describe, expect, it } from 'vitest';
import {
  evaluatePrevious15m,
  selectPreviousCompleted15m,
  completed15mBars,
  classifyP15Location,
  classifyP15Interaction,
  p15BucketOpenTime,
  buildPrevious15mReference,
  p15HistoricalConfluence,
  p15LiveConfluence,
} from '../src/previous-15m/index.js';
import type { Previous15mBarLike } from '../src/previous-15m/index.js';

function bar(time: number, open: number, high: number, low: number, close: number): Previous15mBarLike {
  return { time, open, high, low, close };
}

/** Fixed 15m opens: t=0, 900, 1800, 2700… */
const T0 = 1_700_000_000; // aligned-ish; we'll align explicitly
const B = 900;
const open0 = T0 - (T0 % B);
const open1 = open0 + B;
const open2 = open1 + B;
const open3 = open2 + B;

const series: Previous15mBarLike[] = [
  bar(open0, 4.9, 5.0, 4.85, 4.97),
  bar(open1, 4.97, 5.02, 4.9, 4.95),
  bar(open2, 4.95, 4.99, 4.88, 4.92),
];

describe('completed15mBars / selectPreviousCompleted15m', () => {
  it('excludes in-progress 15m bucket', () => {
    // During open2 bucket (asOf inside open2..open3)
    const asOf = open2 + 100;
    const completed = completed15mBars(series, asOf);
    expect(completed.every((b) => b.time < open2)).toBe(true);
    expect(completed[completed.length - 1]!.time).toBe(open1);
  });

  it('previous is last completed, not current forming', () => {
    const asOf = open2 + 50;
    const prev = selectPreviousCompleted15m(series, asOf);
    expect(prev!.time).toBe(open1);
    expect(prev!.high).toBe(5.02);
    expect(prev!.low).toBe(4.9);
  });

  it('after open2 closes, previous becomes open2', () => {
    const asOf = open3 + 10;
    const withOpen2 = [...series, bar(open2, 4.95, 4.99, 4.88, 4.92)];
    // series already has open2 — asOf in open3 means open2 is completed
    const prev = selectPreviousCompleted15m(series, asOf);
    expect(prev!.time).toBe(open2);
  });

  it('no lookahead: snapshot at early T never sees later bars as previous', () => {
    const early = selectPreviousCompleted15m(series, open1 + 10);
    expect(early!.time).toBe(open0);
    const late = selectPreviousCompleted15m(series, open3 + 10);
    expect(late!.time).toBe(open2);
    expect(early!.high).not.toBe(late!.high);
  });

  it('returns null when no completed candle', () => {
    const onlyLive = [bar(open2, 1, 2, 0.5, 1.5)];
    expect(selectPreviousCompleted15m(onlyLive, open2 + 10)).toBeNull();
  });
});

describe('classifyP15Location', () => {
  const high = 5.0;
  const low = 4.85;

  it('inside previous range', () => {
    expect(classifyP15Location({ price: 4.93, high, low, nearBps: 10, atBps: 3 })).toBe('INSIDE_P15_RANGE');
  });

  it('near / at high and low', () => {
    expect(classifyP15Location({ price: 4.999, high, low, nearBps: 10, atBps: 3 })).toBe('AT_P15_HIGH');
    expect(classifyP15Location({ price: 4.995, high, low, nearBps: 20, atBps: 3 })).toBe('NEAR_P15_HIGH');
    expect(classifyP15Location({ price: 4.851, high, low, nearBps: 10, atBps: 5 })).toBe('AT_P15_LOW');
  });

  it('above high / below low', () => {
    expect(classifyP15Location({ price: 5.05, high, low, nearBps: 10, atBps: 3 })).toBe('ABOVE_P15_HIGH');
    expect(classifyP15Location({ price: 4.8, high, low, nearBps: 10, atBps: 3 })).toBe('BELOW_P15_LOW');
  });
});

describe('classifyP15Interaction', () => {
  const high = 5.0;
  const low = 4.85;

  it('wick above then close below = rejection', () => {
    expect(
      classifyP15Interaction({
        bar: bar(1, 4.98, 5.02, 4.96, 4.97),
        high,
        low,
        nearBps: 10,
      }),
    ).toBe('P15_HIGH_REJECTION');
  });

  it('wick below then reclaim = low rejection', () => {
    expect(
      classifyP15Interaction({
        bar: bar(1, 4.88, 4.9, 4.82, 4.89),
        high,
        low,
        nearBps: 10,
      }),
    ).toBe('P15_LOW_REJECTION');
  });

  it('close above = closed / accepted', () => {
    expect(
      classifyP15Interaction({
        bar: bar(1, 4.99, 5.03, 4.98, 5.02),
        high,
        low,
        nearBps: 10,
        acceptConfirmCloses: 1,
      }),
    ).toBe('ACCEPTED_ABOVE_P15_HIGH');
  });

  it('close below accepted', () => {
    expect(
      classifyP15Interaction({
        bar: bar(1, 4.88, 4.89, 4.8, 4.82),
        high,
        low,
        nearBps: 10,
      }),
    ).toBe('ACCEPTED_BELOW_P15_LOW');
  });
});

describe('evaluatePrevious15m', () => {
  it('builds reference from previous completed candle', () => {
    const snap = evaluatePrevious15m({
      bars15m: series,
      asOf: open2 + 120,
      currentPrice: 4.93,
    });
    expect(snap.status).toBe('OK');
    expect(snap.previous15m!.high).toBe(5.02);
    expect(snap.previous15m!.low).toBe(4.9);
    expect(snap.currentContext!.location).toBe('INSIDE_P15_RANGE');
  });

  it('unavailable when no data', () => {
    const snap = evaluatePrevious15m({
      bars15m: [],
      asOf: open2,
      currentPrice: 1,
    });
    expect(snap.status).toBe('P15_DATA_UNAVAILABLE');
  });

  it('confluence with historical resistance / live ask', () => {
    const ref = buildPrevious15mReference(series[0]!);
    expect(
      p15HistoricalConfluence({
        high: ref.high,
        low: ref.low,
        historicalResistance: { zoneLow: 4.992, zoneHigh: 5.008, center: 5.0 },
        confluenceBps: 12,
      }),
    ).toBe('P15_HIGH_AT_HISTORICAL_RESISTANCE');
    expect(
      p15LiveConfluence({
        high: 5.0,
        low: 4.85,
        liveAsk: { price: 5.003 },
        confluenceBps: 12,
      }),
    ).toBe('LIVE_ASK_AT_P15_HIGH');
  });

  it('bucket open aligns to 15m', () => {
    expect(p15BucketOpenTime(open1 + 333) % 900).toBe(0);
    expect(p15BucketOpenTime(open1 + 333)).toBe(open1);
  });
});
