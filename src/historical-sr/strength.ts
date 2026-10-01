/**
 * Historical S/R strength — structural importance, not a trade signal.
 * All inputs must be known at `asOf` (no future reactions).
 */

import type {
  HistoricalLevel,
  HistoricalLevelState,
  HistoricalReactionSample,
  HistoricalReactionTrend,
  HistoricalSRStrengthComponents,
  HistoricalSRStrengthState,
  StrengthHistoryPoint,
} from './types.js';

export type {
  HistoricalReactionSample,
  HistoricalReactionTrend,
  HistoricalSRStrengthComponents,
  HistoricalSRStrengthState,
  StrengthHistoryPoint,
} from './types.js';

export interface HistoricalSRStrengthWeights {
  structureSignificance: number;
  reactionQuality: number;
  holdQuality: number;
  recency: number;
  timeframeImportance: number;
  roleFlip: number;
  confluence: number;
}

export interface HistoricalSRStrengthThresholds {
  weakMax: number;
  moderateMax: number;
  strongMax: number;
  /** Below this confidence, prefer not to advertise VERY_STRONG. */
  veryStrongMinConfidence: number;
}

export interface HistoricalSRStrengthConfig {
  weights: HistoricalSRStrengthWeights;
  thresholds: HistoricalSRStrengthThresholds;
  /** Bars of idle before recency decays hard. */
  recencyHalfLifeBars: number;
  /** Seconds per bar proxy when bar count unknown (unix seconds charts). */
  secondsPerBarHint: number;
  weakeningSlopeThreshold: number;
}

export const DEFAULT_SR_STRENGTH_CONFIG: HistoricalSRStrengthConfig = {
  weights: {
    structureSignificance: 0.2,
    reactionQuality: 0.25,
    holdQuality: 0.2,
    recency: 0.1,
    timeframeImportance: 0.1,
    roleFlip: 0.05,
    confluence: 0.1,
  },
  thresholds: {
    weakMax: 30,
    moderateMax: 55,
    strongMax: 75,
    veryStrongMinConfidence: 45,
  },
  recencyHalfLifeBars: 40,
  secondsPerBarHint: 60,
  weakeningSlopeThreshold: -0.12,
};

export interface HistoricalSRStrengthScore {
  strengthScore: number;
  strengthState: HistoricalSRStrengthState;
  strengthConfidence: number;
  reactionTrend: HistoricalReactionTrend;
  components: HistoricalSRStrengthComponents;
  testCount: number;
  successfulHoldCount: number;
  failedTestCount: number;
  holdRatio: number;
  averageReactionFraction: number;
  largestReactionFraction: number;
}

const TF_SCORE: Record<string, number> = {
  '1m': 35,
  '3m': 40,
  '5m': 48,
  '15m': 58,
  '30m': 65,
  '1h': 78,
  '2h': 82,
  '4h': 90,
  '1D': 96,
  '1d': 96,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function secondsPerBarForTimeframe(tf: string): number {
  const m = /^(\d+)m$/i.exec(tf);
  if (m) return Number(m[1]) * 60;
  const h = /^(\d+)h$/i.exec(tf);
  if (h) return Number(h[1]) * 3600;
  if (/^1d$/i.test(tf)) return 86_400;
  return 60;
}

export function timeframeImportanceScore(tf: string): number {
  if (TF_SCORE[tf] != null) return TF_SCORE[tf]!;
  const m = /^(\d+)m$/i.exec(tf);
  if (m) {
    const mins = Number(m[1]);
    return clamp(30 + Math.log10(1 + mins) * 28, 30, 95);
  }
  return 55;
}

/** Normalize a single reaction into 0–100 quality. */
export function reactionSampleScore(sample: HistoricalReactionSample): number {
  if (sample.kind === 'BREAK') return 5;
  const atrPart = clamp(sample.reactionAtr / 2.5, 0, 1) * 55;
  const pctPart = clamp(sample.reactionFraction / 0.025, 0, 1) * 35;
  const holdBonus = sample.held ? 10 : 0;
  const kindBoost =
    sample.kind === 'REJECTION' ? 8 : sample.kind === 'HOLD' ? 5 : sample.kind === 'FALSE_BREAK' ? 3 : 0;
  return clamp(atrPart + pctPart + holdBonus + kindBoost, 0, 100);
}

export function reactionTrendOf(
  samples: HistoricalReactionSample[],
  asOf: number,
  config: HistoricalSRStrengthConfig = DEFAULT_SR_STRENGTH_CONFIG,
): HistoricalReactionTrend {
  const known = samples.filter((s) => s.timestamp <= asOf && s.kind !== 'BREAK');
  if (known.length < 3) return 'STABLE';
  const recent = known.slice(-4);
  const scores = recent.map(reactionSampleScore);
  const slope = (scores[scores.length - 1]! - scores[0]!) / Math.max(1, scores.length - 1);
  if (slope <= config.weakeningSlopeThreshold * 100) return 'WEAKENING';
  if (slope >= Math.abs(config.weakeningSlopeThreshold) * 100) return 'STRENGTHENING';
  let decaying = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]!.reactionAtr < recent[i - 1]!.reactionAtr * 0.85) decaying += 1;
  }
  if (decaying >= recent.length - 1) return 'WEAKENING';
  return 'STABLE';
}

export function computeHistoricalSRStrength(input: {
  level: Pick<
    HistoricalLevel,
    | 'sourceTimeframe'
    | 'knownAt'
    | 'lastInteractionAt'
    | 'state'
    | 'touchCount'
    | 'rejectionCount'
    | 'breakCount'
    | 'components'
  > & {
    reactionHistory?: HistoricalReactionSample[];
    roleFlipCount?: number;
    roleFlipQuality?: number;
    confluenceScore?: number;
  };
  asOf: number;
  atr: number;
  /** Approximate bars since last interaction when timestamps are unix seconds. */
  barsHint?: number;
  config?: Partial<HistoricalSRStrengthConfig>;
}): HistoricalSRStrengthScore {
  const config: HistoricalSRStrengthConfig = {
    ...DEFAULT_SR_STRENGTH_CONFIG,
    ...input.config,
    weights: { ...DEFAULT_SR_STRENGTH_CONFIG.weights, ...(input.config?.weights ?? {}) },
    thresholds: { ...DEFAULT_SR_STRENGTH_CONFIG.thresholds, ...(input.config?.thresholds ?? {}) },
  };
  const w = config.weights;
  const level = input.level;
  const history = (level.reactionHistory ?? []).filter((s) => s.timestamp <= input.asOf);
  const holds = history.filter((s) => s.held && s.kind !== 'BREAK');
  const fails = history.filter((s) => s.kind === 'BREAK' || (!s.held && s.kind !== 'WEAK_BOUNCE'));
  const testCount = Math.max(level.touchCount, history.length);
  const successfulHoldCount = Math.max(level.rejectionCount, holds.length);
  const failedTestCount = Math.max(level.breakCount, fails.length);
  const holdRatio = testCount > 0 ? successfulHoldCount / testCount : 0;

  const structureSignificance = clamp(level.components.swingSignificance, 0, 100);

  const reactionScores = history.filter((s) => s.kind !== 'BREAK').map(reactionSampleScore);
  const reactionQuality =
    reactionScores.length > 0
      ? clamp(reactionScores.reduce((a, b) => a + b, 0) / reactionScores.length, 0, 100)
      : clamp(level.components.rejectionMagnitude, 0, 55);

  // Hold quality uses ratio + held-reaction quality — not raw touch count alone.
  const holdQuality = clamp(
    holdRatio * 55 +
      (holds.length ? (holds.reduce((a, s) => a + reactionSampleScore(s), 0) / holds.length) * 0.35 : 0) +
      clamp(successfulHoldCount * 6, 0, 15),
    0,
    100,
  );

  const secondsPerBar = config.secondsPerBarHint;
  const last = level.lastInteractionAt ?? level.knownAt;
  const idleBars =
    input.barsHint ?? Math.max(0, (input.asOf - last) / Math.max(1, secondsPerBar));
  const recencyScore = clamp(100 * Math.exp(-idleBars / Math.max(1, config.recencyHalfLifeBars)), 15, 100);

  const timeframeScore = timeframeImportanceScore(level.sourceTimeframe);
  const roleFlipScore = clamp(
    (level.roleFlipCount ?? 0) > 0
      ? 40 + (level.roleFlipQuality ?? 50) * 0.5 + Math.min(20, (level.roleFlipCount ?? 0) * 10)
      : 20,
    0,
    100,
  );
  const confluenceScore = clamp(level.confluenceScore ?? 0, 0, 100);

  const trend = reactionTrendOf(history, input.asOf, config);
  let weakeningPenalty = 0;
  if (trend === 'WEAKENING') {
    weakeningPenalty = clamp(12 + Math.max(0, testCount - 2) * 5, 12, 35);
  } else if (testCount >= 4 && holdRatio < 0.5) {
    weakeningPenalty = 10;
  }

  const raw =
    structureSignificance * w.structureSignificance +
    reactionQuality * w.reactionQuality +
    holdQuality * w.holdQuality +
    recencyScore * w.recency +
    timeframeScore * w.timeframeImportance +
    roleFlipScore * w.roleFlip +
    confluenceScore * w.confluence;

  const scoreBeforePenalty = clamp(raw, 0, 100);
  let strengthScore = clamp(raw - weakeningPenalty, 0, 100);

  // New / lightly tested levels: structure can look strong but confidence stays low.
  if (history.length <= 1 && successfulHoldCount <= 1) {
    strengthScore = Math.min(strengthScore, 72);
  }

  const strengthConfidence = clamp(
    25 +
      Math.min(40, history.length * 12) +
      Math.min(20, successfulHoldCount * 8) +
      (level.components.swingSignificance >= 70 ? 10 : 0) +
      (confluenceScore >= 50 ? 5 : 0),
    15,
    98,
  );

  const strengthState = strengthStateOf(
    strengthScore,
    trend,
    level.state,
    strengthConfidence,
    config.thresholds,
    scoreBeforePenalty,
  );

  const reactionFractions = history.filter((s) => s.held).map((s) => s.reactionFraction);
  const averageReactionFraction =
    reactionFractions.length > 0
      ? reactionFractions.reduce((a, b) => a + b, 0) / reactionFractions.length
      : 0;
  const largestReactionFraction = reactionFractions.length ? Math.max(...reactionFractions) : 0;

  void input.atr;

  return {
    strengthScore: Math.round(strengthScore * 10) / 10,
    strengthState,
    strengthConfidence: Math.round(strengthConfidence * 10) / 10,
    reactionTrend: trend,
    components: {
      structureSignificance: Math.round(structureSignificance),
      reactionQuality: Math.round(reactionQuality),
      holdQuality: Math.round(holdQuality),
      recencyScore: Math.round(recencyScore),
      timeframeScore: Math.round(timeframeScore),
      roleFlipScore: Math.round(roleFlipScore),
      confluenceScore: Math.round(confluenceScore),
      weakeningPenalty: Math.round(weakeningPenalty),
    },
    testCount,
    successfulHoldCount,
    failedTestCount,
    holdRatio: Math.round(holdRatio * 1000) / 1000,
    averageReactionFraction,
    largestReactionFraction,
  };
}

export function strengthStateOf(
  score: number,
  trend: HistoricalReactionTrend,
  levelState: HistoricalLevelState,
  confidence: number,
  thresholds: HistoricalSRStrengthThresholds = DEFAULT_SR_STRENGTH_CONFIG.thresholds,
  scoreBeforePenalty?: number,
): HistoricalSRStrengthState {
  if (levelState === 'BROKEN' || levelState === 'EXPIRED') return 'BROKEN';
  const prior = scoreBeforePenalty ?? score;
  // Historically meaningful levels that are decaying — even if penalty pulls score below STRONG.
  if (trend === 'WEAKENING' && prior >= thresholds.moderateMax) return 'STRONG_BUT_WEAKENING';
  if (score < thresholds.weakMax) return 'WEAK';
  if (score < thresholds.moderateMax) return 'MODERATE';
  if (score >= thresholds.strongMax && confidence >= thresholds.veryStrongMinConfidence) {
    return 'VERY_STRONG';
  }
  if (score >= thresholds.strongMax) return 'STRONG';
  return 'STRONG';
}

export function appendStrengthHistory(
  history: StrengthHistoryPoint[] | undefined,
  point: StrengthHistoryPoint,
  minDelta = 1.5,
): StrengthHistoryPoint[] {
  const prev = history ?? [];
  const last = prev[prev.length - 1];
  if (last && last.timestamp === point.timestamp) {
    return [...prev.slice(0, -1), point];
  }
  if (last && Math.abs(last.strength - point.strength) < minDelta && last.state === point.state) {
    return prev;
  }
  return [...prev, point].slice(-64);
}

/** Build a reaction sample from a hold/rejection bar (causal — same candle only). */
export function reactionFromBar(input: {
  timestamp: number;
  levelPrice: number;
  type: 'SUPPORT' | 'RESISTANCE';
  open: number;
  high: number;
  low: number;
  close: number;
  atr: number;
  held: boolean;
  kind: HistoricalReactionSample['kind'];
}): HistoricalReactionSample {
  const { levelPrice, atr, close, high, low, type } = input;
  const excursion =
    type === 'SUPPORT'
      ? Math.max(0, close - levelPrice, high - levelPrice)
      : Math.max(0, levelPrice - close, levelPrice - low);
  const reactionFraction = levelPrice > 0 ? excursion / levelPrice : 0;
  const reactionAtr = atr > 0 ? excursion / atr : 0;
  return {
    timestamp: input.timestamp,
    reactionFraction,
    reactionAtr,
    held: input.held,
    kind: input.kind,
  };
}

/** Compact trader label for chart. */
export function strengthStateLabel(state: HistoricalSRStrengthState): string {
  switch (state) {
    case 'VERY_STRONG':
      return 'VERY STRONG';
    case 'STRONG_BUT_WEAKENING':
      return 'STRONG ↓';
    case 'STRONG':
      return 'STRONG';
    case 'MODERATE':
      return 'MODERATE';
    case 'WEAK':
      return 'WEAK';
    case 'BROKEN':
      return 'BROKEN';
    default:
      return '—';
  }
}

/**
 * Overlap confluence across timeframes — does not average identical source copies.
 */
export function multiTimeframeConfluenceScore(
  primary: { price: number; sourceTimeframe: string },
  others: Array<{ price: number; sourceTimeframe: string }>,
  tolerance: number,
): { multiTimeframeConfluence: boolean; confluenceScore: number; confluenceTimeframes: string[] } {
  const tfs = new Set<string>([primary.sourceTimeframe]);
  let hits = 0;
  for (const o of others) {
    if (o.sourceTimeframe === primary.sourceTimeframe) continue;
    if (Math.abs(o.price - primary.price) <= tolerance) {
      hits += 1;
      tfs.add(o.sourceTimeframe);
    }
  }
  if (hits === 0) {
    return { multiTimeframeConfluence: false, confluenceScore: 0, confluenceTimeframes: [primary.sourceTimeframe] };
  }
  return {
    multiTimeframeConfluence: true,
    confluenceScore: clamp(50 + hits * 18, 50, 95),
    confluenceTimeframes: [...tfs],
  };
}
