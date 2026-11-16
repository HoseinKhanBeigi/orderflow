/**
 * Backtest the BUY/SELL 1–4 entry marks per state.
 *
 *   pnpm tsx scripts/backtest-entries.ts [--symbols BTCUSDT,ETHUSDT] [--interval 15m]
 *     [--days 90] [--hold 8] [--fee-bps 5] [--min-stop-atr 0.5] [--market perp|spot]
 *     [--out reports/entry-backtest.md]
 *
 * Bars come from Binance klines: totalBuy = taker-buy quote volume, totalSell = the rest.
 * That is the same aggressive buy/sell split the footprint bars carry, per candle.
 *
 * Trade rules (same for every state, and for the baseline):
 * - Enter at the next candle's open after the marked candle closes.
 * - Stop beyond the marked candle: its low for a buy, its high for a sell,
 *   but never closer than `min-stop-atr` × ATR(14) from entry (a stop inside the noise is not a stop).
 * - Exit at the stop, or at the close of the `hold`-th candle.
 * - `fee-bps` is charged on entry and on exit (taker both ways).
 * R = net PnL / (entry − stop). Baseline = enter on every candle, same rules.
 * Gross +N = move from entry to the close N candles later, toward the trade, before fees and stops.
 * That column is the purest "did the mark call direction" number.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryMarks, type EntryBar, type EntryMark } from '../src/entry-signal/index.js';
import { annotateDeltaProgress } from '../src/footprint/delta-progress.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const INTERVAL_MIN: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240 };

const interval = arg('interval', '15m');
const days = Number(arg('days', '90'));
const hold = Number(arg('hold', '8'));
const feeBps = Number(arg('fee-bps', '5'));
const minStopAtr = Number(arg('min-stop-atr', '0.5'));
const HORIZONS = [1, 4, 8] as const;
const market = arg('market', 'perp') === 'spot' ? 'spot' : 'perp';
const outPath = arg('out', 'reports/entry-backtest.md');
const symbols = arg('symbols', '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
if (!symbols.length) {
  const watch = JSON.parse(readFileSync(join(root, 'data/active-watchlist.json'), 'utf8')) as { symbols: string[] };
  symbols.push(...watch.symbols);
}
if (!INTERVAL_MIN[interval]) throw new Error(`unsupported interval ${interval}`);

async function fetchJson(url: string, symbol: string): Promise<unknown[][]> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status >= 400 && r.status < 500) throw Object.assign(new Error(`binance ${r.status} ${await r.text()}`), { fatal: true });
      if (!r.ok) throw new Error(`binance ${r.status}`);
      return (await r.json()) as unknown[][];
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal) throw new Error(`${symbol}: ${(err as Error).message}`);
      lastErr = err;
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
    }
  }
  throw new Error(`${symbol}: ${(lastErr as Error)?.message ?? 'fetch failed'}`);
}

async function fetchBars(symbol: string): Promise<EntryBar[]> {
  const base = market === 'spot' ? 'https://api.binance.com/api/v3/klines' : 'https://fapi.binance.com/fapi/v1/klines';
  const limit = market === 'spot' ? 1000 : 1500;
  const stepMs = INTERVAL_MIN[interval]! * 60_000;
  const now = Date.now();
  let start = now - days * 86_400_000;
  const out: EntryBar[] = [];
  while (start < now) {
    const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${limit}&startTime=${start}`;
    const rows = await fetchJson(url, symbol);
    if (!rows.length) break;
    for (const k of rows) {
      const closeTime = Number(k[6]);
      if (closeTime >= now) continue; // candle still open
      const quote = Number(k[7]);
      const takerBuy = Number(k[10]);
      out.push({
        time: Number(k[0]) / 1000,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        totalBuy: takerBuy,
        totalSell: Math.max(0, quote - takerBuy),
      });
    }
    start = Number(rows[rows.length - 1]![0]) + stepMs;
  }
  return out;
}

interface Trade {
  key: string;
  state: number;
  side: 'buy' | 'sell';
  time: number;
  r: number;
  netBp: number;
  stopped: boolean;
  gross: number[];
}

function atrAt(bars: EntryBar[], index: number, lookback = 14): number | null {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(1, index - lookback + 1); i <= index; i++) {
    const b = bars[i]!;
    const pc = bars[i - 1]!.close;
    sum += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    n += 1;
  }
  return n ? sum / n : null;
}

/** Simulate one trade from the candle after `index`. Null when there is no room or no risk. */
function simulate(
  bars: EntryBar[],
  index: number,
  side: 'buy' | 'sell',
): { r: number; netBp: number; stopped: boolean; gross: number[] } | null {
  const signal = bars[index]!;
  const first = bars[index + 1];
  const reach = Math.max(hold, ...HORIZONS);
  if (!first || index + reach >= bars.length) return null;
  const atr = atrAt(bars, index);
  if (!atr) return null;
  const entry = first.open;
  const dir = side === 'buy' ? 1 : -1;
  const candleRisk = side === 'buy' ? entry - signal.low : signal.high - entry;
  const risk = Math.max(candleRisk, minStopAtr * atr);
  if (!(risk > 0)) return null;
  const stop = entry - dir * risk;
  let exit = bars[index + hold]!.close;
  let stopped = false;
  for (let j = index + 1; j <= index + hold; j++) {
    const b = bars[j]!;
    const hit = side === 'buy' ? b.low <= stop : b.high >= stop;
    if (hit) {
      // Gap through the stop fills at the open.
      exit = side === 'buy' ? Math.min(stop, b.open) : Math.max(stop, b.open);
      stopped = true;
      break;
    }
  }
  const fees = (entry + exit) * (feeBps / 10_000);
  const pnl = dir * (exit - entry) - fees;
  const gross = HORIZONS.map((h) => (dir * (bars[index + h]!.close - entry) / entry) * 10_000);
  return { r: pnl / risk, netBp: (pnl / entry) * 10_000, stopped, gross };
}

interface Row {
  label: string;
  n: number;
  win: number;
  avgR: number;
  t: number;
  totalR: number;
  avgBp: number;
  gross: number[];
  stopPct: number;
  firstHalfR: number | null;
  secondHalfR: number | null;
}

function summarize(label: string, trades: Trade[], midTime: number): Row {
  const n = trades.length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const rs = trades.map((t) => t.r);
  const avgR = mean(rs);
  const sd = n > 1 ? Math.sqrt(rs.reduce((a, r) => a + (r - avgR) ** 2, 0) / (n - 1)) : NaN;
  const first = trades.filter((t) => t.time < midTime).map((t) => t.r);
  const second = trades.filter((t) => t.time >= midTime).map((t) => t.r);
  return {
    label,
    n,
    win: n ? trades.filter((t) => t.r > 0).length / n : NaN,
    avgR,
    t: n > 1 && sd > 0 ? avgR / (sd / Math.sqrt(n)) : NaN,
    totalR: rs.reduce((a, b) => a + b, 0),
    avgBp: mean(trades.map((t) => t.netBp)),
    gross: HORIZONS.map((_, k) => mean(trades.map((t) => t.gross[k]!))),
    stopPct: n ? trades.filter((t) => t.stopped).length / n : NaN,
    firstHalfR: first.length ? mean(first) : null,
    secondHalfR: second.length ? mean(second) : null,
  };
}

const f2 = (x: number | null) => (x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2));
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');

function table(rows: Row[]): string {
  const grossHead = HORIZONS.map((h) => `Gross bp +${h}`).join(' | ');
  const head = `| Group | Trades | Win % | Avg R | t | Total R | ${grossHead} | Net bp/trade | Stopped | Avg R 1st half | Avg R 2nd half |`;
  const sep = `|---|---:|---:|---:|---:|---:|${HORIZONS.map(() => '---:').join('|')}|---:|---:|---:|---:|`;
  const f1 = (x: number) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : '—');
  const body = rows.map((r) =>
    `| ${r.label} | ${r.n} | ${pct(r.win)} | ${f2(r.avgR)} | ${f2(r.t)} | ${f2(r.totalR)} | ${r.gross.map(f1).join(' | ')} | ${f1(r.avgBp)} | ${pct(r.stopPct)} | ${f2(r.firstHalfR)} | ${f2(r.secondHalfR)} |`,
  );
  return [head, sep, ...body].join('\n');
}

async function main(): Promise<void> {
  const all: Trade[] = [];
  const baseline: Trade[] = [];
  const perSymbol: Array<{ label: string; trades: Trade[] }> = [];
  const skipped: string[] = [];
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const symbol of symbols) {
    let bars: EntryBar[];
    try {
      bars = await fetchBars(symbol);
    } catch (err) {
      skipped.push(`${symbol} (${(err as Error).message.slice(0, 80)})`);
      continue;
    }
    if (bars.length < 100) {
      skipped.push(`${symbol} (only ${bars.length} bars)`);
      continue;
    }
    minTime = Math.min(minTime, bars[0]!.time);
    maxTime = Math.max(maxTime, bars[bars.length - 1]!.time);
    const marks: Map<number, EntryMark> = entryMarks(bars, null, annotateDeltaProgress(bars));
    const indexByTime = new Map(bars.map((b, i) => [b.time, i]));
    const mine: Trade[] = [];
    for (const [time, mark] of marks) {
      const i = indexByTime.get(time)!;
      const res = simulate(bars, i, mark.side);
      if (!res) continue;
      mine.push({ key: mark.short, state: mark.state, side: mark.side, time, ...res });
    }
    for (let i = 20; i < bars.length; i++) {
      for (const side of ['buy', 'sell'] as const) {
        const res = simulate(bars, i, side);
        if (res) baseline.push({ key: side === 'buy' ? 'ALL_LONG' : 'ALL_SHORT', state: 0, side, time: bars[i]!.time, ...res });
      }
    }
    all.push(...mine);
    perSymbol.push({ label: `${symbol} (${marks.size} marks / ${bars.length} bars)`, trades: mine });
    console.error(`${symbol}: ${bars.length} bars, ${marks.size} marks, ${mine.length} trades`);
  }

  const mid = (minTime + maxTime) / 2;
  const byKey = ['B1', 'S1', 'B2', 'S2', 'B3', 'S3', 'B4', 'S4'].map((k) => summarize(k, all.filter((t) => t.key === k), mid));
  const byState = [1, 2, 3, 4].map((s) => summarize(`State ${s}`, all.filter((t) => t.state === s), mid));
  const totals = [
    summarize('All marks', all, mid),
    summarize('Baseline: every candle long', baseline.filter((t) => t.side === 'buy'), mid),
    summarize('Baseline: every candle short', baseline.filter((t) => t.side === 'sell'), mid),
  ];
  const from = new Date(minTime * 1000).toISOString().slice(0, 10);
  const to = new Date(maxTime * 1000).toISOString().slice(0, 10);
  const md = [
    '# Entry marks backtest',
    '',
    `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/backtest-entries.ts\`.`,
    '',
    `- Data: Binance ${market} klines, ${interval}, ${from} → ${to}`,
    `- Symbols: ${symbols.filter((s) => !skipped.some((x) => x.startsWith(s + ' '))).join(', ')}`,
    skipped.length ? `- Skipped: ${skipped.join('; ')}` : null,
    `- Entry: next candle open. Stop: marked candle low (buy) / high (sell). Exit: stop or close of candle ${hold}.`,
    `- Stop floor: ${minStopAtr} × ATR(14). Fees: ${feeBps} bp per side. R = net PnL ÷ (entry − stop).`,
    `- Gross bp +N: move from entry to the close N candles later, toward the trade, no fees or stop.`,
    '- `t` = Avg R ÷ standard error. Roughly, |t| < 2 is indistinguishable from noise.',
    '- 1st/2nd half split the date range in two, as a quick stability check.',
    '',
    '## Per state and side',
    '',
    table(byKey),
    '',
    '## Per state',
    '',
    table(byState),
    '',
    '## Totals vs baseline',
    '',
    table(totals),
    '',
    '## Per symbol (all marks)',
    '',
    table(perSymbol.map((p) => summarize(p.label, p.trades, mid))),
    '',
  ]
    .filter((l) => l != null)
    .join('\n');

  writeFileSync(join(root, outPath), md);
  console.log(md);
  console.error(`\nWrote ${outPath}`);
}

await main();
