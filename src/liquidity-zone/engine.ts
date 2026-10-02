/**
 * Liquidity Zone Attention — WHERE to watch, not an automatic trade signal.
 *
 * Confirmed Swing → Potential Liquidity Zone → approach → attack vs defense → result.
 * Without liquidation evidence: POTENTIAL_LIQUIDITY_ZONE only.
 * Never: zone touch = SHORT/LONG.
 */

import type { SwingPoint, SwingType } from '../swing-structure/engine.js';
import { distanceBps } from '../swing-structure/engine.js';

export const LIQUIDITY_ZONE_VERSION = 'LIQUIDITY_ZONE_ATTENTION_V1';

export type LiquiditySide = 'BUY_SIDE' | 'SELL_SIDE';

export type ZoneClassification =
  | 'POTENTIAL_LIQUIDITY_ZONE'
  | 'LIQUIDITY_INTEREST_ZONE'
  | 'LIQUIDATION_CONFLUENCE_ZONE';

export type ZoneProximity =
  | 'FAR'
  | 'APPROACHING'
  | 'NEAR'
  | 'INSIDE'
  | 'SWEPT'
  | 'BROKEN'
  | 'RECLAIMED';

export type LiquidityZoneState =
  | 'ACTIVE'
  | 'APPROACHING'
  | 'TESTING'
  | 'SWEPT'
  | 'ABSORBING'
  | 'BREAKING'
  | 'BROKEN'
  | 'RECLAIMED'
  | 'REJECTED'
  | 'EXPIRED';

export type ZoneInteractionOutcome =
  | 'NONE'
  | 'UNCLEAR'
  | 'BUYERS_ABSORBED_AT_SWING_HIGH'
  | 'SELLERS_ABSORBED_AT_SWING_LOW'
  | 'SWING_HIGH_SWEEP'
  | 'SWING_HIGH_SWEEP_RECLAIMED'
  | 'SWING_LOW_SWEEP'
  | 'SWING_LOW_SWEEP_RECLAIMED'
  | 'SWING_HIGH_BREAK'
  | 'SWING_LOW_BREAK'
  | 'WICK_ONLY_PENETRATION';

export type FormingBias =
  | 'NONE'
  | 'SHORT_FORMING'
  | 'LONG_FORMING'
  | 'LONG_CONTINUATION_FORMING'
  | 'SHORT_CONTINUATION_FORMING';

export type LiquidationConfluenceLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

export interface LiquidationClusterInput {
  side: 'SHORT' | 'LONG';
  priceLow: number;
  priceHigh: number;
  /** Optional — omit rather than fabricate. */
  estimatedSize?: number | null;
  confidence?: number | null;
}

export interface FlowAtZoneInput {
  buyEffort: number | null;
  sellEffort: number | null;
  askDefense: number | null;
  bidDefense: number | null;
  askRefill?: number | null;
  bidRefill?: number | null;
  askSurvival?: number | null;
  bidSurvival?: number | null;
  askConsumption?: number | null;
  bidConsumption?: number | null;
  upResult: number | null;
  downResult: number | null;
}

export interface LiveWallInput {
  price: number;
  strength: number;
}

export interface BarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LiquidityZoneConfluenceComponents {
  swingSignificance: number;
  historicalSrOverlap: number;
  liveWallAlignment: number;
  liquidationOverlap: number;
  priorReactions: number;
}

export interface LiquidityZoneConfluence {
  score: number;
  components: LiquidityZoneConfluenceComponents;
  liquidationLevel: LiquidationConfluenceLevel;
}

export interface LiquidityZone {
  id: string;
  sourceType: SwingType;
  sourceSwingId: string;
  price: number;
  zoneLow: number;
  zoneHigh: number;
  liquiditySide: LiquiditySide;
  classification: ZoneClassification;
  swingSignificance: number;
  confidence: number;
  state: LiquidityZoneState;
  proximity: ZoneProximity;
  distanceBps: number | null;
  createdAt: number;
  confirmedAt: number;
  timeframe: string;
  confluence: LiquidityZoneConfluence;
  liveWallAlignment: 'NONE' | 'LIVE_ASK_AT_SWING_HIGH' | 'LIVE_BID_AT_SWING_LOW';
}

export interface ZoneAttentionRead {
  attentionMode: boolean;
  primaryZone: LiquidityZone | null;
  outcome: ZoneInteractionOutcome;
  formingBias: FormingBias;
  attackLabel: string;
  attack: number | null;
  defenseLabel: string;
  defense: number | null;
  resultLabel: string;
  result: number | null;
  interpretation: string;
}

export interface LiquidityZoneSnapshot {
  version: typeof LIQUIDITY_ZONE_VERSION;
  timestamp: number;
  zones: LiquidityZone[];
  attention: ZoneAttentionRead;
}

export interface LiquidityZoneConfig {
  /** Half-width in bps around swing price (before ATR blend). */
  baseHalfWidthBps: number;
  atrFraction: number;
  approachBps: number;
  nearBps: number;
  /** Effort / defense / result thresholds 0–100. */
  effortHigh: number;
  defenseHigh: number;
  defenseWeak: number;
  resultHigh: number;
  resultLow: number;
  acceptBeyondBps: number;
  acceptConfirmCloses: number;
  minSwingSignificance: number;
  maxZones: number;
  liveWallAlignBps: number;
  attentionProximities: ZoneProximity[];
}

export const DEFAULT_LIQUIDITY_ZONE_CONFIG: LiquidityZoneConfig = {
  baseHalfWidthBps: 8,
  atrFraction: 0.12,
  approachBps: 25,
  nearBps: 10,
  effortHigh: 65,
  defenseHigh: 65,
  defenseWeak: 40,
  resultHigh: 65,
  resultLow: 35,
  acceptBeyondBps: 5,
  acceptConfirmCloses: 1,
  minSwingSignificance: 42,
  maxZones: 4,
  liveWallAlignBps: 12,
  attentionProximities: ['APPROACHING', 'NEAR', 'INSIDE', 'SWEPT', 'RECLAIMED'],
};

export interface EvaluateLiquidityZonesInput {
  swings: SwingPoint[];
  asOf: number;
  currentPrice: number;
  currentBar?: BarLike | null;
  atr?: number | null;
  flow?: FlowAtZoneInput | null;
  liveAsk?: LiveWallInput | null;
  liveBid?: LiveWallInput | null;
  historicalResistance?: { low: number; high: number } | null;
  historicalSupport?: { low: number; high: number } | null;
  liquidationClusters?: LiquidationClusterInput[] | null;
  priorReactionCountBySwingId?: Record<string, number>;
  config?: Partial<LiquidityZoneConfig>;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mergeLiquidityZoneConfig(partial?: Partial<LiquidityZoneConfig>): LiquidityZoneConfig {
  return { ...DEFAULT_LIQUIDITY_ZONE_CONFIG, ...partial };
}

export function zoneHalfWidth(price: number, atr: number | null | undefined, cfg: LiquidityZoneConfig, significance: number): number {
  const bpsHalf = (price * cfg.baseHalfWidthBps) / 10_000;
  const atrHalf = atr != null && atr > 0 ? atr * cfg.atrFraction : bpsHalf;
  const sigBoost = 1 + clamp((significance - 50) / 100, -0.15, 0.25);
  return Math.max(bpsHalf, atrHalf) * sigBoost;
}

export function swingsToLiquidityZones(input: {
  swings: SwingPoint[];
  asOf: number;
  atr?: number | null;
  config?: Partial<LiquidityZoneConfig>;
  liquidationClusters?: LiquidationClusterInput[] | null;
  historicalResistance?: { low: number; high: number } | null;
  historicalSupport?: { low: number; high: number } | null;
  liveAsk?: LiveWallInput | null;
  liveBid?: LiveWallInput | null;
  priorReactionCountBySwingId?: Record<string, number>;
}): LiquidityZone[] {
  const cfg = mergeLiquidityZoneConfig(input.config);
  const clusters = input.liquidationClusters ?? [];

  const zones: LiquidityZone[] = [];
  for (const s of input.swings) {
    if (s.pending) continue;
    if (s.confirmedAt > input.asOf) continue; // no lookahead
    if (s.significance < cfg.minSwingSignificance) continue;

    const half = zoneHalfWidth(s.price, input.atr, cfg, s.significance);
    const zoneLow = s.price - half;
    const zoneHigh = s.price + half;
    const liquiditySide: LiquiditySide = s.type === 'SWING_HIGH' ? 'BUY_SIDE' : 'SELL_SIDE';

    const liqOverlap = liquidationOverlapScore(zoneLow, zoneHigh, s.type, clusters);
    const classification: ZoneClassification =
      liqOverlap.level === 'NONE'
        ? 'POTENTIAL_LIQUIDITY_ZONE'
        : 'LIQUIDATION_CONFLUENCE_ZONE';

    const histScore = historicalOverlapScore(
      s.type,
      zoneLow,
      zoneHigh,
      input.historicalResistance,
      input.historicalSupport,
    );
    const wall = liveWallAlignment(s.type, zoneLow, zoneHigh, input.liveAsk, input.liveBid, cfg.liveWallAlignBps);
    const wallScore = wall !== 'NONE' ? 80 : 0;
    const prior = input.priorReactionCountBySwingId?.[s.id] ?? s.testCount ?? 0;
    const priorScore = clamp(prior * 18, 0, 100);

    const components: LiquidityZoneConfluenceComponents = {
      swingSignificance: clamp(s.significance, 0, 100),
      historicalSrOverlap: histScore,
      liveWallAlignment: wallScore,
      liquidationOverlap: liqOverlap.score,
      priorReactions: priorScore,
    };
    const score = Math.round(
      components.swingSignificance * 0.35 +
        components.historicalSrOverlap * 0.2 +
        components.liveWallAlignment * 0.2 +
        components.liquidationOverlap * 0.15 +
        components.priorReactions * 0.1,
    );

    zones.push({
      id: `LZ:${s.id}`,
      sourceType: s.type,
      sourceSwingId: s.id,
      price: s.price,
      zoneLow,
      zoneHigh,
      liquiditySide,
      classification,
      swingSignificance: s.significance,
      confidence: clamp(40 + s.significance * 0.4 + (wall !== 'NONE' ? 8 : 0) + liqOverlap.score * 0.1, 0, 100),
      state: 'ACTIVE',
      proximity: 'FAR',
      distanceBps: null,
      createdAt: s.pivotTime,
      confirmedAt: s.confirmedAt,
      timeframe: s.timeframe,
      confluence: {
        score: clamp(score, 0, 100),
        components,
        liquidationLevel: liqOverlap.level,
      },
      liveWallAlignment: wall,
    });
  }

  return zones
    .sort((a, b) => b.confluence.score - a.confluence.score || b.confirmedAt - a.confirmedAt)
    .slice(0, cfg.maxZones * 2); // trim later by priority with price
}

function rangesOverlap(aLow: number, aHigh: number, bLow: number, bHigh: number): boolean {
  return aLow <= bHigh && bLow <= aHigh;
}

function liquidationOverlapScore(
  zoneLow: number,
  zoneHigh: number,
  swingType: SwingType,
  clusters: LiquidationClusterInput[],
): { score: number; level: LiquidationConfluenceLevel } {
  if (!clusters.length) return { score: 0, level: 'NONE' };
  let best = 0;
  for (const c of clusters) {
    const sideOk =
      (swingType === 'SWING_HIGH' && c.side === 'SHORT') || (swingType === 'SWING_LOW' && c.side === 'LONG');
    if (!sideOk) continue;
    if (!rangesOverlap(zoneLow, zoneHigh, c.priceLow, c.priceHigh)) continue;
    const conf = c.confidence != null ? clamp(c.confidence, 0, 100) : 55;
    best = Math.max(best, conf);
  }
  if (best <= 0) return { score: 0, level: 'NONE' };
  if (best < 40) return { score: best, level: 'LOW' };
  if (best < 70) return { score: best, level: 'MODERATE' };
  return { score: best, level: 'HIGH' };
}

function historicalOverlapScore(
  type: SwingType,
  zoneLow: number,
  zoneHigh: number,
  resistance?: { low: number; high: number } | null,
  support?: { low: number; high: number } | null,
): number {
  if (type === 'SWING_HIGH' && resistance && rangesOverlap(zoneLow, zoneHigh, resistance.low, resistance.high)) {
    return 85;
  }
  if (type === 'SWING_LOW' && support && rangesOverlap(zoneLow, zoneHigh, support.low, support.high)) {
    return 85;
  }
  return 0;
}

export function liveWallAlignment(
  type: SwingType,
  zoneLow: number,
  zoneHigh: number,
  liveAsk?: LiveWallInput | null,
  liveBid?: LiveWallInput | null,
  alignBps = 12,
): 'NONE' | 'LIVE_ASK_AT_SWING_HIGH' | 'LIVE_BID_AT_SWING_LOW' {
  if (type === 'SWING_HIGH' && liveAsk) {
    const mid = (zoneLow + zoneHigh) / 2;
    if (liveAsk.price >= zoneLow && liveAsk.price <= zoneHigh) return 'LIVE_ASK_AT_SWING_HIGH';
    if (distanceBps(liveAsk.price, mid) <= alignBps) return 'LIVE_ASK_AT_SWING_HIGH';
  }
  if (type === 'SWING_LOW' && liveBid) {
    const mid = (zoneLow + zoneHigh) / 2;
    if (liveBid.price >= zoneLow && liveBid.price <= zoneHigh) return 'LIVE_BID_AT_SWING_LOW';
    if (distanceBps(liveBid.price, mid) <= alignBps) return 'LIVE_BID_AT_SWING_LOW';
  }
  return 'NONE';
}

export function classifyProximity(input: {
  price: number;
  bar: BarLike | null | undefined;
  zone: Pick<LiquidityZone, 'zoneLow' | 'zoneHigh' | 'sourceType'>;
  approachBps: number;
  nearBps: number;
  acceptBeyondBps: number;
  priorAcceptedBeyond?: boolean;
}): ZoneProximity {
  const { price, bar, zone, approachBps, nearBps, acceptBeyondBps } = input;
  const mid = (zone.zoneLow + zone.zoneHigh) / 2;
  const d = distanceBps(price, mid);

  const high = bar?.high ?? price;
  const low = bar?.low ?? price;
  const close = bar?.close ?? price;

  if (zone.sourceType === 'SWING_HIGH') {
    if (high > zone.zoneHigh && close < zone.zoneLow) return 'RECLAIMED';
    if (high > zone.zoneHigh && close <= zone.zoneHigh) return 'SWEPT';
    if (close > zone.zoneHigh && distanceBps(close, zone.zoneHigh) >= acceptBeyondBps) {
      return input.priorAcceptedBeyond ? 'BROKEN' : 'BROKEN';
    }
  } else {
    if (low < zone.zoneLow && close > zone.zoneHigh) return 'RECLAIMED';
    if (low < zone.zoneLow && close >= zone.zoneLow) return 'SWEPT';
    if (close < zone.zoneLow && distanceBps(close, zone.zoneLow) >= acceptBeyondBps) {
      return 'BROKEN';
    }
  }

  if (price >= zone.zoneLow && price <= zone.zoneHigh) return 'INSIDE';
  if (d <= nearBps) return 'NEAR';
  if (d <= approachBps) return 'APPROACHING';
  return 'FAR';
}

export function classifyZoneOutcome(input: {
  zone: LiquidityZone;
  proximity: ZoneProximity;
  bar: BarLike | null | undefined;
  flow: FlowAtZoneInput | null | undefined;
  cfg: LiquidityZoneConfig;
}): { outcome: ZoneInteractionOutcome; state: LiquidityZoneState; formingBias: FormingBias; interpretation: string } {
  const { zone, proximity, bar, flow, cfg } = input;
  const f = flow ?? null;
  const isHigh = zone.sourceType === 'SWING_HIGH';

  // Wick-only: pierced but closed back without flow confirmation of break
  if (bar && proximity === 'SWEPT') {
    const wickOnly =
      isHigh
        ? bar.high > zone.zoneHigh && bar.close <= zone.zoneHigh
        : bar.low < zone.zoneLow && bar.close >= zone.zoneLow;

    if (wickOnly && f) {
      const effort = isHigh ? f.buyEffort : f.sellEffort;
      const defense = isHigh ? f.askDefense : f.bidDefense;
      const result = isHigh ? f.upResult : f.downResult;
      const absorbed =
        (effort ?? 0) >= cfg.effortHigh &&
        (defense ?? 0) >= cfg.defenseHigh &&
        (result ?? 100) <= cfg.resultLow;
      if (absorbed) {
        return {
          outcome: isHigh ? 'SWING_HIGH_SWEEP_RECLAIMED' : 'SWING_LOW_SWEEP_RECLAIMED',
          state: 'RECLAIMED',
          formingBias: isHigh ? 'SHORT_FORMING' : 'LONG_FORMING',
          interpretation: isHigh
            ? 'SWING HIGH SWEEP + ABSORPTION'
            : 'SWING LOW SWEEP + SELLER ABSORPTION',
        };
      }
      return {
        outcome: isHigh ? 'SWING_HIGH_SWEEP' : 'SWING_LOW_SWEEP',
        state: 'SWEPT',
        formingBias: 'NONE',
        interpretation: isHigh ? 'Swing high swept — await reclaim/defense' : 'Swing low swept — await reclaim/defense',
      };
    }
    if (wickOnly && !f) {
      return {
        outcome: 'WICK_ONLY_PENETRATION',
        state: 'SWEPT',
        formingBias: 'NONE',
        interpretation: 'Wick penetration only — not acceptance',
      };
    }
  }

  if (proximity === 'RECLAIMED') {
    const absorbed =
      f &&
      (isHigh
        ? (f.buyEffort ?? 0) >= cfg.effortHigh &&
          (f.askDefense ?? 0) >= cfg.defenseHigh &&
          (f.upResult ?? 100) <= cfg.resultLow
        : (f.sellEffort ?? 0) >= cfg.effortHigh &&
          (f.bidDefense ?? 0) >= cfg.defenseHigh &&
          (f.downResult ?? 100) <= cfg.resultLow);
    return {
      outcome: isHigh ? 'SWING_HIGH_SWEEP_RECLAIMED' : 'SWING_LOW_SWEEP_RECLAIMED',
      state: absorbed ? 'RECLAIMED' : 'REJECTED',
      formingBias: absorbed ? (isHigh ? 'SHORT_FORMING' : 'LONG_FORMING') : 'NONE',
      interpretation: absorbed
        ? isHigh
          ? 'SWING HIGH SWEEP + ABSORPTION'
          : 'SWING LOW SWEEP + SELLER ABSORPTION'
        : 'Sweep reclaimed — confirmation incomplete',
    };
  }

  if (proximity === 'BROKEN') {
    const breakout =
      f &&
      (isHigh
        ? (f.buyEffort ?? 0) >= cfg.effortHigh &&
          (f.askDefense ?? 100) <= cfg.defenseWeak &&
          (f.upResult ?? 0) >= cfg.resultHigh
        : (f.sellEffort ?? 0) >= cfg.effortHigh &&
          (f.bidDefense ?? 100) <= cfg.defenseWeak &&
          (f.downResult ?? 0) >= cfg.resultHigh);
    if (breakout) {
      return {
        outcome: isHigh ? 'SWING_HIGH_BREAK' : 'SWING_LOW_BREAK',
        state: 'BROKEN',
        formingBias: isHigh ? 'LONG_CONTINUATION_FORMING' : 'SHORT_CONTINUATION_FORMING',
        interpretation: isHigh ? 'SWING HIGH BROKEN' : 'SWING LOW BROKEN',
      };
    }
    // Close beyond without supporting flow → unclear / breaking
    return {
      outcome: isHigh ? 'SWING_HIGH_BREAK' : 'SWING_LOW_BREAK',
      state: 'BREAKING',
      formingBias: 'NONE',
      interpretation: 'Beyond zone — acceptance/flow confirmation incomplete',
    };
  }

  // Inside / near / approaching — absorption test
  if (
    (proximity === 'INSIDE' || proximity === 'NEAR' || proximity === 'APPROACHING') &&
    f
  ) {
    if (isHigh) {
      const absorbed =
        (f.buyEffort ?? 0) >= cfg.effortHigh &&
        (f.askDefense ?? 0) >= cfg.defenseHigh &&
        (f.upResult ?? 100) <= cfg.resultLow;
      if (absorbed) {
        return {
          outcome: 'BUYERS_ABSORBED_AT_SWING_HIGH',
          state: 'ABSORBING',
          formingBias: 'SHORT_FORMING',
          interpretation: 'BUYERS ABSORBED AT SWING HIGH',
        };
      }
      const breaking =
        (f.buyEffort ?? 0) >= cfg.effortHigh &&
        (f.askDefense ?? 100) <= cfg.defenseWeak &&
        (f.upResult ?? 0) >= cfg.resultHigh;
      if (breaking) {
        return {
          outcome: 'UNCLEAR',
          state: 'BREAKING',
          formingBias: 'LONG_CONTINUATION_FORMING',
          interpretation: 'Ask defense weakening at swing high',
        };
      }
    } else {
      const absorbed =
        (f.sellEffort ?? 0) >= cfg.effortHigh &&
        (f.bidDefense ?? 0) >= cfg.defenseHigh &&
        (f.downResult ?? 100) <= cfg.resultLow;
      if (absorbed) {
        return {
          outcome: 'SELLERS_ABSORBED_AT_SWING_LOW',
          state: 'ABSORBING',
          formingBias: 'LONG_FORMING',
          interpretation: 'SELLERS ABSORBED AT SWING LOW',
        };
      }
      const breaking =
        (f.sellEffort ?? 0) >= cfg.effortHigh &&
        (f.bidDefense ?? 100) <= cfg.defenseWeak &&
        (f.downResult ?? 0) >= cfg.resultHigh;
      if (breaking) {
        return {
          outcome: 'UNCLEAR',
          state: 'BREAKING',
          formingBias: 'SHORT_CONTINUATION_FORMING',
          interpretation: 'Bid defense weakening at swing low',
        };
      }
    }
  }

  if (proximity === 'APPROACHING') {
    return {
      outcome: 'NONE',
      state: 'APPROACHING',
      formingBias: 'NONE',
      interpretation: isHigh ? 'Approaching swing high liquidity interest' : 'Approaching swing low liquidity interest',
    };
  }
  if (proximity === 'NEAR' || proximity === 'INSIDE') {
    return {
      outcome: 'UNCLEAR',
      state: 'TESTING',
      formingBias: 'NONE',
      interpretation: 'Testing zone — await attack vs defense result',
    };
  }

  return {
    outcome: 'NONE',
    state: 'ACTIVE',
    formingBias: 'NONE',
    interpretation: '',
  };
}

export function selectPrimaryZone(
  zones: LiquidityZone[],
  price: number,
): LiquidityZone | null {
  if (!zones.length) return null;
  const scored = zones.map((z) => {
    const mid = (z.zoneLow + z.zoneHigh) / 2;
    const d = distanceBps(price, mid);
    const distScore = clamp(100 - d, 0, 100);
    const priority =
      distScore * 0.35 +
      z.swingSignificance * 0.25 +
      z.confluence.score * 0.25 +
      (z.liveWallAlignment !== 'NONE' ? 15 : 0) +
      (z.confluence.liquidationLevel !== 'NONE' ? 10 : 0);
    return { z, priority, d };
  });
  scored.sort((a, b) => b.priority - a.priority || a.d - b.d);
  return scored[0]?.z ?? null;
}

export function emptyLiquidityZoneSnapshot(timestamp = 0): LiquidityZoneSnapshot {
  return {
    version: LIQUIDITY_ZONE_VERSION,
    timestamp,
    zones: [],
    attention: {
      attentionMode: false,
      primaryZone: null,
      outcome: 'NONE',
      formingBias: 'NONE',
      attackLabel: 'Attack',
      attack: null,
      defenseLabel: 'Defense',
      defense: null,
      resultLabel: 'Result',
      result: null,
      interpretation: '',
    },
  };
}

export function evaluateLiquidityZones(input: EvaluateLiquidityZonesInput): LiquidityZoneSnapshot {
  const cfg = mergeLiquidityZoneConfig(input.config);
  const raw = swingsToLiquidityZones({
    swings: input.swings,
    asOf: input.asOf,
    atr: input.atr,
    config: cfg,
    liquidationClusters: input.liquidationClusters,
    historicalResistance: input.historicalResistance,
    historicalSupport: input.historicalSupport,
    liveAsk: input.liveAsk,
    liveBid: input.liveBid,
    priorReactionCountBySwingId: input.priorReactionCountBySwingId,
  });

  const bar = input.currentBar ?? null;
  const enriched: LiquidityZone[] = raw.map((z) => {
    const proximity = classifyProximity({
      price: input.currentPrice,
      bar,
      zone: z,
      approachBps: cfg.approachBps,
      nearBps: cfg.nearBps,
      acceptBeyondBps: cfg.acceptBeyondBps,
    });
    const mid = (z.zoneLow + z.zoneHigh) / 2;
    const { state } = classifyZoneOutcome({
      zone: z,
      proximity,
      bar,
      flow: input.flow,
      cfg,
    });
    return {
      ...z,
      proximity,
      distanceBps: distanceBps(input.currentPrice, mid),
      state,
    };
  });

  // Keep nearest meaningful zones for display
  const sorted = [...enriched].sort(
    (a, b) => (a.distanceBps ?? 1e9) - (b.distanceBps ?? 1e9) || b.confluence.score - a.confluence.score,
  );
  const zones = sorted.slice(0, cfg.maxZones);
  const primary = selectPrimaryZone(zones, input.currentPrice);

  let attention: ZoneAttentionRead = {
    attentionMode: false,
    primaryZone: primary,
    outcome: 'NONE',
    formingBias: 'NONE',
    attackLabel: 'Attack',
    attack: null,
    defenseLabel: 'Defense',
    defense: null,
    resultLabel: 'Result',
    result: null,
    interpretation: '',
  };

  if (primary) {
    const read = classifyZoneOutcome({
      zone: primary,
      proximity: primary.proximity,
      bar,
      flow: input.flow,
      cfg,
    });
    const isHigh = primary.sourceType === 'SWING_HIGH';
    const f = input.flow;
    attention = {
      attentionMode: cfg.attentionProximities.includes(primary.proximity),
      primaryZone: { ...primary, state: read.state },
      outcome: read.outcome,
      formingBias: read.formingBias,
      attackLabel: isHigh ? 'Buy Attack' : 'Sell Attack',
      attack: isHigh ? (f?.buyEffort ?? null) : (f?.sellEffort ?? null),
      defenseLabel: isHigh ? 'Ask Defense' : 'Bid Defense',
      defense: isHigh ? (f?.askDefense ?? null) : (f?.bidDefense ?? null),
      resultLabel: isHigh ? 'Up Result' : 'Down Result',
      result: isHigh ? (f?.upResult ?? null) : (f?.downResult ?? null),
      interpretation: read.interpretation,
    };
  }

  return {
    version: LIQUIDITY_ZONE_VERSION,
    timestamp: input.asOf,
    zones: zones.map((z) =>
      attention.primaryZone && z.id === attention.primaryZone.id
        ? { ...z, state: attention.primaryZone.state }
        : z,
    ),
    attention,
  };
}

export function liquidityZoneBadge(snap: LiquidityZoneSnapshot | null): string {
  if (!snap?.attention?.attentionMode || !snap.attention.primaryZone) return '';
  const z = snap.attention.primaryZone;
  const side = z.sourceType === 'SWING_HIGH' ? 'SWING HIGH' : 'SWING LOW';
  const prox = z.proximity.replaceAll('_', ' ');
  if (snap.attention.interpretation) {
    const short =
      snap.attention.outcome === 'BUYERS_ABSORBED_AT_SWING_HIGH' ||
      snap.attention.outcome === 'SELLERS_ABSORBED_AT_SWING_LOW'
        ? 'ABSORPTION'
        : snap.attention.outcome.includes('SWEEP')
          ? 'SWEEP'
          : snap.attention.outcome.includes('BREAK')
            ? 'BREAK'
            : prox;
    return `${prox} ${side} · ${short}`;
  }
  return `${prox} ${side}`;
}

export function liquidityZoneTooltip(zone: LiquidityZone, attention?: ZoneAttentionRead | null): string {
  const lines = [
    zone.sourceType === 'SWING_HIGH' ? 'SWING HIGH LIQUIDITY ZONE' : 'SWING LOW LIQUIDITY ZONE',
    `Price: ${zone.price}`,
    `Zone: ${zone.zoneLow}–${zone.zoneHigh}`,
    `Class: ${zone.classification.replaceAll('_', ' ')}`,
    `Swing Significance: ${Math.round(zone.swingSignificance)}`,
    zone.distanceBps != null ? `Distance: ${zone.distanceBps.toFixed(1)} bps` : '',
    attention?.attack != null ? `${attention.attackLabel}: ${Math.round(attention.attack)}` : '',
    attention?.defense != null ? `${attention.defenseLabel}: ${Math.round(attention.defense)}` : '',
    attention?.result != null ? `${attention.resultLabel}: ${Math.round(attention.result)}` : '',
    `State: ${zone.state}`,
    attention?.interpretation ? `Read: ${attention.interpretation}` : '',
    `Liquidation Confluence: ${zone.confluence.liquidationLevel}`,
    `Confluence Score: ${zone.confluence.score}`,
    `  swing ${Math.round(zone.confluence.components.swingSignificance)}`,
    `  hist S/R ${Math.round(zone.confluence.components.historicalSrOverlap)}`,
    `  live wall ${Math.round(zone.confluence.components.liveWallAlignment)}`,
    `  liquidation ${Math.round(zone.confluence.components.liquidationOverlap)}`,
    `  prior reactions ${Math.round(zone.confluence.components.priorReactions)}`,
  ];
  return lines.filter(Boolean).join('\n');
}
