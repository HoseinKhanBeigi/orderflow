import type { LocationLabelConfig } from './config.js';
import type { LocationBarInput, LocationLabel, PriceZone } from './types.js';
import { LOCATION_LABEL_PRIORITY } from './types.js';

function bps(price: number, dist: number): number {
  if (!(price > 0) || !Number.isFinite(dist)) return 0;
  return (Math.abs(dist) / price) * 10_000;
}

function proximityBps(bar: LocationBarInput, cfg: LocationLabelConfig): number {
  const atr = bar.atr;
  if (atr != null && atr > 0 && bar.close > 0) {
    return (atr * cfg.nearAtrFrac) / bar.close * 10_000;
  }
  return cfg.nearBps;
}

function atBandBps(zone: PriceZone, price: number, cfg: LocationLabelConfig): number {
  const width = Math.max(0, zone.zoneHigh - zone.zoneLow);
  const fromWidth = price > 0 ? (width * cfg.atZoneFrac) / price * 10_000 : 0;
  return Math.max(cfg.atMinBps, fromWidth);
}

function mid(z: PriceZone): number {
  return (z.zoneLow + z.zoneHigh) / 2;
}

function classifyVsResistance(
  bar: LocationBarInput,
  zone: PriceZone,
  proxBps: number,
  cfg: LocationLabelConfig,
): LocationLabel | null {
  const c = bar.close;
  const hi = zone.zoneHigh;
  const lo = zone.zoneLow;
  const band = atBandBps(zone, c, cfg);

  // Explicit rejection of higher prices → AT RES (not ABOVE)
  if (bar.rejectedAboveResistance) return 'AT_RESISTANCE';

  if (c >= lo && c <= hi) return 'INSIDE_RESISTANCE';

  // Wick-only / close above without acceptance → AT/NEAR, not ABOVE
  if (c > hi) {
    const aboveBps = bps(c, c - hi);
    if (bar.acceptedAboveResistance) return 'ABOVE_RESISTANCE';
    if (aboveBps <= band) return 'AT_RESISTANCE';
    if (aboveBps <= proxBps) return 'NEAR_RESISTANCE';
    return 'AT_RESISTANCE';
  }

  const belowBps = bps(c, lo - c);
  if (belowBps <= band) return 'AT_RESISTANCE';
  if (belowBps <= proxBps) return 'NEAR_RESISTANCE';
  return 'BELOW_RESISTANCE';
}

function classifyVsSupport(
  bar: LocationBarInput,
  zone: PriceZone,
  proxBps: number,
  cfg: LocationLabelConfig,
): LocationLabel | null {
  const c = bar.close;
  const hi = zone.zoneHigh;
  const lo = zone.zoneLow;
  const band = atBandBps(zone, c, cfg);

  if (bar.rejectedBelowSupport) return 'AT_SUPPORT';

  if (c >= lo && c <= hi) return 'INSIDE_SUPPORT';

  if (c < lo) {
    const belowBps = bps(c, lo - c);
    if (bar.acceptedBelowSupport) return 'BELOW_SUPPORT';
    if (belowBps <= band) return 'AT_SUPPORT';
    if (belowBps <= proxBps) return 'NEAR_SUPPORT';
    return 'BELOW_SUPPORT';
  }

  const aboveBps = bps(c, c - hi);
  if (aboveBps <= band) return 'AT_SUPPORT';
  if (aboveBps <= proxBps) return 'NEAR_SUPPORT';
  return 'ABOVE_SUPPORT';
}

function classifyVsSwing(
  close: number,
  swing: number,
  side: 'HIGH' | 'LOW',
  proxBps: number,
  atBps: number,
): LocationLabel | null {
  const d = bps(close, close - swing);
  if (side === 'HIGH') {
    if (Math.abs(close - swing) / Math.max(close, 1e-12) * 10_000 <= atBps) return 'AT_SWING_HIGH';
    if (close > swing) {
      const above = bps(close, close - swing);
      if (above <= proxBps) return 'NEAR_SWING_HIGH';
      return 'ABOVE_SWING_HIGH';
    }
    if (d <= proxBps) return 'NEAR_SWING_HIGH';
    return null;
  }
  if (Math.abs(close - swing) / Math.max(close, 1e-12) * 10_000 <= atBps) return 'AT_SWING_LOW';
  if (close < swing) {
    const below = bps(close, swing - close);
    if (below <= proxBps) return 'NEAR_SWING_LOW';
    return 'BELOW_SWING_LOW';
  }
  if (d <= proxBps) return 'NEAR_SWING_LOW';
  return null;
}

function insideZone(close: number, z: PriceZone): boolean {
  return close >= z.zoneLow && close <= z.zoneHigh;
}

/**
 * Collect candidate location labels (unordered), then caller picks primary.
 */
export function collectLocationCandidates(
  bar: LocationBarInput,
  cfg: LocationLabelConfig,
): LocationLabel[] {
  const prox = proximityBps(bar, cfg);
  const atBps = cfg.atMinBps;
  const out: LocationLabel[] = [];

  if (bar.support) {
    const s = classifyVsSupport(bar, bar.support, prox, cfg);
    if (s) out.push(s);
  }
  if (bar.resistance) {
    const r = classifyVsResistance(bar, bar.resistance, prox, cfg);
    if (r) out.push(r);
  }

  if (bar.swingHigh != null && Number.isFinite(bar.swingHigh)) {
    const sh = classifyVsSwing(bar.close, bar.swingHigh, 'HIGH', prox, atBps);
    if (sh) out.push(sh);
  }
  if (bar.swingLow != null && Number.isFinite(bar.swingLow)) {
    const sl = classifyVsSwing(bar.close, bar.swingLow, 'LOW', prox, atBps);
    if (sl) out.push(sl);
  }

  if (bar.bidDefenseZone && insideZone(bar.close, bar.bidDefenseZone)) out.push('AT_BID_DEFENSE_ZONE');
  if (bar.askDefenseZone && insideZone(bar.close, bar.askDefenseZone)) out.push('AT_ASK_DEFENSE_ZONE');
  if (bar.liquidityZone && insideZone(bar.close, bar.liquidityZone)) out.push('AT_LIQUIDITY_ZONE');

  // BETWEEN when clearly between S and R and not near either
  if (bar.support && bar.resistance) {
    const aboveSup = bar.close > bar.support.zoneHigh;
    const belowRes = bar.close < bar.resistance.zoneLow;
    const distSup = bps(bar.close, bar.close - bar.support.zoneHigh);
    const distRes = bps(bar.close, bar.resistance.zoneLow - bar.close);
    if (aboveSup && belowRes && distSup > prox && distRes > prox) {
      out.push('BETWEEN_LEVELS');
    }
  }

  return [...new Set(out)];
}

export function pickPrimaryLocation(candidates: LocationLabel[]): {
  primary: LocationLabel;
  confluence: LocationLabel[];
} {
  if (!candidates.length) return { primary: 'NONE', confluence: [] };

  // Mid-range: BETWEEN wins over generic ABOVE_SUP / BELOW_RES when those are the only S/R reads.
  const hasBetween = candidates.includes('BETWEEN_LEVELS');
  const tightSr = candidates.some((c) =>
    /^(INSIDE_|AT_|NEAR_)/.test(c) && (c.includes('SUPPORT') || c.includes('RESISTANCE')),
  );
  let list = [...candidates];
  if (hasBetween && !tightSr) {
    list = list.filter((c) => c !== 'ABOVE_SUPPORT' && c !== 'BELOW_RESISTANCE');
  }

  const ranked = list.sort(
    (a, b) => (LOCATION_LABEL_PRIORITY[b] ?? 0) - (LOCATION_LABEL_PRIORITY[a] ?? 0),
  );
  const primary = ranked[0] ?? 'NONE';
  const confluence = ranked.slice(1);
  return { primary, confluence };
}

export function distBpsToZone(close: number, zone: PriceZone | null | undefined, side: 'above' | 'below'): number | null {
  if (!zone || !(close > 0)) return null;
  if (side === 'above') return +bps(close, close - zone.zoneHigh).toFixed(2);
  return +bps(close, zone.zoneLow - close).toFixed(2);
}
