/**
 * Bridge Level Interaction events into Market Sequence FR snapshots
 * without changing primary-label priority rules.
 */

import type { FailureReclaimSnapshot } from '../market-sequence/adapters.js';
import type {
  ChartViewport,
  CompactLevelLabel,
  InteractionLevel,
  LevelEventType,
  LevelInteractionEvent,
  LevelEventLine,
  ProjectedEventLine,
} from './types.js';
import { LEVEL_EVENT_SHORT } from './types.js';

export function level(partial: Partial<InteractionLevel> & Pick<InteractionLevel, 'price' | 'type'>): InteractionLevel {
  return {
    id: partial.id ?? `${partial.type}:${partial.price}`,
    type: partial.type,
    price: partial.price,
    zoneLow: partial.zoneLow ?? partial.price,
    zoneHigh: partial.zoneHigh ?? partial.price,
    timeframe: partial.timeframe ?? '15m',
    createdAt: partial.createdAt ?? 0,
    knownAt: partial.knownAt ?? 0,
    strength: partial.strength,
    confidence: partial.confidence,
  };
}

export function mapLevelEventToFailureReclaim(
  event: LevelInteractionEvent | null | undefined,
): FailureReclaimSnapshot | null {
  if (!event || event.status !== 'CONFIRMED') return null;
  if (event.eventType === 'FAIL_UP') {
    return {
      failure: { detected: true, label: 'BUYER_FAILURE' },
      reclaim: { state: 'NO_RECLAIM' },
      progress: { failure: true },
      direction: 'SHORT',
    };
  }
  if (event.eventType === 'FAIL_DOWN') {
    return {
      failure: { detected: true, label: 'SELLER_FAILURE' },
      reclaim: { state: 'NO_RECLAIM' },
      progress: { failure: true },
      direction: 'LONG',
    };
  }
  if (event.eventType === 'RECLAIM_UP') {
    return {
      failure: { detected: false, label: 'SELLER_FAILURE' },
      reclaim: { state: 'ACCEPTED_RECLAIM' },
      progress: { failure: false },
      direction: 'LONG',
    };
  }
  if (event.eventType === 'RECLAIM_DOWN') {
    return {
      failure: { detected: false, label: 'BUYER_FAILURE' },
      reclaim: { state: 'ACCEPTED_RECLAIM' },
      progress: { failure: false },
      direction: 'SHORT',
    };
  }
  return null;
}

export function compactLabelFor(type: LevelEventType): CompactLevelLabel {
  return LEVEL_EVENT_SHORT[type];
}

/**
 * Map a stored event line into pixel space. Price is invariant under zoom/pan;
 * x/y are derived from the current viewport.
 */
export function projectLevelEventLine(
  line: LevelEventLine,
  viewport: ChartViewport,
): ProjectedEventLine {
  const i0 = viewport.times.findIndex((t) => t >= line.startTime);
  const i1 = viewport.times.findIndex((t) => t >= line.endTime);
  const start = i0 >= 0 ? i0 : 0;
  const end = i1 >= 0 ? i1 : viewport.times.length - 1;
  const visible = viewport.times.some((t) => t >= line.startTime && t <= line.endTime)
    || (viewport.times[0] != null && viewport.times[viewport.times.length - 1] != null
      && line.startTime <= viewport.times[viewport.times.length - 1]!
      && line.endTime >= viewport.times[0]!);
  return {
    eventId: line.eventId,
    price: line.price,
    x0: viewport.xForIndex(Math.max(0, start)),
    x1: viewport.xForIndex(Math.max(start, end)),
    y: viewport.yForPrice(line.price),
    yZoneLow: line.zoneLow != null ? viewport.yForPrice(line.zoneLow) : undefined,
    yZoneHigh: line.zoneHigh != null ? viewport.yForPrice(line.zoneHigh) : undefined,
    visible,
  };
}

export function resetLevelSeriesKey(symbol: string, timeframe: string): string {
  return `${symbol}::${timeframe}`;
}

/** X/Y for a FAIL/REC label above the confirmation candle wick. */
export function projectFailReclaimLabel(
  confirmTime: number,
  barHigh: number,
  viewport: ChartViewport,
  gap = 14,
): { x: number; y: number; visible: boolean } {
  const i = viewport.times.indexOf(confirmTime);
  return {
    x: i >= 0 ? viewport.xForIndex(i) : viewport.xForIndex(0),
    y: viewport.yForPrice(barHigh) - gap,
    visible: i >= 0,
  };
}
