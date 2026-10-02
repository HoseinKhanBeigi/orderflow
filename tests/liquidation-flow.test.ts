import { describe, expect, it } from 'vitest';
import {
  evaluateLiquidationFlow,
  splitOrganicForced,
  classifyForcedRatio,
  detectCascade,
  detectExhaustion,
  fromExchangeLiquidation,
  mergeLiquidationFlowConfig,
  mapFeedToQuality,
} from '../src/liquidation-flow/index.js';

const cfg = mergeLiquidationFlowConfig({});

describe('direction mapping', () => {
  it('short liquidation → forced buy', () => {
    const e = fromExchangeLiquidation({
      timestamp: 1,
      symbol: 'BTCUSDT',
      type: 'SHORT_LIQUIDATION',
      price: 100,
      quantity: 2,
      quoteValue: 200,
    });
    expect(e.positionSide).toBe('SHORT');
    expect(e.forcedFlowSide).toBe('BUY');
    expect(e.classification).toBe('CONFIRMED');
  });

  it('long liquidation → forced sell', () => {
    const e = fromExchangeLiquidation({
      timestamp: 1,
      symbol: 'BTCUSDT',
      type: 'LONG_LIQUIDATION',
      price: 100,
      quantity: 2,
      quoteValue: 200,
    });
    expect(e.positionSide).toBe('LONG');
    expect(e.forcedFlowSide).toBe('SELL');
  });
});

describe('no double counting / reconciliation', () => {
  it('organic = total − forced subset', () => {
    const s = splitOrganicForced(8_400_000, 3_300_000, 'CONFIRMED', cfg);
    expect(s.organic).toBe(5_100_000);
    expect(s.forced).toBe(3_300_000);
    expect(s.forcedRatio).toBeCloseTo(0.3928, 3);
    expect(s.reconciliationOk).toBe(true);
  });

  it('does not invent organic when feed unavailable', () => {
    const s = splitOrganicForced(8_400_000, 0, 'UNAVAILABLE', cfg);
    expect(s.organic).toBeNull();
    expect(s.forced).toBeNull();
    expect(s.forcedRatio).toBeNull();
  });

  it('reconciliation error when forced >> total', () => {
    const s = splitOrganicForced(1_000_000, 2_000_000, 'CONFIRMED', cfg);
    expect(s.reconciliationOk).toBe(false);
    expect(s.forced).toBe(1_000_000); // clipped
  });
});

describe('forced ratio states', () => {
  it('classifies organic / mixed / heavy / dominant', () => {
    expect(classifyForcedRatio(0.1, cfg)).toBe('MOSTLY_ORGANIC');
    expect(classifyForcedRatio(0.39, cfg)).toBe('MIXED');
    expect(classifyForcedRatio(0.6, cfg)).toBe('LIQUIDATION_HEAVY');
    expect(classifyForcedRatio(0.8, cfg)).toBe('LIQUIDATION_DOMINANT');
    expect(classifyForcedRatio(null, cfg)).toBe('UNKNOWN');
  });
});

describe('evaluateLiquidationFlow', () => {
  it('confirmed mixed buy flow', () => {
    const snap = evaluateLiquidationFlow({
      timestamp: 1000,
      symbol: 'NEARUSDT',
      totalAggressiveBuy: 8_400_000,
      totalAggressiveSell: 7_200_000,
      shortLiquidationBuy: 3_300_000,
      longLiquidationSell: 2_000_000,
      feed: 'live',
      buyEffort: 84,
      sellEffort: 70,
    });
    expect(snap.dataQuality).toBe('CONFIRMED');
    expect(snap.buy.state).toBe('MIXED');
    expect(snap.buy.liquidationLabel).toBe('SHORT_LIQUIDATION_FLOW');
    expect(snap.sell.liquidationLabel).toBe('LONG_LIQUIDATION_FLOW');
    expect(snap.buy.organicFlowScore).toBeGreaterThan(0);
    expect(snap.buy.forcedFlowScore).toBeGreaterThan(0);
    expect(snap.reconciliationOk).toBe(true);
  });

  it('missing feed → unknown split', () => {
    const snap = evaluateLiquidationFlow({
      timestamp: 1,
      symbol: 'X',
      totalAggressiveBuy: 1e6,
      totalAggressiveSell: 1e6,
      shortLiquidationBuy: 0,
      longLiquidationSell: 0,
      feed: 'unavailable',
    });
    expect(snap.dataQuality).toBe('UNAVAILABLE');
    expect(snap.buy.state).toBe('UNKNOWN');
    expect(snap.buy.organicAggressive).toBeNull();
    expect(snap.alert).toBe('NONE');
  });

  it('estimated feed marked ESTIMATED', () => {
    expect(mapFeedToQuality('estimated')).toBe('ESTIMATED');
    const snap = evaluateLiquidationFlow({
      timestamp: 1,
      symbol: 'X',
      totalAggressiveBuy: 1e6,
      totalAggressiveSell: 1e6,
      shortLiquidationBuy: 0.6e6,
      longLiquidationSell: 0,
      feed: 'estimated',
      estimationConfidence: 40,
    });
    expect(snap.dataQuality).toBe('ESTIMATED');
    expect(snap.estimationConfidence).toBe(40);
  });

  it('forced buy absorption', () => {
    const snap = evaluateLiquidationFlow({
      timestamp: 1,
      symbol: 'X',
      totalAggressiveBuy: 10e6,
      totalAggressiveSell: 1e6,
      shortLiquidationBuy: 6e6,
      longLiquidationSell: 0,
      feed: 'live',
      buyEffort: 89,
      askDefense: 92,
      upResult: 18,
    });
    expect(snap.alert).toBe('SHORT_LIQUIDATION_BUY_FLOW_ABSORBED');
  });

  it('forced sell absorption at swing low', () => {
    const snap = evaluateLiquidationFlow({
      timestamp: 1,
      symbol: 'X',
      totalAggressiveBuy: 1e6,
      totalAggressiveSell: 10e6,
      shortLiquidationBuy: 0,
      longLiquidationSell: 6e6,
      feed: 'live',
      sellEffort: 90,
      bidDefense: 88,
      downResult: 20,
      nearSwingLow: true,
    });
    expect(snap.alert).toBe('FORCED_SELL_FLOW_ABSORBED_AT_SWING_LOW');
  });

  it('swing high forced buy absorption', () => {
    const snap = evaluateLiquidationFlow({
      timestamp: 1,
      symbol: 'X',
      totalAggressiveBuy: 10e6,
      totalAggressiveSell: 1e6,
      shortLiquidationBuy: 7e6,
      longLiquidationSell: 0,
      feed: 'live',
      buyEffort: 88,
      askDefense: 90,
      upResult: 15,
      nearSwingHigh: true,
    });
    expect(snap.alert).toBe('FORCED_BUY_FLOW_ABSORBED_AT_SWING_HIGH');
  });

  it('no lookahead: only uses provided history samples', () => {
    const early = evaluateLiquidationFlow({
      timestamp: 100,
      symbol: 'X',
      totalAggressiveBuy: 1e6,
      totalAggressiveSell: 1e6,
      shortLiquidationBuy: 100_000,
      longLiquidationSell: 0,
      feed: 'live',
      forcedBuyHistory: [100_000],
    });
    expect(early.alert).not.toBe('SHORT_LIQUIDATION_CASCADE');
  });
});

describe('cascade / exhaustion', () => {
  it('detects cascade acceleration', () => {
    expect(detectCascade([400_000, 1_100_000, 3_800_000], cfg)).toBe(true);
    expect(detectCascade([400_000, 450_000, 500_000], cfg)).toBe(false);
  });

  it('detects exhaustion after spike', () => {
    expect(detectExhaustion([20, 45, 82, 96, 38, 11].map((n) => n * 10_000), cfg)).toBe(true);
  });
});
