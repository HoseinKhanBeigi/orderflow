import type {
  AbsorptionState,
  AggressionState,
  BreakoutState,
  ControlState,
  EffortResultState,
  ExpansionState,
  FailureState,
  LocationState,
  PriceResponseState,
  PrimaryLabel,
  ReclaimState,
  SequenceStages,
  SweepState,
} from './types.js';
import type { MarketSequenceConfig } from './config.js';

export const PRIMARY_LABEL_SHORT: Record<PrimaryLabel, string> = {
  NONE: '',
  SWEEP_H: 'SWEEP H',
  SWEEP_L: 'SWEEP L',
  BUY_EFFECTIVE: 'BUY EFF',
  SELL_EFFECTIVE: 'SELL EFF',
  BUY_ABS: 'BUY ABS',
  SELL_ABS: 'SELL ABS',
  BUY_FAIL: 'BUY FAIL',
  SELL_FAIL: 'SELL FAIL',
  BULL_RCLM: 'BULL RCLM',
  BEAR_RCLM: 'BEAR RCLM',
  BUY_CTRL: 'BUY CTRL',
  SELL_CTRL: 'SELL CTRL',
  BREAKOUT: 'BREAKOUT',
  BREAKDOWN: 'BREAKDOWN',
  BULL_EXP: 'BULL EXP',
  BEAR_EXP: 'BEAR EXP',
};

export const PRIMARY_LABEL_FULL: Record<PrimaryLabel, string> = {
  NONE: 'None',
  SWEEP_H: 'Sweep High',
  SWEEP_L: 'Sweep Low',
  BUY_EFFECTIVE: 'Buyers Effective',
  SELL_EFFECTIVE: 'Sellers Effective',
  BUY_ABS: 'Buyers Absorbed',
  SELL_ABS: 'Sellers Absorbed',
  BUY_FAIL: 'Buyer Failure',
  SELL_FAIL: 'Seller Failure',
  BULL_RCLM: 'Bullish Reclaim',
  BEAR_RCLM: 'Bearish Reclaim',
  BUY_CTRL: 'Buyer Control',
  SELL_CTRL: 'Seller Control',
  BREAKOUT: 'Breakout',
  BREAKDOWN: 'Breakdown',
  BULL_EXP: 'Bullish Expansion',
  BEAR_EXP: 'Bearish Expansion',
};

export interface LabelPick {
  label: PrimaryLabel;
  confidence: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  stage:
    | 'EXPANSION'
    | 'BREAKOUT'
    | 'BREAKDOWN'
    | 'CONTROL'
    | 'RECLAIM'
    | 'FAILURE'
    | 'ABSORPTION'
    | 'SWEEP'
    | 'EFFECTIVE'
    | 'IDLE';
}

/**
 * Priority (later confirmed stages win on the SAME candle):
 * 1 EXPANSION
 * 2 BREAKOUT / BREAKDOWN
 * 3 CONTROL
 * 4 RECLAIM
 * 5 FAILURE
 * 6 ABSORPTION
 * 7 SWEEP
 * 8 EFFECTIVE AGGRESSION
 * 9 NONE
 */
export function selectPrimaryLabel(
  stages: SequenceStages,
  cfg: MarketSequenceConfig,
): LabelPick {
  const {
    expansion,
    breakout,
    control,
    reclaim,
    failure,
    absorption,
    sweep,
    effortResult,
  } = stages;

  if (expansion === 'BULLISH_EXPANSION_CONFIRMED') {
    return { label: 'BULL_EXP', confidence: 88, bias: 'BULLISH', stage: 'EXPANSION' };
  }
  if (expansion === 'BEARISH_EXPANSION_CONFIRMED') {
    return { label: 'BEAR_EXP', confidence: 88, bias: 'BEARISH', stage: 'EXPANSION' };
  }
  if (expansion === 'BULLISH_EXPANSION_FORMING') {
    return { label: 'BULL_EXP', confidence: 68, bias: 'BULLISH', stage: 'EXPANSION' };
  }
  if (expansion === 'BEARISH_EXPANSION_FORMING') {
    return { label: 'BEAR_EXP', confidence: 68, bias: 'BEARISH', stage: 'EXPANSION' };
  }

  if (breakout === 'BREAKOUT_CONFIRMED' || breakout === 'BREAKOUT_FORMING') {
    return {
      label: 'BREAKOUT',
      confidence: breakout === 'BREAKOUT_CONFIRMED' ? 84 : 66,
      bias: 'BULLISH',
      stage: 'BREAKOUT',
    };
  }
  if (breakout === 'BREAKDOWN_CONFIRMED' || breakout === 'BREAKDOWN_FORMING') {
    return {
      label: 'BREAKDOWN',
      confidence: breakout === 'BREAKDOWN_CONFIRMED' ? 84 : 66,
      bias: 'BEARISH',
      stage: 'BREAKDOWN',
    };
  }

  if (control === 'BUYER_CONTROL_SHIFT') {
    return { label: 'BUY_CTRL', confidence: 80, bias: 'BULLISH', stage: 'CONTROL' };
  }
  if (control === 'SELLER_CONTROL_SHIFT') {
    return { label: 'SELL_CTRL', confidence: 80, bias: 'BEARISH', stage: 'CONTROL' };
  }

  if (
    reclaim === 'ACCEPTED_RECLAIM' ||
    reclaim === 'CLOSE_RECLAIM' ||
    reclaim === 'BODY_RECLAIM' ||
    reclaim === 'WICK_RECLAIM'
  ) {
    // Direction from failure / sweep context encoded in stages.
    if (failure.startsWith('SELLER') || sweep === 'SWEEP_LOW') {
      return {
        label: 'BULL_RCLM',
        confidence: reclaim === 'WICK_RECLAIM' ? 62 : 82,
        bias: 'BULLISH',
        stage: 'RECLAIM',
      };
    }
    if (failure.startsWith('BUYER') || sweep === 'SWEEP_HIGH') {
      return {
        label: 'BEAR_RCLM',
        confidence: reclaim === 'WICK_RECLAIM' ? 62 : 82,
        bias: 'BEARISH',
        stage: 'RECLAIM',
      };
    }
  }

  if (failure === 'BUYER_FAILURE_CONFIRMED') {
    return { label: 'BUY_FAIL', confidence: 86, bias: 'BEARISH', stage: 'FAILURE' };
  }
  if (failure === 'SELLER_FAILURE_CONFIRMED') {
    return { label: 'SELL_FAIL', confidence: 86, bias: 'BULLISH', stage: 'FAILURE' };
  }
  if (failure === 'BUYER_FAILURE_FORMING') {
    return { label: 'BUY_FAIL', confidence: 64, bias: 'BEARISH', stage: 'FAILURE' };
  }
  if (failure === 'SELLER_FAILURE_FORMING') {
    return { label: 'SELL_FAIL', confidence: 64, bias: 'BULLISH', stage: 'FAILURE' };
  }

  if (absorption === 'BUYER_ABSORPTION') {
    return { label: 'BUY_ABS', confidence: 80, bias: 'BEARISH', stage: 'ABSORPTION' };
  }
  if (absorption === 'SELLER_ABSORPTION') {
    return { label: 'SELL_ABS', confidence: 80, bias: 'BULLISH', stage: 'ABSORPTION' };
  }
  if (absorption === 'POSSIBLE_BUYER_ABSORPTION') {
    return { label: 'BUY_ABS', confidence: 58, bias: 'BEARISH', stage: 'ABSORPTION' };
  }
  if (absorption === 'POSSIBLE_SELLER_ABSORPTION') {
    return { label: 'SELL_ABS', confidence: 58, bias: 'BULLISH', stage: 'ABSORPTION' };
  }

  if (sweep === 'SWEEP_HIGH') {
    return { label: 'SWEEP_H', confidence: 74, bias: 'BEARISH', stage: 'SWEEP' };
  }
  if (sweep === 'SWEEP_LOW') {
    return { label: 'SWEEP_L', confidence: 74, bias: 'BULLISH', stage: 'SWEEP' };
  }

  if (effortResult === 'BUYERS_EFFECTIVE') {
    return { label: 'BUY_EFFECTIVE', confidence: 70, bias: 'BULLISH', stage: 'EFFECTIVE' };
  }
  if (effortResult === 'SELLERS_EFFECTIVE') {
    return { label: 'SELL_EFFECTIVE', confidence: 70, bias: 'BEARISH', stage: 'EFFECTIVE' };
  }

  void cfg;
  return { label: 'NONE', confidence: 0, bias: 'NEUTRAL', stage: 'IDLE' };
}

export function emptyStages(): SequenceStages {
  return {
    location: 'NONE',
    sweep: 'NO_SWEEP',
    aggression: 'UNCLEAR',
    response: 'NO_MEANINGFUL_RESPONSE',
    effortResult: 'UNCLEAR',
    absorption: 'NONE',
    failure: 'NO_FAILURE',
    reclaim: 'NO_RECLAIM',
    control: 'NO_CONTROL_SHIFT',
    breakout: 'NO_STRUCTURAL_BREAK',
    expansion: 'NO_EXPANSION',
  };
}

export function deriveEffortResult(
  buyEffort: number,
  sellEffort: number,
  upResult: number,
  downResult: number,
  cfg: MarketSequenceConfig,
): EffortResultState {
  if (buyEffort >= cfg.effortHigh && upResult >= cfg.resultStrong) return 'BUYERS_EFFECTIVE';
  if (buyEffort >= cfg.effortHigh && upResult <= cfg.resultWeak) return 'BUYERS_INEFFECTIVE';
  if (sellEffort >= cfg.effortHigh && downResult >= cfg.resultStrong) return 'SELLERS_EFFECTIVE';
  if (sellEffort >= cfg.effortHigh && downResult <= cfg.resultWeak) return 'SELLERS_INEFFECTIVE';
  return 'UNCLEAR';
}

export type {
  LocationState,
  SweepState,
  AggressionState,
  PriceResponseState,
  AbsorptionState,
  FailureState,
  ReclaimState,
  ControlState,
  BreakoutState,
  ExpansionState,
};
