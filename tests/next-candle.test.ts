import { describe, expect, it } from 'vitest';
import { featuresFromSnapshot, NextCandleModel, type NextCandleFeatures } from '../src/next-candle/index.js';

const upWith: NextCandleFeatures = { ok: true, score: 1.2, book: 0.6 };
const quietLean: NextCandleFeatures = { ok: true, score: 0.1, book: 0 };
const noData: NextCandleFeatures = { ok: false, score: 0, book: 0 };

function drive(
  model: NextCandleModel,
  minutes: number,
  priceAt: (minute: number) => number,
  features: NextCandleFeatures,
) {
  let call = model.current();
  for (let minute = 0; minute <= minutes; minute++) {
    call = model.observe(features, priceAt(minute), minute * 60_000);
  }
  return call;
}

describe('next candle model', () => {
  it('stays quiet until the same setup has 12 finished candles', () => {
    const model = new NextCandleModel();
    const early = drive(model, 12, (minute) => 100 + minute, upWith);
    expect(early.shown).toBe(false);
    expect(early.samples).toBe(11);

    const ready = model.observe(upWith, 113, 13 * 60_000);
    expect(ready.shown).toBe(true);
    expect(ready.direction).toBe('UP');
    expect(ready.probability).toBe(100);
    expect(ready.samples).toBe(12);
  });

  it('stays quiet when the next candle is up only half the time', () => {
    const model = new NextCandleModel();
    const call = drive(model, 20, (minute) => 100 + (minute % 2), upWith);
    expect(call.shown).toBe(false);
    expect(call.samples).toBeGreaterThanOrEqual(12);
    expect(call.note).toMatch(/stays quiet/);
  });

  it('does not change the call inside the same minute', () => {
    const model = new NextCandleModel();
    const first = model.observe(upWith, 100, 0);
    const again = model.observe(upWith, 130, 30_000);
    expect(again).toBe(first);
    expect(again.shown).toBe(false);
  });

  it('hides a setup after its shown calls fall below half right', () => {
    const model = new NextCandleModel();
    drive(model, 13, (minute) => 100 + minute, upWith);
    expect(model.current().shown).toBe(true);

    let call = model.current();
    for (let minute = 14; minute <= 21; minute++) {
      call = model.observe(upWith, 113 - (minute - 13), minute * 60_000);
    }
    expect(call.shown).toBe(false);
    expect(call.note).toMatch(/Recent calls/);
  });

  it('counts a flat candle as not an up candle', () => {
    const model = new NextCandleModel();
    const call = drive(model, 16, () => 100, upWith);
    expect(call.shown).toBe(false);
    expect(call.direction).toBe(null);
  });

  it('stays quiet when fuel and the book do not lean', () => {
    const model = new NextCandleModel();
    const call = drive(model, 20, (minute) => 100 + minute, quietLean);
    expect(call.shown).toBe(false);
    expect(call.note).toMatch(/do not lean/);
  });

  it('does not file the next candle when the minute had no trades', () => {
    const model = new NextCandleModel();
    drive(model, 3, (minute) => 100 + minute, upWith);
    const learned = model.current().samples;
    model.observe(noData, 110, 4 * 60_000);
    const next = model.observe(upWith, 111, 5 * 60_000);
    expect(next.samples).toBe(learned + 1);
  });
});

describe('next candle features', () => {
  it('leans up when buy fuel leads, offers give way, and price already followed', () => {
    const features = featuresFromSnapshot({
      priceChangePercent: 0.08,
      marketFuel: {
        dataStatus: 'OK',
        upsideFuel: 70,
        downsideFuel: 30,
        fuelImbalance: 40,
      },
      marketBattle: {
        upside: { aggressive: { power: 75 } },
        downside: { aggressive: { power: 25 } },
      },
      liquidityResponse: {
        askConsumption: 'HIGH',
        askReplenishment: 'LOW',
        bidConsumption: 'LOW',
        bidReplenishment: 'HIGH',
        effort: 'EFFICIENT_BUYING',
        absorption: { kind: null },
      },
      absorption: { detected: false, type: null },
    });
    expect(features.ok).toBe(true);
    expect(features.score).toBeGreaterThan(0.35);
    expect(features.book).toBeGreaterThan(0);
  });

  it('ignores a feed with no fuel', () => {
    const features = featuresFromSnapshot({
      priceChangePercent: 0.2,
      marketFuel: { dataStatus: 'NO_DATA', upsideFuel: null, downsideFuel: null, fuelImbalance: null },
      marketBattle: null,
      liquidityResponse: null,
      absorption: null,
    });
    expect(features.ok).toBe(false);
  });
});
