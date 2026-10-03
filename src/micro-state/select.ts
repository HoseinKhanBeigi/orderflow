import type { MicroStateConfig } from './config.js';
import { MICRO_LABEL_PRIORITY, type MicroCandidate, type MicroStateLabel } from './types.js';

const CATEGORY: Record<MicroStateLabel, string> = {
  MOVE_UP: 'MOVE',
  MOVE_DOWN: 'MOVE',
  CONT_UP: 'CONT',
  CONT_DOWN: 'CONT',
  BUYER_NO_PROGRESS: 'NP',
  SELLER_NO_PROGRESS: 'NP',
  REJECT_UP: 'REJECT',
  REJECT_DOWN: 'REJECT',
  ACCEPT_UP: 'ACCEPT',
  ACCEPT_DOWN: 'ACCEPT',
};

function directionOf(label: MicroStateLabel): 'UP' | 'DOWN' | 'BUYER' | 'SELLER' {
  if (label.endsWith('_UP') || label === 'BUYER_NO_PROGRESS') return label.includes('BUYER') ? 'BUYER' : 'UP';
  if (label.endsWith('_DOWN') || label === 'SELLER_NO_PROGRESS') return label.includes('SELLER') ? 'SELLER' : 'DOWN';
  return 'UP';
}

/**
 * Pick ≤ maxSecondaryLabels with:
 * - one label per category
 * - ACCEPT vs REJECT same direction → ACCEPT only if both present (acceptance confirmed)
 * - CONT suppresses MOVE same direction
 * - MOVE suppressed when NP on that aggression side conflicts with meaningful-move gate
 * - priority: ACCEPT > REJECT > NP > CONT > MOVE
 */
export function selectSecondaryLabels(
  candidates: MicroCandidate[],
  cfg: MicroStateConfig,
): MicroCandidate[] {
  if (!candidates.length) return [];

  const byLabel = new Map<MicroStateLabel, MicroCandidate>();
  for (const c of candidates) {
    const prev = byLabel.get(c.label);
    if (!prev || c.score > prev.score) byLabel.set(c.label, c);
  }

  let list = [...byLabel.values()];

  // ACCEPT vs REJECT conflict (same arrow direction)
  const hasAcceptUp = list.some((c) => c.label === 'ACCEPT_UP');
  const hasAcceptDown = list.some((c) => c.label === 'ACCEPT_DOWN');
  if (hasAcceptUp) list = list.filter((c) => c.label !== 'REJECT_UP');
  if (hasAcceptDown) list = list.filter((c) => c.label !== 'REJECT_DOWN');
  // If both reject and accept somehow opposite — keep both categories separately via category rule

  // CONT > MOVE same direction
  if (list.some((c) => c.label === 'CONT_UP')) list = list.filter((c) => c.label !== 'MOVE_UP');
  if (list.some((c) => c.label === 'CONT_DOWN')) list = list.filter((c) => c.label !== 'MOVE_DOWN');

  // NP vs MOVE: no MOVE_UP with BUYER NP (and mirror)
  if (list.some((c) => c.label === 'BUYER_NO_PROGRESS')) {
    list = list.filter((c) => c.label !== 'MOVE_UP');
  }
  if (list.some((c) => c.label === 'SELLER_NO_PROGRESS')) {
    list = list.filter((c) => c.label !== 'MOVE_DOWN');
  }

  // One per category — keep highest priority/score
  const bestByCat = new Map<string, MicroCandidate>();
  for (const c of list) {
    const cat = CATEGORY[c.label];
    const rank = MICRO_LABEL_PRIORITY[c.label] * 1000 + c.score;
    const prev = bestByCat.get(cat);
    const prevRank = prev ? MICRO_LABEL_PRIORITY[prev.label] * 1000 + prev.score : -1;
    if (!prev || rank > prevRank) bestByCat.set(cat, c);
  }

  const selected = [...bestByCat.values()].sort((a, b) => {
    const pa = MICRO_LABEL_PRIORITY[a.label];
    const pb = MICRO_LABEL_PRIORITY[b.label];
    if (pb !== pa) return pb - pa;
    return b.score - a.score;
  });

  return selected.slice(0, Math.max(0, cfg.maxSecondaryLabels));
}

/** @internal exported for tests */
export function _categoryOf(label: MicroStateLabel): string {
  return CATEGORY[label];
}

/** @internal */
export function _directionOf(label: MicroStateLabel): ReturnType<typeof directionOf> {
  return directionOf(label);
}
