import { RingBuffer } from '../core/ring-buffer.js';
import { rollup } from '../footprint/rollup.js';
import type { FootprintBar } from '../footprint/types.js';
import { labelFootprintBar } from './candle-label-adapter.js';
import {
  PATTERN_TF_MINUTES,
  completedTfBar,
  currentTfBar,
  mergeByTime,
} from './from-bars.js';
import { NextFootprintStatePredictor } from './next-state-predictor.js';
import { PatternRecognitionEngine, minutesToTimeframe } from './pattern-recognition-engine.js';
import type { PatternAlert, PatternSnapshot } from './pattern-types.js';

const MINUTE_CAP = 1_600;

interface SymbolBuf {
  minutes: RingBuffer<FootprintBar>;
  lastMinute: number;
  lastTf: Map<number, number>;
}

/**
 * Live adapter: consumes closed 1m footprint bars, labels completed TF candles,
 * and feeds the pattern engine. Preview candles never confirm.
 */
export class PatternLiveHub {
  readonly engine = new PatternRecognitionEngine();
  readonly predictor: NextFootprintStatePredictor;
  private readonly bySymbol = new Map<string, SymbolBuf>();
  private readonly lastSnap = new Map<string, PatternSnapshot>();

  constructor(options?: { predictor?: NextFootprintStatePredictor }) {
    this.predictor = options?.predictor ?? new NextFootprintStatePredictor();
  }

  observeClosed(bars: FootprintBar[]): { alerts: PatternAlert[]; dirty: string[] } {
    const alerts: PatternAlert[] = [];
    const dirty: string[] = [];
    const grouped = new Map<string, FootprintBar[]>();
    for (const bar of bars) {
      const key = `${bar.symbol}|${bar.market}`;
      const list = grouped.get(key) ?? [];
      list.push(bar);
      grouped.set(key, list);
    }
    for (const [key, list] of grouped) {
      const [symbol, market] = key.split('|') as [string, string];
      const result = this.observeSymbol(symbol, market, list);
      alerts.push(...result.alerts);
      if (result.ingested) dirty.push(symbol);
    }
    return { alerts, dirty: [...new Set(dirty)] };
  }

  snapshot(symbol: string, timeframeMinutes: number, market = 'perp'): PatternSnapshot | null {
    return this.lastSnap.get(`${symbol}|${market}|${minutesToTimeframe(timeframeMinutes)}`) ?? null;
  }

  snapshotsForSymbol(symbol: string, market = 'perp'): PatternSnapshot[] {
    const prefix = `${symbol}|${market}|`;
    const out: PatternSnapshot[] = [];
    for (const [key, snap] of this.lastSnap) {
      if (key.startsWith(prefix)) out.push(snap);
    }
    return out;
  }

  private observeSymbol(symbol: string, market: string, incoming: FootprintBar[]): { alerts: PatternAlert[]; ingested: boolean } {
    const buf = this.buf(symbol, market);
    const mergedIncoming = mergeByTime(incoming).sort((a, b) => a.time - b.time);
    const alerts: PatternAlert[] = [];
    let ingested = false;

    for (const bar of mergedIncoming) {
      const existing = buf.minutes.toArray();
      if (existing.some((b) => b.time === bar.time)) {
        replaceMinute(buf.minutes, bar);
      } else {
        buf.minutes.push(bar);
      }
      if (bar.time < buf.lastMinute) continue;
      buf.lastMinute = bar.time;
      const closed = this.closeTimeframes(symbol, market, buf, bar.time);
      alerts.push(...closed.alerts);
      if (closed.ingested) ingested = true;
    }

    this.previewTimeframes(symbol, market, buf);
    return { alerts, ingested };
  }

  private closeTimeframes(symbol: string, market: string, buf: SymbolBuf, closedMinute: number): { alerts: PatternAlert[]; ingested: boolean } {
    const alerts: PatternAlert[] = [];
    let ingested = false;
    const minutes = mergeByTime(buf.minutes.toArray()).sort((a, b) => a.time - b.time);

    for (const tf of PATTERN_TF_MINUTES) {
      const completed = completedTfBar(minutes, tf, closedMinute);
      if (!completed) continue;
      const last = buf.lastTf.get(tf);
      if (last != null && last >= completed.time) continue;
      buf.lastTf.set(tf, completed.time);
      ingested = true;

      const priorTf = rollup(
        minutes.filter((b) => b.time < completed.time),
        tf,
      ).slice(-20);
      const candle = labelFootprintBar(completed, priorTf, minutesToTimeframe(tf));
      const tfName = minutesToTimeframe(tf);
      const snapKey = `${symbol}|${market}|${tfName}`;
      const prevSnap = this.lastSnap.get(snapKey);
      const priorLabels = this.engine.labels(symbol, tfName);
      if (priorLabels.length) {
        this.predictor.observeCompleted({
          symbol,
          timeframe: tfName,
          contextLabels: priorLabels.map((c) => c.label),
          nextLabel: candle.label,
          patternId: prevSnap?.primaryPattern?.id ?? null,
        });
      }
      const snap = this.engine.ingest(candle);
      snap.nextState = this.predictor.predict({
        symbol,
        timeframe: tfName,
        contextLabels: this.engine.labels(symbol, tfName).map((c) => c.label),
        patternId: snap.primaryPattern?.id ?? null,
      });
      this.lastSnap.set(snapKey, snap);
      alerts.push(...snap.alerts);
    }
    return { alerts, ingested };
  }

  private previewTimeframes(symbol: string, market: string, buf: SymbolBuf): void {
    const minutes = mergeByTime(buf.minutes.toArray()).sort((a, b) => a.time - b.time);
    const last = minutes[minutes.length - 1];
    if (!last) return;
    for (const tf of PATTERN_TF_MINUTES) {
      if (tf <= 1) continue;
      const forming = currentTfBar(minutes, tf, last.time);
      if (!forming || forming.time === buf.lastTf.get(tf)) continue;
      const priorTf = rollup(
        minutes.filter((b) => b.time < forming.time),
        tf,
      ).slice(-20);
      const candle = labelFootprintBar(forming, priorTf, minutesToTimeframe(tf));
      const tfName = minutesToTimeframe(tf);
      const snap = this.engine.ingest(candle, { preview: true });
      snap.nextState = this.predictor.predict({
        symbol,
        timeframe: tfName,
        contextLabels: this.engine.labels(symbol, tfName).map((c) => c.label),
        patternId: snap.primaryPattern?.id ?? null,
        remember: false,
      });
      this.lastSnap.set(`${symbol}|${market}|${tfName}`, snap);
    }
  }

  private buf(symbol: string, market: string): SymbolBuf {
    const key = `${symbol}|${market}`;
    let buf = this.bySymbol.get(key);
    if (!buf) {
      buf = { minutes: new RingBuffer<FootprintBar>(MINUTE_CAP), lastMinute: 0, lastTf: new Map() };
      this.bySymbol.set(key, buf);
    }
    return buf;
  }
}

function replaceMinute(buf: RingBuffer<FootprintBar>, bar: FootprintBar): void {
  const arr = buf.toArray();
  const idx = arr.findIndex((b) => b.time === bar.time);
  if (idx < 0) {
    buf.push(bar);
    return;
  }
  arr[idx] = bar;
  buf.clear();
  for (const item of arr) buf.push(item);
}
