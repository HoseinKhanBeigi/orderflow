/**
 * Failure & Reclaim V3 — independent machines, no Acceptance.
 *
 * Failure:  ATTACK → PENETRATION → FAILURE_FORMING → FAILURE_CONFIRMED
 * Reclaim:  LEVEL_LOST → RETURN_ATTEMPT → RECLAIM_FORMING → RECLAIM_CONFIRMED
 *
 * Labels attach to the confirmation candle only. Wick-only is not confirmation.
 */

import { mergeLevelInteractionConfig, type LevelInteractionConfig } from './config.js';
import {
  aggressiveVolumes,
  barIsValid,
  canConfirmReclaim,
  collectEvidence,
  eventConfidence,
  eventInvalidation,
  eventReasons,
  farBoundary,
  isNarrowOrQuiet,
  levelSide,
  penetrationTolerance,
  priorAtr,
  type LevelSide,
} from './evidence.js';
import { collectLevelsKnownAt } from './levels.js';
import type {
  CandleLevelAnnotation,
  CompactLevelLabel,
  FailedBreakState,
  InteractionBar,
  InteractionLevel,
  LevelEventLine,
  LevelEventType,
  LevelEvidence,
  LevelInteractionEvent,
  LevelInteractionResult,
  ReclaimState,
} from './types.js';
import { LEVEL_EVENT_PRIORITY, LEVEL_EVENT_SHORT } from './types.js';

export interface AnnotateLevelOptions {
  symbol?: string;
  timeframe?: string;
  lastIsLive?: boolean;
  /** When set, these are the only structural levels (plus engine-created breakout/reclaim). */
  levels?: InteractionLevel[];
  autoLevels?: boolean;
  extraLevels?: InteractionLevel[];
  cfg?: Partial<LevelInteractionConfig>;
}

interface Track {
  level: InteractionLevel;
  side: LevelSide;
  failedBreak: FailedBreakState;
  reclaim: ReclaimState;
  consecutiveBeyond: number;
  consecutiveOriginal: number;
  attemptOriginTime: number | null;
  attemptOriginIndex: number | null;
  lostAt: number | null;
  lostAtIndex: number | null;
  everLost: boolean;
  lastConfirmBar: number;
  lastConfirmType: LevelEventType | null;
  attemptId: number;
  sweepAttempt: boolean;
}

interface EngineMem {
  tracks: Map<string, Track>;
  extras: InteractionLevel[];
  confirmed: LevelInteractionEvent[];
  forming: LevelInteractionEvent[];
}

function newTrack(level: InteractionLevel): Track {
  return {
    level,
    side: levelSide(level.type),
    failedBreak: 'NONE',
    reclaim: 'NONE',
    consecutiveBeyond: 0,
    consecutiveOriginal: 0,
    attemptOriginTime: null,
    attemptOriginIndex: null,
    lostAt: null,
    lostAtIndex: null,
    everLost: false,
    lastConfirmBar: -999,
    lastConfirmType: null,
    attemptId: 0,
    sweepAttempt: false,
  };
}

function eventId(levelId: string, type: LevelEventType, origin: number, attempt: number): string {
  return `${type}:${levelId}:${origin}:${attempt}`;
}

function lineStyle(type: LevelEventType): Pick<LevelEventLine, 'pattern' | 'color' | 'label'> {
  if (type === 'FAIL_UP') return { pattern: 'DASHED', color: '#f59e0b', label: 'FAIL ↑' };
  if (type === 'FAIL_DOWN') return { pattern: 'DASHED', color: '#84cc16', label: 'FAIL ↓' };
  if (type === 'RECLAIM_UP') return { pattern: 'DOTTED', color: '#22c55e', label: 'REC ↑' };
  return { pattern: 'DOTTED', color: '#ef4444', label: 'REC ↓' };
}

function emptyAnnotation(time: number): CandleLevelAnnotation {
  return {
    time,
    compactLabel: null,
    secondaryLabels: [],
    events: [],
    status: 'CONFIRMED',
    forming: [],
  };
}

function pickCompact(events: LevelInteractionEvent[]): CompactLevelLabel | null {
  if (!events.length) return null;
  const ranked = [...events].sort((a, b) => {
    const pa = LEVEL_EVENT_PRIORITY[a.eventType];
    const pb = LEVEL_EVENT_PRIORITY[b.eventType];
    if (pb !== pa) return pb - pa;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
  return ranked[0]?.compactLabel ?? null;
}

function dedupCandleEvents(events: LevelInteractionEvent[]): LevelInteractionEvent[] {
  const byType = new Map<LevelEventType, LevelInteractionEvent>();
  for (const ev of events) {
    const prev = byType.get(ev.eventType);
    if (!prev || (ev.confidence ?? 0) > (prev.confidence ?? 0)) byType.set(ev.eventType, ev);
  }
  return [...byType.values()];
}

function returnedToOriginal(bar: InteractionBar, level: InteractionLevel, tol: number): boolean {
  const side = levelSide(level.type);
  const boundary = farBoundary(level);
  if (side === 'HIGH') return bar.close <= boundary + tol * 0.25;
  return bar.close >= boundary - tol * 0.25;
}

function makeEvent(
  type: LevelEventType,
  track: Track,
  bar: InteractionBar,
  originTime: number,
  ev: LevelEvidence,
  cfg: LevelInteractionConfig,
  status: LevelInteractionEvent['status'],
): LevelInteractionEvent {
  const confirmed = status === 'CONFIRMED';
  const { buy, sell } = aggressiveVolumes(bar);
  const reasons = eventReasons(type, ev, track.level);
  return {
    id: eventId(track.level.id, type, originTime, track.attemptId),
    type,
    eventType: type,
    status,
    confidence: eventConfidence(type, ev, track.level, cfg),
    levelId: track.level.id,
    levelType: track.level.type,
    levelPrice: track.level.price,
    zoneLow: track.level.zoneLow,
    zoneHigh: track.level.zoneHigh,
    timeframe: track.level.timeframe,
    eventOriginTime: originTime,
    confirmedAt: confirmed ? bar.time : undefined,
    confirmationCandleId: confirmed ? String(bar.time) : undefined,
    originBarTime: originTime,
    confirmBarTime: confirmed ? bar.time : null,
    direction: type.endsWith('_UP') ? 'UP' : 'DOWN',
    compactLabel: LEVEL_EVENT_SHORT[type],
    dataQuality: ev.dataQuality,
    reasons,
    reason: reasons,
    invalidation: eventInvalidation(type),
    sweepReclaim: type.startsWith('RECLAIM') && track.sweepAttempt,
    metrics: {
      delta: ev.delta,
      deltaRatio: ev.deltaRatio,
      priceProgressAtr: ev.displacementAtr,
      volumeBeyondRatio: ev.volumeBeyondRatio,
      timeBeyondMs: ev.timeBeyondMs,
      askDefense: ev.askDefense,
      bidDefense: ev.bidDefense,
      aggressiveBuy: buy || null,
      aggressiveSell: sell || null,
    },
  };
}

function cooldownOk(track: Track, index: number, type: LevelEventType, cfg: LevelInteractionConfig): boolean {
  if (track.lastConfirmType !== type) return true;
  return index - track.lastConfirmBar >= cfg.cooldownBars;
}

function stepTrack(
  track: Track,
  bar: InteractionBar,
  index: number,
  ev: LevelEvidence,
  cfg: LevelInteractionConfig,
  incomplete: boolean,
  atr: number | null,
): { confirmed: LevelInteractionEvent[]; forming: LevelInteractionEvent[] } {
  const confirmed: LevelInteractionEvent[] = [];
  const forming: LevelInteractionEvent[] = [];
  const origin = track.attemptOriginTime ?? bar.time;
  const failType: LevelEventType = track.side === 'HIGH' ? 'FAIL_UP' : 'FAIL_DOWN';
  const reclaimType: LevelEventType = track.side === 'HIGH' ? 'RECLAIM_DOWN' : 'RECLAIM_UP';
  const tol = penetrationTolerance(bar.close || track.level.price, atr, cfg);
  const backInside = returnedToOriginal(bar, track.level, tol);

  // Close through the far side = level lost (reclaim machine). Not a Failure, not Acceptance.
  if (ev.closeBeyond) {
    track.consecutiveBeyond += 1;
    track.consecutiveOriginal = 0;
    if (track.attemptOriginTime == null) {
      track.attemptOriginTime = bar.time;
      track.attemptOriginIndex = index;
    }
    if (track.failedBreak === 'ATTACK' || track.failedBreak === 'PENETRATION' || track.failedBreak === 'FAILURE_FORMING') {
      track.failedBreak = 'FAILURE_INVALIDATED';
    }
    if (!track.everLost) {
      track.everLost = true;
      track.lostAt = bar.time;
      track.lostAtIndex = index;
    }
    track.reclaim = 'LEVEL_LOST';
    return { confirmed, forming };
  }

  if (ev.penetrated && !ev.closeBeyond) {
    if (track.attemptOriginTime == null) {
      track.attemptOriginTime = bar.time;
      track.attemptOriginIndex = index;
    }
    track.consecutiveBeyond = 0;
    track.consecutiveOriginal += 1;
    track.sweepAttempt = true;
    if (track.failedBreak === 'NONE' || track.failedBreak === 'FAILURE_INVALIDATED' || track.failedBreak === 'FAILED_UP' || track.failedBreak === 'FAILED_DOWN') {
      track.failedBreak = backInside ? 'PENETRATION' : 'ATTACK';
    } else if (track.failedBreak === 'ATTACK') {
      track.failedBreak = 'PENETRATION';
    }
    if (track.everLost) {
      track.reclaim = track.reclaim === 'LEVEL_LOST' ? 'RETURN_ATTEMPT' : track.reclaim;
    }
  } else {
    track.consecutiveBeyond = 0;
    if (backInside) track.consecutiveOriginal += 1;
    else track.consecutiveOriginal = 0;
  }

  // Failure machine — independent of reclaim.
  if (
    (track.failedBreak === 'ATTACK' || track.failedBreak === 'PENETRATION' || track.failedBreak === 'FAILURE_FORMING')
    && backInside
  ) {
    track.failedBreak = 'FAILURE_FORMING';
    const hadAttempt = ev.penetrated || track.attemptOriginTime != null;
    const laterBar = track.attemptOriginIndex != null && index > track.attemptOriginIndex;
    const failReady = !incomplete && hadAttempt && backInside && !ev.closeBeyond && !track.everLost && laterBar;
    if (failReady && cooldownOk(track, index, failType, cfg)) {
      const originFail = track.attemptOriginTime ?? bar.time;
      track.failedBreak = failType === 'FAIL_UP' ? 'FAILED_UP' : 'FAILED_DOWN';
      track.lastConfirmBar = index;
      track.lastConfirmType = failType;
      confirmed.push(makeEvent(failType, track, bar, originFail, ev, cfg, 'CONFIRMED'));
      track.attemptId += 1;
      track.attemptOriginTime = null;
      track.attemptOriginIndex = null;
      track.sweepAttempt = false;
    } else if (hadAttempt) {
      forming.push(makeEvent(failType, track, bar, track.attemptOriginTime ?? bar.time, ev, cfg, incomplete ? 'PROVISIONAL' : 'FORMING'));
    }
  }

  // Reclaim machine — does not require a prior Failure event.
  const barsSinceLoss = track.lostAtIndex != null ? index - track.lostAtIndex : cfg.reclaimWindowBars + 1;
  if (track.everLost && backInside) {
    if (track.reclaim === 'NONE' || track.reclaim === 'LEVEL_LOST' || track.reclaim === 'RECLAIM_FAILED') {
      track.reclaim = ev.penetrated || track.consecutiveOriginal > 0 ? 'RECLAIM_FORMING' : 'LEVEL_LOST';
    } else if (track.reclaim === 'RETURN_ATTEMPT') {
      track.reclaim = 'RECLAIM_FORMING';
    }
    if (
      canConfirmReclaim(ev, cfg, track.everLost, barsSinceLoss, incomplete)
      && cooldownOk(track, index, reclaimType, cfg)
    ) {
      track.reclaim = reclaimType === 'RECLAIM_UP' ? 'RECLAIMED_UP' : 'RECLAIMED_DOWN';
      track.lastConfirmBar = index;
      track.lastConfirmType = reclaimType;
      const originRec = track.lostAt ?? track.attemptOriginTime ?? bar.time;
      confirmed.push(makeEvent(reclaimType, track, bar, originRec, ev, cfg, 'CONFIRMED'));
      track.attemptId += 1;
      track.attemptOriginTime = null;
      track.attemptOriginIndex = null;
      track.everLost = false;
      track.lostAt = null;
      track.lostAtIndex = null;
      track.failedBreak = 'NONE';
      track.level = {
        ...track.level,
        type: 'RECLAIMED_LEVEL',
        id: `RECLAIMED_LEVEL:${track.level.id}`,
      };
    } else if (track.reclaim === 'RECLAIM_FORMING' || track.reclaim === 'RETURN_ATTEMPT') {
      forming.push(makeEvent(reclaimType, track, bar, track.lostAt ?? origin, ev, cfg, incomplete ? 'PROVISIONAL' : 'FORMING'));
    }
  } else if (track.everLost && !backInside && !ev.closeBeyond) {
    track.reclaim = 'LEVEL_LOST';
  }

  if (track.reclaim === 'RECLAIM_FORMING' && ev.closeBeyond) {
    track.reclaim = 'RECLAIM_FAILED';
  }

  return { confirmed, forming };
}

function toLines(events: LevelInteractionEvent[], bars: InteractionBar[], cfg: LevelInteractionConfig): LevelEventLine[] {
  const confirmed = events.filter((e) => e.status === 'CONFIRMED');
  const sliced = confirmed.slice(-cfg.maxEventLines);
  const timeIndex = new Map(bars.map((b, i) => [b.time, i]));
  return sliced.map((e) => {
    const style = lineStyle(e.eventType);
    const confirmIdx = e.confirmBarTime != null ? timeIndex.get(e.confirmBarTime) : undefined;
    const endIdx = confirmIdx != null ? Math.min(bars.length - 1, confirmIdx + cfg.lineExtendBars) : confirmIdx;
    const endTime = endIdx != null ? bars[endIdx]?.time ?? e.confirmBarTime ?? e.eventOriginTime : e.confirmBarTime ?? e.eventOriginTime;
    return {
      eventId: e.id,
      eventType: e.eventType,
      price: e.levelPrice,
      zoneLow: e.zoneLow,
      zoneHigh: e.zoneHigh,
      startTime: e.eventOriginTime,
      endTime,
      confirmTime: e.confirmedAt,
      ...style,
    };
  });
}

function mergeLevels(
  auto: InteractionLevel[],
  injected: InteractionLevel[],
  extras: InteractionLevel[],
  atTime: number,
): InteractionLevel[] {
  const all = [...injected, ...auto, ...extras].filter((l) => l.knownAt <= atTime);
  const map = new Map<string, InteractionLevel>();
  for (const lv of all) {
    const prev = map.get(lv.id);
    if (!prev) map.set(lv.id, lv);
  }
  return [...map.values()];
}

/**
 * Oldest → newest. Live last bar is evaluated without committing confirmation.
 */
export function annotateLevelInteractions(
  bars: InteractionBar[],
  opts: AnnotateLevelOptions = {},
): LevelInteractionResult {
  const cfg = mergeLevelInteractionConfig(opts.cfg);
  const timeframe = opts.timeframe ?? '15m';
  const lastIsLive = Boolean(opts.lastIsLive);
  const useAuto = opts.autoLevels ?? opts.levels == null;
  const injected = opts.levels ?? [];
  const byTime = new Map<number, CandleLevelAnnotation>();
  const mem: EngineMem = {
    tracks: new Map(),
    extras: [...(opts.extraLevels ?? [])],
    confirmed: [],
    forming: [],
  };

  if (!bars.length) {
    return { events: [], confirmed: [], lines: [], byTime, levelsUsed: [] };
  }

  const last = bars.length - 1;
  const levelsUsed: InteractionLevel[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const incomplete = Boolean(bar.incomplete) || (lastIsLive && i === last);
    const ann = emptyAnnotation(bar.time);
    ann.status = incomplete ? 'PROVISIONAL' : 'CONFIRMED';

    if (!barIsValid(bar)) {
      byTime.set(bar.time, ann);
      continue;
    }

    const atr = priorAtr(bars, i, cfg);
    const auto = useAuto ? collectLevelsKnownAt(bars, i, cfg, timeframe, mem.extras) : [];
    const known = mergeLevels(auto, injected, mem.extras, bar.time);
    for (const lv of known) {
      if (!levelsUsed.some((x) => x.id === lv.id)) levelsUsed.push(lv);
      if (!mem.tracks.has(lv.id)) mem.tracks.set(lv.id, newTrack(lv));
    }

    const candleConfirmed: LevelInteractionEvent[] = [];
    const candleForming: LevelInteractionEvent[] = [];

    for (const lv of known) {
      const track = mem.tracks.get(lv.id);
      if (!track) continue;
      const snapshot: Track | null = incomplete
        ? {
            ...track,
            level: { ...track.level },
          }
        : null;
      const ev = collectEvidence(
        bar,
        track.level,
        atr,
        cfg,
        track.consecutiveBeyond + (/* preview increment happens in step */ 0),
        track.consecutiveOriginal,
      );
      // Pre-count so confirmation sees this close.
      const previewBeyond = ev.closeBeyond ? track.consecutiveBeyond + 1 : 0;
      const previewOriginal = !ev.closeBeyond && returnedToOriginal(bar, track.level, penetrationTolerance(bar.close, atr, cfg))
        ? track.consecutiveOriginal + 1
        : ev.closeBeyond ? 0 : track.consecutiveOriginal;
      const evNow = {
        ...ev,
        consecutiveClosesBeyond: previewBeyond,
        consecutiveClosesOriginal: previewOriginal,
      };

      const quiet = isNarrowOrQuiet(bar, atr, cfg) && !ev.penetrated && !ev.closeBeyond;
      if (quiet) {
        if (snapshot) Object.assign(track, snapshot);
        continue;
      }

      const out = stepTrack(track, bar, i, evNow, cfg, incomplete, atr);
      if (incomplete && snapshot) {
        // Keep forming/provisional, roll back committed state.
        Object.assign(track, snapshot);
        candleForming.push(...out.forming, ...out.confirmed.map((e) => ({ ...e, status: 'PROVISIONAL' as const, confirmedAt: undefined, confirmBarTime: null })));
      } else {
        candleForming.push(...out.forming);
        for (const evnt of out.confirmed) {
          if (mem.confirmed.some((x) => x.id === evnt.id)) continue;
          const atrNow = atr != null && atr > 0 ? atr : evnt.levelPrice * 0.004;
          const band = Math.max(atrNow * Math.max(cfg.zoneMergeAtr, 0.5), evnt.levelPrice * 0.004);
          const interval = i > 0 ? Math.max(1, bar.time - (bars[i - 1]?.time ?? bar.time - 1)) : 1;
          const nearDup = mem.confirmed.some((x) => (
            x.eventType === evnt.eventType
            && Math.abs(x.levelPrice - evnt.levelPrice) <= band
            && evnt.confirmBarTime != null
            && x.confirmBarTime != null
            && Math.abs(evnt.confirmBarTime - x.confirmBarTime) <= interval * 3
          ));
          if (nearDup) continue;
          mem.confirmed.push(evnt);
          candleConfirmed.push(evnt);
        }
      }
    }

    // One compact label per type; extras stay on confirmed for tooltips.
    const display = candleConfirmed.length ? dedupCandleEvents(candleConfirmed) : [];
    ann.events = display;
    ann.forming = candleForming;
    ann.secondaryLabels = [...new Set(display.map((e) => e.compactLabel))];
    ann.compactLabel = pickCompact(display);
    byTime.set(bar.time, ann);
  }

  const lines = toLines(mem.confirmed, bars, cfg);
  return {
    events: mem.confirmed,
    confirmed: mem.confirmed,
    lines,
    byTime,
    levelsUsed,
  };
}

function fmtEventClock(time: number | null | undefined): string {
  if (time == null) return '—';
  if (time > 1e11) return new Date(time).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return String(time);
}

export function formatLevelEventTooltip(event: LevelInteractionEvent, extras?: { cvd?: number | null }): string {
  const m = event.metrics;
  const kind =
    event.eventType === 'FAIL_UP' ? 'Failed upward break'
      : event.eventType === 'FAIL_DOWN' ? 'Failed downward break'
        : event.eventType === 'RECLAIM_UP' ? 'Bullish reclaim'
          : 'Bearish reclaim';
  const cvd = extras?.cvd;
  const lines = [
    `${event.compactLabel}  ${kind}  ${event.status}`,
    '',
    `Level: ${event.levelType.replace(/_/g, ' ')}  ${event.levelPrice}`,
    event.zoneLow != null && event.zoneHigh != null
      ? `Zone: ${event.zoneLow} – ${event.zoneHigh}`
      : null,
    `Timeframe: ${event.timeframe}`,
    `Origin: ${fmtEventClock(event.eventOriginTime)}`,
    `Confirmed: ${fmtEventClock(event.confirmedAt ?? event.confirmBarTime)}`,
    `Candle: ${event.confirmationCandleId ?? '—'}`,
    `Confidence: ${event.confidence ?? '—'}  ·  Data: ${event.dataQuality}`,
    m.aggressiveBuy != null || m.aggressiveSell != null
      ? `Aggressive: buy ${m.aggressiveBuy != null ? Math.round(m.aggressiveBuy) : '—'}  sell ${m.aggressiveSell != null ? Math.round(m.aggressiveSell) : '—'}`
      : 'Aggressive: n/a',
    m.delta != null ? `Delta: ${m.delta >= 0 ? '+' : ''}${Math.round(m.delta)}` : 'Delta: n/a',
    m.deltaRatio != null ? `Delta ratio: ${m.deltaRatio >= 0 ? '+' : ''}${m.deltaRatio.toFixed(1)}%` : 'Delta ratio: n/a',
    cvd != null && Number.isFinite(cvd) ? `CVD: ${cvd >= 0 ? '+' : ''}${Math.round(cvd)}` : 'CVD: see candle CVD label',
    m.priceProgressAtr != null ? `Price progress: ${m.priceProgressAtr.toFixed(2)} ATR` : 'Price progress: n/a',
    m.volumeBeyondRatio != null ? `Volume beyond level: ${Math.round(m.volumeBeyondRatio * 100)}%` : 'Volume beyond level: n/a',
    m.askDefense != null ? `Ask defense: ${Math.round(m.askDefense)}` : 'Ask defense: unavailable',
    m.bidDefense != null ? `Bid defense: ${Math.round(m.bidDefense)}` : 'Bid defense: unavailable',
    event.sweepReclaim ? 'Kind: sweep reclaim' : null,
    '',
    'Confirmation',
    ...event.reason.map((r) => `• ${r}`),
    '',
    'Invalidation',
    ...event.invalidation.map((r) => `• ${r}`),
  ];
  return lines.filter((x) => x != null).join('\n');
}
