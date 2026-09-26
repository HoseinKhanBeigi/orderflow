import type { WindowId } from './trade.js';

/**
 * Active / forced executable pressure. Not passive liquidity, not the
 * attack-vs-defense battle, and not whether price moved.
 *
 * Weights are a documented starting mix, not a claim about market physics.
 */
export type FuelState =
  | 'NO_DATA'
  | 'LOW_FUEL'
  | 'BALANCED_FUEL'
  | 'UPSIDE_FUEL_BUILDING'
  | 'DOWNSIDE_FUEL_BUILDING'
  | 'STRONG_UPSIDE_FUEL'
  | 'STRONG_DOWNSIDE_FUEL'
  | 'TWO_SIDED_HIGH_FUEL'
  | 'FORCED_BUY_FUEL'
  | 'FORCED_SELL_FUEL';

export type FuelDataStatus = 'OK' | 'PARTIAL_DATA' | 'STALE_DATA' | 'NO_DATA';

export interface FuelComponent {
  /** Already-normalized 0–100 input. Null means the feed did not provide it. */
  value: number | null;
  /** True when this is inferred (sweep/burst), not an exchange-tagged stop. */
  inferred?: boolean;
}

export interface FuelComponents {
  aggressiveBuyPower: FuelComponent;
  buyVelocity: FuelComponent;
  buyTradeIntensity: FuelComponent;
  largeBuyStrength: FuelComponent;
  buyAcceleration: FuelComponent;
  shortLiquidationStrength: FuelComponent;
  inferredStopBuyFlow: FuelComponent;
  aggressiveSellPower: FuelComponent;
  sellVelocity: FuelComponent;
  sellTradeIntensity: FuelComponent;
  largeSellStrength: FuelComponent;
  sellAcceleration: FuelComponent;
  longLiquidationStrength: FuelComponent;
  inferredStopSellFlow: FuelComponent;
}

export interface MarketFuelSnapshot {
  symbol: string;
  window: WindowId;
  timestamp: number;
  /** Null when the trade tape is missing. Never a silent zero. */
  upsideFuel: number | null;
  downsideFuel: number | null;
  /** UpsideFuel − DownsideFuel, or null when either side is missing. */
  fuelImbalance: number | null;
  /** (up − down) / max(up + down, 1). Null when either side is missing. */
  normalizedFuelImbalance: number | null;
  /**
   * max(upside, downside). High on both sides is intense, not directional.
   * Null when both sides are missing.
   */
  totalFuelIntensity: number | null;
  /** Score points per second. Null until a prior sample exists for this window. */
  upsideFuelVelocity: number | null;
  downsideFuelVelocity: number | null;
  /** Change in fuel velocity. Null until two velocities exist. */
  upsideFuelAcceleration: number | null;
  downsideFuelAcceleration: number | null;
  state: FuelState;
  organicUpsideFuel: number | null;
  forcedUpsideFuel: number | null;
  organicDownsideFuel: number | null;
  forcedDownsideFuel: number | null;
  /** 0–100. Separate from the fuel scores. */
  confidence: number;
  dataStatus: FuelDataStatus;
  components: FuelComponents;
}

export function emptyFuelComponent(): FuelComponent {
  return { value: null };
}
