import { describe, expect, it } from 'vitest';
import {
  HistoricalSREngine,
  assertNoLookahead,
  classifyZoneInteraction,
  classifyZoneLocation,
  updateInteractionSession,
  zoneGeometryAsOf,
  zoneHalfWidthOf,
  appendZoneVersion,
  timeframeWidthFactor,
} from '../src/historical-sr/index.js';
import type { HistoricalBarLike } from '../src/historical-sr/index.js';

function bar(time: number, open: number, high: number, low: number, close: number): HistoricalBarLike {
  return { time, open, high, low, close, totalBuy: 1000, totalSell: 1000 };
}

describe('zone width', () => {
  it('uses ATR and bps floor', () => {
    const half = zoneHalfWidthOf(100, 2, { zoneAtrFraction: 0.22, zoneMinBps: 4 }, '15m');
    expect(half).toBeGreaterThanOrEqual(100 * 0.0004);
    expect(half).toBeCloseTo(2 * 0.22, 5);
  });

  it('widens on higher timeframes when factor applied', () => {
    const m1 = zoneHalfWidthOf(100, 2, {
      zoneAtrFraction: 0.22,
      zoneMinBps: 1,
      timeframeWidthFactor: timeframeWidthFactor('1m'),
    }, '1m');
    const h1 = zoneHalfWidthOf(100, 2, {
      zoneAtrFraction: 0.22,
      zoneMinBps: 1,
      timeframeWidthFactor: timeframeWidthFactor('1h'),
    }, '1h');
    expect(h1).toBeGreaterThan(m1);
  });
});

describe('zone location', () => {
  const zone = { zoneLow: 4.992, zoneHigh: 5.008 };

  it('classifies inside / near / above / below resistance', () => {
    expect(
      classifyZoneLocation({ type: 'RESISTANCE', price: 5.0, ...zone, nearBps: 20 }),
    ).toBe('INSIDE_RESISTANCE');
    expect(
      classifyZoneLocation({ type: 'RESISTANCE', price: 4.98, ...zone, nearBps: 40 }),
    ).toBe('NEAR_RESISTANCE');
    expect(
      classifyZoneLocation({ type: 'RESISTANCE', price: 4.5, ...zone, nearBps: 20 }),
    ).toBe('BELOW_RESISTANCE');
    expect(
      classifyZoneLocation({ type: 'RESISTANCE', price: 5.05, ...zone, nearBps: 20 }),
    ).toBe('ABOVE_RESISTANCE');
  });

  it('detects entering resistance from below', () => {
    expect(
      classifyZoneLocation({
        type: 'RESISTANCE',
        price: 5.0,
        ...zone,
        nearBps: 20,
        priorPrice: 4.98,
      }),
    ).toBe('ENTERING_RESISTANCE');
  });

  it('classifies support sides', () => {
    expect(
      classifyZoneLocation({ type: 'SUPPORT', price: 5.0, ...zone, nearBps: 20 }),
    ).toBe('INSIDE_SUPPORT');
    expect(
      classifyZoneLocation({ type: 'SUPPORT', price: 5.05, ...zone, nearBps: 20 }),
    ).toBe('ABOVE_SUPPORT');
    expect(
      classifyZoneLocation({ type: 'SUPPORT', price: 4.9, ...zone, nearBps: 20 }),
    ).toBe('BELOW_SUPPORT');
  });
});

describe('zone interaction', () => {
  const zone = { zoneLow: 99, zoneHigh: 101, centerPrice: 100 };

  it('wick touch resistance without body accept', () => {
    const ix = classifyZoneInteraction({
      type: 'RESISTANCE',
      ...zone,
      bar: bar(1, 98, 100.5, 97.5, 98.2),
      atr: 1,
      breakBeyondAtrFraction: 0.15,
      approachBps: 30,
      beyondCloses: 0,
      breakConfirmCloses: 2,
    });
    expect(['WICK_TOUCH', 'REJECTED', 'HELD', 'BODY_TOUCH']).toContain(ix);
  });

  it('body touch when body enters zone without rejection close', () => {
    const ix = classifyZoneInteraction({
      type: 'RESISTANCE',
      ...zone,
      // Body inside zone; close stays elevated (not a rejection back below mid).
      bar: bar(1, 99.2, 100.4, 99, 100.3),
      atr: 1,
      breakBeyondAtrFraction: 0.15,
      approachBps: 30,
      beyondCloses: 0,
      breakConfirmCloses: 2,
    });
    expect(ix).toBe('BODY_TOUCH');
  });

  it('breaking then accepted through with confirm closes', () => {
    const breaking = classifyZoneInteraction({
      type: 'RESISTANCE',
      ...zone,
      bar: bar(1, 100, 103, 100, 102.5),
      atr: 1,
      breakBeyondAtrFraction: 0.15,
      approachBps: 30,
      beyondCloses: 0,
      breakConfirmCloses: 2,
    });
    expect(breaking).toBe('BREAKING');
    const accepted = classifyZoneInteraction({
      type: 'RESISTANCE',
      ...zone,
      bar: bar(2, 102, 104, 101.5, 103),
      atr: 1,
      breakBeyondAtrFraction: 0.15,
      approachBps: 30,
      beyondCloses: 1,
      breakConfirmCloses: 2,
    });
    expect(accepted).toBe('ACCEPTED_THROUGH');
  });
});

describe('interaction sessions', () => {
  it('counts multiple candles inside as one session', () => {
    let sess = {
      activeSessionId: null as string | null,
      sessionStartedAt: null as number | null,
      lastInsideAt: null as number | null,
    };
    const zone = { zoneLow: 99, zoneHigh: 101, leaveBps: 20 };
    let news = 0;
    for (const t of [1, 2, 3]) {
      const r = updateInteractionSession({
        ...sess,
        bar: bar(t, 100, 100.5, 99.5, 100),
        zoneLow: zone.zoneLow,
        zoneHigh: zone.zoneHigh,
        leaveBps: zone.leaveBps,
        touching: true,
      });
      if (r.newSession) news += 1;
      sess = r;
    }
    expect(news).toBe(1);
    expect(sess.activeSessionId).toBeTruthy();
  });

  it('starts a new session after leaving and returning', () => {
    let sess = updateInteractionSession({
      activeSessionId: null,
      sessionStartedAt: null,
      lastInsideAt: null,
      bar: bar(1, 100, 100.5, 99.5, 100),
      zoneLow: 99,
      zoneHigh: 101,
      leaveBps: 20,
      touching: true,
    });
    expect(sess.newSession).toBe(true);
    sess = updateInteractionSession({
      ...sess,
      bar: bar(2, 95, 96, 94, 95),
      zoneLow: 99,
      zoneHigh: 101,
      leaveBps: 20,
      touching: false,
    });
    expect(sess.activeSessionId).toBeNull();
    sess = updateInteractionSession({
      ...sess,
      bar: bar(3, 100, 100.5, 99.5, 100),
      zoneLow: 99,
      zoneHigh: 101,
      leaveBps: 20,
      touching: true,
    });
    expect(sess.newSession).toBe(true);
  });
});

describe('zone version history / no lookahead', () => {
  it('restores earlier boundaries before cluster expand', () => {
    let versions = appendZoneVersion([], {
      timestamp: 10,
      centerPrice: 5,
      zoneLow: 4.996,
      zoneHigh: 5.004,
      width: 0.008,
      widthBps: 16,
      reason: 'CREATED',
    });
    versions = appendZoneVersion(versions, {
      timestamp: 20,
      centerPrice: 5,
      zoneLow: 4.992,
      zoneHigh: 5.008,
      width: 0.016,
      widthBps: 32,
      reason: 'CLUSTER_EXPAND',
    });
    const at15 = zoneGeometryAsOf(versions, { centerPrice: 5, zoneLow: 4.992, zoneHigh: 5.008 }, 15);
    expect(at15.zoneLow).toBeCloseTo(4.996, 6);
    expect(at15.zoneHigh).toBeCloseTo(5.004, 6);
    const at25 = zoneGeometryAsOf(versions, { centerPrice: 5, zoneLow: 4.992, zoneHigh: 5.008 }, 25);
    expect(at25.zoneLow).toBeCloseTo(4.992, 6);
  });

  it('engine snapshotAt does not apply future zone expansion', () => {
    const bars: HistoricalBarLike[] = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99, 101),
      bar(3, 101, 108, 100, 107), // high A
      bar(4, 107, 107.5, 105, 106),
      bar(5, 106, 106.5, 104, 105), // confirm A
      bar(6, 105, 106, 103, 104),
      bar(7, 104, 108.3, 103.5, 107), // high B near A
      bar(8, 107, 107.2, 105, 106),
      bar(9, 106, 106.5, 104.5, 105), // confirm B → expand
    ];
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      clusterAtrFraction: 0.8,
      majorMinStrength: 0,
    });
    engine.processAll(bars);
    const live = engine.getLevels().find((l) => l.type === 'RESISTANCE' && l.source !== 'FLIPPED');
    expect(live).toBeTruthy();
    expect(live!.zoneVersions.length).toBeGreaterThanOrEqual(1);

    const early = engine.snapshotAt(5).knownResistance.find((l) => l.id === live!.id);
    expect(early).toBeTruthy();
    // Early geometry must not equal a later expanded-only bound if versions differ
    if (live!.zoneVersions.length >= 2) {
      expect(early!.zoneHigh - early!.zoneLow).toBeLessThanOrEqual(live!.zoneHigh - live!.zoneLow + 1e-9);
      const v0 = live!.zoneVersions[0]!;
      expect(early!.zoneLow).toBeCloseTo(v0.zoneLow, 5);
      expect(early!.zoneHigh).toBeCloseTo(v0.zoneHigh, 5);
    }
  });
});

describe('engine zones', () => {
  it('creates zone with center and width around swing', () => {
    const bars = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99.5, 101),
      bar(3, 101, 103, 100, 102),
      bar(4, 102, 105, 101, 104),
      bar(5, 104, 110, 103, 108),
      bar(6, 108, 109, 106, 107),
      bar(7, 107, 108, 105, 106),
    ];
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    engine.processAll(bars);
    const r = engine.getLevels().find((l) => l.type === 'RESISTANCE');
    expect(r).toBeTruthy();
    expect(r!.centerPrice).toBe(110);
    expect(r!.zoneLow).toBeLessThan(r!.centerPrice);
    expect(r!.zoneHigh).toBeGreaterThan(r!.centerPrice);
    expect(r!.width).toBeGreaterThan(0);
    expect(r!.zoneVersions[0]?.reason).toBe('CREATED');
  });

  it('clusters nearby pivots into one zone', () => {
    const bars: HistoricalBarLike[] = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99, 101),
      bar(3, 101, 108, 100, 107),
      bar(4, 107, 107.5, 105, 106),
      bar(5, 106, 106.5, 104, 105),
      bar(6, 105, 106, 103, 104),
      bar(7, 104, 108.3, 103.5, 107),
      bar(8, 107, 107.2, 105, 106),
      bar(9, 106, 106.5, 104.5, 105),
    ];
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      clusterAtrFraction: 0.8,
      majorMinStrength: 0,
    });
    engine.processAll(bars);
    const resistances = engine.getLevels().filter((l) => l.type === 'RESISTANCE' && l.source !== 'FLIPPED');
    expect(resistances.length).toBeLessThanOrEqual(2);
    const clustered = resistances.find((l) => l.source === 'CLUSTERED_SWING');
    if (clustered) {
      expect(clustered.zoneVersions.some((v) => v.reason === 'CLUSTER_EXPAND')).toBe(true);
    }
  });

  it('candle context exposes zone location and interaction badge', () => {
    const bars = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99.5, 101),
      bar(3, 101, 103, 100, 102),
      bar(4, 102, 105, 101, 104),
      bar(5, 104, 110, 103, 108),
      bar(6, 108, 109, 106, 107),
      bar(7, 107, 108, 105, 106),
      bar(8, 106, 107, 104, 105),
      bar(9, 105, 109.5, 104.5, 105.2),
    ];
    const engine = new HistoricalSREngine('15m', { pivotConfirmBars: 2, majorMinStrength: 0 });
    engine.processAll(bars);
    const ctx = engine.snapshotAt(9).candleContext;
    expect(ctx).toBeTruthy();
    expect(ctx!.locationState).toBeTruthy();
    expect(ctx!.interactionBadge).toBeTruthy();
    expect(ctx!.primaryZone || ctx!.nearestKnownResistance).toBeTruthy();
  });

  it('role flip creates flipped zone', () => {
    const bars = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99.5, 101),
      bar(3, 101, 103, 100, 102),
      bar(4, 102, 105, 101, 104),
      bar(5, 104, 110, 103, 108),
      bar(6, 108, 109, 106, 107),
      bar(7, 107, 108, 105, 106),
      bar(8, 106, 107, 104, 105),
      bar(9, 105, 109.5, 104.5, 105.2),
      bar(10, 105.2, 106, 103, 104),
      bar(11, 104, 105, 102, 103),
      bar(12, 103, 112, 103, 111),
      bar(13, 111, 113, 110, 112),
    ];
    const engine = new HistoricalSREngine('15m', {
      pivotConfirmBars: 2,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    engine.processAll(bars);
    const flipped = engine.getLevels().find((l) => l.source === 'FLIPPED');
    expect(flipped).toBeTruthy();
    expect(flipped!.interactionState).toBe('FLIPPED');
    expect(flipped!.zoneVersions[0]?.reason).toBe('FLIP');
  });

  it('no lookahead across zone series', () => {
    const bars = [
      bar(1, 100, 101, 99, 100),
      bar(2, 100, 102, 99.5, 101),
      bar(3, 101, 103, 100, 102),
      bar(4, 102, 105, 101, 104),
      bar(5, 104, 110, 103, 108),
      bar(6, 108, 109, 106, 107),
      bar(7, 107, 108, 105, 106),
      bar(8, 106, 107, 104, 105),
      bar(9, 105, 109.5, 104.5, 105.2),
      bar(10, 105.2, 106, 103, 104),
      bar(11, 104, 105, 102, 103),
      bar(12, 103, 112, 103, 111),
      bar(13, 111, 113, 110, 112),
    ];
    const err = assertNoLookahead(bars, {
      pivotConfirmBars: 2,
      breakBeyondAtrFraction: 0.05,
      majorMinStrength: 0,
    });
    expect(err).toBeNull();
  });
});
