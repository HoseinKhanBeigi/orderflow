import { clamp } from '../core/integrity.js';
import {
  DEFAULT_PASSIVE_STRENGTH_CONFIG,
  PASSIVE_STRENGTH_VERSION,
  emptyPassiveStrengthSnapshot,
  type ChurnState,
  type DefenseRead,
  type PassiveSideComponents,
  type PassiveSideState,
  type PassiveSideTrend,
  type PassiveStrengthConfig,
  type PassiveStrengthDataStatus,
  type PassiveStrengthInput,
  type PassiveStrengthSide,
  type PassiveStrengthSnapshot,
  type PassiveStrengthState,
  type PassiveWinner,
  type StrengthHistoryPoint,
  type SurvivalRead,
  type WallReliabilityLabel,
} from '../models/passive-strength.js';

const EPS = 1e-9;

/**
 * Scores one observation from components that are already normalized.
 * History points at or after `timestamp` are ignored, so a later sample cannot move this read.
 */
export function evaluatePassiveStrength(
  input: PassiveStrengthInput,
  config: PassiveStrengthConfig = DEFAULT_PASSIVE_STRENGTH_CONFIG,
): PassiveStrengthSnapshot {
  const history = (input.history ?? [])
    .filter((point) => point.timestamp < input.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-4);

  if (input.dataStatus === 'NO_DATA' || !hasAnyComponent(input.bids) && !hasAnyComponent(input.asks)) {
    const empty = emptyPassiveStrengthSnapshot(input.symbol, input.timestamp);
    empty.dataStatus = input.dataStatus === 'NO_DATA' ? 'NO_DATA' : 'PARTIAL_DATA';
    empty.reasons = ['passive measurements are missing'];
    return empty;
  }

  const bids = scoreSide(input.bids, history.map((p) => p.bidStrength), config);
  const asks = scoreSide(input.asks, history.map((p) => p.askStrength), config);
  const spread = bids.strength - asks.strength;
  const imbalance = spread / Math.max(bids.strength + asks.strength, EPS);
  const mismatch = input.reconciliationError != null && input.reconciliationError > config.mismatchSoft;
  const hardMismatch = input.reconciliationError != null && input.reconciliationError > config.mismatchHard;

  let state = classify(bids, asks, spread, config);
  let dataStatus: PassiveStrengthDataStatus = input.dataStatus;
  if (hardMismatch) {
    state = 'UNCERTAIN';
    dataStatus = dataStatus === 'OK' ? 'LOW_CONFIDENCE' : dataStatus;
  } else if (input.dataStatus === 'STALE_DATA') {
    state = 'UNCERTAIN';
  }

  let confidence = confidenceOf(input.dataStatus, bids, asks, mismatch, hardMismatch, history.length);
  if (state === 'UNCERTAIN') confidence = Math.min(confidence, hardMismatch ? 20 : 35);

  const winner = winnerOf(state, confidence);
  const reasons = explain(state, bids, asks, spread, mismatch, hardMismatch);

  return {
    version: PASSIVE_STRENGTH_VERSION,
    symbol: input.symbol,
    timestamp: input.timestamp,
    bids,
    asks,
    passiveStrengthSpread: spread,
    passiveStrengthImbalance: clamp(imbalance, -1, 1),
    passiveWinner: winner,
    state,
    confidence,
    dataStatus,
    accountingMismatch: mismatch,
    reasons,
    strongestBidWall: input.strongestBidWall ?? null,
    strongestAskWall: input.strongestAskWall ?? null,
  };
}

/**
 * Remembers prior scores for velocity. A timestamp older than the latest sample is ignored.
 */
export class PassiveLiquidityStrengthEngine {
  private history: StrengthHistoryPoint[] = [];

  evaluate(
    input: Omit<PassiveStrengthInput, 'history'>,
    config: PassiveStrengthConfig = DEFAULT_PASSIVE_STRENGTH_CONFIG,
  ): PassiveStrengthSnapshot {
    const snapshot = evaluatePassiveStrength({ ...input, history: this.history }, config);
    const last = this.history[this.history.length - 1];
    if (last && input.timestamp < last.timestamp) return snapshot;
    if (last && input.timestamp === last.timestamp) {
      last.bidStrength = snapshot.bids.strength;
      last.askStrength = snapshot.asks.strength;
    } else if (snapshot.dataStatus !== 'NO_DATA') {
      this.history.push({
        timestamp: input.timestamp,
        bidStrength: snapshot.bids.strength,
        askStrength: snapshot.asks.strength,
      });
      if (this.history.length > 8) this.history.shift();
    }
    return snapshot;
  }
}

function scoreSide(
  components: PassiveSideComponents,
  prior: number[],
  config: PassiveStrengthConfig,
): PassiveStrengthSide {
  const w = config.weights;
  const net = netPressure(components);
  const positive: Array<[number, number | null]> = [
    [w.depth, components.depthScore],
    [w.nearTouch, components.nearTouchScore],
    [w.replenishment, components.replenishmentScore],
    [w.survival, components.survivalObserved ? components.survivalScore : null],
    [w.persistence, components.persistenceScore],
    [w.reliability, components.reliabilityScore],
  ];
  const negative: Array<[number, number | null]> = [
    [w.cancellation, components.cancellationScore],
    [w.withdrawal, components.withdrawalScore],
    [w.netConsumption, net],
  ];
  const pos = average(positive);
  const neg = average(negative);
  const strength = pos.used + neg.used === 0
    ? 0
    : clamp(pos.score * (1 - config.penaltyScale * neg.score), 0, 1) * 100;

  const series = [...prior, strength];
  const { velocity, acceleration, trend } = trendOf(series, config);
  const oldest = prior[0];
  const change = oldest == null ? 0 : strength - oldest;
  const churn = churnOf(components.churnRatio, config);
  const survival = survivalRead(components);
  const defense = defenseRead(components, survival);
  const reliability = reliabilityLabel(components);
  const state = sideState(strength, trend, defense, components, velocity, config);

  return {
    strength,
    trend,
    velocity,
    acceleration,
    change,
    depthScore: components.depthScore,
    nearTouchScore: components.nearTouchScore,
    consumptionScore: components.consumptionScore,
    replenishmentScore: components.replenishmentScore,
    cancellationScore: components.cancellationScore,
    withdrawalScore: components.withdrawalScore,
    survivalScore: components.survivalObserved ? components.survivalScore : null,
    persistenceScore: components.persistenceScore,
    reliabilityScore: components.reliabilityScore,
    netConsumptionPressure: net,
    nearTouchConcentration: components.nearTouchConcentration,
    churn,
    survival,
    defense,
    reliability,
    state,
    componentsUsed: pos.used + neg.used,
  };
}

function netPressure(components: PassiveSideComponents): number | null {
  if (components.consumptionScore == null || components.replenishmentScore == null) return null;
  return clamp(components.consumptionScore - components.replenishmentScore, 0, 100);
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

function trendOf(
  series: number[],
  config: PassiveStrengthConfig,
): { velocity: number; acceleration: number; trend: PassiveSideTrend } {
  if (series.length < 2) return { velocity: 0, acceleration: 0, trend: 'UNKNOWN' };
  const steps: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    if (prev === undefined || cur === undefined) continue;
    steps.push(cur - prev);
  }
  const velocity = steps.reduce((s, v) => s + v, 0) / steps.length;
  const acceleration = steps.length >= 2
    ? (steps[steps.length - 1] ?? 0) - (steps[steps.length - 2] ?? 0)
    : 0;
  const trend: PassiveSideTrend = velocity >= config.strengtheningVelocity
    ? 'RISING'
    : velocity <= config.weakeningVelocity
      ? 'FALLING'
      : 'FLAT';
  return { velocity, acceleration, trend };
}

function churnOf(ratio: number | null, config: PassiveStrengthConfig): ChurnState {
  if (ratio == null || !Number.isFinite(ratio)) return 'UNKNOWN';
  if (ratio < config.churnLow) return 'LOW_CHURN';
  if (ratio < config.churnNormal) return 'NORMAL_CHURN';
  if (ratio < config.churnHigh) return 'HIGH_CHURN';
  return 'EXTREME_CHURN';
}

function survivalRead(components: PassiveSideComponents): SurvivalRead {
  if (!components.survivalObserved || components.survivalScore == null) return 'UNTESTED';
  if (components.approachWithdrawal && components.survivalScore < 45) return 'WITHDRAWING';
  if (components.survivalScore < 25) return 'BROKEN';
  if (components.survivalScore < 45) return 'WEAKENING';
  if (
    components.survivalScore >= 70 &&
    (components.consumptionScore ?? 0) >= 50 &&
    (components.replenishmentScore ?? 0) >= 50
  ) {
    return 'DEFENDING';
  }
  if (components.survivalScore >= 70) return 'SURVIVING';
  return 'CONTACTED';
}

function defenseRead(components: PassiveSideComponents, survival: SurvivalRead): DefenseRead {
  const refill = components.replenishmentScore;
  const consumed = components.consumptionScore;
  const cancel = components.cancellationScore ?? 0;
  const withdraw = components.withdrawalScore ?? 0;
  if (survival === 'UNTESTED' && cancel < 60 && !components.approachWithdrawal) return 'UNTESTED';
  if ((cancel >= 70 || withdraw >= 70 || components.approachWithdrawal) && (components.survivalScore == null || components.survivalScore < 45)) {
    return 'WITHDRAWING';
  }
  if (consumed != null && consumed >= 60 && refill != null && refill <= 35 && (components.survivalScore ?? 0) < 45) {
    return 'BREAKING';
  }
  if (consumed != null && consumed >= 60 && refill != null && refill >= 60 && (components.survivalScore == null || components.survivalScore >= 55)) {
    return 'HOLDING';
  }
  if (cancel < 35 && components.survivalScore != null && components.survivalScore >= 70) return 'STAYING';
  if (survival === 'BROKEN' || survival === 'WEAKENING') return 'BREAKING';
  if (survival === 'WITHDRAWING') return 'WITHDRAWING';
  if (survival === 'DEFENDING' || survival === 'SURVIVING') return 'STAYING';
  return 'UNTESTED';
}

function reliabilityLabel(components: PassiveSideComponents): WallReliabilityLabel {
  const depth = components.depthScore ?? 0;
  const cancel = components.cancellationScore ?? 0;
  const survival = components.survivalScore;
  const persistence = components.persistenceScore ?? 0;
  const consumed = components.consumptionScore ?? 0;
  const reliability = components.reliabilityScore;
  if (
    depth >= 70 &&
    cancel >= 75 &&
    survival != null &&
    survival < 35 &&
    persistence < 40 &&
    consumed < 45
  ) {
    return 'SPOOF_LIKE';
  }
  if ((reliability != null && reliability < 40) || (cancel >= 70 && survival != null && survival < 40)) {
    return 'UNRELIABLE';
  }
  if (
    (reliability == null || reliability >= 70) &&
    persistence >= 60 &&
    (survival == null || survival >= 60) &&
    cancel < 40
  ) {
    return 'RELIABLE';
  }
  return 'MODERATE';
}

function sideState(
  strength: number,
  trend: PassiveSideTrend,
  defense: DefenseRead,
  components: PassiveSideComponents,
  velocity: number,
  config: PassiveStrengthConfig,
): PassiveSideState {
  if (!components.survivalObserved && components.persistenceScore == null && components.depthScore == null) {
    return 'UNTESTED';
  }
  if (defense === 'WITHDRAWING') return 'WITHDRAWING';
  if (defense === 'BREAKING' || trend === 'FALLING' || velocity <= config.weakeningVelocity) return 'WEAKENING';
  if (strength >= config.bothStrong && defense !== 'UNTESTED') return 'STRONG_DEFENSE';
  if (strength < config.bothWeak) return 'WEAK';
  if (!components.survivalObserved && strength < 50) return 'UNTESTED';
  return 'MODERATE';
}

function classify(
  bids: PassiveStrengthSide,
  asks: PassiveStrengthSide,
  spread: number,
  config: PassiveStrengthConfig,
): PassiveStrengthState {
  const margin = config.minimumStrengthMargin;
  const bidsFalling = bids.trend === 'FALLING' && bids.change <= -config.weakeningDrop;
  const asksFalling = asks.trend === 'FALLING' && asks.change <= -config.weakeningDrop;
  const churny = (side: PassiveStrengthSide) => side.churn === 'HIGH_CHURN' || side.churn === 'EXTREME_CHURN';

  if (bids.strength >= config.bothStrong && asks.strength >= config.bothStrong && Math.abs(spread) < margin * 1.5) {
    return 'BOTH_STRONG';
  }
  if (bids.strength <= config.bothWeak && asks.strength <= config.bothWeak) return 'BOTH_WEAK';
  if (churny(bids) && churny(asks) && Math.abs(spread) < margin) return 'HIGH_CHURN';
  if (bidsFalling && spread < margin * 2) return 'BIDS_WEAKENING';
  if (asksFalling && spread > -margin * 2) return 'ASKS_WEAKENING';
  if (Math.abs(spread) < margin) return 'BALANCED';
  return spread > 0 ? 'BIDS_STRONGER' : 'ASKS_STRONGER';
}

function confidenceOf(
  status: PassiveStrengthDataStatus,
  bids: PassiveStrengthSide,
  asks: PassiveStrengthSide,
  mismatch: boolean,
  hardMismatch: boolean,
  historySamples: number,
): number {
  let score = status === 'OK' ? 78
    : status === 'PARTIAL_DATA' ? 52
      : status === 'LOW_CONFIDENCE' ? 36
        : status === 'STALE_DATA' ? 22
          : 0;
  if (bids.componentsUsed >= 6 && asks.componentsUsed >= 6) score += 10;
  if (bids.survival !== 'UNTESTED' && asks.survival !== 'UNTESTED') score += 8;
  if (bids.churn === 'HIGH_CHURN' || bids.churn === 'EXTREME_CHURN' || asks.churn === 'HIGH_CHURN' || asks.churn === 'EXTREME_CHURN') {
    score -= 12;
  }
  if (historySamples < 2) score -= 8;
  if (bids.componentsUsed < 3 || asks.componentsUsed < 3) score = Math.min(score, 40);
  if (mismatch) score = Math.min(score, 45);
  if (hardMismatch) score = Math.min(score, 20);
  if (status === 'STALE_DATA') score = Math.min(score, 25);
  return clamp(score, 0, 100);
}

function winnerOf(state: PassiveStrengthState, confidence: number): PassiveWinner {
  if (state === 'UNCERTAIN' || confidence < 35) return 'UNCERTAIN';
  if (state === 'BIDS_STRONGER') return 'BIDS';
  if (state === 'ASKS_STRONGER') return 'ASKS';
  return 'BALANCED';
}

function explain(
  state: PassiveStrengthState,
  bids: PassiveStrengthSide,
  asks: PassiveStrengthSide,
  spread: number,
  mismatch: boolean,
  hardMismatch: boolean,
): string[] {
  const reasons: string[] = [];
  if (hardMismatch) reasons.push('liquidity accounting does not reconcile, so strength is not trusted');
  else if (mismatch) reasons.push('liquidity accounting mismatch — confidence capped');
  if (state === 'BIDS_STRONGER' || state === 'BIDS_WEAKENING') {
    if ((bids.survivalScore ?? 0) >= 70) reasons.push('bid survival is high');
    if ((bids.replenishmentScore ?? 0) >= 70) reasons.push('bid replenishment is strong');
    if ((bids.cancellationScore ?? 100) <= 25) reasons.push('bid cancellation is low');
    if (asks.defense === 'WITHDRAWING' || asks.defense === 'BREAKING') reasons.push('asks are withdrawing or breaking');
    if ((asks.survivalScore ?? 100) < 45) reasons.push('ask survival is weak');
  }
  if (state === 'ASKS_STRONGER' || state === 'ASKS_WEAKENING') {
    if ((asks.survivalScore ?? 0) >= 70) reasons.push('ask survival is high');
    if ((asks.replenishmentScore ?? 0) >= 70) reasons.push('ask replenishment is strong');
    if ((asks.cancellationScore ?? 100) <= 25) reasons.push('ask cancellation is low');
    if (bids.defense === 'WITHDRAWING' || bids.defense === 'BREAKING') reasons.push('bids are withdrawing or breaking');
    if ((bids.survivalScore ?? 100) < 45) reasons.push('bid survival is weak');
  }
  if (state === 'BIDS_WEAKENING') reasons.push('bid strength is falling');
  if (state === 'ASKS_WEAKENING') reasons.push('ask strength is falling');
  if (asks.trend === 'RISING' && state === 'BIDS_WEAKENING') reasons.push('asks are strengthening');
  if (bids.trend === 'RISING' && state === 'ASKS_WEAKENING') reasons.push('bids are strengthening');
  if (state === 'BALANCED') reasons.push(`bid and ask strength are within the margin (${spread >= 0 ? '+' : ''}${spread.toFixed(0)})`);
  if (state === 'BOTH_STRONG') reasons.push('both sides are defending');
  if (state === 'BOTH_WEAK') reasons.push('neither side is holding');
  if (state === 'HIGH_CHURN') reasons.push('liquidity is being added and cancelled without a stable side');
  if (bids.defense === 'HOLDING') reasons.push('bid consumption is being refilled');
  if (asks.defense === 'HOLDING') reasons.push('ask consumption is being refilled');
  if (bids.reliability === 'SPOOF_LIKE') reasons.push('displayed bid size is unreliable — it cancels without surviving');
  if (asks.reliability === 'SPOOF_LIKE') reasons.push('displayed ask size is unreliable — it cancels without surviving');
  return reasons.slice(0, 6);
}

function hasAnyComponent(side: PassiveSideComponents): boolean {
  return [
    side.depthScore,
    side.nearTouchScore,
    side.consumptionScore,
    side.replenishmentScore,
    side.cancellationScore,
    side.withdrawalScore,
    side.survivalScore,
    side.persistenceScore,
    side.reliabilityScore,
  ].some((value) => value != null && Number.isFinite(value));
}
