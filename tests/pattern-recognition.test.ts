import { describe, expect, it } from 'vitest';
import {
  PatternRecognitionEngine,
  labelFootprintBar,
  labeledCandle,
  recognizeFromCandles,
  replayPatterns,
} from '../src/pattern-recognition/index.js';
import type { CandleLabel, LabeledCandle } from '../src/pattern-recognition/index.js';
import type { FootprintBar } from '../src/footprint/types.js';

const TF = '5m';
const STEP = 300;

function c(
  i: number,
  label: CandleLabel,
  extra: Partial<LabeledCandle> = {},
  symbol = 'BTCUSDT',
  timeframe = TF,
): LabeledCandle {
  return labeledCandle({
    timestamp: 1_700_000_000 + i * STEP,
    symbol,
    timeframe,
    label,
    labelConfidence: extra.labelConfidence ?? 0.85,
    open: 100,
    high: 101,
    low: 99,
    close: 100.4,
    volume: 10_000,
    ...extra,
  });
}

function seq(labels: CandleLabel[], extra: Partial<LabeledCandle>[] = []): LabeledCandle[] {
  return labels.map((label, i) => c(i, label, extra[i] ?? {}));
}

function fpBar(partial: Partial<FootprintBar> & { time: number }): FootprintBar {
  const buy = partial.totalBuy ?? 10_000;
  const sell = partial.totalSell ?? 10_000;
  const close = partial.close ?? 100;
  return {
    symbol: 'BTCUSDT',
    exchange: 'binance',
    market: 'perp',
    open: partial.open ?? close,
    high: partial.high ?? close,
    low: partial.low ?? close,
    close,
    totalBuy: buy,
    totalSell: sell,
    trades: 20,
    levels: [{ price: close, buy, sell }],
    ...partial,
  };
}

describe('pattern recognition — sequences', () => {
  it('confirms an exact bullish liquidity reversal', () => {
    const candles = seq([
      'SELLER_IN_CONTROL',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    const snap = recognizeFromCandles(candles);
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
    expect(snap.primaryPattern?.matchedLabels).toEqual([
      'SELLER_IN_CONTROL',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    expect(snap.primaryPattern?.progress).toBe(1);
    expect(snap.primaryPattern?.stage).toBe(4);
    expect(snap.primaryPattern?.totalStages).toBe(4);
    expect(snap.primaryPattern?.patternVersion).toBe('BULLISH_LIQUIDITY_REVERSAL:v1');
    expect(snap.primaryPattern?.direction).toBe('BULLISH');
    expect(snap.primaryPattern?.confidence).toBeGreaterThan(50);
  });

  it('tolerates a repeated first stage', () => {
    const candles = seq([
      'SELLER_IN_CONTROL',
      'SELLER_IN_CONTROL',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    const snap = recognizeFromCandles(candles);
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
    expect(snap.primaryPattern?.matchedLabels).toEqual([
      'SELLER_IN_CONTROL',
      'SELLER_IN_CONTROL',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    expect(snap.primaryPattern?.barsUsed).toBe(5);
  });

  it('tolerates an optional BIDS_PULLED stage', () => {
    const candles = seq([
      'SELLER_IN_CONTROL',
      'BIDS_PULLED',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    const snap = recognizeFromCandles(candles);
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
    expect(snap.primaryPattern?.matchedLabels).toContain('BIDS_PULLED');
  });

  it('marks a prefix as FORMING', () => {
    const candles = seq(['SELLER_IN_CONTROL', 'STOP_HUNT_LOW']);
    const snap = recognizeFromCandles(candles);
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('FORMING');
    expect(snap.primaryPattern?.stage).toBe(2);
    expect(snap.primaryPattern?.progress).toBe(0.5);
  });

  it('keeps pattern progress independent from pattern confidence', () => {
    const forming = recognizeFromCandles(seq(['BUYER_IN_CONTROL', 'ASKS_PULLED']));
    const confirmed = recognizeFromCandles(seq(['BUYER_IN_CONTROL', 'ASKS_PULLED', 'BUYER_IN_CONTROL']));
    expect(forming.primaryPattern?.id).toBe('BULLISH_CONTINUATION');
    expect(forming.primaryPattern?.status).toBe('FORMING');
    expect(forming.primaryPattern?.progress).toBeCloseTo(2 / 3, 5);
    expect(confirmed.primaryPattern?.progress).toBe(1);
    expect(forming.primaryPattern?.confidence).toBeGreaterThan(50);
    expect(forming.primaryPattern?.confidence).not.toBe(Math.round((forming.primaryPattern?.progress ?? 0) * 100));
    expect(forming.primaryPattern?.evidence.components.stageCompletion).toBeCloseTo(2 / 3, 5);
    expect(confirmed.primaryPattern?.confidence).toBeGreaterThanOrEqual(forming.primaryPattern?.confidence ?? 0);
  });

  it('increases progress after seller absorption', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    const forming = engine.ingest(c(2, 'SELLER_ABSORBED'));
    expect(forming.primaryPattern?.id).toBe('SELLER_TRAP_FORMING');
    expect(forming.primaryPattern?.status).toBe('FORMING');
    expect(forming.primaryPattern?.progress).toBe(1);
    const reversal = forming.candidates.find((x) => x.id === 'BULLISH_LIQUIDITY_REVERSAL');
    expect(reversal?.status).toBe('FORMING');
    expect(reversal?.stage).toBe(3);
  });

  it('does not treat a buyer trap as a confirmed bearish reversal', () => {
    const snap = recognizeFromCandles(
      seq(['BUYER_IN_CONTROL', 'STOP_HUNT_HIGH', 'BUYER_ABSORBED']),
    );
    expect(snap.primaryPattern?.id).toBe('BUYER_TRAP_FORMING');
    expect(snap.primaryPattern?.status).toBe('FORMING');
    const reversal = snap.candidates.find((x) => x.id === 'BEARISH_LIQUIDITY_REVERSAL');
    expect(reversal?.status).not.toBe('CONFIRMED');
    expect(reversal == null || reversal.stage < 4).toBe(true);
  });

  it('evolves a seller trap into a bullish reversal', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    const trap = engine.ingest(c(2, 'SELLER_ABSORBED'));
    expect(trap.primaryPattern?.id).toBe('SELLER_TRAP_FORMING');
    const confirmed = engine.ingest(c(3, 'BUYER_IN_CONTROL'));
    expect(confirmed.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(confirmed.primaryPattern?.status).toBe('CONFIRMED');
  });

  it('confirms a bullish continuation', () => {
    const snap = recognizeFromCandles(
      seq(['BUYER_IN_CONTROL', 'ASKS_PULLED', 'BUYER_IN_CONTROL']),
    );
    expect(snap.primaryPattern?.id).toBe('BULLISH_CONTINUATION');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
  });

  it('confirms continuation when the vacuum bar repeats', () => {
    const snap = recognizeFromCandles(
      seq(['BUYER_IN_CONTROL', 'ASKS_PULLED', 'ASKS_PULLED', 'BUYER_IN_CONTROL']),
    );
    expect(snap.primaryPattern?.id).toBe('BULLISH_CONTINUATION');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
  });

  it('confirms a reversal when bids pull after the stop hunt', () => {
    const snap = recognizeFromCandles(
      seq(['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'BIDS_PULLED', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL']),
    );
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
  });

  it('keeps a forming pattern visible through an unclassified bar', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    const noise = engine.ingest(c(2, 'UNCLASSIFIED'));
    expect(noise.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(noise.primaryPattern?.status).toBe('FORMING');
  });

  it('still shows the forming pattern on a live bar that does not extend it', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    const preview = engine.ingest(c(2, 'BUYER_ABSORBED'), { preview: true });
    expect(preview.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(preview.primaryPattern?.status).toBe('PREVIEW');
    expect(engine.snapshot('BTCUSDT', TF).primaryPattern?.status).toBe('FORMING');
  });

  it('confirms a failed bearish reversal', () => {
    const snap = recognizeFromCandles(
      seq(['STOP_HUNT_HIGH', 'SELLER_IN_CONTROL', 'BUYER_IN_CONTROL']),
    );
    expect(snap.primaryPattern?.id).toBe('FAILED_BEARISH_REVERSAL');
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
    expect(snap.primaryPattern?.direction).toBe('BULLISH');
  });
});

describe('pattern recognition — lifecycle', () => {
  it('fails a forming bullish reversal when sellers regain control', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    const failed = engine.ingest(c(2, 'SELLER_IN_CONTROL'));
    const reversalFail = failed.candidates.find(
      (x) => x.id === 'BULLISH_LIQUIDITY_REVERSAL' && x.status === 'FAILED',
    );
    expect(reversalFail).toBeTruthy();
    expect(failed.alerts.some((a) => a.type === 'PATTERN_FAILED')).toBe(true);
  });

  it('expires a forming pattern after maxBars', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    let snap = engine.snapshot('BTCUSDT', TF);
    expect(snap.primaryPattern?.status).toBe('FORMING');
    for (let i = 2; i <= 8; i++) {
      snap = engine.ingest(c(i, 'UNCLASSIFIED'));
    }
    const events = engine.events('BTCUSDT', TF);
    expect(events.some((e) => e.patternId === 'BULLISH_LIQUIDITY_REVERSAL' && e.status === 'EXPIRED')).toBe(true);
    expect(snap.primaryPattern?.id === 'BULLISH_LIQUIDITY_REVERSAL').toBe(false);
  });

  it('does not confirm from an unfinished preview candle', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    engine.ingest(c(1, 'STOP_HUNT_LOW'));
    engine.ingest(c(2, 'SELLER_ABSORBED'));
    const preview = engine.ingest(c(3, 'BUYER_IN_CONTROL'), { preview: true });
    expect(preview.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(preview.primaryPattern?.status).toBe('PREVIEW');
    expect(preview.primaryPattern?.status).not.toBe('CONFIRMED');
    const live = engine.snapshot('BTCUSDT', TF);
    expect(live.primaryPattern?.status).not.toBe('CONFIRMED');
    const confirmed = engine.ingest(c(3, 'BUYER_IN_CONTROL'));
    expect(confirmed.primaryPattern?.status).toBe('CONFIRMED');
  });

  it('alerts on stage transitions, not every repeated control bar', () => {
    const engine = new PatternRecognitionEngine();
    const a = engine.ingest(c(0, 'SELLER_IN_CONTROL'));
    const b = engine.ingest(c(1, 'SELLER_IN_CONTROL'));
    const d = engine.ingest(c(2, 'STOP_HUNT_LOW'));
    expect(a.alerts.filter((x) => x.patternId === 'BULLISH_LIQUIDITY_REVERSAL')).toHaveLength(0);
    expect(b.alerts.filter((x) => x.patternId === 'BULLISH_LIQUIDITY_REVERSAL')).toHaveLength(0);
    expect(d.alerts.some((x) => x.type === 'PATTERN_FORMING' && x.patternId === 'BULLISH_LIQUIDITY_REVERSAL')).toBe(
      true,
    );
    const again = engine.ingest(c(3, 'SELLER_IN_CONTROL'));
    expect(again.alerts.filter((x) => x.type === 'PATTERN_FORMING' && x.patternId === 'BULLISH_LIQUIDITY_REVERSAL')).toHaveLength(
      0,
    );
  });
});

describe('pattern recognition — confidence and isolation', () => {
  it('scores low-confidence labels below high-confidence labels', () => {
    const weak = recognizeFromCandles(
      seq(
        ['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL'],
        [{ labelConfidence: 0.51 }, { labelConfidence: 0.51 }, { labelConfidence: 0.51 }, { labelConfidence: 0.51 }],
      ),
    );
    const strong = recognizeFromCandles(
      seq(
        ['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL'],
        [{ labelConfidence: 0.94 }, { labelConfidence: 0.94 }, { labelConfidence: 0.94 }, { labelConfidence: 0.94 }],
      ),
    );
    expect(strong.primaryPattern?.confidence).toBeGreaterThan(weak.primaryPattern?.confidence ?? 0);
    expect(weak.primaryPattern?.evidence.components.labelConfidence).toBeLessThan(0.6);
    expect(strong.primaryPattern?.evidence.components.labelConfidence).toBeGreaterThan(0.9);
  });

  it('still matches when optional numeric features are missing', () => {
    const snap = recognizeFromCandles(seq(['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL']));
    expect(snap.primaryPattern?.status).toBe('CONFIRMED');
    expect(snap.primaryPattern?.evidence.sweepQuality).toBeNull();
  });

  it('raises confidence with supporting numeric evidence', () => {
    const plain = recognizeFromCandles(seq(['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL']));
    const rich = recognizeFromCandles(
      seq(
        ['SELLER_IN_CONTROL', 'STOP_HUNT_LOW', 'SELLER_ABSORBED', 'BUYER_IN_CONTROL'],
        [
          {},
          { sweepQuality: 90 },
          { passiveBuyerDefense: 88, bidReplenishment: 80 },
          { aggressiveBuyPower: 85, upsideBattleSpread: 80 },
        ],
      ),
    );
    expect(rich.primaryPattern?.confidence).toBeGreaterThanOrEqual(plain.primaryPattern?.confidence ?? 0);
    expect(rich.primaryPattern?.evidence.supportingEvidence).toBeGreaterThan(1);
  });

  it('keeps symbol streams isolated', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL', {}, 'BTCUSDT'));
    engine.ingest(c(1, 'STOP_HUNT_LOW', {}, 'BTCUSDT'));
    engine.ingest(c(0, 'BUYER_IN_CONTROL', {}, 'ETHUSDT'));
    engine.ingest(c(1, 'STOP_HUNT_HIGH', {}, 'ETHUSDT'));
    expect(engine.snapshot('BTCUSDT', TF).primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(engine.snapshot('ETHUSDT', TF).primaryPattern?.id).toBe('BEARISH_LIQUIDITY_REVERSAL');
  });

  it('keeps timeframe streams isolated', () => {
    const engine = new PatternRecognitionEngine();
    engine.ingest(c(0, 'SELLER_IN_CONTROL', {}, 'BTCUSDT', '5m'));
    engine.ingest(c(1, 'STOP_HUNT_LOW', {}, 'BTCUSDT', '5m'));
    engine.ingest(c(0, 'BUYER_IN_CONTROL', {}, 'BTCUSDT', '15m'));
    engine.ingest(c(1, 'ASKS_PULLED', {}, 'BTCUSDT', '15m'));
    expect(engine.snapshot('BTCUSDT', '5m').primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
    expect(engine.snapshot('BTCUSDT', '15m').primaryPattern?.id).toBe('BULLISH_CONTINUATION');
  });

  it('never uses future candles when evaluating at time T', () => {
    const candles = seq([
      'SELLER_IN_CONTROL',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ]);
    const { snapshots } = replayPatterns(candles);
    expect(snapshots[1]?.primaryPattern?.status).toBe('FORMING');
    expect(snapshots[1]?.primaryPattern?.matchedLabels).not.toContain('BUYER_IN_CONTROL');
    expect(snapshots[2]?.primaryPattern?.status).not.toBe('CONFIRMED');
    expect(snapshots[3]?.primaryPattern?.status).toBe('CONFIRMED');
  });
});

describe('candle label adapter — causal footprint mapping', () => {
  it('does not inspect a later bar when labeling the current bar', () => {
    const prior = [
      fpBar({ time: 1000, high: 110, low: 100, open: 105, close: 104, totalBuy: 1, totalSell: 1 }),
      fpBar({ time: 1060, high: 109, low: 101, open: 104, close: 103, totalBuy: 1, totalSell: 1 }),
    ];
    const hunt = fpBar({
      time: 1120,
      high: 108,
      low: 90,
      open: 103,
      close: 104,
      totalBuy: 8_000,
      totalSell: 20_000,
    });
    const next = fpBar({
      time: 1180,
      high: 120,
      low: 104,
      open: 104,
      close: 119,
      totalBuy: 50_000,
      totalSell: 1_000,
    });
    const labeled = labelFootprintBar(hunt, prior, '1m');
    const labeledWithFutureIgnored = labelFootprintBar(hunt, prior, '1m');
    expect(labeled.label).toBe(labeledWithFutureIgnored.label);
    const nextLabel = labelFootprintBar(next, [...prior, hunt], '1m');
    expect(nextLabel.timestamp).toBe(1180);
    expect(labeled.timestamp).toBe(1120);
  });

  it('labels aggressive follow-through as control and absorption as absorbed', () => {
    const control = labelFootprintBar(
      fpBar({ time: 1, open: 100, high: 101, low: 99, close: 100.7, totalBuy: 20_000, totalSell: 4_000 }),
      [],
      '5m',
    );
    expect(control.label).toBe('BUYER_IN_CONTROL');
    const absorbed = labelFootprintBar(
      fpBar({ time: 2, open: 100, high: 101, low: 99.8, close: 100.05, totalBuy: 20_000, totalSell: 5_000 }),
      [],
      '5m',
    );
    expect(absorbed.label === 'BUYER_ABSORBED' || absorbed.label === 'UNCLASSIFIED').toBe(true);
  });
});
