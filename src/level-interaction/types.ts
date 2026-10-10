/**
 * Failure & Reclaim Engine V3.
 *
 * FAIL ↑ / FAIL ↓: a break attempt that did not hold.
 * REC ↑ / REC ↓: recovery of a previously lost or broken level.
 *
 * No Acceptance detection. A wick is not confirmation.
 * Labels attach to the confirmation candle only.
 */

export const LEVEL_INTERACTION_VERSION = 'FAILURE_RECLAIM_V3';

export type InteractionLevelType =
  | 'HISTORICAL_SUPPORT'
  | 'HISTORICAL_RESISTANCE'
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'PREV_15M_HIGH'
  | 'PREV_15M_LOW'
  | 'BREAKOUT_LEVEL'
  | 'RECLAIMED_LEVEL';

export interface InteractionLevel {
  id: string;
  type: InteractionLevelType;
  price: number;
  zoneLow?: number;
  zoneHigh?: number;
  timeframe: string;
  createdAt: number;
  knownAt: number;
  strength?: number;
  confidence?: number;
}

export type FailedBreakState =
  | 'NONE'
  | 'ATTACK'
  | 'PENETRATION'
  | 'FAILURE_FORMING'
  | 'FAILED_UP'
  | 'FAILED_DOWN'
  | 'FAILURE_INVALIDATED'
  | 'EXPIRED';

export type ReclaimState =
  | 'NONE'
  | 'LEVEL_LOST'
  | 'RETURN_ATTEMPT'
  | 'RECLAIM_FORMING'
  | 'RECLAIMED_UP'
  | 'RECLAIMED_DOWN'
  | 'RECLAIM_FAILED'
  | 'EXPIRED';

export type LevelEventType = 'FAIL_UP' | 'FAIL_DOWN' | 'RECLAIM_UP' | 'RECLAIM_DOWN';

export type LevelEventStatus = 'FORMING' | 'CONFIRMED' | 'PROVISIONAL' | 'INVALIDATED' | 'EXPIRED';

export type CompactLevelLabel = 'FAIL ↑' | 'FAIL ↓' | 'REC ↑' | 'REC ↓';

export interface FootprintLevelLike {
  price: number;
  buy: number;
  sell: number;
}

export interface InteractionBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  totalBuy?: number;
  totalSell?: number;
  aggressiveBuy?: number;
  aggressiveSell?: number;
  levels?: FootprintLevelLike[];
  timeBeyondMs?: number | null;
  askDefense?: number | null;
  bidDefense?: number | null;
  askReplenishment?: number | null;
  bidReplenishment?: number | null;
  incomplete?: boolean;
  hasFootprint?: boolean;
}

export interface LevelEvidence {
  closeBeyond: boolean;
  penetrated: boolean;
  wickOnly: boolean;
  bodyBeyond: boolean;
  consecutiveClosesBeyond: number;
  consecutiveClosesOriginal: number;
  volumeBeyondRatio: number | null;
  timeBeyondMs: number | null;
  delta: number | null;
  deltaRatio: number | null;
  displacementBps: number;
  displacementAtr: number | null;
  bodyEfficiency: number;
  effortSide: 'BUYERS' | 'SELLERS' | 'UNCLEAR';
  effortEffective: boolean;
  imbalanceBeyond: number | null;
  askDefense: number | null;
  bidDefense: number | null;
  followThrough: boolean;
  dataQuality: 'GOOD' | 'PARTIAL' | 'UNAVAILABLE';
}

export interface FailureReclaimEvent {
  id: string;
  levelId: string;
  levelPrice: number;
  type: LevelEventType;
  status: LevelEventStatus;
  eventOriginTime: number;
  confirmedAt?: number;
  confirmationCandleId?: string;
  confidence: number | null;
  dataQuality: string;
  reasons: string[];
}

export interface LevelInteractionEvent extends FailureReclaimEvent {
  eventType: LevelEventType;
  levelType: InteractionLevelType;
  zoneLow?: number;
  zoneHigh?: number;
  timeframe: string;
  originBarTime: number;
  confirmBarTime: number | null;
  direction: 'UP' | 'DOWN';
  compactLabel: CompactLevelLabel;
  reason: string[];
  invalidation: string[];
  sweepReclaim: boolean;
  metrics: {
    delta: number | null;
    deltaRatio: number | null;
    priceProgressAtr: number | null;
    volumeBeyondRatio: number | null;
    timeBeyondMs: number | null;
    askDefense: number | null;
    bidDefense: number | null;
    aggressiveBuy: number | null;
    aggressiveSell: number | null;
  };
}

export interface LevelEventLine {
  eventId: string;
  eventType: LevelEventType;
  price: number;
  zoneLow?: number;
  zoneHigh?: number;
  startTime: number;
  endTime: number;
  confirmTime: number | null;
  pattern: 'SOLID' | 'DASHED' | 'DOTTED';
  color: string;
  label: string;
}

export interface CandleLevelAnnotation {
  time: number;
  compactLabel: CompactLevelLabel | null;
  secondaryLabels: CompactLevelLabel[];
  events: LevelInteractionEvent[];
  status: LevelEventStatus;
  forming: LevelInteractionEvent[];
}

export interface LevelInteractionResult {
  events: LevelInteractionEvent[];
  confirmed: LevelInteractionEvent[];
  lines: LevelEventLine[];
  byTime: Map<number, CandleLevelAnnotation>;
  levelsUsed: InteractionLevel[];
}

export interface ChartViewport {
  times: number[];
  xForIndex: (index: number) => number;
  yForPrice: (price: number) => number;
}

export interface ProjectedEventLine {
  eventId: string;
  price: number;
  x0: number;
  x1: number;
  y: number;
  yZoneLow?: number;
  yZoneHigh?: number;
  visible: boolean;
}

export const LEVEL_EVENT_SHORT: Record<LevelEventType, CompactLevelLabel> = {
  FAIL_UP: 'FAIL ↑',
  FAIL_DOWN: 'FAIL ↓',
  RECLAIM_UP: 'REC ↑',
  RECLAIM_DOWN: 'REC ↓',
};

export const LEVEL_EVENT_PRIORITY: Record<LevelEventType, number> = {
  RECLAIM_UP: 100,
  RECLAIM_DOWN: 100,
  FAIL_UP: 80,
  FAIL_DOWN: 80,
};

/** Pixel gap between the wick high and the FAIL/REC label. */
export const FAIL_RECLAIM_WICK_GAP = 14;

export function failReclaimLabelY(barHighY: number, gap = FAIL_RECLAIM_WICK_GAP): number {
  return barHighY - gap;
}
