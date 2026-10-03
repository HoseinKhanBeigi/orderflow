/**
 * Market Sequence Interpretation Engine — orchestrates existing modules.
 *
 * WHERE → SWEEP → AGGRESSION → RESPONSE → ABSORPTION → FAILURE → RECLAIM → CONTROL → BREAKOUT → EXPANSION
 *
 * Does NOT recompute delta/CVD/displacement/FR/absorption formulas.
 * Consumes SequenceStageInput (normalized adapters).
 * One primary label per candle. No backfill. No lookahead.
 */

import { mergeMarketSequenceConfig, type MarketSequenceConfig } from './config.js';
import { deriveEffortFromInput } from './adapters.js';
import {
  PRIMARY_LABEL_FULL,
  PRIMARY_LABEL_SHORT,
  emptyStages,
  selectPrimaryLabel,
} from './label-selector.js';
import { SequenceStore } from './sequence-store.js';
import type {
  ActiveSequence,
  BreakoutState,
  CandleSequenceAnnotation,
  CurrentStage,
  ExpansionState,
  SequenceDirection,
  SequenceStageInput,
  SequenceStages,
} from './types.js';
import { MARKET_SEQUENCE_VERSION } from './types.js';

export { MARKET_SEQUENCE_VERSION };

function directionFromSweep(sweep: SequenceStageInput['sweep']['state']): SequenceDirection {
  if (sweep === 'SWEEP_LOW') return 'BULLISH'; // reversal bias after low sweep
  if (sweep === 'SWEEP_HIGH') return 'BEARISH';
  return 'NONE';
}

function mergeStages(input: SequenceStageInput, cfg: MarketSequenceConfig, prev?: SequenceStages): SequenceStages {
  const effortResult = deriveEffortFromInput(input, cfg);
  const fr = input.failureReclaim;

  let breakout: BreakoutState = input.structuralBreak ?? prev?.breakout ?? 'NO_STRUCTURAL_BREAK';
  const absorbed =
    input.absorption.state === 'BUYER_ABSORPTION' ||
    input.absorption.state === 'SELLER_ABSORPTION' ||
    input.absorption.state === 'POSSIBLE_BUYER_ABSORPTION' ||
    input.absorption.state === 'POSSIBLE_SELLER_ABSORPTION' ||
    effortResult === 'BUYERS_INEFFECTIVE' ||
    effortResult === 'SELLERS_INEFFECTIVE';

  // Structural acceptance only when aggression is EFFECTIVE (not absorbed).
  if (!absorbed) {
    if (
      input.sweep.state === 'SWEEP_HIGH' &&
      effortResult === 'BUYERS_EFFECTIVE' &&
      input.priceResponse.state === 'UP_RESPONSE_STRONG'
    ) {
      breakout = 'BREAKOUT_CONFIRMED';
    } else if (
      input.sweep.state === 'SWEEP_LOW' &&
      effortResult === 'SELLERS_EFFECTIVE' &&
      input.priceResponse.state === 'DOWN_RESPONSE_STRONG'
    ) {
      breakout = 'BREAKDOWN_CONFIRMED';
    } else if (
      input.sweep.state === 'SWEEP_HIGH' &&
      effortResult === 'BUYERS_EFFECTIVE' &&
      input.priceResponse.state.startsWith('UP_')
    ) {
      if (breakout === 'NO_STRUCTURAL_BREAK') breakout = 'BREAKOUT_FORMING';
    } else if (
      input.sweep.state === 'SWEEP_LOW' &&
      effortResult === 'SELLERS_EFFECTIVE' &&
      input.priceResponse.state.startsWith('DOWN_')
    ) {
      if (breakout === 'NO_STRUCTURAL_BREAK') breakout = 'BREAKDOWN_FORMING';
    }
  }

  return {
    location: input.structure.location,
    sweep: input.sweep.state !== 'NO_SWEEP' ? input.sweep.state : prev?.sweep ?? 'NO_SWEEP',
    aggression: input.aggression.side,
    response: input.priceResponse.state,
    effortResult,
    absorption:
      input.absorption.state !== 'NONE' ? input.absorption.state : prev?.absorption ?? 'NONE',
    failure: fr?.failureState && fr.failureState !== 'NO_FAILURE'
      ? fr.failureState
      : prev?.failure ?? 'NO_FAILURE',
    reclaim: fr?.reclaimState && fr.reclaimState !== 'NO_RECLAIM'
      ? fr.reclaimState
      : prev?.reclaim ?? 'NO_RECLAIM',
    control: fr?.controlShiftState && fr.controlShiftState !== 'NO_CONTROL_SHIFT'
      ? fr.controlShiftState
      : prev?.control ?? 'NO_CONTROL_SHIFT',
    breakout,
    expansion: prev?.expansion ?? 'NO_EXPANSION',
  };
}

function currentStageOf(stages: SequenceStages): CurrentStage {
  if (stages.expansion.includes('CONFIRMED') || stages.expansion.includes('FORMING')) return 'EXPANSION';
  if (stages.breakout.startsWith('BREAKOUT')) return 'BREAKOUT';
  if (stages.breakout.startsWith('BREAKDOWN')) return 'BREAKDOWN';
  if (stages.control !== 'NO_CONTROL_SHIFT') return 'CONTROL';
  if (stages.reclaim !== 'NO_RECLAIM' && stages.reclaim !== 'RECLAIM_FAILED') return 'RECLAIM';
  if (stages.failure !== 'NO_FAILURE') return 'FAILURE';
  if (stages.absorption !== 'NONE') return 'ABSORPTION';
  if (stages.sweep !== 'NO_SWEEP') return 'SWEEP';
  if (stages.location !== 'NONE' && stages.location !== 'MID_RANGE') return 'LOCATION';
  return 'IDLE';
}

function stageRank(stage: CurrentStage): number {
  const order: CurrentStage[] = [
    'IDLE',
    'LOCATION',
    'SWEEP',
    'AGGRESSION',
    'RESPONSE',
    'ABSORPTION',
    'FAILURE',
    'RECLAIM',
    'CONTROL',
    'BREAKOUT',
    'BREAKDOWN',
    'EXPANSION',
  ];
  return order.indexOf(stage);
}

function updateExpansion(
  stages: SequenceStages,
  input: SequenceStageInput,
  cfg: MarketSequenceConfig,
  prevStage?: CurrentStage,
): ExpansionState {
  // Expansion is a FOLLOWING stage — not same-candle as first control confirm.
  const hadControl =
    prevStage === 'CONTROL' ||
    prevStage === 'BREAKOUT' ||
    prevStage === 'BREAKDOWN' ||
    prevStage === 'EXPANSION';

  const afterReclaimControl =
    (stages.reclaim === 'ACCEPTED_RECLAIM' ||
      stages.reclaim === 'CLOSE_RECLAIM' ||
      stages.reclaim === 'BODY_RECLAIM') &&
    stages.control !== 'NO_CONTROL_SHIFT';

  const afterBreakout = stages.breakout === 'BREAKOUT_CONFIRMED' || stages.breakout === 'BREAKDOWN_CONFIRMED';

  if (!hadControl) {
    // Allow forming only after control already existed previously.
    return stages.expansion;
  }

  if (!afterReclaimControl && !afterBreakout && stages.expansion === 'NO_EXPANSION') {
    return 'NO_EXPANSION';
  }

  const disp = input.priceResponse.displacementBps;
  if (stages.control === 'BUYER_CONTROL_SHIFT' || stages.breakout === 'BREAKOUT_CONFIRMED') {
    if (disp >= cfg.expansionDispBps && input.aggression.buyEffort >= cfg.effortHigh * 0.75) {
      return 'BULLISH_EXPANSION_CONFIRMED';
    }
    if (disp > 0) return 'BULLISH_EXPANSION_FORMING';
  }
  if (stages.control === 'SELLER_CONTROL_SHIFT' || stages.breakout === 'BREAKDOWN_CONFIRMED') {
    if (disp <= -cfg.expansionDispBps && input.aggression.sellEffort >= cfg.effortHigh * 0.75) {
      return 'BEARISH_EXPANSION_CONFIRMED';
    }
    if (disp < 0) return 'BEARISH_EXPANSION_FORMING';
  }
  return stages.expansion;
}

/**
 * Process one candle against the sequence store.
 * Returns a frozen annotation for THIS candle only (no mutation of prior candles).
 */
export function processSequenceCandle(
  store: SequenceStore,
  input: SequenceStageInput,
  cfgPartial?: Partial<MarketSequenceConfig>,
): CandleSequenceAnnotation {
  const cfg = mergeMarketSequenceConfig(cfgPartial);
  const ref = input.structure.primaryReference;
  const symbol = input.symbol;
  const timeframe = input.timeframe;

  // Expire / invalidate existing sequences for this symbol+tf
  for (const seq of store.allFor(symbol, timeframe)) {
    seq.barsAlive += 1;
    seq.barsSinceProgress += 1;
    if (input.failureReclaim?.invalidated) {
      seq.status = 'INVALIDATED';
      seq.currentStage = 'INVALIDATED';
    } else if (
      seq.barsSinceProgress > cfg.maxBarsBetweenStages ||
      seq.barsAlive > cfg.maxSequenceBars
    ) {
      seq.status = 'EXPIRED';
      seq.currentStage = 'EXPIRED';
    }
    if (seq.status === 'INVALIDATED' || seq.status === 'EXPIRED') {
      store.delete(symbol, timeframe, seq.referenceLevelId);
    }
  }

  let active: ActiveSequence | undefined =
    ref != null ? store.get(symbol, timeframe, ref.id) : undefined;

  // Start sequence only on meaningful structure + sweep (or FR break)
  const shouldStart =
    !active &&
    ref != null &&
    input.sweep.state !== 'NO_SWEEP' &&
    input.structure.location !== 'NONE' &&
    input.structure.location !== 'MID_RANGE';

  if (shouldStart && ref) {
    active = store.create({
      symbol,
      timeframe,
      referenceLevelId: ref.id,
      referenceLevelType: ref.type,
      referencePrice: ref.price,
      startedAt: input.timestamp,
      direction: directionFromSweep(input.sweep.state),
    });
  }

  let stages = mergeStages(input, cfg, active?.stages);
  const prevStage = active?.currentStage;
  stages = { ...stages, expansion: updateExpansion(stages, input, cfg, prevStage) };

  // Successful breakout path: clear absorption/failure/reclaim noise for THIS candle's stages
  // when structural acceptance is confirmed without ineffective effort.
  if (
    (stages.breakout === 'BREAKOUT_CONFIRMED' || stages.breakout === 'BREAKDOWN_CONFIRMED') &&
    (stages.effortResult === 'BUYERS_EFFECTIVE' || stages.effortResult === 'SELLERS_EFFECTIVE')
  ) {
    stages = {
      ...stages,
      absorption: 'NONE',
      failure: 'NO_FAILURE',
      reclaim: 'NO_RECLAIM',
    };
  }

  const stage = currentStageOf(stages);
  const pick = selectPrimaryLabel(stages, cfg);

  if (active) {
    const prevRank = stageRank(active.currentStage);
    const nextRank = stageRank(stage);
    if (nextRank > prevRank) active.barsSinceProgress = 0;
    active.stages = stages;
    active.currentStage = stage;
    active.lastUpdatedAt = input.timestamp;
    active.direction =
      pick.bias === 'NEUTRAL' ? active.direction : pick.bias === 'BULLISH' ? 'BULLISH' : 'BEARISH';
    if (
      stages.expansion === 'BULLISH_EXPANSION_CONFIRMED' ||
      stages.expansion === 'BEARISH_EXPANSION_CONFIRMED'
    ) {
      active.status = 'CONFIRMED';
    }
    store.set(active, symbol, timeframe);
  }

  return {
    candleTimestamp: input.timestamp,
    symbol,
    timeframe,
    sequenceId: active?.sequenceId ?? null,
    referenceLevelId: active?.referenceLevelId ?? ref?.id ?? null,
    stages: active ? { ...active.stages } : stages,
    currentStage: stage,
    primaryLabel: pick.label,
    primaryShort: PRIMARY_LABEL_SHORT[pick.label],
    primaryFull: PRIMARY_LABEL_FULL[pick.label],
    labelConfidence: pick.confidence,
    labelStatus: input.incomplete ? 'PROVISIONAL' : 'CONFIRMED',
    bias: pick.bias,
    delta: input.aggression.delta,
    cvd: input.aggression.cvd,
    displacementBps: input.priceResponse.displacementBps,
  };
}

/**
 * Replay a list of stage inputs oldest → newest.
 * Each annotation is immutable afterward (no backfill).
 */
export function annotateSequenceReplay(
  inputs: SequenceStageInput[],
  cfgPartial?: Partial<MarketSequenceConfig>,
): CandleSequenceAnnotation[] {
  const cfg = mergeMarketSequenceConfig(cfgPartial);
  const store = new SequenceStore(cfg);
  return inputs.map((input) => processSequenceCandle(store, input, cfg));
}

export function sequenceAnnotationTooltip(a: CandleSequenceAnnotation): string {
  const s = a.stages;
  return [
    `${a.primaryFull}${a.labelStatus === 'PROVISIONAL' ? ' (live)' : ''}`,
    '',
    `Location: ${s.location}`,
    a.referenceLevelId ? `Reference: ${a.referenceLevelId}` : null,
    a.sequenceId ? `Sequence: ${a.sequenceId}` : null,
    `Sweep: ${s.sweep}`,
    `Aggression: ${s.aggression}`,
    `Delta: ${a.delta >= 0 ? '+' : ''}${Math.round(a.delta)}`,
    `CVD: ${a.cvd >= 0 ? '+' : ''}${Math.round(a.cvd)}`,
    `Displacement: ${a.displacementBps >= 0 ? '+' : ''}${a.displacementBps.toFixed(1)} bp`,
    `Response: ${s.response}`,
    `Effort/Result: ${s.effortResult}`,
    `Absorption: ${s.absorption}`,
    `Failure: ${s.failure}`,
    `Reclaim: ${s.reclaim}`,
    `Control: ${s.control}`,
    `Breakout: ${s.breakout}`,
    `Expansion: ${s.expansion}`,
    `Stage: ${a.currentStage}`,
    `Confidence: ${a.labelConfidence}%`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function labelBiasColor(
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  provisional = false,
): string {
  if (bias === 'BULLISH') return provisional ? '#86efac' : '#22c55e';
  if (bias === 'BEARISH') return provisional ? '#fca5a5' : '#ef4444';
  return provisional ? '#94a3b8' : '#8b949e';
}

export function createSequenceStore(cfgPartial?: Partial<MarketSequenceConfig>): SequenceStore {
  return new SequenceStore(mergeMarketSequenceConfig(cfgPartial));
}

export { emptyStages };
