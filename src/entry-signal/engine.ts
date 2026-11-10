/**
 * Candle entry script: marks closed candles as BUY/SELL 1–4.
 *
 * Ported from public/app.js so the browser chart, the alerts and the backtest
 * all run the same rules. Inputs are closed footprint bars (quote notional
 * buy/sell totals + OHLC) and the delta-progress rows for the same bars.
 * Nothing here reads a later candle than the one being marked.
 */

export const ENTRY_LITTLE_PROG = 0.25;
export const ENTRY_REAL_PROG = 0.5;
export const ENTRY_RESPONSE_PROG = 0.8;
export const ENTRY_PRIOR_BARS = 6;

/** Close position in range at or above this = buyers won the close. */
export const BATTLE_CLOSE_WIN = 0.55;
/** Buy/sell power split closer than this = PAIR. */
export const BATTLE_EVEN_GAP_PCT = 6;

export type EntryState = 1 | 2 | 3 | 4;
export type EntrySide = 'buy' | 'sell';

export const ENTRY_DETAIL: Record<EntryState, string> = {
  1: 'high delta, low response',
  2: 'high delta, high response',
  3: 'effort flipped, price stopped',
  4: 'failed side, price responded',
};

export interface EntryBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  totalBuy?: number;
  totalSell?: number;
}

/** The three delta-progress fields the script reads. */
export interface EntryProgressRow {
  deltaStrengthState?: string;
  deltaSide?: string;
  directionalProgressATR?: number | null;
}

export type UpOutcome = 'BUYERS_WIN' | 'ASKS_HOLD' | 'CONTESTED';
export type DownOutcome = 'SELLERS_WIN' | 'BIDS_HOLD' | 'CONTESTED';

export interface BattleVerdict {
  stronger: 'UP' | 'DOWN' | 'EVEN';
  up: { power: number; outcome: UpOutcome };
  down: { power: number; outcome: DownOutcome };
  closePos: number;
}

export type EntryChip = 'BUYERS' | 'SELLERS' | 'ASKS' | 'BIDS' | 'PAIR';

export interface EntryRead {
  chip: EntryChip;
  upside: UpOutcome | 'NONE';
  downside: DownOutcome | 'NONE';
  /** Price progress in ATR, signed toward the delta side (negative = moved against it). */
  prog: number | null;
  absProg: number | null;
  strength: string;
  deltaSide: string;
  highDelta: boolean;
  hunt: 'HIGH' | 'LOW' | null;
}

export interface EntrySignal {
  side: EntrySide;
  state: EntryState;
}

export interface EntryMark extends EntrySignal {
  text: string;
  short: string;
  color: string;
  tip: string;
}

export function barBattleVerdict(bar: EntryBar): BattleVerdict | null {
  const buy = Math.max(0, bar.totalBuy ?? 0);
  const sell = Math.max(0, bar.totalSell ?? 0);
  const vol = buy + sell;
  if (vol <= 0) return null;
  const range = bar.high - bar.low;
  const closePos = range > 0 ? Math.min(1, Math.max(0, (bar.close - bar.low) / range)) : 0.5;
  const upPower = Math.round((buy / vol) * 100);
  const downPower = 100 - upPower;
  const highClose = closePos >= BATTLE_CLOSE_WIN;
  const lowClose = closePos <= 1 - BATTLE_CLOSE_WIN;
  return {
    stronger: Math.abs(upPower - downPower) < BATTLE_EVEN_GAP_PCT ? 'EVEN' : upPower > downPower ? 'UP' : 'DOWN',
    up: { power: upPower, outcome: highClose ? 'BUYERS_WIN' : lowClose ? 'ASKS_HOLD' : 'CONTESTED' },
    down: { power: downPower, outcome: lowClose ? 'SELLERS_WIN' : highClose ? 'BIDS_HOLD' : 'CONTESTED' },
    closePos,
  };
}

function priorSwingLevels(prior: EntryBar[]): { support: number | null; resistance: number | null } {
  if (!prior.length) return { support: null, resistance: null };
  let resistance = -Infinity;
  let support = Infinity;
  for (const b of prior.slice(-16)) {
    if (b.high > resistance) resistance = b.high;
    if (b.low < support) support = b.low;
  }
  if (!Number.isFinite(resistance) || !Number.isFinite(support)) return { support: null, resistance: null };
  return { support, resistance };
}

function recentBarAtr(prior: EntryBar[], bar: EntryBar): number {
  const fallback = Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
  const look = prior.slice(-8);
  if (!look.length) return fallback;
  let s = 0;
  for (const b of look) s += Math.max(b.high - b.low, 0);
  return s / look.length || fallback;
}

/** Wick through the prior 16-candle high/low that closed back inside. */
export function stopHuntKind(bar: EntryBar, prior: EntryBar[]): 'HIGH' | 'LOW' | null {
  const { support, resistance } = priorSwingLevels(prior);
  if (support == null || resistance == null || resistance <= support) return null;
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  const closePos = (bar.close - bar.low) / range;
  const band = Math.max((resistance - support) * 0.08, atr * 0.35);
  if (bar.high >= resistance + band * 0.2 && bar.close < resistance && closePos <= 0.42) return 'HIGH';
  if (bar.low <= support - band * 0.2 && bar.close > support && closePos >= 0.58) return 'LOW';
  return null;
}

function entryChip(verdict: BattleVerdict | null): EntryChip {
  if (!verdict || verdict.stronger === 'EVEN') return 'PAIR';
  const outcome = verdict.stronger === 'UP' ? verdict.up.outcome : verdict.down.outcome;
  if (outcome === 'BUYERS_WIN') return 'BUYERS';
  if (outcome === 'ASKS_HOLD') return 'ASKS';
  if (outcome === 'SELLERS_WIN') return 'SELLERS';
  if (outcome === 'BIDS_HOLD') return 'BIDS';
  return 'PAIR';
}

export function barEntryRead(bars: EntryBar[], index: number, progress: EntryProgressRow[]): EntryRead {
  const bar = bars[index]!;
  const row = progress[index] ?? {};
  const verdict = barBattleVerdict(bar);
  const raw = Number(row.directionalProgressATR);
  const prog = row.directionalProgressATR != null && Number.isFinite(raw) ? raw : null;
  const prior = bars.slice(Math.max(0, index - 16), index);
  const strength = row.deltaStrengthState ?? 'UNAVAILABLE';
  return {
    chip: entryChip(verdict),
    upside: verdict?.up.outcome ?? 'NONE',
    downside: verdict?.down.outcome ?? 'NONE',
    prog,
    absProg: prog == null ? null : Math.abs(prog),
    strength,
    deltaSide: row.deltaSide ?? 'NONE',
    highDelta: strength === 'STRONG' || strength === 'EXTREME',
    hunt: prior.length ? stopHuntKind(bar, prior) : null,
  };
}

function priorsOwn(priors: EntryRead[], chip: 'BUYERS' | 'SELLERS'): boolean {
  const recent = priors.slice(-ENTRY_PRIOR_BARS);
  if (recent.length < 2) return false;
  const other = chip === 'SELLERS' ? 'BUYERS' : 'SELLERS';
  let mine = 0;
  let theirs = 0;
  for (const row of recent) {
    if (row.chip === chip) mine += 1;
    else if (row.chip === other) theirs += 1;
  }
  return mine >= 2 && mine > theirs;
}

function otherSideFailed(
  prev: EntryRead | null,
  priors: EntryRead[],
  failedChip: EntryChip,
  trapHunt: 'HIGH' | 'LOW',
): boolean {
  if (!prev) return false;
  if (prev.hunt === trapHunt) return true;
  if (prev.chip !== 'PAIR' && prev.strength !== 'WEAK') return false;
  let n = 0;
  for (const row of priors.slice(0, -1).slice(-ENTRY_PRIOR_BARS)) {
    if (row.chip === failedChip) n += 1;
  }
  return n >= 2;
}

/**
 * One entry from the last closed candle.
 * 1 high delta, low response, and that side did not win the close → fade it.
 * 2 high delta and a real response, and the earlier candles already own that side.
 * 3 the previous candle's effort was accepted, this candle flips the delta and price stops.
 * 4 the other side failed, then this candle responds on ordinary delta.
 */
export function decideEntry(
  cur: EntryRead | null,
  prev: EntryRead | null,
  priors: EntryRead[],
  prevSignal: { side: EntrySide } | null,
): EntrySignal | null {
  if (!cur) return null;
  const real = cur.prog != null && cur.prog >= ENTRY_REAL_PROG;
  const little = cur.absProg != null && cur.absProg <= ENTRY_LITTLE_PROG;

  if (prev && prev.highDelta && prev.prog != null && prev.prog >= ENTRY_REAL_PROG && cur.highDelta && little) {
    if (prev.deltaSide === 'SELL' && cur.deltaSide === 'BUY') return { side: 'buy', state: 3 };
    if (prev.deltaSide === 'BUY' && cur.deltaSide === 'SELL') return { side: 'sell', state: 3 };
  }

  if (cur.highDelta && real) {
    const chip = cur.deltaSide === 'BUY' ? 'BUYERS' : cur.deltaSide === 'SELL' ? 'SELLERS' : null;
    const side: EntrySide = chip === 'BUYERS' ? 'buy' : 'sell';
    const continued = chip && prevSignal && prevSignal.side === side;
    if (chip && cur.chip === chip && priorsOwn(priors, chip) && !continued) {
      return { side, state: 2 };
    }
  }

  const responded = cur.prog != null && cur.prog >= ENTRY_RESPONSE_PROG && !cur.highDelta;
  if (responded && cur.upside === 'BUYERS_WIN' && cur.deltaSide === 'BUY' && otherSideFailed(prev, priors, 'SELLERS', 'LOW')) {
    return { side: 'buy', state: 4 };
  }
  if (responded && cur.downside === 'SELLERS_WIN' && cur.deltaSide === 'SELL' && otherSideFailed(prev, priors, 'BUYERS', 'HIGH')) {
    return { side: 'sell', state: 4 };
  }

  const battleWon = cur.prog != null && cur.prog >= ENTRY_REAL_PROG && cur.strength !== 'WEAK';
  if (battleWon && cur.upside === 'BUYERS_WIN' && cur.deltaSide === 'BUY' && prev && prev.downside === 'SELLERS_WIN' && !(prevSignal && prevSignal.side === 'buy')) {
    return { side: 'buy', state: 4 };
  }
  if (battleWon && cur.downside === 'SELLERS_WIN' && cur.deltaSide === 'SELL' && prev && prev.upside === 'BUYERS_WIN' && !(prevSignal && prevSignal.side === 'sell')) {
    return { side: 'sell', state: 4 };
  }
  // State 2 needs the delta on the same side as the trade. Without this check a
  // heavy SELL candle that closed high was marked BUY 2 "high delta, high response".
  if (cur.highDelta && cur.prog != null && cur.prog >= ENTRY_REAL_PROG) {
    const recent = priors.slice(-3);
    if (cur.deltaSide === 'SELL' && cur.downside === 'SELLERS_WIN' && recent.some((row) => row.downside === 'SELLERS_WIN') && !(prevSignal && prevSignal.side === 'sell')) {
      return { side: 'sell', state: 2 };
    }
    if (cur.deltaSide === 'BUY' && cur.upside === 'BUYERS_WIN' && recent.some((row) => row.upside === 'BUYERS_WIN') && !(prevSignal && prevSignal.side === 'buy')) {
      return { side: 'buy', state: 2 };
    }
  }

  const buyersLost = cur.highDelta && cur.deltaSide === 'BUY' && cur.upside === 'ASKS_HOLD';
  const sellersLost = cur.highDelta && cur.deltaSide === 'SELL' && cur.downside === 'BIDS_HOLD';
  const prevLostSame = prev && (
    (buyersLost && prev.highDelta && prev.deltaSide === 'BUY' && prev.upside === 'ASKS_HOLD') ||
    (sellersLost && prev.highDelta && prev.deltaSide === 'SELL' && prev.downside === 'BIDS_HOLD')
  );
  if (!prevLostSame && sellersLost) return { side: 'buy', state: 1 };
  if (!prevLostSame && buyersLost) return { side: 'sell', state: 1 };
  return null;
}

function lower(s: string): string {
  return s.replaceAll('_', ' ').toLowerCase();
}

/**
 * Closed candles the entry script would have taken, keyed by bar time.
 * `liveTime` is the open candle's time (it is skipped); pass null when every bar is closed.
 * A mark only appears when the side changes from the currently open one.
 */
export function entryMarks(
  bars: EntryBar[],
  liveTime: number | null,
  progress: EntryProgressRow[],
): Map<number, EntryMark> {
  const marks = new Map<number, EntryMark>();
  if (!bars || bars.length < ENTRY_PRIOR_BARS + 1) return marks;
  const lastIsLive = liveTime != null && bars[bars.length - 1]?.time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  const reads: EntryRead[] = [];
  for (let i = 0; i < last; i++) reads.push(barEntryRead(bars, i, progress));
  let openSide: EntrySide | null = null;
  for (let index = ENTRY_PRIOR_BARS; index < last; index++) {
    const cur = reads[index]!;
    const prev = reads[index - 1]!;
    const priors = reads.slice(Math.max(0, index - ENTRY_PRIOR_BARS), index);
    const signal = decideEntry(cur, prev, priors, openSide ? { side: openSide } : null);
    const stalled = cur.absProg != null && cur.absProg <= ENTRY_LITTLE_PROG
      && ((openSide === 'sell' && cur.downside === 'SELLERS_WIN') || (openSide === 'buy' && cur.upside === 'BUYERS_WIN'));
    if (!signal) {
      if (stalled || (openSide === 'sell' && cur.upside === 'BUYERS_WIN') || (openSide === 'buy' && cur.downside === 'SELLERS_WIN')) openSide = null;
      continue;
    }
    const time = bars[index]!.time;
    if (signal.side !== openSide && !marks.has(time)) {
      const buy = signal.side === 'buy';
      const word = buy ? 'BUY' : 'SELL';
      marks.set(time, {
        side: signal.side,
        state: signal.state,
        text: `${word} ${signal.state}`,
        short: `${buy ? 'B' : 'S'}${signal.state}`,
        color: buy ? '#22c55e' : '#ef4444',
        tip: `${word} ${signal.state}\n${ENTRY_DETAIL[signal.state]}\nUpside ${lower(cur.upside)} · downside ${lower(cur.downside)}`,
      });
    }
    openSide = signal.side;
  }
  return marks;
}
