# Entry states

The script marks a closed candle **BUY** or **SELL**. The chart shows that as **B** or **S** plus the state number. The forming candle is never marked. A second candle of the same side stays quiet, except state 5 can mark again after a different state on that side.

Alerts use the same marks, on the 15-minute chart only. The title is BUY or SELL.

## Context

Every state reads the **6 closed candles before** the signal candle. At least 5 of them have to be there.

**Downtrend:** the close of the 6th candle is at least 0.25% below the close of the 1st, and at least 2 of those candles show sellers or asks.

**Uptrend:** the close of the 6th is at least 0.25% above the 1st, and at least 2 of those candles show buyers or bids.

A downtrend is judged by aggressive sellers and the asks: can they still get price down. An uptrend is judged by aggressive buyers and the bids: can they still get price up.

If those six closes did not drift enough to be a trend, states 1, 3, 5, and 7 keep their own rule. State 8 only marks when the trend is there. A flat window is not a trend, even when one side printed more delta. A join (state 2) and a response (state 4 or 6) stay quiet on that flat window: the delta is pushing and the close is not leaving. 15 Nov 17:05 on the 5-minute chart is that pin. The 15-minute sell that actually leaves, 17:15, is still the sell.

Fades need the trend they are fading. A push that goes with the move needs that side's trend.

The longer swing is the last 16 closes. Down at least 0.50% is a bearish market. Up at least 0.50% is a bullish market. In a bearish market the sells stand, and a buy has to be the sell failing or being taken. In a bullish market the buys stand, and a sell has to be the buy failing, the buyers already failing and the response holding, or the join once the six closes have turned.

**Maybe** is not an entry. In a drop, a strong bounce or a held ceiling is labeled MAYBE SELL: the next candle may sell. In a rise, a strong dip or a held floor is labeled MAYBE BUY. 15 Nov 19:45 is that bounce. 20:00 is the sell. The forming candle is never labeled.

## Sellers can't and buyers can't

This is a reading of the same six candles, drawn on the candle where it shows. It is not a ninth entry.

**Sellers can't:** the six are a downtrend, so aggressive sellers and the asks had the effort, and this close did not go down versus the previous close. A close that is still lower is sellers getting price down, even when that candle finished off its low.

**Buyers can't:** the six are an uptrend, so aggressive buyers and the bids had the effort, and this close did not go up versus the previous close. A close that is still higher is buyers getting price up, even when that candle finished off its high.

The label sits on the first candle of that failure. The next candle of the same failure stays quiet. The forming candle is never labeled.

A fade (states 1, 3, 4, 5, 6, 7, 8) stands when that side already can't, or when this candle is the one where the close or the progress fails. A join (state 2) stays quiet when that side already can't inside the six. State 8 is that failure candle, so the can't label confirms it.

## Sell trap and buy trap

A trap is that same trend, plus a sweep of the prior swing.

**S TRAP:** downtrend. Aggressive sellers and the asks had the effort, price took the prior low, and the close came back up.

**B TRAP:** uptrend. Aggressive buyers and the bids had the effort, price took the prior high, and the close came back down.

A sweep that is not that trend stays unlabeled. The label sits on the sweep candle. The forming candle is never labeled.

States 1, 4, 5, and 8 stand when the window has that trap. A buy stands with an S trap. A sell stands with a B trap. If the window has no trap, those states keep their own rule. State 2 stays quiet when its side is the one that was trapped. State 4 is still the entry on the candle that responds after the trap.

## Failure, floor, and ceiling

The floor and the ceiling are the prior swing. One test is not enough.

**Floor:** the low was already defended once, and this close holds above it again. The bids held.

**Ceiling:** the high was already defended once, and this close holds below it again. The asks held.

**Fail down:** price went through that floor and the close came back above it. This is the same idea as FAIL ↓.

**Fail up:** price went through that ceiling and the close came back below it. This is the same idea as FAIL ↑.

A buy in states 1, 4, 5, and 8 stands at a floor or a fail down. A sell stands at a ceiling or a fail up. The other level keeps that fade quiet. If the window has neither, those states keep their own rule. A buy join (state 2) stays quiet into a ceiling. A sell join stays quiet into a floor.

## Effort and response

Effort is the aggressive imbalance (Agg) and the delta. Response is how far price moved with that delta, in ATR.

| Word | Meaning |
| --- | --- |
| Little response | progress at or under 0.25 ATR |
| Real response | progress at or over 0.50 ATR |
| Large response | progress at or over 0.80 ATR |
| Agg leans | aggressive share at least 8% to that side |
| Same effort | this candle's delta is 70% to 115% of the previous candle |
| Response faded | progress is under 0.50 ATR and under half the previous candle |

Asks replenished (A) are aggressive buys the close did not keep. Bids replenished (B) are aggressive sells the close did not keep. Pas positive means bids are heavier. Pas negative means asks are heavier.

## States

### 1 — high effort absorbed, book refilled

That side was already pushing, then this candle's effort is absorbed.

- **Buy:** downtrend. Sellers print high delta, lose the close (bids hold), and the asks refilled. At least 3 of the 6 candles are sell delta. The previous candle did not lose the same way. A close that only ticks up, while the tape is still sell and the move against that sell is under 0.50 ATR, is not this buy. That candle stays with the sell.
- **Sell:** uptrend. Buyers print high delta, lose the close (asks hold), and the bids refilled. At least 3 of the 6 are buy delta. That is high effort and a low response, so it is this sell even when the close is still higher than the previous close. A small downtick with the tape still buy stays with the buy. 15 Nov 15:00 is this sell.

### 2 — high effort accepted, book did not refill

That side already owns the move, and this candle's effort is accepted.

- **Buy:** uptrend. High buy delta, real progress, buyers win the close, Agg leans buy, bids are not refilling against them. Buyers already own the setup, or at least two of the six candles already closed as buyers.
- **Sell:** downtrend. The mirror: sellers win the close, asks are not refilling against them.

If that side already can't inside the six, or that side was just trapped, this join stays quiet. A heavy sell candle that closed high stays a fade. It is not buy 2.

### 3 — effort flipped, book refilled, price stopped

The side that just worked gets answered, and price stops.

- **Buy:** downtrend. The previous candle was an accepted sell (high delta, real progress, at least two sells in the six). This candle flips to high buy delta, progress is little, and the asks refill the buy.
- **Sell:** uptrend. The mirror.

A flip the book accepts is not state 3.

A bounce that never clears the other side is the same flip when the next candle gives it back. 14 Nov 16:45 closed up inside the sell candles' high. That is not a buy. 17:00 gave that close back, and that candle is the sell. The mirror is a buy. A candle that actually extends is state 2, not this.

### 4 — failed side, response held

The other side already failed, then price responds.

- **Buy:** downtrend. Sellers already failed at least twice in the six, and the candle just before still belongs to that failure. Aggressive buyers win the close and the bids are with them. Progress is a large response on ordinary delta, or a real response that is not weak.
- **Sell:** uptrend. The mirror: aggressive sellers win the close and the asks are with them.

### 5 — side tried, book held, other side took it

One side kept trying and the book held. The other side takes it.

- **Buy:** downtrend. At least 3 of the 6 are sell delta, at least 2 of those failed to extend or got absorbed, and the candle just before is still that failed sell. Aggressive buyers either win the close with the bids, or they move price while the asks are still on the close.
- **Sell:** uptrend. The mirror: sellers win the close with the asks, or they move price while the bids are still on the close.

State 5 can mark even if that side is already open, unless the open mark is already state 5.

### 6 — effort stopped, open before the move

The side that just moved does not progress. Open the other side on this candle, before the next move's candles.

- **Sell:** uptrend. The previous candle was an accepted buy with real progress. This candle is still buy delta, progress is little, and asks or bids are on the candle. Sellers already printed one real push inside the six.
- **Buy:** downtrend. The mirror. The previous sell stalls, asks or bids are on the candle, and buyers already moved once in the six.

A candle that is still progressing is left alone.

### 7 — same effort, response faded

Effort stays about the same and the response fades. The other side is opened on this candle.

- **Sell:** uptrend. This candle's buy delta is 70% to 115% of the previous buy. The previous candle had real progress. This candle's progress is under 0.50 ATR and under half of that previous progress. Aggressive buyers are still on it, and either they still hold the close or the asks have it.
- **Buy:** downtrend. The mirror: aggressive sellers are still on it, and either they still hold the close or the bids have it.

If effort and response are both still growing, there is no fade. Effort that collapses below 70% is state 6, not state 7.

### 8 — trend side could not move price

The trend's effort and book no longer move price. The label is the candle where the close turns back.

- **Buy:** downtrend, sellers and asks. The candle just before still belongs to that downtrend. This candle closes back up (buyers win the close). Weak or flat delta still counts. 13 Nov 14:00 is this buy: the six closes before it fell, the asks were in that push, and 14:00 did not extend the drop. A candle that is still sell delta, and only ticks up without a real answer, is not this buy. 14 Nov 19:00 was that pause. It stays a sell.
- **Sell:** uptrend, buyers and bids. This candle closes back down. The mirror stays a buy when the tape is still buy and the dip is not real.

A high-delta candle is left to states 1–5. The next candle of the same turn is not a second state 8.

## Order

The script checks the candle in this order: 3, 2, 4, 5, 1, 6, 7, 8. The first match is the label.
