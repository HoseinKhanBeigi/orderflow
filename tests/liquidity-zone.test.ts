import { describe, expect, it } from 'vitest';
import {
  evaluateLiquidityZones,
  swingsToLiquidityZones,
  classifyProximity,
  classifyZoneOutcome,
  liveWallAlignment,
  mergeLiquidityZoneConfig,
  type FlowAtZoneInput,
} from '../src/liquidity-zone/index.js';
import type { SwingPoint } from '../src/swing-structure/index.js';

function swing(partial: Partial<SwingPoint> & Pick<SwingPoint, 'type' | 'price' | 'pivotTime' | 'confirmedAt'>): SwingPoint {
  return {
    id: partial.id ?? `${partial.type}:${partial.pivotTime}`,
    type: partial.type,
    price: partial.price,
    pivotTime: partial.pivotTime,
    confirmedAt: partial.confirmedAt,
    timeframe: partial.timeframe ?? '15m',
    leftBars: 3,
    rightBars: 3,
    significance: partial.significance ?? 80,
    class: partial.class ?? 'MAJOR',
    state: partial.state ?? 'ACTIVE',
    testCount: partial.testCount ?? 0,
    lastInteractionAt: null,
    pending: partial.pending,
  };
}

const sh = swing({ type: 'SWING_HIGH', price: 5.02, pivotTime: 1000, confirmedAt: 1900, significance: 82 });
const sl = swing({ type: 'SWING_LOW', price: 4.74, pivotTime: 2000, confirmedAt: 2900, significance: 74 });

const cfg = mergeLiquidityZoneConfig({
  baseHalfWidthBps: 8,
  approachBps: 25,
  nearBps: 10,
  acceptBeyondBps: 5,
});

describe('zone creation from confirmed swings', () => {
  it('creates potential buy-side zone from swing high', () => {
    const zones = swingsToLiquidityZones({ swings: [sh], asOf: 2000, atr: 0.05, config: cfg });
    expect(zones).toHaveLength(1);
    expect(zones[0]!.sourceType).toBe('SWING_HIGH');
    expect(zones[0]!.liquiditySide).toBe('BUY_SIDE');
    expect(zones[0]!.classification).toBe('POTENTIAL_LIQUIDITY_ZONE');
    expect(zones[0]!.zoneLow).toBeLessThan(5.02);
    expect(zones[0]!.zoneHigh).toBeGreaterThan(5.02);
  });

  it('creates potential sell-side zone from swing low', () => {
    const zones = swingsToLiquidityZones({ swings: [sl], asOf: 3000, atr: 0.05, config: cfg });
    expect(zones[0]!.liquiditySide).toBe('SELL_SIDE');
    expect(zones[0]!.classification).toBe('POTENTIAL_LIQUIDITY_ZONE');
  });

  it('no lookahead: zone absent before confirmedAt', () => {
    const zones = swingsToLiquidityZones({ swings: [sh], asOf: 1800, config: cfg });
    expect(zones).toHaveLength(0);
  });

  it('without liquidation data stays potential', () => {
    const zones = swingsToLiquidityZones({ swings: [sh], asOf: 2000, liquidationClusters: [], config: cfg });
    expect(zones[0]!.classification).toBe('POTENTIAL_LIQUIDITY_ZONE');
    expect(zones[0]!.confluence.liquidationLevel).toBe('NONE');
  });

  it('liquidation confluence upgrades classification', () => {
    const zones = swingsToLiquidityZones({
      swings: [sh],
      asOf: 2000,
      config: cfg,
      liquidationClusters: [{ side: 'SHORT', priceLow: 5.015, priceHigh: 5.03, confidence: 80 }],
    });
    expect(zones[0]!.classification).toBe('LIQUIDATION_CONFLUENCE_ZONE');
    expect(zones[0]!.confluence.liquidationLevel).toBe('HIGH');
  });
});

describe('approach / proximity', () => {
  const zone = { zoneLow: 5.012, zoneHigh: 5.028, sourceType: 'SWING_HIGH' as const };

  it('far / approaching / near / inside', () => {
    expect(
      classifyProximity({
        price: 4.9,
        bar: null,
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('FAR');
    expect(
      classifyProximity({
        price: 5.01,
        bar: null,
        zone,
        approachBps: 40,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toMatch(/APPROACHING|NEAR|INSIDE/);
    expect(
      classifyProximity({
        price: 5.02,
        bar: null,
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('INSIDE');
  });

  it('swing high sweep then reclaim', () => {
    expect(
      classifyProximity({
        price: 5.015,
        bar: { time: 1, open: 5.02, high: 5.035, low: 5.01, close: 5.015 },
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('SWEPT');
    expect(
      classifyProximity({
        price: 5.005,
        bar: { time: 1, open: 5.02, high: 5.035, low: 5.0, close: 5.005 },
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('RECLAIMED');
  });

  it('swing low sweep', () => {
    const lowZone = { zoneLow: 4.732, zoneHigh: 4.748, sourceType: 'SWING_LOW' as const };
    expect(
      classifyProximity({
        price: 4.74,
        bar: { time: 1, open: 4.74, high: 4.75, low: 4.72, close: 4.742 },
        zone: lowZone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('SWEPT');
  });

  it('accepted breakout uses close beyond, not wick-only', () => {
    expect(
      classifyProximity({
        price: 5.04,
        bar: { time: 1, open: 5.02, high: 5.05, low: 5.01, close: 5.04 },
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('BROKEN');
    // wick only
    expect(
      classifyProximity({
        price: 5.02,
        bar: { time: 1, open: 5.02, high: 5.04, low: 5.01, close: 5.02 },
        zone,
        approachBps: 25,
        nearBps: 10,
        acceptBeyondBps: 5,
      }),
    ).toBe('SWEPT');
  });
});

describe('absorption / break outcomes', () => {
  const zoneHigh = {
    id: 'LZ:sh',
    sourceType: 'SWING_HIGH' as const,
    sourceSwingId: 'sh',
    price: 5.02,
    zoneLow: 5.012,
    zoneHigh: 5.028,
    liquiditySide: 'BUY_SIDE' as const,
    classification: 'POTENTIAL_LIQUIDITY_ZONE' as const,
    swingSignificance: 82,
    confidence: 78,
    state: 'ACTIVE' as const,
    proximity: 'INSIDE' as const,
    distanceBps: 2,
    createdAt: 1000,
    confirmedAt: 1900,
    timeframe: '15m',
    confluence: {
      score: 70,
      components: {
        swingSignificance: 82,
        historicalSrOverlap: 0,
        liveWallAlignment: 0,
        liquidationOverlap: 0,
        priorReactions: 0,
      },
      liquidationLevel: 'NONE' as const,
    },
    liveWallAlignment: 'NONE' as const,
  };

  const absorbBuy: FlowAtZoneInput = {
    buyEffort: 89,
    sellEffort: 20,
    askDefense: 92,
    bidDefense: 40,
    askRefill: 88,
    askSurvival: 91,
    upResult: 18,
    downResult: 50,
  };

  it('buyer absorption at swing high', () => {
    const r = classifyZoneOutcome({
      zone: zoneHigh,
      proximity: 'INSIDE',
      bar: { time: 1, open: 5.02, high: 5.025, low: 5.015, close: 5.018 },
      flow: absorbBuy,
      cfg,
    });
    expect(r.outcome).toBe('BUYERS_ABSORBED_AT_SWING_HIGH');
    expect(r.formingBias).toBe('SHORT_FORMING');
    expect(r.state).toBe('ABSORBING');
  });

  it('swing high break with weak ask defense', () => {
    const r = classifyZoneOutcome({
      zone: zoneHigh,
      proximity: 'BROKEN',
      bar: { time: 1, open: 5.02, high: 5.05, low: 5.02, close: 5.04 },
      flow: {
        buyEffort: 87,
        sellEffort: 10,
        askDefense: 29,
        bidDefense: 40,
        askConsumption: 90,
        askRefill: 20,
        upResult: 84,
        downResult: 10,
      },
      cfg,
    });
    expect(r.outcome).toBe('SWING_HIGH_BREAK');
    expect(r.formingBias).toBe('LONG_CONTINUATION_FORMING');
  });

  it('seller absorption at swing low', () => {
    const zoneLow = { ...zoneHigh, sourceType: 'SWING_LOW' as const, liquiditySide: 'SELL_SIDE' as const, price: 4.74, zoneLow: 4.732, zoneHigh: 4.748 };
    const r = classifyZoneOutcome({
      zone: zoneLow,
      proximity: 'INSIDE',
      bar: { time: 1, open: 4.74, high: 4.745, low: 4.735, close: 4.742 },
      flow: {
        buyEffort: 20,
        sellEffort: 91,
        askDefense: 30,
        bidDefense: 88,
        bidRefill: 90,
        downResult: 21,
        upResult: 40,
      },
      cfg,
    });
    expect(r.outcome).toBe('SELLERS_ABSORBED_AT_SWING_LOW');
    expect(r.formingBias).toBe('LONG_FORMING');
  });

  it('wick-only without flow is not break', () => {
    const r = classifyZoneOutcome({
      zone: zoneHigh,
      proximity: 'SWEPT',
      bar: { time: 1, open: 5.02, high: 5.04, low: 5.01, close: 5.02 },
      flow: null,
      cfg,
    });
    expect(r.outcome).toBe('WICK_ONLY_PENETRATION');
    expect(r.formingBias).toBe('NONE');
  });

  it('sweep reclaim with absorption → SHORT_FORMING hint only', () => {
    const r = classifyZoneOutcome({
      zone: zoneHigh,
      proximity: 'SWEPT',
      bar: { time: 1, open: 5.02, high: 5.035, low: 5.01, close: 5.015 },
      flow: absorbBuy,
      cfg,
    });
    expect(r.outcome).toBe('SWING_HIGH_SWEEP_RECLAIMED');
    expect(r.formingBias).toBe('SHORT_FORMING');
  });
});

describe('live wall + evaluate snapshot', () => {
  it('live ask at swing high', () => {
    expect(
      liveWallAlignment('SWING_HIGH', 5.012, 5.028, { price: 5.022, strength: 88 }, null, 12),
    ).toBe('LIVE_ASK_AT_SWING_HIGH');
  });

  it('evaluate activates attention near zone', () => {
    const snap = evaluateLiquidityZones({
      swings: [sh, sl],
      asOf: 3000,
      currentPrice: 5.019,
      currentBar: { time: 3000, open: 5.015, high: 5.022, low: 5.012, close: 5.019 },
      atr: 0.04,
      flow: {
        buyEffort: 89,
        sellEffort: 20,
        askDefense: 92,
        bidDefense: 40,
        upResult: 18,
        downResult: 50,
      },
      liveAsk: { price: 5.022, strength: 88 },
      config: cfg,
    });
    expect(snap.attention.attentionMode).toBe(true);
    expect(snap.attention.primaryZone?.sourceType).toBe('SWING_HIGH');
    expect(snap.attention.outcome).toBe('BUYERS_ABSORBED_AT_SWING_HIGH');
  });

  it('replay: early asOf excludes unconfirmed swing zone', () => {
    const early = evaluateLiquidityZones({
      swings: [sh],
      asOf: 1500,
      currentPrice: 5.0,
      config: cfg,
    });
    expect(early.zones).toHaveLength(0);
    const late = evaluateLiquidityZones({
      swings: [sh],
      asOf: 2000,
      currentPrice: 5.0,
      config: cfg,
    });
    expect(late.zones.length).toBeGreaterThan(0);
  });

  it('multi-timeframe: prefers higher significance when equidistant-ish', () => {
    const minor5m = swing({
      type: 'SWING_HIGH',
      price: 5.021,
      pivotTime: 1000,
      confirmedAt: 1900,
      significance: 45,
      timeframe: '5m',
      id: '5m',
    });
    const major15 = swing({
      type: 'SWING_HIGH',
      price: 5.02,
      pivotTime: 1000,
      confirmedAt: 1900,
      significance: 85,
      timeframe: '15m',
      id: '15m',
    });
    const snap = evaluateLiquidityZones({
      swings: [minor5m, major15],
      asOf: 2000,
      currentPrice: 5.02,
      config: cfg,
    });
    expect(snap.attention.primaryZone?.timeframe).toBe('15m');
  });
});
