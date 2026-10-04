# orderflow

Real-time crypto order-flow dashboard.

## Local (Node server)

```bash
npm install
npm start
```

## Vercel (browser feeds)

```bash
npm run build:client
vercel
```

On Vercel the UI runs live Binance WebSockets in the browser. Watchlist is stored in `localStorage`. `/api/depth` and `/api/klines` are small proxies for exchange REST (CORS).
