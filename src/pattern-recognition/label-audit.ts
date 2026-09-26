import type { FootprintBarLike, CandleLabel } from './pattern-types.js';
import { classifyBarLegacy, classifyCandleStructure } from './candle-classification.js';
import type { CandleClassification } from './candle-classification-types.js';

export interface LabelCountReport {
  total: number;
  byLabel: Record<string, number>;
  byPercent: Record<string, number>;
}

export interface StructuredDistributionReport {
  total: number;
  control: Record<string, number>;
  liquidityEvent: Record<string, number>;
  specialEvent: Record<string, number>;
  primaryDisplayLabel: Record<string, number>;
  outcome: Record<string, number>;
}

export interface ClassificationCompareReport {
  legacy: LabelCountReport;
  structured: StructuredDistributionReport;
  notes: string[];
}

/** Count flat legacy labels over a bar series (no future bars). */
export function auditLegacyLabelDistribution(bars: FootprintBarLike[]): LabelCountReport {
  const byLabel: Record<string, number> = {};
  for (let i = 0; i < bars.length; i++) {
    const label = classifyBarLegacy(bars[i]!, bars.slice(0, i));
    byLabel[label] = (byLabel[label] ?? 0) + 1;
  }
  return toCountReport(bars.length, byLabel);
}

/** Count structured layers over a bar series (no future bars). */
export function auditStructuredDistribution(bars: FootprintBarLike[]): StructuredDistributionReport {
  const control: Record<string, number> = {};
  const liquidityEvent: Record<string, number> = {};
  const specialEvent: Record<string, number> = {};
  const primaryDisplayLabel: Record<string, number> = {};
  const outcome: Record<string, number> = {};

  for (let i = 0; i < bars.length; i++) {
    const c = classifyCandleStructure(bars[i]!, { prior: bars.slice(0, i) });
    bump(control, c.primaryState.control);
    bump(liquidityEvent, c.liquidityBehavior.dominantEvent);
    bump(specialEvent, c.specialEvent.type ?? 'NONE');
    bump(primaryDisplayLabel, c.primaryDisplayLabel);
    bump(outcome, c.outcome.type);
  }

  return {
    total: bars.length,
    control: toPercents(bars.length, control),
    liquidityEvent: toPercents(bars.length, liquidityEvent),
    specialEvent: toPercents(bars.length, specialEvent),
    primaryDisplayLabel: toPercents(bars.length, primaryDisplayLabel),
    outcome: toPercents(bars.length, outcome),
  };
}

export function compareClassificationDistributions(bars: FootprintBarLike[]): ClassificationCompareReport {
  const legacy = auditLegacyLabelDistribution(bars);
  const structured = auditStructuredDistribution(bars);
  const pulledConsumed =
    (legacy.byPercent['ASKS_PULLED'] ?? 0) + (legacy.byPercent['BIDS_PULLED'] ?? 0);
  const notes: string[] = [];
  if (pulledConsumed >= 40) {
    notes.push(
      `Legacy pulled labels cover ${pulledConsumed.toFixed(1)}% of candles — likely over-promoted relative to control/special events.`,
    );
  }
  const newPulled =
    (structured.liquidityEvent['ASKS_PULLED'] ?? 0) + (structured.liquidityEvent['BIDS_PULLED'] ?? 0);
  notes.push(
    `Structured dominant liquidity pulled events: ${newPulled.toFixed(1)}% (gated; NONE is expected on most candles).`,
  );
  notes.push(
    `No stored live footprint history in-repo; pass recent bars into this auditor when available.`,
  );
  return { legacy, structured, notes };
}

export function auditLabelDistribution(bars: FootprintBarLike[]): ClassificationCompareReport {
  return compareClassificationDistributions(bars);
}

export function classificationsOf(bars: FootprintBarLike[]): CandleClassification[] {
  return bars.map((bar, i) => classifyCandleStructure(bar, { prior: bars.slice(0, i) }));
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function toCountReport(total: number, byLabel: Record<string, number>): LabelCountReport {
  return {
    total,
    byLabel,
    byPercent: toPercents(total, byLabel),
  };
}

function toPercents(total: number, counts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  for (const [k, n] of Object.entries(counts)) {
    out[k] = Math.round((n / total) * 10_000) / 100;
  }
  return out;
}

export type { CandleLabel };
