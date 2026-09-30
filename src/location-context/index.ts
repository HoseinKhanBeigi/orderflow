export {
  LocationContextEngine,
  evaluateLocationContext,
  applyLevelOutcomes,
  flipBrokenLevel,
  wallsAsExternalLevels,
  fromFootprintBar,
  DEFAULT_LOCATION_CONTEXT_CONFIG,
  LOCATION_CONTEXT_VERSION,
  emptyLocationContext,
  locationTraderLabel,
  distanceBps,
} from './engine.js';
export type {
  LocationContextInput,
  LocationBarLike,
  ExternalLevelInput,
  LocationReactionHints,
  LocationContextSnapshot,
  LocationContextConfig,
  StructuralLevel,
} from './engine.js';
export type {
  LocationContextState,
  ContactType,
  SupportReactionState,
  ResistanceReactionState,
  LocationDataQuality,
  LocationArea,
  LocationLevelView,
  StructuralLevelType,
  StructuralLevelSource,
  StructuralLevelState,
} from '../models/location-context.js';
