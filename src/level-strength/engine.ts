import { clamp } from '../core/integrity.js';
import {
  DEFAULT_LEVEL_STRENGTH_CONFIG,
  LEVEL_STRENGTH_VERSION,
  emptyLevelWallMap,
  emptyMetric,
  observedMetric,
  type AttackedWallView,
  type DistanceBand,
  type LevelDataQuality,
  type LevelLifecycle,
  type LevelMetric,
  type LevelMetricState,
  type LevelObservation,
  type LevelRef,
  type LevelReliability,
  type LevelSignificance,
  type LevelStrengthConfig,
  type LevelStrengthHistoryPoint,
  type LevelStrengthRow,
  type LevelStrengthState,
  type LevelTrend,
  type LevelWallMap,
  type LevelZone,
  type SurvivalState,
  type WallBattleState,
  type WallBattleVerdict,
  type WallMaturity,
} from '../models/level-strength.js';

export interface LevelMapInput {
  symbol: string;
  timestamp: number;
  currentPrice: number;
  levels: LevelObservation[];
  dataQuality?: LevelDataQuality;
  history?: LevelStrengthHistoryPoint[];
  buyPower?: number | null;
  sellPower?: number | null;
  sideStrength?: { bids: number | null; asks: number | null };
}

/**
 * Ranks significant resting prices. History at or after `timestamp` is ignored.
 * Missing metrics stay null — they are never substituted with 50 or 100.
 */
export function evaluateLevelMap(
  input: LevelMapInput,
  config: LevelStrengthConfig = DEFAULT_LEVEL_STRENGTH_CONFIG,
): LevelWallMap {
  const quality = input.dataQuality ?? 'GOOD';
  if (quality === 'STALE' && !input.levels.length) {
    const empty = emptyLevelWallMap(input.symbol, input.timestamp, input.currentPrice);
    empty.dataQuality = 'STALE';
    return empty;
  }

  const history = (input.history ?? []).filter((point) => point.timestamp < input.timestamp);
  const scored = input.levels
    .filter((level) => !level.outOfView && level.currentSize > 0 && level.price > 0)
    .map((level) => scoreLevel(level, history, quality, config))
    .filter((level) => level.significance === 'SIGNIFICANT');

  const asks = scored.filter((level) => level.side === 'ASK');
  const bids = scored.filter((level) => level.side === 'BID');
  const ladderAsks = nearest(asks, config.topLevels);
  const ladderBids = nearest(bids, config.topLevels);
  markAttacked(ladderAsks, ladderBids, input.buyPower ?? null, input.sellPower ?? null);

  const events = eventsOf(scored, history, config);
  const currentlyAttackedAsk = attackedView(ladderAsks, 'ASK', input.buyPower ?? null, input.sellPower ?? null);
  const currentlyAttackedBid = attackedView(ladderBids, 'BID', input.buyPower ?? null, input.sellPower ?? null);
  const askRow = ladderAsks.find((level) => level.attacked) ?? null;
  const bidRow = ladderBids.find((level) => level.attacked) ?? null;
  const battle = battleOf(
    currentlyAttackedAsk,
    currentlyAttackedBid,
    input.buyPower ?? null,
    input.sellPower ?? null,
    askRow,
    bidRow,
  );

  const strongestOverallAsk = strongestByRanking(asks, config);
  const strongestOverallBid = strongestByRanking(bids, config);

  return {
    version: LEVEL_STRENGTH_VERSION,
    symbol: input.symbol,
    timestamp: input.timestamp,
    currentPrice: input.currentPrice,
    dataQuality: quality,
    asks: ladderAsks,
    bids: ladderBids,
    nearTouchAsks: bandOf(asks, 'NEAR_TOUCH'),
    nearTouchBids: bandOf(bids, 'NEAR_TOUCH'),
    midAsks: bandOf(asks, 'MID'),
    midBids: bandOf(bids, 'MID'),
    deepAsks: bandOf(asks, 'DEEP'),
    deepBids: bandOf(bids, 'DEEP'),
    strongestAsk: strongestOverallAsk,
    strongestBid: strongestOverallBid,
    strongestOverallAsk,
    strongestOverallBid,
    strongestRelevantAsk: mostRelevant(asks),
    strongestRelevantBid: mostRelevant(bids),
    nearestStrongAsk: nearestStrong(asks, config),
    nearestStrongBid: nearestStrong(bids, config),
    currentlyAttackedAsk,
    currentlyAttackedBid,
    zones: zonesOf([...asks, ...bids], config),
    events,
    battle,
    sideStrength: input.sideStrength ?? { bids: null, asks: null },
  };
}

export class LevelStrengthEngine {
  private history: LevelStrengthHistoryPoint[] = [];

  evaluate(input: Omit<LevelMapInput, 'history'>, config?: LevelStrengthConfig): LevelWallMap {
    const map = evaluateLevelMap({ ...input, history: this.history }, config);
    const last = this.history[this.history.length - 1];
    if (last && input.timestamp < last.timestamp) return map;
    if (last && input.timestamp === last.timestamp) {
      this.history = this.history.filter((point) => point.timestamp !== input.timestamp);
    }
    for (const level of [...map.asks, ...map.bids]) {
      this.history.push({
        timestamp: input.timestamp,
        price: level.price,
        side: level.side,
        strength: level.strength,
      });
    }
    if (this.history.length > 400) this.history.splice(0, this.history.length - 400);
    return map;
  }
}

function scoreLevel(
  level: LevelObservation,
  history: LevelStrengthHistoryPoint[],
  quality: LevelDataQuality,
  config: LevelStrengthConfig,
): LevelStrengthRow {
  const significance = significanceOf(level, config);
  const survival = survivalOf(level, config);
  const cancellation = asMetric(
    level.cancellationScore,
    level.cancellationState ?? (level.cancellationScore == null ? 'UNTESTED' : 'OBSERVED'),
  );
  const consumption = asMetric(
    level.consumptionScore,
    level.consumptionState ?? (level.consumed > 0 ? 'OBSERVED' : level.consumptionScore == null ? 'UNTESTED' : 'OBSERVED'),
  );
  const replenishment = asMetric(
    level.replenishmentScore,
    level.replenishmentState ?? (level.replenishmentScore == null ? 'UNTESTED' : 'OBSERVED'),
  );
  const withdrawal = asMetric(
    level.withdrawalScore,
    level.withdrawalState ?? (level.withdrawalScore == null ? 'UNTESTED' : 'OBSERVED'),
  );
  const persistence = asMetric(
    level.persistenceScore,
    level.persistenceState ?? (level.persistenceScore == null ? 'INSUFFICIENT_DATA' : 'OBSERVED'),
  );
  const depth = asMetric(level.sizePercentile, level.sizePercentile == null ? 'INSUFFICIENT_DATA' : 'OBSERVED');
  const nearTouch = observedMetric(
    clamp(Math.exp(-config.distanceWeightK * Math.max(0, level.distanceBps)) * 100, 0, 100),
  );
  const net = netPressure(level, consumption, replenishment);
  const reliabilityMetric = reliabilityScoreOf(level, survival.value, cancellation.value, persistence, replenishment);
  const reliability = reliabilityLabel(level, survival.value, cancellation.value, reliabilityMetric.value ?? 0);

  // Strength ignores near-touch / distance. Missing components drop out of the denominator.
  const w = config.weights;
  const positive: Array<[number, number | null]> = [
    [w.depth, depth.value],
    [w.replenishment, replenishment.value],
    [w.survival, survival.value],
    [w.persistence, persistence.value],
    [w.reliability, reliabilityMetric.value],
  ];
  const negative: Array<[number, number | null]> = [
    [w.cancellation, cancellation.value],
    [w.withdrawal, withdrawal.value],
    [w.netConsumption, net.value],
  ];
  const pos = average(positive);
  const neg = average(negative);
  let strength = pos.used + neg.used === 0
    ? 0
    : clamp(pos.score * (1 - config.penaltyScale * neg.score), 0, 1) * 100;

  const lifecycle = lifecycleOf(level, survival, replenishment.value, config);
  const maturity = maturityOf(level, survival, config);
  if (lifecycle === 'WITHDRAWING' || lifecycle === 'UNRELIABLE') strength *= 0.72;
  if (lifecycle === 'BROKEN' || lifecycle === 'CONSUMED') strength *= 0.5;
  strength = clamp(strength, 0, 100);

  const prior = history
    .filter((point) => point.side === level.side && point.price === level.price)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-5)
    .map((point) => point.strength);
  const { trend, velocity, acceleration } = trendOf(prior, strength);
  const { mismatch, error } = mismatchOf(level, config);
  if (mismatch) strength = Math.min(strength, 55);

  const componentsAvailable = 7;
  const componentsUsed = pos.used + neg.used;
  const confidence = confidenceOf({
    componentsUsed,
    componentsAvailable,
    maturity,
    survivalState: survival.state === 'UNTESTED' ? 'UNTESTED' : survivalRead(survival),
    persistenceMs: level.persistenceMs,
    snapshotCount: level.snapshotCount,
    quality: mismatch ? 'UNRELIABLE' : quality,
    mismatch,
    approachCount: level.approachCheckpoints?.length ?? 0,
  }, config);

  const rankingScore = clamp(
    strength * (confidence / 100) * ((reliabilityMetric.value ?? 40) / 100),
    0,
    100,
  );
  // Relevance is separate: how important this wall is right now.
  const relevance = clamp(
    strength * (nearTouch.value! / 100) * (0.35 + 0.65 * (confidence / 100)),
    0,
    100,
  );

  const survivalReadState = survivalRead(survival);
  const battleState = battleStateOf(lifecycle, survivalReadState, level, consumption.value, replenishment.value);
  const state = stateOf(strength, confidence, lifecycle, reliability, survivalReadState, config);

  return {
    price: level.price,
    side: level.side,
    significance,
    initialSize: level.initialSize,
    currentSize: level.currentSize,
    newAdded: level.newAdded,
    replenished: level.replenished,
    consumed: level.consumed,
    cancelled: level.cancelled,
    survivalRatio: survival.value == null ? null : survival.value / 100,
    survival,
    survivalState: survivalReadState,
    persistenceMs: level.persistenceMs,
    snapshotCount: level.snapshotCount,
    distanceBps: level.distanceBps,
    distanceBand: distanceBand(level.distanceBps, config),
    depthScore: depth,
    nearTouchScore: nearTouch,
    replenishmentScore: replenishment,
    survivalScore: survival,
    persistenceScore: persistence,
    reliabilityScore: reliabilityMetric,
    cancellationScore: cancellation,
    consumptionScore: consumption,
    withdrawalScore: withdrawal,
    netConsumptionPressure: net,
    strength,
    strengthConfidence: confidence,
    rankingScore,
    relevance,
    wallMaturity: maturity,
    reliability,
    state,
    lifecycle,
    battleState,
    trend,
    strengthVelocity: velocity,
    strengthAcceleration: acceleration,
    history: [...prior, Math.round(strength)],
    accountingMismatch: mismatch,
    reconciliationError: error,
    dataQuality: mismatch ? 'UNRELIABLE' : quality,
    lastUpdatedAt: level.lastUpdatedAt,
    attacked: false,
    componentsUsed,
    componentsAvailable,
  };
}

function asMetric(value: number | null | undefined, state: LevelMetricState): LevelMetric {
  if (value == null || !Number.isFinite(value)) return emptyMetric(state);
  return { value, state };
}

function significanceOf(level: LevelObservation, config: LevelStrengthConfig): LevelSignificance {
  if (level.outOfView || level.currentSize <= 0) return 'IGNORE';
  const percentile = level.sizePercentile;
  if (percentile != null && percentile >= config.minSizePercentile) return 'SIGNIFICANT';
  if (level.persistenceMs >= config.minPersistenceMs && (percentile == null || percentile >= 50)) return 'SIGNIFICANT';
  if (percentile != null && percentile >= 40) return 'NORMAL';
  // Cold size percentiles: still show sizeable resting levels so the map is not empty.
  if (percentile == null && level.currentSize > 0 && level.persistenceMs >= config.newMaxMs) return 'SIGNIFICANT';
  return 'IGNORE';
}

/**
 * Survival requires approach evidence beyond birth distance.
 * Appearing inside 20 bps — or drifting a few bps closer without hitting a
 * checkpoint — is not survival proof.
 */
function survivalOf(level: LevelObservation, _config: LevelStrengthConfig): LevelMetric {
  const checkpoints = level.approachCheckpoints ?? [];
  const contacted = level.closestApproachBps != null && level.closestApproachBps <= 0.5;
  const approached = checkpoints.length > 0 || level.attackCount > 0 || contacted;

  if (!approached) return emptyMetric('UNTESTED');

  const base = level.initialSize > 0 ? level.initialSize : level.currentSize;
  if (base <= 0) return emptyMetric('INSUFFICIENT_DATA');
  const atContact = level.sizeAtClosestApproach != null && level.sizeAtClosestApproach > 0
    ? level.sizeAtClosestApproach
    : level.currentSize;
  const ratio = clamp(atContact / base, 0, 1.25);
  return { value: (ratio / 1.25) * 100, state: 'OBSERVED' };
}

function survivalRead(survival: LevelMetric): SurvivalState {
  if (survival.value == null || survival.state === 'UNTESTED') return 'UNTESTED';
  if (survival.value < 20) return 'BROKEN';
  if (survival.value < 45) return 'WEAKENING';
  if (survival.value >= 70) return 'SURVIVING';
  return 'APPROACHED';
}

function netPressure(
  level: LevelObservation,
  consumption: LevelMetric,
  replenishment: LevelMetric,
): LevelMetric {
  if (consumption.value == null || replenishment.value == null) {
    return emptyMetric(consumption.value == null && replenishment.value == null ? 'UNTESTED' : 'INSUFFICIENT_DATA');
  }
  return observedMetric(clamp(consumption.value - replenishment.value, 0, 100));
}

function reliabilityScoreOf(
  level: LevelObservation,
  survival: number | null,
  cancellation: number | null,
  persistence: LevelMetric,
  replenishment: LevelMetric,
): LevelMetric {
  const terms: Array<[number, number | null]> = [
    [0.3, survival],
    [0.25, persistence.value],
    [0.2, replenishment.value],
    [0.15, level.executionCount > 0 ? 100 : null],
    [0.1, cancellation == null ? null : 100 - cancellation],
  ];
  let acc = 0;
  let weight = 0;
  for (const [w, value] of terms) {
    if (value == null) continue;
    acc += w * (clamp(value, 0, 100) / 100);
    weight += w;
  }
  if (weight <= 0) return emptyMetric('INSUFFICIENT_DATA');
  let raw = acc / weight;
  if (level.approachWithdrawal) raw -= 0.35;
  if (level.relocated) raw -= 0.25;
  if (level.persistenceMs < 1_000) raw -= 0.2;
  return observedMetric(clamp(raw, 0, 1) * 100);
}

function reliabilityLabel(
  level: LevelObservation,
  survival: number | null,
  cancellation: number | null,
  reliability: number,
): LevelReliability {
  const depth = level.sizePercentile ?? 0;
  const cancel = cancellation ?? 0;
  if (depth >= 70 && cancel >= 75 && survival != null && survival < 35 && level.persistenceMs < 4_000 && level.executionCount === 0) {
    return 'SPOOF_LIKE';
  }
  if (level.approachWithdrawal || level.relocated || (cancel >= 70 && survival != null && survival < 40)) {
    return 'UNRELIABLE';
  }
  if (reliability >= 70 && (survival == null || survival >= 60) && cancel < 40) return 'RELIABLE';
  return 'MODERATE';
}

function maturityOf(
  level: LevelObservation,
  survival: LevelMetric,
  config: LevelStrengthConfig,
): WallMaturity {
  const tested =
    survival.state === 'OBSERVED' ||
    level.attackCount > 0 ||
    (level.approachCheckpoints?.length ?? 0) > 0;
  if (tested) return 'TESTED';
  if (level.snapshotCount >= config.matureMinSnapshots && level.persistenceMs >= config.formingMaxMs) {
    return 'MATURE';
  }
  if (level.persistenceMs >= config.newMaxMs || level.snapshotCount >= 3) return 'FORMING';
  return 'NEW';
}

function lifecycleOf(
  level: LevelObservation,
  survival: LevelMetric,
  refill: number | null,
  config: LevelStrengthConfig,
): LevelLifecycle {
  const survivalValue = survival.value;
  if (level.currentSize <= 0 && level.consumed > level.cancelled) return 'CONSUMED';
  if (level.approachWithdrawal || (level.relocated && (survivalValue == null || survivalValue < 45))) {
    return 'WITHDRAWING';
  }
  if (survivalValue != null && survivalValue < 20 && level.attackCount > 0) return 'BROKEN';
  const consumedHigh = level.consumed > level.initialSize * 0.4;
  if (consumedHigh && refill != null && refill >= 70 && (survivalValue == null || survivalValue >= 55)) {
    return 'REPLENISHING';
  }
  if (level.attackCount > 0 && (survivalValue == null || survivalValue >= 60) && refill != null && refill >= 50) {
    return 'DEFENDING';
  }
  if (level.attackCount > 0) return 'ATTACKED';
  if (survival.state === 'OBSERVED') return 'APPROACHED';
  if (level.persistenceMs < config.formingMaxMs) {
    return level.persistenceMs < config.newMaxMs ? 'APPEARED' : 'FORMING';
  }
  if ((survivalValue == null || survivalValue >= 70) && (level.persistenceScore ?? 0) >= 50) return 'HOLDING';
  return 'PERSISTING';
}

function battleStateOf(
  lifecycle: LevelLifecycle,
  survival: SurvivalState,
  level: LevelObservation,
  consumption: number | null,
  refill: number | null,
): WallBattleState {
  if (lifecycle === 'BROKEN' || lifecycle === 'CONSUMED' || survival === 'BROKEN') return 'BROKEN';
  if (lifecycle === 'WITHDRAWING' || survival === 'WITHDRAWING') return 'WITHDRAWING';
  if (lifecycle === 'REPLENISHING') return 'REPLENISHING';
  if (lifecycle === 'DEFENDING') return 'DEFENDING';
  if (
    level.attackCount > 0 &&
    consumption != null &&
    consumption >= 60 &&
    refill != null &&
    refill >= 60 &&
    (survival === 'SURVIVING' || survival === 'DEFENDING' || survival === 'APPROACHED')
  ) {
    return 'HOLDING';
  }
  if (level.attackCount > 0 && consumption != null && consumption >= 60 && (refill == null || refill <= 35)) {
    return 'BREAKING';
  }
  if (survival === 'WEAKENING') return 'WEAKENING';
  if (level.attackCount > 0) return 'ATTACKED';
  if (survival === 'APPROACHED' || survival === 'SURVIVING') return 'APPROACHING';
  return 'ATTACK_NOT_STARTED';
}

function stateOf(
  strength: number,
  confidence: number,
  lifecycle: LevelLifecycle,
  reliability: LevelReliability,
  survival: SurvivalState,
  config: LevelStrengthConfig,
): LevelStrengthState {
  if (lifecycle === 'BROKEN' || lifecycle === 'CONSUMED') return 'BROKEN';
  if (lifecycle === 'WITHDRAWING') return 'WITHDRAWING';
  if (reliability === 'SPOOF_LIKE' || reliability === 'UNRELIABLE') return 'UNRELIABLE';
  if (survival === 'UNTESTED' && confidence < config.minConfidenceForState) return 'UNTESTED';
  if (confidence < config.minConfidenceForState) return 'UNCERTAIN';
  if (strength >= config.veryStrong) return 'VERY_STRONG';
  if (lifecycle === 'REPLENISHING' && strength >= config.strong) return 'REPLENISHING';
  if (lifecycle === 'DEFENDING' && strength >= config.strong) return 'DEFENDING';
  if (strength >= config.strong) return 'STRONG';
  if (strength >= config.moderate) return 'MODERATE';
  if (strength >= config.weak) return 'WEAK';
  return 'VERY_WEAK';
}

function confidenceOf(input: {
  componentsUsed: number;
  componentsAvailable: number;
  maturity: WallMaturity;
  survivalState: SurvivalState;
  persistenceMs: number;
  snapshotCount: number;
  quality: LevelDataQuality;
  mismatch: boolean;
  approachCount: number;
}, config: LevelStrengthConfig): number {
  let score = 18;
  score += (input.componentsUsed / Math.max(1, input.componentsAvailable)) * 40;
  if (input.maturity === 'TESTED') score += 18;
  else if (input.maturity === 'MATURE') score += 12;
  else if (input.maturity === 'FORMING') score += 5;
  if (input.survivalState !== 'UNTESTED') score += 10;
  score += clamp(input.approachCount / 3, 0, 1) * 8;
  score += clamp(input.persistenceMs / config.formingMaxMs, 0, 1) * 8;
  score += clamp(input.snapshotCount / config.matureMinSnapshots, 0, 1) * 6;
  if (input.quality === 'STALE') score = Math.min(score, 25);
  if (input.quality === 'UNRELIABLE') score = Math.min(score, 30);
  if (input.quality === 'PARTIAL') score = Math.min(score, 55);
  if (input.mismatch) score = Math.min(score, 28);
  return clamp(score, 0, 100);
}

function trendOf(prior: number[], current: number): {
  trend: LevelTrend;
  velocity: number;
  acceleration: number;
} {
  if (!prior.length) return { trend: 'UNKNOWN', velocity: 0, acceleration: 0 };
  const series = [...prior, current];
  const steps: number[] = [];
  for (let i = 1; i < series.length; i++) steps.push((series[i] ?? 0) - (series[i - 1] ?? 0));
  const velocity = steps.reduce((s, v) => s + v, 0) / steps.length;
  const acceleration = steps.length >= 2
    ? (steps[steps.length - 1] ?? 0) - (steps[steps.length - 2] ?? 0)
    : 0;
  const trend: LevelTrend = velocity >= 8 ? 'STRENGTHENING' : velocity <= -8 ? 'WEAKENING' : 'STABLE';
  return { trend, velocity, acceleration };
}

function mismatchOf(level: LevelObservation, config: LevelStrengthConfig): { mismatch: boolean; error: number } {
  const expected = level.initialSize + level.newAdded - level.cancelled - level.consumed - level.unresolved;
  const base = Math.max(level.currentSize, level.initialSize, 1);
  const error = Math.abs(level.currentSize - expected) / base;
  return { mismatch: error > config.mismatchFraction, error };
}

function average(terms: Array<[number, number | null]>): { score: number; used: number } {
  let acc = 0;
  let weight = 0;
  let used = 0;
  for (const [w, value] of terms) {
    if (w <= 0 || value == null || !Number.isFinite(value)) continue;
    acc += w * (clamp(value, 0, 100) / 100);
    weight += w;
    used += 1;
  }
  return { score: weight > 0 ? acc / weight : 0, used };
}

function distanceBand(bps: number, config: LevelStrengthConfig): DistanceBand {
  if (bps <= config.nearTouchMaxBps) return 'NEAR_TOUCH';
  if (bps <= config.midMaxBps) return 'MID';
  return 'DEEP';
}

function bandOf(levels: LevelStrengthRow[], band: DistanceBand): LevelStrengthRow[] {
  return levels.filter((level) => level.distanceBand === band);
}

function nearest(levels: LevelStrengthRow[], count: number): LevelStrengthRow[] {
  return [...levels]
    .sort((a, b) => a.distanceBps - b.distanceBps)
    .slice(0, count)
    .sort((a, b) => b.price - a.price);
}

function qualifiesForTop(level: LevelStrengthRow, config: LevelStrengthConfig): boolean {
  if (level.strengthConfidence < config.minConfidenceForTop) return false;
  if (!config.minMaturityForTop.includes(level.wallMaturity)) return false;
  if (level.state === 'BROKEN' || level.state === 'UNRELIABLE') return false;
  return true;
}

function strongestByRanking(levels: LevelStrengthRow[], config: LevelStrengthConfig): LevelRef | null {
  const eligible = levels.filter((level) => qualifiesForTop(level, config));
  const pool = eligible.length ? eligible : levels.filter((level) => level.wallMaturity !== 'NEW');
  if (!pool.length) return null;
  return ref(pool.reduce((best, level) => (level.rankingScore > best.rankingScore ? level : best)));
}

function nearestStrong(levels: LevelStrengthRow[], config: LevelStrengthConfig): LevelRef | null {
  const strong = levels.filter((level) =>
    level.strength >= config.strongThreshold &&
    level.strengthConfidence >= config.minConfidenceForTop * 0.75 &&
    level.state !== 'BROKEN' &&
    level.state !== 'UNRELIABLE' &&
    level.state !== 'UNCERTAIN',
  );
  if (!strong.length) return null;
  return ref(strong.reduce((best, level) => (level.distanceBps < best.distanceBps ? level : best)));
}

function mostRelevant(levels: LevelStrengthRow[]): LevelRef | null {
  if (!levels.length) return null;
  return ref(levels.reduce((best, level) => (level.relevance > best.relevance ? level : best)));
}

function ref(level: LevelStrengthRow): LevelRef {
  return {
    price: level.price,
    strength: level.strength,
    strengthConfidence: level.strengthConfidence,
    rankingScore: level.rankingScore,
    state: level.state,
    distanceBps: level.distanceBps,
    relevance: level.relevance,
    wallMaturity: level.wallMaturity,
    trend: level.trend,
  };
}

function zonesOf(levels: LevelStrengthRow[], config: LevelStrengthConfig): LevelZone[] {
  if (config.zoneBps <= 0) return [];
  const zones: LevelZone[] = [];
  for (const side of ['ASK', 'BID'] as const) {
    const rows = levels
      .filter((level) => level.side === side && level.significance === 'SIGNIFICANT')
      .sort((a, b) => a.price - b.price);
    let cluster: LevelStrengthRow[] = [];
    const flush = () => {
      if (cluster.length < 2) {
        cluster = [];
        return;
      }
      const notional = cluster.reduce((sum, level) => sum + level.currentSize, 0);
      const strength = notional > 0
        ? cluster.reduce((sum, level) => sum + level.strength * level.currentSize, 0) / notional
        : cluster.reduce((sum, level) => sum + level.strength, 0) / cluster.length;
      zones.push({
        side,
        priceMin: cluster[0]?.price ?? 0,
        priceMax: cluster[cluster.length - 1]?.price ?? 0,
        strength,
        levelCount: cluster.length,
      });
      cluster = [];
    };
    for (const level of rows) {
      const prev = cluster[cluster.length - 1];
      const mid = ((prev?.price ?? level.price) + level.price) / 2;
      const gapBps = prev && mid > 0 ? Math.abs(level.price - prev.price) / mid * 10_000 : 0;
      if (prev && gapBps > config.zoneBps) flush();
      cluster.push(level);
    }
    flush();
  }
  return zones;
}

function eventsOf(
  levels: LevelStrengthRow[],
  history: LevelStrengthHistoryPoint[],
  config: LevelStrengthConfig,
): LevelWallMap['events'] {
  const events: LevelWallMap['events'] = [];
  for (const side of ['ASK', 'BID'] as const) {
    const rows = levels.filter((level) => level.side === side);
    const broken = rows.find((level) => {
      const prior = history.filter((point) => point.side === level.side && point.price === level.price);
      const first = prior[0]?.strength;
      const drop = first == null ? 0 : level.strength - first;
      const survivalWeak = level.survival.value != null && level.survival.value < 45;
      const netHigh = level.netConsumptionPressure.value != null && level.netConsumptionPressure.value >= 25;
      return drop <= -config.breakDrop && netHigh && survivalWeak;
    });
    if (broken) {
      events.push(side === 'ASK' ? 'ASK_WALL_BROKEN' : 'BID_WALL_BROKEN');
      continue;
    }
    const holding = rows.find((level) =>
      (level.lifecycle === 'DEFENDING' || level.lifecycle === 'REPLENISHING' || level.battleState === 'HOLDING') &&
      level.strength >= config.strong &&
      level.strengthConfidence >= config.minConfidenceForState,
    );
    if (holding) events.push(side === 'ASK' ? 'ASK_WALL_HOLDING' : 'BID_WALL_HOLDING');
  }
  return events;
}

function markAttacked(
  asks: LevelStrengthRow[],
  bids: LevelStrengthRow[],
  buyPower: number | null,
  sellPower: number | null,
): void {
  if (buyPower != null && buyPower >= 55) {
    const target = [...asks].sort((a, b) => a.distanceBps - b.distanceBps)[0];
    if (target && target.distanceBps <= 30) target.attacked = true;
  }
  if (sellPower != null && sellPower >= 55) {
    const target = [...bids].sort((a, b) => a.distanceBps - b.distanceBps)[0];
    if (target && target.distanceBps <= 30) target.attacked = true;
  }
}

function attackedView(
  levels: LevelStrengthRow[],
  side: 'ASK' | 'BID',
  buyPower: number | null,
  sellPower: number | null,
): AttackedWallView | null {
  const target = levels.find((level) => level.attacked) ?? null;
  if (!target) return null;
  return {
    price: target.price,
    side,
    buyAttack: side === 'ASK' ? buyPower : null,
    sellAttack: side === 'BID' ? sellPower : null,
    wallStrength: target.strength,
    strengthConfidence: target.strengthConfidence,
    consumption: target.consumptionScore.value,
    replenishment: target.replenishmentScore.value,
    survival: target.survival.value,
    state: target.battleState,
  };
}

function battleOf(
  ask: AttackedWallView | null,
  bid: AttackedWallView | null,
  buyPower: number | null,
  sellPower: number | null,
  askRow: LevelStrengthRow | null,
  bidRow: LevelStrengthRow | null,
): LevelWallMap['battle'] {
  if (ask && buyPower != null && askRow) {
    return {
      attacked: ref(askRow),
      currentlyAttackedAsk: ask,
      currentlyAttackedBid: bid,
      attackSide: 'BUY',
      attackPower: buyPower,
      battleState: ask.state,
      verdict: verdict(buyPower, ask.wallStrength, 'ASK', ask.state),
    };
  }
  if (bid && sellPower != null && bidRow) {
    return {
      attacked: ref(bidRow),
      currentlyAttackedAsk: ask,
      currentlyAttackedBid: bid,
      attackSide: 'SELL',
      attackPower: sellPower,
      battleState: bid.state,
      verdict: verdict(sellPower, bid.wallStrength, 'BID', bid.state),
    };
  }
  return {
    attacked: null,
    currentlyAttackedAsk: ask,
    currentlyAttackedBid: bid,
    attackSide: null,
    attackPower: null,
    battleState: 'ATTACK_NOT_STARTED',
    verdict: 'NONE',
  };
}

function verdict(
  attack: number,
  wall: number,
  side: 'ASK' | 'BID',
  battleState: WallBattleState,
): WallBattleVerdict {
  const breaking = battleState === 'BREAKING' || battleState === 'BROKEN' || (attack >= wall + 8 && wall < 60);
  if (side === 'ASK') return breaking ? 'BUYERS_BREAKING_WALL' : 'SELLERS_DEFENDING';
  return breaking ? 'SELLERS_BREAKING_WALL' : 'BUYERS_DEFENDING';
}

/** @internal exported for tests */
export function _testHooks() {
  return { survivalOf, average, confidenceOf, maturityOf };
}
