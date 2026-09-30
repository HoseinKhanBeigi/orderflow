/**
 * Location Context — WHERE price is relative to meaningful support/resistance.
 * Location is context only. It never implies BUY/SELL/LONG/SHORT by itself.
 */

export const LOCATION_CONTEXT_VERSION = 'LOCATION_CONTEXT_V1';

export type LocationContextState =
  | 'AT_SUPPORT'
  | 'NEAR_SUPPORT'
  | 'AT_RESISTANCE'
  | 'NEAR_RESISTANCE'
  | 'BETWEEN_LEVELS'
  | 'NONE'
  | 'UNKNOWN';

export type StructuralLevelType = 'SUPPORT' | 'RESISTANCE';

export type StructuralLevelSource =
  | 'SWING_PIVOT'
  | 'CLUSTERED_EXTREME'
  | 'PRIOR_BAR'
  | 'STRUCTURE_SWING'
  | 'PASSIVE_WALL'
  | 'VOLUME_NODE'
  | 'ABSORPTION'
  | 'FLIPPED';

export type StructuralLevelState =
  | 'ACTIVE'
  | 'TESTED'
  | 'WEAKENING'
  | 'BROKEN'
  | 'FLIPPED'
  | 'EXPIRED';

export type ContactType =
  | 'WICK_TOUCH'
  | 'BODY_TOUCH'
  | 'CLOSE_AT_LEVEL'
  | 'CLOSE_THROUGH_LEVEL'
  | 'NEAR_TOUCH'
  | 'NO_TOUCH';

export type SupportReactionState =
  | 'NONE'
  | 'SUPPORT_HOLDING'
  | 'SUPPORT_BREAKING'
  | 'SUPPORT_BROKEN';

export type ResistanceReactionState =
  | 'NONE'
  | 'RESISTANCE_HOLDING'
  | 'RESISTANCE_BREAKING'
  | 'RESISTANCE_BROKEN';

export type LocationDataQuality = 'GOOD' | 'PARTIAL' | 'INSUFFICIENT_DATA';

export type LocationArea =
  | 'MID_RANGE'
  | 'AT_SUPPORT'
  | 'AT_RESISTANCE'
  | 'BREAKOUT_AREA'
  | 'BREAKDOWN_AREA'
  | 'RETEST_AREA'
  | 'UNKNOWN';

export interface LocationContextConfig {
  /** Distance ≤ this (bps) counts as AT the level. */
  atLevelMaxBps: number;
  /** Distance ≤ this (bps) counts as NEAR the level. */
  nearLevelMaxBps: number;
  /** ATR fraction of price (as bps scale) folded into AT threshold. */
  atAtrFraction: number;
  /** ATR fraction of price folded into NEAR threshold. */
  nearAtrFraction: number;
  /** Floor so tiny markets do not collapse the zone to zero. */
  minAtBps: number;
  minNearBps: number;
  structureLookback: number;
  atrPeriod: number;
  /** Pivot confirmation neighbor count (1 = classic 3-bar pivot). */
  pivotConfirmBars: number;
  /** Soft hold/break gates when effort/defense are supplied. */
  holdEffortMin: number;
  holdDefenseMin: number;
  holdResultMax: number;
  breakEffortMin: number;
  breakDefenseMax: number;
  breakResultMin: number;
}

export const DEFAULT_LOCATION_CONTEXT_CONFIG: LocationContextConfig = {
  atLevelMaxBps: 3,
  nearLevelMaxBps: 10,
  atAtrFraction: 0.15,
  nearAtrFraction: 0.45,
  minAtBps: 2,
  minNearBps: 5,
  structureLookback: 24,
  atrPeriod: 14,
  pivotConfirmBars: 1,
  holdEffortMin: 65,
  holdDefenseMin: 60,
  holdResultMax: 35,
  breakEffortMin: 65,
  breakDefenseMax: 40,
  breakResultMin: 55,
};

export interface StructuralLevel {
  id: string;
  type: StructuralLevelType;
  price: number;
  source: StructuralLevelSource;
  strength: number;
  confidence: number;
  relevance: number;
  createdAt: number;
  /** First time this pivot was causally knowable (right-neighbor closed). */
  levelKnownAt: number;
  lastTestedAt: number | null;
  testCount: number;
  state: StructuralLevelState;
  touches: number;
  components: {
    swingSignificance: number;
    reactionCount: number;
    recency: number;
    volumeActivity: number;
    wallStrength: number | null;
  };
}

export interface LocationLevelView {
  price: number;
  distanceBps: number;
  strength: number;
  confidence: number;
  relevance: number;
  state: StructuralLevelState;
  source: StructuralLevelSource;
  id: string;
}

export interface LocationContextSnapshot {
  version: typeof LOCATION_CONTEXT_VERSION;
  timestamp: number;
  symbol: string;

  locationContext: LocationContextState;
  locationArea: LocationArea;
  contactType: ContactType;

  nearestSupport: LocationLevelView | null;
  nearestResistance: LocationLevelView | null;
  strongestNearbySupport: LocationLevelView | null;
  strongestNearbyResistance: LocationLevelView | null;

  distanceToSupportBps: number | null;
  distanceToResistanceBps: number | null;

  supportState: SupportReactionState;
  resistanceState: ResistanceReactionState;

  wickContact: boolean;
  bodyContact: boolean;
  closeAtLevel: boolean;
  closeThroughLevel: boolean;

  effectiveAtBps: number;
  effectiveNearBps: number;
  atr: number;
  dataQuality: LocationDataQuality;
  levels: StructuralLevel[];
  reasons: string[];
}

export function emptyLocationContext(symbol = '', timestamp = 0): LocationContextSnapshot {
  return {
    version: LOCATION_CONTEXT_VERSION,
    timestamp,
    symbol,
    locationContext: 'UNKNOWN',
    locationArea: 'UNKNOWN',
    contactType: 'NO_TOUCH',
    nearestSupport: null,
    nearestResistance: null,
    strongestNearbySupport: null,
    strongestNearbyResistance: null,
    distanceToSupportBps: null,
    distanceToResistanceBps: null,
    supportState: 'NONE',
    resistanceState: 'NONE',
    wickContact: false,
    bodyContact: false,
    closeAtLevel: false,
    closeThroughLevel: false,
    effectiveAtBps: DEFAULT_LOCATION_CONTEXT_CONFIG.atLevelMaxBps,
    effectiveNearBps: DEFAULT_LOCATION_CONTEXT_CONFIG.nearLevelMaxBps,
    atr: 0,
    dataQuality: 'INSUFFICIENT_DATA',
    levels: [],
    reasons: ['insufficient structure'],
  };
}

/** Compact trader-facing label. */
export function locationTraderLabel(state: LocationContextState): string {
  switch (state) {
    case 'AT_SUPPORT':
      return 'AT SUPPORT';
    case 'NEAR_SUPPORT':
      return 'NEAR SUPPORT';
    case 'AT_RESISTANCE':
      return 'AT RESISTANCE';
    case 'NEAR_RESISTANCE':
      return 'NEAR RESISTANCE';
    case 'BETWEEN_LEVELS':
      return 'BETWEEN LEVELS';
    case 'NONE':
      return 'NO LEVEL';
    default:
      return 'UNKNOWN';
  }
}

export function distanceBps(price: number, level: number): number {
  if (!(price > 0) || !(level > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(price - level) / level) * 10_000;
}
