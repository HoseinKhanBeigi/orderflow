# UI Simplification Plan — Fast Decision First

## Current surface (what the trader sees)

| Surface | Location | What it shows | Role |
| --- | --- | --- | --- |
| Passive strength chip | Header (`#passive-strength`) | Bid/ask strength, labels, tooltips with refill/survival/cancel/consume | Diagnostic leakage into primary chrome |
| Liquidity Wall Map | Chart overlay (`#wall-map`) | Strongest + relevant + every ladder row + confidence + maturity + distance + battle + metric tooltips | **Primary clutter** — blocks 2–3s reads |
| Footprint candle badge | Per-card canvas title | LONG/SHORT/WAIT + short line | Already compact — keep |
| Legacy battle / delta / absorption DOM | `updateUi()` targets missing IDs | Dead bindings after header trim | Noise in code; ignore or no-op |

## Duplication

- **Control** appears in: marketBattle.summary, tradeDecision metrics, footprint badge, (formerly) state-badge.
- **Passive defense** appears in: passiveStrength chip, wall-map scores, marketBattle upside/downside.passive, tradeDecision metrics.
- **Battle** appears in: wall-map battle block, marketBattle upside/downside, footprint “NOW” title.
- **Decision** appears in: tradeDecision snapshot (underused in UI), footprint badge (recomputed locally).

One concept should have one home in the default view.

## Trader-facing vs diagnostic

**Trader-facing (default):**
1. Trade decision (LONG / SHORT / FORMING / WAIT + one blocker + decision confidence)
2. Current battle (attack vs defense bars + human state + relevant price)
3. Market control (BUYERS / SELLERS / BALANCED + strength + trend arrow)
4. Passive defense (ask/bid defense + advantage)

**Diagnostic-only (details / advanced):**
- Full wall ladder, strongest overall walls
- Refill / survival / consumption / cancellation / persistence / reliability / maturity / per-wall confidence / distance bands
- Data quality (only surface when bad)

## Data sources (no engine changes)

| UI card | Engine field |
| --- | --- |
| Decision | `windows['1m'].tradeDecision` (action, phase, confidence, blockers, reasons) |
| Control | `marketBattle.summary` + buyer/seller control from `tradeDecision.metrics` |
| Passive defense | `passiveStrength` bids/asks strength + trend; fallback `tradeDecision.metrics.passive*Defense` |
| Current battle | Stronger of `marketBattle.upside` / `downside` by battleScore; relevantWall from battle or wallMap |
| Details drawer | Existing `wallMap` unchanged |

## Layout change

Replace `#wall-map` default content with four compact cards + “View liquidity details” toggle.
Advanced ON → restore current full wall map (diagnostics).

## Footprint

Keep compact badge. Prefer `tradeDecision.action` when present; do not dump wall metrics on candles.

## Implementation status

Shipped as presentation-only:

- Replaced default wall ladder with `#decision-panel`: Decision → Battle → Control → Passive Defense
- Wall ladder / strongest walls / refill / survival / etc. behind **View liquidity details**
- Header passive chip reduced to Ask/Bid + advantage (no metric dump)
- Live footprint NOW badge uses `tradeDecision` when available
- Engine untouched

Plan file: this document.