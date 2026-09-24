export type AssetVenue = 'crypto' | 'equity';

export interface WatchCoin {
  symbol: string;
  label: string;
  minUsd: number;
  venue: AssetVenue;
}

/**
 * Full catalog of coins the UI can enable. Active selection is stored in
 * `data/active-watchlist.json` (or SYMBOLS env) — no more commenting here.
 */
export const WATCHLIST_CATALOG: WatchCoin[] = [
  { symbol: 'ETHUSDT', label: 'ETH', minUsd: 5_000, venue: 'crypto' },
  { symbol: 'AVAXUSDT', label: 'AVAX', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'NEARUSDT', label: 'NEAR', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'DOTUSDT', label: 'DOT', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'SOLUSDT', label: 'SOL', minUsd: 3_000, venue: 'crypto' },
  { symbol: 'LINKUSDT', label: 'LINK', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'XRPUSDT', label: 'XRP', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'DOGEUSDT', label: 'DOGE', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'SUIUSDT', label: 'SUI', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'PAXGUSDT', label: 'PAXG', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'HYPEUSDT', label: 'HYPE', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'PUMPUSDT', label: 'PUMP', minUsd: 500, venue: 'crypto' },
  { symbol: 'PENGUUSDT', label: 'PENGU', minUsd: 500, venue: 'crypto' },
  { symbol: 'OPUSDT', label: 'OP', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'XLMUSDT', label: 'XLM', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'PYTHUSDT', label: 'PYTH', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'TRUMPUSDT', label: 'TRUMP', minUsd: 500, venue: 'crypto' },
  { symbol: 'CROUSDT', label: 'CRO', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'EGLDUSDT', label: 'EGLD', minUsd: 1_000, venue: 'crypto' },
  { symbol: 'ZKCUSDT', label: 'ZKC', minUsd: 500, venue: 'crypto' },
  { symbol: 'TNSRUSDT', label: 'TNSR', minUsd: 500, venue: 'crypto' },
  { symbol: 'JUPUSDT', label: 'JUP', minUsd: 500, venue: 'crypto' },
  { symbol: 'ZAMAUSDT', label: 'ZAMA', minUsd: 500, venue: 'crypto' },
  { symbol: 'WLDUSDT', label: 'WLD', minUsd: 500, venue: 'crypto' },
];

/**
 * Binance USD-M TradFi perpetuals (equity + commodities; same futures WS as crypto).
 * Example: https://www.binance.com/en/futures/AMZNUSDT
 * SpaceX is not listed.
 */
export const EQUITY_PERP_CATALOG: WatchCoin[] = [
  { symbol: 'AAPLUSDT', label: 'AAPL', minUsd: 500, venue: 'equity' },
  { symbol: 'AMZNUSDT', label: 'AMZN', minUsd: 500, venue: 'equity' },
  { symbol: 'METAUSDT', label: 'META', minUsd: 500, venue: 'equity' },
  { symbol: 'MSFTUSDT', label: 'MSFT', minUsd: 500, venue: 'equity' },
  { symbol: 'GOOGLUSDT', label: 'GOOGL', minUsd: 500, venue: 'equity' },
  { symbol: 'TSLAUSDT', label: 'TSLA', minUsd: 500, venue: 'equity' },
  { symbol: 'AMDUSDT', label: 'AMD', minUsd: 500, venue: 'equity' },
  { symbol: 'NVDAUSDT', label: 'NVDA', minUsd: 500, venue: 'equity' },
  { symbol: 'SOXLUSDT', label: 'SOXL', minUsd: 500, venue: 'equity' },
  { symbol: 'CLUSDT', label: 'CL', minUsd: 500, venue: 'equity' },
  { symbol: 'XAGUSDT', label: 'XAG', minUsd: 500, venue: 'equity' },
];

/** Full catalog = crypto + equity. */
export const FULL_WATCHLIST_CATALOG: WatchCoin[] = [...WATCHLIST_CATALOG, ...EQUITY_PERP_CATALOG];

/** Coins that are on when no active-watchlist file / SYMBOLS env exists yet. */
export const DEFAULT_ACTIVE_SYMBOLS = ['NEARUSDT'];

/**
 * Active coins used by the live feed when no file/env override is present.
 * Prefer `resolveWatchlist(activeSymbols)` once the active set is loaded.
 */
export const DEFAULT_WATCHLIST: WatchCoin[] = resolveWatchlist(DEFAULT_ACTIVE_SYMBOLS);

/** @deprecated use EQUITY_PERP_CATALOG */
export const EQUITY_PERP_WATCHLIST = EQUITY_PERP_CATALOG;

/** @deprecated use EQUITY_PERP_CATALOG */
export const STOCK_WATCHLIST = EQUITY_PERP_CATALOG;

export function resolveWatchlist(
  symbols: string[],
  catalog: WatchCoin[] = FULL_WATCHLIST_CATALOG,
): WatchCoin[] {
  const wanted = new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean));
  const fromCatalog = catalog.filter((c) => wanted.has(c.symbol));
  // Allow ad-hoc SYMBOLS env entries that are not in the catalog.
  for (const symbol of wanted) {
    if (fromCatalog.some((c) => c.symbol === symbol)) continue;
    fromCatalog.push({
      symbol,
      label: symbol.replace(/USDT$/, ''),
      minUsd: 1_000,
      venue: 'crypto',
    });
  }
  return fromCatalog;
}

export function minUsdFor(
  symbol: string,
  list: WatchCoin[] = FULL_WATCHLIST_CATALOG,
): number {
  return list.find((c) => c.symbol === symbol)?.minUsd ?? 1_000;
}
