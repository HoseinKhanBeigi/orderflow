export { MARKET_SEQUENCE_VERSION } from './types.js';
export type {
  ReferenceLevelType,
  SequenceStatus,
  SequenceDirection,
  CurrentStage,
  LocationState,
  SweepState,
  AggressionState,
  PriceResponseState,
  EffortResultState,
  AbsorptionState,
  FailureState,
  ReclaimState,
  ControlState,
  BreakoutState,
  ExpansionState,
  PrimaryLabel,
  LabelStatus,
  ReferenceLevelRef,
  SequenceStages,
  SequenceStageInput,
  ActiveSequence,
  CandleSequenceAnnotation,
} from './types.js';

export {
  DEFAULT_MARKET_SEQUENCE_CONFIG,
  mergeMarketSequenceConfig,
} from './config.js';
export type { MarketSequenceConfig } from './config.js';

export {
  selectPrimaryLabel,
  PRIMARY_LABEL_SHORT,
  PRIMARY_LABEL_FULL,
  deriveEffortResult,
  emptyStages,
} from './label-selector.js';
export type { LabelPick } from './label-selector.js';

export { SequenceStore, makeSequenceId, storeKey } from './sequence-store.js';

export {
  normalizeAbsorptionName,
  mapFailureFromFr,
  mapReclaimFromFr,
  mapControlFromFr,
  aggressionSide,
  priceResponseState,
  resultScore,
  effortScores,
  buildStageInput,
  displacementFromBar,
  deriveEffortFromInput,
} from './adapters.js';
export type { RawBarLike } from './adapters.js';

export {
  processSequenceCandle,
  annotateSequenceReplay,
  sequenceAnnotationTooltip,
  labelBiasColor,
  createSequenceStore,
} from './engine.js';
