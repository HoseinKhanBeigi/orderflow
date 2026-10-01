export const HISTORICAL_SR_VERSION = 'HISTORICAL_SR_V2';

export type HistoricalLevelType = 'SUPPORT' | 'RESISTANCE';

export type HistoricalLevelSource =
  | 'SWING_LOW'
  | 'SWING_HIGH'
  | 'CLUSTERED_SWING'
  | 'BREAKOUT_LEVEL'
  | 'FLIPPED';

export type HistoricalLevelState =
  | 'FORMING'
  | 'ACTIVE'
  | 'TESTED'
  | 'WEAKENING'
  | 'BROKEN'
  | 'FLIPPED_SUPPORT'
  | 'FLIPPED_RESISTANCE'
  | 'EXPIRED';

/** Legacy per-bar interaction labels (kept for compatibility). */
export type HistoricalInteraction =
  | 'APPROACH'
  | 'TOUCH'
  | 'WICK_TOUCH'
  | 'BODY_TOUCH'
  | 'CLOSE_IN_ZONE'
  | 'CLOSE_THROUGH'
  | 'REJECTION'
  | 'BREAK'
  | 'RETEST'
  | 'NONE';

/** Zone location — primary state relative to zone boundaries (not center tick). */
export type HistoricalZoneLocationState =
  | 'ABOVE_SUPPORT'
  | 'NEAR_SUPPORT'
  | 'ENTERING_SUPPORT'
  | 'INSIDE_SUPPORT'
  | 'BELOW_SUPPORT'
  | 'BELOW_RESISTANCE'
  | 'NEAR_RESISTANCE'
  | 'ENTERING_RESISTANCE'
  | 'INSIDE_RESISTANCE'
  | 'ABOVE_RESISTANCE'
  | 'BETWEEN_ZONES'
  | 'NONE'
  | 'UNKNOWN';

/** Zone interaction — separate from location. */
export type HistoricalZoneInteractionState =
  | 'NONE'
  | 'APPROACHING'
  | 'TOUCHED'
  | 'WICK_TOUCH'
  | 'BODY_TOUCH'
  | 'ENTERED'
  | 'REJECTED'
  | 'HELD'
  | 'BREAKING'
  | 'BROKEN'
  | 'ACCEPTED_THROUGH'
  | 'RETESTING'
  | 'FLIPPED';

export type HistoricalZonePressureState =
  | 'NONE'
  | 'SUPPORT_UNDER_PRESSURE'
  | 'RESISTANCE_UNDER_PRESSURE';

export type HistoricalLevelEventType =
  | 'LEVEL_CREATED'
  | 'LEVEL_CONFIRMED'
  | 'LEVEL_TOUCHED'
  | 'LEVEL_HELD'
  | 'LEVEL_BROKEN'
  | 'LEVEL_FLIPPED'
  | 'LEVEL_EXPIRED'
  | 'ZONE_EXPANDED';

export type ZoneCenterMethod = 'WEIGHTED_AVG' | 'MEDIAN' | 'STRONGEST';

export interface HistoricalSRConfig {
  pivotConfirmBars: number;
  structureLookback: number;
  atrPeriod: number;
  /** Zone half-width as fraction of ATR. */
  zoneAtrFraction: number;
  /** Zone half-width floor in bps of price. */
  zoneMinBps: number;
  /** Merge tolerance as fraction of ATR. */
  clusterAtrFraction: number;
  /** Close beyond zone by this ATR fraction to count as break. */
  breakBeyondAtrFraction: number;
  /** Consecutive closes beyond zone to confirm break. */
  breakConfirmCloses: number;
  /** Minimum strength to show as major. */
  majorMinStrength: number;
  touchApproachBps: number;
  /** Distance outside zone (bps) before a visit ends — new return = new test. */
  sessionLeaveBps: number;
  /** Near-zone threshold in bps from zone edge. */
  nearZoneBps: number;
  zoneCenterMethod: ZoneCenterMethod;
  /** Apply timeframe width scaling (1m narrower, HTF wider). */
  timeframeAwareWidth: boolean;
  decayIdleBars: number;
  decayStrengthPerIdle: number;
  maxActiveLevels: number;
}

export const DEFAULT_HISTORICAL_SR_CONFIG: HistoricalSRConfig = {
  pivotConfirmBars: 2,
  structureLookback: 64,
  atrPeriod: 14,
  zoneAtrFraction: 0.22,
  zoneMinBps: 4,
  clusterAtrFraction: 0.3,
  breakBeyondAtrFraction: 0.15,
  breakConfirmCloses: 1,
  majorMinStrength: 62,
  touchApproachBps: 18,
  sessionLeaveBps: 12,
  nearZoneBps: 18,
  zoneCenterMethod: 'WEIGHTED_AVG',
  timeframeAwareWidth: true,
  decayIdleBars: 48,
  decayStrengthPerIdle: 0.35,
  maxActiveLevels: 24,
};

export interface HistoricalBarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  totalBuy?: number;
  totalSell?: number;
}

export type HistoricalSRStrengthState =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'STRONG_BUT_WEAKENING'
  | 'MODERATE'
  | 'WEAK'
  | 'BROKEN';

export type HistoricalReactionTrend = 'STRENGTHENING' | 'STABLE' | 'WEAKENING';

export interface HistoricalReactionSample {
  timestamp: number;
  /** Absolute reaction move as fraction of price (0.02 = 2%). */
  reactionFraction: number;
  /** Same move in ATR units. */
  reactionAtr: number;
  held: boolean;
  kind: 'REJECTION' | 'HOLD' | 'WEAK_BOUNCE' | 'FALSE_BREAK' | 'BREAK';
  sessionId?: string | null;
}

export interface StrengthHistoryPoint {
  timestamp: number;
  strength: number;
  state: HistoricalSRStrengthState;
  confidence: number;
}

export interface HistoricalSRStrengthComponents {
  structureSignificance: number;
  reactionQuality: number;
  holdQuality: number;
  recencyScore: number;
  timeframeScore: number;
  roleFlipScore: number;
  confluenceScore: number;
  weakeningPenalty: number;
}

/** Immutable zone geometry revision for causal replay. */
export interface HistoricalZoneVersion {
  version: number;
  timestamp: number;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  width: number;
  widthBps: number;
  reason: 'CREATED' | 'CLUSTER_EXPAND' | 'FLIP' | 'MANUAL';
}

export interface HistoricalLevel {
  id: string;
  type: HistoricalLevelType;
  /** @deprecated Prefer centerPrice — kept as alias. */
  price: number;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  width: number;
  widthBps: number;
  source: HistoricalLevelSource;
  sourceTimeframe: string;
  sourceCandleTime: number;
  knownAt: number;
  createdAt: number;
  firstSeenAt: number;
  lastInteractionAt: number | null;
  /** Alias of strengthScore — historical structural importance 0–100. */
  strength: number;
  strengthScore: number;
  strengthState: HistoricalSRStrengthState;
  strengthConfidence: number;
  reactionTrend: HistoricalReactionTrend;
  strengthComponents: HistoricalSRStrengthComponents;
  reactionHistory: HistoricalReactionSample[];
  strengthHistory: StrengthHistoryPoint[];
  zoneVersions: HistoricalZoneVersion[];
  roleFlipCount: number;
  roleFlipQuality: number;
  confluenceScore: number;
  multiTimeframeConfluence: boolean;
  confluenceTimeframes: string[];
  /** Strength retained when level breaks — not deleted. */
  historicalStrengthBeforeBreak: number | null;
  /** Independent zone visits (session-aware). */
  touchCount: number;
  /** Successful holds / rejections. */
  holdCount: number;
  rejectionCount: number;
  breakCount: number;
  state: HistoricalLevelState;
  locationState: HistoricalZoneLocationState;
  interactionState: HistoricalZoneInteractionState;
  pressureState: HistoricalZonePressureState;
  activeSessionId: string | null;
  sessionStartedAt: number | null;
  sessionTouchBars: number;
  beyondCloses: number;
  /** Frozen at creation — used for causal snapshot reconstruction. */
  initialSwingSignificance: number;
  pivotWeight: number;
  components: {
    swingSignificance: number;
    reactionCount: number;
    rejectionMagnitude: number;
    recency: number;
    independentTests: number;
  };
}

export interface HistoricalLevelEvent {
  type: HistoricalLevelEventType;
  timestamp: number;
  levelId: string;
  price: number;
  stateBefore: HistoricalLevelState;
  stateAfter: HistoricalLevelState;
  evidence: string;
}

export interface HistoricalLevelSegment {
  levelId: string;
  type: HistoricalLevelType;
  price: number;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  width: number;
  widthBps: number;
  strength: number;
  strengthState: HistoricalSRStrengthState;
  strengthConfidence: number;
  reactionTrend: HistoricalReactionTrend;
  locationState: HistoricalZoneLocationState;
  interactionState: HistoricalZoneInteractionState;
  state: HistoricalLevelState;
  /** Inclusive start (unix seconds typically). */
  fromTime: number;
  /** Inclusive end; null = still open to chart end. */
  toTime: number | null;
  broken: boolean;
  major: boolean;
}

export interface HistoricalCandleSRContext {
  timestamp: number;
  nearestKnownSupport: HistoricalLevel | null;
  nearestKnownResistance: HistoricalLevel | null;
  primaryZone: HistoricalLevel | null;
  /** Primary zone location (explicit zone states). */
  locationState: HistoricalZoneLocationState;
  /** @deprecated Prefer locationState — mapped legacy labels. */
  locationContext:
    | 'AT_SUPPORT'
    | 'NEAR_SUPPORT'
    | 'AT_RESISTANCE'
    | 'NEAR_RESISTANCE'
    | 'BETWEEN_LEVELS'
    | 'NONE'
    | 'UNKNOWN';
  interactionState: HistoricalZoneInteractionState;
  interactionBadge: string;
  supportStrength: number | null;
  supportStrengthState: HistoricalSRStrengthState | null;
  resistanceStrength: number | null;
  resistanceStrengthState: HistoricalSRStrengthState | null;
  supportInteraction: HistoricalInteraction;
  resistanceInteraction: HistoricalInteraction;
  supportLocationState: HistoricalZoneLocationState | null;
  resistanceLocationState: HistoricalZoneLocationState | null;
  knownSupport: HistoricalLevel[];
  knownResistance: HistoricalLevel[];
  multiTfConfluenceLabel: string | null;
}

export interface HistoricalSRSnapshot {
  version: typeof HISTORICAL_SR_VERSION;
  timestamp: number;
  timeframe: string;
  atr: number;
  knownSupport: HistoricalLevel[];
  knownResistance: HistoricalLevel[];
  segments: HistoricalLevelSegment[];
  events: HistoricalLevelEvent[];
  candleContext: HistoricalCandleSRContext | null;
}

export type HistoricalTimeframe = string;
