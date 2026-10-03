import type { ActiveSequence, ReferenceLevelType, SequenceDirection } from './types.js';
import type { MarketSequenceConfig } from './config.js';
import { emptyStages } from './label-selector.js';

export function makeSequenceId(
  levelType: ReferenceLevelType,
  price: number,
  startedAt: number,
): string {
  const px = Number.isFinite(price) ? price.toFixed(4) : '0';
  const d = new Date(startedAt * 1000);
  const stamp = Number.isFinite(d.getTime())
    ? d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    : String(startedAt);
  return `${levelType}_${px}_${stamp}`;
}

export function storeKey(symbol: string, timeframe: string, referenceLevelId: string): string {
  return `${symbol}|${timeframe}|${referenceLevelId}`;
}

/**
 * Bounded in-memory store of active sequences.
 * Keyed by symbol + timeframe + referenceLevelId.
 */
export class SequenceStore {
  private readonly map = new Map<string, ActiveSequence>();

  constructor(private readonly cfg: MarketSequenceConfig) {}

  get(symbol: string, timeframe: string, referenceLevelId: string): ActiveSequence | undefined {
    return this.map.get(storeKey(symbol, timeframe, referenceLevelId));
  }

  set(seq: ActiveSequence, symbol: string, timeframe: string): void {
    this.map.set(storeKey(symbol, timeframe, seq.referenceLevelId), seq);
    this.trim();
  }

  delete(symbol: string, timeframe: string, referenceLevelId: string): void {
    this.map.delete(storeKey(symbol, timeframe, referenceLevelId));
  }

  allFor(symbol: string, timeframe: string): ActiveSequence[] {
    const prefix = `${symbol}|${timeframe}|`;
    const out: ActiveSequence[] = [];
    for (const [k, v] of this.map) {
      if (k.startsWith(prefix)) out.push(v);
    }
    return out;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  create(input: {
    symbol: string;
    timeframe: string;
    referenceLevelId: string;
    referenceLevelType: ReferenceLevelType;
    referencePrice: number;
    startedAt: number;
    direction: SequenceDirection;
  }): ActiveSequence {
    const seq: ActiveSequence = {
      sequenceId: makeSequenceId(input.referenceLevelType, input.referencePrice, input.startedAt),
      referenceLevelId: input.referenceLevelId,
      referenceLevelType: input.referenceLevelType,
      referencePrice: input.referencePrice,
      startedAt: input.startedAt,
      lastUpdatedAt: input.startedAt,
      direction: input.direction,
      stages: emptyStages(),
      currentStage: 'LOCATION',
      status: 'ACTIVE',
      barsAlive: 0,
      barsSinceProgress: 0,
    };
    this.set(seq, input.symbol, input.timeframe);
    return seq;
  }

  private trim(): void {
    if (this.map.size <= this.cfg.maxActiveSequences) return;
    const entries = [...this.map.entries()].sort(
      (a, b) => a[1].lastUpdatedAt - b[1].lastUpdatedAt,
    );
    const drop = entries.length - this.cfg.maxActiveSequences;
    for (let i = 0; i < drop; i++) this.map.delete(entries[i]![0]);
  }
}
