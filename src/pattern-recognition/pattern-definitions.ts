import type { PatternDefinition } from './pattern-types.js';

export const PATTERN_LIBRARY_VERSION = 2;

/**
 * Pattern stages query structured dimensions (control / liquidity / specialEvent)
 * independently. Flat `labels` remain as a fallback for fixtures that only set `label`.
 */
export const PATTERN_DEFINITIONS: PatternDefinition[] = [
  {
    id: 'BULLISH_LIQUIDITY_REVERSAL',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BULLISH',
    title: 'Bullish Liquidity Reversal',
    badge: 'BR',
    minBars: 4,
    maxBars: 6,
    specificity: 80,
    supersedes: ['SELLER_TRAP_FORMING'],
    minFormingStages: 2,
    failWhen: {
      minStage: 2,
      control: ['SELLER_IN_CONTROL'],
      specialEvent: ['BUYER_ABSORBED'],
      labels: ['SELLER_IN_CONTROL', 'BUYER_ABSORBED'],
    },
    stages: [
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'], repeat: true },
      { liquidity: ['BIDS_PULLED'], labels: ['BIDS_PULLED'], optional: true },
      { specialEvent: ['STOP_HUNT_LOW'], labels: ['STOP_HUNT_LOW'] },
      { liquidity: ['BIDS_PULLED'], labels: ['BIDS_PULLED'], optional: true },
      { specialEvent: ['SELLER_ABSORBED'], labels: ['SELLER_ABSORBED'] },
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'] },
    ],
  },
  {
    id: 'BEARISH_LIQUIDITY_REVERSAL',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BEARISH',
    title: 'Bearish Liquidity Reversal',
    badge: 'ER',
    minBars: 4,
    maxBars: 6,
    specificity: 80,
    supersedes: ['BUYER_TRAP_FORMING'],
    minFormingStages: 2,
    failWhen: {
      minStage: 2,
      control: ['BUYER_IN_CONTROL'],
      specialEvent: ['SELLER_ABSORBED'],
      labels: ['BUYER_IN_CONTROL', 'SELLER_ABSORBED'],
    },
    stages: [
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'], repeat: true },
      { liquidity: ['ASKS_PULLED'], labels: ['ASKS_PULLED'], optional: true },
      { specialEvent: ['STOP_HUNT_HIGH'], labels: ['STOP_HUNT_HIGH'] },
      { liquidity: ['ASKS_PULLED'], labels: ['ASKS_PULLED'], optional: true },
      { specialEvent: ['BUYER_ABSORBED'], labels: ['BUYER_ABSORBED'] },
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'] },
    ],
  },
  {
    id: 'BULLISH_CONTINUATION',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BULLISH',
    title: 'Bullish Continuation',
    badge: 'BC',
    minBars: 3,
    maxBars: 6,
    specificity: 50,
    minFormingStages: 2,
    failWhen: {
      minStage: 2,
      control: ['SELLER_IN_CONTROL'],
      specialEvent: ['BUYER_ABSORBED'],
      labels: ['SELLER_IN_CONTROL', 'BUYER_ABSORBED'],
    },
    stages: [
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'], repeat: true },
      { liquidity: ['ASKS_PULLED'], labels: ['ASKS_PULLED'], repeat: true },
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'], repeat: true },
    ],
  },
  {
    id: 'BEARISH_CONTINUATION',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BEARISH',
    title: 'Bearish Continuation',
    badge: 'SC',
    minBars: 3,
    maxBars: 6,
    specificity: 50,
    minFormingStages: 2,
    failWhen: {
      minStage: 2,
      control: ['BUYER_IN_CONTROL'],
      specialEvent: ['SELLER_ABSORBED'],
      labels: ['BUYER_IN_CONTROL', 'SELLER_ABSORBED'],
    },
    stages: [
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'], repeat: true },
      { liquidity: ['BIDS_PULLED'], labels: ['BIDS_PULLED'], repeat: true },
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'], repeat: true },
    ],
  },
  {
    id: 'FAILED_BEARISH_REVERSAL',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BULLISH',
    title: 'Failed Bearish Reversal',
    badge: 'FB',
    minBars: 3,
    maxBars: 5,
    specificity: 70,
    minFormingStages: 2,
    failWhen: { minStage: 2, control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'] },
    stages: [
      { specialEvent: ['STOP_HUNT_HIGH'], labels: ['STOP_HUNT_HIGH'] },
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'], repeat: true },
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'] },
    ],
  },
  {
    id: 'FAILED_BULLISH_REVERSAL',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BEARISH',
    title: 'Failed Bullish Reversal',
    badge: 'FU',
    minBars: 3,
    maxBars: 5,
    specificity: 70,
    minFormingStages: 2,
    failWhen: { minStage: 2, control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'] },
    stages: [
      { specialEvent: ['STOP_HUNT_LOW'], labels: ['STOP_HUNT_LOW'] },
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'], repeat: true },
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'] },
    ],
  },
  {
    id: 'BUYER_TRAP_FORMING',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BEARISH',
    title: 'Buyer Trap Forming',
    badge: 'BT',
    minBars: 3,
    maxBars: 6,
    specificity: 40,
    completesOnMatch: false,
    minFormingStages: 3,
    failWhen: { minStage: 2, control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'] },
    stages: [
      { control: ['BUYER_IN_CONTROL'], labels: ['BUYER_IN_CONTROL'], repeat: true },
      { liquidity: ['ASKS_PULLED'], labels: ['ASKS_PULLED'], optional: true },
      { specialEvent: ['STOP_HUNT_HIGH'], labels: ['STOP_HUNT_HIGH'] },
      { liquidity: ['ASKS_PULLED'], labels: ['ASKS_PULLED'], optional: true },
      { specialEvent: ['BUYER_ABSORBED'], labels: ['BUYER_ABSORBED'] },
    ],
  },
  {
    id: 'SELLER_TRAP_FORMING',
    version: PATTERN_LIBRARY_VERSION,
    direction: 'BULLISH',
    title: 'Seller Trap Forming',
    badge: 'SR',
    minBars: 3,
    maxBars: 6,
    specificity: 40,
    completesOnMatch: false,
    minFormingStages: 3,
    failWhen: { minStage: 2, control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'] },
    stages: [
      { control: ['SELLER_IN_CONTROL'], labels: ['SELLER_IN_CONTROL'], repeat: true },
      { liquidity: ['BIDS_PULLED'], labels: ['BIDS_PULLED'], optional: true },
      { specialEvent: ['STOP_HUNT_LOW'], labels: ['STOP_HUNT_LOW'] },
      { liquidity: ['BIDS_PULLED'], labels: ['BIDS_PULLED'], optional: true },
      { specialEvent: ['SELLER_ABSORBED'], labels: ['SELLER_ABSORBED'] },
    ],
  },
];

export function patternVersionTag(id: string, version: number): string {
  return `${id}:v${version}`;
}

export function requiredStageCount(def: PatternDefinition): number {
  return def.stages.filter((s) => !s.optional).length;
}
