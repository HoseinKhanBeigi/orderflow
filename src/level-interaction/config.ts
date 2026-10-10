export interface LevelInteractionConfig {
  /** Consecutive completed closes back on the original side required for reclaim. */
  minConsecutiveCloses: number;
  /** ATR multiple that counts as a real penetration (not a tick wick). */
  atrPenetration: number;
  /** Basis-point floor for penetration. */
  bpsPenetration: number;
  /** Absolute price floor when ATR/tick are tiny. */
  minPenetrationPrice: number;
  /** Minimum bar range as an ATR multiple. Narrow noise is skipped. */
  minRangeAtr: number;
  /** Minimum executed notional before a break attempt is considered. */
  minAttemptVolume: number;
  /** Volume-beyond-level ratio used as supporting reclaim evidence. */
  altVolumeRatio: number;
  /** Minimum |displacement bps| for the single-close alternative path. */
  altDispBps: number;
  /** Bars after a confirmed event before the same level+type may confirm again. */
  cooldownBars: number;
  /** Max bars after a level-loss in which a reclaim may confirm. */
  reclaimWindowBars: number;
  /** Bars a confirmed event line extends past the confirmation candle. */
  lineExtendBars: number;
  /** Cap historical event lines drawn on the chart. */
  maxEventLines: number;
  atrLookback: number;
  minAtrBars: number;
  zonePadAtr: number;
  zoneMergeAtr: number;
  swingLookback: number;
  imbalanceRatio: number;
  /** |delta / volume| treated as directional aggression. */
  aggressionRatio: number;
  effortHigh: number;
  resultStrong: number;
  resultWeak: number;
  maxTrackedLevels: number;
  /**
   * Confidence weights. Correlated flow metrics (delta, delta ratio,
   * imbalance) share `aggressiveFlow` — they are not summed.
   * Missing passive-defense data is dropped and the rest is renormalized.
   */
  weights: {
    levelSignificance: number;
    timeVolumeBeyond: number;
    aggressiveFlow: number;
    effortResult: number;
    passiveDefense: number;
    followThrough: number;
  };
}

export const DEFAULT_LEVEL_INTERACTION_CONFIG: LevelInteractionConfig = {
  minConsecutiveCloses: 2,
  atrPenetration: 0.08,
  bpsPenetration: 4,
  minPenetrationPrice: 0,
  minRangeAtr: 0.12,
  minAttemptVolume: 0,
  altVolumeRatio: 0.45,
  altDispBps: 12,
  cooldownBars: 3,
  reclaimWindowBars: 12,
  lineExtendBars: 2,
  maxEventLines: 24,
  atrLookback: 8,
  minAtrBars: 2,
  zonePadAtr: 0.12,
  zoneMergeAtr: 0.35,
  swingLookback: 48,
  imbalanceRatio: 3,
  aggressionRatio: 0.18,
  effortHigh: 62,
  resultStrong: 55,
  resultWeak: 28,
  maxTrackedLevels: 48,
  weights: {
    levelSignificance: 0.15,
    timeVolumeBeyond: 0.25,
    aggressiveFlow: 0.18,
    effortResult: 0.15,
    passiveDefense: 0.12,
    followThrough: 0.15,
  },
};

export function mergeLevelInteractionConfig(
  partial?: Partial<LevelInteractionConfig>,
): LevelInteractionConfig {
  if (!partial) return { ...DEFAULT_LEVEL_INTERACTION_CONFIG, weights: { ...DEFAULT_LEVEL_INTERACTION_CONFIG.weights } };
  return {
    ...DEFAULT_LEVEL_INTERACTION_CONFIG,
    ...partial,
    weights: { ...DEFAULT_LEVEL_INTERACTION_CONFIG.weights, ...(partial.weights ?? {}) },
  };
}
