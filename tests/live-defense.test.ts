import { describe, expect, it } from 'vitest';
import {
  selectLiveDefense,
  evaluateStructureDefense,
  emptyLiveDefense,
  DEFAULT_LIVE_DEFENSE_CONFIG,
} from '../src/live-defense/index.js';
import { evaluateLocationContext, DEFAULT_LOCATION_CONTEXT_CONFIG } from '../src/location-context/index.js';
import type { LocationBarLike } from '../src/location-context/index.js';
import { emptyLevelWallMap, type LevelStrengthRow, type LevelWallMap } from '../src/models/level-strength.js';
import { observedMetric } from '../src/models/level-strength.js';

function metric(v: number) {
  return observedMetric(v);
}

function row(partial: Partial<LevelStrengthRow> & { price: number; side: 'ASK' | 'BID' }): LevelStrengthRow {
  const strength = partial.strength ?? 70;
  return {
    price: partial.price,
    side: partial.side,
    significance: 'SIGNIFICANT',
    initialSize: 100,
    currentSize: partial.currentSize ?? 100,
    newAdded: 0,
    replenished: 0,
    consumed: 0,
    cancelled: 0,
    survivalRatio: 0.8,
    survival: metric(80),
    survivalState: 'HOLDING',
    persistenceMs: 12_000,
    snapshotCount: 5,
    distanceBps: partial.distanceBps ?? 10,
    distanceBand: 'NEAR_TOUCH',
    depthScore: metric(50),
    nearTouchScore: metric(80),
    replenishmentScore: metric(40),
    survivalScore: metric(80),
    persistenceScore: metric(60),
    reliabilityScore: metric(70),
    cancellationScore: metric(30),
    consumptionScore: metric(20),
    withdrawalScore: metric(10),
    netConsumptionPressure: metric(15),
    strength,
    strengthConfidence: partial.strengthConfidence ?? 70,
    rankingScore: strength,
    relevance: partial.relevance ?? strength * 0.8,
    wallMaturity: partial.wallMaturity ?? 'MATURE',
    reliability: 'RELIABLE',
    state: partial.state ?? 'ACTIVE',
    lifecycle: 'RESTING',
    battleState: 'IDLE',
    trend: partial.trend ?? 'STABLE',
    strengthVelocity: 0,
    strengthAcceleration: 0,
    history: [strength],
    accountingMismatch: false,
    reconciliationError: 0,
    dataQuality: partial.dataQuality ?? 'GOOD',
    lastUpdatedAt: 1,
    attacked: partial.attacked ?? false,
    componentsUsed: 5,
    componentsAvailable: 5,
    ...partial,
  } as LevelStrengthRow;
}

function mapWith(asks: LevelStrengthRow[], bids: LevelStrengthRow[]): LevelWallMap {
  const base = emptyLevelWallMap('TEST', 1, 100);
  return {
    ...base,
    dataQuality: 'GOOD',
    currentPrice: 100,
    asks,
    bids,
    strongestRelevantAsk: asks[0]
      ? {
          price: asks[0].price,
          strength: asks[0].strength,
          strengthConfidence: asks[0].strengthConfidence,
          rankingScore: asks[0].rankingScore,
          state: asks[0].state,
          distanceBps: asks[0].distanceBps,
          relevance: asks[0].relevance,
          wallMaturity: asks[0].wallMaturity,
          trend: asks[0].trend,
        }
      : null,
    strongestRelevantBid: bids[0]
      ? {
          price: bids[0].price,
          strength: bids[0].strength,
          strengthConfidence: bids[0].strengthConfidence,
          rankingScore: bids[0].rankingScore,
          state: bids[0].state,
          distanceBps: bids[0].distanceBps,
          relevance: bids[0].relevance,
          wallMaturity: bids[0].wallMaturity,
          trend: bids[0].trend,
        }
      : null,
  };
}

describe('selectLiveDefense', () => {
  it('picks nearest relevant ask above price by score not raw size', () => {
    const hugeFar = row({
      price: 110,
      side: 'ASK',
      currentSize: 10_000,
      strength: 56,
      strengthConfidence: 55,
      distanceBps: 70,
      relevance: 30,
    });
    const nearStrong = row({
      price: 100.5,
      side: 'ASK',
      currentSize: 200,
      strength: 78,
      strengthConfidence: 80,
      distanceBps: 8,
      relevance: 85,
    });
    const { ask } = selectLiveDefense(mapWith([hugeFar, nearStrong], []));
    expect(ask?.price).toBe(100.5);
  });

  it('picks nearest relevant bid below price', () => {
    const { bid } = selectLiveDefense(
      mapWith(
        [],
        [
          row({ price: 99.5, side: 'BID', strength: 81, distanceBps: 5, relevance: 90 }),
          row({ price: 95, side: 'BID', strength: 90, distanceBps: 50, relevance: 40 }),
        ],
      ),
    );
    expect(bid?.price).toBe(99.5);
  });

  it('excludes weak walls below min strength/confidence', () => {
    const { ask, bid } = selectLiveDefense(
      mapWith(
        [row({ price: 101, side: 'ASK', strength: 40, strengthConfidence: 40, relevance: 20 })],
        [row({ price: 99, side: 'BID', strength: 40, strengthConfidence: 40, relevance: 20 })],
      ),
      { minStrength: 55, minConfidence: 50 },
    );
    expect(ask).toBeNull();
    expect(bid).toBeNull();
  });

  it('excludes stale / broken walls', () => {
    const { ask } = selectLiveDefense(
      mapWith(
        [
          row({ price: 101, side: 'ASK', strength: 80, state: 'BROKEN', relevance: 90 }),
          row({ price: 101.2, side: 'ASK', strength: 80, dataQuality: 'STALE', relevance: 90 }),
        ],
        [],
      ),
    );
    expect(ask).toBeNull();
  });

  it('returns none when wall map is stale', () => {
    const m = mapWith([row({ price: 101, side: 'ASK' })], []);
    m.dataQuality = 'STALE';
    const { ask } = selectLiveDefense(m);
    expect(ask).toBeNull();
  });
});

describe('alignment + confluence', () => {
  it('detects LIVE_BID_AT_SUPPORT', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 100,
      wallMap: mapWith([], [row({ price: 99.9, side: 'BID', strength: 84, distanceBps: 4, relevance: 90 })]),
      nearestSupport: { price: 99.85, strength: 80 },
      locationState: 'NEAR_SUPPORT',
      sellAttack: 70,
      downResult: 30,
      sellersAbsorbed: true,
    });
    expect(snap.alignment.bidAtSupport).toBe(true);
    expect(['SUPPORT_ACTIVELY_DEFENDED', 'SELLERS_TESTING_SUPPORT', 'LIVE_BID_AT_SUPPORT']).toContain(
      snap.interpretation,
    );
    expect(snap.alignment.confluenceState).not.toBe('NONE');
  });

  it('detects LIVE_ASK_AT_RESISTANCE', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 100,
      wallMap: mapWith([row({ price: 100.1, side: 'ASK', strength: 88, distanceBps: 4, relevance: 92 })], []),
      nearestResistance: { price: 100.12, strength: 82 },
      locationState: 'AT_RESISTANCE',
      buyAttack: 75,
      upResult: 25,
      buyersAbsorbed: true,
    });
    expect(snap.alignment.askAtResistance).toBe(true);
  });

  it('live wall far from structure is not aligned', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 100,
      wallMap: mapWith([], [row({ price: 98, side: 'BID', strength: 80, distanceBps: 20, relevance: 70 })]),
      nearestSupport: { price: 95, strength: 80 },
      locationState: 'ABOVE_SUPPORT',
      config: { alignmentMaxBps: 12 },
    });
    expect(snap.alignment.bidAtSupport).toBe(false);
  });

  it('support breaking when bid weak and sell attack strong', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 99.5,
      wallMap: mapWith([], [row({ price: 99.4, side: 'BID', strength: 32, trend: 'WEAKENING', distanceBps: 5, relevance: 40 })]),
      nearestSupport: { price: 99.5, strength: 70 },
      locationState: 'NEAR_SUPPORT',
      sellAttack: 82,
      downResult: 70,
      config: { minStrength: 30, minConfidence: 40 },
    });
    expect(snap.interpretation).toBe('SUPPORT_BREAKING');
  });

  it('resistance hold when ask strong vs buy attack', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 100,
      wallMap: mapWith(
        [row({ price: 100.05, side: 'ASK', strength: 88, trend: 'STRENGTHENING', distanceBps: 3, relevance: 95 })],
        [],
      ),
      nearestResistance: { price: 100.05, strength: 80 },
      locationState: 'AT_RESISTANCE',
      buyAttack: 84,
      upResult: 28,
      buyersAbsorbed: true,
    });
    expect(snap.interpretation).toBe('RESISTANCE_ACTIVELY_DEFENDED');
  });
});

describe('no cross-contamination', () => {
  it('live defense does not invent historical levels', () => {
    const snap = evaluateStructureDefense({
      timestamp: 1,
      currentPrice: 100,
      wallMap: mapWith([row({ price: 101, side: 'ASK', strength: 90 })], [row({ price: 99, side: 'BID', strength: 90 })]),
      nearestSupport: null,
      nearestResistance: null,
      locationState: 'NONE',
    });
    expect(snap.relevantAsk).toBeTruthy();
    expect(snap.relevantBid).toBeTruthy();
    expect(snap.alignment.bidAtSupport).toBe(false);
    expect(snap.alignment.askAtResistance).toBe(false);
  });

  it('emptyLiveDefense has no walls', () => {
    expect(emptyLiveDefense().relevantAsk).toBeNull();
    expect(DEFAULT_LIVE_DEFENSE_CONFIG.minStrength).toBeGreaterThan(0);
  });
});

describe('location: current vs candle interaction', () => {
  const CFG = {
    ...DEFAULT_LOCATION_CONTEXT_CONFIG,
    atLevelMaxBps: 3,
    nearLevelMaxBps: 10,
    atAtrFraction: 0,
    nearAtrFraction: 0,
    minAtBps: 3,
    minNearBps: 10,
  };

  function bar(partial: Partial<LocationBarLike> & { time: number; close: number }): LocationBarLike {
    return {
      open: partial.open ?? partial.close,
      high: partial.high ?? partial.close,
      low: partial.low ?? partial.close,
      totalBuy: 1000,
      totalSell: 1000,
      ...partial,
    };
  }

  it('wick touch does not force AT_SUPPORT when close is above', () => {
    const support = 99;
    const snap = evaluateLocationContext({
      symbol: 'T',
      prior: [],
      bar: bar({
        time: 100,
        open: 100,
        high: 100.2,
        low: support - 0.01,
        close: 100.05,
      }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    // Close clearly above → ABOVE_SUPPORT or NEAR_SUPPORT, not AT from wick alone
    expect(['ABOVE_SUPPORT', 'NEAR_SUPPORT', 'BETWEEN_LEVELS']).toContain(snap.locationContext);
    expect(snap.locationContext).not.toBe('BELOW_SUPPORT');
    // Candle may still record touch
    expect(['TOUCHED_SUPPORT', 'WICK_THROUGH_SUPPORT', 'APPROACHED', 'NONE']).toContain(snap.candleInteraction);
  });

  it('close inside zone → AT_SUPPORT (inside alias)', () => {
    const support = 100;
    const snap = evaluateLocationContext({
      symbol: 'T',
      prior: [],
      bar: bar({ time: 100, open: 100, high: 100.05, low: 99.98, close: 100.01 }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    expect(['AT_SUPPORT', 'INSIDE_SUPPORT', 'NEAR_SUPPORT']).toContain(snap.locationContext);
  });

  it('close below support → BELOW_SUPPORT', () => {
    const support = 100;
    const snap = evaluateLocationContext({
      symbol: 'T',
      prior: [],
      bar: bar({ time: 100, open: 99.5, high: 99.6, low: 99.2, close: 99.3 }),
      config: CFG,
      externalLevels: [{ price: support, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 }],
    });
    expect(snap.locationContext).toBe('BELOW_SUPPORT');
  });

  it('does not report contradictory primary states', () => {
    const snap = evaluateLocationContext({
      symbol: 'T',
      prior: [],
      bar: bar({ time: 100, close: 100.5, high: 100.6, low: 100.4 }),
      config: CFG,
      externalLevels: [
        { price: 100, type: 'SUPPORT', source: 'SWING_PIVOT', strength: 80, knownAt: 1 },
        { price: 101, type: 'RESISTANCE', source: 'SWING_PIVOT', strength: 80, knownAt: 1 },
      ],
    });
    const s = snap.locationContext;
    const supportish = /SUPPORT/.test(s);
    const resistish = /RESISTANCE/.test(s);
    // Primary is one label — not both AT_SUPPORT and AT_RESISTANCE
    expect(!(supportish && resistish && s.includes('AT_') && s.includes('AT_'))).toBe(true);
    expect(typeof s).toBe('string');
  });
});
