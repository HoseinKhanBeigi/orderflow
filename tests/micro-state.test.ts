import { describe, expect, it } from 'vitest';
import {
  annotateBarMicroState,
  annotateBarsMicroState,
  detectAcceptance,
  detectContinuation,
  detectMove,
  detectNoProgress,
  detectRejection,
  mergeMicroStateConfig,
  selectSecondaryLabels,
  MICRO_LABEL_SHORT,
} from '../src/micro-state/index.js';
import type { MicroBarInput, MicroCandidate } from '../src/micro-state/types.js';

const cfg = mergeMicroStateConfig({
  moveMinBps: 15,
  npEffortHigh: 60,
  npMaxDispBps: 8,
  npResultWeak: 30,
  contMinBps: 12,
  maxSecondaryLabels: 2,
});

function bar(partial: Partial<MicroBarInput> & Pick<MicroBarInput, 'time'>): MicroBarInput {
  return {
    open: 100,
    high: 101,
    low: 99,
    close: 100.2,
    aggressiveBuy: 1e6,
    aggressiveSell: 1e6,
    delta: 0,
    displacementBps: 0,
    bodyEfficiency: 0.5,
    ...partial,
  };
}

describe('micro-state MOVE', () => {
  it('labels MOVE ↑ when displacement is meaningful', () => {
    const c = detectMove(
      bar({ time: 1, displacementBps: 38, bodyEfficiency: 0.55, close: 100.38, open: 100 }),
      cfg,
    );
    expect(c?.label).toBe('MOVE_UP');
    expect(MICRO_LABEL_SHORT.MOVE_UP).toBe('MOVE ↑');
  });

  it('labels MOVE ↓ for meaningful downside', () => {
    const c = detectMove(
      bar({ time: 1, displacementBps: -40, bodyEfficiency: 0.6, close: 99.6, open: 100 }),
      cfg,
    );
    expect(c?.label).toBe('MOVE_DOWN');
  });

  it('does not label tiny noise as MOVE', () => {
    expect(detectMove(bar({ time: 1, displacementBps: 5, bodyEfficiency: 0.9 }), cfg)).toBeNull();
    expect(detectMove(bar({ time: 1, displacementBps: 40, bodyEfficiency: 0.1 }), cfg)).toBeNull();
  });
});

describe('micro-state CONT', () => {
  it('requires prior directional context', () => {
    expect(
      detectContinuation(
        bar({ time: 2, displacementBps: 25, priorDirection: 'NONE', close: 100.25, open: 100 }),
        cfg,
      ),
    ).toBeNull();
  });

  it('labels CONT ↑ after prior UP context', () => {
    const c = detectContinuation(
      bar({
        time: 2,
        displacementBps: 22,
        priorDirection: 'UP',
        open: 100,
        high: 100.4,
        low: 99.95,
        close: 100.25,
      }),
      cfg,
    );
    expect(c?.label).toBe('CONT_UP');
  });

  it('labels CONT ↓ after prior DOWN context', () => {
    const c = detectContinuation(
      bar({
        time: 2,
        displacementBps: -22,
        priorDirection: 'DOWN',
        open: 100,
        high: 100.05,
        low: 99.6,
        close: 99.75,
      }),
      cfg,
    );
    expect(c?.label).toBe('CONT_DOWN');
  });
});

describe('micro-state NP', () => {
  it('labels BUYER NP on high buy effort with weak up result', () => {
    const c = detectNoProgress(
      bar({
        time: 1,
        aggressiveBuy: 9e6,
        aggressiveSell: 1e6,
        delta: 8e6,
        displacementBps: 3,
        buyEffort: 88,
        upResult: 11,
      }),
      cfg,
    );
    expect(c?.label).toBe('BUYER_NO_PROGRESS');
    expect(String(c?.detail.note)).toMatch(/not automatic absorption/i);
  });

  it('labels SELLER NP mirror', () => {
    const c = detectNoProgress(
      bar({
        time: 1,
        aggressiveBuy: 1e6,
        aggressiveSell: 9e6,
        delta: -8e6,
        displacementBps: -2,
        sellEffort: 90,
        downResult: 10,
      }),
      cfg,
    );
    expect(c?.label).toBe('SELLER_NO_PROGRESS');
  });

  it('does not auto-create absorption from NP', () => {
    const ann = annotateBarMicroState(
      bar({
        time: 1,
        aggressiveBuy: 9e6,
        aggressiveSell: 1e6,
        delta: 8e6,
        displacementBps: 2,
        buyEffort: 90,
        upResult: 10,
      }),
      cfg,
    );
    expect(ann.secondaryLabels).toContain('BUYER_NO_PROGRESS');
    expect(ann.secondaryLabels.join(' ')).not.toMatch(/ABSORP/);
  });
});

describe('micro-state REJECT', () => {
  it('labels REJECT ↑ at swing high when excursion closes back below', () => {
    const c = detectRejection(
      bar({
        time: 1,
        open: 5.01,
        high: 5.035,
        low: 5.005,
        close: 5.012,
        displacementBps: 4,
        bodyEfficiency: 0.2,
        references: [{ kind: 'SWING_HIGH', price: 5.02 }],
      }),
      cfg,
    );
    expect(c?.label).toBe('REJECT_UP');
  });

  it('labels REJECT ↓ at swing low', () => {
    const c = detectRejection(
      bar({
        time: 1,
        open: 4.75,
        high: 4.76,
        low: 4.725,
        close: 4.748,
        displacementBps: -4,
        bodyEfficiency: 0.2,
        references: [{ kind: 'SWING_LOW', price: 4.74 }],
      }),
      cfg,
    );
    expect(c?.label).toBe('REJECT_DOWN');
  });
});

describe('micro-state ACCEPT', () => {
  it('does not treat wick-only penetration as acceptance', () => {
    const c = detectAcceptance(
      bar({
        time: 1,
        open: 5.01,
        high: 5.04,
        low: 5.0,
        close: 5.015,
        displacementBps: 10,
        bodyEfficiency: 0.2,
        references: [{ kind: 'RESISTANCE', price: 5.02, zoneLow: 5.02, zoneHigh: 5.03 }],
      }),
      cfg,
    );
    expect(c).toBeNull();
  });

  it('labels ACCEPT ↑ after close/follow-through above zone', () => {
    const c = detectAcceptance(
      bar({
        time: 1,
        open: 5.025,
        high: 5.05,
        low: 5.022,
        close: 5.045,
        displacementBps: 40,
        bodyEfficiency: 0.7,
        references: [{ kind: 'RESISTANCE', price: 5.02, zoneLow: 5.02, zoneHigh: 5.03 }],
      }),
      cfg,
    );
    expect(c?.label).toBe('ACCEPT_UP');
  });

  it('labels ACCEPT ↓ after close below support', () => {
    const c = detectAcceptance(
      bar({
        time: 1,
        open: 4.73,
        high: 4.735,
        low: 4.7,
        close: 4.71,
        displacementBps: -42,
        bodyEfficiency: 0.65,
        references: [{ kind: 'SUPPORT', price: 4.74, zoneLow: 4.735, zoneHigh: 4.745 }],
      }),
      cfg,
    );
    expect(c?.label).toBe('ACCEPT_DOWN');
  });
});

describe('micro-state selection', () => {
  it('caps at two secondary labels and respects priority', () => {
    const cands: MicroCandidate[] = [
      { label: 'MOVE_UP', score: 40, detail: {} },
      { label: 'CONT_UP', score: 50, detail: {} },
      { label: 'ACCEPT_UP', score: 90, detail: {} },
      { label: 'BUYER_NO_PROGRESS', score: 80, detail: {} },
    ];
    const picked = selectSecondaryLabels(cands, cfg);
    expect(picked.length).toBeLessThanOrEqual(2);
    expect(picked[0]?.label).toBe('ACCEPT_UP');
    // CONT suppresses MOVE
    expect(picked.map((p) => p.label)).not.toContain('MOVE_UP');
  });

  it('collapses MOVE when CONT confirmed', () => {
    const picked = selectSecondaryLabels(
      [
        { label: 'MOVE_UP', score: 40, detail: {} },
        { label: 'CONT_UP', score: 55, detail: {} },
      ],
      cfg,
    );
    expect(picked.map((p) => p.label)).toEqual(['CONT_UP']);
  });

  it('rejects ACCEPT+REJECT same direction', () => {
    const picked = selectSecondaryLabels(
      [
        { label: 'ACCEPT_UP', score: 90, detail: {} },
        { label: 'REJECT_UP', score: 80, detail: {} },
      ],
      cfg,
    );
    expect(picked.map((p) => p.label)).toEqual(['ACCEPT_UP']);
  });
});

describe('micro-state replay', () => {
  it('has no lookahead — later CONT does not rewrite prior candle', () => {
    const bars: MicroBarInput[] = [
      bar({
        time: 1,
        displacementBps: 30,
        bodyEfficiency: 0.5,
        open: 100,
        close: 100.3,
        high: 100.35,
        low: 99.9,
      }),
      bar({
        time: 2,
        displacementBps: 20,
        bodyEfficiency: 0.5,
        open: 100.3,
        close: 100.5,
        high: 100.55,
        low: 100.28,
        priorDirection: 'UP',
      }),
    ];
    const once = annotateBarsMicroState(bars, { cfg });
    const twice = annotateBarsMicroState(bars, { cfg });
    expect(once[0]?.secondaryLabels).toEqual(twice[0]?.secondaryLabels);
    expect(once[0]?.secondaryLabels).toContain('MOVE_UP');
    expect(once[1]?.secondaryLabels).toContain('CONT_UP');
    // first candle frozen without CONT
    expect(once[0]?.secondaryLabels).not.toContain('CONT_UP');
  });

  it('marks open candle provisional', () => {
    const ann = annotateBarMicroState(
      bar({ time: 9, incomplete: true, displacementBps: 30, bodyEfficiency: 0.5 }),
      cfg,
    );
    expect(ann.status).toBe('PROVISIONAL');
  });
});
