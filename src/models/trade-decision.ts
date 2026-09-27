/**
 * Simple TRADE DECISION — LONG / SHORT / WAIT only.
 * Consumes existing MarketBattle / MarketFuel / LiquidityResponse / absorption /
 * price-impact outputs. Does not recalculate microstructure.
 */

export const TRADE_DECISION_STRATEGY_VERSION = 'SIMPLE_ATTACK_DEFENSE_V1' as const;

export type TradeDecisionAction = 'LONG' | 'SHORT' | 'WAIT';

export type TradeEntryQuality = 'LOW' | 'MODERATE' | 'HIGH';

/** Internal forming states — UI maps FORMING → WAIT. */
export type TradeDecisionPhase =
  | 'LONG_SETUP_FORMING'
  | 'LONG_CONFIRMATION'
  | 'SHORT_SETUP_FORMING'
  | 'SHORT_CONFIRMATION'
  | 'NO_TRADE';

export interface TradeDecisionSnapshot {
  strategyVersion: typeof TRADE_DECISION_STRATEGY_VERSION;
  action: TradeDecisionAction;
  phase: TradeDecisionPhase;
  confidence: number;
  entryQuality: TradeEntryQuality;
  reasons: string[];
  blockers: string[];
  invalidationReasons: string[];
  metrics: TradeDecisionMetrics;
  timestamp: number;
  symbol: string;
  window: string;
}

export interface TradeDecisionMetrics {
  buyerControl: number | null;
  sellerControl: number | null;
  upsideFuel: number | null;
  downsideFuel: number | null;
  fuelEdge: number | null;
  passiveSellerDefense: number | null;
  passiveBuyerDefense: number | null;
  askConsumption: number | null;
  bidConsumption: number | null;
  askPulling: number | null;
  bidPulling: number | null;
  askReplenishment: number | null;
  bidReplenishment: number | null;
  askSurvival: number | null;
  bidSurvival: number | null;
  upsideFuelVelocity: number | null;
  downsideFuelVelocity: number | null;
  buyerAbsorbed: boolean;
  sellerAbsorbed: boolean;
  priceFollowedUp: boolean;
  priceFollowedDown: boolean;
  dataQuality: 'OK' | 'PARTIAL' | 'STALE' | 'NO_DATA' | 'LOW_CONFIDENCE';
  patternId: string | null;
  patternStatus: string | null;
}
