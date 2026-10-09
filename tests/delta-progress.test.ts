import { describe, expect, it } from 'vitest';
import {
  annotateDeltaProgress,
  deltaLabelYOffsets,
  deltaProgressLabelRows,
  deltaRatioPercent,
  DELTA_LABEL_ANCHOR,
  DELTA_LABEL_FIRST_OFFSET,
  percentileRank,
  priorAtr,
  type DeltaProgressBar,
} from '../src/footprint/delta-progress.js';

function bar(partial: Partial<DeltaProgressBar> & Pick<DeltaProgressBar, 'time'>): DeltaProgressBar {
  return {
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

/** 20 quiet completed candles, then one subject candle. */
function historyThen(subject: Partial<DeltaProgressBar>, priorAbs = 10): DeltaProgressBar[] {
  const bars: DeltaProgressBar[] = [];
  for (let i = 0; i < 24; i++) {
    const buy = 50 + priorAbs / 2;
    const sell = 50 - priorAbs / 2;
    bars.push(bar({
      time: 1_700_000_000 + i * 60,
      open: 100,
      high: 101,
      low: 99,
      close: 100 + (i % 2 === 0 ? 0.2 : -0.2),
      totalBuy: buy,
      totalSell: sell,
    }));
  }
  bars.push(bar({
    time: 1_700_000_000 + 24 * 60,
    ...subject,
  }));
  return bars;
}

const ready = { minHistory: 20, minAtrBars: 5, atrLookback: 14, deltaLookback: 50 };

describe('delta ratio', () => {
  it('is net delta as a percent of total volume, not buy/total', () => {
    expect(deltaRatioPercent(135, 65)).toBeCloseTo(35, 6);
    expect(deltaRatioPercent(65, 135)).toBeCloseTo(-35, 6);
    expect(deltaRatioPercent(50, 50)).toBeCloseTo(0, 6);
  });

  it('returns null for zero total volume', () => {
    expect(deltaRatioPercent(0, 0)).toBeNull();
  });
});

describe('percentile and ATR baselines exclude the current candle', () => {
  it('ranks only prior samples', () => {
    expect(percentileRank(10, [1, 2, 3, 10])).toBe(100);
    expect(percentileRank(1, [1, 2, 3, 10])).toBe(25);
  });

  it('prior ATR ignores the current bar and future bars', () => {
    const bars = [
      { high: 102, low: 98, close: 100 },
      { high: 103, low: 99, close: 101 },
      { high: 102, low: 98, close: 100 },
      { high: 103, low: 99, close: 101 },
      { high: 102, low: 98, close: 100 },
      { high: 103, low: 99, close: 101 },
      { high: 500, low: 1, close: 250 },
    ];
    const at = priorAtr(bars, 6, 14, 5);
    const withFuture = priorAtr([...bars, { high: 900, low: 1, close: 400 }], 6, 14, 5);
    expect(at).not.toBeNull();
    expect(withFuture).toBeCloseTo(at!, 8);
    expect(priorAtr(bars, 6, 14, 5)).toBeLessThan(50);
  });

  it('returns null ATR when warm-up is short or range is zero', () => {
    expect(priorAtr([{ high: 1, low: 1, close: 1 }], 0, 14, 5)).toBeNull();
    const flat = Array.from({ length: 8 }, () => ({ high: 10, low: 10, close: 10 }));
    expect(priorAtr(flat, flat.length, 14, 5)).toBeNull();
  });
});

describe('effort versus result', () => {
  it('labels strong buying with upward progress as buyers effective', () => {
    const bars = historyThen({ open: 100, close: 102, high: 102.5, low: 99.5, totalBuy: 200, totalSell: 40 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.deltaSide).toBe('BUY');
    expect(last.deltaStrengthState === 'STRONG' || last.deltaStrengthState === 'EXTREME').toBe(true);
    expect(last.deltaRatioPercent).toBeGreaterThan(15);
    expect(last.directionalProgressATR).toBeGreaterThan(0.1);
    expect(last.effortResultState).toBe('BUYERS_EFFECTIVE');
  });

  it('labels strong buying with low upward progress as buyer no progress', () => {
    const bars = historyThen({ open: 100, close: 100.02, high: 100.4, low: 99.6, totalBuy: 200, totalSell: 40 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.priceProgressState).toBe('LOW_PROGRESS');
    expect(last.effortResultState).toBe('BUYER_NO_PROGRESS');
  });

  it('labels strong buying when price closes down as buyer no progress', () => {
    const bars = historyThen({ open: 100, close: 98, high: 100.4, low: 97.5, totalBuy: 200, totalSell: 40 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.directionalProgressATR).toBeLessThan(0);
    expect(last.priceProgressState).toBe('AGAINST_AGGRESSION');
    expect(last.effortResultState).toBe('BUYER_NO_PROGRESS');
  });

  it('labels strong selling with downward progress as sellers effective', () => {
    const bars = historyThen({ open: 100, close: 98, high: 100.5, low: 97.5, totalBuy: 40, totalSell: 200 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.deltaSide).toBe('SELL');
    expect(last.directionalProgressATR).toBeGreaterThan(0.1);
    expect(last.effortResultState).toBe('SELLERS_EFFECTIVE');
  });

  it('labels strong selling with low downward progress as seller no progress', () => {
    const bars = historyThen({ open: 100, close: 99.98, high: 100.4, low: 99.6, totalBuy: 40, totalSell: 200 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.effortResultState).toBe('SELLER_NO_PROGRESS');
  });

  it('labels strong selling when price closes up as seller no progress', () => {
    const bars = historyThen({ open: 100, close: 102, high: 102.5, low: 99.5, totalBuy: 40, totalSell: 200 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.priceProgressState).toBe('AGAINST_AGGRESSION');
    expect(last.effortResultState).toBe('SELLER_NO_PROGRESS');
  });

  it('does not treat a high absolute delta with a low ratio as effort', () => {
    const bars = historyThen({ open: 100, close: 102, high: 102.2, low: 99.5, totalBuy: 520, totalSell: 480 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.absoluteDelta).toBeGreaterThan(20);
    expect(Math.abs(last.deltaRatioPercent!)).toBeLessThan(15);
    expect(last.effortResultState).toBe('NEUTRAL');
  });

  it('does not upgrade a moderate delta just because the ratio is high', () => {
    const bars = historyThen({ open: 100, close: 102, high: 102.2, low: 99.5, totalBuy: 12, totalSell: 2 }, 40);
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.deltaRatioPercent).toBeGreaterThan(50);
    expect(last.deltaStrengthState === 'WEAK' || last.deltaStrengthState === 'NORMAL').toBe(true);
    expect(last.effortResultState).not.toBe('BUYERS_EFFECTIVE');
    expect(last.effortResultState).not.toBe('BUYER_NO_PROGRESS');
  });
});

describe('missing data', () => {
  it('does not invent a ratio or strength when volume is missing', () => {
    const bars = historyThen({ totalBuy: 0, totalSell: 0, open: 100, close: 101, high: 101.2, low: 99.8 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.deltaRatioPercent).toBeNull();
    expect(last.delta).toBeNull();
    expect(last.deltaStrengthState).toBe('UNAVAILABLE');
    expect(last.dataQuality).toBe('UNAVAILABLE');
    expect(deltaProgressLabelRows(last, 'METRICS').some((row) => row.key === 'ratio')).toBe(false);
  });

  it('does not classify stale flow', () => {
    const bars = historyThen({ flowQuality: 'STALE', totalBuy: 200, totalSell: 20, open: 100, close: 102, high: 102, low: 99 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(last.dataQuality).toBe('STALE');
    expect(last.deltaStrengthState).toBe('UNAVAILABLE');
    expect(last.effortResultState).toBe('INSUFFICIENT');
  });

  it('marks insufficient percentile history', () => {
    const bars = [bar({ time: 1, totalBuy: 80, totalSell: 20, open: 100, close: 101, high: 101, low: 99 })];
    const last = annotateDeltaProgress(bars, ready)[0]!;
    expect(last.deltaStrengthState).toBe('INSUFFICIENT_DATA');
    expect(last.deltaStrengthPercentile).toBeNull();
    expect(last.deltaRatioPercent).toBeCloseTo(60, 6);
  });

  it('does not fabricate progress when ATR is invalid', () => {
    const flat = Array.from({ length: 8 }, (_, i) => bar({
      time: i,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      totalBuy: 80,
      totalSell: 20,
    }));
    const last = annotateDeltaProgress(flat, { ...ready, minHistory: 3, minAtrBars: 5 }).at(-1)!;
    expect(last.atr).toBeNull();
    expect(last.directionalProgressATR).toBeNull();
    expect(last.priceProgressState).toBe('INSUFFICIENT_DATA');
    expect(last.effortResultState).toBe('INSUFFICIENT');
  });
});

describe('no lookahead', () => {
  it('keeps earlier candles stable when a later candle changes', () => {
    const bars = historyThen({ totalBuy: 180, totalSell: 30, open: 100, close: 101.2, high: 101.4, low: 99.6 });
    const before = annotateDeltaProgress(bars, ready);
    const extended = [
      ...bars,
      bar({ time: bars.at(-1)!.time + 60, totalBuy: 9_000, totalSell: 1, open: 100, close: 140, high: 140, low: 90 }),
    ];
    const after = annotateDeltaProgress(extended, ready);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('updates only the live candle as its own volume changes', () => {
    const bars = historyThen({ totalBuy: 80, totalSell: 40, open: 100, close: 100.1, high: 100.4, low: 99.7 });
    const first = annotateDeltaProgress(bars, { ...ready, lastIsLive: true });
    const live = bars.map((b, i) => i === bars.length - 1 ? { ...b, totalBuy: 220, totalSell: 30 } : b);
    const second = annotateDeltaProgress(live, { ...ready, lastIsLive: true });
    expect(second.slice(0, -1)).toEqual(first.slice(0, -1));
    expect(second.at(-1)!.incomplete).toBe(true);
    expect(second.at(-1)!.delta).not.toBe(first.at(-1)!.delta);
    expect(second.at(-1)!.deltaStrengthPercentile).not.toBeNull();
  });

  it('uses a 50-candle window and ignores older samples beyond it', () => {
    const bars: DeltaProgressBar[] = [];
    for (let i = 0; i < 80; i++) {
      const old = i < 25;
      bars.push(bar({
        time: i,
        totalBuy: old ? 200 : 55,
        totalSell: old ? 0 : 45,
        open: 100,
        high: 101,
        low: 99,
        close: 100.2,
      }));
    }
    const narrow = annotateDeltaProgress(bars, { ...ready, minHistory: 20, deltaLookback: 50 }).at(-1)!;
    const wide = annotateDeltaProgress(bars, { ...ready, minHistory: 20, deltaLookback: 80 }).at(-1)!;
    expect(narrow.absoluteDelta).toBe(10);
    expect(narrow.deltaStrengthPercentile).toBe(100);
    expect(wide.deltaStrengthPercentile).toBeLessThan(narrow.deltaStrengthPercentile!);
  });
});

describe('below-candle labels', () => {
  it('anchors every row below the candle foot and away from top labels', () => {
    expect(DELTA_LABEL_ANCHOR).toBe('BELOW_CANDLE');
    const ys = deltaLabelYOffsets(4);
    expect(ys[0]).toBe(DELTA_LABEL_FIRST_OFFSET);
    expect(DELTA_LABEL_FIRST_OFFSET).toBeGreaterThan(52);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    expect(Math.min(...ys)).toBeGreaterThan(0);
  });

  it('renders metrics under the candle and hides them when OFF', () => {
    const bars = historyThen({ open: 100, close: 100.02, high: 100.4, low: 99.6, totalBuy: 200, totalSell: 40 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    const metrics = deltaProgressLabelRows(last, 'METRICS');
    expect(metrics.map((row) => row.key)).toEqual(['strength', 'ratio', 'progress', 'effort']);
    expect(metrics.some((row) => row.text.includes('BUYER NP') || row.text.includes('BUY Δ'))).toBe(true);
    expect(deltaProgressLabelRows(last, 'OFF')).toEqual([]);
  });

  it('compact mode keeps effort and ratio, and dense zoom drops lower rows', () => {
    const bars = historyThen({ open: 100, close: 100.02, high: 100.4, low: 99.6, totalBuy: 200, totalSell: 40 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    const compact = deltaProgressLabelRows(last, 'COMPACT');
    expect(compact.map((row) => row.key)).toContain('effort');
    expect(compact.map((row) => row.key)).toContain('ratio');
    expect(compact.map((row) => row.key)).not.toContain('progress');
    const dense = deltaProgressLabelRows(last, 'METRICS', { dense: true });
    expect(dense.length).toBeLessThanOrEqual(2);
    expect(dense.every((row) => row.key === 'effort' || row.key === 'ratio' || row.key === 'strength')).toBe(true);
  });

  it('does not emit a placeholder row when the state is unavailable', () => {
    const bars = historyThen({ totalBuy: 0, totalSell: 0 });
    const last = annotateDeltaProgress(bars, ready).at(-1)!;
    expect(deltaProgressLabelRows(last, 'METRICS')).toEqual([]);
    expect(deltaProgressLabelRows(last, 'COMPACT')).toEqual([]);
  });
});
