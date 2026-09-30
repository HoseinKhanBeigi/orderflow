import { clamp } from '../core/integrity.js';
import type { FootprintBar } from '../footprint/types.js';
import {
  DEFAULT_LOCATION_CONTEXT_CONFIG,
  LOCATION_CONTEXT_VERSION,
  distanceBps,
  emptyLocationContext,
  type ContactType,
  type LocationArea,
  type LocationContextConfig,
  type LocationContextSnapshot,
  type LocationContextState,
  type LocationDataQuality,
  type LocationLevelView,
  type ResistanceReactionState,
  type StructuralLevel,
  type StructuralLevelSource,
  type StructuralLevelState,
  type SupportReactionState,
} from '../models/location-context.js';

export type {
  LocationContextSnapshot,
  LocationContextConfig,
  StructuralLevel,
} from '../models/location-context.js';
export {
  DEFAULT_LOCATION_CONTEXT_CONFIG,
  LOCATION_CONTEXT_VERSION,
  emptyLocationContext,
  locationTraderLabel,
  distanceBps,
} from '../models/location-context.js';

export interface LocationBarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  totalBuy?: number;
  totalSell?: number;
}

export interface ExternalLevelInput {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  source: StructuralLevelSource;
  strength?: number;
  confidence?: number;
  knownAt?: number;
  state?: StructuralLevelState;
  touches?: number;
}

export interface LocationReactionHints {
  sellEffort?: number | null;
  buyEffort?: number | null;
  buyerDefense?: number | null;
  sellerDefense?: number | null;
  downResult?: number | null;
  upResult?: number | null;
}

export interface LocationContextInput {
  symbol: string;
  /** Candle being located — never used to define the level it is tested against. */
  bar: LocationBarLike;
  /** Prior completed candles only. */
  prior: LocationBarLike[];
  externalLevels?: ExternalLevelInput[];
  reaction?: LocationReactionHints;
  config?: LocationContextConfig;
  /** Only levels with levelKnownAt ≤ bar.time are considered. */
  trackedLevels?: StructuralLevel[];
}

/**
 * Causal location context. Swings are built only from `prior` (completed bars).
 * Pivot at index i requires neighbors inside prior — never the current bar.
 */
export class LocationContextEngine {
  evaluate(input: LocationContextInput): LocationContextSnapshot {
    const config = input.config ?? DEFAULT_LOCATION_CONTEXT_CONFIG;
    const bar = input.bar;
    const empty = emptyLocationContext(input.symbol, bar.time);
    if (!Number.isFinite(bar.close) || bar.close <= 0) return empty;

    const atr = atrOf(input.prior, bar, config.atrPeriod);
    const { atBps, nearBps } = effectiveThresholds(bar.close, atr, config);

    const swingLevels = buildSwingLevels(input.prior, config);
    const external = (input.externalLevels ?? []).map((l) => externalToLevel(l, bar.time));
    const tracked = (input.trackedLevels ?? []).filter((l) => l.levelKnownAt <= bar.time);

    const merged = mergeLevels([...tracked, ...swingLevels, ...external], bar.close);
    if (!merged.length) {
      return {
        ...empty,
        atr,
        effectiveAtBps: atBps,
        effectiveNearBps: nearBps,
        dataQuality: 'INSUFFICIENT_DATA',
        locationContext: 'UNKNOWN',
      };
    }

    const supports = merged
      .filter((l) => l.type === 'SUPPORT' && l.state !== 'BROKEN' && l.state !== 'EXPIRED')
      .sort((a, b) => b.price - a.price);
    const resistances = merged
      .filter((l) => l.type === 'RESISTANCE' && l.state !== 'BROKEN' && l.state !== 'EXPIRED')
      .sort((a, b) => a.price - b.price);

    const nearestSupport = pickNearestBelow(supports, bar.close);
    const nearestResistance = pickNearestAbove(resistances, bar.close);
    const nearbySupports = supports.filter((l) => distanceBps(bar.close, l.price) <= nearBps * 3);
    const nearbyResistances = resistances.filter((l) => distanceBps(bar.close, l.price) <= nearBps * 3);
    const strongestNearbySupport = pickStrongest(nearbySupports);
    const strongestNearbyResistance = pickStrongest(nearbyResistances);

    const supportView = toView(nearestSupport, bar.close);
    const resistanceView = toView(nearestResistance, bar.close);
    const strongSupportView = toView(strongestNearbySupport, bar.close);
    const strongResistanceView = toView(strongestNearbyResistance, bar.close);

    const primary = pickPrimaryLevel(nearestSupport, nearestResistance, bar, atBps, nearBps);
    const contact = contactAgainst(bar, primary.level, primary.side, atBps, nearBps);
    const locationContext = classifyLocation(primary, contact, atBps, nearBps);
    const locationArea = areaOf(locationContext, contact, bar, nearestSupport, nearestResistance, atBps);

    const supportState = supportReaction(
      locationContext,
      contact,
      bar,
      nearestSupport,
      atBps,
      input.reaction,
      config,
    );
    const resistanceState = resistanceReaction(
      locationContext,
      contact,
      bar,
      nearestResistance,
      atBps,
      input.reaction,
      config,
    );

    const levels = merged.map((l) => {
      if (primary.level && l.id === primary.level.id && contact.contactType !== 'NO_TOUCH') {
        return {
          ...l,
          lastTestedAt: bar.time,
          testCount: l.testCount + 1,
          state: l.state === 'ACTIVE' ? ('TESTED' as const) : l.state,
        };
      }
      return l;
    });

    const dataQuality = qualityOf(supports.length, resistances.length, input.prior.length);
    const reasons = reasonsOf(
      locationContext,
      contact,
      supportState,
      resistanceState,
      supportView,
      resistanceView,
    );

    return {
      version: LOCATION_CONTEXT_VERSION,
      timestamp: bar.time,
      symbol: input.symbol,
      locationContext,
      locationArea,
      contactType: contact.contactType,
      nearestSupport: supportView,
      nearestResistance: resistanceView,
      strongestNearbySupport: strongSupportView,
      strongestNearbyResistance: strongResistanceView,
      distanceToSupportBps: supportView?.distanceBps ?? null,
      distanceToResistanceBps: resistanceView?.distanceBps ?? null,
      supportState,
      resistanceState,
      wickContact: contact.wickContact,
      bodyContact: contact.bodyContact,
      closeAtLevel: contact.closeAtLevel,
      closeThroughLevel: contact.closeThroughLevel,
      effectiveAtBps: atBps,
      effectiveNearBps: nearBps,
      atr,
      dataQuality,
      levels,
      reasons,
    };
  }
}

export function evaluateLocationContext(input: LocationContextInput): LocationContextSnapshot {
  return new LocationContextEngine().evaluate(input);
}

export function applyLevelOutcomes(
  levels: StructuralLevel[],
  bar: LocationBarLike,
  atBps: number,
): StructuralLevel[] {
  return levels.map((level) => {
    if (level.state === 'BROKEN' || level.state === 'EXPIRED' || level.state === 'FLIPPED') return level;
    const zone = (level.price * atBps) / 10_000;
    if (level.type === 'RESISTANCE' && bar.close > level.price + zone) {
      return { ...level, state: 'BROKEN', lastTestedAt: bar.time };
    }
    if (level.type === 'SUPPORT' && bar.close < level.price - zone) {
      return { ...level, state: 'BROKEN', lastTestedAt: bar.time };
    }
    return level;
  });
}

export function flipBrokenLevel(level: StructuralLevel, knownAt: number): StructuralLevel | null {
  if (level.state !== 'BROKEN') return null;
  return {
    ...level,
    id: `${level.id}:flip:${knownAt}`,
    type: level.type === 'RESISTANCE' ? 'SUPPORT' : 'RESISTANCE',
    source: 'FLIPPED',
    state: 'FLIPPED',
    levelKnownAt: knownAt,
    createdAt: knownAt,
    testCount: 0,
    lastTestedAt: null,
    touches: 0,
  };
}

function buildSwingLevels(prior: LocationBarLike[], config: LocationContextConfig): StructuralLevel[] {
  if (prior.length < 3) return [];
  const recent = prior.slice(-config.structureLookback);
  const atr = atrOf(prior, recent[recent.length - 1]!, config.atrPeriod);
  const ref = recent[recent.length - 1]!;
  const tol = Math.max(atr * 0.28, (ref.close || 1) * 0.0008);
  const confirm = Math.max(1, config.pivotConfirmBars);

  const levels: StructuralLevel[] = [];
  for (let i = confirm; i < recent.length - confirm; i++) {
    const p = recent[i]!;
    const left = recent.slice(i - confirm, i);
    const right = recent.slice(i + 1, i + 1 + confirm);
    if (left.length < confirm || right.length < confirm) continue;
    const knownAt = right[right.length - 1]!.time;
    const isLow = left.every((b) => p.low <= b.low) && right.every((b) => p.low <= b.low);
    const isHigh = left.every((b) => p.high >= b.high) && right.every((b) => p.high >= b.high);
    if (isLow) {
      levels.push(
        makeLevel({
          type: 'SUPPORT',
          price: p.low,
          source: 'SWING_PIVOT',
          createdAt: p.time,
          knownAt,
          touches: 1,
          atr,
          refPrice: ref.close,
        }),
      );
    }
    if (isHigh) {
      levels.push(
        makeLevel({
          type: 'RESISTANCE',
          price: p.high,
          source: 'SWING_PIVOT',
          createdAt: p.time,
          knownAt,
          touches: 1,
          atr,
          refPrice: ref.close,
        }),
      );
    }
  }

  const window16 = prior.slice(-16);
  if (window16.length >= 3) {
    let absHigh = -Infinity;
    let absLow = Infinity;
    let highAt = 0;
    let lowAt = 0;
    for (const b of window16) {
      if (b.high > absHigh) {
        absHigh = b.high;
        highAt = b.time;
      }
      if (b.low < absLow) {
        absLow = b.low;
        lowAt = b.time;
      }
    }
    if (Number.isFinite(absLow)) {
      levels.push(
        makeLevel({
          type: 'SUPPORT',
          price: absLow,
          source: 'CLUSTERED_EXTREME',
          createdAt: lowAt,
          knownAt: lowAt,
          touches: countNear(
            window16.map((b) => b.low),
            absLow,
            tol,
          ),
          atr,
          refPrice: ref.close,
          strengthBase: 55,
        }),
      );
    }
    if (Number.isFinite(absHigh)) {
      levels.push(
        makeLevel({
          type: 'RESISTANCE',
          price: absHigh,
          source: 'CLUSTERED_EXTREME',
          createdAt: highAt,
          knownAt: highAt,
          touches: countNear(
            window16.map((b) => b.high),
            absHigh,
            tol,
          ),
          atr,
          refPrice: ref.close,
          strengthBase: 55,
        }),
      );
    }
  }

  const lastPrior = prior[prior.length - 1];
  if (lastPrior) {
    levels.push(
      makeLevel({
        type: 'SUPPORT',
        price: lastPrior.low,
        source: 'PRIOR_BAR',
        createdAt: lastPrior.time,
        knownAt: lastPrior.time,
        touches: 1,
        atr,
        refPrice: ref.close,
        strengthBase: 45,
      }),
    );
    levels.push(
      makeLevel({
        type: 'RESISTANCE',
        price: lastPrior.high,
        source: 'PRIOR_BAR',
        createdAt: lastPrior.time,
        knownAt: lastPrior.time,
        touches: 1,
        atr,
        refPrice: ref.close,
        strengthBase: 45,
      }),
    );
  }

  return clusterMerge(levels, tol);
}

function makeLevel(p: {
  type: 'SUPPORT' | 'RESISTANCE';
  price: number;
  source: StructuralLevelSource;
  createdAt: number;
  knownAt: number;
  touches: number;
  atr: number;
  refPrice: number;
  strengthBase?: number;
}): StructuralLevel {
  const recency = 70;
  const swingSignificance = p.source === 'SWING_PIVOT' ? 75 : p.source === 'CLUSTERED_EXTREME' ? 60 : 40;
  const reactionCount = clamp(p.touches * 20, 0, 100);
  const strength = clamp(
    (p.strengthBase ?? 60) * 0.45 + swingSignificance * 0.25 + reactionCount * 0.2 + recency * 0.1,
    0,
    100,
  );
  const confidence = clamp(40 + p.touches * 12 + (p.source === 'SWING_PIVOT' ? 15 : 0), 0, 100);
  return {
    id: `${p.type}:${p.source}:${p.price.toFixed(8)}:${p.knownAt}`,
    type: p.type,
    price: p.price,
    source: p.source,
    strength,
    confidence,
    relevance: 0,
    createdAt: p.createdAt,
    levelKnownAt: p.knownAt,
    lastTestedAt: null,
    testCount: 0,
    state: 'ACTIVE',
    touches: p.touches,
    components: {
      swingSignificance,
      reactionCount,
      recency,
      volumeActivity: 0,
      wallStrength: null,
    },
  };
}

function clusterMerge(levels: StructuralLevel[], tol: number): StructuralLevel[] {
  const byType: Record<'SUPPORT' | 'RESISTANCE', StructuralLevel[]> = { SUPPORT: [], RESISTANCE: [] };
  for (const level of levels) {
    const bucket = byType[level.type];
    const existing = bucket.find((x) => Math.abs(x.price - level.price) <= tol);
    if (!existing) {
      bucket.push(level);
      continue;
    }
    const better =
      level.touches > existing.touches ||
      (level.touches === existing.touches && level.strength > existing.strength) ||
      (level.levelKnownAt < existing.levelKnownAt && level.source === 'SWING_PIVOT');
    if (better) {
      const idx = bucket.indexOf(existing);
      bucket[idx] = {
        ...level,
        touches: Math.max(level.touches, existing.touches),
        strength: Math.max(level.strength, existing.strength),
        levelKnownAt: Math.min(level.levelKnownAt, existing.levelKnownAt),
      };
    } else {
      existing.touches = Math.max(existing.touches, level.touches);
      existing.strength = Math.max(existing.strength, level.strength);
    }
  }
  return [...byType.SUPPORT, ...byType.RESISTANCE];
}

function mergeLevels(levels: StructuralLevel[], price: number): StructuralLevel[] {
  return levels.map((l) => {
    const dist = distanceBps(price, l.price);
    const proximity = clamp(100 - dist / 2, 0, 100);
    const relevance = clamp(
      0.35 * proximity + 0.3 * l.strength + 0.15 * clamp(l.touches * 20, 0, 100) + 0.2 * l.components.recency,
      0,
      100,
    );
    return { ...l, relevance };
  });
}

function externalToLevel(l: ExternalLevelInput, fallbackKnownAt: number): StructuralLevel {
  return {
    id: `EXT:${l.type}:${l.source}:${l.price}:${l.knownAt ?? fallbackKnownAt}`,
    type: l.type,
    price: l.price,
    source: l.source,
    strength: l.strength ?? 70,
    confidence: l.confidence ?? 65,
    relevance: 0,
    createdAt: l.knownAt ?? fallbackKnownAt,
    levelKnownAt: l.knownAt ?? fallbackKnownAt,
    lastTestedAt: null,
    testCount: 0,
    state: l.state ?? 'ACTIVE',
    touches: l.touches ?? 1,
    components: {
      swingSignificance: l.source === 'PASSIVE_WALL' ? 50 : 60,
      reactionCount: (l.touches ?? 1) * 15,
      recency: 80,
      volumeActivity: 0,
      wallStrength: l.source === 'PASSIVE_WALL' ? (l.strength ?? null) : null,
    },
  };
}

function effectiveThresholds(price: number, atr: number, config: LocationContextConfig) {
  const atrBps = price > 0 ? (atr / price) * 10_000 : 0;
  const atBps = Math.max(config.minAtBps, config.atLevelMaxBps, atrBps * config.atAtrFraction);
  const nearBps = Math.max(
    config.minNearBps,
    config.nearLevelMaxBps,
    atrBps * config.nearAtrFraction,
    atBps + 1,
  );
  return { atBps, nearBps };
}

function pickNearestBelow(levels: StructuralLevel[], price: number): StructuralLevel | null {
  let best: StructuralLevel | null = null;
  for (const l of levels) {
    if (l.price > price) continue;
    if (!best || l.price > best.price) best = l;
  }
  if (!best && levels.length) {
    best = [...levels].sort((a, b) => distanceBps(price, a.price) - distanceBps(price, b.price))[0] ?? null;
  }
  return best;
}

function pickNearestAbove(levels: StructuralLevel[], price: number): StructuralLevel | null {
  let best: StructuralLevel | null = null;
  for (const l of levels) {
    if (l.price < price) continue;
    if (!best || l.price < best.price) best = l;
  }
  if (!best && levels.length) {
    best = [...levels].sort((a, b) => distanceBps(price, a.price) - distanceBps(price, b.price))[0] ?? null;
  }
  return best;
}

function pickStrongest(levels: StructuralLevel[]): StructuralLevel | null {
  if (!levels.length) return null;
  return [...levels].sort((a, b) => b.strength - a.strength || b.relevance - a.relevance)[0] ?? null;
}

function toView(level: StructuralLevel | null, price: number): LocationLevelView | null {
  if (!level) return null;
  return {
    price: level.price,
    distanceBps: round1(distanceBps(price, level.price)),
    strength: round1(level.strength),
    confidence: round1(level.confidence),
    relevance: round1(level.relevance),
    state: level.state,
    source: level.source,
    id: level.id,
  };
}

function pickPrimaryLevel(
  support: StructuralLevel | null,
  resistance: StructuralLevel | null,
  bar: LocationBarLike,
  atBps: number,
  _nearBps: number,
): { level: StructuralLevel | null; side: 'SUPPORT' | 'RESISTANCE' | null; distance: number } {
  const sDist = support ? wickDistanceBps(bar, support.price, 'SUPPORT') : Infinity;
  const rDist = resistance ? wickDistanceBps(bar, resistance.price, 'RESISTANCE') : Infinity;
  const sClose = support ? distanceBps(bar.close, support.price) : Infinity;
  const rClose = resistance ? distanceBps(bar.close, resistance.price) : Infinity;
  const sScore = Math.min(sDist, sClose);
  const rScore = Math.min(rDist, rClose);

  if (!Number.isFinite(sScore) && !Number.isFinite(rScore)) {
    return { level: null, side: null, distance: Infinity };
  }
  if (sScore <= atBps && rScore <= atBps) {
    return sDist <= rDist
      ? { level: support, side: 'SUPPORT', distance: sDist }
      : { level: resistance, side: 'RESISTANCE', distance: rDist };
  }
  if (sScore <= rScore) return { level: support, side: 'SUPPORT', distance: sScore };
  return { level: resistance, side: 'RESISTANCE', distance: rScore };
}

function wickDistanceBps(bar: LocationBarLike, level: number, side: 'SUPPORT' | 'RESISTANCE'): number {
  if (side === 'SUPPORT') {
    if (bar.low <= level) return 0;
    return distanceBps(bar.low, level);
  }
  if (bar.high >= level) return 0;
  return distanceBps(bar.high, level);
}

function contactAgainst(
  bar: LocationBarLike,
  level: StructuralLevel | null,
  side: 'SUPPORT' | 'RESISTANCE' | null,
  atBps: number,
  nearBps: number,
): {
  contactType: ContactType;
  wickContact: boolean;
  bodyContact: boolean;
  closeAtLevel: boolean;
  closeThroughLevel: boolean;
  distance: number;
} {
  if (!level || !side) {
    return {
      contactType: 'NO_TOUCH',
      wickContact: false,
      bodyContact: false,
      closeAtLevel: false,
      closeThroughLevel: false,
      distance: Infinity,
    };
  }
  const zone = (level.price * atBps) / 10_000;
  const bodyHigh = Math.max(bar.open, bar.close);
  const bodyLow = Math.min(bar.open, bar.close);

  let wickContact = false;
  let bodyContact = false;
  let closeAtLevel = false;
  let closeThroughLevel = false;
  let distance = distanceBps(bar.close, level.price);

  if (side === 'RESISTANCE') {
    wickContact = bar.high >= level.price - zone;
    bodyContact = bodyHigh >= level.price - zone;
    closeAtLevel = Math.abs(bar.close - level.price) <= zone;
    closeThroughLevel = bar.close > level.price + zone;
    distance = Math.min(distance, wickDistanceBps(bar, level.price, 'RESISTANCE'));
  } else {
    wickContact = bar.low <= level.price + zone;
    bodyContact = bodyLow <= level.price + zone;
    closeAtLevel = Math.abs(bar.close - level.price) <= zone;
    closeThroughLevel = bar.close < level.price - zone;
    distance = Math.min(distance, wickDistanceBps(bar, level.price, 'SUPPORT'));
  }

  let contactType: ContactType = 'NO_TOUCH';
  if (closeThroughLevel) contactType = 'CLOSE_THROUGH_LEVEL';
  else if (closeAtLevel) contactType = 'CLOSE_AT_LEVEL';
  else if (bodyContact) contactType = 'BODY_TOUCH';
  else if (wickContact) contactType = 'WICK_TOUCH';
  else if (distance <= nearBps) contactType = 'NEAR_TOUCH';

  if (contactType === 'NO_TOUCH' && distance <= nearBps) contactType = 'NEAR_TOUCH';

  return { contactType, wickContact, bodyContact, closeAtLevel, closeThroughLevel, distance };
}

function classifyLocation(
  primary: { level: StructuralLevel | null; side: 'SUPPORT' | 'RESISTANCE' | null; distance: number },
  contact: { contactType: ContactType; distance: number },
  atBps: number,
  nearBps: number,
): LocationContextState {
  if (!primary.level || !primary.side) return 'NONE';
  const dist = contact.distance;
  const at =
    dist <= atBps ||
    contact.contactType === 'WICK_TOUCH' ||
    contact.contactType === 'BODY_TOUCH' ||
    contact.contactType === 'CLOSE_AT_LEVEL' ||
    contact.contactType === 'CLOSE_THROUGH_LEVEL';
  const near = !at && dist <= nearBps;

  if (primary.side === 'SUPPORT') {
    if (at) return 'AT_SUPPORT';
    if (near) return 'NEAR_SUPPORT';
  } else {
    if (at) return 'AT_RESISTANCE';
    if (near) return 'NEAR_RESISTANCE';
  }
  return 'BETWEEN_LEVELS';
}

function areaOf(
  location: LocationContextState,
  contact: { contactType: ContactType },
  bar: LocationBarLike,
  support: StructuralLevel | null,
  resistance: StructuralLevel | null,
  atBps: number,
): LocationArea {
  if (location === 'AT_SUPPORT' || location === 'NEAR_SUPPORT') return 'AT_SUPPORT';
  if (location === 'AT_RESISTANCE' || location === 'NEAR_RESISTANCE') return 'AT_RESISTANCE';
  if (location === 'UNKNOWN') return 'UNKNOWN';
  if (resistance && contact.contactType === 'CLOSE_THROUGH_LEVEL' && bar.close > resistance.price) {
    return 'BREAKOUT_AREA';
  }
  if (support && contact.contactType === 'CLOSE_THROUGH_LEVEL' && bar.close < support.price) {
    return 'BREAKDOWN_AREA';
  }
  if (resistance) {
    const zone = (resistance.price * atBps) / 10_000;
    if (bar.high > resistance.price + zone && bar.close < resistance.price) return 'RETEST_AREA';
  }
  if (support) {
    const zone = (support.price * atBps) / 10_000;
    if (bar.low < support.price - zone && bar.close > support.price) return 'RETEST_AREA';
  }
  return 'MID_RANGE';
}

function supportReaction(
  location: LocationContextState,
  contact: { contactType: ContactType; closeThroughLevel: boolean },
  bar: LocationBarLike,
  support: StructuralLevel | null,
  atBps: number,
  reaction: LocationReactionHints | undefined,
  config: LocationContextConfig,
): SupportReactionState {
  if (!support || (location !== 'AT_SUPPORT' && location !== 'NEAR_SUPPORT' && contact.contactType === 'NO_TOUCH')) {
    return 'NONE';
  }
  const zone = (support.price * atBps) / 10_000;
  if (bar.close < support.price - zone && contact.closeThroughLevel) {
    const sell = reaction?.sellEffort;
    const def = reaction?.buyerDefense;
    const down = reaction?.downResult;
    if (
      sell != null &&
      def != null &&
      down != null &&
      sell >= config.breakEffortMin &&
      def <= config.breakDefenseMax &&
      down >= config.breakResultMin
    ) {
      return 'SUPPORT_BROKEN';
    }
    return 'SUPPORT_BREAKING';
  }

  const sell = reaction?.sellEffort ?? null;
  const def = reaction?.buyerDefense ?? null;
  const down = reaction?.downResult ?? null;
  if (
    sell != null &&
    def != null &&
    down != null &&
    sell >= config.holdEffortMin &&
    def >= config.holdDefenseMin &&
    down <= config.holdResultMax
  ) {
    return 'SUPPORT_HOLDING';
  }
  if (bar.low <= support.price + zone && bar.close > support.price) return 'SUPPORT_HOLDING';
  return 'NONE';
}

function resistanceReaction(
  location: LocationContextState,
  contact: { contactType: ContactType; closeThroughLevel: boolean },
  bar: LocationBarLike,
  resistance: StructuralLevel | null,
  atBps: number,
  reaction: LocationReactionHints | undefined,
  config: LocationContextConfig,
): ResistanceReactionState {
  if (
    !resistance ||
    (location !== 'AT_RESISTANCE' && location !== 'NEAR_RESISTANCE' && contact.contactType === 'NO_TOUCH')
  ) {
    return 'NONE';
  }
  const zone = (resistance.price * atBps) / 10_000;
  if (bar.close > resistance.price + zone && contact.closeThroughLevel) {
    const buy = reaction?.buyEffort;
    const def = reaction?.sellerDefense;
    const up = reaction?.upResult;
    if (
      buy != null &&
      def != null &&
      up != null &&
      buy >= config.breakEffortMin &&
      def <= config.breakDefenseMax &&
      up >= config.breakResultMin
    ) {
      return 'RESISTANCE_BROKEN';
    }
    return 'RESISTANCE_BREAKING';
  }

  const buy = reaction?.buyEffort ?? null;
  const def = reaction?.sellerDefense ?? null;
  const up = reaction?.upResult ?? null;
  if (
    buy != null &&
    def != null &&
    up != null &&
    buy >= config.holdEffortMin &&
    def >= config.holdDefenseMin &&
    up <= config.holdResultMax
  ) {
    return 'RESISTANCE_HOLDING';
  }
  if (bar.high >= resistance.price - zone && bar.close < resistance.price) return 'RESISTANCE_HOLDING';
  return 'NONE';
}

function qualityOf(supportCount: number, resistanceCount: number, priorLen: number): LocationDataQuality {
  if (priorLen < 5 || (supportCount === 0 && resistanceCount === 0)) return 'INSUFFICIENT_DATA';
  if (supportCount === 0 || resistanceCount === 0 || priorLen < 10) return 'PARTIAL';
  return 'GOOD';
}

function reasonsOf(
  location: LocationContextState,
  contact: { contactType: ContactType },
  supportState: SupportReactionState,
  resistanceState: ResistanceReactionState,
  support: LocationLevelView | null,
  resistance: LocationLevelView | null,
): string[] {
  const out: string[] = [];
  out.push(`location ${location}`);
  if (contact.contactType !== 'NO_TOUCH') out.push(`contact ${contact.contactType}`);
  if (support) out.push(`support ${support.price} (${support.distanceBps} bps)`);
  if (resistance) out.push(`resistance ${resistance.price} (${resistance.distanceBps} bps)`);
  if (supportState !== 'NONE') out.push(supportState);
  if (resistanceState !== 'NONE') out.push(resistanceState);
  return out.slice(0, 6);
}

function atrOf(prior: LocationBarLike[], bar: LocationBarLike, period: number): number {
  const window = [...prior.slice(-(period - 1)), bar];
  if (window.length < 2) return Math.max(bar.high - bar.low, 1e-12);
  let sum = 0;
  for (let i = 1; i < window.length; i++) {
    const cur = window[i]!;
    const prev = window[i - 1]!;
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
  }
  return Math.max(sum / (window.length - 1), 1e-12);
}

function countNear(values: number[], level: number, tol: number): number {
  let n = 0;
  for (const v of values) if (Math.abs(v - level) <= tol) n += 1;
  return Math.max(1, n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function wallsAsExternalLevels(input: {
  bidWalls?: Array<{ price: number; strength?: number | null }>;
  askWalls?: Array<{ price: number; strength?: number | null }>;
  knownAt: number;
}): ExternalLevelInput[] {
  const out: ExternalLevelInput[] = [];
  for (const w of input.bidWalls ?? []) {
    if (!(w.price > 0)) continue;
    out.push({
      price: w.price,
      type: 'SUPPORT',
      source: 'PASSIVE_WALL',
      strength: w.strength ?? 70,
      knownAt: input.knownAt,
    });
  }
  for (const w of input.askWalls ?? []) {
    if (!(w.price > 0)) continue;
    out.push({
      price: w.price,
      type: 'RESISTANCE',
      source: 'PASSIVE_WALL',
      strength: w.strength ?? 70,
      knownAt: input.knownAt,
    });
  }
  return out;
}

export function fromFootprintBar(bar: FootprintBar): LocationBarLike {
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    totalBuy: bar.totalBuy,
    totalSell: bar.totalSell,
  };
}
