import { clamp } from '../core/integrity.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import type { CandleClassificationConfig } from '../config/types.js';
import type { IntensityLabel } from '../models/liquidity-response.js';
import type { WindowSnapshot } from '../models/signals.js';
import type { CandleLabel, FootprintBarLike, LabeledCandle } from './pattern-types.js';
import type {
  CandleClassification,
  ClassificationDataQuality,
  ControlState,
  DominantLiquidityEvent,
  LiquidityBehaviorLayer,
  LiquidityBehaviorState,
  LiquidityMetricView,
  OutcomeDirection,
  OutcomeLayer,
  OutcomeType,
  SpecialEventLayer,
  SpecialEventType,
} from './candle-classification-types.js';

export type { CandleClassification } from './candle-classification-types.js';

const DEFAULT_CLASSIFICATION_CONFIG: CandleClassificationConfig =
  DEFAULT_CONFIG.candleClassification;

export interface ClassificationInputMetrics {
  bidConsumption: number | null;
  askConsumption: number | null;
  bidWithdrawal: number | null;
  askWithdrawal: number | null;
  bidReplenishment: number | null;
  askReplenishment: number | null;
  bidSurvival: number | null;
  askSurvival: number | null;
  /** Optional rolling significance when available from LR norms / depth. */
  bidConsumptionPercentile?: number | null;
  askConsumptionPercentile?: number | null;
  bidWithdrawalPercentile?: number | null;
  askWithdrawalPercentile?: number | null;
  bidReplenishmentPercentile?: number | null;
  askReplenishmentPercentile?: number | null;
  bidConsumptionZ?: number | null;
  askConsumptionZ?: number | null;
  bidWithdrawalZ?: number | null;
  askWithdrawalZ?: number | null;
  rawBidConsumed?: number | null;
  rawAskConsumed?: number | null;
  rawBidCancelled?: number | null;
  rawAskCancelled?: number | null;
  rawBidReplenished?: number | null;
  rawAskReplenished?: number | null;
  dataQualityScore?: number | null;
  dataStale?: boolean;
}

export interface ClassifyCandleOptions {
  config?: CandleClassificationConfig;
  metrics?: ClassificationInputMetrics | null;
  /** Prior completed candles only — never future. */
  prior?: FootprintBarLike[];
}

/**
 * Build the four-layer classification for one candle.
 * Does not look ahead. Outcome that needs the next candle is marked PENDING.
 */
export function classifyCandleStructure(
  bar: FootprintBarLike,
  options: ClassifyCandleOptions = {},
): CandleClassification {
  const config = options.config ?? DEFAULT_CLASSIFICATION_CONFIG;
  const prior = options.prior ?? [];
  const metrics = options.metrics ?? null;

  const control = deriveControl(bar);
  const liquidity = deriveLiquidityBehavior(bar, prior, metrics, config);
  const special = deriveSpecialEvent(bar, prior, metrics);
  const outcome = deriveOutcome(bar, control.control, special.type, prior, metrics);
  const primaryDisplayLabel = derivePrimaryDisplayLabel(
    control,
    liquidity,
    special,
    config,
  );

  return {
    primaryState: control,
    liquidityBehavior: liquidity,
    specialEvent: special,
    outcome,
    primaryDisplayLabel,
  };
}

/** Map structured classification → legacy flat alphabet for pattern / transition compat. */
export function displayLabelFromClassification(c: CandleClassification): CandleLabel {
  return c.primaryDisplayLabel;
}

export function emptyLiquidityMetric(): LiquidityMetricView {
  return {
    score: null,
    state: 'NO_DATA',
    percentile: null,
    zScore: null,
    rawValue: null,
  };
}

export function emptyClassification(): CandleClassification {
  const emptySide = emptyLiquidityMetric();
  return {
    primaryState: { control: 'UNCLEAR', confidence: 0.35 },
    liquidityBehavior: {
      bidConsumption: emptySide,
      bidPulling: emptySide,
      bidReplenishment: emptySide,
      bidSurvival: emptySide,
      askConsumption: emptySide,
      askPulling: emptySide,
      askReplenishment: emptySide,
      askSurvival: emptySide,
      dominantEvent: 'NONE',
      dataQuality: 'NO_DATA',
    },
    specialEvent: { type: null, confidence: null },
    outcome: { type: 'NEUTRAL', direction: 'NONE', confidence: 0.4 },
    primaryDisplayLabel: 'UNCLASSIFIED',
  };
}

export function metricsFromLabeledFields(
  candle: Partial<LabeledCandle> | null | undefined,
): ClassificationInputMetrics | null {
  if (!candle) return null;
  const hasAny =
    candle.bidConsumption != null ||
    candle.askConsumption != null ||
    candle.bidWithdrawal != null ||
    candle.askWithdrawal != null ||
    candle.bidReplenishment != null ||
    candle.askReplenishment != null ||
    candle.bidSurvival != null ||
    candle.askSurvival != null;
  if (!hasAny) return null;
  return {
    bidConsumption: candle.bidConsumption ?? null,
    askConsumption: candle.askConsumption ?? null,
    bidWithdrawal: candle.bidWithdrawal ?? null,
    askWithdrawal: candle.askWithdrawal ?? null,
    bidReplenishment: candle.bidReplenishment ?? null,
    askReplenishment: candle.askReplenishment ?? null,
    bidSurvival: candle.bidSurvival ?? null,
    askSurvival: candle.askSurvival ?? null,
  };
}

export function classificationMetricsFromWindow(
  snap: WindowSnapshot | null | undefined,
): ClassificationInputMetrics | null {
  if (!snap) return null;
  const lr = snap.liquidityResponse;
  const battle = snap.marketBattle;
  if (!lr && !battle) return null;

  const askDepth = lr?.askDepth;
  const bidDepth = lr?.bidDepth;
  const dataQualityScore = lr?.dataQuality ?? null;
  const stale =
    lr != null &&
    (lr.confidence === 'LOW' || (typeof dataQualityScore === 'number' && dataQualityScore < 35));

  return {
    bidConsumption: intensityToScore(lr?.bidConsumption),
    askConsumption: intensityToScore(lr?.askConsumption),
    bidWithdrawal: intensityToScore(lr?.bidWithdrawal),
    askWithdrawal: intensityToScore(lr?.askWithdrawal),
    bidReplenishment: intensityToScore(lr?.bidReplenishment),
    askReplenishment: intensityToScore(lr?.askReplenishment),
    bidSurvival: battle?.downside.passive.survival ?? null,
    askSurvival: battle?.upside.passive.survival ?? null,
    rawBidConsumed: bidDepth?.consumed ?? null,
    rawAskConsumed: askDepth?.consumed ?? null,
    rawBidCancelled: bidDepth?.cancelled ?? null,
    rawAskCancelled: askDepth?.cancelled ?? null,
    rawBidReplenished: bidDepth?.replenished ?? null,
    rawAskReplenished: askDepth?.replenished ?? null,
    dataQualityScore,
    dataStale: stale,
  };
}

export function stateFromScore(
  score: number | null,
  config: CandleClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
): LiquidityBehaviorState {
  if (score == null || !Number.isFinite(score)) return 'NO_DATA';
  const s = clamp(score, 0, 100);
  const b = config.stateBuckets;
  if (s < b.low) return 'LOW';
  if (s < b.normal) return 'NORMAL';
  if (s < b.elevated) return 'ELEVATED';
  if (s < b.strong) return 'STRONG';
  return 'EXTREME';
}

export function pickDominantLiquidityEvent(
  behaviors: Array<{ event: DominantLiquidityEvent; score: number | null; percentile: number | null }>,
  config: CandleClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
): DominantLiquidityEvent {
  const ranked = behaviors
    .filter((b) => b.event !== 'NONE' && b.score != null && Number.isFinite(b.score))
    .map((b) => ({ ...b, score: b.score as number }))
    .sort((a, b) => b.score - a.score || a.event.localeCompare(b.event));

  const top = ranked[0];
  if (!top) return 'NONE';

  const second = ranked[1];
  const margin = second ? top.score - second.score : top.score;
  const scoreOk = top.score >= config.minimumDominanceScore;
  const marginOk = margin >= config.minimumDominanceMargin;
  const percentileOk =
    top.percentile == null ||
    !Number.isFinite(top.percentile) ||
    top.percentile >= config.minimumDominancePercentile;

  // Relative significance: when percentile is present and high, allow slightly softer score.
  const relativeExtreme =
    top.percentile != null &&
    Number.isFinite(top.percentile) &&
    top.percentile >= Math.max(config.minimumDominancePercentile, 85) &&
    top.score >= config.minimumDominanceScore - 10;

  if ((scoreOk || relativeExtreme) && marginOk && percentileOk) return top.event;
  return 'NONE';
}

function deriveControl(bar: FootprintBarLike): { control: ControlState; confidence: number } {
  const win = barWinner(bar);
  if (win === 'AGGRESSIVE_BUYERS') {
    return { control: 'BUYER_IN_CONTROL', confidence: controlConfidence(bar) };
  }
  if (win === 'AGGRESSIVE_SELLERS') {
    return { control: 'SELLER_IN_CONTROL', confidence: controlConfidence(bar) };
  }
  if (win === 'PASSIVE_SELLERS' || win === 'PASSIVE_BUYERS') {
    // Passive defense is not control of the active battle — leave control unclear/balanced.
    return { control: 'BALANCED', confidence: Math.min(0.55, absorbConfidence(bar)) };
  }
  if (win === 'BALANCED') {
    return { control: 'BALANCED', confidence: 0.45 };
  }
  return { control: 'UNCLEAR', confidence: 0.35 };
}

function deriveLiquidityBehavior(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  metrics: ClassificationInputMetrics | null,
  config: CandleClassificationConfig,
): LiquidityBehaviorLayer {
  const quality = resolveDataQuality(metrics);
  const fromBook = metrics != null && hasBookLiquidity(metrics);

  const bidConsumption = metricView(
    metrics?.bidConsumption ?? null,
    metrics?.bidConsumptionPercentile ?? null,
    metrics?.bidConsumptionZ ?? null,
    metrics?.rawBidConsumed ?? null,
    config,
  );
  const askConsumption = metricView(
    metrics?.askConsumption ?? null,
    metrics?.askConsumptionPercentile ?? null,
    metrics?.askConsumptionZ ?? null,
    metrics?.rawAskConsumed ?? null,
    config,
  );
  const bidPulling = metricView(
    metrics?.bidWithdrawal ?? null,
    metrics?.bidWithdrawalPercentile ?? null,
    metrics?.bidWithdrawalZ ?? null,
    metrics?.rawBidCancelled ?? null,
    config,
  );
  const askPulling = metricView(
    metrics?.askWithdrawal ?? null,
    metrics?.askWithdrawalPercentile ?? null,
    metrics?.askWithdrawalZ ?? null,
    metrics?.rawAskCancelled ?? null,
    config,
  );
  const bidReplenishment = metricView(
    metrics?.bidReplenishment ?? null,
    metrics?.bidReplenishmentPercentile ?? null,
    null,
    metrics?.rawBidReplenished ?? null,
    config,
  );
  const askReplenishment = metricView(
    metrics?.askReplenishment ?? null,
    metrics?.askReplenishmentPercentile ?? null,
    null,
    metrics?.rawAskReplenished ?? null,
    config,
  );
  const bidSurvival = metricView(metrics?.bidSurvival ?? null, null, null, null, config);
  const askSurvival = metricView(metrics?.askSurvival ?? null, null, null, null, config);

  // Heuristic vacuum only supplements pulling when book metrics are absent —
  // never invents consumption, and never becomes control.
  if (!fromBook) {
    const vac = vacuumKind(bar, prior);
    if (vac === 'UPSIDE') {
      const stretch = vacuumStretchScore(bar, prior);
      if (askPulling.score == null) {
        askPulling.score = stretch;
        askPulling.state = stateFromScore(stretch, config);
        askPulling.percentile = null;
      }
    } else if (vac === 'DOWNSIDE') {
      const stretch = vacuumStretchScore(bar, prior);
      if (bidPulling.score == null) {
        bidPulling.score = stretch;
        bidPulling.state = stateFromScore(stretch, config);
        bidPulling.percentile = null;
      }
    }
  }

  const candidates: Array<{ event: DominantLiquidityEvent; score: number | null; percentile: number | null }> = [
    { event: 'BIDS_CONSUMED', score: bidConsumption.score, percentile: bidConsumption.percentile },
    { event: 'ASKS_CONSUMED', score: askConsumption.score, percentile: askConsumption.percentile },
    { event: 'BIDS_PULLED', score: bidPulling.score, percentile: bidPulling.percentile },
    { event: 'ASKS_PULLED', score: askPulling.score, percentile: askPulling.percentile },
    { event: 'BIDS_REPLENISHED', score: bidReplenishment.score, percentile: bidReplenishment.percentile },
    { event: 'ASKS_REPLENISHED', score: askReplenishment.score, percentile: askReplenishment.percentile },
    { event: 'BIDS_SURVIVING', score: bidSurvival.score, percentile: bidSurvival.percentile },
    { event: 'ASKS_SURVIVING', score: askSurvival.score, percentile: askSurvival.percentile },
  ];

  // Incomplete book data: do not promote strong pull/consumption from missing values.
  const dominantEvent =
    quality === 'NO_DATA' || quality === 'STALE_DATA' || quality === 'LOW_CONFIDENCE'
      ? softDominantWhenPartial(candidates, quality, config)
      : pickDominantLiquidityEvent(candidates, config);

  return {
    bidConsumption,
    bidPulling,
    bidReplenishment,
    bidSurvival,
    askConsumption,
    askPulling,
    askReplenishment,
    askSurvival,
    dominantEvent,
    dataQuality: quality,
  };
}

function softDominantWhenPartial(
  candidates: Array<{ event: DominantLiquidityEvent; score: number | null; percentile: number | null }>,
  quality: ClassificationDataQuality,
  config: CandleClassificationConfig,
): DominantLiquidityEvent {
  if (quality === 'NO_DATA') {
    // Heuristic-only stretching may still yield a dominant pull, gated normally.
    return pickDominantLiquidityEvent(candidates, config);
  }
  if (quality === 'STALE_DATA' || quality === 'LOW_CONFIDENCE') {
    return 'NONE';
  }
  return pickDominantLiquidityEvent(candidates, config);
}

function deriveSpecialEvent(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  metrics: ClassificationInputMetrics | null,
): SpecialEventLayer {
  const hunt = stopHuntKind(bar, prior, metrics);
  if (hunt === 'HIGH') {
    return { type: 'STOP_HUNT_HIGH', confidence: huntConfidence(bar, prior, 'HIGH', metrics) };
  }
  if (hunt === 'LOW') {
    return { type: 'STOP_HUNT_LOW', confidence: huntConfidence(bar, prior, 'LOW', metrics) };
  }

  const location = barLocationFromPrior(bar, prior);
  const absorbed = barAbsorbed(bar);
  const win = barWinner(bar);

  if (location === 'AT_SUPPORT' && (absorbed === 'SELLERS' || win === 'PASSIVE_BUYERS' || win === 'AGGRESSIVE_BUYERS')) {
    return { type: 'HELD_SUPPORT', confidence: clamp(0.5 + (absorbed === 'SELLERS' ? 0.25 : 0.1), 0.45, 0.92) };
  }
  if (location === 'AT_RESISTANCE' && (absorbed === 'BUYERS' || win === 'PASSIVE_SELLERS' || win === 'AGGRESSIVE_SELLERS')) {
    return { type: 'REJECTED_RESISTANCE', confidence: clamp(0.5 + (absorbed === 'BUYERS' ? 0.25 : 0.1), 0.45, 0.92) };
  }
  if (location === 'ABOVE_RESISTANCE' && win === 'AGGRESSIVE_BUYERS') {
    return { type: 'BREAKOUT_ACCEPTANCE', confidence: controlConfidence(bar) };
  }
  if (location === 'BELOW_SUPPORT' && win === 'AGGRESSIVE_SELLERS') {
    return { type: 'BREAKDOWN_ACCEPTANCE', confidence: controlConfidence(bar) };
  }

  if (absorbed === 'SELLERS') {
    return { type: 'SELLER_ABSORBED', confidence: absorbConfidence(bar) };
  }
  if (absorbed === 'BUYERS') {
    return { type: 'BUYER_ABSORBED', confidence: absorbConfidence(bar) };
  }
  if (win === 'PASSIVE_SELLERS') {
    return { type: 'BUYER_ABSORBED', confidence: Math.min(0.72, absorbConfidence(bar)) };
  }
  if (win === 'PASSIVE_BUYERS') {
    return { type: 'SELLER_ABSORBED', confidence: Math.min(0.72, absorbConfidence(bar)) };
  }

  return { type: null, confidence: null };
}

function deriveOutcome(
  bar: FootprintBarLike,
  control: ControlState,
  special: SpecialEventType | null,
  prior: FootprintBarLike[] = [],
  metrics: ClassificationInputMetrics | null = null,
): OutcomeLayer {
  const range = Math.max(bar.high - bar.low, 1e-9);
  const body = Math.abs(bar.close - bar.open);
  const move = bar.close - bar.open;
  const closePos = (bar.close - bar.low) / range;
  const direction: OutcomeDirection = move > 0 ? 'UP' : move < 0 ? 'DOWN' : 'NONE';
  const bodyFrac = body / range;
  const followed =
    (control === 'BUYER_IN_CONTROL' && move > 0) ||
    (control === 'SELLER_IN_CONTROL' && move < 0);

  if (special === 'STOP_HUNT_LOW' || special === 'STOP_HUNT_HIGH') {
    // Reversal confirmation often needs the next candle — stay causal.
    const kind = special === 'STOP_HUNT_LOW' ? 'LOW' : 'HIGH';
    const reversedInBar =
      (special === 'STOP_HUNT_LOW' && closePos >= 0.58) ||
      (special === 'STOP_HUNT_HIGH' && closePos <= 0.42);
    if (reversedInBar) {
      return {
        type: 'REVERSAL',
        direction: special === 'STOP_HUNT_LOW' ? 'UP' : 'DOWN',
        confidence: huntConfidence(bar, prior, kind, metrics),
      };
    }
    return { type: 'PENDING', direction, confidence: null };
  }

  if (special === 'BUYER_ABSORBED' || special === 'SELLER_ABSORBED') {
    if (bodyFrac < 0.3) {
      return { type: 'NO_FOLLOW_THROUGH', direction: 'NONE', confidence: absorbConfidence(bar) };
    }
    return { type: 'PRICE_FAILED', direction, confidence: absorbConfidence(bar) };
  }

  if (followed && bodyFrac >= 0.3) {
    return { type: 'PRICE_FOLLOWED', direction, confidence: controlConfidence(bar) };
  }
  if (followed) {
    return { type: 'CONTINUATION', direction, confidence: clamp(controlConfidence(bar) * 0.85, 0.4, 0.9) };
  }
  if (control === 'BUYER_IN_CONTROL' || control === 'SELLER_IN_CONTROL') {
    return { type: 'NO_FOLLOW_THROUGH', direction, confidence: 0.5 };
  }
  if (bodyFrac < 0.25) {
    return { type: 'NEUTRAL', direction: 'NONE', confidence: 0.4 };
  }
  return { type: 'NEUTRAL', direction, confidence: 0.4 };
}

function derivePrimaryDisplayLabel(
  control: { control: ControlState; confidence: number },
  liquidity: LiquidityBehaviorLayer,
  special: SpecialEventLayer,
  config: CandleClassificationConfig,
): CandleLabel {
  if (
    special.type &&
    special.confidence != null &&
    special.confidence >= config.strongSpecialEventConfidence
  ) {
    return specialEventToCandleLabel(special.type);
  }

  if (
    (control.control === 'BUYER_IN_CONTROL' || control.control === 'SELLER_IN_CONTROL') &&
    control.confidence >= config.strongControlConfidence
  ) {
    return control.control;
  }

  if (liquidity.dominantEvent !== 'NONE') {
    const metric = metricForDominant(liquidity, liquidity.dominantEvent);
    if (
      metric &&
      config.headlineLiquidityStates.includes(metric.state as 'STRONG' | 'EXTREME')
    ) {
      const mapped = liquidityEventToCandleLabel(liquidity.dominantEvent);
      if (mapped) return mapped;
    }
  }

  if (control.control === 'BUYER_IN_CONTROL' || control.control === 'SELLER_IN_CONTROL') {
    return control.control;
  }

  return 'UNCLASSIFIED';
}

function specialEventToCandleLabel(type: SpecialEventType): CandleLabel {
  switch (type) {
    case 'STOP_HUNT_HIGH':
      return 'STOP_HUNT_HIGH';
    case 'STOP_HUNT_LOW':
      return 'STOP_HUNT_LOW';
    case 'BUYER_ABSORBED':
      return 'BUYER_ABSORBED';
    case 'SELLER_ABSORBED':
      return 'SELLER_ABSORBED';
    case 'HELD_SUPPORT':
    case 'BREAKOUT_ACCEPTANCE':
    case 'FAILED_BEARISH_REVERSAL':
      return 'BUYER_IN_CONTROL';
    case 'REJECTED_RESISTANCE':
    case 'BREAKDOWN_ACCEPTANCE':
    case 'FAILED_BULLISH_REVERSAL':
      return 'SELLER_IN_CONTROL';
    default:
      return 'UNCLASSIFIED';
  }
}

function liquidityEventToCandleLabel(event: DominantLiquidityEvent): CandleLabel | null {
  if (event === 'ASKS_PULLED') return 'ASKS_PULLED';
  if (event === 'BIDS_PULLED') return 'BIDS_PULLED';
  // Consumed / replenished / surviving are not in the legacy 9-label alphabet —
  // map consumption follow-through toward control for flat-label consumers.
  if (event === 'ASKS_CONSUMED') return 'BUYER_IN_CONTROL';
  if (event === 'BIDS_CONSUMED') return 'SELLER_IN_CONTROL';
  return null;
}

function metricForDominant(
  layer: LiquidityBehaviorLayer,
  event: DominantLiquidityEvent,
): LiquidityMetricView | null {
  switch (event) {
    case 'BIDS_CONSUMED':
      return layer.bidConsumption;
    case 'ASKS_CONSUMED':
      return layer.askConsumption;
    case 'BIDS_PULLED':
      return layer.bidPulling;
    case 'ASKS_PULLED':
      return layer.askPulling;
    case 'BIDS_REPLENISHED':
      return layer.bidReplenishment;
    case 'ASKS_REPLENISHED':
      return layer.askReplenishment;
    case 'BIDS_SURVIVING':
      return layer.bidSurvival;
    case 'ASKS_SURVIVING':
      return layer.askSurvival;
    default:
      return null;
  }
}

function metricView(
  score: number | null,
  percentile: number | null,
  zScore: number | null,
  rawValue: number | null,
  config: CandleClassificationConfig,
): LiquidityMetricView {
  if (score == null || !Number.isFinite(score)) {
    return {
      score: null,
      state: 'NO_DATA',
      percentile: percentile ?? null,
      zScore: zScore ?? null,
      rawValue: rawValue ?? null,
    };
  }
  return {
    score: clamp(score, 0, 100),
    state: stateFromScore(score, config),
    percentile: percentile ?? null,
    zScore: zScore ?? null,
    rawValue: rawValue ?? null,
  };
}

function resolveDataQuality(metrics: ClassificationInputMetrics | null): ClassificationDataQuality {
  if (!metrics) return 'NO_DATA';
  if (metrics.dataStale) return 'STALE_DATA';
  if (metrics.dataQualityScore != null && metrics.dataQualityScore < 35) return 'LOW_CONFIDENCE';
  if (!hasBookLiquidity(metrics)) {
    // Survival-only from battle still counts as partial.
    if (metrics.bidSurvival != null || metrics.askSurvival != null) return 'PARTIAL_DATA';
    return 'NO_DATA';
  }
  const known = [
    metrics.bidConsumption,
    metrics.askConsumption,
    metrics.bidWithdrawal,
    metrics.askWithdrawal,
    metrics.bidReplenishment,
    metrics.askReplenishment,
  ].filter((v) => v != null).length;
  if (known < 4) return 'PARTIAL_DATA';
  if (metrics.dataQualityScore != null && metrics.dataQualityScore < 50) return 'LOW_CONFIDENCE';
  return 'OK';
}

function hasBookLiquidity(metrics: ClassificationInputMetrics): boolean {
  return (
    metrics.bidConsumption != null ||
    metrics.askConsumption != null ||
    metrics.bidWithdrawal != null ||
    metrics.askWithdrawal != null ||
    metrics.bidReplenishment != null ||
    metrics.askReplenishment != null
  );
}

function intensityToScore(label: IntensityLabel | string | undefined): number | null {
  if (!label) return null;
  if (label === 'EXTREME') return 90;
  if (label === 'HIGH') return 75;
  if (label === 'NORMAL') return 45;
  if (label === 'LOW') return 25;
  return null;
}

// ─── Shared bar heuristics (causal; no next-bar) ─────────────────────────────

function volumeOf(bar: FootprintBarLike): number {
  if (typeof bar.volume === 'number' && Number.isFinite(bar.volume)) return bar.volume;
  return (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
}

export function barWinner(bar: FootprintBarLike): string {
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const mid = (bar.high + bar.low) / 2 || bar.close;
  const move = mid ? (bar.close - bar.open) / mid : 0;
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const stalled = Math.abs(move) < 0.00045 || (range > 0 && body / range < 0.3);
  if (delta > 0 && stalled) return 'PASSIVE_SELLERS';
  if (delta < 0 && stalled) return 'PASSIVE_BUYERS';
  if (delta > 0 && move > 0) return 'AGGRESSIVE_BUYERS';
  if (delta < 0 && move < 0) return 'AGGRESSIVE_SELLERS';
  return 'BALANCED';
}

export function barAbsorbed(bar: FootprintBarLike): 'SELLERS' | 'BUYERS' | null {
  const vol = volumeOf(bar);
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const dominated = vol > 0 && Math.abs(delta / vol) >= 0.25;
  if (dominated && delta < 0 && closePos >= 0.55) return 'SELLERS';
  if (dominated && delta > 0 && closePos <= 0.45) return 'BUYERS';
  return null;
}

function priorSwingLevels(prior: FootprintBarLike[]): { support: number | null; resistance: number | null } {
  const ranked = rankedHuntLevels(prior);
  return { support: ranked.support, resistance: ranked.resistance };
}

function barLocationFromPrior(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
): 'AT_SUPPORT' | 'AT_RESISTANCE' | 'ABOVE_RESISTANCE' | 'BELOW_SUPPORT' | 'MID_RANGE' | 'UNKNOWN' {
  const { support, resistance } = priorSwingLevels(prior);
  if (support == null || resistance == null || resistance <= support) return 'UNKNOWN';
  const band = Math.max((resistance - support) * 0.12, (bar.close || 1) * 0.0015);
  if (bar.close > resistance + band * 0.15) return 'ABOVE_RESISTANCE';
  if (bar.close < support - band * 0.15) return 'BELOW_SUPPORT';
  if (bar.high >= resistance - band) return 'AT_RESISTANCE';
  if (bar.low <= support + band) return 'AT_SUPPORT';
  return 'MID_RANGE';
}

/**
 * Swing / equal-level candidates for stop liquidity.
 * Prefers clustered pivot highs/lows over a single noisy extreme.
 */
function rankedHuntLevels(prior: FootprintBarLike[]): {
  support: number | null;
  resistance: number | null;
  supportTouches: number;
  resistanceTouches: number;
} {
  if (!prior.length) {
    return { support: null, resistance: null, supportTouches: 0, resistanceTouches: 0 };
  }
  const recent = prior.slice(-24);
  const atrRef = recent[recent.length - 1]!;
  const atr = recentBarAtr(prior, atrRef);
  const tol = Math.max(atr * 0.28, (atrRef.close || 1) * 0.0008);

  const pivotLows: number[] = [];
  const pivotHighs: number[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const p = recent[i]!;
    const l = recent[i - 1]!;
    const r = recent[i + 1]!;
    if (p.low <= l.low && p.low <= r.low) pivotLows.push(p.low);
    if (p.high >= l.high && p.high >= r.high) pivotHighs.push(p.high);
  }

  const window16 = prior.slice(-16);
  let absHigh = -Infinity;
  let absLow = Infinity;
  for (const b of window16) {
    if (b.high > absHigh) absHigh = b.high;
    if (b.low < absLow) absLow = b.low;
  }
  if (!Number.isFinite(absHigh) || !Number.isFinite(absLow)) {
    return { support: null, resistance: null, supportTouches: 0, resistanceTouches: 0 };
  }

  const supportPick = pickClusteredLevel(pivotLows, absLow, tol, 'support');
  const resistancePick = pickClusteredLevel(pivotHighs, absHigh, tol, 'resistance');
  return {
    support: supportPick.level,
    resistance: resistancePick.level,
    supportTouches: supportPick.touches,
    resistanceTouches: resistancePick.touches,
  };
}

function pickClusteredLevel(
  pivots: number[],
  extreme: number,
  tol: number,
  side: 'support' | 'resistance',
): { level: number; touches: number } {
  const points = pivots.slice();
  if (Number.isFinite(extreme)) points.push(extreme);
  if (!points.length) return { level: extreme, touches: 1 };

  const sorted = [...points].sort((a, b) => a - b);
  type Cluster = { sum: number; count: number; min: number; max: number };
  const clusters: Cluster[] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && p - last.max <= tol) {
      last.sum += p;
      last.count += 1;
      last.max = p;
    } else {
      clusters.push({ sum: p, count: 1, min: p, max: p });
    }
  }

  let best = clusters[0]!;
  for (const c of clusters) {
    if (c.count > best.count) {
      best = c;
      continue;
    }
    if (c.count === best.count) {
      const bestMean = best.sum / best.count;
      const mean = c.sum / c.count;
      if (side === 'support' ? mean < bestMean : mean > bestMean) best = c;
    }
  }

  // Prefer the extreme if it sits in a strong cluster; otherwise use cluster mean.
  const mean = best.sum / best.count;
  const extremeInCluster = Math.abs(extreme - mean) <= tol * 1.25;
  const level = extremeInCluster ? extreme : mean;
  return { level, touches: best.count };
}

function recentBarAtr(prior: FootprintBarLike[], bar: FootprintBarLike): number {
  const look = prior.slice(-8);
  if (!look.length) return Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
  let s = 0;
  for (const b of look) s += Math.max(b.high - b.low, 0);
  return s / look.length || Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
}

export function vacuumKind(bar: FootprintBarLike, prior: FootprintBarLike[]): 'UPSIDE' | 'DOWNSIDE' | null {
  const buy = bar.totalBuy ?? 0;
  const sell = bar.totalSell ?? 0;
  const vol = buy + sell;
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  const atr = recentBarAtr(prior, bar);
  const closePos = (bar.close - bar.low) / range;
  const move = bar.close - bar.open;
  const expanded = range >= atr * 1.15;
  const ran = Math.abs(move) >= atr * 0.45;
  if (!expanded && !ran) return null;
  const deltaPct = vol > 0 ? (buy - sell) / vol : move > 0 ? 0.3 : move < 0 ? -0.3 : 0;
  if (deltaPct >= 0.18 && move > 0 && closePos >= 0.62) return 'UPSIDE';
  if (deltaPct <= -0.18 && move < 0 && closePos <= 0.38) return 'DOWNSIDE';
  if (move > 0 && closePos >= 0.72 && range >= atr * 1.35) return 'UPSIDE';
  if (move < 0 && closePos <= 0.28 && range >= atr * 1.35) return 'DOWNSIDE';
  return null;
}

function vacuumStretchScore(bar: FootprintBarLike, prior: FootprintBarLike[]): number {
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  const stretch = atr > 0 ? range / atr : 1;
  // Map stretch into 0–100; only extreme stretches clear dominance gates alone.
  return clamp(40 + (stretch - 1) * 35, 0, 100);
}

/**
 * Stop hunt = pierce real stop liquidity (swing / equal high-low), reject back inside,
 * with flow evidence of absorption or aggressive flip — not a naked wick.
 */
export function stopHuntKind(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  metrics: ClassificationInputMetrics | null = null,
): 'HIGH' | 'LOW' | null {
  const levels = rankedHuntLevels(prior);
  const { support, resistance } = levels;
  if (support == null || resistance == null || resistance <= support) return null;

  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  // Tiny noise bars are not hunts.
  if (range < atr * 0.55) return null;

  const closePos = (bar.close - bar.low) / range;
  const band = Math.max((resistance - support) * 0.08, atr * 0.35);
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const bodyFrac = Math.abs(bar.close - bar.open) / range;

  const highPierce = bar.high >= resistance + band * 0.2;
  const lowPierce = bar.low <= support - band * 0.2;
  const highReject = bar.close < resistance && closePos <= 0.42 && upperWick / range >= 0.32;
  const lowReject = bar.close > support && closePos >= 0.58 && lowerWick / range >= 0.32;

  // Continuation displacement after pierce = breakout, not hunt.
  if (highPierce && closePos >= 0.7 && bodyFrac >= 0.45) return null;
  if (lowPierce && closePos <= 0.3 && bodyFrac >= 0.45) return null;

  if (highPierce && highReject && huntFlowConfirms(bar, 'HIGH', metrics, prior)) {
    // Weak single-touch mid pivots need stronger reclaim.
    if (levels.resistanceTouches < 2 && closePos > 0.35) return null;
    return 'HIGH';
  }
  if (lowPierce && lowReject && huntFlowConfirms(bar, 'LOW', metrics, prior)) {
    if (levels.supportTouches < 2 && closePos < 0.65) return null;
    return 'LOW';
  }
  return null;
}

function huntFlowConfirms(
  bar: FootprintBarLike,
  kind: 'HIGH' | 'LOW',
  metrics: ClassificationInputMetrics | null,
  prior: FootprintBarLike[],
): boolean {
  const absorbed = barAbsorbed(bar);
  const win = barWinner(bar);
  const vol = volumeOf(bar);
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const deltaPct = vol > 0 ? delta / vol : 0;

  const priorVac =
    prior.length > 0 ? vacuumKind(prior[prior.length - 1]!, prior.slice(0, -1)) : null;
  const vacuumInto =
    (kind === 'LOW' && priorVac === 'DOWNSIDE') || (kind === 'HIGH' && priorVac === 'UPSIDE');

  if (kind === 'LOW') {
    if (absorbed === 'SELLERS') return true;
    if (win === 'PASSIVE_BUYERS' || win === 'AGGRESSIVE_BUYERS') return true;
    // Classic flush: sell-heavy aggression into lows, close reclaimed high in range.
    if (vol > 0 && deltaPct <= -0.12 && closePos >= 0.62) return true;
    if ((metrics?.bidReplenishment ?? 0) >= 70 || (metrics?.bidSurvival ?? 0) >= 65) return true;
    if ((metrics?.bidWithdrawal ?? 0) >= 75 && closePos >= 0.7) return true;
    if (vacuumInto && closePos >= 0.68) return true;
    // Sparse volume fixtures: allow strong structural reclaim alone.
    if (vol > 0 && vol < 50 && closePos >= 0.7) return true;
    return false;
  }

  if (absorbed === 'BUYERS') return true;
  if (win === 'PASSIVE_SELLERS' || win === 'AGGRESSIVE_SELLERS') return true;
  if (vol > 0 && deltaPct >= 0.12 && closePos <= 0.38) return true;
  if ((metrics?.askReplenishment ?? 0) >= 70 || (metrics?.askSurvival ?? 0) >= 65) return true;
  if ((metrics?.askWithdrawal ?? 0) >= 75 && closePos <= 0.3) return true;
  if (vacuumInto && closePos <= 0.32) return true;
  if (vol > 0 && vol < 50 && closePos <= 0.3) return true;
  return false;
}

function huntConfidence(
  bar: FootprintBarLike,
  prior: FootprintBarLike[],
  kind: 'HIGH' | 'LOW',
  metrics: ClassificationInputMetrics | null = null,
): number {
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const extremity = kind === 'LOW' ? closePos : 1 - closePos;
  const atr = recentBarAtr(prior, bar);
  const levels = rankedHuntLevels(prior);
  const level = kind === 'LOW' ? levels.support : levels.resistance;
  const touches = kind === 'LOW' ? levels.supportTouches : levels.resistanceTouches;
  const swept =
    level == null
      ? 0
      : kind === 'LOW'
        ? Math.max(0, level - bar.low)
        : Math.max(0, bar.high - level);
  const sweepFrac = atr > 0 ? clamp(swept / atr, 0, 1.5) / 1.5 : 0;
  const wick =
    kind === 'LOW'
      ? (Math.min(bar.open, bar.close) - bar.low) / range
      : (bar.high - Math.max(bar.open, bar.close)) / range;

  let score = 0.48 + extremity * 0.22 + sweepFrac * 0.12 + clamp(wick, 0, 1) * 0.1;
  if (touches >= 2) score += 0.06;
  if (touches >= 3) score += 0.03;

  const absorbed = barAbsorbed(bar);
  if ((kind === 'LOW' && absorbed === 'SELLERS') || (kind === 'HIGH' && absorbed === 'BUYERS')) {
    score += 0.08;
  }

  if (kind === 'LOW') {
    if ((metrics?.bidReplenishment ?? 0) >= 70 || (metrics?.bidSurvival ?? 0) >= 65) score += 0.05;
  } else if ((metrics?.askReplenishment ?? 0) >= 70 || (metrics?.askSurvival ?? 0) >= 65) {
    score += 0.05;
  }

  return clamp(score, 0.5, 0.98);
}

function absorbConfidence(bar: FootprintBarLike): number {
  const vol = volumeOf(bar);
  const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
  const imb = vol > 0 ? delta / vol : 0;
  const range = Math.max(bar.high - bar.low, 1e-9);
  const body = Math.abs(bar.close - bar.open) / range;
  return clamp(0.45 + imb * 0.4 + (1 - body) * 0.15, 0.4, 0.96);
}

function controlConfidence(bar: FootprintBarLike): number {
  const vol = volumeOf(bar);
  const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
  const imb = vol > 0 ? delta / vol : 0;
  return clamp(0.5 + imb * 0.45, 0.45, 0.97);
}

/** Legacy flat classifier preserved for audit comparisons only. */
export function classifyBarLegacy(bar: FootprintBarLike, prior: FootprintBarLike[]): CandleLabel {
  const hunt = stopHuntKind(bar, prior);
  if (hunt === 'HIGH') return 'STOP_HUNT_HIGH';
  if (hunt === 'LOW') return 'STOP_HUNT_LOW';
  const vac = vacuumKind(bar, prior);
  if (vac === 'UPSIDE') return 'ASKS_PULLED';
  if (vac === 'DOWNSIDE') return 'BIDS_PULLED';
  const absorbed = barAbsorbed(bar);
  if (absorbed === 'SELLERS') return 'SELLER_ABSORBED';
  if (absorbed === 'BUYERS') return 'BUYER_ABSORBED';
  const win = barWinner(bar);
  if (win === 'AGGRESSIVE_BUYERS') return 'BUYER_IN_CONTROL';
  if (win === 'AGGRESSIVE_SELLERS') return 'SELLER_IN_CONTROL';
  if (win === 'PASSIVE_SELLERS') return 'BUYER_ABSORBED';
  if (win === 'PASSIVE_BUYERS') return 'SELLER_ABSORBED';
  return 'UNCLASSIFIED';
}
