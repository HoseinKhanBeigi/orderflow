import type { ControlState, DominantLiquidityEvent, SpecialEventType } from './candle-classification-types.js';
import {
  CONTROL_STATES,
  DOMINANT_LIQUIDITY_EVENTS,
} from './candle-classification-types.js';
import type { CandleLabel, PatternId } from './pattern-types.js';
import { MAX_SEQUENCE_DEPTH, ngramKey } from './transition-table.js';

export type DimensionKey = 'control' | 'specialEvent' | 'liquidity';

export type DimensionValue = string;

/**
 * Frequency tables for structured next-state dimensions.
 * Counts only — no invented probabilities.
 */
export class DimensionTransitionTable {
  private readonly streams = new Map<string, Map<string, Map<string, number>>>();

  observe(
    symbol: string,
    timeframe: string,
    dimension: DimensionKey,
    context: readonly string[],
    next: string,
    patternId?: PatternId | null,
    maxDepth = MAX_SEQUENCE_DEPTH,
  ): void {
    if (!context.length) return;
    const stream = this.stream(symbol, timeframe, dimension);
    const depth = Math.min(maxDepth, context.length);
    for (let d = 1; d <= depth; d++) {
      const slice = context.slice(-d) as CandleLabel[];
      this.bump(stream, ngramKey(null, slice), next);
      if (patternId) this.bump(stream, ngramKey(patternId, slice), next);
    }
  }

  lookup(
    symbol: string,
    timeframe: string,
    dimension: DimensionKey,
    context: readonly string[],
    depth: number,
    patternId?: PatternId | null,
  ): { total: number; byValue: Map<string, number> } {
    if (depth < 1 || context.length < depth) return { total: 0, byValue: new Map() };
    const slice = context.slice(-depth) as CandleLabel[];
    const row = this.streams.get(streamKey(symbol, timeframe, dimension))?.get(ngramKey(patternId, slice));
    if (!row) return { total: 0, byValue: new Map() };
    let total = 0;
    const byValue = new Map<string, number>();
    for (const [value, n] of row) {
      byValue.set(value, n);
      total += n;
    }
    return { total, byValue };
  }

  clear(symbol?: string, timeframe?: string): void {
    if (symbol && timeframe) {
      for (const dim of ['control', 'specialEvent', 'liquidity'] as DimensionKey[]) {
        this.streams.delete(streamKey(symbol, timeframe, dim));
      }
      return;
    }
    this.streams.clear();
  }

  private stream(symbol: string, timeframe: string, dimension: DimensionKey): Map<string, Map<string, number>> {
    const key = streamKey(symbol, timeframe, dimension);
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new Map();
      this.streams.set(key, stream);
    }
    return stream;
  }

  private bump(stream: Map<string, Map<string, number>>, key: string, next: string): void {
    let row = stream.get(key);
    if (!row) {
      row = new Map();
      stream.set(key, row);
    }
    row.set(next, (row.get(next) ?? 0) + 1);
  }
}

function streamKey(symbol: string, timeframe: string, dimension: DimensionKey): string {
  return `${symbol}|${timeframe}|${dimension}`;
}

export const SPECIAL_EVENT_PREDICT_VALUES = [
  'NONE',
  'STOP_HUNT_HIGH',
  'STOP_HUNT_LOW',
  'BUYER_ABSORBED',
  'SELLER_ABSORBED',
  'HELD_SUPPORT',
  'REJECTED_RESISTANCE',
  'FAILED_BULLISH_REVERSAL',
  'FAILED_BEARISH_REVERSAL',
  'BREAKOUT_ACCEPTANCE',
  'BREAKDOWN_ACCEPTANCE',
] as const;

export type SpecialEventPredictValue = (typeof SPECIAL_EVENT_PREDICT_VALUES)[number];

export function controlToken(control: ControlState): string {
  return control;
}

export function specialEventToken(type: SpecialEventType | null): SpecialEventPredictValue {
  return type ?? 'NONE';
}

export function liquidityToken(event: DominantLiquidityEvent): string {
  return event;
}

export { CONTROL_STATES, DOMINANT_LIQUIDITY_EVENTS };
