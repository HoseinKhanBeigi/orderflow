/**
 * Strength of one resting price, separate from the side-wide score.
 * A moderate ask book can still hide one very strong ask level.
 *
 * UNKNOWN ≠ 50. UNTESTED ≠ 100.
 * Strength, confidence, and relevance stay separate numbers.
 */

export const LEVEL_STRENGTH_VERSION = 'LEVEL_STRENGTH_V2';

export type LevelSignificance = 'SIGNIFICANT' | 'NORMAL' | 'IGNORE';

export type LevelMetricState =
  | 'OBSERVED'
  | 'UNTESTED'
  | 'INSUFFICIENT_DATA'
  | 'STALE'
  | 'UNRELIABLE';

export type LevelStrengthState =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'MODERATE'
  | 'WEAK'
  | 'VERY_WEAK'
  | 'UNCERTAIN'
  | 'UNRELIABLE'
  | 'BROKEN'
  | 'WITHDRAWING'
  | 'REPLENISHING'
  | 'DEFENDING'
  | 'UNTESTED';

export type WallMaturity = 'NEW' | 'FORMING' | 'MATURE' | 'TESTED';

export type LevelLifecycle =
  | 'APPEARED'
  | 'FORMING'
  | 'PERSISTING'
  | 'APPROACHED'
  | 'ATTACKED'
  | 'DEFENDING'
  | 'REPLENISHING'
  | 'HOLDING'
  | 'WITHDRAWING'
  | 'UNRELIABLE'
  | 'CONSUMED'
  | 'BROKEN';

export type LevelReliability = 'RELIABLE' | 'MODERATE' | 'UNRELIABLE' | 'SPOOF_LIKE';

export type LevelDataQuality = 'GOOD' | 'PARTIAL' | 'STALE' | 'UNRELIABLE';

export type LevelTrend = 'STRENGTHENING' | 'WEAKENING' | 'STABLE' | 'UNKNOWN';

export type SurvivalState =
  | 'UNTESTED'
  | 'APPROACHED'
  | 'SURVIVING'
  | 'WEAKENING'
  | 'WITHDRAWING'
  | 'DEFENDING'
  | 'BROKEN';

export type WallBattleState =
  | 'ATTACK_NOT_STARTED'
  | 'APPROACHING'
  | 'ATTACKED'
  | 'DEFENDING'
  | 'WEAKENING'
  | 'BREAKING'
  | 'BROKEN'
  | 'HOLDING'
  | 'REPLENISHING'
  | 'WITHDRAWING';

export type WallBattleVerdict =
  | 'SELLERS_DEFENDING'
  | 'BUYERS_BREAKING_WALL'
  | 'BUYERS_DEFENDING'
  | 'SELLERS_BREAKING_WALL'
  | 'NONE';

export type DistanceBand = 'NEAR_TOUCH' | 'MID' | 'DEEP';

export type ApproachCheckpoint = '20' | '10' | '5' | '2' | '1' | 'contact';

export interface LevelMetric {
  value: number | null;
  state: LevelMetricState;
}

export interface LevelStrengthWeights {
  depth: number;
  /** Kept for config compatibility; distance must not enter strength. */
  nearTouch: number;
  replenishment: number;
  survival: number;
  persistence: number;
  reliability: number;
  cancellation: number;
  withdrawal: number;
  netConsumption: number;
}

export interface LevelStrengthConfig {
  weights: LevelStrengthWeights;
  minSizePercentile: number;
  minPersistenceMs: number;
  topLevels: number;
  strongThreshold: number;
  veryStrong: number;
  strong: number;
  moderate: number;
  weak: number;
  zoneBps: number;
  /** Legacy single approach gate; checkpoints are preferred. */
  approachBps: number;
  approachCheckpointsBps: number[];
  mismatchFraction: number;
  breakDrop: number;
  penaltyScale: number;
  distanceWeightK: number;
  /** Below this confidence, state is UNCERTAIN regardless of raw strength. */
  minConfidenceForState: number;
  minConfidenceForTop: number;
  minMaturityForTop: WallMaturity[];
  newMaxMs: number;
  formingMaxMs: number;
  matureMinSnapshots: number;
  nearTouchMaxBps: number;
  midMaxBps: number;
}

export const DEFAULT_LEVEL_STRENGTH_CONFIG: LevelStrengthConfig = {
  weights: {
    depth: 0.15,
    nearTouch: 0, // relevance only — never strength
    replenishment: 0.2,
    survival: 0.2,
    persistence: 0.15,
    reliability: 0.1,
    cancellation: 0.1,
    withdrawal: 0.1,
    netConsumption: 0.1,
  },
  minSizePercentile: 70,
  minPersistenceMs: 8_000,
  topLevels: 6,
  strongThreshold: 60,
  veryStrong: 85,
  strong: 70,
  moderate: 45,
  weak: 30,
  zoneBps: 8,
  approachBps: 20,
  approachCheckpointsBps: [20, 10, 5, 2, 1, 0],
  mismatchFraction: 0.4,
  breakDrop: 40,
  penaltyScale: 1,
  distanceWeightK: 0.04,
  minConfidenceForState: 40,
  minConfidenceForTop: 50,
  minMaturityForTop: ['FORMING', 'MATURE', 'TESTED'],
  newMaxMs: 2_000,
  formingMaxMs: 8_000,
  matureMinSnapshots: 8,
  nearTouchMaxBps: 25,
  midMaxBps: 100,
};

/**
 * One resting price. Sizes are notional. Null scores are missing, not zero.
 * Replenished volume is a subset of newAdded in this project's book accounting,
 * so expected depth does not add it a second time.
 */
export interface LevelObservation {
  price: number;
  side: 'BID' | 'ASK';
  initialSize: number;
  currentSize: number;
  newAdded: number;
  replenished: number;
  consumed: number;
  cancelled: number;
  unresolved: number;
  persistenceMs: number;
  distanceBps: number;
  sizePercentile: number | null;
  replenishmentScore: number | null;
  withdrawalScore: number | null;
  persistenceScore: number | null;
  cancellationScore: number | null;
  consumptionScore: number | null;
  replenishmentState?: LevelMetricState;
  withdrawalState?: LevelMetricState;
  persistenceState?: LevelMetricState;
  cancellationState?: LevelMetricState;
  consumptionState?: LevelMetricState;
  firstSeenDistanceBps: number | null;
  snapshotCount: number;
  closestApproachBps: number | null;
  sizeAtClosestApproach: number | null;
  approachCheckpoints: ApproachCheckpoint[];
  approachWithdrawal: boolean;
  attackCount: number;
  executionCount: number;
  relocated: boolean;
  outOfView: boolean;
  lastUpdatedAt: number;
}

export interface LevelStrengthHistoryPoint {
  timestamp: number;
  price: number;
  side: 'BID' | 'ASK';
  strength: number;
}

export interface LevelStrengthRow {
  price: number;
  side: 'BID' | 'ASK';
  significance: LevelSignificance;
  initialSize: number;
  currentSize: number;
  newAdded: number;
  replenished: number;
  consumed: number;
  cancelled: number;
  survivalRatio: number | null;
  survival: LevelMetric;
  survivalState: SurvivalState;
  persistenceMs: number;
  snapshotCount: number;
  distanceBps: number;
  distanceBand: DistanceBand;
  depthScore: LevelMetric;
  nearTouchScore: LevelMetric;
  replenishmentScore: LevelMetric;
  survivalScore: LevelMetric;
  persistenceScore: LevelMetric;
  reliabilityScore: LevelMetric;
  cancellationScore: LevelMetric;
  consumptionScore: LevelMetric;
  withdrawalScore: LevelMetric;
  netConsumptionPressure: LevelMetric;
  /** Observed components only — missing metrics are not filled with 50. */
  strength: number;
  strengthConfidence: number;
  rankingScore: number;
  relevance: number;
  wallMaturity: WallMaturity;
  reliability: LevelReliability;
  state: LevelStrengthState;
  lifecycle: LevelLifecycle;
  battleState: WallBattleState;
  trend: LevelTrend;
  strengthVelocity: number;
  strengthAcceleration: number;
  history: number[];
  accountingMismatch: boolean;
  reconciliationError: number;
  dataQuality: LevelDataQuality;
  lastUpdatedAt: number;
  attacked: boolean;
  componentsUsed: number;
  componentsAvailable: number;
}

export interface LevelZone {
  side: 'BID' | 'ASK';
  priceMin: number;
  priceMax: number;
  strength: number;
  levelCount: number;
}

export interface LevelRef {
  price: number;
  strength: number;
  strengthConfidence: number;
  rankingScore: number;
  state: LevelStrengthState;
  distanceBps: number;
  relevance: number;
  wallMaturity: WallMaturity;
  trend: LevelTrend;
}

export interface AttackedWallView {
  price: number;
  side: 'ASK' | 'BID';
  buyAttack: number | null;
  sellAttack: number | null;
  wallStrength: number;
  strengthConfidence: number;
  consumption: number | null;
  replenishment: number | null;
  survival: number | null;
  state: WallBattleState;
}

export interface WallBattleView {
  attacked: LevelRef | null;
  currentlyAttackedAsk: AttackedWallView | null;
  currentlyAttackedBid: AttackedWallView | null;
  attackSide: 'BUY' | 'SELL' | null;
  attackPower: number | null;
  battleState: WallBattleState;
  verdict: WallBattleVerdict;
}

export interface LevelWallMap {
  version: typeof LEVEL_STRENGTH_VERSION;
  symbol: string;
  timestamp: number;
  currentPrice: number;
  dataQuality: LevelDataQuality;
  asks: LevelStrengthRow[];
  bids: LevelStrengthRow[];
  nearTouchAsks: LevelStrengthRow[];
  nearTouchBids: LevelStrengthRow[];
  midAsks: LevelStrengthRow[];
  midBids: LevelStrengthRow[];
  deepAsks: LevelStrengthRow[];
  deepBids: LevelStrengthRow[];
  strongestAsk: LevelRef | null;
  strongestBid: LevelRef | null;
  strongestOverallAsk: LevelRef | null;
  strongestOverallBid: LevelRef | null;
  strongestRelevantAsk: LevelRef | null;
  strongestRelevantBid: LevelRef | null;
  nearestStrongAsk: LevelRef | null;
  nearestStrongBid: LevelRef | null;
  currentlyAttackedAsk: AttackedWallView | null;
  currentlyAttackedBid: AttackedWallView | null;
  zones: LevelZone[];
  events: Array<'ASK_WALL_BROKEN' | 'BID_WALL_BROKEN' | 'ASK_WALL_HOLDING' | 'BID_WALL_HOLDING'>;
  battle: WallBattleView;
  sideStrength: { bids: number | null; asks: number | null };
}

export function emptyMetric(state: LevelMetricState = 'UNTESTED'): LevelMetric {
  return { value: null, state };
}

export function observedMetric(value: number): LevelMetric {
  return { value, state: 'OBSERVED' };
}

export function emptyLevelWallMap(symbol = '', timestamp = 0, price = 0): LevelWallMap {
  return {
    version: LEVEL_STRENGTH_VERSION,
    symbol,
    timestamp,
    currentPrice: price,
    dataQuality: 'UNRELIABLE',
    asks: [],
    bids: [],
    nearTouchAsks: [],
    nearTouchBids: [],
    midAsks: [],
    midBids: [],
    deepAsks: [],
    deepBids: [],
    strongestAsk: null,
    strongestBid: null,
    strongestOverallAsk: null,
    strongestOverallBid: null,
    strongestRelevantAsk: null,
    strongestRelevantBid: null,
    nearestStrongAsk: null,
    nearestStrongBid: null,
    currentlyAttackedAsk: null,
    currentlyAttackedBid: null,
    zones: [],
    events: [],
    battle: {
      attacked: null,
      currentlyAttackedAsk: null,
      currentlyAttackedBid: null,
      attackSide: null,
      attackPower: null,
      battleState: 'ATTACK_NOT_STARTED',
      verdict: 'NONE',
    },
    sideStrength: { bids: null, asks: null },
  };
}
