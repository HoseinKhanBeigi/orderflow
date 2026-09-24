import { describe, expect, it } from 'vitest';
import {
  CANDLE_LABELS,
  NextFootprintStatePredictor,
  PredictionEvaluation,
  recognizeFromCandles,
} from '../src/pattern-recognition/index.js';
import { labeledCandle } from '../src/pattern-recognition/candle-label-adapter.js';
import type { CandleLabel, LabeledCandle } from '../src/pattern-recognition/index.js';

const TF = '15m';

function candle(i: number, label: CandleLabel, symbol = 'BTCUSDT', timeframe = TF): LabeledCandle {
  return labeledCandle({
    timestamp: 1_700_000_000 + i * 900,
    symbol,
    timeframe,
    label,
    labelConfidence: 0.8,
  });
}

function predictor(minSamples = 20) {
  return new NextFootprintStatePredictor({
    minimumSampleCount: minSamples,
    minimumTopProbability: 0.6,
    minimumPredictionMargin: 0.15,
  });
}

function fill(
  p: NextFootprintStatePredictor,
  context: CandleLabel[],
  next: CandleLabel,
  n: number,
  symbol = 'BTCUSDT',
  timeframe = TF,
): void {
  for (let i = 0; i < n; i++) {
    p.table.observe(symbol, timeframe, context, next);
  }
}

function distSum(dist: Record<string, number>): number {
  return Object.values(dist).reduce((s, v) => s + v, 0);
}

describe('next-state predictor — frequencies', () => {
  it('computes P(next | sequence) from historical counts', () => {
    const p = predictor(10);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'BUYER_IN_CONTROL', 64);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'ASKS_PULLED', 17);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'SELLER_IN_CONTROL', 11);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'STOP_HUNT_HIGH', 5);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'UNCLASSIFIED', 3);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL', 'ASKS_PULLED'],
      remember: false,
    });
    expect(pred.status).toBe('PREDICTED');
    expect(pred.prediction).toBe('BUYER_IN_CONTROL');
    expect(pred.probability).toBeCloseTo(0.64, 2);
    expect(pred.secondPrediction).toBe('ASKS_PULLED');
    expect(pred.secondProbability).toBeCloseTo(0.17, 2);
    expect(pred.margin).toBeCloseTo(0.47, 2);
    expect(pred.sampleCount).toBe(100);
    expect(pred.sequenceDepth).toBe(2);
    expect(distSum(pred.distribution as Record<string, number>)).toBeCloseTo(1, 2);
  });

  it('sums probabilities to ~1', () => {
    const p = predictor(5);
    for (const label of CANDLE_LABELS) {
      fill(p, ['SELLER_IN_CONTROL'], label, 8);
    }
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['SELLER_IN_CONTROL'],
      remember: false,
    });
    expect(distSum(pred.distribution as Record<string, number>)).toBeCloseTo(1, 2);
  });
});

describe('next-state predictor — backoff and samples', () => {
  it('prefers a shorter sequence when the longer n-gram lacks samples', () => {
    const p = predictor(50);
    const longCtx: CandleLabel[] = [
      'SELLER_IN_CONTROL',
      'BIDS_PULLED',
      'STOP_HUNT_LOW',
      'SELLER_ABSORBED',
      'BUYER_IN_CONTROL',
    ];
    fill(p, longCtx, 'BUYER_IN_CONTROL', 12);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'BUYER_IN_CONTROL', 80);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'SELLER_IN_CONTROL', 10);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL', 'ASKS_PULLED'],
      remember: false,
    });
    expect(pred.sequenceDepth).toBe(2);
    expect(pred.sampleCount).toBe(90);
    expect(pred.prediction).toBe('BUYER_IN_CONTROL');
  });

  it('walks 5 → 1 until minimumSampleCount is met', () => {
    const p = predictor(100);
    fill(p, ['ASKS_PULLED'], 'BUYER_IN_CONTROL', 40);
    fill(p, ['BUYER_IN_CONTROL', 'ASKS_PULLED'], 'BUYER_IN_CONTROL', 30);
    fill(p, ['ASKS_PULLED'], 'SELLER_IN_CONTROL', 80);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL', 'ASKS_PULLED'],
      remember: false,
    });
    expect(pred.sequenceDepth).toBe(1);
    expect(pred.sampleCount).toBe(150);
    expect(pred.prediction).toBe('SELLER_IN_CONTROL');
  });

  it('does not emit PREDICTED below minimumSampleCount', () => {
    const p = new NextFootprintStatePredictor({ minimumSampleCount: 100, minimumTopProbability: 0.5, minimumPredictionMargin: 0.05 });
    fill(p, ['ASKS_PULLED'], 'BUYER_IN_CONTROL', 40);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
      remember: false,
    });
    expect(pred.sampleCount).toBe(40);
    expect(pred.status).toBe('NO_CLEAR_PREDICTION');
    expect(pred.prediction).toBe('BUYER_IN_CONTROL');
  });
});

describe('next-state predictor — margin and no-clear', () => {
  it('returns NO_CLEAR_PREDICTION when the top two labels are too close', () => {
    const p = predictor(50);
    fill(p, ['BUYER_IN_CONTROL'], 'ASKS_PULLED', 34);
    fill(p, ['BUYER_IN_CONTROL'], 'SELLER_IN_CONTROL', 31);
    fill(p, ['BUYER_IN_CONTROL'], 'BUYER_ABSORBED', 20);
    fill(p, ['BUYER_IN_CONTROL'], 'BIDS_PULLED', 15);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL'],
      remember: false,
    });
    expect(pred.status).toBe('NO_CLEAR_PREDICTION');
    expect(pred.prediction).toBe('ASKS_PULLED');
    expect(pred.probability).toBeCloseTo(0.34, 2);
    expect(pred.margin).toBeCloseTo(0.03, 2);
    expect(pred.confidence).toBe('LOW');
  });

  it('exposes prediction margin as top minus second', () => {
    const p = predictor(10);
    fill(p, ['BIDS_PULLED'], 'SELLER_IN_CONTROL', 70);
    fill(p, ['BIDS_PULLED'], 'BUYER_IN_CONTROL', 30);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BIDS_PULLED'],
      remember: false,
    });
    expect(pred.margin).toBeCloseTo(0.4, 5);
  });
});

describe('next-state predictor — isolation, lookahead, unknown', () => {
  it('keeps symbol streams isolated', () => {
    const p = predictor(10);
    fill(p, ['ASKS_PULLED'], 'BUYER_IN_CONTROL', 40, 'BTCUSDT');
    fill(p, ['ASKS_PULLED'], 'SELLER_IN_CONTROL', 40, 'ETHUSDT');
    const btc = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
      remember: false,
    });
    const eth = p.predict({
      symbol: 'ETHUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
      remember: false,
    });
    expect(btc.prediction).toBe('BUYER_IN_CONTROL');
    expect(eth.prediction).toBe('SELLER_IN_CONTROL');
  });

  it('keeps timeframe streams isolated', () => {
    const p = predictor(10);
    fill(p, ['ASKS_PULLED'], 'BUYER_IN_CONTROL', 40, 'BTCUSDT', '5m');
    fill(p, ['ASKS_PULLED'], 'SELLER_IN_CONTROL', 40, 'BTCUSDT', '15m');
    expect(
      p.predict({ symbol: 'BTCUSDT', timeframe: '5m', contextLabels: ['ASKS_PULLED'], remember: false }).prediction,
    ).toBe('BUYER_IN_CONTROL');
    expect(
      p.predict({ symbol: 'BTCUSDT', timeframe: '15m', contextLabels: ['ASKS_PULLED'], remember: false }).prediction,
    ).toBe('SELLER_IN_CONTROL');
  });

  it('does not use a future label when predicting at time T', () => {
    const p = predictor(1);
    p.trainFromCandles([
      candle(0, 'BUYER_IN_CONTROL'),
      candle(1, 'ASKS_PULLED'),
    ]);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL', 'ASKS_PULLED'],
      remember: false,
    });
    expect(pred.distribution.SELLER_IN_CONTROL ?? 0).toBe(0);
    expect(Object.keys(pred.distribution)).not.toContain('STOP_HUNT_HIGH');
    p.trainFromCandles([
      candle(0, 'BUYER_IN_CONTROL'),
      candle(1, 'ASKS_PULLED'),
      candle(2, 'SELLER_IN_CONTROL'),
    ]);
    const after = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL', 'ASKS_PULLED'],
      remember: false,
    });
    expect(after.prediction).toBe('SELLER_IN_CONTROL');
  });

  it('maps unknown labels to UNCLASSIFIED', () => {
    const p = predictor(1);
    p.table.observe('BTCUSDT', TF, ['BUYER_IN_CONTROL'], 'NOT_A_LABEL');
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['BUYER_IN_CONTROL'],
      remember: false,
    });
    expect(pred.prediction).toBe('UNCLASSIFIED');
    expect(pred.sampleCount).toBe(1);
  });

  it('returns empty NO_CLEAR_PREDICTION when history is missing', () => {
    const p = predictor(10);
    const pred = p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
      remember: false,
    });
    expect(pred.status).toBe('NO_CLEAR_PREDICTION');
    expect(pred.sampleCount).toBe(0);
    expect(pred.prediction).toBeNull();
    expect(pred.confidence).toBe('LOW');
  });
});

describe('next-state predictor — calibration', () => {
  it('collects calibration buckets and top-1 accuracy after outcomes arrive', () => {
    const p = predictor(10);
    fill(p, ['ASKS_PULLED'], 'BUYER_IN_CONTROL', 80);
    fill(p, ['ASKS_PULLED'], 'SELLER_IN_CONTROL', 20);
    p.predict({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
    });
    p.observeCompleted({
      symbol: 'BTCUSDT',
      timeframe: TF,
      contextLabels: ['ASKS_PULLED'],
      nextLabel: 'BUYER_IN_CONTROL',
    });
    const snap = p.evaluation.snapshot();
    expect(snap.total).toBe(1);
    expect(snap.top1Hits).toBe(1);
    expect(snap.top1Accuracy).toBe(1);
    expect(snap.calibration.some((b) => b.lo === 0.8 && b.predictions === 1 && b.hits === 1)).toBe(true);
  });

  it('PredictionEvaluation starts empty', () => {
    const evaler = new PredictionEvaluation();
    const snap = evaler.snapshot();
    expect(snap.total).toBe(0);
    expect(snap.top1Accuracy).toBeNull();
  });
});

describe('replay still exposes forming patterns separately from next-state', () => {
  it('does not treat pattern confidence as a next-label probability', () => {
    const snap = recognizeFromCandles([
      candle(0, 'BUYER_IN_CONTROL'),
      candle(1, 'ASKS_PULLED'),
    ]);
    expect(snap.primaryPattern?.id).toBe('BULLISH_CONTINUATION');
    expect(snap.primaryPattern?.status).toBe('FORMING');
    expect(snap.nextState).toBeNull();
    expect(snap.primaryPattern?.confidence).not.toBe(64);
  });
});
