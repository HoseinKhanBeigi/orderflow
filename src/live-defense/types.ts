/**
 * Live liquidity defense — WHO is defending right now.
 * Separate from historical S/R (WHERE structure is).
 * Never promotes order-book walls into historical levels.
 */

export const LIVE_DEFENSE_VERSION = 'LIVE_DEFENSE_V1';

export type LiveDefenseTrend = 'STRENGTHENING' | 'WEAKENING' | 'STABLE';

export type StructuralConfluenceState = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

export type StructureDefenseInterpretation =
  | 'NONE'
  | 'SUPPORT_ACTIVELY_DEFENDED'
  | 'SUPPORT_BREAKING'
  | 'RESISTANCE_ACTIVELY_DEFENDED'
  | 'RESISTANCE_BREAKING'
  | 'SELLERS_TESTING_SUPPORT'
  | 'BUYERS_TESTING_RESISTANCE'
  | 'LIVE_BID_AT_SUPPORT'
  | 'LIVE_ASK_AT_RESISTANCE';

export interface LiveDefenseConfig {
  minConfidence: number;
  minStrength: number;
  /** Prefer walls within this distance (bps) when ranking. */
  preferNearBps: number;
  /** Hard max distance for a wall to be considered relevant. */
  maxDistanceBps: number;
  /** Require at least this maturity rank (NEW=0 … MATURE=3). */
  minMaturityRank: number;
  /** Alignment between live wall and historical level (bps). */
  alignmentMaxBps: number;
  /** Reject STALE / UNRELIABLE dataQuality on the wall row. */
  requireReliable: boolean;
}

export const DEFAULT_LIVE_DEFENSE_CONFIG: LiveDefenseConfig = {
  minConfidence: 50,
  minStrength: 55,
  preferNearBps: 35,
  maxDistanceBps: 80,
  minMaturityRank: 1, // FORMING+
  alignmentMaxBps: 12,
  requireReliable: true,
};

export interface LiveDefenseWall {
  price: number;
  strength: number;
  confidence: number;
  trend: LiveDefenseTrend;
  distanceBps: number;
  relevance: number;
  maturity: string | null;
  lifecycle: string | null;
  state: string | null;
  /** Tooltip metrics — not shown on chart by default. */
  diagnostics: {
    refill: number | null;
    survival: number | null;
    consumption: number | null;
    cancellation: number | null;
    persistenceSec: number | null;
  };
}

export interface HistoricalStructureRef {
  price: number;
  zoneLow?: number;
  zoneHigh?: number;
  strength?: number;
  distanceBps?: number | null;
}

export interface LiveDefenseSnapshot {
  version: typeof LIVE_DEFENSE_VERSION;
  timestamp: number;
  currentPrice: number;

  relevantAsk: LiveDefenseWall | null;
  relevantBid: LiveDefenseWall | null;

  alignment: {
    bidAtSupport: boolean;
    askAtResistance: boolean;
    bidSupportDistanceBps: number | null;
    askResistanceDistanceBps: number | null;
    confluenceState: StructuralConfluenceState;
  };

  interpretation: StructureDefenseInterpretation;
  reasons: string[];
}
