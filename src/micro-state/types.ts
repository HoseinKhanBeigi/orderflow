/**
 * Secondary micro-state labels — what price did during this candle.
 * Primary market-sequence label remains separate and always renders first.
 */

export const MICRO_STATE_VERSION = 'MICRO_STATE_V1';

export type MicroStateLabel =
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'CONT_UP'
  | 'CONT_DOWN'
  | 'BUYER_NO_PROGRESS'
  | 'SELLER_NO_PROGRESS'
  | 'REJECT_UP'
  | 'REJECT_DOWN'
  | 'ACCEPT_UP'
  | 'ACCEPT_DOWN';

export type MicroLabelStatus = 'PROVISIONAL' | 'CONFIRMED';

export type MicroReferenceKind =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'SUPPORT'
  | 'RESISTANCE'
  | 'LIQUIDITY_ZONE'
  | 'BREAKOUT_LEVEL'
  | 'NONE';

export interface MicroReference {
  kind: MicroReferenceKind;
  price: number;
  zoneLow?: number;
  zoneHigh?: number;
  id?: string;
}

export interface MicroBarInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Aggressive buy notional (quote). */
  aggressiveBuy: number;
  /** Aggressive sell notional (quote). */
  aggressiveSell: number;
  delta: number;
  displacementBps: number;
  bodyEfficiency: number;
  incomplete?: boolean;
  /** Optional precomputed effort 0–100. */
  buyEffort?: number;
  sellEffort?: number;
  /** Optional precomputed result 0–100. */
  upResult?: number;
  downResult?: number;
  /** Nearest structural references known at this candle (no lookahead). */
  references?: MicroReference[];
  /** Optional acceptance hints from structure / FR / hist-SR engines. */
  acceptanceHint?: 'ACCEPT_UP' | 'ACCEPT_DOWN' | null;
  /** Optional rejection hints from structure / fail engines. */
  rejectionHint?: 'REJECT_UP' | 'REJECT_DOWN' | null;
  /**
   * Prior directional context for CONT (from previous confirmed annotation).
   * UP = prior bullish move/control/expansion; DOWN = bearish.
   */
  priorDirection?: 'UP' | 'DOWN' | 'NONE';
}

export interface MicroCandidate {
  label: MicroStateLabel;
  score: number;
  detail: Record<string, string | number | boolean | null>;
}

export interface CandleMicroStateAnnotation {
  time: number;
  secondaryLabels: MicroStateLabel[];
  secondaryShort: string[];
  status: MicroLabelStatus;
  candidates: MicroCandidate[];
  tooltips: Partial<Record<MicroStateLabel, string>>;
}

export const MICRO_LABEL_SHORT: Record<MicroStateLabel, string> = {
  MOVE_UP: 'MOVE ↑',
  MOVE_DOWN: 'MOVE ↓',
  CONT_UP: 'CONT ↑',
  CONT_DOWN: 'CONT ↓',
  BUYER_NO_PROGRESS: 'BUYER NP',
  SELLER_NO_PROGRESS: 'SELLER NP',
  REJECT_UP: 'REJECT ↑',
  REJECT_DOWN: 'REJECT ↓',
  ACCEPT_UP: 'ACCEPT ↑',
  ACCEPT_DOWN: 'ACCEPT ↓',
};

export const MICRO_LABEL_PRIORITY: Record<MicroStateLabel, number> = {
  ACCEPT_UP: 100,
  ACCEPT_DOWN: 100,
  REJECT_UP: 90,
  REJECT_DOWN: 90,
  BUYER_NO_PROGRESS: 80,
  SELLER_NO_PROGRESS: 80,
  CONT_UP: 70,
  CONT_DOWN: 70,
  MOVE_UP: 60,
  MOVE_DOWN: 60,
};
