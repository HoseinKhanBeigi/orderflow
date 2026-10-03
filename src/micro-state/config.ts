export interface MicroStateConfig {
  /** |displacementBps| must exceed this for MOVE. */
  moveMinBps: number;
  /** Min body efficiency for MOVE (close−open vs range). */
  moveMinBodyEfficiency: number;
  /** Buy/sell effort threshold for NP (0–100). */
  npEffortHigh: number;
  /** Max |displacementBps| (and weak result) to still count as NP. */
  npMaxDispBps: number;
  /** Up/down result must be at or below this for NP. */
  npResultWeak: number;
  /** Min wick excursion beyond reference (bps of open) for REJECT. */
  rejectMinExcursionBps: number;
  /** Close must be back on the failed side of reference for REJECT. */
  rejectCloseBeyondFrac: number;
  /** Min distance beyond reference (bps) for ACCEPT close. */
  acceptMinBeyondBps: number;
  /** Max secondary labels painted per candle. */
  maxSecondaryLabels: number;
  /** CONT requires prior direction and this min displacement. */
  contMinBps: number;
}

export const DEFAULT_MICRO_STATE_CONFIG: MicroStateConfig = {
  moveMinBps: 15,
  moveMinBodyEfficiency: 0.28,
  npEffortHigh: 62,
  npMaxDispBps: 8,
  npResultWeak: 28,
  rejectMinExcursionBps: 8,
  rejectCloseBeyondFrac: 0.35,
  acceptMinBeyondBps: 6,
  maxSecondaryLabels: 2,
  contMinBps: 12,
};

export function mergeMicroStateConfig(
  partial?: Partial<MicroStateConfig>,
): MicroStateConfig {
  return { ...DEFAULT_MICRO_STATE_CONFIG, ...(partial ?? {}) };
}
