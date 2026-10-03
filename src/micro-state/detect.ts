import type { MicroStateConfig } from './config.js';
import type {
  MicroBarInput,
  MicroCandidate,
  MicroReference,
  MicroStateLabel,
} from './types.js';

function effortScores(buy: number, sell: number, delta: number): { buyEffort: number; sellEffort: number } {
  const vol = buy + sell;
  if (vol <= 0) return { buyEffort: 0, sellEffort: 0 };
  const dAmp = Math.min(1, Math.abs(delta) / vol) * 40;
  return {
    buyEffort: Math.round(Math.min(100, (buy / vol) * 70 + (delta > 0 ? dAmp : 0))),
    sellEffort: Math.round(Math.min(100, (sell / vol) * 70 + (delta < 0 ? dAmp : 0))),
  };
}

function resultScore(dispBps: number, dir: 'UP' | 'DOWN', neutral = 2): number {
  const raw = dir === 'UP' ? dispBps : -dispBps;
  if (raw <= 0) return Math.max(0, 20 + raw);
  return Math.min(100, Math.round((raw / Math.max(neutral * 8, 1)) * 100));
}

function refMid(ref: MicroReference): number {
  if (ref.zoneLow != null && ref.zoneHigh != null) return (ref.zoneLow + ref.zoneHigh) / 2;
  return ref.price;
}

function refHigh(ref: MicroReference): number {
  return ref.zoneHigh ?? ref.price;
}

function refLow(ref: MicroReference): number {
  return ref.zoneLow ?? ref.price;
}

function bpsFrom(open: number, dist: number): number {
  if (!(open > 0) || !Number.isFinite(dist)) return 0;
  return (dist / open) * 10_000;
}

function isHighSideRef(kind: MicroReference['kind']): boolean {
  return kind === 'SWING_HIGH' || kind === 'RESISTANCE' || kind === 'BREAKOUT_LEVEL' || kind === 'LIQUIDITY_ZONE';
}

function isLowSideRef(kind: MicroReference['kind']): boolean {
  return kind === 'SWING_LOW' || kind === 'SUPPORT' || kind === 'BREAKOUT_LEVEL' || kind === 'LIQUIDITY_ZONE';
}

export function detectMove(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate | null {
  const disp = bar.displacementBps;
  const body = bar.bodyEfficiency;
  if (!Number.isFinite(disp) || body < cfg.moveMinBodyEfficiency) return null;
  if (disp >= cfg.moveMinBps) {
    return {
      label: 'MOVE_UP',
      score: Math.min(100, Math.abs(disp)),
      detail: {
        displacementBps: +disp.toFixed(2),
        bodyEfficiency: +body.toFixed(3),
        thresholdBps: cfg.moveMinBps,
      },
    };
  }
  if (disp <= -cfg.moveMinBps) {
    return {
      label: 'MOVE_DOWN',
      score: Math.min(100, Math.abs(disp)),
      detail: {
        displacementBps: +disp.toFixed(2),
        bodyEfficiency: +body.toFixed(3),
        thresholdBps: cfg.moveMinBps,
      },
    };
  }
  return null;
}

export function detectContinuation(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate | null {
  const prior = bar.priorDirection ?? 'NONE';
  if (prior === 'NONE') return null;
  const disp = bar.displacementBps;
  const open = bar.open;
  const holdsAbove = bar.close >= open && bar.low >= Math.min(open, bar.close) - Math.abs(bar.high - bar.low) * 0.15;
  const holdsBelow = bar.close <= open && bar.high <= Math.max(open, bar.close) + Math.abs(bar.high - bar.low) * 0.15;

  if (prior === 'UP' && disp >= cfg.contMinBps && bar.close >= bar.open && holdsAbove) {
    return {
      label: 'CONT_UP',
      score: Math.min(100, Math.abs(disp) + 10),
      detail: {
        priorDirection: 'UP',
        displacementBps: +disp.toFixed(2),
        higherClose: bar.close >= open,
      },
    };
  }
  if (prior === 'DOWN' && disp <= -cfg.contMinBps && bar.close <= bar.open && holdsBelow) {
    return {
      label: 'CONT_DOWN',
      score: Math.min(100, Math.abs(disp) + 10),
      detail: {
        priorDirection: 'DOWN',
        displacementBps: +disp.toFixed(2),
        lowerClose: bar.close <= open,
      },
    };
  }
  return null;
}

export function detectNoProgress(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate | null {
  const efforts = effortScores(bar.aggressiveBuy, bar.aggressiveSell, bar.delta);
  const buyEffort = bar.buyEffort ?? efforts.buyEffort;
  const sellEffort = bar.sellEffort ?? efforts.sellEffort;
  const upResult = bar.upResult ?? resultScore(bar.displacementBps, 'UP');
  const downResult = bar.downResult ?? resultScore(bar.displacementBps, 'DOWN');
  const disp = bar.displacementBps;

  const buyerNp =
    buyEffort >= cfg.npEffortHigh &&
    bar.delta > 0 &&
    upResult <= cfg.npResultWeak &&
    disp <= cfg.npMaxDispBps;

  const sellerNp =
    sellEffort >= cfg.npEffortHigh &&
    bar.delta < 0 &&
    downResult <= cfg.npResultWeak &&
    disp >= -cfg.npMaxDispBps;

  if (buyerNp && (!sellerNp || buyEffort >= sellEffort)) {
    return {
      label: 'BUYER_NO_PROGRESS',
      score: buyEffort,
      detail: {
        buyEffort,
        delta: Math.round(bar.delta),
        displacementBps: +disp.toFixed(2),
        upResult,
        note: 'Aggressive buying without meaningful upward progress — not automatic absorption',
      },
    };
  }
  if (sellerNp) {
    return {
      label: 'SELLER_NO_PROGRESS',
      score: sellEffort,
      detail: {
        sellEffort,
        delta: Math.round(bar.delta),
        displacementBps: +disp.toFixed(2),
        downResult,
        note: 'Aggressive selling without meaningful downward progress — not automatic absorption',
      },
    };
  }
  return null;
}

export function detectRejection(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate | null {
  if (bar.rejectionHint === 'REJECT_UP') {
    return {
      label: 'REJECT_UP',
      score: 88,
      detail: { source: 'hint' },
    };
  }
  if (bar.rejectionHint === 'REJECT_DOWN') {
    return {
      label: 'REJECT_DOWN',
      score: 88,
      detail: { source: 'hint' },
    };
  }

  const refs = (bar.references ?? []).filter((r) => r.kind !== 'NONE');
  if (!refs.length) return null;

  let best: MicroCandidate | null = null;

  for (const ref of refs) {
    const hi = refHigh(ref);
    const lo = refLow(ref);
    const open = bar.open > 0 ? bar.open : refMid(ref);

    // REJECT ↑ — traded above high-side ref, closed back below
    if (isHighSideRef(ref.kind)) {
      const excursion = bpsFrom(open, bar.high - hi);
      const closedBack = bar.close <= hi;
      const upperWick = bar.high - Math.max(bar.open, bar.close);
      const upperWickFrac = upperWick / Math.max(bar.high - bar.low, 1e-12);
      if (
        excursion >= cfg.rejectMinExcursionBps &&
        closedBack &&
        upperWickFrac >= cfg.rejectCloseBeyondFrac
      ) {
        const cand: MicroCandidate = {
          label: 'REJECT_UP',
          score: Math.min(100, excursion + 20),
          detail: {
            reference: `${ref.kind} ${hi}`,
            excursionBps: +excursion.toFixed(1),
            close: bar.close,
            acceptance: false,
          },
        };
        if (!best || cand.score > best.score) best = cand;
      }
    }

    // REJECT ↓ — traded below low-side ref, closed back above
    if (isLowSideRef(ref.kind)) {
      const excursion = bpsFrom(open, lo - bar.low);
      const closedBack = bar.close >= lo;
      const lowerWick = Math.min(bar.open, bar.close) - bar.low;
      const lowerWickFrac = lowerWick / Math.max(bar.high - bar.low, 1e-12);
      if (
        excursion >= cfg.rejectMinExcursionBps &&
        closedBack &&
        lowerWickFrac >= cfg.rejectCloseBeyondFrac
      ) {
        const cand: MicroCandidate = {
          label: 'REJECT_DOWN',
          score: Math.min(100, excursion + 20),
          detail: {
            reference: `${ref.kind} ${lo}`,
            excursionBps: +excursion.toFixed(1),
            close: bar.close,
            acceptance: false,
          },
        };
        if (!best || cand.score > best.score) best = cand;
      }
    }
  }

  return best;
}

/**
 * Acceptance requires close/stay beyond a reference — wick-only is NOT acceptance.
 */
export function detectAcceptance(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate | null {
  if (bar.acceptanceHint === 'ACCEPT_UP') {
    return {
      label: 'ACCEPT_UP',
      score: 92,
      detail: { source: 'hint', followThrough: true },
    };
  }
  if (bar.acceptanceHint === 'ACCEPT_DOWN') {
    return {
      label: 'ACCEPT_DOWN',
      score: 92,
      detail: { source: 'hint', followThrough: true },
    };
  }

  const refs = (bar.references ?? []).filter((r) => r.kind !== 'NONE');
  if (!refs.length) return null;

  let best: MicroCandidate | null = null;

  for (const ref of refs) {
    const hi = refHigh(ref);
    const lo = refLow(ref);
    const open = bar.open > 0 ? bar.open : refMid(ref);

    if (isHighSideRef(ref.kind)) {
      const beyond = bpsFrom(open, bar.close - hi);
      const bodyAbove = Math.min(bar.open, bar.close) > hi;
      // Wick-only (high > hi but close <= hi) must NOT accept.
      if (beyond >= cfg.acceptMinBeyondBps && bar.close > hi && (bodyAbove || bar.displacementBps >= cfg.moveMinBps * 0.6)) {
        const cand: MicroCandidate = {
          label: 'ACCEPT_UP',
          score: Math.min(100, beyond + 25),
          detail: {
            reference: `${ref.kind} ${hi}`,
            close: bar.close,
            beyondBps: +beyond.toFixed(1),
            timeAbove: true,
            followThrough: bar.displacementBps > 0,
          },
        };
        if (!best || cand.score > best.score) best = cand;
      }
    }

    if (isLowSideRef(ref.kind)) {
      const beyond = bpsFrom(open, lo - bar.close);
      const bodyBelow = Math.max(bar.open, bar.close) < lo;
      if (beyond >= cfg.acceptMinBeyondBps && bar.close < lo && (bodyBelow || bar.displacementBps <= -cfg.moveMinBps * 0.6)) {
        const cand: MicroCandidate = {
          label: 'ACCEPT_DOWN',
          score: Math.min(100, beyond + 25),
          detail: {
            reference: `${ref.kind} ${lo}`,
            close: bar.close,
            beyondBps: +beyond.toFixed(1),
            timeBelow: true,
            followThrough: bar.displacementBps < 0,
          },
        };
        if (!best || cand.score > best.score) best = cand;
      }
    }
  }

  return best;
}

export function collectCandidates(bar: MicroBarInput, cfg: MicroStateConfig): MicroCandidate[] {
  return [
    detectAcceptance(bar, cfg),
    detectRejection(bar, cfg),
    detectNoProgress(bar, cfg),
    detectContinuation(bar, cfg),
    detectMove(bar, cfg),
  ].filter((c): c is MicroCandidate => c != null);
}

export function formatMicroTooltip(label: MicroStateLabel, detail: MicroCandidate['detail']): string {
  const lines: string[] = [label.replace(/_/g, ' ')];
  for (const [k, v] of Object.entries(detail)) {
    if (v == null) continue;
    const key = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    lines.push(`${key}: ${v}`);
  }
  if (label === 'BUYER_NO_PROGRESS') {
    lines.push('', 'Interpretation:', 'Buyers attacked aggressively but made little upward progress.');
  } else if (label === 'SELLER_NO_PROGRESS') {
    lines.push('', 'Interpretation:', 'Sellers attacked aggressively but made little downward progress.');
  }
  return lines.join('\n');
}
