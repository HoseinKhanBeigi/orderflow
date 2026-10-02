import { describe, expect, it } from 'vitest';
import {
  evaluateSwingStructure,
  detectConfirmedSwings,
  completedSwingBars,
  classifySwingLocation,
  classifySwingInteraction,
  detectBosChoch,
  swingHistoricalConfluence,
  swingLiveConfluence,
  mergeSwingConfig,
  type SwingBarLike,
} from '../src/swing-structure/index.js';

const B = 900; // 15m
const T0 = 1_700_000_000 - (1_700_000_000 % B);

function bar(i: number, open: number, high: number, low: number, close: number): SwingBarLike {
  return { time: T0 + i * B, open, high, low, close };
}

/** Classic swing: rise to high at i=5, then fall; low at i=10, then rise. left=3 right=3 */
function structureSeries(): SwingBarLike[] {
  // indices 0..16
  const rows: Array<[number, number, number, number]> = [
    [4.9, 4.95, 4.88, 4.92], // 0
    [4.92, 4.98, 4.9, 4.96], // 1
    [4.96, 5.0, 4.94, 4.98], // 2
    [4.98, 5.05, 4.97, 5.02], // 3
    [5.02, 5.08, 5.0, 5.06], // 4
    [5.06, 5.2, 5.04, 5.1], // 5  ← swing high 5.20
    [5.1, 5.12, 5.0, 5.02], // 6
    [5.02, 5.05, 4.95, 4.97], // 7
    [4.97, 5.0, 4.9, 4.92], // 8
    [4.92, 4.95, 4.85, 4.88], // 9
    [4.88, 4.9, 4.74, 4.8], // 10 ← swing low 4.74
    [4.8, 4.95, 4.78, 4.92], // 11
    [4.92, 5.0, 4.9, 4.98], // 12
    [4.98, 5.05, 4.96, 5.02], // 13
    [5.02, 5.1, 5.0, 5.08], // 14
    [5.08, 5.15, 5.05, 5.12], // 15
    [5.12, 5.18, 5.1, 5.16], // 16
  ];
  return rows.map((r, i) => bar(i, r[0]!, r[1]!, r[2]!, r[3]!));
}

const cfg = mergeSwingConfig({
  leftBars: 3,
  rightBars: 3,
  barSeconds: B,
  minSignificance: 30,
  minBarsBetweenSwings: 1,
  acceptBeyondBps: 5,
});

describe('completedSwingBars / confirmation', () => {
  it('excludes bars not yet closed', () => {
    const series = structureSeries();
    const asOf = series[8]!.time + 100; // mid bar 8
    const completed = completedSwingBars(series, asOf, B);
    expect(completed.every((b) => b.time + B <= asOf)).toBe(true);
    expect(completed[completed.length - 1]!.time).toBe(series[7]!.time);
  });

  it('swing high not known until rightBars confirm', () => {
    const series = structureSeries();
    // Pivot at index 5, confirmed after bar 8 closes → confirmedAt = bar8.time + B = bar9.time
    const pivot = series[5]!;
    const confirmClose = series[8]!.time + B;

    const before = evaluateSwingStructure({
      bars: series,
      asOf: confirmClose - 1,
      config: cfg,
    });
    expect(before.recentSwingHigh).toBeNull();

    const after = evaluateSwingStructure({
      bars: series,
      asOf: confirmClose,
      config: cfg,
    });
    expect(after.recentSwingHigh).not.toBeNull();
    expect(after.recentSwingHigh!.price).toBe(pivot.high);
    expect(after.recentSwingHigh!.pivotTime).toBe(pivot.time);
    expect(after.recentSwingHigh!.confirmedAt).toBe(confirmClose);
  });
});

describe('swing high / low detection', () => {
  it('detects swing high and swing low', () => {
    const series = structureSeries();
    const asOf = series[series.length - 1]!.time + B;
    const swings = detectConfirmedSwings(completedSwingBars(series, asOf, B), cfg);
    const highs = swings.filter((s) => s.type === 'SWING_HIGH');
    const lows = swings.filter((s) => s.type === 'SWING_LOW');
    expect(highs.some((h) => h.price === 5.2)).toBe(true);
    expect(lows.some((l) => l.price === 4.74)).toBe(true);
  });

  it('handles equal highs deterministically (right allows >=)', () => {
    // Peak at i=3 with equal high on right first bar still qualifies via >=
    const series: SwingBarLike[] = [
      bar(0, 1, 1.1, 0.9, 1),
      bar(1, 1, 1.2, 0.95, 1.1),
      bar(2, 1.1, 1.3, 1.0, 1.2),
      bar(3, 1.2, 1.5, 1.15, 1.4), // pivot high 1.5
      bar(4, 1.4, 1.5, 1.2, 1.3), // equal high
      bar(5, 1.3, 1.4, 1.1, 1.2),
      bar(6, 1.2, 1.35, 1.05, 1.15),
    ];
    const asOf = series[6]!.time + B;
    const swings = detectConfirmedSwings(completedSwingBars(series, asOf, B), {
      ...cfg,
      leftBars: 2,
      rightBars: 2,
    });
    expect(swings.some((s) => s.type === 'SWING_HIGH' && s.price === 1.5)).toBe(true);
  });

  it('handles equal lows', () => {
    const series: SwingBarLike[] = [
      bar(0, 2, 2.1, 1.9, 2),
      bar(1, 2, 2.05, 1.8, 1.9),
      bar(2, 1.9, 1.95, 1.7, 1.8),
      bar(3, 1.8, 1.85, 1.5, 1.6), // pivot low 1.5
      bar(4, 1.6, 1.7, 1.5, 1.65), // equal low
      bar(5, 1.65, 1.8, 1.6, 1.75),
      bar(6, 1.75, 1.9, 1.7, 1.85),
    ];
    const asOf = series[6]!.time + B;
    const swings = detectConfirmedSwings(completedSwingBars(series, asOf, B), {
      ...cfg,
      leftBars: 2,
      rightBars: 2,
    });
    expect(swings.some((s) => s.type === 'SWING_LOW' && s.price === 1.5)).toBe(true);
  });
});

describe('no lookahead / no repaint', () => {
  it('replay at T never sees unconfirmed future swing', () => {
    const series = structureSeries();
    const early = evaluateSwingStructure({ bars: series, asOf: series[6]!.time + B, config: cfg });
    const late = evaluateSwingStructure({
      bars: series,
      asOf: series[series.length - 1]!.time + B,
      config: cfg,
    });
    // At bar6 close, pivot5 not yet confirmed (needs through bar8)
    expect(early.swings.every((s) => s.confirmedAt <= series[6]!.time + B)).toBe(true);
    if (early.recentSwingHigh && late.recentSwingHigh) {
      // Once confirmed, pivot price must not move
      const earlyHigh = early.swings.find((s) => s.pivotTime === series[5]!.time);
      const lateHigh = late.swings.find((s) => s.pivotTime === series[5]!.time);
      if (earlyHigh && lateHigh) expect(earlyHigh.price).toBe(lateHigh.price);
    }
  });

  it('does not rewrite confirmed swing price', () => {
    const series = structureSeries();
    const t1 = series[8]!.time + B;
    const t2 = series[16]!.time + B;
    const a = evaluateSwingStructure({ bars: series, asOf: t1, config: cfg });
    const b = evaluateSwingStructure({ bars: series, asOf: t2, config: cfg });
    const shA = a.swings.find((s) => s.pivotTime === series[5]!.time);
    const shB = b.swings.find((s) => s.pivotTime === series[5]!.time);
    expect(shA?.price).toBe(5.2);
    expect(shB?.price).toBe(5.2);
  });
});

describe('location / interaction', () => {
  it('near / at / above / below', () => {
    expect(
      classifySwingLocation({ price: 5.196, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('NEAR_SWING_HIGH');
    expect(
      classifySwingLocation({ price: 5.2, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('AT_SWING_HIGH');
    expect(
      classifySwingLocation({ price: 5.25, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('ABOVE_SWING_HIGH');
    expect(
      classifySwingLocation({ price: 4.743, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('NEAR_SWING_LOW');
    expect(
      classifySwingLocation({ price: 4.7, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('BELOW_SWING_LOW');
    expect(
      classifySwingLocation({ price: 5.0, swingHigh: 5.2, swingLow: 4.74, nearBps: 10, atBps: 3 }),
    ).toBe('BETWEEN_SWINGS');
  });

  it('wick above = rejection, not break', () => {
    const interaction = classifySwingInteraction({
      bar: { time: 1, open: 5.1, high: 5.22, low: 5.05, close: 5.08 },
      swingHigh: 5.2,
      swingLow: 4.74,
      nearBps: 10,
      acceptBeyondBps: 5,
    });
    expect(interaction).toBe('SWING_HIGH_REJECTION');
  });

  it('wick below = rejection', () => {
    const interaction = classifySwingInteraction({
      bar: { time: 1, open: 4.8, high: 4.85, low: 4.7, close: 4.82 },
      swingHigh: 5.2,
      swingLow: 4.74,
      nearBps: 10,
      acceptBeyondBps: 5,
    });
    expect(interaction).toBe('SWING_LOW_REJECTION');
  });

  it('close beyond with distance = break path', () => {
    expect(
      classifySwingInteraction({
        bar: { time: 1, open: 5.2, high: 5.3, low: 5.18, close: 5.28 },
        swingHigh: 5.2,
        swingLow: 4.74,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('CLOSED_ABOVE_SWING_HIGH');

    expect(
      classifySwingInteraction({
        bar: { time: 1, open: 4.74, high: 4.76, low: 4.6, close: 4.65 },
        swingHigh: 5.2,
        swingLow: 4.74,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('CLOSED_BELOW_SWING_LOW');
  });
});

describe('BOS / CHOCH', () => {
  it('close above swing high → BOS (not wick-only)', () => {
    const high = {
      id: 'h',
      type: 'SWING_HIGH' as const,
      price: 5.2,
      pivotTime: 1,
      confirmedAt: 2,
      timeframe: '15m',
      leftBars: 3,
      rightBars: 3,
      significance: 80,
      class: 'MAJOR' as const,
      state: 'ACTIVE' as const,
      testCount: 0,
      lastInteractionAt: null,
    };
    expect(
      detectBosChoch({
        structure: 'BULLISH_STRUCTURE',
        recentSwingHigh: high,
        recentSwingLow: null,
        close: 5.201, // ~1.9 bps — below acceptBeyond
        acceptBeyondBps: 5,
      }),
    ).toBe('NONE');
    expect(
      detectBosChoch({
        structure: 'BULLISH_STRUCTURE',
        recentSwingHigh: high,
        recentSwingLow: null,
        close: 5.28,
        acceptBeyondBps: 5,
      }),
    ).toBe('BULLISH_BOS');
    expect(
      detectBosChoch({
        structure: 'BEARISH_STRUCTURE',
        recentSwingHigh: high,
        recentSwingLow: null,
        close: 5.28,
        acceptBeyondBps: 5,
      }),
    ).toBe('BULLISH_CHOCH');
  });
});

describe('confluence', () => {
  it('swing high at historical resistance', () => {
    expect(
      swingHistoricalConfluence({
        swingHigh: 5.02,
        swingLow: 4.74,
        resistance: { low: 5.015, high: 5.03 },
        support: null,
        confluenceBps: 12,
      }),
    ).toBe('SWING_HIGH_AT_RESISTANCE');
  });

  it('live ask at swing high', () => {
    expect(
      swingLiveConfluence({
        swingHigh: 5.02,
        swingLow: 4.74,
        liveAsk: { price: 5.018 },
        liveBid: null,
        confluenceBps: 12,
      }),
    ).toBe('LIVE_ASK_AT_SWING_HIGH');
  });
});

describe('structure + recent selection', () => {
  it('exposes recent swing high/low after confirmation', () => {
    const series = structureSeries();
    const snap = evaluateSwingStructure({
      bars: series,
      asOf: series[series.length - 1]!.time + B,
      currentPrice: 5.05,
      config: cfg,
    });
    expect(snap.recentSwingHigh?.price).toBe(5.2);
    expect(snap.recentSwingLow?.price).toBe(4.74);
    expect(snap.currentContext?.location).toBe('BETWEEN_SWINGS');
  });

  it('1m/5m charts can still evaluate fixed 15m swings (isolation)', () => {
    // Same 15m series — config timeframe label stays 15m regardless of chart TF.
    const series = structureSeries();
    const snap = evaluateSwingStructure({
      bars: series,
      asOf: series[series.length - 1]!.time + B,
      config: { ...cfg, timeframeLabel: '15m' },
    });
    expect(snap.timeframe).toBe('15m');
    expect(snap.recentSwingHigh).not.toBeNull();
  });
});

describe('break confirmation vs wick-only false break', () => {
  it('wick-only does not mark BROKEN in update path', () => {
    // Build series where after SH confirm, price wicks above then closes below
    const series = structureSeries();
    const confirmClose = series[8]!.time + B;
    // Add a rejection bar after confirmation
    const extended = [
      ...series,
      bar(17, 5.1, 5.22, 5.0, 5.05), // wick above 5.20, close below
    ];
    const snap = evaluateSwingStructure({
      bars: extended,
      asOf: extended[extended.length - 1]!.time + B,
      config: cfg,
    });
    const sh = snap.swings.find((s) => s.price === 5.2) ?? snap.recentSwingHigh;
    expect(sh).not.toBeNull();
    expect(sh!.state).not.toBe('BROKEN');
    expect(['REJECTED', 'TESTING', 'ACTIVE']).toContain(sh!.state);
  });
});
