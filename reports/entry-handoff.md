# Handoff — order flow entries

Repo: `/Users/hossein/Documents/orderflow`. Chart is the footprint at `http://127.0.0.1:3456` (`pnpm run ui`). Entry rules live in `src/entry-signal/engine.ts` and `src/entry-signal/shape.ts`. The browser runs the bundle, not the TypeScript. After any engine or shape edit, run `pnpm run build:client` with full permissions (`tsx` fails in the sandbox with `listen EPERM`) and bump the `client.bundle.js` query in `public/index.html`. Chart-only edits are `public/app.js` plus its query. Current queries: `client.bundle.js?v=entry-chase-v1`, `app.js?v=fp-keep-label-v1`. User must reload. Tests: `pnpm exec vitest run tests/entry-signal.test.ts`.

Do not edit `reports/entry-states.md` unless asked. That file is behind the code: it has states 1–8 and the older context, and it does not mention shape, thin volume, the chase gate, or the sticky label.

Do not add or renumber states. Check order stays **3, 2, 4, 5, 1, 6, 7, 8**. First match wins. The chip stays `BUY n` / `SELL n`. Fuel is display-only. Do not set `textContent` on `#market-fuel`. Do not stamp live fuel onto old candles. Do not invent historical fuel. The forming candle is never an entry.

## Context the states already use

Every state reads the **6 closed candles** before the signal. At least 5 must exist. Drift is **0.25%** (`priceDrift`). A flat window is not a trend.

- **Downtrend:** sellers and asks. The 6th close is at least 0.25% under the 1st, and at least 2 of those candles show sellers or asks.
- **Uptrend:** buyers and bids. The mirror.

**16-close swing** is 0.50% (`SWING_DRIFT`). Bearish swing: sells stand, a buy has to be the sell failing. Bullish swing: buys stand, a sell has to be the buy failing, buyers already failing with the response holding, or a join after the six closes have turned.

**Sellers can't / Buyers can't** is a label, not a state. Sellers can't: downtrend, and this close did not go down versus the previous close. Buyers can't is the mirror. A close that is still extending is not "can't". Fades (1, 3, 4, 5, 6, 7, 8) stand when that side already can't, or when this candle is the failure. A join (2) stays quiet when that side already can't inside the six.

**Trap.** S trap: downtrend, price took the prior low, close came back up. B trap is the mirror. States 1, 4, 5, 8 stand with that trap. State 2 stays quiet when its own side was trapped.

**Floor / ceiling.** Floor: a low already defended, and this close holds above it again. Ceiling is the mirror. Fail down: through the floor and the close back above. Fail up is the mirror. Buy fades stand at a floor or fail down. Sell fades stand at a ceiling or fail up. A buy join stays quiet into a ceiling. A sell join stays quiet into a floor.

**Effort.** Little response ≤ 0.25 ATR. Real ≥ 0.50. Large ≥ 0.80. Agg lean ≥ 8%. Same effort is 70–115% of the previous candle's delta. Response faded: under 0.50 ATR and under half the previous progress. A close inside 0.05% did not extend (`ENTRY_CLOSE_FLAT`).

**Maybe** is not an entry. Drop plus a strong bounce or a held ceiling is MAYBE SELL. Rise plus a strong dip or a held floor is MAYBE BUY.

Same side stays quiet, except state 5 can mark again after a different state on that side. State 6 and 7 do not open the other side while that side's close is still extending (`stillExtending`). 16 Nov 09:15 NEAR is the case: progress faded but the close was still lower, and 09:30 fell again. No buy there.

## Context added on top of the states

These do not change the state number. They gate or decorate the mark after `decideEntry`.

**Shape** (`shape.ts`), checked after a signal. If buy and `buyOk` is false, or sell and `sellOk` is false, that entry is dropped and `openSide` is not set. M overrides a box. One chart chip on the fresh candle: BOX gray, M red, W green.

- **Box:** prior 8 bars only, not this bar. Ceiling and floor are the 2nd-highest high and 2nd-lowest low. Height 1.4× to 3× the median range. Net close drift ≤ 28% of the height. Widest bar ≤ 50% of the height. At least 2 ceiling touches and 2 floor touches in the outer 18%, separated by ≥ 2 bars, ≥ 6 closes inside, and the touch sequence must contain LHL or HLH. Close inside. Buy only in the bottom 30%. Sell only in the top 30%. The middle quiets both. A close outside does not use the box. Fresh only on the first inside bar.
- **M:** two swing highs, 2 bars each side, known only through index−2, lookback 20, gap 5–14 bars. A real pivot low between them. Depth ≥ 1.3× median range. The two highs differ by ≤ 30% of depth and ≤ 0.75× median range. No hidden higher high beyond 0.35× the median range. Break starts within 8 bars after the second high. A close back through the neckline ends it. Active for 3 bars. Buy off, sell on.
- **W:** the mirror. Buy on, sell off.
- On BTC 15m, 15 Nov 15:30 through 16 Nov 11:15 local, the only shape label is a W at 15 Nov 22:30. The old boxes at 16 Nov 09:00 and 10:15, the M at 07:30, and the W at 05:45 and 11:00 are rejected.

**Thin volume.** Quote volume (buy + sell notional) under 45% of the median of up to 16 prior candles, and at least 6 of those have volume. Missing volume is not thin, so old fixtures still mark. The state still shows, in a lighter color, with no entry line and the tip "Volume is small next to the recent candles, so this is not a position." It does not set `openSide`. The same thin side does not repeat every bar.

**Chase gate, state 2 only.** Do not join when the 16-bar swing is already that side, the close is in the outer 12% of the candle (sell ≤ 0.12, buy ≥ 0.88), and the close is beyond the prior 6 bars' low (sell) or high (buy). This removed the 11 Nov 10:00 NEAR 15m sell: close = low 3.594 after the drop had already run. 11 Nov 07:15 S4, 10 Nov 17:30 B2 (close position 0.81), and 10 Nov 21:15 S2 (close position 0.68) stay. Other state-2 paths (weak bounce, trend-fail weak bounce) are not gated.

**Entry price.** Buy is a little under the close. Sell is a little over. Step is `min(max(room × 0.35, ATR × 0.15), ATR × 0.3)`. ATR is the mean range of up to 8 prior bars. Thin marks have no price.

## States

| # | Name | What it is |
|---|---|---|
| 1 | high effort absorbed, book refilled | That side was pushing. This candle's high delta is absorbed and the book refills. Buy: downtrend, sellers lose the close, asks refilled, ≥ 3 of 6 are sell delta, previous candle did not lose the same way. A close that only ticks up while the tape is still sell and the move is under 0.50 ATR stays with the sell. Sell is the mirror, and it can be a sell even when the close is still higher. 15 Nov 15:00 is that sell. |
| 2 | high effort accepted, book did not refill | That side owns the move and this candle is accepted. Buy: uptrend, high buy delta, real progress, buyers win the close, agg leans buy, bids are not refilling, and buyers already own the setup or ≥ 2 of 6 closed as buyers. Sell is the mirror. Quiet if that side already can't, was trapped, or is chasing a new extreme. A heavy sell that closed high is a fade, not buy 2. |
| 3 | effort flipped, book refilled, price stopped | Previous candle was an accepted push. This candle flips to high delta the other way, progress is little, and the book refills. A flip the book accepts is not state 3. A bounce that never clears the other side, then this candle gives it back, is the same flip. 14 Nov 16:45 closed up inside the sell. 17:00 gave it back and is the sell. A candle that actually extends is state 2. |
| 4 | failed side, response held | The other side already failed at least twice, and the candle just before still belongs to that failure. This side wins the close and the book is with them. Progress is a large response on ordinary delta, or a real response that is not weak. |
| 5 | side tried, book held, other side took it | ≥ 3 of 6 are that side's delta, ≥ 2 failed to extend or got absorbed, and the candle just before is still that failure. The other side takes the close, or moves price while the book is still on the close. Can mark again after a different state on the same side. Not after another state 5. |
| 6 | effort stopped, open before the move | Previous candle was an accepted push with real progress. This candle is still that delta, progress is little, asks or bids are on it, and the other side already printed one real push in the six. Do not mark if the close is still extending. |
| 7 | same effort, response faded | Delta is 70–115% of the previous candle. Previous progress was real. This progress is under 0.50 ATR and under half of that. The aggressive side is still on it. Do not mark if the close is still extending. Effort that collapses under 70% is state 6, not 7. |
| 8 | trend side could not move price | The trend's effort and book no longer move price. The label is the candle where the close turns back and the other side shows up. A high-delta candle is left to states 1–5. A flat pause where nobody shows up is not state 8. The next candle of the same turn is not a second state 8. 13 Nov 14:00 is the buy. 14 Nov 19:00 was a pause and stays a sell. |

## Chart behavior that is not a state

`entryMarks` is causal. A later candle does not change an earlier mark if the earlier bar's prices and volume stay the same. There is a test for that.

The chart was still rewriting a shown buy. Two causes, both fixed in `public/app.js` only:

- After a candle closes, a kline estimate was mixed into a candle that already had real trades, which changed the delta and the label. A live-trade candle (`flowSource: 'LIVE'`) is no longer filled with that estimate.
- The live buffer only keeps the open candle and the one before it. The candle before that was deleted, then sometimes redrawn from the estimate. Closed candles already shown are kept for the session (`fpShownBars`, cap 500). The first buy or sell on a closed live-trade candle is frozen (`fpEntryStick`). Later recomputes can add new candles. They cannot change or delete that mark. The forming candle is not frozen. Kline-only history is not frozen, so a better print can still replace it. Alerts use the same freeze if the chart already froze that candle. They do not create new freezes.

Phone under 520px: the book ladder is hidden, and the candles scale so at least 3 fit. iPhone 13 portrait is 390px. The view still follows the live edge, so the oldest of those three slides off. It is still in the chart. Drag left. The label on it does not change.

## Leave alone

Next-candle pill stays quiet until 12 matching closed 1-minute samples of the same setup, and hides if recent shown calls fall under half right. Pre-existing `tsc` errors in `scripts/live-server.ts`, `src/level-interaction/engine.ts`, and `src/live/live-feed.ts` are not part of this work. Do not rename the chip to a bare BUY or SELL unless asked.
