/**
 * Location context labels — WHERE price is relative to known structure.
 * Does not invent S/R; consumes zones/swings supplied by callers.
 */

export const LOCATION_LABEL_VERSION = 'LOCATION_LABEL_V1';

export type LocationLabel =
  | 'NONE'
  | 'ABOVE_SUPPORT'
  | 'NEAR_SUPPORT'
  | 'AT_SUPPORT'
  | 'INSIDE_SUPPORT'
  | 'BELOW_SUPPORT'
  | 'BELOW_RESISTANCE'
  | 'NEAR_RESISTANCE'
  | 'AT_RESISTANCE'
  | 'INSIDE_RESISTANCE'
  | 'ABOVE_RESISTANCE'
  | 'BETWEEN_LEVELS'
  | 'AT_SWING_HIGH'
  | 'NEAR_SWING_HIGH'
  | 'ABOVE_SWING_HIGH'
  | 'AT_SWING_LOW'
  | 'NEAR_SWING_LOW'
  | 'BELOW_SWING_LOW'
  | 'AT_LIQUIDITY_ZONE'
  | 'AT_BID_DEFENSE_ZONE'
  | 'AT_ASK_DEFENSE_ZONE';

export interface PriceZone {
  zoneLow: number;
  zoneHigh: number;
  /** Optional display id / source. */
  id?: string;
  kind?: 'SUPPORT' | 'RESISTANCE' | 'LIQUIDITY' | 'BID_DEFENSE' | 'ASK_DEFENSE';
}

export interface LocationBarInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Optional ATR for proximity (preferred over fixed $). */
  atr?: number | null;
  support?: PriceZone | null;
  resistance?: PriceZone | null;
  swingHigh?: number | null;
  swingLow?: number | null;
  liquidityZone?: PriceZone | null;
  bidDefenseZone?: PriceZone | null;
  askDefenseZone?: PriceZone | null;
  /**
   * From micro-state / sequence — acceptance above/below changes ABOVE_RES / BELOW_SUP.
   * Wick-only must not produce ABOVE_RESISTANCE / BELOW_SUPPORT.
   */
  acceptedAboveResistance?: boolean;
  acceptedBelowSupport?: boolean;
  rejectedAboveResistance?: boolean;
  rejectedBelowSupport?: boolean;
  incomplete?: boolean;
}

export interface LocationAnnotation {
  time: number;
  locationLabel: LocationLabel;
  locationShort: string;
  confluence: LocationLabel[];
  status: 'PROVISIONAL' | 'CONFIRMED';
  detail: {
    nearestSupport: PriceZone | null;
    nearestResistance: PriceZone | null;
    swingHigh: number | null;
    swingLow: number | null;
    distanceToSupportBps: number | null;
    distanceToResistanceBps: number | null;
    proximityBps: number;
  };
  tooltip: string;
}

export const LOCATION_LABEL_SHORT: Record<LocationLabel, string> = {
  NONE: '',
  ABOVE_SUPPORT: 'ABOVE SUP',
  NEAR_SUPPORT: 'NEAR SUP',
  AT_SUPPORT: 'AT SUP',
  INSIDE_SUPPORT: 'IN SUP',
  BELOW_SUPPORT: 'BELOW SUP',
  BELOW_RESISTANCE: 'BELOW RES',
  NEAR_RESISTANCE: 'NEAR RES',
  AT_RESISTANCE: 'AT RES',
  INSIDE_RESISTANCE: 'IN RES',
  ABOVE_RESISTANCE: 'ABOVE RES',
  BETWEEN_LEVELS: 'BETWEEN',
  AT_SWING_HIGH: 'AT SH',
  NEAR_SWING_HIGH: 'NEAR SH',
  ABOVE_SWING_HIGH: 'ABOVE SH',
  AT_SWING_LOW: 'AT SL',
  NEAR_SWING_LOW: 'NEAR SL',
  BELOW_SWING_LOW: 'BELOW SL',
  AT_LIQUIDITY_ZONE: 'AT LZ',
  AT_BID_DEFENSE_ZONE: 'AT BID DEF',
  AT_ASK_DEFENSE_ZONE: 'AT ASK DEF',
};

/** Compact codes for narrow candles. */
export const LOCATION_LABEL_COMPACT: Record<LocationLabel, string> = {
  NONE: '',
  ABOVE_SUPPORT: 'ABV SUP',
  NEAR_SUPPORT: 'NR SUP',
  AT_SUPPORT: 'AT SUP',
  INSIDE_SUPPORT: 'IN SUP',
  BELOW_SUPPORT: 'BLW SUP',
  BELOW_RESISTANCE: 'BLW RES',
  NEAR_RESISTANCE: 'NR RES',
  AT_RESISTANCE: 'AT RES',
  INSIDE_RESISTANCE: 'IN RES',
  ABOVE_RESISTANCE: 'ABV RES',
  BETWEEN_LEVELS: 'BETWEEN',
  AT_SWING_HIGH: 'AT SH',
  NEAR_SWING_HIGH: 'NR SH',
  ABOVE_SWING_HIGH: 'ABV SH',
  AT_SWING_LOW: 'AT SL',
  NEAR_SWING_LOW: 'NR SL',
  BELOW_SWING_LOW: 'BLW SL',
  AT_LIQUIDITY_ZONE: 'AT LZ',
  AT_BID_DEFENSE_ZONE: 'BID DEF',
  AT_ASK_DEFENSE_ZONE: 'ASK DEF',
};

/** Higher = preferred for display. */
export const LOCATION_LABEL_PRIORITY: Record<LocationLabel, number> = {
  INSIDE_SUPPORT: 100,
  INSIDE_RESISTANCE: 100,
  AT_SUPPORT: 90,
  AT_RESISTANCE: 90,
  AT_BID_DEFENSE_ZONE: 88,
  AT_ASK_DEFENSE_ZONE: 88,
  AT_LIQUIDITY_ZONE: 86,
  NEAR_SUPPORT: 80,
  NEAR_RESISTANCE: 80,
  ABOVE_RESISTANCE: 70,
  BELOW_SUPPORT: 70,
  ABOVE_SUPPORT: 60,
  BELOW_RESISTANCE: 60,
  AT_SWING_HIGH: 50,
  AT_SWING_LOW: 50,
  NEAR_SWING_HIGH: 40,
  NEAR_SWING_LOW: 40,
  ABOVE_SWING_HIGH: 30,
  BELOW_SWING_LOW: 30,
  BETWEEN_LEVELS: 20,
  NONE: 0,
};
