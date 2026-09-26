import { clamp } from '../core/integrity.js';
import type {
  CandleLabel,
  ConfidenceComponents,
  LabeledCandle,
  PatternCandidate,
  PatternDefinition,
  PatternEvidence,
} from './pattern-types.js';
import { patternVersionTag, requiredStageCount } from './pattern-definitions.js';

/**
 * Pattern confidence measures match *quality*, not completeness.
 *
 * The old V1.0 UI "36" was a mixed engine score:
 *   100 * stageCompletion * mean(labelConfidence) * supporting * conflict
 * so a 2/3-complete continuation with decent labels printed ~36 even when
 * the labels themselves were fine. That number is NOT P(next candle).
 *
 * V1.1 keeps stageCompletion in `evidence.components` for diagnostics but
 * scores confidence from label quality, supporting order-flow, and conflicts:
 *   100 * mean(labelConfidence) * supporting * conflict
 */
export function scorePatternConfidence(
  def: PatternDefinition,
  candles: LabeledCandle[],
  requiredMatched: number,
  statusIsComplete: boolean,
): { confidence: number; evidence: PatternEvidence } {
  const totalRequired = Math.max(1, requiredStageCount(def));
  const stageCompletion = statusIsComplete ? 1 : clamp(requiredMatched / totalRequired, 0, 1);
  const labelConfidence = meanLabelConfidence(candles);
  const { supporting, conflict, sweepQuality, controlShift } = supportingEvidence(def, candles);

  const components: ConfidenceComponents = {
    stageCompletion,
    labelConfidence,
    supportingEvidence: supporting,
    conflictPenalty: conflict,
  };

  const raw = 100 * labelConfidence * supporting * conflict;
  const confidence = Math.round(clamp(raw, 0, 100));

  return {
    confidence,
    evidence: {
      labelConfidence,
      sweepQuality,
      controlShift,
      supportingEvidence: supporting,
      conflictPenalty: conflict,
      components,
    },
  };
}

function meanLabelConfidence(candles: LabeledCandle[]): number {
  if (!candles.length) return 0.7;
  const values = candles.map((c) => {
    if (c.labelConfidence == null || !Number.isFinite(c.labelConfidence)) return 0.7;
    return clamp(c.labelConfidence, 0, 1);
  });
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function supportingEvidence(
  def: PatternDefinition,
  candles: LabeledCandle[],
): {
  supporting: number;
  conflict: number;
  sweepQuality: number | null;
  controlShift: number | null;
} {
  const byLabel = groupByLabel(candles);
  const scores: number[] = [];
  const conflicts: number[] = [];

  const huntLow = lastOf(byLabel, 'STOP_HUNT_LOW');
  const huntHigh = lastOf(byLabel, 'STOP_HUNT_HIGH');
  const sellerAbs = lastOf(byLabel, 'SELLER_ABSORBED');
  const buyerAbs = lastOf(byLabel, 'BUYER_ABSORBED');
  const buyerCtrl = lastOf(byLabel, 'BUYER_IN_CONTROL');
  const sellerCtrl = lastOf(byLabel, 'SELLER_IN_CONTROL');

  if (def.direction === 'BULLISH') {
    pushPos(scores, huntLow?.sweepQuality);
    pushPos(scores, sellerAbs?.passiveBuyerDefense);
    pushPos(scores, sellerAbs?.bidReplenishment);
    pushPos(scores, buyerCtrl?.aggressiveBuyPower);
    pushPos(scores, buyerCtrl?.upsideBattleSpread);
    pushNeg(conflicts, sellerAbs?.aggressiveSellPower);
    pushNeg(conflicts, buyerCtrl?.aggressiveSellPower);
    pushNeg(conflicts, huntLow && invert(huntLow.sweepQuality));
  }

  if (def.direction === 'BEARISH') {
    pushPos(scores, huntHigh?.sweepQuality);
    pushPos(scores, buyerAbs?.passiveSellerDefense);
    pushPos(scores, buyerAbs?.askReplenishment);
    pushPos(scores, sellerCtrl?.aggressiveSellPower);
    pushPos(scores, sellerCtrl?.downsideBattleSpread);
    pushNeg(conflicts, buyerAbs?.aggressiveBuyPower);
    pushNeg(conflicts, sellerCtrl?.aggressiveBuyPower);
  }

  const last = candles[candles.length - 1];
  if (def.direction === 'BULLISH') {
    pushPos(scores, last?.upsideFuel);
    if ((last?.upsideFuelVelocity ?? 0) > 0) pushPos(scores, last?.upsideFuel);
  }
  if (def.direction === 'BEARISH') {
    pushPos(scores, last?.downsideFuel);
    if ((last?.downsideFuelVelocity ?? 0) > 0) pushPos(scores, last?.downsideFuel);
  }

  const supporting = scores.length ? clamp(0.85 + 0.3 * mean(scores), 0.75, 1.15) : 1;
  const conflict = conflicts.length ? clamp(1 - 0.35 * mean(conflicts), 0.55, 1) : 1;
  const sweepQuality = huntLow?.sweepQuality ?? huntHigh?.sweepQuality ?? null;
  const controlShift = controlShiftScore(candles);

  return { supporting, conflict, sweepQuality, controlShift };
}

function controlShiftScore(candles: LabeledCandle[]): number | null {
  if (candles.length < 2) return null;
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  const buyShift = (last.aggressiveBuyPower ?? 50) - (first.aggressiveBuyPower ?? 50);
  const sellShift = (last.aggressiveSellPower ?? 50) - (first.aggressiveSellPower ?? 50);
  if (
    first.aggressiveBuyPower == null &&
    last.aggressiveBuyPower == null &&
    first.aggressiveSellPower == null &&
    last.aggressiveSellPower == null
  ) {
    return null;
  }
  return clamp(50 + (buyShift - sellShift) / 2, 0, 100);
}

function groupByLabel(candles: LabeledCandle[]): Map<CandleLabel, LabeledCandle[]> {
  const map = new Map<CandleLabel, LabeledCandle[]>();
  for (const c of candles) {
    const list = map.get(c.label) ?? [];
    list.push(c);
    map.set(c.label, list);
  }
  return map;
}

function lastOf(map: Map<CandleLabel, LabeledCandle[]>, label: CandleLabel): LabeledCandle | undefined {
  const list = map.get(label);
  return list?.[list.length - 1];
}

function pushPos(into: number[], raw: number | null | undefined): void {
  const n = toUnit(raw);
  if (n != null) into.push(n);
}

function pushNeg(into: number[], raw: number | null | undefined): void {
  const n = toUnit(raw);
  if (n != null) into.push(n);
}

function invert(raw: number | null | undefined): number | null {
  const n = toUnit(raw);
  return n == null ? null : 1 - n;
}

/** Treat 0–1 and 0–100 scores as a 0–1 unit interval. Null if missing. */
function toUnit(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw < 0) return 0;
  if (raw <= 1) return raw;
  return clamp(raw / 100, 0, 1);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function withScoredCandidate(
  def: PatternDefinition,
  partial: Omit<PatternCandidate, 'confidence' | 'evidence' | 'patternVersion' | 'version' | 'id' | 'direction' | 'title' | 'badge'>,
  candles: LabeledCandle[],
  requiredMatched: number,
): PatternCandidate {
  const complete = partial.status === 'CONFIRMED' || (partial.status === 'FORMING' && def.completesOnMatch === false && partial.progress >= 1);
  const { confidence, evidence } = scorePatternConfidence(def, candles, requiredMatched, complete || partial.progress >= 1);
  return {
    id: def.id,
    version: def.version,
    patternVersion: patternVersionTag(def.id, def.version),
    direction: def.direction,
    title: def.title,
    badge: def.badge,
    ...partial,
    confidence,
    evidence,
  };
}
