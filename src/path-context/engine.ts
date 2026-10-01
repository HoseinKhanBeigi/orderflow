/**
 * Path context — separates historical structure from live liquidity above/below price.
 * NEVER communicate "no historical resistance detected" as "no resistance / free space".
 */

export const PATH_CONTEXT_VERSION = 'PATH_CONTEXT_V1';

export type HistoricalDetectionStatus = 'FOUND' | 'NONE_DETECTED';

export type HistoricalNoneDetectedReason =
  | 'NO_QUALIFIED_LEVEL'
  | 'OUTSIDE_LOADED_HISTORY'
  | 'FILTERED_AS_MINOR'
  | 'HIGHER_TIMEFRAME_NOT_LOADED'
  | 'INSUFFICIENT_HISTORY'
  | 'MINOR_LEVELS_HIDDEN';

export type HigherTfStatus = 'FOUND' | 'NONE_DETECTED' | 'HIGHER_TF_NOT_AVAILABLE';

export type PathQuality =
  | 'BLOCKED'
  | 'CONTESTED'
  | 'MODERATELY_OPEN'
  | 'RELATIVELY_OPEN'
  | 'UNKNOWN';

export type NextObstacleType =
  | 'HISTORICAL_RESISTANCE'
  | 'LIVE_ASK_DEFENSE'
  | 'HISTORICAL_SUPPORT'
  | 'LIVE_BID_DEFENSE'
  | 'NONE_DETECTED';

export type ResistanceBreakState =
  | 'NONE'
  | 'ACTIVE'
  | 'TESTING'
  | 'BREAKING'
  | 'BROKEN'
  | 'REJECTED'
  | 'ACCEPTED_ABOVE';

export type SupportBreakState =
  | 'NONE'
  | 'ACTIVE'
  | 'TESTING'
  | 'BREAKING'
  | 'BROKEN'
  | 'REJECTED'
  | 'ACCEPTED_BELOW';

export type LiveBookQuality = 'GOOD' | 'STALE' | 'PARTIAL' | 'UNRELIABLE' | 'UNKNOWN';

export type UpsideLiquidityState = 'DENSE' | 'MODERATE' | 'THIN' | 'UNKNOWN';

export interface PathZoneRef {
  center: number;
  zoneLow: number;
  zoneHigh: number;
  strength: number;
  timeframe?: string;
  major?: boolean;
  id?: string;
}

export interface PathLiveWallRef {
  price: number;
  strength: number;
  notional?: number | null;
  trend?: string | null;
}

export interface HistoricalLevelLookup {
  status: HistoricalDetectionStatus;
  reason: HistoricalNoneDetectedReason | null;
  reasonLabel: string | null;
  zone: PathZoneRef | null;
  distanceBps: number | null;
}

export interface HigherTfLookup {
  status: HigherTfStatus;
  zone: PathZoneRef | null;
  distanceBps: number | null;
}

export interface NextObstacle {
  direction: 'UP' | 'DOWN';
  type: NextObstacleType;
  price: number | null;
  strength: number | null;
  distanceBps: number | null;
  sourceLabel: string;
  timeframe?: string | null;
}

export interface UpsidePathContext {
  currentResistance: PathZoneRef | null;
  resistanceState: ResistanceBreakState;
  nextHistoricalResistance: PathZoneRef | null;
  historicalStatus: HistoricalDetectionStatus;
  historicalReason: HistoricalNoneDetectedReason | null;
  historicalReasonLabel: string | null;
  higherTimeframeResistance: PathZoneRef | null;
  higherTfStatus: HigherTfStatus;
  liveAskDefense: PathLiveWallRef | null;
  askLiquidityPresent: boolean;
  liveBookQuality: LiveBookQuality;
  upsideLiquidityState: UpsideLiquidityState;
  quality: PathQuality;
  nextObstacle: NextObstacle;
  confluence: 'NONE' | 'RESISTANCE_CONFLUENCE_HIGH';
  interpretation: string;
}

export interface DownsidePathContext {
  currentSupport: PathZoneRef | null;
  supportState: SupportBreakState;
  nextHistoricalSupport: PathZoneRef | null;
  historicalStatus: HistoricalDetectionStatus;
  historicalReason: HistoricalNoneDetectedReason | null;
  historicalReasonLabel: string | null;
  higherTimeframeSupport: PathZoneRef | null;
  higherTfStatus: HigherTfStatus;
  liveBidDefense: PathLiveWallRef | null;
  bidLiquidityPresent: boolean;
  liveBookQuality: LiveBookQuality;
  downsideLiquidityState: UpsideLiquidityState;
  quality: PathQuality;
  nextObstacle: NextObstacle;
  confluence: 'NONE' | 'SUPPORT_CONFLUENCE_HIGH';
  interpretation: string;
}

export interface PathContextSnapshot {
  version: typeof PATH_CONTEXT_VERSION;
  timestamp: number;
  currentPrice: number;
  upside: UpsidePathContext;
  downside: DownsidePathContext;
}

export interface PathContextConfig {
  majorMinStrength: number;
  confluenceBps: number;
  nearZoneBps: number;
  strongLiveDefense: number;
  weakLiveDefense: number;
  denseAskStrength: number;
  thinAskStrength: number;
}

export const DEFAULT_PATH_CONTEXT_CONFIG: PathContextConfig = {
  majorMinStrength: 62,
  confluenceBps: 12,
  nearZoneBps: 25,
  strongLiveDefense: 65,
  weakLiveDefense: 40,
  denseAskStrength: 70,
  thinAskStrength: 40,
};

export interface PathContextInput {
  currentPrice: number;
  timestamp: number;
  /** Current TF historical resistances (already known). */
  historicalResistances: PathZoneRef[];
  historicalSupports: PathZoneRef[];
  /** Optional higher-TF levels separately. */
  higherTfResistances?: PathZoneRef[] | null;
  higherTfSupports?: PathZoneRef[] | null;
  higherTfAvailable?: boolean;
  minorLevelsHidden?: boolean;
  historyInsufficient?: boolean;
  liveAsk?: PathLiveWallRef | null;
  liveBid?: PathLiveWallRef | null;
  askLiquidityPresent?: boolean;
  bidLiquidityPresent?: boolean;
  liveBookQuality?: LiveBookQuality;
  /** Location / interaction hints from zone engine. */
  locationState?: string | null;
  interactionState?: string | null;
  buyAttack?: number | null;
  sellAttack?: number | null;
  upResult?: number | null;
  downResult?: number | null;
  config?: Partial<PathContextConfig>;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bps(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(a - b) / a) * 10_000;
}

function reasonLabel(
  reason: HistoricalNoneDetectedReason | null,
  tfHint = 'current TF',
  side: 'RESISTANCE' | 'SUPPORT' = 'RESISTANCE',
): string | null {
  if (!reason) return null;
  const noun = side === 'SUPPORT' ? 'support' : 'resistance';
  switch (reason) {
    case 'NO_QUALIFIED_LEVEL':
      return `No qualified ${tfHint} ${noun} in loaded history`;
    case 'OUTSIDE_LOADED_HISTORY':
      return 'Outside loaded history window';
    case 'FILTERED_AS_MINOR':
    case 'MINOR_LEVELS_HIDDEN':
      return `No major ${noun} detected · Minor levels hidden`;
    case 'HIGHER_TIMEFRAME_NOT_LOADED':
      return 'Higher timeframe structure not loaded';
    case 'INSUFFICIENT_HISTORY':
      return 'Insufficient history to detect structure';
    default:
      return `No qualified ${noun} detected`;
  }
}

function isMajor(z: PathZoneRef, min: number): boolean {
  if (z.major === false) return false;
  if (z.major === true) return true;
  return z.strength >= min;
}

/** Next resistance strictly above price (prefer zoneLow > price; else center > price). */
export function nextResistanceAbove(
  zones: PathZoneRef[],
  price: number,
  majorOnly: boolean,
  majorMin: number,
): { zone: PathZoneRef | null; filteredMinorExists: boolean } {
  const above = zones
    .filter((z) => z.zoneLow > price || z.center > price)
    .sort((a, b) => a.center - b.center);
  const majors = above.filter((z) => isMajor(z, majorMin));
  const filteredMinorExists = majorOnly && majors.length === 0 && above.length > 0;
  if (majorOnly) return { zone: majors[0] ?? null, filteredMinorExists };
  return { zone: above[0] ?? null, filteredMinorExists: false };
}

export function nextSupportBelow(
  zones: PathZoneRef[],
  price: number,
  majorOnly: boolean,
  majorMin: number,
): { zone: PathZoneRef | null; filteredMinorExists: boolean } {
  const below = zones
    .filter((z) => z.zoneHigh < price || z.center < price)
    .sort((a, b) => b.center - a.center);
  const majors = below.filter((z) => isMajor(z, majorMin));
  const filteredMinorExists = majorOnly && majors.length === 0 && below.length > 0;
  if (majorOnly) return { zone: majors[0] ?? null, filteredMinorExists };
  return { zone: below[0] ?? null, filteredMinorExists: false };
}

export function currentZoneNearPrice(
  zones: PathZoneRef[],
  price: number,
  nearBps: number,
  side: 'RESISTANCE' | 'SUPPORT',
): PathZoneRef | null {
  const candidates = zones
    .map((z) => {
      const inside = price >= z.zoneLow && price <= z.zoneHigh;
      const dist = Math.min(bps(price, z.zoneLow), bps(price, z.zoneHigh), bps(price, z.center));
      return { z, inside, dist };
    })
    .filter((c) => c.inside || c.dist <= nearBps)
    .sort((a, b) => a.dist - b.dist);
  return candidates[0]?.z ?? null;
}

export function resistanceBreakStateOf(input: {
  locationState?: string | null;
  interactionState?: string | null;
  current: PathZoneRef | null;
  price: number;
}): ResistanceBreakState {
  const loc = String(input.locationState || '');
  const ix = String(input.interactionState || '');
  if (!input.current && !/RESISTANCE/.test(loc)) return 'NONE';
  if (ix === 'REJECTED' || /REJECT/.test(ix)) return 'REJECTED';
  if (ix === 'ACCEPTED_THROUGH' || ix === 'BROKEN' || loc === 'ABOVE_RESISTANCE') {
    if (input.current && input.price > input.current.zoneHigh) return 'ACCEPTED_ABOVE';
    return 'BROKEN';
  }
  if (ix === 'BREAKING' || /BREAKING/.test(ix)) return 'BREAKING';
  if (
    loc === 'INSIDE_RESISTANCE' ||
    loc === 'ENTERING_RESISTANCE' ||
    loc === 'AT_RESISTANCE' ||
    loc === 'NEAR_RESISTANCE'
  ) {
    return 'TESTING';
  }
  if (input.current) return 'ACTIVE';
  return 'NONE';
}

export function supportBreakStateOf(input: {
  locationState?: string | null;
  interactionState?: string | null;
  current: PathZoneRef | null;
  price: number;
}): SupportBreakState {
  const loc = String(input.locationState || '');
  const ix = String(input.interactionState || '');
  if (!input.current && !/SUPPORT/.test(loc)) return 'NONE';
  if (ix === 'REJECTED' || /REJECT/.test(ix)) return 'REJECTED';
  if (ix === 'ACCEPTED_THROUGH' || ix === 'BROKEN' || loc === 'BELOW_SUPPORT') {
    if (input.current && input.price < input.current.zoneLow) return 'ACCEPTED_BELOW';
    return 'BROKEN';
  }
  if (ix === 'BREAKING' || /BREAKING/.test(ix)) return 'BREAKING';
  if (
    loc === 'INSIDE_SUPPORT' ||
    loc === 'ENTERING_SUPPORT' ||
    loc === 'AT_SUPPORT' ||
    loc === 'NEAR_SUPPORT'
  ) {
    return 'TESTING';
  }
  if (input.current) return 'ACTIVE';
  return 'NONE';
}

function lookupHistorical(
  zone: PathZoneRef | null,
  price: number,
  opts: {
    filteredMinorExists: boolean;
    minorHidden: boolean;
    insufficient: boolean;
    emptyUniverse: boolean;
    tfHint: string;
    side?: 'RESISTANCE' | 'SUPPORT';
  },
): HistoricalLevelLookup {
  if (zone) {
    return {
      status: 'FOUND',
      reason: null,
      reasonLabel: null,
      zone,
      distanceBps: Math.round(bps(price, zone.center) * 10) / 10,
    };
  }
  let reason: HistoricalNoneDetectedReason = 'NO_QUALIFIED_LEVEL';
  if (opts.insufficient) reason = 'INSUFFICIENT_HISTORY';
  else if (opts.filteredMinorExists) reason = 'FILTERED_AS_MINOR';
  else if (opts.minorHidden && !opts.emptyUniverse) reason = 'MINOR_LEVELS_HIDDEN';
  else if (opts.emptyUniverse) reason = 'NO_QUALIFIED_LEVEL';
  return {
    status: 'NONE_DETECTED',
    reason,
    reasonLabel: reasonLabel(reason, opts.tfHint, opts.side ?? 'RESISTANCE'),
    zone: null,
    distanceBps: null,
  };
}

function liquidityState(
  wall: PathLiveWallRef | null,
  present: boolean,
  book: LiveBookQuality,
  cfg: PathContextConfig,
): UpsideLiquidityState {
  if (book === 'STALE' || book === 'UNRELIABLE' || book === 'PARTIAL') return 'UNKNOWN';
  if (!present || !wall) return 'THIN';
  if (wall.strength >= cfg.denseAskStrength) return 'DENSE';
  if (wall.strength >= cfg.thinAskStrength) return 'MODERATE';
  return 'THIN';
}

function upsideQuality(input: {
  hist: HistoricalLevelLookup;
  htf: HigherTfLookup;
  live: PathLiveWallRef | null;
  liveState: UpsideLiquidityState;
  book: LiveBookQuality;
  buyAttack: number;
  upResult: number;
  resistanceState: ResistanceBreakState;
  cfg: PathContextConfig;
}): PathQuality {
  if (input.book === 'STALE' || input.book === 'UNRELIABLE') return 'UNKNOWN';
  const nearHist =
    (input.hist.zone && (input.hist.distanceBps ?? 999) < 80) ||
    (input.htf.zone && (input.htf.distanceBps ?? 999) < 100);
  const strongLive = !!input.live && input.live.strength >= input.cfg.strongLiveDefense;
  if (nearHist && strongLive) return 'BLOCKED';
  if (nearHist || strongLive || input.liveState === 'DENSE') return 'CONTESTED';
  if (
    input.resistanceState === 'BROKEN' ||
    input.resistanceState === 'ACCEPTED_ABOVE' ||
    input.resistanceState === 'BREAKING'
  ) {
    if (input.liveState === 'THIN' && input.buyAttack >= 60 && input.upResult >= 55) {
      return 'RELATIVELY_OPEN';
    }
    return 'MODERATELY_OPEN';
  }
  if (input.hist.status === 'NONE_DETECTED' && input.liveState === 'THIN') return 'MODERATELY_OPEN';
  return 'CONTESTED';
}

function pickNextObstacleUp(input: {
  hist: HistoricalLevelLookup;
  htf: HigherTfLookup;
  live: PathLiveWallRef | null;
  book: LiveBookQuality;
  price: number;
  cfg: PathContextConfig;
}): NextObstacle {
  type Cand = { type: NextObstacleType; price: number; strength: number; distanceBps: number; label: string; tf?: string };
  const cands: Cand[] = [];
  if (input.hist.zone) {
    cands.push({
      type: 'HISTORICAL_RESISTANCE',
      price: input.hist.zone.center,
      strength: input.hist.zone.strength,
      distanceBps: input.hist.distanceBps ?? bps(input.price, input.hist.zone.center),
      label: `${input.hist.zone.timeframe ?? ''} RESISTANCE`.trim(),
      tf: input.hist.zone.timeframe,
    });
  }
  if (input.htf.zone) {
    cands.push({
      type: 'HISTORICAL_RESISTANCE',
      price: input.htf.zone.center,
      strength: input.htf.zone.strength,
      distanceBps: input.htf.distanceBps ?? bps(input.price, input.htf.zone.center),
      label: `${input.htf.zone.timeframe ?? 'HTF'} RESISTANCE`,
      tf: input.htf.zone.timeframe,
    });
  }
  if (input.live && input.book !== 'STALE' && input.book !== 'UNRELIABLE') {
    cands.push({
      type: 'LIVE_ASK_DEFENSE',
      price: input.live.price,
      strength: input.live.strength,
      distanceBps: bps(input.price, input.live.price),
      label: 'LIVE ASK',
    });
  }
  if (!cands.length) {
    return {
      direction: 'UP',
      type: 'NONE_DETECTED',
      price: null,
      strength: null,
      distanceBps: null,
      sourceLabel: input.book === 'STALE' || input.book === 'UNRELIABLE'
        ? 'LIVE LIQUIDITY UNKNOWN'
        : 'No major obstacle detected nearby',
    };
  }
  // Immediate relevance: nearer + stronger preferred; keep source visible.
  cands.sort((a, b) => {
    const score = (c: Cand) => c.strength * 0.55 - Math.min(120, c.distanceBps) * 0.35;
    return score(b) - score(a);
  });
  const best = cands[0]!;
  return {
    direction: 'UP',
    type: best.type,
    price: best.price,
    strength: best.strength,
    distanceBps: Math.round(best.distanceBps * 10) / 10,
    sourceLabel: best.label,
    timeframe: best.tf ?? null,
  };
}

function pickNextObstacleDown(input: {
  hist: HistoricalLevelLookup;
  htf: HigherTfLookup;
  live: PathLiveWallRef | null;
  book: LiveBookQuality;
  price: number;
  cfg: PathContextConfig;
}): NextObstacle {
  type Cand = { type: NextObstacleType; price: number; strength: number; distanceBps: number; label: string; tf?: string };
  const cands: Cand[] = [];
  if (input.hist.zone) {
    cands.push({
      type: 'HISTORICAL_SUPPORT',
      price: input.hist.zone.center,
      strength: input.hist.zone.strength,
      distanceBps: input.hist.distanceBps ?? bps(input.price, input.hist.zone.center),
      label: `${input.hist.zone.timeframe ?? ''} SUPPORT`.trim(),
      tf: input.hist.zone.timeframe,
    });
  }
  if (input.htf.zone) {
    cands.push({
      type: 'HISTORICAL_SUPPORT',
      price: input.htf.zone.center,
      strength: input.htf.zone.strength,
      distanceBps: input.htf.distanceBps ?? bps(input.price, input.htf.zone.center),
      label: `${input.htf.zone.timeframe ?? 'HTF'} SUPPORT`,
      tf: input.htf.zone.timeframe,
    });
  }
  if (input.live && input.book !== 'STALE' && input.book !== 'UNRELIABLE') {
    cands.push({
      type: 'LIVE_BID_DEFENSE',
      price: input.live.price,
      strength: input.live.strength,
      distanceBps: bps(input.price, input.live.price),
      label: 'LIVE BID',
    });
  }
  if (!cands.length) {
    return {
      direction: 'DOWN',
      type: 'NONE_DETECTED',
      price: null,
      strength: null,
      distanceBps: null,
      sourceLabel: input.book === 'STALE' || input.book === 'UNRELIABLE'
        ? 'LIVE LIQUIDITY UNKNOWN'
        : 'No major obstacle detected nearby',
    };
  }
  cands.sort((a, b) => {
    const score = (c: Cand) => c.strength * 0.55 - Math.min(120, c.distanceBps) * 0.35;
    return score(b) - score(a);
  });
  const best = cands[0]!;
  return {
    direction: 'DOWN',
    type: best.type,
    price: best.price,
    strength: best.strength,
    distanceBps: Math.round(best.distanceBps * 10) / 10,
    sourceLabel: best.label,
    timeframe: best.tf ?? null,
  };
}

function upsideInterpretation(u: Omit<UpsidePathContext, 'interpretation'>): string {
  if (u.liveBookQuality === 'STALE' || u.liveBookQuality === 'UNRELIABLE') {
    return 'Live liquidity unknown — do not treat path as open';
  }
  if (u.resistanceState === 'REJECTED') return 'Resistance rejected — buyers failed at structure';
  if (u.resistanceState === 'BREAKING' || u.resistanceState === 'BROKEN' || u.resistanceState === 'ACCEPTED_ABOVE') {
    if (u.liveAskDefense && u.liveAskDefense.strength >= 60) {
      return 'Structural breakout, but live sell liquidity remains above';
    }
    if (u.quality === 'RELATIVELY_OPEN') return 'Upside path relatively open — no major obstacle detected nearby';
    return 'Resistance giving way — evaluate next obstacle';
  }
  if (u.historicalStatus === 'NONE_DETECTED' && u.liveAskDefense) {
    return `No historical resistance detected — live ask defense at ${u.liveAskDefense.price}`;
  }
  if (u.confluence === 'RESISTANCE_CONFLUENCE_HIGH') {
    return 'Historical resistance and live ask defense aligned';
  }
  return u.nextObstacle.sourceLabel;
}

export function evaluatePathContext(input: PathContextInput): PathContextSnapshot {
  const cfg: PathContextConfig = { ...DEFAULT_PATH_CONTEXT_CONFIG, ...(input.config ?? {}) };
  const price = input.currentPrice;
  const minorHidden = input.minorLevelsHidden !== false; // default: major-only view
  const book = input.liveBookQuality ?? 'UNKNOWN';
  const buyAttack = input.buyAttack ?? 50;
  const sellAttack = input.sellAttack ?? 50;
  const upResult = input.upResult ?? 50;
  const downResult = input.downResult ?? 50;

  const resAbove = nextResistanceAbove(
    input.historicalResistances,
    price,
    minorHidden,
    cfg.majorMinStrength,
  );
  const supBelow = nextSupportBelow(
    input.historicalSupports,
    price,
    minorHidden,
    cfg.majorMinStrength,
  );

  const currentRes = currentZoneNearPrice(
    input.historicalResistances,
    price,
    cfg.nearZoneBps,
    'RESISTANCE',
  );
  const currentSup = currentZoneNearPrice(
    input.historicalSupports,
    price,
    cfg.nearZoneBps,
    'SUPPORT',
  );

  const histUp = lookupHistorical(resAbove.zone, price, {
    filteredMinorExists: resAbove.filteredMinorExists,
    minorHidden,
    insufficient: !!input.historyInsufficient,
    emptyUniverse: input.historicalResistances.length === 0,
    tfHint: 'loaded',
    side: 'RESISTANCE',
  });
  const histDown = lookupHistorical(supBelow.zone, price, {
    filteredMinorExists: supBelow.filteredMinorExists,
    minorHidden,
    insufficient: !!input.historyInsufficient,
    emptyUniverse: input.historicalSupports.length === 0,
    tfHint: 'loaded',
    side: 'SUPPORT',
  });

  const htfAvail = input.higherTfAvailable === true;
  const htfResList = input.higherTfResistances ?? null;
  const htfSupList = input.higherTfSupports ?? null;

  const htfUp: HigherTfLookup = !htfAvail || htfResList == null
    ? { status: 'HIGHER_TF_NOT_AVAILABLE', zone: null, distanceBps: null }
    : (() => {
        const n = nextResistanceAbove(htfResList, price, true, cfg.majorMinStrength).zone;
        return n
          ? { status: 'FOUND' as const, zone: n, distanceBps: Math.round(bps(price, n.center) * 10) / 10 }
          : { status: 'NONE_DETECTED' as const, zone: null, distanceBps: null };
      })();

  const htfDown: HigherTfLookup = !htfAvail || htfSupList == null
    ? { status: 'HIGHER_TF_NOT_AVAILABLE', zone: null, distanceBps: null }
    : (() => {
        const n = nextSupportBelow(htfSupList, price, true, cfg.majorMinStrength).zone;
        return n
          ? { status: 'FOUND' as const, zone: n, distanceBps: Math.round(bps(price, n.center) * 10) / 10 }
          : { status: 'NONE_DETECTED' as const, zone: null, distanceBps: null };
      })();

  const liveAsk =
    book === 'STALE' || book === 'UNRELIABLE' ? null : input.liveAsk ?? null;
  const liveBid =
    book === 'STALE' || book === 'UNRELIABLE' ? null : input.liveBid ?? null;
  const askPresent = book === 'STALE' || book === 'UNRELIABLE'
    ? false
    : input.askLiquidityPresent ?? !!liveAsk;
  const bidPresent = book === 'STALE' || book === 'UNRELIABLE'
    ? false
    : input.bidLiquidityPresent ?? !!liveBid;

  const resistanceState = resistanceBreakStateOf({
    locationState: input.locationState,
    interactionState: input.interactionState,
    current: currentRes,
    price,
  });
  const supportState = supportBreakStateOf({
    locationState: input.locationState,
    interactionState: input.interactionState,
    current: currentSup,
    price,
  });

  const upLiq = liquidityState(liveAsk, askPresent, book, cfg);
  const downLiq = liquidityState(liveBid, bidPresent, book, cfg);

  const upQuality = upsideQuality({
    hist: histUp,
    htf: htfUp,
    live: liveAsk,
    liveState: upLiq,
    book,
    buyAttack,
    upResult,
    resistanceState,
    cfg,
  });
  const downQuality = upsideQuality({
    hist: histDown,
    htf: htfDown,
    live: liveBid,
    liveState: downLiq,
    book,
    buyAttack: sellAttack,
    upResult: downResult,
    resistanceState: supportState as unknown as ResistanceBreakState,
    cfg,
  });

  const confluenceUp =
    histUp.zone &&
    liveAsk &&
    bps(histUp.zone.center, liveAsk.price) <= cfg.confluenceBps &&
    histUp.zone.strength >= 60 &&
    liveAsk.strength >= cfg.strongLiveDefense
      ? 'RESISTANCE_CONFLUENCE_HIGH'
      : 'NONE';

  const confluenceDown =
    histDown.zone &&
    liveBid &&
    bps(histDown.zone.center, liveBid.price) <= cfg.confluenceBps &&
    histDown.zone.strength >= 60 &&
    liveBid.strength >= cfg.strongLiveDefense
      ? 'SUPPORT_CONFLUENCE_HIGH'
      : 'NONE';

  const nextUp = pickNextObstacleUp({
    hist: histUp,
    htf: htfUp,
    live: liveAsk,
    book,
    price,
    cfg,
  });
  const nextDown = pickNextObstacleDown({
    hist: histDown,
    htf: htfDown,
    live: liveBid,
    book,
    price,
    cfg,
  });

  const upsideBase: Omit<UpsidePathContext, 'interpretation'> = {
    currentResistance: currentRes,
    resistanceState,
    nextHistoricalResistance: histUp.zone,
    historicalStatus: histUp.status,
    historicalReason: histUp.reason,
    historicalReasonLabel: histUp.reasonLabel,
    higherTimeframeResistance: htfUp.zone,
    higherTfStatus: htfUp.status,
    liveAskDefense: liveAsk,
    askLiquidityPresent: askPresent,
    liveBookQuality: book,
    upsideLiquidityState: upLiq,
    quality: upQuality,
    nextObstacle: nextUp,
    confluence: confluenceUp,
  };

  const downsideBase: Omit<DownsidePathContext, 'interpretation'> = {
    currentSupport: currentSup,
    supportState,
    nextHistoricalSupport: histDown.zone,
    historicalStatus: histDown.status,
    historicalReason: histDown.reason,
    historicalReasonLabel: histDown.reasonLabel,
    higherTimeframeSupport: htfDown.zone,
    higherTfStatus: htfDown.status,
    liveBidDefense: liveBid,
    bidLiquidityPresent: bidPresent,
    liveBookQuality: book,
    downsideLiquidityState: downLiq,
    quality: downQuality,
    nextObstacle: nextDown,
    confluence: confluenceDown,
  };

  return {
    version: PATH_CONTEXT_VERSION,
    timestamp: input.timestamp,
    currentPrice: price,
    upside: {
      ...upsideBase,
      interpretation: upsideInterpretation(upsideBase),
    },
    downside: {
      ...downsideBase,
      interpretation: downsideInterpretation(downsideBase),
    },
  };
}


function downsideInterpretation(d: Omit<DownsidePathContext, 'interpretation'>): string {
  if (d.liveBookQuality === 'STALE' || d.liveBookQuality === 'UNRELIABLE') {
    return 'Live liquidity unknown — do not treat path as open';
  }
  if (d.supportState === 'REJECTED') return 'Support rejected — sellers failed at structure';
  if (d.supportState === 'BREAKING' || d.supportState === 'BROKEN' || d.supportState === 'ACCEPTED_BELOW') {
    if (d.liveBidDefense && d.liveBidDefense.strength >= 60) {
      return 'Structural breakdown, but live bid liquidity remains below';
    }
    if (d.quality === 'RELATIVELY_OPEN') return 'Downside path relatively open — no major obstacle detected nearby';
    return 'Support giving way — evaluate next obstacle';
  }
  if (d.historicalStatus === 'NONE_DETECTED' && d.liveBidDefense) {
    return `No historical support detected — live bid defense at ${d.liveBidDefense.price}`;
  }
  if (d.confluence === 'SUPPORT_CONFLUENCE_HIGH') {
    return 'Historical support and live bid defense aligned';
  }
  return d.nextObstacle.sourceLabel;
}

export function emptyPathContext(timestamp = 0, price = 0): PathContextSnapshot {
  const noneObstacle = (dir: 'UP' | 'DOWN'): NextObstacle => ({
    direction: dir,
    type: 'NONE_DETECTED',
    price: null,
    strength: null,
    distanceBps: null,
    sourceLabel: 'No major obstacle detected nearby',
  });
  return {
    version: PATH_CONTEXT_VERSION,
    timestamp,
    currentPrice: price,
    upside: {
      currentResistance: null,
      resistanceState: 'NONE',
      nextHistoricalResistance: null,
      historicalStatus: 'NONE_DETECTED',
      historicalReason: 'INSUFFICIENT_HISTORY',
      historicalReasonLabel: reasonLabel('INSUFFICIENT_HISTORY'),
      higherTimeframeResistance: null,
      higherTfStatus: 'HIGHER_TF_NOT_AVAILABLE',
      liveAskDefense: null,
      askLiquidityPresent: false,
      liveBookQuality: 'UNKNOWN',
      upsideLiquidityState: 'UNKNOWN',
      quality: 'UNKNOWN',
      nextObstacle: noneObstacle('UP'),
      confluence: 'NONE',
      interpretation: 'Insufficient data',
    },
    downside: {
      currentSupport: null,
      supportState: 'NONE',
      nextHistoricalSupport: null,
      historicalStatus: 'NONE_DETECTED',
      historicalReason: 'INSUFFICIENT_HISTORY',
      historicalReasonLabel: reasonLabel('INSUFFICIENT_HISTORY'),
      higherTimeframeSupport: null,
      higherTfStatus: 'HIGHER_TF_NOT_AVAILABLE',
      liveBidDefense: null,
      bidLiquidityPresent: false,
      liveBookQuality: 'UNKNOWN',
      downsideLiquidityState: 'UNKNOWN',
      quality: 'UNKNOWN',
      nextObstacle: noneObstacle('DOWN'),
      confluence: 'NONE',
      interpretation: 'Insufficient data',
    },
  };
}

/** Compact trader labels — never "NO RESISTANCE" / "FREE SPACE". */
export function pathQualityLabel(q: PathQuality): string {
  switch (q) {
    case 'BLOCKED':
      return 'BLOCKED';
    case 'CONTESTED':
      return 'CONTESTED';
    case 'MODERATELY_OPEN':
      return 'MODERATELY OPEN';
    case 'RELATIVELY_OPEN':
      return 'RELATIVELY OPEN';
    default:
      return 'UNKNOWN';
  }
}

export function historicalStatusLabel(status: HistoricalDetectionStatus): string {
  return status === 'FOUND' ? 'FOUND' : 'NONE DETECTED';
}
