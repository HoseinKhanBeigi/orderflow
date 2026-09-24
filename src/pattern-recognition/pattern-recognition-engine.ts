import { RingBuffer } from '../core/ring-buffer.js';
import { PATTERN_DEFINITIONS, patternVersionTag } from './pattern-definitions.js';
import {
  bestMatchForDefinition,
  matchExpired,
  matchLooksFailed,
  pickPrimary,
} from './pattern-matcher.js';
import type {
  CandleLabel,
  LabeledCandle,
  PatternAlert,
  PatternCandidate,
  PatternDefinition,
  PatternEngineOptions,
  PatternEvent,
  PatternMarker,
  PatternSnapshot,
} from './pattern-types.js';
import { PATTERN_ENGINE_VERSION } from './pattern-types.js';

const DEFAULT_BUFFER = 40;
const EVENT_BUFFER = 80;

interface StreamState {
  buffer: RingBuffer<LabeledCandle>;
  lastById: Map<string, PatternCandidate>;
  events: RingBuffer<PatternEvent>;
  lastAlertKey: Map<string, string>;
}

function streamKey(symbol: string, timeframe: string): string {
  return `${symbol}|${timeframe}`;
}

export function timeframeToSeconds(timeframe: string): number {
  const t = timeframe.trim();
  if (t === '1D' || t === '1d') return 86_400;
  if (t.endsWith('h') || t.endsWith('H')) return (Number.parseInt(t, 10) || 1) * 3600;
  if (t.endsWith('m') || t.endsWith('M')) return (Number.parseInt(t, 10) || 1) * 60;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n * 60 : 60;
}

export function minutesToTimeframe(minutes: number): string {
  if (minutes === 1440) return '1D';
  if (minutes === 240) return '4h';
  if (minutes === 120) return '2h';
  if (minutes === 60) return '1h';
  return `${minutes}m`;
}

/**
 * Sequence matcher over finalized candle labels.
 * Isolated per symbol+timeframe. Never uses future candles.
 */
export class PatternRecognitionEngine {
  private readonly bufferSize: number;
  private readonly definitions: PatternDefinition[];
  private readonly streams = new Map<string, StreamState>();

  constructor(options: PatternEngineOptions = {}) {
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER;
    this.definitions = options.definitions ?? PATTERN_DEFINITIONS;
  }

  ingest(candle: LabeledCandle, options?: { preview?: boolean }): PatternSnapshot {
    const state = this.stream(candle.symbol, candle.timeframe);
    if (options?.preview) {
      return this.evaluate(state, candle.symbol, candle.timeframe, candle);
    }
    const last = state.buffer.last();
    if (!last || last.timestamp !== candle.timestamp) {
      state.buffer.push(candle);
    } else {
      // Same completed bar replayed — replace in place by rebuilding.
      const arr = state.buffer.toArray();
      arr[arr.length - 1] = candle;
      state.buffer.clear();
      for (const item of arr) state.buffer.push(item);
    }
    return this.evaluate(state, candle.symbol, candle.timeframe, null);
  }

  snapshot(symbol: string, timeframe: string): PatternSnapshot {
    const state = this.streams.get(streamKey(symbol, timeframe));
    if (!state) return emptySnapshot(symbol, timeframe);
    return this.evaluate(state, symbol, timeframe, null, { alerts: false });
  }

  labels(symbol: string, timeframe: string): LabeledCandle[] {
    return this.streams.get(streamKey(symbol, timeframe))?.buffer.toArray() ?? [];
  }

  events(symbol?: string, timeframe?: string): PatternEvent[] {
    if (symbol && timeframe) {
      return this.streams.get(streamKey(symbol, timeframe))?.events.toArray() ?? [];
    }
    const out: PatternEvent[] = [];
    for (const [key, state] of this.streams) {
      if (symbol && !key.startsWith(`${symbol}|`)) continue;
      out.push(...state.events.toArray());
    }
    return out.sort((a, b) => a.startTimestamp - b.startTimestamp);
  }

  reset(symbol?: string, timeframe?: string): void {
    if (symbol && timeframe) {
      this.streams.delete(streamKey(symbol, timeframe));
      return;
    }
    if (symbol) {
      for (const key of [...this.streams.keys()]) {
        if (key.startsWith(`${symbol}|`)) this.streams.delete(key);
      }
      return;
    }
    this.streams.clear();
  }

  private stream(symbol: string, timeframe: string): StreamState {
    const key = streamKey(symbol, timeframe);
    let state = this.streams.get(key);
    if (!state) {
      state = {
        buffer: new RingBuffer<LabeledCandle>(this.bufferSize),
        lastById: new Map(),
        events: new RingBuffer<PatternEvent>(EVENT_BUFFER),
        lastAlertKey: new Map(),
      };
      this.streams.set(key, state);
    }
    return state;
  }

  private evaluate(
    state: StreamState,
    symbol: string,
    timeframe: string,
    preview: LabeledCandle | null,
    opts?: { alerts?: boolean },
  ): PatternSnapshot {
    const emitAlerts = opts?.alerts !== false;
    const finalized = state.buffer.toArray();
    const buffer = preview ? [...finalized, preview] : finalized;
    const statusOverride = preview ? ('PREVIEW' as const) : undefined;
    const last = buffer[buffer.length - 1];
    const currentLabel: CandleLabel | null = last?.label ?? null;
    const barSeconds = timeframeToSeconds(timeframe);

    const live: PatternCandidate[] = [];
    const alerts: PatternAlert[] = [];

    for (const def of this.definitions) {
      const match = bestMatchForDefinition(def, buffer, statusOverride);
      const prev = state.lastById.get(def.id);

      if (preview) {
        if (match) live.push(downgradeConfirmed(match.candidate));
        else if (prev && (prev.status === 'FORMING' || prev.status === 'PREVIEW' || prev.status === 'CONFIRMED')) {
          live.push(prev.status === 'CONFIRMED' ? prev : { ...prev, status: 'PREVIEW' });
        }
        continue;
      }

      if (last && matchLooksFailed(def, prev, last, match)) {
        const failed = failCandidate(prev!, last.timestamp, 'Opposite control regained');
        live.push(failed);
        this.recordEvent(state, symbol, timeframe, failed);
        if (emitAlerts) {
          const alert = maybeAlert(state, symbol, timeframe, failed, last.timestamp);
          if (alert) alerts.push(alert);
        }
        state.lastById.delete(def.id);
        continue;
      }

      if (last && !match && matchExpired(def, prev, last.timestamp, barSeconds, match)) {
        const expired = expireCandidate(prev!, last.timestamp);
        this.recordEvent(state, symbol, timeframe, expired);
        state.lastById.delete(def.id);
        continue;
      }

      if (match) {
        const candidate = match.candidate;
        live.push(candidate);
        if (emitAlerts) {
          const alert = maybeAlert(state, symbol, timeframe, candidate, last?.timestamp ?? candidate.startTimestamp, prev);
          if (alert) alerts.push(alert);
        }
        if (candidate.status === 'CONFIRMED' && prev?.status !== 'CONFIRMED') {
          this.recordEvent(state, symbol, timeframe, candidate);
        }
        state.lastById.set(def.id, candidate);
        continue;
      }

      if (prev?.status === 'CONFIRMED' && last) {
        const elapsed = Math.floor((last.timestamp - prev.startTimestamp) / Math.max(1, barSeconds)) + 1;
        if (elapsed <= def.maxBars) {
          live.push(prev);
          continue;
        }
      }

      if (prev?.status === 'FORMING' || prev?.status === 'PREVIEW') {
        live.push(prev);
        continue;
      }

      state.lastById.delete(def.id);
    }

    const primary = pickPrimary(live);
    const markers = markersFrom(live, last?.timestamp ?? 0);

    return {
      symbol,
      timeframe,
      currentLabel,
      primaryPattern: primary,
      candidates: [...live].sort((a, b) => b.confidence - a.confidence),
      markers,
      alerts,
      engineVersion: PATTERN_ENGINE_VERSION,
      nextState: null,
    };
  }

  private recordEvent(
    state: StreamState,
    symbol: string,
    timeframe: string,
    candidate: PatternCandidate,
  ): void {
    state.events.push({
      patternId: candidate.id,
      patternVersion: candidate.patternVersion || patternVersionTag(candidate.id, candidate.version),
      symbol,
      timeframe,
      startTimestamp: candidate.startTimestamp,
      confirmedTimestamp: candidate.confirmedTimestamp,
      failedTimestamp: candidate.failedTimestamp,
      direction: candidate.direction,
      status: candidate.status,
      confidence: candidate.confidence,
      matchedLabels: candidate.matchedLabels,
      candleTimestamps: candidate.candleTimestamps,
      engineVersion: PATTERN_ENGINE_VERSION,
      outcome: null,
    });
  }
}

function emptySnapshot(symbol: string, timeframe: string): PatternSnapshot {
  return {
    symbol,
    timeframe,
    currentLabel: null,
    primaryPattern: null,
    candidates: [],
    markers: [],
    alerts: [],
    engineVersion: PATTERN_ENGINE_VERSION,
    nextState: null,
  };
}

function downgradeConfirmed(candidate: PatternCandidate): PatternCandidate {
  if (candidate.status !== 'CONFIRMED') {
    return { ...candidate, status: 'PREVIEW' };
  }
  return {
    ...candidate,
    status: 'PREVIEW',
    confirmedTimestamp: null,
  };
}

function failCandidate(prev: PatternCandidate, at: number, reason: string): PatternCandidate {
  return {
    ...prev,
    status: 'FAILED',
    failedTimestamp: at,
    failReason: reason,
  };
}

function expireCandidate(prev: PatternCandidate, at: number): PatternCandidate {
  return {
    ...prev,
    status: 'EXPIRED',
    failedTimestamp: at,
    failReason: 'Max bars exceeded while forming',
  };
}

function maybeAlert(
  state: StreamState,
  symbol: string,
  timeframe: string,
  candidate: PatternCandidate,
  timestamp: number,
  prev?: PatternCandidate,
): PatternAlert | null {
  let type: PatternAlert['type'] | null = null;
  if (candidate.status === 'CONFIRMED' && prev?.status !== 'CONFIRMED') type = 'PATTERN_CONFIRMED';
  else if (candidate.status === 'FAILED') type = 'PATTERN_FAILED';
  else if (candidate.status === 'FORMING') {
    const stageChanged = !prev || prev.stage < candidate.stage || prev.id !== candidate.id;
    const startChanged = prev?.startTimestamp !== candidate.startTimestamp;
    if (stageChanged || (startChanged && candidate.stage >= 2)) type = 'PATTERN_FORMING';
  }
  if (!type) return null;

  const key = `${candidate.id}:${type}:${candidate.startTimestamp}:${candidate.stage}`;
  if (state.lastAlertKey.get(candidate.id) === key) return null;
  state.lastAlertKey.set(candidate.id, key);

  const verb =
    type === 'PATTERN_CONFIRMED' ? 'confirmed' : type === 'PATTERN_FAILED' ? 'failed' : 'forming';
  return {
    type,
    symbol,
    timeframe,
    patternId: candidate.id,
    patternVersion: candidate.patternVersion,
    status: candidate.status,
    stage: candidate.stage,
    confidence: candidate.confidence,
    timestamp,
    message: `${candidate.title} ${verb} · ${candidate.confidence}% · ${timeframe}`,
  };
}

function markersFrom(candidates: PatternCandidate[], lastTimestamp: number): PatternMarker[] {
  const live = candidates.filter(
    (c) => c.status === 'FORMING' || c.status === 'CONFIRMED' || c.status === 'PREVIEW',
  );
  const primary = pickPrimary(live);
  if (!primary) return [];
  const time =
    primary.status === 'CONFIRMED' && primary.confirmedTimestamp != null
      ? primary.confirmedTimestamp
      : lastTimestamp;
  return [toPatternMarker(primary, time)];
}

export function toPatternMarker(candidate: PatternCandidate, time: number): PatternMarker {
  return {
    time,
    badge: candidate.badge,
    patternId: candidate.id,
    title: candidate.title,
    status: candidate.status,
    confidence: candidate.confidence,
    direction: candidate.direction,
    stage: candidate.stage,
    totalStages: candidate.totalStages,
    progress: candidate.progress,
    matchedLabels: candidate.matchedLabels,
    barsUsed: candidate.barsUsed,
  };
}

/** Replay a finalized sequence (tests, history API). Never inspects beyond index i. */
export function replayPatterns(
  candles: LabeledCandle[],
  engine: PatternRecognitionEngine = new PatternRecognitionEngine(),
): { snapshots: PatternSnapshot[]; last: PatternSnapshot | null } {
  const snapshots: PatternSnapshot[] = [];
  if (!candles.length) return { snapshots, last: null };
  const symbol = candles[0]!.symbol;
  const timeframe = candles[0]!.timeframe;
  engine.reset(symbol, timeframe);
  for (const candle of candles) {
    snapshots.push(engine.ingest(candle));
  }
  return { snapshots, last: snapshots[snapshots.length - 1] ?? null };
}

export function recognizeFromCandles(candles: LabeledCandle[]): PatternSnapshot {
  const last = replayPatterns(candles).last;
  if (last) return last;
  return emptySnapshot(candles[0]?.symbol ?? '', candles[0]?.timeframe ?? '');
}
