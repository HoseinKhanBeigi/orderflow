/**
 * Adapters: normalize existing engine outputs into SequenceStageInput.
 * No second formulas for delta/CVD/displacement/FR/absorption.
 */

import { computeDisplacement } from '../footprint/displacement-cvd.js';
import type { MarketSequenceConfig } from './config.js';
import { deriveEffortResult } from './label-selector.js';
import type {
  AbsorptionState,
  AggressionState,
  BreakoutState,
  ControlState,
  FailureState,
  LocationState,
  PriceResponseState,
  ReclaimState,
  ReferenceLevelRef,
  SequenceStageInput,
  SweepState,
} from './types.js';

/** Minimal FR snapshot shape — avoids hard-dep when failure-reclaim is absent. */
export interface FailureReclaimSnapshot {
  failure?: {
    detected?: boolean;
    label?: string;
  };
  reclaim?: {
    state?: string;
  };
  controlShift?: {
    state?: string;
    buyerControl?: number | null;
    sellerControl?: number | null;
  };
  direction?: 'LONG' | 'SHORT' | 'NONE' | string;
  setup?: string;
  machineState?: string;
  progress?: {
    failure?: boolean;
  };
}

export interface RawBarLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  totalBuy?: number;
  totalSell?: number;
  aggressiveBuy?: number;
  aggressiveSell?: number;
}

export function normalizeAbsorptionName(
  raw: string | null | undefined,
): AbsorptionState {
  if (!raw) return 'NONE';
  const s = String(raw).toUpperCase();
  // Canonical: BUYER_ABSORPTION = aggressive buyers absorbed
  if (s === 'BUYER_ABSORPTION' || s === 'BUYERS_ABSORBED' || s === 'POSSIBLE_BUYER_ABSORPTION') {
    return s.includes('POSSIBLE') ? 'POSSIBLE_BUYER_ABSORPTION' : 'BUYER_ABSORPTION';
  }
  if (s === 'SELLER_ABSORPTION' || s === 'SELLERS_ABSORBED' || s === 'POSSIBLE_SELLER_ABSORPTION') {
    return s.includes('POSSIBLE') ? 'POSSIBLE_SELLER_ABSORPTION' : 'SELLER_ABSORPTION';
  }
  // Legacy LR naming: BUY_ABSORPTION meant passive buys absorbing sells (= SELLER_ABSORPTION)
  if (s === 'BUY_ABSORPTION' || s === 'SELL_ABSORPTION') {
    return s === 'BUY_ABSORPTION' ? 'SELLER_ABSORPTION' : 'BUYER_ABSORPTION';
  }
  return 'NONE';
}

export function mapFailureFromFr(fr?: FailureReclaimSnapshot | null): FailureState {
  if (!fr?.failure?.detected) return 'NO_FAILURE';
  const label = fr.failure.label;
  if (label === 'BUYER_FAILURE') {
    return fr.progress?.failure ? 'BUYER_FAILURE_CONFIRMED' : 'BUYER_FAILURE_FORMING';
  }
  if (label === 'SELLER_FAILURE') {
    return fr.progress?.failure ? 'SELLER_FAILURE_CONFIRMED' : 'SELLER_FAILURE_FORMING';
  }
  return 'NO_FAILURE';
}

export function mapReclaimFromFr(fr?: FailureReclaimSnapshot | null): ReclaimState {
  if (!fr) return 'NO_RECLAIM';
  return (fr.reclaim?.state as ReclaimState) || 'NO_RECLAIM';
}

export function mapControlFromFr(fr?: FailureReclaimSnapshot | null): ControlState {
  if (!fr) return 'NO_CONTROL_SHIFT';
  if (fr.controlShift?.state === 'CONFIRMED') {
    return fr.direction === 'LONG' ? 'BUYER_CONTROL_SHIFT' : fr.direction === 'SHORT' ? 'SELLER_CONTROL_SHIFT' : 'NO_CONTROL_SHIFT';
  }
  if (fr.controlShift?.state === 'FORMING') {
    return fr.direction === 'LONG' ? 'BUYER_CONTROL_SHIFT' : fr.direction === 'SHORT' ? 'SELLER_CONTROL_SHIFT' : 'NO_CONTROL_SHIFT';
  }
  return 'NO_CONTROL_SHIFT';
}

export function aggressionSide(
  delta: number,
  vol: number,
  dominance = 0.18,
): AggressionState {
  if (vol <= 0) return 'UNCLEAR';
  const r = delta / vol;
  if (r >= dominance) return 'BUYERS_AGGRESSIVE';
  if (r <= -dominance) return 'SELLERS_AGGRESSIVE';
  if (Math.abs(r) < dominance * 0.35) return 'BALANCED';
  return 'UNCLEAR';
}

export function priceResponseState(
  dispBps: number,
  bodyEff: number,
  neutral = 2,
): PriceResponseState {
  const strong = Math.abs(dispBps) >= neutral * 4 && bodyEff >= 0.35;
  if (dispBps > neutral) return strong ? 'UP_RESPONSE_STRONG' : 'UP_RESPONSE_WEAK';
  if (dispBps < -neutral) return strong ? 'DOWN_RESPONSE_STRONG' : 'DOWN_RESPONSE_WEAK';
  return 'NO_MEANINGFUL_RESPONSE';
}

export function resultScore(dispBps: number, dir: 'UP' | 'DOWN', neutral = 2): number {
  const raw = dir === 'UP' ? dispBps : -dispBps;
  if (raw <= 0) return Math.max(0, 20 + raw);
  return Math.min(100, Math.round((raw / Math.max(neutral * 8, 1)) * 100));
}

export function effortScores(
  buy: number,
  sell: number,
  delta: number,
): { buyEffort: number; sellEffort: number } {
  const vol = buy + sell;
  if (vol <= 0) return { buyEffort: 0, sellEffort: 0 };
  const dAmp = Math.min(1, Math.abs(delta) / vol) * 40;
  return {
    buyEffort: Math.round(Math.min(100, (buy / vol) * 70 + (delta > 0 ? dAmp : 0))),
    sellEffort: Math.round(Math.min(100, (sell / vol) * 70 + (delta < 0 ? dAmp : 0))),
  };
}

/**
 * Build a stage input from already-computed metrics (preferred path).
 */
export function buildStageInput(args: {
  timestamp: number;
  symbol: string;
  timeframe: string;
  incomplete?: boolean;
  reference: ReferenceLevelRef | null;
  location: LocationState;
  confluence?: string[];
  sweep: SweepState;
  aggressiveBuy: number;
  aggressiveSell: number;
  delta: number;
  cvd: number;
  displacementBps: number;
  bodyEfficiency: number;
  absorptionRaw?: string | null;
  absorptionConfidence?: number;
  failureReclaim?: FailureReclaimSnapshot | null;
  askDefense?: number | null;
  bidDefense?: number | null;
  buyerControl?: number | null;
  sellerControl?: number | null;
  structuralBreak?: BreakoutState;
  cfg: MarketSequenceConfig;
}): SequenceStageInput {
  const vol = args.aggressiveBuy + args.aggressiveSell;
  const { buyEffort, sellEffort } = effortScores(args.aggressiveBuy, args.aggressiveSell, args.delta);
  const upResult = resultScore(args.displacementBps, 'UP');
  const downResult = resultScore(args.displacementBps, 'DOWN');
  const response = priceResponseState(args.displacementBps, args.bodyEfficiency);
  const side = aggressionSide(args.delta, vol);

  let absorption = normalizeAbsorptionName(args.absorptionRaw);
  // If no external absorption, derive POSSIBLE from effort/result (not a second absorption engine —
  // only when AbsorpEngine silent; prefers FR absorption boosts when present).
  if (absorption === 'NONE') {
    if (buyEffort >= args.cfg.effortHigh && upResult <= args.cfg.resultWeak) {
      absorption = 'POSSIBLE_BUYER_ABSORPTION';
    } else if (sellEffort >= args.cfg.effortHigh && downResult <= args.cfg.resultWeak) {
      absorption = 'POSSIBLE_SELLER_ABSORPTION';
    }
  }

  const fr = args.failureReclaim ?? null;

  return {
    timestamp: args.timestamp,
    symbol: args.symbol,
    timeframe: args.timeframe,
    incomplete: args.incomplete,
    structure: {
      primaryReference: args.reference,
      location: args.location,
      confluence: args.confluence,
    },
    sweep: {
      state: args.sweep,
      referenceLevelId: args.reference?.id ?? null,
    },
    aggression: {
      aggressiveBuy: args.aggressiveBuy,
      aggressiveSell: args.aggressiveSell,
      delta: args.delta,
      cvd: args.cvd,
      buyEffort,
      sellEffort,
      side,
    },
    priceResponse: {
      displacementBps: args.displacementBps,
      bodyEfficiency: args.bodyEfficiency,
      upResult,
      downResult,
      state: response,
    },
    passiveDefense: {
      askDefense: args.askDefense ?? null,
      bidDefense: args.bidDefense ?? null,
    },
    absorption: {
      state: absorption,
      confidence: args.absorptionConfidence ?? (absorption.includes('POSSIBLE') ? 55 : absorption === 'NONE' ? 0 : 75),
    },
    failureReclaim: fr
      ? {
          failureState: mapFailureFromFr(fr),
          reclaimState: mapReclaimFromFr(fr),
          controlShiftState: mapControlFromFr(fr),
          setupState: fr.setup,
          invalidated: fr.machineState === 'INVALIDATED' || fr.machineState === 'EXPIRED',
        }
      : undefined,
    battle: {
      buyerControl: args.buyerControl ?? fr?.controlShift?.buyerControl ?? null,
      sellerControl: args.sellerControl ?? fr?.controlShift?.sellerControl ?? null,
    },
    structuralBreak: args.structuralBreak ?? 'NO_STRUCTURAL_BREAK',
  };
}

/** Convenience: displacement metrics from a raw bar (reuses footprint helper). */
export function displacementFromBar(bar: RawBarLike) {
  return computeDisplacement(bar);
}

export function deriveEffortFromInput(input: SequenceStageInput, cfg: MarketSequenceConfig) {
  return deriveEffortResult(
    input.aggression.buyEffort,
    input.aggression.sellEffort,
    input.priceResponse.upResult,
    input.priceResponse.downResult,
    cfg,
  );
}
