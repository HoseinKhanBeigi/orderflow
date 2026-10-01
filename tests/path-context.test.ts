import { describe, expect, it } from 'vitest';
import {
  evaluatePathContext,
  nextResistanceAbove,
  resistanceBreakStateOf,
  emptyPathContext,
} from '../src/path-context/index.js';
import type { PathZoneRef } from '../src/path-context/index.js';

function zone(center: number, strength: number, major = true, tf = '15m'): PathZoneRef {
  const half = center * 0.001;
  return {
    center,
    zoneLow: center - half,
    zoneHigh: center + half,
    strength,
    major,
    timeframe: tf,
  };
}

describe('nextResistanceAbove', () => {
  it('finds single resistance above price', () => {
    const { zone: z } = nextResistanceAbove([zone(5.0, 65)], 4.9, true, 62);
    expect(z?.center).toBe(5.0);
  });

  it('picks nearest of multiple resistances', () => {
    const { zone: z } = nextResistanceAbove([zone(5.2, 70), zone(5.0, 65), zone(5.5, 80)], 4.9, true, 62);
    expect(z?.center).toBe(5.0);
  });

  it('reports filtered minor when major-only', () => {
    const { zone: z, filteredMinorExists } = nextResistanceAbove(
      [zone(5.0, 40, false)],
      4.9,
      true,
      62,
    );
    expect(z).toBeNull();
    expect(filteredMinorExists).toBe(true);
  });
});

describe('evaluatePathContext', () => {
  it('NONE_DETECTED when no qualified historical resistance — not "no resistance"', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [],
      historicalSupports: [],
      liveAsk: { price: 5.04, strength: 74 },
      askLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
    });
    expect(snap.upside.historicalStatus).toBe('NONE_DETECTED');
    expect(snap.upside.liveAskDefense?.price).toBe(5.04);
    expect(snap.upside.nextObstacle.type).toBe('LIVE_ASK_DEFENSE');
    expect(snap.upside.interpretation.toLowerCase()).not.toContain('no resistance');
    expect(snap.upside.interpretation.toLowerCase()).toContain('live ask');
  });

  it('minor levels hidden reason', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [zone(5.0, 40, false)],
      historicalSupports: [],
      minorLevelsHidden: true,
      liveAsk: null,
      askLiquidityPresent: false,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
    });
    expect(snap.upside.historicalStatus).toBe('NONE_DETECTED');
    expect(snap.upside.historicalReason).toBe('FILTERED_AS_MINOR');
    expect(snap.upside.historicalReasonLabel || '').toMatch(/Minor levels hidden/i);
  });

  it('higher-TF resistance when available', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [zone(5.0, 65)],
      historicalSupports: [],
      higherTfAvailable: true,
      higherTfResistances: [zone(5.12, 81, true, '1h')],
      liveAsk: { price: 5.04, strength: 68 },
      liveBookQuality: 'GOOD',
    });
    expect(snap.upside.higherTfStatus).toBe('FOUND');
    expect(snap.upside.higherTimeframeResistance?.center).toBe(5.12);
  });

  it('higher-TF unavailable when not loaded', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [],
      historicalSupports: [],
      higherTfAvailable: false,
      liveBookQuality: 'GOOD',
    });
    expect(snap.upside.higherTfStatus).toBe('HIGHER_TF_NOT_AVAILABLE');
  });

  it('live ask disappears → not preserved as structure', () => {
    const withAsk = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [],
      historicalSupports: [],
      liveAsk: { price: 5.04, strength: 74 },
      askLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
    });
    expect(withAsk.upside.nextObstacle.type).toBe('LIVE_ASK_DEFENSE');
    const gone = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 2,
      historicalResistances: [],
      historicalSupports: [],
      liveAsk: null,
      askLiquidityPresent: false,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
    });
    expect(gone.upside.liveAskDefense).toBeNull();
    expect(gone.upside.nextObstacle.type).toBe('NONE_DETECTED');
  });

  it('stale book → LIVE LIQUIDITY UNKNOWN / quality UNKNOWN', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.91,
      timestamp: 1,
      historicalResistances: [],
      historicalSupports: [],
      liveAsk: { price: 5.04, strength: 90 },
      askLiquidityPresent: true,
      liveBookQuality: 'STALE',
      higherTfAvailable: false,
    });
    expect(snap.upside.liveAskDefense).toBeNull();
    expect(snap.upside.quality).toBe('UNKNOWN');
    expect(snap.upside.nextObstacle.sourceLabel).toMatch(/UNKNOWN/i);
  });

  it('resistance rejection vs broken', () => {
    expect(
      resistanceBreakStateOf({
        locationState: 'INSIDE_RESISTANCE',
        interactionState: 'REJECTED',
        current: zone(5, 65),
        price: 4.98,
      }),
    ).toBe('REJECTED');
    expect(
      resistanceBreakStateOf({
        locationState: 'ABOVE_RESISTANCE',
        interactionState: 'ACCEPTED_THROUGH',
        current: zone(5, 65),
        price: 5.02,
      }),
    ).toBe('ACCEPTED_ABOVE');
  });

  it('breaking strong resistance with live asks → contested / structural breakout language', () => {
    const snap = evaluatePathContext({
      currentPrice: 5.018,
      timestamp: 1,
      historicalResistances: [zone(5.0, 65)],
      historicalSupports: [],
      locationState: 'ABOVE_RESISTANCE',
      interactionState: 'ACCEPTED_THROUGH',
      liveAsk: { price: 5.04, strength: 74 },
      askLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      buyAttack: 84,
      upResult: 70,
      higherTfAvailable: false,
      minorLevelsHidden: true,
    });
    expect(['BROKEN', 'ACCEPTED_ABOVE']).toContain(snap.upside.resistanceState);
    expect(snap.upside.interpretation).toMatch(/live sell liquidity|next obstacle|break/i);
    expect(snap.upside.quality).not.toBe('RELATIVELY_OPEN');
  });

  it('relatively open when broken and thin asks', () => {
    const snap = evaluatePathContext({
      currentPrice: 5.02,
      timestamp: 1,
      historicalResistances: [zone(5.0, 65)],
      historicalSupports: [],
      locationState: 'ABOVE_RESISTANCE',
      interactionState: 'ACCEPTED_THROUGH',
      liveAsk: { price: 5.2, strength: 25 },
      askLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      buyAttack: 80,
      upResult: 70,
      higherTfAvailable: false,
    });
    // next hist may still be none above if broken zone is below price
    expect(['RELATIVELY_OPEN', 'MODERATELY_OPEN', 'CONTESTED']).toContain(snap.upside.quality);
    expect(String(snap.upside.quality)).not.toMatch(/FREE|CLEAR|NO_RESISTANCE/);
  });

  it('historical + live confluence', () => {
    const snap = evaluatePathContext({
      currentPrice: 4.95,
      timestamp: 1,
      historicalResistances: [zone(5.04, 70)],
      historicalSupports: [],
      liveAsk: { price: 5.041, strength: 72 },
      askLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
      minorLevelsHidden: false,
    });
    expect(snap.upside.confluence).toBe('RESISTANCE_CONFLUENCE_HIGH');
  });

  it('downside mirror — live bid as next obstacle', () => {
    const snap = evaluatePathContext({
      currentPrice: 5.0,
      timestamp: 1,
      historicalResistances: [],
      historicalSupports: [],
      liveBid: { price: 4.87, strength: 78 },
      bidLiquidityPresent: true,
      liveBookQuality: 'GOOD',
      higherTfAvailable: false,
    });
    expect(snap.downside.historicalStatus).toBe('NONE_DETECTED');
    expect(snap.downside.nextObstacle.type).toBe('LIVE_BID_DEFENSE');
  });

  it('empty path context defaults', () => {
    const e = emptyPathContext(0, 0);
    expect(e.upside.historicalStatus).toBe('NONE_DETECTED');
    expect(e.upside.higherTfStatus).toBe('HIGHER_TF_NOT_AVAILABLE');
  });
});
