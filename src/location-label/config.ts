export interface LocationLabelConfig {
  /** Proximity band as fraction of ATR (preferred). */
  nearAtrFrac: number;
  /** Fallback proximity in bps of price when ATR missing. */
  nearBps: number;
  /** Touch band as fraction of zone width (min floor applied). */
  atZoneFrac: number;
  /** Min AT band in bps of price. */
  atMinBps: number;
}

export const DEFAULT_LOCATION_LABEL_CONFIG: LocationLabelConfig = {
  nearAtrFrac: 0.35,
  nearBps: 12,
  atZoneFrac: 0.35,
  atMinBps: 4,
};

export function mergeLocationLabelConfig(
  partial?: Partial<LocationLabelConfig>,
): LocationLabelConfig {
  return { ...DEFAULT_LOCATION_LABEL_CONFIG, ...(partial ?? {}) };
}
