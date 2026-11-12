import { clamp } from '../core/integrity.js';

/** The few readings the next-candle model is allowed to see. */
export interface NextCandleFeatures {
  ok: boolean;
  /** Positive leans up. Already weighted. */
  score: number;
  /** Positive means offers were consumed more than bids. */
  book: number;
}

export interface NextCandleSource {
  priceChangePercent: number;
  marketFuel: {
    dataStatus: string;
    upsideFuel: number | null;
    downsideFuel: number | null;
    fuelImbalance: number | null;
  } | null;
  marketBattle: {
    upside: { aggressive: { power: number } };
    downside: { aggressive: { power: number } };
  } | null;
  liquidityResponse: {
    askConsumption: string;
    bidConsumption: string;
    askReplenishment: string;
    bidReplenishment: string;
    effort: string;
    absorption?: { kind: string | null } | null;
  } | null;
  absorption: {
    detected: boolean;
    type: string | null;
  } | null;
}

function intensity(label: string | undefined | null): number {
  if (label === 'EXTREME') return 90;
  if (label === 'HIGH') return 75;
  if (label === 'NORMAL') return 45;
  if (label === 'LOW') return 25;
  return 0;
}

/**
 * One score from fuel lead, control, whether the book gave way,
 * whether price already followed, and whether the push was absorbed.
 * Other metrics are left out on purpose: they describe the same push.
 */
export function featuresFromSnapshot(snap: NextCandleSource): NextCandleFeatures {
  const fuel = snap.marketFuel;
  if (
    !fuel ||
    fuel.dataStatus === 'NO_DATA' ||
    fuel.dataStatus === 'STALE_DATA' ||
    fuel.upsideFuel == null
  ) {
    return { ok: false, score: 0, book: 0 };
  }

  const edge = clamp(
    fuel.fuelImbalance ?? fuel.upsideFuel - (fuel.downsideFuel ?? 0),
    -100,
    100,
  );
  const buy = snap.marketBattle?.upside.aggressive.power ?? 0;
  const sell = snap.marketBattle?.downside.aggressive.power ?? 0;
  const control = clamp((buy - sell) / 100, -1, 1);

  const lr = snap.liquidityResponse;
  const askGave = intensity(lr?.askConsumption) - intensity(lr?.askReplenishment);
  const bidGave = intensity(lr?.bidConsumption) - intensity(lr?.bidReplenishment);
  const book = clamp((askGave - bidGave) / 90, -1, 1);

  const pct = snap.priceChangePercent;
  const follow = (pct > 0.02 ? 1 : 0) - (pct < -0.02 ? 1 : 0);

  const buyerAbsorbed =
    (snap.absorption?.detected === true && snap.absorption.type === 'BUYER_ABSORPTION') ||
    lr?.absorption?.kind === 'BUY_ABSORPTION' ||
    lr?.effort === 'BUY_ABSORPTION';
  const sellerAbsorbed =
    (snap.absorption?.detected === true && snap.absorption.type === 'SELLER_ABSORPTION') ||
    lr?.absorption?.kind === 'SELL_ABSORPTION' ||
    lr?.effort === 'SELL_ABSORPTION';
  const absorb = (sellerAbsorbed ? 1 : 0) - (buyerAbsorbed ? 1 : 0);

  const score = 0.045 * edge + 1.1 * control + 0.8 * book + 0.7 * follow + 0.6 * absorb;
  return { ok: true, score, book };
}
