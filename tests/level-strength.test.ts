import { describe, expect, it } from 'vitest';
import { evaluateLevelMap, LevelStrengthEngine } from '../src/level-strength/index.js';
import {
  cancellationMetric,
  consumptionMetric,
  persistenceMetric,
  replenishmentMetric,
  withdrawalMetric,
} from '../src/passive-liquidity/level-scores.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { LevelObservation } from '../src/models/level-strength.js';

function level(partial: Partial<LevelObservation> & Pick<LevelObservation, 'price' | 'side'>): LevelObservation {
  const initialSize = partial.initialSize ?? 1_000_000;
  const newAdded = partial.newAdded ?? 0;
  const consumed = partial.consumed ?? 0;
  const cancelled = partial.cancelled ?? 0;
  const unresolved = partial.unresolved ?? 0;
  const currentSize = partial.currentSize ?? initialSize + newAdded - consumed - cancelled - unresolved;
  return {
    initialSize,
    currentSize,
    newAdded,
    replenished: partial.replenished ?? 0,
    consumed,
    cancelled,
    unresolved,
    persistenceMs: 20_000,
    distanceBps: 10,
    sizePercentile: 80,
    replenishmentScore: null,
    withdrawalScore: null,
    persistenceScore: 70,
    cancellationScore: null,
    consumptionScore: null,
    firstSeenDistanceBps: 15,
    snapshotCount: 12,
    closestApproachBps: null,
    sizeAtClosestApproach: null,
    approachCheckpoints: [],
    approachWithdrawal: false,
    attackCount: 0,
    executionCount: 0,
    relocated: false,
    outOfView: false,
    lastUpdatedAt: 1_000,
    ...partial,
    currentSize: partial.currentSize ?? currentSize,
  };
}

const scoreInput = {
  ageMs: 20_000,
  presentMs: 18_000,
  distanceBps: 12,
  quantity: 100,
  maxQuantity: 100,
  consumedQuantity: 0,
  cancelledQuantity: 0,
  replenishedQuantity: 0,
  attackCount: 0,
  defendedCount: 0,
  replenishmentCount: 0,
  snapshotCount: 12,
};

describe('unknown metrics must not become neutral defaults', () => {
  it('unknown refill does not become 50', () => {
    const m = replenishmentMetric(scoreInput);
    expect(m.value).toBeNull();
    expect(m.state).toBe('UNTESTED');
    expect(m.value).not.toBe(50);
  });

  it('unknown cancellation does not become 50', () => {
    const m = cancellationMetric(scoreInput);
    expect(m.value).toBeNull();
    expect(m.state).toBe('UNTESTED');
  });

  it('unknown consumption does not become 50', () => {
    const m = consumptionMetric(scoreInput);
    expect(m.value).toBeNull();
    expect(m.state).toBe('UNTESTED');
  });

  it('unknown withdrawal does not become 50', () => {
    const m = withdrawalMetric(scoreInput, DEFAULT_CONFIG.passiveLiquidity);
    expect(m.value).toBeNull();
    expect(m.state).toBe('UNTESTED');
  });

  it('untested survival does not become 100', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({
          price: 101.15,
          side: 'ASK',
          distanceBps: 15,
          firstSeenDistanceBps: 15,
          closestApproachBps: null,
          approachCheckpoints: [],
          attackCount: 0,
          persistenceScore: 40,
          sizePercentile: 85,
        }),
      ],
    });
    const row = map.asks[0]!;
    expect(row.survival.value).toBeNull();
    expect(row.survivalState).toBe('UNTESTED');
    expect(row.survival.value).not.toBe(100);
  });

  it('wall appearing inside 20 bps without closer approach stays UNTESTED', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({
          price: 100.12,
          side: 'ASK',
          distanceBps: 12,
          firstSeenDistanceBps: 15,
          closestApproachBps: 12,
          approachCheckpoints: [],
          attackCount: 0,
        }),
      ],
    });
    expect(map.asks[0]!.survivalState).toBe('UNTESTED');
    expect(map.asks[0]!.survival.value).toBeNull();
  });
});

describe('wall maturity', () => {
  it('classifies new / forming / mature / tested walls', () => {
    const neu = evaluateLevelMap({
      symbol: 'X',
      timestamp: 1,
      currentPrice: 100,
      levels: [level({ price: 101, side: 'ASK', persistenceMs: 400, snapshotCount: 1 })],
    });
    expect(neu.asks[0]!.wallMaturity).toBe('NEW');

    const forming = evaluateLevelMap({
      symbol: 'X',
      timestamp: 1,
      currentPrice: 100,
      levels: [level({ price: 101, side: 'ASK', persistenceMs: 4_000, snapshotCount: 4 })],
    });
    expect(forming.asks[0]!.wallMaturity).toBe('FORMING');

    const mature = evaluateLevelMap({
      symbol: 'X',
      timestamp: 1,
      currentPrice: 100,
      levels: [level({ price: 101, side: 'ASK', persistenceMs: 20_000, snapshotCount: 20 })],
    });
    expect(mature.asks[0]!.wallMaturity).toBe('MATURE');

    const tested = evaluateLevelMap({
      symbol: 'X',
      timestamp: 1,
      currentPrice: 100,
      levels: [level({
        price: 101,
        side: 'ASK',
        approachCheckpoints: ['10'],
        closestApproachBps: 8,
        firstSeenDistanceBps: 20,
        sizeAtClosestApproach: 900_000,
        attackCount: 1,
        executionCount: 1,
        replenishmentScore: 70,
        consumptionScore: 60,
        cancellationScore: 10,
        withdrawalScore: 10,
      })],
    });
    expect(tested.asks[0]!.wallMaturity).toBe('TESTED');
  });
});

describe('strength with partial metrics', () => {
  it('renormalizes weights and ignores missing refill/survival', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({
          price: 101,
          side: 'ASK',
          sizePercentile: 90,
          persistenceScore: 80,
          replenishmentScore: null,
          withdrawalScore: null,
          cancellationScore: null,
          consumptionScore: null,
          approachCheckpoints: [],
          closestApproachBps: null,
        }),
      ],
    });
    const row = map.asks[0]!;
    expect(row.replenishmentScore.value).toBeNull();
    expect(row.survival.value).toBeNull();
    expect(row.componentsUsed).toBeGreaterThan(0);
    expect(row.componentsUsed).toBeLessThan(row.componentsAvailable);
    expect(row.strengthConfidence).toBeLessThan(70);
    // Must not land in the fake-neutral 48–52 band from defaulted components.
    expect(row.strength === 50 || (row.strength >= 48 && row.strength <= 52 && row.strengthConfidence > 80)).toBe(false);
  });

  it('low-confidence high-strength wall is UNCERTAIN, not VERY_STRONG', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({
          price: 101,
          side: 'ASK',
          sizePercentile: 99,
          persistenceScore: 95,
          persistenceMs: 500,
          snapshotCount: 1,
          replenishmentScore: null,
          approachCheckpoints: [],
        }),
      ],
    });
    const row = map.asks[0]!;
    expect(row.strength).toBeGreaterThan(60);
    expect(row.strengthConfidence).toBeLessThan(40);
    expect(row.state === 'UNCERTAIN' || row.state === 'UNTESTED').toBe(true);
  });

  it('high-confidence moderate wall ranks above low-confidence high strength', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100.95,
      levels: [
        level({
          price: 101.5,
          side: 'ASK',
          distanceBps: 80,
          sizePercentile: 99,
          persistenceScore: 95,
          persistenceMs: 400,
          snapshotCount: 1,
          replenishmentScore: null,
        }),
        level({
          price: 101.05,
          side: 'ASK',
          distanceBps: 4,
          sizePercentile: 75,
          persistenceScore: 78,
          persistenceMs: 25_000,
          snapshotCount: 30,
          replenishmentScore: 80,
          consumptionScore: 70,
          cancellationScore: 12,
          withdrawalScore: 15,
          approachCheckpoints: ['5', '2'],
          closestApproachBps: 2,
          firstSeenDistanceBps: 20,
          sizeAtClosestApproach: 900_000,
          attackCount: 3,
          executionCount: 4,
        }),
      ],
    });
    expect(map.strongestOverallAsk?.price).toBe(101.05);
    expect(map.asks.find((r) => r.price === 101.05)!.rankingScore)
      .toBeGreaterThan(map.asks.find((r) => r.price === 101.5)!.rankingScore);
  });

  it('keeps strongest overall separate from strongest relevant', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100.95,
      levels: [
        level({
          price: 105,
          side: 'ASK',
          distanceBps: 400,
          sizePercentile: 95,
          persistenceScore: 92,
          persistenceMs: 40_000,
          snapshotCount: 40,
          replenishmentScore: 90,
          consumptionScore: 70,
          cancellationScore: 10,
          withdrawalScore: 10,
          approachCheckpoints: ['10'],
          closestApproachBps: 8,
          firstSeenDistanceBps: 30,
          sizeAtClosestApproach: 950_000,
          attackCount: 2,
          executionCount: 3,
        }),
        level({
          price: 101.05,
          side: 'ASK',
          distanceBps: 4,
          sizePercentile: 72,
          persistenceScore: 70,
          persistenceMs: 20_000,
          snapshotCount: 20,
          replenishmentScore: 75,
          consumptionScore: 60,
          cancellationScore: 18,
          withdrawalScore: 20,
          approachCheckpoints: ['5', '2', '1'],
          closestApproachBps: 1,
          firstSeenDistanceBps: 15,
          sizeAtClosestApproach: 850_000,
          attackCount: 2,
          executionCount: 2,
        }),
      ],
    });
    expect(map.strongestOverallAsk?.price).toBe(105);
    expect(map.strongestRelevantAsk?.price).toBe(101.05);
  });
});

describe('wall battle and lifecycle signals', () => {
  it('marks currently attacked ask and hold/break events', () => {
    const holding = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100.95,
      buyPower: 78,
      levels: [
        level({
          price: 101.05,
          side: 'ASK',
          distanceBps: 8,
          replenishmentScore: 90,
          consumptionScore: 80,
          cancellationScore: 10,
          withdrawalScore: 12,
          persistenceScore: 85,
          approachCheckpoints: ['5', '2'],
          closestApproachBps: 2,
          firstSeenDistanceBps: 20,
          sizeAtClosestApproach: 1_800_000,
          initialSize: 2_000_000,
          newAdded: 1_700_000,
          replenished: 1_500_000,
          consumed: 1_200_000,
          cancelled: 80_000,
          attackCount: 4,
          executionCount: 5,
        }),
      ],
    });
    expect(holding.currentlyAttackedAsk?.price).toBe(101.05);
    expect(holding.events).toContain('ASK_WALL_HOLDING');

    const broken = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 8_000,
      currentPrice: 101.2,
      buyPower: 82,
      levels: [
        level({
          price: 101.1,
          side: 'ASK',
          distanceBps: 5,
          initialSize: 2_000_000,
          consumed: 1_400_000,
          cancelled: 200_000,
          newAdded: 100_000,
          replenishmentScore: 15,
          consumptionScore: 85,
          cancellationScore: 30,
          persistenceScore: 30,
          withdrawalScore: 35,
          sizeAtClosestApproach: 400_000,
          approachCheckpoints: ['2', '1', 'contact'],
          closestApproachBps: 0.5,
          firstSeenDistanceBps: 20,
          attackCount: 4,
          executionCount: 4,
        }),
      ],
      history: [
        { timestamp: 1_000, price: 101.1, side: 'ASK', strength: 91 },
        { timestamp: 3_000, price: 101.1, side: 'ASK', strength: 70 },
      ],
    });
    expect(broken.events).toContain('ASK_WALL_BROKEN');
    expect(broken.asks[0]!.trend).toBe('WEAKENING');
  });

  it('separates near-touch from deep walls in bands', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({ price: 100.1, side: 'ASK', distanceBps: 10, persistenceScore: 70, sizePercentile: 80 }),
        level({ price: 101.5, side: 'ASK', distanceBps: 150, persistenceScore: 70, sizePercentile: 80 }),
      ],
    });
    expect(map.nearTouchAsks.some((r) => r.price === 100.1)).toBe(true);
    expect(map.deepAsks.some((r) => r.price === 101.5)).toBe(true);
  });

  it('flags accounting mismatch and stale data', () => {
    const mismatch = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      levels: [
        level({
          price: 101,
          side: 'ASK',
          initialSize: 1_000_000,
          currentSize: 4_000_000,
          newAdded: 0,
          consumed: 0,
          cancelled: 0,
        }),
      ],
    });
    expect(mismatch.asks[0]?.accountingMismatch).toBe(true);
    expect(mismatch.asks[0]?.dataQuality).toBe('UNRELIABLE');
    expect(mismatch.asks[0]!.strengthConfidence).toBeLessThanOrEqual(28);

    const stale = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 5_000,
      currentPrice: 100,
      dataQuality: 'STALE',
      levels: [level({ price: 101, side: 'ASK' })],
    });
    expect(stale.dataQuality).toBe('STALE');
    expect(stale.asks[0]?.dataQuality).toBe('STALE');
  });

  it('keeps engines separate and ignores future history', () => {
    const map = evaluateLevelMap({
      symbol: 'NEARUSDT',
      timestamp: 2_000,
      currentPrice: 100,
      levels: [level({
        price: 101,
        side: 'ASK',
        replenishmentScore: 85,
        persistenceScore: 80,
        approachCheckpoints: ['10'],
        closestApproachBps: 8,
        firstSeenDistanceBps: 20,
        sizeAtClosestApproach: 900_000,
        attackCount: 1,
        executionCount: 1,
        consumptionScore: 50,
        cancellationScore: 10,
        withdrawalScore: 10,
      })],
      history: [{ timestamp: 9_000, price: 101, side: 'ASK', strength: 5 }],
    });
    expect(map.asks[0]?.trend).toBe('UNKNOWN');

    const a = new LevelStrengthEngine();
    const b = new LevelStrengthEngine();
    const input = {
      symbol: 'NEARUSDT',
      timestamp: 1_000,
      currentPrice: 100,
      levels: [level({
        price: 100.8,
        side: 'BID',
        replenishmentScore: 88,
        persistenceScore: 80,
        approachCheckpoints: ['10'],
        closestApproachBps: 6,
        firstSeenDistanceBps: 20,
        sizeAtClosestApproach: 900_000,
        attackCount: 1,
        executionCount: 1,
        consumptionScore: 50,
        cancellationScore: 10,
        withdrawalScore: 10,
      })],
    };
    a.evaluate(input);
    const later = a.evaluate({
      ...input,
      timestamp: 4_000,
      levels: [level({
        price: 100.8,
        side: 'BID',
        replenishmentScore: 20,
        persistenceScore: 30,
        withdrawalScore: 80,
        consumptionScore: 80,
        cancellationScore: 40,
        consumed: 700_000,
        cancelled: 100_000,
        sizeAtClosestApproach: 200_000,
        approachCheckpoints: ['2', '1'],
        closestApproachBps: 2,
        firstSeenDistanceBps: 20,
        attackCount: 2,
        executionCount: 2,
      })],
    });
    const other = b.evaluate({ ...input, timestamp: 4_000 });
    expect(later.bids[0]?.trend).toBe('WEAKENING');
    expect(other.bids[0]?.trend).toBe('UNKNOWN');
  });
});

describe('persistence maturity', () => {
  it('returns INSUFFICIENT_DATA for brand-new walls', () => {
    const m = persistenceMetric({
      ...scoreInput,
      presentMs: 200,
      ageMs: 200,
      snapshotCount: 1,
    }, DEFAULT_CONFIG.passiveLiquidity);
    expect(m.value).toBeNull();
    expect(m.state).toBe('INSUFFICIENT_DATA');
  });
});
