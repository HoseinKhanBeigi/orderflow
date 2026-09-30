# Liquidity Wall Score Audit

Audit of why wall strengths cluster near 48–52 and why tooltips show Refill/Cancellation/Consumption = 50 and Survival = 100 for untested walls.

## Summary

Missing / untested evidence is being converted into **numeric neutrals** (50) or **perfect survival** (100). The per-level strength engine already skips `null` components and renormalizes weights, but **upstream score factories always emit numbers**, so the null path is never taken for refill, cancellation, consumption, or persistence.

---

## Metric pipeline

| Metric | Source | Default behavior today | Problem | Proposed fix |
| --- | --- | --- | --- | --- |
| **Refill / replenishment** | `level-scores.replenishmentScoreOf` → `level-tracker.toPublic` → `levelObservation` → `level-strength.scoreLevel` | Always returns a `number`. With no consumption and no refill events → **0**. Side aggregates use `normalizer.percentile` / empty metrics → **50** when cold. | UI / side strength show **Refill 50** on warm-up. Per-level path gets **0**, which is still fake evidence (scored as “no refill” rather than “untested”). | Return `null` + state `UNTESTED` until `consumedQuantity > 0` or `replenishmentCount > 0`. Cold percentiles → `null`, not 50. |
| **Consumption** | Side: `consumedPercentile` via `PassiveMetricNormalizer`. Per-level: raw `consumed` only (no null-aware score in wall map tooltip path for “Consumption 50”). | Empty / cold percentile = **50**. | Tooltip / passive-strength components read as neutral evidence. | `null` + `UNTESTED` until executions observed at the level / side has warm samples. |
| **Cancellation** | Per-level: `cancellationScoreOf` = cancelled / (cancelled+consumed+current). Side: `cancelledPercentile`. | Per-level with no cancel → **~0**. Side cold → **50**. `eventsOf` break check uses `survivalScore ?? 100`. | Side path invents neutral cancel. Break detector treats missing survival as perfect. | Null until cancel/consume activity exists; never `?? 100` for survival. |
| **Survival** | `level-strength.survivalRatioOf` using `closestApproachBps` / `attackCount`. Tracker initializes `closestApproachBps` to **current distance at birth**. | If wall appears ≤ `approachBps` (20), survival is immediately **current/initial ≈ 100**. Untested persistence path uses **0.5** survival in `persistenceScore`. | **Survival = 100 without approach.** Persistence secretly injects 50. | Require real approach: checkpoint closer than `firstSeenDistanceBps`, or attack/contact. Until then `survival = null`, state `UNTESTED`. |
| **Persistence** | `level-scores.persistenceScore` | Always a number. Untested attack path uses `survival = 0.5`. Young walls still get mid scores from age/presence mix. | Inflates strength for brand-new walls; contributes to 48–52 cluster. | Return `null` / `INSUFFICIENT_DATA` until `snapshotCount` / `persistenceMs` clear configurable maturity. Do not substitute 0.5 for untested survival. |
| **strengthScore** | `level-strength.scoreLevel` weighted average with null skip + renormalize | Correct **if** inputs are null. Upstream never nulls refill/persistence. Also folds **nearTouch** into strength. | Distance mixed into strength; fake components still enter when non-null. | Keep renormalize; exclude distance from strength; feed nulls; add separate `relevanceScore`. |
| **Fallbacks 50 / 100** | See fallback inventory below | Silent substitution. | Fake moderate / perfect walls. | Remove; use explicit metric states. |

---

## Fallback inventory (repo search)

| Location | Pattern | Effect |
| --- | --- | --- |
| `src/passive-liquidity/level-scores.ts` | `attackCount > 0 ? … : 0.5` | Untested survival → **50%** inside persistence. |
| `src/passive-liquidity/normalize.ts` | cold `percentile` → **50** | Refill/cancel/consume/near-depth look neutral. |
| `src/passive-liquidity/empty.ts` | `*Percentile: 50` | Empty snapshot looks measured. |
| `src/passive-liquidity/net-liquidity.ts` | warm? midRank : **50** | Same for net/velocity. |
| `src/passive-liquidity/absorption.ts` / `vacuum.ts` | input defaults 50 | Classification neutrals when callers omit. |
| `src/passive-liquidity/level-tracker.ts` | `sizePercentile: 50` at create; `closestApproachBps = distance at birth` | Fake size rank; fake approach. |
| `src/level-strength/engine.ts` | `survival ?? 40` in reliability; `survivalScore ?? 100` in break event; `refill ?? 0` | Missing survival treated as OK-ish or perfect depending on site. |
| `src/market-battle/engine.ts` | `survivalScore == null ? 50` | Battle defense gets neutral survival. |
| `src/passive-strength/engine.ts` | `cancellationScore ?? 100` in explain (low-cancel claim); thresholds with `?? 0` | Explanation bias only, but reinforces fake certainty. |
| UI `public/app.js` | `fmtScore` already shows `—` for null | Good — but upstream rarely sends null. |

---

## Survival / approach (critical)

`TrackedLevel.closestApproachBps` is set to the birth distance. `survivalRatioOf` treats `closestApproachBps <= approachBps` as approached.

Example: wall appears at 12 bps → immediately “approached” → survival ≈ 100. Matches the observed tooltip pattern.

Required model: checkpoints `20 / 10 / 5 / 2 / 1 / contact`, numeric survival only after sufficient approach observations relative to first-seen distance (or attack/contact).

---

## Strength vs confidence vs relevance

| Concept | Today | Target |
| --- | --- | --- |
| Strength | Single score; near-touch included; no confidence gate on VERY_STRONG | Observed components only; renormalized weights |
| Confidence | Missing on wall rows (side-level has confidence) | `strengthConfidence` 0–100 from evidence quality |
| Relevance | `strength * nearTouch` | Separate; distance / approach / attack flow — not mixed into strength |
| State labels | VERY_STRONG etc. even when untested | `UNCERTAIN` when confidence below threshold |
| Ranking | Raw `strength` for strongest picks | Separate `rankingScore` (strength × confidence × reliability factors) |

---

## Architecture (current → target)

```
OrderBook Events
  → Per-Level Tracker   (today: always-numeric scores + birth = approach)
  → Consumed/Cancel/Refill/Survival/Persistence
  → Per-Level Strength  (today: null-aware but fed non-null fakes)
  → Wall Map UI         (today: strength bar, no confidence / UNTESTED metric labels)
```

Target adds: metric `{value,state}`, wall maturity, confidence, relevance selector, current wall battle, ranking gates.

---

## Implementation status

Implemented in this change set:

1. `level-scores` returns `{value,state}` with null for UNTESTED / INSUFFICIENT_DATA (no 0.5 survival stub).
2. Approach tracking no longer treats birth distance as closest approach; checkpoints required for survival.
3. Cold percentiles use `percentileOrNull` → null (not 50) on side metrics feeding strength.
4. Level wall map exposes strength / strengthConfidence / rankingScore / relevance / wallMaturity separately.
5. UI shows UNTESTED metric labels, confidence %, relevant vs strongest, and current wall battle.
6. Tests cover unknown→50, untested→100, maturity, ranking, battle, hold/break, bands, mismatch.

See `src/level-strength/engine.ts`, `src/passive-liquidity/level-scores.ts`, `public/app.js`.
