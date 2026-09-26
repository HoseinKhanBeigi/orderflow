export { PATTERN_ENGINE_VERSION, CANDLE_LABELS } from './pattern-types.js';
export type {
  CandleLabel,
  PatternId,
  PatternDirection,
  PatternStatus,
  PatternAlertType,
  PatternStageDef,
  PatternDefinition,
  LabeledCandle,
  ConfidenceComponents,
  PatternEvidence,
  PatternCandidate,
  PatternAlert,
  PatternEvent,
  PatternOutcome,
  PatternMarker,
  PatternSnapshot,
  PatternEngineOptions,
  NextStateStatus,
  PredictionConfidenceBand,
  NextStatePrediction,
  DimensionPrediction,
  CurrentPatternView,
  PredictorOptions,
  TransitionFeatureBuckets,
  CandleClassification,
  ControlState,
  DominantLiquidityEvent,
  SpecialEventType,
  LiquidityBehaviorState,
  OutcomeType,
  OutcomeDirection,
  ClassificationDataQuality,
} from './pattern-types.js';

export { PATTERN_DEFINITIONS, PATTERN_LIBRARY_VERSION, patternVersionTag } from './pattern-definitions.js';
export { PatternRecognitionEngine, replayPatterns, recognizeFromCandles, minutesToTimeframe, timeframeToSeconds, toPatternMarker } from './pattern-recognition-engine.js';
export {
  labelFootprintBar,
  labelFootprintBars,
  labeledCandle,
  classificationFromFlatLabel,
  metricsFromWindowSnapshot,
} from './candle-label-adapter.js';
export {
  classifyCandleStructure,
  classifyBarLegacy,
  pickDominantLiquidityEvent,
  stateFromScore,
  emptyClassification,
  barWinner,
  barAbsorbed,
  vacuumKind,
  stopHuntKind,
} from './candle-classification.js';
export { recognizeFootprintBars, labeledHistory, historyPatternView, PATTERN_TF_MINUTES } from './from-bars.js';
export { PatternLiveHub } from './live-hub.js';
export { matchPatternWindow, bestMatchForDefinition, pickPrimary, candleMatchesStage } from './pattern-matcher.js';
export { scorePatternConfidence } from './pattern-confidence.js';
export { NextFootprintStatePredictor, DEFAULT_PREDICTOR_OPTIONS, toCurrentPattern } from './next-state-predictor.js';
export { TransitionTable, isCandleLabel, normalizeLabel, MAX_SEQUENCE_DEPTH } from './transition-table.js';
export { PredictionEvaluation, CALIBRATION_BUCKETS } from './prediction-eval.js';
export { auditLabelDistribution, compareClassificationDistributions } from './label-audit.js';
