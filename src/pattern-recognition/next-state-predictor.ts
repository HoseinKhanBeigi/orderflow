import { clamp } from '../core/integrity.js';
import type { SpecialEventType } from './candle-classification-types.js';
import {
  CONTROL_STATES,
  DOMINANT_LIQUIDITY_EVENTS,
  DimensionTransitionTable,
  SPECIAL_EVENT_PREDICT_VALUES,
  controlToken,
  liquidityToken,
  specialEventToken,
  type SpecialEventPredictValue,
} from './dimension-transition-table.js';
import type { LabeledCandle } from './pattern-types.js';
import type {
  CandleLabel,
  ControlState,
  DimensionPrediction,
  DominantLiquidityEvent,
  NextStatePrediction,
  PatternId,
  PredictorOptions,
  PredictionConfidenceBand,
} from './pattern-types.js';
import { CANDLE_LABELS } from './pattern-types.js';
import { PredictionEvaluation } from './prediction-eval.js';
import { MAX_SEQUENCE_DEPTH, TransitionTable, normalizeLabel } from './transition-table.js';

export const DEFAULT_PREDICTOR_OPTIONS = {
  minimumTopProbability: 0.6,
  minimumPredictionMargin: 0.15,
  minimumSampleCount: 100,
  maxDepth: MAX_SEQUENCE_DEPTH,
} as const;

const DISPLAY_TOP = 4;

export class NextFootprintStatePredictor {
  readonly table = new TransitionTable();
  readonly dimensions = new DimensionTransitionTable();
  readonly evaluation = new PredictionEvaluation();
  private readonly pending = new Map<string, NextStatePrediction>();
  readonly options: Required<PredictorOptions>;

  constructor(options: PredictorOptions = {}) {
    this.options = {
      minimumTopProbability: options.minimumTopProbability ?? DEFAULT_PREDICTOR_OPTIONS.minimumTopProbability,
      minimumPredictionMargin: options.minimumPredictionMargin ?? DEFAULT_PREDICTOR_OPTIONS.minimumPredictionMargin,
      minimumSampleCount: options.minimumSampleCount ?? DEFAULT_PREDICTOR_OPTIONS.minimumSampleCount,
      maxDepth: options.maxDepth ?? DEFAULT_PREDICTOR_OPTIONS.maxDepth,
    };
  }

  /**
   * Record a completed transition T-1 → T. Call this only after candle T is final.
   * Evaluates the previous prediction against `nextLabel` (no lookahead).
   */
  observeCompleted(input: {
    symbol: string;
    timeframe: string;
    contextLabels: readonly string[];
    nextLabel: string;
    patternId?: PatternId | null;
    contextControls?: readonly string[];
    nextControl?: string;
    contextSpecialEvents?: readonly string[];
    nextSpecialEvent?: string;
    contextLiquidityEvents?: readonly string[];
    nextLiquidityEvent?: string;
  }): void {
    const key = streamKey(input.symbol, input.timeframe);
    const pending = this.pending.get(key);
    if (pending) {
      this.evaluation.record(pending, input.nextLabel, {
        timeframe: input.timeframe,
        patternId: input.patternId ?? pending.patternId,
      });
      this.pending.delete(key);
    }
    this.table.observe(
      input.symbol,
      input.timeframe,
      input.contextLabels,
      input.nextLabel,
      input.patternId,
      this.options.maxDepth,
    );
    this.observeDimensions(input);
  }

  /** Train from a finalized tape. Pair i-1 → i never inspects i+1. */
  trainFromCandles(candles: LabeledCandle[], patternAt?: Array<PatternId | null | undefined>): void {
    for (let i = 1; i < candles.length; i++) {
      const ctx = candles.slice(0, i);
      const first = ctx[0];
      const next = candles[i]!;
      if (!first) continue;
      this.table.observe(
        first.symbol,
        first.timeframe,
        ctx.map((c) => c.label),
        next.label,
        patternAt?.[i - 1] ?? null,
        this.options.maxDepth,
      );
      this.observeDimensions({
        symbol: first.symbol,
        timeframe: first.timeframe,
        patternId: patternAt?.[i - 1] ?? null,
        contextControls: ctx.map((c) => controlToken(c.classification?.primaryState.control ?? 'UNCLEAR')),
        nextControl: controlToken(next.classification?.primaryState.control ?? 'UNCLEAR'),
        contextSpecialEvents: ctx.map((c) => specialEventToken(c.classification?.specialEvent.type ?? null)),
        nextSpecialEvent: specialEventToken(next.classification?.specialEvent.type ?? null),
        contextLiquidityEvents: ctx.map((c) =>
          liquidityToken(c.classification?.liquidityBehavior.dominantEvent ?? 'NONE'),
        ),
        nextLiquidityEvent: liquidityToken(next.classification?.liquidityBehavior.dominantEvent ?? 'NONE'),
      });
    }
  }

  predict(input: {
    symbol: string;
    timeframe: string;
    contextLabels: readonly string[];
    patternId?: PatternId | null;
    remember?: boolean;
    contextControls?: readonly string[];
    contextSpecialEvents?: readonly string[];
    contextLiquidityEvents?: readonly string[];
  }): NextStatePrediction {
    const labels = input.contextLabels.map(normalizeLabel);
    const dims = this.dimensionPredictions(input, labels);
    const empty = emptyPrediction(input.patternId ?? null);
    if (!labels.length) return { ...empty, ...dims };

    const picked = this.pickCounts(input.symbol, input.timeframe, labels, input.patternId ?? null);
    if (!picked || picked.counts.total <= 0) return { ...empty, ...dims };

    const ranked = rankDistribution(picked.counts.byLabel, picked.counts.total);
    const top = ranked[0];
    const second = ranked[1];
    const topP = top?.p ?? 0;
    const secondP = second?.p ?? 0;
    const margin = topP - secondP;
    const enoughSamples = picked.counts.total >= this.options.minimumSampleCount;
    const clear =
      enoughSamples &&
      topP >= this.options.minimumTopProbability &&
      margin >= this.options.minimumPredictionMargin &&
      top != null;

    const confidenceScore = scorePredictionConfidence({
      topP,
      margin,
      sampleCount: picked.counts.total,
      depth: picked.depth,
      minSamples: this.options.minimumSampleCount,
    });
    const result: NextStatePrediction = {
      status: clear ? 'PREDICTED' : 'NO_CLEAR_PREDICTION',
      prediction: top?.label ?? null,
      probability: round4(topP),
      secondPrediction: second?.label ?? null,
      secondProbability: round4(secondP),
      margin: round4(margin),
      confidence: bandFor(clear, confidenceScore, topP, margin, picked.counts.total),
      confidenceScore,
      sampleCount: picked.counts.total,
      sequenceDepth: picked.depth,
      patternId: picked.patternId,
      distribution: toDisplayDistribution(ranked),
      ...dims,
    };

    if (input.remember !== false) {
      this.pending.set(streamKey(input.symbol, input.timeframe), result);
    }
    return result;
  }

  reset(symbol?: string, timeframe?: string): void {
    this.table.clear(symbol, timeframe);
    this.dimensions.clear(symbol, timeframe);
    if (symbol && timeframe) this.pending.delete(streamKey(symbol, timeframe));
    else this.pending.clear();
    if (!symbol) this.evaluation.reset();
  }

  private dimensionPredictions(
    input: {
      symbol: string;
      timeframe: string;
      patternId?: PatternId | null;
      contextControls?: readonly string[];
      contextSpecialEvents?: readonly string[];
      contextLiquidityEvents?: readonly string[];
    },
    labels: CandleLabel[],
  ): Pick<NextStatePrediction, 'nextControl' | 'nextSpecialEvent' | 'nextDominantLiquidity'> {
    return {
      nextControl: this.predictDimension(
        input.symbol,
        input.timeframe,
        'control',
        input.contextControls ?? labels,
        CONTROL_STATES as unknown as string[],
        input.patternId ?? null,
      ) as DimensionPrediction<ControlState>,
      nextSpecialEvent: this.predictDimension(
        input.symbol,
        input.timeframe,
        'specialEvent',
        input.contextSpecialEvents ?? labels,
        SPECIAL_EVENT_PREDICT_VALUES as unknown as string[],
        input.patternId ?? null,
      ) as DimensionPrediction<SpecialEventType | 'NONE'>,
      nextDominantLiquidity: this.predictDimension(
        input.symbol,
        input.timeframe,
        'liquidity',
        input.contextLiquidityEvents ?? labels,
        DOMINANT_LIQUIDITY_EVENTS as unknown as string[],
        input.patternId ?? null,
      ) as DimensionPrediction<DominantLiquidityEvent>,
    };
  }

  private observeDimensions(input: {
    symbol: string;
    timeframe: string;
    patternId?: PatternId | null;
    contextControls?: readonly string[];
    nextControl?: string;
    contextSpecialEvents?: readonly string[];
    nextSpecialEvent?: string;
    contextLiquidityEvents?: readonly string[];
    nextLiquidityEvent?: string;
  }): void {
    if (input.contextControls?.length && input.nextControl) {
      this.dimensions.observe(
        input.symbol,
        input.timeframe,
        'control',
        input.contextControls,
        input.nextControl,
        input.patternId,
        this.options.maxDepth,
      );
    }
    if (input.contextSpecialEvents?.length && input.nextSpecialEvent) {
      this.dimensions.observe(
        input.symbol,
        input.timeframe,
        'specialEvent',
        input.contextSpecialEvents,
        input.nextSpecialEvent,
        input.patternId,
        this.options.maxDepth,
      );
    }
    if (input.contextLiquidityEvents?.length && input.nextLiquidityEvent) {
      this.dimensions.observe(
        input.symbol,
        input.timeframe,
        'liquidity',
        input.contextLiquidityEvents,
        input.nextLiquidityEvent,
        input.patternId,
        this.options.maxDepth,
      );
    }
  }

  private predictDimension(
    symbol: string,
    timeframe: string,
    dimension: 'control' | 'specialEvent' | 'liquidity',
    context: readonly string[],
    alphabet: readonly string[],
    patternId: PatternId | null,
  ): DimensionPrediction<string> {
    const empty: DimensionPrediction<string> = {
      status: 'NO_CLEAR_PREDICTION',
      prediction: null,
      probability: 0,
      secondPrediction: null,
      secondProbability: 0,
      margin: 0,
      sampleCount: 0,
      distribution: {},
    };
    if (!context.length) return empty;

    const maxD = Math.min(this.options.maxDepth, context.length);
    let best: { total: number; byValue: Map<string, number>; depth: number } | null = null;
    for (let d = maxD; d >= 1; d--) {
      if (patternId) {
        const cond = this.dimensions.lookup(symbol, timeframe, dimension, context, d, patternId);
        if (cond.total >= this.options.minimumSampleCount) {
          best = { ...cond, depth: d };
          break;
        }
      }
      const uncond = this.dimensions.lookup(symbol, timeframe, dimension, context, d, null);
      if (uncond.total >= this.options.minimumSampleCount) {
        best = { ...uncond, depth: d };
        break;
      }
      if (uncond.total > (best?.total ?? 0)) best = { ...uncond, depth: d };
    }
    if (!best || best.total <= 0) return empty;

    const ranked = [...alphabet]
      .map((value) => ({
        value,
        n: best!.byValue.get(value) ?? 0,
        p: (best!.byValue.get(value) ?? 0) / best!.total,
      }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.p - a.p || a.value.localeCompare(b.value));

    const top = ranked[0];
    const second = ranked[1];
    const topP = top?.p ?? 0;
    const secondP = second?.p ?? 0;
    const margin = topP - secondP;
    const clear =
      best.total >= this.options.minimumSampleCount &&
      topP >= this.options.minimumTopProbability &&
      margin >= this.options.minimumPredictionMargin &&
      top != null;

    const distribution: Partial<Record<string | 'OTHER', number>> = {};
    let other = 0;
    ranked.forEach((row, i) => {
      if (i < DISPLAY_TOP) distribution[row.value] = round4(row.p);
      else other += row.p;
    });
    if (other > 0) distribution.OTHER = round4(other);

    return {
      status: clear ? 'PREDICTED' : 'NO_CLEAR_PREDICTION',
      prediction: top?.value ?? null,
      probability: round4(topP),
      secondPrediction: second?.value ?? null,
      secondProbability: round4(secondP),
      margin: round4(margin),
      sampleCount: best.total,
      distribution,
    };
  }

  private pickCounts(
    symbol: string,
    timeframe: string,
    labels: CandleLabel[],
    patternId: PatternId | null,
  ): { counts: ReturnType<TransitionTable['lookup']>; depth: number; patternId: PatternId | null } | null {
    const maxD = Math.min(this.options.maxDepth, labels.length);
    const minN = this.options.minimumSampleCount;
    for (let d = maxD; d >= 1; d--) {
      if (patternId) {
        const cond = this.table.lookup(symbol, timeframe, labels, d, patternId);
        if (cond.total >= minN) return { counts: cond, depth: d, patternId };
      }
      const uncond = this.table.lookup(symbol, timeframe, labels, d, null);
      if (uncond.total >= minN) return { counts: uncond, depth: d, patternId: null };
    }

    let best: { counts: ReturnType<TransitionTable['lookup']>; depth: number; patternId: PatternId | null } | null =
      null;
    for (let d = maxD; d >= 1; d--) {
      const uncond = this.table.lookup(symbol, timeframe, labels, d, null);
      if (uncond.total > (best?.counts.total ?? 0)) best = { counts: uncond, depth: d, patternId: null };
    }
    return best;
  }
}

function rankDistribution(
  byLabel: Map<CandleLabel, number>,
  total: number,
): Array<{ label: CandleLabel; p: number; n: number }> {
  const rows: Array<{ label: CandleLabel; p: number; n: number }> = [];
  for (const label of CANDLE_LABELS) {
    const n = byLabel.get(label) ?? 0;
    if (!n) continue;
    rows.push({ label, p: n / total, n });
  }
  rows.sort((a, b) => b.p - a.p || a.label.localeCompare(b.label));
  return rows;
}

function toDisplayDistribution(
  ranked: Array<{ label: CandleLabel; p: number }>,
): Partial<Record<CandleLabel | 'OTHER', number>> {
  const out: Partial<Record<CandleLabel | 'OTHER', number>> = {};
  let other = 0;
  ranked.forEach((row, i) => {
    if (i < DISPLAY_TOP) out[row.label] = round4(row.p);
    else other += row.p;
  });
  if (other > 0) out.OTHER = round4(other);
  return out;
}

function scorePredictionConfidence(input: {
  topP: number;
  margin: number;
  sampleCount: number;
  depth: number;
  minSamples: number;
}): number {
  const sampleScore = clamp(Math.log((input.sampleCount + 1) / input.minSamples) / Math.log(20), 0, 1);
  const depthScore = clamp(input.depth / MAX_SEQUENCE_DEPTH, 0, 1);
  const marginScore = clamp(input.margin / 0.4, 0, 1);
  const raw = 100 * (0.35 * input.topP + 0.25 * marginScore + 0.25 * sampleScore + 0.15 * depthScore);
  return Math.round(clamp(raw, 0, 100));
}

function bandFor(
  clear: boolean,
  score: number,
  topP: number,
  margin: number,
  n: number,
): PredictionConfidenceBand {
  if (!clear) return 'LOW';
  if (score >= 70 && topP >= 0.7 && margin >= 0.2 && n >= 400) return 'HIGH';
  return 'MODERATE';
}

function emptyPrediction(patternId: PatternId | null): NextStatePrediction {
  return {
    status: 'NO_CLEAR_PREDICTION',
    prediction: null,
    probability: 0,
    secondPrediction: null,
    secondProbability: 0,
    margin: 0,
    confidence: 'LOW',
    confidenceScore: 0,
    sampleCount: 0,
    sequenceDepth: 0,
    patternId,
    distribution: {},
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function streamKey(symbol: string, timeframe: string): string {
  return `${symbol}|${timeframe}`;
}

export function toCurrentPattern(candidate: {
  id: PatternId;
  status: string;
  progress: number;
  confidence: number;
  title: string;
} | null): {
  id: PatternId;
  status: string;
  progress: number;
  confidence: number;
  title: string;
  preview: boolean;
} | null {
  if (!candidate) return null;
  const preview = candidate.status === 'PREVIEW';
  return {
    id: candidate.id,
    status: preview ? 'FORMING' : candidate.status,
    progress: Math.round(clamp(candidate.progress, 0, 1) * 100),
    confidence: candidate.confidence,
    title: candidate.title,
    preview,
  };
}

export type { SpecialEventPredictValue };
