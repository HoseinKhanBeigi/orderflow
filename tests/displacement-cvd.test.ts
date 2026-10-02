import { describe, expect, it } from 'vitest';
import {
  annotateBarsWithDisplacementCvd,
  candleDelta,
  computeDisplacement,
  flowDataQuality,
  reconcileCandleFlow,
  rowDelta,
  utcDayStartSec,
  formatDisplacementBps,
} from '../src/footprint/displacement-cvd.js';

function bar(
  partial: Partial<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    totalBuy: number;
    totalSell: number;
    hasFootprint: boolean;
    flowQuality: 'GOOD' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';
  }>,
) {
  return {
    time: 1_700_000_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    totalBuy: 0,
    totalSell: 0,
    hasFootprint: true,
    ...partial,
  };
}

describe('displacement', () => {
  it('computes bullish displacement in bps (not range)', () => {
    const d = computeDisplacement({ open: 100, high: 102, low: 99, close: 101 });
    expect(d.displacementRaw).toBeCloseTo(1, 10);
    expect(d.displacementPct).toBeCloseTo(1, 10);
    expect(d.displacementBps).toBeCloseTo(100, 6);
    expect(d.rangeRaw).toBeCloseTo(3, 10);
    expect(d.rangeBps).toBeCloseTo(300, 6);
    expect(d.direction).toBe('BULLISH');
    expect(d.displacementBps).not.toBeCloseTo(d.rangeBps);
  });

  it('computes bearish displacement', () => {
    const d = computeDisplacement({ open: 5, high: 5.01, low: 4.96, close: 4.975 });
    expect(d.displacementBps).toBeCloseTo(-50, 4);
    expect(d.direction).toBe('BEARISH');
  });

  it('handles zero displacement', () => {
    const d = computeDisplacement({ open: 10, high: 10.5, low: 9.5, close: 10 });
    expect(d.displacementBps).toBe(0);
    expect(d.direction).toBe('NEUTRAL');
    expect(d.rangeBps).toBeGreaterThan(0);
  });

  it('body efficiency = |close-open| / range', () => {
    const d = computeDisplacement({ open: 100, high: 102, low: 99, close: 101 });
    // |1| / 3
    expect(d.bodyEfficiency).toBeCloseTo(1 / 3, 6);
  });

  it('ATR-normalized displacement is optional and signed', () => {
    const d = computeDisplacement({ open: 100, high: 102, low: 99, close: 101 }, { atr: 2 });
    expect(d.displacementATR).toBeCloseTo(0.5, 6);
    const down = computeDisplacement({ open: 100, high: 100, low: 98, close: 99 }, { atr: 2 });
    expect(down.displacementATR).toBeCloseTo(-0.5, 6);
  });

  it('formatDisplacementBps keeps sign', () => {
    expect(formatDisplacementBps(42.3)).toBe('+42 bp');
    expect(formatDisplacementBps(-0.8)).toBe('−0.8 bp');
  });
});

describe('candle delta + reconciliation', () => {
  it('positive and negative delta', () => {
    expect(candleDelta({ totalBuy: 4_200_000, totalSell: 2_700_000 })).toBeCloseTo(1_500_000);
    expect(candleDelta({ totalBuy: 1_000_000, totalSell: 3_000_000 })).toBeCloseTo(-2_000_000);
  });

  it('reconciles buy+sell and delta', () => {
    const r = reconcileCandleFlow({ totalBuy: 4e6, totalSell: 2e6 });
    expect(r.ok).toBe(true);
    expect(r.executed).toBe(6e6);
    expect(r.delta).toBe(2e6);
  });

  it('row delta is not CVD', () => {
    expect(rowDelta(100, 40)).toBe(60);
  });
});

describe('CVD accumulation', () => {
  it('accumulates deltas sequentially (example from spec)', () => {
    const bars = [
      bar({ time: 100, totalBuy: 4e6, totalSell: 2e6, close: 101 }),
      bar({ time: 200, totalBuy: 1e6, totalSell: 3e6, close: 99 }),
      bar({ time: 300, totalBuy: 5e6, totalSell: 1e6, close: 102 }),
    ];
    const out = annotateBarsWithDisplacementCvd(bars, { resetMode: 'FROM_LOADED_HISTORY' });
    expect(out[0]!.delta).toBeCloseTo(2e6);
    expect(out[0]!.cvd).toBeCloseTo(2e6);
    expect(out[1]!.delta).toBeCloseTo(-2e6);
    expect(out[1]!.cvd).toBeCloseTo(0);
    expect(out[2]!.delta).toBeCloseTo(4e6);
    expect(out[2]!.cvd).toBeCloseTo(4e6);
  });

  it('cvdChange equals candle delta', () => {
    const out = annotateBarsWithDisplacementCvd(
      [
        bar({ time: 1, totalBuy: 2e6, totalSell: 0.5e6 }),
        bar({ time: 2, totalBuy: 0.2e6, totalSell: 1.2e6 }),
      ],
      { resetMode: 'FROM_LOADED_HISTORY' },
    );
    expect(out[1]!.cvdChange).toBeCloseTo(out[1]!.delta);
    expect(out[1]!.cvd).toBeCloseTo(out[0]!.cvd + out[1]!.delta);
  });

  it('allows CVD / displacement divergence', () => {
    const out = annotateBarsWithDisplacementCvd(
      [
        bar({
          time: 1,
          open: 5,
          high: 5.02,
          low: 4.97,
          close: 4.986, // −28 bps-ish
          totalBuy: 5e6,
          totalSell: 0.8e6, // strong +delta
        }),
      ],
      { resetMode: 'FROM_LOADED_HISTORY' },
    );
    expect(out[0]!.cvd).toBeGreaterThan(0);
    expect(out[0]!.displacementBps).toBeLessThan(0);
  });

  it('negative CVD + positive displacement is valid', () => {
    const out = annotateBarsWithDisplacementCvd(
      [
        bar({
          time: 1,
          open: 5,
          high: 5.05,
          low: 4.99,
          close: 5.0155, // ~+31 bps
          totalBuy: 0.5e6,
          totalSell: 4.3e6,
        }),
      ],
      { resetMode: 'FROM_LOADED_HISTORY' },
    );
    expect(out[0]!.cvd).toBeLessThan(0);
    expect(out[0]!.displacementBps).toBeGreaterThan(0);
  });

  it('UTC day reset', () => {
    const day1 = utcDayStartSec(1_704_067_200); // fixed
    const bars = [
      bar({ time: day1 + 3600, totalBuy: 1e6, totalSell: 0 }),
      bar({ time: day1 + 7200, totalBuy: 1e6, totalSell: 0 }),
      bar({ time: day1 + 86_400 + 3600, totalBuy: 0.5e6, totalSell: 0 }),
    ];
    const out = annotateBarsWithDisplacementCvd(bars, { resetMode: 'UTC_DAY' });
    expect(out[0]!.cvd).toBeCloseTo(1e6);
    expect(out[1]!.cvd).toBeCloseTo(2e6);
    expect(out[2]!.cvd).toBeCloseTo(0.5e6);
    expect(out[2]!.cvdStartTimestamp).toBe(bars[2]!.time);
  });

  it('does not fabricate CVD when flow unavailable', () => {
    const out = annotateBarsWithDisplacementCvd(
      [
        bar({ time: 1, totalBuy: 2e6, totalSell: 0 }),
        bar({ time: 2, totalBuy: 0, totalSell: 0, hasFootprint: false, flowQuality: 'UNAVAILABLE' }),
        bar({ time: 3, totalBuy: 1e6, totalSell: 0 }),
      ],
      { resetMode: 'FROM_LOADED_HISTORY' },
    );
    expect(out[1]!.dataQuality).toBe('UNAVAILABLE');
    expect(out[1]!.delta).toBe(0);
    expect(out[1]!.cvd).toBeCloseTo(2e6);
    expect(out[2]!.cvd).toBeCloseTo(3e6);
  });

  it('no future leakage: prefix CVD matches full-series CVD at same index', () => {
    const bars = [
      bar({ time: 1, totalBuy: 3e6, totalSell: 1e6 }),
      bar({ time: 2, totalBuy: 0.5e6, totalSell: 2e6 }),
      bar({ time: 3, totalBuy: 4e6, totalSell: 0.5e6 }),
    ];
    const full = annotateBarsWithDisplacementCvd(bars, { resetMode: 'FROM_LOADED_HISTORY' });
    const prefix = annotateBarsWithDisplacementCvd(bars.slice(0, 2), { resetMode: 'FROM_LOADED_HISTORY' });
    expect(prefix[1]!.cvd).toBeCloseTo(full[1]!.cvd);
  });

  it('marks last bar incomplete when live', () => {
    const out = annotateBarsWithDisplacementCvd(
      [bar({ time: 1, totalBuy: 1e6, totalSell: 0 }), bar({ time: 2, totalBuy: 1e6, totalSell: 0 })],
      { resetMode: 'FROM_LOADED_HISTORY', lastIsLive: true },
    );
    expect(out[0]!.incomplete).toBe(false);
    expect(out[1]!.incomplete).toBe(true);
  });

  it('flowDataQuality', () => {
    expect(flowDataQuality({ totalBuy: 1, totalSell: 1, hasFootprint: true })).toBe('GOOD');
    expect(flowDataQuality({ totalBuy: 0, totalSell: 0 })).toBe('UNAVAILABLE');
    expect(flowDataQuality({ totalBuy: 1, totalSell: 0, hasFootprint: false })).toBe('PARTIAL');
  });
});
