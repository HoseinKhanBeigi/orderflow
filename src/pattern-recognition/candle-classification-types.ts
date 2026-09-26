/**
 * Structured candle classification layers.
 * CONTROL / LIQUIDITY / SPECIAL EVENT / OUTCOME stay separate — never collapse into one enum.
 */

import type { CandleLabel } from './pattern-types.js';

export type ControlState = 'BUYER_IN_CONTROL' | 'SELLER_IN_CONTROL' | 'BALANCED' | 'UNCLEAR';

export type LiquidityBehaviorState =
  | 'LOW'
  | 'NORMAL'
  | 'ELEVATED'
  | 'STRONG'
  | 'EXTREME'
  | 'NO_DATA';

export type DominantLiquidityEvent =
  | 'ASKS_CONSUMED'
  | 'BIDS_CONSUMED'
  | 'ASKS_PULLED'
  | 'BIDS_PULLED'
  | 'ASKS_REPLENISHED'
  | 'BIDS_REPLENISHED'
  | 'ASKS_SURVIVING'
  | 'BIDS_SURVIVING'
  | 'NONE';

export type SpecialEventType =
  | 'STOP_HUNT_HIGH'
  | 'STOP_HUNT_LOW'
  | 'BUYER_ABSORBED'
  | 'SELLER_ABSORBED'
  | 'HELD_SUPPORT'
  | 'REJECTED_RESISTANCE'
  | 'FAILED_BULLISH_REVERSAL'
  | 'FAILED_BEARISH_REVERSAL'
  | 'BREAKOUT_ACCEPTANCE'
  | 'BREAKDOWN_ACCEPTANCE';

export type OutcomeType =
  | 'PRICE_FOLLOWED'
  | 'PRICE_FAILED'
  | 'REVERSAL'
  | 'CONTINUATION'
  | 'NO_FOLLOW_THROUGH'
  | 'NEUTRAL'
  | 'PENDING';

export type OutcomeDirection = 'UP' | 'DOWN' | 'NONE';

export type ClassificationDataQuality =
  | 'OK'
  | 'NO_DATA'
  | 'PARTIAL_DATA'
  | 'STALE_DATA'
  | 'LOW_CONFIDENCE';

export interface LiquidityMetricView {
  /** Normalized 0–100 when known; null when data is missing (never coerced to 0). */
  score: number | null;
  state: LiquidityBehaviorState;
  percentile: number | null;
  zScore: number | null;
  rawValue: number | null;
}

export interface ControlLayer {
  control: ControlState;
  confidence: number;
}

export interface LiquidityBehaviorLayer {
  bidConsumption: LiquidityMetricView;
  bidPulling: LiquidityMetricView;
  bidReplenishment: LiquidityMetricView;
  bidSurvival: LiquidityMetricView;
  askConsumption: LiquidityMetricView;
  askPulling: LiquidityMetricView;
  askReplenishment: LiquidityMetricView;
  askSurvival: LiquidityMetricView;
  dominantEvent: DominantLiquidityEvent;
  dataQuality: ClassificationDataQuality;
}

export interface SpecialEventLayer {
  type: SpecialEventType | null;
  confidence: number | null;
}

export interface OutcomeLayer {
  type: OutcomeType;
  direction: OutcomeDirection;
  confidence: number | null;
}

/**
 * Full structured classification for one completed (or preview) candle.
 * `primaryDisplayLabel` is display/compat only — dimensions are the source of truth.
 */
export interface CandleClassification {
  primaryState: ControlLayer;
  liquidityBehavior: LiquidityBehaviorLayer;
  specialEvent: SpecialEventLayer;
  outcome: OutcomeLayer;
  primaryDisplayLabel: CandleLabel;
}

export const CONTROL_STATES = [
  'BUYER_IN_CONTROL',
  'SELLER_IN_CONTROL',
  'BALANCED',
  'UNCLEAR',
] as const;

export const DOMINANT_LIQUIDITY_EVENTS = [
  'ASKS_CONSUMED',
  'BIDS_CONSUMED',
  'ASKS_PULLED',
  'BIDS_PULLED',
  'ASKS_REPLENISHED',
  'BIDS_REPLENISHED',
  'ASKS_SURVIVING',
  'BIDS_SURVIVING',
  'NONE',
] as const;

export const SPECIAL_EVENT_TYPES = [
  'STOP_HUNT_HIGH',
  'STOP_HUNT_LOW',
  'BUYER_ABSORBED',
  'SELLER_ABSORBED',
  'HELD_SUPPORT',
  'REJECTED_RESISTANCE',
  'FAILED_BULLISH_REVERSAL',
  'FAILED_BEARISH_REVERSAL',
  'BREAKOUT_ACCEPTANCE',
  'BREAKDOWN_ACCEPTANCE',
] as const;

export const LIQUIDITY_BEHAVIOR_STATES = [
  'LOW',
  'NORMAL',
  'ELEVATED',
  'STRONG',
  'EXTREME',
  'NO_DATA',
] as const;
