/**
 * Liquidation Flow Source — forced aggression is a SOURCE of flow, not a fourth side.
 *
 * SHORT_LIQUIDATION → forced BUY
 * LONG_LIQUIDATION  → forced SELL
 *
 * If liquidation prints are already inside total aggressive volume (isForced trades),
 * forced is a SUBSET — never add again. Organic = total − forced when confirmed.
 * If feed missing: Organic/Forced = UNKNOWN (do not assume organic = total).
 */

export const LIQUIDATION_FLOW_VERSION = 'LIQUIDATION_FLOW_SOURCE_V1';

export type LiquidationDataQuality =
  | 'CONFIRMED'
  | 'ESTIMATED'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'STALE'
  | 'NOT_EXPECTED';

export type FlowSourceState =
  | 'MOSTLY_ORGANIC'
  | 'MIXED'
  | 'LIQUIDATION_HEAVY'
  | 'LIQUIDATION_DOMINANT'
  | 'UNKNOWN';

export type LiquidationEventClassification = 'CONFIRMED' | 'ESTIMATED';

export type ForcedFlowAlert =
  | 'NONE'
  | 'SHORT_LIQUIDATION_SURGE'
  | 'LONG_LIQUIDATION_SURGE'
  | 'SHORT_LIQUIDATION_CASCADE'
  | 'LONG_LIQUIDATION_CASCADE'
  | 'SHORT_LIQUIDATION_EXHAUSTION'
  | 'LONG_LIQUIDATION_EXHAUSTION'
  | 'SHORT_LIQUIDATION_BUY_FLOW_ABSORBED'
  | 'LONG_LIQUIDATION_SELL_FLOW_ABSORBED'
  | 'FORCED_BUY_FLOW_ABSORBED_AT_SWING_HIGH'
  | 'FORCED_SELL_FLOW_ABSORBED_AT_SWING_LOW'
  | 'LIQUIDATION_FLOW_RECONCILIATION_ERROR';

export type LiquidationFeedStatus = 'live' | 'unavailable' | 'not_expected' | 'stale' | 'estimated';

export interface LiquidationFlowEvent {
  timestamp: number;
  symbol: string;
  positionSide: 'LONG' | 'SHORT';
  forcedFlowSide: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  notional: number;
  source: 'EXCHANGE_FEED' | 'ESTIMATED_MODEL' | 'SIMULATION';
  classification: LiquidationEventClassification;
  matchStatus?: 'MATCHED' | 'UNMATCHED_LIQUIDATION_EVENT' | 'PARTIAL_MATCH';
}

export interface SideFlowSource {
  totalAggressive: number | null;
  organicAggressive: number | null;
  /** SHORT_LIQUIDATION_FLOW on buy; LONG_LIQUIDATION_FLOW on sell. */
  liquidationFlow: number | null;
  liquidationLabel: 'SHORT_LIQUIDATION_FLOW' | 'LONG_LIQUIDATION_FLOW';
  forcedRatio: number | null;
  organicRatio: number | null;
  state: FlowSourceState;
  organicFlowScore: number | null;
  forcedFlowScore: number | null;
}

export interface LiquidationFlowConfig {
  mostlyOrganicMax: number;
  mixedMax: number;
  heavyMax: number;
  /** Forced may exceed total by this relative tolerance before RECONCILIATION_ERROR. */
  reconcileTolerance: number;
  surgeMinForcedRatio: number;
  surgeMinNotional: number;
  cascadeAccelFactor: number;
  cascadeMinSamples: number;
  exhaustionDropFactor: number;
  absorptionEffortHigh: number;
  absorptionDefenseHigh: number;
  absorptionResultLow: number;
}

export const DEFAULT_LIQUIDATION_FLOW_CONFIG: LiquidationFlowConfig = {
  mostlyOrganicMax: 0.25,
  mixedMax: 0.5,
  heavyMax: 0.75,
  reconcileTolerance: 0.05,
  surgeMinForcedRatio: 0.35,
  surgeMinNotional: 50_000,
  cascadeAccelFactor: 1.8,
  cascadeMinSamples: 3,
  exhaustionDropFactor: 0.45,
  absorptionEffortHigh: 65,
  absorptionDefenseHigh: 65,
  absorptionResultLow: 35,
};

export interface EvaluateLiquidationFlowInput {
  timestamp: number;
  symbol: string;
  /** Total aggressive buy notional (already includes forced if feed uses isForced trades). */
  totalAggressiveBuy: number;
  totalAggressiveSell: number;
  /** Short-liquidation forced buy subset already counted in total. */
  shortLiquidationBuy: number;
  /** Long-liquidation forced sell subset already counted in total. */
  longLiquidationSell: number;
  feed: LiquidationFeedStatus;
  /** Optional attack/defense/result for absorption reads (0–100). */
  buyEffort?: number | null;
  sellEffort?: number | null;
  askDefense?: number | null;
  bidDefense?: number | null;
  askRefill?: number | null;
  bidRefill?: number | null;
  upResult?: number | null;
  downResult?: number | null;
  /** Recent forced buy/sell samples oldest→newest for cascade/exhaustion. */
  forcedBuyHistory?: number[];
  forcedSellHistory?: number[];
  nearSwingHigh?: boolean;
  nearSwingLow?: boolean;
  config?: Partial<LiquidationFlowConfig>;
  /** Estimation confidence when feed === estimated (0–100). */
  estimationConfidence?: number | null;
}

export interface LiquidationFlowSnapshot {
  version: typeof LIQUIDATION_FLOW_VERSION;
  timestamp: number;
  symbol: string;
  dataQuality: LiquidationDataQuality;
  estimationConfidence: number | null;
  buy: SideFlowSource;
  sell: SideFlowSource;
  alert: ForcedFlowAlert;
  interpretation: string;
  reconciliationOk: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mergeLiquidationFlowConfig(partial?: Partial<LiquidationFlowConfig>): LiquidationFlowConfig {
  return { ...DEFAULT_LIQUIDATION_FLOW_CONFIG, ...partial };
}

export function mapFeedToQuality(feed: LiquidationFeedStatus): LiquidationDataQuality {
  if (feed === 'live') return 'CONFIRMED';
  if (feed === 'estimated') return 'ESTIMATED';
  if (feed === 'stale') return 'STALE';
  if (feed === 'not_expected') return 'NOT_EXPECTED';
  return 'UNAVAILABLE';
}

export function classifyForcedRatio(ratio: number | null, cfg: LiquidationFlowConfig): FlowSourceState {
  if (ratio == null || !Number.isFinite(ratio)) return 'UNKNOWN';
  if (ratio < cfg.mostlyOrganicMax) return 'MOSTLY_ORGANIC';
  if (ratio < cfg.mixedMax) return 'MIXED';
  if (ratio < cfg.heavyMax) return 'LIQUIDATION_HEAVY';
  return 'LIQUIDATION_DOMINANT';
}

/**
 * Split total into organic + forced without double counting.
 * forced is treated as a subset of total (clipped).
 */
export function splitOrganicForced(
  total: number,
  forced: number,
  quality: LiquidationDataQuality,
  cfg: LiquidationFlowConfig,
): {
  total: number | null;
  organic: number | null;
  forced: number | null;
  forcedRatio: number | null;
  organicRatio: number | null;
  reconciliationOk: boolean;
} {
  if (!Number.isFinite(total) || total < 0) {
    return { total: null, organic: null, forced: null, forcedRatio: null, organicRatio: null, reconciliationOk: true };
  }

  if (quality === 'UNAVAILABLE' || quality === 'NOT_EXPECTED' || quality === 'STALE') {
    return {
      total,
      organic: null,
      forced: null,
      forcedRatio: null,
      organicRatio: null,
      reconciliationOk: true,
    };
  }

  const rawForced = Math.max(0, Number.isFinite(forced) ? forced : 0);
  let reconciliationOk = true;
  if (total > 0 && rawForced > total * (1 + cfg.reconcileTolerance)) {
    reconciliationOk = false;
  }
  const forcedClipped = Math.min(rawForced, total);
  const organic = Math.max(0, total - forcedClipped);
  const forcedRatio = total > 0 ? forcedClipped / total : 0;
  const organicRatio = total > 0 ? organic / total : 1;

  return {
    total,
    organic,
    forced: forcedClipped,
    forcedRatio,
    organicRatio,
    reconciliationOk,
  };
}

function sideSource(input: {
  total: number;
  forced: number;
  quality: LiquidationDataQuality;
  label: 'SHORT_LIQUIDATION_FLOW' | 'LONG_LIQUIDATION_FLOW';
  cfg: LiquidationFlowConfig;
  attackScore?: number | null;
}): { side: SideFlowSource; reconciliationOk: boolean } {
  const split = splitOrganicForced(input.total, input.forced, input.quality, input.cfg);
  const state = classifyForcedRatio(split.forcedRatio, input.cfg);
  const attack = input.attackScore != null && Number.isFinite(input.attackScore) ? clamp(input.attackScore, 0, 100) : null;

  let organicFlowScore: number | null = null;
  let forcedFlowScore: number | null = null;
  if (attack != null && split.forcedRatio != null && split.organicRatio != null) {
    organicFlowScore = Math.round(attack * split.organicRatio);
    forcedFlowScore = Math.round(attack * split.forcedRatio);
  }

  return {
    reconciliationOk: split.reconciliationOk,
    side: {
      totalAggressive: split.total,
      organicAggressive: split.organic,
      liquidationFlow: split.forced,
      liquidationLabel: input.label,
      forcedRatio: split.forcedRatio,
      organicRatio: split.organicRatio,
      state,
      organicFlowScore,
      forcedFlowScore,
    },
  };
}

export function detectCascade(
  history: number[] | undefined,
  cfg: LiquidationFlowConfig,
): boolean {
  if (!history || history.length < cfg.cascadeMinSamples) return false;
  const recent = history.slice(-cfg.cascadeMinSamples);
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]!;
    const cur = recent[i]!;
    if (prev <= 0) {
      if (cur < cfg.surgeMinNotional) return false;
      continue;
    }
    if (cur / prev < cfg.cascadeAccelFactor) return false;
  }
  return recent[recent.length - 1]! >= cfg.surgeMinNotional;
}

export function detectExhaustion(
  history: number[] | undefined,
  cfg: LiquidationFlowConfig,
): boolean {
  if (!history || history.length < 4) return false;
  const h = history.slice(-6);
  let peakI = 0;
  for (let i = 1; i < h.length; i++) if (h[i]! > h[peakI]!) peakI = i;
  if (peakI === 0 || peakI >= h.length - 1) return false;
  const peak = h[peakI]!;
  const last = h[h.length - 1]!;
  if (peak < cfg.surgeMinNotional) return false;
  // Rising into peak
  for (let i = 1; i <= peakI; i++) {
    if (h[i]! + 1e-9 < h[i - 1]!) return false;
  }
  return last <= peak * cfg.exhaustionDropFactor;
}

export function emptyLiquidationFlow(timestamp = 0, symbol = ''): LiquidationFlowSnapshot {
  const unk: SideFlowSource = {
    totalAggressive: null,
    organicAggressive: null,
    liquidationFlow: null,
    liquidationLabel: 'SHORT_LIQUIDATION_FLOW',
    forcedRatio: null,
    organicRatio: null,
    state: 'UNKNOWN',
    organicFlowScore: null,
    forcedFlowScore: null,
  };
  return {
    version: LIQUIDATION_FLOW_VERSION,
    timestamp,
    symbol,
    dataQuality: 'UNAVAILABLE',
    estimationConfidence: null,
    buy: { ...unk, liquidationLabel: 'SHORT_LIQUIDATION_FLOW' },
    sell: { ...unk, liquidationLabel: 'LONG_LIQUIDATION_FLOW' },
    alert: 'NONE',
    interpretation: 'Liquidation split unknown',
    reconciliationOk: true,
  };
}

export function evaluateLiquidationFlow(input: EvaluateLiquidationFlowInput): LiquidationFlowSnapshot {
  const cfg = mergeLiquidationFlowConfig(input.config);
  const quality = mapFeedToQuality(input.feed);
  const estConf =
    quality === 'ESTIMATED' && input.estimationConfidence != null
      ? clamp(input.estimationConfidence, 0, 100)
      : quality === 'ESTIMATED'
        ? 50
        : null;

  const buyPart = sideSource({
    total: input.totalAggressiveBuy,
    forced: input.shortLiquidationBuy,
    quality,
    label: 'SHORT_LIQUIDATION_FLOW',
    cfg,
    attackScore: input.buyEffort,
  });
  const sellPart = sideSource({
    total: input.totalAggressiveSell,
    forced: input.longLiquidationSell,
    quality,
    label: 'LONG_LIQUIDATION_FLOW',
    cfg,
    attackScore: input.sellEffort,
  });

  const reconciliationOk = buyPart.reconciliationOk && sellPart.reconciliationOk;
  let alert: ForcedFlowAlert = 'NONE';
  let interpretation = '';

  if (!reconciliationOk) {
    alert = 'LIQUIDATION_FLOW_RECONCILIATION_ERROR';
    interpretation = 'Forced volume exceeds total aggressive — check double-count / feed alignment';
  } else if (quality === 'CONFIRMED' || quality === 'ESTIMATED' || quality === 'PARTIAL') {
    const buyForced = buyPart.side.forcedRatio ?? 0;
    const sellForced = sellPart.side.forcedRatio ?? 0;
    const buyLiq = buyPart.side.liquidationFlow ?? 0;
    const sellLiq = sellPart.side.liquidationFlow ?? 0;

    const buyCascade = detectCascade(input.forcedBuyHistory, cfg);
    const sellCascade = detectCascade(input.forcedSellHistory, cfg);
    const buyExhaust = detectExhaustion(input.forcedBuyHistory, cfg);
    const sellExhaust = detectExhaustion(input.forcedSellHistory, cfg);

    const buyAbsorbed =
      buyForced >= cfg.surgeMinForcedRatio &&
      (input.buyEffort ?? 0) >= cfg.absorptionEffortHigh &&
      (input.askDefense ?? 0) >= cfg.absorptionDefenseHigh &&
      (input.upResult ?? 100) <= cfg.absorptionResultLow;

    const sellAbsorbed =
      sellForced >= cfg.surgeMinForcedRatio &&
      (input.sellEffort ?? 0) >= cfg.absorptionEffortHigh &&
      (input.bidDefense ?? 0) >= cfg.absorptionDefenseHigh &&
      (input.downResult ?? 100) <= cfg.absorptionResultLow;

    if (buyAbsorbed && input.nearSwingHigh) {
      alert = 'FORCED_BUY_FLOW_ABSORBED_AT_SWING_HIGH';
      interpretation = 'Short-liquidation buy flow absorbed at swing high';
    } else if (sellAbsorbed && input.nearSwingLow) {
      alert = 'FORCED_SELL_FLOW_ABSORBED_AT_SWING_LOW';
      interpretation = 'Long-liquidation sell flow absorbed at swing low';
    } else if (buyAbsorbed) {
      alert = 'SHORT_LIQUIDATION_BUY_FLOW_ABSORBED';
      interpretation = 'Forced buy (short liq) absorbed by ask defense';
    } else if (sellAbsorbed) {
      alert = 'LONG_LIQUIDATION_SELL_FLOW_ABSORBED';
      interpretation = 'Forced sell (long liq) absorbed by bid defense';
    } else if (buyCascade) {
      alert = 'SHORT_LIQUIDATION_CASCADE';
      interpretation = 'Accelerating short-liquidation → forced buy cascade';
    } else if (sellCascade) {
      alert = 'LONG_LIQUIDATION_CASCADE';
      interpretation = 'Accelerating long-liquidation → forced sell cascade';
    } else if (buyExhaust) {
      alert = 'SHORT_LIQUIDATION_EXHAUSTION';
      interpretation = 'Short-liquidation buy flow spiked then collapsed';
    } else if (sellExhaust) {
      alert = 'LONG_LIQUIDATION_EXHAUSTION';
      interpretation = 'Long-liquidation sell flow spiked then collapsed';
    } else if (buyForced >= cfg.surgeMinForcedRatio && buyLiq >= cfg.surgeMinNotional) {
      alert = 'SHORT_LIQUIDATION_SURGE';
      interpretation = `Short liquidation → forced buy ${Math.round(buyForced * 100)}%`;
    } else if (sellForced >= cfg.surgeMinForcedRatio && sellLiq >= cfg.surgeMinNotional) {
      alert = 'LONG_LIQUIDATION_SURGE';
      interpretation = `Long liquidation → forced sell ${Math.round(sellForced * 100)}%`;
    } else if (buyPart.side.state === 'MIXED' || sellPart.side.state === 'MIXED') {
      interpretation = 'Mixed organic + forced aggression';
    } else if (buyPart.side.state === 'MOSTLY_ORGANIC' && sellPart.side.state === 'MOSTLY_ORGANIC') {
      interpretation = 'Mostly organic aggression';
    }
  } else if (quality === 'UNAVAILABLE') {
    interpretation = 'Liquidation feed unavailable — organic/forced split unknown';
  } else if (quality === 'NOT_EXPECTED') {
    interpretation = 'No liquidation channel for this market';
  } else if (quality === 'STALE') {
    interpretation = 'Liquidation feed stale — split unknown';
  }

  return {
    version: LIQUIDATION_FLOW_VERSION,
    timestamp: input.timestamp,
    symbol: input.symbol,
    dataQuality: quality,
    estimationConfidence: estConf,
    buy: buyPart.side,
    sell: sellPart.side,
    alert,
    interpretation,
    reconciliationOk,
  };
}

/** Compact UI lines: "BUY FLOW 8.4M · 39% Forced" */
export function formatForcedFlowUi(side: SideFlowSource, sideLabel: 'BUY' | 'SELL'): string {
  const total = side.totalAggressive;
  if (total == null) return `${sideLabel} FLOW —`;
  const vol =
    total >= 1_000_000
      ? `${(total / 1_000_000).toFixed(1)}M`
      : total >= 1_000
        ? `${Math.round(total / 1_000)}K`
        : `${Math.round(total)}`;
  if (side.forcedRatio == null) return `${sideLabel} FLOW ${vol} · Forced UNKNOWN`;
  return `${sideLabel} FLOW ${vol} · ${Math.round(side.forcedRatio * 100)}% Forced`;
}

export function forcedFlowTooltip(side: SideFlowSource, sideLabel: 'BUY' | 'SELL'): string {
  const isBuy = sideLabel === 'BUY';
  const lines = [
    `${sideLabel} FLOW SOURCE`,
    side.totalAggressive != null ? `Total: ${Math.round(side.totalAggressive)}` : 'Total: —',
    side.organicAggressive != null
      ? `Organic: ${Math.round(side.organicAggressive)} (${side.organicRatio != null ? Math.round(side.organicRatio * 100) : '?'}%)`
      : 'Organic: UNKNOWN',
    isBuy
      ? side.liquidationFlow != null
        ? `Short Liquidation → Forced Buy: ${Math.round(side.liquidationFlow)} (${side.forcedRatio != null ? Math.round(side.forcedRatio * 100) : '?'}%)`
        : 'Short Liquidation → Forced Buy: UNKNOWN'
      : side.liquidationFlow != null
        ? `Long Liquidation → Forced Sell: ${Math.round(side.liquidationFlow)} (${side.forcedRatio != null ? Math.round(side.forcedRatio * 100) : '?'}%)`
        : 'Long Liquidation → Forced Sell: UNKNOWN',
    `State: ${side.state}`,
  ];
  return lines.join('\n');
}

/**
 * Stateful helper: keep short forced-notional history for cascade/exhaustion.
 * Call pushSample once per window snapshot.
 */
export class LiquidationFlowHistory {
  private readonly buy: number[] = [];
  private readonly sell: number[] = [];
  constructor(private readonly max = 12) {}

  pushSample(forcedBuy: number, forcedSell: number): void {
    this.buy.push(Math.max(0, forcedBuy));
    this.sell.push(Math.max(0, forcedSell));
    while (this.buy.length > this.max) this.buy.shift();
    while (this.sell.length > this.max) this.sell.shift();
  }

  buyHistory(): number[] {
    return [...this.buy];
  }

  sellHistory(): number[] {
    return [...this.sell];
  }

  reset(): void {
    this.buy.length = 0;
    this.sell.length = 0;
  }
}

/** Map LiquidationEvent → normalized flow event (confirmed exchange). */
export function fromExchangeLiquidation(input: {
  timestamp: number;
  symbol: string;
  type: 'LONG_LIQUIDATION' | 'SHORT_LIQUIDATION';
  price: number;
  quantity: number;
  quoteValue: number;
  source?: LiquidationFlowEvent['source'];
}): LiquidationFlowEvent {
  const isShort = input.type === 'SHORT_LIQUIDATION';
  return {
    timestamp: input.timestamp,
    symbol: input.symbol,
    positionSide: isShort ? 'SHORT' : 'LONG',
    forcedFlowSide: isShort ? 'BUY' : 'SELL',
    price: input.price,
    quantity: input.quantity,
    notional: input.quoteValue,
    source: input.source ?? 'EXCHANGE_FEED',
    classification: 'CONFIRMED',
    matchStatus: 'MATCHED',
  };
}
