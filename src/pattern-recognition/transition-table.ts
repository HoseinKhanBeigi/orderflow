import type { CandleLabel, PatternId } from './pattern-types.js';
import { CANDLE_LABELS } from './pattern-types.js';

export const MAX_SEQUENCE_DEPTH = 5;

const LABEL_SET = new Set<string>(CANDLE_LABELS);

export function isCandleLabel(value: string): value is CandleLabel {
  return LABEL_SET.has(value);
}

export function normalizeLabel(value: string | null | undefined): CandleLabel {
  if (value && isCandleLabel(value)) return value;
  return 'UNCLASSIFIED';
}

export function ngramKey(patternId: PatternId | null | undefined, labels: CandleLabel[]): string {
  const seq = labels.join('>');
  return patternId ? `@${patternId}|${seq}` : seq;
}

export interface TransitionCounts {
  total: number;
  byLabel: Map<CandleLabel, number>;
}

/**
 * Deterministic frequency table: count(sequence → nextLabel) per symbol|timeframe.
 * Incremental; the live engine must not rebuild this from scratch every candle.
 */
export class TransitionTable {
  private readonly streams = new Map<string, Map<string, Map<CandleLabel, number>>>();

  observe(
    symbol: string,
    timeframe: string,
    contextLabels: readonly string[],
    nextLabel: string,
    patternId?: PatternId | null,
    maxDepth = MAX_SEQUENCE_DEPTH,
  ): void {
    const labels = contextLabels.map(normalizeLabel);
    if (!labels.length) return;
    const next = normalizeLabel(nextLabel);
    const stream = this.stream(symbol, timeframe);
    const depth = Math.min(maxDepth, labels.length);
    for (let d = 1; d <= depth; d++) {
      const slice = labels.slice(-d);
      this.bump(stream, ngramKey(null, slice), next);
      if (patternId) this.bump(stream, ngramKey(patternId, slice), next);
    }
  }

  lookup(
    symbol: string,
    timeframe: string,
    contextLabels: readonly string[],
    depth: number,
    patternId?: PatternId | null,
  ): TransitionCounts {
    const labels = contextLabels.map(normalizeLabel);
    if (depth < 1 || labels.length < depth) return emptyCounts();
    const slice = labels.slice(-depth);
    const row = this.streams.get(streamKey(symbol, timeframe))?.get(ngramKey(patternId, slice));
    if (!row) return emptyCounts();
    let total = 0;
    const byLabel = new Map<CandleLabel, number>();
    for (const [label, n] of row) {
      byLabel.set(label, n);
      total += n;
    }
    return { total, byLabel };
  }

  sampleCount(symbol: string, timeframe: string): number {
    const stream = this.streams.get(streamKey(symbol, timeframe));
    if (!stream) return 0;
    let n = 0;
    for (const [key, row] of stream) {
      if (key.includes('|') || key.startsWith('@')) continue;
      if (!key.includes('>')) {
        for (const c of row.values()) n += c;
      }
    }
    return n;
  }

  clear(symbol?: string, timeframe?: string): void {
    if (symbol && timeframe) {
      this.streams.delete(streamKey(symbol, timeframe));
      return;
    }
    this.streams.clear();
  }

  private stream(symbol: string, timeframe: string): Map<string, Map<CandleLabel, number>> {
    const key = streamKey(symbol, timeframe);
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new Map();
      this.streams.set(key, stream);
    }
    return stream;
  }

  private bump(stream: Map<string, Map<CandleLabel, number>>, key: string, next: CandleLabel): void {
    let row = stream.get(key);
    if (!row) {
      row = new Map();
      stream.set(key, row);
    }
    row.set(next, (row.get(next) ?? 0) + 1);
  }
}

function streamKey(symbol: string, timeframe: string): string {
  return `${symbol}|${timeframe}`;
}

function emptyCounts(): TransitionCounts {
  return { total: 0, byLabel: new Map() };
}
