/** Direction of one closed 1-minute candle. Not a price target. */
export type NextCandleDirection = 'UP' | 'DOWN' | 'FLAT';

/**
 * Call for the 1-minute candle that is open now.
 * `shown` is false until this setup has enough history and that history agrees.
 */
export interface NextCandleCall {
  shown: boolean;
  direction: 'UP' | 'DOWN' | null;
  /** 0–100. Share of recent candles with this setup that went this way. */
  probability: number | null;
  samples: number;
  note: string;
}

export const NEXT_CANDLE_QUIET: NextCandleCall = {
  shown: false,
  direction: null,
  probability: null,
  samples: 0,
  note: 'Waiting for the next 1-minute candle.',
};
