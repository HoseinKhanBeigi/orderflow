import { describe, expect, it } from 'vitest';
import {
  evaluateTradeDecisionFromMetrics,
  TRADE_DECISION_STRATEGY_VERSION,
} from '../src/trade-decision/index.js';
import type { TradeDecisionMetrics } from '../src/trade-decision/index.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

function baseMetrics(over: Partial<TradeDecisionMetrics> = {}): TradeDecisionMetrics {
  return {
    buyerControl: null,
    sellerControl: null,
    upsideFuel: null,
    downsideFuel: null,
    fuelEdge: null,
    passiveSellerDefense: null,
    passiveBuyerDefense: null,
    askConsumption: null,
    bidConsumption: null,
    askPulling: null,
    bidPulling: null,
    askReplenishment: null,
    bidReplenishment: null,
    askSurvival: null,
    bidSurvival: null,
    upsideFuelVelocity: null,
    downsideFuelVelocity: null,
    buyerAbsorbed: false,
    sellerAbsorbed: false,
    priceFollowedUp: false,
    priceFollowedDown: false,
    dataQuality: 'OK',
    patternId: null,
    patternStatus: null,
    ...over,
  };
}

const strongLong = (): TradeDecisionMetrics =>
  baseMetrics({
    buyerControl: 74,
    sellerControl: 31,
    upsideFuel: 81,
    downsideFuel: 42,
    fuelEdge: 39,
    passiveSellerDefense: 32,
    askConsumption: 74,
    askPulling: 86,
    askReplenishment: 21,
    askSurvival: 28,
    buyerAbsorbed: false,
    priceFollowedUp: true,
    upsideFuelVelocity: 2,
  });

const strongShort = (): TradeDecisionMetrics =>
  baseMetrics({
    sellerControl: 77,
    buyerControl: 30,
    downsideFuel: 83,
    upsideFuel: 39,
    fuelEdge: -44,
    passiveBuyerDefense: 29,
    bidConsumption: 81,
    bidPulling: 75,
    bidReplenishment: 24,
    bidSurvival: 30,
    sellerAbsorbed: false,
    priceFollowedDown: true,
    downsideFuelVelocity: 2,
  });

describe('TradeDecisionEngine — SIMPLE_ATTACK_DEFENSE_V1', () => {
  it('emits valid LONG on aligned attack + weak ask defense + price up', () => {
    const d = evaluateTradeDecisionFromMetrics(strongLong());
    expect(d.action).toBe('LONG');
    expect(d.phase).toBe('LONG_CONFIRMATION');
    expect(d.confidence).toBeGreaterThanOrEqual(55);
    expect(d.reasons).toEqual(expect.arrayContaining(['buyers_in_control', 'price_following_up']));
    expect(d.blockers).toEqual([]);
    expect(d.strategyVersion).toBe(TRADE_DECISION_STRATEGY_VERSION);
    expect(d.invalidationReasons.length).toBeGreaterThan(0);
  });

  it('emits valid SHORT on mirror conditions', () => {
    const d = evaluateTradeDecisionFromMetrics(strongShort());
    expect(d.action).toBe('SHORT');
    expect(d.phase).toBe('SHORT_CONFIRMATION');
    expect(d.reasons).toEqual(expect.arrayContaining(['sellers_in_control', 'price_following_down']));
  });

  it('WAIT when fuel is balanced', () => {
    const d = evaluateTradeDecisionFromMetrics(
      baseMetrics({
        ...strongLong(),
        upsideFuel: 74,
        downsideFuel: 71,
        fuelEdge: 3,
      }),
    );
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('fuel_balanced');
  });

  it('WAIT when control is weak', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ ...strongLong(), buyerControl: 40 }));
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('weak_buyer_control');
  });

  it('WAIT when opposing defense is strong', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ ...strongLong(), passiveSellerDefense: 84 }));
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('seller_defense_strong');
  });

  it('WAIT when opposing replenishment is high', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ ...strongLong(), askReplenishment: 91 }));
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('ask_replenishment_high');
  });

  it('buyer absorption blocks LONG even with strong attack', () => {
    const d = evaluateTradeDecisionFromMetrics(
      baseMetrics({
        ...strongLong(),
        buyerAbsorbed: true,
        askReplenishment: 91,
        priceFollowedUp: false,
        passiveSellerDefense: 84,
      }),
    );
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toEqual(
      expect.arrayContaining(['BUYER_ABSORBED', 'ask_replenishment_high', 'no_price_follow_through']),
    );
  });

  it('seller absorption blocks SHORT', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ ...strongShort(), sellerAbsorbed: true }));
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('SELLER_ABSORBED');
  });

  it('WAIT when price does not follow', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ ...strongLong(), priceFollowedUp: false }));
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('no_price_follow_through');
  });

  it('WAIT on stale / missing data', () => {
    expect(evaluateTradeDecisionFromMetrics(baseMetrics({ dataQuality: 'STALE' })).action).toBe('WAIT');
    expect(evaluateTradeDecisionFromMetrics(baseMetrics({ dataQuality: 'NO_DATA' })).blockers).toContain(
      'insufficient_data',
    );
    expect(evaluateTradeDecisionFromMetrics(baseMetrics({ dataQuality: 'LOW_CONFIDENCE' })).action).toBe('WAIT');
  });

  it('pattern alone does not create LONG', () => {
    const d = evaluateTradeDecisionFromMetrics(baseMetrics({ buyerControl: 40, upsideFuel: 40 }), DEFAULT_CONFIG.tradeDecision, {
      pattern: { id: 'BULLISH_CONTINUATION', status: 'CONFIRMED', direction: 'BULLISH' },
    });
    expect(d.action).toBe('WAIT');
  });

  it('confirmed bullish pattern boosts confidence on a valid LONG', () => {
    const plain = evaluateTradeDecisionFromMetrics(strongLong());
    const boosted = evaluateTradeDecisionFromMetrics(strongLong(), DEFAULT_CONFIG.tradeDecision, {
      pattern: { id: 'BULLISH_CONTINUATION', status: 'CONFIRMED', direction: 'BULLISH' },
    });
    expect(boosted.action).toBe('LONG');
    expect(boosted.confidence).toBeGreaterThanOrEqual(plain.confidence);
  });

  it('fuel edge cannot favor both sides at once — defaults to WAIT/entry on one side only', () => {
    const both = baseMetrics({
      buyerControl: 80,
      sellerControl: 80,
      upsideFuel: 80,
      downsideFuel: 80,
      fuelEdge: 0,
      passiveSellerDefense: 20,
      passiveBuyerDefense: 20,
      askConsumption: 80,
      bidConsumption: 80,
      askPulling: 80,
      bidPulling: 80,
      askReplenishment: 20,
      bidReplenishment: 20,
      buyerAbsorbed: false,
      sellerAbsorbed: false,
      priceFollowedUp: true,
      priceFollowedDown: true,
    });
    const d = evaluateTradeDecisionFromMetrics(both);
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toContain('fuel_balanced');
  });

  it('keeps strategy version on every snapshot', () => {
    const d = evaluateTradeDecisionFromMetrics(strongLong());
    expect(d.strategyVersion).toBe('SIMPLE_ATTACK_DEFENSE_V1');
  });

  it('does not look ahead — same metrics always same action', () => {
    const a = evaluateTradeDecisionFromMetrics(strongLong(), DEFAULT_CONFIG.tradeDecision, { now: 1 });
    const b = evaluateTradeDecisionFromMetrics(strongLong(), DEFAULT_CONFIG.tradeDecision, { now: 2 });
    expect(a.action).toBe(b.action);
    expect(a.confidence).toBe(b.confidence);
  });
});

describe('TradeDecisionEngine — strong attack vs strong defense', () => {
  it('WAIT with explanatory blockers', () => {
    const d = evaluateTradeDecisionFromMetrics(
      baseMetrics({
        buyerControl: 79,
        upsideFuel: 88,
        downsideFuel: 40,
        fuelEdge: 48,
        passiveSellerDefense: 84,
        askConsumption: 90,
        askPulling: 40,
        askReplenishment: 91,
        buyerAbsorbed: true,
        priceFollowedUp: false,
      }),
    );
    expect(d.action).toBe('WAIT');
    expect(d.blockers).toEqual(
      expect.arrayContaining([
        'seller_defense_strong',
        'ask_replenishment_high',
        'BUYER_ABSORBED',
        'no_price_follow_through',
      ]),
    );
    expect(d.reasons).toEqual(expect.arrayContaining(['buyers_in_control', 'upside_fuel_dominant']));
  });
});
