/**
 * Which resting side is actually stronger.
 * Scores come from behavior already measured by passive liquidity.
 * Raw displayed size is one input, and a small one.
 */

export const PASSIVE_STRENGTH_VERSION = 'PASSIVE_STRENGTH_V1';

export type PassiveStrengthState =
  | 'BIDS_STRONGER'
  | 'ASKS_STRONGER'
  | 'BALANCED'
  | 'BIDS_WEAKENING'
  | 'ASKS_WEAKENING'
  | 'BOTH_STRONG'
  | 'BOTH_WEAK'
  | 'HIGH_CHURN'
  | 'UNCERTAIN';

export type PassiveWinner = 'BIDS' | 'ASKS' | 'BALANCED' | 'UNCERTAIN';

export type PassiveStrengthDataStatus =
  | 'OK'
  | 'NO_DATA'
  | 'PARTIAL_DATA'
  | 'STALE_DATA'
  | 'LOW_CONFIDENCE';

export type PassiveSideTrend = 'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN';

export type PassiveSideState =
  | 'STRONG_DEFENSE'
  | 'MODERATE'
  | 'WEAKENING'
  | 'WEAK'
  | 'WITHDRAWING'
  | 'UNTESTED';

export type DefenseRead = 'HOLDING' | 'BREAKING' | 'WITHDRAWING' | 'STAYING' | 'UNTESTED';

export type WallReliabilityLabel = 'RELIABLE' | 'MODERATE' | 'UNRELIABLE' | 'SPOOF_LIKE';

export type ChurnState = 'LOW_CHURN' | 'NORMAL_CHURN' | 'HIGH_CHURN' | 'EXTREME_CHURN' | 'UNKNOWN';

export type SurvivalRead =
  | 'UNTESTED'
  | 'SURVIVING'
  | 'WEAKENING'
  | 'WITHDRAWING'
  | 'CONTACTED'
  | 'DEFENDING'
  | 'BROKEN';

export interface PassiveStrengthWeights {
  depth: number;
  nearTouch: number;
  replenishment: number;
  survival: number;
  persistence: number;
  reliability: number;
  /** Subtracted. High cancellation weakens the side. */
  cancellation: number;
  withdrawal: number;
  /** Subtracted only for consumption that was not refilled. */
  netConsumption: number;
}

export interface PassiveStrengthConfig {
  weights: PassiveStrengthWeights;
  /** |bid − ask| must clear this before either side is called stronger. */
  minimumStrengthMargin: number;
  bothStrong: number;
  bothWeak: number;
  /** Score points per step. Negative means the side is losing strength. */
  weakeningVelocity: number;
  strengtheningVelocity: number;
  /** Minimum drop across the recent history before a weakening label overrides a close spread. */
  weakeningDrop: number;
  /** Gross activity / current depth. Dimensionless, so it is not a dollar comparison. */
  churnLow: number;
  churnNormal: number;
  churnHigh: number;
  /** Reconciliation error as a fraction of depth. Above this, confidence is capped. */
  mismatchSoft: number;
  /** Above this, the read is UNCERTAIN. */
  mismatchHard: number;
  /** How hard a full penalty pulls a perfect positive score toward zero. 1 wipes it. */
  penaltyScale: number;
}

export const DEFAULT_PASSIVE_STRENGTH_CONFIG: PassiveStrengthConfig = {
  weights: {
    depth: 0.08,
    nearTouch: 0.12,
    replenishment: 0.18,
    survival: 0.22,
    persistence: 0.1,
    reliability: 0.12,
    cancellation: 0.16,
    withdrawal: 0.14,
    netConsumption: 0.1,
  },
  minimumStrengthMargin: 10,
  bothStrong: 70,
  bothWeak: 38,
  weakeningVelocity: -6,
  strengtheningVelocity: 4,
  weakeningDrop: 12,
  churnLow: 0.35,
  churnNormal: 1.2,
  churnHigh: 2.5,
  mismatchSoft: 0.15,
  mismatchHard: 0.4,
  penaltyScale: 1,
};

/**
 * Already-normalized 0–100 component scores.
 * Null means the measurement is missing. It is left out of the score.
 */
export interface PassiveSideComponents {
  depthScore: number | null;
  nearTouchScore: number | null;
  consumptionScore: number | null;
  replenishmentScore: number | null;
  cancellationScore: number | null;
  withdrawalScore: number | null;
  survivalScore: number | null;
  persistenceScore: number | null;
  reliabilityScore: number | null;
  /** Gross added+replenished+cancelled+consumed divided by current depth. */
  churnRatio: number | null;
  /** Liquidity inside 5 bps divided by liquidity inside 100 bps. */
  nearTouchConcentration: number | null;
  approachWithdrawal: boolean;
  /** False until price has closed in on this side. Survival is then untested, not zero. */
  survivalObserved: boolean;
}

export interface StrengthHistoryPoint {
  timestamp: number;
  bidStrength: number;
  askStrength: number;
}

export interface WallStrengthRef {
  price: number;
  strength: number;
  reliability: number;
  lifecycle: string;
}

export interface PassiveStrengthInput {
  symbol: string;
  timestamp: number;
  bids: PassiveSideComponents;
  asks: PassiveSideComponents;
  /** Fraction, matching net-liquidity reconciliationErrorPercent. Null if accounting was not run. */
  reconciliationError: number | null;
  dataStatus: PassiveStrengthDataStatus;
  history?: StrengthHistoryPoint[];
  strongestBidWall?: WallStrengthRef | null;
  strongestAskWall?: WallStrengthRef | null;
}

export interface PassiveStrengthSide {
  strength: number;
  trend: PassiveSideTrend;
  velocity: number;
  acceleration: number;
  /** Current strength minus the oldest prior sample. Zero until history exists. */
  change: number;
  depthScore: number | null;
  nearTouchScore: number | null;
  consumptionScore: number | null;
  replenishmentScore: number | null;
  cancellationScore: number | null;
  withdrawalScore: number | null;
  survivalScore: number | null;
  persistenceScore: number | null;
  reliabilityScore: number | null;
  netConsumptionPressure: number | null;
  nearTouchConcentration: number | null;
  churn: ChurnState;
  survival: SurvivalRead;
  defense: DefenseRead;
  reliability: WallReliabilityLabel;
  state: PassiveSideState;
  componentsUsed: number;
}

export interface PassiveStrengthSnapshot {
  version: typeof PASSIVE_STRENGTH_VERSION;
  symbol: string;
  timestamp: number;
  bids: PassiveStrengthSide;
  asks: PassiveStrengthSide;
  passiveStrengthSpread: number;
  passiveStrengthImbalance: number;
  passiveWinner: PassiveWinner;
  state: PassiveStrengthState;
  confidence: number;
  dataStatus: PassiveStrengthDataStatus;
  accountingMismatch: boolean;
  reasons: string[];
  strongestBidWall: WallStrengthRef | null;
  strongestAskWall: WallStrengthRef | null;
}

export function emptySideComponents(): PassiveSideComponents {
  return {
    depthScore: null,
    nearTouchScore: null,
    consumptionScore: null,
    replenishmentScore: null,
    cancellationScore: null,
    withdrawalScore: null,
    survivalScore: null,
    persistenceScore: null,
    reliabilityScore: null,
    churnRatio: null,
    nearTouchConcentration: null,
    approachWithdrawal: false,
    survivalObserved: false,
  };
}

export function emptyPassiveStrengthSnapshot(symbol = '', timestamp = 0): PassiveStrengthSnapshot {
  const side = emptyStrengthSide();
  return {
    version: PASSIVE_STRENGTH_VERSION,
    symbol,
    timestamp,
    bids: side,
    asks: { ...side },
    passiveStrengthSpread: 0,
    passiveStrengthImbalance: 0,
    passiveWinner: 'UNCERTAIN',
    state: 'UNCERTAIN',
    confidence: 0,
    dataStatus: 'NO_DATA',
    accountingMismatch: false,
    reasons: ['no passive liquidity measurements'],
    strongestBidWall: null,
    strongestAskWall: null,
  };
}

function emptyStrengthSide(): PassiveStrengthSide {
  return {
    strength: 0,
    trend: 'UNKNOWN',
    velocity: 0,
    acceleration: 0,
    change: 0,
    depthScore: null,
    nearTouchScore: null,
    consumptionScore: null,
    replenishmentScore: null,
    cancellationScore: null,
    withdrawalScore: null,
    survivalScore: null,
    persistenceScore: null,
    reliabilityScore: null,
    netConsumptionPressure: null,
    nearTouchConcentration: null,
    churn: 'UNKNOWN',
    survival: 'UNTESTED',
    defense: 'UNTESTED',
    reliability: 'MODERATE',
    state: 'UNTESTED',
    componentsUsed: 0,
  };
}
