/**
 * Failure + Reclaim Setup — break attempt → failure → reclaim → control shift → setup.
 *
 * FAILURE alone ≠ entry. RECLAIM alone ≠ entry.
 * Never: FAILURE = LONG/SHORT.
 */

export const FAILURE_RECLAIM_VERSION = 'FAILURE_RECLAIM_SETUP_V1';

export type ReferenceLevelType =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'HISTORICAL_SUPPORT'
  | 'HISTORICAL_RESISTANCE'
  | 'LIQUIDITY_ZONE'
  | 'STRUCTURAL_BREAKOUT'
  | 'SESSION_HIGH'
  | 'SESSION_LOW';

export type SetupMachineState =
  | 'NO_SETUP'
  | 'BREAK_ATTEMPT'
  | 'FAILURE_DETECTED'
  | 'RECLAIM_FORMING'
  | 'RECLAIM_CONFIRMED'
  | 'CONTROL_SHIFT_PENDING'
  | 'LONG_SETUP'
  | 'SHORT_SETUP'
  | 'INVALIDATED'
  | 'EXPIRED';

export type SetupAction = 'LONG_SETUP' | 'SHORT_SETUP' | 'LONG_FORMING' | 'SHORT_FORMING' | 'WAIT' | 'INVALIDATED';

export type FailedSide = 'BUYERS' | 'SELLERS' | 'NONE';

export type ReclaimQuality = 'NONE' | 'WICK_RECLAIM' | 'BODY_RECLAIM' | 'CLOSE_RECLAIM' | 'ACCEPTED_RECLAIM' | 'RECLAIM_FAILED';

export type ControlShiftState = 'NONE' | 'FORMING' | 'CONFIRMED' | 'LOST';

export type MissingConfirmation =
  | 'NONE'
  | 'MEANINGFUL_LEVEL'
  | 'BREAK_ATTEMPT'
  | 'FAILURE'
  | 'RECLAIM'
  | 'BUYER_CONTROL'
  | 'SELLER_CONTROL'
  | 'CONTROL_SHIFT';

export interface ReferenceLevel {
  id: string;
  type: ReferenceLevelType;
  price: number;
  significance: number;
  /** Zone optional half-width around price. */
  zoneLow?: number;
  zoneHigh?: number;
}

export interface BarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface FlowEvidence {
  buyEffort: number | null;
  sellEffort: number | null;
  askDefense: number | null;
  bidDefense: number | null;
  askRefill?: number | null;
  bidRefill?: number | null;
  askSurvival?: number | null;
  bidSurvival?: number | null;
  upResult: number | null;
  downResult: number | null;
  buyerControl: number | null;
  sellerControl: number | null;
  buyerAbsorbed?: boolean;
  sellerAbsorbed?: boolean;
  stopHuntHigh?: boolean;
  stopHuntLow?: boolean;
  forcedBuyAbsorbed?: boolean;
  forcedSellAbsorbed?: boolean;
}

export interface FailureReclaimConfig {
  minBreakBps: number;
  minBreakAtrFraction: number;
  effortHigh: number;
  effortMeaningful: number;
  resultLow: number;
  defenseHigh: number;
  controlConfirm: number;
  controlForming: number;
  acceptHoldBars: number;
  maxBarsAfterFailure: number;
  minLevelSignificance: number;
  reclaimCloseBeyondBps: number;
}

export const DEFAULT_FAILURE_RECLAIM_CONFIG: FailureReclaimConfig = {
  minBreakBps: 5,
  minBreakAtrFraction: 0.08,
  effortHigh: 65,
  effortMeaningful: 45,
  resultLow: 35,
  defenseHigh: 65,
  controlConfirm: 62,
  controlForming: 52,
  acceptHoldBars: 1,
  maxBarsAfterFailure: 12,
  minLevelSignificance: 42,
  reclaimCloseBeyondBps: 2,
};

export interface BreakAttemptView {
  confirmed: boolean;
  weak: boolean;
  extremePrice: number | null;
  breakDepthBps: number | null;
  breakDepthNormalized: number | null;
}

export interface FailureView {
  detected: boolean;
  side: FailedSide;
  strength: number;
  label: 'BUYER_FAILURE' | 'SELLER_FAILURE' | 'WEAK_BREAK_ATTEMPT' | 'NO_MEANINGFUL_FAILURE' | 'NONE';
}

export interface ReclaimView {
  state: ReclaimQuality;
  confirmed: boolean;
  hold: boolean;
}

export interface ControlShiftView {
  state: ControlShiftState;
  buyerControl: number | null;
  sellerControl: number | null;
}

export interface SetupConfidenceComponents {
  levelSignificance: number;
  breakQuality: number;
  failureStrength: number;
  reclaimQuality: number;
  controlShift: number;
  defenseConfirm: number;
  absorptionBoost: number;
  confluenceBoost: number;
}

export interface FailureReclaimSnapshot {
  version: typeof FAILURE_RECLAIM_VERSION;
  timestamp: number;
  machineState: SetupMachineState;
  setup: SetupAction;
  direction: 'LONG' | 'SHORT' | 'NONE';
  referenceLevel: ReferenceLevel | null;
  breakAttempt: BreakAttemptView;
  failure: FailureView;
  reclaim: ReclaimView;
  controlShift: ControlShiftView;
  confidence: number;
  components: SetupConfidenceComponents;
  missingConfirmation: MissingConfirmation;
  progress: {
    breakAttempt: boolean;
    failure: boolean;
    reclaim: boolean;
    controlShift: boolean;
    setup: boolean;
  };
  alert: FailureReclaimAlert;
  interpretation: string;
  /** Causal timestamps — null until observed. */
  failureTimestamp: number | null;
  reclaimTimestamp: number | null;
  controlShiftTimestamp: number | null;
  setupConfirmedTimestamp: number | null;
  barsSinceFailure: number | null;
}

export type FailureReclaimAlert =
  | 'NONE'
  | 'SELLER_FAILURE_DETECTED'
  | 'BUYER_FAILURE_DETECTED'
  | 'LONG_RECLAIM_FORMING'
  | 'SHORT_RECLAIM_FORMING'
  | 'LONG_RECLAIM_CONFIRMED'
  | 'SHORT_RECLAIM_CONFIRMED'
  | 'LONG_SETUP_CONFIRMED'
  | 'SHORT_SETUP_CONFIRMED'
  | 'SETUP_INVALIDATED';

export interface EvaluateFailureReclaimInput {
  timestamp: number;
  bar: BarLike;
  /** Prior completed bars after failure (for acceptance / expiration). Oldest→newest. */
  postFailureBars?: BarLike[];
  atr?: number | null;
  levels: ReferenceLevel[];
  flow: FlowEvidence;
  /** Carry prior machine state for causal progression (no future). */
  prior?: FailureReclaimSnapshot | null;
  config?: Partial<FailureReclaimConfig>;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mergeFailureReclaimConfig(partial?: Partial<FailureReclaimConfig>): FailureReclaimConfig {
  return { ...DEFAULT_FAILURE_RECLAIM_CONFIG, ...partial };
}

export function distanceBps(price: number, level: number): number {
  if (!(level > 0) || !Number.isFinite(price)) return 0;
  return (Math.abs(price - level) / level) * 10_000;
}

function emptyBreak(): BreakAttemptView {
  return { confirmed: false, weak: false, extremePrice: null, breakDepthBps: null, breakDepthNormalized: null };
}

function emptyFailure(): FailureView {
  return { detected: false, side: 'NONE', strength: 0, label: 'NONE' };
}

function emptyReclaim(): ReclaimView {
  return { state: 'NONE', confirmed: false, hold: false };
}

function emptyControl(): ControlShiftView {
  return { state: 'NONE', buyerControl: null, sellerControl: null };
}

function emptyComponents(): SetupConfidenceComponents {
  return {
    levelSignificance: 0,
    breakQuality: 0,
    failureStrength: 0,
    reclaimQuality: 0,
    controlShift: 0,
    defenseConfirm: 0,
    absorptionBoost: 0,
    confluenceBoost: 0,
  };
}

export function emptyFailureReclaim(timestamp = 0): FailureReclaimSnapshot {
  return {
    version: FAILURE_RECLAIM_VERSION,
    timestamp,
    machineState: 'NO_SETUP',
    setup: 'WAIT',
    direction: 'NONE',
    referenceLevel: null,
    breakAttempt: emptyBreak(),
    failure: emptyFailure(),
    reclaim: emptyReclaim(),
    controlShift: emptyControl(),
    confidence: 0,
    components: emptyComponents(),
    missingConfirmation: 'MEANINGFUL_LEVEL',
    progress: { breakAttempt: false, failure: false, reclaim: false, controlShift: false, setup: false },
    alert: 'NONE',
    interpretation: '',
    failureTimestamp: null,
    reclaimTimestamp: null,
    controlShiftTimestamp: null,
    setupConfirmedTimestamp: null,
    barsSinceFailure: null,
  };
}

/** Prefer major swings / HSR / liquidity zones nearest to price. */
export function pickReferenceLevels(
  levels: ReferenceLevel[],
  price: number,
  cfg: FailureReclaimConfig,
): { longLevel: ReferenceLevel | null; shortLevel: ReferenceLevel | null } {
  const eligible = levels.filter((l) => l.significance >= cfg.minLevelSignificance && Number.isFinite(l.price));
  const supports = eligible
    .filter((l) =>
      l.type === 'SWING_LOW' ||
      l.type === 'HISTORICAL_SUPPORT' ||
      l.type === 'LIQUIDITY_ZONE' ||
      l.type === 'SESSION_LOW',
    )
    .sort(
      (a, b) =>
        distanceBps(price, a.price) - distanceBps(price, b.price) || b.significance - a.significance,
    );
  const resists = eligible
    .filter((l) =>
      l.type === 'SWING_HIGH' ||
      l.type === 'HISTORICAL_RESISTANCE' ||
      l.type === 'LIQUIDITY_ZONE' ||
      l.type === 'SESSION_HIGH',
    )
    .sort(
      (a, b) =>
        distanceBps(price, a.price) - distanceBps(price, b.price) || b.significance - a.significance,
    );

  // For LIQUIDITY_ZONE ambiguous type: use position vs price
  const liqBelow = eligible
    .filter((l) => l.type === 'LIQUIDITY_ZONE' && l.price <= price)
    .sort((a, b) => distanceBps(price, a.price) - distanceBps(price, b.price));
  const liqAbove = eligible
    .filter((l) => l.type === 'LIQUIDITY_ZONE' && l.price >= price)
    .sort((a, b) => distanceBps(price, a.price) - distanceBps(price, b.price));

  return {
    longLevel: supports[0] ?? liqBelow[0] ?? null,
    shortLevel: resists[0] ?? liqAbove[0] ?? null,
  };
}

export function minBreakDistance(level: number, atr: number | null | undefined, cfg: FailureReclaimConfig): number {
  const bps = (level * cfg.minBreakBps) / 10_000;
  const atrPart = atr != null && atr > 0 ? atr * cfg.minBreakAtrFraction : bps;
  return Math.max(bps, atrPart);
}

export function classifyBreakAttempt(input: {
  direction: 'LONG' | 'SHORT';
  level: ReferenceLevel;
  bar: BarLike;
  atr?: number | null;
  cfg: FailureReclaimConfig;
  flow: FlowEvidence;
}): BreakAttemptView {
  const { direction, level, bar, atr, cfg, flow } = input;
  const minDist = minBreakDistance(level.price, atr, cfg);
  if (direction === 'LONG') {
    const extreme = bar.low;
    const depth = level.price - extreme;
    if (depth < minDist) return emptyBreak();
    const depthBps = distanceBps(extreme, level.price);
    const effort = flow.sellEffort ?? 0;
    const weak = effort < cfg.effortMeaningful;
    return {
      confirmed: !weak,
      weak,
      extremePrice: extreme,
      breakDepthBps: depthBps,
      breakDepthNormalized: atr && atr > 0 ? depth / atr : depthBps / Math.max(cfg.minBreakBps, 1),
    };
  }
  const extreme = bar.high;
  const depth = extreme - level.price;
  if (depth < minDist) return emptyBreak();
  const depthBps = distanceBps(extreme, level.price);
  const effort = flow.buyEffort ?? 0;
  const weak = effort < cfg.effortMeaningful;
  return {
    confirmed: !weak,
    weak,
    extremePrice: extreme,
    breakDepthBps: depthBps,
    breakDepthNormalized: atr && atr > 0 ? depth / atr : depthBps / Math.max(cfg.minBreakBps, 1),
  };
}

export function classifyFailure(input: {
  direction: 'LONG' | 'SHORT';
  breakAttempt: BreakAttemptView;
  flow: FlowEvidence;
  cfg: FailureReclaimConfig;
}): FailureView {
  const { direction, breakAttempt, flow, cfg } = input;
  if (!breakAttempt.confirmed && !breakAttempt.weak) return emptyFailure();
  if (breakAttempt.weak) {
    return { detected: false, side: 'NONE', strength: 20, label: 'WEAK_BREAK_ATTEMPT' };
  }

  if (direction === 'LONG') {
    const effort = flow.sellEffort ?? 0;
    const result = flow.downResult ?? 100;
    const defense = flow.bidDefense ?? 0;
    const refill = flow.bidRefill ?? defense;
    const survival = flow.bidSurvival ?? defense;
    if (effort < cfg.effortMeaningful) {
      return { detected: false, side: 'NONE', strength: 25, label: 'NO_MEANINGFUL_FAILURE' };
    }
    const failed = effort >= cfg.effortMeaningful && result <= cfg.resultLow;
    if (!failed) return emptyFailure();
    let strength = 45 + Math.min(30, (effort - cfg.effortMeaningful) * 0.5) + Math.min(20, cfg.resultLow - result);
    if (defense >= cfg.defenseHigh) strength += 8;
    if ((refill ?? 0) >= cfg.defenseHigh) strength += 4;
    if ((survival ?? 0) >= cfg.defenseHigh) strength += 4;
    if (flow.sellerAbsorbed) strength += 6;
    if (flow.forcedSellAbsorbed) strength += 5;
    if (flow.stopHuntLow) strength += 5;
    return {
      detected: true,
      side: 'SELLERS',
      strength: clamp(Math.round(strength), 0, 100),
      label: 'SELLER_FAILURE',
    };
  }

  const effort = flow.buyEffort ?? 0;
  const result = flow.upResult ?? 100;
  const defense = flow.askDefense ?? 0;
  const refill = flow.askRefill ?? defense;
  const survival = flow.askSurvival ?? defense;
  if (effort < cfg.effortMeaningful) {
    return { detected: false, side: 'NONE', strength: 25, label: 'NO_MEANINGFUL_FAILURE' };
  }
  const failed = effort >= cfg.effortMeaningful && result <= cfg.resultLow;
  if (!failed) return emptyFailure();
  let strength = 45 + Math.min(30, (effort - cfg.effortMeaningful) * 0.5) + Math.min(20, cfg.resultLow - result);
  if (defense >= cfg.defenseHigh) strength += 8;
  if ((refill ?? 0) >= cfg.defenseHigh) strength += 4;
  if ((survival ?? 0) >= cfg.defenseHigh) strength += 4;
  if (flow.buyerAbsorbed) strength += 6;
  if (flow.forcedBuyAbsorbed) strength += 5;
  if (flow.stopHuntHigh) strength += 5;
  return {
    detected: true,
    side: 'BUYERS',
    strength: clamp(Math.round(strength), 0, 100),
    label: 'BUYER_FAILURE',
  };
}

export function classifyReclaim(input: {
  direction: 'LONG' | 'SHORT';
  level: ReferenceLevel;
  bar: BarLike;
  postFailureBars: BarLike[];
  cfg: FailureReclaimConfig;
  priorReclaim?: ReclaimView | null;
}): ReclaimView {
  const { direction, level, bar, postFailureBars, cfg } = input;
  const beyond = (cfg.reclaimCloseBeyondBps / 10_000) * level.price;

  if (direction === 'LONG') {
    // Reclaim = back ABOVE the level after a downside break (not the break candle itself).
    const closeOk = bar.close >= level.price + beyond;
    const bodyOk =
      bar.close >= level.price &&
      Math.min(bar.open, bar.close) < level.price &&
      Math.max(bar.open, bar.close) >= level.price + beyond;
    const wickOk = bar.high >= level.price + beyond && bar.close < level.price;
    if (!wickOk && !closeOk && !bodyOk && !(input.priorReclaim?.confirmed)) {
      return emptyReclaim();
    }
    let state: ReclaimQuality = 'NONE';
    if (closeOk) state = 'CLOSE_RECLAIM';
    else if (bodyOk) state = 'BODY_RECLAIM';
    else if (wickOk) state = 'WICK_RECLAIM';

    const heldBars = postFailureBars.filter((b) => b.close >= level.price).length;
    const lostAgain = postFailureBars.some((b) => b.close < level.price - beyond && b.time > bar.time);
    if (closeOk && heldBars >= cfg.acceptHoldBars && !lostAgain) state = 'ACCEPTED_RECLAIM';
    if ((input.priorReclaim?.confirmed || closeOk) && lostAgain) {
      return { state: 'RECLAIM_FAILED', confirmed: false, hold: false };
    }
    const confirmed = state === 'CLOSE_RECLAIM' || state === 'ACCEPTED_RECLAIM' || state === 'BODY_RECLAIM';
    return {
      state,
      confirmed,
      hold: state === 'ACCEPTED_RECLAIM',
    };
  }

  const closeOk = bar.close <= level.price - beyond;
  const bodyOk =
    bar.close <= level.price &&
    Math.max(bar.open, bar.close) > level.price &&
    Math.min(bar.open, bar.close) <= level.price - beyond;
  const wickOk = bar.low <= level.price - beyond && bar.close > level.price;
  if (!wickOk && !closeOk && !bodyOk && !(input.priorReclaim?.confirmed)) {
    return emptyReclaim();
  }
  let state: ReclaimQuality = 'NONE';
  if (closeOk) state = 'CLOSE_RECLAIM';
  else if (bodyOk) state = 'BODY_RECLAIM';
  else if (wickOk) state = 'WICK_RECLAIM';

  const heldBars = postFailureBars.filter((b) => b.close <= level.price).length;
  const lostAgain = postFailureBars.some((b) => b.close > level.price + beyond && b.time > bar.time);
  if (closeOk && heldBars >= cfg.acceptHoldBars && !lostAgain) state = 'ACCEPTED_RECLAIM';
  if ((input.priorReclaim?.confirmed || closeOk) && lostAgain) {
    return { state: 'RECLAIM_FAILED', confirmed: false, hold: false };
  }
  const confirmed = state === 'CLOSE_RECLAIM' || state === 'ACCEPTED_RECLAIM' || state === 'BODY_RECLAIM';
  return { state, confirmed, hold: state === 'ACCEPTED_RECLAIM' };
}

export function classifyControlShift(input: {
  direction: 'LONG' | 'SHORT';
  flow: FlowEvidence;
  cfg: FailureReclaimConfig;
}): ControlShiftView {
  const { direction, flow, cfg } = input;
  const buyer = flow.buyerControl;
  const seller = flow.sellerControl;
  if (direction === 'LONG') {
    if (buyer == null) return { state: 'NONE', buyerControl: null, sellerControl: seller };
    if (buyer >= cfg.controlConfirm) return { state: 'CONFIRMED', buyerControl: buyer, sellerControl: seller };
    if (buyer >= cfg.controlForming) return { state: 'FORMING', buyerControl: buyer, sellerControl: seller };
    return { state: 'NONE', buyerControl: buyer, sellerControl: seller };
  }
  if (seller == null) return { state: 'NONE', buyerControl: buyer, sellerControl: null };
  if (seller >= cfg.controlConfirm) return { state: 'CONFIRMED', buyerControl: buyer, sellerControl: seller };
  if (seller >= cfg.controlForming) return { state: 'FORMING', buyerControl: buyer, sellerControl: seller };
  return { state: 'NONE', buyerControl: buyer, sellerControl: seller };
}

function scoreConfidence(input: {
  level: ReferenceLevel;
  breakAttempt: BreakAttemptView;
  failure: FailureView;
  reclaim: ReclaimView;
  control: ControlShiftView;
  flow: FlowEvidence;
  direction: 'LONG' | 'SHORT';
}): { confidence: number; components: SetupConfidenceComponents } {
  const reclaimMap: Record<ReclaimQuality, number> = {
    NONE: 0,
    WICK_RECLAIM: 25,
    BODY_RECLAIM: 45,
    CLOSE_RECLAIM: 70,
    ACCEPTED_RECLAIM: 90,
    RECLAIM_FAILED: 5,
  };
  const controlMap: Record<ControlShiftState, number> = {
    NONE: 0,
    FORMING: 45,
    CONFIRMED: 85,
    LOST: 5,
  };
  const components: SetupConfidenceComponents = {
    levelSignificance: clamp(input.level.significance, 0, 100),
    breakQuality: input.breakAttempt.confirmed
      ? clamp(40 + (input.breakAttempt.breakDepthNormalized ?? 0) * 20, 0, 100)
      : input.breakAttempt.weak
        ? 20
        : 0,
    failureStrength: input.failure.strength,
    reclaimQuality: reclaimMap[input.reclaim.state],
    controlShift: controlMap[input.control.state],
    defenseConfirm:
      input.direction === 'LONG'
        ? clamp(input.flow.bidDefense ?? 0, 0, 100)
        : clamp(input.flow.askDefense ?? 0, 0, 100),
    // Absorption / stop-hunt / forced — single small boost, not double-counted into failure again
    absorptionBoost: clamp(
      (input.direction === 'LONG'
        ? (input.flow.sellerAbsorbed ? 12 : 0) + (input.flow.stopHuntLow ? 8 : 0) + (input.flow.forcedSellAbsorbed ? 8 : 0)
        : (input.flow.buyerAbsorbed ? 12 : 0) + (input.flow.stopHuntHigh ? 8 : 0) + (input.flow.forcedBuyAbsorbed ? 8 : 0)),
      0,
      20,
    ),
    confluenceBoost: clamp(
      input.level.type === 'HISTORICAL_SUPPORT' ||
        input.level.type === 'HISTORICAL_RESISTANCE' ||
        input.level.type === 'LIQUIDITY_ZONE'
        ? 12
        : input.level.type === 'SWING_HIGH' || input.level.type === 'SWING_LOW'
          ? 8
          : 0,
      0,
      15,
    ),
  };

  // Transparent weights — failure strength already embeds defense; defenseConfirm lightly weighted
  const confidence = Math.round(
    components.levelSignificance * 0.15 +
      components.breakQuality * 0.1 +
      components.failureStrength * 0.25 +
      components.reclaimQuality * 0.2 +
      components.controlShift * 0.2 +
      components.defenseConfirm * 0.05 +
      components.absorptionBoost * 0.03 +
      components.confluenceBoost * 0.02,
  );
  return { confidence: clamp(confidence, 0, 100), components };
}

function evaluateDirection(input: {
  direction: 'LONG' | 'SHORT';
  level: ReferenceLevel;
  bar: BarLike;
  postFailureBars: BarLike[];
  atr?: number | null;
  flow: FlowEvidence;
  prior: FailureReclaimSnapshot | null;
  cfg: FailureReclaimConfig;
  timestamp: number;
}): FailureReclaimSnapshot {
  const { direction, level, bar, flow, cfg, timestamp } = input;
  const priorSame =
    input.prior &&
    input.prior.direction === direction &&
    input.prior.referenceLevel?.id === level.id &&
    input.prior.machineState !== 'INVALIDATED' &&
    input.prior.machineState !== 'EXPIRED' &&
    input.prior.machineState !== 'NO_SETUP'
      ? input.prior
      : null;

  const breakAttempt = classifyBreakAttempt({ direction, level, bar, atr: input.atr, cfg, flow });
  // If we already had a break/failure earlier, keep that break evidence
  const effectiveBreak =
    priorSame?.breakAttempt.confirmed || priorSame?.failure.detected
      ? priorSame.breakAttempt
      : breakAttempt;

  let failure = classifyFailure({ direction, breakAttempt: effectiveBreak, flow, cfg });
  if (priorSame?.failure.detected && !failure.detected) {
    failure = priorSame.failure;
  }

  const postBars = input.postFailureBars ?? [];
  let reclaim = emptyReclaim();
  if (failure.detected || priorSame?.failure.detected) {
    reclaim = classifyReclaim({
      direction,
      level,
      bar,
      postFailureBars: postBars,
      cfg,
      priorReclaim: priorSame?.reclaim ?? null,
    });
    if (priorSame?.reclaim.confirmed && reclaim.state !== 'RECLAIM_FAILED' && !reclaim.confirmed) {
      reclaim = priorSame.reclaim;
    }
  }

  const control = classifyControlShift({ direction, flow, cfg });
  const { confidence, components } = scoreConfidence({
    level,
    breakAttempt: effectiveBreak,
    failure,
    reclaim,
    control,
    flow,
    direction,
  });

  const failureTimestamp = priorSame?.failureTimestamp ?? (failure.detected ? timestamp : null);
  let barsSinceFailure = priorSame?.barsSinceFailure ?? null;
  if (failureTimestamp != null) {
    barsSinceFailure = (priorSame?.barsSinceFailure ?? 0) + (priorSame?.failure.detected ? 1 : 0);
    if (!priorSame?.failure.detected && failure.detected) barsSinceFailure = 0;
  }

  // Expiration
  if (
    failure.detected &&
    failureTimestamp != null &&
    !reclaim.confirmed &&
    (barsSinceFailure ?? 0) > cfg.maxBarsAfterFailure
  ) {
    return {
      ...emptyFailureReclaim(timestamp),
      machineState: 'EXPIRED',
      setup: 'WAIT',
      direction,
      referenceLevel: level,
      breakAttempt: effectiveBreak,
      failure,
      reclaim,
      controlShift: control,
      confidence: 0,
      components,
      missingConfirmation: 'RECLAIM',
      alert: 'NONE',
      interpretation: 'Failure expired without reclaim',
      failureTimestamp,
      reclaimTimestamp: null,
      controlShiftTimestamp: null,
      setupConfirmedTimestamp: null,
      barsSinceFailure,
    };
  }

  // Invalidation after confirmed setup / reclaim
  const beyond = (cfg.reclaimCloseBeyondBps / 10_000) * level.price;
  const lostLong = direction === 'LONG' && reclaim.confirmed && bar.close < level.price - beyond;
  const lostShort = direction === 'SHORT' && reclaim.confirmed && bar.close > level.price + beyond;
  const controlLost =
    (direction === 'LONG' && (flow.sellerControl ?? 0) >= cfg.controlConfirm && (flow.buyerControl ?? 100) < cfg.controlForming) ||
    (direction === 'SHORT' && (flow.buyerControl ?? 0) >= cfg.controlConfirm && (flow.sellerControl ?? 100) < cfg.controlForming);

  if (
    (priorSame?.machineState === 'LONG_SETUP' ||
      priorSame?.machineState === 'SHORT_SETUP' ||
      priorSame?.machineState === 'RECLAIM_CONFIRMED' ||
      priorSame?.machineState === 'CONTROL_SHIFT_PENDING') &&
    (lostLong || lostShort || controlLost || reclaim.state === 'RECLAIM_FAILED')
  ) {
    return {
      version: FAILURE_RECLAIM_VERSION,
      timestamp,
      machineState: 'INVALIDATED',
      setup: 'INVALIDATED',
      direction,
      referenceLevel: level,
      breakAttempt: effectiveBreak,
      failure,
      reclaim: reclaim.state === 'RECLAIM_FAILED' ? reclaim : { ...reclaim, state: 'RECLAIM_FAILED', confirmed: false },
      controlShift: { ...control, state: 'LOST' },
      confidence: Math.min(confidence, 30),
      components,
      missingConfirmation: 'NONE',
      progress: {
        breakAttempt: effectiveBreak.confirmed,
        failure: failure.detected,
        reclaim: false,
        controlShift: false,
        setup: false,
      },
      alert: 'SETUP_INVALIDATED',
      interpretation: 'Reclaim lost / opposite control returned',
      failureTimestamp,
      reclaimTimestamp: priorSame?.reclaimTimestamp ?? null,
      controlShiftTimestamp: priorSame?.controlShiftTimestamp ?? null,
      setupConfirmedTimestamp: priorSame?.setupConfirmedTimestamp ?? null,
      barsSinceFailure,
    };
  }

  let machineState: SetupMachineState = 'NO_SETUP';
  let setup: SetupAction = 'WAIT';
  let missing: MissingConfirmation = 'BREAK_ATTEMPT';
  let alert: FailureReclaimAlert = 'NONE';
  let interpretation = '';
  let reclaimTimestamp = priorSame?.reclaimTimestamp ?? null;
  let controlShiftTimestamp = priorSame?.controlShiftTimestamp ?? null;
  let setupConfirmedTimestamp = priorSame?.setupConfirmedTimestamp ?? null;

  if (!effectiveBreak.confirmed && !effectiveBreak.weak && !failure.detected) {
    machineState = 'NO_SETUP';
    missing = effectiveBreak.weak ? 'FAILURE' : 'BREAK_ATTEMPT';
  } else if (effectiveBreak.weak && !failure.detected) {
    machineState = 'BREAK_ATTEMPT';
    missing = 'FAILURE';
    interpretation = 'Weak break attempt — no meaningful failure';
  } else if (effectiveBreak.confirmed && !failure.detected) {
    machineState = 'BREAK_ATTEMPT';
    missing = 'FAILURE';
  } else if (failure.detected && !reclaim.confirmed) {
    machineState = 'FAILURE_DETECTED';
    missing = 'RECLAIM';
    alert = direction === 'LONG' ? 'SELLER_FAILURE_DETECTED' : 'BUYER_FAILURE_DETECTED';
    interpretation = direction === 'LONG' ? 'Seller failure — await reclaim above' : 'Buyer failure — await reclaim below';
    if (reclaim.state === 'WICK_RECLAIM') {
      machineState = 'RECLAIM_FORMING';
      alert = direction === 'LONG' ? 'LONG_RECLAIM_FORMING' : 'SHORT_RECLAIM_FORMING';
      missing = 'RECLAIM';
      interpretation = 'Wick reclaim only — need close/acceptance';
    }
  } else if (failure.detected && reclaim.confirmed && control.state !== 'CONFIRMED') {
    machineState = control.state === 'FORMING' ? 'CONTROL_SHIFT_PENDING' : 'RECLAIM_CONFIRMED';
    setup = direction === 'LONG' ? 'LONG_FORMING' : 'SHORT_FORMING';
    missing = direction === 'LONG' ? 'BUYER_CONTROL' : 'SELLER_CONTROL';
    reclaimTimestamp = reclaimTimestamp ?? timestamp;
    alert = direction === 'LONG' ? 'LONG_RECLAIM_CONFIRMED' : 'SHORT_RECLAIM_CONFIRMED';
    interpretation =
      direction === 'LONG'
        ? 'Reclaim confirmed — need buyer control'
        : 'Reclaim confirmed — need seller control';
    if (control.state === 'FORMING') {
      alert = direction === 'LONG' ? 'LONG_RECLAIM_CONFIRMED' : 'SHORT_RECLAIM_CONFIRMED';
      interpretation =
        direction === 'LONG' ? 'Buyer control forming' : 'Seller control forming';
    }
  } else if (failure.detected && reclaim.confirmed && control.state === 'CONFIRMED') {
    machineState = direction === 'LONG' ? 'LONG_SETUP' : 'SHORT_SETUP';
    setup = direction === 'LONG' ? 'LONG_SETUP' : 'SHORT_SETUP';
    missing = 'NONE';
    reclaimTimestamp = reclaimTimestamp ?? timestamp;
    controlShiftTimestamp = controlShiftTimestamp ?? timestamp;
    setupConfirmedTimestamp = setupConfirmedTimestamp ?? timestamp;
    alert = direction === 'LONG' ? 'LONG_SETUP_CONFIRMED' : 'SHORT_SETUP_CONFIRMED';
    interpretation = direction === 'LONG' ? 'Failure + reclaim + buyer control' : 'Failure + reclaim + seller control';
  }

  return {
    version: FAILURE_RECLAIM_VERSION,
    timestamp,
    machineState,
    setup,
    direction,
    referenceLevel: level,
    breakAttempt: effectiveBreak,
    failure,
    reclaim,
    controlShift: control,
    confidence: setup === 'WAIT' && machineState === 'NO_SETUP' ? 0 : confidence,
    components,
    missingConfirmation: missing,
    progress: {
      breakAttempt: effectiveBreak.confirmed || effectiveBreak.weak,
      failure: failure.detected,
      reclaim: reclaim.confirmed,
      controlShift: control.state === 'CONFIRMED' || control.state === 'FORMING',
      setup: setup === 'LONG_SETUP' || setup === 'SHORT_SETUP',
    },
    alert,
    interpretation,
    failureTimestamp,
    reclaimTimestamp,
    controlShiftTimestamp,
    setupConfirmedTimestamp,
    barsSinceFailure,
  };
}

export function evaluateFailureReclaim(input: EvaluateFailureReclaimInput): FailureReclaimSnapshot {
  const cfg = mergeFailureReclaimConfig(input.config);
  const { longLevel, shortLevel } = pickReferenceLevels(input.levels, input.bar.close, cfg);
  if (!longLevel && !shortLevel) return emptyFailureReclaim(input.timestamp);

  const longSnap = longLevel
    ? evaluateDirection({
        direction: 'LONG',
        level: longLevel,
        bar: input.bar,
        postFailureBars: input.postFailureBars ?? [],
        atr: input.atr,
        flow: input.flow,
        prior: input.prior?.direction === 'LONG' ? input.prior : null,
        cfg,
        timestamp: input.timestamp,
      })
    : emptyFailureReclaim(input.timestamp);

  const shortSnap = shortLevel
    ? evaluateDirection({
        direction: 'SHORT',
        level: shortLevel,
        bar: input.bar,
        postFailureBars: input.postFailureBars ?? [],
        atr: input.atr,
        flow: input.flow,
        prior: input.prior?.direction === 'SHORT' ? input.prior : null,
        cfg,
        timestamp: input.timestamp,
      })
    : emptyFailureReclaim(input.timestamp);

  // Prefer confirmed setup, then forming, then furthest progressed
  const rank = (s: FailureReclaimSnapshot): number => {
    if (s.setup === 'LONG_SETUP' || s.setup === 'SHORT_SETUP') return 500 + s.confidence;
    if (s.setup === 'LONG_FORMING' || s.setup === 'SHORT_FORMING') return 300 + s.confidence;
    if (s.machineState === 'FAILURE_DETECTED' || s.machineState === 'RECLAIM_FORMING') return 150 + s.confidence;
    if (s.machineState === 'BREAK_ATTEMPT') return 50 + s.confidence;
    if (s.machineState === 'INVALIDATED') return 20;
    return s.confidence;
  };

  return rank(longSnap) >= rank(shortSnap) ? longSnap : shortSnap;
}

export function failureReclaimBadge(snap: FailureReclaimSnapshot | null): string {
  if (!snap) return '';
  if (snap.setup === 'LONG_SETUP') return 'LONG FR';
  if (snap.setup === 'SHORT_SETUP') return 'SHORT FR';
  if (snap.setup === 'LONG_FORMING') return 'LONG FR…';
  if (snap.setup === 'SHORT_FORMING') return 'SHORT FR…';
  if (snap.machineState === 'RECLAIM_FORMING' || snap.machineState === 'RECLAIM_CONFIRMED') return 'RECLAIM';
  if (snap.machineState === 'FAILURE_DETECTED') return 'FAILURE';
  return '';
}

export function failureReclaimCard(snap: FailureReclaimSnapshot | null): string {
  if (!snap || snap.machineState === 'NO_SETUP') return '';
  const lvl = snap.referenceLevel;
  const lines = [
    'FAILURE + RECLAIM',
    lvl ? `Level ${lvl.type.replaceAll('_', ' ')} ${lvl.price}` : 'Level —',
    `Failure ${snap.failure.label.replaceAll('_', ' ')}${snap.failure.detected ? ' ✓' : ''}`,
    `Reclaim ${snap.reclaim.state.replaceAll('_', ' ')}${snap.reclaim.confirmed ? ' ✓' : ''}`,
    snap.direction === 'LONG'
      ? `Control BUYERS ${snap.controlShift.state}${snap.controlShift.state === 'CONFIRMED' ? ' ✓' : ' …'}`
      : snap.direction === 'SHORT'
        ? `Control SELLERS ${snap.controlShift.state}${snap.controlShift.state === 'CONFIRMED' ? ' ✓' : ' …'}`
        : 'Control —',
    `Setup ${snap.setup.replaceAll('_', ' ')}${snap.confidence ? ` · ${snap.confidence}%` : ''}`,
    snap.missingConfirmation !== 'NONE' ? `Need ${snap.missingConfirmation.replaceAll('_', ' ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
