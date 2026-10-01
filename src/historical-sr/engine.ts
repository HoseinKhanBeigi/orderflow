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
import {
  appendStrengthHistory,
  computeHistoricalSRStrength,
  DEFAULT_SR_STRENGTH_CONFIG,
  multiTimeframeConfluenceScore,
  reactionFromBar,
  secondsPerBarForTimeframe,
  type HistoricalSRStrengthConfig,
} from './strength.js';

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
export {
  computeHistoricalSRStrength,
  DEFAULT_SR_STRENGTH_CONFIG,
  multiTimeframeConfluenceScore,
  reactionFromBar,
  reactionTrendOf,
  strengthStateLabel,
  strengthStateOf,
  timeframeImportanceScore,
} from './strength.js';
export type {
  HistoricalSRStrengthScore,
  HistoricalSRStrengthConfig,
  HistoricalSRStrengthState,
  HistoricalReactionTrend,
  HistoricalReactionSample,
  StrengthHistoryPoint,
} from './strength.js';

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

function emptyStrengthComponents() {
  return {
    structureSignificance: 0,
    reactionQuality: 0,
    holdQuality: 0,
    recencyScore: 0,
    timeframeScore: 0,
    roleFlipScore: 0,
    confluenceScore: 0,
    weakeningPenalty: 0,
  };
}

function cloneLevel(level: HistoricalLevel): HistoricalLevel {
  return {
    ...level,
    components: { ...level.components },
    strengthComponents: { ...level.strengthComponents },
    reactionHistory: level.reactionHistory.map((r) => ({ ...r })),
    strengthHistory: level.strengthHistory.map((h) => ({ ...h })),
    confluenceTimeframes: [...level.confluenceTimeframes],
  };
}

/** Causal component view — ignores mutations that happened after `timestamp`. */
function componentsAsOf(
  level: HistoricalLevel,
  timestamp: number,
  events: HistoricalLevelEvent[],
): HistoricalLevel['components'] {
  const reactions = (level.reactionHistory ?? []).filter((s) => s.timestamp <= timestamp);
  const held = reactions.filter((s) => s.held && s.kind !== 'BREAK');
  const confirmedAfterCreate = events.filter(
    (e) =>
      e.levelId === level.id &&
      e.type === 'LEVEL_CONFIRMED' &&
      e.timestamp <= timestamp &&
      e.timestamp >= level.knownAt,
  ).length;
  const swingSignificance =
    confirmedAfterCreate > 0
      ? Math.max(level.initialSwingSignificance, 78)
      : level.initialSwingSignificance;

  const rejectionMagnitude =
    held.length > 0
      ? clamp(
          held.reduce((a, s) => a + Math.min(100, s.reactionAtr * 25), 0) / held.length,
          0,
          100,
        )
      : 0;

  return {
    swingSignificance,
    reactionCount: reactions.length,
    rejectionMagnitude,
    recency: 0,
    independentTests: 1 + confirmedAfterCreate + held.length,
  };
}

export class HistoricalSREngine {
  private readonly config: HistoricalSRConfig;
  private readonly strengthConfig: HistoricalSRStrengthConfig;
  private readonly timeframe: string;
  private bars: HistoricalBarLike[] = [];
  private levels: HistoricalLevel[] = [];
  private events: HistoricalLevelEvent[] = [];
  private segments: Map<string, HistoricalLevelSegment> = new Map();
  private lastAtr = 0;
  private lastContext: HistoricalCandleSRContext | null = null;
  /** External TF levels for confluence (not owned / mutated). */
  private externalConfluence: Array<{ price: number; sourceTimeframe: string }> = [];

  constructor(
    timeframe = '15m',
    config: Partial<HistoricalSRConfig> = {},
    strengthConfig: Partial<HistoricalSRStrengthConfig> = {},
  ) {
    this.timeframe = timeframe;
    this.config = { ...DEFAULT_HISTORICAL_SR_CONFIG, ...config };
    this.strengthConfig = {
      ...DEFAULT_SR_STRENGTH_CONFIG,
      ...strengthConfig,
      weights: { ...DEFAULT_SR_STRENGTH_CONFIG.weights, ...(strengthConfig.weights ?? {}) },
      thresholds: { ...DEFAULT_SR_STRENGTH_CONFIG.thresholds, ...(strengthConfig.thresholds ?? {}) },
      secondsPerBarHint:
        strengthConfig.secondsPerBarHint ?? secondsPerBarForTimeframe(timeframe),
    };
  }

  reset(): void {
    this.bars = [];
    this.levels = [];
    this.events = [];
    this.segments.clear();
    this.lastAtr = 0;
    this.lastContext = null;
  }

  /** Register overlapping levels from other timeframes (confluence only). */
  setExternalConfluenceLevels(levels: Array<{ price: number; sourceTimeframe: string }>): void {
    this.externalConfluence = levels.slice();
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
   * Strength at T uses only reactions/history known at T.
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
        if (s.toTime != null && s.toTime < asOf) return true;
        if (!includeBroken && s.broken) return s.toTime != null;
      }
      if (!includeBroken && s.broken && s.toTime == null) return false;
      return true;
    });
  }

  // --- internal ---

  private applyLevelStrength(level: HistoricalLevel, asOf: number, atr: number): void {
    const last = level.lastInteractionAt ?? level.knownAt;
    const idleBars = this.bars.filter((b) => b.time > last && b.time <= asOf).length;
    const scored = computeHistoricalSRStrength({
      level,
      asOf,
      atr,
      barsHint: idleBars,
      config: this.strengthConfig,
    });

    // Preserve pre-break historical score when broken.
    if (level.state === 'BROKEN' && level.historicalStrengthBeforeBreak != null) {
      level.strengthScore = level.historicalStrengthBeforeBreak;
      level.strength = level.historicalStrengthBeforeBreak;
    } else {
      level.strengthScore = scored.strengthScore;
      level.strength = scored.strengthScore;
    }
    level.strengthState = scored.strengthState;
    level.strengthConfidence = scored.strengthConfidence;
    level.reactionTrend = scored.reactionTrend;
    level.strengthComponents = scored.components;
    level.components.reactionCount = scored.testCount;
    level.components.recency = scored.components.recencyScore;
    level.strengthHistory = appendStrengthHistory(level.strengthHistory, {
      timestamp: asOf,
      strength: level.strengthScore,
      state: level.strengthState,
      confidence: level.strengthConfidence,
    });
  }

  private refreshConfluence(level: HistoricalLevel): void {
    const tol = Math.max(this.lastAtr * this.config.clusterAtrFraction, zoneHalfWidth(level.price, this.lastAtr, this.config));
    const result = multiTimeframeConfluenceScore(
      { price: level.price, sourceTimeframe: level.sourceTimeframe },
      this.externalConfluence,
      tol,
    );
    level.multiTimeframeConfluence = result.multiTimeframeConfluence;
    level.confluenceScore = Math.max(level.confluenceScore, result.confluenceScore);
    if (result.multiTimeframeConfluence) {
      level.confluenceTimeframes = result.confluenceTimeframes;
    }
  }

  private levelAsOf(level: HistoricalLevel, timestamp: number): HistoricalLevel {
    const out = cloneLevel(level);
    const breakEvt = this.events.find(
      (e) =>
        e.levelId === level.id &&
        (e.type === 'LEVEL_BROKEN' || e.type === 'LEVEL_FLIPPED') &&
        e.timestamp > timestamp,
    );
    if (breakEvt && level.knownAt <= timestamp) {
      const lastBefore = [...this.events]
        .filter((e) => e.levelId === level.id && e.timestamp <= timestamp)
        .pop();
      if (lastBefore) {
        out.state = lastBefore.stateAfter;
      } else {
        out.state = 'ACTIVE';
      }
      out.historicalStrengthBeforeBreak = null;
    }

    // Causal reaction / strength history only.
    out.reactionHistory = (level.reactionHistory ?? []).filter((s) => s.timestamp <= timestamp);
    out.strengthHistory = (level.strengthHistory ?? []).filter((h) => h.timestamp <= timestamp);
    out.components = componentsAsOf(level, timestamp, this.events);

    const held = out.reactionHistory.filter((s) => s.held && s.kind !== 'BREAK');
    const broken = out.reactionHistory.filter((s) => s.kind === 'BREAK');
    const touchEvents = this.events.filter(
      (e) =>
        e.levelId === level.id &&
        e.timestamp <= timestamp &&
        (e.type === 'LEVEL_TOUCHED' || e.type === 'LEVEL_HELD' || e.type === 'LEVEL_BROKEN'),
    );
    out.touchCount = Math.max(1, touchEvents.length || (out.knownAt <= timestamp ? 1 : 0));
    out.rejectionCount = held.length;
    out.breakCount = broken.length;
    out.lastInteractionAt =
      out.reactionHistory.length > 0
        ? out.reactionHistory[out.reactionHistory.length - 1]!.timestamp
        : null;

    // Confluence: multi-TF registered at creation; same-TF cluster only if confirmed by T.
    const confirmedByT = this.events.filter(
      (e) =>
        e.levelId === level.id &&
        e.type === 'LEVEL_CONFIRMED' &&
        e.timestamp <= timestamp,
    ).length;
    if (level.multiTimeframeConfluence) {
      out.confluenceScore = level.confluenceScore;
    } else {
      out.confluenceScore = confirmedByT > 0 ? 35 : 0;
    }

    const last = out.lastInteractionAt ?? out.knownAt;
    const idleBars = this.bars.filter((b) => b.time > last && b.time <= timestamp).length;
    const scored = computeHistoricalSRStrength({
      level: out,
      asOf: timestamp,
      atr: this.lastAtr,
      barsHint: idleBars,
      config: this.strengthConfig,
    });
    out.strengthScore = scored.strengthScore;
    out.strength = scored.strengthScore;
    out.strengthState = scored.strengthState;
    out.strengthConfidence = scored.strengthConfidence;
    out.reactionTrend = scored.reactionTrend;
    out.strengthComponents = scored.components;
    out.components = {
      ...out.components,
      reactionCount: scored.testCount,
      recency: scored.components.recencyScore,
    };
    return out;
  }

  private confirmNewPivots(now: number): void {
    const confirm = Math.max(1, this.config.pivotConfirmBars);
    const bars = this.bars;
    if (bars.length < confirm * 2 + 1) return;

    const pivotIdx = bars.length - 1 - confirm;
    if (pivotIdx < confirm) return;

    const pivot = bars[pivotIdx]!;
    const left = bars.slice(pivotIdx - confirm, pivotIdx);
    const right = bars.slice(pivotIdx + 1, pivotIdx + 1 + confirm);
    if (left.length < confirm || right.length < confirm) return;

    const knownAt = right[right.length - 1]!.time;
    if (knownAt !== now) return;

    const atr = this.lastAtr;
    const isLow = left.every((b) => pivot.low <= b.low) && right.every((b) => pivot.low <= b.low);
    const isHigh = left.every((b) => pivot.high >= b.high) && right.every((b) => pivot.high >= b.high);

    const confirmClose = right[right.length - 1]!.close;
    const moveAway = atr > 0 ? Math.abs(confirmClose - pivot.low) / atr : 1;
    const moveAwayHigh = atr > 0 ? Math.abs(confirmClose - pivot.high) / atr : 1;

    if (isLow) {
      this.addOrMergeLevel({
        type: 'SUPPORT',
        price: pivot.low,
        source: 'SWING_LOW',
        sourceCandleTime: pivot.time,
        knownAt,
        atr,
        swingSignificance: clamp(42 + moveAway * 18, 40, 95),
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
        swingSignificance: clamp(42 + moveAwayHigh * 18, 40, 95),
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
    swingSignificance: number;
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
      existing.components.swingSignificance = Math.max(
        existing.components.swingSignificance,
        p.swingSignificance,
        78,
      );
      existing.source = 'CLUSTERED_SWING';
      // Same-TF cluster = mild confluence, not multi-TF.
      existing.confluenceScore = Math.max(existing.confluenceScore, 35);
      existing.lastInteractionAt = p.knownAt;
      this.refreshConfluence(existing);
      this.applyLevelStrength(existing, p.knownAt, p.atr);
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
      strengthScore: 0,
      strengthState: 'MODERATE',
      strengthConfidence: 25,
      reactionTrend: 'STABLE',
      strengthComponents: emptyStrengthComponents(),
      reactionHistory: [],
      strengthHistory: [],
      roleFlipCount: 0,
      roleFlipQuality: 0,
      confluenceScore: 0,
      multiTimeframeConfluence: false,
      confluenceTimeframes: [this.timeframe],
      historicalStrengthBeforeBreak: null,
      touchCount: 1,
      rejectionCount: 0,
      breakCount: 0,
      state: 'ACTIVE',
      beyondCloses: 0,
      initialSwingSignificance: p.swingSignificance,
      components: {
        swingSignificance: p.swingSignificance,
        reactionCount: 0,
        rejectionMagnitude: 0,
        recency: 90,
        independentTests: 1,
      },
    };
    this.refreshConfluence(level);
    this.applyLevelStrength(level, p.knownAt, p.atr);
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
      existing.strengthState = level.strengthState;
      existing.strengthConfidence = level.strengthConfidence;
      existing.reactionTrend = level.reactionTrend;
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
      strengthState: level.strengthState,
      strengthConfidence: level.strengthConfidence,
      reactionTrend: level.reactionTrend,
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
      (l) => l.knownAt <= bar.time && l.state !== 'EXPIRED' && l.state !== 'BROKEN',
    );

    for (const level of known) {
      const interaction = this.classifyInteraction(level, bar);
      if (interaction === 'NONE' || interaction === 'APPROACH') continue;

      const stateBefore = level.state;
      level.lastInteractionAt = bar.time;
      level.touchCount +=
        interaction === 'TOUCH' ||
        interaction === 'WICK_TOUCH' ||
        interaction === 'BODY_TOUCH' ||
        interaction === 'CLOSE_IN_ZONE' ||
        interaction === 'REJECTION' ||
        interaction === 'RETEST'
          ? 1
          : 0;

      if (interaction === 'REJECTION') {
        level.rejectionCount += 1;
        const sample = reactionFromBar({
          timestamp: bar.time,
          levelPrice: level.price,
          type: level.type,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          atr,
          held: true,
          kind: 'REJECTION',
        });
        level.reactionHistory.push(sample);
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
          level.historicalStrengthBeforeBreak = level.strengthScore;
          level.reactionHistory.push(
            reactionFromBar({
              timestamp: bar.time,
              levelPrice: level.price,
              type: level.type,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              atr,
              held: false,
              kind: 'BREAK',
            }),
          );
          level.state = 'BROKEN';
          this.applyLevelStrength(level, bar.time, atr);
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
        // Weak touch / stall — record low-quality sample so touch-count alone cannot inflate strength.
        if (
          interaction === 'WICK_TOUCH' ||
          interaction === 'BODY_TOUCH' ||
          interaction === 'CLOSE_IN_ZONE' ||
          interaction === 'TOUCH' ||
          interaction === 'RETEST'
        ) {
          level.reactionHistory.push(
            reactionFromBar({
              timestamp: bar.time,
              levelPrice: level.price,
              type: level.type,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              atr,
              held: interaction === 'RETEST',
              kind: 'WEAK_BOUNCE',
            }),
          );
        }
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
        this.applyLevelStrength(level, bar.time, atr);
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
      zoneLow: broken.price - half,
      zoneHigh: broken.price + half,
      source: 'FLIPPED',
      sourceTimeframe: this.timeframe,
      sourceCandleTime: broken.sourceCandleTime,
      knownAt: bar.time,
      createdAt: bar.time,
      firstSeenAt: bar.time,
      lastInteractionAt: bar.time,
      strength: 0,
      strengthScore: 0,
      strengthState: 'MODERATE',
      strengthConfidence: 30,
      reactionTrend: 'STABLE',
      strengthComponents: emptyStrengthComponents(),
      reactionHistory: [],
      strengthHistory: [],
      roleFlipCount: 1,
      roleFlipQuality: clamp(broken.historicalStrengthBeforeBreak ?? broken.strengthScore, 40, 95),
      confluenceScore: broken.confluenceScore * 0.5,
      multiTimeframeConfluence: broken.multiTimeframeConfluence,
      confluenceTimeframes: [...broken.confluenceTimeframes],
      historicalStrengthBeforeBreak: null,
      touchCount: 0,
      rejectionCount: 0,
      breakCount: 0,
      state: flippedState,
      beyondCloses: 0,
      initialSwingSignificance: 70,
      components: {
        swingSignificance: 70,
        reactionCount: 0,
        rejectionMagnitude: broken.components.rejectionMagnitude * 0.5,
        recency: 95,
        independentTests: 1,
      },
    };
    this.refreshConfluence(level);
    this.applyLevelStrength(level, bar.time, atr);
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
      const idle = this.bars.filter((b) => b.time > last && b.time <= now).length;
      this.applyLevelStrength(level, now, atr);
      if (idle >= this.config.decayIdleBars && level.strength < 28) {
        const before = level.state;
        level.state = 'EXPIRED';
        level.strengthState = 'BROKEN';
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
      } else if (idle >= this.config.decayIdleBars && (level.state === 'TESTED' || level.state === 'ACTIVE')) {
        level.state = 'WEAKENING';
        this.upsertSegment(level);
      } else {
        this.upsertSegment(level);
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
        weak.strengthState = 'BROKEN';
        this.upsertSegment(weak);
      }
    }
  }

  private buildCandleContext(bar: HistoricalBarLike): HistoricalCandleSRContext {
    const known = this.levels.filter((l) => l.knownAt <= bar.time).map((l) => this.levelAsOf(l, bar.time));
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
      supportStrength: nearestKnownSupport?.strengthScore ?? null,
      supportStrengthState: nearestKnownSupport?.strengthState ?? null,
      resistanceStrength: nearestKnownResistance?.strengthScore ?? null,
      resistanceStrengthState: nearestKnownResistance?.strengthState ?? null,
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
    for (const l of [...atT.knownSupport, ...atT.knownResistance]) {
      if (l.knownAt > t) return `lookahead: level ${l.id} knownAt ${l.knownAt} > T ${t}`;
    }
    // Strength at T must not exceed online engine's causal strength for same id.
    for (const l of [...atT.knownSupport, ...atT.knownResistance]) {
      const onlineLevel = [...online.snapshotAt(t).knownSupport, ...online.snapshotAt(t).knownResistance].find(
        (x) => x.id === l.id,
      );
      if (!onlineLevel) continue;
      if (Math.abs(onlineLevel.strengthScore - l.strengthScore) > 2) {
        return `strength lookahead at T=${t} id=${l.id}: online=${onlineLevel.strengthScore} snap=${l.strengthScore}`;
      }
    }
  }
  return null;
}
