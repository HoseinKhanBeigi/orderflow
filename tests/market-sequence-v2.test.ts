import { describe, expect, it } from 'vitest';
import {
  annotateSequenceReplay,
  buildStageInput,
  createSequenceStore,
  makeSequenceId,
  normalizeAbsorptionName,
  processSequenceCandle,
  selectPrimaryLabel,
  emptyStages,
  mergeMarketSequenceConfig,
} from '../src/market-sequence/index.js';
import type { SequenceStageInput, SequenceStages } from '../src/market-sequence/types.js';

const cfg = mergeMarketSequenceConfig({
  effortHigh: 60,
  resultStrong: 50,
  resultWeak: 30,
  expansionDispBps: 15,
  maxBarsBetweenStages: 10,
});

function baseInput(partial: Partial<SequenceStageInput> & { timestamp: number }): SequenceStageInput {
  const buy = partial.aggression?.aggressiveBuy ?? 1e6;
  const sell = partial.aggression?.aggressiveSell ?? 1e6;
  const delta = partial.aggression?.delta ?? buy - sell;
  return buildStageInput({
    timestamp: partial.timestamp,
    symbol: partial.symbol ?? 'TEST',
    timeframe: partial.timeframe ?? '15m',
    incomplete: partial.incomplete,
    reference: partial.structure?.primaryReference ?? {
      id: 'SL:100',
      type: 'SWING_LOW',
      price: 100,
    },
    location: partial.structure?.location ?? 'AT_SWING_LOW',
    sweep: partial.sweep?.state ?? 'NO_SWEEP',
    aggressiveBuy: buy,
    aggressiveSell: sell,
    delta,
    cvd: partial.aggression?.cvd ?? delta,
    displacementBps: partial.priceResponse?.displacementBps ?? 0,
    bodyEfficiency: partial.priceResponse?.bodyEfficiency ?? 0.4,
    absorptionRaw: partial.absorption?.state === 'NONE' ? null : partial.absorption?.state,
    failureReclaim: partial.failureReclaim
      ? ({
          failure: {
            detected: partial.failureReclaim.failureState !== 'NO_FAILURE',
            side: partial.failureReclaim.failureState.includes('BUYER')
              ? 'BUYERS'
              : partial.failureReclaim.failureState.includes('SELLER')
                ? 'SELLERS'
                : 'NONE',
            strength: 70,
            label: partial.failureReclaim.failureState.includes('BUYER')
              ? 'BUYER_FAILURE'
              : partial.failureReclaim.failureState.includes('SELLER')
                ? 'SELLER_FAILURE'
                : 'NONE',
          },
          reclaim: {
            state: partial.failureReclaim.reclaimState,
            confirmed: partial.failureReclaim.reclaimState.includes('RECLAIM') &&
              partial.failureReclaim.reclaimState !== 'NO_RECLAIM' &&
              partial.failureReclaim.reclaimState !== 'RECLAIM_FAILED',
            hold: partial.failureReclaim.reclaimState === 'ACCEPTED_RECLAIM',
          },
          controlShift: {
            state:
              partial.failureReclaim.controlShiftState === 'NO_CONTROL_SHIFT'
                ? 'NONE'
                : 'CONFIRMED',
            buyerControl: 70,
            sellerControl: 30,
          },
          progress: {
            breakAttempt: true,
            failure: partial.failureReclaim.failureState.includes('CONFIRMED'),
            reclaim: partial.failureReclaim.reclaimState !== 'NO_RECLAIM',
            controlShift: partial.failureReclaim.controlShiftState !== 'NO_CONTROL_SHIFT',
            setup: false,
          },
          direction: partial.failureReclaim.controlShiftState === 'BUYER_CONTROL_SHIFT'
            ? 'LONG'
            : partial.failureReclaim.controlShiftState === 'SELLER_CONTROL_SHIFT'
              ? 'SHORT'
              : 'NONE',
          setup: 'WAIT',
          machineState: partial.failureReclaim.invalidated ? 'INVALIDATED' : 'FAILURE_DETECTED',
        } as never)
      : null,
    cfg,
    ...({} as object),
  });
}

describe('absorption naming', () => {
  it('canonical BUYER_ABSORPTION = aggressive buyers absorbed', () => {
    expect(normalizeAbsorptionName('BUYER_ABSORPTION')).toBe('BUYER_ABSORPTION');
    expect(normalizeAbsorptionName('SELLER_ABSORPTION')).toBe('SELLER_ABSORPTION');
  });
  it('maps legacy LR BUY_ABSORPTION → SELLER_ABSORPTION', () => {
    expect(normalizeAbsorptionName('BUY_ABSORPTION')).toBe('SELLER_ABSORPTION');
    expect(normalizeAbsorptionName('SELL_ABSORPTION')).toBe('BUYER_ABSORPTION');
  });
});

describe('label priority', () => {
  it('failure beats absorption and sweep on same candle', () => {
    const stages: SequenceStages = {
      ...emptyStages(),
      sweep: 'SWEEP_LOW',
      absorption: 'SELLER_ABSORPTION',
      failure: 'SELLER_FAILURE_CONFIRMED',
    };
    expect(selectPrimaryLabel(stages, cfg).label).toBe('SELL_FAIL');
  });

  it('control beats reclaim', () => {
    const stages: SequenceStages = {
      ...emptyStages(),
      sweep: 'SWEEP_LOW',
      failure: 'SELLER_FAILURE_CONFIRMED',
      reclaim: 'CLOSE_RECLAIM',
      control: 'BUYER_CONTROL_SHIFT',
    };
    expect(selectPrimaryLabel(stages, cfg).label).toBe('BUY_CTRL');
  });

  it('expansion beats breakout when independently confirmed', () => {
    const stages: SequenceStages = {
      ...emptyStages(),
      breakout: 'BREAKOUT_CONFIRMED',
      expansion: 'BULLISH_EXPANSION_CONFIRMED',
    };
    expect(selectPrimaryLabel(stages, cfg).label).toBe('BULL_EXP');
  });

  it('breakout without expansion stays BREAKOUT', () => {
    const stages: SequenceStages = {
      ...emptyStages(),
      breakout: 'BREAKOUT_CONFIRMED',
      expansion: 'NO_EXPANSION',
      effortResult: 'BUYERS_EFFECTIVE',
    };
    expect(selectPrimaryLabel(stages, cfg).label).toBe('BREAKOUT');
  });
});

describe('bullish reversal sequence', () => {
  it('labels SWEEP_L → SELL_ABS → SELL_FAIL → BULL_RCLM → BUY_CTRL → BULL_EXP without backfill', () => {
    const ref = { id: 'SL:100', type: 'SWING_LOW' as const, price: 100 };
    const inputs: SequenceStageInput[] = [
      // A sweep low
      buildStageInput({
        timestamp: 1,
        symbol: 'T',
        timeframe: '15m',
        reference: ref,
        location: 'AT_SWING_LOW',
        sweep: 'SWEEP_LOW',
        aggressiveBuy: 1e6,
        aggressiveSell: 4e6,
        delta: -3e6,
        cvd: -3e6,
        displacementBps: -8,
        bodyEfficiency: 0.3,
        cfg,
      }),
      // B seller absorption
      buildStageInput({
        timestamp: 2,
        symbol: 'T',
        timeframe: '15m',
        reference: ref,
        location: 'AT_SWING_LOW',
        sweep: 'SWEEP_LOW',
        aggressiveBuy: 1e6,
        aggressiveSell: 5e6,
        delta: -4e6,
        cvd: -7e6,
        displacementBps: -2,
        bodyEfficiency: 0.15,
        absorptionRaw: 'SELLER_ABSORPTION',
        cfg,
      }),
      // C seller failure (from FR)
      (() => {
        const i = buildStageInput({
          timestamp: 3,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_LOW',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 1.5e6,
          aggressiveSell: 3e6,
          delta: -1.5e6,
          cvd: -8.5e6,
          displacementBps: 5,
          bodyEfficiency: 0.35,
          absorptionRaw: 'SELLER_ABSORPTION',
          cfg,
        });
        i.failureReclaim = {
          failureState: 'SELLER_FAILURE_CONFIRMED',
          reclaimState: 'NO_RECLAIM',
          controlShiftState: 'NO_CONTROL_SHIFT',
        };
        return i;
      })(),
      // D bull reclaim
      (() => {
        const i = buildStageInput({
          timestamp: 4,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_LOW',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 3e6,
          aggressiveSell: 1e6,
          delta: 2e6,
          cvd: -6.5e6,
          displacementBps: 22,
          bodyEfficiency: 0.55,
          cfg,
        });
        i.failureReclaim = {
          failureState: 'SELLER_FAILURE_CONFIRMED',
          reclaimState: 'CLOSE_RECLAIM',
          controlShiftState: 'NO_CONTROL_SHIFT',
        };
        return i;
      })(),
      // E buyer control
      (() => {
        const i = buildStageInput({
          timestamp: 5,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'NEAR_SWING_LOW',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 4e6,
          aggressiveSell: 1e6,
          delta: 3e6,
          cvd: -3.5e6,
          displacementBps: 28,
          bodyEfficiency: 0.6,
          cfg,
        });
        i.failureReclaim = {
          failureState: 'SELLER_FAILURE_CONFIRMED',
          reclaimState: 'ACCEPTED_RECLAIM',
          controlShiftState: 'BUYER_CONTROL_SHIFT',
        };
        return i;
      })(),
      // F expansion
      (() => {
        const i = buildStageInput({
          timestamp: 6,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'MID_RANGE',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 5e6,
          aggressiveSell: 0.8e6,
          delta: 4.2e6,
          cvd: 0.7e6,
          displacementBps: 40,
          bodyEfficiency: 0.7,
          cfg,
        });
        i.failureReclaim = {
          failureState: 'SELLER_FAILURE_CONFIRMED',
          reclaimState: 'ACCEPTED_RECLAIM',
          controlShiftState: 'BUYER_CONTROL_SHIFT',
        };
        return i;
      })(),
    ];

    const ann = annotateSequenceReplay(inputs, cfg);
    expect(ann.map((a) => a.primaryLabel)).toEqual([
      'SWEEP_L',
      'SELL_ABS',
      'SELL_FAIL',
      'BULL_RCLM',
      'BUY_CTRL',
      'BULL_EXP',
    ]);

    // shared sequenceId
    const ids = ann.map((a) => a.sequenceId).filter(Boolean);
    expect(new Set(ids).size).toBe(1);

    // no backfill: first candle stays SWEEP_L after full replay
    expect(ann[0]!.primaryLabel).toBe('SWEEP_L');

    // prefix replay consistency
    const prefix = annotateSequenceReplay(inputs.slice(0, 3), cfg);
    expect(prefix[2]!.primaryLabel).toBe(ann[2]!.primaryLabel);
  });
});

describe('bearish reversal', () => {
  it('SWEEP_H → BUY_ABS → BUY_FAIL → BEAR_RCLM → SELL_CTRL → BEAR_EXP', () => {
    const ref = { id: 'SH:200', type: 'SWING_HIGH' as const, price: 200 };
    const mk = (
      t: number,
      sweep: 'NO_SWEEP' | 'SWEEP_HIGH',
      buy: number,
      sell: number,
      disp: number,
      fr?: SequenceStageInput['failureReclaim'],
      abs?: string,
    ) => {
      const i = buildStageInput({
        timestamp: t,
        symbol: 'T',
        timeframe: '15m',
        reference: ref,
        location: 'AT_SWING_HIGH',
        sweep,
        aggressiveBuy: buy,
        aggressiveSell: sell,
        delta: buy - sell,
        cvd: buy - sell,
        displacementBps: disp,
        bodyEfficiency: 0.4,
        absorptionRaw: abs,
        cfg,
      });
      if (fr) i.failureReclaim = fr;
      return i;
    };
    const ann = annotateSequenceReplay(
      [
        mk(1, 'SWEEP_HIGH', 5e6, 1e6, 4, undefined),
        mk(2, 'SWEEP_HIGH', 5e6, 1e6, 1, undefined, 'BUYER_ABSORPTION'),
        mk(3, 'NO_SWEEP', 4e6, 1e6, -3, {
          failureState: 'BUYER_FAILURE_CONFIRMED',
          reclaimState: 'NO_RECLAIM',
          controlShiftState: 'NO_CONTROL_SHIFT',
        }, 'BUYER_ABSORPTION'),
        mk(4, 'NO_SWEEP', 1e6, 3e6, -20, {
          failureState: 'BUYER_FAILURE_CONFIRMED',
          reclaimState: 'CLOSE_RECLAIM',
          controlShiftState: 'NO_CONTROL_SHIFT',
        }),
        mk(5, 'NO_SWEEP', 1e6, 4e6, -25, {
          failureState: 'BUYER_FAILURE_CONFIRMED',
          reclaimState: 'ACCEPTED_RECLAIM',
          controlShiftState: 'SELLER_CONTROL_SHIFT',
        }),
        mk(6, 'NO_SWEEP', 0.8e6, 5e6, -35, {
          failureState: 'BUYER_FAILURE_CONFIRMED',
          reclaimState: 'ACCEPTED_RECLAIM',
          controlShiftState: 'SELLER_CONTROL_SHIFT',
        }),
      ],
      cfg,
    );
    expect(ann.map((a) => a.primaryLabel)).toEqual([
      'SWEEP_H',
      'BUY_ABS',
      'BUY_FAIL',
      'BEAR_RCLM',
      'SELL_CTRL',
      'BEAR_EXP',
    ]);
  });
});

describe('breakout continuation', () => {
  it('does not force absorption/failure/reclaim', () => {
    const ref = { id: 'SH:50', type: 'SWING_HIGH' as const, price: 50 };
    const ann = annotateSequenceReplay(
      [
        buildStageInput({
          timestamp: 1,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_HIGH',
          sweep: 'SWEEP_HIGH',
          aggressiveBuy: 5e6,
          aggressiveSell: 1e6,
          delta: 4e6,
          cvd: 4e6,
          displacementBps: 35,
          bodyEfficiency: 0.7,
          cfg,
        }),
        buildStageInput({
          timestamp: 2,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_HIGH',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 5e6,
          aggressiveSell: 0.5e6,
          delta: 4.5e6,
          cvd: 8.5e6,
          displacementBps: 40,
          bodyEfficiency: 0.75,
          structuralBreak: 'BREAKOUT_CONFIRMED',
          cfg,
        }),
      ],
      cfg,
    );
    expect(ann[0]!.primaryLabel === 'SWEEP_H' || ann[0]!.primaryLabel === 'BREAKOUT' || ann[0]!.primaryLabel === 'BUY_EFFECTIVE').toBe(true);
    expect(['BREAKOUT', 'BULL_EXP', 'BUY_EFFECTIVE']).toContain(ann[1]!.primaryLabel);
    expect(ann.some((a) => a.primaryLabel === 'BUY_ABS' || a.primaryLabel === 'BUY_FAIL' || a.primaryLabel === 'BEAR_RCLM')).toBe(false);
  });
});

describe('absorption without failure', () => {
  it('stays BUY_ABS', () => {
    const ref = { id: 'SH:1', type: 'SWING_HIGH' as const, price: 10 };
    const ann = annotateSequenceReplay(
      [
        buildStageInput({
          timestamp: 1,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_HIGH',
          sweep: 'SWEEP_HIGH',
          aggressiveBuy: 5e6,
          aggressiveSell: 1e6,
          delta: 4e6,
          cvd: 4e6,
          displacementBps: 2,
          bodyEfficiency: 0.2,
          absorptionRaw: 'BUYER_ABSORPTION',
          cfg,
        }),
        buildStageInput({
          timestamp: 2,
          symbol: 'T',
          timeframe: '15m',
          reference: ref,
          location: 'AT_SWING_HIGH',
          sweep: 'NO_SWEEP',
          aggressiveBuy: 4e6,
          aggressiveSell: 1e6,
          delta: 3e6,
          cvd: 7e6,
          displacementBps: 1,
          bodyEfficiency: 0.15,
          absorptionRaw: 'BUYER_ABSORPTION',
          cfg,
        }),
      ],
      cfg,
    );
    expect(ann[1]!.primaryLabel).toBe('BUY_ABS');
    expect(ann[1]!.stages.failure).toBe('NO_FAILURE');
  });
});

describe('sequence id + store', () => {
  it('builds stable sequence ids', () => {
    const id = makeSequenceId('SWING_LOW', 4.74, 1_700_000_000);
    expect(id.startsWith('SWING_LOW_4.7400_')).toBe(true);
  });

  it('one primary label per candle', () => {
    const store = createSequenceStore(cfg);
    const a = processSequenceCandle(
      store,
      buildStageInput({
        timestamp: 1,
        symbol: 'T',
        timeframe: '15m',
        reference: { id: 'SL:1', type: 'SWING_LOW', price: 1 },
        location: 'AT_SWING_LOW',
        sweep: 'SWEEP_LOW',
        aggressiveBuy: 1,
        aggressiveSell: 2,
        delta: -1,
        cvd: -1,
        displacementBps: -5,
        bodyEfficiency: 0.3,
        cfg,
      }),
      cfg,
    );
    expect(typeof a.primaryLabel).toBe('string');
    expect(a.primaryShort.length).toBeGreaterThan(0);
  });
});
