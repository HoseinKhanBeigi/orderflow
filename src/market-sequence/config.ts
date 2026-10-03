export interface MarketSequenceConfig {
  maxBarsBetweenStages: number;
  maxSequenceBars: number;
  effortHigh: number;
  resultStrong: number;
  resultWeak: number;
  expansionDispBps: number;
  maxActiveSequences: number;
}

export const DEFAULT_MARKET_SEQUENCE_CONFIG: MarketSequenceConfig = {
  maxBarsBetweenStages: 8,
  maxSequenceBars: 24,
  effortHigh: 62,
  resultStrong: 55,
  resultWeak: 28,
  expansionDispBps: 18,
  maxActiveSequences: 32,
};

export function mergeMarketSequenceConfig(
  partial?: Partial<MarketSequenceConfig>,
): MarketSequenceConfig {
  return { ...DEFAULT_MARKET_SEQUENCE_CONFIG, ...(partial ?? {}) };
}
