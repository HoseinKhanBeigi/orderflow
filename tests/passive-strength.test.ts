import { describe, expect, it } from 'vitest';
import {
  evaluatePassiveStrength,
  PassiveLiquidityStrengthEngine,
} from '../src/passive-strength/index.js';
import {
  emptySideComponents,
  type PassiveSideComponents,
  type PassiveStrengthInput,
} from '../src/models/passive-strength.js';

function side(partial: Partial<PassiveSideComponents>): PassiveSideComponents {
  return { ...emptySideComponents(), survivalObserved: true, ...partial };
}

function input(partial: Partial<PassiveStrengthInput> & Pick<PassiveStrengthInput, 'bids' | 'asks'>): PassiveStrengthInput {
  return {
    symbol: 'NEARUSDT',
    timestamp: 1_000,
    reconciliationError: 0,
    dataStatus: 'OK',
    ...partial,
  };
}

const strongBid = side({
  depthScore: 70,
  nearTouchScore: 82,
  consumptionScore: 76,
  replenishmentScore: 91,
  survivalScore: 89,
  cancellationScore: 14,
  withdrawalScore: 11,
  persistenceScore: 88,
  reliabilityScore: 90,
  churnRatio: 0.4,
});

const weakBid = side({
  depthScore: 83,
  consumptionScore: 28,
  replenishmentScore: 12,
  survivalScore: 19,
  cancellationScore: 92,
  withdrawalScore: 88,
  persistenceScore: 21,
  reliabilityScore: 20,
  churnRatio: 0.2,
});

const strongAsk = side({
  depthScore: 75,
  nearTouchScore: 80,
  consumptionScore: 84,
  replenishmentScore: 93,
  survivalScore: 87,
  cancellationScore: 16,
  withdrawalScore: 12,
  persistenceScore: 90,
  reliabilityScore: 88,
  churnRatio: 0.4,
});

const weakAsk = side({
  depthScore: 88,
  consumptionScore: 30,
  replenishmentScore: 18,
  survivalScore: 14,
  cancellationScore: 90,
  withdrawalScore: 94,
  persistenceScore: 18,
  reliabilityScore: 16,
  churnRatio: 0.2,
});

describe('passive liquidity strength', () => {
  it('scores a bid wall that is being hit but survives and refills as stronger than raw size', () => {
    const read = evaluatePassiveStrength(input({ bids: strongBid, asks: weakAsk }));
    expect(read.bids.strength).toBeGreaterThan(70);
    expect(read.bids.defense).toBe('HOLDING');
    expect(read.bids.state).toBe('STRONG_DEFENSE');
    expect(read.state).toBe('BIDS_STRONGER');
    expect(read.passiveWinner).toBe('BIDS');
    expect(read.passiveStrengthSpread).toBeGreaterThan(10);
    expect(read.reasons.some((reason) => reason.includes('bid survival'))).toBe(true);
  });

  it('treats a large bid wall that cancels on approach as unreliable', () => {
    const read = evaluatePassiveStrength(input({
      bids: weakBid,
      asks: side({
        depthScore: 40,
        nearTouchScore: 55,
        replenishmentScore: 70,
        survivalScore: 72,
        cancellationScore: 20,
        withdrawalScore: 15,
        persistenceScore: 75,
        reliabilityScore: 70,
        consumptionScore: 40,
      }),
    }));
    expect(read.bids.strength).toBeLessThan(40);
    expect(read.bids.reliability).toBe('SPOOF_LIKE');
    expect(read.bids.defense).toBe('WITHDRAWING');
    expect(read.state).not.toBe('BIDS_STRONGER');
  });

  it('lets a smaller persistent ask wall beat a larger cancelling ask wall', () => {
    const small = evaluatePassiveStrength(input({
      bids: weakBid,
      asks: side({
        depthScore: 34,
        nearTouchScore: 68,
        consumptionScore: 60,
        replenishmentScore: 86,
        survivalScore: 84,
        cancellationScore: 12,
        withdrawalScore: 10,
        persistenceScore: 91,
        reliabilityScore: 80,
      }),
    }));
    const large = evaluatePassiveStrength(input({ bids: weakBid, asks: weakAsk }));
    expect(small.asks.strength).toBeGreaterThan(large.asks.strength);
    expect(small.asks.strength).toBeGreaterThan(small.asks.depthScore ?? 0);
  });

  it('reads high consumption with refill and survival as defense holding', () => {
    const read = evaluatePassiveStrength(input({ bids: strongBid, asks: strongAsk }));
    expect(read.bids.defense).toBe('HOLDING');
    expect(read.asks.defense).toBe('HOLDING');
    expect(read.bids.netConsumptionPressure).toBe(0);
    expect(read.state).toBe('BOTH_STRONG');
  });

  it('reads high consumption without refill as defense breaking', () => {
    const breaking = side({
      depthScore: 60,
      consumptionScore: 85,
      replenishmentScore: 15,
      survivalScore: 20,
      cancellationScore: 30,
      withdrawalScore: 25,
      persistenceScore: 40,
      reliabilityScore: 35,
    });
    const read = evaluatePassiveStrength(input({
      bids: breaking,
      asks: side({
        depthScore: 50,
        consumptionScore: 20,
        replenishmentScore: 40,
        survivalScore: 55,
        cancellationScore: 20,
        withdrawalScore: 15,
        persistenceScore: 50,
        reliabilityScore: 50,
      }),
    }));
    expect(read.bids.defense).toBe('BREAKING');
    expect(read.bids.netConsumptionPressure).toBeGreaterThan(50);
    expect(read.bids.strength).toBeLessThan(40);
  });

  it('does not call a close score bids stronger', () => {
    const bids = side({
      depthScore: 60,
      nearTouchScore: 62,
      replenishmentScore: 58,
      survivalScore: 60,
      cancellationScore: 30,
      withdrawalScore: 28,
      persistenceScore: 60,
      reliabilityScore: 60,
      consumptionScore: 40,
    });
    const asks = side({ ...bids, depthScore: 58, nearTouchScore: 58, survivalScore: 57 });
    const read = evaluatePassiveStrength(input({ bids, asks }));
    expect(Math.abs(read.passiveStrengthSpread)).toBeLessThan(10);
    expect(read.state).toBe('BALANCED');
    expect(read.passiveWinner).toBe('BALANCED');
  });

  it('calls asks stronger when ask behavior leads by more than the margin', () => {
    const read = evaluatePassiveStrength(input({ bids: weakBid, asks: strongAsk }));
    expect(read.state).toBe('ASKS_STRONGER');
    expect(read.passiveWinner).toBe('ASKS');
  });

  it('flags weakening from the trend before the spread is extreme', () => {
    const steady = side({
      depthScore: 55,
      nearTouchScore: 55,
      replenishmentScore: 50,
      survivalScore: 60,
      cancellationScore: 30,
      withdrawalScore: 25,
      persistenceScore: 55,
      reliabilityScore: 55,
      consumptionScore: 40,
    });
    const base = evaluatePassiveStrength(input({ bids: steady, asks: steady, timestamp: 500 }));
    const read = evaluatePassiveStrength(input({
      bids: steady,
      asks: steady,
      timestamp: 4_000,
      history: [
        { timestamp: 1_000, bidStrength: base.bids.strength + 24, askStrength: base.asks.strength - 8 },
        { timestamp: 2_000, bidStrength: base.bids.strength + 16, askStrength: base.asks.strength - 4 },
        { timestamp: 3_000, bidStrength: base.bids.strength + 8, askStrength: base.asks.strength },
      ],
    }));
    expect(Math.abs(read.passiveStrengthSpread)).toBeLessThan(10);
    expect(read.bids.trend).toBe('FALLING');
    expect(read.state).toBe('BIDS_WEAKENING');
    expect(read.passiveWinner).toBe('BALANCED');
    expect(read.reasons.some((reason) => reason.includes('asks are strengthening') || reason.includes('bid strength is falling'))).toBe(true);
  });

  it('refuses a confident score when accounting does not reconcile', () => {
    const read = evaluatePassiveStrength(input({
      bids: strongBid,
      asks: weakAsk,
      reconciliationError: 0.55,
    }));
    expect(read.accountingMismatch).toBe(true);
    expect(read.state).toBe('UNCERTAIN');
    expect(read.confidence).toBeLessThan(40);
    expect(read.passiveWinner).toBe('UNCERTAIN');
  });

  it('lowers confidence on high churn and names the state when both sides churn', () => {
    const churn = side({
      depthScore: 60,
      nearTouchScore: 60,
      replenishmentScore: 80,
      survivalScore: 55,
      cancellationScore: 40,
      withdrawalScore: 25,
      persistenceScore: 40,
      reliabilityScore: 45,
      consumptionScore: 50,
      churnRatio: 3.4,
    });
    const read = evaluatePassiveStrength(input({ bids: churn, asks: { ...churn } }));
    expect(read.bids.churn).toBe('EXTREME_CHURN');
    expect(read.state).toBe('HIGH_CHURN');
    expect(read.confidence).toBeLessThan(78);
  });

  it('keeps near-touch concentration as its own measurement', () => {
    const read = evaluatePassiveStrength(input({
      bids: { ...strongBid, nearTouchConcentration: 0.72 },
      asks: { ...weakAsk, nearTouchConcentration: 0.1 },
    }));
    expect(read.bids.nearTouchConcentration).toBeCloseTo(0.72);
    expect(read.asks.nearTouchConcentration).toBeCloseTo(0.1);
  });

  it('marks approach withdrawal as withdrawing', () => {
    const read = evaluatePassiveStrength(input({
      bids: { ...weakBid, approachWithdrawal: true, survivalScore: 22 },
      asks: strongAsk,
    }));
    expect(read.bids.survival).toBe('WITHDRAWING');
    expect(read.bids.defense).toBe('WITHDRAWING');
  });

  it('does not turn missing measurements into zeros', () => {
    const read = evaluatePassiveStrength(input({
      bids: emptySideComponents(),
      asks: emptySideComponents(),
      dataStatus: 'NO_DATA',
    }));
    expect(read.state).toBe('UNCERTAIN');
    expect(read.dataStatus).toBe('NO_DATA');
    expect(read.bids.survivalScore).toBeNull();
    expect(read.bids.depthScore).toBeNull();
    expect(read.confidence).toBe(0);
  });

  it('caps a stale book', () => {
    const read = evaluatePassiveStrength(input({
      bids: strongBid,
      asks: weakAsk,
      dataStatus: 'STALE_DATA',
    }));
    expect(read.state).toBe('UNCERTAIN');
    expect(read.confidence).toBeLessThanOrEqual(25);
  });

  it('ignores history from the future', () => {
    const read = evaluatePassiveStrength(input({
      bids: strongBid,
      asks: weakAsk,
      timestamp: 1_000,
      history: [{ timestamp: 5_000, bidStrength: 5, askStrength: 95 }],
    }));
    expect(read.bids.trend).toBe('UNKNOWN');
    expect(read.state).toBe('BIDS_STRONGER');
  });

  it('keeps strength history per engine', () => {
    const a = new PassiveLiquidityStrengthEngine();
    const b = new PassiveLiquidityStrengthEngine();
    const first = {
      symbol: 'NEARUSDT',
      timestamp: 1_000,
      bids: strongBid,
      asks: weakAsk,
      reconciliationError: 0,
      dataStatus: 'OK' as const,
    };
    a.evaluate(first);
    const later = a.evaluate({
      ...first,
      timestamp: 2_000,
      bids: weakBid,
    });
    const other = b.evaluate({ ...first, timestamp: 2_000, bids: weakBid });
    expect(later.bids.change).not.toBe(0);
    expect(other.bids.change).toBe(0);
    expect(other.bids.trend).toBe('UNKNOWN');
  });

  it('names both weak when neither side holds', () => {
    const read = evaluatePassiveStrength(input({ bids: weakBid, asks: weakAsk }));
    expect(read.bids.strength).toBeLessThan(38);
    expect(read.asks.strength).toBeLessThan(38);
    expect(read.state).toBe('BOTH_WEAK');
  });
});
