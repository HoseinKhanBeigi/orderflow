# Market Sequence Interpretation — Audit (updated)

## Status

Implemented `MARKET_SEQUENCE_V2` as an **orchestrator**, not a second calculator.

## Module layout

```
src/market-sequence/
  types.ts           # stages, labels, SequenceStageInput
  config.ts          # thresholds / TTL
  adapters.ts        # normalize FR / absorption / effort from existing engines
  label-selector.ts  # ONE primary label priority
  sequence-store.ts  # sequenceId + bounded active sequences
  engine.ts          # processSequenceCandle / annotateSequenceReplay
  index.ts
tests/market-sequence.test.ts
```

## Reuse map

| Stage | Source |
| --- | --- |
| Delta / CVD / Displacement | `footprint/displacement-cvd` via adapters |
| Failure / Reclaim / Control | `failure-reclaim` mapped in adapters |
| Absorption name | Canonical `BUYER_ABSORPTION` / `SELLER_ABSORPTION` (+ legacy LR remap) |
| Effort vs Result | derived from existing effort/result scores (no new volume formula) |
| Breakout vs Expansion | separate stages; expansion only after prior CONTROL/BREAK |

## Label priority

EXPANSION > BREAKOUT/BREAKDOWN > CONTROL > RECLAIM > FAILURE > ABSORPTION > SWEEP > EFFECTIVE > NONE

## Chart

- Top: sequence primary label only (no competing strategyStoryForBar headline)
- Bottom: Displacement · Δ · CVD
- Hover: full stage tooltip
- TradeDecision LONG/SHORT is not the sequence headline

## Rules enforced

1. Reuse engines — do not duplicate FR/delta/CVD math  
2. One primary label per candle  
3. Shared `sequenceId` across related candles  
4. No backfill / no lookahead  
5. Breakout ≠ Expansion  
6. Candle label = market event; TradeDecision = separate consumer  
