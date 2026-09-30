import { clamp, safeDiv } from '../core/integrity.js';
import type { PassiveLiquidityConfig } from '../config/types.js';

export interface LevelScoreInput {
  ageMs: number;
  presentMs: number;
  distanceBps: number;
  quantity: number;
  maxQuantity: number;
  consumedQuantity: number;
  cancelledQuantity: number;
  replenishedQuantity: number;
  attackCount: number;
  defendedCount: number;
  replenishmentCount: number;
  /** Book snapshots that observed this level with size. */
  snapshotCount?: number;
}

export type LevelMetricState =
  | 'OBSERVED'
  | 'UNTESTED'
  | 'INSUFFICIENT_DATA'
  | 'STALE'
  | 'UNRELIABLE';

export interface LevelMetric {
  value: number | null;
  state: LevelMetricState;
}

/** exp(-k * bps): near-touch liquidity is worth more than distant liquidity. */
export function distanceWeight(distanceBps: number, k: number): number {
  if (!Number.isFinite(distanceBps) || distanceBps < 0) return 0;
  return Math.exp(-k * distanceBps);
}

export function replenishmentRatio(replenished: number, consumed: number): number {
  if (consumed <= 0) return replenished > 0 ? 1 : 0;
  return replenished / consumed;
}

/**
 * Share of the level's disappearance that was pulled rather than executed.
 * Remaining size counts in the denominator so a level that mostly still exists
 * cannot score as heavily withdrawn.
 */
export function withdrawalShare(input: LevelScoreInput): number {
  const total = input.cancelledQuantity + input.consumedQuantity + input.quantity;
  return total <= 0 ? 0 : input.cancelledQuantity / total;
}

function metric(value: number | null, state: LevelMetricState): LevelMetric {
  return { value, state };
}

/**
 * Age alone is not persistence. A level that has been attacked and replenished
 * scores higher than an untested level of the same age, and a level bleeding
 * cancellations is penalised regardless of how long it has existed.
 *
 * Untested survival must not become 0.5. Insufficient history returns null.
 */
export function persistenceMetric(input: LevelScoreInput, config: PassiveLiquidityConfig): LevelMetric {
  const minSnapshots = Math.max(1, config.wallPersistenceMinSnapshots ?? 4);
  const snapshots = input.snapshotCount ?? 0;
  if (snapshots > 0 && snapshots < minSnapshots && input.presentMs < config.wallYoungMs) {
    return metric(null, 'INSUFFICIENT_DATA');
  }
  if (input.presentMs <= 0 && snapshots < minSnapshots) {
    return metric(null, 'INSUFFICIENT_DATA');
  }

  const matureSec = Math.max(1, config.wallMatureMs / 1_000);
  const ageFactor = clamp(
    Math.log1p(Math.max(0, input.presentMs) / 1_000) / Math.log1p(matureSec),
    0,
    1,
  );
  const presenceRatio = input.ageMs > 0 ? clamp(input.presentMs / input.ageMs, 0, 1) : 0;
  const replenishObserved = input.consumedQuantity > 0 || input.replenishmentCount > 0;
  const replenish = replenishObserved
    ? clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1)
    : null;
  const survival = input.attackCount > 0
    ? clamp(input.defendedCount / input.attackCount, 0, 1)
    : null;
  const proximity = distanceWeight(input.distanceBps, config.distanceWeightK);
  const pulled = withdrawalShare(input);

  let weight = 0;
  let acc = 0;
  const add = (w: number, value: number | null) => {
    if (value == null || w <= 0) return;
    acc += w * value;
    weight += w;
  };
  add(0.45, ageFactor);
  add(0.25, presenceRatio);
  add(0.15, replenish);
  add(0.15, survival);
  // Proximity is relevance, not persistence evidence — omit from persistence.
  void proximity;

  if (weight <= 0) return metric(null, 'INSUFFICIENT_DATA');
  const raw = acc / weight - 0.35 * pulled;
  return metric(clamp(raw, 0, 1) * 100, 'OBSERVED');
}

/** @deprecated Prefer persistenceMetric — returns 0 when insufficient instead of null. */
export function persistenceScore(input: LevelScoreInput, config: PassiveLiquidityConfig): number {
  return persistenceMetric(input, config).value ?? 0;
}

/**
 * Refill is untested until the level has been consumed or has recorded a refill event.
 * Never invent a neutral 50.
 */
export function replenishmentMetric(input: LevelScoreInput): LevelMetric {
  if (input.consumedQuantity <= 0 && input.replenishmentCount <= 0) {
    return metric(null, 'UNTESTED');
  }
  const ratio = clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1.5);
  const repeat = clamp(input.replenishmentCount / 4, 0, 1);
  return metric(clamp(0.75 * (ratio / 1.5) + 0.25 * repeat, 0, 1) * 100, 'OBSERVED');
}

export function replenishmentScoreOf(input: LevelScoreInput): number {
  return replenishmentMetric(input).value ?? 0;
}

/**
 * Cancellation / withdrawal share is untested until size has disappeared
 * (cancel or consume). A quiet resting level is not "zero cancellation".
 */
export function withdrawalMetric(input: LevelScoreInput, config: PassiveLiquidityConfig): LevelMetric {
  if (input.cancelledQuantity <= 0 && input.consumedQuantity <= 0) {
    return metric(null, 'UNTESTED');
  }
  const share = withdrawalShare(input);
  const proximity = distanceWeight(input.distanceBps, config.distanceWeightK);
  const shrink = input.maxQuantity > 0
    ? clamp(1 - input.quantity / input.maxQuantity, 0, 1)
    : 0;
  return metric(clamp(0.55 * share + 0.25 * shrink + 0.2 * share * proximity, 0, 1) * 100, 'OBSERVED');
}

export function withdrawalScoreOf(input: LevelScoreInput, config: PassiveLiquidityConfig): number {
  return withdrawalMetric(input, config).value ?? 0;
}

export function cancellationMetric(input: LevelScoreInput): LevelMetric {
  const total = input.cancelledQuantity + input.consumedQuantity + input.quantity;
  if (input.cancelledQuantity <= 0 && input.consumedQuantity <= 0) {
    return metric(null, 'UNTESTED');
  }
  if (total <= 0) return metric(null, 'INSUFFICIENT_DATA');
  return metric(clamp(input.cancelledQuantity / total, 0, 1) * 100, 'OBSERVED');
}

export function consumptionMetric(input: LevelScoreInput): LevelMetric {
  if (input.consumedQuantity <= 0) return metric(null, 'UNTESTED');
  const base = Math.max(input.maxQuantity, input.quantity + input.consumedQuantity, 1);
  return metric(clamp(input.consumedQuantity / base, 0, 1.5) / 1.5 * 100, 'OBSERVED');
}

/**
 * Absorption at a level needs all three: it was executed into, it came back,
 * and it is still there. Any one of them alone is not absorption.
 */
export function absorptionMetric(input: LevelScoreInput): LevelMetric {
  if (input.consumedQuantity <= 0) return metric(null, 'UNTESTED');
  const consumedShare = input.maxQuantity > 0
    ? clamp(input.consumedQuantity / input.maxQuantity, 0, 1)
    : 0;
  const replenish = clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1);
  const stillThere = input.maxQuantity > 0 ? clamp(input.quantity / input.maxQuantity, 0, 1) : 0;
  const repeat = clamp(safeDiv(input.attackCount, 3), 0, 1);
  return metric(
    clamp(0.35 * consumedShare + 0.35 * replenish + 0.2 * stillThere + 0.1 * repeat, 0, 1) * 100,
    'OBSERVED',
  );
}

export function absorptionScoreOf(input: LevelScoreInput): number {
  return absorptionMetric(input).value ?? 0;
}
