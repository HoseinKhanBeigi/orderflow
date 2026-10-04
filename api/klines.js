/** Tiny Vercel proxy — Binance REST klines are blocked by browser CORS. Live trades still use Binance WSS directly. */
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

    const base =
      market === 'spot' ? 'https://api.binance.com/api/v3/klines' : 'https://fapi.binance.com/fapi/v1/klines';
    const r = await fetch(
      `${base}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
      { headers: { 'User-Agent': 'order-flow-vercel/1.0' } },
    );
    if (!r.ok) {
      res.status(r.status).json([]);
      return;
    }
    const rows = await r.json();
    // Match app.js / venues.ts: [t,o,h,l,c,vol,quote,takerBuyBase]
    const out = (Array.isArray(rows) ? rows : []).map((k) => [
      k[0],
      k[1],
      k[2],
      k[3],
      k[4],
      k[5],
      k[7] ?? '0',
      k[9] ?? null,
    ]);
    res.status(200).json(out);
  } catch {
    res.status(500).json([]);
  }
}
