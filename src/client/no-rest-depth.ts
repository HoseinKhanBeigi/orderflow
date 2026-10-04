import type { ExchangeId, VenueDepth } from '../exchange/venues.js';
import type { MarketType } from '../models/trade.js';

/** Browser builds must never call Binance REST /depth (CORS + request storms). */
export async function fetchVenueDepth(
  _exchange: ExchangeId,
  _symbol: string,
  _market: MarketType,
  _limit = 100,
): Promise<VenueDepth> {
  return { bids: [], asks: [] };
}
