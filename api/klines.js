/**
 * Kline backfill proxy (browser CORS).
 * Binance often returns 451 from US Vercel IPs — try Binance first, then Bybit.
 */

const BYBIT_INTERVAL = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '1d': 'D',
};

function mapBinance(rows) {
  return (Array.isArray(rows) ? rows : []).map((k) => [
    k[0],
    k[1],
    k[2],
    k[3],
    k[4],
    k[5],
    k[7] ?? '0',
    k[9] ?? null,
  ]);
}

/** Bybit list rows: [start, open, high, low, close, volume, turnover] newest-first. */
function mapBybit(list) {
  const rows = (Array.isArray(list) ? list : [])
    .map((k) => [Number(k[0]), k[1], k[2], k[3], k[4], k[5], k[6] ?? '0', null])
    .filter((k) => Number.isFinite(k[0]));
  rows.sort((a, b) => a[0] - b[0]);
  return rows;
}

async function fetchBinance(symbol, market, interval, limit) {
  const base =
    market === 'spot' ? 'https://api.binance.com/api/v3/klines' : 'https://fapi.binance.com/fapi/v1/klines';
  const r = await fetch(
    `${base}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
    { headers: { 'User-Agent': 'order-flow-vercel/1.0' } },
  );
  if (!r.ok) {
    const err = new Error(`binance ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return mapBinance(await r.json());
}

async function fetchBybit(symbol, market, interval, limit) {
  const category = market === 'spot' ? 'spot' : 'linear';
  const bybitIv = BYBIT_INTERVAL[interval] ?? interval.replace(/m$/, '').replace('h', '');
  const r = await fetch(
    `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(bybitIv)}&limit=${Math.min(limit, 200)}`,
    { headers: { 'User-Agent': 'order-flow-vercel/1.0' } },
  );
  if (!r.ok) {
    const err = new Error(`bybit ${r.status}`);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  return mapBybit(data?.result?.list);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
    const market = url.searchParams.get('market') === 'spot' ? 'spot' : 'perp';
    const interval = url.searchParams.get('interval') || '5m';
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 300));

    try {
      const rows = await fetchBinance(symbol, market, interval, limit);
      res.status(200).json(rows);
      return;
    } catch (binanceErr) {
      // 451 = Binance geo-block (common on US Vercel IPs)
      console.warn('[klines] binance failed, trying bybit:', binanceErr?.message || binanceErr);
    }

    const rows = await fetchBybit(symbol, market, interval, limit);
    res.status(200).json(rows);
  } catch (err) {
    console.error('[klines]', err);
    res.status(502).json([]);
  }
}
