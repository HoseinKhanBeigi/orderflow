import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/index.js';
import { emptyAggressiveFlow, emptyAggressiveSideFlow, type AggressiveFlowSnapshot, type AggressiveSideFlow } from '../src/models/aggressive-flow.js';
import { MarketFuelEngine, type MarketFuelInput } from '../src/market-fuel/engine.js';

function engine() {
  return new MarketFuelEngine({ ...DEFAULT_CONFIG.marketFuel, statePersistMs: 0 });
}

function side(power: number, executed = 1_000_000): AggressiveSideFlow {
  const row = emptyAggressiveSideFlow();
  row.hasData = true;
  row.power = power;
  row.executedVolume = executed;
  row.contributions = [
    { label: 'Execution Velocity', normalized: power, weight: 0.2, points: 0 },
    { label: 'Trade Count Intensity', normalized: power, weight: 0.1, points: 0 },
    { label: 'Large Trade Activity', normalized: power, weight: 0.15, points: 0 },
  ];
  return row;
}

function flow(buy: number, sell: number, buyExecuted = 1_000_000, sellExecuted = 1_000_000): AggressiveFlowSnapshot {
  const snap = emptyAggressiveFlow('10s', 10_000);
  snap.buy = side(buy, buyExecuted);
  snap.sell = side(sell, sellExecuted);
  snap.aggressiveBuyPower = buy;
  snap.aggressiveSellPower = sell;
  return snap;
}

function input(over: Partial<MarketFuelInput> = {}): MarketFuelInput {
  return {
    symbol: 'BTCUSDT',
    window: '10s',
    now: 1_000,
    aggressiveFlow: flow(50, 50),
    forcedBuyVolume: 0,
    forcedSellVolume: 0,
    liquidationFeed: 'live',
    buyBurst: false,
    sellBurst: false,
    tradeDataMissing: false,
    tradeStale: false,
    sampleConfidence: 0.9,
    ...over,
  };
}

describe('MarketFuelEngine', () => {
  it('scores pure aggressive buy fuel without using passive liquidity', () => {
    const snap = engine().snapshot(input({ aggressiveFlow: flow(95, 8), now: 5_000 }));
    expect(snap.upsideFuel).toBeGreaterThan(80);
    expect(snap.downsideFuel).toBeLessThan(20);
    expect(snap.state).toBe('STRONG_UPSIDE_FUEL');
    expect(snap.fuelImbalance).toBeGreaterThan(50);
    expect(JSON.stringify(snap)).not.toMatch(/askDepth|bidDepth|Survival|replenish|withdrawal/i);
  });

  it('scores pure aggressive sell fuel', () => {
    const snap = engine().snapshot(input({ aggressiveFlow: flow(8, 95) }));
    expect(snap.downsideFuel).toBeGreaterThan(80);
    expect(snap.upsideFuel).toBeLessThan(20);
    expect(snap.state).toBe('STRONG_DOWNSIDE_FUEL');
  });

  it('treats high fuel on both sides as intense, not directional', () => {
    const snap = engine().snapshot(input({ aggressiveFlow: flow(85, 82) }));
    expect(snap.state).toBe('TWO_SIDED_HIGH_FUEL');
    expect(snap.totalFuelIntensity).toBeGreaterThanOrEqual(82);
    expect(Math.abs(snap.fuelImbalance ?? 0)).toBeLessThan(15);
  });

  it('labels quiet tape as low fuel and a small gap as balanced', () => {
    expect(engine().snapshot(input({ aggressiveFlow: flow(12, 10) })).state).toBe('LOW_FUEL');
    const balanced = engine().snapshot(input({ aggressiveFlow: flow(50, 46) }));
    expect(balanced.state).toBe('BALANCED_FUEL');
  });

  it('separates liquidation-driven fuel from organic buying', () => {
    const snap = engine().snapshot(
      input({
        aggressiveFlow: flow(20, 8, 200_000, 200_000),
        forcedBuyVolume: 800_000,
      }),
    );
    expect(snap.state).toBe('FORCED_BUY_FUEL');
    expect(snap.forcedUpsideFuel).toBeGreaterThan(snap.organicUpsideFuel ?? 0);
    expect(snap.components.shortLiquidationStrength.value).toBeGreaterThan(70);
    expect(snap.organicUpsideFuel).toBeLessThan(40);
  });

  it('does not turn a missing liquidation feed into zero', () => {
    const withFeed = engine().snapshot(input({ aggressiveFlow: flow(70, 20), liquidationFeed: 'not_expected' }));
    const missing = engine().snapshot(input({ aggressiveFlow: flow(70, 20), liquidationFeed: 'unavailable' }));
    expect(missing.components.shortLiquidationStrength.value).toBeNull();
    expect(missing.components.longLiquidationStrength.value).toBeNull();
    expect(missing.dataStatus).toBe('PARTIAL_DATA');
    expect(missing.upsideFuel).toBeCloseTo(withFeed.upsideFuel ?? 0, 5);
  });

  it('marks stale tape and missing tape without inventing fuel', () => {
    const stale = engine().snapshot(input({ tradeStale: true }));
    expect(stale.dataStatus).toBe('STALE_DATA');
    expect(stale.confidence).toBeLessThanOrEqual(45);
    expect(stale.upsideFuel).not.toBeNull();

    const none = engine().snapshot(input({ tradeDataMissing: true, aggressiveFlow: null }));
    expect(none.dataStatus).toBe('NO_DATA');
    expect(none.state).toBe('NO_DATA');
    expect(none.upsideFuel).toBeNull();
    expect(none.downsideFuel).toBeNull();
    expect(none.confidence).toBe(0);
  });

  it('tracks velocity and acceleration per window', () => {
    const fuel = engine();
    fuel.snapshot(input({ now: 0, aggressiveFlow: flow(40, 10) }));
    const mid = fuel.snapshot(input({ now: 1_000, aggressiveFlow: flow(50, 10) }));
    expect(mid.upsideFuelVelocity).toBeGreaterThan(0);
    expect(mid.upsideFuelAcceleration).toBeNull();
    const later = fuel.snapshot(input({ now: 2_000, aggressiveFlow: flow(80, 10) }));
    expect(later.upsideFuelVelocity).toBeGreaterThan(mid.upsideFuelVelocity ?? 0);
    expect(later.upsideFuelAcceleration).toBeGreaterThan(0);
  });

  it('does not let a later sample rewrite an earlier snapshot', () => {
    const fuel = engine();
    const first = fuel.snapshot(input({ now: 0, aggressiveFlow: flow(30, 10) }));
    const saved = first.upsideFuel;
    fuel.snapshot(input({ now: 1_000, aggressiveFlow: flow(99, 10) }));
    expect(first.upsideFuel).toBe(saved);
  });

  it('clamps extreme component values to 0–100', () => {
    const hot = flow(150, -20);
    const snap = engine().snapshot(input({ aggressiveFlow: hot }));
    expect(snap.upsideFuel).toBeLessThanOrEqual(100);
    expect(snap.downsideFuel).toBeGreaterThanOrEqual(0);
    expect(snap.components.aggressiveBuyPower.value).toBeLessThanOrEqual(100);
  });

  it('keeps symbols and timeframes on separate histories', () => {
    const a = engine();
    const b = engine();
    a.snapshot(input({ symbol: 'BTCUSDT', now: 0, aggressiveFlow: flow(20, 10) }));
    const bFirst = b.snapshot(input({ symbol: 'ETHUSDT', now: 1_000, aggressiveFlow: flow(80, 10) }));
    expect(bFirst.upsideFuelVelocity).toBeNull();

    const shared = engine();
    shared.snapshot(input({ window: '10s', now: 0, aggressiveFlow: flow(20, 10) }));
    shared.snapshot(input({ window: '10s', now: 1_000, aggressiveFlow: flow(70, 10) }));
    const otherTf = shared.snapshot(input({ window: '1m', now: 1_000, aggressiveFlow: flow(70, 10) }));
    expect(otherTf.upsideFuelVelocity).toBeNull();
  });

  it('names burst flow as inferred, not as an observed stop', () => {
    const snap = engine().snapshot(input({ buyBurst: true, aggressiveFlow: flow(40, 10) }));
    expect(snap.components.inferredStopBuyFlow.inferred).toBe(true);
    expect(snap.components.inferredStopBuyFlow.value).toBeGreaterThan(0);
    expect(snap.confidence).toBeLessThanOrEqual(80);
  });
});
