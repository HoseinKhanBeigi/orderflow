# Displacement / CVD Audit

Audit of how displacement, candle delta, CVD, and aggressive buy/sell are calculated today — before changing chart behavior.

## Summary

| Metric | Location | Status | Verdict |
| --- | --- | --- | --- |
| Aggressive buy/sell (live trades) | `src/flow/trade-classifier.ts` + venue adapters | **Correct** | Maker/taker (`isBuyerMaker`) or explicit aggressor. Never candle color. |
| Candle delta (footprint bars) | `totalBuy - totalSell` (quote USD) | **Correct when source is classified trades** | Contaminated when kline proxy invents sides. |
| CVD (chart UI) | `public/app.js` draw loop | **Formula OK, policy wrong** | Running sum of deltas, but silent `FROM_LOADED_HISTORY` reset; includes fabricated kline sides. |
| Displacement (chart UI) | `barDisplacementBps` | **Correct** | Signed `(close-open)/open×10000`. Not high−low. |
| Displacement (backtest features) | `src/backtest/features.ts` | **Incomplete / misleading** | Uses `Math.abs(close-open)` in price units; unsigned; no bps/range/bodyEfficiency split. |
| Kline side proxy | `fillKlineProxyLevels` | **Violates aggressor rules** | Falls back to green/red candle to invent buyFrac when `takerBuy` missing. |

---

## 1. Aggressive buy / sell

### Live / server footprint

- `src/exchange/binance-adapters.ts` → `classifyTrade({ isBuyerMaker: msg.m })`
- `src/flow/trade-classifier.ts`: `isBuyerMaker === true` → aggressor **SELL**; else **BUY**. Optional book inference only when maker/taker missing; **never** from close vs open.
- `src/footprint/aggregator.ts`: `side === 'BUY'` adds `quoteValue` to `totalBuy` / level.buy; else `totalSell` / level.sell.

**Unit:** quote notional (USD). Consistent across aggregator, wire (`tb`/`ts`), and UI.

### Chart tape fallback

`ingestTradeToChart` also keys off `trade.side` the same way, but is skipped while the live WS owns the bar (avoids undercounting from large-print-only tape).

---

## 2. Candle delta

Everywhere that matters:

```
delta = totalBuy - totalSell   // aggressiveBuy − aggressiveSell in USD
```

Examples: `public/app.js` footer, `src/footprint/structure.ts`, backtest `buy - sell`.

**Reconciliation expected:** `totalBuy + totalSell ≈ executedVolume`, `totalBuy - totalSell = delta`. Holds for aggregator bars. Does **not** hold as “true CVD input” when kline proxy fabricates sides.

---

## 3. CVD (chart)

In `drawFootprint` (`public/app.js`):

```js
let cvd = 0;
for (const b of bars) {
  cvd += (b.totalBuy ?? 0) - (b.totalSell ?? 0);
  cvdByTime.set(b.time, cvd);
}
```

| Requirement | Current behavior |
| --- | --- |
| `cvd[t] = cvd[t-1] + delta[t]` | Yes |
| From aggressive classification | Only when bars come from footprint history / live agg |
| Explicit reset mode | **No** — resets whenever loaded `bars` array changes |
| SESSION / UTC_DAY | **Not implemented** |
| Skip fabricated / incomplete | **No** — kline-proxy bars participate |
| No OHLC-direction CVD | Formula OK, but **inputs** can be OHLC-derived via proxy |
| Live vs completed distinction | Metrics drawn on live bar without LIVE tag on D/CVD |
| Incremental update | Full recompute each draw (OK for chart size; not session-persisted) |

Backtest CVD (`FeatureEngine.cvd += delta`) is the same accumulation idea and uses `aggressiveBuy/Sell` from bars — sound for backtest when `hasFootprint` is true.

---

## 4. Displacement

### Chart UI — `barDisplacementBps`

```js
((close - open) / open) * 10_000
```

Signed body displacement in bps. **Does not use high−low.** Matches the required primary definition.

Gaps vs full model:

- No `displacementRaw` / `displacementPct` / `rangeBps` / `bodyEfficiency` / `displacementATR` on the candle object
- Direction enum not computed
- Neutral threshold not configurable
- Display currently third line under delta+CVD (spec wants compact **D + CVD** only)

### Backtest — `src/backtest/features.ts`

```js
const displacement = Math.abs(bar.close - bar.open);
```

Issues:

- Unsigned → cannot express bearish displacement
- Raw price units, not bps
- Ranked as percentile for absorption heuristics (OK as *feature*), but must not be treated as the chart displacement metric
- Does not store range separately from displacement

---

## 5. Forbidden / risky paths found

### A. Kline proxy invents aggressor from candle color

`fillKlineProxyLevels` (`public/app.js`):

1. Prefer `takerBuy / volume` when present → acceptable **PARTIAL** aggressor estimate (Binance kline taker-buy base).
2. Else if `close > open` → inflate buyFrac; if `close < open` → inflate sellFrac.

That second branch is exactly:

> CVD / delta derived from candle direction

which the spec forbids. Those fabricated `totalBuy`/`totalSell` then enter chart CVD.

### B. Silent CVD window

CVD starts at 0 at the oldest loaded bar with no `cvdResetMode` / `cvdStartTimestamp` surfaced. Reloading history or changing TF silently restarts the series.

### C. Naming confusion (fixed partially)

Candle footer previously labeled aggressive shares as “Asks/Bids”. Renamed to Agg buy/Agg sell, then removed. Residual risk: strategy copy still says “asks consumed” meaning aggressive buy took resting ask — wording is OK if not shown as book ask volume.

---

## 6. What is already OK

- Live trade aggressor classification
- Footprint row buy/sell = aggressive notional at price
- Candle delta formula when source is real footprint
- UI displacement bps formula (signed close−open)
- Quote-USD unit consistency on real bars
- No evidence of CVD = ±volume from green/red OHLC in the accumulator itself

---

## 7. Fix plan (post-audit)

1. Add pure module `src/footprint/displacement-cvd.ts`: displacement (raw/pct/bps/range/bodyEfficiency/ATR/direction), candle delta, CVD accumulate with explicit reset modes + dataQuality.
2. Stop inventing kline buy/sell from candle color; only use taker-buy when present; otherwise leave flow empty / `CVD_UNAVAILABLE` or carry CVD without adding fabricated delta.
3. Chart footer: compact two lines under completed candles — `+42 bp` and `CVD +8.3M`; live bar marked incomplete; delta in hover tooltip.
4. Persist `cvdResetMode` (default `UTC_DAY` for 24/7 crypto ≈ session day) + start timestamp; never silent undocumented reset.
5. Unit tests covering displacement vs range, CVD accumulation, reset, divergence cases, no future leakage, reconciliation.

---

## 8. Search inventory (key hits)

| Symbol / path | Role |
| --- | --- |
| `barDisplacementBps` | Chart signed bps — correct |
| `cvdByTime` in `drawFootprint` | Chart CVD series — policy gaps |
| `fillKlineProxyLevels` | Fabricates sides from OHLC — **bug** |
| `FootprintAggregator.ingest` | Correct aggressor bucketing |
| `classifyTrade` / `isBuyerMaker` | Correct |
| `FeatureEngine.push` displacement | Abs close−open — backtest only |
| `FeatureEngine.cvd` | Correct accumulation for footprint bars |
