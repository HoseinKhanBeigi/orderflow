import type { PassiveLiquidityLevel, PassiveLiquidityWall } from '../models/passive-liquidity.js';
import type { LevelDataQuality, LevelObservation } from '../models/level-strength.js';
import type { PassiveLiquidityDataQuality } from '../models/passive-liquidity.js';

/** Maps a tracked book level onto the strength engine. Does not recompute fills or cancels. */
export function levelObservation(
  level: PassiveLiquidityLevel,
  relocated: boolean,
): LevelObservation {
  return {
    price: level.price,
    side: level.side,
    initialSize: level.initialNotional,
    currentSize: level.notionalValue,
    newAdded: level.addedNotional,
    replenished: level.replenishedNotional,
    consumed: level.consumedNotional,
    cancelled: level.cancelledNotional,
    unresolved: level.unresolvedQuantity * level.price,
    persistenceMs: level.presentMs,
    distanceBps: level.distanceBps,
    sizePercentile: Number.isFinite(level.sizePercentile as number) ? level.sizePercentile : null,
    replenishmentScore: level.replenishmentScore,
    withdrawalScore: level.withdrawalScore,
    persistenceScore: level.persistenceScore,
    cancellationScore: level.cancellationScore,
    consumptionScore: level.consumptionScore,
    replenishmentState: level.replenishmentState,
    withdrawalState: level.withdrawalState,
    persistenceState: level.persistenceState,
    cancellationState: level.cancellationState,
    consumptionState: level.consumptionState,
    firstSeenDistanceBps: level.firstSeenDistanceBps,
    snapshotCount: level.snapshotCount,
    closestApproachBps: level.closestApproachBps,
    sizeAtClosestApproach: level.notionalAtClosestApproach,
    approachCheckpoints: level.approachCheckpoints,
    approachWithdrawal: level.approachWithdrawal,
    attackCount: level.attackCount,
    executionCount: level.executionCount,
    relocated,
    outOfView: level.outOfView || !level.visible,
    lastUpdatedAt: level.lastUpdatedAt,
  };
}

export function relocatedPrices(walls: PassiveLiquidityWall[]): Set<string> {
  const keys = new Set<string>();
  for (const wall of walls) {
    if (wall.labels.includes('REAPPEARS_FARTHER')) keys.add(`${wall.side}:${wall.price}`);
  }
  return keys;
}

export function levelDataQuality(quality: PassiveLiquidityDataQuality): LevelDataQuality {
  if (quality.reasons.some((reason) => reason.startsWith('book stale') || reason.includes('no book'))) return 'STALE';
  if (!quality.trustworthy || quality.score < 45) return 'UNRELIABLE';
  if (quality.reasons.some((reason) => reason === 'warming up' || reason === 'limited history')) return 'PARTIAL';
  return 'GOOD';
}
