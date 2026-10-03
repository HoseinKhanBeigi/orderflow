import { mergeLocationLabelConfig, type LocationLabelConfig } from './config.js';
import {
  collectLocationCandidates,
  distBpsToZone,
  pickPrimaryLocation,
} from './classify.js';
import {
  LOCATION_LABEL_COMPACT,
  LOCATION_LABEL_SHORT,
  LOCATION_LABEL_VERSION,
  type LocationAnnotation,
  type LocationBarInput,
  type LocationLabel,
} from './types.js';

export { LOCATION_LABEL_VERSION };

function proximityBps(bar: LocationBarInput, cfg: LocationLabelConfig): number {
  const atr = bar.atr;
  if (atr != null && atr > 0 && bar.close > 0) {
    return ((atr * cfg.nearAtrFrac) / bar.close) * 10_000;
  }
  return cfg.nearBps;
}

function buildTooltip(
  primary: LocationLabel,
  confluence: LocationLabel[],
  bar: LocationBarInput,
  prox: number,
): string {
  const lines = [`LOCATION  ${LOCATION_LABEL_SHORT[primary] || primary}`, ''];
  if (bar.resistance) {
    lines.push(
      `Nearest Resistance: ${bar.resistance.zoneLow.toFixed(4)}–${bar.resistance.zoneHigh.toFixed(4)}`,
    );
  }
  if (bar.support) {
    lines.push(
      `Nearest Support: ${bar.support.zoneLow.toFixed(4)}–${bar.support.zoneHigh.toFixed(4)}`,
    );
  }
  if (bar.swingHigh != null) lines.push(`Swing High: ${bar.swingHigh}`);
  if (bar.swingLow != null) lines.push(`Swing Low: ${bar.swingLow}`);
  lines.push(`Proximity band: ${prox.toFixed(1)} bp`);
  if (confluence.length) {
    lines.push('', 'Confluence:');
    for (const c of confluence) lines.push(`  ${LOCATION_LABEL_SHORT[c] || c}`);
  }
  return lines.filter(Boolean).join('\n');
}

export function annotateBarLocation(
  bar: LocationBarInput,
  cfgPartial?: Partial<LocationLabelConfig>,
): LocationAnnotation {
  const cfg = mergeLocationLabelConfig(cfgPartial);
  const candidates = collectLocationCandidates(bar, cfg);
  const { primary, confluence } = pickPrimaryLocation(candidates);
  const prox = proximityBps(bar, cfg);

  return {
    time: bar.time,
    locationLabel: primary,
    locationShort: LOCATION_LABEL_SHORT[primary],
    confluence,
    status: bar.incomplete ? 'PROVISIONAL' : 'CONFIRMED',
    detail: {
      nearestSupport: bar.support ?? null,
      nearestResistance: bar.resistance ?? null,
      swingHigh: bar.swingHigh ?? null,
      swingLow: bar.swingLow ?? null,
      distanceToSupportBps: distBpsToZone(bar.close, bar.support, 'above'),
      distanceToResistanceBps: distBpsToZone(bar.close, bar.resistance, 'below'),
      proximityBps: +prox.toFixed(2),
    },
    tooltip: buildTooltip(primary, confluence, bar, prox),
  };
}

/**
 * Oldest → newest. Levels must already be causal in each bar input (no lookahead).
 */
export function annotateBarsLocation(
  bars: LocationBarInput[],
  cfgPartial?: Partial<LocationLabelConfig>,
): LocationAnnotation[] {
  return bars.map((b) => annotateBarLocation(b, cfgPartial));
}

export function locationDisplayShort(label: LocationLabel, compact = false): string {
  if (compact) return LOCATION_LABEL_COMPACT[label] || '';
  return LOCATION_LABEL_SHORT[label] || '';
}
