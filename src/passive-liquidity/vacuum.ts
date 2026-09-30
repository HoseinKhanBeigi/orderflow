import type { PassiveLiquidityConfig } from '../config/types.js';
import { clamp } from '../core/integrity.js';
import type { VacuumAssessment } from '../models/passive-liquidity.js';

export interface VacuumInput {
  nearDepthPercentile: number | null;
  withdrawalPercentile: number | null;
  replenishmentPercentile: number | null;
  distanceToNextWallBps: number;
  priceEfficiencyPercentile: number;
  spreadExpansionBps: number;
}

export function emptyVacuum(direction: 'UP' | 'DOWN'): VacuumAssessment {
  return {
    direction,
    score: 0,
    detected: false,
    nearDepthPercentile: 0,
    withdrawalPercentile: 0,
    replenishmentPercentile: 0,
    distanceToNextWallBps: Number.POSITIVE_INFINITY,
    priceEfficiencyPercentile: 50,
    spreadExpansionBps: 0,
  };
}

/**
 * A vacuum is thin, withdrawing, non-replenishing liquidity where modest
 * aggression produces outsized displacement. Thin depth alone is not a vacuum.
 * Missing percentiles are untested — never treated as neutral 50.
 */
export function assessVacuum(
  direction: 'UP' | 'DOWN',
  input: VacuumInput,
  config: PassiveLiquidityConfig,
  trustworthy: boolean,
): VacuumAssessment {
  const near = input.nearDepthPercentile;
  const withdraw = input.withdrawalPercentile;
  const refill = input.replenishmentPercentile;
  if (near == null || withdraw == null || refill == null) {
    return {
      direction,
      score: 0,
      detected: false,
      nearDepthPercentile: near ?? 0,
      withdrawalPercentile: withdraw ?? 0,
      replenishmentPercentile: refill ?? 0,
      distanceToNextWallBps: input.distanceToNextWallBps,
      priceEfficiencyPercentile: input.priceEfficiencyPercentile,
      spreadExpansionBps: input.spreadExpansionBps,
    };
  }

  const thin = clamp(1 - near / 100, 0, 1);
  const withdrawing = clamp(withdraw / 100, 0, 1);
  const notReplenishing = clamp(1 - refill / 100, 0, 1);
  const efficient = clamp(input.priceEfficiencyPercentile / 100, 0, 1);
  const runway = Number.isFinite(input.distanceToNextWallBps)
    ? clamp(input.distanceToNextWallBps / config.maxTrackedBps, 0, 1)
    : 1;
  const spread = clamp(input.spreadExpansionBps / 5, 0, 1);

  const score =
    clamp(
      0.28 * thin + 0.22 * withdrawing + 0.18 * notReplenishing + 0.14 * runway + 0.13 * efficient + 0.05 * spread,
      0,
      1,
    ) * 100;

  const gatesMet =
    near <= config.lowPercentile &&
    refill <= config.highPercentile &&
    (withdraw >= config.highPercentile ||
      input.priceEfficiencyPercentile >= config.highPercentile);

  return {
    direction,
    score,
    detected: trustworthy && gatesMet && score >= config.minVacuumScore,
    nearDepthPercentile: near,
    withdrawalPercentile: withdraw,
    replenishmentPercentile: refill,
    distanceToNextWallBps: input.distanceToNextWallBps,
    priceEfficiencyPercentile: input.priceEfficiencyPercentile,
    spreadExpansionBps: input.spreadExpansionBps,
  };
}
