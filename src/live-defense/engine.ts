import type { LevelRef, LevelStrengthRow, LevelWallMap, LevelTrend, WallMaturity } from '../models/level-strength.js';
import {
  DEFAULT_LIVE_DEFENSE_CONFIG,
  LIVE_DEFENSE_VERSION,
  type HistoricalStructureRef,
  type LiveDefenseConfig,
  type LiveDefenseSnapshot,
  type LiveDefenseTrend,
  type LiveDefenseWall,
  type StructuralConfluenceState,
  type StructureDefenseInterpretation,
} from './types.js';

export {
  DEFAULT_LIVE_DEFENSE_CONFIG,
  LIVE_DEFENSE_VERSION,
} from './types.js';
export type {
  HistoricalStructureRef,
  LiveDefenseConfig,
  LiveDefenseSnapshot,
  LiveDefenseTrend,
  LiveDefenseWall,
  StructuralConfluenceState,
  StructureDefenseInterpretation,
} from './types.js';

const MATURITY_RANK: Record<string, number> = {
  NEW: 0,
  FORMING: 1,
  TESTED: 2,
  MATURE: 3,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function trendOf(t: LevelTrend | string | null | undefined): LiveDefenseTrend {
  const s = String(t || '');
  if (s === 'RISING' || s === 'STRENGTHENING') return 'STRENGTHENING';
  if (s === 'FALLING' || s === 'WEAKENING') return 'WEAKENING';
  return 'STABLE';
}

function maturityRank(m: WallMaturity | string | null | undefined): number {
  if (!m) return 0;
  return MATURITY_RANK[String(m)] ?? 0;
}

function bpsBetween(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(a - b) / a) * 10_000;
}

function zoneContains(price: number, level: HistoricalStructureRef | null | undefined, tolBps: number): boolean {
  if (!level || !(level.price > 0)) return false;
  const lo = level.zoneLow ?? level.price * (1 - tolBps / 10_000);
  const hi = level.zoneHigh ?? level.price * (1 + tolBps / 10_000);
  return price >= lo && price <= hi;
}

function wallPassesFilters(row: LevelStrengthRow, config: LiveDefenseConfig): boolean {
  if (!(row.currentSize > 0) || !(row.price > 0)) return false;
  if (row.state === 'BROKEN' || row.state === 'UNRELIABLE' || row.state === 'UNCERTAIN') return false;
  if (config.requireReliable && (row.dataQuality === 'STALE' || row.dataQuality === 'UNRELIABLE')) return false;
  if (row.strength < config.minStrength) return false;
  if (row.strengthConfidence < config.minConfidence) return false;
  if (maturityRank(row.wallMaturity) < config.minMaturityRank) return false;
  if (row.distanceBps > config.maxDistanceBps) return false;
  return true;
}

/** Score: relevance × nearness boost × strength/confidence — not raw size. */
function selectionScore(row: LevelStrengthRow, config: LiveDefenseConfig): number {
  const nearBoost =
    row.distanceBps <= config.preferNearBps
      ? 1.25
      : clamp(1.25 - (row.distanceBps - config.preferNearBps) / config.maxDistanceBps, 0.55, 1.25);
  const attackBoost = row.attacked ? 1.12 : 1;
  return (
    row.relevance * 0.45 +
    row.strength * 0.3 +
    row.strengthConfidence * 0.15 +
    (100 - Math.min(100, row.distanceBps)) * 0.1
  ) * nearBoost * attackBoost;
}

function toWall(row: LevelStrengthRow): LiveDefenseWall {
  return {
    price: row.price,
    strength: row.strength,
    confidence: row.strengthConfidence,
    trend: trendOf(row.trend),
    distanceBps: row.distanceBps,
    relevance: row.relevance,
    maturity: row.wallMaturity ?? null,
    lifecycle: row.lifecycle ?? null,
    state: row.state ?? null,
    diagnostics: {
      refill: row.replenishmentScore?.value ?? null,
      survival: row.survival?.value ?? row.survivalScore?.value ?? null,
      consumption: row.consumptionScore?.value ?? null,
      cancellation: row.cancellationScore?.value ?? null,
      persistenceSec: row.persistenceMs != null ? row.persistenceMs / 1000 : null,
    },
  };
}

function fromRef(ref: LevelRef | null, config: LiveDefenseConfig): LiveDefenseWall | null {
  if (!ref) return null;
  if (ref.state === 'BROKEN' || ref.state === 'UNRELIABLE' || ref.state === 'UNCERTAIN') return null;
  if (ref.strength < config.minStrength) return null;
  if (ref.strengthConfidence < config.minConfidence) return null;
  if (ref.distanceBps > config.maxDistanceBps) return null;
  return {
    price: ref.price,
    strength: ref.strength,
    confidence: ref.strengthConfidence,
    trend: trendOf(ref.trend),
    distanceBps: ref.distanceBps,
    relevance: ref.relevance,
    maturity: ref.wallMaturity ?? null,
    lifecycle: null,
    state: ref.state ?? null,
    diagnostics: {
      refill: null,
      survival: null,
      consumption: null,
      cancellation: null,
      persistenceSec: null,
    },
  };
}

/**
 * Pick nearest relevant ASK above price / BID below price from the wall map.
 * Falls back to strongestRelevant* only if it still passes quality filters.
 */
export function selectLiveDefense(
  wallMap: LevelWallMap | null | undefined,
  config: Partial<LiveDefenseConfig> = {},
): { ask: LiveDefenseWall | null; bid: LiveDefenseWall | null } {
  const cfg = { ...DEFAULT_LIVE_DEFENSE_CONFIG, ...config };
  if (!wallMap || wallMap.dataQuality === 'STALE') {
    return { ask: null, bid: null };
  }

  const pick = (rows: LevelStrengthRow[], fallback: LevelRef | null): LiveDefenseWall | null => {
    const eligible = rows.filter((r) => wallPassesFilters(r, cfg));
    if (!eligible.length) {
      return fromRef(fallback, cfg);
    }
    eligible.sort((a, b) => selectionScore(b, cfg) - selectionScore(a, cfg));
    return toWall(eligible[0]!);
  };

  return {
    ask: pick(wallMap.asks ?? [], wallMap.strongestRelevantAsk ?? wallMap.nearestStrongAsk),
    bid: pick(wallMap.bids ?? [], wallMap.strongestRelevantBid ?? wallMap.nearestStrongBid),
  };
}

export interface StructureDefenseInput {
  timestamp: number;
  currentPrice: number;
  wallMap: LevelWallMap | null | undefined;
  nearestSupport?: HistoricalStructureRef | null;
  nearestResistance?: HistoricalStructureRef | null;
  /** Historical location label e.g. NEAR_SUPPORT / INSIDE_SUPPORT */
  locationState?: string | null;
  /** Aggression / effort for interpretation. */
  buyAttack?: number | null;
  sellAttack?: number | null;
  upResult?: number | null;
  downResult?: number | null;
  sellersAbsorbed?: boolean;
  buyersAbsorbed?: boolean;
  config?: Partial<LiveDefenseConfig>;
}

export function evaluateStructureDefense(input: StructureDefenseInput): LiveDefenseSnapshot {
  const cfg = { ...DEFAULT_LIVE_DEFENSE_CONFIG, ...input.config };
  const { ask, bid } = selectLiveDefense(input.wallMap, cfg);

  const support = input.nearestSupport ?? null;
  const resistance = input.nearestResistance ?? null;

  const bidAtSupport =
    !!bid &&
    !!support &&
    (zoneContains(bid.price, support, cfg.alignmentMaxBps) ||
      bpsBetween(bid.price, support.price) <= cfg.alignmentMaxBps);
  const askAtResistance =
    !!ask &&
    !!resistance &&
    (zoneContains(ask.price, resistance, cfg.alignmentMaxBps) ||
      bpsBetween(ask.price, resistance.price) <= cfg.alignmentMaxBps);

  const confluenceState = confluenceOf({
    support,
    resistance,
    bid,
    ask,
    bidAtSupport,
    askAtResistance,
    sellersAbsorbed: !!input.sellersAbsorbed,
    buyersAbsorbed: !!input.buyersAbsorbed,
    locationState: input.locationState ?? null,
  });

  const { interpretation, reasons } = interpret({
    locationState: input.locationState ?? null,
    bid,
    ask,
    bidAtSupport,
    askAtResistance,
    buyAttack: input.buyAttack ?? null,
    sellAttack: input.sellAttack ?? null,
    upResult: input.upResult ?? null,
    downResult: input.downResult ?? null,
    sellersAbsorbed: !!input.sellersAbsorbed,
    buyersAbsorbed: !!input.buyersAbsorbed,
  });

  return {
    version: LIVE_DEFENSE_VERSION,
    timestamp: input.timestamp,
    currentPrice: input.currentPrice,
    relevantAsk: ask,
    relevantBid: bid,
    alignment: {
      bidAtSupport,
      askAtResistance,
      bidSupportDistanceBps: bid && support ? bpsBetween(bid.price, support.price) : null,
      askResistanceDistanceBps: ask && resistance ? bpsBetween(ask.price, resistance.price) : null,
      confluenceState,
    },
    interpretation,
    reasons,
  };
}

function confluenceOf(p: {
  support: HistoricalStructureRef | null;
  resistance: HistoricalStructureRef | null;
  bid: LiveDefenseWall | null;
  ask: LiveDefenseWall | null;
  bidAtSupport: boolean;
  askAtResistance: boolean;
  sellersAbsorbed: boolean;
  buyersAbsorbed: boolean;
  locationState: string | null;
}): StructuralConfluenceState {
  let score = 0;
  const loc = String(p.locationState || '');
  const nearSupport = /SUPPORT/.test(loc) && !/BELOW_SUPPORT|ABOVE_RESISTANCE/.test(loc);
  const nearResist = /RESISTANCE/.test(loc) && !/ABOVE_RESISTANCE|BELOW_SUPPORT/.test(loc);

  if (nearSupport && p.support && (p.support.strength ?? 0) >= 65) score += 1;
  if (nearResist && p.resistance && (p.resistance.strength ?? 0) >= 65) score += 1;
  if (p.bidAtSupport && p.bid && p.bid.strength >= 60) score += 2;
  if (p.askAtResistance && p.ask && p.ask.strength >= 60) score += 2;
  if (p.sellersAbsorbed && nearSupport) score += 1;
  if (p.buyersAbsorbed && nearResist) score += 1;

  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MODERATE';
  if (score >= 1) return 'LOW';
  return 'NONE';
}

function interpret(p: {
  locationState: string | null;
  bid: LiveDefenseWall | null;
  ask: LiveDefenseWall | null;
  bidAtSupport: boolean;
  askAtResistance: boolean;
  buyAttack: number | null;
  sellAttack: number | null;
  upResult: number | null;
  downResult: number | null;
  sellersAbsorbed: boolean;
  buyersAbsorbed: boolean;
}): { interpretation: StructureDefenseInterpretation; reasons: string[] } {
  const reasons: string[] = [];
  const loc = String(p.locationState || '');
  const sell = p.sellAttack ?? 0;
  const buy = p.buyAttack ?? 0;
  const down = p.downResult ?? 50;
  const up = p.upResult ?? 50;
  const bidStr = p.bid?.strength ?? 0;
  const askStr = p.ask?.strength ?? 0;
  const bidWeak = !p.bid || bidStr < 40 || p.bid.trend === 'WEAKENING';
  const askWeak = !p.ask || askStr < 40 || p.ask.trend === 'WEAKENING';

  if (/SUPPORT/.test(loc)) {
    if (p.bidAtSupport) reasons.push('LIVE_BID_AT_SUPPORT');
    if (sell >= 65 && bidStr >= 60 && (down <= 40 || p.sellersAbsorbed)) {
      reasons.push('bid defense holding vs sell attack');
      return { interpretation: 'SUPPORT_ACTIVELY_DEFENDED', reasons };
    }
    if (sell >= 70 && bidWeak && down >= 55) {
      reasons.push('bid defense weak; price accepting lower');
      return { interpretation: 'SUPPORT_BREAKING', reasons };
    }
    if (sell >= 55 && (p.bidAtSupport || /NEAR_SUPPORT|INSIDE_SUPPORT|AT_SUPPORT/.test(loc))) {
      return { interpretation: 'SELLERS_TESTING_SUPPORT', reasons: [...reasons, 'sellers testing support'] };
    }
  }

  if (/RESISTANCE/.test(loc)) {
    if (p.askAtResistance) reasons.push('LIVE_ASK_AT_RESISTANCE');
    if (buy >= 65 && askStr >= 60 && (up <= 40 || p.buyersAbsorbed)) {
      reasons.push('ask defense holding vs buy attack');
      return { interpretation: 'RESISTANCE_ACTIVELY_DEFENDED', reasons };
    }
    if (buy >= 70 && askWeak && up >= 55) {
      reasons.push('ask defense weak; price accepting higher');
      return { interpretation: 'RESISTANCE_BREAKING', reasons };
    }
    if (buy >= 55 && (p.askAtResistance || /NEAR_RESISTANCE|INSIDE_RESISTANCE|AT_RESISTANCE/.test(loc))) {
      return { interpretation: 'BUYERS_TESTING_RESISTANCE', reasons: [...reasons, 'buyers testing resistance'] };
    }
  }

  if (p.bidAtSupport) return { interpretation: 'LIVE_BID_AT_SUPPORT', reasons: ['live bid aligned with support'] };
  if (p.askAtResistance) return { interpretation: 'LIVE_ASK_AT_RESISTANCE', reasons: ['live ask aligned with resistance'] };
  return { interpretation: 'NONE', reasons };
}

export function emptyLiveDefense(timestamp = 0, price = 0): LiveDefenseSnapshot {
  return {
    version: LIVE_DEFENSE_VERSION,
    timestamp,
    currentPrice: price,
    relevantAsk: null,
    relevantBid: null,
    alignment: {
      bidAtSupport: false,
      askAtResistance: false,
      bidSupportDistanceBps: null,
      askResistanceDistanceBps: null,
      confluenceState: 'NONE',
    },
    interpretation: 'NONE',
    reasons: [],
  };
}

/** Compact chart / panel label. */
export function liveDefenseLabel(wall: LiveDefenseWall | null, side: 'ASK' | 'BID'): string {
  if (!wall) return `LIVE ${side} NONE`;
  const arrow = wall.trend === 'STRENGTHENING' ? '↑' : wall.trend === 'WEAKENING' ? '↓' : '→';
  return `LIVE ${side} ${wall.price} · ${Math.round(wall.strength)} ${arrow}`;
}
