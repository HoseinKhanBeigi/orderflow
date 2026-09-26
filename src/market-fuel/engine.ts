import { clamp } from '../core/integrity.js';
import type { MarketFuelConfig } from '../config/types.js';
import type { AggressiveFlowSnapshot, AggressiveSideFlow } from '../models/aggressive-flow.js';
import type {
  FuelComponent,
  FuelComponents,
  FuelDataStatus,
  FuelState,
  MarketFuelSnapshot,
} from '../models/market-fuel.js';
import type { WindowId } from '../models/trade.js';

export interface MarketFuelInput {
  symbol: string;
  window: WindowId;
  now: number;
  aggressiveFlow: AggressiveFlowSnapshot | null;
  /** Short-liquidation notional already summed by the trade window. */
  forcedBuyVolume: number;
  /** Long-liquidation notional already summed by the trade window. */
  forcedSellVolume: number;
  /**
   * `live` — venue liquidation feed is connected (a zero print is observed).
   * `unavailable` — a perp feed was expected and is down (do not treat as zero).
   * `not_expected` — spot or a market with no liquidation channel.
   */
  liquidationFeed: 'live' | 'unavailable' | 'not_expected';
  /** Existing burst detector. Used only as inferred stop-like flow. */
  buyBurst: boolean;
  sellBurst: boolean;
  tradeDataMissing: boolean;
  tradeStale: boolean;
  /** Existing window confidence, 0–1. */
  sampleConfidence: number;
}

interface Sample {
  at: number;
  up: number;
  down: number;
  upVel: number | null;
  downVel: number | null;
}

interface PendingState {
  state: FuelState;
  since: number;
}

const CONTRIB = {
  velocity: 'Execution Velocity',
  intensity: 'Trade Count Intensity',
  large: 'Large Trade Activity',
} as const;

/**
 * Composes existing aggressive-flow scores into directional fuel.
 *
 * Does not read the book. Ask/bid depth, survival, replenishment, and
 * withdrawal stay in PassiveLiquidity / LiquidityResponse / MarketBattle.
 *
 * AggressiveBuyPower already folds volume, velocity, intensity, and large
 * trades. Those normalized contributions are reused here as separate
 * emphasis terms. They are not measured a second time from raw dollars.
 */
export class MarketFuelEngine {
  private readonly history = new Map<WindowId, Sample>();
  private readonly committed = new Map<WindowId, FuelState>();
  private readonly pending = new Map<WindowId, PendingState>();

  constructor(private readonly config: MarketFuelConfig) {}

  snapshot(input: MarketFuelInput): MarketFuelSnapshot {
    if (input.tradeDataMissing || !input.aggressiveFlow) {
      return this.blank(input, 'NO_DATA', 'NO_DATA', 0);
    }

    const buy = input.aggressiveFlow.buy;
    const sell = input.aggressiveFlow.sell;
    const prev = this.history.get(input.window) ?? null;
    const buyAccel = accelerationScore(buy.power, prev ? this.priorPower(input.window, 'buy') : null);
    const sellAccel = accelerationScore(sell.power, prev ? this.priorPower(input.window, 'sell') : null);

    const liqBuy = liquidationStrength(input.forcedBuyVolume, buy.executedVolume, input.liquidationFeed);
    const liqSell = liquidationStrength(input.forcedSellVolume, sell.executedVolume, input.liquidationFeed);
    const stopBuy = input.buyBurst ? this.config.inferredStopScore : null;
    const stopSell = input.sellBurst ? this.config.inferredStopScore : null;

    const w = this.config.weights;
    const upParts = [
      part(buy.hasData ? buy.power : null, w.aggressivePower),
      part(contribution(buy, CONTRIB.velocity), w.velocity),
      part(contribution(buy, CONTRIB.intensity), w.tradeIntensity),
      part(contribution(buy, CONTRIB.large), w.largeStrength),
      part(buyAccel, w.acceleration),
      part(liqBuy, w.liquidation),
      part(stopBuy, w.inferredStop),
    ];
    const downParts = [
      part(sell.hasData ? sell.power : null, w.aggressivePower),
      part(contribution(sell, CONTRIB.velocity), w.velocity),
      part(contribution(sell, CONTRIB.intensity), w.tradeIntensity),
      part(contribution(sell, CONTRIB.large), w.largeStrength),
      part(sellAccel, w.acceleration),
      part(liqSell, w.liquidation),
      part(stopSell, w.inferredStop),
    ];

    const organicUp = blend(upParts.slice(0, 5));
    const organicDown = blend(downParts.slice(0, 5));
    const forcedUp = blend(upParts.slice(5));
    const forcedDown = blend(downParts.slice(5));
    const organicW = w.aggressivePower + w.velocity + w.tradeIntensity + w.largeStrength + w.acceleration;
    const forcedW = w.liquidation + w.inferredStop;
    // A zero forced reading means no forced print. It does not dilute organic fuel.
    const upside = combine(organicUp, forcedUp, organicW, forcedW);
    const downside = combine(organicDown, forcedDown, organicW, forcedW);

    const velocity = this.velocities(input.window, input.now, upside, downside);
    const proposed = classifyState(upside, downside, organicUp, forcedUp, organicDown, forcedDown);
    const state = this.commitState(input.window, proposed, input.now);

    const partial =
      buyAccel == null ||
      sellAccel == null ||
      input.liquidationFeed === 'unavailable' ||
      !buy.hasData ||
      !sell.hasData;
    const dataStatus: FuelDataStatus = input.tradeStale ? 'STALE_DATA' : partial ? 'PARTIAL_DATA' : 'OK';
    let confidence = clamp(input.sampleConfidence, 0, 1) * 100;
    if (input.tradeStale) confidence = Math.min(confidence, 45);
    if (dataStatus === 'PARTIAL_DATA') confidence = Math.min(confidence, 75);
    if (input.buyBurst || input.sellBurst) confidence = Math.min(confidence, 80);

    const snap: MarketFuelSnapshot = {
      symbol: input.symbol,
      window: input.window,
      timestamp: input.now,
      upsideFuel: upside,
      downsideFuel: downside,
      fuelImbalance: upside == null || downside == null ? null : clamp(upside - downside, -100, 100),
      normalizedFuelImbalance:
        upside == null || downside == null ? null : (upside - downside) / Math.max(upside + downside, 1),
      totalFuelIntensity: upside == null && downside == null ? null : Math.max(upside ?? 0, downside ?? 0),
      upsideFuelVelocity: velocity.upVel,
      downsideFuelVelocity: velocity.downVel,
      upsideFuelAcceleration: velocity.upAcc,
      downsideFuelAcceleration: velocity.downAcc,
      state,
      organicUpsideFuel: organicUp,
      forcedUpsideFuel: forcedUp,
      organicDownsideFuel: organicDown,
      forcedDownsideFuel: forcedDown,
      confidence: Math.round(clamp(confidence, 0, 100)),
      dataStatus,
      components: componentsOf({
        buy,
        sell,
        buyAccel,
        sellAccel,
        liqBuy,
        liqSell,
        stopBuy,
        stopSell,
      }),
    };
    this.rememberPower(input.window, buy.power, sell.power);
    return snap;
  }

  /** Last aggressive power seen for this window, used only for the acceleration term. */
  private readonly power = new Map<WindowId, { buy: number; sell: number }>();

  private priorPower(window: WindowId, side: 'buy' | 'sell'): number | null {
    const row = this.power.get(window);
    if (!row) return null;
    return side === 'buy' ? row.buy : row.sell;
  }

  private rememberPower(window: WindowId, buy: number, sell: number): void {
    this.power.set(window, { buy, sell });
  }

  private velocities(
    window: WindowId,
    now: number,
    up: number | null,
    down: number | null,
  ): { upVel: number | null; downVel: number | null; upAcc: number | null; downAcc: number | null } {
    const prev = this.history.get(window);
    if (up == null || down == null) {
      return { upVel: null, downVel: null, upAcc: null, downAcc: null };
    }
    if (!prev) {
      this.history.set(window, { at: now, up, down, upVel: null, downVel: null });
      return { upVel: null, downVel: null, upAcc: null, downAcc: null };
    }
    const dt = Math.max(now - prev.at, 1) / 1000;
    const upVel = clamp((up - prev.up) / dt, -100, 100);
    const downVel = clamp((down - prev.down) / dt, -100, 100);
    const upAcc = prev.upVel == null ? null : clamp(upVel - prev.upVel, -100, 100);
    const downAcc = prev.downVel == null ? null : clamp(downVel - prev.downVel, -100, 100);
    this.history.set(window, { at: now, up, down, upVel, downVel });
    return { upVel, downVel, upAcc, downAcc };
  }

  private commitState(window: WindowId, proposed: FuelState, now: number): FuelState {
    const current = this.committed.get(window);
    if (!current) {
      this.committed.set(window, proposed);
      return proposed;
    }
    if (proposed === current) {
      this.pending.delete(window);
      return current;
    }
    const wait = this.pending.get(window);
    if (!wait || wait.state !== proposed) {
      this.pending.set(window, { state: proposed, since: now });
      if (this.config.statePersistMs <= 0) {
        this.committed.set(window, proposed);
        return proposed;
      }
      return current;
    }
    if (now - wait.since >= this.config.statePersistMs) {
      this.committed.set(window, proposed);
      this.pending.delete(window);
      return proposed;
    }
    return current;
  }

  private blank(
    input: MarketFuelInput,
    state: FuelState,
    dataStatus: FuelDataStatus,
    confidence: number,
  ): MarketFuelSnapshot {
    const missing = (): FuelComponent => ({ value: null });
    return {
      symbol: input.symbol,
      window: input.window,
      timestamp: input.now,
      upsideFuel: null,
      downsideFuel: null,
      fuelImbalance: null,
      normalizedFuelImbalance: null,
      totalFuelIntensity: null,
      upsideFuelVelocity: null,
      downsideFuelVelocity: null,
      upsideFuelAcceleration: null,
      downsideFuelAcceleration: null,
      state,
      organicUpsideFuel: null,
      forcedUpsideFuel: null,
      organicDownsideFuel: null,
      forcedDownsideFuel: null,
      confidence,
      dataStatus,
      components: {
        aggressiveBuyPower: missing(),
        buyVelocity: missing(),
        buyTradeIntensity: missing(),
        largeBuyStrength: missing(),
        buyAcceleration: missing(),
        shortLiquidationStrength: missing(),
        inferredStopBuyFlow: missing(),
        aggressiveSellPower: missing(),
        sellVelocity: missing(),
        sellTradeIntensity: missing(),
        largeSellStrength: missing(),
        sellAcceleration: missing(),
        longLiquidationStrength: missing(),
        inferredStopSellFlow: missing(),
      },
    };
  }
}

function part(value: number | null, weight: number): { value: number | null; weight: number } {
  if (value == null || !Number.isFinite(value)) return { value: null, weight };
  return { value: clamp(value, 0, 100), weight };
}

/** Weighted mean of present components. Missing inputs drop out; they are not zeros. */
function combine(
  organic: number | null,
  forced: number | null,
  organicW: number,
  forcedW: number,
): number | null {
  const useForced = forced != null && forced > 0 && forcedW > 0;
  if (organic == null && !useForced) return null;
  if (!useForced) return organic;
  if (organic == null) return forced;
  const weight = organicW + forcedW;
  if (!(weight > 0)) return organic;
  return clamp((organic * organicW + forced * forcedW) / weight, 0, 100);
}

function blend(parts: Array<{ value: number | null; weight: number }>): number | null {
  let weight = 0;
  let sum = 0;
  for (const p of parts) {
    if (p.value == null || !(p.weight > 0)) continue;
    weight += p.weight;
    sum += p.value * p.weight;
  }
  if (!(weight > 0)) return null;
  return clamp(sum / weight, 0, 100);
}

function contribution(side: AggressiveSideFlow, label: string): number | null {
  if (!side.hasData) return null;
  const row = side.contributions.find((c) => c.label === label);
  return row ? row.normalized : null;
}

/** Positive change in existing aggressive power. Flat or fading adds nothing. */
function accelerationScore(current: number, prior: number | null): number | null {
  if (prior == null) return null;
  const rising = (current - prior) * 2.5;
  if (!(rising > 0)) return null;
  return clamp(rising, 0, 100);
}

function liquidationStrength(
  forced: number,
  executed: number,
  feed: MarketFuelInput['liquidationFeed'],
): number | null {
  if (feed === 'unavailable') return null;
  if (feed === 'not_expected') return null;
  const base = Math.max(executed, forced, 0);
  if (!(base > 0)) return 0;
  return clamp((Math.max(forced, 0) / base) * 100, 0, 100);
}

function classifyState(
  up: number | null,
  down: number | null,
  organicUp: number | null,
  forcedUp: number | null,
  organicDown: number | null,
  forcedDown: number | null,
): FuelState {
  if (up == null || down == null) return 'NO_DATA';
  const gap = up - down;
  const forcedBuy = (forcedUp ?? 0) >= 45 && (forcedUp ?? 0) > (organicUp ?? 0) && gap >= 10;
  const forcedSell = (forcedDown ?? 0) >= 45 && (forcedDown ?? 0) > (organicDown ?? 0) && -gap >= 10;
  if (forcedBuy) return 'FORCED_BUY_FUEL';
  if (forcedSell) return 'FORCED_SELL_FUEL';
  if (up >= 70 && down >= 70 && Math.abs(gap) < 15) return 'TWO_SIDED_HIGH_FUEL';
  if (up >= 75 && gap >= 20) return 'STRONG_UPSIDE_FUEL';
  if (down >= 75 && -gap >= 20) return 'STRONG_DOWNSIDE_FUEL';
  if (up >= 45 && gap >= 12) return 'UPSIDE_FUEL_BUILDING';
  if (down >= 45 && -gap >= 12) return 'DOWNSIDE_FUEL_BUILDING';
  if (up < 35 && down < 35) return 'LOW_FUEL';
  return 'BALANCED_FUEL';
}

function componentsOf(p: {
  buy: AggressiveSideFlow;
  sell: AggressiveSideFlow;
  buyAccel: number | null;
  sellAccel: number | null;
  liqBuy: number | null;
  liqSell: number | null;
  stopBuy: number | null;
  stopSell: number | null;
}): FuelComponents {
  const n = (value: number | null, inferred = false): FuelComponent =>
    value == null ? { value: null } : { value: clamp(value, 0, 100), ...(inferred ? { inferred: true } : {}) };
  return {
    aggressiveBuyPower: n(p.buy.hasData ? p.buy.power : null),
    buyVelocity: n(contribution(p.buy, CONTRIB.velocity)),
    buyTradeIntensity: n(contribution(p.buy, CONTRIB.intensity)),
    largeBuyStrength: n(contribution(p.buy, CONTRIB.large)),
    buyAcceleration: n(p.buyAccel),
    shortLiquidationStrength: n(p.liqBuy),
    inferredStopBuyFlow: p.stopBuy == null ? { value: null, inferred: true } : n(p.stopBuy, true),
    aggressiveSellPower: n(p.sell.hasData ? p.sell.power : null),
    sellVelocity: n(contribution(p.sell, CONTRIB.velocity)),
    sellTradeIntensity: n(contribution(p.sell, CONTRIB.intensity)),
    largeSellStrength: n(contribution(p.sell, CONTRIB.large)),
    sellAcceleration: n(p.sellAccel),
    longLiquidationStrength: n(p.liqSell),
    inferredStopSellFlow: p.stopSell == null ? { value: null, inferred: true } : n(p.stopSell, true),
  };
}
