import type { FootprintBar } from '../footprint/types.js';
import type {
  CandleClassification,
  ControlState,
  DominantLiquidityEvent,
  SpecialEventType,
} from './candle-classification-types.js';

export type {
  CandleClassification,
  ControlState,
  DominantLiquidityEvent,
  SpecialEventType,
  LiquidityBehaviorState,
  OutcomeType,
  OutcomeDirection,
  ClassificationDataQuality,
} from './candle-classification-types.js';

/** Engine contract version — bump when matching or scoring semantics change. */
export const PATTERN_ENGINE_VERSION = 'pattern-recognition/v1.2.0';

export const CANDLE_LABELS = [
  'BUYER_IN_CONTROL',
  'SELLER_IN_CONTROL',
  'STOP_HUNT_LOW',
  'STOP_HUNT_HIGH',
  'BUYER_ABSORBED',
  'SELLER_ABSORBED',
  'ASKS_PULLED',
  'BIDS_PULLED',
  'UNCLASSIFIED',
] as const;

/**
 * Backward-compatible flat alphabet for transitions / display.
 * Source of truth is `LabeledCandle.classification` (control / liquidity / special / outcome).
 */
export type CandleLabel =
  | 'BUYER_IN_CONTROL'
  | 'SELLER_IN_CONTROL'
  | 'STOP_HUNT_LOW'
  | 'STOP_HUNT_HIGH'
  | 'BUYER_ABSORBED'
  | 'SELLER_ABSORBED'
  | 'ASKS_PULLED'
  | 'BIDS_PULLED'
  | 'UNCLASSIFIED';

export type PatternId =
  | 'BULLISH_LIQUIDITY_REVERSAL'
  | 'BEARISH_LIQUIDITY_REVERSAL'
  | 'BULLISH_CONTINUATION'
  | 'BEARISH_CONTINUATION'
  | 'FAILED_BEARISH_REVERSAL'
  | 'FAILED_BULLISH_REVERSAL'
  | 'BUYER_TRAP_FORMING'
  | 'SELLER_TRAP_FORMING';

export type PatternDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type PatternStatus = 'FORMING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED' | 'PREVIEW';

export type PatternAlertType = 'PATTERN_FORMING' | 'PATTERN_CONFIRMED' | 'PATTERN_FAILED';

export interface PatternStageDef {
  /**
   * Legacy flat labels (matches `candle.label` / primaryDisplayLabel).
   * Prefer dimensional matchers when available.
   */
  labels?: CandleLabel[];
  /** Match control layer (AND with other dimensional fields when set). */
  control?: ControlState[];
  /** Match dominant liquidity event. */
  liquidity?: DominantLiquidityEvent[];
  /** Match special event type. */
  specialEvent?: SpecialEventType[];
  /** Stage may be skipped. */
  optional?: boolean;
  /** Stage may consume consecutive matching candles. */
  repeat?: boolean;
  /** Default 1 when required, 0 when optional. */
  minRepeats?: number;
  /** Default 1 when not repeat, unlimited when repeat. */
  maxRepeats?: number;
  /** Zero or one of these labels may appear immediately before the stage. */
  optionalBefore?: CandleLabel[];
}

export interface PatternFailWhen {
  /** Required stages already matched before a fail label can kill the instance. */
  minStage: number;
  labels?: CandleLabel[];
  control?: ControlState[];
  specialEvent?: SpecialEventType[];
}

export interface PatternDefinition {
  id: PatternId;
  version: number;
  direction: PatternDirection;
  title: string;
  badge: string;
  minBars: number;
  maxBars: number;
  stages: PatternStageDef[];
  /**
   * Higher wins when overlapping candidates compete.
   * Reversals outrank traps (evolution), confirmed structure outranks continuation.
   */
  specificity: number;
  /** Pattern ids this one replaces when both are active (prefix evolution). */
  supersedes?: PatternId[];
  /**
   * When all stages match, keep status FORMING instead of CONFIRMED.
   * Used for trap / exhaustion prefixes.
   */
  completesOnMatch?: boolean;
  /** Minimum required stages before a partial match is reported as FORMING. */
  minFormingStages?: number;
  failWhen?: PatternFailWhen;
}

export interface LabeledCandle {
  timestamp: number;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Display / legacy flat label derived from structured classification. */
  label: CandleLabel;
  labelConfidence: number | null;
  /** Structured CONTROL / LIQUIDITY / SPECIAL / OUTCOME layers. */
  classification: CandleClassification;
  aggressiveBuyPower: number | null;
  aggressiveSellPower: number | null;
  passiveBuyerDefense: number | null;
  passiveSellerDefense: number | null;
  upsideBattleSpread: number | null;
  downsideBattleSpread: number | null;
  bidWithdrawal: number | null;
  askWithdrawal: number | null;
  bidReplenishment: number | null;
  askReplenishment: number | null;
  bidConsumption: number | null;
  askConsumption: number | null;
  bidSurvival: number | null;
  askSurvival: number | null;
  sweepQuality: number | null;
  /** Stored so later studies can condition next-label odds on fuel. Optional. */
  upsideFuel?: number | null;
  downsideFuel?: number | null;
  fuelImbalance?: number | null;
  fuelState?: string | null;
  upsideFuelVelocity?: number | null;
  downsideFuelVelocity?: number | null;
}

export interface ConfidenceComponents {
  stageCompletion: number;
  labelConfidence: number;
  supportingEvidence: number;
  conflictPenalty: number;
}

export interface PatternEvidence {
  labelConfidence: number;
  sweepQuality: number | null;
  controlShift: number | null;
  supportingEvidence: number;
  conflictPenalty: number;
  components: ConfidenceComponents;
}

export interface PatternCandidate {
  id: PatternId;
  version: number;
  patternVersion: string;
  direction: PatternDirection;
  title: string;
  badge: string;
  status: PatternStatus;
  confidence: number;
  startTimestamp: number;
  confirmedTimestamp: number | null;
  failedTimestamp: number | null;
  barsUsed: number;
  stage: number;
  totalStages: number;
  progress: number;
  matchedLabels: CandleLabel[];
  candleTimestamps: number[];
  evidence: PatternEvidence;
  failReason?: string;
}

export interface PatternAlert {
  type: PatternAlertType;
  symbol: string;
  timeframe: string;
  patternId: PatternId;
  patternVersion: string;
  status: PatternStatus;
  stage: number;
  confidence: number;
  timestamp: number;
  message: string;
}

/**
 * Serializable record for later historical analysis.
 * Outcome fields are reserved for an offline process and never set by live recognition.
 */
export interface PatternEvent {
  patternId: PatternId;
  patternVersion: string;
  symbol: string;
  timeframe: string;
  startTimestamp: number;
  confirmedTimestamp: number | null;
  failedTimestamp: number | null;
  direction: PatternDirection;
  status: PatternStatus;
  confidence: number;
  matchedLabels: CandleLabel[];
  candleTimestamps: number[];
  engineVersion: string;
  /** Offline-only. Live recognition leaves these null. */
  outcome: PatternOutcome | null;
}

export interface PatternOutcome {
  returnAfter1m: number | null;
  returnAfter5m: number | null;
  returnAfter15m: number | null;
  mfe: number | null;
  mae: number | null;
  hitUp025: boolean | null;
  hitDown025: boolean | null;
  hitUp050: boolean | null;
  hitDown050: boolean | null;
  hitUp100: boolean | null;
  hitDown100: boolean | null;
  firstBarrier050: 'UP' | 'DOWN' | null;
}

export interface PatternMarker {
  time: number;
  badge: string;
  patternId: PatternId;
  title: string;
  status: PatternStatus;
  confidence: number;
  direction: PatternDirection;
  stage: number;
  totalStages: number;
  progress: number;
  matchedLabels: CandleLabel[];
  barsUsed: number;
}

export interface PatternSnapshot {
  symbol: string;
  timeframe: string;
  currentLabel: CandleLabel | null;
  primaryPattern: PatternCandidate | null;
  candidates: PatternCandidate[];
  markers: PatternMarker[];
  alerts: PatternAlert[];
  engineVersion: string;
  nextState: NextStatePrediction | null;
}

export interface PatternEngineOptions {
  bufferSize?: number;
  definitions?: PatternDefinition[];
}

export type NextStateStatus = 'PREDICTED' | 'NO_CLEAR_PREDICTION';
export type PredictionConfidenceBand = 'LOW' | 'MODERATE' | 'HIGH';

export interface DimensionPrediction<T extends string> {
  status: NextStateStatus;
  prediction: T | null;
  probability: number;
  secondPrediction: T | null;
  secondProbability: number;
  margin: number;
  sampleCount: number;
  distribution: Partial<Record<T | 'OTHER', number>>;
}

export interface NextStatePrediction {
  status: NextStateStatus;
  /** Legacy flat primaryDisplayLabel prediction. */
  prediction: CandleLabel | null;
  probability: number;
  secondPrediction: CandleLabel | null;
  secondProbability: number;
  margin: number;
  confidence: PredictionConfidenceBand;
  confidenceScore: number;
  sampleCount: number;
  sequenceDepth: number;
  patternId: PatternId | null;
  distribution: Partial<Record<CandleLabel | 'OTHER', number>>;
  /** Dimensional transition forecasts from historical counts only. */
  nextControl?: DimensionPrediction<ControlState>;
  nextSpecialEvent?: DimensionPrediction<SpecialEventType | 'NONE'>;
  nextDominantLiquidity?: DimensionPrediction<DominantLiquidityEvent>;
}

export interface CurrentPatternView {
  id: PatternId;
  status: PatternStatus;
  progress: number;
  confidence: number;
  title: string;
  preview: boolean;
}

export interface PredictorOptions {
  minimumTopProbability?: number;
  minimumPredictionMargin?: number;
  minimumSampleCount?: number;
  maxDepth?: number;
}

/** Reserved for later n-gram conditioning. Ignored by V1 lookups. */
export interface TransitionFeatureBuckets {
  patternConfidence?: 'low' | 'mid' | 'high';
  battleStrength?: 'low' | 'mid' | 'high';
  sweepQuality?: 'low' | 'mid' | 'high';
  volatility?: 'low' | 'mid' | 'high';
  liquidity?: 'thin' | 'normal' | 'heavy';
  aggression?: 'low' | 'mid' | 'high';
}

export type FootprintBarLike = Pick<
  FootprintBar,
  'symbol' | 'time' | 'open' | 'high' | 'low' | 'close' | 'totalBuy' | 'totalSell'
> & {
  volume?: number;
};
