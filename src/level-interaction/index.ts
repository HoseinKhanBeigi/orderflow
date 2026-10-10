export { LEVEL_INTERACTION_VERSION } from './types.js';
export type {
  InteractionLevelType,
  InteractionLevel,
  FailedBreakState,
  ReclaimState,
  LevelEventType,
  LevelEventStatus,
  CompactLevelLabel,
  FootprintLevelLike,
  InteractionBar,
  LevelEvidence,
  FailureReclaimEvent,
  LevelInteractionEvent,
  LevelEventLine,
  CandleLevelAnnotation,
  LevelInteractionResult,
  ChartViewport,
  ProjectedEventLine,
} from './types.js';
export { LEVEL_EVENT_SHORT, LEVEL_EVENT_PRIORITY, failReclaimLabelY, FAIL_RECLAIM_WICK_GAP } from './types.js';

export {
  DEFAULT_LEVEL_INTERACTION_CONFIG,
  mergeLevelInteractionConfig,
} from './config.js';
export type { LevelInteractionConfig } from './config.js';

export {
  collectEvidence,
  canConfirmAcceptance,
  canConfirmFailure,
  canConfirmReclaim,
  eventConfidence,
  priorAtr,
  penetrationTolerance,
  volumeBeyondLevel,
  farBoundary,
  levelSide,
} from './evidence.js';

export { collectLevelsKnownAt, confirmedSwings, previous15mLevel } from './levels.js';

export { annotateLevelInteractions, formatLevelEventTooltip } from './engine.js';
export type { AnnotateLevelOptions } from './engine.js';

export {
  level,
  mapLevelEventToFailureReclaim,
  compactLabelFor,
  projectLevelEventLine,
  projectFailReclaimLabel,
  resetLevelSeriesKey,
} from './adapters.js';
