import type { PassiveStrengthWeights } from '../config/types.js';
import { clamp } from '../core/integrity.js';

export interface StrengthInput {
  depthPercentile: number | null;
  nearDepthPercentile: number | null;
  /** 0-100 notional-weighted level persistence. Null when insufficient. */
  persistenceScore: number | null;
  replenishmentPercentile: number | null;
  withdrawalPercentile: number | null;
  /** Percentile of opposing aggression this side absorbed. */
  absorbedAggressionPercentile: number | null;
  /** 0-100: how poorly price advanced against this side. */
  priceInefficiency: number | null;
  defendedTests: number;
  confirmedTestCount: number;
}

/**
 * Weighted composite rather than a plain average, so a single large number
 * cannot carry the score. Withdrawal enters inverted: liquidity that gets
 * pulled reduces strength no matter how much of it is displayed.
 *
 * Null components are omitted and weights are renormalized — never filled with 50.
 */
export function passiveStrength(input: StrengthInput, weights: PassiveStrengthWeights): number {
  const terms: Array<[number, number | null]> = [
    [weights.depth, input.depthPercentile == null ? null : input.depthPercentile / 100],
    [weights.nearDepth, input.nearDepthPercentile == null ? null : input.nearDepthPercentile / 100],
    [weights.persistence, input.persistenceScore == null ? null : input.persistenceScore / 100],
    [weights.replenishment, input.replenishmentPercentile == null ? null : input.replenishmentPercentile / 100],
    [weights.withdrawalInverse, input.withdrawalPercentile == null ? null : 1 - input.withdrawalPercentile / 100],
    [weights.absorbedAggression, input.absorbedAggressionPercentile == null ? null : input.absorbedAggressionPercentile / 100],
    [weights.priceInefficiency, input.priceInefficiency == null ? null : input.priceInefficiency / 100],
    [
      weights.defendedTests,
      input.confirmedTestCount > 0
        ? clamp(input.defendedTests / Math.max(1, input.confirmedTestCount), 0, 1)
        : null,
    ],
  ];

  let weighted = 0;
  let total = 0;
  for (const [weight, value] of terms) {
    if (weight <= 0 || value == null) continue;
    weighted += weight * clamp(value, 0, 1);
    total += weight;
  }
  if (total <= 0) return 0;
  return clamp(weighted / total, 0, 1) * 100;
}
