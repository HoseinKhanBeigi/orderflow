import { clamp } from '../core/integrity.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import type { TradeDecisionConfig } from '../config/types.js';
import type {
  TradeDecisionAction,
  TradeDecisionMetrics,
  TradeDecisionPhase,
  TradeDecisionSnapshot,
  TradeEntryQuality,
} from '../models/trade-decision.js';
import { TRADE_DECISION_STRATEGY_VERSION } from '../models/trade-decision.js';
import type { WindowSnapshot } from '../models/signals.js';
import type { IntensityLabel } from '../models/liquidity-response.js';
import type { PatternCandidate } from '../pattern-recognition/pattern-types.js';

export type { TradeDecisionSnapshot } from '../models/trade-decision.js';
export type { TradeDecisionConfig } from '../config/types.js';
export { TRADE_DECISION_STRATEGY_VERSION } from '../models/trade-decision.js';

export const DEFAULT_TRADE_DECISION_CONFIG: TradeDecisionConfig =
  DEFAULT_CONFIG.tradeDecision;

/**
 * Optional enrichments. Pattern must not bypass core gates.
 * Control history is newest-last; used only as confidence support.
 */
export interface TradeDecisionContext {
  pattern?: Pick<PatternCandidate, 'id' | 'status' | 'direction'> | null;
  /** Prior buyer-control scores (0–100), oldest → newest. */
  buyerControlHistory?: number[];
  /** Prior seller-control scores (0–100), oldest → newest. */
  sellerControlHistory?: number[];
  now?: number;
}

/**
 * Evaluates LONG / SHORT / WAIT from an existing window snapshot.
 *
 * Intentional overlap (not double-counted as the same evidence):
 * - PassiveSellerDefense is a composite strength gate.
 * - AskConsumption / AskPulling confirm the *mechanism* of weakening.
 * - Fuel uses MarketFuel only; aggression power is used for control, not fuel.
 */
export function evaluateTradeDecision(
  snap: WindowSnapshot,
  config: TradeDecisionConfig = DEFAULT_TRADE_DECISION_CONFIG,
  context: TradeDecisionContext = {},
): TradeDecisionSnapshot {
  const metrics = projectMetrics(snap, context);
  const now = context.now ?? Date.now();

  if (metrics.dataQuality === 'NO_DATA' || metrics.dataQuality === 'STALE' || metrics.dataQuality === 'LOW_CONFIDENCE') {
    return decision({
      action: 'WAIT',
      phase: 'NO_TRADE',
      confidence: 20,
      entryQuality: 'LOW',
      reasons: [],
      blockers: ['insufficient_data'],
      invalidationReasons: [],
      metrics,
      snap,
      now,
    });
  }

  const long = scoreLong(metrics, config, context);
  const short = scoreShort(metrics, config, context);

  if (long.ok && short.ok) {
    return decision({
      action: 'WAIT',
      phase: 'NO_TRADE',
      confidence: 30,
      entryQuality: 'LOW',
      reasons: [...long.reasons, ...short.reasons],
      blockers: ['conflicting_long_short_conditions'],
      invalidationReasons: [],
      metrics,
      snap,
      now,
    });
  }

  if (long.ok) {
    return decision({
      action: 'LONG',
      phase: 'LONG_CONFIRMATION',
      confidence: long.confidence,
      entryQuality: qualityOf(long.confidence),
      reasons: long.reasons,
      blockers: [],
      invalidationReasons: [
        'buyer_control_lost',
        'seller_defense_rebuilds',
        'buyer_absorption_appears',
        'price_loses_upside_acceptance',
      ],
      metrics,
      snap,
      now,
    });
  }

  if (short.ok) {
    return decision({
      action: 'SHORT',
      phase: 'SHORT_CONFIRMATION',
      confidence: short.confidence,
      entryQuality: qualityOf(short.confidence),
      reasons: short.reasons,
      blockers: [],
      invalidationReasons: [
        'seller_control_lost',
        'buyer_defense_rebuilds',
        'seller_absorption_appears',
        'price_loses_downside_acceptance',
      ],
      metrics,
      snap,
      now,
    });
  }

  // Prefer richer WAIT explanation from the closer side.
  const closer = long.progress >= short.progress ? long : short;
  const phase: TradeDecisionPhase =
    closer.progress >= 0.5
      ? closer === long
        ? 'LONG_SETUP_FORMING'
        : 'SHORT_SETUP_FORMING'
      : 'NO_TRADE';

  return decision({
    action: 'WAIT',
    phase,
    confidence: clamp(closer.confidence * 0.55, 15, 55),
    entryQuality: 'LOW',
    reasons: closer.reasons,
    blockers: closer.blockers,
    invalidationReasons: [],
    metrics,
    snap,
    now,
  });
}

interface SideScore {
  ok: boolean;
  progress: number;
  confidence: number;
  reasons: string[];
  blockers: string[];
}

function scoreLong(
  m: TradeDecisionMetrics,
  cfg: TradeDecisionConfig,
  ctx: TradeDecisionContext,
): SideScore {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let gates = 0;
  const total = 7;

  const buyer = m.buyerControl;
  const upside = m.upsideFuel;
  const downside = m.downsideFuel;
  const fuelEdge = m.fuelEdge;
  const sellerDef = m.passiveSellerDefense;
  const askCons = m.askConsumption;
  const askPull = m.askPulling;
  const askRepl = m.askReplenishment;

  if (buyer != null && buyer >= cfg.buyerControlMin) {
    gates += 1;
    reasons.push('buyers_in_control');
  } else {
    blockers.push('weak_buyer_control');
  }

  if (upside != null && upside >= cfg.fuelMin) {
    gates += 1;
    reasons.push('upside_fuel_dominant');
  } else {
    blockers.push('weak_upside_fuel');
  }

  if (fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin) {
    gates += 1;
    reasons.push('fuel_directional_edge');
  } else {
    blockers.push('fuel_balanced');
  }

  if (sellerDef != null && sellerDef <= cfg.opposingDefenseMax) {
    gates += 1;
    reasons.push('seller_defense_weak');
  } else {
    blockers.push('seller_defense_strong');
  }

  const liqWeak =
    (askCons != null && askCons >= cfg.liquidityWeakeningMin) ||
    (askPull != null && askPull >= cfg.liquidityWeakeningMin);
  if (liqWeak) {
    gates += 1;
    if (askPull != null && askPull >= cfg.liquidityWeakeningMin) reasons.push('asks_pulled');
    if (askCons != null && askCons >= cfg.liquidityWeakeningMin) reasons.push('asks_consumed');
  } else {
    blockers.push('no_ask_side_weakening');
  }

  if (askRepl != null && askRepl < cfg.opposingReplenishmentMax) {
    gates += 1;
    reasons.push('ask_replenishment_low');
  } else if (askRepl == null) {
    // Missing replenishment: do not invent zero; treat as incomplete gate.
    blockers.push('ask_replenishment_unknown');
  } else {
    blockers.push('ask_replenishment_high');
  }

  if (m.buyerAbsorbed) {
    blockers.push('BUYER_ABSORBED');
  } else {
    gates += 1;
    reasons.push('no_buyer_absorption');
  }

  if (!m.priceFollowedUp) {
    blockers.push('no_price_follow_through');
  } else {
    // Price is confirmation after the 7 structural gates — counted in confidence, not gate total.
    reasons.push('price_following_up');
  }

  // Soft survival support
  if (m.askSurvival != null && m.askSurvival < cfg.opposingSurvivalMax) {
    reasons.push('ask_survival_low');
  }

  const ok =
    gates >= total &&
    !m.buyerAbsorbed &&
    m.priceFollowedUp &&
    askRepl != null &&
    askRepl < cfg.opposingReplenishmentMax &&
    liqWeak &&
    sellerDef != null &&
    sellerDef <= cfg.opposingDefenseMax &&
    buyer != null &&
    buyer >= cfg.buyerControlMin &&
    upside != null &&
    upside >= cfg.fuelMin &&
    fuelEdge != null &&
    fuelEdge >= cfg.fuelEdgeMin;

  const confidence = computeConfidence({
    ok,
    gates,
    total,
    control: buyer,
    fuel: upside,
    fuelEdge,
    opposingDefense: sellerDef,
    liqWeakScore: Math.max(askCons ?? 0, askPull ?? 0),
    priceOk: m.priceFollowedUp,
    absorbed: m.buyerAbsorbed,
    dataQuality: m.dataQuality,
    velocity: m.upsideFuelVelocity,
    controlTrend: trendScore(ctx.buyerControlHistory),
    patternBoost: patternBoost(ctx.pattern, 'BULLISH', cfg),
    cfg,
  });

  return { ok, progress: gates / total, confidence, reasons: unique(reasons), blockers: unique(blockers) };
}

function scoreShort(
  m: TradeDecisionMetrics,
  cfg: TradeDecisionConfig,
  ctx: TradeDecisionContext,
): SideScore {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let gates = 0;
  const total = 7;

  const seller = m.sellerControl;
  const downside = m.downsideFuel;
  const upside = m.upsideFuel;
  const fuelEdge = downside != null && upside != null ? downside - upside : m.fuelEdge != null ? -m.fuelEdge : null;
  const buyerDef = m.passiveBuyerDefense;
  const bidCons = m.bidConsumption;
  const bidPull = m.bidPulling;
  const bidRepl = m.bidReplenishment;

  if (seller != null && seller >= cfg.sellerControlMin) {
    gates += 1;
    reasons.push('sellers_in_control');
  } else {
    blockers.push('weak_seller_control');
  }

  if (downside != null && downside >= cfg.fuelMin) {
    gates += 1;
    reasons.push('downside_fuel_dominant');
  } else {
    blockers.push('weak_downside_fuel');
  }

  if (fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin) {
    gates += 1;
    reasons.push('fuel_directional_edge');
  } else {
    blockers.push('fuel_balanced');
  }

  if (buyerDef != null && buyerDef <= cfg.opposingDefenseMax) {
    gates += 1;
    reasons.push('buyer_defense_weak');
  } else {
    blockers.push('buyer_defense_strong');
  }

  const liqWeak =
    (bidCons != null && bidCons >= cfg.liquidityWeakeningMin) ||
    (bidPull != null && bidPull >= cfg.liquidityWeakeningMin);
  if (liqWeak) {
    gates += 1;
    if (bidPull != null && bidPull >= cfg.liquidityWeakeningMin) reasons.push('bids_pulled');
    if (bidCons != null && bidCons >= cfg.liquidityWeakeningMin) reasons.push('bids_consumed');
  } else {
    blockers.push('no_bid_side_weakening');
  }

  if (bidRepl != null && bidRepl < cfg.opposingReplenishmentMax) {
    gates += 1;
    reasons.push('bid_replenishment_low');
  } else if (bidRepl == null) {
    blockers.push('bid_replenishment_unknown');
  } else {
    blockers.push('bid_replenishment_high');
  }

  if (m.sellerAbsorbed) {
    blockers.push('SELLER_ABSORBED');
  } else {
    gates += 1;
    reasons.push('no_seller_absorption');
  }

  if (!m.priceFollowedDown) {
    blockers.push('no_price_follow_through');
  } else {
    reasons.push('price_following_down');
  }

  if (m.bidSurvival != null && m.bidSurvival < cfg.opposingSurvivalMax) {
    reasons.push('bid_survival_low');
  }

  const ok =
    gates >= total &&
    !m.sellerAbsorbed &&
    m.priceFollowedDown &&
    bidRepl != null &&
    bidRepl < cfg.opposingReplenishmentMax &&
    liqWeak &&
    buyerDef != null &&
    buyerDef <= cfg.opposingDefenseMax &&
    seller != null &&
    seller >= cfg.sellerControlMin &&
    downside != null &&
    downside >= cfg.fuelMin &&
    fuelEdge != null &&
    fuelEdge >= cfg.fuelEdgeMin;

  const confidence = computeConfidence({
    ok,
    gates,
    total,
    control: seller,
    fuel: downside,
    fuelEdge,
    opposingDefense: buyerDef,
    liqWeakScore: Math.max(bidCons ?? 0, bidPull ?? 0),
    priceOk: m.priceFollowedDown,
    absorbed: m.sellerAbsorbed,
    dataQuality: m.dataQuality,
    velocity: m.downsideFuelVelocity,
    controlTrend: trendScore(ctx.sellerControlHistory),
    patternBoost: patternBoost(ctx.pattern, 'BEARISH', cfg),
    cfg,
  });

  return { ok, progress: gates / total, confidence, reasons: unique(reasons), blockers: unique(blockers) };
}

function computeConfidence(input: {
  ok: boolean;
  gates: number;
  total: number;
  control: number | null;
  fuel: number | null;
  fuelEdge: number | null;
  opposingDefense: number | null;
  liqWeakScore: number;
  priceOk: boolean;
  absorbed: boolean;
  dataQuality: TradeDecisionMetrics['dataQuality'];
  velocity: number | null;
  controlTrend: number;
  patternBoost: number;
  cfg: TradeDecisionConfig;
}): number {
  const baseAlignment = (input.gates / input.total) * 40;
  const controlPart = ((input.control ?? 0) / 100) * 15;
  const fuelPart = ((input.fuel ?? 0) / 100) * 12;
  const edgePart = clamp((input.fuelEdge ?? 0) / 40, 0, 1) * 10;
  const defensePart =
    input.opposingDefense != null ? clamp((100 - input.opposingDefense) / 100, 0, 1) * 8 : 0;
  const liqPart = clamp(input.liqWeakScore / 100, 0, 1) * 8;
  const pricePart = input.priceOk ? 7 : 0;
  const velocityPart =
    input.velocity == null
      ? 0
      : input.velocity > 0
        ? Math.min(5, input.velocity * input.cfg.fuelVelocityWeight)
        : Math.max(-6, input.velocity * input.cfg.fuelVelocityWeight);
  const trendPart = input.controlTrend * 4;
  const patternPart = input.ok ? input.patternBoost : 0;

  let contradiction = 0;
  if (input.absorbed) contradiction += 25;
  if (!input.priceOk) contradiction += 10;
  if (input.dataQuality === 'PARTIAL') contradiction += 8;

  const raw =
    baseAlignment +
    controlPart +
    fuelPart +
    edgePart +
    defensePart +
    liqPart +
    pricePart +
    velocityPart +
    trendPart +
    patternPart -
    contradiction;

  return Math.round(clamp(raw, 0, 100));
}

function projectMetrics(snap: WindowSnapshot, ctx: TradeDecisionContext): TradeDecisionMetrics {
  const battle = snap.marketBattle;
  const fuel = snap.marketFuel;
  const lr = snap.liquidityResponse;

  const buyerControl = battle?.upside.aggressive.power ?? null;
  const sellerControl = battle?.downside.aggressive.power ?? null;
  const upsideFuel = fuel?.upsideFuel ?? null;
  const downsideFuel = fuel?.downsideFuel ?? null;
  const fuelEdge =
    upsideFuel != null && downsideFuel != null ? upsideFuel - downsideFuel : null;

  const askConsumption = intensityToScore(lr?.askConsumption);
  const bidConsumption = intensityToScore(lr?.bidConsumption);
  const askPulling = intensityToScore(lr?.askWithdrawal);
  const bidPulling = intensityToScore(lr?.bidWithdrawal);
  const askReplenishment = intensityToScore(lr?.askReplenishment);
  const bidReplenishment = intensityToScore(lr?.bidReplenishment);

  const buyerAbsorbed =
    snap.absorption?.detected === true && snap.absorption.type === 'BUYER_ABSORPTION'
      ? true
      : lr?.absorption?.kind === 'BUY_ABSORPTION'
        ? true
        : battle?.downside.state === 'BUYER_ABSORPTION'
          ? true
          : lr?.effort === 'BUY_ABSORPTION';

  const sellerAbsorbed =
    snap.absorption?.detected === true && snap.absorption.type === 'SELLER_ABSORPTION'
      ? true
      : lr?.absorption?.kind === 'SELL_ABSORPTION'
        ? true
        : battle?.upside.state === 'SELLER_ABSORPTION'
          ? true
          : lr?.effort === 'SELL_ABSORPTION';

  const priceFollowedUp = derivePriceFollowUp(snap);
  const priceFollowedDown = derivePriceFollowDown(snap);

  return {
    buyerControl,
    sellerControl,
    upsideFuel,
    downsideFuel,
    fuelEdge,
    passiveSellerDefense: battle?.upside.passive.defensePower ?? null,
    passiveBuyerDefense: battle?.downside.passive.defensePower ?? null,
    askConsumption,
    bidConsumption,
    askPulling,
    bidPulling,
    askReplenishment,
    bidReplenishment,
    askSurvival: battle?.upside.passive.survival ?? null,
    bidSurvival: battle?.downside.passive.survival ?? null,
    upsideFuelVelocity: fuel?.upsideFuelVelocity ?? null,
    downsideFuelVelocity: fuel?.downsideFuelVelocity ?? null,
    buyerAbsorbed,
    sellerAbsorbed,
    priceFollowedUp,
    priceFollowedDown,
    dataQuality: resolveDataQuality(snap),
    patternId: ctx.pattern?.id ?? null,
    patternStatus: ctx.pattern?.status ?? null,
  };
}

function derivePriceFollowUp(snap: WindowSnapshot): boolean {
  if (snap.priceChangePercent > 0.02 && (snap.priceImpactEfficiency === 'HIGH' || snap.priceImpactEfficiency === 'EXTREME' || snap.priceImpactEfficiency === 'NORMAL')) {
    return true;
  }
  if (snap.liquidityResponse?.effort === 'EFFICIENT_BUYING') return true;
  const score = snap.marketBattle?.upside.price.efficiencyScore ?? 0;
  if (snap.priceChangePercent > 0 && score >= 55) return true;
  if (snap.delta > 0 && snap.priceChangePercent > 0.05) return true;
  return false;
}

function derivePriceFollowDown(snap: WindowSnapshot): boolean {
  if (snap.priceChangePercent < -0.02 && (snap.priceImpactEfficiency === 'HIGH' || snap.priceImpactEfficiency === 'EXTREME' || snap.priceImpactEfficiency === 'NORMAL')) {
    return true;
  }
  if (snap.liquidityResponse?.effort === 'EFFICIENT_SELLING') return true;
  const score = snap.marketBattle?.downside.price.efficiencyScore ?? 0;
  if (snap.priceChangePercent < 0 && score >= 55) return true;
  if (snap.delta < 0 && snap.priceChangePercent < -0.05) return true;
  return false;
}

function resolveDataQuality(snap: WindowSnapshot): TradeDecisionMetrics['dataQuality'] {
  const battleStatus = snap.marketBattle?.dataHealth?.status;
  const fuelStatus = snap.marketFuel?.dataStatus;
  if (fuelStatus === 'NO_DATA' || battleStatus === 'NO_TRADES') return 'NO_DATA';
  if (fuelStatus === 'STALE_DATA' || battleStatus === 'STALE_TRADES') return 'STALE';
  if (fuelStatus === 'PARTIAL_DATA' || battleStatus === 'BOOK_UNRELIABLE') return 'PARTIAL';
  if (
    snap.liquidityResponse &&
    (snap.liquidityResponse.confidence === 'LOW' ||
      (typeof snap.liquidityResponse.dataQuality === 'number' && snap.liquidityResponse.dataQuality < 35))
  ) {
    return 'LOW_CONFIDENCE';
  }
  if (!snap.marketBattle || !snap.marketFuel || !snap.liquidityResponse) return 'PARTIAL';
  return 'OK';
}

function intensityToScore(label: IntensityLabel | string | undefined | null): number | null {
  if (!label) return null;
  if (label === 'EXTREME') return 90;
  if (label === 'HIGH') return 75;
  if (label === 'NORMAL') return 45;
  if (label === 'LOW') return 25;
  return null;
}

function patternBoost(
  pattern: TradeDecisionContext['pattern'],
  want: 'BULLISH' | 'BEARISH',
  cfg: TradeDecisionConfig,
): number {
  if (!pattern) return 0;
  if (pattern.status !== 'CONFIRMED' && pattern.status !== 'FORMING') return 0;
  if (pattern.direction !== want) return 0;
  const mult = pattern.status === 'CONFIRMED' ? 1 : 0.5;
  return cfg.patternSupportBonus * mult;
}

/** Rising sequence → ~1, falling → ~-1, flat → 0. */
function trendScore(history: number[] | undefined): number {
  if (!history || history.length < 2) return 0;
  const recent = history.slice(-4);
  let up = 0;
  for (let i = 1; i < recent.length; i++) {
    const d = (recent[i] ?? 0) - (recent[i - 1] ?? 0);
    if (d > 1) up += 1;
    else if (d < -1) up -= 1;
  }
  return clamp(up / Math.max(1, recent.length - 1), -1, 1);
}

function qualityOf(confidence: number): TradeEntryQuality {
  if (confidence >= 75) return 'HIGH';
  if (confidence >= 55) return 'MODERATE';
  return 'LOW';
}

function decision(input: {
  action: TradeDecisionAction;
  phase: TradeDecisionPhase;
  confidence: number;
  entryQuality: TradeEntryQuality;
  reasons: string[];
  blockers: string[];
  invalidationReasons: string[];
  metrics: TradeDecisionMetrics;
  snap: WindowSnapshot;
  now: number;
}): TradeDecisionSnapshot {
  // Attach live fuel velocity into metrics for diagnostics (not used as a hard gate).
  const metrics: TradeDecisionMetrics = {
    ...input.metrics,
  };
  return {
    strategyVersion: TRADE_DECISION_STRATEGY_VERSION,
    action: input.action,
    phase: input.phase,
    confidence: input.confidence,
    entryQuality: input.entryQuality,
    reasons: input.reasons,
    blockers: input.blockers,
    invalidationReasons: input.invalidationReasons,
    metrics,
    timestamp: input.now,
    symbol: input.snap.symbol,
    window: input.snap.window,
  };
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function emptyTradeDecisionWait(
  symbol: string,
  window: string,
  now = Date.now(),
): TradeDecisionSnapshot {
  return {
    strategyVersion: TRADE_DECISION_STRATEGY_VERSION,
    action: 'WAIT',
    phase: 'NO_TRADE',
    confidence: 0,
    entryQuality: 'LOW',
    reasons: [],
    blockers: ['insufficient_data'],
    invalidationReasons: [],
    metrics: {
      buyerControl: null,
      sellerControl: null,
      upsideFuel: null,
      downsideFuel: null,
      fuelEdge: null,
      passiveSellerDefense: null,
      passiveBuyerDefense: null,
      askConsumption: null,
      bidConsumption: null,
      askPulling: null,
      bidPulling: null,
      askReplenishment: null,
      bidReplenishment: null,
      askSurvival: null,
      bidSurvival: null,
      upsideFuelVelocity: null,
      downsideFuelVelocity: null,
      buyerAbsorbed: false,
      sellerAbsorbed: false,
      priceFollowedUp: false,
      priceFollowedDown: false,
      dataQuality: 'NO_DATA',
      patternId: null,
      patternStatus: null,
    },
    timestamp: now,
    symbol,
    window,
  };
}

/**
 * Pure evaluate from explicit metrics — used by tests without building a full WindowSnapshot.
 * Production path should use evaluateTradeDecision(WindowSnapshot).
 */
export function evaluateTradeDecisionFromMetrics(
  metrics: TradeDecisionMetrics,
  config: TradeDecisionConfig = DEFAULT_TRADE_DECISION_CONFIG,
  context: TradeDecisionContext = {},
): TradeDecisionSnapshot {
  const fakeSnap = {
    symbol: 'TEST',
    window: '1m',
    marketFuel: {
      upsideFuelVelocity: null,
      downsideFuelVelocity: null,
    },
  } as unknown as WindowSnapshot;

  const long = scoreLong(metrics, config, context);
  const short = scoreShort(metrics, config, context);
  const now = context.now ?? 0;

  if (metrics.dataQuality === 'NO_DATA' || metrics.dataQuality === 'STALE' || metrics.dataQuality === 'LOW_CONFIDENCE') {
    return decision({
      action: 'WAIT',
      phase: 'NO_TRADE',
      confidence: 20,
      entryQuality: 'LOW',
      reasons: [],
      blockers: ['insufficient_data'],
      invalidationReasons: [],
      metrics,
      snap: fakeSnap,
      now,
    });
  }

  if (long.ok && short.ok) {
    return decision({
      action: 'WAIT',
      phase: 'NO_TRADE',
      confidence: 30,
      entryQuality: 'LOW',
      reasons: [...long.reasons, ...short.reasons],
      blockers: ['conflicting_long_short_conditions'],
      invalidationReasons: [],
      metrics,
      snap: fakeSnap,
      now,
    });
  }
  if (long.ok) {
    return decision({
      action: 'LONG',
      phase: 'LONG_CONFIRMATION',
      confidence: long.confidence,
      entryQuality: qualityOf(long.confidence),
      reasons: long.reasons,
      blockers: [],
      invalidationReasons: [
        'buyer_control_lost',
        'seller_defense_rebuilds',
        'buyer_absorption_appears',
        'price_loses_upside_acceptance',
      ],
      metrics,
      snap: fakeSnap,
      now,
    });
  }
  if (short.ok) {
    return decision({
      action: 'SHORT',
      phase: 'SHORT_CONFIRMATION',
      confidence: short.confidence,
      entryQuality: qualityOf(short.confidence),
      reasons: short.reasons,
      blockers: [],
      invalidationReasons: [
        'seller_control_lost',
        'buyer_defense_rebuilds',
        'seller_absorption_appears',
        'price_loses_downside_acceptance',
      ],
      metrics,
      snap: fakeSnap,
      now,
    });
  }
  const closer = long.progress >= short.progress ? long : short;
  return decision({
    action: 'WAIT',
    phase:
      closer.progress >= 0.5
        ? closer === long
          ? 'LONG_SETUP_FORMING'
          : 'SHORT_SETUP_FORMING'
        : 'NO_TRADE',
    confidence: clamp(closer.confidence * 0.55, 15, 55),
    entryQuality: 'LOW',
    reasons: closer.reasons,
    blockers: closer.blockers,
    invalidationReasons: [],
    metrics,
    snap: fakeSnap,
    now,
  });
}
