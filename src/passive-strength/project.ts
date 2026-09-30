import type { PassiveLiquidityDataQuality, PassiveLiquidityLevel, PassiveLiquidityWall, PassiveSideMetrics } from '../models/passive-liquidity.js';
import type { NetLiquiditySnapshot } from '../models/passive-liquidity.js';
import type { LiquidityBandBucket } from '../models/passive-liquidity.js';
import {
  emptySideComponents,
  type PassiveSideComponents,
  type PassiveStrengthDataStatus,
  type WallStrengthRef,
} from '../models/passive-strength.js';

const APPROACH_BPS = 10;

/**
 * Reads scores the passive-liquidity engine already computed.
 * Survival is the share of approached liquidity that is still there.
 */
export function projectSideComponents(
  metrics: PassiveSideMetrics,
  levels: PassiveLiquidityLevel[],
  walls: PassiveLiquidityWall[],
  bands: LiquidityBandBucket[],
): PassiveSideComponents {
  const side = metrics.side;
  const components = emptySideComponents();
  components.nearTouchScore = finite(metrics.nearDepthPercentile);
  components.consumptionScore = finite(metrics.consumedPercentile);
  components.replenishmentScore = finite(metrics.replenishedPercentile);
  components.cancellationScore = finite(metrics.cancelledPercentile);
  components.withdrawalScore = finite(metrics.withdrawalScore);
  components.persistenceScore = finite(metrics.persistenceScore);

  const own = levels.filter((level) => level.side === side && !level.outOfView);
  const tested = own.filter((level) =>
    level.closestApproachBps != null &&
    level.closestApproachBps <= APPROACH_BPS &&
    level.initialNotional > 0 &&
    (level.approachCheckpoints?.length ?? 0) > 0,
  );
  if (tested.length) {
    const initial = tested.reduce((sum, level) => sum + level.initialNotional, 0);
    const current = tested.reduce((sum, level) => sum + level.notionalValue, 0);
    components.survivalObserved = true;
    components.survivalScore = initial > 0 ? Math.max(0, Math.min(100, (current / initial) * 100)) : null;
  }
  components.approachWithdrawal = tested.some((level) => level.approachWithdrawal);

  const sideWalls = walls.filter((wall) => wall.side === side && wall.notional > 0);
  if (sideWalls.length) {
    const notional = sideWalls.reduce((sum, wall) => sum + wall.notional, 0);
    components.reliabilityScore = notional > 0
      ? sideWalls.reduce((sum, wall) => sum + wall.reliability * wall.notional, 0) / notional
      : null;
  }

  const depth = metrics.depthNotional;
  const gross = metrics.addedNotional + metrics.replenishedNotional + metrics.cancelledNotional + metrics.consumedNotional;
  components.churnRatio = depth > 0 ? gross / depth : null;

  const near = bandNotional(bands, side, 5);
  const wide = bandNotional(bands, side, 100);
  components.nearTouchConcentration = wide > 0 ? near / wide : null;
  return components;
}

/** Depth percentile is supplied by the caller because it lives on the normalizer, not the side metrics. */
export function withDepthScore(components: PassiveSideComponents, depthPercentile: number | null): PassiveSideComponents {
  return { ...components, depthScore: finite(depthPercentile) };
}

function finite(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

export function dataStatusOf(quality: PassiveLiquidityDataQuality): PassiveStrengthDataStatus {
  if (quality.observations <= 0 || quality.reasons.some((reason) => reason.includes('no order book') || reason.includes('no book snapshot'))) {
    return 'NO_DATA';
  }
  if (quality.reasons.some((reason) => reason.startsWith('book stale'))) return 'STALE_DATA';
  if (!quality.trustworthy) return 'LOW_CONFIDENCE';
  if (quality.reasons.some((reason) => reason === 'warming up' || reason === 'limited history')) return 'PARTIAL_DATA';
  return 'OK';
}

export function reconciliationOf(net: NetLiquiditySnapshot): number | null {
  const bid = net.bid?.reconciliationErrorPercent;
  const ask = net.ask?.reconciliationErrorPercent;
  const values = [bid, ask].filter((value): value is number => value != null && Number.isFinite(value));
  if (!values.length) return null;
  return Math.max(...values);
}

export function strongestWall(walls: PassiveLiquidityWall[], side: 'BID' | 'ASK'): WallStrengthRef | null {
  const own = walls.filter((wall) => wall.side === side);
  if (!own.length) return null;
  const best = own.reduce((top, wall) => (wall.strength > top.strength ? wall : top));
  return {
    price: best.price,
    strength: best.strength,
    reliability: best.reliability,
    lifecycle: best.lifecycle,
  };
}

function bandNotional(bands: LiquidityBandBucket[], side: 'BID' | 'ASK', maxBps: number): number {
  return bands
    .filter((band) => band.toBps <= maxBps)
    .reduce((sum, band) => sum + (side === 'BID' ? band.bidNotional : band.askNotional), 0);
}
