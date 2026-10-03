export { LOCATION_LABEL_VERSION } from './types.js';
export type {
  LocationLabel,
  PriceZone,
  LocationBarInput,
  LocationAnnotation,
} from './types.js';
export {
  LOCATION_LABEL_SHORT,
  LOCATION_LABEL_COMPACT,
  LOCATION_LABEL_PRIORITY,
} from './types.js';

export {
  DEFAULT_LOCATION_LABEL_CONFIG,
  mergeLocationLabelConfig,
} from './config.js';
export type { LocationLabelConfig } from './config.js';

export {
  collectLocationCandidates,
  pickPrimaryLocation,
  distBpsToZone,
} from './classify.js';

export {
  annotateBarLocation,
  annotateBarsLocation,
  locationDisplayShort,
} from './engine.js';
