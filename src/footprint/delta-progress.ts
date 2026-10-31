/**
 * Candle delta strength, delta ratio, and ATR-normalized price progress.
 *
 * Reuses footprint displacement (close − open) and aggressive buy/sell delta.
 * Does not invent a second displacement formula.
 *
 * Directional progress:
 *   sign(delta) * (close − open) / priorATR
 * which is sign(delta) * displacementATR from computeDisplacement.
 *
 * ATR is the simple mean of true ranges of prior completed candles only
 * (same TR definition as simulator averageTrueRange). The current candle
 * and any future candle are excluded.
 *
 * Delta-strength percentile uses prior completed candles only.
 */

import { aggressiveVolumes, candleDelta, computeDisplacement, flowDataQuality, type AggressiveFlowLike, type FlowDataQuality, type OhlcLike } from './displacement-cvd.js';

export type DeltaStrengthState =
  | 'EXTREME'
  | 'STRONG'
  | 'NORMAL'
  | 'WEAK'
  | 'INSUFFICIENT_DATA'
  | 'UNAVAILABLE';

export type DeltaSide = 'BUY' | 'SELL' | 'NONE';

export type PriceProgressState =
  | 'LOW_PROGRESS'
  | 'MODERATE_PROGRESS'
  | 'HIGH_PROGRESS'
  | 'AGAINST_AGGRESSION'
  | 'UNAVAILABLE'
  | 'INSUFFICIENT_DATA';

export type ProgressMagnitude = 'LOW_PROGRESS' | 'MODERATE_PROGRESS' | 'HIGH_PROGRESS' | null;

export type DeltaEffortState =
  | 'BUYERS_EFFECTIVE'
  | 'BUYER_NO_PROGRESS'
  | 'SELLERS_EFFECTIVE'
  | 'SELLER_NO_PROGRESS'
  | 'NEUTRAL'
  | 'INSUFFICIENT';

/** Ranked Effort÷Response: high = inefficient / absorption, low = efficient. */
export type EffortResponseState =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'AGAINST'
  | 'INSUFFICIENT'
  | 'UNAVAILABLE';

export type DeltaProgressQuality =
  | 'GOOD'
  | 'PARTIAL'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'INSUFFICIENT_DATA'
  | 'INVALID';

export type DeltaLabelMode = 'COMPACT' | 'METRICS' | 'EFFORT_RESPONSE' | 'OFF';

export interface DeltaProgressConfig {
  /** Prior completed candles used as the absolute-delta baseline. */
  deltaLookback: number;
  /** Minimum valid prior candles before a percentile is published. */
  minHistory: number;
  extremePercentile: number;
  strongPercentile: number;
  /** Below this percentile → WEAK. */
  weakPercentile: number;
  /** |delta ratio| below this has no directional side. */
  flatRatioPct: number;
  /** |delta ratio| required before effort/result is named. */
  minEffortRatioPct: number;
  atrLookback: number;
  minAtrBars: number;
  lowProgressAtr: number;
  highProgressAtr: number;
  /** Floor for |progress ATR| in Effort÷Response so tiny moves do not divide by zero. */
  effortResponseProgressFloor: number;
  /** Floor for |delta| in Response÷Effort so flat delta does not divide by zero. */
  responseEffortDeltaFloor: number;
  /** Effort÷Response percentile ≥ this → HIGH (inefficient). */
  effortResponseHighPercentile: number;
  /** Effort÷Response percentile < this → LOW (efficient). */
  effortResponseLowPercentile: number;
}

export const DEFAULT_DELTA_PROGRESS_CONFIG: DeltaProgressConfig = {
  deltaLookback: 50,
  minHistory: 20,
  extremePercentile: 95,
  strongPercentile: 80,
  weakPercentile: 20,
  flatRatioPct: 2,
  minEffortRatioPct: 15,
  atrLookback: 14,
  minAtrBars: 5,
  lowProgressAtr: 0.1,
  highProgressAtr: 0.3,
  effortResponseProgressFloor: 0.01,
  responseEffortDeltaFloor: 1,
  effortResponseHighPercentile: 80,
  effortResponseLowPercentile: 20,
};

export interface DeltaProgressBar extends OhlcLike, AggressiveFlowLike {
  time: number;
}

export interface DeltaProgressResult {
  time: number;
  delta: number | null;
  absoluteDelta: number | null;
  deltaStrengthPercentile: number | null;
  deltaStrengthState: DeltaStrengthState;
  deltaSide: DeltaSide;
  deltaRatioPercent: number | null;
  directionalProgressATR: number | null;
  priceProgressState: PriceProgressState;
  progressMagnitude: ProgressMagnitude;
  effortResultState: DeltaEffortState;
  /** |delta| / max(|progress ATR|, floor). High = inefficient. */
  effortResponseRatio: number | null;
  effortResponsePercentile: number | null;
  effortResponseState: EffortResponseState;
  /** |progress ATR| / max(|delta|, floor). High = efficient (inverse of E/R). */
  responseEffortRatio: number | null;
  responseEffortPercentile: number | null;
  responseEffortState: EffortResponseState;
  dataQuality: DeltaProgressQuality;
  atr: number | null;
  displacementRaw: number | null;
  incomplete: boolean;
}

export interface DeltaLabelRow {
  key: 'strength' | 'ratio' | 'progress' | 'effort' | 'effortLevel' | 'response' | 'effortResponse' | 'responseEffort';
  text: string;
  /** Higher priority survives dense zoom. */
  priority: number;
  tip: string;
}

/** First footer offset below existing D / Δ / CVD / battle rows. Always under the candle. */
export const DELTA_LABEL_FIRST_OFFSET = 112;
export const DELTA_LABEL_LINE_H = 11;
export const DELTA_LABEL_ANCHOR = 'BELOW_CANDLE' as const;

function cfgOf(partial?: Partial<DeltaProgressConfig>): DeltaProgressConfig {
  return { ...DEFAULT_DELTA_PROGRESS_CONFIG, ...(partial ?? {}) };
}

export function trueRange(high: number, low: number, prevClose: number | null): number | null {
  if (![high, low].every((n) => Number.isFinite(n)) || high < low) return null;
  const hl = high - low;
  if (prevClose == null || !Number.isFinite(prevClose)) return hl;
  return Math.max(hl, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/** Mean true range of candles strictly before `index`. Null when warm-up is short or ATR is 0. */
export function priorAtr(
  bars: Array<Pick<OhlcLike, 'high' | 'low' | 'close'>>,
  index: number,
  lookback = DEFAULT_DELTA_PROGRESS_CONFIG.atrLookback,
  minBars = DEFAULT_DELTA_PROGRESS_CONFIG.minAtrBars,
): number | null {
  if (index < 1) return null;
  const start = Math.max(1, index - lookback);
  let sum = 0;
  let n = 0;
  for (let i = start; i < index; i++) {
    const prevClose = bars[i - 1]?.close;
    const tr = trueRange(bars[i]!.high, bars[i]!.low, prevClose ?? null);
    if (tr == null || !Number.isFinite(tr)) continue;
    sum += tr;
    n += 1;
  }
  if (n < minBars) return null;
  const atr = sum / n;
  if (!(atr > 0) || !Number.isFinite(atr)) return null;
  return atr;
}

/** Percent of prior samples that are <= value. Current sample must not be inside `prior`. */
export function percentileRank(value: number, prior: number[]): number | null {
  if (!Number.isFinite(value) || prior.length === 0) return null;
  let le = 0;
  for (const sample of prior) {
    if (Number.isFinite(sample) && sample <= value) le += 1;
  }
  return (le / prior.length) * 100;
}

export function deltaRatioPercent(buy: number, sell: number): number | null {
  if (![buy, sell].every((n) => Number.isFinite(n)) || buy < 0 || sell < 0) return null;
  const total = buy + sell;
  if (!(total > 0)) return null;
  const ratio = ((buy - sell) / total) * 100;
  return Number.isFinite(ratio) ? ratio : null;
}

function strengthState(percentile: number | null, config: DeltaProgressConfig): DeltaStrengthState {
  if (percentile == null || !Number.isFinite(percentile)) return 'INSUFFICIENT_DATA';
  if (percentile >= config.extremePercentile) return 'EXTREME';
  if (percentile >= config.strongPercentile) return 'STRONG';
  if (percentile < config.weakPercentile) return 'WEAK';
  return 'NORMAL';
}

function magnitudeOf(absProgress: number, config: DeltaProgressConfig): ProgressMagnitude {
  if (absProgress <= config.lowProgressAtr) return 'LOW_PROGRESS';
  if (absProgress <= config.highProgressAtr) return 'MODERATE_PROGRESS';
  return 'HIGH_PROGRESS';
}

function effortOf(input: {
  side: DeltaSide;
  strength: DeltaStrengthState;
  ratio: number | null;
  progress: number | null;
  config: DeltaProgressConfig;
}): DeltaEffortState {
  const { side, strength, ratio, progress, config } = input;
  const strong = strength === 'STRONG' || strength === 'EXTREME';
  if (!strong || ratio == null || progress == null || !Number.isFinite(progress)) return 'INSUFFICIENT';
  if (Math.abs(ratio) < config.minEffortRatioPct) return 'NEUTRAL';
  if (side === 'NONE') return 'NEUTRAL';
  const withAggression = progress > config.lowProgressAtr;
  if (side === 'BUY') return withAggression ? 'BUYERS_EFFECTIVE' : 'BUYER_NO_PROGRESS';
  if (side === 'SELL') return withAggression ? 'SELLERS_EFFECTIVE' : 'SELLER_NO_PROGRESS';
  return 'NEUTRAL';
}

/** |delta| / max(|progress ATR|, floor). High = inefficient (lots of effort, little move). */
export function effortResponseRatio(
  absoluteDelta: number,
  directionalProgressATR: number | null,
  progressFloor = DEFAULT_DELTA_PROGRESS_CONFIG.effortResponseProgressFloor,
): number | null {
  if (!(absoluteDelta >= 0) || !Number.isFinite(absoluteDelta)) return null;
  if (directionalProgressATR == null || !Number.isFinite(directionalProgressATR)) return null;
  const floor = progressFloor > 0 && Number.isFinite(progressFloor) ? progressFloor : 0.01;
  const denom = Math.max(Math.abs(directionalProgressATR), floor);
  const ratio = absoluteDelta / denom;
  return Number.isFinite(ratio) ? ratio : null;
}

/** |progress ATR| / max(|delta|, floor). High = efficient (lots of move per unit effort). */
export function responseEffortRatio(
  absoluteDelta: number,
  directionalProgressATR: number | null,
  deltaFloor = DEFAULT_DELTA_PROGRESS_CONFIG.responseEffortDeltaFloor,
): number | null {
  if (!(absoluteDelta >= 0) || !Number.isFinite(absoluteDelta)) return null;
  if (directionalProgressATR == null || !Number.isFinite(directionalProgressATR)) return null;
  const floor = deltaFloor > 0 && Number.isFinite(deltaFloor) ? deltaFloor : 1;
  const denom = Math.max(absoluteDelta, floor);
  const ratio = Math.abs(directionalProgressATR) / denom;
  return Number.isFinite(ratio) ? ratio : null;
}

function effortResponseStateOf(input: {
  against: boolean;
  percentile: number | null;
  config: DeltaProgressConfig;
}): EffortResponseState {
  if (input.against) return 'AGAINST';
  if (input.percentile == null || !Number.isFinite(input.percentile)) return 'INSUFFICIENT';
  if (input.percentile >= input.config.effortResponseHighPercentile) return 'HIGH';
  if (input.percentile < input.config.effortResponseLowPercentile) return 'LOW';
  return 'NORMAL';
}

/** R/E reading is the inverse of E/R: HIGH = efficient, LOW = inefficient. */
function responseEffortStateFrom(effortResponseState: EffortResponseState): EffortResponseState {
  switch (effortResponseState) {
    case 'HIGH': return 'LOW';
    case 'LOW': return 'HIGH';
    case 'NORMAL': return 'NORMAL';
    case 'AGAINST': return 'AGAINST';
    case 'INSUFFICIENT': return 'INSUFFICIENT';
    case 'UNAVAILABLE': return 'UNAVAILABLE';
    default: return 'UNAVAILABLE';
  }
}

function flowBlocked(quality: FlowDataQuality): boolean {
  return quality === 'UNAVAILABLE' || quality === 'STALE';
}

export function annotateDeltaProgress(
  bars: DeltaProgressBar[],
  options: Partial<DeltaProgressConfig> & { lastIsLive?: boolean } = {},
): DeltaProgressResult[] {
  const config = cfgOf(options);
  const lastIsLive = !!options.lastIsLive;
  const absHistory: Array<number | null> = bars.map((bar) => {
    const quality = flowDataQuality(bar);
    if (flowBlocked(quality)) return null;
    const { buy, sell } = aggressiveVolumes(bar);
    if (!(buy + sell > 0)) return null;
    return Math.abs(candleDelta(bar));
  });

  const drafts: DeltaProgressResult[] = bars.map((bar, index) => {
    const incomplete = lastIsLive && index === bars.length - 1;
    const quality = flowDataQuality(bar);
    const ohlcOk = [bar.open, bar.high, bar.low, bar.close].every((n) => Number.isFinite(n)) && bar.open > 0 && bar.high >= bar.low;
    const base = emptyResult(bar.time, incomplete);

    if (flowBlocked(quality)) {
      return { ...base, dataQuality: quality === 'STALE' ? 'STALE' : 'UNAVAILABLE' };
    }

    const { buy, sell } = aggressiveVolumes(bar);
    const ratio = deltaRatioPercent(buy, sell);
    if (ratio == null) {
      return { ...base, dataQuality: 'UNAVAILABLE', deltaStrengthState: 'UNAVAILABLE', priceProgressState: ohlcOk ? 'INSUFFICIENT_DATA' : 'UNAVAILABLE' };
    }

    const delta = buy - sell;
    const absoluteDelta = Math.abs(delta);
    const from = Math.max(0, index - config.deltaLookback);
    const prior: number[] = [];
    for (let j = from; j < index; j++) {
      const sample = absHistory[j];
      if (sample != null) prior.push(sample);
    }
    const percentile = prior.length >= config.minHistory ? percentileRank(absoluteDelta, prior) : null;
    const deltaStrengthState = percentile == null ? 'INSUFFICIENT_DATA' : strengthState(percentile, config);
    const deltaSide: DeltaSide =
      Math.abs(ratio) < config.flatRatioPct ? 'NONE' : delta > 0 ? 'BUY' : delta < 0 ? 'SELL' : 'NONE';

    const atr = ohlcOk ? priorAtr(bars, index, config.atrLookback, config.minAtrBars) : null;
    const disp = ohlcOk ? computeDisplacement(bar, { atr }) : null;
    const displacementRaw = disp && Number.isFinite(disp.displacementRaw) ? disp.displacementRaw : null;
    let directionalProgressATR: number | null = null;
    let priceProgressState: PriceProgressState = 'UNAVAILABLE';
    let progressMagnitude: ProgressMagnitude = null;

    if (!ohlcOk) {
      priceProgressState = 'UNAVAILABLE';
    } else if (atr == null) {
      priceProgressState = 'INSUFFICIENT_DATA';
    } else if (disp?.displacementATR == null || !Number.isFinite(disp.displacementATR)) {
      priceProgressState = 'UNAVAILABLE';
    } else {
      const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0;
      directionalProgressATR = sign * disp.displacementATR;
      const mag = magnitudeOf(Math.abs(directionalProgressATR), config);
      progressMagnitude = mag;
      priceProgressState = directionalProgressATR < 0 ? 'AGAINST_AGGRESSION' : mag!;
    }

    const effortResultState = effortOf({
      side: deltaSide,
      strength: deltaStrengthState,
      ratio,
      progress: directionalProgressATR,
      config,
    });

    const effortResponseRatioValue = effortResponseRatio(
      absoluteDelta,
      directionalProgressATR,
      config.effortResponseProgressFloor,
    );
    const responseEffortRatioValue = responseEffortRatio(
      absoluteDelta,
      directionalProgressATR,
      config.responseEffortDeltaFloor,
    );

    const dataQuality: DeltaProgressQuality =
      deltaStrengthState === 'INSUFFICIENT_DATA' || priceProgressState === 'INSUFFICIENT_DATA'
        ? 'INSUFFICIENT_DATA'
        : quality === 'PARTIAL'
          ? 'PARTIAL'
          : 'GOOD';

    return {
      time: bar.time,
      delta,
      absoluteDelta,
      deltaStrengthPercentile: percentile,
      deltaStrengthState,
      deltaSide,
      deltaRatioPercent: ratio,
      directionalProgressATR,
      priceProgressState,
      progressMagnitude,
      effortResultState,
      effortResponseRatio: effortResponseRatioValue,
      effortResponsePercentile: null,
      effortResponseState: effortResponseRatioValue == null ? 'UNAVAILABLE' : 'INSUFFICIENT',
      responseEffortRatio: responseEffortRatioValue,
      responseEffortPercentile: null,
      responseEffortState: responseEffortRatioValue == null ? 'UNAVAILABLE' : 'INSUFFICIENT',
      dataQuality,
      atr,
      displacementRaw,
      incomplete,
    };
  });

  const ratioHistory: Array<number | null> = drafts.map((d) => d.effortResponseRatio);

  return drafts.map((draft, index) => {
    if (draft.effortResponseRatio == null) {
      return {
        ...draft,
        responseEffortState: draft.responseEffortRatio == null ? 'UNAVAILABLE' : draft.responseEffortState,
      };
    }
    const from = Math.max(0, index - config.deltaLookback);
    const prior: number[] = [];
    for (let j = from; j < index; j++) {
      const sample = ratioHistory[j];
      if (sample != null) prior.push(sample);
    }
    const erPercentile = prior.length >= config.minHistory
      ? percentileRank(draft.effortResponseRatio, prior)
      : null;
    const against = draft.priceProgressState === 'AGAINST_AGGRESSION';
    const effortResponseState = effortResponseStateOf({ against, percentile: erPercentile, config });
    const responseEffortPercentile = erPercentile == null ? null : 100 - erPercentile;
    return {
      ...draft,
      effortResponsePercentile: erPercentile,
      effortResponseState,
      responseEffortPercentile,
      responseEffortState: responseEffortStateFrom(effortResponseState),
    };
  });
}

function emptyResult(time: number, incomplete: boolean): DeltaProgressResult {
  return {
    time,
    delta: null,
    absoluteDelta: null,
    deltaStrengthPercentile: null,
    deltaStrengthState: 'UNAVAILABLE',
    deltaSide: 'NONE',
    deltaRatioPercent: null,
    directionalProgressATR: null,
    priceProgressState: 'UNAVAILABLE',
    progressMagnitude: null,
    effortResultState: 'INSUFFICIENT',
    effortResponseRatio: null,
    effortResponsePercentile: null,
    effortResponseState: 'UNAVAILABLE',
    responseEffortRatio: null,
    responseEffortPercentile: null,
    responseEffortState: 'UNAVAILABLE',
    dataQuality: 'UNAVAILABLE',
    atr: null,
    displacementRaw: null,
    incomplete,
  };
}

function fmtRatio(ratio: number): string {
  const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : '';
  return `${sign}${Math.abs(ratio).toFixed(0)}%`;
}

function fmtProg(progress: number): string {
  const sign = progress > 0 ? '' : progress < 0 ? '−' : '';
  return `${sign}${Math.abs(progress).toFixed(2)} ATR`;
}

export function strengthLabelText(result: DeltaProgressResult, dense = false): string | null {
  const state = result.deltaStrengthState;
  if (state === 'UNAVAILABLE' || state === 'INSUFFICIENT_DATA') return null;
  const word = state === 'EXTREME' ? (dense ? 'EXT' : 'EXTREME')
    : state === 'STRONG' ? (dense ? 'STR' : 'STRONG')
      : state === 'WEAK' ? 'WEAK'
        : 'NORM';
  if (result.deltaSide === 'BUY') return dense ? `BΔ ${word}` : `BUY Δ ${word}`;
  if (result.deltaSide === 'SELL') return dense ? `SΔ ${word}` : `SELL Δ ${word}`;
  return `Δ ${word}`;
}

export function effortLabelText(state: DeltaEffortState, dense = false): string | null {
  switch (state) {
    case 'BUYER_NO_PROGRESS': return dense ? 'B NP' : 'BUYER NP';
    case 'SELLER_NO_PROGRESS': return dense ? 'S NP' : 'SELLER NP';
    case 'BUYERS_EFFECTIVE': return dense ? 'B EFF' : 'BUY EFF';
    case 'SELLERS_EFFECTIVE': return dense ? 'S EFF' : 'SELL EFF';
    default: return null;
  }
}

export function effortLevelLabelText(result: DeltaProgressResult, dense = false): string | null {
  const state = result.deltaStrengthState;
  if (state === 'UNAVAILABLE' || state === 'INSUFFICIENT_DATA') return null;
  const word = state === 'EXTREME' ? (dense ? 'EXT' : 'EXTREME')
    : state === 'STRONG' ? (dense ? 'STR' : 'STRONG')
      : state === 'WEAK' ? 'WEAK'
        : 'NORM';
  const side = result.deltaSide === 'BUY' ? (dense ? 'B ' : 'BUY ')
    : result.deltaSide === 'SELL' ? (dense ? 'S ' : 'SELL ')
      : '';
  return `${dense ? 'E' : 'EFFORT'} ${side}${word}`;
}

export function responseLabelText(state: PriceProgressState, dense = false): string | null {
  const word = state === 'HIGH_PROGRESS' ? 'HIGH'
    : state === 'MODERATE_PROGRESS' ? (dense ? 'MOD' : 'MODERATE')
      : state === 'LOW_PROGRESS' ? 'LOW'
        : state === 'AGAINST_AGGRESSION' ? (dense ? 'AGST' : 'AGAINST')
          : null;
  return word == null ? null : `${dense ? 'R' : 'RESPONSE'} ${word}`;
}

export function effortResponseLabelText(state: EffortResponseState, dense = false): string | null {
  switch (state) {
    case 'LOW': return dense ? 'ER L' : 'E/R LOW';
    case 'NORMAL': return dense ? 'ER N' : 'E/R NORM';
    case 'HIGH': return dense ? 'ER H' : 'E/R HIGH';
    case 'AGAINST': return dense ? 'ER AGST' : 'E/R AGST';
    default: return null;
  }
}

export function responseEffortLabelText(state: EffortResponseState, dense = false): string | null {
  switch (state) {
    case 'LOW': return dense ? 'RE L' : 'R/E LOW';
    case 'NORMAL': return dense ? 'RE N' : 'R/E NORM';
    case 'HIGH': return dense ? 'RE H' : 'R/E HIGH';
    case 'AGAINST': return dense ? 'RE AGST' : 'R/E AGST';
    default: return null;
  }
}

export function deltaProgressTooltip(result: DeltaProgressResult, config: DeltaProgressConfig = DEFAULT_DELTA_PROGRESS_CONFIG): string {
  const lines = [
    'DELTA / PROGRESS',
    result.incomplete ? 'Live candle (provisional)' : 'Completed candle',
    '',
    `Delta: ${result.delta == null ? 'unavailable' : result.delta.toFixed(0)}`,
    `Strength: ${result.deltaStrengthState}${result.deltaStrengthPercentile == null ? '' : ` · ${result.deltaStrengthPercentile.toFixed(0)}th pct`}`,
    `Delta ratio: ${result.deltaRatioPercent == null ? 'unavailable' : `${result.deltaRatioPercent.toFixed(1)}%`}`,
    `Progress: ${result.directionalProgressATR == null ? 'unavailable' : `${result.directionalProgressATR.toFixed(3)} ATR`}`,
    `Progress state: ${result.priceProgressState}`,
    `Effort / result: ${result.effortResultState}`,
    `Effort÷Response: ${result.effortResponseState}${result.effortResponsePercentile == null ? '' : ` · ${result.effortResponsePercentile.toFixed(0)}th pct`}${result.effortResponseRatio == null ? '' : ` · raw ${result.effortResponseRatio.toFixed(1)}`}`,
    `Response÷Effort: ${result.responseEffortState}${result.responseEffortPercentile == null ? '' : ` · ${result.responseEffortPercentile.toFixed(0)}th pct`}${result.responseEffortRatio == null ? '' : ` · raw ${result.responseEffortRatio.toExponential(2)}`}`,
    `Data: ${result.dataQuality}`,
    '',
    `Strong ≥ ${config.strongPercentile}th · extreme ≥ ${config.extremePercentile}th`,
    `Effort needs |ΔR| ≥ ${config.minEffortRatioPct}%`,
    `Low progress ≤ ${config.lowProgressAtr} ATR`,
    `E/R = |Δ| / max(|progress ATR|, ${config.effortResponseProgressFloor}) · HIGH = inefficient`,
    `R/E = |progress ATR| / max(|Δ|, ${config.responseEffortDeltaFloor}) · HIGH = efficient`,
    'AGST = price moved against delta',
    '',
    'No-progress is not a long or short, and not absorption by itself.',
  ];
  return lines.join('\n');
}

/**
 * Rows painted under the candle. OFF yields none.
 * COMPACT keeps effort (if any) plus delta ratio.
 * METRICS keeps strength, ratio, progress, then effort.
 * Dense zoom drops lower-priority rows. Never relocates them above the candle.
 */
export function deltaProgressLabelRows(
  result: DeltaProgressResult,
  mode: DeltaLabelMode,
  options: { dense?: boolean; config?: DeltaProgressConfig } = {},
): DeltaLabelRow[] {
  if (mode === 'OFF') return [];
  const dense = !!options.dense;
  const tip = deltaProgressTooltip(result, options.config);
  const rows: DeltaLabelRow[] = [];

  if (mode === 'EFFORT_RESPONSE') {
    const effortLevel = effortLevelLabelText(result, dense);
    const response = responseLabelText(result.priceProgressState, dense);
    const er = effortResponseLabelText(result.effortResponseState, dense);
    const re = responseEffortLabelText(result.responseEffortState, dense);
    if (effortLevel) rows.push({ key: 'effortLevel', text: effortLevel, priority: 100, tip });
    if (response) rows.push({ key: 'response', text: response, priority: 90, tip });
    if (er) rows.push({ key: 'effortResponse', text: er, priority: 80, tip });
    if (re) rows.push({ key: 'responseEffort', text: re, priority: 70, tip });
    return rows;
  }

  const strength = strengthLabelText(result, dense);
  const ratio = result.deltaRatioPercent == null ? null : `ΔR ${fmtRatio(result.deltaRatioPercent)}`;
  const progress = result.directionalProgressATR == null ? null : `PROG ${fmtProg(result.directionalProgressATR)}`;
  const effort = effortLabelText(result.effortResultState, dense);

  if (mode === 'COMPACT') {
    if (effort) rows.push({ key: 'effort', text: effort, priority: 100, tip });
    if (ratio) rows.push({ key: 'ratio', text: ratio, priority: 80, tip });
    if (!dense && strength && (result.deltaStrengthState === 'STRONG' || result.deltaStrengthState === 'EXTREME')) {
      rows.push({ key: 'strength', text: strength, priority: 60, tip });
    }
  } else {
    if (strength && (!dense || result.deltaStrengthState === 'STRONG' || result.deltaStrengthState === 'EXTREME')) {
      rows.push({ key: 'strength', text: strength, priority: 70, tip });
    }
    if (ratio) rows.push({ key: 'ratio', text: ratio, priority: 90, tip });
    if (progress && !dense) rows.push({ key: 'progress', text: progress, priority: 50, tip });
    if (effort) rows.push({ key: 'effort', text: effort, priority: 100, tip });
  }

  const cap = dense ? 2 : 4;
  return rows.sort((a, b) => b.priority - a.priority).slice(0, cap).sort((a, b) => {
    const order: Record<DeltaLabelRow['key'], number> = {
      strength: 0,
      ratio: 1,
      progress: 2,
      effort: 3,
      effortLevel: 4,
      response: 5,
      effortResponse: 6,
      responseEffort: 7,
    };
    return order[a.key] - order[b.key];
  });
}

/** Y positions measured down from the candle foot. All values stay below the candle. */
export function deltaLabelYOffsets(
  rowCount: number,
  firstOffset = DELTA_LABEL_FIRST_OFFSET,
  lineH = DELTA_LABEL_LINE_H,
): number[] {
  const ys: number[] = [];
  for (let i = 0; i < rowCount; i++) ys.push(firstOffset + i * lineH);
  return ys;
}
