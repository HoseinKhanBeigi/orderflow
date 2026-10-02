import { describe, expect, it } from 'vitest';
import {
  evaluateFailureReclaim,
  classifyBreakAttempt,
  classifyFailure,
  classifyReclaim,
  classifyControlShift,
  mergeFailureReclaimConfig,
  type ReferenceLevel,
  type FlowEvidence,
  type BarLike,
} from '../src/failure-reclaim/index.js';

const cfg = mergeFailureReclaimConfig({
  minBreakBps: 5,
  effortMeaningful: 45,
  effortHigh: 65,
  resultLow: 35,
  defenseHigh: 65,
  controlConfirm: 62,
  controlForming: 52,
  acceptHoldBars: 1,
  maxBarsAfterFailure: 12,
});

const swingLow: ReferenceLevel = {
  id: 'SL:4.74',
  type: 'SWING_LOW',
  price: 4.74,
  significance: 80,
};

const swingHigh: ReferenceLevel = {
  id: 'SH:5.02',
  type: 'SWING_HIGH',
  price: 5.02,
  significance: 82,
};

function bar(time: number, o: number, h: number, l: number, c: number): BarLike {
  return { time, open: o, high: h, low: l, close: c };
}

function flow(partial: Partial<FlowEvidence>): FlowEvidence {
  return {
    buyEffort: null,
    sellEffort: null,
    askDefense: null,
    bidDefense: null,
    upResult: null,
    downResult: null,
    buyerControl: null,
    sellerControl: null,
    ...partial,
  };
}

describe('break attempt', () => {
  it('requires meaningful penetration for long (below swing low)', () => {
    const weak = classifyBreakAttempt({
      direction: 'LONG',
      level: swingLow,
      bar: bar(1, 4.74, 4.75, 4.738, 4.74),
      atr: 0.05,
      cfg,
      flow: flow({ sellEffort: 80 }),
    });
    expect(weak.confirmed).toBe(false);

    const ok = classifyBreakAttempt({
      direction: 'LONG',
      level: swingLow,
      bar: bar(1, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      cfg,
      flow: flow({ sellEffort: 84 }),
    });
    expect(ok.confirmed).toBe(true);
    expect(ok.extremePrice).toBe(4.724);
  });

  it('low aggression → weak break', () => {
    const w = classifyBreakAttempt({
      direction: 'SHORT',
      level: swingHigh,
      bar: bar(1, 5.02, 5.035, 5.01, 5.025),
      atr: 0.05,
      cfg,
      flow: flow({ buyEffort: 20 }),
    });
    expect(w.weak).toBe(true);
    expect(w.confirmed).toBe(false);
  });
});

describe('failure', () => {
  it('seller failure: high sell effort + low down result', () => {
    const br = classifyBreakAttempt({
      direction: 'LONG',
      level: swingLow,
      bar: bar(1, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      cfg,
      flow: flow({ sellEffort: 84 }),
    });
    const f = classifyFailure({
      direction: 'LONG',
      breakAttempt: br,
      flow: flow({ sellEffort: 84, downResult: 18, bidDefense: 89 }),
      cfg,
    });
    expect(f.detected).toBe(true);
    expect(f.side).toBe('SELLERS');
    expect(f.label).toBe('SELLER_FAILURE');
  });

  it('buyer failure mirror', () => {
    const br = classifyBreakAttempt({
      direction: 'SHORT',
      level: swingHigh,
      bar: bar(1, 5.02, 5.035, 5.01, 5.022),
      atr: 0.05,
      cfg,
      flow: flow({ buyEffort: 88 }),
    });
    const f = classifyFailure({
      direction: 'SHORT',
      breakAttempt: br,
      flow: flow({ buyEffort: 88, upResult: 20, askDefense: 90 }),
      cfg,
    });
    expect(f.detected).toBe(true);
    expect(f.side).toBe('BUYERS');
  });

  it('failure without reclaim stays forming path incomplete', () => {
    const snap = evaluateFailureReclaim({
      timestamp: 100,
      bar: bar(100, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 84, downResult: 18, bidDefense: 89, buyerControl: 30 }),
      config: cfg,
    });
    expect(snap.failure.detected).toBe(true);
    expect(snap.reclaim.confirmed).toBe(false);
    expect(snap.setup).toBe('WAIT');
    expect(snap.missingConfirmation).toBe('RECLAIM');
  });
});

describe('reclaim', () => {
  it('wick vs close vs accepted', () => {
    const wick = classifyReclaim({
      direction: 'LONG',
      level: swingLow,
      bar: bar(2, 4.73, 4.745, 4.72, 4.735),
      postFailureBars: [],
      cfg,
    });
    expect(wick.state).toBe('WICK_RECLAIM');
    expect(wick.confirmed).toBe(false);

    const close = classifyReclaim({
      direction: 'LONG',
      level: swingLow,
      bar: bar(2, 4.73, 4.76, 4.72, 4.75),
      postFailureBars: [bar(2, 4.73, 4.76, 4.72, 4.75)],
      cfg,
    });
    expect(close.confirmed).toBe(true);
    expect(['CLOSE_RECLAIM', 'ACCEPTED_RECLAIM']).toContain(close.state);
  });

  it('reclaim failure when lost again', () => {
    const r = classifyReclaim({
      direction: 'LONG',
      level: swingLow,
      bar: bar(2, 4.73, 4.76, 4.72, 4.75),
      postFailureBars: [
        bar(2, 4.73, 4.76, 4.72, 4.75),
        bar(3, 4.75, 4.76, 4.7, 4.71),
      ],
      cfg,
      priorReclaim: { state: 'CLOSE_RECLAIM', confirmed: true, hold: false },
    });
    expect(r.state).toBe('RECLAIM_FAILED');
  });
});

describe('control + full sequence', () => {
  it('control shift forming vs confirmed', () => {
    expect(
      classifyControlShift({
        direction: 'LONG',
        flow: flow({ buyerControl: 55 }),
        cfg,
      }).state,
    ).toBe('FORMING');
    expect(
      classifyControlShift({
        direction: 'LONG',
        flow: flow({ buyerControl: 70 }),
        cfg,
      }).state,
    ).toBe('CONFIRMED');
  });

  it('failure + reclaim without control → LONG_FORMING', () => {
    const fail = evaluateFailureReclaim({
      timestamp: 100,
      bar: bar(100, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 84, downResult: 18, bidDefense: 89, buyerControl: 40 }),
      config: cfg,
    });
    const reclaim = evaluateFailureReclaim({
      timestamp: 200,
      bar: bar(200, 4.73, 4.78, 4.72, 4.76),
      postFailureBars: [bar(200, 4.73, 4.78, 4.72, 4.76)],
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 50, downResult: 40, bidDefense: 80, buyEffort: 60, buyerControl: 55 }),
      prior: fail,
      config: cfg,
    });
    expect(reclaim.failure.detected).toBe(true);
    expect(reclaim.reclaim.confirmed).toBe(true);
    expect(reclaim.setup).toBe('LONG_FORMING');
    expect(reclaim.missingConfirmation).toBe('BUYER_CONTROL');
  });

  it('confirmed LONG_SETUP only after control', () => {
    const fail = evaluateFailureReclaim({
      timestamp: 100,
      bar: bar(100, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 84, downResult: 18, bidDefense: 89, buyerControl: 30 }),
      config: cfg,
    });
    const done = evaluateFailureReclaim({
      timestamp: 300,
      bar: bar(300, 4.75, 4.8, 4.74, 4.78),
      postFailureBars: [bar(200, 4.73, 4.78, 4.72, 4.76), bar(300, 4.75, 4.8, 4.74, 4.78)],
      atr: 0.05,
      levels: [swingLow],
      flow: flow({
        sellEffort: 35,
        downResult: 40,
        bidDefense: 80,
        buyEffort: 75,
        upResult: 70,
        buyerControl: 72,
        sellerAbsorbed: true,
      }),
      prior: fail,
      config: cfg,
    });
    expect(done.setup).toBe('LONG_SETUP');
    expect(done.progress.setup).toBe(true);
    expect(done.setupConfirmedTimestamp).toBe(300);
  });

  it('confirmed SHORT_SETUP', () => {
    const fail = evaluateFailureReclaim({
      timestamp: 100,
      bar: bar(100, 5.02, 5.035, 5.01, 5.025),
      atr: 0.05,
      levels: [swingHigh],
      flow: flow({ buyEffort: 88, upResult: 18, askDefense: 91, sellerControl: 30 }),
      config: cfg,
    });
    const done = evaluateFailureReclaim({
      timestamp: 300,
      bar: bar(300, 5.01, 5.02, 4.98, 4.99),
      postFailureBars: [bar(200, 5.02, 5.03, 4.99, 5.0), bar(300, 5.01, 5.02, 4.98, 4.99)],
      atr: 0.05,
      levels: [swingHigh],
      flow: flow({
        buyEffort: 30,
        upResult: 40,
        askDefense: 80,
        sellEffort: 78,
        downResult: 72,
        sellerControl: 74,
        buyerAbsorbed: true,
      }),
      prior: fail,
      config: cfg,
    });
    expect(done.setup).toBe('SHORT_SETUP');
  });

  it('no lookahead: setupConfirmedTimestamp null until confirmed bar', () => {
    const fail = evaluateFailureReclaim({
      timestamp: 100,
      bar: bar(100, 4.74, 4.75, 4.724, 4.73),
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 84, downResult: 18, bidDefense: 89 }),
      config: cfg,
    });
    expect(fail.setupConfirmedTimestamp).toBeNull();
    expect(fail.failureTimestamp).toBe(100);
  });

  it('reclaim without prior failure is not a setup', () => {
    const snap = evaluateFailureReclaim({
      timestamp: 200,
      bar: bar(200, 4.73, 4.78, 4.72, 4.76),
      atr: 0.05,
      levels: [swingLow],
      flow: flow({ sellEffort: 20, downResult: 50, buyerControl: 70 }),
      config: cfg,
    });
    expect(snap.setup).not.toBe('LONG_SETUP');
    expect(snap.failure.detected).toBe(false);
  });
});
