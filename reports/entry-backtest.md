# Entry marks backtest

Generated 2026-11-10 14:16 UTC by `scripts/backtest-entries.ts`.

- Data: Binance perp klines, 15m, 2026-08-12 → 2026-11-10
- Symbols: BTCUSDT, ETHUSDT, SOLUSDT, NEARUSDT, FILUSDT, 1000SHIBUSDT, AVAUSDT
- Entry: next candle open. Stop: marked candle low (buy) / high (sell). Exit: stop or close of candle 8.
- Stop floor: 0.5 × ATR(14). Fees: 5 bp per side. R = net PnL ÷ (entry − stop).
- Gross bp +N: move from entry to the close N candles later, toward the trade, no fees or stop.
- `t` = Avg R ÷ standard error. Roughly, |t| < 2 is indistinguishable from noise.
- 1st/2nd half split the date range in two, as a quick stability check.

## Per state and side

| Group | Trades | Win % | Avg R | t | Total R | Gross bp +1 | Gross bp +4 | Gross bp +8 | Net bp/trade | Stopped | Avg R 1st half | Avg R 2nd half |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 1236 | 32% | -0.28 | -5.57 | -342.63 | +3.2 | -0.0 | +0.8 | -12.3 | 58% | -0.13 | -0.43 |
| S1 | 920 | 29% | -0.41 | -7.02 | -381.11 | -2.1 | -3.8 | -4.9 | -13.2 | 61% | -0.47 | -0.36 |
| B2 | 1397 | 33% | -0.22 | -5.19 | -312.04 | +0.1 | +0.6 | +2.3 | -7.6 | 50% | -0.10 | -0.36 |
| S2 | 1890 | 34% | -0.19 | -5.02 | -353.96 | -0.6 | -1.0 | -2.6 | -9.9 | 50% | -0.27 | -0.12 |
| B3 | 80 | 28% | -0.47 | -2.59 | -37.76 | -5.3 | +11.6 | +4.0 | -15.1 | 69% | -0.80 | -0.11 |
| S3 | 107 | 22% | -0.44 | -2.22 | -47.18 | +2.1 | +3.0 | +10.4 | -14.8 | 73% | -0.45 | -0.43 |
| B4 | 3577 | 31% | -0.28 | -10.09 | -997.34 | +1.8 | +2.6 | +5.3 | -6.9 | 55% | -0.19 | -0.37 |
| S4 | 3483 | 32% | -0.27 | -8.85 | -953.12 | +0.8 | -3.2 | -4.0 | -12.7 | 57% | -0.32 | -0.23 |

## Per state

| Group | Trades | Win % | Avg R | t | Total R | Gross bp +1 | Gross bp +4 | Gross bp +8 | Net bp/trade | Stopped | Avg R 1st half | Avg R 2nd half |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| State 1 | 2156 | 31% | -0.34 | -8.82 | -723.74 | +1.0 | -1.6 | -1.6 | -12.7 | 59% | -0.27 | -0.40 |
| State 2 | 3287 | 33% | -0.20 | -7.19 | -666.00 | -0.3 | -0.3 | -0.5 | -8.9 | 50% | -0.19 | -0.21 |
| State 3 | 187 | 25% | -0.45 | -3.30 | -84.94 | -1.0 | +6.7 | +7.6 | -14.9 | 71% | -0.61 | -0.30 |
| State 4 | 7060 | 32% | -0.28 | -13.34 | -1950.46 | +1.3 | -0.2 | +0.7 | -9.8 | 56% | -0.25 | -0.30 |

## Totals vs baseline

| Group | Trades | Win % | Avg R | t | Total R | Gross bp +1 | Gross bp +4 | Gross bp +8 | Net bp/trade | Stopped | Avg R 1st half | Avg R 2nd half |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All marks | 12690 | 32% | -0.27 | -17.72 | -3425.14 | +0.8 | -0.4 | +0.1 | -10.1 | 55% | -0.25 | -0.29 |
| Baseline: every candle long | 60277 | 24% | -0.44 | -46.36 | -26574.42 | +0.4 | +1.6 | +3.3 | -9.0 | 71% | -0.36 | -0.52 |
| Baseline: every candle short | 60277 | 24% | -0.45 | -47.61 | -27378.35 | -0.4 | -1.6 | -3.3 | -11.0 | 71% | -0.54 | -0.37 |

## Per symbol (all marks)

| Group | Trades | Win % | Avg R | t | Total R | Gross bp +1 | Gross bp +4 | Gross bp +8 | Net bp/trade | Stopped | Avg R 1st half | Avg R 2nd half |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT (1933 marks / 8639 bars) | 1930 | 27% | -0.56 | -14.07 | -1081.01 | -0.0 | -0.4 | +0.2 | -9.3 | 54% | -0.52 | -0.60 |
| ETHUSDT (1848 marks / 8639 bars) | 1847 | 31% | -0.35 | -8.08 | -655.06 | +0.9 | +2.1 | +2.3 | -8.5 | 54% | -0.39 | -0.31 |
| SOLUSDT (1805 marks / 8639 bars) | 1804 | 32% | -0.31 | -8.44 | -555.30 | +1.9 | +1.3 | +2.4 | -10.5 | 56% | -0.32 | -0.29 |
| NEARUSDT (1816 marks / 8639 bars) | 1815 | 33% | -0.19 | -5.60 | -350.26 | +1.3 | -4.5 | -4.7 | -17.9 | 57% | -0.18 | -0.21 |
| FILUSDT (1774 marks / 8639 bars) | 1772 | 34% | -0.10 | -2.08 | -169.90 | +2.5 | +0.2 | +1.2 | -6.7 | 54% | +0.04 | -0.22 |
| 1000SHIBUSDT (1686 marks / 8639 bars) | 1685 | 33% | -0.24 | -5.73 | -402.99 | +1.9 | +0.4 | +1.2 | -9.6 | 55% | -0.17 | -0.31 |
| AVAUSDT (1838 marks / 8639 bars) | 1837 | 35% | -0.11 | -3.06 | -210.62 | -2.8 | -1.8 | -1.7 | -8.4 | 55% | -0.15 | -0.08 |
