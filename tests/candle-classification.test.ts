import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import {
  auditLabelDistribution,
  candleMatchesStage,
  classifyBarLegacy,
  classifyCandleStructure,
  labelFootprintBar,
  labeledCandle,
  pickDominantLiquidityEvent,
  recognizeFromCandles,
  stateFromScore,
} from '../src/pattern-recognition/index.js';
import type { FootprintBar } from '../src/footprint/types.js';
import type { ClassificationInputMetrics } from '../src/pattern-recognition/candle-classification.js';

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

const extremeMetrics = (over: Partial<ClassificationInputMetrics> = {}): ClassificationInputMetrics => ({
  bidConsumption: null,
  askConsumption: null,
  bidWithdrawal: null,
  askWithdrawal: null,
  bidReplenishment: null,
  askReplenishment: null,
  bidSurvival: null,
  askSurvival: null,
  dataQualityScore: 80,
  ...over,
});

describe('structured candle classification', () => {
  it('separates consumption from pulling', () => {
    const bar = fpBar({
      time: 1,
      open: 100,
      high: 101,
      low: 99,
      close: 99.2,
      totalBuy: 4_000,
      totalSell: 20_000,
    });
    const c = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        bidConsumption: 92,
        bidWithdrawal: 30,
        askConsumption: 20,
        askWithdrawal: 15,
        bidConsumptionPercentile: 94,
        bidWithdrawalPercentile: 40,
        rawBidConsumed: 1_200_000,
        rawBidCancelled: 80_000,
      }),
    });
    expect(c.liquidityBehavior.bidConsumption.state).toBe('EXTREME');
    expect(c.liquidityBehavior.bidPulling.state).not.toBe('EXTREME');
    expect(c.liquidityBehavior.dominantEvent).toBe('BIDS_CONSUMED');
    expect(c.primaryState.control).toBe('SELLER_IN_CONTROL');
    expect(c.outcome.type).toBe('PRICE_FOLLOWED');
    expect(c.outcome.direction).toBe('DOWN');
    expect(c.liquidityBehavior.bidConsumption.rawValue).toBe(1_200_000);
  });

  it('tracks replenishment and survival independently', () => {
    const bar = fpBar({ time: 2, open: 100, high: 100.5, low: 99.5, close: 100.1, totalBuy: 8_000, totalSell: 7_500 });
    const c = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        bidReplenishment: 92,
        bidSurvival: 70,
        askReplenishment: 20,
        askSurvival: 25,
        bidConsumption: 40,
        askConsumption: 35,
        bidWithdrawal: 15,
        askWithdrawal: 18,
        bidReplenishmentPercentile: 94,
      }),
    });
    expect(c.liquidityBehavior.bidReplenishment.state).toBe('EXTREME');
    expect(c.liquidityBehavior.bidSurvival.state).toBe('STRONG');
    expect(c.liquidityBehavior.dominantEvent).toBe('BIDS_REPLENISHED');
  });

  it('does not force a dominant liquidity event on background activity', () => {
    const bar = fpBar({ time: 3, open: 100, high: 100.4, low: 99.7, close: 100.1, totalBuy: 5_000, totalSell: 4_800 });
    const c = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        bidConsumption: 42,
        askConsumption: 38,
        bidWithdrawal: 35,
        askWithdrawal: 33,
        bidReplenishment: 40,
        askReplenishment: 36,
        bidSurvival: 44,
        askSurvival: 41,
      }),
    });
    expect(c.liquidityBehavior.dominantEvent).toBe('NONE');
  });

  it('does not promote normal background consumption or pulling', () => {
    expect(
      pickDominantLiquidityEvent([
        { event: 'BIDS_CONSUMED', score: 48, percentile: 43 },
        { event: 'ASKS_PULLED', score: 40, percentile: 38 },
        { event: 'BIDS_PULLED', score: 35, percentile: 30 },
      ]),
    ).toBe('NONE');

    expect(
      pickDominantLiquidityEvent([
        { event: 'ASKS_CONSUMED', score: 55, percentile: 52 },
        { event: 'BIDS_PULLED', score: 50, percentile: 48 },
      ]),
    ).toBe('NONE');
  });

  it('promotes extreme consumption when dominant and significant', () => {
    expect(
      pickDominantLiquidityEvent([
        { event: 'BIDS_CONSUMED', score: 91, percentile: 94 },
        { event: 'BIDS_PULLED', score: 60, percentile: 55 },
        { event: 'ASKS_CONSUMED', score: 30, percentile: 40 },
      ]),
    ).toBe('BIDS_CONSUMED');
  });

  it('promotes extreme pulling when dominant and significant', () => {
    expect(
      pickDominantLiquidityEvent([
        { event: 'ASKS_PULLED', score: 88, percentile: 90 },
        { event: 'ASKS_CONSUMED', score: 50, percentile: 45 },
        { event: 'BIDS_PULLED', score: 20, percentile: 22 },
      ]),
    ).toBe('ASKS_PULLED');
  });

  it('allows simultaneous control + liquidity event', () => {
    const bar = fpBar({
      time: 4,
      open: 100,
      high: 101.2,
      low: 99.8,
      close: 101,
      totalBuy: 25_000,
      totalSell: 5_000,
    });
    const c = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        askWithdrawal: 90,
        askConsumption: 40,
        bidWithdrawal: 20,
        bidConsumption: 25,
        askWithdrawalPercentile: 93,
      }),
    });
    expect(c.primaryState.control).toBe('BUYER_IN_CONTROL');
    expect(c.liquidityBehavior.dominantEvent).toBe('ASKS_PULLED');
    // Display prefers strong control over liquidity.
    expect(c.primaryDisplayLabel).toBe('BUYER_IN_CONTROL');
  });

  it('allows simultaneous special event + control and prioritizes special for display', () => {
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
    const c = classifyCandleStructure(hunt, { prior });
    expect(c.specialEvent.type).toBe('STOP_HUNT_LOW');
    expect(c.primaryDisplayLabel).toBe('STOP_HUNT_LOW');
    expect(c.outcome.type === 'REVERSAL' || c.outcome.type === 'PENDING').toBe(true);
  });

  it('headline priority: special > control > extreme liquidity', () => {
    const bar = fpBar({
      time: 5,
      open: 100,
      high: 100.2,
      low: 99.9,
      close: 100.05,
      totalBuy: 22_000,
      totalSell: 5_000,
    });
    const absorbed = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        askConsumption: 95,
        bidConsumption: 20,
        askWithdrawal: 10,
        bidWithdrawal: 10,
        askConsumptionPercentile: 96,
      }),
    });
    // Passive stall → absorption special wins over ask consumption liquidity.
    expect(absorbed.specialEvent.type).toBe('BUYER_ABSORBED');
    expect(absorbed.primaryDisplayLabel).toBe('BUYER_ABSORBED');
  });

  it('does not look ahead when classifying', () => {
    const prior = [
      fpBar({ time: 1000, high: 110, low: 100, open: 105, close: 104, totalBuy: 1, totalSell: 1 }),
    ];
    const bar = fpBar({ time: 1060, open: 104, high: 105, low: 103, close: 104.5, totalBuy: 12_000, totalSell: 4_000 });
    const a = classifyCandleStructure(bar, { prior });
    const b = classifyCandleStructure(bar, { prior });
    expect(a.primaryDisplayLabel).toBe(b.primaryDisplayLabel);
    expect(a.outcome.type).not.toBeUndefined();
  });

  it('marks missing liquidity metrics as NO_DATA rather than zero', () => {
    const bar = fpBar({ time: 6, open: 100, high: 100.5, low: 99.5, close: 100.2, totalBuy: 5_000, totalSell: 4_000 });
    const c = classifyCandleStructure(bar, { metrics: null });
    expect(c.liquidityBehavior.bidConsumption.state).toBe('NO_DATA');
    expect(c.liquidityBehavior.bidConsumption.score).toBeNull();
    expect(c.liquidityBehavior.dataQuality).toBe('NO_DATA');
  });

  it('refuses strong liquidity inference on stale / low-confidence book data', () => {
    const bar = fpBar({ time: 7, open: 100, high: 101, low: 99, close: 99.2, totalBuy: 3_000, totalSell: 18_000 });
    const c = classifyCandleStructure(bar, {
      metrics: extremeMetrics({
        bidConsumption: 95,
        askConsumption: 10,
        bidWithdrawal: 20,
        askWithdrawal: 15,
        dataQualityScore: 20,
        dataStale: true,
      }),
    });
    expect(c.liquidityBehavior.dataQuality === 'STALE_DATA' || c.liquidityBehavior.dataQuality === 'LOW_CONFIDENCE').toBe(
      true,
    );
    expect(c.liquidityBehavior.dominantEvent).toBe('NONE');
  });

  it('keeps backward-compatible display label on LabeledCandle.label', () => {
    const labeled = labelFootprintBar(
      fpBar({ time: 8, open: 100, high: 101, low: 99, close: 100.8, totalBuy: 20_000, totalSell: 4_000 }),
      [],
      '5m',
    );
    expect(labeled.label).toBe(labeled.classification.primaryDisplayLabel);
    expect(labeled.classification.primaryState.control).toBe('BUYER_IN_CONTROL');
  });

  it('maps state buckets from configurable thresholds', () => {
    const cfg = DEFAULT_CONFIG.candleClassification;
    expect(stateFromScore(10, cfg)).toBe('LOW');
    expect(stateFromScore(40, cfg)).toBe('NORMAL');
    expect(stateFromScore(60, cfg)).toBe('ELEVATED');
    expect(stateFromScore(80, cfg)).toBe('STRONG');
    expect(stateFromScore(90, cfg)).toBe('EXTREME');
    expect(stateFromScore(null, cfg)).toBe('NO_DATA');
  });

  it('pattern engine reads structured dimensions', () => {
    const candles = [
      labeledCandle({
        timestamp: 1,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        label: 'SELLER_IN_CONTROL',
      }),
      labeledCandle({
        timestamp: 2,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        label: 'BIDS_PULLED',
      }),
      labeledCandle({
        timestamp: 3,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        label: 'STOP_HUNT_LOW',
      }),
      labeledCandle({
        timestamp: 4,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        label: 'SELLER_ABSORBED',
      }),
      labeledCandle({
        timestamp: 5,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        label: 'BUYER_IN_CONTROL',
      }),
    ];
    expect(
      candleMatchesStage(candles[0]!, { control: ['SELLER_IN_CONTROL'] }),
    ).toBe(true);
    expect(
      candleMatchesStage(candles[1]!, { liquidity: ['BIDS_PULLED'] }),
    ).toBe(true);
    expect(
      candleMatchesStage(candles[2]!, { specialEvent: ['STOP_HUNT_LOW'] }),
    ).toBe(true);

    const snap = recognizeFromCandles(candles);
    expect(snap.primaryPattern?.id).toBe('BULLISH_LIQUIDITY_REVERSAL');
  });

  it('audit report compares legacy vs structured distributions', () => {
    const bars = [
      fpBar({ time: 1, open: 100, high: 103, low: 99.5, close: 102.8, totalBuy: 30_000, totalSell: 5_000 }),
      fpBar({ time: 2, open: 102.8, high: 104, low: 102, close: 103.8, totalBuy: 28_000, totalSell: 6_000 }),
      fpBar({ time: 3, open: 103.8, high: 104.2, low: 103, close: 103.2, totalBuy: 10_000, totalSell: 12_000 }),
      fpBar({ time: 4, open: 103.2, high: 103.5, low: 100, close: 100.5, totalBuy: 4_000, totalSell: 25_000 }),
      fpBar({ time: 5, open: 100.5, high: 101, low: 99, close: 100.8, totalBuy: 18_000, totalSell: 8_000 }),
    ];
    const report = auditLabelDistribution(bars);
    expect(report.legacy.total).toBe(5);
    expect(report.structured.total).toBe(5);
    expect(Object.keys(report.legacy.byPercent).length).toBeGreaterThan(0);
    expect(Object.keys(report.structured.control).length).toBeGreaterThan(0);
    // Legacy often promotes vacuum pulls; structured gates them.
    const legacyPulled =
      (report.legacy.byPercent['ASKS_PULLED'] ?? 0) + (report.legacy.byPercent['BIDS_PULLED'] ?? 0);
    const structuredPulled =
      (report.structured.liquidityEvent['ASKS_PULLED'] ?? 0) +
      (report.structured.liquidityEvent['BIDS_PULLED'] ?? 0);
    expect(structuredPulled).toBeLessThanOrEqual(legacyPulled);
    for (const bar of bars) {
      const legacy = classifyBarLegacy(bar, []);
      expect(typeof legacy).toBe('string');
    }
  });
});
