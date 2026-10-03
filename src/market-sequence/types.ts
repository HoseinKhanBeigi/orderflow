/**
 * Shared absorption naming (canonical):
 * BUYER_ABSORPTION  = aggressive BUYERS were absorbed by passive asks
 * SELLER_ABSORPTION = aggressive SELLERS were absorbed by passive bids
 *
 * Do not use BUY_ABSORPTION / SELL_ABSORPTION in this module.
 */

export const MARKET_SEQUENCE_VERSION = 'MARKET_SEQUENCE_V2';

export type ReferenceLevelType =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'HISTORICAL_SUPPORT'
  | 'HISTORICAL_RESISTANCE'
  | 'LIQUIDITY_ZONE';

export type SequenceStatus = 'ACTIVE' | 'CONFIRMED' | 'INVALIDATED' | 'EXPIRED';

export type SequenceDirection = 'BULLISH' | 'BEARISH' | 'NONE';

export type CurrentStage =
  | 'LOCATION'
  | 'SWEEP'
  | 'AGGRESSION'
  | 'RESPONSE'
  | 'ABSORPTION'
  | 'FAILURE'
  | 'RECLAIM'
  | 'CONTROL'
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'EXPANSION'
  | 'IDLE'
  | 'INVALIDATED'
  | 'EXPIRED';

export type LocationState =
  | 'AT_SWING_HIGH'
  | 'NEAR_SWING_HIGH'
  | 'AT_SWING_LOW'
  | 'NEAR_SWING_LOW'
  | 'AT_SUPPORT'
  | 'INSIDE_SUPPORT'
  | 'AT_RESISTANCE'
  | 'INSIDE_RESISTANCE'
  | 'AT_LIQUIDITY_ZONE'
  | 'MID_RANGE'
  | 'NONE';

export type SweepState = 'NO_SWEEP' | 'SWEEP_HIGH' | 'SWEEP_LOW';

export type AggressionState =
  | 'BUYERS_AGGRESSIVE'
  | 'SELLERS_AGGRESSIVE'
  | 'BALANCED'
  | 'UNCLEAR';

export type PriceResponseState =
  | 'UP_RESPONSE_STRONG'
  | 'UP_RESPONSE_WEAK'
  | 'DOWN_RESPONSE_STRONG'
  | 'DOWN_RESPONSE_WEAK'
  | 'NO_MEANINGFUL_RESPONSE';

export type EffortResultState =
  | 'BUYERS_EFFECTIVE'
  | 'BUYERS_INEFFECTIVE'
  | 'SELLERS_EFFECTIVE'
  | 'SELLERS_INEFFECTIVE'
  | 'UNCLEAR';

/** Canonical absorption naming — aggressive side that got absorbed. */
export type AbsorptionState =
  | 'NONE'
  | 'POSSIBLE_BUYER_ABSORPTION'
  | 'BUYER_ABSORPTION'
  | 'POSSIBLE_SELLER_ABSORPTION'
  | 'SELLER_ABSORPTION';

export type FailureState =
  | 'NO_FAILURE'
  | 'BUYER_FAILURE_FORMING'
  | 'BUYER_FAILURE_CONFIRMED'
  | 'SELLER_FAILURE_FORMING'
  | 'SELLER_FAILURE_CONFIRMED';

export type ReclaimState =
  | 'NO_RECLAIM'
  | 'WICK_RECLAIM'
  | 'BODY_RECLAIM'
  | 'CLOSE_RECLAIM'
  | 'ACCEPTED_RECLAIM'
  | 'RECLAIM_FAILED';

export type ControlState = 'NO_CONTROL_SHIFT' | 'BUYER_CONTROL_SHIFT' | 'SELLER_CONTROL_SHIFT';

export type BreakoutState =
  | 'NO_STRUCTURAL_BREAK'
  | 'BREAKOUT_FORMING'
  | 'BREAKOUT_CONFIRMED'
  | 'BREAKDOWN_FORMING'
  | 'BREAKDOWN_CONFIRMED';

export type ExpansionState =
  | 'NO_EXPANSION'
  | 'BULLISH_EXPANSION_FORMING'
  | 'BULLISH_EXPANSION_CONFIRMED'
  | 'BEARISH_EXPANSION_FORMING'
  | 'BEARISH_EXPANSION_CONFIRMED';

export type PrimaryLabel =
  | 'NONE'
  | 'SWEEP_H'
  | 'SWEEP_L'
  | 'BUY_EFFECTIVE'
  | 'SELL_EFFECTIVE'
  | 'BUY_ABS'
  | 'SELL_ABS'
  | 'BUY_FAIL'
  | 'SELL_FAIL'
  | 'BULL_RCLM'
  | 'BEAR_RCLM'
  | 'BUY_CTRL'
  | 'SELL_CTRL'
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'BULL_EXP'
  | 'BEAR_EXP';

export type LabelStatus = 'PROVISIONAL' | 'CONFIRMED';

export interface ReferenceLevelRef {
  id: string;
  type: ReferenceLevelType;
  price: number;
  zoneLow?: number;
  zoneHigh?: number;
}

export interface SequenceStages {
  location: LocationState;
  sweep: SweepState;
  aggression: AggressionState;
  response: PriceResponseState;
  effortResult: EffortResultState;
  absorption: AbsorptionState;
  failure: FailureState;
  reclaim: ReclaimState;
  control: ControlState;
  breakout: BreakoutState;
  expansion: ExpansionState;
}

export interface SequenceStageInput {
  timestamp: number;
  symbol: string;
  timeframe: string;
  incomplete?: boolean;

  structure: {
    primaryReference: ReferenceLevelRef | null;
    location: LocationState;
    confluence?: string[];
  };

  sweep: {
    state: SweepState;
    referenceLevelId: string | null;
  };

  aggression: {
    aggressiveBuy: number;
    aggressiveSell: number;
    delta: number;
    cvd: number;
    buyEffort: number;
    sellEffort: number;
    side: AggressionState;
  };

  priceResponse: {
    displacementBps: number;
    bodyEfficiency: number;
    upResult: number;
    downResult: number;
    state: PriceResponseState;
  };

  passiveDefense?: {
    askDefense: number | null;
    bidDefense: number | null;
  };

  absorption: {
    state: AbsorptionState;
    confidence: number;
  };

  /** Prefer FailureReclaim engine outputs when available. */
  failureReclaim?: {
    failureState: FailureState;
    reclaimState: ReclaimState;
    controlShiftState: ControlState;
    setupState?: string;
    invalidated?: boolean;
  };

  battle?: {
    buyerControl: number | null;
    sellerControl: number | null;
  };

  /** Optional structural acceptance signal from structure engines. */
  structuralBreak?: BreakoutState;
}

export interface ActiveSequence {
  sequenceId: string;
  referenceLevelId: string;
  referenceLevelType: ReferenceLevelType;
  referencePrice: number;
  startedAt: number;
  lastUpdatedAt: number;
  direction: SequenceDirection;
  stages: SequenceStages;
  currentStage: CurrentStage;
  status: SequenceStatus;
  barsAlive: number;
  barsSinceProgress: number;
}

export interface CandleSequenceAnnotation {
  candleTimestamp: number;
  symbol: string;
  timeframe: string;
  sequenceId: string | null;
  referenceLevelId: string | null;
  stages: SequenceStages;
  currentStage: CurrentStage;
  primaryLabel: PrimaryLabel;
  primaryShort: string;
  primaryFull: string;
  labelConfidence: number;
  labelStatus: LabelStatus;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  delta: number;
  cvd: number;
  displacementBps: number;
}
