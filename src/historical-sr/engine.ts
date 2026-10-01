import {
  DEFAULT_HISTORICAL_SR_CONFIG,
  HISTORICAL_SR_VERSION,
  type HistoricalBarLike,
  type HistoricalCandleSRContext,
  type HistoricalInteraction,
  type HistoricalLevel,
  type HistoricalLevelEvent,
  type HistoricalLevelSegment,
  type HistoricalLevelState,
  type HistoricalLevelType,
  type HistoricalSRConfig,
  type HistoricalSRSnapshot,
} from './types.js';

export {
  DEFAULT_HISTORICAL_SR_CONFIG,
  HISTORICAL_SR_VERSION,
} from './types.js';
export type {
  HistoricalBarLike,
  HistoricalCandleSRContext,
  HistoricalInteraction,
  HistoricalLevel,
  HistoricalLevelEvent,
  HistoricalLevelSegment,
  HistoricalLevelState,
  HistoricalLevelType,
  HistoricalSRConfig,
  HistoricalSRSnapshot,
} from './types.js';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function atrOf(bars: HistoricalBarLike[], period: number): number {
  if (bars.length < 2) {
    const b = bars[bars.length - 1];
    return b ? Math.max(b.high - b.low, b.close * 0.002) : 0;
  }
  const n = Math.min(period, bars.length - 1);
  let sum = 0;
  for (let i = bars.length - n; i < bars.length; i++) {
    const cur = bars[i]!;
    const prev = bars[i - 1]!;
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    sum += tr;
  }
  return sum / n || bars[bars.length - 1]!.close * 0.002;
}

function zoneHalfWidth(price: number, atr: number, config: HistoricalSRConfig): number {
  const fromAtr = atr * config.zoneAtrFraction;
  const fromBps = price * (config.zoneMinBps / 10_000);
  return Math.max(fromAtr, fromBps, price * 1e-6);
}

function bpsDistance(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return (Math.abs(a - b) / a) * 10_000;
}

function cloneLevel(level: HistoricalLevel): HistoricalLevel {
  return {
    ...level,
    components: { ...level.components },
  };
}

function recomputeStrength(level: HistoricalLevel, now: number, atr: number): number {
  const ageBarsProxy = Math.max(0, (now - level.knownAt) / Math.max(1, atr > 0 ? 1 : 1));
  void ageBarsProxy;
  const swing = level.components.swingSignificance;
  const reactions = clamp(level.touchCount * 14 + level.rejectionCount * 18, 0, 100);
  const mag = clamp(level.components.rejectionMagnitude, 0, 100);
  const tests = clamp(level.components.independentTests * 16, 0, 100);
  const recency = level.lastInteractionAt
    ? clamp(100 - ((now - level.lastInteractionAt) / 60) * 0.5, 20, 100)
    : clamp(100 - ((now - level.knownAt) / 60) * 0.35, 25, 100);
  level.components.reactionCount = reactions;
  level.components.recency = recency;
  return clamp(swing * 0.28 + reactions * 0.22 + mag * 0.2 + tests * 0.15 + recency * 0.15, 0, 100);
}

export class HistoricalSREngine {
  private readonly config: HistoricalSRConfig;
  private readonly timeframe: string;
  private bars: HistoricalBarLike[] = [];
  private levels: HistoricalLevel[] = [];
  private events: HistoricalLevelEvent[] = [];
  private segments: Map<string, HistoricalLevelSegment> = new Map();
  private lastAtr = 0;
  private lastContext: HistoricalCandleSRContext | null = null;

  constructor(timeframe = '15m', config: Partial<HistoricalSRConfig> = {}) {
    this.timeframe = timeframe;
    this.config = { ...DEFAULT_HISTORICAL_SR_CONFIG, ...config };
  }

  reset(): void {
    this.bars = [];
    this.levels = [];
    this.events = [];
    this.segments.clear();
    this.lastAtr = 0;
    this.lastContext = null;
  }

  getLevels(): HistoricalLevel[] {
    return this.levels.map(cloneLevel);
  }

  getEvents(): HistoricalLevelEvent[] {
    return this.events.slice();
  }

  getSegments(): HistoricalLevelSegment[] {
    return [...this.segments.values()].map((s) => ({ ...s }));
  }

  /**
   * Incremental: append one completed candle and update levels known at/after this close.
   */
  processBar(bar: HistoricalBarLike): HistoricalSRSnapshot {
    this.bars.push({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      totalBuy: bar.totalBuy,
      totalSell: bar.totalSell,
    });
    this.lastAtr = atrOf(this.bars, this.config.atrPeriod);

    this.confirmNewPivots(bar.time);
    this.interactLevels(bar);
    this.applyDecay(bar.time);
    this.trimActive();

    this.lastContext = this.buildCandleContext(bar);
    return this.snapshot(bar.time);
  }

  /**
   * Full batch: process all bars online. Same as incremental loop.
   */
  processAll(bars: HistoricalBarLike[]): HistoricalSRSnapshot {
    this.reset();
    let snap: HistoricalSRSnapshot = this.snapshot(0);
    for (const bar of bars) {
      snap = this.processBar(bar);
    }
    return snap;
  }

  /**
   * Levels known at or before timestamp T (inclusive).
   */
  snapshotAt(timestamp: number): HistoricalSRSnapshot {
    const known = this.levels
      .filter((l) => l.knownAt <= timestamp)
      .map((l) => this.levelAsOf(l, timestamp));
    const support = known
      .filter((l) => l.type === 'SUPPORT' || l.state === 'FLIPPED_SUPPORT')
      .sort((a, b) => b.strength - a.strength);
    const resistance = known
      .filter((l) => l.type === 'RESISTANCE' || l.state === 'FLIPPED_RESISTANCE')
      .sort((a, b) => b.strength - a.strength);

    const segments = this.getSegments().filter((s) => s.fromTime <= timestamp);
    const events = this.events.filter((e) => e.timestamp <= timestamp);

    let candleContext: HistoricalCandleSRContext | null = null;
    const bar = [...this.bars].reverse().find((b) => b.time <= timestamp);
    if (bar) {
      candleContext = this.buildCandleContextFrom(bar, known);
    }

    return {
      version: HISTORICAL_SR_VERSION,
      timestamp,
      timeframe: this.timeframe,
      atr: this.lastAtr,
      knownSupport: support,
      knownResistance: resistance,
      segments,
      events,
      candleContext,
    };
  }

  snapshot(timestamp: number): HistoricalSRSnapshot {
    return this.snapshotAt(timestamp);
  }

  /**
   * Chart segments: draw from knownAt forward; optionally filter major-only.
   */
  chartSegments(opts: { majorOnly?: boolean; includeBroken?: boolean; asOf?: number } = {}): HistoricalLevelSegment[] {
    const asOf = opts.asOf ?? Number.POSITIVE_INFINITY;
    const majorOnly = opts.majorOnly !== false;
    const includeBroken = opts.includeBroken === true;
    return this.getSegments().filter((s) => {
      if (s.fromTime > asOf) return false;
      if (majorOnly && !s.major) return false;
      if (!includeBroken && s.broken && (s.toTime == null || s.toTime <= asOf)) {
        // still show broken segment history if includeBroken; default hide live broken stubs
        if (s.toTime != null && s.toTime < asOf) return true;
        if (!includeBroken && s.broken) return s.toTime != null;
      }
      if (!includeBroken && s.broken && s.toTime == null) return false;
      return true;
    });
  }

  // --- internal ---

  private levelAsOf(level: HistoricalLevel, timestamp: number): HistoricalLevel {
    const out = cloneLevel(level);
    // Historical state at T: if broken/flipped after T, present pre-break view for snapshot honesty
    const breakEvt = this.events.find(
      (e) =>
        e.levelId === level.id &&
        (e.type === 'LEVEL_BROKEN' || e.type === 'LEVEL_FLIPPED') &&
        e.timestamp > timestamp,
    );
    if (breakEvt && level.knownAt <= timestamp) {
      // Keep current object but if break was after T, restore ACTIVE/TESTED from events before T
      const lastBefore = [...this.events]
        .filter((e) => e.levelId === level.id && e.timestamp <= timestamp)
        .pop();
      if (lastBefore) {
        out.state = lastBefore.stateAfter;
      } else {
        out.state = 'ACTIVE';
      }
    }
    return out;
  }

  private confirmNewPivots(now: number): void {
    const confirm = Math.max(1, this.config.pivotConfirmBars);
    const bars = this.bars;
    if (bars.length < confirm * 2 + 1) return;

    // Pivot index that just became confirmable: last bar is right[confirm-1]
    const pivotIdx = bars.length - 1 - confirm;
    if (pivotIdx < confirm) return;

    const pivot = bars[pivotIdx]!;
    const left = bars.slice(pivotIdx - confirm, pivotIdx);
    const right = bars.slice(pivotIdx + 1, pivotIdx + 1 + confirm);
    if (left.length < confirm || right.length < confirm) return;

    const knownAt = right[right.length - 1]!.time;
    if (knownAt !== now) return; // only confirm on the exact confirmation bar

    const atr = this.lastAtr;
    const isLow = left.every((b) => pivot.low <= b.low) && right.every((b) => pivot.low <= b.low);
    const isHigh = left.every((b) => pivot.high >= b.high) && right.every((b) => pivot.high >= b.high);

    if (isLow) {
      this.addOrMergeLevel({
        type: 'SUPPORT',
        price: pivot.low,
        source: 'SWING_LOW',
        sourceCandleTime: pivot.time,
        knownAt,
        atr,
      });
    }
    if (isHigh) {
      this.addOrMergeLevel({
        type: 'RESISTANCE',
        price: pivot.high,
        source: 'SWING_HIGH',
        sourceCandleTime: pivot.time,
        knownAt,
        atr,
      });
    }
  }

  private addOrMergeLevel(p: {
    type: HistoricalLevelType;
    price: number;
    source: HistoricalLevel['source'];
    sourceCandleTime: number;
    knownAt: number;
    atr: number;
  }): void {
    const half = zoneHalfWidth(p.price, p.atr, this.config);
    const clusterTol = Math.max(p.atr * this.config.clusterAtrFraction, half);

    const existing = this.levels.find(
      (l) =>
        l.type === p.type &&
        l.state !== 'BROKEN' &&
        l.state !== 'EXPIRED' &&
        Math.abs(l.price - p.price) <= clusterTol,
    );

    if (existing) {
      const stateBefore = existing.state;
      existing.price = (existing.price * existing.touchCount + p.price) / (existing.touchCount + 1);
      existing.zoneLow = Math.min(existing.zoneLow, p.price - half);
      existing.zoneHigh = Math.max(existing.zoneHigh, p.price + half);
      existing.touchCount += 1;
      existing.components.independentTests += 1;
      existing.components.swingSignificance = Math.max(existing.components.swingSignificance, 78);
      existing.source = 'CLUSTERED_SWING';
      existing.strength = recomputeStrength(existing, p.knownAt, p.atr);
      existing.lastInteractionAt = p.knownAt;
      this.pushEvent({
        type: 'LEVEL_CONFIRMED',
        timestamp: p.knownAt,
        levelId: existing.id,
        price: existing.price,
        stateBefore,
        stateAfter: existing.state,
        evidence: `cluster merge pivot @ ${p.price}`,
      });
      this.upsertSegment(existing);
      return;
    }

    const level: HistoricalLevel = {
      id: `${p.type}:${p.source}:${p.sourceCandleTime}:${p.knownAt}:${p.price.toFixed(8)}`,
      type: p.type,
      price: p.price,
      zoneLow: p.price - half,
      zoneHigh: p.price + half,
      source: p.source,
      sourceTimeframe: this.timeframe,
      sourceCandleTime: p.sourceCandleTime,
      knownAt: p.knownAt,
      createdAt: p.sourceCandleTime,
      firstSeenAt: p.knownAt,
      lastInteractionAt: null,
      strength: 0,
      touchCount: 1,
      rejectionCount: 0,
      breakCount: 0,
      state: 'ACTIVE',
      beyondCloses: 0,
      components: {
        swingSignificance: 78,
        reactionCount: 20,
        rejectionMagnitude: 0,
        recency: 90,
        independentTests: 1,
      },
    };
    level.strength = recomputeStrength(level, p.knownAt, p.atr);
    this.levels.push(level);
    this.pushEvent({
      type: 'LEVEL_CREATED',
      timestamp: p.knownAt,
      levelId: level.id,
      price: level.price,
      stateBefore: 'FORMING',
      stateAfter: 'ACTIVE',
      evidence: `swing pivot confirmed (${p.source})`,
    });
    this.upsertSegment(level);
  }

  private upsertSegment(level: HistoricalLevel): void {
    const major = level.strength >= this.config.majorMinStrength;
    const existing = this.segments.get(level.id);
    if (existing) {
      existing.price = level.price;
      existing.zoneLow = level.zoneLow;
      existing.zoneHigh = level.zoneHigh;
      existing.strength = level.strength;
      existing.state = level.state;
      existing.major = major;
      if (
        level.state === 'BROKEN' ||
        level.state === 'EXPIRED' ||
        level.state === 'FLIPPED_SUPPORT' ||
        level.state === 'FLIPPED_RESISTANCE'
      ) {
        existing.broken = level.state === 'BROKEN' || level.state === 'EXPIRED';
        if (existing.toTime == null && level.lastInteractionAt != null) {
          existing.toTime = level.lastInteractionAt;
        }
      }
      return;
    }
    this.segments.set(level.id, {
      levelId: level.id,
      type: level.type,
      price: level.price,
      zoneLow: level.zoneLow,
      zoneHigh: level.zoneHigh,
      strength: level.strength,
      state: level.state,
      fromTime: level.knownAt,
      toTime: null,
      broken: false,
      major,
    });
  }

  private interactLevels(bar: HistoricalBarLike): void {
    const atr = this.lastAtr;
    const known = this.levels.filter(
      (l) =>
        l.knownAt <= bar.time &&
        l.state !== 'EXPIRED' &&
        l.state !== 'BROKEN',
    );

    for (const level of known) {
      // Skip interaction on the confirmation bar itself for brand-new levels
      if (level.knownAt === bar.time && level.sourceCandleTime !== bar.time) {
        // allow flip retests later; new pivot may still not "touch" itself meaningfully
      }

      const interaction = this.classifyInteraction(level, bar);
      if (interaction === 'NONE' || interaction === 'APPROACH') continue;

      const stateBefore = level.state;
      level.lastInteractionAt = bar.time;
      level.touchCount += interaction === 'TOUCH' || interaction === 'WICK_TOUCH' || interaction === 'BODY_TOUCH' || interaction === 'CLOSE_IN_ZONE' || interaction === 'REJECTION' || interaction === 'RETEST' ? 1 : 0;

      if (interaction === 'REJECTION') {
        level.rejectionCount += 1;
        const mag =
          level.type === 'SUPPORT'
            ? ((bar.close - level.zoneLow) / Math.max(atr, level.price * 0.001)) * 25
            : ((level.zoneHigh - bar.close) / Math.max(atr, level.price * 0.001)) * 25;
        level.components.rejectionMagnitude = clamp(
          level.components.rejectionMagnitude * 0.6 + clamp(mag, 0, 100) * 0.4,
          0,
          100,
        );
        level.components.independentTests += 1;
        if (level.state === 'ACTIVE') level.state = 'TESTED';
        this.pushEvent({
          type: 'LEVEL_HELD',
          timestamp: bar.time,
          levelId: level.id,
          price: level.price,
          stateBefore,
          stateAfter: level.state,
          evidence: `${level.type} held via rejection`,
        });
      } else if (interaction === 'BREAK') {
        level.beyondCloses += 1;
        if (level.beyondCloses >= this.config.breakConfirmCloses) {
          level.breakCount += 1;
          level.state = 'BROKEN';
          this.pushEvent({
            type: 'LEVEL_BROKEN',
            timestamp: bar.time,
            levelId: level.id,
            price: level.price,
            stateBefore,
            stateAfter: 'BROKEN',
            evidence: `close acceptance beyond zone (${level.beyondCloses} closes)`,
          });
          this.upsertSegment(level);
          this.maybeFlip(level, bar);
        }
      } else {
        if (level.state === 'ACTIVE') level.state = 'TESTED';
        this.pushEvent({
          type: 'LEVEL_TOUCHED',
          timestamp: bar.time,
          levelId: level.id,
          price: level.price,
          stateBefore,
          stateAfter: level.state,
          evidence: interaction,
        });
      }

      if (level.state !== 'BROKEN') {
        level.beyondCloses = interaction === 'CLOSE_THROUGH' ? level.beyondCloses : 0;
        level.strength = recomputeStrength(level, bar.time, atr);
        this.upsertSegment(level);
      }
    }
  }

  private maybeFlip(broken: HistoricalLevel, bar: HistoricalBarLike): void {
    const atr = this.lastAtr;
    const half = zoneHalfWidth(broken.price, atr, this.config);
    const flippedType: HistoricalLevelType = broken.type === 'RESISTANCE' ? 'SUPPORT' : 'RESISTANCE';
    const flippedState: HistoricalLevelState =
      flippedType === 'SUPPORT' ? 'FLIPPED_SUPPORT' : 'FLIPPED_RESISTANCE';

    const level: HistoricalLevel = {
      id: `${flippedType}:FLIPPED:${broken.id}:${bar.time}`,
      type: flippedType,
      price: broken.price,
      zoneLow: broken.zoneLow,
      zoneHigh: broken.zoneHigh,
      source: 'FLIPPED',
      sourceTimeframe: this.timeframe,
      sourceCandleTime: broken.sourceCandleTime,
      knownAt: bar.time,
      createdAt: bar.time,
      firstSeenAt: bar.time,
      lastInteractionAt: bar.time,
      strength: clamp(broken.strength * 0.85, 40, 95),
      touchCount: 0,
      rejectionCount: 0,
      breakCount: 0,
      state: flippedState,
      beyondCloses: 0,
      components: {
        swingSignificance: 70,
        reactionCount: 10,
        rejectionMagnitude: broken.components.rejectionMagnitude * 0.5,
        recency: 95,
        independentTests: 1,
      },
    };
    // Expand zone slightly around flip
    level.zoneLow = broken.price - half;
    level.zoneHigh = broken.price + half;
    this.levels.push(level);
    this.pushEvent({
      type: 'LEVEL_FLIPPED',
      timestamp: bar.time,
      levelId: level.id,
      price: level.price,
      stateBefore: 'BROKEN',
      stateAfter: flippedState,
      evidence: `${broken.type} → ${flippedState}`,
    });
    this.upsertSegment(level);
  }

  private classifyInteraction(level: HistoricalLevel, bar: HistoricalBarLike): HistoricalInteraction {
    const atr = this.lastAtr;
    const { zoneLow, zoneHigh } = level;
    const mid = level.price;
    const approachBps = this.config.touchApproachBps;
    const near = bpsDistance(bar.close, mid) <= approachBps * 1.5;

    const wickIn =
      (bar.low <= zoneHigh && bar.low >= zoneLow) ||
      (bar.high >= zoneLow && bar.high <= zoneHigh) ||
      (bar.low < zoneLow && bar.high > zoneHigh);
    const bodyLow = Math.min(bar.open, bar.close);
    const bodyHigh = Math.max(bar.open, bar.close);
    const bodyIn = bodyLow <= zoneHigh && bodyHigh >= zoneLow;
    const closeIn = bar.close >= zoneLow && bar.close <= zoneHigh;

    const breakDist = atr * this.config.breakBeyondAtrFraction;

    if (level.type === 'SUPPORT' || level.state === 'FLIPPED_SUPPORT') {
      const wickThrough = bar.low < zoneLow - breakDist * 0.25;
      const closeThrough = bar.close < zoneLow - breakDist;
      if (closeThrough) return 'BREAK';
      if (wickIn || bodyIn || closeIn) {
        // Rejection: wicked into/through zone but closed back above zone mid
        if ((wickThrough || wickIn) && bar.close > zoneLow && bar.close >= mid - atr * 0.05) {
          return 'REJECTION';
        }
        if (closeIn) return 'CLOSE_IN_ZONE';
        if (bodyIn) return 'BODY_TOUCH';
        if (wickIn) return 'WICK_TOUCH';
        return 'TOUCH';
      }
      if (near) return 'APPROACH';
      return 'NONE';
    }

    // Resistance
    const wickThrough = bar.high > zoneHigh + breakDist * 0.25;
    const closeThrough = bar.close > zoneHigh + breakDist;
    if (closeThrough) return 'BREAK';
    if (wickIn || bodyIn || closeIn) {
      if ((wickThrough || wickIn) && bar.close < zoneHigh && bar.close <= mid + atr * 0.05) {
        return 'REJECTION';
      }
      if (closeIn) return 'CLOSE_IN_ZONE';
      if (bodyIn) return 'BODY_TOUCH';
      if (wickIn) return 'WICK_TOUCH';
      return 'TOUCH';
    }
    if (near) return 'APPROACH';
    return 'NONE';
  }

  private applyDecay(now: number): void {
    const atr = this.lastAtr;
    for (const level of this.levels) {
      if (level.state === 'BROKEN' || level.state === 'EXPIRED') continue;
      if (level.knownAt > now) continue;
      const last = level.lastInteractionAt ?? level.knownAt;
      // Approximate idle bars via bar count after last
      const idle = this.bars.filter((b) => b.time > last && b.time <= now).length;
      if (idle >= this.config.decayIdleBars) {
        level.strength = clamp(level.strength - this.config.decayStrengthPerIdle, 0, 100);
        if (level.strength < 28) {
          const before = level.state;
          level.state = 'EXPIRED';
          this.pushEvent({
            type: 'LEVEL_EXPIRED',
            timestamp: now,
            levelId: level.id,
            price: level.price,
            stateBefore: before,
            stateAfter: 'EXPIRED',
            evidence: `idle ${idle} bars`,
          });
          this.upsertSegment(level);
        } else if (level.state === 'TESTED' || level.state === 'ACTIVE') {
          level.state = 'WEAKENING';
          this.upsertSegment(level);
        }
      } else {
        level.strength = recomputeStrength(level, now, atr);
      }
    }
  }

  private trimActive(): void {
    const active = this.levels
      .filter((l) => l.state !== 'BROKEN' && l.state !== 'EXPIRED')
      .sort((a, b) => b.strength - a.strength);
    if (active.length <= this.config.maxActiveLevels) return;
    for (const weak of active.slice(this.config.maxActiveLevels)) {
      if (weak.state === 'WEAKENING') {
        weak.state = 'EXPIRED';
        this.upsertSegment(weak);
      }
    }
  }

  private buildCandleContext(bar: HistoricalBarLike): HistoricalCandleSRContext {
    const known = this.levels.filter((l) => l.knownAt <= bar.time).map(cloneLevel);
    return this.buildCandleContextFrom(bar, known);
  }

  private buildCandleContextFrom(bar: HistoricalBarLike, known: HistoricalLevel[]): HistoricalCandleSRContext {
    const supports = known
      .filter(
        (l) =>
          (l.type === 'SUPPORT' || l.state === 'FLIPPED_SUPPORT') &&
          l.state !== 'BROKEN' &&
          l.state !== 'EXPIRED',
      )
      .sort((a, b) => Math.abs(a.price - bar.close) - Math.abs(b.price - bar.close));
    const resistances = known
      .filter(
        (l) =>
          (l.type === 'RESISTANCE' || l.state === 'FLIPPED_RESISTANCE') &&
          l.state !== 'BROKEN' &&
          l.state !== 'EXPIRED',
      )
      .sort((a, b) => Math.abs(a.price - bar.close) - Math.abs(b.price - bar.close));

    const nearestKnownSupport = supports[0] ?? null;
    const nearestKnownResistance = resistances[0] ?? null;

    const atBps = 8;
    const nearBps = 22;
    let locationContext: HistoricalCandleSRContext['locationContext'] = 'BETWEEN_LEVELS';
    if (!nearestKnownSupport && !nearestKnownResistance) locationContext = 'NONE';
    else {
      const ds = nearestKnownSupport ? bpsDistance(bar.close, nearestKnownSupport.price) : Infinity;
      const dr = nearestKnownResistance ? bpsDistance(bar.close, nearestKnownResistance.price) : Infinity;
      if (nearestKnownSupport && ds <= atBps) locationContext = 'AT_SUPPORT';
      else if (nearestKnownResistance && dr <= atBps) locationContext = 'AT_RESISTANCE';
      else if (nearestKnownSupport && ds <= nearBps && ds <= dr) locationContext = 'NEAR_SUPPORT';
      else if (nearestKnownResistance && dr <= nearBps) locationContext = 'NEAR_RESISTANCE';
      else locationContext = 'BETWEEN_LEVELS';
    }

    return {
      timestamp: bar.time,
      nearestKnownSupport,
      nearestKnownResistance,
      locationContext,
      supportInteraction: nearestKnownSupport ? this.classifyInteraction(nearestKnownSupport, bar) : 'NONE',
      resistanceInteraction: nearestKnownResistance
        ? this.classifyInteraction(nearestKnownResistance, bar)
        : 'NONE',
      knownSupport: supports,
      knownResistance: resistances,
    };
  }

  private pushEvent(e: HistoricalLevelEvent): void {
    this.events.push(e);
  }
}

/** Pure helper: detect swing high/low with confirmation delay (for tests). */
export function detectConfirmedPivots(
  bars: HistoricalBarLike[],
  confirmBars: number,
): Array<{ index: number; type: 'HIGH' | 'LOW'; price: number; sourceCandleTime: number; knownAt: number }> {
  const confirm = Math.max(1, confirmBars);
  const out: Array<{
    index: number;
    type: 'HIGH' | 'LOW';
    price: number;
    sourceCandleTime: number;
    knownAt: number;
  }> = [];
  for (let i = confirm; i < bars.length - confirm; i++) {
    const p = bars[i]!;
    const left = bars.slice(i - confirm, i);
    const right = bars.slice(i + 1, i + 1 + confirm);
    const knownAt = right[right.length - 1]!.time;
    const isLow = left.every((b) => p.low <= b.low) && right.every((b) => p.low <= b.low);
    const isHigh = left.every((b) => p.high >= b.high) && right.every((b) => p.high >= b.high);
    if (isLow) {
      out.push({ index: i, type: 'LOW', price: p.low, sourceCandleTime: p.time, knownAt });
    }
    if (isHigh) {
      out.push({ index: i, type: 'HIGH', price: p.high, sourceCandleTime: p.time, knownAt });
    }
  }
  return out;
}

/**
 * Online vs full-dataset no-lookahead check at each T.
 * Returns first mismatch description or null if identical.
 */
export function assertNoLookahead(
  bars: HistoricalBarLike[],
  config: Partial<HistoricalSRConfig> = {},
): string | null {
  const online = new HistoricalSREngine('test', config);
  for (let i = 0; i < bars.length; i++) {
    online.processBar(bars[i]!);
    const t = bars[i]!.time;

    const full = new HistoricalSREngine('test', config);
    full.processAll(bars);
    const atT = full.snapshotAt(t);

    const onlineIds = new Set(
      [...online.snapshotAt(t).knownSupport, ...online.snapshotAt(t).knownResistance].map((l) => l.id),
    );
    const fullIds = new Set([...atT.knownSupport, ...atT.knownResistance].map((l) => l.id));

    if (onlineIds.size !== fullIds.size) {
      return `size mismatch at T=${t}: online=${onlineIds.size} fullSnapshot=${fullIds.size}`;
    }
    for (const id of onlineIds) {
      if (!fullIds.has(id)) return `id ${id} missing in full snapshot at T=${t}`;
    }
    // Full engine must not know levels earlier than online
    for (const l of [...atT.knownSupport, ...atT.knownResistance]) {
      if (l.knownAt > t) return `lookahead: level ${l.id} knownAt ${l.knownAt} > T ${t}`;
    }
  }
  return null;
}
