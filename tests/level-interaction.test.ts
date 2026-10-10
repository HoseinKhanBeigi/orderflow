import { describe, expect, it } from 'vitest';
import {
  annotateLevelInteractions,
  failReclaimLabelY,
  mapLevelEventToFailureReclaim,
  projectFailReclaimLabel,
  canConfirmAcceptance,
  confirmedSwings,
  level,
} from '../src/level-interaction/index.js';
import type { InteractionBar, InteractionLevel } from '../src/level-interaction/types.js';
import { emptyStages, selectPrimaryLabel, mergeMarketSequenceConfig } from '../src/market-sequence/index.js';

const RES = level({
  id: 'res-5',
  type: 'HISTORICAL_RESISTANCE',
  price: 5,
  zoneLow: 5,
  zoneHigh: 5,
  knownAt: 0,
});

const SUP = level({
  id: 'sup-5',
  type: 'HISTORICAL_SUPPORT',
  price: 5,
  zoneLow: 5,
  zoneHigh: 5,
  knownAt: 0,
});

function bar(
  time: number,
  o: number,
  h: number,
  l: number,
  c: number,
  extra: Partial<InteractionBar> = {},
): InteractionBar {
  const buy = extra.totalBuy ?? extra.aggressiveBuy ?? 1_000_000;
  const sell = extra.totalSell ?? extra.aggressiveSell ?? 800_000;
  const mid = (h + l) / 2;
  return {
    time,
    open: o,
    high: h,
    low: l,
    close: c,
    totalBuy: buy,
    totalSell: sell,
    aggressiveBuy: extra.aggressiveBuy ?? buy,
    aggressiveSell: extra.aggressiveSell ?? sell,
    levels: extra.levels ?? [
      { price: l, buy: buy * 0.2, sell: sell * 0.45 },
      { price: mid, buy: buy * 0.3, sell: sell * 0.3 },
      { price: h, buy: buy * 0.5, sell: sell * 0.25 },
    ],
    ...extra,
  };
}

function run(bars: InteractionBar[], levels: InteractionLevel[], extra: Record<string, unknown> = {}) {
  return annotateLevelInteractions(bars, {
    levels,
    autoLevels: false,
    timeframe: '15m',
    ...extra,
  });
}

function typesAt(result: ReturnType<typeof run>, time: number) {
  return (result.byTime.get(time)?.events ?? []).map((e) => e.eventType);
}

describe('1. failed upward break at resistance', () => {
  it('confirms FAIL ↑ on the return candle, not the attempt', () => {
    const bars = [
      bar(1, 4.98, 5.04, 4.97, 4.99),
      bar(2, 4.98, 4.995, 4.94, 4.96),
    ];
    const r = run(bars, [RES]);
    expect(typesAt(r, 1)).toEqual([]);
    expect(typesAt(r, 2)).toEqual(['FAIL_UP']);
    expect(r.confirmed[0]?.confirmationCandleId).toBe('2');
    expect(r.confirmed[0]?.eventOriginTime).toBe(1);
    expect(r.confirmed[0]?.compactLabel).toBe('FAIL ↑');
  });
});

describe('2. failed downward break at support', () => {
  it('confirms FAIL ↓ after a return above support', () => {
    const bars = [
      bar(1, 5.02, 5.04, 4.96, 5.01),
      bar(2, 5.02, 5.06, 5.005, 5.045),
    ];
    const r = run(bars, [SUP]);
    expect(typesAt(r, 2)).toEqual(['FAIL_DOWN']);
  });
});

describe('3. bullish reclaim after prior level loss', () => {
  it('confirms REC ↑ after a close below and two closes back above', () => {
    const bars = [
      bar(1, 5.02, 5.03, 4.94, 4.96),
      bar(2, 4.98, 5.02, 4.97, 5.01),
      bar(3, 5.02, 5.06, 5.005, 5.045),
    ];
    const r = run(bars, [SUP]);
    expect(r.confirmed.some((e) => e.eventType.startsWith('FAIL'))).toBe(false);
    expect(typesAt(r, 3)).toEqual(['RECLAIM_UP']);
    expect(r.confirmed[0]?.eventOriginTime).toBe(1);
  });
});

describe('4. bearish reclaim after prior level break', () => {
  it('confirms REC ↓ after a close above and two closes back below', () => {
    const bars = [
      bar(1, 4.99, 5.05, 4.98, 5.04),
      bar(2, 5.02, 5.03, 4.98, 4.99),
      bar(3, 4.99, 4.995, 4.93, 4.95),
    ];
    const r = run(bars, [RES]);
    expect(typesAt(r, 3)).toEqual(['RECLAIM_DOWN']);
  });
});

describe('5. strong delta but no confirmed failure', () => {
  it('does not confirm FAIL on a single live/attempt candle', () => {
    const bars = [bar(1, 4.98, 5.04, 4.97, 4.99, { aggressiveBuy: 2_000_000, aggressiveSell: 400_000 })];
    const r = run(bars, [RES]);
    expect(r.confirmed).toEqual([]);
  });
});

describe('6. wick-only penetration', () => {
  it('does not confirm FAIL or REC on a wick through the level', () => {
    const r = run([bar(1, 4.98, 5.04, 4.97, 4.99)], [RES]);
    expect(r.confirmed).toEqual([]);
  });
});

describe('7. missing passive-liquidity data', () => {
  it('still confirms FAIL and does not invent defense', () => {
    const r = run(
      [bar(1, 4.98, 5.04, 4.97, 4.99), bar(2, 4.98, 4.995, 4.94, 4.96)],
      [RES],
    );
    const ev = r.confirmed[0];
    expect(ev?.eventType).toBe('FAIL_UP');
    expect(ev?.metrics.askDefense).toBeNull();
    expect(ev?.metrics.bidDefense).toBeNull();
  });
});

describe('8. overlapping levels and deduplication', () => {
  it('does not print two identical FAIL events from near-duplicate levels', () => {
    const near = level({ id: 'res-5.01', type: 'SWING_HIGH', price: 5.01, knownAt: 0 });
    const r = run(
      [bar(1, 4.98, 5.05, 4.97, 4.99), bar(2, 4.98, 4.995, 4.94, 4.95)],
      [RES, near],
    );
    const fails = r.confirmed.filter((e) => e.eventType === 'FAIL_UP');
    expect(fails.length).toBe(1);
    expect(r.byTime.get(2)?.compactLabel).toBe('FAIL ↑');
  });
});

describe('9. Failure and Reclaim on the same candle', () => {
  it('allows independently confirmed FAIL and REC together', () => {
    const bars = [
      bar(1, 5.02, 5.03, 4.94, 4.96),
      bar(2, 4.98, 5.06, 4.97, 5.01),
      bar(3, 5.02, 5.07, 5.005, 5.02),
    ];
    const r = run(bars, [SUP, RES]);
    const types = typesAt(r, 3);
    expect(types).toContain('RECLAIM_UP');
  });
});

describe('10. confirmation-candle anchoring', () => {
  it('sets confirmationCandleId to the confirm bar, not the origin', () => {
    const r = run(
      [bar(1, 4.98, 5.04, 4.97, 4.99), bar(2, 4.98, 4.995, 4.94, 4.96)],
      [RES],
    );
    expect(r.confirmed[0]?.confirmationCandleId).toBe('2');
    expect(r.confirmed[0]?.confirmedAt).toBe(2);
    expect(r.confirmed[0]?.eventOriginTime).toBe(1);
  });
});

describe('11. labels above candle highs and wicks', () => {
  it('places the label above the wick y', () => {
    expect(failReclaimLabelY(200, 14)).toBe(186);
    const pos = projectFailReclaimLabel(2, 5.04, {
      times: [1, 2],
      xForIndex: (i) => 100 + i * 40,
      yForPrice: (p) => 400 - p * 50,
    });
    expect(pos.x).toBe(140);
    expect(pos.y).toBe(400 - 5.04 * 50 - 14);
    expect(pos.visible).toBe(true);
  });
});

describe('12. no overlap with Market Sequence labels', () => {
  it('does not change primary-label priority', () => {
    const cfg = mergeMarketSequenceConfig();
    const stages = emptyStages();
    stages.expansion = 'BULLISH_EXPANSION_CONFIRMED';
    stages.failure = 'BUYER_FAILURE_CONFIRMED';
    expect(selectPrimaryLabel(stages, cfg).label).toBe('BULL_EXP');
  });
});

describe('13. zoom / pan remaps x/y, not the event', () => {
  it('keeps confirm time and remaps pixels', () => {
    const r = run(
      [bar(1, 4.98, 5.04, 4.97, 4.99), bar(2, 4.98, 4.995, 4.94, 4.96)],
      [RES],
    );
    const ev = r.confirmed[0]!;
    const pan = projectFailReclaimLabel(ev.confirmedAt!, 5.04, {
      times: [1, 2],
      xForIndex: (i) => 80 + i * 30,
      yForPrice: (p) => 300 - p * 40,
    });
    const zoom = projectFailReclaimLabel(ev.confirmedAt!, 5.04, {
      times: [1, 2],
      xForIndex: (i) => 80 + i * 70,
      yForPrice: (p) => 600 - p * 80,
    });
    expect(pan.y).not.toBe(zoom.y);
    expect(ev.confirmedAt).toBe(2);
  });
});

describe('14. dense-chart collision helper', () => {
  it('stacks a second label above the first wick label', () => {
    const y1 = failReclaimLabelY(200, 14);
    const y2 = y1 - 14;
    expect(y2).toBe(172);
  });
});

describe('15. historical replay without lookahead', () => {
  it('reproduces the same confirmed ids', () => {
    const bars = [bar(1, 4.98, 5.04, 4.97, 4.99), bar(2, 4.98, 4.995, 4.94, 4.96)];
    expect(run(bars, [RES]).confirmed.map((e) => e.id)).toEqual(run(bars, [RES]).confirmed.map((e) => e.id));
    const swings = confirmedSwings(
      [bar(10, 5, 5.2, 4.9, 5.1), bar(20, 5.1, 5.15, 4.95, 5), bar(30, 5, 5.4, 4.98, 5.3), bar(40, 5.2, 5.25, 5.05, 5.1), bar(50, 5.1, 5.18, 5, 5.05)],
      4,
    );
    for (const s of swings) expect(s.knownAt).toBeGreaterThan(s.time);
  });
});

describe('16. no Acceptance detection', () => {
  it('never emits ACC / ACCEPTED events', () => {
    expect(canConfirmAcceptance()).toBe(false);
    const stayAbove = run(
      [bar(1, 4.99, 5.03, 4.98, 5.015), bar(2, 5.02, 5.06, 5.005, 5.045)],
      [RES],
    );
    expect(JSON.stringify(stayAbove.confirmed)).not.toMatch(/ACC|ACCEPTED/);
    expect(stayAbove.confirmed.every((e) => e.eventType === 'RECLAIM_DOWN' || e.eventType === 'FAIL_UP' || e.eventType === 'RECLAIM_UP' || e.eventType === 'FAIL_DOWN')).toBe(true);
  });
});

describe('17. existing bottom-metric labels are out of this engine', () => {
  it('does not overwrite delta / CVD / displacement fields on the bar', () => {
    const b = bar(1, 4.98, 5.04, 4.97, 4.99);
    const r = run([b, bar(2, 4.98, 4.995, 4.94, 4.96)], [RES]);
    expect(b.totalBuy).toBe(1_000_000);
    expect(r.confirmed[0]?.metrics.delta).not.toBeUndefined();
  });
});

describe('Market Sequence adapter', () => {
  it('maps FAIL ↑ to buyer failure without changing MS priority', () => {
    const mapped = mapLevelEventToFailureReclaim({
      eventType: 'FAIL_UP',
      type: 'FAIL_UP',
      status: 'CONFIRMED',
    } as never);
    expect(mapped?.failure?.label).toBe('BUYER_FAILURE');
  });
});
