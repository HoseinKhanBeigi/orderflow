import type { NextCandleCall, NextCandleDirection } from './types.js';
import { NEXT_CANDLE_QUIET } from './types.js';
import type { NextCandleFeatures } from './features.js';

/** A move smaller than this, as a fraction of price, counts as a flat candle. */
const FLAT_RETURN = 0.00015;
/** |score| below this has no lean, so the model stays quiet. */
const SCORE_LEAN = 0.35;
const MIN_SAMPLES = 12;
/** Leading direction must be at least this share of recent candles. */
const MIN_HIT_RATE = 0.58;
/** Leading direction must beat the next one by this much. */
const MIN_MARGIN = 0.12;
const HISTORY_CAP = 40;
/** After this many shown calls, a setup below half right is hidden. */
const GRADE_MIN = 8;
const GRADE_CAP = 12;
const GRADE_FLOOR = 0.5;

interface PendingShown {
  bucket: string;
  direction: 'UP' | 'DOWN';
}

/**
 * Session memory for one symbol.
 * Updates once per minute. The call does not change on every trade.
 */
export class NextCandleModel {
  private lastMinute: number | null = null;
  private boundaryPrice: number | null = null;
  private pendingBucket: string | null = null;
  private pendingShown: PendingShown | null = null;
  private readonly history = new Map<string, NextCandleDirection[]>();
  private readonly grades = new Map<string, boolean[]>();
  private call: NextCandleCall = NEXT_CANDLE_QUIET;

  current(): NextCandleCall {
    return this.call;
  }

  observe(features: NextCandleFeatures, price: number, now: number): NextCandleCall {
    const minute = Math.floor(now / 60_000);
    if (this.lastMinute == null) {
      this.lastMinute = minute;
      this.boundaryPrice = price > 0 ? price : null;
      this.call = NEXT_CANDLE_QUIET;
      return this.call;
    }
    if (minute === this.lastMinute) return this.call;
    if (minute < this.lastMinute) return this.call;

    const actual =
      this.boundaryPrice != null && price > 0
        ? directionOf(this.boundaryPrice, price)
        : null;
    if (actual && this.pendingBucket) {
      pushCapped(this.history, this.pendingBucket, actual, HISTORY_CAP);
    }
    if (actual && this.pendingShown) {
      const hit = actual === this.pendingShown.direction;
      pushCapped(this.grades, this.pendingShown.bucket, hit, GRADE_CAP);
    }

    this.lastMinute = minute;
    this.boundaryPrice = price > 0 ? price : null;
    this.pendingBucket = null;
    this.pendingShown = null;

    if (!features.ok) {
      this.call = {
        shown: false,
        direction: null,
        probability: null,
        samples: 0,
        note: 'Waiting for trades.',
      };
      return this.call;
    }

    const bucket = bucketOf(features);
    this.pendingBucket = bucket;
    const outcomes = this.history.get(bucket) ?? [];
    this.call = decide(features, bucket, outcomes, this.grades.get(bucket) ?? []);
    if (this.call.shown && this.call.direction) {
      this.pendingShown = { bucket, direction: this.call.direction };
    }
    return this.call;
  }
}

function bucketOf(features: NextCandleFeatures): string {
  if (Math.abs(features.score) < SCORE_LEAN) return 'EVEN';
  const up = features.score > 0;
  const agrees = Math.abs(features.book) < 0.15 || (features.book > 0) === up;
  return `${up ? 'UP' : 'DOWN'}|${agrees ? 'WITH' : 'AGAINST'}`;
}

function decide(
  features: NextCandleFeatures,
  bucket: string,
  outcomes: readonly NextCandleDirection[],
  grades: readonly boolean[],
): NextCandleCall {
  const samples = outcomes.length;
  if (bucket === 'EVEN') {
    return {
      shown: false,
      direction: null,
      probability: null,
      samples,
      note: 'Fuel and the book do not lean, so the next candle stays quiet.',
    };
  }

  const direction: 'UP' | 'DOWN' = features.score > 0 ? 'UP' : 'DOWN';
  const quiet = (note: string): NextCandleCall => ({
    shown: false,
    direction: null,
    probability: null,
    samples,
    note,
  });

  if (samples < MIN_SAMPLES) {
    return quiet(`This setup has happened ${samples} times. It shows after ${MIN_SAMPLES}.`);
  }

  const share = count(outcomes, direction) / samples;
  const others = (['UP', 'DOWN', 'FLAT'] as const).filter((d) => d !== direction);
  const second = Math.max(...others.map((d) => count(outcomes, d) / samples));
  const word = direction === 'UP' ? 'up' : 'down';
  const hits = Math.round(share * samples);

  if (grades.length >= GRADE_MIN) {
    const right = grades.filter(Boolean).length;
    if (right / grades.length < GRADE_FLOOR) {
      return quiet(
        `Recent calls for this setup were right ${right} of ${grades.length} times, so it stays quiet.`,
      );
    }
  }

  if (share < MIN_HIT_RATE) {
    return quiet(`This setup was ${word} only ${hits} of ${samples} times, so it stays quiet.`);
  }
  if (share - second < MIN_MARGIN) {
    return quiet('This setup does not lead by enough, so it stays quiet.');
  }

  return {
    shown: true,
    direction,
    probability: Math.round(share * 100),
    samples,
    note: `Next 1-minute candle. This setup was followed by an ${word} candle ${hits} of ${samples} times.`,
  };
}

function directionOf(start: number, end: number): NextCandleDirection {
  const ret = (end - start) / start;
  if (Math.abs(ret) < FLAT_RETURN) return 'FLAT';
  return end > start ? 'UP' : 'DOWN';
}

function count(outcomes: readonly NextCandleDirection[], direction: NextCandleDirection): number {
  let n = 0;
  for (const item of outcomes) if (item === direction) n += 1;
  return n;
}

function pushCapped<T>(map: Map<string, T[]>, key: string, value: T, cap: number): void {
  const list = map.get(key) ?? [];
  list.push(value);
  if (list.length > cap) list.shift();
  map.set(key, list);
}
