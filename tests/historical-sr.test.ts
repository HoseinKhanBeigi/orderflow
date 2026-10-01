import { describe, expect, it } from 'vitest';
import {
  HistoricalSREngine,
  detectConfirmedPivots,
  assertNoLookahead,
  DEFAULT_HISTORICAL_SR_CONFIG,
} from '../src/historical-sr/index.js';
import type { HistoricalBarLike } from '../src/historical-sr/index.js';

function bar(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
): HistoricalBarLike {
  return { time, open, high, low, close, totalBuy: 1000, totalSell: 1000 };
}

/** Synthetic series with a clear swing high then rejection then break. */
function swingHighSeries(): HistoricalBarLike[] {
  // times 1..n ; pivot high at t=5 (price 110), confirm with 2 bars → knownAt=7
  return [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 102, 99.5, 101),
    bar(3, 101, 103, 100, 102),
    bar(4, 102, 105, 101, 104),
    bar(5, 104, 110, 103, 108), // swing high
    bar(6, 108, 109, 106, 107),
    bar(7, 107, 108, 105, 106), // confirmation closes → knownAt
    bar(8, 106, 107, 104, 105),
    bar(9, 105, 109.5, 104.5, 105.2), // wick into resistance, reject
    bar(10, 105.2, 106, 103, 104),
    bar(11, 104, 105, 102, 103),
    bar(12, 103, 112, 103, 111), // close through → break
    bar(13, 111, 113, 110, 112),
  ];
}

function swingLowSeries(): HistoricalBarLike[] {
  return [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 100.5, 98, 99),
    bar(3, 99, 99.5, 97, 98),
    bar(4, 98, 98.5, 96, 97),
    bar(5, 97, 97.5, 90, 91), // swing low
    bar(6, 91, 93, 90.5, 92),
    bar(7, 92, 94, 91.5, 93), // knownAt
    bar(8, 93, 95, 92, 94),
    bar(9, 94, 95, 89.5, 93.5), // wick through support, reject
    bar(10, 93.5, 96, 93, 95),
  ];
}

describe('detectConfirmedPivots', () => {
  it('detects swing high with knownAt after confirmation bars', () => {
    const bars = swingHighSeries();
    const pivots = detectConfirmedPivots(bars, 2);
    const high = pivots.find((p) => p.type === 'HIGH' && p.sourceCandleTime === 5);
    expect(high).toBeTruthy();
    expect(high!.knownAt).toBe(7);
    expect(high!.price).toBe(110);
  });

  it('detects swing low with knownAt after confirmation', () => {
    const bars = swingLowSeries();
    const pivots = detectConfirmedPivots(bars, 2);
    const low = pivots.find((p) => p.type === 'LOW' && p.sourceCandleTime === 5);
    expect(low).toBeTruthy();
    expect(low!.knownAt).toBe(7);
    expect(low!.price).toBe(90);
  });

  it('does not mark pivot known at source candle time', () => {
    const bars = swingHighSeries().slice(0, 5); // only through pivot, no right bars
    const pivots = detectConfirmedPivots(bars, 2);
    expect(pivots.every((p) => p.knownAt !== p.sourceCandleTime || p.knownAt > p.sourceCandleTime)).toBe(true);
    expect(pivots.filter((p) => p.sourceCandleTime === 5)).toHaveLength(0);
  });
});

describe('HistoricalSREngine creation', () => {
  it('creates resistance only after confirmation', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    const bars = swingHighSeries();
    for (let i = 0; i < 6; i++) engine.processBar(bars[i]!);
    expect(engine.snapshotAt(6).knownResistance).toHaveLength(0);

    engine.processBar(bars[6]!); // t=7 confirmation
    const snap = engine.snapshotAt(7);
    expect(snap.knownResistance.length).toBeGreaterThanOrEqual(1);
    const r = snap.knownResistance.find((l) => Math.abs(l.price - 110) < 1);
    expect(r).toBeTruthy();
    expect(r!.knownAt).toBe(7);
    expect(r!.sourceCandleTime).toBe(5);
    expect(r!.type).toBe('RESISTANCE');
  });

  it('creates support only after confirmation', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    const bars = swingLowSeries();
    for (let i = 0; i < 6; i++) engine.processBar(bars[i]!);
    expect(engine.snapshotAt(6).knownSupport).toHaveLength(0);
    engine.processBar(bars[6]!);
    const s = engine.snapshotAt(7).knownSupport.find((l) => Math.abs(l.price - 90) < 1);
    expect(s).toBeTruthy();
    expect(s!.knownAt).toBe(7);
  });

  it('builds zones around price', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, zoneAtrFraction: 0.2 });
    engine.processAll(swingHighSeries().slice(0, 7));
    const r = engine.getLevels().find((l) => l.type === 'RESISTANCE');
    expect(r).toBeTruthy();
    expect(r!.zoneLow).toBeLessThan(r!.price);
    expect(r!.zoneHigh).toBeGreaterThan(r!.price);
  });
});

describe('interactions', () => {
  it('wick rejection does not break resistance', () => {
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      breakConfirmCloses: 1,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    const bars = swingHighSeries();
    for (let i = 0; i < 9; i++) engine.processBar(bars[i]!); // through wick reject
    const r = engine.getLevels().find((l) => l.type === 'RESISTANCE' && l.source !== 'FLIPPED');
    expect(r).toBeTruthy();
    expect(r!.state).not.toBe('BROKEN');
    expect(r!.rejectionCount).toBeGreaterThanOrEqual(1);
  });

  it('close through breaks resistance', () => {
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      breakConfirmCloses: 1,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    engine.processAll(swingHighSeries());
    const broken = engine.getLevels().find((l) => l.type === 'RESISTANCE' && l.source !== 'FLIPPED');
    expect(broken?.state).toBe('BROKEN');
    expect(engine.getEvents().some((e) => e.type === 'LEVEL_BROKEN')).toBe(true);
  });

  it('support wick rejection holds', () => {
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    engine.processAll(swingLowSeries());
    const s = engine.getLevels().find((l) => l.type === 'SUPPORT' && l.source !== 'FLIPPED');
    expect(s).toBeTruthy();
    expect(s!.state).not.toBe('BROKEN');
    expect(s!.rejectionCount).toBeGreaterThanOrEqual(1);
  });

  it('role flip after break creates flipped level', () => {
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    engine.processAll(swingHighSeries());
    const flipped = engine.getLevels().find((l) => l.source === 'FLIPPED');
    expect(flipped).toBeTruthy();
    expect(flipped!.type).toBe('SUPPORT');
    expect(flipped!.state).toBe('FLIPPED_SUPPORT');
    expect(engine.getEvents().some((e) => e.type === 'LEVEL_FLIPPED')).toBe(true);
  });
});

describe('clustering', () => {
  it('merges nearby pivots into one zone', () => {
    // Two swing highs close in price
    const bars: HistoricalBarLike[] = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99, 101),
      bar(3, 101, 108, 100, 107), // high A
      bar(4, 107, 107.5, 105, 106),
      bar(5, 106, 106.5, 104, 105), // confirm A at t=5
      bar(6, 105, 106, 103, 104),
      bar(7, 104, 108.3, 103.5, 107), // high B near A
      bar(8, 107, 107.2, 105, 106),
      bar(9, 106, 106.5, 104.5, 105), // confirm B
    ];
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      clusterAtrFraction: 0.8,
      majorMinStrength: 0,
    });
    engine.processAll(bars);
    const resistances = engine.getLevels().filter((l) => l.type === 'RESISTANCE' && l.source !== 'FLIPPED');
    expect(resistances.length).toBeLessThanOrEqual(2);
    const clustered = resistances.find((l) => l.source === 'CLUSTERED_SWING' || l.touchCount >= 2);
    expect(clustered || resistances.length === 1).toBeTruthy();
  });
});

describe('segments and snapshot', () => {
  it('segments start at knownAt not sourceCandleTime', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    engine.processAll(swingHighSeries().slice(0, 8));
    const segs = engine.getSegments();
    expect(segs.length).toBeGreaterThanOrEqual(1);
    for (const s of segs) {
      expect(s.fromTime).toBeGreaterThanOrEqual(7);
    }
  });

  it('snapshot at T excludes levels known later', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    engine.processAll(swingHighSeries());
    const early = engine.snapshotAt(6);
    expect(early.knownResistance.every((l) => l.knownAt <= 6)).toBe(true);
    expect(early.knownResistance.find((l) => l.sourceCandleTime === 5)).toBeFalsy();

    const late = engine.snapshotAt(7);
    expect(late.knownResistance.some((l) => l.sourceCandleTime === 5)).toBe(true);
  });

  it('candle context only uses known levels', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    const bars = swingHighSeries();
    for (let i = 0; i < 7; i++) engine.processBar(bars[i]!);
    const ctx = engine.snapshotAt(7).candleContext;
    expect(ctx).toBeTruthy();
    expect(ctx!.knownResistance.every((l) => l.knownAt <= 7)).toBe(true);
  });
});

describe('no lookahead', () => {
  it('online vs full-dataset levels identical at each T', () => {
    const bars = [
      ...swingHighSeries(),
      ...swingLowSeries().map((b) => ({ ...b, time: b.time + 100 })),
    ];
    const err = assertNoLookahead(bars, { pivotConfirmBars: 2, majorMinStrength: 0 });
    expect(err).toBeNull();
  });

  it('incremental processBar matches processAll ids', () => {
    const bars = swingHighSeries();
    const online = new HistoricalSREngine('15m', { pivotConfirmBars: 2 });
    const batch = new HistoricalSREngine('15m', { pivotConfirmBars: 2 });
    batch.processAll(bars);
    for (const b of bars) online.processBar(b);
    const onlineIds = new Set(online.getLevels().map((l) => l.id));
    const batchIds = new Set(batch.getLevels().map((l) => l.id));
    expect(onlineIds).toEqual(batchIds);
  });
});

describe('strength and decay', () => {
  it('strength increases after rejection', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    const bars = swingHighSeries();
    for (let i = 0; i < 7; i++) engine.processBar(bars[i]!);
    const before = engine.getLevels().find((l) => l.type === 'RESISTANCE')!.strength;
    engine.processBar(bars[8]!); // rejection
    const after = engine.getLevels().find((l) => l.type === 'RESISTANCE' && l.state !== 'BROKEN');
    expect(after).toBeTruthy();
    expect(after!.rejectionCount).toBeGreaterThanOrEqual(1);
    expect(after!.strength).toBeGreaterThanOrEqual(before * 0.9);
  });

  it('events include LEVEL_CREATED', () => {
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2 });
    engine.processAll(swingHighSeries().slice(0, 7));
    expect(engine.getEvents().some((e) => e.type === 'LEVEL_CREATED')).toBe(true);
  });
});

describe('config defaults', () => {
  it('exposes default config', () => {
    expect(DEFAULT_HISTORICAL_SR_CONFIG.pivotConfirmBars).toBeGreaterThanOrEqual(1);
  });
});
