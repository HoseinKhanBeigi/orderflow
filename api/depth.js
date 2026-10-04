/** Vercel serverless proxy — exchange REST depth is blocked by browser CORS. */
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
    const limit = Math.min(500, Math.max(5, Number(url.searchParams.get('limit')) || 500));
    const exchange = (url.searchParams.get('exchange') || 'binance').toLowerCase();

    if (exchange !== 'binance') {
      res.status(200).json({ bids: [], asks: [] });
      return;
    }

    const base =
      market === 'spot' ? 'https://api.binance.com/api/v3/depth' : 'https://fapi.binance.com/fapi/v1/depth';
    const r = await fetch(`${base}?symbol=${encodeURIComponent(symbol)}&limit=${limit}`, {
      headers: { 'User-Agent': 'order-flow-vercel/1.0' },
    });
    if (!r.ok) {
      res.status(r.status).json({ error: `upstream ${r.status}`, bids: [], asks: [] });
      return;
    }
    const data = await r.json();
    res.status(200).json({
      lastUpdateId: data.lastUpdateId,
      bids: data.bids ?? [],
      asks: data.asks ?? [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'depth failed',
      bids: [],
      asks: [],
    });
  }
}
