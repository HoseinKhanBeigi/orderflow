import type {
  CandleLabel,
  LabeledCandle,
  PatternCandidate,
  PatternDefinition,
  PatternFailWhen,
  PatternStageDef,
  PatternStatus,
} from './pattern-types.js';
import { requiredStageCount } from './pattern-definitions.js';
import { withScoredCandidate } from './pattern-confidence.js';

interface StageHit {
  stageIndex: number;
  candles: LabeledCandle[];
}

interface RawMatch {
  hits: StageHit[];
  partial: boolean;
}

export interface WindowMatch {
  candidate: PatternCandidate;
  candles: LabeledCandle[];
  requiredMatched: number;
}

/**
 * Try to match `def` against a window that MUST end on the last candle.
 * Optional / repeat stages are consumed greedily; unmatched labels abort the window.
 * Stages may match control / liquidity / specialEvent dimensions independently.
 */
export function matchPatternWindow(
  def: PatternDefinition,
  window: LabeledCandle[],
  statusOverride?: PatternStatus,
): WindowMatch | null {
  if (!window.length) return null;
  const raw = matchStages(def, window);
  if (!raw) return null;

  const candles = raw.hits.flatMap((h) => h.candles);
  if (!candles.length) return null;
  if (candles[candles.length - 1]!.timestamp !== window[window.length - 1]!.timestamp) {
    return null;
  }

  const requiredMatched = countRequiredHits(def, raw.hits);
  const totalRequired = requiredStageCount(def);
  const minForming = def.minFormingStages ?? 2;
  const barsUsed = window.length;

  if (raw.partial) {
    if (requiredMatched < minForming) return null;
    if (barsUsed > def.maxBars) return null;
    return toMatch(def, window, raw, 'FORMING', statusOverride);
  }

  if (barsUsed < def.minBars || barsUsed > def.maxBars) return null;
  if (requiredMatched < totalRequired) return null;

  const completeStatus: PatternStatus =
    def.completesOnMatch === false ? 'FORMING' : 'CONFIRMED';
  return toMatch(def, window, raw, completeStatus, statusOverride);
}

export function bestMatchForDefinition(
  def: PatternDefinition,
  buffer: LabeledCandle[],
  statusOverride?: PatternStatus,
): WindowMatch | null {
  if (!buffer.length) return null;
  const maxLen = Math.min(def.maxBars, buffer.length);
  let best: WindowMatch | null = null;
  for (let len = maxLen; len >= 1; len--) {
    const window = buffer.slice(buffer.length - len);
    const match = matchPatternWindow(def, window, statusOverride);
    if (!match) continue;
    if (!best || rankMatch(match) > rankMatch(best)) best = match;
  }
  return best;
}

export function matchLooksFailed(
  def: PatternDefinition,
  previous: PatternCandidate | undefined,
  last: LabeledCandle,
  nextMatch: WindowMatch | null,
): boolean {
  if (!previous) return false;
  if (previous.status !== 'FORMING' && previous.status !== 'PREVIEW') return false;
  if (!def.failWhen) return false;
  if (previous.stage < def.failWhen.minStage) return false;
  if (!failWhenMatches(def.failWhen, last)) return false;
  if (!nextMatch) return true;
  if (nextMatch.candidate.stage < previous.stage) return true;
  if (nextMatch.candidate.startTimestamp > previous.startTimestamp && nextMatch.candidate.stage < previous.stage) {
    return true;
  }
  return false;
}

export function matchExpired(
  def: PatternDefinition,
  previous: PatternCandidate | undefined,
  lastTimestamp: number,
  barSeconds: number,
  nextMatch: WindowMatch | null,
): boolean {
  if (!previous) return false;
  if (previous.status !== 'FORMING' && previous.status !== 'PREVIEW') return false;
  if (nextMatch && nextMatch.candidate.startTimestamp === previous.startTimestamp) return false;
  const elapsedBars = Math.floor((lastTimestamp - previous.startTimestamp) / Math.max(1, barSeconds));
  return elapsedBars + 1 > def.maxBars;
}

function matchStages(def: PatternDefinition, candles: LabeledCandle[]): RawMatch | null {
  let i = 0;
  const hits: StageHit[] = [];

  for (let s = 0; s < def.stages.length; s++) {
    const stage = def.stages[s]!;
    const minR = stage.minRepeats ?? (stage.optional ? 0 : 1);
    const maxR = stage.maxRepeats ?? (stage.repeat ? Number.POSITIVE_INFINITY : 1);

    i = skipUnclassified(candles, i);

    let before: LabeledCandle | undefined;
    if (stage.optionalBefore?.length && i < candles.length) {
      const c = candles[i]!;
      if (stage.optionalBefore.includes(c.label) && !candleMatchesStage(c, stage)) {
        before = c;
        i += 1;
        i = skipUnclassified(candles, i);
      }
    }

    const captured: LabeledCandle[] = [];
    while (i < candles.length && captured.length < maxR && candleMatchesStage(candles[i]!, stage)) {
      captured.push(candles[i]!);
      i += 1;
      if (!stage.repeat) break;
      i = skipUnclassified(candles, i);
    }

    if (captured.length < minR) {
      if (stage.optional || minR === 0) {
        if (before) i -= 1;
        continue;
      }
      if (i >= candles.length && hits.length > 0) {
        return { hits, partial: true };
      }
      return null;
    }

    hits.push({ stageIndex: s, candles: before ? [before, ...captured] : captured });
  }

  i = skipUnclassified(candles, i);
  if (i !== candles.length) return null;
  return { hits, partial: false };
}

function skipUnclassified(candles: LabeledCandle[], i: number): number {
  while (i < candles.length && candles[i]!.label === 'UNCLASSIFIED') i += 1;
  return i;
}

/**
 * Dimensional AND: every specified dimension on the stage must match.
 * Flat `labels` remain as a legacy fallback when classification dims are missing.
 */
export function candleMatchesStage(candle: LabeledCandle, stage: PatternStageDef): boolean {
  const cls = candle.classification;
  const hasDim = !!(stage.control?.length || stage.liquidity?.length || stage.specialEvent?.length);
  const hasLabels = !!(stage.labels?.length);

  if (!hasDim && !hasLabels) return false;

  if (stage.control?.length) {
    const control = cls?.primaryState.control;
    if (control && stage.control.includes(control)) {
      // ok
    } else if (hasLabels && stage.labels!.includes(candle.label) && stage.control.includes(candle.label as never)) {
      // flat fallback
    } else {
      return false;
    }
  }

  if (stage.liquidity?.length) {
    const event = cls?.liquidityBehavior.dominantEvent;
    const byDim = event != null && stage.liquidity.includes(event);
    const byLabel =
      hasLabels && stage.labels!.some((l) => candle.label === l && stage.liquidity!.includes(l as never));
    if (!byDim && !byLabel) return false;
  }

  if (stage.specialEvent?.length) {
    const type = cls?.specialEvent.type;
    const byDim = type != null && stage.specialEvent.includes(type);
    const byLabel =
      hasLabels && stage.labels!.some((l) => candle.label === l && stage.specialEvent!.includes(l as never));
    if (!byDim && !byLabel) return false;
  }

  if (!hasDim && hasLabels) {
    return stage.labels!.includes(candle.label);
  }

  return true;
}

function failWhenMatches(fail: PatternFailWhen, candle: LabeledCandle): boolean {
  const cls = candle.classification;
  if (fail.labels?.length && fail.labels.includes(candle.label)) return true;
  if (fail.control?.length && cls && fail.control.includes(cls.primaryState.control)) return true;
  if (fail.specialEvent?.length && cls?.specialEvent.type && fail.specialEvent.includes(cls.specialEvent.type)) {
    return true;
  }
  return false;
}

function countRequiredHits(def: PatternDefinition, hits: StageHit[]): number {
  let n = 0;
  for (const hit of hits) {
    const stage = def.stages[hit.stageIndex];
    if (stage && !stage.optional) n += 1;
  }
  return n;
}

function toMatch(
  def: PatternDefinition,
  window: LabeledCandle[],
  raw: RawMatch,
  status: PatternStatus,
  statusOverride?: PatternStatus,
): WindowMatch {
  const requiredMatched = countRequiredHits(def, raw.hits);
  const totalRequired = requiredStageCount(def);
  const progress = totalRequired === 0 ? 1 : Math.min(1, requiredMatched / totalRequired);
  const first = window[0]!;
  const last = window[window.length - 1]!;
  const finalStatus = statusOverride ?? status;
  const confirmed = finalStatus === 'CONFIRMED' ? last.timestamp : null;

  const candidate = withScoredCandidate(
    def,
    {
      status: finalStatus,
      startTimestamp: first.timestamp,
      confirmedTimestamp: confirmed,
      failedTimestamp: null,
      barsUsed: window.length,
      stage: requiredMatched,
      totalStages: totalRequired,
      progress,
      matchedLabels: window.map((c) => c.label),
      candleTimestamps: window.map((c) => c.timestamp),
    },
    window,
    requiredMatched,
  );

  return { candidate, candles: window, requiredMatched };
}

function rankMatch(match: WindowMatch): number {
  const statusRank =
    match.candidate.status === 'CONFIRMED' ? 400 :
    match.candidate.status === 'FORMING' || match.candidate.status === 'PREVIEW' ? 200 :
    0;
  return statusRank + match.candidate.progress * 50 + match.candidate.confidence * 0.1 + match.candles.length;
}

export function pickPrimary(candidates: PatternCandidate[]): PatternCandidate | null {
  const live = candidates.filter(
    (c) => c.status === 'FORMING' || c.status === 'CONFIRMED' || c.status === 'PREVIEW',
  );
  if (!live.length) return null;

  const superseded = new Set<string>();
  for (const c of live) {
    for (const id of supersedesOf(c.id)) {
      const other = live.find((x) => x.id === id);
      if (!other) continue;
      const evolved = c.status === 'CONFIRMED' || c.progress >= other.progress;
      if (evolved) superseded.add(id);
    }
  }
  const remaining = live.filter((c) => !superseded.has(c.id));
  const pool = remaining.length ? remaining : live;

  return [...pool].sort(compareCandidates)[0] ?? null;
}

function supersedesOf(id: PatternCandidate['id']): string[] {
  if (id === 'BULLISH_LIQUIDITY_REVERSAL') return ['SELLER_TRAP_FORMING'];
  if (id === 'BEARISH_LIQUIDITY_REVERSAL') return ['BUYER_TRAP_FORMING'];
  return [];
}

export function compareCandidates(a: PatternCandidate, b: PatternCandidate): number {
  const statusRank = (s: PatternStatus): number => {
    if (s === 'CONFIRMED') return 4;
    if (s === 'FORMING') return 3;
    if (s === 'PREVIEW') return 2;
    return 0;
  };
  const ds = statusRank(b.status) - statusRank(a.status);
  if (ds) return ds;
  if (b.progress !== a.progress) return b.progress - a.progress;
  const specA = specificityOf(a.id);
  const specB = specificityOf(b.id);
  if (specB !== specA) return specB - specA;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.id.localeCompare(b.id);
}

function specificityOf(id: PatternCandidate['id']): number {
  switch (id) {
    case 'BULLISH_LIQUIDITY_REVERSAL':
    case 'BEARISH_LIQUIDITY_REVERSAL':
      return 80;
    case 'FAILED_BEARISH_REVERSAL':
    case 'FAILED_BULLISH_REVERSAL':
      return 70;
    case 'BULLISH_CONTINUATION':
    case 'BEARISH_CONTINUATION':
      return 50;
    case 'BUYER_TRAP_FORMING':
    case 'SELLER_TRAP_FORMING':
      return 40;
    default:
      return 0;
  }
}

/** @deprecated Prefer candleMatchesStage. */
export function labelsMatch(allowed: CandleLabel[], label: CandleLabel): boolean {
  return allowed.includes(label);
}
