import { describe, expect, it } from 'vitest';
import {
  LocationContextEngine,
  applyLevelOutcomes,
  evaluateLocationContext,
  flipBrokenLevel,
  locationTraderLabel,
  DEFAULT_LOCATION_CONTEXT_CONFIG,
} from '../src/location-context/index.js';
import type { LocationBarLike, LocationContextConfig } from '../src/location-context/index.js';

const CFG: LocationContextConfig = {
  ...DEFAULT_LOCATION_CONTEXT_CONFIG,
  atLevelMaxBps: 3,
  nearLevelMaxBps: 10,
  atAtrFraction: 0,
  nearAtrFraction: 0,
  minAtBps: 3,
  minNearBps: 10,
};

function bar(partial: Partial<LocationBarLike> & { time: number }): LocationBarLike {
  const close = partial.close ?? 100;
  return {
    open: partial.open ?? close,
    high: partial.high ?? close,
    low: partial.low ?? close,
    close,
    totalBuy: partial.totalBuy ?? 10_000,
    totalSell: partial.totalSell ?? 10_000,
    ...partial,
  };
}

function structurePrior(): LocationBarLike[] {
  const seq: Array<[number, number, number, number]> = [
    [100, 100.2, 99.9, 100.1],
    [100.1, 100.3, 100.0, 100.2],
    [100.2, 100.25, 99.0, 99.2],
    [99.2, 99.5, 99.1, 99.4],
    [99.4, 99.8, 99.3, 99.7],
    [99.7, 100.2, 99.6, 100.0],
    [100.0, 100.4, 99.9, 100.3],
    [100.3, 101.2, 100.2, 101.0],
    [101.0, 101.1, 100.5, 100.6],
    [100.6, 100.7, 100.2, 100.4],
    [100.4, 100.5, 100.1, 100.3],
    [100.3, 100.4, 100.0, 100.2],
  ];
  return seq.map(([o, h, l, c], i) => bar({ time: i + 1, open: o, high: h, low: l, close: c }));
}

describe('location context', () => {
  it('exact support touch → AT_SUPPORT with wick contact', () => {
    const support = 99;
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({
        time: 100,
        open: support + 0.4,
        high: support + 0.5,
        low: support + 0.01,
        close: support + 0.35,
      }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 5 }],
    });
    expect(snap.locationContext).toBe('AT_SUPPORT');
    expect(['WICK_TOUCH', 'BODY_TOUCH', 'CLOSE_AT_LEVEL', 'NEAR_TOUCH']).toContain(snap.contactType);
    expect(locationTraderLabel(snap.locationContext)).toBe('AT SUPPORT');
  });

  it('near support by bps distance', () => {
    const support = 5.3;
    const close = 5.318;
    const snap = evaluateLocationContext({
      symbol: 'NEARUSDT',
      prior: [],
      bar: bar({ time: 100, open: 5.32, high: 5.33, low: 5.315, close }),
      config: { ...CFG, nearLevelMaxBps: 40, atLevelMaxBps: 5, minNearBps: 40, minAtBps: 5 },
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    expect(snap.locationContext).toBe('NEAR_SUPPORT');
    expect(snap.distanceToSupportBps).toBeGreaterThan(5);
    expect(snap.distanceToSupportBps!).toBeLessThanOrEqual(40);
  });

  it('exact resistance wick touch → AT_RESISTANCE', () => {
    const resistance = 5.5;
    const snap = evaluateLocationContext({
      symbol: 'NEARUSDT',
      prior: [],
      bar: bar({ time: 100, open: 5.48, high: 5.503, low: 5.47, close: 5.474 }),
      config: CFG,
      externalLevels: [{ price: resistance, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 85, knownAt: 1 }],
    });
    expect(snap.locationContext).toBe('AT_RESISTANCE');
    expect(snap.contactType).toBe('WICK_TOUCH');
    expect(snap.wickContact).toBe(true);
  });

  it('between levels when far from both', () => {
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 100.2, high: 100.25, low: 100.15, close: 100.2 }),
      config: CFG,
      externalLevels: [
        { price: 99.0, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 },
        { price: 101.2, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 },
      ],
    });
    expect(snap.locationContext).toBe('BETWEEN_LEVELS');
    expect(snap.contactType).toBe('NO_TOUCH');
  });

  it('body touch vs close through', () => {
    const resistance = 100;
    const body = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 99.9, high: 100.05, low: 99.8, close: 100.02 }),
      config: CFG,
      externalLevels: [{ price: resistance, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    expect(['BODY_TOUCH', 'CLOSE_AT_LEVEL', 'CLOSE_THROUGH_LEVEL', 'WICK_TOUCH']).toContain(body.contactType);

    const through = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 101, open: 99.9, high: 100.4, low: 99.85, close: 100.35 }),
      config: CFG,
      externalLevels: [{ price: resistance, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    expect(through.contactType).toBe('CLOSE_THROUGH_LEVEL');
    expect(through.closeThroughLevel).toBe(true);
  });

  it('support holding vs breaking with reaction hints', () => {
    const support = 100;
    const hold = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 100.2, high: 100.3, low: 99.98, close: 100.15 }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
      reaction: { sellEffort: 88, buyerDefense: 90, downResult: 18 },
    });
    expect(hold.supportState).toBe('SUPPORT_HOLDING');

    const breaking = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 101, open: 100.1, high: 100.15, low: 99.7, close: 99.75 }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
      reaction: { sellEffort: 90, buyerDefense: 20, downResult: 80 },
    });
    expect(['SUPPORT_BREAKING', 'SUPPORT_BROKEN']).toContain(breaking.supportState);
  });

  it('resistance holding vs breaking', () => {
    const resistance = 100;
    const hold = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 99.8, high: 100.05, low: 99.7, close: 99.85 }),
      config: CFG,
      externalLevels: [{ price: resistance, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
      reaction: { buyEffort: 86, sellerDefense: 88, upResult: 16 },
    });
    expect(hold.resistanceState).toBe('RESISTANCE_HOLDING');

    const broken = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 101, open: 99.9, high: 100.5, low: 99.85, close: 100.4 }),
      config: CFG,
      externalLevels: [{ price: resistance, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
      reaction: { buyEffort: 90, sellerDefense: 18, upResult: 82 },
    });
    expect(['RESISTANCE_BREAKING', 'RESISTANCE_BROKEN']).toContain(broken.resistanceState);
  });

  it('level flip after break', () => {
    const level = {
      id: 'R1',
      type: 'RESISTANCE' as const,
      price: 100,
      source: 'SWING_PIVOT' as const,
      strength: 80,
      confidence: 70,
      relevance: 70,
      createdAt: 1,
      levelKnownAt: 1,
      lastTestedAt: null,
      testCount: 2,
      state: 'ACTIVE' as const,
      touches: 2,
      components: {
        swingSignificance: 70,
        reactionCount: 40,
        recency: 70,
        volumeActivity: 0,
        wallStrength: null,
      },
    };
    const broken = applyLevelOutcomes(
      [level],
      bar({ time: 10, open: 99.9, high: 100.5, low: 99.8, close: 100.4 }),
      3,
    );
    expect(broken[0]!.state).toBe('BROKEN');
    const flipped = flipBrokenLevel(broken[0]!, 10);
    expect(flipped?.type).toBe('SUPPORT');
    expect(flipped?.source).toBe('FLIPPED');
    expect(flipped?.state).toBe('FLIPPED');
  });

  it('multiple nearby levels: nearest vs strongest', () => {
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 100.2, high: 100.25, low: 100.1, close: 100.2 }),
      config: { ...CFG, nearLevelMaxBps: 50, minNearBps: 50 },
      externalLevels: [
        { price: 100.35, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 61, knownAt: 1 },
        { price: 100.5, type: 'RESISTANCE', source: 'PASSIVE_WALL', strength: 88, knownAt: 1 },
      ],
    });
    expect(snap.nearestResistance?.price).toBe(100.35);
    expect(snap.strongestNearbyResistance?.price).toBe(100.5);
  });

  it('volatility-adjusted thresholds expand with ATR', () => {
    const prior = structurePrior().map((b, i) =>
      bar({ ...b, time: i + 1, high: b.close + 2, low: b.close - 2 }),
    );
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior,
      bar: bar({ time: 100, open: 100, high: 100.5, low: 99.5, close: 100 }),
      config: {
        ...DEFAULT_LOCATION_CONTEXT_CONFIG,
        atLevelMaxBps: 3,
        nearLevelMaxBps: 10,
        atAtrFraction: 0.5,
        nearAtrFraction: 1.2,
        minAtBps: 3,
        minNearBps: 10,
      },
      externalLevels: [{ price: 100.2, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 70, knownAt: 1 }],
    });
    expect(snap.effectiveAtBps).toBeGreaterThan(3);
    expect(snap.effectiveNearBps).toBeGreaterThan(snap.effectiveAtBps);
  });

  it('no lookahead: current bar cannot create the level it tests', () => {
    const prior = structurePrior();
    const futureHigh = 110;
    const attack = bar({ time: 100, open: 100, high: 100.2, low: 99.9, close: 100.1 });
    const a = evaluateLocationContext({ symbol: 'BTCUSDT', prior, bar: attack, config: CFG });
    const b = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [...prior, bar({ time: 101, open: 100, high: futureHigh, low: 99.9, close: futureHigh - 0.1 })],
      bar: attack,
      config: CFG,
    });
    expect(a.nearestResistance?.price).not.toBe(futureHigh);
    expect(b.nearestResistance?.price).not.toBe(futureHigh);
  });

  it('pivot knownAt is after confirmation neighbor, not at pivot print', () => {
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: structurePrior(),
      bar: bar({ time: 100, open: 100.2, high: 100.3, low: 100.1, close: 100.2 }),
      config: CFG,
    });
    for (const level of snap.levels.filter((l) => l.source === 'SWING_PIVOT')) {
      expect(level.levelKnownAt).toBeGreaterThan(level.createdAt);
    }
  });

  it('symbol isolation: separate evaluates do not share state', () => {
    const engine = new LocationContextEngine();
    const a = engine.evaluate({
      symbol: 'AAA',
      prior: [],
      bar: bar({ time: 100, open: 100, high: 100.1, low: 99.0, close: 99.2 }),
      config: CFG,
      externalLevels: [{ price: 99.0, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 90, knownAt: 1 }],
    });
    const b = engine.evaluate({
      symbol: 'BBB',
      prior: [],
      bar: bar({ time: 100, open: 100, high: 101.0, low: 99.9, close: 100.8 }),
      config: CFG,
      externalLevels: [{ price: 101.0, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 90, knownAt: 1 }],
    });
    expect(a.symbol).toBe('AAA');
    expect(b.symbol).toBe('BBB');
    expect(a.locationContext).toBe('AT_SUPPORT');
    expect(b.locationContext).toBe('AT_RESISTANCE');
  });

  it('insufficient data → UNKNOWN', () => {
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 1, open: 100, high: 100.1, low: 99.9, close: 100 }),
      config: CFG,
    });
    expect(snap.locationContext).toBe('UNKNOWN');
    expect(snap.dataQuality).toBe('INSUFFICIENT_DATA');
  });

  it('location alone does not imply direction', () => {
    const snap = evaluateLocationContext({
      symbol: 'BTCUSDT',
      prior: [],
      bar: bar({ time: 100, open: 99.2, high: 99.4, low: 99.01, close: 99.3 }),
      config: CFG,
      externalLevels: [{ price: 99.0, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 90, knownAt: 1 }],
    });
    expect(snap.locationContext).toBe('AT_SUPPORT');
    expect(snap.supportState === 'NONE' || snap.supportState === 'SUPPORT_HOLDING').toBe(true);
  });
});
