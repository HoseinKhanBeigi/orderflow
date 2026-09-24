import { rollup } from '../footprint/rollup.js';
import type { FootprintBar } from '../footprint/types.js';
import { labelFootprintBar, labelFootprintBars } from './candle-label-adapter.js';
import { NextFootprintStatePredictor } from './next-state-predictor.js';
import { PatternRecognitionEngine, minutesToTimeframe, replayPatterns, toPatternMarker } from './pattern-recognition-engine.js';
import { PATTERN_ENGINE_VERSION } from './pattern-types.js';
import type { LabeledCandle, PatternId, PatternMarker, PatternSnapshot } from './pattern-types.js';

export const PATTERN_TF_MINUTES = [1, 5, 15, 30, 45, 60, 120, 240, 1440] as const;

export function historyPatternView(
  bars: FootprintBar[],
  timeframeMinutes: number,
  options?: { lastIsLive?: boolean; predictor?: NextFootprintStatePredictor },
): { snapshot: PatternSnapshot | null; markers: PatternMarker[] } {
  const tf = minutesToTimeframe(timeframeMinutes);
  const { finalized, preview } = labelFootprintBars(bars, tf, { lastIsLive: options?.lastIsLive });
  const engine = new PatternRecognitionEngine();
  const { snapshots, last } = replayPatterns(finalized, engine);
  const byKey = new Map<string, PatternMarker>();
  for (const snap of snapshots) {
    for (const candidate of snap.candidates) {
      if (candidate.status !== 'CONFIRMED' && candidate.status !== 'FORMING' && candidate.status !== 'PREVIEW') {
        continue;
      }
      const key = `${candidate.id}:${candidate.startTimestamp}`;
      const time =
        candidate.status === 'CONFIRMED'
          ? (candidate.confirmedTimestamp ?? candidate.candleTimestamps[candidate.candleTimestamps.length - 1] ?? 0)
          : (candidate.candleTimestamps[candidate.candleTimestamps.length - 1] ?? candidate.startTimestamp);
      byKey.set(key, toPatternMarker(candidate, time));
    }
  }
  const predictor = options?.predictor ?? new NextFootprintStatePredictor();
  if (!options?.predictor && finalized.length) {
    const patternAt: Array<PatternId | null> = snapshots.map((s) => s.primaryPattern?.id ?? null);
    predictor.trainFromCandles(finalized, patternAt);
  }
  const nextState = finalized.length
    ? predictor.predict({
        symbol: finalized[0]!.symbol,
        timeframe: tf,
        contextLabels: finalized.map((c) => c.label),
        patternId: last?.primaryPattern?.id ?? null,
        remember: false,
      })
    : null;
  let snapshot = last;
  if (preview) snapshot = engine.ingest(preview, { preview: true });
  if (snapshot) snapshot.nextState = nextState;
  const live = snapshot?.primaryPattern;
  if (live && (live.status === 'FORMING' || live.status === 'PREVIEW' || live.status === 'CONFIRMED')) {
    const time = live.candleTimestamps[live.candleTimestamps.length - 1] ?? live.startTimestamp;
    byKey.set(`${live.id}:${live.startTimestamp}`, toPatternMarker(live, time));
  }
  return { snapshot, markers: [...byKey.values()] };
}

export function recognizeFootprintBars(
  bars: FootprintBar[],
  timeframeMinutes: number,
  options?: { lastIsLive?: boolean; engine?: PatternRecognitionEngine },
): PatternSnapshot {
  const view = historyPatternView(bars, timeframeMinutes, options);
  if (view.snapshot) return view.snapshot;
  return {
    symbol: bars[0]?.symbol ?? '',
    timeframe: minutesToTimeframe(timeframeMinutes),
    currentLabel: null,
    primaryPattern: null,
    candidates: [],
    markers: [],
    alerts: [],
    engineVersion: PATTERN_ENGINE_VERSION,
    nextState: null,
  };
}

export function labeledHistory(
  bars: FootprintBar[],
  timeframeMinutes: number,
  lastIsLive = false,
): LabeledCandle[] {
  return labelFootprintBars(bars, minutesToTimeframe(timeframeMinutes), { lastIsLive }).finalized;
}

export function mergeByTime(bars: FootprintBar[]): FootprintBar[] {
  if (bars.length <= 1) return bars;
  return rollup(bars, 1);
}

export function completedTfBar(
  minuteBars: FootprintBar[],
  timeframeMinutes: number,
  closedMinuteTime: number,
): FootprintBar | null {
  if (timeframeMinutes <= 1) {
    return minuteBars.find((b) => b.time === closedMinuteTime) ?? null;
  }
  const bucketSec = timeframeMinutes * 60;
  if (closedMinuteTime % bucketSec !== 0) return null;
  const start = closedMinuteTime - bucketSec;
  const slice = minuteBars.filter((b) => b.time >= start && b.time < closedMinuteTime);
  if (!slice.length) return null;
  return rollup(slice, timeframeMinutes)[0] ?? null;
}

export function currentTfBar(
  minuteBars: FootprintBar[],
  timeframeMinutes: number,
  currentMinuteTime: number,
): FootprintBar | null {
  const bucketSec = timeframeMinutes * 60;
  const start = currentMinuteTime - (currentMinuteTime % bucketSec);
  const slice = minuteBars.filter((b) => b.time >= start && b.time <= currentMinuteTime);
  if (!slice.length) return null;
  return rollup(slice, timeframeMinutes)[0] ?? null;
}

export function toLabeledTfBar(
  bar: FootprintBar,
  prior: FootprintBar[],
  timeframeMinutes: number,
  metrics?: Partial<LabeledCandle>,
): LabeledCandle {
  return labelFootprintBar(bar, prior, minutesToTimeframe(timeframeMinutes), metrics);
}
