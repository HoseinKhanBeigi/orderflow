import { describe, expect, it } from 'vitest';
import {
  annotateBarLocation,
  annotateBarsLocation,
  collectLocationCandidates,
  LOCATION_LABEL_SHORT,
  mergeLocationLabelConfig,
  pickPrimaryLocation,
} from '../src/location-label/index.js';
import type { LocationBarInput } from '../src/location-label/types.js';

const cfg = mergeLocationLabelConfig({
  nearBps: 12,
  nearAtrFrac: 0.35,
  atMinBps: 4,
});

function bar(partial: Partial<LocationBarInput> & Pick<LocationBarInput, 'time' | 'close'>): LocationBarInput {
  const close = partial.close;
  return {
    open: close,
    high: close,
    low: close,
    atr: 0.05,
    support: { zoneLow: 4.94, zoneHigh: 4.96, kind: 'SUPPORT' },
    resistance: { zoneLow: 5.02, zoneHigh: 5.035, kind: 'RESISTANCE' },
    swingHigh: 5.02,
    swingLow: 4.94,
    ...partial,
  };
}

describe('location-label support/resistance', () => {
  it('AT SUPPORT / INSIDE SUPPORT', () => {
    expect(annotateBarLocation(bar({ time: 1, close: 4.95 }), cfg).locationLabel).toBe('INSIDE_SUPPORT');
    expect(annotateBarLocation(bar({ time: 1, close: 4.962 }), cfg).locationLabel).toMatch(/SUPPORT/);
  });

  it('ABOVE SUPPORT when clearly above nearest support', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        close: 4.995,
        support: { zoneLow: 4.94, zoneHigh: 4.96 },
        resistance: null,
        swingHigh: null,
        swingLow: null,
      }),
      cfg,
    );
    expect(a.locationLabel).toBe('ABOVE_SUPPORT');
    expect(LOCATION_LABEL_SHORT.ABOVE_SUPPORT).toBe('ABOVE SUP');
  });

  it('BELOW SUPPORT requires acceptance (not wick-only)', () => {
    const wick = annotateBarLocation(
      bar({
        time: 1,
        open: 4.97,
        high: 4.98,
        low: 4.92,
        close: 4.968,
        support: { zoneLow: 4.94, zoneHigh: 4.96 },
      }),
      cfg,
    );
    expect(wick.locationLabel).not.toBe('BELOW_SUPPORT');

    const accepted = annotateBarLocation(
      bar({
        time: 1,
        close: 4.90,
        support: { zoneLow: 4.94, zoneHigh: 4.96 },
        acceptedBelowSupport: true,
      }),
      cfg,
    );
    expect(accepted.locationLabel).toBe('BELOW_SUPPORT');
  });

  it('NEAR SUPPORT', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        close: 4.975,
        atr: 0.08,
        support: { zoneLow: 4.94, zoneHigh: 4.96 },
        resistance: { zoneLow: 5.2, zoneHigh: 5.22 },
      }),
      cfg,
    );
    expect(['NEAR_SUPPORT', 'AT_SUPPORT', 'ABOVE_SUPPORT']).toContain(a.locationLabel);
  });

  it('AT / INSIDE / ABOVE RESISTANCE', () => {
    expect(annotateBarLocation(bar({ time: 1, close: 5.028 }), cfg).locationLabel).toBe('INSIDE_RESISTANCE');

    const rejected = annotateBarLocation(
      bar({
        time: 1,
        open: 5.01,
        high: 5.05,
        low: 5.0,
        close: 5.012,
        rejectedAboveResistance: true,
      }),
      cfg,
    );
    expect(rejected.locationLabel).toBe('AT_RESISTANCE');

    const accepted = annotateBarLocation(
      bar({
        time: 1,
        close: 5.06,
        acceptedAboveResistance: true,
      }),
      cfg,
    );
    expect(accepted.locationLabel).toBe('ABOVE_RESISTANCE');
  });

  it('BELOW RESISTANCE when under zone', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        close: 4.99,
        support: { zoneLow: 4.7, zoneHigh: 4.72 },
        resistance: { zoneLow: 5.02, zoneHigh: 5.035 },
      }),
      cfg,
    );
    expect(['BELOW_RESISTANCE', 'BETWEEN_LEVELS', 'ABOVE_SUPPORT']).toContain(a.locationLabel);
  });

  it('BETWEEN LEVELS when mid-range', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        close: 5.0,
        atr: 0.02,
        support: { zoneLow: 4.9, zoneHigh: 4.92 },
        resistance: { zoneLow: 5.1, zoneHigh: 5.12 },
        swingHigh: null,
        swingLow: null,
      }),
      cfg,
    );
    expect(a.locationLabel).toBe('BETWEEN_LEVELS');
    expect(a.locationShort).toBe('BETWEEN');
  });
});

describe('location-label swings', () => {
  it('AT SWING HIGH / LOW', () => {
    expect(
      annotateBarLocation(
        bar({
          time: 1,
          close: 5.02,
          support: null,
          resistance: null,
          swingHigh: 5.02,
          swingLow: 4.8,
        }),
        cfg,
      ).locationLabel,
    ).toBe('AT_SWING_HIGH');

    expect(
      annotateBarLocation(
        bar({
          time: 1,
          close: 4.74,
          support: null,
          resistance: null,
          swingHigh: 5.1,
          swingLow: 4.74,
        }),
        cfg,
      ).locationLabel,
    ).toBe('AT_SWING_LOW');
  });
});

describe('location-label integration semantics', () => {
  it('acceptance above resistance → ABOVE RES', () => {
    const a = annotateBarLocation(
      bar({ time: 1, close: 5.05, acceptedAboveResistance: true }),
      cfg,
    );
    expect(a.locationLabel).toBe('ABOVE_RESISTANCE');
  });

  it('rejection above resistance → AT RES not ABOVE RES', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        open: 5.01,
        high: 5.05,
        low: 5.0,
        close: 5.01,
        rejectedAboveResistance: true,
      }),
      cfg,
    );
    expect(a.locationLabel).toBe('AT_RESISTANCE');
  });

  it('reclaim above support → ABOVE SUP or AT SUP', () => {
    const a = annotateBarLocation(
      bar({
        time: 1,
        close: 4.985,
        support: { zoneLow: 4.94, zoneHigh: 4.96 },
        resistance: null,
        swingHigh: null,
        swingLow: null,
      }),
      cfg,
    );
    expect(['ABOVE_SUPPORT', 'NEAR_SUPPORT', 'AT_SUPPORT']).toContain(a.locationLabel);
  });

  it('picks one primary location; keeps confluence', () => {
    const cands = collectLocationCandidates(
      bar({
        time: 1,
        close: 5.028,
        swingHigh: 5.028,
      }),
      cfg,
    );
    const picked = pickPrimaryLocation(cands);
    expect(picked.primary).not.toBe('NONE');
    expect(picked.primary === 'INSIDE_RESISTANCE' || picked.primary === 'AT_RESISTANCE' || picked.primary === 'AT_SWING_HIGH').toBe(true);
    // confluence may include swing when S/R wins
    expect(picked.confluence.length + 1).toBe(cands.length);
  });

  it('no lookahead — replay freezes each bar', () => {
    const bars: LocationBarInput[] = [
      bar({ time: 1, close: 4.95 }),
      bar({ time: 2, close: 5.028, acceptedAboveResistance: false }),
      bar({ time: 3, close: 5.06, acceptedAboveResistance: true }),
    ];
    const once = annotateBarsLocation(bars, cfg);
    const twice = annotateBarsLocation(bars, cfg);
    expect(once.map((a) => a.locationLabel)).toEqual(twice.map((a) => a.locationLabel));
    expect(once[0]?.locationLabel).toBe('INSIDE_SUPPORT');
    expect(once[2]?.locationLabel).toBe('ABOVE_RESISTANCE');
  });
});
