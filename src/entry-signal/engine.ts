/**
 * Candle entry script: marks closed candles as BUY/SELL 1–8.
 *
 * Ported from public/app.js so the browser chart, the alerts and the backtest
 * all run the same rules. Inputs are closed footprint bars (quote notional
 * buy/sell totals + OHLC) and the delta-progress rows for the same bars.
 * Nothing here reads a later candle than the one being marked.
 */

import { shapeAt } from './shape.js';

export const ENTRY_LITTLE_PROG = 0.25;
export const ENTRY_REAL_PROG = 0.5;
export const ENTRY_RESPONSE_PROG = 0.8;
export const ENTRY_PRIOR_BARS = 6;
/** A state needs at least this many of those candles before the signal candle counts. */
export const ENTRY_CONTEXT_MIN = 5;
/** Aggressive imbalance has to lean at least this far, or the tape is still two-sided. */
export const ENTRY_AGG_LEAN = 0.08;
/** A response can carry a little refill against it. Past this, the book absorbed the move. */
export const ENTRY_PAS_GIVE = 0.2;
/** Current |delta| inside this band of the previous candle counts as the same effort. */
export const ENTRY_EFFORT_SAME_MIN = 0.7;
export const ENTRY_EFFORT_SAME_MAX = 1.15;
/** Response has faded when it is under half the previous candle's progress. */
export const ENTRY_RESPONSE_FADE = 0.5;
/**
 * A close inside this band did not extend the move.
 * 13 Nov 14:00 closed about 3 bp lower and was still the failure. A clearly lower close is not.
 */
export const ENTRY_CLOSE_FLAT = 0.0005;

/** Close position in range at or above this = buyers won the close. */
export const BATTLE_CLOSE_WIN = 0.55;
/** Buy/sell power split closer than this = PAIR. */
export const BATTLE_EVEN_GAP_PCT = 6;

export type EntryState = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type EntrySide = 'buy' | 'sell';

export const ENTRY_DETAIL: Record<EntryState, string> = {
  1: 'high effort absorbed, book refilled',
  2: 'high effort accepted, book did not refill',
  3: 'effort flipped, book refilled, price stopped',
  4: 'failed side, response held',
  5: 'side tried, book held, other side took it',
  6: 'effort stopped, open before the move',
  7: 'same effort, response faded',
  8: 'trend side could not move price',
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
  /** (buy − sell) / (buy + sell). Positive means aggressive buyers. Null when volume is missing. */
  agg: number | null;
  /** (bids replenished − asks replenished) / both. Positive means resting bids are heavier. */
  pas: number | null;
  /** Aggressive buys that did not lift the close. */
  askRepl: number | null;
  /** Aggressive sells that did not push the close down. */
  bidRepl: number | null;
  /** Buy notional minus sell notional. Null when the candle has no volume. */
  delta: number | null;
  /** Candle close, used to see whether the last 6 candles drifted up or down. */
  close: number | null;
  high: number | null;
  low: number | null;
  /** This candle is another defense of a low the bids already held. */
  atFloor: boolean;
  /** This candle is another defense of a high the asks already held. */
  atCeiling: boolean;
  /** Price went through that floor and the close came back above it. */
  failDown: boolean;
  /** Price went through that ceiling and the close came back below it. */
  failUp: boolean;
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
  /** A little under the close for a buy, a little over it for a sell. */
  price: number | null;
}

/** Chart label for the candle where the trend side's close fails. Not an entry by itself. */
export interface CouldntMark {
  side: 'BUY' | 'SELL';
  text: string;
  short: string;
  color: string;
  tip: string;
}

/** Chart label for the sweep that traps the trend side. Not an entry by itself. */
export interface TrapMark {
  side: 'BUY' | 'SELL';
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

/** A buy sits this far under the close. A sell sits this far over it. In ATR. */
export const ENTRY_PULLBACK_ATR = 0.15;

/**
 * A candle under this share of the recent median volume is too thin to take.
 * The buy or sell read can still be right. It is not a position.
 */
export const ENTRY_THIN_VOLUME = 0.45;

export function barQuoteVolume(bar: EntryBar): number {
  return Math.max(0, bar.totalBuy ?? 0) + Math.max(0, bar.totalSell ?? 0);
}

/** True when this candle traded well under the median of the prior candles that have volume. */
export function entryVolumeThin(bars: EntryBar[], index: number): boolean {
  const vol = barQuoteVolume(bars[index]!);
  const prior = bars
    .slice(Math.max(0, index - 16), index)
    .map(barQuoteVolume)
    .filter((v) => v > 0);
  if (prior.length < 6) return false;
  const scale = medianOf(prior);
  return scale > 0 && vol < scale * ENTRY_THIN_VOLUME;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * The working entry is a little better than the close.
 * A buy is under the close. A sell is over the close.
 * The step is part of the recent ATR, and also part of the way back into this candle.
 */
export function entryPullbackPrice(bar: EntryBar, prior: EntryBar[], side: EntrySide): number | null {
  if (!(bar.close > 0) || !Number.isFinite(bar.high) || !Number.isFinite(bar.low)) return null;
  const atr = recentBarAtr(prior, bar);
  const room = side === 'buy' ? Math.max(0, bar.close - bar.low) : Math.max(0, bar.high - bar.close);
  const step = Math.min(Math.max(room * 0.35, atr * ENTRY_PULLBACK_ATR), atr * 0.3);
  if (!(step > 0)) return bar.close;
  return side === 'buy' ? bar.close - step : bar.close + step;
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

const NO_LEVEL = { atFloor: false, atCeiling: false, failDown: false, failUp: false };

/**
 * Floor: the swing low, defended at least once already, and this close holds above it.
 * Ceiling: the swing high, defended at least once already, and this close holds below it.
 * One test is not a floor or a ceiling. A failure is a break of that level whose close comes back.
 */
function levelFlags(bar: EntryBar, prior: EntryBar[]): Pick<EntryRead, 'atFloor' | 'atCeiling' | 'failDown' | 'failUp'> {
  if (prior.length < 5) return NO_LEVEL;
  const { support, resistance } = priorSwingLevels(prior);
  if (support == null || resistance == null || resistance <= support) return NO_LEVEL;
  const atr = recentBarAtr(prior, bar);
  const band = Math.max((resistance - support) * 0.08, atr * 0.35);
  let floorTests = 0;
  let ceilingTests = 0;
  for (const b of prior) {
    const range = b.high - b.low;
    if (!(range > 0)) continue;
    const closePos = (b.close - b.low) / range;
    if (b.low <= support + band && b.close > support && closePos >= BATTLE_CLOSE_WIN) floorTests += 1;
    if (b.high >= resistance - band && b.close < resistance && closePos <= 1 - BATTLE_CLOSE_WIN) ceilingTests += 1;
  }
  const range = bar.high - bar.low;
  const closePos = range > 0 ? (bar.close - bar.low) / range : 0.5;
  const holdsFloor = bar.low <= support + band && bar.close > support && closePos >= BATTLE_CLOSE_WIN;
  const holdsCeiling = bar.high >= resistance - band && bar.close < resistance && closePos <= 1 - BATTLE_CLOSE_WIN;
  return {
    atFloor: floorTests >= 1 && holdsFloor,
    atCeiling: ceilingTests >= 1 && holdsCeiling,
    failDown: floorTests >= 1 && bar.low < support && bar.close > support,
    failUp: ceilingTests >= 1 && bar.high > resistance && bar.close < resistance,
  };
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

/** Aggressive imbalance and the bid/ask replenishment behind passive imbalance. */
export function barPressure(bar: EntryBar): Pick<EntryRead, 'agg' | 'pas' | 'askRepl' | 'bidRepl'> {
  const buy = Math.max(0, bar.totalBuy ?? 0);
  const sell = Math.max(0, bar.totalSell ?? 0);
  const vol = buy + sell;
  if (vol <= 0) return { agg: null, pas: null, askRepl: null, bidRepl: null };
  const range = bar.high - bar.low;
  const closePos = range > 0 ? Math.min(1, Math.max(0, (bar.close - bar.low) / range)) : 0.5;
  const askRepl = buy * (1 - closePos);
  const bidRepl = sell * closePos;
  const repl = askRepl + bidRepl;
  return {
    agg: (buy - sell) / vol,
    pas: repl > 0 ? (bidRepl - askRepl) / repl : 0,
    askRepl,
    bidRepl,
  };
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
    ...barPressure(bar),
    delta: (bar.totalBuy ?? 0) + (bar.totalSell ?? 0) > 0 ? (bar.totalBuy ?? 0) - (bar.totalSell ?? 0) : null,
    close: Number.isFinite(bar.close) ? bar.close : null,
    high: Number.isFinite(bar.high) ? bar.high : null,
    low: Number.isFinite(bar.low) ? bar.low : null,
    ...levelFlags(bar, prior),
  };
}

type EffortSide = 'BUY' | 'SELL';

function known(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

/** The tape actually belongs to that side, not a large delta with both sides active. */
function aggLeans(row: EntryRead, side: EffortSide): boolean {
  if (!known(row.agg)) return true;
  return side === 'BUY' ? row.agg >= ENTRY_AGG_LEAN : row.agg <= -ENTRY_AGG_LEAN;
}

/** Resting liquidity did not refill against this side. Bids heavier agrees with a buy. */
function passiveAgrees(row: EntryRead, side: EffortSide): boolean {
  if (!known(row.pas)) return true;
  return side === 'BUY' ? row.pas >= 0 : row.pas <= 0;
}

/**
 * The response can stand a little refill against it.
 * A buy still holds when asks are not more than ENTRY_PAS_GIVE heavier than bids.
 */
function responseHeld(row: EntryRead, side: EffortSide): boolean {
  if (!known(row.pas)) return true;
  return side === 'BUY' ? row.pas >= -ENTRY_PAS_GIVE : row.pas <= ENTRY_PAS_GIVE;
}

/** The other book refilled against this side's aggression. */
function passiveAbsorbs(row: EntryRead, side: EffortSide): boolean {
  if (known(row.pas)) return side === 'BUY' ? row.pas < 0 : row.pas > 0;
  return side === 'BUY' ? row.upside === 'ASKS_HOLD' : row.downside === 'BIDS_HOLD';
}

/** The setup is the last 6 candles. Fewer than 5 means the state has no context yet. */
function setupContext(priors: EntryRead[]): EntryRead[] | null {
  const recent = priors.slice(-ENTRY_PRIOR_BARS);
  return recent.length >= ENTRY_CONTEXT_MIN ? recent : null;
}

function countDelta(recent: EntryRead[], side: EffortSide): number {
  let n = 0;
  for (const row of recent) if (row.deltaSide === side) n += 1;
  return n;
}

function countWins(recent: EntryRead[], outcome: 'BUYERS_WIN' | 'SELLERS_WIN'): number {
  let n = 0;
  for (const row of recent) {
    if (outcome === 'BUYERS_WIN' ? row.upside === 'BUYERS_WIN' : row.downside === 'SELLERS_WIN') n += 1;
  }
  return n;
}

/**
 * The other side already failed inside the 6-candle setup.
 * One trap or one winning candle is not enough; the window has to show it twice,
 * and the candle just before the signal still belongs to that failure.
 */
function failedSideShown(recent: EntryRead[], chip: 'SELLERS' | 'BUYERS', trap: 'HIGH' | 'LOW'): boolean {
  let n = 0;
  for (const row of recent) {
    const hunted = row.hunt === trap;
    const owned = chip === 'SELLERS'
      ? row.chip === 'SELLERS' || row.downside === 'SELLERS_WIN'
      : row.chip === 'BUYERS' || row.upside === 'BUYERS_WIN';
    if (hunted || owned) n += 1;
  }
  if (n < 2) return false;
  const prev = recent[recent.length - 1];
  if (!prev) return false;
  if (prev.hunt === trap) return true;
  return chip === 'SELLERS'
    ? prev.chip === 'SELLERS' || prev.downside === 'SELLERS_WIN' || prev.chip === 'PAIR'
    : prev.chip === 'BUYERS' || prev.upside === 'BUYERS_WIN' || prev.chip === 'PAIR';
}

function priorsOwn(priors: EntryRead[], chip: 'BUYERS' | 'SELLERS'): boolean {
  const recent = priors.slice(-ENTRY_PRIOR_BARS);
  if (recent.length < ENTRY_CONTEXT_MIN) return false;
  const other = chip === 'SELLERS' ? 'BUYERS' : 'SELLERS';
  let mine = 0;
  let theirs = 0;
  for (const row of recent) {
    if (row.chip === chip) mine += 1;
    else if (row.chip === other) theirs += 1;
  }
  return mine >= 2 && mine > theirs;
}

/**
 * A side tried across the 6-candle setup and the book refilled against them.
 * At least 3 of those candles are that delta, at least 2 failed to extend
 * or got absorbed, and the candle just before this one still shows that absorption.
 */
function triedButCouldnt(priors: EntryRead[], side: 'SELL' | 'BUY'): boolean {
  const recent = priors.slice(-ENTRY_PRIOR_BARS);
  if (recent.length < ENTRY_CONTEXT_MIN) return false;
  let tries = 0;
  let failed = 0;
  for (const row of recent) {
    if (row.deltaSide !== side) continue;
    tries += 1;
    const extended = row.prog != null && row.prog >= ENTRY_REAL_PROG;
    const won = side === 'SELL' ? row.downside === 'SELLERS_WIN' : row.upside === 'BUYERS_WIN';
    const refilled = known(row.pas) && passiveAbsorbs(row, side);
    if (!extended || !won || refilled) failed += 1;
  }
  if (tries < 3 || failed < 2) return false;
  const prev = priors[priors.length - 1];
  if (!prev || prev.deltaSide !== side) return false;
  if (known(prev.pas)) return passiveAbsorbs(prev, side);
  const prevExtended = prev.prog != null && prev.prog >= ENTRY_REAL_PROG;
  const prevWon = side === 'SELL' ? prev.downside === 'SELLERS_WIN' : prev.upside === 'BUYERS_WIN';
  return !prevExtended || !prevWon;
}

/**
 * Downtrend book is the asks. Uptrend book is the bids.
 * A known passive number decides it. Otherwise the close has to show that book.
 */
function trendBookSeen(row: EntryRead, trend: EffortSide): boolean {
  if (trend === 'SELL') {
    if (known(row.pas)) return row.pas <= 0;
    return row.chip === 'ASKS' || row.upside === 'ASKS_HOLD';
  }
  if (known(row.pas)) return row.pas >= 0;
  return row.chip === 'BIDS' || row.downside === 'BIDS_HOLD';
}

/** Down if the window's close drifted lower, up if it drifted higher. */
function priceDrift(recent: EntryRead[]): EffortSide | null {
  const closes = recent.map((row) => row.close).filter((n): n is number => known(n));
  if (closes.length < ENTRY_CONTEXT_MIN) return null;
  const first = closes[0]!;
  const last = closes[closes.length - 1]!;
  if (!(first > 0)) return null;
  const change = (last - first) / first;
  if (change <= -0.0025) return 'SELL';
  if (change >= 0.0025) return 'BUY';
  return null;
}

/** The last 16 closes. A real swing, not the 6-candle trend. */
const SWING_BARS = 16;
const SWING_DRIFT = 0.005;

function swingSide(prior: EntryRead[]): EffortSide | null {
  const closes = prior.slice(-SWING_BARS).map((row) => row.close).filter((n): n is number => known(n));
  if (closes.length < SWING_BARS) return null;
  const first = closes[0]!;
  const last = closes[closes.length - 1]!;
  if (!(first > 0)) return null;
  const change = (last - first) / first;
  if (change <= -SWING_DRIFT) return 'SELL';
  if (change >= SWING_DRIFT) return 'BUY';
  return null;
}

/**
 * In a drop, sells stand and a buy has to be the sell failing or being taken.
 * In a rise, buys stand and a sell has to be the buy failing, a real response, or the join once the six have turned.
 */
function keptInMarket(side: EntrySide, state: EntryState, market: EffortSide | null): EntrySignal | null {
  const against = (market === 'SELL' && side === 'buy') || (market === 'BUY' && side === 'sell');
  if (against) {
    const buyOk = side === 'buy' && (state === 1 || state === 5 || state === 8);
    const sellOk = side === 'sell' && (state === 1 || state === 2 || state === 4 || state === 5 || state === 8);
    if (!buyOk && !sellOk) return null;
  }
  return { side, state };
}

function trendTrying(row: EntryRead, trend: EffortSide): boolean {
  if (trend === 'SELL') {
    return row.deltaSide === 'SELL' || row.chip === 'SELLERS' || row.chip === 'ASKS' || row.upside === 'ASKS_HOLD' || row.downside === 'SELLERS_WIN';
  }
  return row.deltaSide === 'BUY' || row.chip === 'BUYERS' || row.chip === 'BIDS' || row.downside === 'BIDS_HOLD' || row.upside === 'BUYERS_WIN';
}

/**
 * The side taking over actually showed up on this candle: its aggression leans,
 * or the close moved at least ENTRY_LITTLE_PROG ATR its way.
 * A flat, two-sided candle after a trend is a pause, not the other side winning.
 */
function sideShowedUp(cur: EntryRead, prev: EntryRead | null, side: EffortSide): boolean {
  if (cur.deltaSide === side && known(cur.agg) && aggLeans(cur, side)) return true;
  const moved = cur.absProg != null && cur.absProg >= ENTRY_LITTLE_PROG;
  return moved && (side === 'BUY' ? closeStillUp(cur, prev) : closeStillDown(cur, prev));
}

/**
 * The 6 candles are that trend. A price drift is enough when that side's book
 * showed up. Without closes, the aggressive side has to lean, with its book,
 * and either move price once or keep leaning for 3 candles.
 */
function trendContext(recent: EntryRead[], trend: EffortSide): boolean {
  const other: EffortSide = trend === 'SELL' ? 'BUY' : 'SELL';
  let effort = 0;
  let otherEffort = 0;
  let book = false;
  let moved = false;
  let tries = 0;
  for (const row of recent) {
    if (trendTrying(row, trend)) {
      tries += 1;
      if (trendBookSeen(row, trend)) book = true;
      if (row.deltaSide === trend && row.prog != null && row.prog >= ENTRY_REAL_PROG) moved = true;
    }
    if (row.deltaSide === trend && aggLeans(row, trend)) effort += 1;
    else if (row.deltaSide === other && aggLeans(row, other)) otherEffort += 1;
  }
  const drift = priceDrift(recent);
  if (drift === trend) return book && tries >= 2;
  if (drift != null) return false;
  // Closes are here and did not drift. That is not a trend, so state 8 stays quiet.
  // Missing closes keep the effort rule, so a fixture without prices still resolves.
  const closes = recent.map((row) => row.close).filter((n): n is number => known(n));
  if (closes.length >= ENTRY_CONTEXT_MIN) return false;
  return effort >= 2 && effort > otherEffort && book && (moved || effort >= 3);
}

/**
 * States 1–7 use the same trend as state 8.
 * A flat window, or rows with no close, keeps the older rule.
 * A real drift has to be that side, with its book: asks on the way down, bids on the way up.
 */
function inTrend(recent: EntryRead[], trend: EffortSide): boolean {
  const drift = priceDrift(recent);
  if (drift == null) return true;
  return trendContext(recent, trend);
}

/**
 * A join or a response needs the six closes to have drifted that way.
 * A flat window is price pinned while the delta flips. That is not the move.
 * No closes keeps the older rule, so a fixture without prices still resolves.
 */
function drifted(recent: EntryRead[], trend: EffortSide): boolean {
  const drift = priceDrift(recent);
  if (drift == null) {
    const closes = recent.map((row) => row.close).filter((n): n is number => known(n));
    if (closes.length >= ENTRY_CONTEXT_MIN) return false;
  }
  return inTrend(recent, trend);
}

/** The candle before the signal still belongs to that trend, so this is the first failure. */
function prevStillTrend(prev: EntryRead, trend: EffortSide): boolean {
  if (trend === 'SELL') {
    return prev.deltaSide === 'SELL' || prev.downside === 'SELLERS_WIN' || prev.chip === 'SELLERS' || prev.chip === 'ASKS' || prev.upside === 'ASKS_HOLD';
  }
  return prev.deltaSide === 'BUY' || prev.upside === 'BUYERS_WIN' || prev.chip === 'BUYERS' || prev.chip === 'BIDS' || prev.downside === 'BIDS_HOLD';
}

/**
 * The four groups on one candle.
 * Aggressive buyers and sellers come from the tape. Asks and bids come from the close and from Pas.
 */
function fight(row: EntryRead) {
  return {
    aggBuyers: row.deltaSide === 'BUY' && aggLeans(row, 'BUY'),
    aggSellers: row.deltaSide === 'SELL' && aggLeans(row, 'SELL'),
    asks: row.upside === 'ASKS_HOLD' || row.chip === 'ASKS' || (known(row.pas) && row.pas < 0),
    bids: row.downside === 'BIDS_HOLD' || row.chip === 'BIDS' || (known(row.pas) && row.pas > 0),
  };
}

/** Aggressive buyers won the close and the bids are with them. */
function buyersOwnClose(row: EntryRead): boolean {
  const groups = fight(row);
  return groups.aggBuyers && row.upside === 'BUYERS_WIN' && groups.bids && passiveAgrees(row, 'BUY');
}

/** Aggressive sellers won the close and the asks are with them. */
function sellersOwnClose(row: EntryRead): boolean {
  const groups = fight(row);
  return groups.aggSellers && row.downside === 'SELLERS_WIN' && groups.asks && passiveAgrees(row, 'SELL');
}

/** Buyers own the close, or they moved price while asks were still sitting on it. */
function buyersTook(row: EntryRead): boolean {
  const groups = fight(row);
  if (buyersOwnClose(row)) return true;
  return groups.aggBuyers && groups.asks && row.upside !== 'BUYERS_WIN';
}

/** Sellers own the close, or they moved price while bids were still sitting on it. */
function sellersTook(row: EntryRead): boolean {
  const groups = fight(row);
  if (sellersOwnClose(row)) return true;
  return groups.aggSellers && groups.bids && row.downside !== 'SELLERS_WIN';
}

/**
 * The trend did not get its price. A downtrend fails when the close comes back up,
 * an uptrend when the close goes back down. Weak or flat delta still counts:
 * 14:00 was a weak print that closed high after the asks could not extend the drop.
 * A high-delta candle is already decided by states 1–5.
 */
function trendFailed(cur: EntryRead, trend: EffortSide): boolean {
  if (cur.highDelta) return false;
  if (trend === 'SELL') {
    if (cur.upside !== 'BUYERS_WIN') return false;
    return !(cur.deltaSide === 'SELL' && cur.prog != null && cur.prog >= ENTRY_REAL_PROG);
  }
  if (cur.downside !== 'SELLERS_WIN') return false;
  return !(cur.deltaSide === 'BUY' && cur.prog != null && cur.prog >= ENTRY_REAL_PROG);
}

/**
 * Sellers can't: this close did not go down versus the previous close.
 * Buyers can't: this close did not go up versus the previous close.
 * Finishing off the low of a candle that still closed lower is sellers getting price down.
 * A close only a few bp through the previous close did not extend. 14:00 is that case.
 */
/**
 * The close ticked against that effort, but not by a real amount, and the tape is still that side.
 * 14 Nov 18:00 and 19:00 did this inside the sell. That is not a buy.
 * No previous close keeps the older rule.
 */
/** This close is still lower than the previous close. Sellers are getting price down. */
function closeStillDown(cur: EntryRead, prev: EntryRead | null): boolean {
  if (!known(cur.close) || !prev || !known(prev.close) || !(prev.close > 0)) return false;
  return (cur.close - prev.close) / prev.close < -ENTRY_CLOSE_FLAT;
}

/** This close is still higher than the previous close. Buyers are getting price up. */
function closeStillUp(cur: EntryRead, prev: EntryRead | null): boolean {
  if (!known(cur.close) || !prev || !known(prev.close) || !(prev.close > 0)) return false;
  return (cur.close - prev.close) / prev.close > ENTRY_CLOSE_FLAT;
}

function weakBounce(cur: EntryRead, prev: EntryRead | null, effort: EffortSide): boolean {
  if (!known(cur.close) || !prev || !known(prev.close) || !(prev.close > 0)) return false;
  // Against the effort, but not a real answer. Progress with the effort is not a bounce.
  if (cur.deltaSide !== effort || cur.prog == null || cur.prog >= 0 || cur.prog <= -ENTRY_REAL_PROG) return false;
  const change = (cur.close - prev.close) / prev.close;
  return effort === 'SELL' ? change > ENTRY_CLOSE_FLAT : change < -ENTRY_CLOSE_FLAT;
}

function closeCouldnt(row: EntryRead, prev: EntryRead | null, side: EffortSide): boolean {
  if (known(row.close) && prev && known(prev.close) && prev.close > 0) {
    const change = (row.close - prev.close) / prev.close;
    if (side === 'SELL') return change > -ENTRY_CLOSE_FLAT;
    return change < ENTRY_CLOSE_FLAT;
  }
  if (side === 'SELL') return row.upside === 'BUYERS_WIN';
  return row.downside === 'SELLERS_WIN';
}

/**
 * The 6 candles are that trend, and the latest effort candle already lost its close.
 * Null means the window has no trend read, so states 1–7 keep their older rule.
 */
function effortCouldnt(recent: EntryRead[], side: EffortSide): boolean | null {
  if (recent.length < ENTRY_CONTEXT_MIN) return null;
  if (!trendContext(recent, side)) return priceDrift(recent) == null ? null : false;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (!trendTrying(recent[i]!, side)) continue;
    return closeCouldnt(recent[i]!, i > 0 ? recent[i - 1]! : null, side);
  }
  return null;
}

/** The signal candle is where that side's price stops: the close turns, or progress stalls. */
function candleFailsSide(cur: EntryRead, prev: EntryRead | null, side: EffortSide): boolean {
  if (closeCouldnt(cur, prev, side)) return true;
  if (cur.prog != null && cur.absProg != null && cur.absProg <= ENTRY_LITTLE_PROG) return true;
  return cur.deltaSide === side && cur.prog != null && cur.prog < ENTRY_REAL_PROG;
}

/**
 * A fade stands when that side already can't, or when this candle is the failure.
 * A flat window keeps the older rule.
 */
function fadeStands(recent: EntryRead[], cur: EntryRead, prev: EntryRead | null, side: EffortSide): boolean {
  const prior = effortCouldnt(recent, side);
  if (prior == null || prior) return true;
  return candleFailsSide(cur, prev, side);
}

/**
 * The swing has already run, and this candle closed on a new extreme.
 * 11 Nov 10:00 NEAR: the drop was already in, then the candle closed on its low.
 * Joining that sell was the low. The mirror is a buy that closes on a new high.
 */
function chaseExtreme(cur: EntryRead, priors: EntryRead[], side: EffortSide): boolean {
  if (swingSide(priors) !== side) return false;
  if (!known(cur.close) || !known(cur.high) || !known(cur.low)) return false;
  const range = cur.high - cur.low;
  if (!(range > 0)) return false;
  const pos = (cur.close - cur.low) / range;
  if (side === 'SELL' ? pos > 0.12 : pos < 0.88) return false;
  const recent = priors.slice(-ENTRY_PRIOR_BARS);
  const edges = recent.map((row) => side === 'SELL' ? row.low : row.high).filter((n): n is number => known(n));
  if (!edges.length) return false;
  const edge = side === 'SELL' ? Math.min(...edges) : Math.max(...edges);
  return side === 'SELL' ? cur.close < edge : cur.close > edge;
}

/** A join stays quiet once that side has already lost its close inside the 6. */
function joinStands(recent: EntryRead[], side: EffortSide): boolean {
  const prior = effortCouldnt(recent, side);
  if (prior == null) return true;
  return !prior;
}

/** Latest sweep in the window. LOW traps sellers. HIGH traps buyers. */
function latestHunt(rows: EntryRead[]): 'HIGH' | 'LOW' | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const hunt = rows[i]?.hunt;
    if (hunt === 'HIGH' || hunt === 'LOW') return hunt;
  }
  return null;
}

/**
 * S trap: a downtrend (or a window with no drift) whose low was taken and given back.
 * B trap: an uptrend (or a window with no drift) whose high was taken and given back.
 * A sweep against the trend is not that side's trap. Null means no trap.
 */
function trendTrap(recent: EntryRead[], cur: EntryRead | null): EffortSide | null {
  const hunt = latestHunt(cur ? [...recent, cur] : recent);
  if (hunt === 'LOW') {
    if (trendContext(recent, 'SELL') || priceDrift(recent) == null) return 'SELL';
    return null;
  }
  if (hunt === 'HIGH') {
    if (trendContext(recent, 'BUY') || priceDrift(recent) == null) return 'BUY';
    return null;
  }
  return null;
}

/** A buy fade needs an S trap when one is there. A sell fade needs a B trap. No trap keeps the older rule. */
function trapAllowsFade(recent: EntryRead[], cur: EntryRead, faded: EffortSide): boolean {
  const trap = trendTrap(recent, cur);
  if (trap == null) return true;
  return trap === faded;
}

/** A join stays quiet when that side is the one that just got trapped. */
function trapAllowsJoin(recent: EntryRead[], cur: EntryRead, joining: EffortSide): boolean {
  const trap = trendTrap(recent, cur);
  if (trap == null) return true;
  return trap !== joining;
}

function levelSeen(rows: EntryRead[]): { floor: boolean; ceiling: boolean } {
  let floor = false;
  let ceiling = false;
  for (const row of rows) {
    if (row.atFloor || row.failDown) floor = true;
    if (row.atCeiling || row.failUp) ceiling = true;
  }
  return { floor, ceiling };
}

/**
 * A buy fade stands at a floor or a failed break down. A sell fade stands at a ceiling or a failed break up.
 * The other level blocks that fade. No floor and no ceiling keeps the older rule.
 */
function levelAllowsFade(recent: EntryRead[], cur: EntryRead, faded: EffortSide): boolean {
  const { floor, ceiling } = levelSeen([...recent, cur]);
  if (!floor && !ceiling) return true;
  if (floor && !ceiling) return faded === 'SELL';
  if (ceiling && !floor) return faded === 'BUY';
  return true;
}

/** Highest high of that side's candles in the six, or the lowest low. */
function sideExtreme(recent: EntryRead[], side: EffortSide, edge: 'high' | 'low'): number | null {
  let best: number | null = null;
  for (const row of recent) {
    if (row.deltaSide !== side) continue;
    const value = edge === 'high' ? row.high : row.low;
    if (!known(value)) continue;
    if (best == null || (edge === 'high' ? value > best : value < best)) best = value;
  }
  return best;
}

/**
 * A buy response has to trade above the sell candles' high.
 * A sell response has to trade under the buy candles' low.
 * No prices keeps the older rule.
 */
function responseClears(recent: EntryRead[], cur: EntryRead, failed: EffortSide): boolean {
  if (failed === 'SELL') {
    const cap = sideExtreme(recent, 'SELL', 'high');
    if (cap == null || !known(cur.high)) return true;
    return cur.high >= cap;
  }
  const floor = sideExtreme(recent, 'BUY', 'low');
  if (floor == null || !known(cur.low)) return true;
  return cur.low <= floor;
}

/**
 * The other side's effort is still the larger one in the six.
 * Unknown deltas do not count, so this stays quiet in fixtures without volume.
 */
function effortDominates(recent: EntryRead[], side: EffortSide): boolean {
  const other: EffortSide = side === 'SELL' ? 'BUY' : 'SELL';
  let mine = 0;
  let theirs = 0;
  let mineN = 0;
  for (const row of recent) {
    if (!known(row.delta) || (row.deltaSide !== side && row.deltaSide !== other)) continue;
    if (row.deltaSide === side) {
      mine += Math.abs(row.delta);
      mineN += 1;
    } else theirs += Math.abs(row.delta);
  }
  return mineN >= 2 && mine > theirs;
}

/**
 * A bounce that never cleared the other side, then this candle gives it back.
 * 14 Nov 16:45 closed up inside the sell. 17:00 gave that close back. That is the sell.
 * The mirror is a buy. A real extension is left to state 2.
 */
function bounceFailed(recent: EntryRead[], prev: EntryRead | null, cur: EntryRead): EntrySignal | null {
  if (!prev) return null;
  const gaveBack = known(cur.close) && known(prev.close) && prev.close > 0
    ? (cur.close - prev.close) / prev.close
    : null;
  const extended = cur.prog != null && cur.prog >= ENTRY_REAL_PROG;
  if (
    prev.deltaSide === 'BUY' && prev.upside === 'BUYERS_WIN'
    && cur.deltaSide === 'SELL' && aggLeans(cur, 'SELL')
    && !extended
    && effortDominates(recent, 'SELL')
    && !responseClears(recent, prev, 'SELL')
    && (gaveBack == null || gaveBack <= ENTRY_CLOSE_FLAT)
  ) {
    return { side: 'sell', state: 3 };
  }
  if (
    prev.deltaSide === 'SELL' && prev.downside === 'SELLERS_WIN'
    && cur.deltaSide === 'BUY' && aggLeans(cur, 'BUY')
    && !extended
    && effortDominates(recent, 'BUY')
    && !responseClears(recent, prev, 'BUY')
    && (gaveBack == null || gaveBack >= -ENTRY_CLOSE_FLAT)
  ) {
    return { side: 'buy', state: 3 };
  }
  return null;
}

/** A buy join stays quiet into a ceiling. A sell join stays quiet into a floor. */
function levelAllowsJoin(recent: EntryRead[], cur: EntryRead, joining: EffortSide): boolean {
  const { floor, ceiling } = levelSeen([...recent, cur]);
  if (joining === 'BUY' && ceiling && !floor) return false;
  if (joining === 'SELL' && floor && !ceiling) return false;
  return true;
}

/**
 * One entry from the last closed candle. The 6 candles before it are read first.
 * Effort is the aggressive imbalance. The book is passive imbalance and A/B replenishment.
 * 1 that side was already pushing, then this candle's effort is absorbed.
 * 2 that side already owns the setup, then this candle's effort is accepted.
 * 3 that side's effort was accepted in the setup, this candle flips and the book refills.
 * 4 that side already failed in the setup, then this candle's response holds.
 * 5 that side tried across the setup and the book held, then the other side takes it.
 * 6 that side's effort just stopped progressing, so the other side is opened before its candles start.
 * 7 effort stays about the same as the previous candle and the response fades, so the other side is opened on this candle.
 * 8 the trend is down and aggressive sellers plus asks cannot push price down, so this candle is a buy.
 *    The trend is up and aggressive buyers plus bids cannot push price up, so this candle is a sell.
 * Every state reads that same trend. A downtrend is sellers and asks. An uptrend is buyers and bids.
 * Fades need the trend they are fading. A push with the move needs that side's trend.
 * Sellers can't means a downtrend whose sellers and asks did not get the close down.
 * Buyers can't means an uptrend whose buyers and bids did not get the close up.
 * A fade stands when that side already can't, or when this candle is that failure.
 * A join stays quiet when that side already can't.
 * S trap is a downtrend that took the prior low and closed back up. B trap is the mirror.
 * States 1, 4, 5, and 8 stand with that trap. State 2 stays quiet when its side was trapped.
 * A floor is a low the bids have already held. A ceiling is a high the asks have already held.
 * Fail down is a break of the floor whose close comes back. Fail up is the mirror.
 * A buy fade stands at the floor. A sell fade stands at the ceiling. A join stays quiet into that level.
 */
export function decideEntry(
  cur: EntryRead | null,
  prev: EntryRead | null,
  priors: EntryRead[],
  prevSignal: { side: EntrySide } | null,
): EntrySignal | null {
  const recent = cur ? setupContext(priors) : null;
  if (!cur || !recent) return null;
  const market = swingSide(priors);
  const bounce = bounceFailed(recent, prev, cur);
  if (bounce && inTrend(recent, bounce.side === 'sell' ? 'SELL' : 'BUY')) return keptInMarket(bounce.side, bounce.state, market);
  const real = cur.prog != null && cur.prog >= ENTRY_REAL_PROG;
  const little = cur.absProg != null && cur.absProg <= ENTRY_LITTLE_PROG;
  const prevSide = prev?.deltaSide === 'BUY' || prev?.deltaSide === 'SELL' ? prev.deltaSide : null;
  const prevAccepted = !!prev && !!prevSide && prev.highDelta && prev.prog != null && prev.prog >= ENTRY_REAL_PROG
    && aggLeans(prev, prevSide) && passiveAgrees(prev, prevSide)
    && countDelta(recent, prevSide) >= 2;

  if (prevAccepted && cur.highDelta && little) {
    if (prevSide === 'SELL' && cur.deltaSide === 'BUY' && aggLeans(cur, 'BUY') && passiveAbsorbs(cur, 'BUY')) {
      if (!inTrend(recent, 'SELL') || !fadeStands(recent, cur, prev, 'SELL')) return null;
      return keptInMarket('buy', 3, market);
    }
    if (prevSide === 'BUY' && cur.deltaSide === 'SELL' && aggLeans(cur, 'SELL') && passiveAbsorbs(cur, 'SELL')) {
      if (!inTrend(recent, 'BUY') || !fadeStands(recent, cur, prev, 'BUY')) return null;
      return keptInMarket('sell', 3, market);
    }
  }

  if (cur.highDelta && real) {
    const effort = cur.deltaSide === 'BUY' ? 'BUY' : cur.deltaSide === 'SELL' ? 'SELL' : null;
    const chip = effort === 'BUY' ? 'BUYERS' : effort === 'SELL' ? 'SELLERS' : null;
    const side: EntrySide = chip === 'BUYERS' ? 'buy' : 'sell';
    const continued = chip && prevSignal && prevSignal.side === side;
    const took = effort === 'BUY' ? buyersOwnClose(cur) : effort === 'SELL' ? sellersOwnClose(cur) : false;
    if (chip && effort && took && cur.chip === chip && priorsOwn(recent, chip) && !continued && passiveAgrees(cur, effort)) {
      if (!drifted(recent, effort) || !joinStands(recent, effort) || !trapAllowsJoin(recent, cur, effort) || !levelAllowsJoin(recent, cur, effort) || chaseExtreme(cur, priors, effort)) return null;
      return keptInMarket(side, 2, market);
    }
  }

  const responded = cur.prog != null && cur.prog >= ENTRY_RESPONSE_PROG && !cur.highDelta;
  if (responded && buyersOwnClose(cur) && failedSideShown(recent, 'SELLERS', 'LOW')) {
    if (!drifted(recent, 'SELL') || !fadeStands(recent, cur, prev, 'SELL') || !trapAllowsFade(recent, cur, 'SELL') || !levelAllowsFade(recent, cur, 'SELL')) return null;
    return keptInMarket('buy', 4, market);
  }
  if (responded && sellersOwnClose(cur) && failedSideShown(recent, 'BUYERS', 'HIGH')) {
    if (!drifted(recent, 'BUY') || !fadeStands(recent, cur, prev, 'BUY') || !trapAllowsFade(recent, cur, 'BUY') || !levelAllowsFade(recent, cur, 'BUY')) return null;
    return keptInMarket('sell', 4, market);
  }

  const battleWon = cur.prog != null && cur.prog >= ENTRY_REAL_PROG && cur.strength !== 'WEAK';
  if (battleWon && buyersOwnClose(cur) && failedSideShown(recent, 'SELLERS', 'LOW') && !(prevSignal && prevSignal.side === 'buy')) {
    if (!drifted(recent, 'SELL') || !fadeStands(recent, cur, prev, 'SELL') || !trapAllowsFade(recent, cur, 'SELL') || !levelAllowsFade(recent, cur, 'SELL')) return null;
    return keptInMarket('buy', 4, market);
  }
  if (battleWon && sellersOwnClose(cur) && failedSideShown(recent, 'BUYERS', 'HIGH') && !(prevSignal && prevSignal.side === 'sell')) {
    if (!drifted(recent, 'BUY') || !fadeStands(recent, cur, prev, 'BUY') || !trapAllowsFade(recent, cur, 'BUY') || !levelAllowsFade(recent, cur, 'BUY')) return null;
    return keptInMarket('sell', 4, market);
  }
  // State 2 needs the delta on the same side as the trade, and at least two of the
  // setup candles already won that battle. A heavy SELL candle that closed high stays a fade.
  if (cur.highDelta && real) {
    if (sellersOwnClose(cur) && countWins(recent, 'SELLERS_WIN') >= 2 && !(prevSignal && prevSignal.side === 'sell')) {
      if (!drifted(recent, 'SELL') || !joinStands(recent, 'SELL') || !trapAllowsJoin(recent, cur, 'SELL') || !levelAllowsJoin(recent, cur, 'SELL') || chaseExtreme(cur, priors, 'SELL')) return null;
      return keptInMarket('sell', 2, market);
    }
    if (buyersOwnClose(cur) && countWins(recent, 'BUYERS_WIN') >= 2 && !(prevSignal && prevSignal.side === 'buy')) {
      if (!drifted(recent, 'BUY') || !joinStands(recent, 'BUY') || !trapAllowsJoin(recent, cur, 'BUY') || !levelAllowsJoin(recent, cur, 'BUY') || chaseExtreme(cur, priors, 'BUY')) return null;
      return keptInMarket('buy', 2, market);
    }
  }

  if (cur.highDelta && real && buyersTook(cur) && triedButCouldnt(recent, 'SELL')) {
    if (!inTrend(recent, 'SELL') || !fadeStands(recent, cur, prev, 'SELL') || !trapAllowsFade(recent, cur, 'SELL') || !levelAllowsFade(recent, cur, 'SELL')) return null;
    return keptInMarket('buy', 5, market);
  }
  if (cur.highDelta && real && sellersTook(cur) && triedButCouldnt(recent, 'BUY')) {
    if (!inTrend(recent, 'BUY') || !fadeStands(recent, cur, prev, 'BUY') || !trapAllowsFade(recent, cur, 'BUY') || !levelAllowsFade(recent, cur, 'BUY')) return null;
    return keptInMarket('sell', 5, market);
  }

  const buyersLost = cur.highDelta && cur.deltaSide === 'BUY' && cur.upside === 'ASKS_HOLD' && aggLeans(cur, 'BUY') && passiveAbsorbs(cur, 'BUY');
  const sellersLost = cur.highDelta && cur.deltaSide === 'SELL' && cur.downside === 'BIDS_HOLD' && aggLeans(cur, 'SELL') && passiveAbsorbs(cur, 'SELL');
  const prevLostSame = prev && (
    (buyersLost && prev.highDelta && prev.deltaSide === 'BUY' && prev.upside === 'ASKS_HOLD') ||
    (sellersLost && prev.highDelta && prev.deltaSide === 'SELL' && prev.downside === 'BIDS_HOLD')
  );
  if (!prevLostSame && sellersLost && countDelta(recent, 'SELL') >= 3) {
    if (!inTrend(recent, 'SELL') || !fadeStands(recent, cur, prev, 'SELL') || !trapAllowsFade(recent, cur, 'SELL') || !levelAllowsFade(recent, cur, 'SELL')) return null;
    if (weakBounce(cur, prev, 'SELL') || closeStillDown(cur, prev)) return keptInMarket('sell', 2, market);
    return keptInMarket('buy', 1, market);
  }
  if (!prevLostSame && buyersLost && countDelta(recent, 'BUY') >= 3) {
    if (!inTrend(recent, 'BUY') || !fadeStands(recent, cur, prev, 'BUY') || !trapAllowsFade(recent, cur, 'BUY') || !levelAllowsFade(recent, cur, 'BUY')) return null;
    // A higher close is not acceptance. Asks held, so the response stayed low. That is the sell.
    if (weakBounce(cur, prev, 'BUY')) return keptInMarket('buy', 2, market);
    return keptInMarket('sell', 1, market);
  }

  // The side that just moved does not progress on this candle. Open the other side
  // here, before that side's move candles start. The other side must already have
  // moved once inside the setup.
  if (prev && prevSide && cur.deltaSide === prevSide && cur.prog != null && cur.prog <= ENTRY_LITTLE_PROG) {
    const stalledSide = prevSide;
    const joining = stalledSide === 'BUY' ? 'SELL' : 'BUY';
    const prevMoved = prev.prog != null && prev.prog >= ENTRY_REAL_PROG && aggLeans(prev, stalledSide) && passiveAgrees(prev, stalledSide);
    const otherAlreadyMoved = recent.some((row) => row.deltaSide === joining && row.prog != null && row.prog >= ENTRY_REAL_PROG);
    const groups = fight(cur);
    // Progress can fade while the close is still going that way. 16 Nov 09:15
    // sold less than 09:00, but the close was still lower, and 09:30 fell again.
    const stillExtending = stalledSide === 'BUY' ? closeStillUp(cur, prev) : closeStillDown(cur, prev);
    if (prevMoved && otherAlreadyMoved && (groups.asks || groups.bids) && !stillExtending) {
      if (!drifted(recent, stalledSide) || !fadeStands(recent, cur, prev, stalledSide)) return null;
      return keptInMarket(joining === 'BUY' ? 'buy' : 'sell', 6, market);
    }
  }

  // Same side, almost the same delta, and the response fell to under half.
  // The fade is this candle, before the next candle spends the move.
  if (prev && prevSide && cur.deltaSide === prevSide && known(prev.delta) && known(cur.delta) && known(prev.prog) && known(cur.prog)) {
    const prevEffort = Math.abs(prev.delta);
    const effortRatio = prevEffort > 0 ? Math.abs(cur.delta) / prevEffort : 0;
    const sameEffort = effortRatio >= ENTRY_EFFORT_SAME_MIN && effortRatio <= ENTRY_EFFORT_SAME_MAX;
    const responseOkBefore = prev.prog >= ENTRY_REAL_PROG;
    const responseFaded = cur.prog < ENTRY_REAL_PROG && cur.prog < prev.prog * ENTRY_RESPONSE_FADE;
    const fadedFight = prevSide === 'BUY'
      ? fight(cur).aggBuyers && (fight(cur).asks || cur.upside === 'BUYERS_WIN')
      : fight(cur).aggSellers && (fight(cur).bids || cur.downside === 'SELLERS_WIN');
    // The response did not fade if that side still got the close past the previous close.
    // 16 Nov 09:15: sellers' progress dropped, but the close was still 16 bp lower. 09:30 fell 60 bp.
    const stillExtending = prevSide === 'BUY' ? closeStillUp(cur, prev) : closeStillDown(cur, prev);
    if (sameEffort && responseOkBefore && responseFaded && fadedFight && !stillExtending) {
      if (!inTrend(recent, prevSide) || !fadeStands(recent, cur, prev, prevSide)) return null;
      return keptInMarket(prevSide === 'BUY' ? 'sell' : 'buy', 7, market);
    }
  }

  // Trend context. A downtrend is judged by aggressive sellers and the asks:
  // if they no longer get price down, buy on the candle that takes the close.
  // An uptrend is judged by aggressive buyers and the bids, and the failure is a sell.
  // A failure candle where the other side did not show up is a pause, not an entry.
  // 15 Nov 21:15: flat PAIR candle after the drop, sellers came straight back.
  if (trendFails(cur, prev, recent, 'SELL') && !(prevSignal && prevSignal.side === 'buy')) {
    if (weakBounce(cur, prev, 'SELL')) return keptInMarket('sell', 2, market);
    if (!sideShowedUp(cur, prev, 'BUY')) return null;
    return keptInMarket('buy', 8, market);
  }
  if (trendFails(cur, prev, recent, 'BUY') && !(prevSignal && prevSignal.side === 'sell')) {
    if (weakBounce(cur, prev, 'BUY')) return keptInMarket('buy', 2, market);
    if (!sideShowedUp(cur, prev, 'SELL')) return null;
    return keptInMarket('sell', 8, market);
  }

  // The candle after that pause. The other side shows up and gets the close: that is the 8.
  // 13 Nov 14:00 paused, 14:15 buyers came in and took the close.
  const pause = pausedFailure(prev, priors);
  if (pause === 'SELL' && !(prevSignal && prevSignal.side === 'buy') && sideShowedUp(cur, prev, 'BUY') && closeStillUp(cur, prev) && cur.upside === 'BUYERS_WIN') {
    return keptInMarket('buy', 8, market);
  }
  if (pause === 'BUY' && !(prevSignal && prevSignal.side === 'sell') && sideShowedUp(cur, prev, 'SELL') && closeStillDown(cur, prev) && cur.downside === 'SELLERS_WIN') {
    return keptInMarket('sell', 8, market);
  }
  return null;
}

/** The trend lost its close on this candle (state 8 before the other side has to show). */
function trendFails(cur: EntryRead, prev: EntryRead | null, recent: EntryRead[], trend: EffortSide): boolean {
  return !!prev && trendContext(recent, trend) && prevStillTrend(prev, trend) && trendFailed(cur, trend)
    && closeCouldnt(cur, prev, trend) && trapAllowsFade(recent, cur, trend) && levelAllowsFade(recent, cur, trend);
}

/**
 * The previous candle was a trend failure that nobody took: state 8 without the other side.
 * Reads the previous candle against its own setup window, so priors needs one extra candle.
 */
function pausedFailure(prev: EntryRead | null, priors: EntryRead[]): EffortSide | null {
  if (!prev || priors.length < ENTRY_CONTEXT_MIN + 1) return null;
  const before = priors.slice(0, -1);
  const prevRecent = before.slice(-ENTRY_PRIOR_BARS);
  const prevPrev = before[before.length - 1] ?? null;
  for (const trend of ['SELL', 'BUY'] as const) {
    if (!trendFails(prev, prevPrev, prevRecent, trend)) continue;
    if (weakBounce(prev, prevPrev, trend)) return null;
    const other: EffortSide = trend === 'SELL' ? 'BUY' : 'SELL';
    return sideShowedUp(prev, prevPrev, other) ? null : trend;
  }
  return null;
}

function lower(s: string): string {
  return s.replaceAll('_', ' ').toLowerCase();
}

function fmtSignedPct(n: number | null): string {
  if (!known(n)) return '—';
  const pct = Math.round(n * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

function fmtEntryPrice(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 1 : abs >= 100 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 6;
  return n.toFixed(digits);
}

function fmtNotional(n: number | null): string {
  if (!known(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${Math.round(abs / 1_000)}K`;
  return `${Math.round(abs)}`;
}

/**
 * Closed candles the entry script would have taken, keyed by bar time.
 * `liveTime` is the open candle's time (it is skipped); pass null when every bar is closed.
 * A mark appears when the side changes. State 5 can still mark after a different state on the same side.
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
  let openState: EntryState | null = null;
  let thinSide: EntrySide | null = null;
  for (let index = ENTRY_PRIOR_BARS; index < last; index++) {
    const cur = reads[index]!;
    const prev = reads[index - 1]!;
    const history = reads.slice(0, index);
    const priors = history.slice(-ENTRY_PRIOR_BARS);
    const signal = decideEntry(cur, prev, history, openSide ? { side: openSide } : null);
    const stalled = cur.absProg != null && cur.absProg <= ENTRY_LITTLE_PROG
      && ((openSide === 'sell' && cur.downside === 'SELLERS_WIN') || (openSide === 'buy' && cur.upside === 'BUYERS_WIN'));
    if (!signal) {
      thinSide = null;
      if (stalled || (openSide === 'sell' && cur.upside === 'BUYERS_WIN') || (openSide === 'buy' && cur.downside === 'SELLERS_WIN')) {
        openSide = null;
        openState = null;
      }
      continue;
    }
    const shape = shapeAt(bars, index);
    if ((signal.side === 'buy' && !shape.buyOk) || (signal.side === 'sell' && !shape.sellOk)) continue;
    const thin = entryVolumeThin(bars, index);
    const time = bars[index]!.time;
    if (thin) {
      if (signal.side !== thinSide && !marks.has(time)) {
        const buy = signal.side === 'buy';
        const word = buy ? 'BUY' : 'SELL';
        marks.set(time, {
          side: signal.side,
          state: signal.state,
          text: `${word} ${signal.state}`,
          short: `${buy ? 'B' : 'S'}${signal.state}`,
          color: buy ? '#86efac' : '#fca5a5',
          price: null,
          tip: [
            `${word} ${signal.state}`,
            ENTRY_DETAIL[signal.state],
            'Volume is small next to the recent candles, so this is not a position.',
            ...(shape.note ? [shape.note] : []),
          ].join('\n'),
        });
      }
      thinSide = signal.side;
      continue;
    }
    thinSide = null;
    const held = signal.side === openSide && (signal.state !== 5 || openState === 5);
    if (!held && !marks.has(time)) {
      const buy = signal.side === 'buy';
      const word = buy ? 'BUY' : 'SELL';
      const faded: EffortSide = buy ? 'SELL' : 'BUY';
      const cant = signal.state === 2
        ? null
        : closeCouldnt(cur, prev, faded) || effortCouldnt(priors, faded) === true
          ? faded === 'SELL' ? "Sellers can't" : "Buyers can't"
          : null;
      const trapped = signal.state === 1 || signal.state === 4 || signal.state === 5 || signal.state === 8
        ? trendTrap(priors, cur)
        : null;
      const trapLine = trapped === faded ? (trapped === 'SELL' ? 'Sell trap' : 'Buy trap') : null;
      const seen = signal.state === 1 || signal.state === 4 || signal.state === 5 || signal.state === 8
        ? levelSeen([...priors, cur])
        : null;
      const levelLine = !seen
        ? null
        : buy && seen.floor && !seen.ceiling
          ? (cur.failDown || priors.some((row) => row.failDown) ? 'Fail down at the floor' : 'Floor held')
          : !buy && seen.ceiling && !seen.floor
            ? (cur.failUp || priors.some((row) => row.failUp) ? 'Fail up at the ceiling' : 'Ceiling held')
            : null;
      const entryPrice = entryPullbackPrice(bars[index]!, bars.slice(0, index), signal.side);
      const priceLine = entryPrice == null
        ? null
        : buy
          ? `Open ${fmtEntryPrice(entryPrice)}, a little under the close`
          : `Open ${fmtEntryPrice(entryPrice)}, a little over the close`;
      marks.set(time, {
        side: signal.side,
        state: signal.state,
        text: `${word} ${signal.state}`,
        short: `${buy ? 'B' : 'S'}${signal.state}`,
        color: buy ? '#22c55e' : '#ef4444',
        price: entryPrice,
        tip: [
          `${word} ${signal.state}`,
          ENTRY_DETAIL[signal.state],
          ...(priceLine ? [priceLine] : []),
          ...(shape.note ? [shape.note] : []),
          ...(cant ? [cant] : []),
          ...(trapLine ? [trapLine] : []),
          ...(levelLine ? [levelLine] : []),
          `Agg ${fmtSignedPct(cur.agg)} · Pas ${fmtSignedPct(cur.pas)}`,
          `A repl ${fmtNotional(cur.askRepl)} · B repl ${fmtNotional(cur.bidRepl)}`,
          `Upside ${lower(cur.upside)} · downside ${lower(cur.downside)}`,
        ].join('\n'),
      });
    }
    openSide = signal.side;
    openState = signal.state;
  }
  return marks;
}

export interface MaybeMark {
  side: EntrySide;
  text: string;
  short: string;
  color: string;
  tip: string;
}

/**
 * A warning, not an entry. The candle has not decided the trade.
 * In a drop, a strong bounce or a held ceiling says the next candle may sell.
 * In a rise, a strong dip or a held floor says the next candle may buy.
 * 15 Nov 19:45 is the bounce. 20:00 is the sell.
 */
export function maybeMarks(
  bars: EntryBar[],
  liveTime: number | null,
  progress: EntryProgressRow[],
): Map<number, MaybeMark> {
  const marks = new Map<number, MaybeMark>();
  if (!bars || bars.length < SWING_BARS + 1) return marks;
  const lastIsLive = liveTime != null && bars[bars.length - 1]?.time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  const reads: EntryRead[] = [];
  for (let i = 0; i < last; i++) reads.push(barEntryRead(bars, i, progress));
  for (let index = SWING_BARS; index < last; index++) {
    const cur = reads[index]!;
    const prev = reads[index - 1]!;
    const history = reads.slice(0, index);
    if (decideEntry(cur, prev, history, null)) continue;
    const market = swingSide(history);
    // The 16-candle swing can stay up after the rise has stalled.
    // 16 Nov 09:00 and 09:15 on NEAR were sell candles in that stall, and the next candle fell.
    const recent = priceDrift(history.slice(-ENTRY_PRIOR_BARS));
    const extended = cur.prog != null && cur.prog >= ENTRY_REAL_PROG;
    const buyBounce = cur.deltaSide === 'BUY' && cur.upside === 'BUYERS_WIN' && extended;
    const sellDip = cur.deltaSide === 'SELL' && cur.downside === 'SELLERS_WIN' && extended;
    const side: EntrySide | null = market === 'SELL' && recent === 'SELL' && (buyBounce || cur.atCeiling || cur.failUp)
      ? 'sell'
      : market === 'BUY' && recent === 'BUY' && (sellDip || cur.atFloor || cur.failDown)
        ? 'buy'
        : null;
    if (!side) continue;
    const sell = side === 'sell';
    marks.set(bars[index]!.time, {
      side,
      text: sell ? 'MAYBE SELL' : 'MAYBE BUY',
      short: sell ? 'M SELL' : 'M BUY',
      color: sell ? '#fbbf24' : '#86efac',
      tip: sell
        ? 'Maybe sell\nThe swing is still down. This candle bounced, or the ceiling held. The next candle may sell. This is not an entry.'
        : 'Maybe buy\nThe swing is still up. This candle dipped, or the floor held. The next candle may buy. This is not an entry.',
    });
  }
  return marks;
}

function couldntMark(side: EffortSide): CouldntMark {
  const sellers = side === 'SELL';
  return {
    side,
    text: sellers ? "SELLERS CAN'T" : "BUYERS CAN'T",
    short: sellers ? "SELL CAN'T" : "BUY CAN'T",
    color: sellers ? '#60a5fa' : '#fbbf24',
    tip: sellers
      ? "Sellers can't\nDowntrend. Aggressive sellers and the asks had the effort, and this close did not go down."
      : "Buyers can't\nUptrend. Aggressive buyers and the bids had the effort, and this close did not go up.",
  };
}

/**
 * SELLERS CAN'T / BUYERS CAN'T on the first closed candle where that trend loses its close.
 * The 6 candles before it are the same window the entry states use.
 * The forming candle is never labeled. The next candle of the same failure stays quiet.
 */
export function couldntMarks(
  bars: EntryBar[],
  liveTime: number | null,
  progress: EntryProgressRow[],
): Map<number, CouldntMark> {
  const marks = new Map<number, CouldntMark>();
  if (!bars || bars.length < ENTRY_PRIOR_BARS + 1) return marks;
  const lastIsLive = liveTime != null && bars[bars.length - 1]?.time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  const reads: EntryRead[] = [];
  for (let i = 0; i < last; i++) reads.push(barEntryRead(bars, i, progress));
  let open: EffortSide | null = null;
  for (let index = ENTRY_PRIOR_BARS; index < last; index++) {
    const cur = reads[index]!;
    const prev = reads[index - 1]!;
    const recent = reads.slice(Math.max(0, index - ENTRY_PRIOR_BARS), index);
    const drift = priceDrift(recent);
    const sellCant = trendContext(recent, 'SELL') && closeCouldnt(cur, prev, 'SELL');
    const buyCant = trendContext(recent, 'BUY') && closeCouldnt(cur, prev, 'BUY');
    const side: EffortSide | null = drift === 'SELL' && sellCant
      ? 'SELL'
      : drift === 'BUY' && buyCant
        ? 'BUY'
        : sellCant && !buyCant
          ? 'SELL'
          : buyCant && !sellCant
            ? 'BUY'
            : null;
    if (side && side !== open) marks.set(bars[index]!.time, couldntMark(side));
    open = side;
  }
  return marks;
}

function trapLabel(side: EffortSide): TrapMark {
  const sellers = side === 'SELL';
  return {
    side,
    text: sellers ? 'SELL TRAP' : 'BUY TRAP',
    short: sellers ? 'S TRAP' : 'B TRAP',
    color: sellers ? '#38bdf8' : '#fb7185',
    tip: sellers
      ? 'Sell trap\nDowntrend. Sellers and the asks took the prior low, and the close came back up.'
      : 'Buy trap\nUptrend. Buyers and the bids took the prior high, and the close came back down.',
  };
}

/**
 * S TRAP on the candle that takes the prior low and closes back up, after a downtrend.
 * B TRAP on the candle that takes the prior high and closes back down, after an uptrend.
 * A sweep without that trend is left unlabeled. The forming candle is never labeled.
 */
export function trapMarks(
  bars: EntryBar[],
  liveTime: number | null,
  progress: EntryProgressRow[],
): Map<number, TrapMark> {
  const marks = new Map<number, TrapMark>();
  if (!bars || bars.length < ENTRY_PRIOR_BARS + 1) return marks;
  const lastIsLive = liveTime != null && bars[bars.length - 1]?.time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  const reads: EntryRead[] = [];
  for (let i = 0; i < last; i++) reads.push(barEntryRead(bars, i, progress));
  for (let index = ENTRY_PRIOR_BARS; index < last; index++) {
    const cur = reads[index]!;
    const prev = reads[index - 1]!;
    const recent = reads.slice(Math.max(0, index - ENTRY_PRIOR_BARS), index);
    const side: EffortSide | null = cur.hunt === 'LOW' && trendContext(recent, 'SELL') && closeCouldnt(cur, prev, 'SELL')
      ? 'SELL'
      : cur.hunt === 'HIGH' && trendContext(recent, 'BUY') && closeCouldnt(cur, prev, 'BUY')
        ? 'BUY'
        : null;
    if (side) marks.set(bars[index]!.time, trapLabel(side));
  }
  return marks;
}

/** Chart label for a defended floor or ceiling, or the failure of that level. */
export interface LevelMark {
  kind: 'FLOOR' | 'CEILING' | 'FAIL_DOWN' | 'FAIL_UP';
  text: string;
  short: string;
  color: string;
  tip: string;
}

function levelLabel(kind: LevelMark['kind']): LevelMark {
  if (kind === 'FAIL_DOWN') {
    return {
      kind,
      text: 'FAIL ↓',
      short: 'FAIL ↓',
      color: '#84cc16',
      tip: 'Fail down\nPrice went through a floor the bids had already held, and the close came back above it.',
    };
  }
  if (kind === 'FAIL_UP') {
    return {
      kind,
      text: 'FAIL ↑',
      short: 'FAIL ↑',
      color: '#f59e0b',
      tip: 'Fail up\nPrice went through a ceiling the asks had already held, and the close came back below it.',
    };
  }
  if (kind === 'FLOOR') {
    return {
      kind,
      text: 'FLOOR',
      short: 'FLOOR',
      color: '#38bdf8',
      tip: 'Floor\nThe bids held this low again. One test is not a floor.',
    };
  }
  return {
    kind: 'CEILING',
    text: 'CEILING',
    short: 'CEIL',
    color: '#fb7185',
    tip: 'Ceiling\nThe asks held this high again. One test is not a ceiling.',
  };
}

/**
 * FLOOR / CEILING on the candle that defends a level already tested once.
 * FAIL ↓ / FAIL ↑ on the candle that breaks that level and closes back inside.
 * The forming candle is never labeled.
 */
export function levelMarks(
  bars: EntryBar[],
  liveTime: number | null,
  progress: EntryProgressRow[],
): Map<number, LevelMark> {
  const marks = new Map<number, LevelMark>();
  if (!bars || bars.length < 6) return marks;
  const lastIsLive = liveTime != null && bars[bars.length - 1]?.time === liveTime;
  const last = lastIsLive ? bars.length - 1 : bars.length;
  const reads: EntryRead[] = [];
  for (let i = 0; i < last; i++) reads.push(barEntryRead(bars, i, progress));
  for (let index = 0; index < last; index++) {
    const cur = reads[index]!;
    const kind: LevelMark['kind'] | null = cur.failDown
      ? 'FAIL_DOWN'
      : cur.failUp
        ? 'FAIL_UP'
        : cur.atFloor
          ? 'FLOOR'
          : cur.atCeiling
            ? 'CEILING'
            : null;
    if (kind) marks.set(bars[index]!.time, levelLabel(kind));
  }
  return marks;
}
