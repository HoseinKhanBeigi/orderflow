import type { CandleLabel, PatternId } from './pattern-types.js';
import type { NextStatePrediction } from './pattern-types.js';
import { CANDLE_LABELS } from './pattern-types.js';
import { normalizeLabel } from './transition-table.js';

export const CALIBRATION_BUCKETS = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0001],
] as const;

export interface CalibrationBucketStats {
  lo: number;
  hi: number;
  predictions: number;
  hits: number;
  hitRate: number | null;
}

export interface PredictionEvalSnapshot {
  total: number;
  top1Hits: number;
  top2Hits: number;
  top1Accuracy: number | null;
  top2Accuracy: number | null;
  calibration: CalibrationBucketStats[];
  byLabel: Record<string, { n: number; hits: number }>;
  byTimeframe: Record<string, { n: number; hits: number }>;
  byDepth: Record<string, { n: number; hits: number }>;
  byPattern: Record<string, { n: number; hits: number }>;
  confusion: Record<string, Record<string, number>>;
}

/**
 * Online calibration / accuracy collector. Records only after the next
 * candle is completed — never uses T+1 at prediction time.
 */
export class PredictionEvaluation {
  private total = 0;
  private top1Hits = 0;
  private top2Hits = 0;
  private readonly buckets = CALIBRATION_BUCKETS.map(([lo, hi]) => ({ lo, hi, predictions: 0, hits: 0 }));
  private readonly byLabel = new Map<string, { n: number; hits: number }>();
  private readonly byTimeframe = new Map<string, { n: number; hits: number }>();
  private readonly byDepth = new Map<string, { n: number; hits: number }>();
  private readonly byPattern = new Map<string, { n: number; hits: number }>();
  private readonly confusion = new Map<string, Map<string, number>>();

  record(
    prediction: NextStatePrediction,
    actual: string,
    meta?: { timeframe?: string; patternId?: PatternId | null },
  ): void {
    const actualLabel = normalizeLabel(actual);
    this.total += 1;
    const top = prediction.prediction;
    const second = prediction.secondPrediction;
    const hit1 = top === actualLabel;
    const hit2 = hit1 || second === actualLabel;
    if (hit1) this.top1Hits += 1;
    if (hit2) this.top2Hits += 1;

    const p = prediction.probability;
    for (const bucket of this.buckets) {
      if (p >= bucket.lo && p < bucket.hi) {
        bucket.predictions += 1;
        if (hit1) bucket.hits += 1;
        break;
      }
    }

    bump(this.byLabel, actualLabel, hit1);
    if (meta?.timeframe) bump(this.byTimeframe, meta.timeframe, hit1);
    bump(this.byDepth, String(prediction.sequenceDepth), hit1);
    bump(this.byPattern, meta?.patternId ?? prediction.patternId ?? 'none', hit1);

    const predicted = top ?? 'NONE';
    let row = this.confusion.get(predicted);
    if (!row) {
      row = new Map();
      this.confusion.set(predicted, row);
    }
    row.set(actualLabel, (row.get(actualLabel) ?? 0) + 1);
  }

  snapshot(): PredictionEvalSnapshot {
    return {
      total: this.total,
      top1Hits: this.top1Hits,
      top2Hits: this.top2Hits,
      top1Accuracy: this.total ? this.top1Hits / this.total : null,
      top2Accuracy: this.total ? this.top2Hits / this.total : null,
      calibration: this.buckets.map((b) => ({
        lo: b.lo,
        hi: b.hi > 1 ? 1 : b.hi,
        predictions: b.predictions,
        hits: b.hits,
        hitRate: b.predictions ? b.hits / b.predictions : null,
      })),
      byLabel: Object.fromEntries(this.byLabel),
      byTimeframe: Object.fromEntries(this.byTimeframe),
      byDepth: Object.fromEntries(this.byDepth),
      byPattern: Object.fromEntries(this.byPattern),
      confusion: confusionObject(this.confusion),
    };
  }

  reset(): void {
    this.total = 0;
    this.top1Hits = 0;
    this.top2Hits = 0;
    for (const b of this.buckets) {
      b.predictions = 0;
      b.hits = 0;
    }
    this.byLabel.clear();
    this.byTimeframe.clear();
    this.byDepth.clear();
    this.byPattern.clear();
    this.confusion.clear();
  }
}

function bump(map: Map<string, { n: number; hits: number }>, key: string, hit: boolean): void {
  const row = map.get(key) ?? { n: 0, hits: 0 };
  row.n += 1;
  if (hit) row.hits += 1;
  map.set(key, row);
}

function confusionObject(map: Map<string, Map<string, number>>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const label of ['NONE', ...CANDLE_LABELS]) {
    const row = map.get(label);
    if (!row) continue;
    out[label] = Object.fromEntries(row);
  }
  for (const [pred, row] of map) {
    if (out[pred]) continue;
    out[pred] = Object.fromEntries(row);
  }
  return out;
}
