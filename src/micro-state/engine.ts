/**
 * Secondary micro-state engine.
 * No lookahead. Historical replay is deterministic.
 * Does not invent absorption from NP.
 */

import { mergeMicroStateConfig, type MicroStateConfig } from './config.js';
import { collectCandidates, formatMicroTooltip } from './detect.js';
import { selectSecondaryLabels } from './select.js';
import {
  MICRO_LABEL_SHORT,
  MICRO_STATE_VERSION,
  type CandleMicroStateAnnotation,
  type MicroBarInput,
  type MicroStateLabel,
} from './types.js';

export { MICRO_STATE_VERSION };

function priorDirectionFrom(
  prev: CandleMicroStateAnnotation | null,
  prevPrimaryBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null,
): 'UP' | 'DOWN' | 'NONE' {
  if (prev) {
    if (prev.secondaryLabels.includes('CONT_UP') || prev.secondaryLabels.includes('MOVE_UP') || prev.secondaryLabels.includes('ACCEPT_UP')) {
      return 'UP';
    }
    if (prev.secondaryLabels.includes('CONT_DOWN') || prev.secondaryLabels.includes('MOVE_DOWN') || prev.secondaryLabels.includes('ACCEPT_DOWN')) {
      return 'DOWN';
    }
  }
  if (prevPrimaryBias === 'BULLISH') return 'UP';
  if (prevPrimaryBias === 'BEARISH') return 'DOWN';
  return 'NONE';
}

export function annotateBarMicroState(
  bar: MicroBarInput,
  cfgPartial?: Partial<MicroStateConfig>,
): CandleMicroStateAnnotation {
  const cfg = mergeMicroStateConfig(cfgPartial);
  const candidates = collectCandidates(bar, cfg);
  const selected = selectSecondaryLabels(candidates, cfg);
  const labels = selected.map((c) => c.label);
  const tooltips: Partial<Record<MicroStateLabel, string>> = {};
  for (const c of selected) {
    tooltips[c.label] = formatMicroTooltip(c.label, c.detail);
  }
  return {
    time: bar.time,
    secondaryLabels: labels,
    secondaryShort: labels.map((l) => MICRO_LABEL_SHORT[l]),
    status: bar.incomplete ? 'PROVISIONAL' : 'CONFIRMED',
    candidates,
    tooltips,
  };
}

/**
 * Oldest → newest. Each candle is frozen after emit (no backfill).
 * `primaryBiasByTime` optional map from market-sequence primary bias.
 */
export function annotateBarsMicroState(
  bars: MicroBarInput[],
  opts?: {
    cfg?: Partial<MicroStateConfig>;
    primaryBiasByTime?: Map<number, 'BULLISH' | 'BEARISH' | 'NEUTRAL'>;
  },
): CandleMicroStateAnnotation[] {
  const cfg = mergeMicroStateConfig(opts?.cfg);
  const out: CandleMicroStateAnnotation[] = [];
  let prev: CandleMicroStateAnnotation | null = null;

  for (const raw of bars) {
    const bias = opts?.primaryBiasByTime?.get(raw.time) ?? null;
    const bar: MicroBarInput = {
      ...raw,
      priorDirection: raw.priorDirection ?? priorDirectionFrom(prev, bias),
    };
    const ann = annotateBarMicroState(bar, cfg);
    // Freeze: push immutable copy
    out.push({
      ...ann,
      secondaryLabels: [...ann.secondaryLabels],
      secondaryShort: [...ann.secondaryShort],
      candidates: ann.candidates.map((c) => ({ ...c, detail: { ...c.detail } })),
      tooltips: { ...ann.tooltips },
    });
    prev = out[out.length - 1]!;
  }

  return out;
}

export function microLabelsDisplayLine(
  primaryShort: string,
  secondaryShort: string[],
  provisional = false,
): string {
  const parts = [primaryShort, ...secondaryShort].filter(Boolean);
  const line = parts.join('   ');
  return provisional ? line.replace(/↑/g, '↑?').replace(/↓/g, '↓?').replace(/ NP/g, ' NP?') : line;
}
