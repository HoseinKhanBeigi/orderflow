var process = globalThis.process || { env: {} };
"use strict";
(() => {
  // src/config/defaults.ts
  var DEFAULT_CONFIG = {
    windows: ["1s", "5s", "10s", "30s", "1m", "5m", "15m"],
    bucketMs: 100,
    /** 100ms × 9_000 = 15m coverage for the longest configured window. */
    maxBuckets: 9e3,
    tapeCapacity: 2e3,
    largeTradeThresholds: {
      tier1: 1e5,
      tier2: 5e5,
      tier3: 1e6,
      tier4: 5e6
    },
    relative: {
      sampleSize: 4096,
      largePercentile: 95,
      veryLargePercentile: 99,
      extremePercentile: 99.9,
      minStdDevQuote: 1
    },
    burst: {
      maxGapMs: 3e3,
      minTradeCount: 5,
      minTotalQuoteValue: 1e6,
      minSameSideShare: 0.8,
      strengthVolumeWeight: 0.35,
      strengthCountWeight: 0.2,
      strengthTightnessWeight: 0.2,
      strengthRelativeWeight: 0.15,
      strengthMoveWeight: 0.1
    },
    cluster: {
      maxGapMs: 5e3,
      maxPriceRangeBps: 3,
      minTradeCount: 4,
      minTotalQuoteValue: 5e5
    },
    persistent: {
      minSameSideDeltaPercent: 0.45,
      minTradeCount: 12,
      minFlowMultiple: 2,
      minDurationMs: 5e3
    },
    absorption: {
      minAbsDeltaQuote: 5e6,
      minDeltaPercent: 0.35,
      maxPriceChangePercent: 0.08,
      minFlowMultiple: 3,
      minBurstOrPersistent: false,
      replenishmentBoost: 0.15,
      samePriceBoost: 0.1,
      minStrength: 0.55,
      minConfidence: 0.5
    },
    samePrice: {
      maxPriceDeviationBps: 0.5,
      minTradeCount: 4,
      minTotalQuoteValue: 1e6
    },
    iceberg: {
      minAggressiveOverVisible: 4,
      minAggressiveQuote: 25e4
    },
    priceImpact: {
      sampleSize: 512,
      lowRatioOfMedian: 0.4,
      highRatioOfMedian: 2,
      extremeRatioOfMedian: 5,
      minAbsDeltaQuote: 5e4
    },
    vacuum: {
      minPressure: 3,
      minPriceChangePercent: 0.4,
      maxFlowMultiple: 2.5,
      minImpact: "HIGH"
    },
    exhaustion: {
      requiredPriorAcceleration: "MODERATE",
      minDecelerationDrop: 0.5
    },
    pressure: {
      nearBandPct: 0.25,
      thinAskQuote: 5e5,
      thinBidQuote: 5e5
    },
    directionalWeights: {
      deltaPercent: 0.28,
      largeFlowShare: 0.16,
      burst: 0.12,
      persistence: 0.12,
      cvdSlope: 0.1,
      consumption: 0.1,
      priceResponse: 0.12
    },
    participantWeights: {
      largeTradeFrequency: 0.12,
      largeTradeVolume: 0.16,
      relativePercentile: 0.14,
      burstPersistence: 0.14,
      sameSideDominance: 0.12,
      largeFlowShare: 0.12,
      priceResponse: 0.1,
      liquidityConsumption: 0.1
    },
    confidence: {
      lowVolume: 0.25,
      staleBook: 0.3,
      missingData: 0.35,
      contradictoryPrice: 0.2,
      rapidFlip: 0.25,
      wideSpread: 0.2,
      reconnect: 0.4,
      sequenceGap: 0.35
    },
    alerts: {
      extremeBurstQuote: 2e7,
      netFlow10sQuote: 1e8
    },
    integrity: {
      maxOutOfOrderMs: 2e3,
      bookStaleMs: 5e3,
      maxSpreadBps: 50,
      duplicateWindow: 8192
    },
    movePotential: {
      percentSteps: [0.15, 0.35, 0.7, 1.4, 2.1, 2.8],
      atrMultiples: [0.25, 0.5, 1, 1.5, 2, 3],
      maxTargetsPerSide: 6,
      nearbyBandPct: 0.35,
      minAtrPctOfPrice: 0.15,
      densityThinRatio: 0.5,
      densityThickRatio: 2,
      densityExtremeRatio: 4,
      pressureModerate: 0.6,
      pressureStrong: 1,
      pressureVeryStrong: 1.5,
      reachability: {
        flowToLiquidity: 0.35,
        flowAcceleration: 0.1,
        liquidityConsumption: 0.1,
        liquidityPulling: 0.05,
        liquidationAcceleration: 0.05,
        priceEfficiency: 0.15,
        volatilityDistance: 0.15,
        structuralAlignment: 0.05
      },
      easyScore: 75,
      moderateScore: 55,
      difficultScore: 35,
      veryDifficultScore: 20,
      directionNeutralBand: 0.12,
      wallMultiple: 4,
      wallMinPercentile: 80,
      wallLookaround: 4,
      wallDropFraction: 0.5,
      vacuumDensityRatio: 0.35,
      pullUnexplainedFraction: 0.55
    },
    flowBattle: {
      minAttackQuote: 1e6,
      consumeOverReplenish: 1.5,
      replenishOverConsume: 1.1,
      minDefenseScore: 55,
      minFailureConfidence: 0.55,
      zoneBps: 5,
      minExecutionToVisible: 4
    },
    marketBattle: {
      aggressiveWeights: {
        executedVolume: 0.25,
        executionVelocity: 0.2,
        imbalanceStrength: 0.2,
        largeTradeActivity: 0.15,
        tradeCountIntensity: 0.1,
        deltaCvdContribution: 0.1
      },
      imbalanceRatio: 3,
      minImbalanceQuote: 800,
      tradeStaleMs: 15e3,
      tradeStaleGapMultiple: 15,
      maxTradeStaleMs: 18e4
    },
    marketFuel: {
      weights: {
        aggressivePower: 0.34,
        velocity: 0.16,
        tradeIntensity: 0.12,
        largeStrength: 0.12,
        acceleration: 0.1,
        liquidation: 0.1,
        inferredStop: 0.06
      },
      statePersistMs: 1500,
      inferredStopScore: 62
    },
    candleClassification: {
      minimumDominanceScore: 70,
      minimumDominanceMargin: 15,
      minimumDominancePercentile: 70,
      stateBuckets: {
        low: 25,
        normal: 50,
        elevated: 70,
        strong: 85
      },
      strongControlConfidence: 0.55,
      strongSpecialEventConfidence: 0.55,
      headlineLiquidityStates: ["STRONG", "EXTREME"]
    },
    tradeDecision: {
      buyerControlMin: 60,
      sellerControlMin: 60,
      fuelMin: 60,
      fuelEdgeMin: 10,
      opposingDefenseMax: 50,
      liquidityWeakeningMin: 70,
      opposingReplenishmentMax: 50,
      opposingSurvivalMax: 50,
      patternSupportBonus: 8,
      fuelVelocityWeight: 0.4
    },
    liquidityResponse: {
      bandPct: 0.25,
      bands: [0.05, 0.1, 0.25, 0.5, 1],
      normWindows: [20, 50, 100],
      defaultNormWindow: 50,
      impactHorizonsMs: [0, 5e3, 3e4, 6e4, 3e5],
      replenishRepeatMin: 2,
      largeAggressionPercentile: 80,
      extremeAggressionPercentile: 92,
      weakDisplacementPercentile: 40,
      strongDisplacementPercentile: 70,
      nearTouchShare: 0.5,
      vacuumPullShare: 0.45,
      vacuumSpreadExpandBps: 1.5,
      minBookTicks: 4,
      minuteCapacity: 400,
      markTtlMs: 8e3,
      minImpactQuote: 5e4,
      atrPeriod: 14,
      persistMs: 4e3,
      persistMinStrength: 0.62,
      defendEscalateCount: 2,
      highConfidenceMinQuality: 55,
      oiThresholdPercent: 0.05,
      unexplainedDropPercent: 80,
      minConsistencyForHigh: 60,
      minConsistencyForKnown: 40,
      percentileBands: {
        veryLow: 20,
        low: 40,
        normal: 60,
        elevated: 80,
        high: 95
      }
    },
    passiveLiquidity: {
      bandEdgesBps: [0, 5, 10, 25, 50, 100, 250],
      imbalanceCutsBps: [5, 10, 25, 50, 100],
      nearTouchBps: 10,
      /** exp(-0.03 * bps): ~0.86 at 5bps, ~0.22 at 50bps, ~0.05 at 100bps. */
      distanceWeightK: 0.03,
      maxTrackedBps: 250,
      tradeMatchWindowMs: 100,
      tradeMatchTicks: 1,
      unresolvedCommitMs: 150,
      replenishWindowMs: 5e3,
      levelSampleSize: 4096,
      metricSampleSize: 512,
      metricWindowMs: 1e4,
      metricSampleMs: 1e3,
      wallMinPercentile: 95,
      wallMinVsNearbyMedian: 3,
      wallYoungMs: 2e3,
      wallMatureMs: 3e5,
      wallBreakFraction: 0.8,
      approachArmBps: 2,
      approachWithdrawalFraction: 0.5,
      highPercentile: 85,
      extremePercentile: 92,
      lowPercentile: 30,
      minAbsorptionScore: 60,
      minVacuumScore: 60,
      confirmedTestCount: 4,
      buildingTestCount: 2,
      zoneBps: 5,
      strengthWeights: {
        depth: 0.1,
        nearDepth: 0.18,
        persistence: 0.14,
        replenishment: 0.18,
        withdrawalInverse: 0.14,
        absorbedAggression: 0.12,
        priceInefficiency: 0.08,
        defendedTests: 0.06
      },
      minTrustedQuality: 45,
      bookStaleMs: 5e3,
      maxTimestampDriftMs: 5e3,
      timelinePoints: 64,
      profileLevelsPerSide: 24,
      eventCapacity: 256,
      memoryCapacity: 512
    },
    historicalBaselineSamples: 1024,
    accelerationLookbackBuckets: 5,
    cvdSlopeMs: 5e3
  };
  function mergeConfig(overrides = {}) {
    return deepMerge(DEFAULT_CONFIG, overrides);
  }
  function deepMerge(base, override) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const key3 of Object.keys(override)) {
      const value = override[key3];
      if (value === void 0) continue;
      const current = out[key3];
      if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
        out[key3] = deepMerge(
          current,
          value
        );
      } else {
        out[key3] = value;
      }
    }
    return out;
  }

  // src/exchange/venues.ts
  var EXCHANGE_IDS = ["binance", "bybit", "okx", "bitget", "hyperliquid", "dydx", "bitstamp"];
  var EXCHANGE_LABELS = {
    binance: "Binance",
    bybit: "Bybit",
    okx: "OKX",
    bitget: "Bitget",
    hyperliquid: "Hyperliquid",
    dydx: "dYdX",
    bitstamp: "Bitstamp"
  };
  function isExchangeId(value) {
    return EXCHANGE_IDS.includes(value);
  }
  function parseExchangesEnv(raw = "binance") {
    if (!raw?.trim()) return [...EXCHANGE_IDS];
    const ids = raw.split(",").map((s) => s.trim().toLowerCase()).filter(isExchangeId);
    const unique2 = [...new Set(ids)];
    if (!unique2.includes("binance")) unique2.unshift("binance");
    return unique2.length ? unique2 : [...EXCHANGE_IDS];
  }
  function baseAsset(symbol) {
    const base = symbol.toUpperCase();
    if (base.endsWith("USDT")) return base.slice(0, -4);
    if (base.endsWith("USDC")) return base.slice(0, -4);
    if (base.endsWith("USD")) return base.slice(0, -3);
    return base;
  }
  function venueInstrument(exchange, symbol, market) {
    const base = symbol.toUpperCase();
    if (!base) return null;
    if (exchange === "binance" || exchange === "bybit" || exchange === "bitget") return base;
    if (exchange === "hyperliquid") return baseAsset(base);
    if (exchange === "dydx") return `${baseAsset(base)}-USD`;
    if (exchange === "bitstamp") {
      const coin2 = baseAsset(base).toLowerCase();
      return market === "spot" ? `${coin2}usdt` : `${coin2}usd-perp`;
    }
    const quote = base.endsWith("USDT") ? "USDT" : base.endsWith("USD") ? "USD" : "";
    const coin = quote ? base.slice(0, -quote.length) : base;
    if (!coin) return null;
    if (market === "spot") return `${coin}-${quote || "USDT"}`;
    return `${coin}-${quote || "USDT"}-SWAP`;
  }
  function canonicalFromVenue(exchange, instrument) {
    const raw = instrument.toUpperCase();
    if (exchange === "okx") return raw.replace("-SWAP", "").replace(/-/g, "");
    if (exchange === "hyperliquid") return raw.endsWith("USDT") ? raw : `${raw}USDT`;
    if (exchange === "dydx") return `${raw.replace(/-USD$/, "")}USDT`;
    if (exchange === "bitstamp") {
      const stripped = raw.replace(/-PERP$/, "").replace(/USD$/, "USDT");
      return stripped.replace(/[^A-Z0-9]/g, "");
    }
    return raw;
  }
  var UA = { "User-Agent": "oderFlow/1.0" };
  async function fetchJson(url) {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  async function fetchPost(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { ...UA, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  function pairs(rows, priceIdx = 0, sizeIdx = 1) {
    if (!Array.isArray(rows)) return [];
    const out = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length <= sizeIdx) continue;
      out.push([String(row[priceIdx]), String(row[sizeIdx])]);
    }
    return out;
  }
  async function fetchVenueDepth(exchange, symbol, market, limit = 100) {
    const inst = venueInstrument(exchange, symbol, market);
    if (!inst) return { bids: [], asks: [] };
    if (exchange === "binance") {
      const base = market === "spot" ? "https://api.binance.com/api/v3/depth" : "https://fapi.binance.com/fapi/v1/depth";
      const data2 = await fetchJson(`${base}?symbol=${encodeURIComponent(inst)}&limit=${limit}`);
      return { lastUpdateId: data2.lastUpdateId, bids: data2.bids ?? [], asks: data2.asks ?? [] };
    }
    if (exchange === "bybit") {
      const category = market === "spot" ? "spot" : "linear";
      const data2 = await fetchJson(
        `https://api.bybit.com/v5/market/orderbook?category=${category}&symbol=${encodeURIComponent(inst)}&limit=${Math.min(limit, 200)}`
      );
      return {
        lastUpdateId: data2.result?.seq,
        bids: pairs(data2.result?.b),
        asks: pairs(data2.result?.a)
      };
    }
    if (exchange === "okx") {
      const data2 = await fetchJson(
        `https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(inst)}&sz=${Math.min(limit, 400)}`
      );
      const book = data2.data?.[0];
      return { bids: pairs(book?.bids), asks: pairs(book?.asks) };
    }
    if (exchange === "bitget") {
      const path = market === "spot" ? `https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${encodeURIComponent(inst)}&limit=${Math.min(limit, 150)}` : `https://api.bitget.com/api/v2/mix/market/merge-depth?symbol=${encodeURIComponent(inst)}&productType=USDT-FUTURES&limit=${Math.min(limit, 100)}`;
      const data2 = await fetchJson(path);
      return { bids: pairs(data2.data?.bids), asks: pairs(data2.data?.asks) };
    }
    if (exchange === "hyperliquid") {
      const data2 = await fetchPost("https://api.hyperliquid.xyz/info", { type: "l2Book", coin: inst });
      const bids = (data2.levels?.[0] ?? []).map((l) => [String(l.px ?? "0"), String(l.sz ?? "0")]);
      const asks = (data2.levels?.[1] ?? []).map((l) => [String(l.px ?? "0"), String(l.sz ?? "0")]);
      return { bids, asks };
    }
    if (exchange === "dydx") {
      const data2 = await fetchJson(
        `https://indexer.dydx.trade/v4/orderbooks/perpetualMarket/${encodeURIComponent(inst)}`
      );
      return {
        bids: (data2.bids ?? []).map((l) => [String(l.price ?? "0"), String(l.size ?? "0")]),
        asks: (data2.asks ?? []).map((l) => [String(l.price ?? "0"), String(l.size ?? "0")])
      };
    }
    const data = await fetchJson(`https://www.bitstamp.net/api/v2/order_book/${encodeURIComponent(inst)}/`);
    return { bids: pairs(data.bids), asks: pairs(data.asks) };
  }
  async function fetchOkxContractValues(market) {
    const instType = market === "spot" ? "SPOT" : "SWAP";
    const data = await fetchJson(
      `https://www.okx.com/api/v5/public/instruments?instType=${instType}`
    );
    const map = /* @__PURE__ */ new Map();
    for (const row of data.data ?? []) {
      if (!row.instId) continue;
      const ctVal = Number(row.ctVal);
      map.set(row.instId, Number.isFinite(ctVal) && ctVal > 0 ? ctVal : 1);
    }
    return map;
  }

  // src/footprint/tick-size.ts
  function tickSize(price) {
    if (price >= 1e4) return 10;
    if (price >= 1e3) return 1;
    if (price >= 100) return 0.5;
    if (price >= 10) return 0.1;
    if (price >= 1) return 0.01;
    return 1e-3;
  }
  function priceToTick(price, tick = tickSize(price)) {
    return Number((Math.round(price / tick) * tick).toFixed(6));
  }
  function barTime(timestampMs, intervalMinutes = 1) {
    const seconds = Math.floor(timestampMs / 1e3);
    const bucket2 = intervalMinutes * 60;
    return seconds - seconds % bucket2;
  }

  // src/footprint/aggregator.ts
  var FootprintAggregator = class {
    constructor(options) {
      this.options = options;
      this.intervalMinutes = options.intervalMinutes ?? 1;
    }
    open = /* @__PURE__ */ new Map();
    closed = [];
    intervalMinutes;
    ingest(trade, exchange = "binance") {
      const { price, quoteValue, timestamp, side: side2, symbol } = trade;
      if (!Number.isFinite(price) || price <= 0) return;
      if (!Number.isFinite(quoteValue) || quoteValue <= 0) return;
      const time = barTime(timestamp, this.intervalMinutes);
      const key3 = `${symbol}|${exchange}`;
      let bar = this.open.get(key3);
      if (bar && bar.time !== time) {
        if (time < bar.time) return;
        this.closed.push(finalize(bar, this.options.market));
        bar = void 0;
      }
      if (!bar) {
        bar = {
          symbol,
          exchange,
          time,
          open: price,
          high: price,
          low: price,
          close: price,
          totalBuy: 0,
          totalSell: 0,
          trades: 0,
          buyTrades: 0,
          sellTrades: 0,
          largestBuy: 0,
          largestSell: 0,
          levels: /* @__PURE__ */ new Map(),
          dirty: false
        };
        this.open.set(key3, bar);
      }
      bar.high = Math.max(bar.high, price);
      bar.low = Math.min(bar.low, price);
      bar.close = price;
      bar.trades += 1;
      bar.dirty = true;
      const level2 = priceToTick(price, tickSize(price));
      let entry = bar.levels.get(level2);
      if (!entry) {
        entry = { price: level2, buy: 0, sell: 0 };
        bar.levels.set(level2, entry);
      }
      if (side2 === "BUY") {
        entry.buy += quoteValue;
        bar.totalBuy += quoteValue;
        bar.buyTrades += 1;
        if (quoteValue > bar.largestBuy) bar.largestBuy = quoteValue;
      } else {
        entry.sell += quoteValue;
        bar.totalSell += quoteValue;
        bar.sellTrades += 1;
        if (quoteValue > bar.largestSell) bar.largestSell = quoteValue;
      }
    }
    /** Rolls bars whose interval has elapsed, even if the symbol went quiet. */
    closeStale(now = Date.now()) {
      const current = barTime(now, this.intervalMinutes);
      for (const [key3, bar] of this.open) {
        if (bar.time >= current) continue;
        this.closed.push(finalize(bar, this.options.market));
        this.open.delete(key3);
      }
    }
    /** Snapshot of completed bars that have not been drained yet. */
    peekClosed() {
      return this.closed.slice();
    }
    /** Returns completed bars and clears the queue. */
    drainClosed() {
      if (!this.closed.length) return [];
      const out = this.closed;
      this.closed = [];
      return out;
    }
    /** Snapshot of in-progress bars, for periodic checkpointing. */
    openBars(onlyDirty = false) {
      const out = [];
      for (const bar of this.open.values()) {
        if (onlyDirty && !bar.dirty) continue;
        bar.dirty = false;
        out.push(finalize(bar, this.options.market));
      }
      return out;
    }
    currentBar(symbol, exchange) {
      const bar = this.open.get(`${symbol}|${exchange}`);
      return bar ? finalize(bar, this.options.market) : null;
    }
  };
  function finalize(bar, market) {
    return {
      symbol: bar.symbol,
      exchange: bar.exchange,
      market,
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      totalBuy: bar.totalBuy,
      totalSell: bar.totalSell,
      trades: bar.trades,
      buyTrades: bar.buyTrades,
      sellTrades: bar.sellTrades,
      largestBuy: bar.largestBuy,
      largestSell: bar.largestSell,
      levels: [...bar.levels.values()].sort((a, b) => a.price - b.price)
    };
  }

  // src/footprint/types.ts
  function toWire(bar) {
    return {
      t: bar.time,
      o: bar.open,
      h: bar.high,
      l: bar.low,
      c: bar.close,
      tb: round2(bar.totalBuy),
      ts: round2(bar.totalSell),
      n: bar.trades,
      bt: bar.buyTrades,
      st: bar.sellTrades,
      lb: bar.largestBuy != null ? round2(bar.largestBuy) : void 0,
      ls: bar.largestSell != null ? round2(bar.largestSell) : void 0,
      lv: bar.levels.map((l) => [l.price, round2(l.buy), round2(l.sell)])
    };
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // src/client/browser-ws.ts
  var WebSocketBrowser = class {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    ws;
    handlers = /* @__PURE__ */ new Map();
    constructor(url) {
      this.ws = new WebSocket(url);
      this.ws.addEventListener("open", () => this.emit("open"));
      this.ws.addEventListener("message", (ev) => this.emit("message", ev.data));
      this.ws.addEventListener("close", () => this.emit("close"));
      this.ws.addEventListener("error", () => this.emit("error"));
    }
    get readyState() {
      return this.ws.readyState;
    }
    get bufferedAmount() {
      return this.ws.bufferedAmount;
    }
    on(event, handler) {
      let set = this.handlers.get(event);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        this.handlers.set(event, set);
      }
      set.add(handler);
      return this;
    }
    once(event, handler) {
      const wrap = (...args) => {
        this.off(event, wrap);
        handler(...args);
      };
      return this.on(event, wrap);
    }
    off(event, handler) {
      this.handlers.get(event)?.delete(handler);
      return this;
    }
    removeListener(event, handler) {
      return this.off(event, handler);
    }
    removeAllListeners(event) {
      if (event) this.handlers.delete(event);
      else this.handlers.clear();
      return this;
    }
    send(data) {
      this.ws.send(data);
    }
    close(code, reason) {
      try {
        this.ws.close(code, reason);
      } catch {
      }
    }
    /** Node `ws` API — browser close is enough. */
    terminate() {
      this.close();
    }
    ping() {
    }
    emit(event, ...args) {
      const set = this.handlers.get(event);
      if (!set) return;
      for (const handler of [...set]) {
        try {
          handler(...args);
        } catch (err) {
          console.error("[browser-ws] handler error", err);
        }
      }
    }
  };

  // src/liquidity-response/structure.ts
  function emptyStructure() {
    return {
      swingHigh: null,
      swingLow: null,
      lastSwingHigh: null,
      lastSwingLow: null,
      higherHigh: false,
      higherLow: false,
      lowerHigh: false,
      lowerLow: false,
      bias: "NONE",
      shift: "NONE"
    };
  }
  function detectStructure(bars) {
    const out = emptyStructure();
    if (bars.length < 6) return out;
    const highs = [];
    const lows = [];
    for (let i = 2; i < bars.length - 2; i++) {
      const b = bars[i];
      if (b.high >= bars[i - 1].high && b.high >= bars[i - 2].high && b.high >= bars[i + 1].high && b.high >= bars[i + 2].high) {
        highs.push({ i, price: b.high });
      }
      if (b.low <= bars[i - 1].low && b.low <= bars[i - 2].low && b.low <= bars[i + 1].low && b.low <= bars[i + 2].low) {
        lows.push({ i, price: b.low });
      }
    }
    const sh = highs[highs.length - 1];
    const prevSh = highs[highs.length - 2];
    const sl = lows[lows.length - 1];
    const prevSl = lows[lows.length - 2];
    out.swingHigh = sh?.price ?? null;
    out.swingLow = sl?.price ?? null;
    out.lastSwingHigh = prevSh?.price ?? null;
    out.lastSwingLow = prevSl?.price ?? null;
    out.higherHigh = Boolean(sh && prevSh && sh.price > prevSh.price);
    out.lowerHigh = Boolean(sh && prevSh && sh.price < prevSh.price);
    out.higherLow = Boolean(sl && prevSl && sl.price > prevSl.price);
    out.lowerLow = Boolean(sl && prevSl && sl.price < prevSl.price);
    if (out.higherHigh && out.higherLow) out.bias = "HH_HL";
    else if (out.lowerHigh && out.lowerLow) out.bias = "LH_LL";
    else if (out.higherHigh && out.lowerLow) out.bias = "HH_LL";
    else if (out.lowerHigh && out.higherLow) out.bias = "LH_HL";
    const last = bars[bars.length - 1];
    out.shift = microShift(last, out);
    return out;
  }
  function microShift(last, s) {
    if (s.swingHigh != null && last.close > s.swingHigh) {
      return s.bias === "LH_LL" ? "BULLISH_CHOCH" : "BULLISH_BOS";
    }
    if (s.swingLow != null && last.close < s.swingLow) {
      return s.bias === "HH_HL" ? "BEARISH_CHOCH" : "BEARISH_BOS";
    }
    return "NONE";
  }

  // src/liquidity-response/empty.ts
  var ZERO_NORM = {
    value: 0,
    percentile: 50,
    zScore: 0,
    median: 0,
    std: 0,
    window: 50
  };
  var EMPTY_ABSORPTION = {
    detected: false,
    kind: null,
    absorbingSide: null,
    strength: 0,
    usedBookEvidence: false,
    usedPriceEvidence: false
  };
  var EMPTY_IMPACT = {
    immediateBps: 0,
    bps5s: 0,
    bps30s: 0,
    bps1m: 0,
    bps5m: 0,
    vwapBps: 0,
    classification: "NORMAL",
    faded: false
  };
  function emptyDepth() {
    return {
      current: 0,
      currentPercentile: 50,
      changePercent: null,
      changeReason: "INSUFFICIENT_DATA",
      consumed: 0,
      cancelled: 0,
      replenished: 0,
      removed: 0,
      consumptionRatio: 0,
      changeState: "UNKNOWN",
      sideState: "UNKNOWN"
    };
  }
  function emptyLiquidityResponse() {
    return {
      aggression: "BALANCED",
      executed: 0,
      delta: 0,
      priceMovePercent: 0,
      priceMoveAbs: 0,
      efficiency: "NORMAL",
      askConsumption: "NORMAL",
      askReplenishment: "NORMAL",
      askWithdrawal: "NORMAL",
      bidConsumption: "NORMAL",
      bidReplenishment: "NORMAL",
      bidWithdrawal: "NORMAL",
      askResponse: "QUIET",
      bidResponse: "QUIET",
      state: "BALANCED",
      confidence: "LOW",
      confidenceScore: 22,
      dataQuality: 50,
      why: [],
      effort: "INSUFFICIENT",
      absorption: { ...EMPTY_ABSORPTION },
      vacuum: null,
      impact: { ...EMPTY_IMPACT },
      bands: [],
      levels: [],
      reversal: null,
      entryContext: "NO_ENTRY",
      structure: emptyStructure(),
      cvdDirection: "FLAT",
      oiChangePercent: null,
      oiInterpretation: null,
      shortLiquidationUsd: 0,
      longLiquidationUsd: 0,
      byTf: {},
      norms: {
        aggressiveBuy: { ...ZERO_NORM },
        aggressiveSell: { ...ZERO_NORM },
        delta: { ...ZERO_NORM },
        priceDisplacement: { ...ZERO_NORM },
        askDepthChange: { ...ZERO_NORM }
      },
      compare: null,
      repeatedAskReplenishment: false,
      repeatedBidReplenishment: false,
      deltaAnalysis: {
        delta: 0,
        direction: "BALANCED",
        absoluteDeltaPercentile: 50,
        directionalMagnitudePercentile: 50
      },
      askDepth: emptyDepth(),
      bidDepth: emptyDepth(),
      marketMechanics: "UNKNOWN",
      dataConsistency: 50,
      consistency: { valid: true, reason: null, score: 50 }
    };
  }

  // src/models/trade.ts
  var WINDOW_MS = {
    "1s": 1e3,
    "5s": 5e3,
    "10s": 1e4,
    "30s": 3e4,
    "1m": 6e4,
    "5m": 3e5,
    "15m": 9e5
  };

  // src/flow/net-aggression.ts
  var EPSILON = 1e-9;
  function side(executed, tradeCount, largeVolume, windowMs, percentile) {
    const seconds = Math.max(windowMs / 1e3, EPSILON);
    const count = Math.max(0, tradeCount);
    return {
      executed: Math.max(0, executed),
      tradeCount: count,
      velocityPerSec: Math.max(0, executed) / seconds,
      averageTradeSize: count > 0 ? Math.max(0, executed) / count : 0,
      largeVolume: Math.max(0, largeVolume),
      percentile: clampPct(percentile)
    };
  }
  function clampPct(value) {
    if (!Number.isFinite(value)) return 50;
    return Math.max(0, Math.min(100, value));
  }
  function classifyNetAggression(imbalance, buyPercentile, sellPercentile) {
    const buyPct = clampPct(buyPercentile);
    const sellPct = clampPct(sellPercentile);
    if (imbalance >= 0.35 && buyPct >= 70) return "STRONG_BUY_AGGRESSION";
    if (imbalance <= -0.35 && sellPct >= 70) return "STRONG_SELL_AGGRESSION";
    if (imbalance >= 0.12 || imbalance >= 0.06 && buyPct >= 65) return "BUY_AGGRESSION";
    if (imbalance <= -0.12 || imbalance <= -0.06 && sellPct >= 65) return "SELL_AGGRESSION";
    return "BALANCED";
  }
  function interpretNetAggression(state, net, imbalance) {
    const signed = `${net >= 0 ? "+" : ""}${net.toFixed(0)}`;
    const imb = `${imbalance >= 0 ? "+" : ""}${imbalance.toFixed(2)}`;
    switch (state) {
      case "STRONG_BUY_AGGRESSION":
        return `Buy aggression dominant (net ${signed}, imbalance ${imb}). Not automatically bullish \u2014 check ask replenishment and upward displacement for seller absorption.`;
      case "BUY_AGGRESSION":
        return `Buyers are the more aggressive side (net ${signed}, imbalance ${imb}). Confirm with liquidity response before treating as directional.`;
      case "STRONG_SELL_AGGRESSION":
        return `Sell aggression dominant (net ${signed}, imbalance ${imb}). Not automatically bearish \u2014 check bid replenishment and downward displacement for buyer absorption.`;
      case "SELL_AGGRESSION":
        return `Sellers are the more aggressive side (net ${signed}, imbalance ${imb}). Confirm with liquidity response before treating as directional.`;
      default:
        return `Aggressive buying and selling are roughly balanced (net ${signed}, imbalance ${imb}).`;
    }
  }
  function buildNetAggression(input) {
    const windowMs = WINDOW_MS[input.window];
    const buy = side(
      input.buyVolume,
      input.buyCount,
      input.largeBuyVolume,
      windowMs,
      input.buyPercentile
    );
    const sell = side(
      input.sellVolume,
      input.sellCount,
      input.largeSellVolume,
      windowMs,
      input.sellPercentile
    );
    const net = buy.executed - sell.executed;
    const total = buy.executed + sell.executed;
    const imbalance = total > 0 ? net / total : 0;
    const seconds = Math.max(windowMs / 1e3, EPSILON);
    const state = classifyNetAggression(imbalance, buy.percentile, sell.percentile);
    return {
      window: input.window,
      windowMs,
      buy,
      sell,
      net,
      imbalance,
      netVelocityPerSec: net / seconds,
      buyPercentile: buy.percentile,
      sellPercentile: sell.percentile,
      netPercentile: clampPct(input.netMagnitudePercentile),
      state,
      interpretation: interpretNetAggression(state, net, imbalance)
    };
  }

  // src/core/integrity.ts
  var GAP_WINDOW = 128;
  var IntegrityMonitor = class {
    constructor(duplicateWindow, maxOutOfOrderMs) {
      this.duplicateWindow = duplicateWindow;
      this.maxOutOfOrderMs = maxOutOfOrderMs;
      this.recentIds = new Array(duplicateWindow);
    }
    flags = /* @__PURE__ */ new Set();
    lastTradeTimestamp = 0;
    lastTradeReceivedAt = 0;
    lastBookTimestamp = 0;
    lastBookReceivedAt = 0;
    lastReconnectAt = 0;
    lastSequenceGapAt = 0;
    /** Ring of recent inter-trade gaps (local clock) used for the median. */
    gaps = new Float64Array(GAP_WINDOW);
    gapWrite = 0;
    gapFilled = 0;
    recentIds;
    idWrite = 0;
    idFilled = 0;
    idSet = /* @__PURE__ */ new Set();
    noteReconnect(now) {
      this.lastReconnectAt = now;
      this.flags.add("reconnect");
    }
    noteSequenceGap(now) {
      this.lastSequenceGapAt = now;
      this.flags.add("sequenceGap");
    }
    noteMissingData() {
      this.flags.add("missingData");
    }
    noteLatencySpike() {
      this.flags.add("latencySpike");
    }
    noteWideSpread() {
      this.flags.add("wideSpread");
    }
    noteStaleBook() {
      this.flags.add("staleBook");
    }
    clearTransient() {
      this.flags.delete("duplicate");
      this.flags.delete("outOfOrder");
      this.flags.delete("wideSpread");
      this.flags.delete("staleBook");
      this.flags.delete("latencySpike");
    }
    acceptTradeId(id, timestamp, receivedAt = Date.now()) {
      if (id === void 0) return true;
      const key3 = String(id);
      if (this.idSet.has(key3)) {
        this.flags.add("duplicate");
        return false;
      }
      if (this.idFilled === this.duplicateWindow) {
        const evicted = this.recentIds[this.idWrite];
        if (evicted !== void 0) this.idSet.delete(String(evicted));
      }
      this.recentIds[this.idWrite] = id;
      this.idWrite = (this.idWrite + 1) % this.duplicateWindow;
      if (this.idFilled < this.duplicateWindow) this.idFilled += 1;
      this.idSet.add(key3);
      if (this.lastTradeTimestamp && timestamp + this.maxOutOfOrderMs < this.lastTradeTimestamp) {
        this.flags.add("outOfOrder");
      }
      if (timestamp >= this.lastTradeTimestamp) this.lastTradeTimestamp = timestamp;
      this.noteTradeReceived(receivedAt);
      return true;
    }
    /**
     * Liveness is measured on the local clock, not exchange event time: the two
     * come from different clocks, so mixing them turns ordinary skew into a
     * permanent "data is stale" verdict on a perfectly healthy feed.
     */
    noteTradeReceived(receivedAt) {
      if (this.lastTradeReceivedAt > 0) {
        const gap = receivedAt - this.lastTradeReceivedAt;
        if (gap >= 0) {
          this.gaps[this.gapWrite] = gap;
          this.gapWrite = (this.gapWrite + 1) % GAP_WINDOW;
          if (this.gapFilled < GAP_WINDOW) this.gapFilled += 1;
        }
      }
      this.lastTradeReceivedAt = receivedAt;
    }
    /** Median inter-trade gap in ms, or 0 until there are enough samples to mean anything. */
    medianTradeGapMs() {
      if (this.gapFilled < 8) return 0;
      const sorted = Array.from(this.gaps.subarray(0, this.gapFilled)).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    }
    /** Milliseconds since the last trade actually arrived, or Infinity if none ever did. */
    tradeAgeMs(now) {
      return this.lastTradeReceivedAt > 0 ? Math.max(0, now - this.lastTradeReceivedAt) : Infinity;
    }
    snapshot() {
      return {
        flags: new Set(this.flags),
        lastTradeTimestamp: this.lastTradeTimestamp,
        lastTradeReceivedAt: this.lastTradeReceivedAt,
        lastBookTimestamp: this.lastBookTimestamp,
        lastBookReceivedAt: this.lastBookReceivedAt,
        lastReconnectAt: this.lastReconnectAt,
        lastSequenceGapAt: this.lastSequenceGapAt,
        medianTradeGapMs: this.medianTradeGapMs(),
        tradeGapSamples: this.gapFilled,
        healthy: this.flags.size === 0
      };
    }
  };
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function safeDiv(num, den) {
    if (den === 0) return 0;
    return num / den;
  }
  function pctChange(from, to) {
    if (from === 0) return 0;
    return (to - from) / from * 100;
  }
  function formatQuote(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  function formatTapeTime(timestamp) {
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  // src/analysis/absorption-engine.ts
  var AbsorptionEngine = class {
    constructor(config, samePrice) {
      this.config = config;
      this.samePrice = samePrice;
    }
    detect(input) {
      const buyer = this.buyerAbsorption(input);
      const seller = this.sellerAbsorption(input);
      if (buyer.strength >= seller.strength && buyer.detected) return buyer;
      if (seller.detected) return seller;
      return { detected: false, type: null, absorbingSide: null, aggressiveSide: null, strength: 0, confidence: 0 };
    }
    samePriceHit(side2, prices, notionals, priceStart, priceEnd) {
      if (prices.length < this.samePrice.minTradeCount) return false;
      const total = notionals.reduce((s, n) => s + n, 0);
      if (total < this.samePrice.minTotalQuoteValue) return false;
      const anchor = prices[0];
      const clustered = prices.every(
        (p) => Math.abs(p - anchor) / anchor * 1e4 <= this.samePrice.maxPriceDeviationBps
      );
      if (!clustered) return false;
      const movedThrough = side2 === "BUY" ? priceEnd > priceStart * (1 + 5e-5) : priceEnd < priceStart * (1 - 5e-5);
      return !movedThrough;
    }
    buyerAbsorption(input) {
      const hugeBuy = input.delta >= this.config.minAbsDeltaQuote && input.deltaPercent >= this.config.minDeltaPercent && input.flowMultipleBuy >= this.config.minFlowMultiple;
      const noLift = Math.abs(input.priceChangePercent) <= this.config.maxPriceChangePercent && input.priceChangePercent >= -this.config.maxPriceChangePercent;
      const lowImpact = input.impactEfficiency === "LOW" || noLift;
      const burstOk = !this.config.minBurstOrPersistent || input.buyBurst || input.persistentBuy;
      if (!hugeBuy || !lowImpact || !burstOk || input.priceChangePercent < -this.config.maxPriceChangePercent * 3) {
        return { detected: false, type: null, absorbingSide: null, aggressiveSide: null, strength: 0, confidence: 0 };
      }
      let strength = 0.55;
      strength += clamp((input.deltaPercent - this.config.minDeltaPercent) / 0.5, 0, 0.15);
      strength += clamp(input.askReplenishmentRatio, 0, 1) * this.config.replenishmentBoost;
      if (input.samePriceBuy) strength += this.config.samePriceBoost;
      if (input.icebergSellAbsorption) strength += 0.08;
      if (input.buyBurst) strength += 0.05;
      strength = clamp(strength, 0, 1);
      const confidence = clamp(
        0.5 + (input.askReplenishmentRatio > 0.4 ? 0.15 : 0) + (input.samePriceBuy ? 0.1 : 0) + (input.buyBurst || input.persistentBuy ? 0.1 : 0),
        0,
        1
      );
      const detected = strength >= this.config.minStrength && confidence >= this.config.minConfidence;
      return {
        detected,
        type: detected ? "BUYER_ABSORPTION" : null,
        absorbingSide: detected ? "PASSIVE_SELLER" : null,
        aggressiveSide: detected ? "BUYER" : null,
        strength,
        confidence
      };
    }
    sellerAbsorption(input) {
      const hugeSell = input.delta <= -this.config.minAbsDeltaQuote && input.deltaPercent <= -this.config.minDeltaPercent && input.flowMultipleSell >= this.config.minFlowMultiple;
      const noDrop = Math.abs(input.priceChangePercent) <= this.config.maxPriceChangePercent;
      const lowImpact = input.impactEfficiency === "LOW" || noDrop;
      const burstOk = !this.config.minBurstOrPersistent || input.sellBurst || input.persistentSell;
      if (!hugeSell || !lowImpact || !burstOk || input.priceChangePercent > this.config.maxPriceChangePercent * 3) {
        return { detected: false, type: null, absorbingSide: null, aggressiveSide: null, strength: 0, confidence: 0 };
      }
      let strength = 0.55;
      strength += clamp((-input.deltaPercent - this.config.minDeltaPercent) / 0.5, 0, 0.15);
      strength += clamp(input.bidReplenishmentRatio, 0, 1) * this.config.replenishmentBoost;
      if (input.samePriceSell) strength += this.config.samePriceBoost;
      if (input.icebergBuyAbsorption) strength += 0.08;
      if (input.sellBurst) strength += 0.05;
      strength = clamp(strength, 0, 1);
      const confidence = clamp(
        0.5 + (input.bidReplenishmentRatio > 0.4 ? 0.15 : 0) + (input.samePriceSell ? 0.1 : 0) + (input.sellBurst || input.persistentSell ? 0.1 : 0),
        0,
        1
      );
      const detected = strength >= this.config.minStrength && confidence >= this.config.minConfidence;
      return {
        detected,
        type: detected ? "SELLER_ABSORPTION" : null,
        absorbingSide: detected ? "PASSIVE_BUYER" : null,
        aggressiveSide: detected ? "SELLER" : null,
        strength,
        confidence
      };
    }
  };

  // src/analysis/alerts.ts
  var SKIP_WINDOWS = /* @__PURE__ */ new Set(["1s", "5s", "10s", "30s"]);
  var MIN_MOVE_PCT = {
    "1m": 0.2,
    "5m": 0.35,
    "15m": 0.5
  };
  function isVolatileWindow(snapshot) {
    if (SKIP_WINDOWS.has(snapshot.window)) return false;
    const absPct = Math.abs(snapshot.priceChangePercent);
    const floor = MIN_MOVE_PCT[snapshot.window] ?? 0.25;
    if (absPct < floor) return false;
    const impact = snapshot.priceImpactEfficiency;
    if (impact === "HIGH" || impact === "EXTREME") return true;
    if (snapshot.state === "LIQUIDITY_VACUUM_UP" || snapshot.state === "LIQUIDITY_VACUUM_DOWN") return true;
    return absPct >= floor * 2;
  }
  function buildAlerts(snapshot, _thresholds, now) {
    if (!isVolatileWindow(snapshot)) return [];
    const dir = snapshot.priceChangePercent >= 0 ? "UP" : "DOWN";
    const pct = snapshot.priceChangePercent;
    const bits = [];
    if (snapshot.buyBurstDetected) bits.push("buy burst");
    if (snapshot.sellBurstDetected) bits.push("sell burst");
    if (snapshot.state === "LIQUIDITY_VACUUM_UP" || snapshot.state === "LIQUIDITY_VACUUM_DOWN") {
      bits.push("liquidity vacuum");
    }
    const extra = bits.length ? ` \xB7 ${bits.join(" \xB7 ")}` : "";
    return [
      {
        symbol: snapshot.symbol,
        window: snapshot.window,
        timestamp: now,
        type: `VOLATILITY ${dir}`,
        message: `Range expanding ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% in ${snapshot.window}${extra}`,
        payload: {
          priceChangePercent: pct,
          absolutePriceChange: snapshot.absolutePriceChange,
          impact: snapshot.priceImpactEfficiency
        }
      }
    ];
  }

  // src/analysis/confidence-engine.ts
  var ConfidenceEngine = class {
    constructor(penalties) {
      this.penalties = penalties;
    }
    score(input) {
      let c = 1;
      if (input.tradeCount < 8) c -= this.penalties.lowVolume;
      if (input.flags.has("staleBook")) c -= this.penalties.staleBook;
      if (input.bookEmpty || input.flags.has("missingData")) c -= this.penalties.missingData;
      if (input.flags.has("reconnect")) c -= this.penalties.reconnect;
      if (input.flags.has("sequenceGap")) c -= this.penalties.sequenceGap;
      if (input.spreadBps > input.maxSpreadBps) c -= this.penalties.wideSpread;
      if (input.recentFlip) c -= this.penalties.rapidFlip;
      const flowSign = Math.sign(input.deltaPercent);
      const priceSign = Math.sign(input.priceChangePercent);
      if (flowSign !== 0 && priceSign !== 0 && flowSign !== priceSign && input.impactEfficiency !== "LOW") {
        c -= this.penalties.contradictoryPrice;
      }
      return clamp(c, 0, 1);
    }
  };

  // src/analysis/flow-score-engine.ts
  var FlowScoreEngine = class {
    constructor(weights) {
      this.weights = weights;
    }
    score(input) {
      const w = this.weights;
      const burst = input.buyBurstStrength - input.sellBurstStrength;
      const persist = (input.persistentBuy ? 1 : 0) - (input.persistentSell ? 1 : 0);
      const share = input.largeBuyShare - input.largeSellShare;
      const consumption = Math.sign(input.askConsumption - input.bidConsumption);
      const move = clamp(input.priceChangePercent / 0.5, -1, 1);
      const responseWeight = input.impactEfficiency === "LOW" ? 0.25 : input.impactEfficiency === "EXTREME" ? 1 : 0.7;
      const raw = w.deltaPercent * input.deltaPercent + w.largeFlowShare * share + w.burst * burst + w.persistence * persist + w.cvdSlope * clamp(input.cvdSlopeSign, -1, 1) + w.consumption * consumption + w.priceResponse * move * responseWeight;
      return clamp(Math.round(raw * 100), -100, 100);
    }
  };

  // src/analysis/large-participant-flow-engine.ts
  var LargeParticipantFlowEngine = class {
    constructor(weights) {
      this.weights = weights;
    }
    score(input) {
      const buy = this.sideScore(input, "BUY");
      const sell = this.sideScore(input, "SELL");
      if (buy.score < 20 && sell.score < 20) {
        return {
          side: "NONE",
          largeParticipantFlowScore: Math.max(buy.score, sell.score),
          confidence: 0.3,
          interpretation: "No unusually large persistent aggressive flow."
        };
      }
      const pick2 = buy.score >= sell.score ? buy : sell;
      return {
        side: pick2.side,
        largeParticipantFlowScore: pick2.score,
        confidence: pick2.confidence,
        interpretation: pick2.side === "BUY" ? "Unusually large and persistent aggressive buying is occurring." : "Unusually large and persistent aggressive selling is occurring."
      };
    }
    sideScore(input, side2) {
      const w = this.weights;
      const largeCount = side2 === "BUY" ? input.largeBuyCount : input.largeSellCount;
      const largeVol = side2 === "BUY" ? input.largeBuyVolume : input.largeSellVolume;
      const total = side2 === "BUY" ? input.buyVolume : input.sellVolume;
      const share = side2 === "BUY" ? input.largeBuyShare : input.largeSellShare;
      const burst = side2 === "BUY" ? input.buyBurstStrength : input.sellBurstStrength;
      const persistent = side2 === "BUY" ? input.persistentBuy : input.persistentSell;
      const dominance = side2 === "BUY" ? Math.max(0, input.deltaPercent) : Math.max(0, -input.deltaPercent);
      const consumption = side2 === "BUY" ? input.askConsumption : input.bidConsumption;
      const pressure = side2 === "BUY" ? input.buyPressure : input.sellPressure;
      const frequency = clamp(largeCount / 20, 0, 1);
      const volume = clamp(largeVol / Math.max(total, 1), 0, 1);
      const percentile = clamp((input.maxPercentileRank - 90) / 10, 0, 1);
      const burstPersist = clamp(burst * 0.6 + (persistent ? 0.4 : 0), 0, 1);
      const response = input.impactEfficiency === "EXTREME" ? 1 : input.impactEfficiency === "HIGH" ? 0.7 : input.impactEfficiency === "NORMAL" ? 0.4 : 0.15;
      const liq = clamp(Math.max(consumption > 0 ? 0.5 : 0, Math.min(pressure / 5, 1)), 0, 1);
      const score = clamp(
        100 * (w.largeTradeFrequency * frequency + w.largeTradeVolume * volume + w.relativePercentile * percentile + w.burstPersistence * burstPersist + w.sameSideDominance * dominance + w.largeFlowShare * clamp(share, 0, 1) + w.priceResponse * response + w.liquidityConsumption * liq),
        0,
        100
      );
      const confidence = clamp(0.4 + dominance * 0.2 + burstPersist * 0.2 + (share > 0.25 ? 0.15 : 0), 0, 1);
      return { side: side2, score: Math.round(score), confidence };
    }
  };

  // src/core/rolling-stats.ts
  var RollingDistribution = class {
    constructor(capacity) {
      this.capacity = capacity;
      this.values = new Float64Array(capacity);
      this.sorted = new Float64Array(capacity);
    }
    values;
    sorted;
    write = 0;
    filled = 0;
    dirty = true;
    cachedMean = 0;
    cachedStd = 0;
    get size() {
      return this.filled;
    }
    add(value) {
      this.values[this.write] = value;
      this.write = (this.write + 1) % this.capacity;
      if (this.filled < this.capacity) this.filled += 1;
      this.dirty = true;
    }
    mean() {
      this.refresh();
      return this.cachedMean;
    }
    std() {
      this.refresh();
      return this.cachedStd;
    }
    median() {
      return this.percentile(50);
    }
    percentile(p) {
      if (this.filled === 0) return 0;
      this.refresh();
      const clamped = Math.min(100, Math.max(0, p));
      const idx = clamped / 100 * (this.filled - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      const a = this.sorted[lo] ?? 0;
      const b = this.sorted[hi] ?? a;
      const w = idx - lo;
      return a * (1 - w) + b * w;
    }
    percentileRank(value) {
      if (this.filled === 0) return 50;
      this.refresh();
      let lo = 0;
      let hi = this.filled;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if ((this.sorted[mid] ?? 0) <= value) lo = mid + 1;
        else hi = mid;
      }
      return lo / this.filled * 100;
    }
    /**
     * Tie-aware percentile rank: the midpoint between the share of samples below
     * `value` and the share at or below it.
     *
     * `percentileRank` counts ties as "below", so a value of 0 measured against a
     * history that is mostly zeros comes back as the 100th percentile — reading as
     * an extreme when it is really the most ordinary value in the series. Order
     * book activity is full of legitimate zeros (no consumption this second, no
     * displacement this second), so anything classifying that activity needs the
     * midrank instead.
     */
    midRank(value) {
      if (this.filled === 0) return 50;
      this.refresh();
      const below = this.countBelow(value);
      const atOrBelow = this.countAtOrBelow(value);
      return (below + atOrBelow) / 2 / this.filled * 100;
    }
    countBelow(value) {
      let lo = 0;
      let hi = this.filled;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if ((this.sorted[mid] ?? 0) < value) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }
    countAtOrBelow(value) {
      let lo = 0;
      let hi = this.filled;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if ((this.sorted[mid] ?? 0) <= value) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }
    zScore(value, minStd) {
      const std = Math.max(this.std(), minStd);
      if (std === 0) return 0;
      return (value - this.mean()) / std;
    }
    ratioToMedian(value) {
      const med = this.median();
      if (med === 0) return value === 0 ? 1 : Number.POSITIVE_INFINITY;
      return value / med;
    }
    refresh() {
      if (!this.dirty || this.filled === 0) return;
      this.sorted.set(this.values.subarray(0, this.filled));
      this.sorted.subarray(0, this.filled).sort();
      let sum = 0;
      for (let i = 0; i < this.filled; i++) sum += this.values[i] ?? 0;
      this.cachedMean = sum / this.filled;
      let varSum = 0;
      for (let i = 0; i < this.filled; i++) {
        const d = (this.values[i] ?? 0) - this.cachedMean;
        varSum += d * d;
      }
      this.cachedStd = Math.sqrt(varSum / this.filled);
      this.dirty = false;
    }
  };

  // src/analysis/price-impact-engine.ts
  var PriceImpactEngine = class {
    constructor(config) {
      this.config = config;
      this.history = new RollingDistribution(config.sampleSize);
    }
    history;
    measure(priceStart, priceEnd, netDelta) {
      const absolutePriceChange = priceEnd - priceStart;
      const percentagePriceChange = pctChange(priceStart, priceEnd);
      const absDelta = Math.abs(netDelta);
      const impactPerMillion = absDelta < this.config.minAbsDeltaQuote ? 0 : safeDiv(Math.abs(percentagePriceChange), absDelta / 1e6);
      if (impactPerMillion > 0) this.history.add(impactPerMillion);
      const efficiency2 = this.classify(impactPerMillion);
      const signedMove = netDelta >= 0 ? percentagePriceChange : -percentagePriceChange;
      const effective = signedMove > 0 && efficiency2 !== "LOW";
      return {
        priceStart,
        priceEnd,
        absolutePriceChange,
        percentagePriceChange,
        impactPerMillion,
        efficiency: efficiency2,
        effective
      };
    }
    seed(impactsPerMillion) {
      for (const v of impactsPerMillion) this.history.add(v);
    }
    classify(current) {
      if (current === 0) return "LOW";
      if (this.history.size < 8) {
        if (current < 0.01) return "LOW";
        if (current > 0.5) return "EXTREME";
        if (current > 0.15) return "HIGH";
        return "NORMAL";
      }
      const median3 = this.history.median();
      if (median3 <= 0) return "NORMAL";
      const ratio = current / median3;
      if (ratio < this.config.lowRatioOfMedian) return "LOW";
      if (ratio >= this.config.extremeRatioOfMedian) return "EXTREME";
      if (ratio >= this.config.highRatioOfMedian) return "HIGH";
      return "NORMAL";
    }
  };

  // src/analysis/state-classifier.ts
  var IMPACT_RANK = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    EXTREME: 3
  };
  var ACCEL_RANK = {
    NONE: 0,
    DECELERATING: 0,
    WEAK: 1,
    MODERATE: 2,
    STRONG: 3
  };
  var StateClassifier = class {
    constructor(vacuum, exhaustion) {
      this.vacuum = vacuum;
      this.exhaustion = exhaustion;
    }
    classify(input) {
      if (input.absorption.detected && input.absorption.type === "BUYER_ABSORPTION") {
        return "BUYER_ABSORPTION";
      }
      if (input.absorption.detected && input.absorption.type === "SELLER_ABSORPTION") {
        return "SELLER_ABSORPTION";
      }
      if (this.vacuumUp(input)) return "LIQUIDITY_VACUUM_UP";
      if (this.vacuumDown(input)) return "LIQUIDITY_VACUUM_DOWN";
      if (this.exhaustionBuy(input)) return "FLOW_EXHAUSTION_BUY";
      if (this.exhaustionSell(input)) return "FLOW_EXHAUSTION_SELL";
      const shortWindow = WINDOW_MS[input.window] <= 1e4;
      if (shortWindow && input.buyBurst) return "BUY_BURST";
      if (shortWindow && input.sellBurst) return "SELL_BURST";
      if (input.persistentBuy) return "PERSISTENT_BUY_FLOW";
      if (input.persistentSell) return "PERSISTENT_SELL_FLOW";
      if (input.buyBurst) return "BUY_BURST";
      if (input.sellBurst) return "SELL_BURST";
      if (input.largeBuy) return "LARGE_BUY_FLOW";
      if (input.largeSell) return "LARGE_SELL_FLOW";
      return "NO_SIGNAL";
    }
    vacuumUp(input) {
      return input.buyPressure >= this.vacuum.minPressure && input.priceChangePercent >= this.vacuum.minPriceChangePercent && input.flowMultipleBuy <= this.vacuum.maxFlowMultiple && IMPACT_RANK[input.impactEfficiency] >= IMPACT_RANK[this.vacuum.minImpact];
    }
    vacuumDown(input) {
      return input.sellPressure >= this.vacuum.minPressure && input.priceChangePercent <= -this.vacuum.minPriceChangePercent && input.flowMultipleSell <= this.vacuum.maxFlowMultiple && IMPACT_RANK[input.impactEfficiency] >= IMPACT_RANK[this.vacuum.minImpact];
    }
    exhaustionBuy(input) {
      return ACCEL_RANK[input.priorAccelerationBuy] >= ACCEL_RANK[this.exhaustion.requiredPriorAcceleration] && input.accelerationBuy === "DECELERATING" && (input.largeBuy || input.persistentBuy);
    }
    exhaustionSell(input) {
      return ACCEL_RANK[input.priorAccelerationSell] >= ACCEL_RANK[this.exhaustion.requiredPriorAcceleration] && input.accelerationSell === "DECELERATING" && (input.largeSell || input.persistentSell);
    }
  };

  // src/core/ring-buffer.ts
  var RingBuffer = class {
    constructor(capacity) {
      this.capacity = capacity;
      if (capacity < 1) throw new Error("RingBuffer capacity must be >= 1");
      this.buf = new Array(capacity);
    }
    buf;
    head = 0;
    length_ = 0;
    get length() {
      return this.length_;
    }
    push(item) {
      const evicted = this.length_ === this.capacity ? this.buf[this.head] : void 0;
      this.buf[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
      if (this.length_ < this.capacity) this.length_ += 1;
      return evicted;
    }
    at(index) {
      if (index < 0 || index >= this.length_) return void 0;
      const start = this.length_ === this.capacity ? this.head : 0;
      return this.buf[(start + index) % this.capacity];
    }
    last() {
      return this.length_ === 0 ? void 0 : this.at(this.length_ - 1);
    }
    *values() {
      for (let i = 0; i < this.length_; i++) {
        yield this.at(i);
      }
    }
    toArray() {
      return [...this.values()];
    }
    clear() {
      this.head = 0;
      this.length_ = 0;
      this.buf.fill(void 0);
    }
  };

  // src/flow/burst-detector.ts
  var BurstDetector = class {
    constructor(config) {
      this.config = config;
    }
    recent = new RingBuffer(4096);
    active = [];
    lastBurst = null;
    onTrade(trade, vsMedian) {
      const item = {
        timestamp: trade.timestamp,
        price: trade.price,
        quoteValue: trade.quoteValue,
        side: trade.side,
        vsMedian
      };
      this.recent.push(item);
      if (this.active.length === 0) {
        this.active.push(item);
        return null;
      }
      const first = this.active[0];
      const last = this.active[this.active.length - 1];
      const sameSide = item.side === last.side;
      const gap = item.timestamp - last.timestamp;
      const span = item.timestamp - first.timestamp;
      if (sameSide && gap <= this.config.maxGapMs) {
        this.active.push(item);
      } else {
        const closed = this.finalize(this.active);
        this.active = [item];
        if (closed) {
          this.lastBurst = closed;
          return closed;
        }
        return null;
      }
      if (span >= this.config.maxGapMs || this.active.length >= 8) {
        const burst = this.finalize(this.active);
        if (burst) this.lastBurst = burst;
        return burst;
      }
      return this.lastBurstIfCovers(item.timestamp);
    }
    current(now) {
      const live = this.active.filter((t) => now - t.timestamp <= this.config.maxGapMs * 4);
      return this.finalize(live.length ? live : this.active) ?? this.lastBurstIfCovers(now);
    }
    lastBurstIfCovers(now) {
      if (!this.lastBurst) return null;
      if (now - this.lastBurst.endTime > this.config.maxGapMs * 2) return null;
      return this.lastBurst;
    }
    finalize(trades) {
      if (trades.length < this.config.minTradeCount) return null;
      const side2 = trades[0].side;
      const sameSide = trades.filter((t) => t.side === side2);
      if (sameSide.length / trades.length < this.config.minSameSideShare) return null;
      const total = sameSide.reduce((s, t) => s + t.quoteValue, 0);
      if (total < this.config.minTotalQuoteValue) return null;
      const start = sameSide[0];
      const end = sameSide[sameSide.length - 1];
      const largest = sameSide.reduce((m, t) => Math.max(m, t.quoteValue), 0);
      const avgVsMedian = sameSide.reduce((s, t) => s + Math.min(t.vsMedian, 20), 0) / sameSide.length;
      const duration = Math.max(1, end.timestamp - start.timestamp);
      const tightness = clamp(1 - duration / (this.config.maxGapMs * sameSide.length), 0, 1);
      const move = Math.abs(end.price - start.price) / start.price;
      const w = this.config;
      const strength = clamp(
        w.strengthVolumeWeight * clamp(total / (this.config.minTotalQuoteValue * 8), 0, 1) + w.strengthCountWeight * clamp(sameSide.length / 40, 0, 1) + w.strengthTightnessWeight * tightness + w.strengthRelativeWeight * clamp(avgVsMedian / 8, 0, 1) + w.strengthMoveWeight * clamp(move * 50, 0, 1),
        0,
        1
      );
      return {
        side: side2,
        startTime: start.timestamp,
        endTime: end.timestamp,
        tradeCount: sameSide.length,
        totalQuoteValue: total,
        largestTrade: largest,
        averageTradeSize: safeDiv(total, sameSide.length),
        priceStart: start.price,
        priceEnd: end.price,
        strength
      };
    }
  };

  // src/flow/cluster-detector.ts
  var FlowClusterDetector = class {
    constructor(config) {
      this.config = config;
    }
    active = [];
    last = null;
    onTrade(trade, isLarge) {
      if (!isLarge && trade.quoteValue < this.config.minTotalQuoteValue / this.config.minTradeCount) {
        return this.maybeClose(trade.timestamp);
      }
      const print = {
        timestamp: trade.timestamp,
        price: trade.price,
        quoteValue: trade.quoteValue,
        side: trade.side
      };
      if (this.active.length === 0) {
        this.active.push(print);
        return null;
      }
      const first = this.active[0];
      const last = this.active[this.active.length - 1];
      const priceRangeBps = Math.abs(print.price - first.price) / first.price * 1e4;
      const sameSide = print.side === last.side;
      const closeInTime = print.timestamp - last.timestamp <= this.config.maxGapMs;
      if (sameSide && closeInTime && priceRangeBps <= this.config.maxPriceRangeBps) {
        this.active.push(print);
        const cluster = this.build(this.active);
        if (cluster) this.last = cluster;
        return cluster;
      }
      const closed = this.build(this.active);
      this.active = [print];
      if (closed) this.last = closed;
      return closed;
    }
    current(now) {
      const live = this.build(this.active);
      if (live && now - live.endTime <= this.config.maxGapMs) return live;
      if (this.last && now - this.last.endTime <= this.config.maxGapMs) return this.last;
      return null;
    }
    maybeClose(now) {
      if (this.active.length === 0) return this.last && now - this.last.endTime <= this.config.maxGapMs ? this.last : null;
      const last = this.active[this.active.length - 1];
      if (now - last.timestamp > this.config.maxGapMs) {
        const closed = this.build(this.active);
        this.active = [];
        if (closed) this.last = closed;
        return closed;
      }
      return this.build(this.active);
    }
    build(prints) {
      if (prints.length < this.config.minTradeCount) return null;
      const total = prints.reduce((s, p) => s + p.quoteValue, 0);
      if (total < this.config.minTotalQuoteValue) return null;
      const prices = prints.map((p) => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const duration = Math.max(1, prints[prints.length - 1].timestamp - prints[0].timestamp);
      const tightness = clamp(1 - duration / (this.config.maxGapMs * prints.length), 0, 1);
      return {
        side: prints[0].side,
        minPrice,
        maxPrice,
        startTime: prints[0].timestamp,
        endTime: prints[prints.length - 1].timestamp,
        tradeCount: prints.length,
        totalVolume: total,
        relativeStrength: clamp(tightness * 0.5 + clamp(total / (this.config.minTotalQuoteValue * 10), 0, 1) * 0.5, 0, 1)
      };
    }
  };

  // src/flow/cvd-engine.ts
  var CVDEngine = class {
    constructor(slopeMs, historySize = 4096) {
      this.slopeMs = slopeMs;
      this.history = new RingBuffer(historySize);
    }
    cvd = 0;
    history;
    onTrade(timestamp, buyQuote, sellQuote, price) {
      this.cvd += buyQuote - sellQuote;
      this.history.push({ timestamp, cvd: this.cvd, price });
      return this.snapshot(timestamp);
    }
    snapshot(now) {
      const latest = this.history.last();
      const cvd = latest?.cvd ?? this.cvd;
      const slope = this.slopeAt(now, this.slopeMs);
      const prevSlope = this.slopeAt(now - this.slopeMs, this.slopeMs);
      const acceleration = slope - prevSlope;
      const direction = Math.abs(slope) < 1e-9 ? "FLAT" : slope > 0 ? "UP" : "DOWN";
      return {
        cvd,
        slope,
        acceleration,
        direction,
        divergence: this.divergence(now)
      };
    }
    slopeAt(now, lookback) {
      const end = this.pointAtOrBefore(now);
      const start = this.pointAtOrBefore(now - lookback) ?? this.first();
      if (!end || !start || end.timestamp === start.timestamp) return 0;
      return (end.cvd - start.cvd) / (end.timestamp - start.timestamp);
    }
    first() {
      return this.history.at(0);
    }
    pointAtOrBefore(timestamp) {
      let found;
      for (const p of this.history.values()) {
        if (p.timestamp <= timestamp) found = p;
        else break;
      }
      return found;
    }
    divergence(now) {
      const lookback = this.slopeMs * 3;
      const points = [];
      for (const p of this.history.values()) {
        if (p.timestamp >= now - lookback) points.push(p);
      }
      if (points.length < 8) return "NONE";
      const first = points[0];
      const last = points[points.length - 1];
      const priceUp = last.price > first.price * 1.0005;
      const priceDown = last.price < first.price * 0.9995;
      const cvdUp = last.cvd > first.cvd;
      const cvdDown = last.cvd < first.cvd;
      if (priceUp && cvdDown) return "BEARISH";
      if (priceDown && cvdUp) return "BULLISH";
      return "NONE";
    }
    get value() {
      return this.cvd;
    }
  };

  // src/flow/large-trade-detector.ts
  var LargeTradeDetector = class {
    constructor(config) {
      this.config = config;
      this.distribution = new RollingDistribution(config.relative.sampleSize);
    }
    distribution;
    observe(trade) {
      this.distribution.add(trade.quoteValue);
    }
    relativeSize(quoteValue) {
      const { minStdDevQuote } = this.config.relative;
      const percentileRank = this.distribution.percentileRank(quoteValue);
      return {
        quoteValue,
        vsMedian: this.distribution.ratioToMedian(quoteValue),
        zScore: this.distribution.zScore(quoteValue, minStdDevQuote),
        percentileRank,
        classification: this.classifyPercentile(percentileRank)
      };
    }
    classifyPercentile(percentileRank) {
      const { largePercentile, veryLargePercentile, extremePercentile } = this.config.relative;
      if (percentileRank >= extremePercentile) return "EXTREME";
      if (percentileRank >= veryLargePercentile) return "VERY_LARGE";
      if (percentileRank >= largePercentile) return "LARGE";
      return "NORMAL";
    }
    absoluteTier(quoteValue) {
      const { tier1, tier2, tier3, tier4 } = this.config.largeTradeThresholds;
      if (quoteValue >= tier4) return 4;
      if (quoteValue >= tier3) return 3;
      if (quoteValue >= tier2) return 2;
      if (quoteValue >= tier1) return 1;
      return null;
    }
    isLarge(trade, relative) {
      return relative.classification !== "NORMAL" || this.absoluteTier(trade.quoteValue) !== null;
    }
    maybeEvent(trade, relative) {
      const tier = this.absoluteTier(trade.quoteValue);
      if (tier === null && relative.classification === "NORMAL") return null;
      const effectiveTier = tier ?? 1;
      return {
        type: trade.isAggressiveBuy ? "LARGE_AGGRESSIVE_BUY" : "LARGE_AGGRESSIVE_SELL",
        symbol: trade.symbol,
        quoteValue: trade.quoteValue,
        price: trade.price,
        timestamp: trade.timestamp,
        tier: effectiveTier,
        relativeClass: relative.classification,
        relativeSize: relative.vsMedian,
        zScore: relative.zScore
      };
    }
  };

  // src/flow/delta-engine.ts
  function computeDelta(agg) {
    const buy = agg.buyVolume;
    const sell = agg.sellVolume;
    const delta = buy - sell;
    const total = buy + sell;
    return {
      delta,
      deltaPercent: total === 0 ? 0 : clampUnit(delta / total),
      aggressiveBuyVolume: buy,
      aggressiveSellVolume: sell
    };
  }
  function clampUnit(value) {
    return Math.min(1, Math.max(-1, value));
  }
  function flowShares(agg) {
    return {
      largeBuyFlowShare: safeDiv(agg.largeBuyVolume, agg.buyVolume),
      largeSellFlowShare: safeDiv(agg.largeSellVolume, agg.sellVolume),
      averageBuySize: safeDiv(agg.buyVolume, agg.buyCount),
      averageSellSize: safeDiv(agg.sellVolume, agg.sellCount)
    };
  }

  // src/flow/persistent-flow.ts
  function detectPersistentFlow(agg, windowMs, flowMultipleBuy, flowMultipleSell, config) {
    const delta = computeDelta(agg);
    const longEnough = windowMs >= config.minDurationMs;
    const buy = longEnough && delta.deltaPercent >= config.minSameSideDeltaPercent && agg.buyCount >= config.minTradeCount && flowMultipleBuy >= config.minFlowMultiple;
    const sell = longEnough && delta.deltaPercent <= -config.minSameSideDeltaPercent && agg.sellCount >= config.minTradeCount && flowMultipleSell >= config.minFlowMultiple;
    return { persistentBuyFlow: buy, persistentSellFlow: sell };
  }

  // src/core/bucket-ring.ts
  var EMPTY = {
    buyVolume: 0,
    sellVolume: 0,
    buyCount: 0,
    sellCount: 0,
    largestBuy: 0,
    largestSell: 0,
    largeBuyVolume: 0,
    largeSellVolume: 0,
    forcedBuyVolume: 0,
    forcedSellVolume: 0,
    priceOpen: 0,
    priceHigh: 0,
    priceLow: 0,
    priceClose: 0,
    bucketCount: 0
  };
  function emptyBucket(startMs) {
    return {
      startMs,
      buyVolume: 0,
      sellVolume: 0,
      buyCount: 0,
      sellCount: 0,
      largestBuy: 0,
      largestSell: 0,
      largeBuyVolume: 0,
      largeSellVolume: 0,
      forcedBuyVolume: 0,
      forcedSellVolume: 0,
      priceOpen: 0,
      priceHigh: 0,
      priceLow: 0,
      priceClose: 0
    };
  }
  var BucketRing = class {
    constructor(bucketMs, maxBuckets) {
      this.bucketMs = bucketMs;
      this.maxBuckets = maxBuckets;
      this.buckets = Array.from({ length: maxBuckets }, () => emptyBucket(0));
    }
    buckets;
    filled = 0;
    lastIndex = -1;
    lastStart = Number.NaN;
    bucketStart(timestamp) {
      return Math.floor(timestamp / this.bucketMs) * this.bucketMs;
    }
    add(timestamp, side2, quoteValue, price, isLarge, isForced) {
      const start = this.bucketStart(timestamp);
      const bucket2 = this.ensureBucket(start);
      if (!bucket2) return;
      if (bucket2.buyCount + bucket2.sellCount === 0 && bucket2.priceOpen === 0) {
        bucket2.priceOpen = price;
        bucket2.priceHigh = price;
        bucket2.priceLow = price;
      } else {
        if (bucket2.priceOpen === 0) bucket2.priceOpen = price;
        if (price > bucket2.priceHigh) bucket2.priceHigh = price;
        if (bucket2.priceLow === 0 || price < bucket2.priceLow) bucket2.priceLow = price;
      }
      bucket2.priceClose = price;
      if (side2 === "BUY") {
        bucket2.buyVolume += quoteValue;
        bucket2.buyCount += 1;
        if (quoteValue > bucket2.largestBuy) bucket2.largestBuy = quoteValue;
        if (isLarge) bucket2.largeBuyVolume += quoteValue;
        if (isForced) bucket2.forcedBuyVolume += quoteValue;
      } else {
        bucket2.sellVolume += quoteValue;
        bucket2.sellCount += 1;
        if (quoteValue > bucket2.largestSell) bucket2.largestSell = quoteValue;
        if (isLarge) bucket2.largeSellVolume += quoteValue;
        if (isForced) bucket2.forcedSellVolume += quoteValue;
      }
    }
    touchPrice(timestamp, price) {
      if (price <= 0) return;
      const start = this.bucketStart(timestamp);
      const bucket2 = this.ensureBucket(start);
      if (!bucket2) return;
      if (bucket2.priceOpen === 0) {
        bucket2.priceOpen = price;
        bucket2.priceHigh = price;
        bucket2.priceLow = price;
      } else {
        if (price > bucket2.priceHigh) bucket2.priceHigh = price;
        if (bucket2.priceLow === 0 || price < bucket2.priceLow) bucket2.priceLow = price;
      }
      bucket2.priceClose = price;
    }
    aggregate(fromMs, toMs) {
      if (this.filled === 0) return { ...EMPTY };
      const fromStart = this.bucketStart(fromMs);
      const toStart = this.bucketStart(Math.max(toMs - 1, fromMs));
      const out = { ...EMPTY };
      let opened = false;
      const steps = Math.min(
        this.maxBuckets,
        Math.max(0, Math.floor((toStart - fromStart) / this.bucketMs) + 1)
      );
      for (let i = 0; i < steps; i++) {
        const start = fromStart + i * this.bucketMs;
        const bucket2 = this.getBucket(start);
        if (!bucket2) continue;
        if (bucket2.buyCount + bucket2.sellCount === 0 && bucket2.priceOpen === 0) continue;
        out.buyVolume += bucket2.buyVolume;
        out.sellVolume += bucket2.sellVolume;
        out.buyCount += bucket2.buyCount;
        out.sellCount += bucket2.sellCount;
        out.largeBuyVolume += bucket2.largeBuyVolume;
        out.largeSellVolume += bucket2.largeSellVolume;
        out.forcedBuyVolume += bucket2.forcedBuyVolume;
        out.forcedSellVolume += bucket2.forcedSellVolume;
        if (bucket2.largestBuy > out.largestBuy) out.largestBuy = bucket2.largestBuy;
        if (bucket2.largestSell > out.largestSell) out.largestSell = bucket2.largestSell;
        out.bucketCount += 1;
        if (!opened) {
          out.priceOpen = bucket2.priceOpen;
          out.priceHigh = bucket2.priceHigh;
          out.priceLow = bucket2.priceLow;
          opened = true;
        } else {
          if (bucket2.priceHigh > out.priceHigh) out.priceHigh = bucket2.priceHigh;
          if (bucket2.priceLow > 0 && (out.priceLow === 0 || bucket2.priceLow < out.priceLow)) {
            out.priceLow = bucket2.priceLow;
          }
        }
        out.priceClose = bucket2.priceClose || out.priceClose;
      }
      return out;
    }
    latestPrice() {
      if (this.lastIndex < 0) return 0;
      return this.buckets[this.lastIndex]?.priceClose ?? 0;
    }
    buyVolumesForLastN(n, now) {
      const values = [];
      const current = this.bucketStart(now);
      for (let i = n - 1; i >= 0; i--) {
        const start = current - i * this.bucketMs;
        const bucket2 = this.getBucket(start);
        values.push(bucket2?.buyVolume ?? 0);
      }
      return values;
    }
    sellVolumesForLastN(n, now) {
      const values = [];
      const current = this.bucketStart(now);
      for (let i = n - 1; i >= 0; i--) {
        const start = current - i * this.bucketMs;
        const bucket2 = this.getBucket(start);
        values.push(bucket2?.sellVolume ?? 0);
      }
      return values;
    }
    ensureBucket(startMs) {
      if (Number.isNaN(this.lastStart)) {
        this.lastStart = startMs;
        this.lastIndex = 0;
        this.buckets[0] = emptyBucket(startMs);
        this.filled = 1;
        return this.buckets[0];
      }
      if (startMs === this.lastStart) {
        return this.buckets[this.lastIndex] ?? null;
      }
      if (startMs < this.lastStart) {
        return this.getBucket(startMs) ?? null;
      }
      const gap = Math.floor((startMs - this.lastStart) / this.bucketMs);
      if (gap >= this.maxBuckets) {
        this.buckets.forEach((_, i) => {
          this.buckets[i] = emptyBucket(0);
        });
        this.lastStart = startMs;
        this.lastIndex = 0;
        this.buckets[0] = emptyBucket(startMs);
        this.filled = 1;
        return this.buckets[0];
      }
      for (let i = 0; i < gap; i++) {
        this.lastIndex = (this.lastIndex + 1) % this.maxBuckets;
        const nextStart = this.lastStart + this.bucketMs;
        this.buckets[this.lastIndex] = emptyBucket(nextStart);
        this.lastStart = nextStart;
        if (this.filled < this.maxBuckets) this.filled += 1;
      }
      return this.buckets[this.lastIndex] ?? null;
    }
    getBucket(startMs) {
      if (this.filled === 0 || Number.isNaN(this.lastStart)) return void 0;
      const offset = Math.round((this.lastStart - startMs) / this.bucketMs);
      if (offset < 0 || offset >= this.filled) return void 0;
      const index = (this.lastIndex - offset + this.maxBuckets) % this.maxBuckets;
      const bucket2 = this.buckets[index];
      return bucket2?.startMs === startMs ? bucket2 : void 0;
    }
  };

  // src/flow/rolling-flow-engine.ts
  var RollingFlowEngine = class {
    constructor(config) {
      this.config = config;
      this.buckets = new BucketRing(config.bucketMs, config.maxBuckets);
      this.buyBaseline = new RollingDistribution(config.historicalBaselineSamples);
      this.sellBaseline = new RollingDistribution(config.historicalBaselineSamples);
    }
    buckets;
    buyBaseline;
    sellBaseline;
    lastBaselineSecond = -1;
    onTrade(timestamp, side2, quoteValue, price, isLarge, isForced) {
      this.buckets.add(timestamp, side2, quoteValue, price, isLarge, isForced);
      this.maybeRecordBaseline(timestamp);
    }
    touchPrice(timestamp, price) {
      this.buckets.touchPrice(timestamp, price);
    }
    view(window, now) {
      const windowMs = WINDOW_MS[window];
      const agg = this.buckets.aggregate(now - windowMs, now + 1);
      const multiples = this.scaledMultiples(window, agg);
      const seconds = windowMs / 1e3;
      const buyRank = this.buyBaseline.percentileRank(seconds === 0 ? agg.buyVolume : agg.buyVolume / seconds);
      const sellRank = this.sellBaseline.percentileRank(seconds === 0 ? agg.sellVolume : agg.sellVolume / seconds);
      return {
        window,
        windowMs,
        agg,
        delta: computeDelta(agg),
        shares: flowShares(agg),
        flowMultipleBuy: multiples.buy,
        flowMultipleSell: multiples.sell,
        buyFlowPercentile: buyRank,
        sellFlowPercentile: sellRank,
        largeBuyFlowAcceleration: this.acceleration("BUY", now),
        largeSellFlowAcceleration: this.acceleration("SELL", now)
      };
    }
    seedBaseline(side2, volumes) {
      const dist = side2 === "BUY" ? this.buyBaseline : this.sellBaseline;
      for (const v of volumes) dist.add(v);
    }
    flowMultiple(window, agg, side2) {
      const seconds = WINDOW_MS[window] / 1e3;
      const dist = side2 === "BUY" ? this.buyBaseline : this.sellBaseline;
      const current = side2 === "BUY" ? agg.buyVolume : agg.sellVolume;
      const medianPerSecond = dist.median();
      const expected = medianPerSecond * seconds;
      if (expected === 0) return current === 0 ? 1 : 99;
      return current / expected;
    }
    scaledMultiples(window, agg) {
      return {
        buy: this.flowMultiple(window, agg, "BUY"),
        sell: this.flowMultiple(window, agg, "SELL")
      };
    }
    maybeRecordBaseline(timestamp) {
      const second = Math.floor(timestamp / 1e3);
      if (this.lastBaselineSecond < 0) {
        this.lastBaselineSecond = second;
        return;
      }
      if (second === this.lastBaselineSecond) return;
      const agg = this.buckets.aggregate(this.lastBaselineSecond * 1e3, (this.lastBaselineSecond + 1) * 1e3);
      this.buyBaseline.add(agg.buyVolume);
      this.sellBaseline.add(agg.sellVolume);
      this.lastBaselineSecond = second;
    }
    acceleration(side2, now) {
      const n = this.config.accelerationLookbackBuckets;
      const series = side2 === "BUY" ? this.buckets.buyVolumesForLastN(n, now) : this.buckets.sellVolumesForLastN(n, now);
      if (series.length < 3) return "NONE";
      const recent = series.slice(-3);
      const diffs = [recent[1] - recent[0], recent[2] - recent[1]];
      const accel = diffs[1] - diffs[0];
      const last = recent[2];
      if (last <= 0 && diffs[1] <= 0) return "NONE";
      if (diffs[1] < 0 && diffs[0] > 0) return "DECELERATING";
      const rel = last === 0 ? 0 : accel / Math.max(last, 1);
      if (rel > 0.25 || diffs[1] > 0 && diffs[1] > diffs[0] * 1.5 && diffs[1] > 0) return "STRONG";
      if (rel > 0.08 || diffs[1] > diffs[0]) return "MODERATE";
      if (diffs[1] > 0) return "WEAK";
      if (diffs[1] < 0) return "DECELERATING";
      return "NONE";
    }
  };

  // src/flow/tape.ts
  var LargeTradeTape = class {
    ring;
    constructor(capacity) {
      this.ring = new RingBuffer(capacity);
    }
    push(entry) {
      this.ring.push(entry);
    }
    query(filter = {}) {
      const out = [];
      for (const e of this.ring.values()) {
        if (filter.symbol && e.symbol !== filter.symbol) continue;
        if (filter.side && e.side !== filter.side) continue;
        if (filter.minQuoteValue !== void 0 && e.quoteValue < filter.minQuoteValue) continue;
        if (filter.fromTimestamp !== void 0 && e.timestamp < filter.fromTimestamp) continue;
        if (filter.toTimestamp !== void 0 && e.timestamp > filter.toTimestamp) continue;
        if (filter.minRelativePercentile !== void 0 && relativeFloor(e.relativeClass) < filter.minRelativePercentile) {
          continue;
        }
        out.push(e);
      }
      return out;
    }
    format(filter = {}) {
      const rows = this.query(filter);
      const header = "TIME       SIDE    PRICE       SIZE";
      const lines = rows.map((e) => {
        const time = formatTapeTime(e.timestamp).padEnd(10);
        const side2 = e.side.padEnd(7);
        const price = e.price.toFixed(2).padEnd(12);
        return `${time}${side2}${price}${formatQuote(e.quoteValue)}`;
      });
      return [header, ...lines].join("\n");
    }
  };
  function relativeFloor(cls) {
    switch (cls) {
      case "EXTREME":
        return 99.9;
      case "VERY_LARGE":
        return 99;
      case "LARGE":
        return 95;
      default:
        return 0;
    }
  }

  // src/liquidity/consumption-engine.ts
  var ConsumptionEngine = class {
    constructor(windowMs, capacity = 2048) {
      this.windowMs = windowMs;
      this.samples = new RingBuffer(capacity);
    }
    samples;
    last = null;
    askConsumed = 0;
    bidConsumed = 0;
    askReplaced = 0;
    bidReplaced = 0;
    windowStart = 0;
    observe(timestamp, bid, ask, buyVolumeDelta, sellVolumeDelta) {
      if (!this.last) {
        this.last = { timestamp, bid, ask, buyVolume: buyVolumeDelta, sellVolume: sellVolumeDelta };
        this.windowStart = timestamp;
        this.samples.push(this.last);
        return this.rates();
      }
      const askDrop = Math.max(0, this.last.ask - ask);
      const askRise = Math.max(0, ask - this.last.ask);
      const bidDrop = Math.max(0, this.last.bid - bid);
      const bidRise = Math.max(0, bid - this.last.bid);
      const expectedAskDrop = buyVolumeDelta;
      const expectedBidDrop = sellVolumeDelta;
      this.askConsumed += Math.min(askDrop, expectedAskDrop || askDrop);
      this.bidConsumed += Math.min(bidDrop, expectedBidDrop || bidDrop);
      this.askReplaced += Math.max(askRise, Math.max(0, expectedAskDrop - askDrop));
      this.bidReplaced += Math.max(bidRise, Math.max(0, expectedBidDrop - bidDrop));
      this.last = { timestamp, bid, ask, buyVolume: buyVolumeDelta, sellVolume: sellVolumeDelta };
      this.samples.push(this.last);
      if (timestamp - this.windowStart > this.windowMs) {
        const scale = this.windowMs / Math.max(1, timestamp - this.windowStart);
        this.askConsumed *= scale;
        this.bidConsumed *= scale;
        this.askReplaced *= scale;
        this.bidReplaced *= scale;
        this.windowStart = timestamp - this.windowMs;
      }
      return this.rates();
    }
    rates() {
      return {
        askConsumptionRate: this.askConsumed,
        bidConsumptionRate: this.bidConsumed,
        askReplenishmentRate: this.askReplaced,
        bidReplenishmentRate: this.bidReplaced
      };
    }
    replenishmentRatio(side2) {
      const rates = this.rates();
      if (side2 === "ask") {
        return safeDiv(rates.askReplenishmentRate, rates.askReplenishmentRate + rates.askConsumptionRate);
      }
      return safeDiv(rates.bidReplenishmentRate, rates.bidReplenishmentRate + rates.bidConsumptionRate);
    }
    reset() {
      this.last = null;
      this.askConsumed = 0;
      this.bidConsumed = 0;
      this.askReplaced = 0;
      this.bidReplaced = 0;
    }
  };

  // src/liquidity/defense-engine.ts
  var DefenseEngine = class {
    constructor(config) {
      this.config = config;
    }
    zones = /* @__PURE__ */ new Map();
    bidDefenseStrength(input) {
      if (input.aggressiveSell < this.config.minAttackQuote * 0.25) return 0;
      const persist = persistRatio(input.bidFinal, input.bidInitial);
      const replenish = replenishShare(input.bidReplenished, input.bidConsumed);
      const reject = input.priceChangePercent >= -0.08 ? 1 : clamp(1 + input.priceChangePercent / 0.4, 0, 1);
      return clamp(100 * (0.35 * replenish + 0.3 * persist + 0.35 * reject), 0, 100);
    }
    askDefenseStrength(input) {
      if (input.aggressiveBuy < this.config.minAttackQuote * 0.25) return 0;
      const persist = persistRatio(input.askFinal, input.askInitial);
      const replenish = replenishShare(input.askReplenished, input.askConsumed);
      const reject = input.priceChangePercent <= 0.08 ? 1 : clamp(1 - input.priceChangePercent / 0.4, 0, 1);
      return clamp(100 * (0.35 * replenish + 0.3 * persist + 0.35 * reject), 0, 100);
    }
    failure(input) {
      const askRatio = consumeRatio(input.askConsumed, input.askReplenished);
      const bidRatio = consumeRatio(input.bidConsumed, input.bidReplenished);
      if (input.aggressiveBuy >= this.config.minAttackQuote && askRatio >= this.config.consumeOverReplenish && input.priceChangePercent > 0.05 && input.askFinal < input.askInitial * 0.6) {
        return {
          type: "PASSIVE_SELLER_FAILURE",
          price: input.price,
          consumedLiquidity: input.askConsumed,
          priceResponse: input.priceChangePercent,
          confidence: clamp(0.55 + Math.min(askRatio / 10, 0.3), 0, 1)
        };
      }
      if (input.aggressiveSell >= this.config.minAttackQuote && bidRatio >= this.config.consumeOverReplenish && input.priceChangePercent < -0.05 && input.bidFinal < input.bidInitial * 0.6) {
        return {
          type: "PASSIVE_BUYER_FAILURE",
          price: input.price,
          consumedLiquidity: input.bidConsumed,
          priceResponse: input.priceChangePercent,
          confidence: clamp(0.55 + Math.min(bidRatio / 10, 0.3), 0, 1)
        };
      }
      return null;
    }
    noteDefense(price, side2, absorbed, replenished, priceResponse, strength) {
      const key3 = `${side2}:${bucket(price, this.config.zoneBps)}`;
      const half = price * (this.config.zoneBps / 1e4);
      const prev = this.zones.get(key3);
      const zone = prev ? {
        ...prev,
        testCount: prev.testCount + 1,
        totalAggressiveVolumeAbsorbed: prev.totalAggressiveVolumeAbsorbed + absorbed,
        replenishmentVolume: prev.replenishmentVolume + replenished,
        averagePriceResponse: (prev.averagePriceResponse * prev.testCount + priceResponse) / (prev.testCount + 1),
        defenseStrength: Math.max(prev.defenseStrength, strength)
      } : {
        priceMin: price - half,
        priceMax: price + half,
        side: side2,
        testCount: 1,
        totalAggressiveVolumeAbsorbed: absorbed,
        replenishmentVolume: replenished,
        averagePriceResponse: priceResponse,
        defenseStrength: strength
      };
      this.zones.set(key3, zone);
      if (this.zones.size > 64) {
        const first = this.zones.keys().next().value;
        if (first) this.zones.delete(first);
      }
      return zone;
    }
  };
  function persistRatio(finalV, initial) {
    if (initial <= 0) return finalV > 0 ? 1 : 0;
    return clamp(finalV / initial, 0, 1.5) / 1.5;
  }
  function replenishShare(replenished, consumed) {
    const tot = replenished + consumed;
    if (tot <= 0) return 0;
    return clamp(replenished / tot, 0, 1);
  }
  function consumeRatio(consumed, replenished) {
    if (replenished <= 0) return consumed > 0 ? 99 : 0;
    return consumed / replenished;
  }
  function bucket(price, bps2) {
    const step = price * (bps2 / 1e4);
    if (step <= 0) return price;
    return Math.round(price / step) * step;
  }

  // src/liquidity/iceberg-detector.ts
  var IcebergLikeDetector = class {
    constructor(config) {
      this.config = config;
    }
    aggressiveAtPrice = /* @__PURE__ */ new Map();
    onTrade(trade, book) {
      const key3 = `${trade.side}:${trade.price}`;
      const prev = this.aggressiveAtPrice.get(key3) ?? { quote: 0, side: trade.side, price: trade.price };
      prev.quote += trade.quoteValue;
      this.aggressiveAtPrice.set(key3, prev);
      if (this.aggressiveAtPrice.size > 512) this.aggressiveAtPrice.clear();
      if (prev.quote < this.config.minAggressiveQuote) return null;
      if (trade.isAggressiveBuy) {
        const visible = book.levelQuote("ask", trade.price);
        if (visible > 0 && prev.quote >= visible * this.config.minAggressiveOverVisible) {
          return {
            type: "ICEBERG_LIKE_SELL_ABSORPTION",
            price: trade.price,
            visibleQuote: visible,
            aggressiveQuote: prev.quote,
            note: "possible hidden/replenishing liquidity"
          };
        }
      } else {
        const visible = book.levelQuote("bid", trade.price);
        if (visible > 0 && prev.quote >= visible * this.config.minAggressiveOverVisible) {
          return {
            type: "ICEBERG_LIKE_BUY_ABSORPTION",
            price: trade.price,
            visibleQuote: visible,
            aggressiveQuote: prev.quote,
            note: "possible hidden/replenishing liquidity"
          };
        }
      }
      return null;
    }
  };

  // src/liquidity/liquidity-engine.ts
  var LiquidityEngine = class {
    constructor(config) {
      this.config = config;
    }
    pressure(buyVolume, sellVolume, book) {
      const near = this.config.nearBandPct;
      const mid = book.mid();
      const askLiq = book.notionalWithin("ask", mid, near);
      const bidLiq = book.notionalWithin("bid", mid, near);
      return {
        buyPressure: safeDiv(buyVolume, askLiq),
        sellPressure: safeDiv(sellVolume, bidLiq)
      };
    }
    regime(largeBuy, largeSell, buyVolume, sellVolume, book, askReplenishment, bidReplenishment, askConsumption, bidConsumption) {
      const mid = book.mid();
      const asks = book.notionalWithin("ask", mid, this.config.nearBandPct);
      const bids = book.notionalWithin("bid", mid, this.config.nearBandPct);
      const thinAsks = asks > 0 && asks <= this.config.thinAskQuote;
      const thinBids = bids > 0 && bids <= this.config.thinBidQuote;
      const heavyAskRepl = askReplenishment > askConsumption && askReplenishment > 0;
      const heavyBidRepl = bidReplenishment > bidConsumption && bidReplenishment > 0;
      if (largeBuy && heavyAskRepl) return "LARGE_BUY_FLOW_HEAVY_ASK_REPLENISHMENT";
      if (largeSell && heavyBidRepl) return "LARGE_SELL_FLOW_HEAVY_BID_REPLENISHMENT";
      if (largeBuy && (thinAsks || buyVolume > asks * 3)) return "LARGE_BUY_FLOW_THIN_ASKS";
      if (largeSell && (thinBids || sellVolume > bids * 3)) return "LARGE_SELL_FLOW_THIN_BIDS";
      return "BALANCED";
    }
  };

  // src/models/liquidity.ts
  var DEFAULT_BPS_BANDS = [0.05, 0.1, 0.25, 0.5, 1];

  // src/liquidity/local-order-book.ts
  function key(price) {
    return price.toString();
  }
  var LocalOrderBook = class {
    bids = /* @__PURE__ */ new Map();
    asks = /* @__PURE__ */ new Map();
    lastUpdateId = 0;
    timestamp = 0;
    symbol = "";
    stale = false;
    applySnapshot(snapshot) {
      const thin = snapshot.bids.length <= 1 && snapshot.asks.length <= 1;
      if (thin && this.bids.size + this.asks.size > 2) {
        return;
      }
      this.bids.clear();
      this.asks.clear();
      this.symbol = snapshot.symbol;
      this.timestamp = snapshot.timestamp;
      this.lastUpdateId = snapshot.lastUpdateId ?? this.lastUpdateId;
      this.stale = false;
      for (const lvl of snapshot.bids) this.upsert("bid", lvl);
      for (const lvl of snapshot.asks) this.upsert("ask", lvl);
    }
    applyDelta(delta) {
      if (this.lastUpdateId && delta.firstUpdateId !== void 0 && delta.firstUpdateId > this.lastUpdateId + 1) {
        this.stale = true;
        return { ok: false, gap: true };
      }
      this.timestamp = delta.timestamp;
      this.lastUpdateId = delta.finalUpdateId ?? this.lastUpdateId;
      for (const lvl of delta.bids) this.upsert("bid", lvl);
      for (const lvl of delta.asks) this.upsert("ask", lvl);
      return { ok: true, gap: false };
    }
    bestBid() {
      let best = null;
      for (const lvl of this.bids.values()) {
        if (!best || lvl.price > best.price) best = toLevel(lvl);
      }
      return best;
    }
    bestAsk() {
      let best = null;
      for (const lvl of this.asks.values()) {
        if (!best || lvl.price < best.price) best = toLevel(lvl);
      }
      return best;
    }
    mid() {
      const bid = this.bestBid();
      const ask = this.bestAsk();
      if (bid && ask) return (bid.price + ask.price) / 2;
      return bid?.price ?? ask?.price ?? 0;
    }
    spreadBps() {
      const bid = this.bestBid();
      const ask = this.bestAsk();
      if (!bid || !ask || bid.price === 0) return Number.POSITIVE_INFINITY;
      return (ask.price - bid.price) / bid.price * 1e4;
    }
    levelQuote(side2, price) {
      const map = side2 === "bid" ? this.bids : this.asks;
      const lvl = map.get(key(price));
      if (!lvl) return 0;
      return lvl.price * lvl.quantity;
    }
    nearbyLiquidity(bands = DEFAULT_BPS_BANDS) {
      const mid = this.mid();
      const bid = {};
      const ask = {};
      for (const band of bands) {
        const label = band.toFixed(2);
        bid[label] = this.notionalWithin("bid", mid, band);
        ask[label] = this.notionalWithin("ask", mid, band);
      }
      return { bid, ask };
    }
    notionalWithin(side2, mid, bandPct) {
      if (mid <= 0) return 0;
      const bound = side2 === "bid" ? mid * (1 - bandPct / 100) : mid * (1 + bandPct / 100);
      return this.notionalBetween(side2, mid, bound);
    }
    /** Quote notional between two prices, inclusive of the farther bound, exclusive of mid. */
    notionalBetween(side2, fromPrice, toPrice) {
      const lo = Math.min(fromPrice, toPrice);
      const hi = Math.max(fromPrice, toPrice);
      const map = side2 === "bid" ? this.bids : this.asks;
      let sum = 0;
      for (const lvl of map.values()) {
        if (side2 === "ask" && lvl.price > lo && lvl.price <= hi) sum += lvl.price * lvl.quantity;
        if (side2 === "bid" && lvl.price < hi && lvl.price >= lo) sum += lvl.price * lvl.quantity;
      }
      return sum;
    }
    sortedLevels(side2) {
      const map = side2 === "bid" ? this.bids : this.asks;
      const levels2 = [...map.values()].map(toLevel);
      levels2.sort((a, b) => side2 === "bid" ? b.price - a.price : a.price - b.price);
      return levels2;
    }
    /** Keep the nearest levels so a diff stream cannot grow the book without bound. */
    retainNearest(maxPerSide) {
      if (maxPerSide <= 0) return;
      this.trimSide("bid", maxPerSide);
      this.trimSide("ask", maxPerSide);
    }
    empty() {
      return this.bids.size === 0 && this.asks.size === 0;
    }
    trimSide(side2, maxPerSide) {
      const levels2 = this.sortedLevels(side2);
      if (levels2.length <= maxPerSide) return;
      const map = side2 === "bid" ? this.bids : this.asks;
      const keep = new Set(levels2.slice(0, maxPerSide).map((lvl) => key(lvl.price)));
      for (const price of map.keys()) {
        if (!keep.has(price)) map.delete(price);
      }
    }
    upsert(side2, lvl) {
      const map = side2 === "bid" ? this.bids : this.asks;
      const k = key(lvl.price);
      if (lvl.quantity <= 0) {
        map.delete(k);
        return;
      }
      map.set(k, { price: lvl.price, quantity: lvl.quantity });
    }
  };
  function toLevel(lvl) {
    return { price: lvl.price, quantity: lvl.quantity, quoteValue: lvl.price * lvl.quantity };
  }

  // src/movement/math.ts
  function tickSizeForPrice(price) {
    if (price >= 1e4) return 0.1;
    if (price >= 1e3) return 0.1;
    if (price >= 100) return 0.01;
    if (price >= 10) return 1e-3;
    if (price >= 1) return 1e-4;
    return 1e-5;
  }
  function roundToTick(price, tick = tickSizeForPrice(price)) {
    if (tick <= 0) return price;
    return Math.round(price / tick) * tick;
  }
  function atrFromRange(price, high, low, minPctOfPrice) {
    const range = high > 0 && low > 0 ? Math.abs(high - low) : 0;
    const floor = price * (minPctOfPrice / 100);
    return Math.max(range, floor, tickSizeForPrice(price));
  }
  function distancePercent(from, to) {
    if (from <= 0) return 0;
    return (to - from) / from * 100;
  }
  function efficiencyFactor(efficiency2) {
    if (efficiency2 === "LOW") return 0.25;
    if (efficiency2 === "EXTREME") return 1;
    if (efficiency2 === "HIGH") return 0.85;
    return 0.55;
  }
  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  // src/movement/liquidity-target-generator.ts
  var LiquidityTargetGenerator = class {
    constructor(config) {
      this.config = config;
    }
    prices(currentPrice, atr, side2) {
      if (currentPrice <= 0) return [];
      const tick = tickSizeForPrice(currentPrice);
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      const push = (raw) => {
        const price = roundToTick(raw, tick);
        if (side2 === "UP" && price <= currentPrice) return;
        if (side2 === "DOWN" && price >= currentPrice) return;
        if (price <= 0) return;
        const key3 = price.toFixed(8);
        if (seen.has(key3)) return;
        seen.add(key3);
        out.push(price);
      };
      for (const pct of this.config.percentSteps) {
        const delta = currentPrice * (pct / 100);
        push(side2 === "UP" ? currentPrice + delta : currentPrice - delta);
      }
      for (const mult of this.config.atrMultiples) {
        const delta = atr * mult;
        if (delta <= 0) continue;
        push(side2 === "UP" ? currentPrice + delta : currentPrice - delta);
      }
      out.sort((a, b) => side2 === "UP" ? a - b : b - a);
      return out.slice(0, this.config.maxTargetsPerSide);
    }
  };

  // src/liquidity/liquidity-depth-engine.ts
  var LiquidityDepthEngine = class {
    constructor(config, sampleSize = 1024) {
      this.config = config;
      this.askNotionalHist = new RollingDistribution(sampleSize);
      this.bidNotionalHist = new RollingDistribution(sampleSize);
      this.densityHist = new RollingDistribution(sampleSize);
      this.generator = new LiquidityTargetGenerator(config);
    }
    askNotionalHist;
    bidNotionalHist;
    densityHist;
    generator;
    observeBook(book) {
      if (book.empty()) return;
      const mid = book.mid();
      const nearbyAsk = book.notionalWithin("ask", mid, this.config.nearbyBandPct);
      const nearbyBid = book.notionalWithin("bid", mid, this.config.nearbyBandPct);
      if (nearbyAsk > 0) this.askNotionalHist.add(nearbyAsk);
      if (nearbyBid > 0) this.bidNotionalHist.add(nearbyBid);
    }
    map(book, priceHigh = 0, priceLow = 0) {
      const currentPrice = book.mid();
      const atr = atrFromRange(currentPrice, priceHigh, priceLow, this.config.minAtrPctOfPrice);
      if (currentPrice <= 0 || book.empty()) {
        return { currentPrice, atr, upside: [], downside: [] };
      }
      this.observeBook(book);
      const upside = this.generator.prices(currentPrice, atr, "UP").map(
        (price) => this.target(book, currentPrice, price, "ask")
      );
      const downside = this.generator.prices(currentPrice, atr, "DOWN").map(
        (price) => this.target(book, currentPrice, price, "bid")
      );
      return { currentPrice, atr, upside, downside };
    }
    nearby(book) {
      const mid = book.mid();
      return {
        ask: book.notionalWithin("ask", mid, this.config.nearbyBandPct),
        bid: book.notionalWithin("bid", mid, this.config.nearbyBandPct)
      };
    }
    classifyDensity(density) {
      const median3 = this.densityHist.median();
      if (median3 <= 0) {
        if (density <= 0) return "THIN";
        return "NORMAL";
      }
      const ratio = density / median3;
      if (ratio < this.config.densityThinRatio) return "THIN";
      if (ratio >= this.config.densityExtremeRatio) return "EXTREMELY_THICK";
      if (ratio >= this.config.densityThickRatio) return "THICK";
      return "NORMAL";
    }
    target(book, currentPrice, price, side2) {
      const cumulativeLiquidity = book.notionalBetween(side2, currentPrice, price);
      const distPct = Math.abs(distancePercent(currentPrice, price));
      const liquidityDensity = safeDiv(cumulativeLiquidity, Math.max(distPct, 1e-6));
      if (liquidityDensity > 0) this.densityHist.add(liquidityDensity);
      const hist = side2 === "ask" ? this.askNotionalHist : this.bidNotionalHist;
      const relativeLiquidity = hist.size > 4 ? hist.ratioToMedian(cumulativeLiquidity) : 1;
      const difficultyScore = hist.size > 4 ? hist.percentileRank(cumulativeLiquidity) : 50;
      return {
        price,
        distancePercent: side2 === "ask" ? distPct : -distPct,
        cumulativeLiquidity,
        liquidityDensity,
        relativeLiquidity: Number.isFinite(relativeLiquidity) ? relativeLiquidity : 1,
        difficultyScore,
        densityClass: this.classifyDensity(liquidityDensity)
      };
    }
  };

  // src/liquidity/liquidity-dynamics-engine.ts
  var LiquidityDynamicsEngine = class {
    constructor(windowMs = 6e4, sampleSize = 1024) {
      this.windowMs = windowMs;
      this.askConsHist = new RollingDistribution(sampleSize);
      this.bidConsHist = new RollingDistribution(sampleSize);
      this.askReplHist = new RollingDistribution(sampleSize);
      this.bidReplHist = new RollingDistribution(sampleSize);
      this.askPullHist = new RollingDistribution(sampleSize);
      this.bidPullHist = new RollingDistribution(sampleSize);
    }
    prev = null;
    windowStart = 0;
    askConsumed = 0;
    bidConsumed = 0;
    askReplaced = 0;
    bidReplaced = 0;
    askPulled = 0;
    bidPulled = 0;
    lastAskDropByPrice = /* @__PURE__ */ new Map();
    lastBidDropByPrice = /* @__PURE__ */ new Map();
    lastBuyFlowAvailable = 0;
    lastSellFlowAvailable = 0;
    unmatchedBuy = 0;
    unmatchedSell = 0;
    lastFlowAt = 0;
    flowMatchMs = 2e3;
    askConsHist;
    bidConsHist;
    askReplHist;
    bidReplHist;
    askPullHist;
    bidPullHist;
    observe(timestamp, book, buyDelta, sellDelta) {
      const curr = {
        asks: quoteMap(book, "ask"),
        bids: quoteMap(book, "bid")
      };
      this.lastAskDropByPrice = /* @__PURE__ */ new Map();
      this.lastBidDropByPrice = /* @__PURE__ */ new Map();
      if (!this.prev) {
        this.prev = curr;
        this.windowStart = timestamp;
        this.creditFlow(timestamp, buyDelta, sellDelta);
        return this.snapshot();
      }
      this.creditFlow(timestamp, buyDelta, sellDelta);
      const ask = diffSide(this.prev.asks, curr.asks);
      const bid = diffSide(this.prev.bids, curr.bids);
      this.lastAskDropByPrice = ask.dropByPrice;
      this.lastBidDropByPrice = bid.dropByPrice;
      this.lastBuyFlowAvailable = this.unmatchedBuy;
      this.lastSellFlowAvailable = this.unmatchedSell;
      const askConsumedNow = Math.min(ask.drop, this.unmatchedBuy);
      const bidConsumedNow = Math.min(bid.drop, this.unmatchedSell);
      this.unmatchedBuy -= askConsumedNow;
      this.unmatchedSell -= bidConsumedNow;
      const askPulledNow = Math.max(0, ask.drop - askConsumedNow);
      const bidPulledNow = Math.max(0, bid.drop - bidConsumedNow);
      this.askConsumed += askConsumedNow;
      this.bidConsumed += bidConsumedNow;
      this.askPulled += askPulledNow;
      this.bidPulled += bidPulledNow;
      this.askReplaced += ask.rise;
      this.bidReplaced += bid.rise;
      if (askConsumedNow > 0) this.askConsHist.add(askConsumedNow);
      if (ask.rise > 0) this.askReplHist.add(ask.rise);
      if (askPulledNow > 0) this.askPullHist.add(askPulledNow);
      if (bidConsumedNow > 0) this.bidConsHist.add(bidConsumedNow);
      if (bid.rise > 0) this.bidReplHist.add(bid.rise);
      if (bidPulledNow > 0) this.bidPullHist.add(bidPulledNow);
      this.prev = curr;
      if (timestamp - this.windowStart > this.windowMs) {
        const scale = this.windowMs / Math.max(1, timestamp - this.windowStart);
        this.askConsumed *= scale;
        this.bidConsumed *= scale;
        this.askReplaced *= scale;
        this.bidReplaced *= scale;
        this.askPulled *= scale;
        this.bidPulled *= scale;
        this.windowStart = timestamp - this.windowMs;
      }
      return this.snapshot();
    }
    creditFlow(timestamp, buyDelta, sellDelta) {
      if (this.lastFlowAt > 0 && timestamp - this.lastFlowAt > this.flowMatchMs) {
        this.unmatchedBuy = 0;
        this.unmatchedSell = 0;
      }
      this.unmatchedBuy += Math.max(0, buyDelta);
      this.unmatchedSell += Math.max(0, sellDelta);
      if (buyDelta > 0 || sellDelta > 0) this.lastFlowAt = timestamp;
    }
    snapshot() {
      return {
        askConsumptionRate: this.askConsumed,
        bidConsumptionRate: this.bidConsumed,
        askReplenishmentRate: this.askReplaced,
        bidReplenishmentRate: this.bidReplaced,
        askPullRate: this.askPulled,
        bidPullRate: this.bidPulled,
        askConsumptionNorm: norm(this.askConsHist, this.askConsumed),
        bidConsumptionNorm: norm(this.bidConsHist, this.bidConsumed),
        askReplenishmentNorm: norm(this.askReplHist, this.askReplaced),
        bidReplenishmentNorm: norm(this.bidReplHist, this.bidReplaced),
        askPullNorm: norm(this.askPullHist, this.askPulled),
        bidPullNorm: norm(this.bidPullHist, this.bidPulled)
      };
    }
  };
  function quoteMap(book, side2) {
    const map = /* @__PURE__ */ new Map();
    for (const lvl of book.sortedLevels(side2)) map.set(lvl.price, lvl.quoteValue);
    return map;
  }
  function diffSide(prev, curr) {
    let drop = 0;
    let rise = 0;
    const dropByPrice = /* @__PURE__ */ new Map();
    const prices = /* @__PURE__ */ new Set([...prev.keys(), ...curr.keys()]);
    for (const price of prices) {
      const a = prev.get(price) ?? 0;
      const b = curr.get(price) ?? 0;
      const d = Math.max(0, a - b);
      const r = Math.max(0, b - a);
      drop += d;
      rise += r;
      if (d > 0) dropByPrice.set(price, d);
    }
    return { drop, rise, dropByPrice };
  }
  function norm(hist, value) {
    if (value <= 0) return 0;
    if (hist.size < 4) return 0.65;
    return clamp(hist.percentileRank(value) / 100, 0, 1);
  }

  // src/liquidity/liquidity-vacuum-detector.ts
  var LiquidityVacuumDetector = class {
    constructor(config) {
      this.config = config;
    }
    detect(upside, downside) {
      const events = [];
      const vacuums = [
        ...this.scan(upside, "UPSIDE_LIQUIDITY_VACUUM", events),
        ...this.scan(downside, "DOWNSIDE_LIQUIDITY_VACUUM", events)
      ];
      return { vacuums, events };
    }
    scan(path, kind, events) {
      const out = [];
      for (let i = 0; i < path.length; i++) {
        const anchor = path[i];
        if (anchor.cumulativeLiquidity <= 0) continue;
        if (anchor.densityClass === "THIN") continue;
        const far = path.find(
          (t, j) => j > i && Math.abs(t.distancePercent - anchor.distancePercent) >= 0.15
        );
        if (!far) continue;
        const dist = Math.abs(far.distancePercent - anchor.distancePercent);
        const segment = Math.max(0, far.cumulativeLiquidity - anchor.cumulativeLiquidity);
        const anchorDist = Math.max(1e-6, Math.abs(anchor.distancePercent));
        const prevDensity = anchor.cumulativeLiquidity / anchorDist;
        const density = segment / dist;
        const relative = prevDensity > 0 ? density / prevDensity : 1;
        if (relative > this.config.vacuumDensityRatio) continue;
        out.push({
          kind,
          fromPrice: anchor.price,
          toPrice: far.price,
          segmentLiquidity: segment,
          relativeDensity: relative
        });
        events.push(kind);
        break;
      }
      return out;
    }
  };

  // src/liquidity/liquidity-wall-detector.ts
  function median(values) {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  var LiquidityWallDetector = class {
    constructor(config, sampleSize = 2048) {
      this.config = config;
      this.levelHist = new RollingDistribution(sampleSize);
    }
    levelHist;
    lastQuote = /* @__PURE__ */ new Map();
    detect(book, dynamics, buyDelta, sellDelta) {
      const events = [];
      const walls = [
        ...this.scan(book, "ask", "ASK_LIQUIDITY_WALL", dynamics.lastAskDropByPrice, buyDelta, events),
        ...this.scan(book, "bid", "BID_LIQUIDITY_WALL", dynamics.lastBidDropByPrice, sellDelta, events)
      ];
      return { walls, events };
    }
    scan(book, side2, kind, dropByPrice, flowDelta, events) {
      const levels2 = book.sortedLevels(side2);
      const out = [];
      const look = this.config.wallLookaround;
      for (let i = 0; i < levels2.length; i++) {
        const lvl = levels2[i];
        const nearby = [];
        for (let j = Math.max(0, i - look); j <= Math.min(levels2.length - 1, i + look); j++) {
          if (j === i) continue;
          nearby.push(levels2[j].quoteValue);
        }
        const nearbyMed = median(nearby);
        if (lvl.quoteValue > 0) this.levelHist.add(lvl.quoteValue);
        const ratio = nearbyMed > 0 ? lvl.quoteValue / nearbyMed : 0;
        const percentile = this.levelHist.percentileRank(lvl.quoteValue);
        const bootstrap = this.levelHist.size < 8 && ratio >= this.config.wallMultiple * 1.25;
        const relative = ratio >= this.config.wallMultiple && percentile >= this.config.wallMinPercentile;
        if (!bootstrap && !relative) continue;
        const key3 = `${kind}:${lvl.price}`;
        const isNew = !this.lastQuote.has(key3);
        const prev = this.lastQuote.get(key3) ?? lvl.quoteValue;
        const drop = dropByPrice.get(lvl.price) ?? Math.max(0, prev - lvl.quoteValue);
        let status = "ACTIVE";
        if (prev > 0 && drop / prev >= this.config.wallDropFraction) {
          const explained = Math.min(drop, flowDelta) / Math.max(drop, 1e-9);
          status = explained < this.config.pullUnexplainedFraction ? "PULLED" : "CONSUMED";
          events.push(
            status === "PULLED" ? side2 === "ask" ? "ASK_LIQUIDITY_PULLED" : "BID_LIQUIDITY_PULLED" : side2 === "ask" ? "ASK_WALL_CONSUMED" : "BID_WALL_CONSUMED"
          );
        } else if (isNew) {
          events.push(side2 === "ask" ? "ASK_WALL_DETECTED" : "BID_WALL_DETECTED");
        }
        this.lastQuote.set(key3, lvl.quoteValue);
        out.push({
          kind,
          price: lvl.price,
          quoteValue: lvl.quoteValue,
          vsNearbyMedian: ratio,
          percentile,
          status
        });
      }
      this.markMissingWalls(kind, levels2, dropByPrice, flowDelta, events, out);
      return out;
    }
    markMissingWalls(kind, levels2, dropByPrice, flowDelta, events, out) {
      const present = new Set(levels2.map((l) => l.price));
      const prefix = `${kind}:`;
      for (const [key3, prev] of [...this.lastQuote.entries()]) {
        if (!key3.startsWith(prefix)) continue;
        const price = Number(key3.slice(prefix.length));
        if (present.has(price) || prev <= 0) continue;
        const drop = dropByPrice.get(price) ?? prev;
        const explained = Math.min(drop, flowDelta) / Math.max(drop, 1e-9);
        const pulled = explained < this.config.pullUnexplainedFraction;
        events.push(
          pulled ? kind === "ASK_LIQUIDITY_WALL" ? "ASK_LIQUIDITY_PULLED" : "BID_LIQUIDITY_PULLED" : kind === "ASK_LIQUIDITY_WALL" ? "ASK_WALL_CONSUMED" : "BID_WALL_CONSUMED"
        );
        out.push({
          kind,
          price,
          quoteValue: 0,
          vsNearbyMedian: 0,
          percentile: 100,
          status: pulled ? "PULLED" : "CONSUMED"
        });
        this.lastQuote.delete(key3);
      }
    }
  };

  // src/movement/flow-liquidity-ratio.ts
  var FlowLiquidityRatio = class {
    constructor(config, sampleSize = 1024) {
      this.config = config;
      this.buyHist = new RollingDistribution(sampleSize);
      this.sellHist = new RollingDistribution(sampleSize);
      this.netHist = new RollingDistribution(sampleSize);
    }
    buyHist;
    sellHist;
    netHist;
    measure(buyVolume, sellVolume, nearbyAsk, nearbyBid) {
      const buyPressureRatio = nearbyAsk > 0 ? buyVolume / nearbyAsk : buyVolume > 0 ? 8 : 0;
      const sellPressureRatio = nearbyBid > 0 ? sellVolume / nearbyBid : sellVolume > 0 ? 8 : 0;
      const netFlow = buyVolume - sellVolume;
      if (buyVolume + sellVolume > 0) {
        this.buyHist.add(buyPressureRatio);
        this.sellHist.add(sellPressureRatio);
        this.netHist.add(netFlow);
      }
      const netMedian = this.netHist.median();
      return {
        buyPressureRatio,
        sellPressureRatio,
        buyPressurePercentile: this.buyHist.percentileRank(buyPressureRatio),
        sellPressurePercentile: this.sellHist.percentileRank(sellPressureRatio),
        buyLabel: this.label(buyPressureRatio),
        sellLabel: this.label(sellPressureRatio),
        netFlow,
        netFlowVsMedian: netMedian === 0 ? netFlow === 0 ? 1 : 99 : netFlow / netMedian
      };
    }
    seed(buyRatios, sellRatios) {
      for (const v of buyRatios) this.buyHist.add(v);
      for (const v of sellRatios) this.sellHist.add(v);
    }
    label(ratio) {
      if (ratio >= this.config.pressureVeryStrong) return "VERY_STRONG";
      if (ratio >= this.config.pressureStrong) return "STRONG";
      if (ratio >= this.config.pressureModerate) return "MODERATE";
      return "VERY_WEAK";
    }
  };

  // src/movement/target-reachability-engine.ts
  var TargetReachabilityEngine = class {
    constructor(config) {
      this.config = config;
    }
    score(input) {
      const w = this.config.reachability;
      const distAbs = Math.abs(input.target.distancePercent);
      const priceMove = Math.abs(input.target.price) * (distAbs / 100);
      const atrDistance = input.atr > 0 ? priceMove / input.atr : distAbs;
      const coverage = input.target.cumulativeLiquidity > 0 ? input.flowToward / input.target.cumulativeLiquidity : input.flowToward > 0 ? 2 : 0;
      const flowToLiq = clamp01(coverage / 1.5);
      const pressure = clamp01(input.pressureRatio / this.config.pressureVeryStrong);
      const percentile = clamp01(input.pressurePercentile / 100);
      const flowComponent = flowToLiq * 0.6 + pressure * 0.25 + percentile * 0.15;
      const thickPenalty = input.target.densityClass === "EXTREMELY_THICK" ? 0.15 : input.target.densityClass === "THICK" ? 0.4 : input.target.densityClass === "THIN" ? 0.9 : 0.65;
      const relativeHard = clamp01(input.target.relativeLiquidity / 4);
      const densityEase = thickPenalty * (1 - relativeHard * 0.5);
      const distanceEase = 1 - clamp01(atrDistance / 3);
      const efficiency2 = efficiencyFactor(input.impactEfficiency);
      const absorption = input.absorptionToward ? 0.35 : 1;
      const quality = clamp01(input.dataQualityScore);
      const consumptionEase = clamp01(input.consumptionEase * (1 - input.replenishmentDrag));
      const pullingEase = clamp01(input.pullEase);
      let structure = densityEase;
      if (input.wallAhead && input.pullEase < 0.45 && input.consumptionEase < 0.45) structure *= 0.45;
      if (input.vacuumAhead) structure = clamp01(structure + 0.2);
      const raw = w.flowToLiquidity * flowComponent + w.flowAcceleration * 0.5 + w.liquidityConsumption * consumptionEase + w.liquidityPulling * pullingEase + w.liquidationAcceleration * 0.5 + w.priceEfficiency * efficiency2 + w.volatilityDistance * distanceEase + w.structuralAlignment * structure;
      const replenishmentPenalty = input.replenishmentDrag > 0.55 ? 0.7 : 1;
      const reachabilityScore = Math.round(
        clamp(raw * absorption * replenishmentPenalty * (0.5 + 0.5 * quality) * 100, 0, 100)
      );
      return {
        ...input.target,
        reachabilityScore,
        difficulty: this.difficulty(reachabilityScore)
      };
    }
    difficulty(score) {
      if (score >= this.config.easyScore + 10) return "VERY_EASY";
      if (score >= this.config.easyScore) return "EASY";
      if (score >= this.config.moderateScore) return "MODERATE";
      if (score >= this.config.difficultScore) return "DIFFICULT";
      return "VERY_DIFFICULT";
    }
  };

  // src/movement/move-potential-engine.ts
  var MovePotentialEngine = class {
    depth;
    ratios;
    reachability;
    dynamics;
    walls;
    vacuums;
    lastBuyDelta = 0;
    lastSellDelta = 0;
    constructor(config) {
      this.depth = new LiquidityDepthEngine(config.movePotential, config.historicalBaselineSamples);
      this.ratios = new FlowLiquidityRatio(config.movePotential, config.historicalBaselineSamples);
      this.reachability = new TargetReachabilityEngine(config.movePotential);
      this.dynamics = new LiquidityDynamicsEngine(6e4, config.historicalBaselineSamples);
      this.walls = new LiquidityWallDetector(config.movePotential, config.historicalBaselineSamples);
      this.vacuums = new LiquidityVacuumDetector(config.movePotential);
    }
    observe(now, book, buyDelta, sellDelta) {
      this.dynamics.observe(now, book, buyDelta, sellDelta);
      this.lastBuyDelta = this.dynamics.lastBuyFlowAvailable;
      this.lastSellDelta = this.dynamics.lastSellFlowAvailable;
    }
    evaluate(input) {
      const { book } = input;
      const currentPrice = book.mid();
      const dyn = this.dynamics.snapshot();
      if (book.empty() || currentPrice <= 0) {
        return emptySnapshot(input.symbol, currentPrice, input.impactEfficiency, input.dataQualityScore, dyn);
      }
      const map = this.depth.map(book, input.priceHigh, input.priceLow);
      const nearby = this.depth.nearby(book);
      const flow = this.ratios.measure(input.buyVolume, input.sellVolume, nearby.ask, nearby.bid);
      const wallScan = this.walls.detect(book, this.dynamics, this.lastBuyDelta, this.lastSellDelta);
      const vacuumScan = this.vacuums.detect(map.upside, map.downside);
      const quality = clamp(input.dataQualityScore, 0, 1);
      const buyAbs = input.absorption.detected && input.absorption.type === "BUYER_ABSORPTION";
      const sellAbs = input.absorption.detected && input.absorption.type === "SELLER_ABSORPTION";
      const upside = map.upside.map(
        (target) => this.scoreTarget("UP", target, input, flow, nearby.ask, map.atr, quality, buyAbs, dyn, wallScan.walls, vacuumScan.vacuums)
      );
      const downside = map.downside.map(
        (target) => this.scoreTarget("DOWN", target, input, flow, nearby.bid, map.atr, quality, sellAbs, dyn, wallScan.walls, vacuumScan.vacuums)
      );
      const upsidePotential = meanScore(upside.map((t) => t.reachabilityScore));
      const downsidePotential = meanScore(downside.map((t) => t.reachabilityScore));
      const direction = this.direction(flow.buyPressureRatio, flow.sellPressureRatio, quality);
      const path = this.path(upsidePotential, downsidePotential, direction.direction);
      const events = [.../* @__PURE__ */ new Set([...wallScan.events, ...vacuumScan.events])];
      return {
        symbol: input.symbol,
        currentPrice,
        atr: map.atr,
        dataQualityScore: quality,
        direction,
        movePotential: { upsidePotential, downsidePotential },
        pathOfLeastResistance: path,
        flow,
        liquidity: {
          nearbyAskLiquidity: nearby.ask,
          nearbyBidLiquidity: nearby.bid,
          nearbyAskDensityClass: this.depth.classifyDensity(
            nearby.ask / Math.max(configNearbyPct(map.atr, currentPrice), 1e-6)
          ),
          nearbyBidDensityClass: this.depth.classifyDensity(
            nearby.bid / Math.max(configNearbyPct(map.atr, currentPrice), 1e-6)
          ),
          askConsumptionRate: dyn.askConsumptionRate,
          bidConsumptionRate: dyn.bidConsumptionRate,
          askReplenishmentRate: dyn.askReplenishmentRate,
          bidReplenishmentRate: dyn.bidReplenishmentRate,
          askPullRate: dyn.askPullRate,
          bidPullRate: dyn.bidPullRate,
          walls: wallScan.walls,
          vacuums: vacuumScan.vacuums,
          events
        },
        targets: { upside, downside },
        priceImpactEfficiency: input.impactEfficiency,
        warnings: this.warnings(flow, nearby, buyAbs, sellAbs, input.impactEfficiency, path, dyn, events)
      };
    }
    scoreTarget(side2, target, input, flow, opposingNearby, atr, quality, absorptionToward, dyn, walls, vacuums) {
      const askSide = side2 === "UP";
      const lo = Math.min(input.book.mid(), target.price);
      const hi = Math.max(input.book.mid(), target.price);
      const wallAhead = walls.some((w) => {
        const match = askSide ? w.kind === "ASK_LIQUIDITY_WALL" : w.kind === "BID_LIQUIDITY_WALL";
        return match && w.status === "ACTIVE" && w.price >= lo && w.price <= hi;
      });
      const vacuumAhead = vacuums.some((v) => {
        const match = askSide ? v.kind === "UPSIDE_LIQUIDITY_VACUUM" : v.kind === "DOWNSIDE_LIQUIDITY_VACUUM";
        const a = Math.min(v.fromPrice, v.toPrice);
        const b = Math.max(v.fromPrice, v.toPrice);
        return match && a >= lo && b <= hi + 1e-9;
      });
      return this.reachability.score({
        side: side2,
        target,
        flowToward: askSide ? input.buyVolume : input.sellVolume,
        opposingNearby,
        pressureRatio: askSide ? flow.buyPressureRatio : flow.sellPressureRatio,
        pressurePercentile: askSide ? flow.buyPressurePercentile : flow.sellPressurePercentile,
        atr,
        impactEfficiency: input.impactEfficiency,
        absorptionToward,
        dataQualityScore: quality,
        consumptionEase: askSide ? dyn.askConsumptionNorm : dyn.bidConsumptionNorm,
        replenishmentDrag: askSide ? dyn.askReplenishmentNorm : dyn.bidReplenishmentNorm,
        pullEase: askSide ? dyn.askPullNorm : dyn.bidPullNorm,
        wallAhead,
        vacuumAhead
      });
    }
    direction(buy, sell, quality) {
      const total = buy + sell;
      if (total <= 0.05) {
        return { direction: "NEUTRAL", score: 50, confidence: 0.25 * quality };
      }
      const edge = (buy - sell) / Math.max(total, 1e-9);
      const band = 0.12;
      let direction = "NEUTRAL";
      if (edge > band) direction = "UP";
      else if (edge < -band) direction = "DOWN";
      const score = Math.round(clamp(50 + edge * 50, 0, 100));
      const confidence = clamp(Math.abs(edge) * quality, 0, 1);
      return { direction, score, confidence };
    }
    path(up, down, bias) {
      if (Math.abs(up - down) < 8 && bias === "NEUTRAL") return "BALANCED";
      if (up >= down + 8) return "UP";
      if (down >= up + 8) return "DOWN";
      if (bias === "UP") return "UP";
      if (bias === "DOWN") return "DOWN";
      return "BALANCED";
    }
    warnings(flow, nearby, buyAbs, sellAbs, efficiency2, path, dyn, events) {
      const out = [];
      if (flow.buyLabel === "VERY_STRONG" && nearby.ask > 0 && flow.buyPressureRatio >= 1) {
        out.push("Current aggressive buy flow is sufficient relative to nearby displayed ask liquidity.");
      }
      if (flow.sellLabel === "VERY_STRONG" && nearby.bid > 0 && flow.sellPressureRatio >= 1) {
        out.push("Current aggressive sell flow is sufficient relative to nearby displayed bid liquidity.");
      }
      if (nearby.ask > nearby.bid * 2) {
        out.push("Upside path currently has heavier displayed ask liquidity than bids below.");
      }
      if (nearby.bid > nearby.ask * 2) {
        out.push("Downside path currently has heavier displayed bid liquidity than asks above.");
      }
      if (buyAbs) out.push("Buyer absorption is active \u2014 upside reachability is reduced.");
      if (sellAbs) out.push("Seller absorption is active \u2014 downside reachability is reduced.");
      if (dyn.askReplenishmentNorm > 0.55 && flow.buyPressureRatio >= 0.6) {
        out.push("Ask liquidity is replenishing during aggressive buying (possible passive sell absorption).");
      }
      if (dyn.bidReplenishmentNorm > 0.55 && flow.sellPressureRatio >= 0.6) {
        out.push("Bid liquidity is replenishing during aggressive selling (possible passive buy absorption).");
      }
      if (events.includes("ASK_LIQUIDITY_PULLED")) {
        out.push("Ask liquidity was pulled rather than filled \u2014 upside path is easier.");
      }
      if (events.includes("BID_LIQUIDITY_PULLED")) {
        out.push("Bid liquidity was pulled rather than filled \u2014 downside path is easier.");
      }
      if (events.includes("UPSIDE_LIQUIDITY_VACUUM")) {
        out.push("Thin ask pocket detected above \u2014 a break could travel quickly through that region.");
      }
      if (events.includes("DOWNSIDE_LIQUIDITY_VACUUM")) {
        out.push("Thin bid pocket detected below \u2014 a break could travel quickly through that region.");
      }
      if (efficiency2 === "LOW" && (flow.buyPressureRatio > 0.6 || flow.sellPressureRatio > 0.6)) {
        out.push("Aggressive flow is not producing a matching price response.");
      }
      if (path !== "BALANCED") {
        out.push(`Continuation conditions toward ${path} are elevated, but not guaranteed.`);
      }
      return out;
    }
  };
  function meanScore(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  }
  function configNearbyPct(atr, price) {
    if (price <= 0) return 0.35;
    return Math.max(0.15, atr / price * 100 * 0.5);
  }
  function emptyDynamics() {
    return {
      askConsumptionRate: 0,
      bidConsumptionRate: 0,
      askReplenishmentRate: 0,
      bidReplenishmentRate: 0,
      askPullRate: 0,
      bidPullRate: 0,
      askConsumptionNorm: 0,
      bidConsumptionNorm: 0,
      askReplenishmentNorm: 0,
      bidReplenishmentNorm: 0,
      askPullNorm: 0,
      bidPullNorm: 0
    };
  }
  function emptySnapshot(symbol, currentPrice, impactEfficiency, dataQualityScore2, dyn = emptyDynamics()) {
    return {
      symbol,
      currentPrice,
      atr: 0,
      dataQualityScore: dataQualityScore2,
      direction: { direction: "NEUTRAL", score: 50, confidence: 0 },
      movePotential: { upsidePotential: 0, downsidePotential: 0 },
      pathOfLeastResistance: "BALANCED",
      flow: {
        buyPressureRatio: 0,
        sellPressureRatio: 0,
        buyPressurePercentile: 50,
        sellPressurePercentile: 50,
        buyLabel: "VERY_WEAK",
        sellLabel: "VERY_WEAK",
        netFlow: 0,
        netFlowVsMedian: 1
      },
      liquidity: {
        nearbyAskLiquidity: 0,
        nearbyBidLiquidity: 0,
        nearbyAskDensityClass: "THIN",
        nearbyBidDensityClass: "THIN",
        askConsumptionRate: dyn.askConsumptionRate,
        bidConsumptionRate: dyn.bidConsumptionRate,
        askReplenishmentRate: dyn.askReplenishmentRate,
        bidReplenishmentRate: dyn.bidReplenishmentRate,
        askPullRate: dyn.askPullRate,
        bidPullRate: dyn.bidPullRate,
        walls: [],
        vacuums: [],
        events: []
      },
      targets: { upside: [], downside: [] },
      priceImpactEfficiency: impactEfficiency,
      warnings: ["Order book unavailable \u2014 move potential is not scored."]
    };
  }

  // src/passive-flow/passive-flow-engine.ts
  var PassiveFlowEngine = class {
    ticks;
    lastBid = 0;
    lastAsk = 0;
    primed = false;
    constructor(capacity = 4096) {
      this.ticks = new RingBuffer(capacity);
    }
    observe(timestamp, bid, ask) {
      const bidAdded = this.primed ? Math.max(0, bid - this.lastBid) : 0;
      const askAdded = this.primed ? Math.max(0, ask - this.lastAsk) : 0;
      const bidRemoved = this.primed ? Math.max(0, this.lastBid - bid) : 0;
      const askRemoved = this.primed ? Math.max(0, this.lastAsk - ask) : 0;
      this.ticks.push({
        timestamp,
        bid,
        ask,
        bidAdded,
        askAdded,
        bidRemoved,
        askRemoved
      });
      this.lastBid = bid;
      this.lastAsk = ask;
      this.primed = true;
    }
    window(now, windowMs) {
      const start = now - windowMs;
      let bidAdded = 0;
      let askAdded = 0;
      let bidRemoved = 0;
      let askRemoved = 0;
      let bidInitial = 0;
      let askInitial = 0;
      let bidFinal = this.lastBid;
      let askFinal = this.lastAsk;
      let first = true;
      for (const tick of this.ticks.toArray()) {
        if (tick.timestamp < start || tick.timestamp > now) continue;
        if (first) {
          bidInitial = tick.bid - tick.bidAdded + tick.bidRemoved;
          askInitial = tick.ask - tick.askAdded + tick.askRemoved;
          first = false;
        }
        bidAdded += tick.bidAdded;
        askAdded += tick.askAdded;
        bidRemoved += tick.bidRemoved;
        askRemoved += tick.askRemoved;
        bidFinal = tick.bid;
        askFinal = tick.ask;
      }
      return {
        bidLiquidityAdded: bidAdded,
        askLiquidityAdded: askAdded,
        bidLiquidityRemoved: bidRemoved,
        askLiquidityRemoved: askRemoved,
        bidLiquidityInitial: Math.max(0, bidInitial),
        askLiquidityInitial: Math.max(0, askInitial),
        bidLiquidityFinal: bidFinal,
        askLiquidityFinal: askFinal
      };
    }
    reset() {
      this.ticks.clear();
      this.lastBid = 0;
      this.lastAsk = 0;
      this.primed = false;
    }
  };

  // src/models/passive.ts
  function emptyPassiveMetrics() {
    return {
      passiveBuyExecutedVolume: 0,
      passiveSellExecutedVolume: 0,
      bidLiquidityAdded: 0,
      askLiquidityAdded: 0,
      bidLiquidityRemoved: 0,
      askLiquidityRemoved: 0,
      bidLiquidityConsumed: 0,
      askLiquidityConsumed: 0,
      bidLiquidityReplenished: 0,
      askLiquidityReplenished: 0,
      bidDefenseStrength: 0,
      askDefenseStrength: 0,
      bidLiquidityInitial: 0,
      askLiquidityInitial: 0,
      bidLiquidityFinal: 0,
      askLiquidityFinal: 0
    };
  }
  function emptyFlowBattle() {
    return {
      metrics: emptyPassiveMetrics(),
      winner: { winner: "UNRESOLVED", score: 0, confidence: 0, evidence: [] },
      battle: {
        aggressiveBuyerStrength: 0,
        passiveSellerStrength: 0,
        aggressiveSellerStrength: 0,
        passiveBuyerStrength: 0,
        bullishControl: 0,
        bearishControl: 0,
        winner: "UNRESOLVED"
      },
      state: "BALANCED_AUCTION",
      bias: "NEUTRAL",
      failure: null,
      icebergLike: null,
      defenseZone: null,
      executionToVisibleAsk: 0,
      executionToVisibleBid: 0,
      askConsumptionToReplenishment: 0,
      bidConsumptionToReplenishment: 0,
      buyExecutionEfficiency: 0,
      sellExecutionEfficiency: 0,
      persistentPassive: null
    };
  }

  // src/flow-battle/flow-winner-engine.ts
  var FlowWinnerEngine = class {
    constructor(config, defense) {
      this.config = config;
      this.defense = defense;
    }
    analyze(input) {
      const m = input.metrics;
      const defIn = {
        price: input.price,
        aggressiveBuy: input.aggressiveBuy,
        aggressiveSell: input.aggressiveSell,
        askConsumed: m.askLiquidityConsumed,
        bidConsumed: m.bidLiquidityConsumed,
        askReplenished: m.askLiquidityReplenished,
        bidReplenished: m.bidLiquidityReplenished,
        askInitial: m.askLiquidityInitial,
        bidInitial: m.bidLiquidityInitial,
        askFinal: m.askLiquidityFinal,
        bidFinal: m.bidLiquidityFinal,
        priceChangePercent: input.priceChangePercent,
        impactLow: input.impact === "LOW"
      };
      m.askDefenseStrength = this.defense.askDefenseStrength(defIn);
      m.bidDefenseStrength = this.defense.bidDefenseStrength(defIn);
      const askCr = safeDiv(m.askLiquidityConsumed, Math.max(m.askLiquidityReplenished, 1e-9));
      const bidCr = safeDiv(m.bidLiquidityConsumed, Math.max(m.bidLiquidityReplenished, 1e-9));
      const execAsk = safeDiv(input.aggressiveBuy, Math.max(input.visibleAsk, 1e-9));
      const execBid = safeDiv(input.aggressiveSell, Math.max(input.visibleBid, 1e-9));
      const buyEff = buyEfficiency(input.aggressiveBuy, input.priceChangePercent, input.impact);
      const sellEff = sellEfficiency(input.aggressiveSell, input.priceChangePercent, input.impact);
      const aggressiveBuyer = aggressiveStrength({
        volume: input.aggressiveBuy,
        opposing: input.aggressiveSell,
        multiple: input.flowMultipleBuy,
        consumption: m.askLiquidityConsumed,
        replenishment: m.askLiquidityReplenished,
        efficiency: buyEff,
        burst: input.buyBurst,
        persistent: input.persistentBuy,
        minAttack: this.config.minAttackQuote
      });
      const aggressiveSeller = aggressiveStrength({
        volume: input.aggressiveSell,
        opposing: input.aggressiveBuy,
        multiple: input.flowMultipleSell,
        consumption: m.bidLiquidityConsumed,
        replenishment: m.bidLiquidityReplenished,
        efficiency: sellEff,
        burst: input.sellBurst,
        persistent: input.persistentSell,
        minAttack: this.config.minAttackQuote
      });
      const passiveSeller = passiveStrength({
        executedAgainst: m.passiveSellExecutedVolume,
        replenishment: m.askLiquidityReplenished,
        consumption: m.askLiquidityConsumed,
        defense: m.askDefenseStrength,
        rejected: input.priceChangePercent <= 0.08,
        iceberg: input.iceberg?.type === "ICEBERG_LIKE_SELL_ABSORPTION",
        minAttack: this.config.minAttackQuote
      });
      const passiveBuyer = passiveStrength({
        executedAgainst: m.passiveBuyExecutedVolume,
        replenishment: m.bidLiquidityReplenished,
        consumption: m.bidLiquidityConsumed,
        defense: m.bidDefenseStrength,
        rejected: input.priceChangePercent >= -0.08,
        iceberg: input.iceberg?.type === "ICEBERG_LIKE_BUY_ABSORPTION",
        minAttack: this.config.minAttackQuote
      });
      const { winner, score, evidence, state, bias } = decideWinner({
        aggressiveBuyer,
        passiveSeller,
        aggressiveSeller,
        passiveBuyer,
        input,
        askCr,
        bidCr,
        buyEff,
        sellEff,
        consumeOver: this.config.consumeOverReplenish,
        replenishOver: this.config.replenishOverConsume,
        minAttack: this.config.minAttackQuote
      });
      const failure = this.defense.failure(defIn);
      let defenseZone = null;
      if (winner.winner === "PASSIVE_SELLERS" && m.askDefenseStrength >= this.config.minDefenseScore) {
        defenseZone = this.defense.noteDefense(
          input.price,
          "SELL",
          input.aggressiveBuy,
          m.askLiquidityReplenished,
          input.priceChangePercent,
          m.askDefenseStrength
        );
      } else if (winner.winner === "PASSIVE_BUYERS" && m.bidDefenseStrength >= this.config.minDefenseScore) {
        defenseZone = this.defense.noteDefense(
          input.price,
          "BUY",
          input.aggressiveSell,
          m.bidLiquidityReplenished,
          input.priceChangePercent,
          m.bidDefenseStrength
        );
      }
      const icebergLike = toIcebergPassive(input.iceberg, execAsk, execBid);
      const persistentPassive = input.windowMs >= 6e4 && winner.winner === "PASSIVE_SELLERS" && (input.persistentBuy || input.buyBurst) ? "PERSISTENT_PASSIVE_SELLER_CONTROL" : input.windowMs >= 6e4 && winner.winner === "PASSIVE_BUYERS" && (input.persistentSell || input.sellBurst) ? "PERSISTENT_PASSIVE_BUYER_CONTROL" : null;
      const out = {
        ...emptyFlowBattle(),
        metrics: m,
        winner: { winner: winner.winner, score, confidence: winner.confidence, evidence },
        battle: {
          aggressiveBuyerStrength: aggressiveBuyer,
          passiveSellerStrength: passiveSeller,
          aggressiveSellerStrength: aggressiveSeller,
          passiveBuyerStrength: passiveBuyer,
          bullishControl: clamp(aggressiveBuyer - passiveSeller, -100, 100),
          bearishControl: clamp(aggressiveSeller - passiveBuyer, -100, 100),
          winner: winner.winner
        },
        state,
        bias,
        failure: failure && failure.confidence >= this.config.minFailureConfidence ? failure : null,
        icebergLike,
        defenseZone,
        executionToVisibleAsk: execAsk,
        executionToVisibleBid: execBid,
        askConsumptionToReplenishment: askCr,
        bidConsumptionToReplenishment: bidCr,
        buyExecutionEfficiency: buyEff,
        sellExecutionEfficiency: sellEff,
        persistentPassive
      };
      return out;
    }
  };
  function aggressiveStrength(p) {
    if (p.volume < p.minAttack * 0.2) return 0;
    const share = p.volume / Math.max(p.volume + p.opposing, 1);
    const consume = p.consumption / Math.max(p.consumption + p.replenishment, 1);
    let s = 18 * share + 22 * clamp((Number.isFinite(p.multiple) ? p.multiple : 1) / 6, 0, 1);
    s += 22 * consume + 28 * p.efficiency;
    if (p.burst) s += 5;
    if (p.persistent) s += 5;
    return clamp(s, 0, 100);
  }
  function passiveStrength(p) {
    if (p.executedAgainst < p.minAttack * 0.2 && p.defense < 20) return 0;
    const replenish = p.replenishment / Math.max(p.replenishment + p.consumption, 1);
    let s = 20 * clamp(p.executedAgainst / Math.max(p.minAttack * 8, 1), 0, 1);
    s += 30 * replenish + 0.35 * p.defense;
    if (p.rejected) s += 12;
    if (p.iceberg) s += 8;
    return clamp(s, 0, 100);
  }
  function buyEfficiency(buy, chg, impact) {
    if (buy <= 0) return 0;
    if (chg <= 0) return 0;
    const impactN = impact === "EXTREME" ? 1 : impact === "HIGH" ? 0.75 : impact === "NORMAL" ? 0.45 : 0.15;
    return clamp(0.5 * impactN + 0.5 * clamp(chg / 0.4, 0, 1), 0, 1);
  }
  function sellEfficiency(sell, chg, impact) {
    if (sell <= 0) return 0;
    if (chg >= 0) return 0;
    const impactN = impact === "EXTREME" ? 1 : impact === "HIGH" ? 0.75 : impact === "NORMAL" ? 0.45 : 0.15;
    return clamp(0.5 * impactN + 0.5 * clamp(-chg / 0.4, 0, 1), 0, 1);
  }
  function decideWinner(p) {
    const i = p.input;
    const upGap = p.aggressiveBuyer - p.passiveSeller;
    const downGap = p.aggressiveSeller - p.passiveBuyer;
    const buyAttack = i.aggressiveBuy >= p.minAttack;
    const sellAttack = i.aggressiveSell >= p.minAttack;
    const askEaten = i.metrics.askLiquidityRemoved > i.metrics.askLiquidityAdded * 1.15 || p.askCr >= p.consumeOver;
    const bidEaten = i.metrics.bidLiquidityRemoved > i.metrics.bidLiquidityAdded * 1.15 || p.bidCr >= p.consumeOver;
    const asksBreaking = askEaten && p.buyEff >= 0.3 && i.priceChangePercent > 0.05;
    const bidsBreaking = bidEaten && p.sellEff >= 0.3 && i.priceChangePercent < -0.05;
    const asksDefending = p.askCr > 0 && p.askCr <= 1 / p.replenishOver && i.priceChangePercent <= 0.08;
    const bidsDefending = p.bidCr > 0 && p.bidCr <= 1 / p.replenishOver && i.priceChangePercent >= -0.08;
    const evidence = [];
    if (!buyAttack && !sellAttack) {
      return {
        winner: { winner: "BALANCED", confidence: 0.7 },
        score: 0,
        evidence: ["Aggressive buying and selling are both moderate"],
        state: "BALANCED_AUCTION",
        bias: "NEUTRAL"
      };
    }
    if (i.absorption.detected && i.absorption.type === "BUYER_ABSORPTION") {
      evidence.push("Large positive delta", "Minimal upside price response");
      if (asksDefending || i.absorption.absorbingSide === "PASSIVE_SELLER") {
        evidence.push("Ask liquidity persisted or replenished");
      }
      return pack("PASSIVE_SELLERS", Math.max(p.passiveSeller, 70), evidence, "BUYERS_ABSORBED", "POTENTIALLY_BEARISH", 0.78);
    }
    if (i.absorption.detected && i.absorption.type === "SELLER_ABSORPTION") {
      evidence.push("Large negative delta", "Minimal downside price response");
      if (bidsDefending) evidence.push("Bid liquidity persisted or replenished");
      return pack("PASSIVE_BUYERS", Math.max(p.passiveBuyer, 70), evidence, "SELLERS_ABSORBED", "POTENTIALLY_BULLISH", 0.78);
    }
    if (buyAttack && asksBreaking && upGap > 0) {
      evidence.push("Aggressive buys consumed asks", "Price rising with the buy flow");
      return pack("AGGRESSIVE_BUYERS", p.aggressiveBuyer, evidence, "BUYERS_BREAKING_ASKS", "BULLISH_CONTINUATION", 0.8);
    }
    if (sellAttack && bidsBreaking && downGap > 0) {
      evidence.push("Aggressive sells consumed bids", "Price falling with the sell flow");
      return pack("AGGRESSIVE_SELLERS", p.aggressiveSeller, evidence, "SELLERS_BREAKING_BIDS", "BEARISH_CONTINUATION", 0.8);
    }
    if (buyAttack && i.priceChangePercent > 0.12 && p.buyEff >= 0.3 && p.aggressiveBuyer >= p.passiveSeller) {
      evidence.push("Price rising with aggressive buy flow");
      return pack("AGGRESSIVE_BUYERS", p.aggressiveBuyer, evidence, "BUYERS_BREAKING_ASKS", "BULLISH_CONTINUATION", 0.74);
    }
    if (sellAttack && i.priceChangePercent < -0.12 && p.sellEff >= 0.3 && p.aggressiveSeller >= p.passiveBuyer) {
      evidence.push("Price falling with aggressive sell flow");
      return pack("AGGRESSIVE_SELLERS", p.aggressiveSeller, evidence, "SELLERS_BREAKING_BIDS", "BEARISH_CONTINUATION", 0.74);
    }
    if (buyAttack && (asksDefending || p.passiveSeller > p.aggressiveBuyer + 5) && i.priceChangePercent <= 0.12) {
      evidence.push("Aggressive buying failed to lift price", "Passive sellers defending the ask");
      const absorbed = i.priceChangePercent <= 0.04 && p.passiveSeller >= 55;
      return pack(
        "PASSIVE_SELLERS",
        p.passiveSeller,
        evidence,
        absorbed ? "BUYERS_ABSORBED" : "PASSIVE_SELLERS_DEFENDING",
        "POTENTIALLY_BEARISH",
        0.72
      );
    }
    if (sellAttack && (bidsDefending || p.passiveBuyer > p.aggressiveSeller + 5) && i.priceChangePercent >= -0.12) {
      evidence.push("Aggressive selling failed to push price down", "Passive buyers defending the bid");
      const absorbed = i.priceChangePercent >= -0.04 && p.passiveBuyer >= 55;
      return pack(
        "PASSIVE_BUYERS",
        p.passiveBuyer,
        evidence,
        absorbed ? "SELLERS_ABSORBED" : "PASSIVE_BUYERS_DEFENDING",
        "POTENTIALLY_BULLISH",
        0.72
      );
    }
    if (buyAttack && upGap > 12 && downGap < 8) {
      evidence.push("Buyers attacking asks");
      return pack("UNRESOLVED", Math.abs(upGap), evidence, "BUYERS_ATTACKING", "NEUTRAL", 0.55);
    }
    if (sellAttack && downGap > 12 && upGap < 8) {
      evidence.push("Sellers attacking bids");
      return pack("UNRESOLVED", Math.abs(downGap), evidence, "SELLERS_ATTACKING", "NEUTRAL", 0.55);
    }
    if (Math.abs(upGap) < 10 && Math.abs(downGap) < 10) {
      return {
        winner: { winner: "BALANCED", confidence: 0.65 },
        score: 0,
        evidence: ["Neither side is controlling price"],
        state: "BALANCED_AUCTION",
        bias: "NEUTRAL"
      };
    }
    return {
      winner: { winner: "UNRESOLVED", confidence: 0.5 },
      score: Math.max(Math.abs(upGap), Math.abs(downGap)),
      evidence: ["Flow and price response disagree"],
      state: "BALANCED_AUCTION",
      bias: "NEUTRAL"
    };
  }
  function pack(winner, score, evidence, state, bias, confidence) {
    return {
      winner: { winner, confidence },
      score: clamp(score, 0, 100),
      evidence,
      state,
      bias
    };
  }
  function toIcebergPassive(flag, execAsk, execBid) {
    if (!flag) return null;
    if (flag.type === "ICEBERG_LIKE_SELL_ABSORPTION") {
      return {
        type: "ICEBERG_LIKE_PASSIVE_SELLING",
        visibleLiquidity: flag.visibleQuote,
        executedAgainstLevel: flag.aggressiveQuote,
        replenishmentRatio: execAsk,
        confidence: clamp(0.5 + Math.min(flag.aggressiveQuote / Math.max(flag.visibleQuote, 1) / 20, 0.35), 0, 1)
      };
    }
    return {
      type: "ICEBERG_LIKE_PASSIVE_BUYING",
      visibleLiquidity: flag.visibleQuote,
      executedAgainstLevel: flag.aggressiveQuote,
      replenishmentRatio: execBid,
      confidence: clamp(0.5 + Math.min(flag.aggressiveQuote / Math.max(flag.visibleQuote, 1) / 20, 0.35), 0, 1)
    };
  }

  // src/models/market-battle.ts
  function emptyAggressiveSide() {
    return {
      volume: 0,
      percentile: 0,
      velocityPerSec: 0,
      tradeCount: 0,
      averageTradeSize: 0,
      largeVolume: 0,
      imbalanceCount: 0,
      imbalanceStrength: 0,
      deltaContribution: 0,
      cvdContribution: 0,
      consecutiveImbalances: 0,
      power: 0,
      contributions: [],
      topLevels: [],
      hasData: false,
      lowConfidence: false,
      score: 0
    };
  }

  // src/market-battle/engine.ts
  var MarketBattleEngine = class {
    analyze(input) {
      const lr = input.liquidityResponse;
      const fb = input.flowBattle;
      const pl = input.passiveLiquidity;
      const af = input.aggressiveFlow;
      const tradeMissing = Boolean(input.tradeDataMissing) || !af;
      const tradeLowConf = Boolean(input.tradeDataLowConfidence);
      const bookReliable = pl ? (pl.dataQuality?.trustworthy ?? false) && (pl.dataQuality?.score ?? 0) >= 35 : lr.dataQuality >= 40 && lr.confidence !== "LOW";
      const upsideAgg = mapAggressiveSide(
        af?.buy ?? null,
        tradeMissing,
        tradeLowConf || Boolean(af?.buy?.lowConfidence)
      );
      const downsideAgg = mapAggressiveSide(
        af?.sell ?? null,
        tradeMissing,
        tradeLowConf || Boolean(af?.sell?.lowConfidence)
      );
      const upsidePas = buildPassive({
        currentDepth: pl?.context.askDepth ?? lr.askDepth.current,
        nearDepth: pl?.context.nearAskDepth ?? lr.askDepth.current,
        consumption: lr.askConsumption,
        replenishment: lr.askReplenishment,
        withdrawal: lr.askWithdrawal,
        survival: pl?.context.askPersistence ?? clamp(100 - intensityToScore(lr.askWithdrawal), 0, 100),
        strength: pl?.passiveSellerStrength ?? fb.battle.passiveSellerStrength,
        reliable: bookReliable,
        baseScore: fb.battle.passiveSellerStrength,
        depthPercentile: lr.askDepth.currentPercentile
      });
      const downsidePas = buildPassive({
        currentDepth: pl?.context.bidDepth ?? lr.bidDepth.current,
        nearDepth: pl?.context.nearBidDepth ?? lr.bidDepth.current,
        consumption: lr.bidConsumption,
        replenishment: lr.bidReplenishment,
        withdrawal: lr.bidWithdrawal,
        survival: pl?.context.bidPersistence ?? clamp(100 - intensityToScore(lr.bidWithdrawal), 0, 100),
        strength: pl?.passiveBuyerStrength ?? fb.battle.passiveBuyerStrength,
        reliable: bookReliable,
        baseScore: fb.battle.passiveBuyerStrength,
        depthPercentile: lr.bidDepth.currentPercentile
      });
      const upsidePrice = buildPriceResponse({
        displacementPercent: Math.max(0, input.priceChangePercent),
        impact: input.priceImpactEfficiency,
        lrEfficiency: lr.efficiency,
        executionEfficiency: fb.buyExecutionEfficiency,
        directional: input.priceChangePercent > 0.02,
        absorption: lr.absorption.kind === "BUY_ABSORPTION" || input.priceChangePercent <= 0.04
      });
      const downsidePrice = buildPriceResponse({
        displacementPercent: Math.max(0, -input.priceChangePercent),
        impact: input.priceImpactEfficiency,
        lrEfficiency: lr.efficiency,
        executionEfficiency: fb.sellExecutionEfficiency,
        directional: input.priceChangePercent < -0.02,
        absorption: lr.absorption.kind === "SELL_ABSORPTION" || input.priceChangePercent >= -0.04
      });
      const upside = classifyUpside({
        aggressive: upsideAgg,
        passive: upsidePas,
        price: upsidePrice,
        lr,
        vacuum: lr.vacuum === "UPSIDE_LIQUIDITY_VACUUM" || (pl?.upsideVacuum.detected ?? false),
        absorption: lr.absorption.kind === "BUY_ABSORPTION" || pl?.sellerAbsorption.type === "SELLER_ABSORPTION",
        tradeMissing,
        tradeLowConf,
        bookReliable
      });
      const downside = classifyDownside({
        aggressive: downsideAgg,
        passive: downsidePas,
        price: downsidePrice,
        lr,
        vacuum: lr.vacuum === "DOWNSIDE_LIQUIDITY_VACUUM" || (pl?.downsideVacuum.detected ?? false),
        absorption: lr.absorption.kind === "SELL_ABSORPTION" || pl?.buyerAbsorption.type === "BUYER_ABSORPTION",
        tradeMissing,
        tradeLowConf,
        bookReliable
      });
      const summary = summarizeBattles(upside, downside);
      return {
        window: input.window,
        upside,
        downside,
        upsideBattleScore: upside.battleScore,
        downsideBattleScore: downside.battleScore,
        summary,
        dataHealth: buildDataHealth(input, tradeMissing, tradeLowConf, bookReliable)
      };
    }
  };
  function buildDataHealth(input, tradeMissing, tradeLowConf, bookReliable) {
    const tradeAgeMs = Number.isFinite(input.tradeAgeMs ?? NaN) ? input.tradeAgeMs : 0;
    const staleAfterMs = input.staleAfterMs ?? 0;
    const medianTradeGapMs = input.medianTradeGapMs ?? 0;
    const base = { tradeAgeMs, staleAfterMs, medianTradeGapMs, bookReliable };
    if (tradeMissing) {
      return {
        ...base,
        status: "NO_TRADES",
        detail: "No trades are reaching the engine \u2014 the trade feed is down or not subscribed."
      };
    }
    if (tradeLowConf) {
      const age = Math.round(tradeAgeMs / 1e3);
      const limit = Math.round(staleAfterMs / 1e3);
      return {
        ...base,
        status: "STALE_TRADES",
        detail: `Last trade ${age}s ago, over this symbol's ${limit}s staleness limit \u2014 quiet market or a lagging feed.`
      };
    }
    if (!bookReliable) {
      return {
        ...base,
        status: "BOOK_UNRELIABLE",
        detail: "Trades are live but the order book is incomplete, so defense scores are unreliable."
      };
    }
    return { ...base, status: "OK", detail: "" };
  }
  function mapAggressiveSide(side2, tradeMissing, tradeLowConf) {
    if (tradeMissing || !side2 || !side2.hasData) {
      return emptyAggressiveSide();
    }
    return {
      volume: side2.executedVolume,
      percentile: side2.activityPercentile,
      velocityPerSec: side2.velocityPerSec,
      tradeCount: side2.tradeCount,
      averageTradeSize: side2.averageTradeSize,
      largeVolume: side2.largeVolume,
      imbalanceCount: side2.imbalanceCount,
      imbalanceStrength: side2.imbalanceStrength,
      deltaContribution: side2.deltaContribution,
      cvdContribution: side2.cvdContribution,
      consecutiveImbalances: side2.consecutiveImbalances,
      power: side2.power,
      contributions: side2.contributions,
      topLevels: side2.topLevels,
      hasData: true,
      lowConfidence: tradeLowConf || side2.lowConfidence,
      score: side2.power
    };
  }
  function buildPassive(p) {
    const replenishN = intensityToScore(p.replenishment);
    const withdrawN = intensityToScore(p.withdrawal);
    const depthN = clamp(p.depthPercentile, 0, 100);
    const survivalN = clamp(p.survival, 0, 100);
    const composed = 0.4 * p.baseScore + 0.2 * clamp(p.strength, 0, 100) + 0.15 * replenishN + 0.15 * survivalN + 0.1 * depthN - 0.08 * withdrawN;
    const defensePower = clamp(composed, 0, 100);
    return {
      currentDepth: p.currentDepth,
      nearDepth: p.nearDepth,
      consumption: p.consumption,
      replenishment: p.replenishment,
      withdrawal: p.withdrawal,
      survival: survivalN,
      survivalLabel: survivalN >= 65 ? "STRONG" : survivalN >= 35 ? "MODERATE" : "WEAK",
      strength: clamp(p.strength, 0, 100),
      defensePower,
      reliable: p.reliable,
      score: defensePower
    };
  }
  function buildPriceResponse(p) {
    if (!p.directional || p.absorption) {
      const lowEff = p.impact === "LOW" || p.lrEfficiency === "LOW" ? "LOW" : p.lrEfficiency === "NORMAL" ? "LOW" : "NORMAL";
      return {
        displacementPercent: p.displacementPercent,
        efficiency: lowEff,
        efficiencyScore: clamp(p.executionEfficiency * 100 * 0.35, 0, 40)
      };
    }
    const impactN = intensityToScore(p.impact);
    const lrN = intensityToScore(p.lrEfficiency);
    const score = clamp(0.45 * impactN + 0.35 * lrN + 0.2 * p.executionEfficiency * 100, 0, 100);
    const efficiency2 = score >= 80 ? "EXTREME" : score >= 60 ? "HIGH" : score >= 35 ? "NORMAL" : "LOW";
    return {
      displacementPercent: p.displacementPercent,
      efficiency: efficiency2,
      efficiencyScore: score
    };
  }
  function classifyUpside(p) {
    const aggI = aggressionIntensity(p.aggressive);
    const consI = toBattleIntensity(p.passive.consumption);
    const replI = toBattleIntensity(p.passive.replenishment);
    const withI = toBattleIntensity(p.passive.withdrawal);
    const effI = toBattleIntensity(p.price.efficiency);
    const survivalLow = p.passive.survival < 35;
    const battleScore = battleIntensityScore(p.aggressive.power, p.passive.defensePower, aggI);
    if (p.tradeMissing) {
      return packUpside(p, battleScore, "NO_MEANINGFUL_BATTLE", ["FOOTPRINT DATA UNAVAILABLE"]);
    }
    if ((p.tradeLowConf || p.aggressive.lowConfidence) && aggI === "NONE") {
      return packUpside(p, battleScore * 0.5, "LOW_CONFIDENCE", [
        "Footprint / trade data delayed or incomplete \u2014 attack side low confidence"
      ]);
    }
    if (!p.bookReliable && aggI !== "NONE") {
      return packUpside(p, battleScore * 0.5, "LOW_CONFIDENCE", [
        "Book data unreliable \u2014 passive side marked low confidence"
      ]);
    }
    if (aggI === "NONE") {
      return packUpside(p, Math.min(battleScore, 25), "NO_MEANINGFUL_BATTLE", [
        "Aggressive buy flow is not meaningful in this window"
      ]);
    }
    if ((aggI === "HIGH" || aggI === "MODERATE") && (consI === "HIGH" || consI === "MODERATE") && (replI === "HIGH" || p.passive.survival >= 55) && (effI === "LOW" || p.absorption)) {
      return packUpside(p, battleScore, "SELLER_ABSORPTION", [
        "High aggressive buy power with ask replenishment holding",
        "Upward price efficiency remains low"
      ]);
    }
    if (aggI === "HIGH" && (consI === "HIGH" || consI === "MODERATE") && (replI === "LOW" || p.passive.defensePower + 8 < p.aggressive.power) && (effI === "HIGH" || p.price.efficiencyScore >= 55)) {
      return packUpside(p, battleScore, "BUYERS_WINNING", [
        "Footprint aggression consuming ask liquidity",
        "Ask replenishment weak relative to consumption",
        "Upward price displacement is efficient"
      ]);
    }
    if ((aggI === "MODERATE" || aggI === "HIGH") && (withI === "HIGH" || p.vacuum || survivalLow) && (effI === "HIGH" || p.price.displacementPercent > 0.08)) {
      return packUpside(p, battleScore, "UPSIDE_VACUUM", [
        "Ask liquidity withdrawing / thin survival",
        "Price displacing upward through thin asks"
      ]);
    }
    if ((aggI === "HIGH" || aggI === "MODERATE") && (effI === "LOW" || p.price.displacementPercent < 0.06) && (replI === "HIGH" || p.passive.survival >= 50 || p.passive.defensePower >= p.aggressive.power)) {
      return packUpside(p, battleScore, "SELLERS_DEFENDING", [
        "Passive sellers defending the ask",
        "Footprint buy attack is not producing upside"
      ]);
    }
    if (p.aggressive.power >= p.passive.defensePower + 12 && p.price.efficiencyScore >= 45 && p.price.displacementPercent > 0.05) {
      return packUpside(p, battleScore, "BUYERS_WINNING", [
        "Aggressive buy power outscoring passive seller defense",
        "Price responding to the upside attack"
      ]);
    }
    if (Math.abs(p.aggressive.power - p.passive.defensePower) < 10) {
      return packUpside(p, battleScore, "BALANCED", ["Upside attack and ask defense are evenly matched"]);
    }
    if (p.passive.defensePower > p.aggressive.power) {
      return packUpside(p, battleScore, "SELLERS_DEFENDING", ["Passive seller defense exceeds footprint buy pressure"]);
    }
    return packUpside(p, battleScore, "BALANCED", ["No clear upside winner from liquidity and price response"]);
  }
  function classifyDownside(p) {
    const aggI = aggressionIntensity(p.aggressive);
    const consI = toBattleIntensity(p.passive.consumption);
    const replI = toBattleIntensity(p.passive.replenishment);
    const withI = toBattleIntensity(p.passive.withdrawal);
    const effI = toBattleIntensity(p.price.efficiency);
    const survivalLow = p.passive.survival < 35;
    const battleScore = battleIntensityScore(p.aggressive.power, p.passive.defensePower, aggI);
    if (p.tradeMissing) {
      return packDownside(p, battleScore, "NO_MEANINGFUL_BATTLE", ["FOOTPRINT DATA UNAVAILABLE"]);
    }
    if ((p.tradeLowConf || p.aggressive.lowConfidence) && aggI === "NONE") {
      return packDownside(p, battleScore * 0.5, "LOW_CONFIDENCE", [
        "Footprint / trade data delayed or incomplete \u2014 attack side low confidence"
      ]);
    }
    if (!p.bookReliable && aggI !== "NONE") {
      return packDownside(p, battleScore * 0.5, "LOW_CONFIDENCE", [
        "Book data unreliable \u2014 passive side marked low confidence"
      ]);
    }
    if (aggI === "NONE") {
      return packDownside(p, Math.min(battleScore, 25), "NO_MEANINGFUL_BATTLE", [
        "Aggressive sell flow is not meaningful in this window"
      ]);
    }
    if ((aggI === "HIGH" || aggI === "MODERATE") && (consI === "HIGH" || consI === "MODERATE") && (replI === "HIGH" || p.passive.survival >= 55) && (effI === "LOW" || p.absorption)) {
      return packDownside(p, battleScore, "BUYER_ABSORPTION", [
        "High aggressive sell power with bid replenishment holding",
        "Downward price efficiency remains low"
      ]);
    }
    if (aggI === "HIGH" && (consI === "HIGH" || consI === "MODERATE") && (replI === "LOW" || p.passive.defensePower + 8 < p.aggressive.power) && (effI === "HIGH" || p.price.efficiencyScore >= 55)) {
      return packDownside(p, battleScore, "SELLERS_WINNING", [
        "Footprint aggression consuming bid liquidity",
        "Bid replenishment weak relative to consumption",
        "Downward price displacement is efficient"
      ]);
    }
    if ((aggI === "MODERATE" || aggI === "HIGH") && (withI === "HIGH" || p.vacuum || survivalLow) && (effI === "HIGH" || p.price.displacementPercent > 0.08)) {
      return packDownside(p, battleScore, "DOWNSIDE_VACUUM", [
        "Bid liquidity withdrawing / thin survival",
        "Price displacing downward through thin bids"
      ]);
    }
    if ((aggI === "HIGH" || aggI === "MODERATE") && (effI === "LOW" || p.price.displacementPercent < 0.06) && (replI === "HIGH" || p.passive.survival >= 50 || p.passive.defensePower >= p.aggressive.power)) {
      return packDownside(p, battleScore, "BUYERS_DEFENDING", [
        "Passive buyers defending the bid",
        "Footprint sell attack is not producing downside"
      ]);
    }
    if (p.aggressive.power >= p.passive.defensePower + 12 && p.price.efficiencyScore >= 45 && p.price.displacementPercent > 0.05) {
      return packDownside(p, battleScore, "SELLERS_WINNING", [
        "Aggressive sell power outscoring passive buyer defense",
        "Price responding to the downside attack"
      ]);
    }
    if (Math.abs(p.aggressive.power - p.passive.defensePower) < 10) {
      return packDownside(p, battleScore, "BALANCED", ["Downside attack and bid defense are evenly matched"]);
    }
    if (p.passive.defensePower > p.aggressive.power) {
      return packDownside(p, battleScore, "BUYERS_DEFENDING", ["Passive buyer defense exceeds footprint sell pressure"]);
    }
    return packDownside(p, battleScore, "BALANCED", ["No clear downside winner from liquidity and price response"]);
  }
  function summarizeBattles(upside, downside) {
    const u = upside.state;
    const d = downside.state;
    const buyersAttacking = u === "BUYERS_WINNING" || u === "UPSIDE_VACUUM";
    const sellersAttacking = d === "SELLERS_WINNING" || d === "DOWNSIDE_VACUUM";
    const sellersDefending = u === "SELLERS_DEFENDING" || u === "SELLER_ABSORPTION";
    const buyersDefending = d === "BUYERS_DEFENDING" || d === "BUYER_ABSORPTION";
    if (buyersAttacking && buyersDefending) {
      return {
        state: "BUYERS_IN_CONTROL",
        why: "Aggressive buyers are successfully consuming ask liquidity while passive buyers are simultaneously preventing aggressive sellers from producing meaningful downside displacement."
      };
    }
    if (sellersAttacking && sellersDefending) {
      return {
        state: "SELLERS_IN_CONTROL",
        why: "Aggressive sellers are successfully consuming bid liquidity while passive sellers are simultaneously preventing aggressive buyers from producing meaningful upside displacement."
      };
    }
    if (sellersDefending && buyersDefending) {
      return {
        state: "TWO_SIDED_DEFENSE",
        why: "Passive liquidity is holding on both sides \u2014 aggressive flow is not producing lasting price displacement."
      };
    }
    if (buyersAttacking && sellersAttacking) {
      return {
        state: "TWO_SIDED_AGGRESSION",
        why: "Both aggressive buyers and aggressive sellers are moving price through liquidity \u2014 two-sided aggression."
      };
    }
    if (buyersAttacking && !sellersAttacking) {
      return {
        state: "BUYERS_IN_CONTROL",
        why: "Upside attack is winning while the downside is not producing a meaningful seller breakthrough."
      };
    }
    if (sellersAttacking && !buyersAttacking) {
      return {
        state: "SELLERS_IN_CONTROL",
        why: "Downside attack is winning while the upside is not producing a meaningful buyer breakthrough."
      };
    }
    if (buyersDefending && !sellersDefending) {
      return {
        state: "PASSIVE_BUYERS_DEFENDING",
        why: "Passive buyers are absorbing or rejecting aggressive sell pressure without a clear upside breakout."
      };
    }
    if (sellersDefending && !buyersDefending) {
      return {
        state: "PASSIVE_SELLERS_DEFENDING",
        why: "Passive sellers are absorbing or rejecting aggressive buy pressure without a clear downside breakout."
      };
    }
    if ((u === "BALANCED" || u === "NO_MEANINGFUL_BATTLE" || u === "LOW_CONFIDENCE") && (d === "BALANCED" || d === "NO_MEANINGFUL_BATTLE" || d === "LOW_CONFIDENCE")) {
      if (u === "BALANCED" && d === "BALANCED") {
        return {
          state: "COMPRESSION",
          why: "Both battles are balanced \u2014 aggression and defense are compressing without a clear controller."
        };
      }
      return {
        state: "NO_CLEAR_WINNER",
        why: "Neither battle has a clear winner from liquidity response and price response."
      };
    }
    return {
      state: "NO_CLEAR_WINNER",
      why: "Battle states disagree \u2014 no single side controls both attack and defense."
    };
  }
  function packUpside(p, battleScore, state, why) {
    return {
      aggressive: p.aggressive,
      passive: p.passive,
      price: p.price,
      battleScore: clamp(battleScore, 0, 100),
      state,
      why
    };
  }
  function packDownside(p, battleScore, state, why) {
    return {
      aggressive: p.aggressive,
      passive: p.passive,
      price: p.price,
      battleScore: clamp(battleScore, 0, 100),
      state,
      why
    };
  }
  function aggressionIntensity(agg) {
    if (!agg.hasData) return "NONE";
    if (agg.percentile >= 70 || agg.power >= 65) return "HIGH";
    if (agg.percentile >= 40 || agg.power >= 35) return "MODERATE";
    if (agg.volume > 0 && (agg.percentile >= 20 || agg.power >= 15)) return "LOW";
    return "NONE";
  }
  function toBattleIntensity(label) {
    if (label === "EXTREME" || label === "HIGH") return "HIGH";
    if (label === "LOW") return "LOW";
    return "MODERATE";
  }
  function intensityToScore(label) {
    if (label === "EXTREME") return 95;
    if (label === "HIGH") return 78;
    if (label === "NORMAL") return 50;
    return 22;
  }
  function battleIntensityScore(agg, pas, aggI) {
    if (aggI === "NONE") return clamp(Math.max(agg, pas) * 0.25, 0, 100);
    return clamp(0.55 * Math.max(agg, pas) + 0.45 * ((agg + pas) / 2), 0, 100);
  }

  // src/market-fuel/engine.ts
  var CONTRIB = {
    velocity: "Execution Velocity",
    intensity: "Trade Count Intensity",
    large: "Large Trade Activity"
  };
  var MarketFuelEngine = class {
    constructor(config) {
      this.config = config;
    }
    history = /* @__PURE__ */ new Map();
    committed = /* @__PURE__ */ new Map();
    pending = /* @__PURE__ */ new Map();
    snapshot(input) {
      if (input.tradeDataMissing || !input.aggressiveFlow) {
        return this.blank(input, "NO_DATA", "NO_DATA", 0);
      }
      const buy = input.aggressiveFlow.buy;
      const sell = input.aggressiveFlow.sell;
      const prev = this.history.get(input.window) ?? null;
      const buyAccel = accelerationScore(buy.power, prev ? this.priorPower(input.window, "buy") : null);
      const sellAccel = accelerationScore(sell.power, prev ? this.priorPower(input.window, "sell") : null);
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
        part(stopBuy, w.inferredStop)
      ];
      const downParts = [
        part(sell.hasData ? sell.power : null, w.aggressivePower),
        part(contribution(sell, CONTRIB.velocity), w.velocity),
        part(contribution(sell, CONTRIB.intensity), w.tradeIntensity),
        part(contribution(sell, CONTRIB.large), w.largeStrength),
        part(sellAccel, w.acceleration),
        part(liqSell, w.liquidation),
        part(stopSell, w.inferredStop)
      ];
      const organicUp = blend(upParts.slice(0, 5));
      const organicDown = blend(downParts.slice(0, 5));
      const forcedUp = blend(upParts.slice(5));
      const forcedDown = blend(downParts.slice(5));
      const organicW = w.aggressivePower + w.velocity + w.tradeIntensity + w.largeStrength + w.acceleration;
      const forcedW = w.liquidation + w.inferredStop;
      const upside = combine(organicUp, forcedUp, organicW, forcedW);
      const downside = combine(organicDown, forcedDown, organicW, forcedW);
      const velocity = this.velocities(input.window, input.now, upside, downside);
      const proposed = classifyState(upside, downside, organicUp, forcedUp, organicDown, forcedDown);
      const state = this.commitState(input.window, proposed, input.now);
      const partial = buyAccel == null || sellAccel == null || input.liquidationFeed === "unavailable" || !buy.hasData || !sell.hasData;
      const dataStatus = input.tradeStale ? "STALE_DATA" : partial ? "PARTIAL_DATA" : "OK";
      let confidence = clamp(input.sampleConfidence, 0, 1) * 100;
      if (input.tradeStale) confidence = Math.min(confidence, 45);
      if (dataStatus === "PARTIAL_DATA") confidence = Math.min(confidence, 75);
      if (input.buyBurst || input.sellBurst) confidence = Math.min(confidence, 80);
      const snap = {
        symbol: input.symbol,
        window: input.window,
        timestamp: input.now,
        upsideFuel: upside,
        downsideFuel: downside,
        fuelImbalance: upside == null || downside == null ? null : clamp(upside - downside, -100, 100),
        normalizedFuelImbalance: upside == null || downside == null ? null : (upside - downside) / Math.max(upside + downside, 1),
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
          stopSell
        })
      };
      this.rememberPower(input.window, buy.power, sell.power);
      return snap;
    }
    /** Last aggressive power seen for this window, used only for the acceleration term. */
    power = /* @__PURE__ */ new Map();
    priorPower(window, side2) {
      const row = this.power.get(window);
      if (!row) return null;
      return side2 === "buy" ? row.buy : row.sell;
    }
    rememberPower(window, buy, sell) {
      this.power.set(window, { buy, sell });
    }
    velocities(window, now, up, down) {
      const prev = this.history.get(window);
      if (up == null || down == null) {
        return { upVel: null, downVel: null, upAcc: null, downAcc: null };
      }
      if (!prev) {
        this.history.set(window, { at: now, up, down, upVel: null, downVel: null });
        return { upVel: null, downVel: null, upAcc: null, downAcc: null };
      }
      const dt = Math.max(now - prev.at, 1) / 1e3;
      const upVel = clamp((up - prev.up) / dt, -100, 100);
      const downVel = clamp((down - prev.down) / dt, -100, 100);
      const upAcc = prev.upVel == null ? null : clamp(upVel - prev.upVel, -100, 100);
      const downAcc = prev.downVel == null ? null : clamp(downVel - prev.downVel, -100, 100);
      this.history.set(window, { at: now, up, down, upVel, downVel });
      return { upVel, downVel, upAcc, downAcc };
    }
    commitState(window, proposed, now) {
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
    blank(input, state, dataStatus, confidence) {
      const missing = () => ({ value: null });
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
          inferredStopSellFlow: missing()
        }
      };
    }
  };
  function part(value, weight) {
    if (value == null || !Number.isFinite(value)) return { value: null, weight };
    return { value: clamp(value, 0, 100), weight };
  }
  function combine(organic, forced, organicW, forcedW) {
    const useForced = forced != null && forced > 0 && forcedW > 0;
    if (organic == null && !useForced) return null;
    if (!useForced) return organic;
    if (organic == null) return forced;
    const weight = organicW + forcedW;
    if (!(weight > 0)) return organic;
    return clamp((organic * organicW + forced * forcedW) / weight, 0, 100);
  }
  function blend(parts) {
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
  function contribution(side2, label) {
    if (!side2.hasData) return null;
    const row = side2.contributions.find((c) => c.label === label);
    return row ? row.normalized : null;
  }
  function accelerationScore(current, prior) {
    if (prior == null) return null;
    const rising = (current - prior) * 2.5;
    if (!(rising > 0)) return null;
    return clamp(rising, 0, 100);
  }
  function liquidationStrength(forced, executed, feed) {
    if (feed === "unavailable") return null;
    if (feed === "not_expected") return null;
    const base = Math.max(executed, forced, 0);
    if (!(base > 0)) return 0;
    return clamp(Math.max(forced, 0) / base * 100, 0, 100);
  }
  function classifyState(up, down, organicUp, forcedUp, organicDown, forcedDown) {
    if (up == null || down == null) return "NO_DATA";
    const gap = up - down;
    const forcedBuy = (forcedUp ?? 0) >= 45 && (forcedUp ?? 0) > (organicUp ?? 0) && gap >= 10;
    const forcedSell = (forcedDown ?? 0) >= 45 && (forcedDown ?? 0) > (organicDown ?? 0) && -gap >= 10;
    if (forcedBuy) return "FORCED_BUY_FUEL";
    if (forcedSell) return "FORCED_SELL_FUEL";
    if (up >= 70 && down >= 70 && Math.abs(gap) < 15) return "TWO_SIDED_HIGH_FUEL";
    if (up >= 75 && gap >= 20) return "STRONG_UPSIDE_FUEL";
    if (down >= 75 && -gap >= 20) return "STRONG_DOWNSIDE_FUEL";
    if (up >= 45 && gap >= 12) return "UPSIDE_FUEL_BUILDING";
    if (down >= 45 && -gap >= 12) return "DOWNSIDE_FUEL_BUILDING";
    if (up < 35 && down < 35) return "LOW_FUEL";
    return "BALANCED_FUEL";
  }
  function componentsOf(p) {
    const n = (value, inferred = false) => value == null ? { value: null } : { value: clamp(value, 0, 100), ...inferred ? { inferred: true } : {} };
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
      inferredStopSellFlow: p.stopSell == null ? { value: null, inferred: true } : n(p.stopSell, true)
    };
  }

  // src/models/trade-decision.ts
  var TRADE_DECISION_STRATEGY_VERSION = "SIMPLE_ATTACK_DEFENSE_V1";

  // src/trade-decision/engine.ts
  var DEFAULT_TRADE_DECISION_CONFIG = DEFAULT_CONFIG.tradeDecision;
  function evaluateTradeDecision(snap, config = DEFAULT_TRADE_DECISION_CONFIG, context = {}) {
    const metrics = projectMetrics(snap, context);
    const now = context.now ?? Date.now();
    if (metrics.dataQuality === "NO_DATA" || metrics.dataQuality === "STALE" || metrics.dataQuality === "LOW_CONFIDENCE") {
      return decision({
        action: "WAIT",
        phase: "NO_TRADE",
        confidence: 20,
        entryQuality: "LOW",
        reasons: [],
        blockers: ["insufficient_data"],
        invalidationReasons: [],
        metrics,
        snap,
        now
      });
    }
    const long = scoreLong(metrics, config, context);
    const short = scoreShort(metrics, config, context);
    if (long.ok && short.ok) {
      return decision({
        action: "WAIT",
        phase: "NO_TRADE",
        confidence: 30,
        entryQuality: "LOW",
        reasons: [...long.reasons, ...short.reasons],
        blockers: ["conflicting_long_short_conditions"],
        invalidationReasons: [],
        metrics,
        snap,
        now
      });
    }
    if (long.ok) {
      return decision({
        action: "LONG",
        phase: "LONG_CONFIRMATION",
        confidence: long.confidence,
        entryQuality: qualityOf(long.confidence),
        reasons: long.reasons,
        blockers: [],
        invalidationReasons: [
          "buyer_control_lost",
          "seller_defense_rebuilds",
          "buyer_absorption_appears",
          "price_loses_upside_acceptance"
        ],
        metrics,
        snap,
        now
      });
    }
    if (short.ok) {
      return decision({
        action: "SHORT",
        phase: "SHORT_CONFIRMATION",
        confidence: short.confidence,
        entryQuality: qualityOf(short.confidence),
        reasons: short.reasons,
        blockers: [],
        invalidationReasons: [
          "seller_control_lost",
          "buyer_defense_rebuilds",
          "seller_absorption_appears",
          "price_loses_downside_acceptance"
        ],
        metrics,
        snap,
        now
      });
    }
    const closer = long.progress >= short.progress ? long : short;
    const phase = closer.progress >= 0.5 ? closer === long ? "LONG_SETUP_FORMING" : "SHORT_SETUP_FORMING" : "NO_TRADE";
    return decision({
      action: "WAIT",
      phase,
      confidence: clamp(closer.confidence * 0.55, 15, 55),
      entryQuality: "LOW",
      reasons: closer.reasons,
      blockers: closer.blockers,
      invalidationReasons: [],
      metrics,
      snap,
      now
    });
  }
  function scoreLong(m, cfg, ctx) {
    const reasons = [];
    const blockers = [];
    let gates = 0;
    const total = 7;
    const buyer = m.buyerControl;
    const upside = m.upsideFuel;
    const downside = m.downsideFuel;
    const fuelEdge = m.fuelEdge;
    const sellerDef = m.passiveSellerDefense;
    const askCons = m.askConsumption;
    const askPull = m.askPulling;
    const askRepl = m.askReplenishment;
    if (buyer != null && buyer >= cfg.buyerControlMin) {
      gates += 1;
      reasons.push("buyers_in_control");
    } else {
      blockers.push("weak_buyer_control");
    }
    if (upside != null && upside >= cfg.fuelMin) {
      gates += 1;
      reasons.push("upside_fuel_dominant");
    } else {
      blockers.push("weak_upside_fuel");
    }
    if (fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin) {
      gates += 1;
      reasons.push("fuel_directional_edge");
    } else {
      blockers.push("fuel_balanced");
    }
    if (sellerDef != null && sellerDef <= cfg.opposingDefenseMax) {
      gates += 1;
      reasons.push("seller_defense_weak");
    } else {
      blockers.push("seller_defense_strong");
    }
    const liqWeak = askCons != null && askCons >= cfg.liquidityWeakeningMin || askPull != null && askPull >= cfg.liquidityWeakeningMin;
    if (liqWeak) {
      gates += 1;
      if (askPull != null && askPull >= cfg.liquidityWeakeningMin) reasons.push("asks_pulled");
      if (askCons != null && askCons >= cfg.liquidityWeakeningMin) reasons.push("asks_consumed");
    } else {
      blockers.push("no_ask_side_weakening");
    }
    if (askRepl != null && askRepl < cfg.opposingReplenishmentMax) {
      gates += 1;
      reasons.push("ask_replenishment_low");
    } else if (askRepl == null) {
      blockers.push("ask_replenishment_unknown");
    } else {
      blockers.push("ask_replenishment_high");
    }
    if (m.buyerAbsorbed) {
      blockers.push("BUYER_ABSORBED");
    } else {
      gates += 1;
      reasons.push("no_buyer_absorption");
    }
    if (!m.priceFollowedUp) {
      blockers.push("no_price_follow_through");
    } else {
      reasons.push("price_following_up");
    }
    if (m.askSurvival != null && m.askSurvival < cfg.opposingSurvivalMax) {
      reasons.push("ask_survival_low");
    }
    const ok = gates >= total && !m.buyerAbsorbed && m.priceFollowedUp && askRepl != null && askRepl < cfg.opposingReplenishmentMax && liqWeak && sellerDef != null && sellerDef <= cfg.opposingDefenseMax && buyer != null && buyer >= cfg.buyerControlMin && upside != null && upside >= cfg.fuelMin && fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin;
    const confidence = computeConfidence({
      ok,
      gates,
      total,
      control: buyer,
      fuel: upside,
      fuelEdge,
      opposingDefense: sellerDef,
      liqWeakScore: Math.max(askCons ?? 0, askPull ?? 0),
      priceOk: m.priceFollowedUp,
      absorbed: m.buyerAbsorbed,
      dataQuality: m.dataQuality,
      velocity: m.upsideFuelVelocity,
      controlTrend: trendScore(ctx.buyerControlHistory),
      patternBoost: patternBoost(ctx.pattern, "BULLISH", cfg),
      cfg
    });
    return { ok, progress: gates / total, confidence, reasons: unique(reasons), blockers: unique(blockers) };
  }
  function scoreShort(m, cfg, ctx) {
    const reasons = [];
    const blockers = [];
    let gates = 0;
    const total = 7;
    const seller = m.sellerControl;
    const downside = m.downsideFuel;
    const upside = m.upsideFuel;
    const fuelEdge = downside != null && upside != null ? downside - upside : m.fuelEdge != null ? -m.fuelEdge : null;
    const buyerDef = m.passiveBuyerDefense;
    const bidCons = m.bidConsumption;
    const bidPull = m.bidPulling;
    const bidRepl = m.bidReplenishment;
    if (seller != null && seller >= cfg.sellerControlMin) {
      gates += 1;
      reasons.push("sellers_in_control");
    } else {
      blockers.push("weak_seller_control");
    }
    if (downside != null && downside >= cfg.fuelMin) {
      gates += 1;
      reasons.push("downside_fuel_dominant");
    } else {
      blockers.push("weak_downside_fuel");
    }
    if (fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin) {
      gates += 1;
      reasons.push("fuel_directional_edge");
    } else {
      blockers.push("fuel_balanced");
    }
    if (buyerDef != null && buyerDef <= cfg.opposingDefenseMax) {
      gates += 1;
      reasons.push("buyer_defense_weak");
    } else {
      blockers.push("buyer_defense_strong");
    }
    const liqWeak = bidCons != null && bidCons >= cfg.liquidityWeakeningMin || bidPull != null && bidPull >= cfg.liquidityWeakeningMin;
    if (liqWeak) {
      gates += 1;
      if (bidPull != null && bidPull >= cfg.liquidityWeakeningMin) reasons.push("bids_pulled");
      if (bidCons != null && bidCons >= cfg.liquidityWeakeningMin) reasons.push("bids_consumed");
    } else {
      blockers.push("no_bid_side_weakening");
    }
    if (bidRepl != null && bidRepl < cfg.opposingReplenishmentMax) {
      gates += 1;
      reasons.push("bid_replenishment_low");
    } else if (bidRepl == null) {
      blockers.push("bid_replenishment_unknown");
    } else {
      blockers.push("bid_replenishment_high");
    }
    if (m.sellerAbsorbed) {
      blockers.push("SELLER_ABSORBED");
    } else {
      gates += 1;
      reasons.push("no_seller_absorption");
    }
    if (!m.priceFollowedDown) {
      blockers.push("no_price_follow_through");
    } else {
      reasons.push("price_following_down");
    }
    if (m.bidSurvival != null && m.bidSurvival < cfg.opposingSurvivalMax) {
      reasons.push("bid_survival_low");
    }
    const ok = gates >= total && !m.sellerAbsorbed && m.priceFollowedDown && bidRepl != null && bidRepl < cfg.opposingReplenishmentMax && liqWeak && buyerDef != null && buyerDef <= cfg.opposingDefenseMax && seller != null && seller >= cfg.sellerControlMin && downside != null && downside >= cfg.fuelMin && fuelEdge != null && fuelEdge >= cfg.fuelEdgeMin;
    const confidence = computeConfidence({
      ok,
      gates,
      total,
      control: seller,
      fuel: downside,
      fuelEdge,
      opposingDefense: buyerDef,
      liqWeakScore: Math.max(bidCons ?? 0, bidPull ?? 0),
      priceOk: m.priceFollowedDown,
      absorbed: m.sellerAbsorbed,
      dataQuality: m.dataQuality,
      velocity: m.downsideFuelVelocity,
      controlTrend: trendScore(ctx.sellerControlHistory),
      patternBoost: patternBoost(ctx.pattern, "BEARISH", cfg),
      cfg
    });
    return { ok, progress: gates / total, confidence, reasons: unique(reasons), blockers: unique(blockers) };
  }
  function computeConfidence(input) {
    const baseAlignment = input.gates / input.total * 40;
    const controlPart = (input.control ?? 0) / 100 * 15;
    const fuelPart = (input.fuel ?? 0) / 100 * 12;
    const edgePart = clamp((input.fuelEdge ?? 0) / 40, 0, 1) * 10;
    const defensePart = input.opposingDefense != null ? clamp((100 - input.opposingDefense) / 100, 0, 1) * 8 : 0;
    const liqPart = clamp(input.liqWeakScore / 100, 0, 1) * 8;
    const pricePart = input.priceOk ? 7 : 0;
    const velocityPart = input.velocity == null ? 0 : input.velocity > 0 ? Math.min(5, input.velocity * input.cfg.fuelVelocityWeight) : Math.max(-6, input.velocity * input.cfg.fuelVelocityWeight);
    const trendPart = input.controlTrend * 4;
    const patternPart = input.ok ? input.patternBoost : 0;
    let contradiction = 0;
    if (input.absorbed) contradiction += 25;
    if (!input.priceOk) contradiction += 10;
    if (input.dataQuality === "PARTIAL") contradiction += 8;
    const raw = baseAlignment + controlPart + fuelPart + edgePart + defensePart + liqPart + pricePart + velocityPart + trendPart + patternPart - contradiction;
    return Math.round(clamp(raw, 0, 100));
  }
  function projectMetrics(snap, ctx) {
    const battle = snap.marketBattle;
    const fuel = snap.marketFuel;
    const lr = snap.liquidityResponse;
    const buyerControl = battle?.upside.aggressive.power ?? null;
    const sellerControl = battle?.downside.aggressive.power ?? null;
    const upsideFuel = fuel?.upsideFuel ?? null;
    const downsideFuel = fuel?.downsideFuel ?? null;
    const fuelEdge = upsideFuel != null && downsideFuel != null ? upsideFuel - downsideFuel : null;
    const askConsumption = intensityToScore2(lr?.askConsumption);
    const bidConsumption = intensityToScore2(lr?.bidConsumption);
    const askPulling = intensityToScore2(lr?.askWithdrawal);
    const bidPulling = intensityToScore2(lr?.bidWithdrawal);
    const askReplenishment = intensityToScore2(lr?.askReplenishment);
    const bidReplenishment = intensityToScore2(lr?.bidReplenishment);
    const buyerAbsorbed = snap.absorption?.detected === true && snap.absorption.type === "BUYER_ABSORPTION" ? true : lr?.absorption?.kind === "BUY_ABSORPTION" ? true : battle?.downside.state === "BUYER_ABSORPTION" ? true : lr?.effort === "BUY_ABSORPTION";
    const sellerAbsorbed = snap.absorption?.detected === true && snap.absorption.type === "SELLER_ABSORPTION" ? true : lr?.absorption?.kind === "SELL_ABSORPTION" ? true : battle?.upside.state === "SELLER_ABSORPTION" ? true : lr?.effort === "SELL_ABSORPTION";
    const priceFollowedUp = derivePriceFollowUp(snap);
    const priceFollowedDown = derivePriceFollowDown(snap);
    return {
      buyerControl,
      sellerControl,
      upsideFuel,
      downsideFuel,
      fuelEdge,
      passiveSellerDefense: battle?.upside.passive.defensePower ?? null,
      passiveBuyerDefense: battle?.downside.passive.defensePower ?? null,
      askConsumption,
      bidConsumption,
      askPulling,
      bidPulling,
      askReplenishment,
      bidReplenishment,
      askSurvival: battle?.upside.passive.survival ?? null,
      bidSurvival: battle?.downside.passive.survival ?? null,
      upsideFuelVelocity: fuel?.upsideFuelVelocity ?? null,
      downsideFuelVelocity: fuel?.downsideFuelVelocity ?? null,
      buyerAbsorbed,
      sellerAbsorbed,
      priceFollowedUp,
      priceFollowedDown,
      dataQuality: resolveDataQuality(snap),
      patternId: ctx.pattern?.id ?? null,
      patternStatus: ctx.pattern?.status ?? null
    };
  }
  function derivePriceFollowUp(snap) {
    if (snap.priceChangePercent > 0.02 && (snap.priceImpactEfficiency === "HIGH" || snap.priceImpactEfficiency === "EXTREME" || snap.priceImpactEfficiency === "NORMAL")) {
      return true;
    }
    if (snap.liquidityResponse?.effort === "EFFICIENT_BUYING") return true;
    const score = snap.marketBattle?.upside.price.efficiencyScore ?? 0;
    if (snap.priceChangePercent > 0 && score >= 55) return true;
    if (snap.delta > 0 && snap.priceChangePercent > 0.05) return true;
    return false;
  }
  function derivePriceFollowDown(snap) {
    if (snap.priceChangePercent < -0.02 && (snap.priceImpactEfficiency === "HIGH" || snap.priceImpactEfficiency === "EXTREME" || snap.priceImpactEfficiency === "NORMAL")) {
      return true;
    }
    if (snap.liquidityResponse?.effort === "EFFICIENT_SELLING") return true;
    const score = snap.marketBattle?.downside.price.efficiencyScore ?? 0;
    if (snap.priceChangePercent < 0 && score >= 55) return true;
    if (snap.delta < 0 && snap.priceChangePercent < -0.05) return true;
    return false;
  }
  function resolveDataQuality(snap) {
    const battleStatus = snap.marketBattle?.dataHealth?.status;
    const fuelStatus = snap.marketFuel?.dataStatus;
    if (fuelStatus === "NO_DATA" || battleStatus === "NO_TRADES") return "NO_DATA";
    if (fuelStatus === "STALE_DATA" || battleStatus === "STALE_TRADES") return "STALE";
    if (fuelStatus === "PARTIAL_DATA" || battleStatus === "BOOK_UNRELIABLE") return "PARTIAL";
    if (snap.liquidityResponse && (snap.liquidityResponse.confidence === "LOW" || typeof snap.liquidityResponse.dataQuality === "number" && snap.liquidityResponse.dataQuality < 35)) {
      return "LOW_CONFIDENCE";
    }
    if (!snap.marketBattle || !snap.marketFuel || !snap.liquidityResponse) return "PARTIAL";
    return "OK";
  }
  function intensityToScore2(label) {
    if (!label) return null;
    if (label === "EXTREME") return 90;
    if (label === "HIGH") return 75;
    if (label === "NORMAL") return 45;
    if (label === "LOW") return 25;
    return null;
  }
  function patternBoost(pattern, want, cfg) {
    if (!pattern) return 0;
    if (pattern.status !== "CONFIRMED" && pattern.status !== "FORMING") return 0;
    if (pattern.direction !== want) return 0;
    const mult = pattern.status === "CONFIRMED" ? 1 : 0.5;
    return cfg.patternSupportBonus * mult;
  }
  function trendScore(history) {
    if (!history || history.length < 2) return 0;
    const recent = history.slice(-4);
    let up = 0;
    for (let i = 1; i < recent.length; i++) {
      const d = (recent[i] ?? 0) - (recent[i - 1] ?? 0);
      if (d > 1) up += 1;
      else if (d < -1) up -= 1;
    }
    return clamp(up / Math.max(1, recent.length - 1), -1, 1);
  }
  function qualityOf(confidence) {
    if (confidence >= 75) return "HIGH";
    if (confidence >= 55) return "MODERATE";
    return "LOW";
  }
  function decision(input) {
    const metrics = {
      ...input.metrics
    };
    return {
      strategyVersion: TRADE_DECISION_STRATEGY_VERSION,
      action: input.action,
      phase: input.phase,
      confidence: input.confidence,
      entryQuality: input.entryQuality,
      reasons: input.reasons,
      blockers: input.blockers,
      invalidationReasons: input.invalidationReasons,
      metrics,
      timestamp: input.now,
      symbol: input.snap.symbol,
      window: input.snap.window
    };
  }
  function unique(xs) {
    return [...new Set(xs)];
  }
  function emptyTradeDecisionWait(symbol, window, now = Date.now()) {
    return {
      strategyVersion: TRADE_DECISION_STRATEGY_VERSION,
      action: "WAIT",
      phase: "NO_TRADE",
      confidence: 0,
      entryQuality: "LOW",
      reasons: [],
      blockers: ["insufficient_data"],
      invalidationReasons: [],
      metrics: {
        buyerControl: null,
        sellerControl: null,
        upsideFuel: null,
        downsideFuel: null,
        fuelEdge: null,
        passiveSellerDefense: null,
        passiveBuyerDefense: null,
        askConsumption: null,
        bidConsumption: null,
        askPulling: null,
        bidPulling: null,
        askReplenishment: null,
        bidReplenishment: null,
        askSurvival: null,
        bidSurvival: null,
        upsideFuelVelocity: null,
        downsideFuelVelocity: null,
        buyerAbsorbed: false,
        sellerAbsorbed: false,
        priceFollowedUp: false,
        priceFollowedDown: false,
        dataQuality: "NO_DATA",
        patternId: null,
        patternStatus: null
      },
      timestamp: now,
      symbol,
      window
    };
  }

  // src/models/aggressive-flow.ts
  function emptyAggressiveSideFlow() {
    return {
      executedVolume: 0,
      tradeCount: 0,
      velocityPerSec: 0,
      averageTradeSize: 0,
      largeVolume: 0,
      imbalanceCount: 0,
      stackedImbalanceCount: 0,
      imbalanceNotional: 0,
      imbalanceStrength: 0,
      deltaContribution: 0,
      cvdContribution: 0,
      consecutiveImbalances: 0,
      activityPercentile: 0,
      power: 0,
      contributions: [],
      topLevels: [],
      hasData: false,
      lowConfidence: false
    };
  }
  function emptyAggressiveFlow(window = "10s", windowMs = 1e4) {
    const buy = emptyAggressiveSideFlow();
    const sell = emptyAggressiveSideFlow();
    return {
      window,
      windowMs,
      buy,
      sell,
      aggressiveBuyPower: 0,
      aggressiveSellPower: 0,
      source: "FOOTPRINT_EXECUTED"
    };
  }

  // src/aggressive-flow/engine.ts
  var AggressiveFlowEngine = class {
    constructor(config, capacity = 6e4, baselineSamples = 1024) {
      this.config = config;
      this.capacity = capacity;
      this.events = new Array(capacity);
      this.buyPowerBaseline = new RollingDistribution(baselineSamples);
      this.sellPowerBaseline = new RollingDistribution(baselineSamples);
      this.buyVolumeBaseline = new RollingDistribution(baselineSamples);
      this.sellVolumeBaseline = new RollingDistribution(baselineSamples);
    }
    events;
    write = 0;
    filled = 0;
    oldest = 0;
    lastTradeAt = 0;
    buyPowerBaseline;
    sellPowerBaseline;
    buyVolumeBaseline;
    sellVolumeBaseline;
    lastBaselineSecond = -1;
    onTrade(timestamp, side2, quoteValue, price, isLarge) {
      if (!(quoteValue > 0) || !(price > 0)) return;
      const tick = priceToTick(price);
      const slot = this.write;
      this.events[slot] = { timestamp, price: tick, side: side2, quote: quoteValue, large: isLarge };
      this.write = (this.write + 1) % this.capacity;
      if (this.filled < this.capacity) this.filled += 1;
      else this.oldest = (this.oldest + 1) % this.capacity;
      this.lastTradeAt = timestamp;
      this.maybeBaseline(timestamp);
    }
    snapshot(window, now, opts) {
      const windowMs = WINDOW_MS[window];
      const tradeMissing = Boolean(opts?.tradeDataMissing) || this.filled === 0 || this.lastTradeAt === 0;
      if (tradeMissing) {
        const empty = emptyAggressiveFlow(window, windowMs);
        empty.buy.lowConfidence = true;
        empty.sell.lowConfidence = true;
        return empty;
      }
      const from = now - windowMs;
      const levels2 = /* @__PURE__ */ new Map();
      let buyVol = 0;
      let sellVol = 0;
      let buyCount = 0;
      let sellCount = 0;
      let largeBuy = 0;
      let largeSell = 0;
      for (let i = 0; i < this.filled; i++) {
        const idx = (this.oldest + i) % this.capacity;
        const e = this.events[idx];
        if (!e || e.timestamp < from || e.timestamp > now) continue;
        let lv = levels2.get(e.price);
        if (!lv) {
          lv = { buy: 0, sell: 0 };
          levels2.set(e.price, lv);
        }
        if (e.side === "BUY") {
          lv.buy += e.quote;
          buyVol += e.quote;
          buyCount += 1;
          if (e.large) largeBuy += e.quote;
        } else {
          lv.sell += e.quote;
          sellVol += e.quote;
          sellCount += 1;
          if (e.large) largeSell += e.quote;
        }
      }
      const seconds = Math.max(windowMs / 1e3, 1e-6);
      const imbalance = detectImbalances(levels2, this.config.imbalanceRatio, this.config.minImbalanceQuote);
      const delta = buyVol - sellVol;
      const lowConfidence = Boolean(opts?.tradeStale);
      const buy = scoreSide({
        executedVolume: buyVol,
        tradeCount: buyCount,
        velocityPerSec: buyVol / seconds,
        largeVolume: largeBuy,
        imbalanceCount: imbalance.buyCount,
        stackedImbalanceCount: imbalance.buyStacked,
        imbalanceNotional: imbalance.buyNotional,
        imbalanceStrength: imbalance.buyStrength,
        deltaContribution: Math.max(0, delta),
        cvdContribution: Math.max(0, delta),
        consecutiveImbalances: imbalance.buyConsecutive,
        activityPercentile: this.buyVolumeBaseline.percentileRank(buyVol / seconds),
        weights: this.config.aggressiveWeights,
        opposingVolume: sellVol,
        topLevels: imbalance.buyLevels,
        hasData: true,
        lowConfidence,
        powerBaseline: this.buyPowerBaseline
      });
      const sell = scoreSide({
        executedVolume: sellVol,
        tradeCount: sellCount,
        velocityPerSec: sellVol / seconds,
        largeVolume: largeSell,
        imbalanceCount: imbalance.sellCount,
        stackedImbalanceCount: imbalance.sellStacked,
        imbalanceNotional: imbalance.sellNotional,
        imbalanceStrength: imbalance.sellStrength,
        deltaContribution: Math.min(0, delta),
        cvdContribution: Math.min(0, delta),
        consecutiveImbalances: imbalance.sellConsecutive,
        activityPercentile: this.sellVolumeBaseline.percentileRank(sellVol / seconds),
        weights: this.config.aggressiveWeights,
        opposingVolume: buyVol,
        topLevels: imbalance.sellLevels,
        hasData: true,
        lowConfidence,
        powerBaseline: this.sellPowerBaseline
      });
      return {
        window,
        windowMs,
        buy,
        sell,
        aggressiveBuyPower: buy.power,
        aggressiveSellPower: sell.power,
        source: "FOOTPRINT_EXECUTED"
      };
    }
    maybeBaseline(timestamp) {
      const second = Math.floor(timestamp / 1e3);
      if (this.lastBaselineSecond < 0) {
        this.lastBaselineSecond = second;
        return;
      }
      if (second === this.lastBaselineSecond) return;
      const from = this.lastBaselineSecond * 1e3;
      const to = from + 1e3;
      let buy = 0;
      let sell = 0;
      for (let i = 0; i < this.filled; i++) {
        const idx = (this.oldest + i) % this.capacity;
        const e = this.events[idx];
        if (!e || e.timestamp < from || e.timestamp >= to) continue;
        if (e.side === "BUY") buy += e.quote;
        else sell += e.quote;
      }
      this.buyVolumeBaseline.add(buy);
      this.sellVolumeBaseline.add(sell);
      this.lastBaselineSecond = second;
    }
  };
  function scoreSide(p) {
    if (!p.hasData) return emptyAggressiveSideFlow();
    const w = normalizeWeights(p.weights);
    const volumeN = clamp(p.activityPercentile, 0, 100);
    const velocityN = clamp(Math.log10(1 + p.velocityPerSec / 25e3) * 45, 0, 100);
    const imbalanceN = clamp(
      0.55 * clamp(p.imbalanceStrength * 20, 0, 100) + 0.25 * clamp(p.imbalanceCount * 6, 0, 100) + 0.2 * clamp(p.consecutiveImbalances * 12, 0, 100),
      0,
      100
    );
    const largeN = clamp(safeDiv(p.largeVolume, Math.max(p.executedVolume, 1e-9)) * 100, 0, 100);
    const countN = clamp(Math.log10(1 + p.tradeCount) * 28, 0, 100);
    const deltaShare = clamp(
      safeDiv(Math.abs(p.deltaContribution), Math.max(p.executedVolume + p.opposingVolume, 1e-9)) * 100,
      0,
      100
    );
    const contributions = [
      { label: "Executed Volume", normalized: volumeN, weight: w.executedVolume, points: 0 },
      { label: "Execution Velocity", normalized: velocityN, weight: w.executionVelocity, points: 0 },
      { label: "Imbalance Strength", normalized: imbalanceN, weight: w.imbalanceStrength, points: 0 },
      { label: "Large Trade Activity", normalized: largeN, weight: w.largeTradeActivity, points: 0 },
      { label: "Trade Count Intensity", normalized: countN, weight: w.tradeCountIntensity, points: 0 },
      { label: "Delta / CVD", normalized: deltaShare, weight: w.deltaCvdContribution, points: 0 }
    ];
    for (const c of contributions) {
      c.points = c.normalized * c.weight;
    }
    const rawPower = contributions.reduce((s, c) => s + c.points, 0);
    const power = clamp(rawPower, 0, 100);
    p.powerBaseline.add(power);
    return {
      executedVolume: p.executedVolume,
      tradeCount: p.tradeCount,
      velocityPerSec: p.velocityPerSec,
      averageTradeSize: safeDiv(p.executedVolume, Math.max(p.tradeCount, 1)),
      largeVolume: p.largeVolume,
      imbalanceCount: p.imbalanceCount,
      stackedImbalanceCount: p.stackedImbalanceCount,
      imbalanceNotional: p.imbalanceNotional,
      imbalanceStrength: p.imbalanceStrength,
      deltaContribution: p.deltaContribution,
      cvdContribution: p.cvdContribution,
      consecutiveImbalances: p.consecutiveImbalances,
      activityPercentile: clamp(p.activityPercentile, 0, 100),
      power,
      contributions,
      topLevels: p.topLevels.slice(0, 12),
      hasData: true,
      lowConfidence: p.lowConfidence
    };
  }
  function normalizeWeights(w) {
    const sum = w.executedVolume + w.executionVelocity + w.imbalanceStrength + w.largeTradeActivity + w.tradeCountIntensity + w.deltaCvdContribution;
    if (!(sum > 0)) {
      return {
        executedVolume: 0.25,
        executionVelocity: 0.2,
        imbalanceStrength: 0.2,
        largeTradeActivity: 0.15,
        tradeCountIntensity: 0.1,
        deltaCvdContribution: 0.1
      };
    }
    return {
      executedVolume: w.executedVolume / sum,
      executionVelocity: w.executionVelocity / sum,
      imbalanceStrength: w.imbalanceStrength / sum,
      largeTradeActivity: w.largeTradeActivity / sum,
      tradeCountIntensity: w.tradeCountIntensity / sum,
      deltaCvdContribution: w.deltaCvdContribution / sum
    };
  }
  function detectImbalances(levels2, ratio, minQuote) {
    const prices = [...levels2.keys()].sort((a, b) => a - b);
    const buyLevels = [];
    const sellLevels = [];
    let buyCount = 0;
    let sellCount = 0;
    let buyNotional = 0;
    let sellNotional = 0;
    let buyStrengthSum = 0;
    let sellStrengthSum = 0;
    let buyRun = 0;
    let sellRun = 0;
    let buyConsecutive = 0;
    let sellConsecutive = 0;
    let buyStacked = 0;
    let sellStacked = 0;
    for (const price of prices) {
      const lv = levels2.get(price);
      const buy = lv.buy;
      const sell = lv.sell;
      const hi = Math.max(buy, sell);
      const lo = Math.min(buy, sell);
      let side2 = "BALANCED";
      let imbRatio = 0;
      if (hi >= minQuote) {
        if (lo <= 0) {
          side2 = buy > sell ? "BUY" : sell > buy ? "SELL" : "BALANCED";
          imbRatio = side2 === "BALANCED" ? 0 : 99;
        } else if (hi / lo >= ratio) {
          side2 = buy > sell ? "BUY" : "SELL";
          imbRatio = hi / lo;
        }
      }
      if (side2 === "BUY") {
        buyCount += 1;
        buyNotional += buy;
        buyStrengthSum += imbRatio;
        buyRun += 1;
        sellRun = 0;
        buyConsecutive = Math.max(buyConsecutive, buyRun);
        if (buyRun >= 2) buyStacked += 1;
        buyLevels.push({ price, buyExecuted: buy, sellExecuted: sell, imbalanceRatio: imbRatio, side: side2 });
      } else if (side2 === "SELL") {
        sellCount += 1;
        sellNotional += sell;
        sellStrengthSum += imbRatio;
        sellRun += 1;
        buyRun = 0;
        sellConsecutive = Math.max(sellConsecutive, sellRun);
        if (sellRun >= 2) sellStacked += 1;
        sellLevels.push({ price, buyExecuted: buy, sellExecuted: sell, imbalanceRatio: imbRatio, side: side2 });
      } else {
        buyRun = 0;
        sellRun = 0;
      }
    }
    buyLevels.sort((a, b) => b.buyExecuted - a.buyExecuted);
    sellLevels.sort((a, b) => b.sellExecuted - a.sellExecuted);
    return {
      buyCount,
      sellCount,
      buyStacked,
      sellStacked,
      buyNotional,
      sellNotional,
      buyStrength: buyCount ? buyStrengthSum / buyCount : 0,
      sellStrength: sellCount ? sellStrengthSum / sellCount : 0,
      buyConsecutive,
      sellConsecutive,
      buyLevels,
      sellLevels
    };
  }

  // src/models/liquidity-response.ts
  var LIQUIDITY_TF_MINUTES = [1, 5, 15, 30, 45, 60, 120, 240];

  // src/liquidity-response/book-accountant.ts
  var BookAccountant = class {
    constructor(config) {
      this.config = config;
      this.ticks = new RingBuffer(4096);
    }
    ticks;
    bandState = /* @__PURE__ */ new Map();
    marks = /* @__PURE__ */ new Map();
    primed = false;
    lastAsk = 0;
    lastBid = 0;
    lastSpread = 0;
    askReplenishEvents = 0;
    bidReplenishEvents = 0;
    lastAskConsumed = false;
    lastBidConsumed = false;
    windowAskReplenish = 0;
    windowBidReplenish = 0;
    unmatchedBuy = 0;
    unmatchedSell = 0;
    lastFlowAt = 0;
    flowMatchMs = 2e3;
    lastMid = 0;
    resetAt = 0;
    validSnapshots = 0;
    bandWalked = false;
    observe(timestamp, book, buyDelta, sellDelta, tradePrice, tradeSide) {
      if (book.empty()) return;
      const mid = book.mid();
      const bandPct = this.config.bandPct;
      const ask = book.notionalWithin("ask", mid, bandPct);
      const bid = book.notionalWithin("bid", mid, bandPct);
      const spreadBps = book.spreadBps();
      const midMoved = this.primed && this.lastMid > 0 && mid > 0 && Math.abs(mid - this.lastMid) / this.lastMid >= this.config.bandPct;
      this.bandWalked = midMoved;
      const buy = Math.max(0, buyDelta);
      const sell = Math.max(0, sellDelta);
      if (this.lastFlowAt > 0 && timestamp - this.lastFlowAt > this.flowMatchMs) {
        this.unmatchedBuy = 0;
        this.unmatchedSell = 0;
      }
      this.unmatchedBuy += buy;
      this.unmatchedSell += sell;
      if (buy > 0 || sell > 0) this.lastFlowAt = timestamp;
      const askAdded = this.primed ? Math.max(0, ask - this.lastAsk) : 0;
      const bidAdded = this.primed ? Math.max(0, bid - this.lastBid) : 0;
      const askDrop = this.primed ? Math.max(0, this.lastAsk - ask) : 0;
      const bidDrop = this.primed ? Math.max(0, this.lastBid - bid) : 0;
      const askConsumed = Math.min(askDrop, this.unmatchedBuy);
      const bidConsumed = Math.min(bidDrop, this.unmatchedSell);
      this.unmatchedBuy -= askConsumed;
      this.unmatchedSell -= bidConsumed;
      const askCancelled = Math.max(0, askDrop - askConsumed);
      const bidCancelled = Math.max(0, bidDrop - bidConsumed);
      if (this.lastAskConsumed && askAdded > 0) {
        this.askReplenishEvents += 1;
        this.windowAskReplenish += 1;
      }
      if (this.lastBidConsumed && bidAdded > 0) {
        this.bidReplenishEvents += 1;
        this.windowBidReplenish += 1;
      }
      this.lastAskConsumed = askConsumed > 0 || buy > 0;
      this.lastBidConsumed = bidConsumed > 0 || sell > 0;
      this.ticks.push({
        timestamp,
        mid,
        spreadBps: Number.isFinite(spreadBps) ? spreadBps : 0,
        bid,
        ask,
        bidAdded,
        askAdded,
        bidCancelled,
        askCancelled,
        bidConsumed,
        askConsumed
      });
      this.updateBands(book, mid, buy, sell);
      this.updateMarks(book, timestamp, buy, sell, tradePrice, tradeSide);
      this.lastAsk = ask;
      this.lastBid = bid;
      this.lastMid = mid;
      this.lastSpread = Number.isFinite(spreadBps) ? spreadBps : this.lastSpread;
      if (this.primed) this.validSnapshots += 1;
      this.primed = true;
    }
    noteReset(timestamp = Date.now()) {
      this.primed = false;
      this.resetAt = timestamp;
      this.validSnapshots = 0;
      this.bandWalked = false;
      this.unmatchedBuy = 0;
      this.unmatchedSell = 0;
      this.lastAsk = 0;
      this.lastBid = 0;
      this.lastMid = 0;
      this.lastSpread = 0;
      this.ticks.clear();
      this.bandState.clear();
      this.windowAskReplenish = 0;
      this.windowBidReplenish = 0;
      this.askReplenishEvents = 0;
      this.bidReplenishEvents = 0;
    }
    window(now, windowMs) {
      const start = now - windowMs;
      let bidAdded = 0;
      let askAdded = 0;
      let bidCancelled = 0;
      let askCancelled = 0;
      let bidConsumed = 0;
      let askConsumed = 0;
      let bidInitial = this.lastBid;
      let askInitial = this.lastAsk;
      let bidFinal = this.lastBid;
      let askFinal = this.lastAsk;
      let firstSpread = this.lastSpread;
      let lastSpread = this.lastSpread;
      let first = true;
      let askRepl = 0;
      let bidRepl = 0;
      let prevAskConsumed = false;
      let prevBidConsumed = false;
      for (const tick of this.ticks.toArray()) {
        if (tick.timestamp < start || tick.timestamp > now) continue;
        if (first) {
          bidInitial = Math.max(0, tick.bid - tick.bidAdded + tick.bidCancelled + tick.bidConsumed);
          askInitial = Math.max(0, tick.ask - tick.askAdded + tick.askCancelled + tick.askConsumed);
          firstSpread = tick.spreadBps;
          first = false;
        }
        bidAdded += tick.bidAdded;
        askAdded += tick.askAdded;
        bidCancelled += tick.bidCancelled;
        askCancelled += tick.askCancelled;
        bidConsumed += tick.bidConsumed;
        askConsumed += tick.askConsumed;
        bidFinal = tick.bid;
        askFinal = tick.ask;
        lastSpread = tick.spreadBps;
        if (prevAskConsumed && tick.askAdded > 0) askRepl += 1;
        if (prevBidConsumed && tick.bidAdded > 0) bidRepl += 1;
        prevAskConsumed = tick.askConsumed > 0;
        prevBidConsumed = tick.bidConsumed > 0;
      }
      return {
        bid: toSide(bidInitial, bidAdded, bidCancelled, bidConsumed, bidFinal, bidRepl),
        ask: toSide(askInitial, askAdded, askCancelled, askConsumed, askFinal, askRepl),
        spreadBps: lastSpread,
        spreadDeltaBps: lastSpread - firstSpread,
        askDepthChange: askFinal - askInitial,
        bidDepthChange: bidFinal - bidInitial,
        bandWalked: this.bandWalked,
        resetRecent: this.resetAt > 0 && now - this.resetAt < 8e3,
        primed: this.primed,
        hasValidPrevious: this.validSnapshots >= 1
      };
    }
    bandAccounting() {
      const out = [];
      for (const [bandPct, state] of this.bandState) {
        out.push({
          bandPct,
          side: "ask",
          initial: Math.max(0, state.ask + state.askCancelled + state.askConsumed - state.askAdded),
          added: state.askAdded,
          cancelled: state.askCancelled,
          consumed: state.askConsumed,
          remaining: state.ask,
          response: classifyResponse(state.askAdded, state.askCancelled, state.askConsumed)
        });
        out.push({
          bandPct,
          side: "bid",
          initial: Math.max(0, state.bid + state.bidCancelled + state.bidConsumed - state.bidAdded),
          added: state.bidAdded,
          cancelled: state.bidCancelled,
          consumed: state.bidConsumed,
          remaining: state.bid,
          response: classifyResponse(state.bidAdded, state.bidCancelled, state.bidConsumed)
        });
      }
      return out.sort((a, b) => a.bandPct - b.bandPct || (a.side === "ask" ? 0 : 1));
    }
    levels(now, absorption = null) {
      const ttl = this.config.markTtlMs;
      const out = [];
      for (const mark of this.marks.values()) {
        let event = now - mark.at > ttl ? "NONE" : mark.event;
        if (absorption === "ask" && mark.restingAsk > 0) event = "ABSORPTION_ASK";
        if (absorption === "bid" && mark.restingBid > 0) event = "ABSORPTION_BID";
        out.push({
          price: mark.price,
          restingBid: mark.restingBid,
          restingAsk: mark.restingAsk,
          event
        });
      }
      return out.sort((a, b) => b.price - a.price).slice(0, 48);
    }
    repeatedAskReplenishment(min = this.config.replenishRepeatMin) {
      return this.windowAskReplenish >= min || this.askReplenishEvents >= min;
    }
    repeatedBidReplenishment(min = this.config.replenishRepeatMin) {
      return this.windowBidReplenish >= min || this.bidReplenishEvents >= min;
    }
    get currentAsk() {
      return this.lastAsk;
    }
    get currentBid() {
      return this.lastBid;
    }
    updateBands(book, mid, buy, sell) {
      for (const bandPct of this.config.bands) {
        const ask = book.notionalWithin("ask", mid, bandPct);
        const bid = book.notionalWithin("bid", mid, bandPct);
        const prev = this.bandState.get(bandPct);
        if (!prev) {
          this.bandState.set(bandPct, {
            bid,
            ask,
            bidAdded: 0,
            askAdded: 0,
            bidCancelled: 0,
            askCancelled: 0,
            bidConsumed: 0,
            askConsumed: 0
          });
          continue;
        }
        const askDrop = Math.max(0, prev.ask - ask);
        const bidDrop = Math.max(0, prev.bid - bid);
        const askConsumed = Math.min(askDrop, buy);
        const bidConsumed = Math.min(bidDrop, sell);
        prev.askAdded += Math.max(0, ask - prev.ask);
        prev.bidAdded += Math.max(0, bid - prev.bid);
        prev.askConsumed += askConsumed;
        prev.bidConsumed += bidConsumed;
        prev.askCancelled += Math.max(0, askDrop - askConsumed);
        prev.bidCancelled += Math.max(0, bidDrop - bidConsumed);
        prev.ask = ask;
        prev.bid = bid;
      }
    }
    updateMarks(book, timestamp, buy, sell, tradePrice, tradeSide) {
      const tick = tickSize(book.mid() || tradePrice || 1);
      const seen = /* @__PURE__ */ new Set();
      for (const lvl of book.sortedLevels("ask").slice(0, 20)) {
        const price = priceToTick(lvl.price, tick);
        seen.add(price);
        const prev = this.marks.get(price) ?? emptyMark(price);
        const d = lvl.quoteValue - prev.restingAsk;
        let event = prev.event;
        if (d > 0) event = "REPLENISH_ASK";
        else if (d < 0) event = buy > 0 || tradeSide === "BUY" ? "CONSUME_ASK" : "WITHDRAW_ASK";
        this.marks.set(price, {
          price,
          restingBid: prev.restingBid,
          restingAsk: lvl.quoteValue,
          event,
          at: timestamp
        });
      }
      for (const lvl of book.sortedLevels("bid").slice(0, 20)) {
        const price = priceToTick(lvl.price, tick);
        seen.add(price);
        const prev = this.marks.get(price) ?? emptyMark(price);
        const d = lvl.quoteValue - prev.restingBid;
        let event = prev.event;
        if (d > 0) event = "REPLENISH_BID";
        else if (d < 0) event = sell > 0 || tradeSide === "SELL" ? "CONSUME_BID" : "WITHDRAW_BID";
        this.marks.set(price, {
          price,
          restingBid: lvl.quoteValue,
          restingAsk: prev.restingAsk,
          event,
          at: timestamp
        });
      }
      if (tradePrice && tradeSide) {
        const price = priceToTick(tradePrice, tick);
        const prev = this.marks.get(price) ?? emptyMark(price);
        prev.event = tradeSide === "BUY" ? "CONSUME_ASK" : "CONSUME_BID";
        prev.at = timestamp;
        this.marks.set(price, prev);
      }
      for (const [price, mark] of this.marks) {
        if (!seen.has(price) && timestamp - mark.at > this.config.markTtlMs) this.marks.delete(price);
      }
      if (this.marks.size > 80) {
        const ordered = [...this.marks.entries()].sort((a, b) => a[1].at - b[1].at);
        for (const [price] of ordered.slice(0, this.marks.size - 80)) this.marks.delete(price);
      }
    }
  };
  function emptyMark(price) {
    return { price, restingBid: 0, restingAsk: 0, event: "NONE", at: 0 };
  }
  function classifyResponse(added, cancelled, consumed) {
    const total = added + cancelled + consumed;
    if (total <= 0) return "QUIET";
    const a = safeDiv(added, total);
    const c = safeDiv(cancelled, total);
    const x = safeDiv(consumed, total);
    if (c >= 0.45 && c >= a && c >= x) return "WITHDRAWAL";
    if (a >= 0.45 && a >= x) return "REPLENISHMENT";
    if (x >= 0.45) return "CONSUMPTION";
    if (Math.abs(a - c) < 0.15 && x < 0.25) return "REPRICING";
    return "MIXED";
  }
  function toSide(initial, added, cancelled, consumed, remaining, replenishEvents) {
    return {
      initial: Math.max(0, initial),
      added,
      cancelled,
      consumed,
      remaining: Math.max(0, remaining),
      replenishEvents,
      response: classifyResponse(added, cancelled, consumed)
    };
  }

  // src/liquidity-response/classify.ts
  function efficiencyMetrics(input) {
    const total = input.buy + input.sell;
    const delta = input.buy - input.sell;
    const priceChange = input.priceEnd - input.priceStart;
    const priceChangePercent = pctChange(input.priceStart, input.priceEnd);
    const range = Math.max(0, input.priceHigh - input.priceLow);
    const atr = input.atr > 0 ? input.atr : range;
    const absMove = Math.abs(priceChange);
    return {
      aggressiveBuyVolume: input.buy,
      aggressiveSellVolume: input.sell,
      totalExecutedVolume: total,
      delta,
      priceChange,
      priceChangePercent,
      priceRange: range,
      atrNormalized: atr > 0 ? absMove / atr : 0,
      absoluteEfficiency: safeDiv(absMove, total),
      directionalEfficiency: safeDiv(priceChange, Math.abs(delta)),
      bpsPer100m: safeDiv(Math.abs(priceChangePercent) * 100, total / 1e8),
      classification: input.classification
    };
  }
  function intensityFromPercentile(p) {
    if (p >= 92) return "EXTREME";
    if (p >= 75) return "HIGH";
    if (p <= 25) return "LOW";
    return "NORMAL";
  }
  function aggressionSide(buyPct, sellPct, delta) {
    if (buyPct >= 60 && buyPct >= sellPct + 8) return "BUYERS";
    if (sellPct >= 60 && sellPct >= buyPct + 8) return "SELLERS";
    if (delta > 0 && buyPct >= 55) return "BUYERS";
    if (delta < 0 && sellPct >= 55) return "SELLERS";
    return "BALANCED";
  }
  function detectAbsorption(cfg, input) {
    const empty = {
      detected: false,
      kind: null,
      absorbingSide: null,
      strength: 0,
      usedBookEvidence: false,
      usedPriceEvidence: false
    };
    const largeBuy = input.buyPct >= cfg.largeAggressionPercentile;
    const largeSell = input.sellPct >= cfg.largeAggressionPercentile;
    const extremeBuy = input.buyPct >= cfg.extremeAggressionPercentile;
    const extremeSell = input.sellPct >= cfg.extremeAggressionPercentile;
    const weakMove = input.movePct <= cfg.weakDisplacementPercentile;
    const priceFailedUp = pctChange(input.priceStart, input.priceEnd) <= 0.04;
    const priceFailedDown = pctChange(input.priceStart, input.priceEnd) >= -0.04;
    const askDefense = input.book.ask.response === "REPLENISHMENT" || input.repeatedAsk || input.askReplPct >= 70 || input.nearAskShare >= cfg.nearTouchShare;
    const bidDefense = input.book.bid.response === "REPLENISHMENT" || input.repeatedBid || input.bidReplPct >= 70 || input.nearBidShare >= cfg.nearTouchShare;
    if (input.delta > 0 && largeBuy && priceFailedUp && weakMove && askDefense) {
      const usedBook = input.hasBook && (input.book.ask.response === "REPLENISHMENT" || input.repeatedAsk || input.askReplPct >= 60);
      if (!usedBook && input.nearAskShare < cfg.nearTouchShare) return empty;
      const strength = Math.min(
        1,
        0.45 + (extremeBuy ? 0.2 : 0.1) + (usedBook ? 0.2 : 0.05) + (input.nearAskShare >= cfg.nearTouchShare ? 0.1 : 0) + (input.repeatedAsk ? 0.1 : 0)
      );
      return {
        detected: strength >= 0.55,
        kind: strength >= 0.55 ? "SELL_ABSORPTION" : null,
        absorbingSide: strength >= 0.55 ? "PASSIVE_SELLER" : null,
        strength,
        usedBookEvidence: usedBook,
        usedPriceEvidence: true
      };
    }
    if (input.delta < 0 && largeSell && priceFailedDown && weakMove && bidDefense) {
      const usedBook = input.hasBook && (input.book.bid.response === "REPLENISHMENT" || input.repeatedBid || input.bidReplPct >= 60);
      if (!usedBook && input.nearBidShare < cfg.nearTouchShare) return empty;
      const strength = Math.min(
        1,
        0.45 + (extremeSell ? 0.2 : 0.1) + (usedBook ? 0.2 : 0.05) + (input.nearBidShare >= cfg.nearTouchShare ? 0.1 : 0) + (input.repeatedBid ? 0.1 : 0)
      );
      return {
        detected: strength >= 0.55,
        kind: strength >= 0.55 ? "BUY_ABSORPTION" : null,
        absorbingSide: strength >= 0.55 ? "PASSIVE_BUYER" : null,
        strength,
        usedBookEvidence: usedBook,
        usedPriceEvidence: true
      };
    }
    return empty;
  }
  function detectVacuum(cfg, input) {
    const buyAttack = input.buyPct >= 60 && input.delta > 0;
    const sellAttack = input.sellPct >= 60 && input.delta < 0;
    const askGone = (input.book.ask.response === "WITHDRAWAL" || input.askPullPct >= 70) && input.book.askDepthChange < 0 && input.book.ask.cancelled >= input.book.ask.consumed * cfg.vacuumPullShare;
    const bidGone = (input.book.bid.response === "WITHDRAWAL" || input.bidPullPct >= 70) && input.book.bidDepthChange < 0 && input.book.bid.cancelled >= input.book.bid.consumed * cfg.vacuumPullShare;
    const upMove = pctChange(input.priceStart, input.priceEnd) > 0.05 && input.movePct >= 55;
    const downMove = pctChange(input.priceStart, input.priceEnd) < -0.05 && input.movePct >= 55;
    const spreadOut = input.book.spreadDeltaBps >= cfg.vacuumSpreadExpandBps;
    if (buyAttack && askGone && (upMove || spreadOut)) return "UPSIDE_LIQUIDITY_VACUUM";
    if (sellAttack && bidGone && (downMove || spreadOut)) return "DOWNSIDE_LIQUIDITY_VACUUM";
    return null;
  }
  function classifyEffort(cfg, input, absorption) {
    if (input.buy + input.sell <= 0) return "INSUFFICIENT";
    if (absorption.detected && absorption.kind === "SELL_ABSORPTION") return "BUY_ABSORPTION";
    if (absorption.detected && absorption.kind === "BUY_ABSORPTION") return "SELL_ABSORPTION";
    const largeBuy = input.buyPct >= cfg.largeAggressionPercentile;
    const largeSell = input.sellPct >= cfg.largeAggressionPercentile;
    const strongMove = input.movePct >= cfg.strongDisplacementPercentile;
    const weakMove = input.movePct <= cfg.weakDisplacementPercentile;
    const px = pctChange(input.priceStart, input.priceEnd);
    const askConsumed = input.book.ask.response === "CONSUMPTION" || input.askConsPct >= 75;
    const bidConsumed = input.book.bid.response === "CONSUMPTION" || input.bidConsPct >= 75;
    const askReplenish = input.book.ask.response === "REPLENISHMENT" || input.askReplPct >= 75;
    const bidReplenish = input.book.bid.response === "REPLENISHMENT" || input.bidReplPct >= 75;
    const askWithdraw = input.book.ask.response === "WITHDRAWAL" || input.askPullPct >= 75;
    const bidWithdraw = input.book.bid.response === "WITHDRAWAL" || input.bidPullPct >= 75;
    if (input.delta > 0 && largeBuy) {
      if (px > 0 && strongMove && (askConsumed || askWithdraw)) return "EFFICIENT_BUYING";
      if (weakMove && askReplenish) return "INEFFICIENT_BUYING";
      if (weakMove || px <= 0) return "INEFFICIENT_BUYING";
    }
    if (input.delta < 0 && largeSell) {
      if (px < 0 && strongMove && (bidConsumed || bidWithdraw)) return "EFFICIENT_SELLING";
      if (weakMove && bidReplenish) return "INEFFICIENT_SELLING";
      if (weakMove || px >= 0) return "INEFFICIENT_SELLING";
    }
    return "BALANCED";
  }
  function classifyState2(cfg, input, effort, absorption, vacuum) {
    if (vacuum === "UPSIDE_LIQUIDITY_VACUUM") return "UPSIDE_LIQUIDITY_VACUUM";
    if (vacuum === "DOWNSIDE_LIQUIDITY_VACUUM") return "DOWNSIDE_LIQUIDITY_VACUUM";
    if (noDirectionalEdge(cfg, input)) return "NO_DIRECTIONAL_EDGE";
    const px = pctChange(input.priceStart, input.priceEnd);
    const failedHH = px <= 0.04 && input.priceEnd <= input.priceHigh * 1.0001;
    const failedLL = px >= -0.04 && input.priceEnd >= input.priceLow * 0.9999;
    if (absorption.detected && absorption.kind === "SELL_ABSORPTION") {
      if (input.repeatedAsk || absorption.strength >= 0.7) return "BUYERS_BEING_ABSORBED";
      return "PASSIVE_SELLERS_DEFENDING";
    }
    if (absorption.detected && absorption.kind === "BUY_ABSORPTION") {
      if (input.repeatedBid || absorption.strength >= 0.7) return "SELLERS_BEING_ABSORBED";
      return "PASSIVE_BUYERS_DEFENDING";
    }
    if (buyersInControl(cfg, input, px)) return "BUYERS_IN_CONTROL";
    if (sellersInControl(cfg, input, px)) return "SELLERS_IN_CONTROL";
    const largeBuy = input.buyPct >= cfg.largeAggressionPercentile && input.delta > 0;
    const largeSell = input.sellPct >= cfg.largeAggressionPercentile && input.delta < 0;
    const askReplHigh = input.askReplPct >= 75 || input.book.ask.response === "REPLENISHMENT";
    const bidReplHigh = input.bidReplPct >= 75 || input.book.bid.response === "REPLENISHMENT";
    const askPullLow = input.askPullPct <= 40;
    const bidPullLow = input.bidPullPct <= 40;
    const weakMove = input.movePct <= cfg.weakDisplacementPercentile;
    if (largeBuy && askReplHigh && askPullLow && weakMove && failedHH) return "PASSIVE_SELLERS_DEFENDING";
    if (largeSell && bidReplHigh && bidPullLow && weakMove && failedLL) return "PASSIVE_BUYERS_DEFENDING";
    if (effort === "INEFFICIENT_BUYING" || effort === "INEFFICIENT_SELLING") return "TRANSITION";
    return "BALANCED";
  }
  function buyersInControl(cfg, input, px) {
    const askGone = (input.askConsPct >= 75 || input.book.ask.response === "CONSUMPTION") && (input.askReplPct <= 40 || input.askPullPct >= 70 || input.book.ask.response === "WITHDRAWAL");
    return input.buyPct >= cfg.largeAggressionPercentile && input.delta > 0 && askGone && input.movePct >= cfg.strongDisplacementPercentile && px > 0.04;
  }
  function sellersInControl(cfg, input, px) {
    const bidGone = (input.bidConsPct >= 75 || input.book.bid.response === "CONSUMPTION") && (input.bidReplPct <= 40 || input.bidPullPct >= 70 || input.book.bid.response === "WITHDRAWAL");
    return input.sellPct >= cfg.largeAggressionPercentile && input.delta < 0 && bidGone && input.movePct >= cfg.strongDisplacementPercentile && px < -0.04;
  }
  function noDirectionalEdge(cfg, input) {
    const quiet = (p) => p < 75;
    const aggressionBalanced = Math.abs(input.buyPct - input.sellPct) < 12 && input.buyPct < cfg.largeAggressionPercentile && input.sellPct < cfg.largeAggressionPercentile;
    const deltaQuiet = input.deltaPct < 55;
    const moveQuiet = input.movePct < 70;
    return aggressionBalanced && deltaQuiet && moveQuiet && quiet(input.askConsPct) && quiet(input.askReplPct) && quiet(input.askPullPct) && quiet(input.bidConsPct) && quiet(input.bidReplPct) && quiet(input.bidPullPct);
  }
  function candidateStrength(input, state) {
    if (state === "BUYERS_IN_CONTROL" || state === "SELLERS_IN_CONTROL") {
      return Math.min(1, (Math.max(input.buyPct, input.sellPct) + input.movePct + input.deltaPct) / 300);
    }
    if (state === "BUYERS_BEING_ABSORBED" || state === "SELLERS_BEING_ABSORBED") {
      return Math.min(1, 0.55 + (input.repeatedAsk || input.repeatedBid ? 0.25 : 0));
    }
    if (state.includes("VACUUM")) return 0.75;
    return 0.4;
  }
  function detectReversal(cfg, input, absorption) {
    const px = pctChange(input.priceStart, input.priceEnd);
    const midRange = (input.priceHigh + input.priceLow) / 2 || input.priceEnd;
    const reclaimed = input.priceEnd > midRange && px > 0;
    const lost = input.priceEnd < midRange && px < 0;
    const majorBid = input.book.bid.remaining > 0 && input.book.bid.remaining >= input.book.ask.remaining;
    const majorAsk = input.book.ask.remaining > 0 && input.book.ask.remaining >= input.book.bid.remaining;
    const bullish = majorBid && input.sellPct >= cfg.largeAggressionPercentile && (input.repeatedBid || input.book.bid.response === "REPLENISHMENT") && absorption.kind === "BUY_ABSORPTION" && input.absEffPct <= 45 && reclaimed;
    const bearish = majorAsk && input.buyPct >= cfg.largeAggressionPercentile && (input.repeatedAsk || input.book.ask.response === "REPLENISHMENT") && absorption.kind === "SELL_ABSORPTION" && input.absEffPct <= 45 && lost;
    if (bullish) {
      return {
        detected: true,
        kind: "BULLISH",
        label: "POTENTIAL_REVERSAL_CONDITIONS_DETECTED",
        reasons: [
          "major bid liquidity",
          "aggressive selling",
          "bid replenishment",
          "passive buyer absorption",
          "selling efficiency decreased",
          "price reclaimed local structure"
        ]
      };
    }
    if (bearish) {
      return {
        detected: true,
        kind: "BEARISH",
        label: "POTENTIAL_REVERSAL_CONDITIONS_DETECTED",
        reasons: [
          "major ask liquidity",
          "aggressive buying",
          "ask replenishment",
          "passive seller absorption",
          "buying efficiency decreased",
          "price lost local structure"
        ]
      };
    }
    return null;
  }

  // src/liquidity-response/oi-context.ts
  function interpretOi(input) {
    if (input.oiChangePercent == null) return "UNCLEAR";
    const pxUp = input.priceChangePercent > 0.02;
    const pxDown = input.priceChangePercent < -0.02;
    const dUp = input.futuresDelta > 0;
    const dDown = input.futuresDelta < 0;
    const oiUp = input.oiChangePercent > input.threshold;
    const oiDown = input.oiChangePercent < -input.threshold;
    if (pxUp && dUp && oiUp) return "LIKELY_NEW_LONGS";
    if (pxUp && dUp && oiDown) return "LIKELY_SHORT_COVERING";
    if (pxDown && dDown && oiUp) return "LIKELY_NEW_SHORTS";
    if (pxDown && dDown && oiDown) return "LIKELY_LONG_UNWIND";
    return "UNCLEAR";
  }

  // src/liquidity-response/cross-market.ts
  var CrossMarketConfirmationEngine = class {
    classify(spot, futures, oiThreshold) {
      const spotLeg = toLeg("spot", spot, null, oiThreshold);
      const futOi = interpretOi({
        priceChangePercent: futures.snapshot.priceMovePercent,
        futuresDelta: futures.snapshot.delta,
        oiChangePercent: futures.oiChangePercent,
        threshold: oiThreshold
      });
      const futLeg = toLeg("perp", futures, futOi, oiThreshold);
      const relation2 = relationOf(spotLeg, futLeg, futures.snapshot.priceMovePercent, futOi);
      const confirmed = relation2 === "BROAD_BUYING" || relation2 === "BROAD_SELLING";
      const inefficient = (relation2 === "BROAD_BUYING" || relation2 === "LEVERAGE_DRIVEN_LONGS") && (spotLeg.efficiency === "LOW" || futLeg.efficiency === "LOW");
      return {
        spot: spotLeg,
        futures: futLeg,
        relation: relation2,
        confirmed,
        inefficient,
        oiInterpretation: futOi,
        confidenceScore: combinedConfidence(spotLeg, futLeg, relation2, confirmed),
        note: noteFor(relation2, inefficient, futOi)
      };
    }
  };
  function toLeg(market, src, oi, _threshold) {
    const s = src.snapshot;
    const total = Math.max(1, s.executed);
    return {
      market,
      state: s.state,
      aggression: s.aggression,
      delta: s.delta,
      deltaPercent: src.deltaPercent || s.delta / total,
      cvdDirection: s.cvdDirection,
      bookResponse: dominantBook(s),
      absorption: s.absorption.kind,
      withdrawal: maxIntensity(s.askWithdrawal, s.bidWithdrawal),
      efficiency: s.efficiency,
      effort: s.effort,
      oiChangePercent: src.oiChangePercent,
      oiInterpretation: market === "perp" ? oi : null,
      shortLiquidationUsd: src.shortLiquidationUsd,
      longLiquidationUsd: src.longLiquidationUsd,
      liquidations: src.shortLiquidationUsd + src.longLiquidationUsd
    };
  }
  function dominantBook(s) {
    if (s.aggression === "BUYERS") return s.askResponse;
    if (s.aggression === "SELLERS") return s.bidResponse;
    return s.askResponse !== "QUIET" ? s.askResponse : s.bidResponse;
  }
  function relationOf(spot, fut, priceChangePercent, oi) {
    const sBuy = isBuy(spot);
    const sSell = isSell(spot);
    const fBuy = isBuy(fut);
    const fSell = isSell(fut);
    const pxUp = priceChangePercent > 0.04;
    const pxDown = priceChangePercent < -0.04;
    const shortLiq = fut.shortLiquidationUsd > 0 && fut.shortLiquidationUsd >= fut.longLiquidationUsd * 1.25;
    const longLiq = fut.longLiquidationUsd > 0 && fut.longLiquidationUsd >= fut.shortLiquidationUsd * 1.25;
    if (pxUp && fBuy && oi === "LIKELY_SHORT_COVERING" && shortLiq) return "SHORT_COVERING_DOMINATED";
    if (pxDown && fSell && oi === "LIKELY_LONG_UNWIND" && longLiq) return "LONG_LIQUIDATION_DOMINATED";
    if (pxUp && fBuy && oi === "LIKELY_NEW_LONGS") {
      if (sBuy) return "BROAD_BUYING";
      return "LEVERAGE_DRIVEN_LONGS";
    }
    if (pxDown && fSell && oi === "LIKELY_NEW_SHORTS") {
      if (sSell) return "BROAD_SELLING";
      return "LEVERAGE_DRIVEN_SHORTS";
    }
    if (sBuy && fBuy) return "BROAD_BUYING";
    if (sSell && fSell) return "BROAD_SELLING";
    if (sBuy && !fBuy && !fSell) return "SPOT_LED_BUYING";
    if (sSell && !fBuy && !fSell) return "SPOT_LED_SELLING";
    if (fBuy && !sBuy && !sSell) return "FUTURES_LED_BUYING";
    if (fSell && !sBuy && !sSell) return "FUTURES_LED_SELLING";
    if (sBuy && fSell) return "SPOT_FUTURES_BULLISH_DIVERGENCE";
    if (sSell && fBuy) return "SPOT_FUTURES_BEARISH_DIVERGENCE";
    if (!sBuy && !sSell && !fBuy && !fSell) return "BALANCED";
    return "UNRESOLVED";
  }
  function isBuy(leg) {
    return leg.aggression === "BUYERS" || leg.aggression === "BALANCED" && leg.delta > 0 && Math.abs(leg.deltaPercent) >= 0.12;
  }
  function isSell(leg) {
    return leg.aggression === "SELLERS" || leg.aggression === "BALANCED" && leg.delta < 0 && Math.abs(leg.deltaPercent) >= 0.12;
  }
  function combinedConfidence(spot, fut, relation2, confirmed) {
    let s = 40;
    if (confirmed) s += 22;
    if (relation2.includes("DIVERGENCE")) s -= 18;
    if (spot.efficiency === fut.efficiency && spot.efficiency !== "LOW") s += 8;
    if (spot.cvdDirection === fut.cvdDirection && spot.cvdDirection !== "FLAT") s += 8;
    if (fut.oiChangePercent == null) s -= 8;
    return Math.max(0, Math.min(100, s));
  }
  function noteFor(relation2, inefficient, oi) {
    if (relation2 === "BROAD_BUYING" && inefficient) return "BROAD BUYING BUT INEFFICIENT";
    if (relation2 === "BROAD_SELLING" && inefficient) return "BROAD SELLING BUT INEFFICIENT";
    if (oi && oi !== "UNCLEAR") return `${relation2.replace(/_/g, " ")} \xB7 ${oi.replace(/_/g, " ")}`;
    return relation2.replace(/_/g, " ");
  }
  function maxIntensity(a, b) {
    const rank = { LOW: 0, NORMAL: 1, HIGH: 2, EXTREME: 3 };
    return rank[a] >= rank[b] ? a : b;
  }

  // src/liquidity-response/compare.ts
  var engine = new CrossMarketConfirmationEngine();
  function compareLiquidityMarkets(spot, futures, oiThreshold = 0.05) {
    if (!futures) return null;
    const spotIn = {
      snapshot: spot,
      deltaPercent: spot.executed > 0 ? spot.delta / spot.executed : 0,
      oiChangePercent: null,
      shortLiquidationUsd: 0,
      longLiquidationUsd: 0
    };
    const futIn = {
      snapshot: futures.snapshot,
      deltaPercent: futures.snapshot.executed > 0 ? futures.snapshot.delta / futures.snapshot.executed : 0,
      oiChangePercent: futures.oiChangePercent,
      shortLiquidationUsd: futures.forcedBuyVolume,
      longLiquidationUsd: futures.forcedSellVolume
    };
    return engine.classify(spotIn, futIn, oiThreshold);
  }

  // src/liquidity-response/confidence-score.ts
  function confidenceScore(cfg, src) {
    const i = src.input;
    let s = 22;
    const sig = Math.max(i.buyPct, i.sellPct, i.deltaPct);
    s += clamp((sig - 50) * 0.45, 0, 22);
    if (src.bookClear) s += 12;
    else s -= 6;
    if (i.movePct >= 70) s += 12;
    else if (i.movePct <= 35 && (src.state === "BUYERS_IN_CONTROL" || src.state === "SELLERS_IN_CONTROL")) s -= 14;
    if (src.cvdAligned) s += 8;
    if (src.persisted) s += 10;
    s += (src.dataQuality - 55) * 0.25;
    if (src.crossAgree === true) s += 12;
    if (src.crossAgree === false) s -= 16;
    if (src.fadedImpact) s -= 10;
    if (i.buy + i.sell <= 0 || i.deltaPct < 40) s -= 12;
    if (quietBook(i)) s -= 8;
    if (src.state === "NO_DIRECTIONAL_EDGE" || src.state === "BALANCED") s = Math.min(s, 38);
    let score = Math.round(clamp(s, 0, 100));
    if (src.dataQuality < cfg.highConfidenceMinQuality && score >= 70) score = 69;
    if (src.dataConsistency != null && src.dataConsistency < cfg.minConsistencyForHigh && score >= 70) {
      score = 69;
    }
    const label = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
    return { score, label };
  }
  function quietBook(i) {
    const n = (x) => x === "NORMAL" || x === "LOW";
    return n(intensity(i.askConsPct)) && n(intensity(i.askReplPct)) && n(intensity(i.askPullPct)) && n(intensity(i.bidConsPct)) && n(intensity(i.bidReplPct)) && n(intensity(i.bidPullPct));
  }
  function intensity(p) {
    if (p >= 92) return "EXTREME";
    if (p >= 75) return "HIGH";
    if (p <= 25) return "LOW";
    return "NORMAL";
  }

  // src/liquidity-response/consistency.ts
  function displayedChangePercent(input) {
    if (!input.primed || !input.hasValidPrevious) {
      return { percent: null, reason: "ORDER_BOOK_DATA_RESET" };
    }
    if (input.recentlyReset || !input.websocketHealthy || !input.sequenceContinuous || !input.bookSynchronized) {
      return { percent: null, reason: "ORDER_BOOK_DATA_RESET" };
    }
    if (input.bookEmpty || !input.bandValid) {
      return { percent: null, reason: "ORDER_BOOK_DATA_RESET" };
    }
    if (input.initial <= 0) return { percent: null, reason: "INSUFFICIENT_DATA" };
    const raw = (input.remaining - input.initial) / input.initial * 100;
    const removed = input.consumed + input.cancelled;
    const expectedRemaining = Math.max(0, input.initial + input.added - removed);
    const unexplained = Math.abs(expectedRemaining - input.remaining) > Math.max(input.initial * 0.25, 1);
    if (raw <= -99.5) {
      if (unexplained || input.remaining <= 0 && removed < input.initial * 0.5) {
        return { percent: null, reason: "ORDER_BOOK_DATA_RESET" };
      }
    }
    if (raw <= -80 && unexplained) {
      return { percent: null, reason: "UNEXPLAINED_ASK_LIQUIDITY_DROP" };
    }
    return { percent: raw, reason: null };
  }
  function validateSideDrop(cfg, input) {
    const drop = input.changePercent;
    if (drop == null || drop > -cfg.unexplainedDropPercent) return { valid: true, reason: null };
    const consumeHigh = input.consumption === "HIGH" || input.consumption === "EXTREME";
    const withdrawHigh = input.withdrawal === "HIGH" || input.withdrawal === "EXTREME";
    if (consumeHigh || withdrawHigh) return { valid: true, reason: null };
    return { valid: false, reason: "UNEXPLAINED_ASK_LIQUIDITY_DROP" };
  }
  function dataConsistencyScore(input) {
    let s = 100;
    const flags = new Set([...input.flags ?? []].map(String));
    if (flags.has("reconnect")) s -= 25;
    if (flags.has("sequenceGap")) s -= 20;
    if (flags.has("staleBook")) s -= 20;
    if (flags.has("missingData")) s -= 12;
    if (input.bookEmpty) s -= 20;
    if (!input.snapshotContinuous) s -= 16;
    if (!input.tradeBookReconciled) s -= 14;
    if (input.unexplainedAsk) s -= 45;
    if (input.unexplainedBid) s -= 45;
    if (input.lastBookAgeMs > 4e3) s -= 12;
    if (input.lastTradeAgeMs > 8e3) s -= 8;
    return clamp(s, 0, 100);
  }
  function validateConsistency(cfg, input) {
    const ask = validateSideDrop(cfg, input.ask);
    const bid = validateSideDrop(cfg, input.bid);
    const score = dataConsistencyScore({
      flags: input.flags,
      bookEmpty: input.bookEmpty,
      lastBookAgeMs: input.lastBookAgeMs,
      lastTradeAgeMs: input.lastTradeAgeMs,
      unexplainedAsk: !ask.valid,
      unexplainedBid: !bid.valid,
      snapshotContinuous: input.snapshotContinuous,
      tradeBookReconciled: input.tradeBookReconciled
    });
    const reason = !ask.valid ? ask.reason : !bid.valid ? bid.reason : score < cfg.minConsistencyForKnown ? "INCONSISTENT_DATA" : null;
    return {
      valid: ask.valid && bid.valid && score >= cfg.minConsistencyForKnown,
      reason,
      score
    };
  }
  function tradeBookReconciled(aggressiveBuy, aggressiveSell, ask, bid) {
    if (ask.consumed > aggressiveBuy * 1.35 + 1 && aggressiveBuy >= 0) return false;
    if (bid.consumed > aggressiveSell * 1.35 + 1 && aggressiveSell >= 0) return false;
    return true;
  }

  // src/liquidity-response/data-quality.ts
  function dataQualityScore(input) {
    let s = 100;
    const flags = new Set([...input.flags ?? []].map(String));
    if (flags.has("reconnect")) s -= 22;
    if (flags.has("sequenceGap")) s -= 18;
    if (flags.has("staleBook")) s -= 22;
    if (flags.has("missingData")) s -= 16;
    if (flags.has("wideSpread")) s -= 10;
    if (flags.has("outOfOrder")) s -= 8;
    if (input.bookEmpty) s -= 18;
    if (input.tradeCount < 6) s -= 16;
    else if (input.tradeCount < 12) s -= 8;
    if (input.lastTradeAgeMs > 8e3) s -= 12;
    if (input.lastBookAgeMs > 4e3) s -= 14;
    if (input.baselineSize < 8) s -= 18;
    else if (input.baselineSize < 20) s -= 8;
    if (input.oiExpected && !input.oiPresent) s -= 10;
    if (input.liquidationExpected && !input.liquidationPresent) s -= 6;
    if (input.exchangeCount <= 1) s -= 4;
    return clamp(s, 0, 100);
  }

  // src/liquidity-response/delta-analysis.ts
  function analyzeDelta(delta, absoluteDeltaPercentile) {
    const direction = Math.abs(delta) < 1e-9 ? "BALANCED" : delta > 0 ? "BUY" : "SELL";
    return {
      delta,
      direction,
      absoluteDeltaPercentile,
      directionalMagnitudePercentile: absoluteDeltaPercentile
    };
  }

  // src/liquidity-response/entry-context.ts
  function classifyEntry(input) {
    const bullishShift = input.structure.shift === "BULLISH_CHOCH" || input.structure.shift === "BULLISH_BOS";
    const bearishShift = input.structure.shift === "BEARISH_CHOCH" || input.structure.shift === "BEARISH_BOS";
    const sellerAbsorbed = input.absorption.kind === "BUY_ABSORPTION" || input.state === "SELLERS_BEING_ABSORBED" || input.effort === "SELL_ABSORPTION";
    const buyerAbsorbed = input.absorption.kind === "SELL_ABSORPTION" || input.state === "BUYERS_BEING_ABSORBED" || input.effort === "BUY_ABSORPTION";
    const priceUp = input.priceMovePercent > 0.04 && (input.efficiency === "HIGH" || input.efficiency === "EXTREME");
    const priceDown = input.priceMovePercent < -0.04 && (input.efficiency === "HIGH" || input.efficiency === "EXTREME");
    const failedHH = input.structure.lowerHigh || input.structure.swingHigh != null && input.priceMovePercent <= 0.04;
    const failedLL = input.structure.higherLow || input.structure.swingLow != null && input.priceMovePercent >= -0.04;
    if (sellerAbsorbed && (bullishShift || input.reversal?.kind === "BULLISH") && input.spotDeltaTurnsPositive && priceUp) {
      return "LONG_CONFIRMATION";
    }
    if (buyerAbsorbed && (bearishShift || input.reversal?.kind === "BEARISH") && input.spotDeltaTurnsNegative && priceDown && failedHH) {
      return "SHORT_CONFIRMATION";
    }
    const longSetup = (input.state === "PASSIVE_BUYERS_DEFENDING" || sellerAbsorbed) && (input.aggression === "SELLERS" || input.delta < 0) && highish(input.bidReplenishment) && (input.efficiency === "LOW" || input.efficiency === "NORMAL") && failedLL;
    if (longSetup) return "LONG_SETUP_FORMING";
    const shortSetup = (input.state === "PASSIVE_SELLERS_DEFENDING" || buyerAbsorbed) && (input.aggression === "BUYERS" || input.delta > 0) && highish(input.askReplenishment) && (input.efficiency === "LOW" || input.efficiency === "NORMAL") && failedHH;
    if (shortSetup) return "SHORT_SETUP_FORMING";
    return "NO_ENTRY";
  }
  function highish(x) {
    return x === "HIGH" || x === "EXTREME";
  }

  // src/liquidity-response/impact-horizons.ts
  var ImpactHorizonTracker = class {
    constructor(config) {
      this.config = config;
    }
    current = null;
    closed = [];
    hist = new RollingDistribution(256);
    lastPrice = 0;
    onTrade(timestamp, price, quote) {
      this.advance(timestamp, this.lastPrice || price);
      const bucket2 = timestamp - timestamp % 1e3;
      if (!this.current || this.current.start !== bucket2) {
        if (this.current && this.current.quoteSum >= this.config.minImpactQuote) {
          this.current.immediate = this.lastPrice || price;
          this.closed.push(this.current);
          if (this.closed.length > 240) this.closed.shift();
        }
        this.current = {
          start: bucket2,
          priceBefore: this.lastPrice || price,
          quoteSum: 0,
          pxQuote: 0,
          immediate: price
        };
      }
      this.current.quoteSum += quote;
      this.current.pxQuote += price * quote;
      this.current.immediate = price;
      this.lastPrice = price;
    }
    onPrice(timestamp, price) {
      if (price > 0) this.lastPrice = price;
      this.advance(timestamp, this.lastPrice);
    }
    snapshot(now, price) {
      this.advance(now, price || this.lastPrice);
      const recent = this.closed.filter((o) => now - o.start <= 6e4 && o.quoteSum >= this.config.minImpactQuote);
      const sample = recent[recent.length - 1] ?? this.current;
      if (!sample || sample.priceBefore <= 0) {
        return {
          immediateBps: 0,
          bps5s: 0,
          bps30s: 0,
          bps1m: 0,
          bps5m: 0,
          vwapBps: 0,
          classification: "NORMAL",
          faded: false
        };
      }
      const vwap = safeDiv(sample.pxQuote, sample.quoteSum) || sample.immediate;
      const immediateBps = bps(sample.priceBefore, sample.immediate);
      const vwapBps = bps(sample.priceBefore, vwap);
      const bps5s = bps(sample.priceBefore, sample.at5 ?? sample.immediate);
      const bps30s = bps(sample.priceBefore, sample.at30 ?? sample.at5 ?? sample.immediate);
      const bps1m = bps(sample.priceBefore, sample.at60 ?? sample.at30 ?? sample.immediate);
      const bps5m = bps(sample.priceBefore, sample.at300 ?? sample.at60 ?? sample.at30 ?? sample.immediate);
      if (Math.abs(bps1m) > 0) this.hist.add(Math.abs(bps1m));
      const later = sample.at300 != null ? bps5m : sample.at60 != null ? bps1m : sample.at30 != null ? bps30s : bps5s;
      const faded = immediateBps > 0 && later < immediateBps * 0.25 || immediateBps < 0 && later > immediateBps * 0.25;
      return {
        immediateBps,
        bps5s,
        bps30s,
        bps1m,
        bps5m,
        vwapBps,
        classification: classifyImpact(Math.abs(bps1m) || Math.abs(immediateBps), this.hist),
        faded
      };
    }
    advance(now, price) {
      if (price <= 0) return;
      for (const obs of this.closed) {
        const age = now - obs.start;
        if (age >= 5e3 && obs.at5 == null) obs.at5 = price;
        if (age >= 3e4 && obs.at30 == null) obs.at30 = price;
        if (age >= 6e4 && obs.at60 == null) obs.at60 = price;
        if (age >= 3e5 && obs.at300 == null) obs.at300 = price;
      }
      if (this.current) {
        const age = now - this.current.start;
        if (age >= 5e3 && this.current.at5 == null) this.current.at5 = price;
        if (age >= 3e4 && this.current.at30 == null) this.current.at30 = price;
      }
    }
  };
  function bps(from, to) {
    return pctChange(from, to) * 100;
  }
  function classifyImpact(current, hist) {
    if (current === 0) return "LOW";
    if (hist.size < 8) {
      if (current < 2) return "LOW";
      if (current > 40) return "EXTREME";
      if (current > 12) return "HIGH";
      return "NORMAL";
    }
    const rank = hist.percentileRank(current);
    if (rank >= 92) return "EXTREME";
    if (rank >= 75) return "HIGH";
    if (rank <= 25) return "LOW";
    return "NORMAL";
  }

  // src/liquidity-response/percentile-band.ts
  var DEFAULT_BANDS = {
    veryLow: 20,
    low: 40,
    normal: 60,
    elevated: 80,
    high: 95
  };
  function percentileBand(percentile, bands = DEFAULT_BANDS) {
    if (percentile < bands.veryLow) return "VERY_LOW";
    if (percentile < bands.low) return "LOW";
    if (percentile < bands.normal) return "NORMAL";
    if (percentile < bands.elevated) return "ELEVATED";
    if (percentile < bands.high) return "HIGH";
    return "EXTREME";
  }
  function percentileTooltip(percentile) {
    const p = Math.round(Math.max(0, Math.min(100, percentile)));
    return `This value is higher than ${p}% and lower than ${100 - p}% of comparable historical observations.`;
  }
  function bandToIntensity(band) {
    if (band === "VERY_LOW" || band === "LOW") return "LOW";
    if (band === "NORMAL") return "NORMAL";
    if (band === "ELEVATED" || band === "HIGH") return "HIGH";
    return "EXTREME";
  }

  // src/liquidity-response/mechanics.ts
  var LOW_MAX = ["VERY_LOW", "LOW", "NORMAL"];
  var HIGH_MIN = ["HIGH", "EXTREME"];
  function classifyMarketMechanics(input) {
    const buyBand = percentileBand(input.buyPct, input.bands);
    const sellBand = percentileBand(input.sellPct, input.bands);
    const moveBand = percentileBand(input.movePct, input.bands);
    const askWithdraw = input.ask.changeState === "WITHDRAWAL_DOMINATED";
    const bidWithdraw = input.bid.changeState === "WITHDRAWAL_DOMINATED";
    const askConsume = input.ask.changeState === "CONSUMPTION_DOMINATED";
    const bidConsume = input.bid.changeState === "CONSUMPTION_DOMINATED";
    const askRepl = input.ask.changeState === "REPLENISHMENT_DOMINATED";
    const bidRepl = input.bid.changeState === "REPLENISHMENT_DOMINATED";
    const askDrop = (input.ask.changePercent ?? 0) <= -15;
    const bidDrop = (input.bid.changePercent ?? 0) <= -15;
    const buyQuiet = LOW_MAX.includes(buyBand);
    const sellQuiet = LOW_MAX.includes(sellBand);
    const buyHot = HIGH_MIN.includes(buyBand) || input.buyPct >= 80;
    const sellHot = HIGH_MIN.includes(sellBand) || input.sellPct >= 80;
    const moveHot = HIGH_MIN.includes(moveBand) || input.movePct >= 80;
    const moveCold = input.movePct <= 40;
    if (input.ask.changeState === "UNKNOWN" && input.bid.changeState === "UNKNOWN" && !moveHot && buyQuiet && sellQuiet) {
      return "UNKNOWN";
    }
    if (input.priceMovePercent > 0.04 && buyQuiet && (askWithdraw || askDrop) && moveHot) {
      return "LIQUIDITY_DRIVEN_UP";
    }
    if (input.priceMovePercent < -0.04 && sellQuiet && (bidWithdraw || bidDrop) && moveHot) {
      return "LIQUIDITY_DRIVEN_DOWN";
    }
    if (buyHot && askRepl && moveCold) return "BUYER_ABSORPTION";
    if (sellHot && bidRepl && moveCold) return "SELLER_ABSORPTION";
    if (buyHot && (askConsume || input.ask.consumptionRatio >= 0.55) && moveHot && input.priceMovePercent > 0) {
      return "FLOW_DRIVEN_UP";
    }
    if (sellHot && (bidConsume || input.bid.consumptionRatio >= 0.55) && moveHot && input.priceMovePercent < 0) {
      return "FLOW_DRIVEN_DOWN";
    }
    return "BALANCED";
  }
  function mechanicsInterpretation(kind) {
    switch (kind) {
      case "LIQUIDITY_DRIVEN_UP":
        return "Price is rising primarily because sell liquidity is disappearing, not because aggressive buying is exceptionally large.";
      case "LIQUIDITY_DRIVEN_DOWN":
        return "Price is falling primarily because bid liquidity is disappearing, not because aggressive selling is exceptionally large.";
      case "FLOW_DRIVEN_UP":
        return "Aggressive buyers are strong, ask liquidity is being consumed, and price is responding efficiently.";
      case "FLOW_DRIVEN_DOWN":
        return "Aggressive sellers are strong, bid liquidity is being consumed, and price is responding efficiently.";
      case "BUYER_ABSORPTION":
        return "Buyers are extremely aggressive but sellers replenish asks and price response remains weak \u2014 passive sellers are defending.";
      case "SELLER_ABSORPTION":
        return "Sellers are extremely aggressive but buyers replenish bids and price response remains weak \u2014 passive buyers are defending.";
      case "UNKNOWN":
        return "Order-book data is not consistent enough to classify why price moved.";
      default:
        return "Aggression, book response, and price displacement do not show a clear directional mechanic.";
    }
  }

  // src/liquidity-response/minute-ring.ts
  var MinuteRing = class {
    constructor(capacity) {
      this.capacity = capacity;
    }
    bars = [];
    open = null;
    ingest(trade, opts = {
      large: false,
      nearAsk: false,
      nearBid: false
    }) {
      const time = barTime(trade.timestamp, 1);
      let closed = null;
      if (this.open && this.open.time !== time) {
        if (time > this.open.time) {
          closed = this.closeOpen();
        } else {
          return null;
        }
      }
      if (!this.open) {
        this.open = {
          time,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          buy: 0,
          sell: 0,
          buyCount: 0,
          sellCount: 0,
          largeBuyCount: 0,
          largeSellCount: 0,
          nearAsk: 0,
          nearBid: 0
        };
      }
      const bar = this.open;
      bar.high = Math.max(bar.high, trade.price);
      bar.low = Math.min(bar.low, trade.price);
      bar.close = trade.price;
      if (trade.isAggressiveBuy) {
        bar.buy += trade.quoteValue;
        bar.buyCount += 1;
        if (opts.large) bar.largeBuyCount += 1;
        if (opts.nearAsk) bar.nearAsk += trade.quoteValue;
      } else {
        bar.sell += trade.quoteValue;
        bar.sellCount += 1;
        if (opts.large) bar.largeSellCount += 1;
        if (opts.nearBid) bar.nearBid += trade.quoteValue;
      }
      return closed;
    }
    closeStale(now) {
      if (!this.open) return null;
      if (this.open.time >= barTime(now, 1)) return null;
      return this.closeOpen();
    }
    roll(tf, now = Date.now()) {
      const bars = this.liveSlice(tf, now);
      if (!bars.length) return null;
      return merge(bars, this.atr());
    }
    allTfs(now = Date.now()) {
      const out = {};
      for (const tf of LIQUIDITY_TF_MINUTES) {
        const rolled = this.roll(tf, now);
        if (rolled) out[tf] = rolled;
      }
      return out;
    }
    atr(period = 14) {
      if (this.bars.length < 2) {
        const last = this.open ?? this.bars[this.bars.length - 1];
        return last ? Math.max(0, last.high - last.low) : 0;
      }
      const n = Math.min(period, this.bars.length);
      const slice = this.bars.slice(-n);
      let sum = 0;
      for (let i = 0; i < slice.length; i++) {
        const bar = slice[i];
        const prev = slice[i - 1] ?? this.bars[this.bars.length - n - 1];
        const tr = prev ? Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close)) : bar.high - bar.low;
        sum += tr;
      }
      return sum / n;
    }
    get lastClosed() {
      return this.bars[this.bars.length - 1] ?? null;
    }
    closed() {
      return this.bars;
    }
    closeOpen() {
      const bar = this.open;
      if (!bar) return null;
      this.open = null;
      this.bars.push(bar);
      if (this.bars.length > this.capacity) this.bars.shift();
      return bar;
    }
    liveSlice(tf, now) {
      const live = this.open;
      const lastTime = live?.time ?? barTime(now, 1);
      const from = lastTime - (tf - 1) * 60;
      const closed = this.bars.filter((b) => b.time >= from && b.time !== live?.time);
      return live ? [...closed, live] : closed;
    }
  };
  function merge(bars, atr) {
    const first = bars[0];
    const last = bars[bars.length - 1];
    if (!first || !last) return null;
    let buy = 0;
    let sell = 0;
    let buyCount = 0;
    let sellCount = 0;
    let largeBuyCount = 0;
    let largeSellCount = 0;
    let nearAsk = 0;
    let nearBid = 0;
    let high = first.high;
    let low = first.low;
    for (const b of bars) {
      buy += b.buy;
      sell += b.sell;
      buyCount += b.buyCount;
      sellCount += b.sellCount;
      largeBuyCount += b.largeBuyCount;
      largeSellCount += b.largeSellCount;
      nearAsk += b.nearAsk;
      nearBid += b.nearBid;
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
    }
    return {
      open: first.open,
      high,
      low,
      close: last.close,
      buy,
      sell,
      buyCount,
      sellCount,
      largeBuyCount,
      largeSellCount,
      nearAsk,
      nearBid,
      atr
    };
  }

  // src/liquidity-response/normalizer.ts
  var MetricNormalizer = class {
    constructor(windows, defaultWindow) {
      this.windows = windows;
      this.defaultWindow = defaultWindow;
    }
    series = /* @__PURE__ */ new Map();
    observe(key3, value, tf = 1) {
      if (!Number.isFinite(value)) return;
      for (const n of this.windows) {
        this.dist(key3, tf, n).add(value);
      }
    }
    stats(key3, value, tf = 1, window = this.defaultWindow) {
      const dist = this.dist(key3, tf, window);
      if (dist.size < 4) {
        return { value, percentile: 50, zScore: 0, median: 0, std: 0, window };
      }
      return {
        value,
        percentile: dist.percentileRank(value),
        zScore: dist.zScore(value, 1e-12),
        median: dist.median(),
        std: dist.std(),
        window
      };
    }
    percentile(key3, value, tf = 1, window = this.defaultWindow) {
      return this.stats(key3, value, tf, window).percentile;
    }
    sampleSize(key3, tf = 1, window = this.defaultWindow) {
      return this.dist(key3, tf, window).size;
    }
    dist(key3, tf, window) {
      const id = `${key3}:${tf}:${window}`;
      let d = this.series.get(id);
      if (!d) {
        d = new RollingDistribution(window);
        this.series.set(id, d);
      }
      return d;
    }
  };

  // src/liquidity-response/persistence.ts
  var StatePersistenceEngine = class {
    constructor(config) {
      this.config = config;
    }
    state = "NO_DIRECTIONAL_EDGE";
    since = 0;
    askDefend = 0;
    bidDefend = 0;
    stabilize(now, candidate, strength, confidenceScore2) {
      if (candidate === this.state) {
        this.bumpDefense(candidate);
        return this.state;
      }
      const opposite = isOpposite(this.state, candidate);
      const heldMs = this.since > 0 ? now - this.since : 0;
      const strong = strength >= this.config.persistMinStrength && confidenceScore2 >= 55;
      if (isControl(this.state) && candidate !== this.state) {
        if (opposite && !strong) {
          this.bumpDefense(this.state);
          return this.state;
        }
        if ((candidate === "NO_DIRECTIONAL_EDGE" || candidate === "BALANCED" || candidate === "TRANSITION") && heldMs < this.config.persistMs && !strong) {
          this.bumpDefense(this.state);
          return this.state;
        }
      }
      if (this.state === "PASSIVE_SELLERS_DEFENDING" && candidate === "BUYERS_BEING_ABSORBED") {
        this.askDefend += 1;
        if (this.askDefend >= this.config.defendEscalateCount) {
          this.commit(now, "BUYERS_BEING_ABSORBED");
          return this.state;
        }
        return this.state;
      }
      if (this.state === "PASSIVE_BUYERS_DEFENDING" && candidate === "SELLERS_BEING_ABSORBED") {
        this.bidDefend += 1;
        if (this.bidDefend >= this.config.defendEscalateCount) {
          this.commit(now, "SELLERS_BEING_ABSORBED");
          return this.state;
        }
        return this.state;
      }
      this.commit(now, candidate);
      this.bumpDefense(candidate);
      return this.state;
    }
    escalateDefense(candidate) {
      if (candidate === "PASSIVE_SELLERS_DEFENDING" && this.askDefend >= this.config.defendEscalateCount) {
        return "BUYERS_BEING_ABSORBED";
      }
      if (candidate === "PASSIVE_BUYERS_DEFENDING" && this.bidDefend >= this.config.defendEscalateCount) {
        return "SELLERS_BEING_ABSORBED";
      }
      return candidate;
    }
    get current() {
      return this.state;
    }
    commit(now, state) {
      this.state = state;
      this.since = now;
      if (state !== "PASSIVE_SELLERS_DEFENDING" && state !== "BUYERS_BEING_ABSORBED") this.askDefend = 0;
      if (state !== "PASSIVE_BUYERS_DEFENDING" && state !== "SELLERS_BEING_ABSORBED") this.bidDefend = 0;
    }
    bumpDefense(state) {
      if (state === "PASSIVE_SELLERS_DEFENDING" || state === "BUYERS_BEING_ABSORBED") this.askDefend += 1;
      if (state === "PASSIVE_BUYERS_DEFENDING" || state === "SELLERS_BEING_ABSORBED") this.bidDefend += 1;
    }
  };
  function isControl(state) {
    return state === "BUYERS_IN_CONTROL" || state === "SELLERS_IN_CONTROL";
  }
  function isOpposite(a, b) {
    return a === "BUYERS_IN_CONTROL" && b === "SELLERS_IN_CONTROL" || a === "SELLERS_IN_CONTROL" && b === "BUYERS_IN_CONTROL";
  }

  // src/liquidity-response/side-response.ts
  function consumptionRatio(consumed, cancelled) {
    const removed = consumed + cancelled;
    return safeDiv(consumed, Math.max(removed, 1e-9));
  }
  function classifyChangeState(window, changePercent) {
    if (changePercent == null) return "UNKNOWN";
    const total = window.added + window.cancelled + window.consumed;
    if (total <= 0 && Math.abs(changePercent) < 8) return "STABLE";
    if (total <= 0) return "MIXED";
    const a = safeDiv(window.added, total);
    const c = safeDiv(window.cancelled, total);
    const x = safeDiv(window.consumed, total);
    if (a >= 0.5 && a >= c && a >= x) return "REPLENISHMENT_DOMINATED";
    if (x >= 0.55 && x >= c) return "CONSUMPTION_DOMINATED";
    if (c >= 0.55 && c >= x) return "WITHDRAWAL_DOMINATED";
    return "MIXED";
  }
  function classifyAskSide(input) {
    if (input.consistencyLow) return "UNKNOWN";
    const buyHigh = input.aggressivePct >= 80;
    const consumeHigh = highish2(input.consumePct, input.window.consumed, input.window);
    const replenishHigh = highish2(input.replenishPct, input.window.added, input.window);
    const withdrawHigh = highish2(input.withdrawPct, input.window.cancelled, input.window);
    const pxUp = input.priceMovePercent > 0.04 && input.movePct >= 70;
    const pxWeak = input.movePct <= 40;
    if (buyHigh && consumeHigh && replenishHigh && pxWeak) return "PASSIVE_SELLERS_DEFENDING";
    if (buyHigh && consumeHigh && !replenishHigh && pxUp) return "PASSIVE_SELLERS_FAILING";
    if (withdrawHigh && (input.changePercent ?? 0) <= -15) return "ASKS_BEING_WITHDRAWN";
    if (consumeHigh) return "ASKS_BEING_CONSUMED";
    if (replenishHigh) return "ASKS_BEING_REPLENISHED";
    if (Math.abs(input.changePercent ?? 0) < 8) return "ASK_STABLE";
    return "ASK_STABLE";
  }
  function classifyBidSide(input) {
    if (input.consistencyLow) return "UNKNOWN";
    const sellHigh = input.aggressivePct >= 80;
    const consumeHigh = highish2(input.consumePct, input.window.consumed, input.window);
    const replenishHigh = highish2(input.replenishPct, input.window.added, input.window);
    const withdrawHigh = highish2(input.withdrawPct, input.window.cancelled, input.window);
    const pxDown = input.priceMovePercent < -0.04 && input.movePct >= 70;
    const pxWeak = input.movePct <= 40;
    if (sellHigh && consumeHigh && replenishHigh && pxWeak) return "PASSIVE_BUYERS_DEFENDING";
    if (sellHigh && consumeHigh && !replenishHigh && pxDown) return "PASSIVE_BUYERS_FAILING";
    if (withdrawHigh && (input.changePercent ?? 0) <= -15) return "BIDS_BEING_WITHDRAWN";
    if (consumeHigh) return "BIDS_BEING_CONSUMED";
    if (replenishHigh) return "BIDS_BEING_REPLENISHED";
    if (Math.abs(input.changePercent ?? 0) < 8) return "BID_STABLE";
    return "BID_STABLE";
  }
  function toDepthView(cfg, input, sideState) {
    const removed = input.window.consumed + input.window.cancelled;
    return {
      current: input.window.remaining,
      currentPercentile: input.currentPercentile,
      changePercent: input.changePercent,
      changeReason: input.changeReason,
      consumed: input.window.consumed,
      cancelled: input.window.cancelled,
      replenished: input.window.added,
      removed,
      consumptionRatio: consumptionRatio(input.window.consumed, input.window.cancelled),
      changeState: classifyChangeState(input.window, input.changePercent),
      sideState
    };
  }
  function intensityForComponent(cfg, amount, removed, initial, percentile, sampleSize, dropPercent) {
    const band = percentileBand(percentile, cfg.percentileBands);
    let fromPct = bandToIntensity(band);
    if (sampleSize < 8) fromPct = "NORMAL";
    const share = safeDiv(amount, Math.max(removed, 1e-9));
    const drop = dropPercent ?? 0;
    if (drop <= -cfg.unexplainedDropPercent && share >= 0.55) {
      return amount / Math.max(initial, 1e-9) >= 0.8 ? "EXTREME" : "HIGH";
    }
    if (share >= 0.7 && removed > 0 && Math.abs(drop) >= 15) return fromPct === "LOW" ? "HIGH" : fromPct;
    return fromPct;
  }
  function highish2(percentile, amount, window) {
    const share = safeDiv(amount, Math.max(window.added + window.cancelled + window.consumed, 1e-9));
    return percentile >= 75 || share >= 0.5;
  }
  function changeTooltip(changePercent, reason) {
    if (changePercent == null) {
      return reason === "ORDER_BOOK_DATA_RESET" ? "Ask/bid depth change is unknown because the order book was reset, unsynchronized, or empty." : `Depth change is unknown (${(reason ?? "INSUFFICIENT_DATA").replace(/_/g, " ").toLowerCase()}).`;
    }
    const dir = changePercent >= 0 ? "increased" : "decreased";
    return `Displayed liquidity inside the configured price band ${dir} ${Math.abs(changePercent).toFixed(0)}% relative to the previous valid snapshot.`;
  }

  // src/liquidity-response/why.ts
  function buildWhy(input) {
    const facts = [];
    const buyBand = percentileBand(input.buyPct, input.bands);
    facts.push({
      label: "Aggressive Buying",
      value: `${buyBand} \xB7 ${Math.round(input.buyPct)}th percentile`,
      percentile: input.buyPct,
      band: buyBand,
      tooltip: percentileTooltip(input.buyPct),
      detail: `Current aggressive buying is stronger than only ${Math.round(input.buyPct)}% of comparable historical observations.`
    });
    const dir = input.delta.direction === "BALANCED" ? "balanced" : input.delta.direction === "BUY" ? "BUY dominated" : "SELL dominated";
    facts.push({
      label: "Delta",
      value: `${fmtUsd(input.delta.delta)} \xB7 ${dir} \xB7 ${Math.round(input.delta.absoluteDeltaPercentile)}th percentile magnitude`,
      percentile: input.delta.absoluteDeltaPercentile,
      tooltip: percentileTooltip(input.delta.absoluteDeltaPercentile)
    });
    const askChange = input.ask.changePercent == null ? `UNKNOWN${input.ask.changeReason ? ` \xB7 ${input.ask.changeReason.replace(/_/g, " ")}` : ""}` : `${input.ask.changePercent >= 0 ? "+" : ""}${input.ask.changePercent.toFixed(0)}%`;
    facts.push({
      label: "Current Ask Liquidity",
      value: `${fmtUsd(input.ask.current)} \xB7 ${Math.round(input.ask.currentPercentile)}th percentile`,
      percentile: input.ask.currentPercentile,
      tooltip: percentileTooltip(input.ask.currentPercentile)
    });
    facts.push({
      label: "Ask Liquidity Change",
      value: askChange,
      tooltip: changeTooltip(input.ask.changePercent, input.ask.changeReason)
    });
    if (input.ask.removed > 0 && input.ask.changeState !== "UNKNOWN") {
      facts.push({
        label: "Ask Removal",
        value: `${input.ask.changeState.replace(/_/g, " ")} \xB7 consumed ${fmtUsd(input.ask.consumed)} \xB7 cancelled ${fmtUsd(input.ask.cancelled)}`
      });
    }
    const moveBand = percentileBand(input.movePct, input.bands);
    facts.push({
      label: "Price Displacement",
      value: `${moveBand} \xB7 ${Math.round(input.movePct)}th percentile \xB7 ${input.priceMovePercent >= 0 ? "+" : ""}${input.priceMovePercent.toFixed(2)}%`,
      percentile: input.movePct,
      band: moveBand,
      tooltip: percentileTooltip(input.movePct)
    });
    facts.push({
      label: "Interpretation",
      value: mechanicsInterpretation(input.mechanics)
    });
    return facts.slice(0, 7);
  }
  function fmtUsd(n) {
    const sign = n < 0 ? "-" : n > 0 ? "+" : "";
    const a = Math.abs(n);
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
    return `${sign}$${a.toFixed(0)}`;
  }

  // src/liquidity-response/engine.ts
  var LiquidityResponseEngine = class {
    constructor(config) {
      this.config = config;
      this.book = new BookAccountant(config);
      this.minutes = new MinuteRing(config.minuteCapacity);
      this.impact = new ImpactHorizonTracker(config);
      this.norms = new MetricNormalizer(config.normWindows, config.defaultNormWindow);
      this.persistence = new StatePersistenceEngine(config);
    }
    book;
    minutes;
    impact;
    norms;
    persistence;
    lastTradePrice = 0;
    lastTradeSide;
    bookTicks = 0;
    hasBook = false;
    lastAsk = null;
    lastBid = null;
    oiUsd = null;
    prevOiUsd = null;
    lastTradeTs = 0;
    lastBookTs = 0;
    noteOi(oiUsd) {
      if (this.oiUsd != null && this.oiUsd > 0 && oiUsd !== this.oiUsd) this.prevOiUsd = this.oiUsd;
      this.oiUsd = oiUsd;
    }
    oiChangePercent() {
      if (this.oiUsd == null || this.prevOiUsd == null || this.prevOiUsd <= 0) return null;
      return (this.oiUsd - this.prevOiUsd) / this.prevOiUsd * 100;
    }
    onTrade(trade, large = false) {
      const nearAsk = this.lastAsk != null && trade.isAggressiveBuy && trade.price >= this.lastAsk * 0.9995;
      const nearBid = this.lastBid != null && trade.isAggressiveSell && trade.price <= this.lastBid * 1.0005;
      const closed = this.minutes.ingest(trade, { large, nearAsk, nearBid });
      if (closed) this.observeClosed(closed);
      this.impact.onTrade(trade.timestamp, trade.price, trade.quoteValue);
      this.lastTradePrice = trade.price;
      this.lastTradeSide = trade.side;
      this.lastTradeTs = trade.timestamp;
    }
    onBook(timestamp, book, buyDelta, sellDelta) {
      if (book.empty()) return;
      this.hasBook = true;
      this.bookTicks += 1;
      this.lastAsk = book.bestAsk()?.price ?? this.lastAsk;
      this.lastBid = book.bestBid()?.price ?? this.lastBid;
      this.lastBookTs = timestamp;
      this.book.observe(
        timestamp,
        book,
        Math.max(0, buyDelta),
        Math.max(0, sellDelta),
        this.lastTradePrice,
        this.lastTradeSide
      );
      this.impact.onPrice(timestamp, book.mid() || this.lastTradePrice);
      this.norms.observe("askRemaining", this.book.currentAsk, 1);
      this.norms.observe("bidRemaining", this.book.currentBid, 1);
    }
    noteReset(timestamp = Date.now()) {
      this.book.noteReset(timestamp);
      this.hasBook = false;
      this.bookTicks = 0;
    }
    /** Seed closed 1m history so percentiles are asset-relative from the first live bar. */
    seedHistory(bars) {
      for (const bar of bars) this.observeClosed({ ...bar, time: 0 });
    }
    snapshot(flow, other = null) {
      this.minutes.closeStale(flow.now);
      const bookWin = this.book.window(flow.now, Math.min(flow.windowMs, 6e4));
      const atr = this.minutes.atr(this.config.atrPeriod);
      const total = flow.buy + flow.sell;
      const delta = flow.buy - flow.sell;
      const moveAbs = Math.abs(flow.priceEnd - flow.priceStart);
      const movePctRaw = pctChange(flow.priceStart, flow.priceEnd);
      const absEff = safeDiv(moveAbs, total);
      const tf = windowToTf(flow.windowMs);
      const oiPct = flow.oiChangePercent !== void 0 ? flow.oiChangePercent : this.oiChangePercent();
      const shortLiq = flow.shortLiquidationUsd ?? 0;
      const longLiq = flow.longLiquidationUsd ?? 0;
      const cvdDirection = flow.cvdDirection ?? (delta > 0 ? "UP" : delta < 0 ? "DOWN" : "FLAT");
      const oiInterp = interpretOi({
        priceChangePercent: movePctRaw,
        futuresDelta: delta,
        oiChangePercent: oiPct,
        threshold: this.config.oiThresholdPercent
      });
      const structure = detectStructure(this.minutes.closed());
      const buyPct = this.norms.percentile("aggressiveBuy", flow.buy, tf);
      const sellPct = this.norms.percentile("aggressiveSell", flow.sell, tf);
      const deltaPct = this.norms.percentile("deltaAbs", Math.abs(delta), tf);
      const movePct = this.norms.percentile("priceDisplacement", Math.abs(movePctRaw), tf);
      const absEffPct = this.norms.percentile("absEfficiency", absEff, tf);
      const askConsPct = this.norms.percentile("askDepthChange", bookWin.ask.consumed, 1);
      const askReplPct = this.norms.percentile("askDepthChange", bookWin.ask.added, 1);
      const askPullPct = this.norms.percentile("askDepthChange", bookWin.ask.cancelled, 1);
      const bidConsPct = this.norms.percentile("bidDepthChange", bookWin.bid.consumed, 1);
      const bidReplPct = this.norms.percentile("bidDepthChange", bookWin.bid.added, 1);
      const bidPullPct = this.norms.percentile("bidDepthChange", bookWin.bid.cancelled, 1);
      const rolledNearAsk = this.minutes.roll(tf, flow.now);
      const nearAskShare = safeDiv(rolledNearAsk?.nearAsk ?? 0, flow.buy);
      const nearBidShare = safeDiv(rolledNearAsk?.nearBid ?? 0, flow.sell);
      const input = {
        buy: flow.buy,
        sell: flow.sell,
        delta,
        priceStart: flow.priceStart,
        priceEnd: flow.priceEnd,
        priceHigh: flow.priceHigh,
        priceLow: flow.priceLow,
        atr,
        nearAskShare,
        nearBidShare,
        book: bookWin,
        buyPct,
        sellPct,
        deltaPct,
        movePct,
        absEffPct,
        askConsPct,
        askReplPct,
        askPullPct,
        bidConsPct,
        bidReplPct,
        bidPullPct,
        repeatedAsk: this.book.repeatedAskReplenishment(),
        repeatedBid: this.book.repeatedBidReplenishment(),
        hasBook: this.hasBook,
        ticks: this.bookTicks,
        cvdDirection,
        oiChangePercent: oiPct,
        oiInterpretation: oiPct == null ? null : oiInterp,
        swingHigh: structure.swingHigh,
        swingLow: structure.swingLow
      };
      const absorption = detectAbsorption(this.config, input);
      const vacuum = detectVacuum(this.config, input);
      const effort = classifyEffort(this.config, input, absorption);
      const candidate = classifyState2(this.config, input, effort, absorption, vacuum);
      const quality = dataQualityScore({
        flags: flow.flags,
        bookEmpty: flow.bookEmpty ?? !this.hasBook,
        tradeCount: flow.buyCount + flow.sellCount,
        lastTradeAgeMs: flow.lastTradeAgeMs ?? (this.lastTradeTs > 0 ? Math.max(0, flow.now - this.lastTradeTs) : 0),
        lastBookAgeMs: flow.lastBookAgeMs ?? (this.lastBookTs > 0 ? Math.max(0, flow.now - this.lastBookTs) : 0),
        baselineSize: this.norms.sampleSize("aggressiveBuy", tf),
        oiExpected: flow.oiExpected ?? false,
        oiPresent: oiPct != null,
        liquidationExpected: flow.liquidationExpected ?? false,
        liquidationPresent: shortLiq + longLiq > 0,
        exchangeCount: flow.exchangeCount ?? 1
      });
      const impact = this.impact.snapshot(flow.now, flow.priceEnd);
      const flags = new Set([...flow.flags ?? []].map(String));
      const bookEmpty = flow.bookEmpty ?? !this.hasBook;
      const lastBookAgeMs = flow.lastBookAgeMs ?? (this.lastBookTs > 0 ? Math.max(0, flow.now - this.lastBookTs) : 0);
      const lastTradeAgeMs = flow.lastTradeAgeMs ?? (this.lastTradeTs > 0 ? Math.max(0, flow.now - this.lastTradeTs) : 0);
      const askChange = displayedChangePercent({
        initial: bookWin.ask.initial,
        remaining: bookWin.ask.remaining,
        consumed: bookWin.ask.consumed,
        cancelled: bookWin.ask.cancelled,
        added: bookWin.ask.added,
        primed: bookWin.primed,
        hasValidPrevious: bookWin.hasValidPrevious,
        bookEmpty,
        bookSynchronized: !flags.has("staleBook"),
        sequenceContinuous: !flags.has("sequenceGap"),
        websocketHealthy: !flags.has("reconnect") && !flags.has("missingData"),
        recentlyReset: bookWin.resetRecent,
        bandValid: true
      });
      const bidChange = displayedChangePercent({
        initial: bookWin.bid.initial,
        remaining: bookWin.bid.remaining,
        consumed: bookWin.bid.consumed,
        cancelled: bookWin.bid.cancelled,
        added: bookWin.bid.added,
        primed: bookWin.primed,
        hasValidPrevious: bookWin.hasValidPrevious,
        bookEmpty,
        bookSynchronized: !flags.has("staleBook"),
        sequenceContinuous: !flags.has("sequenceGap"),
        websocketHealthy: !flags.has("reconnect") && !flags.has("missingData"),
        recentlyReset: bookWin.resetRecent,
        bandValid: true
      });
      const bookSample = this.norms.sampleSize("askRemaining", 1);
      const askConsumption = intensityForComponent(
        this.config,
        bookWin.ask.consumed,
        bookWin.ask.consumed + bookWin.ask.cancelled,
        bookWin.ask.initial,
        askConsPct,
        bookSample,
        askChange.percent
      );
      const askWithdrawal = intensityForComponent(
        this.config,
        bookWin.ask.cancelled,
        bookWin.ask.consumed + bookWin.ask.cancelled,
        bookWin.ask.initial,
        askPullPct,
        bookSample,
        askChange.percent
      );
      const askReplenishment = intensityForComponent(
        this.config,
        bookWin.ask.added,
        bookWin.ask.added + bookWin.ask.cancelled + bookWin.ask.consumed,
        bookWin.ask.initial,
        askReplPct,
        bookSample,
        askChange.percent
      );
      const bidConsumption = intensityForComponent(
        this.config,
        bookWin.bid.consumed,
        bookWin.bid.consumed + bookWin.bid.cancelled,
        bookWin.bid.initial,
        bidConsPct,
        bookSample,
        bidChange.percent
      );
      const bidWithdrawal = intensityForComponent(
        this.config,
        bookWin.bid.cancelled,
        bookWin.bid.consumed + bookWin.bid.cancelled,
        bookWin.bid.initial,
        bidPullPct,
        bookSample,
        bidChange.percent
      );
      const bidReplenishment = intensityForComponent(
        this.config,
        bookWin.bid.added,
        bookWin.bid.added + bookWin.bid.cancelled + bookWin.bid.consumed,
        bookWin.bid.initial,
        bidReplPct,
        bookSample,
        bidChange.percent
      );
      const consistency = validateConsistency(this.config, {
        flags: flow.flags,
        bookEmpty,
        lastBookAgeMs,
        lastTradeAgeMs,
        ask: { changePercent: askChange.percent, consumption: askConsumption, withdrawal: askWithdrawal },
        bid: { changePercent: bidChange.percent, consumption: bidConsumption, withdrawal: bidWithdrawal },
        snapshotContinuous: !bookWin.resetRecent && !flags.has("reconnect"),
        tradeBookReconciled: tradeBookReconciled(flow.buy, flow.sell, bookWin.ask, bookWin.bid)
      });
      if (!consistency.valid && askChange.percent != null && askChange.percent <= -this.config.unexplainedDropPercent) {
        askChange.percent = null;
        askChange.reason = consistency.reason ?? "UNEXPLAINED_ASK_LIQUIDITY_DROP";
      }
      if (!consistency.valid && bidChange.percent != null && bidChange.percent <= -this.config.unexplainedDropPercent) {
        bidChange.percent = null;
        bidChange.reason = consistency.reason ?? "UNEXPLAINED_ASK_LIQUIDITY_DROP";
      }
      const consistencyLow = consistency.score < this.config.minConsistencyForKnown;
      const askRemainPct = this.norms.percentile("askRemaining", bookWin.ask.remaining, 1);
      const bidRemainPct = this.norms.percentile("bidRemaining", bookWin.bid.remaining, 1);
      const askSideIn = {
        side: "ask",
        window: bookWin.ask,
        currentPercentile: askRemainPct,
        consumePct: askConsPct,
        replenishPct: askReplPct,
        withdrawPct: askPullPct,
        sampleSize: bookSample,
        aggressiveVolume: flow.buy,
        aggressivePct: buyPct,
        priceMovePercent: movePctRaw,
        movePct,
        changePercent: askChange.percent,
        changeReason: askChange.reason,
        consistencyLow
      };
      const bidSideIn = {
        side: "bid",
        window: bookWin.bid,
        currentPercentile: bidRemainPct,
        consumePct: bidConsPct,
        replenishPct: bidReplPct,
        withdrawPct: bidPullPct,
        sampleSize: bookSample,
        aggressiveVolume: flow.sell,
        aggressivePct: sellPct,
        priceMovePercent: movePctRaw,
        movePct,
        changePercent: bidChange.percent,
        changeReason: bidChange.reason,
        consistencyLow
      };
      const askSideState = classifyAskSide(askSideIn);
      const bidSideState = classifyBidSide(bidSideIn);
      const askDepth = toDepthView(this.config, askSideIn, askSideState);
      const bidDepth = toDepthView(this.config, bidSideIn, bidSideState);
      let mechanics = classifyMarketMechanics({
        buyPct,
        sellPct,
        delta,
        movePct,
        priceMovePercent: movePctRaw,
        ask: askDepth,
        bid: bidDepth,
        bands: this.config.percentileBands
      });
      if (consistencyLow) mechanics = "UNKNOWN";
      const bookClear = bookWin.ask.response === "CONSUMPTION" || bookWin.ask.response === "WITHDRAWAL" || bookWin.bid.response === "CONSUMPTION" || bookWin.bid.response === "WITHDRAWAL" || bookWin.ask.response === "REPLENISHMENT" || bookWin.bid.response === "REPLENISHMENT";
      const conf = confidenceScore(this.config, {
        input,
        state: candidate,
        dataQuality: quality,
        persisted: this.persistence.current === candidate && candidate !== "NO_DIRECTIONAL_EDGE",
        fadedImpact: impact.faded,
        cvdAligned: cvdDirection === "UP" && delta > 0 || cvdDirection === "DOWN" && delta < 0,
        bookClear,
        crossAgree: null,
        dataConsistency: consistency.score
      });
      const state = this.persistence.stabilize(
        flow.now,
        this.persistence.escalateDefense(candidate),
        candidateStrength(input, candidate),
        conf.score
      );
      const deltaAnalysis = analyzeDelta(delta, deltaPct);
      const effClass = intensityFromPercentile(100 - Math.min(100, absEffPct));
      const snap = emptyLiquidityResponse();
      snap.aggression = aggressionSide(buyPct, sellPct, delta);
      snap.executed = total;
      snap.delta = delta;
      snap.priceMovePercent = movePctRaw;
      snap.priceMoveAbs = flow.priceEnd - flow.priceStart;
      snap.efficiency = effClass;
      snap.askConsumption = askConsumption;
      snap.askReplenishment = askReplenishment;
      snap.askWithdrawal = askWithdrawal;
      snap.bidConsumption = bidConsumption;
      snap.bidReplenishment = bidReplenishment;
      snap.bidWithdrawal = bidWithdrawal;
      snap.askResponse = consistencyLow ? "QUIET" : bookWin.ask.response;
      snap.bidResponse = consistencyLow ? "QUIET" : bookWin.bid.response;
      snap.state = state;
      snap.confidence = conf.label;
      snap.confidenceScore = conf.score;
      snap.dataQuality = quality;
      snap.dataConsistency = consistency.score;
      snap.consistency = consistency;
      snap.effort = effort;
      snap.absorption = absorption;
      snap.vacuum = vacuum;
      snap.impact = impact;
      snap.bands = this.book.bandAccounting();
      snap.levels = this.book.levels(
        flow.now,
        absorption.kind === "SELL_ABSORPTION" ? "ask" : absorption.kind === "BUY_ABSORPTION" ? "bid" : null
      );
      snap.reversal = detectReversal(this.config, input, absorption);
      snap.structure = structure;
      snap.cvdDirection = cvdDirection;
      snap.oiChangePercent = oiPct;
      snap.oiInterpretation = flow.oiExpected === false ? null : oiPct == null ? null : oiInterp;
      snap.shortLiquidationUsd = shortLiq;
      snap.longLiquidationUsd = longLiq;
      snap.repeatedAskReplenishment = input.repeatedAsk;
      snap.repeatedBidReplenishment = input.repeatedBid;
      snap.deltaAnalysis = deltaAnalysis;
      snap.askDepth = askDepth;
      snap.bidDepth = bidDepth;
      snap.marketMechanics = mechanics;
      snap.entryContext = classifyEntry({
        state,
        absorption,
        structure,
        effort,
        aggression: snap.aggression,
        delta,
        priceMovePercent: movePctRaw,
        efficiency: effClass,
        askReplenishment,
        bidReplenishment,
        cvdDirection,
        reversal: snap.reversal,
        spotDeltaTurnsPositive: delta > 0 && cvdDirection === "UP",
        spotDeltaTurnsNegative: delta < 0 && cvdDirection === "DOWN"
      });
      snap.norms = {
        aggressiveBuy: this.norms.stats("aggressiveBuy", flow.buy, tf),
        aggressiveSell: this.norms.stats("aggressiveSell", flow.sell, tf),
        delta: this.norms.stats("deltaAbs", Math.abs(delta), tf),
        priceDisplacement: this.norms.stats("priceDisplacement", Math.abs(movePctRaw), tf),
        askDepthChange: this.norms.stats("askDepthChange", bookWin.askDepthChange, 1)
      };
      snap.compare = compareLiquidityMarkets(snap, other, this.config.oiThresholdPercent);
      snap.why = buildWhy({
        buy: flow.buy,
        buyPct,
        sell: flow.sell,
        sellPct,
        delta: deltaAnalysis,
        ask: askDepth,
        bid: bidDepth,
        movePct,
        priceMovePercent: movePctRaw,
        mechanics,
        bands: this.config.percentileBands
      });
      snap.byTf = this.buildTfViews(flow.now, bookWin);
      const primary = snap.byTf[tf];
      if (primary && flow.windowMs >= 6e4) {
        snap.aggression = primary.aggression;
        snap.executed = primary.executed;
        snap.delta = primary.delta;
        snap.priceMovePercent = primary.priceMovePercent;
        snap.priceMoveAbs = primary.priceMoveAbs;
        snap.efficiency = primary.efficiency;
        snap.effort = primary.effort;
        snap.absorption = primary.absorption;
      }
      return snap;
    }
    buildTfViews(now, bookWin) {
      const out = {};
      for (const tf of LIQUIDITY_TF_MINUTES) {
        const rolled = this.minutes.roll(tf, now);
        if (!rolled) continue;
        const total = rolled.buy + rolled.sell;
        const delta = rolled.buy - rolled.sell;
        const movePctRaw = pctChange(rolled.open, rolled.close);
        const absEff = safeDiv(Math.abs(rolled.close - rolled.open), total);
        const buyPct = this.norms.percentile("aggressiveBuy", rolled.buy, tf);
        const sellPct = this.norms.percentile("aggressiveSell", rolled.sell, tf);
        const deltaPct = this.norms.percentile("deltaAbs", Math.abs(delta), tf);
        const movePct = this.norms.percentile("priceDisplacement", Math.abs(movePctRaw), tf);
        const absEffPct = this.norms.percentile("absEfficiency", absEff, tf);
        const input = {
          buy: rolled.buy,
          sell: rolled.sell,
          delta,
          priceStart: rolled.open,
          priceEnd: rolled.close,
          priceHigh: rolled.high,
          priceLow: rolled.low,
          atr: rolled.atr,
          nearAskShare: safeDiv(rolled.nearAsk, rolled.buy),
          nearBidShare: safeDiv(rolled.nearBid, rolled.sell),
          book: bookWin,
          buyPct,
          sellPct,
          deltaPct,
          movePct,
          absEffPct,
          askConsPct: this.norms.percentile("askDepthChange", bookWin.ask.consumed, 1),
          askReplPct: this.norms.percentile("askDepthChange", bookWin.ask.added, 1),
          askPullPct: this.norms.percentile("askDepthChange", bookWin.ask.cancelled, 1),
          bidConsPct: this.norms.percentile("bidDepthChange", bookWin.bid.consumed, 1),
          bidReplPct: this.norms.percentile("bidDepthChange", bookWin.bid.added, 1),
          bidPullPct: this.norms.percentile("bidDepthChange", bookWin.bid.cancelled, 1),
          repeatedAsk: this.book.repeatedAskReplenishment(),
          repeatedBid: this.book.repeatedBidReplenishment(),
          hasBook: this.hasBook,
          ticks: this.bookTicks
        };
        const absorption = detectAbsorption(this.config, input);
        const effort = classifyEffort(this.config, input, absorption);
        const effClass = intensityFromPercentile(100 - Math.min(100, absEffPct));
        out[tf] = {
          tfMinutes: tf,
          aggression: aggressionSide(buyPct, sellPct, delta),
          executed: total,
          delta,
          priceMovePercent: movePctRaw,
          priceMoveAbs: rolled.close - rolled.open,
          efficiency: effClass,
          effort,
          absorption,
          metrics: efficiencyMetrics({
            buy: rolled.buy,
            sell: rolled.sell,
            priceStart: rolled.open,
            priceEnd: rolled.close,
            priceHigh: rolled.high,
            priceLow: rolled.low,
            atr: rolled.atr,
            classification: effClass
          })
        };
      }
      return out;
    }
    observeClosed(bar) {
      const tf = 1;
      this.norms.observe("aggressiveBuy", bar.buy, tf);
      this.norms.observe("aggressiveSell", bar.sell, tf);
      this.norms.observe("deltaAbs", Math.abs(bar.buy - bar.sell), tf);
      this.norms.observe("priceDisplacement", Math.abs(pctChange(bar.open, bar.close)), tf);
      const absEff = safeDiv(Math.abs(bar.close - bar.open), bar.buy + bar.sell);
      this.norms.observe("absEfficiency", absEff, tf);
      this.norms.observe("dirEfficiency", safeDiv(bar.close - bar.open, Math.abs(bar.buy - bar.sell)), tf);
    }
  };
  function windowToTf(windowMs) {
    const minutes = Math.max(1, Math.round(windowMs / 6e4));
    const match = LIQUIDITY_TF_MINUTES.reduce(
      (best, tf) => Math.abs(tf - minutes) < Math.abs(best - minutes) ? tf : best
    );
    return match;
  }

  // src/models/passive-liquidity.ts
  var NET_LIQUIDITY_WINDOWS_MS = [1e4, 3e4, 6e4, 3e5, 9e5];

  // src/passive-liquidity/level-scores.ts
  function distanceWeight(distanceBps, k) {
    if (!Number.isFinite(distanceBps) || distanceBps < 0) return 0;
    return Math.exp(-k * distanceBps);
  }
  function replenishmentRatio(replenished, consumed) {
    if (consumed <= 0) return replenished > 0 ? 1 : 0;
    return replenished / consumed;
  }
  function withdrawalShare(input) {
    const total = input.cancelledQuantity + input.consumedQuantity + input.quantity;
    return total <= 0 ? 0 : input.cancelledQuantity / total;
  }
  function persistenceScore(input, config) {
    const matureSec = Math.max(1, config.wallMatureMs / 1e3);
    const ageFactor = clamp(
      Math.log1p(Math.max(0, input.presentMs) / 1e3) / Math.log1p(matureSec),
      0,
      1
    );
    const presenceRatio = input.ageMs > 0 ? clamp(input.presentMs / input.ageMs, 0, 1) : 0;
    const replenish = clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1);
    const survival = input.attackCount > 0 ? clamp(input.defendedCount / input.attackCount, 0, 1) : 0.5;
    const proximity = distanceWeight(input.distanceBps, config.distanceWeightK);
    const pulled = withdrawalShare(input);
    const raw = 0.4 * ageFactor + 0.2 * presenceRatio + 0.15 * replenish + 0.15 * survival + 0.1 * proximity - 0.35 * pulled;
    return clamp(raw, 0, 1) * 100;
  }
  function replenishmentScoreOf(input) {
    const ratio = clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1.5);
    const repeat = clamp(input.replenishmentCount / 4, 0, 1);
    return clamp(0.75 * (ratio / 1.5) + 0.25 * repeat, 0, 1) * 100;
  }
  function withdrawalScoreOf(input, config) {
    const share = withdrawalShare(input);
    const proximity = distanceWeight(input.distanceBps, config.distanceWeightK);
    const shrink = input.maxQuantity > 0 ? clamp(1 - input.quantity / input.maxQuantity, 0, 1) : 0;
    return clamp(0.55 * share + 0.25 * shrink + 0.2 * share * proximity, 0, 1) * 100;
  }
  function absorptionScoreOf(input) {
    if (input.consumedQuantity <= 0) return 0;
    const consumedShare = input.maxQuantity > 0 ? clamp(input.consumedQuantity / input.maxQuantity, 0, 1) : 0;
    const replenish = clamp(replenishmentRatio(input.replenishedQuantity, input.consumedQuantity), 0, 1);
    const stillThere = input.maxQuantity > 0 ? clamp(input.quantity / input.maxQuantity, 0, 1) : 0;
    const repeat = clamp(safeDiv(input.attackCount, 3), 0, 1);
    return clamp(0.35 * consumedShare + 0.35 * replenish + 0.2 * stillThere + 0.1 * repeat, 0, 1) * 100;
  }

  // src/passive-liquidity/bands.ts
  function bandLabel(fromBps, toBps) {
    return `${fromBps}-${toBps}bps`;
  }
  function buildBands(levels2, config) {
    const edges = config.bandEdgesBps;
    const buckets = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const fromBps = edges[i];
      const toBps = edges[i + 1];
      if (fromBps === void 0 || toBps === void 0) continue;
      buckets.push({
        fromBps,
        toBps,
        label: bandLabel(fromBps, toBps),
        bidQuantity: 0,
        bidNotional: 0,
        askQuantity: 0,
        askNotional: 0,
        bidLevels: 0,
        askLevels: 0,
        imbalance: 0
      });
    }
    for (const level2 of levels2) {
      if (level2.outOfView || level2.quantity <= 0) continue;
      const bucket2 = buckets.find(
        (b) => level2.distanceBps >= b.fromBps && level2.distanceBps < b.toBps
      );
      if (!bucket2) continue;
      if (level2.side === "BID") {
        bucket2.bidQuantity += level2.quantity;
        bucket2.bidNotional += level2.notionalValue;
        bucket2.bidLevels += 1;
      } else {
        bucket2.askQuantity += level2.quantity;
        bucket2.askNotional += level2.notionalValue;
        bucket2.askLevels += 1;
      }
    }
    for (const bucket2 of buckets) {
      const total = bucket2.bidNotional + bucket2.askNotional;
      bucket2.imbalance = total > 0 ? (bucket2.bidNotional - bucket2.askNotional) / total : 0;
    }
    return buckets;
  }
  function buildImbalanceCuts(levels2, config) {
    return config.imbalanceCutsBps.map((withinBps) => {
      let bidNotional = 0;
      let askNotional = 0;
      for (const level2 of levels2) {
        if (level2.outOfView || level2.quantity <= 0) continue;
        if (level2.distanceBps > withinBps) continue;
        if (level2.side === "BID") bidNotional += level2.notionalValue;
        else askNotional += level2.notionalValue;
      }
      const total = bidNotional + askNotional;
      return {
        withinBps,
        bidNotional,
        askNotional,
        imbalance: total > 0 ? (bidNotional - askNotional) / total : 0
      };
    });
  }
  function aggregateDepth(levels2, config) {
    const out = {
      bidNotional: 0,
      askNotional: 0,
      bidQuantity: 0,
      askQuantity: 0,
      nearBidNotional: 0,
      nearAskNotional: 0,
      weightedBidNotional: 0,
      weightedAskNotional: 0,
      bidLevels: 0,
      askLevels: 0
    };
    for (const level2 of levels2) {
      if (level2.outOfView || level2.quantity <= 0) continue;
      const weighted = level2.notionalValue * distanceWeight(level2.distanceBps, config.distanceWeightK);
      const near = level2.distanceBps <= config.nearTouchBps;
      if (level2.side === "BID") {
        out.bidNotional += level2.notionalValue;
        out.bidQuantity += level2.quantity;
        out.weightedBidNotional += weighted;
        out.bidLevels += 1;
        if (near) out.nearBidNotional += level2.notionalValue;
      } else {
        out.askNotional += level2.notionalValue;
        out.askQuantity += level2.quantity;
        out.weightedAskNotional += weighted;
        out.askLevels += 1;
        if (near) out.nearAskNotional += level2.notionalValue;
      }
    }
    return out;
  }
  function imbalanceOf(bidNotional, askNotional) {
    return safeDiv(bidNotional - askNotional, bidNotional + askNotional);
  }

  // src/passive-liquidity/absorption.ts
  function emptyAbsorption(type) {
    return {
      type: null,
      absorbingSide: type === "SELLER_ABSORPTION" ? "ASK" : "BID",
      score: 0,
      confidence: 0,
      aggressionPercentile: 50,
      consumptionPercentile: 50,
      replenishmentPercentile: 50,
      displacementPercentile: 50,
      detected: false
    };
  }
  function assessAbsorption(type, input, config, trustworthy) {
    const aggression = clamp(input.aggressionPercentile / 100, 0, 1);
    const consumption = clamp(input.consumptionPercentile / 100, 0, 1);
    const replenishment = clamp(input.replenishmentPercentile / 100, 0, 1);
    const stalled = clamp(1 - input.displacementPercentile / 100, 0, 1);
    const ratio = clamp(input.replenishmentRatio, 0, 1);
    const score = clamp(
      0.28 * aggression + 0.22 * consumption + 0.22 * replenishment + 0.2 * stalled + 0.08 * ratio,
      0,
      1
    ) * 100;
    const gatesMet = input.aggressionPercentile >= config.highPercentile && input.consumptionPercentile >= config.highPercentile && input.replenishmentPercentile >= config.highPercentile && input.displacementPercentile <= config.lowPercentile && input.aggressionNotional > 0 && input.consumedNotional > 0;
    const detected = trustworthy && gatesMet && score >= config.minAbsorptionScore;
    const confidence = clamp(Math.min(aggression, consumption, replenishment, stalled), 0, 1) * 100;
    return {
      type: detected ? type : null,
      absorbingSide: type === "SELLER_ABSORPTION" ? "ASK" : "BID",
      score,
      confidence,
      aggressionPercentile: input.aggressionPercentile,
      consumptionPercentile: input.consumptionPercentile,
      replenishmentPercentile: input.replenishmentPercentile,
      displacementPercentile: input.displacementPercentile,
      detected
    };
  }

  // src/passive-liquidity/data-quality.ts
  function assessDataQuality(input, config) {
    const reasons = [];
    let score = 100;
    const snapshotAgeMs = input.lastBookAt > 0 ? Math.max(0, input.now - input.lastBookAt) : Infinity;
    if (input.bookEmpty) {
      score -= 60;
      reasons.push("no order book");
    }
    if (!Number.isFinite(snapshotAgeMs)) {
      score -= 40;
      reasons.push("no book snapshot received");
    } else if (snapshotAgeMs > config.bookStaleMs) {
      score -= 30;
      reasons.push(`book stale by ${Math.round(snapshotAgeMs)}ms`);
    }
    const tradeStreamContinuous = input.lastTradeAt > 0 && input.now - input.lastTradeAt <= Math.max(3e4, config.bookStaleMs * 10);
    if (!tradeStreamContinuous) {
      score -= 15;
      reasons.push("trade stream quiet or absent");
    }
    if (!input.sequenceContinuous || input.sequenceGaps > 0) {
      score -= 35;
      reasons.push(`sequence gaps: ${input.sequenceGaps}`);
    }
    if (input.reconnects > 0) {
      score -= 20;
      reasons.push(`reconnects: ${input.reconnects}`);
    }
    if (input.crossedBook) {
      score -= 25;
      reasons.push("crossed book");
    }
    if (input.invalidLevels > 0) {
      score -= Math.min(15, input.invalidLevels * 3);
      reasons.push(`invalid levels: ${input.invalidLevels}`);
    }
    if (Math.abs(input.timestampDriftMs) > config.maxTimestampDriftMs) {
      score -= 15;
      reasons.push(`timestamp drift ${Math.round(input.timestampDriftMs)}ms`);
    }
    if (input.observations < 8) {
      score -= 30;
      reasons.push("warming up");
    } else if (input.observations < 32) {
      score -= 10;
      reasons.push("limited history");
    }
    const bounded = clamp(score, 0, 100);
    return {
      score: bounded,
      trustworthy: bounded >= config.minTrustedQuality,
      snapshotAgeMs: Number.isFinite(snapshotAgeMs) ? snapshotAgeMs : -1,
      sequenceContinuous: input.sequenceContinuous && input.sequenceGaps === 0,
      bookStreamContinuous: Number.isFinite(snapshotAgeMs) && snapshotAgeMs <= config.bookStaleMs,
      tradeStreamContinuous,
      reconnects: input.reconnects,
      sequenceGaps: input.sequenceGaps,
      crossedBook: input.crossedBook,
      invalidLevels: input.invalidLevels,
      timestampDriftMs: input.timestampDriftMs,
      visibleDepthBps: input.visibleDepthBps,
      observations: input.observations,
      reasons
    };
  }

  // src/passive-liquidity/normalize.ts
  var MIN_SAMPLES = 8;
  var PassiveMetricNormalizer = class {
    constructor(sampleSize) {
      this.sampleSize = sampleSize;
    }
    series = /* @__PURE__ */ new Map();
    observe(key3, value) {
      if (!Number.isFinite(value)) return;
      this.dist(key3).add(value);
    }
    percentile(key3, value) {
      const dist = this.dist(key3);
      if (dist.size < MIN_SAMPLES || !Number.isFinite(value)) return 50;
      return dist.midRank(value);
    }
    samples(key3) {
      return this.dist(key3).size;
    }
    measure(key3, value, context) {
      const dist = this.dist(key3);
      const warm = dist.size >= MIN_SAMPLES;
      return {
        raw: value,
        percentile: warm ? dist.midRank(value) : 50,
        zScore: warm ? dist.zScore(value, 1e-9) : 0,
        vsNearbyDepth: safeDiv(value, context.nearbyDepth),
        vsRecentExecutedVolume: safeDiv(value, context.recentExecutedVolume),
        vsDailyVolume: safeDiv(value, context.dailyVolume),
        samples: dist.size
      };
    }
    dist(key3) {
      let d = this.series.get(key3);
      if (!d) {
        d = new RollingDistribution(this.sampleSize);
        this.series.set(key3, d);
      }
      return d;
    }
  };
  function emptyMeasure(raw = 0) {
    return {
      raw,
      percentile: 50,
      zScore: 0,
      vsNearbyDepth: 0,
      vsRecentExecutedVolume: 0,
      vsDailyVolume: 0,
      samples: 0
    };
  }

  // src/passive-liquidity/vacuum.ts
  function emptyVacuum(direction) {
    return {
      direction,
      score: 0,
      detected: false,
      nearDepthPercentile: 50,
      withdrawalPercentile: 50,
      replenishmentPercentile: 50,
      distanceToNextWallBps: Number.POSITIVE_INFINITY,
      priceEfficiencyPercentile: 50,
      spreadExpansionBps: 0
    };
  }
  function assessVacuum(direction, input, config, trustworthy) {
    const thin = clamp(1 - input.nearDepthPercentile / 100, 0, 1);
    const withdrawing = clamp(input.withdrawalPercentile / 100, 0, 1);
    const notReplenishing = clamp(1 - input.replenishmentPercentile / 100, 0, 1);
    const efficient = clamp(input.priceEfficiencyPercentile / 100, 0, 1);
    const runway = Number.isFinite(input.distanceToNextWallBps) ? clamp(input.distanceToNextWallBps / config.maxTrackedBps, 0, 1) : 1;
    const spread = clamp(input.spreadExpansionBps / 5, 0, 1);
    const score = clamp(
      0.28 * thin + 0.22 * withdrawing + 0.18 * notReplenishing + 0.14 * runway + 0.13 * efficient + 0.05 * spread,
      0,
      1
    ) * 100;
    const gatesMet = input.nearDepthPercentile <= config.lowPercentile && input.replenishmentPercentile <= config.highPercentile && (input.withdrawalPercentile >= config.highPercentile || input.priceEfficiencyPercentile >= config.highPercentile);
    return {
      direction,
      score,
      detected: trustworthy && gatesMet && score >= config.minVacuumScore,
      nearDepthPercentile: input.nearDepthPercentile,
      withdrawalPercentile: input.withdrawalPercentile,
      replenishmentPercentile: input.replenishmentPercentile,
      distanceToNextWallBps: input.distanceToNextWallBps,
      priceEfficiencyPercentile: input.priceEfficiencyPercentile,
      spreadExpansionBps: input.spreadExpansionBps
    };
  }

  // src/passive-liquidity/net-liquidity.ts
  var EPSILON2 = 1e-9;
  var SMALL_BASE = 1;
  var MIN_NORMALIZATION_SAMPLES = 8;
  function calculateNetLiquiditySide(input) {
    const newAddedQuantity = Math.max(0, input.added.quantity - input.replenished.quantity);
    const newAdded = Math.max(0, input.added.notional - input.replenished.notional);
    const totalAddedQuantity = newAddedQuantity + input.replenished.quantity;
    const totalAdded = newAdded + input.replenished.notional;
    const behavioralNetQuantity = totalAddedQuantity - input.cancelled.quantity - input.consumed.quantity;
    const behavioralNetChange = totalAdded - input.cancelled.notional - input.consumed.notional;
    const bookNetQuantity = input.current.quantity - input.starting.quantity;
    const bookNetChange = input.current.notional - input.starting.notional;
    const expected = input.starting.notional + behavioralNetChange;
    const reconciliationError = input.current.notional - expected;
    const reconciliationErrorPercent = Math.abs(reconciliationError) / Math.max(Math.abs(input.current.notional), Math.abs(expected), EPSILON2);
    const classificationNetChange = input.classificationNetChange ?? bookNetChange;
    const percentageReliable = input.starting.notional >= SMALL_BASE;
    const netChangePercent = percentageReliable ? classificationNetChange / input.starting.notional * 100 : null;
    const removed = input.cancelled.notional + input.consumed.notional;
    const additions = newAdded + input.replenished.notional;
    const cancellationShare = removed > 0 ? input.cancelled.notional / removed : 0;
    const consumptionShare = removed > 0 ? input.consumed.notional / removed : 0;
    const withdrawalPressure = input.cancelled.notional / Math.max(input.cancelled.notional + additions, EPSILON2);
    const tolerance = input.reconciliationTolerance ?? 0.05;
    const dataConsistency = reconciliationErrorPercent <= tolerance ? "HIGH" : "LOW";
    const primaryCause = causeOf(
      behavioralNetChange,
      newAdded,
      input.replenished.notional,
      input.cancelled.notional,
      input.consumed.notional
    );
    const state = classifyNetLiquidity(
      classificationNetChange,
      netChangePercent,
      input.percentile ?? 50,
      input.trustworthy && dataConsistency === "HIGH"
    );
    return {
      side: input.side,
      startingQuantity: input.starting.quantity,
      currentQuantity: input.current.quantity,
      newAddedQuantity,
      replenishedQuantity: input.replenished.quantity,
      cancelledQuantity: input.cancelled.quantity,
      consumedQuantity: input.consumed.quantity,
      bookNetQuantity,
      behavioralNetQuantity,
      startingDepth: input.starting.notional,
      currentDepth: input.current.notional,
      newAdded,
      replenished: input.replenished.notional,
      totalAdded,
      cancelled: input.cancelled.notional,
      consumed: input.consumed.notional,
      bookNetChange,
      behavioralNetChange,
      netChangePercent,
      percentageReliable,
      velocityPerSec: behavioralNetChange / Math.max(1e-3, input.elapsedMs / 1e3),
      velocityPercentile: input.velocityPercentile ?? 50,
      velocityZScore: input.velocityZScore ?? 0,
      percentile: input.percentile ?? 50,
      zScore: input.zScore ?? 0,
      withdrawalPressure,
      cancellationShare,
      consumptionShare,
      reconciliationError,
      reconciliationErrorPercent,
      dataConsistency,
      state,
      primaryCause
    };
  }
  function causeOf(net, newAdded, replenished, cancelled, consumed) {
    if (Math.abs(net) <= EPSILON2) return "NONE";
    if (net > 0) {
      const total = newAdded + replenished;
      if (total <= 0) return "MIXED";
      if (replenished / total >= 0.6) return "REPLENISHMENT";
      if (newAdded / total >= 0.6) return "NEW_LIQUIDITY";
      return "MIXED";
    }
    const removed = cancelled + consumed;
    if (removed <= 0) return "MIXED";
    if (cancelled / removed >= 0.6) return "WITHDRAWAL";
    if (consumed / removed >= 0.6) return "CONSUMPTION";
    return "MIXED";
  }
  function classifyNetLiquidity(net, percent, percentile, trustworthy) {
    if (!trustworthy || percent == null) return "LOW_CONFIDENCE";
    const magnitude = Math.abs(percent);
    if (magnitude <= 5) return "STABLE";
    if (net > 0) return magnitude >= 30 || percentile >= 90 ? "STRONGLY_GROWING" : "GROWING";
    return magnitude >= 30 || percentile <= 10 ? "STRONGLY_SHRINKING" : "SHRINKING";
  }
  var NetLiquidityTracker = class {
    constructor(sampleSize, bandEdgesBps, reconciliationTolerance = 0.05) {
      this.bandEdgesBps = bandEdgesBps;
      this.reconciliationTolerance = reconciliationTolerance;
      const capacity = Math.max(32, sampleSize);
      this.distributions = {
        BID: { net: new RollingDistribution(capacity), velocity: new RollingDistribution(capacity) },
        ASK: { net: new RollingDistribution(capacity), velocity: new RollingDistribution(capacity) }
      };
      this.imbalance = new RollingDistribution(capacity);
    }
    /** One depth point per second retains an hour without storing every 100ms book snapshot. */
    points = new RingBuffer(3601);
    distributions;
    imbalance;
    pendingPoint = null;
    lastStoredAt = 0;
    observe(at, mid, levels2, flow) {
      const depth = { BID: this.emptyAmounts(), ASK: this.emptyAmounts() };
      const flows = { BID: this.emptyFlows(), ASK: this.emptyFlows() };
      for (const level2 of levels2) {
        if (level2.outOfView || level2.quantity <= 0) continue;
        const index = this.bandIndex(level2.distanceBps);
        if (index < 0) continue;
        depth[level2.side][index].quantity += level2.quantity;
        depth[level2.side][index].notional += level2.notionalValue;
      }
      for (const level2 of flow.levels) {
        const index = this.bandIndex(level2.distanceBps);
        if (index < 0) continue;
        addFlow(flows[level2.side][index], level2);
      }
      const point = { at, mid, depth, flow: flows };
      if (this.points.length === 0) {
        point.flow = { BID: this.emptyFlows(), ASK: this.emptyFlows() };
        this.points.push(point);
        this.lastStoredAt = at;
        return;
      }
      if (!this.pendingPoint) {
        this.pendingPoint = point;
      } else {
        this.pendingPoint.at = at;
        this.pendingPoint.mid = mid;
        this.pendingPoint.depth = depth;
        for (const side2 of ["BID", "ASK"]) {
          for (let i = 0; i < flows[side2].length; i++) {
            addFlow(this.pendingPoint.flow[side2][i], flows[side2][i]);
          }
        }
      }
      if (at - this.lastStoredAt >= 1e3) {
        this.points.push(this.pendingPoint);
        this.lastStoredAt = at;
        this.pendingPoint = null;
      }
    }
    sample(now, windowMs) {
      const raw = this.build(now, windowMs, true, false);
      this.distributions.BID.net.add(raw.bid.bookNetChange);
      this.distributions.ASK.net.add(raw.ask.bookNetChange);
      this.distributions.BID.velocity.add(raw.bid.velocityPerSec);
      this.distributions.ASK.velocity.add(raw.ask.velocityPerSec);
      this.imbalance.add(raw.liquidityChangeImbalance);
    }
    snapshot(now, windowMs, trustworthy) {
      return this.build(now, windowMs, trustworthy, true);
    }
    reset() {
      this.points.clear();
      this.pendingPoint = null;
      this.lastStoredAt = 0;
    }
    emptyAmounts() {
      return Array.from({ length: Math.max(0, this.bandEdgesBps.length - 1) }, () => ({ quantity: 0, notional: 0 }));
    }
    emptyFlows() {
      return Array.from({ length: Math.max(0, this.bandEdgesBps.length - 1) }, zeroFlow);
    }
    bandIndex(distanceBps) {
      for (let i = 0; i < this.bandEdgesBps.length - 1; i++) {
        const lo = this.bandEdgesBps[i];
        const hi = this.bandEdgesBps[i + 1];
        if (lo != null && hi != null && distanceBps >= lo && distanceBps < hi) return i;
      }
      return -1;
    }
    build(now, windowMs, trustworthy, normalized) {
      const points = this.points.toArray();
      if (this.pendingPoint && this.pendingPoint.at <= now) points.push(this.pendingPoint);
      const eligible = points.filter((point) => point.at <= now);
      const empty = emptyPoint(now);
      const current = eligible[eligible.length - 1] ?? empty;
      const from = now - windowMs;
      const starting = [...eligible].reverse().find((point) => point.at <= from) ?? eligible[0] ?? empty;
      const active = eligible.filter((point) => point.at > starting.at && point.at <= now);
      const elapsedMs = Math.max(1, current.at - starting.at);
      const availableMs = Math.min(windowMs, elapsedMs);
      const coverageComplete = eligible.length > 0 && starting.at <= from;
      const total = (side2) => this.sideFor(
        side2,
        starting,
        current,
        active,
        elapsedMs,
        trustworthy,
        normalized
      );
      const within = (side2, bps2) => this.sideFor(
        side2,
        starting,
        current,
        active,
        elapsedMs,
        trustworthy,
        normalized,
        0,
        bps2,
        true
      );
      const bid = total("BID");
      const ask = total("ASK");
      const near5Bps = { bid: within("BID", 5), ask: within("ASK", 5) };
      const near10Bps = { bid: within("BID", 10), ask: within("ASK", 10) };
      const bands = [];
      for (let i = 0; i < this.bandEdgesBps.length - 1; i++) {
        const lo = this.bandEdgesBps[i];
        const hi = this.bandEdgesBps[i + 1];
        if (lo == null || hi == null) continue;
        const bandBid = this.sideFor("BID", starting, current, active, elapsedMs, trustworthy, normalized, lo, hi, true);
        const bandAsk = this.sideFor("ASK", starting, current, active, elapsedMs, trustworthy, normalized, lo, hi, true);
        bands.push({
          fromBps: lo,
          toBps: hi,
          label: `${lo}-${hi}bps`,
          bid: bandBid,
          ask: bandAsk,
          rangeMigration: {
            bid: bandBid.bookNetChange - bandBid.behavioralNetChange,
            ask: bandAsk.bookNetChange - bandAsk.behavioralNetChange
          }
        });
      }
      const liquidityChangeImbalance = bid.bookNetChange - ask.bookNetChange;
      const imbalanceWarm = normalized && this.imbalance.size >= MIN_NORMALIZATION_SAMPLES;
      const imbalancePercentile = imbalanceWarm ? this.imbalance.midRank(liquidityChangeImbalance) : 50;
      const imbalanceZScore = imbalanceWarm ? this.imbalance.zScore(liquidityChangeImbalance, EPSILON2) : 0;
      const flags = [];
      if (bid.dataConsistency === "LOW" || ask.dataConsistency === "LOW") flags.push("LIQUIDITY_ACCOUNTING_MISMATCH");
      if (!bid.percentageReliable || !ask.percentageReliable) flags.push("SMALL_BASE_UNRELIABLE_PERCENTAGE");
      return {
        windowMs,
        availableMs,
        coverageComplete,
        bid,
        ask,
        near5Bps,
        near10Bps,
        bands,
        liquidityChangeImbalance,
        liquidityChangeImbalancePercentile: imbalancePercentile,
        liquidityChangeImbalanceZScore: imbalanceZScore,
        interpretation: interpretationOf(bid, ask, near10Bps.bid, near10Bps.ask),
        flags
      };
    }
    sideFor(side2, starting, current, active, elapsedMs, trustworthy, normalized, fromBps = 0, toBps = Number.POSITIVE_INFINITY, allowRangeMigration = false) {
      const start = this.depthAt(starting, side2, fromBps, toBps);
      const end = this.depthAt(current, side2, fromBps, toBps);
      const flow = this.sumFlows(active, side2, fromBps, toBps);
      const rawNet = end.notional - start.notional;
      const velocity = (flow.addedNotional - flow.cancelledNotional - flow.consumedNotional) / Math.max(1e-3, elapsedMs / 1e3);
      const dist = this.distributions[side2];
      const warm = normalized && dist.net.size >= MIN_NORMALIZATION_SAMPLES;
      const velocityWarm = normalized && dist.velocity.size >= MIN_NORMALIZATION_SAMPLES;
      return calculateNetLiquiditySide({
        side: side2,
        elapsedMs,
        starting: start,
        current: end,
        added: { quantity: flow.addedQuantity, notional: flow.addedNotional },
        replenished: { quantity: flow.replenishedQuantity, notional: flow.replenishedNotional },
        cancelled: { quantity: flow.cancelledQuantity, notional: flow.cancelledNotional },
        consumed: { quantity: flow.consumedQuantity, notional: flow.consumedNotional },
        trustworthy,
        reconciliationTolerance: allowRangeMigration ? Number.POSITIVE_INFINITY : this.reconciliationTolerance,
        percentile: warm ? dist.net.midRank(rawNet) : 50,
        zScore: warm ? dist.net.zScore(rawNet, EPSILON2) : 0,
        velocityPercentile: velocityWarm ? dist.velocity.midRank(velocity) : 50,
        velocityZScore: velocityWarm ? dist.velocity.zScore(velocity, EPSILON2) : 0,
        classificationNetChange: allowRangeMigration ? flow.addedNotional - flow.cancelledNotional - flow.consumedNotional : void 0
      });
    }
    depthAt(point, side2, from, to) {
      const out = { quantity: 0, notional: 0 };
      for (let i = 0; i < point.depth[side2].length; i++) {
        const lo = this.bandEdgesBps[i];
        const hi = this.bandEdgesBps[i + 1];
        if (lo == null || hi == null || lo < from || hi > to) continue;
        out.quantity += point.depth[side2][i].quantity;
        out.notional += point.depth[side2][i].notional;
      }
      return out;
    }
    sumFlows(points, side2, from, to) {
      const out = zeroFlow();
      for (const point of points) {
        for (let i = 0; i < point.flow[side2].length; i++) {
          const lo = this.bandEdgesBps[i];
          const hi = this.bandEdgesBps[i + 1];
          if (lo == null || hi == null || lo < from || hi > to) continue;
          addFlow(out, point.flow[side2][i]);
        }
      }
      return out;
    }
  };
  function emptyNetLiquiditySnapshot(windowMs = 0) {
    const side2 = (value) => calculateNetLiquiditySide({
      side: value,
      elapsedMs: Math.max(1, windowMs),
      starting: { quantity: 0, notional: 0 },
      current: { quantity: 0, notional: 0 },
      added: { quantity: 0, notional: 0 },
      replenished: { quantity: 0, notional: 0 },
      cancelled: { quantity: 0, notional: 0 },
      consumed: { quantity: 0, notional: 0 },
      trustworthy: false
    });
    return {
      windowMs,
      availableMs: 0,
      coverageComplete: false,
      bid: side2("BID"),
      ask: side2("ASK"),
      near5Bps: { bid: side2("BID"), ask: side2("ASK") },
      near10Bps: { bid: side2("BID"), ask: side2("ASK") },
      bands: [],
      liquidityChangeImbalance: 0,
      liquidityChangeImbalancePercentile: 50,
      liquidityChangeImbalanceZScore: 0,
      interpretation: "No order book data.",
      flags: ["SMALL_BASE_UNRELIABLE_PERCENTAGE"]
    };
  }
  function emptyPoint(at) {
    return {
      at,
      mid: 0,
      depth: { BID: [], ASK: [] },
      flow: { BID: [], ASK: [] }
    };
  }
  function zeroFlow() {
    return {
      addedQuantity: 0,
      addedNotional: 0,
      consumedQuantity: 0,
      consumedNotional: 0,
      cancelledQuantity: 0,
      cancelledNotional: 0,
      replenishedQuantity: 0,
      replenishedNotional: 0
    };
  }
  function addFlow(target, source) {
    target.addedQuantity += source.addedQuantity;
    target.addedNotional += source.addedNotional;
    target.consumedQuantity += source.consumedQuantity;
    target.consumedNotional += source.consumedNotional;
    target.cancelledQuantity += source.cancelledQuantity;
    target.cancelledNotional += source.cancelledNotional;
    target.replenishedQuantity += source.replenishedQuantity;
    target.replenishedNotional += source.replenishedNotional;
  }
  function interpretationOf(bid, ask, nearBid, nearAsk) {
    if (bid.state === "LOW_CONFIDENCE" || ask.state === "LOW_CONFIDENCE") {
      return "Net liquidity is low confidence because the accounting or market-data sequence is incomplete.";
    }
    if (nearBid.behavioralNetChange > 0 && nearAsk.behavioralNetChange < 0) {
      return "Near bids are building while near asks are withdrawing; upward movement may become easier if aggressive buyers confirm.";
    }
    if (nearBid.behavioralNetChange < 0 && nearAsk.behavioralNetChange > 0) {
      return "Near bids are withdrawing while near asks are building; downward movement may become easier if aggressive sellers confirm.";
    }
    return `Bid liquidity is ${bid.state.toLowerCase().replace(/_/g, " ")}; ask liquidity is ${ask.state.toLowerCase().replace(/_/g, " ")}.`;
  }

  // src/passive-liquidity/empty.ts
  function emptyNetByWindow() {
    const out = {};
    for (const ms of NET_LIQUIDITY_WINDOWS_MS) {
      out[String(ms)] = emptyNetLiquiditySnapshot(ms);
    }
    return out;
  }
  function emptySide(side2) {
    return {
      side: side2,
      depthNotional: 0,
      depthQuantity: 0,
      nearDepthNotional: 0,
      weightedDepthNotional: 0,
      addedNotional: 0,
      consumedNotional: 0,
      cancelledNotional: 0,
      replenishedNotional: 0,
      replenishmentRatio: 0,
      persistenceScore: 0,
      withdrawalScore: 0,
      levelCount: 0,
      velocity: {
        addedQuantityPerSec: 0,
        addedNotionalPerSec: 0,
        cancelledQuantityPerSec: 0,
        cancelledNotionalPerSec: 0,
        consumedQuantityPerSec: 0,
        consumedNotionalPerSec: 0,
        replenishedQuantityPerSec: 0,
        replenishedNotionalPerSec: 0
      },
      consumedPercentile: 50,
      cancelledPercentile: 50,
      replenishedPercentile: 50,
      nearDepthPercentile: 50
    };
  }
  function emptyPassiveLiquidityContext() {
    return {
      askDepth: 0,
      bidDepth: 0,
      nearAskDepth: 0,
      nearBidDepth: 0,
      weightedAskDepth: 0,
      weightedBidDepth: 0,
      askConsumption: 0,
      bidConsumption: 0,
      askReplenishment: 0,
      bidReplenishment: 0,
      askWithdrawal: 0,
      bidWithdrawal: 0,
      askPersistence: 0,
      bidPersistence: 0,
      passiveSellerStrength: 0,
      passiveBuyerStrength: 0,
      upsideVacuumScore: 0,
      downsideVacuumScore: 0,
      sellerAbsorptionScore: 0,
      buyerAbsorptionScore: 0,
      bookImbalance: 0,
      nearBookImbalance: 0,
      askNetLiquidityChange: 0,
      bidNetLiquidityChange: 0,
      nearAskNetLiquidityChange: 0,
      nearBidNetLiquidityChange: 0,
      askNetLiquidityVelocity: 0,
      bidNetLiquidityVelocity: 0,
      askWithdrawalPressure: 0,
      bidWithdrawalPressure: 0,
      askCancellationShare: 0,
      bidCancellationShare: 0,
      askConsumptionShare: 0,
      bidConsumptionShare: 0,
      liquidityChangeImbalance: 0,
      dataQuality: 0
    };
  }
  function emptyPassiveLiquidityFeatures() {
    return {
      bidDepth: 0,
      askDepth: 0,
      nearBidDepth: 0,
      nearAskDepth: 0,
      weightedBidDepth: 0,
      weightedAskDepth: 0,
      bookImbalance: 0,
      nearBookImbalance: 0,
      askNetLiquidityChange: 0,
      bidNetLiquidityChange: 0,
      nearAskNetLiquidityChange: 0,
      nearBidNetLiquidityChange: 0,
      askNetLiquidityVelocity: 0,
      bidNetLiquidityVelocity: 0,
      askWithdrawalPressure: 0,
      bidWithdrawalPressure: 0,
      askCancellationShare: 0,
      bidCancellationShare: 0,
      askConsumptionShare: 0,
      bidConsumptionShare: 0,
      liquidityChangeImbalance: 0,
      bidConsumption: 0,
      askConsumption: 0,
      bidReplenishment: 0,
      askReplenishment: 0,
      bidWithdrawal: 0,
      askWithdrawal: 0,
      bidReplenishmentRatio: 0,
      askReplenishmentRatio: 0,
      bidPersistence: 0,
      askPersistence: 0,
      passiveBuyerStrength: 0,
      passiveSellerStrength: 0,
      buyerAbsorptionScore: 0,
      sellerAbsorptionScore: 0,
      upsideVacuumScore: 0,
      downsideVacuumScore: 0,
      bidWithdrawalPercentile: 50,
      askWithdrawalPercentile: 50,
      bidReplenishmentPercentile: 50,
      askReplenishmentPercentile: 50,
      aggressiveBuyPercentile: 50,
      aggressiveSellPercentile: 50,
      downsideEfficiencyPercentile: 50,
      upsideEfficiencyPercentile: 50,
      defendedBidTests: 0,
      defendedAskTests: 0,
      dataQuality: 0
    };
  }
  function emptyPassiveLiquiditySnapshot(symbol, timestamp = 0) {
    return {
      symbol,
      timestamp,
      mid: 0,
      bestBid: 0,
      bestAsk: 0,
      spreadBps: 0,
      bid: emptySide("BID"),
      ask: emptySide("ASK"),
      bands: [],
      imbalanceCuts: [],
      netLiquidity: emptyNetLiquiditySnapshot(),
      netByWindow: emptyNetByWindow(),
      profile: [],
      walls: [],
      nearestBidWall: null,
      nearestAskWall: null,
      passiveBuyerStrength: 0,
      passiveSellerStrength: 0,
      sellerAbsorption: emptyAbsorption("SELLER_ABSORPTION"),
      buyerAbsorption: emptyAbsorption("BUYER_ABSORPTION"),
      upsideVacuum: emptyVacuum("UP"),
      downsideVacuum: emptyVacuum("DOWN"),
      zones: [],
      potentialFloor: null,
      potentialCeiling: null,
      aggressionVsLiquidity: {
        aggressiveSide: "BALANCED",
        aggression: emptyMeasure(),
        consumption: emptyMeasure(),
        replenishment: emptyMeasure(),
        withdrawal: emptyMeasure(),
        displacementBps: emptyMeasure(),
        interpretation: "no order book data"
      },
      effortVsResult: { effortScore: 0, resultScore: 0, passiveDefenseScore: 0, labels: [] },
      state: "NO_DIRECTIONAL_EDGE",
      stateConfidence: 0,
      why: [],
      events: [],
      dataQuality: {
        score: 0,
        trustworthy: false,
        snapshotAgeMs: -1,
        sequenceContinuous: false,
        bookStreamContinuous: false,
        tradeStreamContinuous: false,
        reconnects: 0,
        sequenceGaps: 0,
        crossedBook: false,
        invalidLevels: 0,
        timestampDriftMs: 0,
        visibleDepthBps: 0,
        observations: 0,
        reasons: ["no order book data"]
      },
      context: emptyPassiveLiquidityContext(),
      features: emptyPassiveLiquidityFeatures()
    };
  }

  // src/passive-liquidity/level-memory.ts
  function newBaseline(firstSeenAt) {
    return { firstSeenAt, consumed: 0, replenished: 0, cancelled: 0, attacks: 0, defended: 0 };
  }
  var PriceLevelMemoryStore = class {
    constructor(config) {
      this.config = config;
    }
    entries = /* @__PURE__ */ new Map();
    onTrade(trade) {
      if (trade.quoteValue <= 0) return;
      const side2 = trade.isAggressiveBuy ? "ASK" : "BID";
      const price = priceToTick(trade.price, tickSize(trade.price));
      const entry = this.entry(side2, price, trade.timestamp);
      entry.totalAggressionAbsorbed += trade.quoteValue;
    }
    fold(levels2, now, mid) {
      if (mid <= 0) return;
      for (const level2 of levels2) {
        if (level2.outOfView) continue;
        const entry = this.entry(level2.side, level2.price, level2.firstSeenAt);
        if (entry.baseline.firstSeenAt !== level2.firstSeenAt) {
          entry.baseline = newBaseline(level2.firstSeenAt);
        }
        const base = entry.baseline;
        entry.totalConsumed += Math.max(0, level2.consumedNotional - base.consumed);
        entry.totalReplenished += Math.max(0, level2.replenishedNotional - base.replenished);
        entry.totalCancelled += Math.max(0, level2.cancelledNotional - base.cancelled);
        const newAttacks = Math.max(0, level2.attackCount - base.attacks);
        const newDefended = Math.max(0, level2.defendedCount - base.defended);
        base.consumed = level2.consumedNotional;
        base.replenished = level2.replenishedNotional;
        base.cancelled = level2.cancelledNotional;
        base.attacks = level2.attackCount;
        base.defended = level2.defendedCount;
        if (newAttacks > 0) {
          entry.attacks += newAttacks;
          entry.lastTestAt = now;
          entry.activeTest = { startMid: mid, extreme: mid };
        }
        if (entry.activeTest) {
          entry.activeTest.extreme = level2.side === "BID" ? Math.min(entry.activeTest.extreme, mid) : Math.max(entry.activeTest.extreme, mid);
        }
        if (newDefended > 0) {
          entry.defendedTests += newDefended;
          this.closeTest(entry);
        }
        const buffer = this.config.zoneBps / 1e4;
        const through = level2.side === "BID" ? mid < level2.price * (1 - buffer) : mid > level2.price * (1 + buffer);
        if (through && entry.attacks > 0) {
          if (!entry.extendedThrough) entry.brokenTests += 1;
          entry.extendedThrough = true;
          this.closeTest(entry);
        } else if (!through) {
          entry.extendedThrough = false;
        }
      }
      this.trim();
    }
    get(side2, price, mid) {
      const key3 = `${side2}:${priceToTick(price, tickSize(mid || price))}`;
      const entry = this.entries.get(key3);
      return entry ? this.toPublic(entry) : null;
    }
    all() {
      return [...this.entries.values()].filter((e) => e.attacks > 0 || e.totalConsumed > 0).map((e) => this.toPublic(e)).sort((a, b) => b.defenseScore - a.defenseScore);
    }
    reset() {
      this.entries.clear();
    }
    closeTest(entry) {
      const test = entry.activeTest;
      if (!test || test.startMid <= 0) {
        entry.activeTest = null;
        return;
      }
      const moved = entry.side === "BID" ? test.startMid - test.extreme : test.extreme - test.startMid;
      entry.displacementSamples.push(Math.max(0, moved) / test.startMid * 1e4);
      if (entry.displacementSamples.length > 32) entry.displacementSamples.shift();
      entry.activeTest = null;
    }
    entry(side2, price, now) {
      const key3 = `${side2}:${price}`;
      let entry = this.entries.get(key3);
      if (!entry) {
        entry = {
          price,
          side: side2,
          firstSeenAt: now,
          lastTestAt: now,
          attacks: 0,
          defendedTests: 0,
          brokenTests: 0,
          totalAggressionAbsorbed: 0,
          totalConsumed: 0,
          totalReplenished: 0,
          totalCancelled: 0,
          extendedThrough: false,
          displacementSamples: [],
          activeTest: null,
          baseline: newBaseline(now)
        };
        this.entries.set(key3, entry);
      }
      return entry;
    }
    trim() {
      if (this.entries.size <= this.config.memoryCapacity) return;
      const ordered = [...this.entries.entries()].sort((a, b) => a[1].lastTestAt - b[1].lastTestAt);
      for (const [key3] of ordered.slice(0, this.entries.size - this.config.memoryCapacity)) {
        this.entries.delete(key3);
      }
    }
    toPublic(entry) {
      return {
        price: entry.price,
        side: entry.side,
        attacks: entry.attacks,
        defendedTests: entry.defendedTests,
        brokenTests: entry.brokenTests,
        totalAggressionAbsorbed: entry.totalAggressionAbsorbed,
        totalConsumed: entry.totalConsumed,
        totalReplenished: entry.totalReplenished,
        totalCancelled: entry.totalCancelled,
        lastTestAt: entry.lastTestAt,
        firstSeenAt: entry.firstSeenAt,
        defenseScore: defenseScoreOf(entry),
        extendedThrough: entry.extendedThrough
      };
    }
  };
  function meanDisplacementBps(samples) {
    if (!samples.length) return 0;
    let sum = 0;
    for (const s of samples) sum += s;
    return sum / samples.length;
  }
  function defenseScoreOf(entry) {
    if (entry.attacks <= 0) return 0;
    const held = clamp(safeDiv(entry.defendedTests, entry.attacks), 0, 1);
    const replenish = clamp(replenishmentRatio(entry.totalReplenished, entry.totalConsumed), 0, 1);
    const tested = clamp(entry.attacks / 4, 0, 1);
    const pulled = clamp(
      safeDiv(entry.totalCancelled, entry.totalCancelled + entry.totalConsumed),
      0,
      1
    );
    const displacement = meanDisplacementBps(entry.displacementSamples);
    const inefficiency = clamp(1 - displacement / 25, 0, 1);
    const raw = 0.3 * held + 0.25 * replenish + 0.2 * inefficiency + 0.15 * tested - 0.25 * pulled - (entry.extendedThrough ? 0.3 : 0);
    return clamp(raw, 0, 1) * 100;
  }

  // src/passive-liquidity/tick.ts
  var BookTickEstimator = class {
    estimate = 0;
    get tick() {
      return this.estimate;
    }
    observe(book) {
      const gap = Math.min(
        smallestGap(book.sortedLevels("bid")),
        smallestGap(book.sortedLevels("ask"))
      );
      if (Number.isFinite(gap) && gap > 0) {
        const clean = cleanTick(gap);
        this.estimate = this.estimate === 0 ? clean : Math.min(this.estimate, clean);
      }
      if (this.estimate === 0) {
        const mid = book.mid();
        if (Number.isFinite(mid) && mid > 0) this.estimate = fallbackTick(mid);
      }
      return this.estimate;
    }
    /** A single-level book never reveals a gap, so fall back on magnitude. */
    tickFor(price) {
      if (this.estimate > 0) return this.estimate;
      return fallbackTick(price);
    }
    reset() {
      this.estimate = 0;
    }
  };
  function smallestGap(levels2) {
    let min = Infinity;
    for (let i = 1; i < levels2.length; i++) {
      const gap = Math.abs(levels2[i].price - levels2[i - 1].price);
      if (gap > 1e-9 && gap < min) min = gap;
    }
    return min;
  }
  function cleanTick(gap) {
    if (!Number.isFinite(gap) || gap <= 0) return 0;
    const exponent = Math.floor(Math.log10(gap));
    const scale = 10 ** exponent;
    const mantissa = gap / scale;
    const snapped = mantissa <= 1.5 ? 1 : mantissa <= 3.5 ? 2 : mantissa <= 7.5 ? 5 : 10;
    return Number((snapped * scale).toPrecision(12));
  }
  function fallbackTick(price) {
    if (price >= 1e4) return 0.1;
    if (price >= 1e3) return 0.01;
    if (price >= 100) return 0.01;
    if (price >= 10) return 1e-3;
    if (price >= 1) return 1e-4;
    return 1e-6;
  }
  function levelKey(price, tick) {
    const size = tick > 0 ? tick : fallbackTick(price);
    return Number((Math.round(price / size) * size).toFixed(8));
  }

  // src/passive-liquidity/level-tracker.ts
  function emptyFlow() {
    return {
      addedQuantity: 0,
      addedNotional: 0,
      consumedQuantity: 0,
      consumedNotional: 0,
      cancelledQuantity: 0,
      cancelledNotional: 0,
      replenishedQuantity: 0,
      replenishedNotional: 0
    };
  }
  function flowForLevel(flows, level2, mid) {
    let flow = flows.find((entry) => entry.side === level2.side && entry.price === level2.price);
    if (!flow) {
      flow = {
        side: level2.side,
        price: level2.price,
        distanceBps: distanceBpsOf(level2.side, level2.price, mid),
        ...emptyFlow()
      };
      flows.push(flow);
    }
    return flow;
  }
  var LevelTracker = class {
    constructor(config, matcher) {
      this.config = config;
      this.matcher = matcher;
      this.sizeDist = {
        BID: new RollingDistribution(config.levelSampleSize),
        ASK: new RollingDistribution(config.levelSampleSize)
      };
      this.events = new RingBuffer(config.eventCapacity);
    }
    levels = {
      BID: /* @__PURE__ */ new Map(),
      ASK: /* @__PURE__ */ new Map()
    };
    sizeDist;
    events;
    ticks = new BookTickEstimator();
    lastObservedAt = 0;
    lastMid = 0;
    visibleDepthBps = 0;
    get mid() {
      return this.lastMid;
    }
    /** Distance beyond which the venue stops publishing levels. */
    get truncationBps() {
      return this.visibleDepthBps;
    }
    observe(now, book) {
      const mid = book.mid();
      if (!Number.isFinite(mid) || mid <= 0 || book.empty()) return null;
      const tick = this.ticks.observe(book);
      const delta = {
        at: now,
        mid,
        bid: emptyFlow(),
        ask: emptyFlow(),
        levels: [],
        truncatedLevels: 0,
        invalidLevels: 0,
        crossedBook: false
      };
      const bestBid = book.bestBid();
      const bestAsk = book.bestAsk();
      if (bestBid && bestAsk && bestBid.price >= bestAsk.price) delta.crossedBook = true;
      const bidView = this.collect(book, "BID", mid, tick, delta);
      const askView = this.collect(book, "ASK", mid, tick, delta);
      this.visibleDepthBps = Math.min(bidView.edgeBps, askView.edgeBps);
      this.matcher.prune(now);
      this.reconcile("BID", bidView.levels, bidView.edgePrice, now, mid, delta.bid, delta);
      this.reconcile("ASK", askView.levels, askView.edgePrice, now, mid, delta.ask, delta);
      this.lastObservedAt = now;
      this.lastMid = mid;
      return delta;
    }
    /**
     * A sequence gap means incremental state can no longer be trusted. All
     * lifecycle history is dropped rather than carried across the discontinuity.
     */
    reset() {
      this.levels.BID.clear();
      this.levels.ASK.clear();
      this.matcher.reset();
      this.ticks.reset();
      this.lastObservedAt = 0;
      this.lastMid = 0;
    }
    drainEvents() {
      const out = this.events.toArray();
      this.events.clear();
      return out;
    }
    snapshotLevels(now, mid) {
      const out = [];
      for (const side2 of ["ASK", "BID"]) {
        for (const level2 of this.levels[side2].values()) {
          if (level2.quantity <= 0 && level2.removedAt > 0) continue;
          out.push(this.toPublic(level2, now, mid));
        }
      }
      return out.sort((a, b) => b.price - a.price);
    }
    levelAt(side2, price, now, mid) {
      const level2 = this.levels[side2].get(levelKey(price, this.ticks.tickFor(price)));
      return level2 ? this.toPublic(level2, now, mid) : null;
    }
    timelineAt(side2, price, mid) {
      const level2 = this.levels[side2].get(levelKey(price, this.ticks.tickFor(price)));
      return level2 ? level2.timeline.toArray() : [];
    }
    /** Removes long-dead levels so the map stays bounded on a live feed. */
    prune(now) {
      const ttl = Math.max(6e4, this.config.replenishWindowMs * 12);
      for (const side2 of ["BID", "ASK"]) {
        const map = this.levels[side2];
        for (const [price, level2] of map) {
          if (level2.quantity <= 0 && level2.removedAt > 0 && now - level2.removedAt > ttl) {
            map.delete(price);
          }
        }
        if (map.size > 4e3) {
          const ordered = [...map.entries()].sort((a, b) => a[1].lastUpdatedAt - b[1].lastUpdatedAt);
          for (const [price] of ordered.slice(0, map.size - 4e3)) map.delete(price);
        }
      }
    }
    collect(book, side2, mid, tick, delta) {
      const bookSide = side2 === "BID" ? "bid" : "ask";
      const levels2 = /* @__PURE__ */ new Map();
      let edgePrice = side2 === "BID" ? Number.POSITIVE_INFINITY : 0;
      for (const raw of book.sortedLevels(bookSide)) {
        if (!Number.isFinite(raw.price) || !Number.isFinite(raw.quantity) || raw.price <= 0) {
          delta.invalidLevels += 1;
          continue;
        }
        if (raw.quantity <= 0) continue;
        if (side2 === "BID") edgePrice = Math.min(edgePrice, raw.price);
        else edgePrice = Math.max(edgePrice, raw.price);
        if (distanceBpsOf(side2, raw.price, mid) > this.config.maxTrackedBps) continue;
        const key3 = levelKey(raw.price, tick);
        levels2.set(key3, (levels2.get(key3) ?? 0) + raw.quantity);
      }
      if (!Number.isFinite(edgePrice) || edgePrice <= 0) {
        return { levels: levels2, edgePrice: 0, edgeBps: this.config.maxTrackedBps };
      }
      return {
        levels: levels2,
        edgePrice,
        edgeBps: Math.min(this.config.maxTrackedBps, distanceBpsOf(side2, edgePrice, mid))
      };
    }
    reconcile(side2, current, edgePrice, now, mid, flow, delta) {
      const map = this.levels[side2];
      for (const [price, quantity] of current) {
        const level2 = map.get(price) ?? this.create(side2, price, now, quantity, mid);
        if (!map.has(price)) map.set(price, level2);
        level2.visible = true;
        level2.outOfView = false;
        level2.removedAt = 0;
        this.applyQuantity(level2, quantity, now, mid, flow, delta.levels);
        this.trackApproach(level2, now, mid);
        if (quantity > 0) this.sizeDist[side2].add(quantity * price);
        level2.sizePercentile = this.sizeDist[side2].midRank(quantity * price);
      }
      for (const [price, level2] of map) {
        if (current.has(price)) continue;
        if (level2.quantity <= 0) continue;
        const beyondEdge = edgePrice > 0 && (side2 === "BID" ? price < edgePrice : price > edgePrice);
        if (beyondEdge) {
          level2.outOfView = true;
          level2.visible = false;
          delta.truncatedLevels += 1;
          continue;
        }
        level2.visible = false;
        this.applyQuantity(level2, 0, now, mid, flow, delta.levels);
        if (level2.quantity <= 0) level2.removedAt = now;
      }
      for (const level2 of map.values()) {
        this.settleUnresolved(level2, now, mid, flow, delta.levels);
        this.settleEpisode(level2, now, mid);
      }
    }
    create(side2, price, now, quantity, mid) {
      const level2 = {
        side: side2,
        price,
        quantity: 0,
        firstSeenAt: now,
        lastUpdatedAt: now,
        lastPresentAt: now,
        presentMs: 0,
        initialQuantity: quantity,
        addedQuantity: 0,
        consumedQuantity: 0,
        cancelledQuantity: 0,
        replenishedQuantity: 0,
        maxQuantity: 0,
        maxNotional: 0,
        executionCount: 0,
        updateCount: 0,
        replenishmentCount: 0,
        attackCount: 0,
        defendedCount: 0,
        brokenCount: 0,
        outstandingConsumed: 0,
        lastConsumedAt: 0,
        episode: null,
        unresolved: [],
        visible: true,
        outOfView: false,
        removedAt: 0,
        approachRefBps: distanceBpsOf(side2, price, mid),
        approachRefQuantity: quantity,
        approachRefCancelled: 0,
        approachRefConsumed: 0,
        closestApproachBps: distanceBpsOf(side2, price, mid),
        quantityAtClosestApproach: quantity,
        approachWithdrawal: false,
        sizePercentile: 50,
        lastEvent: "NONE",
        timeline: new RingBuffer(this.config.timelinePoints)
      };
      return level2;
    }
    applyQuantity(level2, quantity, now, mid, flow, levelFlows) {
      const previous = level2.quantity;
      const change = quantity - previous;
      if (previous > 0 && now > level2.lastPresentAt) {
        level2.presentMs += now - level2.lastPresentAt;
      }
      level2.lastPresentAt = now;
      if (Math.abs(change) < 1e-12) {
        level2.quantity = quantity;
        level2.lastUpdatedAt = now;
        return;
      }
      let event = change > 0 ? "LIQUIDITY_ADDED" : "LIQUIDITY_CANCELLED";
      if (change > 0) {
        const levelFlow = flowForLevel(levelFlows, level2, mid);
        level2.addedQuantity += change;
        flow.addedQuantity += change;
        flow.addedNotional += change * level2.price;
        levelFlow.addedQuantity += change;
        levelFlow.addedNotional += change * level2.price;
        const withinWindow = now - level2.lastConsumedAt <= this.config.replenishWindowMs;
        if (level2.outstandingConsumed > 0 && withinWindow) {
          const replenished = Math.min(change, level2.outstandingConsumed);
          level2.replenishedQuantity += replenished;
          level2.outstandingConsumed -= replenished;
          level2.replenishmentCount += 1;
          flow.replenishedQuantity += replenished;
          flow.replenishedNotional += replenished * level2.price;
          levelFlow.replenishedQuantity += replenished;
          levelFlow.replenishedNotional += replenished * level2.price;
          event = "LIQUIDITY_REPLENISHED";
        }
      } else {
        const drop = -change;
        const matched = this.matcher.claim(level2.side, level2.price, drop, now, this.ticks.tick);
        if (matched > 0) {
          this.recordConsumption(level2, matched, now, flow, previous, levelFlows, mid);
          event = "LIQUIDITY_CONSUMED";
        }
        const remainder = drop - matched;
        if (remainder > 1e-12) {
          level2.unresolved.push({ at: now, quantity: remainder });
          if (matched <= 0) event = "LIQUIDITY_MOVED";
        }
      }
      level2.quantity = quantity;
      level2.lastUpdatedAt = now;
      level2.updateCount += 1;
      if (quantity > level2.maxQuantity) {
        level2.maxQuantity = quantity;
        level2.maxNotional = quantity * level2.price;
      }
      level2.lastEvent = event;
      level2.timeline.push({
        at: now,
        notional: quantity * level2.price,
        quantity,
        event
      });
      this.pushEvent(level2, event, Math.abs(change), now, mid, eventNote(event));
    }
    /**
     * `sizeBefore` is the resting size immediately before this attack started and
     * must be supplied by the caller: `level.quantity` still holds the pre-drop
     * size when called from `applyQuantity`, but has already been updated when
     * called from the unresolved-drop retry. Deriving it here from `level.quantity`
     * would be wrong in one of the two paths and would skew every subsequent
     * defended/broken verdict for the level.
     */
    recordConsumption(level2, quantity, now, flow, sizeBefore, levelFlows, mid) {
      level2.consumedQuantity += quantity;
      level2.executionCount += 1;
      level2.outstandingConsumed += quantity;
      level2.lastConsumedAt = now;
      flow.consumedQuantity += quantity;
      flow.consumedNotional += quantity * level2.price;
      const levelFlow = flowForLevel(levelFlows, level2, mid);
      levelFlow.consumedQuantity += quantity;
      levelFlow.consumedNotional += quantity * level2.price;
      if (!level2.episode) {
        level2.episode = {
          startedAt: now,
          startQuantity: sizeBefore,
          lastConsumedAt: now,
          consumed: quantity
        };
        level2.attackCount += 1;
      } else {
        level2.episode.lastConsumedAt = now;
        level2.episode.consumed += quantity;
      }
    }
    /**
     * Retries unmatched drops against trades that arrived after the book update,
     * then commits whatever is still unexplained as a cancellation.
     */
    settleUnresolved(level2, now, mid, flow, levelFlows) {
      if (!level2.unresolved.length) return;
      const kept = [];
      for (const pending of level2.unresolved) {
        let remaining = pending.quantity;
        if (now - pending.at <= this.config.tradeMatchWindowMs) {
          const matched = this.matcher.claim(level2.side, level2.price, remaining, pending.at, this.ticks.tick);
          if (matched > 0) {
            this.recordConsumption(level2, matched, pending.at, flow, level2.quantity + pending.quantity, levelFlows, mid);
            remaining -= matched;
          }
        }
        if (remaining <= 1e-12) continue;
        if (now - pending.at >= this.config.unresolvedCommitMs) {
          level2.cancelledQuantity += remaining;
          flow.cancelledQuantity += remaining;
          flow.cancelledNotional += remaining * level2.price;
          const levelFlow = flowForLevel(levelFlows, level2, mid);
          levelFlow.cancelledQuantity += remaining;
          levelFlow.cancelledNotional += remaining * level2.price;
          this.pushEvent(
            level2,
            "LIQUIDITY_CANCELLED",
            remaining,
            now,
            mid,
            "size removed with no matching execution"
          );
        } else {
          kept.push({ at: pending.at, quantity: remaining });
        }
      }
      level2.unresolved = kept;
    }
    /**
     * Closes an attack episode once consumption stops, then decides whether the
     * level held (defended) or gave way (broken).
     *
     * An episode also closes early once the level has fully recovered its starting
     * size with nothing left outstanding. Waiting for a lull would mean a level
     * under sustained pressure that refills after every hit — the clearest form of
     * defence there is — never settles, and so never counts as defended at all.
     */
    settleEpisode(level2, now, mid) {
      const episode = level2.episode;
      if (!episode) return;
      const recovered = episode.startQuantity > 0 && level2.quantity >= episode.startQuantity && level2.outstandingConsumed <= 1e-12;
      if (!recovered && now - episode.lastConsumedAt < this.config.replenishWindowMs) return;
      const start = episode.startQuantity;
      level2.episode = null;
      if (start <= 0) return;
      if (level2.quantity >= start * 0.6) {
        level2.defendedCount += 1;
        this.pushEvent(level2, "WALL_DEFENDED", level2.quantity, now, mid, "size restored after attack");
        return;
      }
      if (level2.quantity <= start * (1 - this.config.wallBreakFraction)) {
        level2.brokenCount += 1;
        this.pushEvent(level2, "WALL_BROKEN", episode.consumed, now, mid, "level gave way under aggression");
      }
    }
    /**
     * Records what a level does as price closes in on it. Losing size to
     * cancellations during an approach is withdrawal, not defence.
     */
    trackApproach(level2, now, mid) {
      const bps2 = distanceBpsOf(level2.side, level2.price, mid);
      if (bps2 < level2.closestApproachBps) {
        level2.closestApproachBps = bps2;
        level2.quantityAtClosestApproach = level2.quantity;
      }
      if (bps2 > level2.approachRefBps) {
        level2.approachRefBps = bps2;
        level2.approachRefQuantity = level2.quantity;
        level2.approachRefCancelled = level2.cancelledQuantity;
        level2.approachRefConsumed = level2.consumedQuantity;
        return;
      }
      if (level2.approachRefBps - bps2 < this.config.approachArmBps) return;
      if (level2.approachRefQuantity <= 0) return;
      const lost = level2.approachRefQuantity - level2.quantity;
      if (lost <= 0) return;
      const spanCancelled = level2.cancelledQuantity - level2.approachRefCancelled;
      const spanConsumed = level2.consumedQuantity - level2.approachRefConsumed;
      const shrankEnough = lost >= level2.approachRefQuantity * this.config.approachWithdrawalFraction;
      if (shrankEnough && spanCancelled > spanConsumed) {
        if (!level2.approachWithdrawal) {
          this.pushEvent(
            level2,
            "WALL_DISAPPEARED",
            lost,
            now,
            mid,
            "size pulled as price approached, before being attacked"
          );
        }
        level2.approachWithdrawal = true;
      }
    }
    pushEvent(level2, type, quantity, now, mid, note) {
      this.events.push({
        type,
        side: level2.side,
        price: level2.price,
        timestamp: now,
        quantity,
        notional: quantity * level2.price,
        distanceBps: distanceBpsOf(level2.side, level2.price, mid),
        note
      });
    }
    toPublic(level2, now, mid) {
      const reference = mid || this.lastMid || level2.price;
      const distanceFromMid = Math.max(0, level2.side === "ASK" ? level2.price - reference : reference - level2.price);
      const distanceBps = reference > 0 ? distanceFromMid / reference * 1e4 : 0;
      const ageMs = Math.max(0, now - level2.firstSeenAt);
      const unresolved = level2.unresolved.reduce((sum, u) => sum + u.quantity, 0);
      const scoreInput = {
        ageMs,
        presentMs: level2.presentMs,
        distanceBps,
        quantity: level2.quantity,
        maxQuantity: level2.maxQuantity,
        consumedQuantity: level2.consumedQuantity,
        cancelledQuantity: level2.cancelledQuantity,
        replenishedQuantity: level2.replenishedQuantity,
        attackCount: level2.attackCount,
        defendedCount: level2.defendedCount,
        replenishmentCount: level2.replenishmentCount
      };
      const persistence = persistenceScore(scoreInput, this.config);
      const replenishment = replenishmentScoreOf(scoreInput);
      const withdrawal = withdrawalScoreOf(scoreInput, this.config);
      const absorption = absorptionScoreOf(scoreInput);
      const isWall = level2.sizePercentile >= this.config.wallMinPercentile && level2.quantity > 0;
      return {
        side: level2.side,
        price: level2.price,
        quantity: level2.quantity,
        notionalValue: level2.quantity * level2.price,
        distanceFromMid,
        distanceBps,
        distancePercent: distanceBps / 100,
        firstSeenAt: level2.firstSeenAt,
        lastUpdatedAt: level2.lastUpdatedAt,
        ageMs,
        presentMs: level2.presentMs,
        initialQuantity: level2.initialQuantity,
        initialNotional: level2.initialQuantity * level2.price,
        addedQuantity: level2.addedQuantity,
        addedNotional: level2.addedQuantity * level2.price,
        consumedQuantity: level2.consumedQuantity,
        consumedNotional: level2.consumedQuantity * level2.price,
        cancelledQuantity: level2.cancelledQuantity,
        cancelledNotional: level2.cancelledQuantity * level2.price,
        replenishedQuantity: level2.replenishedQuantity,
        replenishedNotional: level2.replenishedQuantity * level2.price,
        unresolvedQuantity: unresolved,
        maxQuantity: level2.maxQuantity,
        maxNotional: level2.maxNotional,
        executionCount: level2.executionCount,
        updateCount: level2.updateCount,
        replenishmentCount: level2.replenishmentCount,
        attackCount: level2.attackCount,
        defendedCount: level2.defendedCount,
        replenishmentRatio: replenishmentRatio(level2.replenishedQuantity, level2.consumedQuantity),
        persistenceScore: persistence,
        replenishmentScore: replenishment,
        withdrawalScore: withdrawal,
        absorptionScore: absorption,
        sizePercentile: level2.sizePercentile,
        isWall,
        closestApproachBps: level2.closestApproachBps,
        notionalAtClosestApproach: level2.quantityAtClosestApproach * level2.price,
        approachWithdrawal: level2.approachWithdrawal,
        visible: level2.visible,
        outOfView: level2.outOfView,
        state: classifyLevelState(level2, {
          persistence,
          replenishment,
          withdrawal,
          absorption,
          ageMs,
          isWall
        }, this.config)
      };
    }
  };
  function distanceBpsOf(side2, price, mid) {
    if (mid <= 0) return Number.POSITIVE_INFINITY;
    const distance = side2 === "ASK" ? price - mid : mid - price;
    return Math.max(0, distance) / mid * 1e4;
  }
  function classifyLevelState(level2, scores, config) {
    if (level2.outOfView) return "PERSISTENT";
    if (level2.quantity <= 0) {
      return level2.consumedQuantity > level2.cancelledQuantity ? "BROKEN" : "VACUUM";
    }
    if (level2.brokenCount > 0 && level2.quantity < level2.maxQuantity * 0.2) return "BROKEN";
    if (level2.approachWithdrawal) return "WITHDRAWING";
    if (scores.isWall && scores.ageMs < config.wallYoungMs) return "UNRELIABLE";
    if (scores.withdrawal >= 60 && scores.withdrawal > scores.replenishment) return "WITHDRAWING";
    if (scores.absorption >= config.minAbsorptionScore) return "ABSORBING";
    if (level2.defendedCount >= 2 && scores.replenishment >= 50) return "DEFENDING";
    if (level2.episode && scores.replenishment >= 50) return "REPLENISHING";
    if (level2.episode) return "BEING_CONSUMED";
    if (level2.quantity > level2.maxQuantity * 0.95 && level2.addedQuantity > level2.initialQuantity) {
      return "BUILDING";
    }
    if (level2.quantity < level2.maxQuantity * 0.5) return "WEAKENING";
    if (scores.persistence >= 55) return "PERSISTENT";
    return "NEW";
  }
  function eventNote(event) {
    switch (event) {
      case "LIQUIDITY_ADDED":
        return "resting size increased";
      case "LIQUIDITY_CONSUMED":
        return "size removed by matching aggressive execution";
      case "LIQUIDITY_REPLENISHED":
        return "size restored after execution";
      case "LIQUIDITY_MOVED":
        return "size reduced, awaiting trade reconciliation";
      default:
        return "resting size changed";
    }
  }

  // src/passive-liquidity/state.ts
  function classifyState3(input, config) {
    if (!input.trustworthy) {
      return { state: "NO_DIRECTIONAL_EDGE", confidence: clamp(input.dataQuality, 0, 100) };
    }
    const evidence = (value) => clamp(0.6 * (value / 100) + 0.4 * (input.dataQuality / 100), 0, 1) * 100;
    if (input.upsideVacuum.detected && input.upsideVacuum.score >= input.downsideVacuum.score) {
      return { state: "UPSIDE_LIQUIDITY_VACUUM", confidence: evidence(input.upsideVacuum.score) };
    }
    if (input.downsideVacuum.detected) {
      return { state: "DOWNSIDE_LIQUIDITY_VACUUM", confidence: evidence(input.downsideVacuum.score) };
    }
    if (input.buyerAbsorption.detected && input.buyerAbsorption.score >= input.sellerAbsorption.score) {
      return { state: "BUYER_ABSORPTION", confidence: evidence(input.buyerAbsorption.score) };
    }
    if (input.sellerAbsorption.detected) {
      return { state: "SELLER_ABSORPTION", confidence: evidence(input.sellerAbsorption.score) };
    }
    const floor = input.floor;
    if (floor && (floor.state === "BUILDING_FLOOR" || floor.state === "CONFIRMED_SUPPORT")) {
      return { state: "BUILDING_FLOOR", confidence: evidence(floor.confidence) };
    }
    const ceiling = input.ceiling;
    if (ceiling && (ceiling.state === "BUILDING_CEILING" || ceiling.state === "CONFIRMED_RESISTANCE")) {
      return { state: "BUILDING_CEILING", confidence: evidence(ceiling.confidence) };
    }
    const buyersThrough = input.aggressiveBuyPercentile >= config.highPercentile && input.askConsumedPercentile >= config.highPercentile && input.upsideDisplacementPercentile >= config.highPercentile && input.askReplenishedPercentile <= config.highPercentile;
    if (buyersThrough) {
      return {
        state: "BUYERS_EXPANDING",
        confidence: evidence((input.aggressiveBuyPercentile + input.upsideDisplacementPercentile) / 2)
      };
    }
    const sellersThrough = input.aggressiveSellPercentile >= config.highPercentile && input.bidConsumedPercentile >= config.highPercentile && input.downsideDisplacementPercentile >= config.highPercentile && input.bidReplenishedPercentile <= config.highPercentile;
    if (sellersThrough) {
      return {
        state: "SELLERS_EXPANDING",
        confidence: evidence((input.aggressiveSellPercentile + input.downsideDisplacementPercentile) / 2)
      };
    }
    const buyersDefending = input.passiveBuyerStrength >= 65 && input.passiveBuyerStrength - input.passiveSellerStrength >= 10 && input.bidCancelledPercentile <= config.highPercentile;
    if (buyersDefending) {
      return { state: "PASSIVE_BUYERS_DEFENDING", confidence: evidence(input.passiveBuyerStrength) };
    }
    const sellersDefending = input.passiveSellerStrength >= 65 && input.passiveSellerStrength - input.passiveBuyerStrength >= 10 && input.askCancelledPercentile <= config.highPercentile;
    if (sellersDefending) {
      return { state: "PASSIVE_SELLERS_DEFENDING", confidence: evidence(input.passiveSellerStrength) };
    }
    if (Math.abs(input.nearImbalance) <= 0.15) {
      return { state: "BALANCED", confidence: evidence(50) };
    }
    return { state: "NO_DIRECTIONAL_EDGE", confidence: evidence(35) };
  }

  // src/passive-liquidity/strength.ts
  function passiveStrength2(input, weights) {
    const terms = [
      [weights.depth, input.depthPercentile / 100],
      [weights.nearDepth, input.nearDepthPercentile / 100],
      [weights.persistence, input.persistenceScore / 100],
      [weights.replenishment, input.replenishmentPercentile / 100],
      [weights.withdrawalInverse, 1 - input.withdrawalPercentile / 100],
      [weights.absorbedAggression, input.absorbedAggressionPercentile / 100],
      [weights.priceInefficiency, input.priceInefficiency / 100],
      [
        weights.defendedTests,
        clamp(input.defendedTests / Math.max(1, input.confirmedTestCount), 0, 1)
      ]
    ];
    let weighted = 0;
    let total = 0;
    for (const [weight, value] of terms) {
      if (weight <= 0) continue;
      weighted += weight * clamp(value, 0, 1);
      total += weight;
    }
    if (total <= 0) return 0;
    return clamp(weighted / total, 0, 1) * 100;
  }

  // src/passive-liquidity/structure.ts
  function buildZones(memory, config, mid) {
    if (mid <= 0) return [];
    const tolerance = mid * (config.zoneBps / 1e4);
    const zones = [];
    const ordered = [...memory].filter((m) => m.attacks > 0).sort((a, b) => a.price - b.price);
    for (const entry of ordered) {
      const existing = zones.find(
        (z) => z.side === entry.side && entry.price >= z.priceMin - tolerance && entry.price <= z.priceMax + tolerance
      );
      if (existing) {
        existing.priceMin = Math.min(existing.priceMin, entry.price);
        existing.priceMax = Math.max(existing.priceMax, entry.price);
        existing.testCount += entry.attacks;
        existing.defendedTests += entry.defendedTests;
        existing.brokenTests += entry.brokenTests;
        existing.aggressionAbsorbed += entry.totalAggressionAbsorbed;
        existing.consumedNotional += entry.totalConsumed;
        existing.replenishedNotional += entry.totalReplenished;
        existing.cancelledNotional += entry.totalCancelled;
        existing.firstSeenAt = Math.min(existing.firstSeenAt, entry.firstSeenAt);
        existing.lastTestAt = Math.max(existing.lastTestAt, entry.lastTestAt);
        existing.extendedThrough = existing.extendedThrough || entry.extendedThrough;
        existing.defenseScores.push(entry.defenseScore);
        continue;
      }
      zones.push({
        side: entry.side,
        priceMin: entry.price,
        priceMax: entry.price,
        testCount: entry.attacks,
        defendedTests: entry.defendedTests,
        brokenTests: entry.brokenTests,
        aggressionAbsorbed: entry.totalAggressionAbsorbed,
        consumedNotional: entry.totalConsumed,
        replenishedNotional: entry.totalReplenished,
        cancelledNotional: entry.totalCancelled,
        firstSeenAt: entry.firstSeenAt,
        lastTestAt: entry.lastTestAt,
        extendedThrough: entry.extendedThrough,
        defenseScores: [entry.defenseScore]
      });
    }
    return zones.map((zone) => finalize2(zone, config, mid)).sort((a, b) => b.strength - a.strength);
  }
  function finalize2(zone, config, mid) {
    const ratio = replenishmentRatio(zone.replenishedNotional, zone.consumedNotional);
    const pulled = clamp(
      safeDiv(zone.cancelledNotional, zone.cancelledNotional + zone.consumedNotional),
      0,
      1
    );
    const held = clamp(safeDiv(zone.defendedTests, zone.testCount), 0, 1);
    const meanDefense = zone.defenseScores.length ? zone.defenseScores.reduce((s, v) => s + v, 0) / zone.defenseScores.length : 0;
    const centre = (zone.priceMin + zone.priceMax) / 2;
    const displacementBps = centre > 0 ? Math.abs(mid - centre) / centre * 1e4 : 0;
    const strength = clamp(
      0.35 * (meanDefense / 100) + 0.25 * held + 0.2 * clamp(ratio, 0, 1) + 0.2 * clamp(zone.testCount / config.confirmedTestCount, 0, 1) - 0.3 * pulled - (zone.extendedThrough ? 0.25 : 0),
      0,
      1
    ) * 100;
    const state = classify(zone, ratio, pulled, held, config);
    const confidence = clamp(
      0.5 * clamp(zone.testCount / config.confirmedTestCount, 0, 1) + 0.5 * (strength / 100),
      0,
      1
    ) * 100;
    return {
      side: zone.side,
      priceMin: zone.priceMin,
      priceMax: zone.priceMax,
      state,
      testCount: zone.testCount,
      defendedTests: zone.defendedTests,
      aggressionAbsorbed: zone.aggressionAbsorbed,
      consumedNotional: zone.consumedNotional,
      replenishedNotional: zone.replenishedNotional,
      cancelledNotional: zone.cancelledNotional,
      replenishmentRatio: ratio,
      displacementBps,
      strength,
      confidence,
      firstSeenAt: zone.firstSeenAt,
      lastTestAt: zone.lastTestAt
    };
  }
  function classify(zone, ratio, pulled, held, config) {
    const floor = zone.side === "BID";
    if (zone.extendedThrough && zone.brokenTests > 0 && ratio < 0.4) {
      return floor ? "BROKEN_SUPPORT" : "BROKEN_RESISTANCE";
    }
    if (zone.defendedTests >= config.confirmedTestCount && ratio >= 0.6 && pulled <= 0.4) {
      return floor ? "CONFIRMED_SUPPORT" : "CONFIRMED_RESISTANCE";
    }
    if (zone.defendedTests >= config.buildingTestCount && held >= 0.5 && ratio >= 0.4) {
      return floor ? "BUILDING_FLOOR" : "BUILDING_CEILING";
    }
    if (zone.defendedTests >= config.buildingTestCount && (pulled > 0.5 || ratio < 0.3)) {
      return floor ? "WEAKENING_SUPPORT" : "WEAKENING_RESISTANCE";
    }
    return floor ? "POTENTIAL_FLOOR" : "POTENTIAL_CEILING";
  }
  var FLOOR_STATES = [
    "CONFIRMED_SUPPORT",
    "BUILDING_FLOOR",
    "POTENTIAL_FLOOR"
  ];
  var CEILING_STATES = [
    "CONFIRMED_RESISTANCE",
    "BUILDING_CEILING",
    "POTENTIAL_CEILING"
  ];
  function pickFloor(zones, mid) {
    return pick(zones, "BID", FLOOR_STATES, (zone) => zone.priceMax <= mid);
  }
  function pickCeiling(zones, mid) {
    return pick(zones, "ASK", CEILING_STATES, (zone) => zone.priceMin >= mid);
  }
  function pick(zones, side2, states, positional) {
    let best = null;
    for (const zone of zones) {
      if (zone.side !== side2 || !states.includes(zone.state) || !positional(zone)) continue;
      if (!best || zone.strength > best.strength) best = zone;
    }
    return best;
  }

  // src/passive-liquidity/trade-matcher.ts
  function exactKey(price) {
    return Number(price.toFixed(8));
  }
  var TradeMatcher = class {
    constructor(config) {
      this.config = config;
    }
    /** `${side}:${tick}` -> executions, oldest first. */
    byPrice = /* @__PURE__ */ new Map();
    executedBuyNotional = 0;
    executedSellNotional = 0;
    recentExecutions = [];
    lastTradeAt = 0;
    get lastTradeTimestamp() {
      return this.lastTradeAt;
    }
    /**
     * Aggressive buys lift asks; aggressive sells hit bids. The passive side that
     * lost liquidity is therefore the opposite of the aggressor.
     */
    onTrade(trade) {
      if (trade.quantity <= 0 || trade.price <= 0) return;
      const side2 = trade.isAggressiveBuy ? "ASK" : "BID";
      const price = exactKey(trade.price);
      const key3 = `${side2}:${price}`;
      const list = this.byPrice.get(key3) ?? [];
      list.push({ at: trade.timestamp, price, remaining: trade.quantity });
      this.byPrice.set(key3, list);
      this.lastTradeAt = Math.max(this.lastTradeAt, trade.timestamp);
      if (trade.isAggressiveBuy) this.executedBuyNotional += trade.quoteValue;
      else this.executedSellNotional += trade.quoteValue;
      this.recentExecutions.push({
        at: trade.timestamp,
        buy: trade.isAggressiveBuy ? trade.quoteValue : 0,
        sell: trade.isAggressiveSell ? trade.quoteValue : 0
      });
      if (this.recentExecutions.length > 8192) this.recentExecutions.splice(0, 4096);
    }
    /**
     * Attribute up to `quantity` of a reduction at `price` to executed volume.
     * `at` is the time of the book change, which may precede or follow the trade.
     * `tick` is the venue increment observed on the book, used to widen the search
     * to neighbouring prices when a sweep clears several levels at once.
     */
    claim(side2, price, quantity, at, tick) {
      if (quantity <= 0 || tick <= 0) return 0;
      const window = this.config.tradeMatchWindowMs;
      const reach = this.config.tradeMatchTicks;
      let need = quantity;
      let matched = 0;
      for (let step = 0; step <= reach && need > 0; step++) {
        const candidates = step === 0 ? [0] : [-step, step];
        for (const offset of candidates) {
          if (need <= 0) break;
          const key3 = `${side2}:${exactKey(price + offset * tick)}`;
          const list = this.byPrice.get(key3);
          if (!list) continue;
          for (const entry of list) {
            if (need <= 0) break;
            if (entry.remaining <= 0) continue;
            if (Math.abs(entry.at - at) > window) continue;
            const take = Math.min(entry.remaining, need);
            entry.remaining -= take;
            need -= take;
            matched += take;
          }
          this.byPrice.set(key3, list.filter((e) => e.remaining > 1e-12));
        }
      }
      return matched;
    }
    /** Executed notional in the trailing window, for relative normalization. */
    executedNotional(side2, now, windowMs) {
      const from = now - windowMs;
      let sum = 0;
      for (let i = this.recentExecutions.length - 1; i >= 0; i--) {
        const e = this.recentExecutions[i];
        if (!e || e.at < from) break;
        sum += side2 === "BUY" ? e.buy : e.sell;
      }
      return sum;
    }
    cumulativeNotional(side2) {
      return side2 === "BUY" ? this.executedBuyNotional : this.executedSellNotional;
    }
    /** Drops expired executions so stale trades cannot explain new reductions. */
    prune(now) {
      const cutoff = now - this.config.tradeMatchWindowMs;
      for (const [key3, list] of this.byPrice) {
        const kept = list.filter((e) => e.remaining > 1e-12 && e.at >= cutoff);
        if (kept.length) this.byPrice.set(key3, kept);
        else this.byPrice.delete(key3);
      }
      const trim = now - 3e5;
      while (this.recentExecutions.length && (this.recentExecutions[0]?.at ?? 0) < trim) {
        this.recentExecutions.shift();
      }
    }
    reset() {
      this.byPrice.clear();
    }
  };

  // src/passive-liquidity/velocity.ts
  function zeroVelocity() {
    return {
      addedQuantityPerSec: 0,
      addedNotionalPerSec: 0,
      cancelledQuantityPerSec: 0,
      cancelledNotionalPerSec: 0,
      consumedQuantityPerSec: 0,
      consumedNotionalPerSec: 0,
      replenishedQuantityPerSec: 0,
      replenishedNotionalPerSec: 0
    };
  }
  var LiquidityVelocityTracker = class {
    samples;
    constructor(capacity = 4096) {
      this.samples = {
        BID: new RingBuffer(capacity),
        ASK: new RingBuffer(capacity)
      };
    }
    record(side2, at, flow) {
      this.samples[side2].push({ at, ...flow });
    }
    velocity(side2, now, windowMs) {
      if (windowMs <= 0) return zeroVelocity();
      const from = now - windowMs;
      const totals = this.totals(side2, now, windowMs);
      const seconds = Math.max(1e-3, (now - Math.max(from, 0)) / 1e3);
      return {
        addedQuantityPerSec: totals.addedQuantity / seconds,
        addedNotionalPerSec: totals.addedNotional / seconds,
        cancelledQuantityPerSec: totals.cancelledQuantity / seconds,
        cancelledNotionalPerSec: totals.cancelledNotional / seconds,
        consumedQuantityPerSec: totals.consumedQuantity / seconds,
        consumedNotionalPerSec: totals.consumedNotional / seconds,
        replenishedQuantityPerSec: totals.replenishedQuantity / seconds,
        replenishedNotionalPerSec: totals.replenishedNotional / seconds
      };
    }
    totals(side2, now, windowMs) {
      const from = now - windowMs;
      const out = {
        addedQuantity: 0,
        addedNotional: 0,
        consumedQuantity: 0,
        consumedNotional: 0,
        cancelledQuantity: 0,
        cancelledNotional: 0,
        replenishedQuantity: 0,
        replenishedNotional: 0
      };
      for (const sample of this.samples[side2].values()) {
        if (sample.at < from || sample.at > now) continue;
        out.addedQuantity += sample.addedQuantity;
        out.addedNotional += sample.addedNotional;
        out.consumedQuantity += sample.consumedQuantity;
        out.consumedNotional += sample.consumedNotional;
        out.cancelledQuantity += sample.cancelledQuantity;
        out.cancelledNotional += sample.cancelledNotional;
        out.replenishedQuantity += sample.replenishedQuantity;
        out.replenishedNotional += sample.replenishedNotional;
      }
      return out;
    }
    reset() {
      this.samples.BID.clear();
      this.samples.ASK.clear();
    }
  };

  // src/passive-liquidity/walls.ts
  function median2(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid] ?? 0;
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  var WallTracker = class {
    constructor(config) {
      this.config = config;
    }
    persistenceDist = new RollingDistribution(1024);
    replenishDist = new RollingDistribution(1024);
    vanished = [];
    known = /* @__PURE__ */ new Map();
    /**
     * @param priceRejection 0-1 measure of how poorly price advanced against this
     *        side, supplied by the engine so walls are scored with price response.
     */
    detect(levels2, now, priceRejection) {
      const bySide = { BID: [], ASK: [] };
      for (const level2 of levels2) {
        if (level2.outOfView) continue;
        bySide[level2.side].push(level2);
      }
      const walls = [];
      for (const side2 of ["BID", "ASK"]) {
        const sorted = bySide[side2].sort((a, b) => a.distanceBps - b.distanceBps);
        for (let i = 0; i < sorted.length; i++) {
          const level2 = sorted[i];
          if (!level2 || level2.quantity <= 0) continue;
          const neighbours = [];
          for (let j = Math.max(0, i - 4); j <= Math.min(sorted.length - 1, i + 4); j++) {
            if (j === i) continue;
            const n = sorted[j];
            if (n) neighbours.push(n.notionalValue);
          }
          const nearbyMedian = median2(neighbours);
          const vsNearbyMedian = nearbyMedian > 0 ? level2.notionalValue / nearbyMedian : 0;
          const unusualSize = level2.sizePercentile >= this.config.wallMinPercentile;
          const unusualLocally = vsNearbyMedian >= this.config.wallMinVsNearbyMedian;
          if (!unusualSize && !unusualLocally) continue;
          this.persistenceDist.add(level2.persistenceScore);
          this.replenishDist.add(level2.replenishmentScore);
          walls.push(
            this.build(level2, vsNearbyMedian, now, side2 === "BID" ? priceRejection.bid : priceRejection.ask)
          );
        }
      }
      this.trackDisappearance(walls, now);
      return walls.sort((a, b) => a.distanceBps - b.distanceBps);
    }
    build(level2, vsNearbyMedian, now, priceRejection) {
      const persistencePercentile = this.persistenceDist.size >= 8 ? this.persistenceDist.midRank(level2.persistenceScore) : level2.persistenceScore;
      const replenishmentPercentile = this.replenishDist.size >= 8 ? this.replenishDist.midRank(level2.replenishmentScore) : level2.replenishmentScore;
      const young = level2.ageMs < this.config.wallYoungMs;
      const ageFactor = clamp(
        Math.log1p(level2.presentMs / 1e3) / Math.log1p(this.config.wallMatureMs / 1e3),
        0,
        1
      );
      const defence = level2.attackCount > 0 ? clamp(level2.defendedCount / level2.attackCount, 0, 1) : 0;
      const attackCredit = clamp(level2.attackCount / 4, 0, 1);
      const replenish = clamp(level2.replenishmentRatio, 0, 1);
      const withdrawal = level2.withdrawalScore / 100;
      const proximity = distanceWeight(level2.distanceBps, this.config.distanceWeightK);
      const strengthRaw = 0.18 * (level2.sizePercentile / 100) + 0.1 * clamp(vsNearbyMedian / 6, 0, 1) + 0.22 * (0.5 * ageFactor + 0.5 * persistencePercentile / 100) + 0.2 * replenish + 0.12 * (0.6 * defence + 0.4 * attackCredit) + 0.1 * proximity + 0.08 * clamp(priceRejection, 0, 1) - 0.3 * withdrawal - (young ? 0.25 : 0) - (level2.approachWithdrawal ? 0.3 : 0);
      const reliabilityRaw = 0.35 * ageFactor + 0.25 * replenish + 0.2 * defence + 0.2 * (1 - withdrawal) - (level2.approachWithdrawal ? 0.4 : 0) - (young ? 0.2 : 0);
      const strength = clamp(strengthRaw, 0, 1) * 100;
      const reliability = clamp(reliabilityRaw, 0, 1) * 100;
      const labels = [];
      if (young || persistencePercentile < 30) labels.push("LOW_PERSISTENCE_WALL");
      if (level2.approachWithdrawal) labels.push("APPROACH_WITHDRAWAL");
      if (reliability < 35) labels.push("UNRELIABLE_LIQUIDITY");
      if (this.reappearedFarther(level2, now)) labels.push("REAPPEARS_FARTHER");
      return {
        side: level2.side,
        price: level2.price,
        quantity: level2.quantity,
        notional: level2.notionalValue,
        distanceBps: level2.distanceBps,
        sizePercentile: level2.sizePercentile,
        persistencePercentile,
        replenishmentPercentile,
        vsNearbyMedian,
        ageMs: level2.ageMs,
        attackCount: level2.attackCount,
        defendedCount: level2.defendedCount,
        consumedNotional: level2.consumedNotional,
        replenishedNotional: level2.replenishedNotional,
        cancelledNotional: level2.cancelledNotional,
        strength,
        reliability,
        lifecycle: lifecycleOf(level2, young),
        labels,
        state: level2.state
      };
    }
    /** Remembers walls that vanished so a later wall farther out can be linked. */
    trackDisappearance(walls, now) {
      const present = new Set(walls.map((w) => `${w.side}:${w.price}`));
      for (const [key3, notional] of this.known) {
        if (present.has(key3)) continue;
        const [side2, priceRaw] = key3.split(":");
        const price = Number(priceRaw);
        if (!Number.isFinite(price)) continue;
        this.vanished.push({
          side: side2 === "BID" ? "BID" : "ASK",
          price,
          distanceBps: 0,
          notional,
          at: now
        });
        this.known.delete(key3);
      }
      for (const wall of walls) this.known.set(`${wall.side}:${wall.price}`, wall.notional);
      const cutoff = now - 6e4;
      while (this.vanished.length && (this.vanished[0]?.at ?? 0) < cutoff) this.vanished.shift();
      if (this.vanished.length > 256) this.vanished.splice(0, this.vanished.length - 256);
    }
    reappearedFarther(level2, now) {
      if (level2.ageMs > 3e4) return false;
      for (const gone of this.vanished) {
        if (gone.side !== level2.side) continue;
        if (now - gone.at > 3e4) continue;
        const farther = level2.side === "ASK" ? level2.price > gone.price : level2.price < gone.price;
        const comparableSize = gone.notional > 0 && level2.notionalValue >= gone.notional * 0.6 && level2.notionalValue <= gone.notional * 1.8;
        if (farther && comparableSize) return true;
      }
      return false;
    }
  };
  function lifecycleOf(level2, young) {
    if (level2.quantity <= 0) {
      return level2.consumedQuantity > level2.cancelledQuantity ? "CONSUMED" : "WITHDRAWN";
    }
    if (level2.approachWithdrawal) return "WITHDRAWN";
    if (level2.state === "BROKEN") return "BROKEN";
    if (level2.defendedCount > 0 && level2.quantity >= level2.maxQuantity * 0.6) return "DEFENDED";
    if (level2.attackCount > 0 && level2.consumedQuantity > 0) return "ATTACKED";
    if (young) return "FORMING";
    return "HOLDING";
  }
  function nearestWall(walls, side2) {
    let best = null;
    for (const wall of walls) {
      if (wall.side !== side2 || wall.quantity <= 0) continue;
      if (wall.lifecycle === "BROKEN" || wall.lifecycle === "WITHDRAWN") continue;
      if (!best || wall.distanceBps < best.distanceBps) best = wall;
    }
    return best;
  }
  function distanceToNextWallBps(walls, side2, minStrength) {
    let best = Number.POSITIVE_INFINITY;
    for (const wall of walls) {
      if (wall.side !== side2 || wall.strength < minStrength) continue;
      best = Math.min(best, wall.distanceBps);
    }
    return best;
  }

  // src/passive-liquidity/why.ts
  function fact(label, value, percentile, bands, detail) {
    if (percentile === void 0) return { label, value, detail };
    return {
      label,
      value,
      percentile,
      band: percentileBand(percentile, bands),
      tooltip: percentileTooltip(percentile),
      detail
    };
  }
  function buildWhy2(input) {
    const { bands } = input;
    const sellersActive = input.aggressiveSellPercentile >= input.aggressiveBuyPercentile;
    const facts = [
      fact(
        "Aggressive Sell",
        formatQuote(input.aggressiveSellNotional),
        input.aggressiveSellPercentile,
        bands
      ),
      fact(
        "Aggressive Buy",
        formatQuote(input.aggressiveBuyNotional),
        input.aggressiveBuyPercentile,
        bands
      ),
      fact(
        "Bid Consumption",
        formatQuote(input.bid.consumedNotional),
        input.bid.consumedPercentile,
        bands
      ),
      fact(
        "Ask Consumption",
        formatQuote(input.ask.consumedNotional),
        input.ask.consumedPercentile,
        bands
      ),
      fact(
        "Bid Replenishment",
        formatQuote(input.bid.replenishedNotional),
        input.bid.replenishedPercentile,
        bands,
        `ratio ${input.bid.replenishmentRatio.toFixed(2)} of consumed`
      ),
      fact(
        "Ask Replenishment",
        formatQuote(input.ask.replenishedNotional),
        input.ask.replenishedPercentile,
        bands,
        `ratio ${input.ask.replenishmentRatio.toFixed(2)} of consumed`
      ),
      fact(
        "Bid Withdrawal",
        formatQuote(input.bid.cancelledNotional),
        input.bid.cancelledPercentile,
        bands
      ),
      fact(
        "Ask Withdrawal",
        formatQuote(input.ask.cancelledNotional),
        input.ask.cancelledPercentile,
        bands
      ),
      fact(
        sellersActive ? "Downside Efficiency" : "Upside Efficiency",
        `${input.priceChangePercent.toFixed(3)}%`,
        sellersActive ? input.downsideDisplacementPercentile : input.upsideDisplacementPercentile,
        bands,
        "price displacement per unit of aggression"
      ),
      fact("Near Bid Depth", formatQuote(input.bid.nearDepthNotional), input.bid.nearDepthPercentile, bands),
      fact("Near Ask Depth", formatQuote(input.ask.nearDepthNotional), input.ask.nearDepthPercentile, bands),
      fact(
        "Bid Persistence",
        `${Math.round(input.bid.persistenceScore)}/100`,
        void 0,
        bands,
        "notional-weighted level persistence"
      ),
      fact(
        "Ask Persistence",
        `${Math.round(input.ask.persistenceScore)}/100`,
        void 0,
        bands,
        "notional-weighted level persistence"
      ),
      fact(
        "Passive Buyer Strength",
        `${Math.round(input.passiveBuyerStrength)}/100`,
        void 0,
        bands
      ),
      fact(
        "Passive Seller Strength",
        `${Math.round(input.passiveSellerStrength)}/100`,
        void 0,
        bands
      ),
      fact(
        "Near Book Imbalance",
        input.nearImbalance.toFixed(2),
        void 0,
        bands,
        "-1 ask dominance, +1 bid dominance"
      )
    ];
    const structure = input.floor ?? input.ceiling;
    if (structure) {
      facts.push(
        fact(
          "Defended Tests",
          `${structure.defendedTests} of ${structure.testCount}`,
          void 0,
          bands,
          `${structure.state} between ${structure.priceMin} and ${structure.priceMax}`
        )
      );
    }
    facts.push(
      fact("Data Quality", `${Math.round(input.dataQuality)}/100`, void 0, bands),
      fact("Interpretation", interpret(input), void 0, bands)
    );
    return facts;
  }
  function interpret(input) {
    switch (input.state) {
      case "BUYER_ABSORPTION":
        return "Aggressive sellers kept hitting bids while passive buyers replenished the liquidity they consumed, and price produced progressively weaker downside displacement.";
      case "SELLER_ABSORPTION":
        return "Aggressive buyers kept lifting asks while passive sellers replenished the liquidity they consumed, and price failed to extend higher.";
      case "UPSIDE_LIQUIDITY_VACUUM":
        return "Near ask depth is unusually thin, ask liquidity is being withdrawn rather than replenished, and modest buying is producing outsized upward displacement.";
      case "DOWNSIDE_LIQUIDITY_VACUUM":
        return "Near bid depth is unusually thin, bid liquidity is being withdrawn rather than replenished, and modest selling is producing outsized downward displacement.";
      case "BUILDING_FLOOR":
        return "Sellers repeatedly attacked the same region while passive buyers replenished liquidity and price failed to extend lower.";
      case "BUILDING_CEILING":
        return "Buyers repeatedly attacked the same region while passive sellers replenished liquidity and price failed to extend higher.";
      case "PASSIVE_BUYERS_DEFENDING":
        return "Bid liquidity is persistent and replenishing with low withdrawal, so passive buyers are currently the stronger passive side.";
      case "PASSIVE_SELLERS_DEFENDING":
        return "Ask liquidity is persistent and replenishing with low withdrawal, so passive sellers are currently the stronger passive side.";
      case "BUYERS_EXPANDING":
        return "Aggressive buying is consuming ask liquidity faster than it is replaced and price is advancing with it.";
      case "SELLERS_EXPANDING":
        return "Aggressive selling is consuming bid liquidity faster than it is replaced and price is declining with it.";
      case "BALANCED":
        return "Passive liquidity is close to symmetric near the touch with no side clearly consuming or withdrawing.";
      case "NO_DIRECTIONAL_EDGE":
        return input.dataTrustworthy ? "No passive liquidity condition stands out against this market's own history: consumption, replenishment and withdrawal are all near typical levels, so there is nothing to act on rather than something being hidden." : `Passive liquidity cannot be classified because the data is not trustworthy (quality ${Math.round(input.dataQuality)}/100${input.dataQualityReasons.length ? `: ${input.dataQualityReasons.join("; ")}` : ""}).`;
      default:
        return "Evidence is insufficient to classify passive liquidity behaviour.";
    }
  }

  // src/passive-liquidity/engine.ts
  var PassiveLiquidityEngine = class {
    constructor(symbol, config, bands) {
      this.symbol = symbol;
      this.config = config;
      this.bands = bands;
      this.matcher = new TradeMatcher(config);
      this.tracker = new LevelTracker(config, this.matcher);
      this.normalizer = new PassiveMetricNormalizer(config.metricSampleSize);
      this.walls = new WallTracker(config);
      this.memory = new PriceLevelMemoryStore(config);
      this.prices = new RingBuffer(4096);
      this.pendingEvents = new RingBuffer(config.eventCapacity);
      this.netLiquidityTracker = new NetLiquidityTracker(config.metricSampleSize, config.bandEdgesBps);
    }
    matcher;
    tracker;
    velocity = new LiquidityVelocityTracker();
    normalizer;
    walls;
    memory;
    prices;
    pendingEvents;
    netLiquidityTracker;
    lastBookAt = 0;
    lastBookTimestamp = 0;
    lastBestBid = 0;
    lastBestAsk = 0;
    lastSpreadBps = 0;
    baselineSpreadBps = 0;
    observations = 0;
    lastSampleAt = 0;
    invalidLevels = 0;
    crossedBook = false;
    truncatedLevels = 0;
    resets = 0;
    lastNetLiquidityTrustworthy = false;
    onTrade(trade) {
      if (trade.symbol && trade.symbol !== this.symbol) return;
      this.matcher.onTrade(trade);
      this.memory.onTrade(trade);
    }
    onBook(now, book) {
      const delta = this.tracker.observe(now, book);
      if (!delta) return;
      const observedLevels = this.tracker.snapshotLevels(now, delta.mid);
      this.netLiquidityTracker.observe(now, delta.mid, observedLevels, delta);
      this.velocity.record("BID", now, delta.bid);
      this.velocity.record("ASK", now, delta.ask);
      this.invalidLevels += delta.invalidLevels;
      this.truncatedLevels = delta.truncatedLevels;
      this.crossedBook = delta.crossedBook;
      this.lastBookAt = now;
      this.lastBookTimestamp = book.timestamp;
      this.lastBestBid = book.bestBid()?.price ?? 0;
      this.lastBestAsk = book.bestAsk()?.price ?? 0;
      const spread = book.spreadBps();
      if (Number.isFinite(spread)) {
        this.lastSpreadBps = spread;
        this.baselineSpreadBps = this.baselineSpreadBps === 0 ? spread : this.baselineSpreadBps * 0.99 + spread * 0.01;
      }
      this.prices.push({ at: now, mid: delta.mid });
      this.observations += 1;
      for (const event of this.tracker.drainEvents()) this.pendingEvents.push(event);
      if (now - this.lastSampleAt >= this.config.metricSampleMs) {
        this.lastSampleAt = now;
        this.sampleMetrics(now);
      }
      this.tracker.prune(now);
    }
    /**
     * Sequence continuity is gone, so incremental lifecycle state is discarded.
     * Consumption and cancellation are not calculated across the discontinuity.
     */
    noteReset(now) {
      this.tracker.reset();
      this.velocity.reset();
      this.pendingEvents.clear();
      this.netLiquidityTracker.reset();
      this.observations = 0;
      this.lastSampleAt = 0;
      this.invalidLevels = 0;
      this.crossedBook = false;
      this.lastBookAt = 0;
      this.resets += 1;
      void now;
    }
    snapshot(input) {
      const now = input.now;
      const mid = this.tracker.mid;
      if (mid <= 0 || input.bookEmpty) return emptyPassiveLiquiditySnapshot(this.symbol, now);
      const levels2 = this.tracker.snapshotLevels(now, mid);
      const depth = aggregateDepth(levels2, this.config);
      const bands = buildBands(levels2, this.config);
      const imbalanceCuts = buildImbalanceCuts(levels2, this.config);
      const metricWindow = this.config.metricWindowMs;
      const reportWindow = input.windowMs ?? metricWindow;
      const bidWindow = this.velocity.totals("BID", now, reportWindow);
      const askWindow = this.velocity.totals("ASK", now, reportWindow);
      const bidMetric = this.velocity.totals("BID", now, metricWindow);
      const askMetric = this.velocity.totals("ASK", now, metricWindow);
      const aggressiveBuy = this.matcher.executedNotional("BUY", now, metricWindow);
      const aggressiveSell = this.matcher.executedNotional("SELL", now, metricWindow);
      const displacement = this.displacement(now, metricWindow);
      const dailyVolume = input.dailyVolume ?? this.matcher.cumulativeNotional("BUY") + this.matcher.cumulativeNotional("SELL");
      const quality = assessDataQuality(
        {
          now,
          lastBookAt: this.lastBookAt,
          lastTradeAt: this.matcher.lastTradeTimestamp,
          observations: this.observations,
          reconnects: input.reconnects ?? this.resets,
          sequenceGaps: input.sequenceGaps ?? 0,
          sequenceContinuous: input.sequenceContinuous ?? true,
          crossedBook: this.crossedBook,
          invalidLevels: this.invalidLevels,
          bookEmpty: Boolean(input.bookEmpty),
          timestampDriftMs: input.exchangeTimestamp ? input.exchangeTimestamp - this.lastBookTimestamp : 0,
          visibleDepthBps: this.tracker.truncationBps
        },
        this.config
      );
      this.lastNetLiquidityTrustworthy = quality.trustworthy;
      const netByWindow = {};
      for (const ms of NET_LIQUIDITY_WINDOWS_MS) {
        netByWindow[String(ms)] = this.netLiquidityTracker.snapshot(now, ms, quality.trustworthy);
      }
      const netLiquidity = netByWindow[String(reportWindow)] ?? this.netLiquidityTracker.snapshot(now, reportWindow, quality.trustworthy);
      const relative = {
        nearbyDepth: depth.nearBidNotional + depth.nearAskNotional,
        recentExecutedVolume: aggressiveBuy + aggressiveSell,
        dailyVolume
      };
      const bidMetrics = this.sideMetrics("BID", levels2, depth, bidWindow, bidMetric);
      const askMetrics = this.sideMetrics("ASK", levels2, depth, askWindow, askMetric);
      const aggressiveBuyPercentile = this.normalizer.percentile("aggressiveBuy", aggressiveBuy);
      const aggressiveSellPercentile = this.normalizer.percentile("aggressiveSell", aggressiveSell);
      const upsideDisplacementPercentile = this.normalizer.percentile(
        "upsideDisplacement",
        displacement.upsideBps
      );
      const downsideDisplacementPercentile = this.normalizer.percentile(
        "downsideDisplacement",
        displacement.downsideBps
      );
      const upsideEfficiencyPercentile = this.normalizer.percentile(
        "upsideEfficiency",
        efficiency(displacement.upsideBps, aggressiveBuy)
      );
      const downsideEfficiencyPercentile = this.normalizer.percentile(
        "downsideEfficiency",
        efficiency(displacement.downsideBps, aggressiveSell)
      );
      const wallList = this.walls.detect(levels2, now, {
        bid: 1 - downsideEfficiencyPercentile / 100,
        ask: 1 - upsideEfficiencyPercentile / 100
      });
      this.memory.fold(levels2, now, mid);
      const memory = this.memory.all();
      const zones = buildZones(memory, this.config, mid);
      const floor = pickFloor(zones, mid);
      const ceiling = pickCeiling(zones, mid);
      const defendedBidTests = floor?.defendedTests ?? defendedTests(memory, "BID");
      const defendedAskTests = ceiling?.defendedTests ?? defendedTests(memory, "ASK");
      const passiveBuyerStrength = passiveStrength2(
        {
          depthPercentile: this.normalizer.percentile("bidDepth", depth.bidNotional),
          nearDepthPercentile: bidMetrics.nearDepthPercentile,
          persistenceScore: bidMetrics.persistenceScore,
          replenishmentPercentile: bidMetrics.replenishedPercentile,
          withdrawalPercentile: bidMetrics.cancelledPercentile,
          absorbedAggressionPercentile: aggressiveSellPercentile,
          priceInefficiency: 100 - downsideEfficiencyPercentile,
          defendedTests: defendedBidTests,
          confirmedTestCount: this.config.confirmedTestCount
        },
        this.config.strengthWeights
      );
      const passiveSellerStrength = passiveStrength2(
        {
          depthPercentile: this.normalizer.percentile("askDepth", depth.askNotional),
          nearDepthPercentile: askMetrics.nearDepthPercentile,
          persistenceScore: askMetrics.persistenceScore,
          replenishmentPercentile: askMetrics.replenishedPercentile,
          withdrawalPercentile: askMetrics.cancelledPercentile,
          absorbedAggressionPercentile: aggressiveBuyPercentile,
          priceInefficiency: 100 - upsideEfficiencyPercentile,
          defendedTests: defendedAskTests,
          confirmedTestCount: this.config.confirmedTestCount
        },
        this.config.strengthWeights
      );
      const sellerAbsorption = assessAbsorption(
        "SELLER_ABSORPTION",
        {
          aggressionPercentile: aggressiveBuyPercentile,
          consumptionPercentile: askMetrics.consumedPercentile,
          replenishmentPercentile: askMetrics.replenishedPercentile,
          displacementPercentile: upsideDisplacementPercentile,
          replenishmentRatio: askMetrics.replenishmentRatio,
          aggressionNotional: aggressiveBuy,
          consumedNotional: askMetric.consumedNotional
        },
        this.config,
        quality.trustworthy
      );
      const buyerAbsorption = assessAbsorption(
        "BUYER_ABSORPTION",
        {
          aggressionPercentile: aggressiveSellPercentile,
          consumptionPercentile: bidMetrics.consumedPercentile,
          replenishmentPercentile: bidMetrics.replenishedPercentile,
          displacementPercentile: downsideDisplacementPercentile,
          replenishmentRatio: bidMetrics.replenishmentRatio,
          aggressionNotional: aggressiveSell,
          consumedNotional: bidMetric.consumedNotional
        },
        this.config,
        quality.trustworthy
      );
      const spreadExpansion = Math.max(0, this.lastSpreadBps - this.baselineSpreadBps);
      const upsideVacuum = assessVacuum(
        "UP",
        {
          nearDepthPercentile: askMetrics.nearDepthPercentile,
          withdrawalPercentile: askMetrics.cancelledPercentile,
          replenishmentPercentile: askMetrics.replenishedPercentile,
          distanceToNextWallBps: distanceToNextWallBps(wallList, "ASK", 50),
          priceEfficiencyPercentile: upsideEfficiencyPercentile,
          spreadExpansionBps: spreadExpansion
        },
        this.config,
        quality.trustworthy
      );
      const downsideVacuum = assessVacuum(
        "DOWN",
        {
          nearDepthPercentile: bidMetrics.nearDepthPercentile,
          withdrawalPercentile: bidMetrics.cancelledPercentile,
          replenishmentPercentile: bidMetrics.replenishedPercentile,
          distanceToNextWallBps: distanceToNextWallBps(wallList, "BID", 50),
          priceEfficiencyPercentile: downsideEfficiencyPercentile,
          spreadExpansionBps: spreadExpansion
        },
        this.config,
        quality.trustworthy
      );
      const nearImbalance = imbalanceOf(depth.nearBidNotional, depth.nearAskNotional);
      const bookImbalance = imbalanceOf(depth.bidNotional, depth.askNotional);
      const { state, confidence } = classifyState3(
        {
          trustworthy: quality.trustworthy,
          dataQuality: quality.score,
          sellerAbsorption,
          buyerAbsorption,
          upsideVacuum,
          downsideVacuum,
          passiveBuyerStrength,
          passiveSellerStrength,
          nearImbalance,
          aggressiveBuyPercentile,
          aggressiveSellPercentile,
          upsideDisplacementPercentile,
          downsideDisplacementPercentile,
          askConsumedPercentile: askMetrics.consumedPercentile,
          bidConsumedPercentile: bidMetrics.consumedPercentile,
          askReplenishedPercentile: askMetrics.replenishedPercentile,
          bidReplenishedPercentile: bidMetrics.replenishedPercentile,
          askCancelledPercentile: askMetrics.cancelledPercentile,
          bidCancelledPercentile: bidMetrics.cancelledPercentile,
          floor,
          ceiling
        },
        this.config
      );
      const why = buildWhy2({
        state,
        bid: bidMetrics,
        ask: askMetrics,
        aggressiveBuyNotional: aggressiveBuy,
        aggressiveSellNotional: aggressiveSell,
        aggressiveBuyPercentile,
        aggressiveSellPercentile,
        upsideDisplacementPercentile,
        downsideDisplacementPercentile,
        priceChangePercent: displacement.netPercent,
        nearImbalance,
        floor,
        ceiling,
        passiveBuyerStrength,
        passiveSellerStrength,
        dataQuality: quality.score,
        dataTrustworthy: quality.trustworthy,
        dataQualityReasons: quality.reasons,
        bands: this.bands
      });
      const events = this.pendingEvents.toArray();
      this.pendingEvents.clear();
      this.appendDerivedEvents(events, now, mid, {
        sellerAbsorption,
        buyerAbsorption,
        upsideVacuum,
        downsideVacuum,
        wallList
      });
      const profile = this.buildProfile(levels2);
      const nearestBidWall = nearestWall(wallList, "BID");
      const nearestAskWall = nearestWall(wallList, "ASK");
      const context = {
        askDepth: depth.askNotional,
        bidDepth: depth.bidNotional,
        nearAskDepth: depth.nearAskNotional,
        nearBidDepth: depth.nearBidNotional,
        weightedAskDepth: depth.weightedAskNotional,
        weightedBidDepth: depth.weightedBidNotional,
        askConsumption: askMetric.consumedNotional,
        bidConsumption: bidMetric.consumedNotional,
        askReplenishment: askMetric.replenishedNotional,
        bidReplenishment: bidMetric.replenishedNotional,
        askWithdrawal: askMetric.cancelledNotional,
        bidWithdrawal: bidMetric.cancelledNotional,
        askPersistence: askMetrics.persistenceScore,
        bidPersistence: bidMetrics.persistenceScore,
        passiveSellerStrength,
        passiveBuyerStrength,
        upsideVacuumScore: upsideVacuum.score,
        downsideVacuumScore: downsideVacuum.score,
        sellerAbsorptionScore: sellerAbsorption.score,
        buyerAbsorptionScore: buyerAbsorption.score,
        bookImbalance,
        nearBookImbalance: nearImbalance,
        askNetLiquidityChange: netLiquidity.ask.bookNetChange,
        bidNetLiquidityChange: netLiquidity.bid.bookNetChange,
        nearAskNetLiquidityChange: netLiquidity.near10Bps.ask.behavioralNetChange,
        nearBidNetLiquidityChange: netLiquidity.near10Bps.bid.behavioralNetChange,
        askNetLiquidityVelocity: netLiquidity.ask.velocityPerSec,
        bidNetLiquidityVelocity: netLiquidity.bid.velocityPerSec,
        askWithdrawalPressure: netLiquidity.ask.withdrawalPressure,
        bidWithdrawalPressure: netLiquidity.bid.withdrawalPressure,
        askCancellationShare: netLiquidity.ask.cancellationShare,
        bidCancellationShare: netLiquidity.bid.cancellationShare,
        askConsumptionShare: netLiquidity.ask.consumptionShare,
        bidConsumptionShare: netLiquidity.bid.consumptionShare,
        liquidityChangeImbalance: netLiquidity.liquidityChangeImbalance,
        dataQuality: quality.score
      };
      if (nearestAskWall) context.nearestAskWall = nearestAskWall;
      if (nearestBidWall) context.nearestBidWall = nearestBidWall;
      if (floor) context.potentialFloor = floor;
      if (ceiling) context.potentialCeiling = ceiling;
      const features = {
        bidDepth: depth.bidNotional,
        askDepth: depth.askNotional,
        nearBidDepth: depth.nearBidNotional,
        nearAskDepth: depth.nearAskNotional,
        weightedBidDepth: depth.weightedBidNotional,
        weightedAskDepth: depth.weightedAskNotional,
        bookImbalance,
        nearBookImbalance: nearImbalance,
        askNetLiquidityChange: netLiquidity.ask.bookNetChange,
        bidNetLiquidityChange: netLiquidity.bid.bookNetChange,
        nearAskNetLiquidityChange: netLiquidity.near10Bps.ask.behavioralNetChange,
        nearBidNetLiquidityChange: netLiquidity.near10Bps.bid.behavioralNetChange,
        askNetLiquidityVelocity: netLiquidity.ask.velocityPerSec,
        bidNetLiquidityVelocity: netLiquidity.bid.velocityPerSec,
        askWithdrawalPressure: netLiquidity.ask.withdrawalPressure,
        bidWithdrawalPressure: netLiquidity.bid.withdrawalPressure,
        askCancellationShare: netLiquidity.ask.cancellationShare,
        bidCancellationShare: netLiquidity.bid.cancellationShare,
        askConsumptionShare: netLiquidity.ask.consumptionShare,
        bidConsumptionShare: netLiquidity.bid.consumptionShare,
        liquidityChangeImbalance: netLiquidity.liquidityChangeImbalance,
        bidConsumption: bidMetric.consumedNotional,
        askConsumption: askMetric.consumedNotional,
        bidReplenishment: bidMetric.replenishedNotional,
        askReplenishment: askMetric.replenishedNotional,
        bidWithdrawal: bidMetric.cancelledNotional,
        askWithdrawal: askMetric.cancelledNotional,
        bidReplenishmentRatio: bidMetrics.replenishmentRatio,
        askReplenishmentRatio: askMetrics.replenishmentRatio,
        bidPersistence: bidMetrics.persistenceScore,
        askPersistence: askMetrics.persistenceScore,
        passiveBuyerStrength,
        passiveSellerStrength,
        buyerAbsorptionScore: buyerAbsorption.score,
        sellerAbsorptionScore: sellerAbsorption.score,
        upsideVacuumScore: upsideVacuum.score,
        downsideVacuumScore: downsideVacuum.score,
        bidWithdrawalPercentile: bidMetrics.cancelledPercentile,
        askWithdrawalPercentile: askMetrics.cancelledPercentile,
        bidReplenishmentPercentile: bidMetrics.replenishedPercentile,
        askReplenishmentPercentile: askMetrics.replenishedPercentile,
        aggressiveBuyPercentile,
        aggressiveSellPercentile,
        downsideEfficiencyPercentile,
        upsideEfficiencyPercentile,
        defendedBidTests,
        defendedAskTests,
        dataQuality: quality.score
      };
      return {
        symbol: this.symbol,
        timestamp: now,
        mid,
        bestBid: this.lastBestBid,
        bestAsk: this.lastBestAsk,
        spreadBps: this.lastSpreadBps,
        bid: bidMetrics,
        ask: askMetrics,
        bands,
        imbalanceCuts,
        netLiquidity,
        netByWindow,
        profile,
        walls: wallList,
        nearestBidWall,
        nearestAskWall,
        passiveBuyerStrength,
        passiveSellerStrength,
        sellerAbsorption,
        buyerAbsorption,
        upsideVacuum,
        downsideVacuum,
        zones,
        potentialFloor: floor,
        potentialCeiling: ceiling,
        aggressionVsLiquidity: this.buildAggressionPanel(
          {
            aggressiveBuy,
            aggressiveSell,
            aggressiveBuyPercentile,
            aggressiveSellPercentile,
            upsideDisplacementPercentile,
            downsideDisplacementPercentile
          },
          bidMetrics,
          askMetrics,
          bidMetric,
          askMetric,
          relative,
          displacement,
          state
        ),
        effortVsResult: buildEffortVsResult(
          {
            aggressiveBuyPercentile,
            aggressiveSellPercentile,
            upsideDisplacementPercentile,
            downsideDisplacementPercentile
          },
          passiveBuyerStrength,
          passiveSellerStrength
        ),
        state,
        stateConfidence: confidence,
        why,
        events,
        dataQuality: quality,
        context,
        features
      };
    }
    levelDetail(side2, price, now) {
      const mid = this.tracker.mid;
      const level2 = this.tracker.levelAt(side2, price, now, mid);
      if (!level2) return null;
      return {
        level: level2,
        timeline: this.tracker.timelineAt(side2, price, mid),
        wall: null,
        memory: this.memory.get(side2, price, mid)
      };
    }
    netLiquidity(now, windowMs) {
      const boundedWindow = Math.max(1e4, Math.min(9e5, windowMs));
      return this.netLiquidityTracker.snapshot(now, boundedWindow, this.lastNetLiquidityTrustworthy);
    }
    priceLevelMemory() {
      return this.memory.all();
    }
    /** One sample per `metricSampleMs` keeps distributions from over-weighting bursts. */
    sampleMetrics(now) {
      const window = this.config.metricWindowMs;
      const bid = this.velocity.totals("BID", now, window);
      const ask = this.velocity.totals("ASK", now, window);
      const levels2 = this.tracker.snapshotLevels(now, this.tracker.mid);
      const depth = aggregateDepth(levels2, this.config);
      this.normalizer.observe("bidDepth", depth.bidNotional);
      this.normalizer.observe("askDepth", depth.askNotional);
      this.normalizer.observe("nearBidDepth", depth.nearBidNotional);
      this.normalizer.observe("nearAskDepth", depth.nearAskNotional);
      this.normalizer.observe("bidConsumed", bid.consumedNotional);
      this.normalizer.observe("askConsumed", ask.consumedNotional);
      this.normalizer.observe("bidCancelled", bid.cancelledNotional);
      this.normalizer.observe("askCancelled", ask.cancelledNotional);
      this.normalizer.observe("bidReplenished", bid.replenishedNotional);
      this.normalizer.observe("askReplenished", ask.replenishedNotional);
      this.normalizer.observe("bidAdded", bid.addedNotional);
      this.normalizer.observe("askAdded", ask.addedNotional);
      const buy = this.matcher.executedNotional("BUY", now, window);
      const sell = this.matcher.executedNotional("SELL", now, window);
      this.normalizer.observe("aggressiveBuy", buy);
      this.normalizer.observe("aggressiveSell", sell);
      const displacement = this.displacement(now, window);
      this.normalizer.observe("upsideDisplacement", displacement.upsideBps);
      this.normalizer.observe("downsideDisplacement", displacement.downsideBps);
      this.normalizer.observe("upsideEfficiency", efficiency(displacement.upsideBps, buy));
      this.normalizer.observe("downsideEfficiency", efficiency(displacement.downsideBps, sell));
      this.normalizer.observe("spreadBps", this.lastSpreadBps);
      this.netLiquidityTracker.sample(now, window);
    }
    /**
     * Displacement is measured as the excursion achieved in each direction, not
     * the net change. Net change is zero-inflated: a market that is usually flat
     * would rank a flat window at the top of its own history, which would invert
     * every "price failed to move" test.
     */
    displacement(now, windowMs) {
      const from = now - windowMs;
      let open = 0;
      let close = 0;
      let high = 0;
      let low = Number.POSITIVE_INFINITY;
      for (const sample of this.prices.values()) {
        if (sample.at < from || sample.at > now) continue;
        if (open === 0) open = sample.mid;
        close = sample.mid;
        high = Math.max(high, sample.mid);
        low = Math.min(low, sample.mid);
      }
      if (open <= 0 || close <= 0 || !Number.isFinite(low)) {
        return { upsideBps: 0, downsideBps: 0, netPercent: 0 };
      }
      return {
        upsideBps: (high - open) / open * 1e4,
        downsideBps: (open - low) / open * 1e4,
        netPercent: (close - open) / open * 100
      };
    }
    sideMetrics(side2, levels2, depth, windowFlow, metricFlow) {
      const isBid = side2 === "BID";
      const depthNotional = isBid ? depth.bidNotional : depth.askNotional;
      const nearDepth = isBid ? depth.nearBidNotional : depth.nearAskNotional;
      let persistenceWeighted = 0;
      let withdrawalWeighted = 0;
      let weight = 0;
      let count = 0;
      for (const level2 of levels2) {
        if (level2.side !== side2 || level2.outOfView || level2.quantity <= 0) continue;
        persistenceWeighted += level2.persistenceScore * level2.notionalValue;
        withdrawalWeighted += level2.withdrawalScore * level2.notionalValue;
        weight += level2.notionalValue;
        count += 1;
      }
      const ratio = metricFlow.consumedNotional > 0 ? metricFlow.replenishedNotional / metricFlow.consumedNotional : metricFlow.replenishedNotional > 0 ? 1 : 0;
      return {
        side: side2,
        depthNotional,
        depthQuantity: isBid ? depth.bidQuantity : depth.askQuantity,
        nearDepthNotional: nearDepth,
        weightedDepthNotional: isBid ? depth.weightedBidNotional : depth.weightedAskNotional,
        addedNotional: windowFlow.addedNotional,
        consumedNotional: windowFlow.consumedNotional,
        cancelledNotional: windowFlow.cancelledNotional,
        replenishedNotional: windowFlow.replenishedNotional,
        replenishmentRatio: ratio,
        persistenceScore: weight > 0 ? persistenceWeighted / weight : 0,
        withdrawalScore: weight > 0 ? withdrawalWeighted / weight : 0,
        levelCount: count,
        velocity: this.velocity.velocity(side2, this.lastBookAt, this.config.metricWindowMs),
        consumedPercentile: this.normalizer.percentile(
          isBid ? "bidConsumed" : "askConsumed",
          metricFlow.consumedNotional
        ),
        cancelledPercentile: this.normalizer.percentile(
          isBid ? "bidCancelled" : "askCancelled",
          metricFlow.cancelledNotional
        ),
        replenishedPercentile: this.normalizer.percentile(
          isBid ? "bidReplenished" : "askReplenished",
          metricFlow.replenishedNotional
        ),
        nearDepthPercentile: this.normalizer.percentile(
          isBid ? "nearBidDepth" : "nearAskDepth",
          nearDepth
        )
      };
    }
    /** Asks above mid then bids below, nearest to the touch first on each side. */
    buildProfile(levels2) {
      const limit = this.config.profileLevelsPerSide;
      const asks = levels2.filter((l) => l.side === "ASK" && l.quantity > 0).sort((a, b) => a.distanceBps - b.distanceBps).slice(0, limit);
      const bids = levels2.filter((l) => l.side === "BID" && l.quantity > 0).sort((a, b) => a.distanceBps - b.distanceBps).slice(0, limit);
      return [...asks.sort((a, b) => b.price - a.price), ...bids.sort((a, b) => b.price - a.price)];
    }
    buildAggressionPanel(flow, bid, ask, bidFlow, askFlow, relative, displacement, state) {
      const sellLed = flow.aggressiveSellPercentile > flow.aggressiveBuyPercentile;
      const balanced = Math.abs(flow.aggressiveSellPercentile - flow.aggressiveBuyPercentile) < 5;
      const aggressiveSide = balanced ? "BALANCED" : sellLed ? "SELL" : "BUY";
      const passive = sellLed ? bid : ask;
      const passiveFlow = sellLed ? bidFlow : askFlow;
      return {
        aggressiveSide,
        aggression: this.normalizer.measure(
          sellLed ? "aggressiveSell" : "aggressiveBuy",
          sellLed ? flow.aggressiveSell : flow.aggressiveBuy,
          relative
        ),
        consumption: this.normalizer.measure(
          sellLed ? "bidConsumed" : "askConsumed",
          passiveFlow.consumedNotional,
          relative
        ),
        replenishment: this.normalizer.measure(
          sellLed ? "bidReplenished" : "askReplenished",
          passiveFlow.replenishedNotional,
          relative
        ),
        withdrawal: this.normalizer.measure(
          sellLed ? "bidCancelled" : "askCancelled",
          passiveFlow.cancelledNotional,
          relative
        ),
        displacementBps: this.normalizer.measure(
          sellLed ? "downsideDisplacement" : "upsideDisplacement",
          sellLed ? displacement.downsideBps : displacement.upsideBps,
          relative
        ),
        interpretation: `${state} \xB7 passive ${passive.side} replenishment ratio ${passive.replenishmentRatio.toFixed(2)}`
      };
    }
    appendDerivedEvents(events, now, mid, parts) {
      const push = (type, side2, price, notional, note) => {
        events.push({
          type,
          side: side2,
          price,
          timestamp: now,
          quantity: price > 0 ? notional / price : 0,
          notional,
          distanceBps: mid > 0 ? Math.abs(price - mid) / mid * 1e4 : 0,
          note
        });
      };
      if (parts.sellerAbsorption.detected) {
        push("ABSORPTION_DETECTED", "ASK", mid, 0, "passive sellers absorbing aggressive buyers");
      }
      if (parts.buyerAbsorption.detected) {
        push("ABSORPTION_DETECTED", "BID", mid, 0, "passive buyers absorbing aggressive sellers");
      }
      if (parts.upsideVacuum.detected) {
        push("VACUUM_DETECTED", "ASK", mid, 0, "thin, withdrawing ask liquidity above");
      }
      if (parts.downsideVacuum.detected) {
        push("VACUUM_DETECTED", "BID", mid, 0, "thin, withdrawing bid liquidity below");
      }
      for (const wall of parts.wallList) {
        if (wall.lifecycle === "FORMING") {
          push("WALL_APPEARED", wall.side, wall.price, wall.notional, "unusually large level posted");
        }
        if (wall.lifecycle === "ATTACKED") {
          push("WALL_ATTACKED", wall.side, wall.price, wall.consumedNotional, "aggressive flow executing into wall");
        }
      }
    }
  };
  function efficiency(displacementBps, aggressionNotional) {
    return safeDiv(displacementBps, Math.max(1, aggressionNotional / 1e6));
  }
  function defendedTests(memory, side2) {
    let total = 0;
    for (const entry of memory) {
      if (entry.side === side2) total += entry.defendedTests;
    }
    return total;
  }
  function buildEffortVsResult(flow, passiveBuyerStrength, passiveSellerStrength) {
    const sellLed = flow.aggressiveSellPercentile > flow.aggressiveBuyPercentile;
    const effortScore = sellLed ? flow.aggressiveSellPercentile : flow.aggressiveBuyPercentile;
    const resultScore2 = sellLed ? flow.downsideDisplacementPercentile : flow.upsideDisplacementPercentile;
    const passiveDefenseScore = sellLed ? passiveBuyerStrength : passiveSellerStrength;
    const labels = [];
    if (effortScore >= 70 && resultScore2 <= 35) {
      labels.push(sellLed ? "SELLERS_INEFFICIENT" : "BUYERS_INEFFICIENT");
      if (passiveDefenseScore >= 60) {
        labels.push(sellLed ? "PASSIVE_BUYERS_ABSORBING" : "PASSIVE_SELLERS_ABSORBING");
      }
    } else if (effortScore >= 70 && resultScore2 >= 70) {
      labels.push(sellLed ? "SELLERS_EFFICIENT" : "BUYERS_EFFICIENT");
    }
    return {
      effortScore: clamp(effortScore, 0, 100),
      resultScore: clamp(resultScore2, 0, 100),
      passiveDefenseScore: clamp(passiveDefenseScore, 0, 100),
      labels
    };
  }

  // src/engine/symbol-engine.ts
  var SymbolEngine = class {
    constructor(symbol, marketType, config) {
      this.symbol = symbol;
      this.marketType = marketType;
      this.config = config;
      this.integrity = new IntegrityMonitor(
        config.integrity.duplicateWindow,
        config.integrity.maxOutOfOrderMs
      );
      this.rolling = new RollingFlowEngine(config);
      this.largeTrades = new LargeTradeDetector(config);
      this.bursts = new BurstDetector(config.burst);
      this.clusters = new FlowClusterDetector(config.cluster);
      this.cvd = new CVDEngine(config.cvdSlopeMs);
      this.tape = new LargeTradeTape(config.tapeCapacity);
      this.liquidity = new LiquidityEngine(config.pressure);
      this.consumption = new ConsumptionEngine(6e4);
      this.iceberg = new IcebergLikeDetector(config.iceberg);
      this.priceImpact = new PriceImpactEngine(config.priceImpact);
      this.absorption = new AbsorptionEngine(config.absorption, config.samePrice);
      this.participant = new LargeParticipantFlowEngine(config.participantWeights);
      this.directional = new FlowScoreEngine(config.directionalWeights);
      this.confidence = new ConfidenceEngine(config.confidence);
      this.states = new StateClassifier(config.vacuum, config.exhaustion);
      this.movePotential = new MovePotentialEngine(config);
      this.passive = new PassiveFlowEngine();
      this.defense = new DefenseEngine(config.flowBattle);
      this.flowWinner = new FlowWinnerEngine(config.flowBattle, this.defense);
      this.liquidityResponse = new LiquidityResponseEngine(config.liquidityResponse);
      this.passiveLiquidity = new PassiveLiquidityEngine(
        symbol,
        config.passiveLiquidity,
        config.liquidityResponse.percentileBands
      );
      this.marketBattle = new MarketBattleEngine();
      this.marketFuel = new MarketFuelEngine(config.marketFuel);
      this.aggressiveFlow = new AggressiveFlowEngine(
        config.marketBattle,
        6e4,
        config.historicalBaselineSamples
      );
    }
    book = new LocalOrderBook();
    integrity;
    rolling;
    largeTrades;
    bursts;
    clusters;
    cvd;
    tape;
    liquidity;
    consumption;
    iceberg;
    priceImpact;
    absorption;
    participant;
    directional;
    confidence;
    states;
    movePotential;
    passive;
    defense;
    flowWinner;
    liquidityResponse;
    passiveLiquidity;
    marketBattle;
    marketFuel;
    aggressiveFlow;
    listeners = /* @__PURE__ */ new Set();
    /**
     * The passive liquidity snapshot is window-independent, so it is computed once
     * per timestamp and shared across every window in a multi-window emit.
     */
    passiveCache = null;
    sequenceGaps = 0;
    reconnects = 0;
    lastBuyVolume = 0;
    lastSellVolume = 0;
    lastDeltaSign = 0;
    recentFlip = false;
    priorAccelBuy = "NONE";
    priorAccelSell = "NONE";
    samePrice = { side: "BUY", prices: [], notionals: [] };
    lastIceberg = null;
    lastBurst = null;
    lastNow = 0;
    lastLargeBuyCount = 0;
    lastLargeSellCount = 0;
    lastVolatile = /* @__PURE__ */ new Map();
    on(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    ingestTrade(trade) {
      if (trade.symbol !== this.symbol) return;
      this.integrity.clearTransient();
      if (!this.integrity.acceptTradeId(trade.tradeId, trade.timestamp, Date.now())) return;
      this.lastNow = trade.timestamp;
      const relative = this.largeTrades.relativeSize(trade.quoteValue);
      this.largeTrades.observe(trade);
      const isLarge = this.largeTrades.isLarge(trade, relative);
      if (isLarge) {
        if (trade.isAggressiveBuy) this.lastLargeBuyCount += 1;
        else this.lastLargeSellCount += 1;
        this.tape.push({
          timestamp: trade.timestamp,
          side: trade.side,
          price: trade.price,
          quoteValue: trade.quoteValue,
          relativeClass: relative.classification,
          symbol: trade.symbol
        });
        const event = this.largeTrades.maybeEvent(trade, relative);
        if (event) this.emit({ kind: "large_trade", event });
      }
      this.rolling.onTrade(
        trade.timestamp,
        trade.side,
        trade.quoteValue,
        trade.price,
        isLarge,
        Boolean(trade.isForced)
      );
      this.cvd.onTrade(
        trade.timestamp,
        trade.isAggressiveBuy ? trade.quoteValue : 0,
        trade.isAggressiveSell ? trade.quoteValue : 0,
        trade.price
      );
      const burst = this.bursts.onTrade(trade, relative.vsMedian);
      if (burst) {
        this.lastBurst = burst;
        this.emit({ kind: "burst", burst, symbol: this.symbol });
      }
      const cluster = this.clusters.onTrade(trade, isLarge);
      if (cluster) this.emit({ kind: "cluster", cluster, symbol: this.symbol });
      this.trackSamePrice(trade);
      this.liquidityResponse.onTrade(trade, isLarge);
      this.passiveLiquidity.onTrade(trade);
      this.aggressiveFlow.onTrade(trade.timestamp, trade.side, trade.quoteValue, trade.price, isLarge);
      if (!this.book.empty()) {
        const flag = this.iceberg.onTrade(trade, this.book);
        if (flag) {
          this.lastIceberg = flag;
          this.emit({ kind: "iceberg_like", flag, symbol: this.symbol });
        }
      }
      this.updateLiquidityPath(trade.timestamp);
      this.updateFlip(trade.timestamp);
    }
    ingestBookSnapshot(snapshot) {
      this.book.applySnapshot(snapshot);
      this.integrity.lastBookTimestamp = snapshot.timestamp;
      this.integrity.lastBookReceivedAt = Date.now();
      this.integrity.flags.delete("staleBook");
      this.integrity.flags.delete("missingData");
      this.checkSpread();
      this.rolling.touchPrice(snapshot.timestamp, this.book.mid());
      this.updateLiquidityPath(snapshot.timestamp);
    }
    ingestBookDelta(delta) {
      const result = this.book.applyDelta(delta);
      this.integrity.lastBookTimestamp = delta.timestamp;
      this.integrity.lastBookReceivedAt = Date.now();
      if (!this.book.empty()) this.integrity.flags.delete("missingData");
      if (result.gap) {
        this.integrity.noteSequenceGap(delta.timestamp);
        this.sequenceGaps += 1;
        this.passiveLiquidity.noteReset(delta.timestamp);
      }
      this.checkSpread();
      this.rolling.touchPrice(delta.timestamp, this.book.mid());
      this.updateLiquidityPath(delta.timestamp);
    }
    ingestLiquidation(liq) {
      this.ingestTrade({
        symbol: liq.symbol,
        marketType: liq.marketType,
        timestamp: liq.timestamp,
        price: liq.price,
        quantity: liq.quantity,
        quoteValue: liq.quoteValue,
        side: liq.side,
        isAggressiveBuy: liq.side === "BUY",
        isAggressiveSell: liq.side === "SELL",
        isForced: true
      });
    }
    noteReconnect(now) {
      this.integrity.noteReconnect(now);
      this.liquidityResponse.noteReset(now);
      this.reconnects += 1;
      this.passiveLiquidity.noteReset(now);
    }
    snapshot(window, now = this.lastNow) {
      this.refreshIntegrity(now);
      const view = this.rolling.view(window, now);
      const agg = view.agg;
      const priceEnd = agg.priceClose || this.book.mid() || 0;
      const priceStart = agg.priceOpen || priceEnd;
      const impact = this.priceImpact.measure(priceStart, priceEnd, view.delta.delta);
      const pressure = this.liquidity.pressure(agg.buyVolume, agg.sellVolume, this.book);
      const rates = this.consumption.rates();
      const burstNow = this.bursts.current(now);
      const buyBurst = Boolean(burstNow && burstNow.side === "BUY");
      const sellBurst = Boolean(burstNow && burstNow.side === "SELL");
      const persistent = detectPersistentFlow(
        agg,
        view.windowMs,
        view.flowMultipleBuy,
        view.flowMultipleSell,
        this.config.persistent
      );
      const sameBuy = this.samePrice.side === "BUY" && this.absorption.samePriceHit(
        "BUY",
        this.samePrice.prices,
        this.samePrice.notionals,
        priceStart,
        priceEnd
      );
      const sameSell = this.samePrice.side === "SELL" && this.absorption.samePriceHit(
        "SELL",
        this.samePrice.prices,
        this.samePrice.notionals,
        priceStart,
        priceEnd
      );
      const absorption = this.absorption.detect({
        delta: view.delta.delta,
        deltaPercent: view.delta.deltaPercent,
        flowMultipleBuy: Number.isFinite(view.flowMultipleBuy) ? view.flowMultipleBuy : 99,
        flowMultipleSell: Number.isFinite(view.flowMultipleSell) ? view.flowMultipleSell : 99,
        priceChangePercent: impact.percentagePriceChange,
        impactEfficiency: impact.efficiency,
        buyBurst,
        sellBurst,
        persistentBuy: persistent.persistentBuyFlow,
        persistentSell: persistent.persistentSellFlow,
        askReplenishmentRatio: this.consumption.replenishmentRatio("ask"),
        bidReplenishmentRatio: this.consumption.replenishmentRatio("bid"),
        samePriceBuy: sameBuy,
        samePriceSell: sameSell,
        icebergSellAbsorption: this.lastIceberg?.type === "ICEBERG_LIKE_SELL_ABSORPTION",
        icebergBuyAbsorption: this.lastIceberg?.type === "ICEBERG_LIKE_BUY_ABSORPTION"
      });
      const largeBuy = this.isUnusualLarge(
        view.flowMultipleBuy,
        view.buyFlowPercentile,
        agg.largeBuyVolume,
        agg.largestBuy
      );
      const largeSell = this.isUnusualLarge(
        view.flowMultipleSell,
        view.sellFlowPercentile,
        agg.largeSellVolume,
        agg.largestSell
      );
      const cvd = this.cvd.snapshot(now);
      const participant = this.participant.score({
        largeBuyCount: this.lastLargeBuyCount,
        largeSellCount: this.lastLargeSellCount,
        largeBuyVolume: agg.largeBuyVolume,
        largeSellVolume: agg.largeSellVolume,
        buyVolume: agg.buyVolume,
        sellVolume: agg.sellVolume,
        largeBuyShare: view.shares.largeBuyFlowShare,
        largeSellShare: view.shares.largeSellFlowShare,
        maxPercentileRank: Math.max(view.buyFlowPercentile, view.sellFlowPercentile),
        buyBurstStrength: buyBurst ? burstNow?.strength ?? 0.6 : 0,
        sellBurstStrength: sellBurst ? burstNow?.strength ?? 0.6 : 0,
        persistentBuy: persistent.persistentBuyFlow,
        persistentSell: persistent.persistentSellFlow,
        deltaPercent: view.delta.deltaPercent,
        impactEfficiency: impact.efficiency,
        askConsumption: rates.askConsumptionRate,
        bidConsumption: rates.bidConsumptionRate,
        buyPressure: pressure.buyPressure,
        sellPressure: pressure.sellPressure
      });
      const directional = this.directional.score({
        deltaPercent: view.delta.deltaPercent,
        largeBuyShare: view.shares.largeBuyFlowShare,
        largeSellShare: view.shares.largeSellFlowShare,
        buyBurstStrength: buyBurst ? burstNow?.strength ?? 0.6 : 0,
        sellBurstStrength: sellBurst ? burstNow?.strength ?? 0.6 : 0,
        persistentBuy: persistent.persistentBuyFlow,
        persistentSell: persistent.persistentSellFlow,
        cvdSlopeSign: Math.sign(cvd.slope),
        askConsumption: rates.askConsumptionRate,
        bidConsumption: rates.bidConsumptionRate,
        priceChangePercent: impact.percentagePriceChange,
        impactEfficiency: impact.efficiency,
        accelerationBuy: view.largeBuyFlowAcceleration,
        accelerationSell: view.largeSellFlowAcceleration
      });
      const conf = this.confidence.score({
        flags: this.integrity.flags,
        tradeCount: agg.buyCount + agg.sellCount,
        bookEmpty: this.book.empty(),
        spreadBps: this.book.spreadBps(),
        maxSpreadBps: this.config.integrity.maxSpreadBps,
        deltaPercent: view.delta.deltaPercent,
        priceChangePercent: impact.percentagePriceChange,
        impactEfficiency: impact.efficiency,
        recentFlip: this.recentFlip
      });
      const state = this.states.classify({
        window,
        absorption,
        buyBurst,
        sellBurst,
        persistentBuy: persistent.persistentBuyFlow,
        persistentSell: persistent.persistentSellFlow,
        largeBuy,
        largeSell,
        flowMultipleBuy: view.flowMultipleBuy,
        flowMultipleSell: view.flowMultipleSell,
        buyPressure: pressure.buyPressure,
        sellPressure: pressure.sellPressure,
        priceChangePercent: impact.percentagePriceChange,
        impactEfficiency: impact.efficiency,
        accelerationBuy: view.largeBuyFlowAcceleration,
        accelerationSell: view.largeSellFlowAcceleration,
        priorAccelerationBuy: this.priorAccelBuy,
        priorAccelerationSell: this.priorAccelSell
      });
      this.priorAccelBuy = view.largeBuyFlowAcceleration;
      this.priorAccelSell = view.largeSellFlowAcceleration;
      const band = this.config.pressure.nearBandPct;
      const mid = this.book.mid() || priceEnd;
      const visibleAsk = this.book.notionalWithin("ask", mid, band);
      const visibleBid = this.book.notionalWithin("bid", mid, band);
      const liqWin = this.passive.window(now, WINDOW_MS[window]);
      const metrics = {
        ...emptyPassiveMetrics(),
        passiveBuyExecutedVolume: agg.sellVolume,
        passiveSellExecutedVolume: agg.buyVolume,
        bidLiquidityAdded: liqWin.bidLiquidityAdded,
        askLiquidityAdded: liqWin.askLiquidityAdded,
        bidLiquidityRemoved: liqWin.bidLiquidityRemoved,
        askLiquidityRemoved: liqWin.askLiquidityRemoved,
        bidLiquidityConsumed: rates.bidConsumptionRate,
        askLiquidityConsumed: rates.askConsumptionRate,
        bidLiquidityReplenished: rates.bidReplenishmentRate,
        askLiquidityReplenished: rates.askReplenishmentRate,
        bidLiquidityInitial: liqWin.bidLiquidityInitial,
        askLiquidityInitial: liqWin.askLiquidityInitial,
        bidLiquidityFinal: liqWin.bidLiquidityFinal || visibleBid,
        askLiquidityFinal: liqWin.askLiquidityFinal || visibleAsk
      };
      const flowBattle = this.flowWinner.analyze({
        price: priceEnd,
        aggressiveBuy: agg.buyVolume,
        aggressiveSell: agg.sellVolume,
        delta: view.delta.delta,
        priceChangePercent: impact.percentagePriceChange,
        impact: impact.efficiency,
        flowMultipleBuy: Number.isFinite(view.flowMultipleBuy) ? view.flowMultipleBuy : 1,
        flowMultipleSell: Number.isFinite(view.flowMultipleSell) ? view.flowMultipleSell : 1,
        buyBurst,
        sellBurst,
        persistentBuy: persistent.persistentBuyFlow,
        persistentSell: persistent.persistentSellFlow,
        windowMs: WINDOW_MS[window],
        absorption,
        iceberg: this.lastIceberg,
        visibleAsk,
        visibleBid,
        metrics
      });
      const liquidityResponse = this.liquidityResponse.snapshot({
        now,
        windowMs: WINDOW_MS[window],
        buy: agg.buyVolume,
        sell: agg.sellVolume,
        buyCount: agg.buyCount,
        sellCount: agg.sellCount,
        largeBuyCount: this.lastLargeBuyCount,
        largeSellCount: this.lastLargeSellCount,
        priceStart,
        priceEnd,
        priceHigh: agg.priceHigh || Math.max(priceStart, priceEnd),
        priceLow: agg.priceLow || Math.min(priceStart, priceEnd),
        cvdDirection: cvd.direction,
        shortLiquidationUsd: agg.forcedBuyVolume,
        longLiquidationUsd: agg.forcedSellVolume,
        flags: this.integrity.flags,
        bookEmpty: this.book.empty(),
        // Ages are measured against local receive time. Exchange event time comes
        // from a different clock, so subtracting it from Date.now() reports skew
        // as staleness.
        lastTradeAgeMs: this.integrity.lastTradeReceivedAt ? Math.max(0, now - this.integrity.lastTradeReceivedAt) : 0,
        lastBookAgeMs: this.integrity.lastBookReceivedAt ? Math.max(0, now - this.integrity.lastBookReceivedAt) : 0,
        exchangeCount: 1,
        oiExpected: this.marketType === "perp",
        liquidationExpected: this.marketType === "perp"
      });
      const netAggression = buildNetAggression({
        window,
        buyVolume: agg.buyVolume,
        sellVolume: agg.sellVolume,
        buyCount: agg.buyCount,
        sellCount: agg.sellCount,
        largeBuyVolume: agg.largeBuyVolume,
        largeSellVolume: agg.largeSellVolume,
        buyPercentile: view.buyFlowPercentile,
        sellPercentile: view.sellFlowPercentile,
        netMagnitudePercentile: liquidityResponse.norms.delta.percentile
      });
      const passiveLiquidity = this.passiveLiquiditySnapshot(now);
      const tradeDataMissing = this.integrity.lastTradeReceivedAt === 0 || this.integrity.flags.has("missingData");
      const tradeAgeMs = this.integrity.tradeAgeMs(now);
      const staleAfterMs = this.tradeStaleThresholdMs();
      const tradeDataLowConfidence = !tradeDataMissing && tradeAgeMs > staleAfterMs;
      const aggressiveFlow = this.aggressiveFlow.snapshot(window, now, {
        tradeDataMissing,
        tradeStale: tradeDataLowConfidence
      });
      const marketBattle = this.marketBattle.analyze({
        window,
        priceChangePercent: impact.percentagePriceChange,
        priceImpactEfficiency: impact.efficiency,
        confidence: conf,
        tradeDataMissing,
        tradeDataLowConfidence,
        tradeAgeMs: Number.isFinite(tradeAgeMs) ? tradeAgeMs : 0,
        staleAfterMs,
        medianTradeGapMs: this.integrity.medianTradeGapMs(),
        flowBattle,
        liquidityResponse,
        passiveLiquidity,
        netAggression,
        aggressiveFlow
      });
      const marketFuel = this.marketFuel.snapshot({
        symbol: this.symbol,
        window,
        now,
        aggressiveFlow,
        forcedBuyVolume: agg.forcedBuyVolume,
        forcedSellVolume: agg.forcedSellVolume,
        liquidationFeed: this.marketType === "perp" ? "live" : "not_expected",
        buyBurst,
        sellBurst,
        tradeDataMissing,
        tradeStale: tradeDataLowConfidence,
        sampleConfidence: conf
      });
      const snap = {
        symbol: this.symbol,
        marketType: this.marketType,
        price: priceEnd,
        window,
        aggressiveBuyVolume: agg.buyVolume,
        aggressiveSellVolume: agg.sellVolume,
        buyTradeCount: agg.buyCount,
        sellTradeCount: agg.sellCount,
        averageBuySize: view.shares.averageBuySize,
        averageSellSize: view.shares.averageSellSize,
        delta: view.delta.delta,
        deltaPercent: view.delta.deltaPercent,
        largeBuyVolume: agg.largeBuyVolume,
        largeSellVolume: agg.largeSellVolume,
        largeBuyFlowShare: view.shares.largeBuyFlowShare,
        largeSellFlowShare: view.shares.largeSellFlowShare,
        largestBuy: agg.largestBuy,
        largestSell: agg.largestSell,
        buyBurstDetected: buyBurst,
        sellBurstDetected: sellBurst,
        persistentBuyFlow: persistent.persistentBuyFlow,
        persistentSellFlow: persistent.persistentSellFlow,
        priceStart,
        priceEnd,
        absolutePriceChange: impact.absolutePriceChange,
        priceChangePercent: impact.percentagePriceChange,
        priceImpactEfficiency: impact.efficiency,
        flowMultipleBuy: view.flowMultipleBuy,
        flowMultipleSell: view.flowMultipleSell,
        forcedBuyVolume: agg.forcedBuyVolume,
        forcedSellVolume: agg.forcedSellVolume,
        buyPressure: pressure.buyPressure,
        sellPressure: pressure.sellPressure,
        askReplenishmentRate: rates.askReplenishmentRate,
        bidReplenishmentRate: rates.bidReplenishmentRate,
        askConsumptionRate: rates.askConsumptionRate,
        bidConsumptionRate: rates.bidConsumptionRate,
        largeBuyFlowAcceleration: view.largeBuyFlowAcceleration,
        largeSellFlowAcceleration: view.largeSellFlowAcceleration,
        absorption,
        largeFlowDirectionalScore: directional,
        largeParticipantFlowScore: participant.largeParticipantFlowScore,
        confidence: conf,
        state,
        flowBattle,
        liquidityResponse,
        passiveLiquidity,
        netAggression,
        marketBattle,
        marketFuel,
        tradeDecision: emptyTradeDecisionWait(this.symbol, window, now),
        movePotential: this.movePotential.evaluate({
          symbol: this.symbol,
          book: this.book,
          buyVolume: agg.buyVolume,
          sellVolume: agg.sellVolume,
          priceHigh: agg.priceHigh,
          priceLow: agg.priceLow,
          impactEfficiency: impact.efficiency,
          absorption,
          dataQualityScore: conf
        })
      };
      snap.tradeDecision = evaluateTradeDecision(snap, this.config.tradeDecision, { now });
      const alerts = buildAlerts(snap, this.config.alerts, now);
      const volatile = alerts.length > 0;
      const wasVolatile = this.lastVolatile.get(window) ?? false;
      this.lastVolatile.set(window, volatile);
      if (volatile && !wasVolatile) {
        for (const alert of alerts) this.emit({ kind: "alert", alert });
      }
      if (snap.movePotential.liquidity.events.length) {
        this.emit({
          kind: "move_potential",
          symbol: this.symbol,
          events: snap.movePotential.liquidity.events
        });
      }
      return snap;
    }
    multiWindow(now = this.lastNow) {
      const windows = {};
      let price = 0;
      for (const id of this.config.windows) {
        windows[id] = this.snapshot(id, now);
        price = windows[id].price;
      }
      return {
        symbol: this.symbol,
        marketType: this.marketType,
        price,
        timestamp: now,
        windows
      };
    }
    queryTape(filter = {}) {
      return this.tape.query({ ...filter, symbol: filter.symbol ?? this.symbol });
    }
    formatTape(filter = {}) {
      return this.tape.format({ ...filter, symbol: filter.symbol ?? this.symbol });
    }
    seedTradeSizeBaseline(values) {
      for (const v of values) this.largeTrades.distribution.add(v);
    }
    seedFlowBaseline(side2, perSecondVolumes) {
      this.rolling.seedBaseline(side2, perSecondVolumes);
    }
    seedImpactBaseline(impactsPerMillion) {
      this.priceImpact.seed(impactsPerMillion);
    }
    passiveLiquiditySnapshot(now) {
      if (this.passiveCache && this.passiveCache.at === now) return this.passiveCache.snapshot;
      const snapshot = this.passiveLiquidity.snapshot({
        now,
        reconnects: this.reconnects,
        sequenceGaps: this.sequenceGaps,
        sequenceContinuous: !this.integrity.flags.has("sequenceGap"),
        bookEmpty: this.book.empty(),
        exchangeTimestamp: this.book.timestamp
      });
      this.passiveCache = { at: now, snapshot };
      return snapshot;
    }
    isUnusualLarge(flowMultiple, percentile, largeVolume, largest) {
      const absTier = this.largeTrades.absoluteTier(largest) !== null;
      const rel = this.largeTrades.classifyPercentile(percentile);
      const multiple = Number.isFinite(flowMultiple) && flowMultiple >= 3;
      return absTier && largeVolume > 0 || rel === "LARGE" || rel === "VERY_LARGE" || rel === "EXTREME" || multiple;
    }
    trackSamePrice(trade) {
      if (this.samePrice.side !== trade.side) {
        this.samePrice.side = trade.side;
        this.samePrice.prices = [];
        this.samePrice.notionals = [];
      }
      const last = this.samePrice.prices[this.samePrice.prices.length - 1];
      if (last !== void 0) {
        const bps2 = Math.abs(trade.price - last) / last * 1e4;
        if (bps2 > this.config.samePrice.maxPriceDeviationBps) {
          this.samePrice.prices = [];
          this.samePrice.notionals = [];
        }
      }
      this.samePrice.prices.push(trade.price);
      this.samePrice.notionals.push(trade.quoteValue);
      if (this.samePrice.prices.length > 64) {
        this.samePrice.prices.shift();
        this.samePrice.notionals.shift();
      }
    }
    updateLiquidityPath(now) {
      if (this.book.empty()) {
        this.integrity.noteMissingData();
        return;
      }
      const mid = this.book.mid();
      const band = this.config.pressure.nearBandPct;
      const ask = this.book.notionalWithin("ask", mid, band);
      const bid = this.book.notionalWithin("bid", mid, band);
      const view = this.rolling.view("1s", now || this.lastNow);
      const buyDelta = Math.max(0, view.agg.buyVolume - this.lastBuyVolume);
      const sellDelta = Math.max(0, view.agg.sellVolume - this.lastSellVolume);
      this.lastBuyVolume = view.agg.buyVolume;
      this.lastSellVolume = view.agg.sellVolume;
      this.consumption.observe(now, bid, ask, buyDelta, sellDelta);
      this.passive.observe(now, bid, ask);
      this.passiveLiquidity.onBook(now, this.book);
      this.movePotential.observe(now, this.book, buyDelta, sellDelta);
      this.liquidityResponse.onBook(now, this.book, buyDelta, sellDelta);
    }
    updateFlip(now) {
      const view = this.rolling.view("5s", now);
      const sign = Math.sign(view.delta.deltaPercent);
      if (sign !== 0 && this.lastDeltaSign !== 0 && sign !== this.lastDeltaSign) {
        this.recentFlip = true;
      } else if (sign !== 0) {
        this.recentFlip = false;
      }
      if (sign !== 0) this.lastDeltaSign = sign;
    }
    /**
     * How long a symbol may go without a print before its flow read is stale.
     *
     * A flat threshold assumes every symbol trades like BTC. Thin books can
     * legitimately go tens of seconds between prints, so scale off the symbol's
     * own observed cadence and keep the configured value as the floor.
     */
    tradeStaleThresholdMs() {
      const floor = this.config.marketBattle.tradeStaleMs;
      const median3 = this.integrity.medianTradeGapMs();
      if (median3 <= 0) return floor;
      return Math.min(
        this.config.marketBattle.maxTradeStaleMs,
        Math.max(floor, median3 * this.config.marketBattle.tradeStaleGapMultiple)
      );
    }
    refreshIntegrity(now) {
      if (!this.book.empty() && now - this.book.timestamp > this.config.integrity.bookStaleMs) {
        this.integrity.noteStaleBook();
      }
      this.checkSpread();
    }
    checkSpread() {
      const spread = this.book.spreadBps();
      if (Number.isFinite(spread) && spread > this.config.integrity.maxSpreadBps) {
        this.integrity.noteWideSpread();
      }
    }
    emit(event) {
      for (const listener of this.listeners) listener(event);
    }
  };

  // src/engine/order-flow-engine.ts
  function key2(symbol, marketType) {
    return `${marketType}:${symbol}`;
  }
  var OrderFlowEngine = class {
    config;
    engines = /* @__PURE__ */ new Map();
    listeners = /* @__PURE__ */ new Set();
    constructor(overrides = {}) {
      this.config = mergeConfig(overrides);
    }
    getSymbol(symbol, marketType) {
      const k = key2(symbol, marketType);
      let engine2 = this.engines.get(k);
      if (!engine2) {
        engine2 = new SymbolEngine(symbol, marketType, this.config);
        for (const listener of this.listeners) engine2.on(listener);
        this.engines.set(k, engine2);
      }
      return engine2;
    }
    on(listener) {
      this.listeners.add(listener);
      for (const engine2 of this.engines.values()) engine2.on(listener);
      return () => this.listeners.delete(listener);
    }
    ingestTrade(trade) {
      this.getSymbol(trade.symbol, trade.marketType).ingestTrade(trade);
    }
    ingestBookSnapshot(snapshot) {
      this.getSymbol(snapshot.symbol, snapshot.marketType).ingestBookSnapshot(snapshot);
    }
    ingestBookDelta(delta) {
      this.getSymbol(delta.symbol, delta.marketType).ingestBookDelta(delta);
    }
    ingestLiquidation(liq) {
      this.getSymbol(liq.symbol, liq.marketType).ingestLiquidation(liq);
    }
    snapshot(symbol, marketType, window, now) {
      return this.getSymbol(symbol, marketType).snapshot(window, now);
    }
    multiWindow(symbol, marketType, now) {
      return this.getSymbol(symbol, marketType).multiWindow(now);
    }
    spotPerp(symbol, window, now) {
      const spotEngine = this.engines.get(key2(symbol, "spot"));
      const perpEngine = this.engines.get(key2(symbol, "perp"));
      const spot = spotEngine ? spotEngine.snapshot(window, now) : null;
      const perp = perpEngine ? perpEngine.snapshot(window, now) : null;
      const combined = combineSnapshots(symbol, spot, perp, window);
      const timestamp = now ?? spot?.priceEnd ?? perp?.priceEnd ?? Date.now();
      return {
        symbol,
        timestamp,
        price: perp?.price ?? spot?.price ?? 0,
        spot,
        perp,
        combined
      };
    }
    noteReconnect(symbol, marketType, now) {
      this.getSymbol(symbol, marketType).noteReconnect(now);
    }
  };
  function combineSnapshots(symbol, spot, perp, window) {
    if (!spot && !perp) return null;
    if (spot && !perp) return { ...spot, marketType: "combined" };
    if (perp && !spot) return { ...perp, marketType: "combined" };
    const a = spot;
    const b = perp;
    const buy = a.aggressiveBuyVolume + b.aggressiveBuyVolume;
    const sell = a.aggressiveSellVolume + b.aggressiveSellVolume;
    const total = buy + sell;
    const delta = buy - sell;
    const buyCount = a.buyTradeCount + b.buyTradeCount;
    const sellCount = a.sellTradeCount + b.sellTradeCount;
    const largeBuy = a.largeBuyVolume + b.largeBuyVolume;
    const largeSell = a.largeSellVolume + b.largeSellVolume;
    return {
      ...b,
      symbol,
      marketType: "combined",
      window,
      aggressiveBuyVolume: buy,
      aggressiveSellVolume: sell,
      buyTradeCount: buyCount,
      sellTradeCount: sellCount,
      averageBuySize: buy / Math.max(1, buyCount),
      averageSellSize: sell / Math.max(1, sellCount),
      delta,
      deltaPercent: total === 0 ? 0 : delta / total,
      largeBuyVolume: largeBuy,
      largeSellVolume: largeSell,
      forcedBuyVolume: a.forcedBuyVolume + b.forcedBuyVolume,
      forcedSellVolume: a.forcedSellVolume + b.forcedSellVolume,
      largestBuy: Math.max(a.largestBuy, b.largestBuy),
      largestSell: Math.max(a.largestSell, b.largestSell),
      liquidityResponse: emptyLiquidityResponse(),
      netAggression: buildNetAggression({
        window,
        buyVolume: buy,
        sellVolume: sell,
        buyCount,
        sellCount,
        largeBuyVolume: largeBuy,
        largeSellVolume: largeSell,
        buyPercentile: Math.max(a.netAggression?.buyPercentile ?? 50, b.netAggression?.buyPercentile ?? 50),
        sellPercentile: Math.max(a.netAggression?.sellPercentile ?? 50, b.netAggression?.sellPercentile ?? 50),
        netMagnitudePercentile: Math.max(
          a.netAggression?.netPercentile ?? 50,
          b.netAggression?.netPercentile ?? 50
        )
      })
    };
  }

  // src/flow/trade-classifier.ts
  function inferAggressorFromBook(price, bestBid, bestAsk, bookAgeMs) {
    if (bestBid == null || bestAsk == null) return null;
    if (!(bestBid > 0 && bestAsk > 0 && bestAsk >= bestBid)) return null;
    if (bookAgeMs != null && bookAgeMs > 1500) return null;
    const mid = (bestBid + bestAsk) / 2;
    if (mid <= 0) return null;
    const spreadBps = (bestAsk - bestBid) / mid * 1e4;
    if (spreadBps > 25) return null;
    if (price >= bestAsk) return "BUY";
    if (price <= bestBid) return "SELL";
    return null;
  }
  function classifyTrade(input) {
    const quoteValue = input.price * input.quantity;
    let side2;
    if (input.aggressorSide) {
      side2 = input.aggressorSide;
    } else if (input.isBuyerMaker !== void 0) {
      side2 = input.isBuyerMaker ? "SELL" : "BUY";
    } else {
      const inferred = inferAggressorFromBook(input.price, input.bestBid, input.bestAsk, input.bookAgeMs);
      if (!inferred) {
        throw new Error("Trade is missing maker/taker (isBuyerMaker) and aggressorSide");
      }
      side2 = inferred;
    }
    return {
      symbol: input.symbol,
      marketType: input.marketType ?? "spot",
      timestamp: input.timestamp,
      price: input.price,
      quantity: input.quantity,
      quoteValue,
      side: side2,
      isAggressiveBuy: side2 === "BUY",
      isAggressiveSell: side2 === "SELL",
      tradeId: input.tradeId,
      isForced: input.isForced
    };
  }

  // src/exchange/binance-adapters.ts
  function levels(rows) {
    return rows.map(([p, q]) => {
      const price = Number(p);
      const quantity = Number(q);
      return { price, quantity, quoteValue: price * quantity };
    });
  }
  var BinanceSpotAdapter = class {
    marketType = "spot";
    normalizeAggTrade(msg) {
      return classifyTrade({
        symbol: msg.s,
        marketType: "spot",
        timestamp: msg.T,
        price: Number(msg.p),
        quantity: Number(msg.q),
        isBuyerMaker: msg.m,
        tradeId: msg.a
      });
    }
    normalizeTrade(msg) {
      return classifyTrade({
        symbol: msg.s,
        marketType: "spot",
        timestamp: msg.T,
        price: Number(msg.p),
        quantity: Number(msg.q),
        isBuyerMaker: msg.m,
        tradeId: msg.t
      });
    }
    normalizeDepthSnapshot(symbol, snapshot, timestamp) {
      return {
        symbol,
        marketType: "spot",
        timestamp,
        lastUpdateId: snapshot.lastUpdateId,
        bids: levels(snapshot.bids),
        asks: levels(snapshot.asks)
      };
    }
    normalizeDepthDelta(msg) {
      return {
        symbol: msg.s,
        marketType: "spot",
        timestamp: msg.E,
        firstUpdateId: msg.U,
        finalUpdateId: msg.u,
        bids: levels(msg.b),
        asks: levels(msg.a)
      };
    }
    normalizeBookTicker(msg) {
      return {
        symbol: msg.s,
        marketType: "spot",
        timestamp: msg.E ?? Date.now(),
        bids: levels([[msg.b, msg.B]]),
        asks: levels([[msg.a, msg.A]])
      };
    }
  };
  var BinanceFuturesAdapter = class {
    marketType = "perp";
    normalizeAggTrade(msg) {
      return classifyTrade({
        symbol: msg.s,
        marketType: "perp",
        timestamp: msg.T,
        price: Number(msg.p),
        quantity: Number(msg.q),
        isBuyerMaker: msg.m,
        tradeId: msg.a
      });
    }
    normalizeTrade(msg) {
      return classifyTrade({
        symbol: msg.s,
        marketType: "perp",
        timestamp: msg.T,
        price: Number(msg.p),
        quantity: Number(msg.q),
        isBuyerMaker: msg.m,
        tradeId: msg.t
      });
    }
    normalizeDepthSnapshot(symbol, snapshot, timestamp) {
      return {
        symbol,
        marketType: "perp",
        timestamp,
        lastUpdateId: snapshot.lastUpdateId,
        bids: levels(snapshot.bids),
        asks: levels(snapshot.asks)
      };
    }
    normalizeDepthDelta(msg) {
      return {
        symbol: msg.s,
        marketType: "perp",
        timestamp: msg.E,
        firstUpdateId: msg.U,
        finalUpdateId: msg.u,
        prevUpdateId: msg.pu,
        bids: levels(msg.b),
        asks: levels(msg.a)
      };
    }
    normalizeBookTicker(msg) {
      return {
        symbol: msg.s,
        marketType: "perp",
        timestamp: msg.E ?? Date.now(),
        bids: levels([[msg.b, msg.B]]),
        asks: levels([[msg.a, msg.A]])
      };
    }
    normalizeForceOrder(msg) {
      const side2 = msg.o.S;
      const price = Number(msg.o.ap || msg.o.p);
      const quantity = Number(msg.o.q);
      return {
        symbol: msg.o.s,
        marketType: "perp",
        timestamp: msg.o.T,
        price,
        quantity,
        quoteValue: price * quantity,
        side: side2,
        type: side2 === "BUY" ? "SHORT_LIQUIDATION" : "LONG_LIQUIDATION"
      };
    }
    normalizeMarkPrice(msg) {
      return { symbol: msg.s, timestamp: msg.E, markPrice: Number(msg.p) };
    }
  };

  // src/exchange/types.ts
  function streamName(symbol, channel) {
    return `${symbol.toLowerCase()}@${channel}`;
  }
  var BINANCE_SPOT_WS = "wss://stream.binance.com:9443/stream";
  var BINANCE_FUTURES_WS = "wss://fstream.binance.com/stream";
  var BINANCE_FUTURES_WS_RAW = "wss://fstream.binance.com/ws";
  function unwrapBinancePayload(msg) {
    const nested = msg.data;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested;
    }
    if (typeof msg.e === "string" || typeof msg.s === "string" && (msg.p != null || msg.b != null && msg.a != null) || Array.isArray(msg.bids) && Array.isArray(msg.asks)) {
      return msg;
    }
    return null;
  }

  // src/live/watchlist.ts
  var WATCHLIST_CATALOG = [
    { symbol: "BTCUSDT", label: "BTC", minUsd: 1e4, venue: "crypto" },
    { symbol: "ETHUSDT", label: "ETH", minUsd: 5e3, venue: "crypto" },
    { symbol: "AVAXUSDT", label: "AVAX", minUsd: 1e3, venue: "crypto" },
    { symbol: "NEARUSDT", label: "NEAR", minUsd: 1e3, venue: "crypto" },
    { symbol: "DOTUSDT", label: "DOT", minUsd: 1e3, venue: "crypto" },
    { symbol: "SOLUSDT", label: "SOL", minUsd: 3e3, venue: "crypto" },
    { symbol: "LINKUSDT", label: "LINK", minUsd: 1e3, venue: "crypto" },
    { symbol: "XRPUSDT", label: "XRP", minUsd: 1e3, venue: "crypto" },
    { symbol: "DOGEUSDT", label: "DOGE", minUsd: 1e3, venue: "crypto" },
    { symbol: "SUIUSDT", label: "SUI", minUsd: 1e3, venue: "crypto" },
    { symbol: "PAXGUSDT", label: "PAXG", minUsd: 1e3, venue: "crypto" },
    { symbol: "HYPEUSDT", label: "HYPE", minUsd: 1e3, venue: "crypto" },
    { symbol: "PUMPUSDT", label: "PUMP", minUsd: 500, venue: "crypto" },
    { symbol: "PENGUUSDT", label: "PENGU", minUsd: 500, venue: "crypto" },
    { symbol: "OPUSDT", label: "OP", minUsd: 1e3, venue: "crypto" },
    { symbol: "XLMUSDT", label: "XLM", minUsd: 1e3, venue: "crypto" },
    { symbol: "TRUMPUSDT", label: "TRUMP", minUsd: 500, venue: "crypto" },
    { symbol: "ZKCUSDT", label: "ZKC", minUsd: 500, venue: "crypto" },
    { symbol: "ZAMAUSDT", label: "ZAMA", minUsd: 500, venue: "crypto" },
    { symbol: "FARTCOINUSDT", label: "FARTCOIN", minUsd: 500, venue: "crypto" },
    { symbol: "SENTUSDT", label: "SENT", minUsd: 500, venue: "crypto" },
    { symbol: "TAOUSDT", label: "TAO", minUsd: 1e3, venue: "crypto" }
  ];
  var EQUITY_PERP_CATALOG = [
    { symbol: "AAPLUSDT", label: "AAPL", minUsd: 500, venue: "equity" },
    { symbol: "AMZNUSDT", label: "AMZN", minUsd: 500, venue: "equity" },
    { symbol: "METAUSDT", label: "META", minUsd: 500, venue: "equity" },
    { symbol: "MSFTUSDT", label: "MSFT", minUsd: 500, venue: "equity" },
    { symbol: "GOOGLUSDT", label: "GOOGL", minUsd: 500, venue: "equity" },
    { symbol: "TSLAUSDT", label: "TSLA", minUsd: 500, venue: "equity" },
    { symbol: "AMDUSDT", label: "AMD", minUsd: 500, venue: "equity" },
    { symbol: "NVDAUSDT", label: "NVDA", minUsd: 500, venue: "equity" },
    { symbol: "SOXLUSDT", label: "SOXL", minUsd: 500, venue: "equity" },
    { symbol: "CLUSDT", label: "CL", minUsd: 500, venue: "equity" },
    { symbol: "XAGUSDT", label: "XAG", minUsd: 500, venue: "equity" }
  ];
  var FULL_WATCHLIST_CATALOG = [...WATCHLIST_CATALOG, ...EQUITY_PERP_CATALOG];
  var DEFAULT_ACTIVE_SYMBOLS = ["BTCUSDT", "NEARUSDT"];
  var DEFAULT_WATCHLIST = resolveWatchlist(DEFAULT_ACTIVE_SYMBOLS);
  function resolveWatchlist(symbols, catalog = FULL_WATCHLIST_CATALOG) {
    const wanted = new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean));
    const fromCatalog = catalog.filter((c) => wanted.has(c.symbol));
    for (const symbol of wanted) {
      if (fromCatalog.some((c) => c.symbol === symbol)) continue;
      fromCatalog.push({
        symbol,
        label: symbol.replace(/USDT$/, ""),
        minUsd: 1e3,
        venue: "crypto"
      });
    }
    return fromCatalog;
  }
  function minUsdFor(symbol, list = FULL_WATCHLIST_CATALOG) {
    return list.find((c) => c.symbol === symbol)?.minUsd ?? 1e3;
  }

  // src/live/json-socket.ts
  function openReconnectingJsonSocket(opts) {
    let socket = null;
    let pingTimer;
    let reconnectTimer;
    let stopped = false;
    const connect = () => {
      if (stopped || opts.isStopped()) return;
      const ws = new WebSocketBrowser(opts.url);
      socket = ws;
      ws.on("open", () => {
        if (stopped || opts.isStopped()) {
          safeCloseWebSocket(ws);
          return;
        }
        opts.onConnection?.(true, opts.label);
        opts.onOpen?.(ws);
        if (opts.ping && opts.pingMs) {
          clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocketBrowser.OPEN) opts.ping?.(ws);
          }, opts.pingMs);
        }
      });
      ws.on("message", (raw) => {
        const text = String(raw);
        if (text === "pong") return;
        if (text === "ping") {
          ws.send("pong");
          return;
        }
        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }
        opts.onMessage(msg, text);
      });
      const retry = () => {
        clearInterval(pingTimer);
        pingTimer = void 0;
        if (socket === ws) socket = null;
        if (stopped || opts.isStopped()) return;
        opts.onConnection?.(false, opts.label);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 2e3);
      };
      ws.on("close", retry);
      ws.on("error", () => {
        try {
          ws.close();
        } catch {
        }
      });
    };
    connect();
    return () => {
      stopped = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      const ws = socket;
      socket = null;
      safeCloseWebSocket(ws);
    };
  }
  function safeCloseWebSocket(ws) {
    if (!ws) return;
    try {
      ws.removeAllListeners("message");
      ws.removeAllListeners("open");
      ws.removeAllListeners("close");
      ws.removeAllListeners("ping");
      ws.removeAllListeners("pong");
      ws.removeAllListeners("error");
      ws.on("error", () => {
      });
      if (ws.readyState === WebSocketBrowser.CONNECTING) {
        ws.terminate();
      } else if (ws.readyState !== WebSocketBrowser.CLOSED) {
        ws.close();
      }
    } catch {
    }
  }

  // src/exchange/bitget-adapter.ts
  var BitgetAdapter = class {
    constructor(marketType) {
      this.marketType = marketType;
    }
    normalizeTrade(msg, instrument) {
      const side2 = msg.side.toLowerCase() === "sell" ? "SELL" : "BUY";
      return classifyTrade({
        symbol: canonicalFromVenue("bitget", instrument),
        marketType: this.marketType,
        timestamp: Number(msg.ts),
        price: Number(msg.price),
        quantity: Number(msg.size),
        aggressorSide: side2,
        tradeId: msg.tradeId
      });
    }
  };
  function parseBitgetTrade(row, _instrument) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const o = row;
      const price = String(o.price ?? o.p ?? "");
      const size = String(o.size ?? o.sz ?? "");
      const side2 = String(o.side ?? "");
      const ts = String(o.ts ?? o.T ?? "");
      if (!price || !size || !side2) return null;
      return { ts, price, size, side: side2, tradeId: String(o.tradeId ?? o.tid ?? ts) };
    }
    if (Array.isArray(row) && row.length >= 4) {
      const asStr = row.map((x) => String(x));
      const live = asStr[0] === "live" || asStr[0] === "snapshot";
      const parsed = live ? {
        ts: asStr[2] ?? "",
        price: asStr[3] ?? "",
        size: asStr[4] ?? "",
        side: asStr[5] ?? "",
        tradeId: asStr[2] ?? ""
      } : {
        ts: asStr[0] ?? "",
        price: asStr[1] ?? "",
        size: asStr[2] ?? "",
        side: asStr[3] ?? "",
        tradeId: asStr[4] ?? asStr[0] ?? ""
      };
      if (!parsed.price || !parsed.size || !parsed.side) return null;
      return parsed;
    }
    return null;
  }

  // src/exchange/bitstamp-adapter.ts
  var BitstampAdapter = class {
    constructor(marketType) {
      this.marketType = marketType;
    }
    normalizeTrade(msg, market) {
      const ts = msg.microtimestamp != null ? Math.floor(Number(msg.microtimestamp) / 1e3) : Number(msg.timestamp) * (String(msg.timestamp).length <= 10 ? 1e3 : 1);
      const side2 = Number(msg.type) === 1 ? "SELL" : "BUY";
      return classifyTrade({
        symbol: canonicalFromVenue("bitstamp", market),
        marketType: this.marketType,
        timestamp: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
        price: Number(msg.price),
        quantity: Number(msg.amount),
        aggressorSide: side2,
        tradeId: msg.id
      });
    }
  };

  // src/exchange/bybit-adapter.ts
  var BybitAdapter = class {
    constructor(marketType) {
      this.marketType = marketType;
    }
    normalizeTrade(msg) {
      const side2 = msg.S.toLowerCase() === "sell" ? "SELL" : "BUY";
      return classifyTrade({
        symbol: canonicalFromVenue("bybit", msg.s),
        marketType: this.marketType,
        timestamp: msg.T,
        price: Number(msg.p),
        quantity: Number(msg.v),
        aggressorSide: side2,
        tradeId: msg.i
      });
    }
  };

  // src/exchange/dydx-adapter.ts
  var DydxAdapter = class {
    constructor(marketType) {
      this.marketType = marketType;
    }
    normalizeTrade(msg, market = "") {
      const side2 = msg.side.toUpperCase() === "SELL" ? "SELL" : "BUY";
      return classifyTrade({
        symbol: canonicalFromVenue("dydx", market),
        marketType: this.marketType,
        timestamp: Date.parse(msg.createdAt) || Date.now(),
        price: Number(msg.price),
        quantity: Number(msg.size),
        aggressorSide: side2,
        tradeId: msg.id,
        isForced: msg.type === "LIQUIDATION" || msg.type === "LIQUIDATED"
      });
    }
  };

  // src/exchange/hyperliquid-adapter.ts
  var HyperliquidAdapter = class {
    constructor(marketType) {
      this.marketType = marketType;
    }
    normalizeTrade(msg) {
      const side2 = msg.side.toUpperCase() === "A" ? "SELL" : "BUY";
      return classifyTrade({
        symbol: canonicalFromVenue("hyperliquid", msg.coin),
        marketType: this.marketType,
        timestamp: msg.time,
        price: Number(msg.px),
        quantity: Number(msg.sz),
        aggressorSide: side2,
        tradeId: msg.tid ?? msg.hash
      });
    }
  };

  // src/exchange/okx-adapter.ts
  var OkxAdapter = class {
    constructor(marketType, contractValue = /* @__PURE__ */ new Map()) {
      this.marketType = marketType;
      this.contractValue = contractValue;
    }
    setContractValue(instId, ctVal) {
      this.contractValue.set(instId, ctVal);
    }
    normalizeTrade(msg) {
      const side2 = msg.side.toLowerCase() === "sell" ? "SELL" : "BUY";
      const ctVal = this.contractValue.get(msg.instId) ?? 1;
      return classifyTrade({
        symbol: canonicalFromVenue("okx", msg.instId),
        marketType: this.marketType,
        timestamp: Number(msg.ts),
        price: Number(msg.px),
        quantity: Number(msg.sz) * ctVal,
        aggressorSide: side2,
        tradeId: msg.tradeId
      });
    }
  };

  // src/live/venue-trades.ts
  var BYBIT_WS = {
    spot: "wss://stream.bybit.com/v5/public/spot",
    perp: "wss://stream.bybit.com/v5/public/linear"
  };
  var OKX_WS = "wss://ws.okx.com:8443/ws/v5/public";
  var BITGET_WS = "wss://ws.bitget.com/v2/ws/public";
  var HYPERLIQUID_WS = "wss://api.hyperliquid.xyz/ws";
  var DYDX_WS = "wss://indexer.dydx.trade/v4/ws";
  var BITSTAMP_WS = "wss://ws.bitstamp.net";
  var VenueTradeFan = class {
    constructor(coins, market, enabled, onTrade, onStatus) {
      this.coins = coins;
      this.market = market;
      this.enabled = enabled;
      this.onTrade = onTrade;
      this.onStatus = onStatus;
      const type = market === "spot" ? "spot" : "perp";
      this.bybit = new BybitAdapter(type);
      this.okx = new OkxAdapter(type);
      this.bitget = new BitgetAdapter(type);
      this.hyperliquid = new HyperliquidAdapter(type);
      this.dydx = new DydxAdapter(type);
      this.bitstamp = new BitstampAdapter(type);
    }
    stops = [];
    closed = false;
    bybit;
    okx;
    bitget;
    hyperliquid;
    dydx;
    bitstamp;
    start() {
      this.closed = false;
      const crypto = this.coins.filter((c) => c.venue !== "equity");
      if (!crypto.length) return;
      if (this.enabled.includes("bybit")) this.connectBybit(crypto);
      if (this.enabled.includes("okx")) this.connectOkx(crypto);
      if (this.enabled.includes("bitget")) this.connectBitget(crypto);
      if (this.enabled.includes("hyperliquid")) this.connectHyperliquid(crypto);
      if (this.enabled.includes("dydx")) this.connectDydx(crypto);
      if (this.enabled.includes("bitstamp")) this.connectBitstamp(crypto);
    }
    stop() {
      this.closed = true;
      while (this.stops.length) this.stops.pop()?.();
    }
    isStopped = () => this.closed;
    connectBybit(coins) {
      const args = coins.map((c) => `publicTrade.${c.symbol}`);
      const url = this.market === "spot" ? BYBIT_WS.spot : BYBIT_WS.perp;
      this.stops.push(
        openReconnectingJsonSocket({
          url,
          label: "bybit",
          pingMs: 2e4,
          ping: (ws) => ws.send(JSON.stringify({ op: "ping" })),
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("bybit", up),
          onOpen: (ws) => ws.send(JSON.stringify({ op: "subscribe", args })),
          onMessage: (msg) => {
            const payload = msg;
            if (!payload.topic?.startsWith("publicTrade.") || !Array.isArray(payload.data)) return;
            for (const row of payload.data) {
              if (!row?.p || !row?.v) continue;
              this.onTrade(this.bybit.normalizeTrade(row), "bybit");
            }
          }
        })
      );
    }
    connectOkx(coins) {
      const args = coins.map((c) => venueInstrument("okx", c.symbol, this.market)).filter((inst) => Boolean(inst)).map((instId) => ({ channel: "trades", instId }));
      void fetchOkxContractValues(this.market).then((map) => {
        for (const [instId, ctVal] of map) this.okx.setContractValue(instId, ctVal);
      }).catch(() => void 0);
      this.stops.push(
        openReconnectingJsonSocket({
          url: OKX_WS,
          label: "okx",
          pingMs: 2e4,
          ping: (ws) => ws.send("ping"),
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("okx", up),
          onOpen: (ws) => ws.send(JSON.stringify({ op: "subscribe", args })),
          onMessage: (msg) => {
            const payload = msg;
            if (payload.arg?.channel !== "trades" || !Array.isArray(payload.data)) return;
            for (const row of payload.data) {
              if (!row?.px || !row?.sz) continue;
              this.onTrade(this.okx.normalizeTrade(row), "okx");
            }
          }
        })
      );
    }
    connectBitget(coins) {
      const instType = this.market === "spot" ? "SPOT" : "USDT-FUTURES";
      const args = coins.map((c) => ({ instType, channel: "trade", instId: c.symbol }));
      this.stops.push(
        openReconnectingJsonSocket({
          url: BITGET_WS,
          label: "bitget",
          pingMs: 25e3,
          ping: (ws) => ws.send(JSON.stringify({ op: "ping" })),
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("bitget", up),
          onOpen: (ws) => ws.send(JSON.stringify({ op: "subscribe", args })),
          onMessage: (msg) => {
            const payload = msg;
            if (payload.arg?.channel !== "trade" || !Array.isArray(payload.data)) return;
            const inst = payload.arg.instId ?? "";
            for (const row of payload.data) {
              const parsed = parseBitgetTrade(row, inst);
              if (!parsed) continue;
              this.onTrade(this.bitget.normalizeTrade(parsed, inst), "bitget");
            }
          }
        })
      );
    }
    connectHyperliquid(coins) {
      const names = coins.map((c) => venueInstrument("hyperliquid", c.symbol, this.market)).filter((inst) => Boolean(inst));
      this.stops.push(
        openReconnectingJsonSocket({
          url: HYPERLIQUID_WS,
          label: "hyperliquid",
          pingMs: 2e4,
          ping: (ws) => ws.send(JSON.stringify({ method: "ping" })),
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("hyperliquid", up),
          onOpen: (ws) => {
            for (const coin of names) {
              ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin } }));
            }
          },
          onMessage: (msg) => {
            const payload = msg;
            if (payload.channel !== "trades" || !Array.isArray(payload.data)) return;
            for (const row of payload.data) {
              if (!row?.px || !row?.sz) continue;
              this.onTrade(this.hyperliquid.normalizeTrade(row), "hyperliquid");
            }
          }
        })
      );
    }
    connectDydx(coins) {
      const markets = coins.map((c) => venueInstrument("dydx", c.symbol, this.market)).filter((inst) => Boolean(inst));
      this.stops.push(
        openReconnectingJsonSocket({
          url: DYDX_WS,
          label: "dydx",
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("dydx", up),
          onOpen: (ws) => {
            for (const id of markets) {
              ws.send(JSON.stringify({ type: "subscribe", channel: "v4_trades", id, batched: true }));
            }
          },
          onMessage: (msg) => {
            const payload = msg;
            if (payload.channel !== "v4_trades") return;
            const market = payload.id ?? "";
            for (const row of dydxTradeRows(payload.contents)) {
              if (!row?.price || !row?.size) continue;
              this.onTrade(this.dydx.normalizeTrade(row, market), "dydx");
            }
          }
        })
      );
    }
    connectBitstamp(coins) {
      const markets = coins.map((c) => venueInstrument("bitstamp", c.symbol, this.market)).filter((inst) => Boolean(inst));
      this.stops.push(
        openReconnectingJsonSocket({
          url: BITSTAMP_WS,
          label: "bitstamp",
          isStopped: this.isStopped,
          onConnection: (up) => this.onStatus("bitstamp", up),
          onOpen: (ws) => {
            for (const market of markets) {
              ws.send(JSON.stringify({ event: "bts:subscribe", data: { channel: `live_trades_${market}` } }));
            }
          },
          onMessage: (msg) => {
            const payload = msg;
            if (payload.event !== "trade" || !payload.data) return;
            const market = String(payload.channel ?? "").replace(/^live_trades_/, "");
            this.onTrade(this.bitstamp.normalizeTrade(payload.data, market), "bitstamp");
          }
        })
      );
    }
  };
  function dydxTradeRows(contents) {
    const out = [];
    const take = (block) => {
      if (!block || typeof block !== "object") return;
      const trades = block.trades;
      if (Array.isArray(trades)) out.push(...trades);
    };
    if (Array.isArray(contents)) {
      for (const block of contents) take(block);
    } else {
      take(contents);
    }
    return out;
  }

  // src/live/live-feed.ts
  var BOOK_DEPTH = 500;
  function stripPassive(snapshot) {
    const { passiveLiquidity: _passiveLiquidity, ...wire } = snapshot;
    return wire;
  }
  var LiveBinanceFeed = class {
    constructor(config) {
      this.config = config;
      this.engine = new OrderFlowEngine();
      this.coins = config.coins;
      this.exchanges = config.exchanges?.length ? config.exchanges : parseExchangesEnv();
      this.engineTradeVenues = config.engineTradeVenues?.length ? config.engineTradeVenues : ["binance"];
      for (const coin of this.coins) {
        this.engine.getSymbol(coin.symbol, config.market);
        this.tradeCount.set(coin.symbol, 0);
        this.lastStates.set(coin.symbol, {});
      }
      this.engine.on((ev) => {
        if (ev.kind === "large_trade") {
          const e = ev.event;
          this.emit({
            type: "large_trade",
            symbol: e.symbol,
            side: e.type.includes("BUY") ? "BUY" : "SELL",
            quoteValue: e.quoteValue,
            price: e.price,
            tier: e.tier,
            relativeClass: e.relativeClass
          });
        }
        if (ev.kind === "burst") {
          this.emit({
            type: "burst",
            symbol: ev.symbol,
            side: ev.burst.side,
            totalQuoteValue: ev.burst.totalQuoteValue,
            tradeCount: ev.burst.tradeCount,
            durationMs: ev.burst.endTime - ev.burst.startTime
          });
        }
        if (ev.kind === "alert") {
          this.emit({
            type: "alert",
            symbol: ev.alert.symbol,
            alertType: ev.alert.type,
            message: ev.alert.message
          });
        }
        if (ev.kind === "move_potential" && ev.events.length) {
          const sig = [...ev.events].sort().join(",");
          if (sig !== this.lastMoveEvents.get(ev.symbol)) {
            this.lastMoveEvents.set(ev.symbol, sig);
            this.emit({ type: "move_potential", symbol: ev.symbol, events: ev.events });
          }
        }
      });
    }
    engine;
    coins;
    exchanges;
    sockets = [];
    closed = false;
    lastSummary = 0;
    lastBookEmit = /* @__PURE__ */ new Map();
    /** Diffs received before the REST depth snapshot is applied. */
    depthBuffers = /* @__PURE__ */ new Map();
    depthSynced = /* @__PURE__ */ new Set();
    depthSyncing = /* @__PURE__ */ new Set();
    tradeCount = /* @__PURE__ */ new Map();
    lastMoveEvents = /* @__PURE__ */ new Map();
    lastStates = /* @__PURE__ */ new Map();
    listeners = /* @__PURE__ */ new Set();
    rawTradeListeners = /* @__PURE__ */ new Set();
    rawLiqListeners = /* @__PURE__ */ new Set();
    spot = new BinanceSpotAdapter();
    futures = new BinanceFuturesAdapter();
    venueUp = {};
    venues = null;
    /** Venues whose trades reach the analysis engine. */
    engineTradeVenues;
    lastEngineTradeAt = /* @__PURE__ */ new Map();
    startedAt = Date.now();
    fallbackAnnounced = false;
    on(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    onAnyTrade(listener) {
      this.rawTradeListeners.add(listener);
      return () => this.rawTradeListeners.delete(listener);
    }
    onAnyLiquidation(listener) {
      this.rawLiqListeners.add(listener);
      return () => this.rawLiqListeners.delete(listener);
    }
    start() {
      this.closed = false;
      this.connect();
      const extra = this.exchanges.filter((id) => id !== "binance");
      if (extra.length) {
        this.venues = new VenueTradeFan(
          this.coins,
          this.config.market,
          extra,
          (trade, exchange) => this.handleVenueTrade(trade, exchange),
          (exchange, connected) => this.setVenueUp(exchange, connected)
        );
        this.venues.start();
      }
    }
    stop() {
      this.closed = true;
      this.venues?.stop();
      this.venues = null;
      this.closeSockets();
      this.emit({ type: "status", connected: false, message: "Stopped" });
    }
    closeSockets() {
      for (const ws of this.sockets.splice(0)) {
        safeCloseWebSocket(ws);
      }
    }
    connect() {
      this.closeSockets();
      this.resetDepthSync();
      this.emit({ type: "status", connected: false, message: "Connecting\u2026" });
      const { market } = this.config;
      const tradeChannel = market === "spot" ? "aggTrade" : "trade";
      if (market === "spot") {
        this.openCombined(BINANCE_SPOT_WS, this.coins, tradeChannel, "spot");
        this.openSocket(`${BINANCE_SPOT_WS}?streams=${this.depthList(this.coins)}`, "spot book");
      } else {
        const crypto = this.coins.filter((c) => c.venue !== "equity");
        const equity = this.coins.filter((c) => c.venue === "equity");
        if (crypto.length) {
          this.openCombined(BINANCE_FUTURES_WS, crypto, "trade", "crypto perp");
          this.openSocket(`${BINANCE_FUTURES_WS}?streams=${this.depthList(crypto)}`, "crypto book");
          this.openSocket(`${BINANCE_FUTURES_WS}?streams=!forceOrder@arr`, "liquidations");
        }
        if (equity.length) {
          this.openRawCombined(equity, "trade", "equity perp");
          this.openSocket(`${BINANCE_FUTURES_WS}?streams=${this.depthList(equity)}`, "equity book");
        }
      }
      if (this.config.depthMode !== "partial-ws") {
        this.coins.forEach((coin, i) => {
          setTimeout(() => {
            if (!this.closed) void this.syncSymbolBook(coin.symbol);
          }, i * 200);
        });
      }
    }
    resetDepthSync() {
      this.depthBuffers.clear();
      this.depthSynced.clear();
      this.depthSyncing.clear();
    }
    streamList(coins, tradeChannel) {
      return coins.map((c) => streamName(c.symbol, tradeChannel)).join("/");
    }
    depthList(coins) {
      const channel = this.config.depthMode === "partial-ws" ? "depth20@100ms" : "depth@100ms";
      return coins.map((c) => streamName(c.symbol, channel)).join("/");
    }
    openCombined(base, coins, tradeChannel, label) {
      this.openSocket(`${base}?streams=${this.streamList(coins, tradeChannel)}`, label);
    }
    openRawCombined(coins, tradeChannel, label) {
      this.openSocket(`${BINANCE_FUTURES_WS_RAW}/${this.streamList(coins, tradeChannel)}`, label);
    }
    openSocket(url, label) {
      const ws = new WebSocketBrowser(url);
      this.sockets.push(ws);
      ws.on("open", () => this.setVenueUp("binance", true));
      ws.on("message", (raw) => this.onSocketMessage(raw));
      ws.on("close", () => {
        const idx = this.sockets.indexOf(ws);
        if (idx >= 0) this.sockets.splice(idx, 1);
        if (this.closed) return;
        if (this.sockets.length === 0) this.setVenueUp("binance", false);
        setTimeout(() => {
          if (!this.closed) this.openSocket(url, label);
        }, 2e3);
      });
      ws.on("error", () => {
        try {
          if (ws.readyState === WebSocketBrowser.OPEN || ws.readyState === WebSocketBrowser.CONNECTING) {
            safeCloseWebSocket(ws);
          }
        } catch {
        }
      });
    }
    onSocketMessage(raw) {
      const { market } = this.config;
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const stream = String(msg.stream ?? "");
      const data = unwrapBinancePayload(msg);
      if (!data) return;
      const event = data.e;
      const symbol = String(data.s ?? stream.split("@")[0] ?? "").toUpperCase();
      if (this.config.depthMode === "partial-ws") {
        const bids = Array.isArray(data.bids) ? data.bids : data.b;
        const asks = Array.isArray(data.asks) ? data.asks : data.a;
        const isPartialStream = stream.includes("depth20") || stream.includes("@depth");
        if (isPartialStream && Array.isArray(bids) && Array.isArray(asks)) {
          const sym = symbol || String(data.s ?? "").toUpperCase();
          this.applyPartialBookSnapshot(sym, {
            lastUpdateId: data.lastUpdateId ?? data.u,
            bids,
            asks
          });
          const nowPartial = Date.now();
          if (nowPartial - this.lastSummary >= this.config.summaryMs) {
            this.lastSummary = nowPartial;
            this.emitAllSummaries(nowPartial);
          }
          return;
        }
      }
      if (event === "depthUpdate" && Array.isArray(data.b) && Array.isArray(data.a)) {
        this.onDepthDiff(data);
      }
      if (event === "forceOrder" || stream.includes("forceOrder")) {
        const raw2 = data.o ? data : { e: "forceOrder", E: Date.now(), o: data };
        if (raw2?.o?.s) {
          const liq = this.futures.normalizeForceOrder(raw2);
          if (this.coins.some((c) => c.symbol === liq.symbol)) {
            this.engine.ingestLiquidation(liq);
            for (const listener of this.rawLiqListeners) {
              try {
                listener(liq);
              } catch (err) {
                console.error("[feed] liquidation listener failed:", err instanceof Error ? err.message : err);
              }
            }
          }
        }
      }
      if (!symbol) return;
      if (event === "aggTrade") {
        const trade = market === "spot" ? this.spot.normalizeAggTrade(data) : this.futures.normalizeAggTrade(data);
        this.handleTrade(trade);
      }
      if (event === "trade") {
        const trade = market === "spot" ? this.spot.normalizeTrade(data) : this.futures.normalizeTrade(data);
        this.handleTrade(trade);
      }
      if (event === "bookTicker" || stream.includes("bookTicker")) return;
      const now = Date.now();
      if (now - this.lastSummary >= this.config.summaryMs) {
        this.lastSummary = now;
        this.emitAllSummaries(now);
      }
    }
    /**
     * Whether this venue's trades should reach the analysis engine.
     *
     * Normally only the configured venues do. If the primary has gone silent for
     * longer than the fallback window, the fallback venue is admitted too, so a
     * blocked or broken primary degrades the read instead of blanking it.
     */
    feedsEngine(exchange) {
      if (this.engineTradeVenues.includes(exchange)) return true;
      const fallback = this.config.engineTradeFallback;
      const windowMs = this.config.engineTradeFallbackMs ?? 0;
      if (!fallback || windowMs <= 0 || exchange !== fallback) return false;
      const primaryAt = Math.max(
        0,
        ...this.engineTradeVenues.map((id) => this.lastEngineTradeAt.get(id) ?? 0)
      );
      const silent = primaryAt === 0 ? this.startedAt : primaryAt;
      if (Date.now() - silent <= windowMs) return false;
      if (!this.fallbackAnnounced) {
        this.fallbackAnnounced = true;
        console.warn(
          `[feed] ${this.config.market}: no trades from ${this.engineTradeVenues.join("/")} for ${Math.round(windowMs / 1e3)}s \u2014 feeding the engine from ${fallback} instead.`
        );
      }
      return true;
    }
    applyPartialBookSnapshot(symbol, data) {
      if (!symbol || !this.coins.some((c) => c.symbol === symbol)) return;
      const market = this.config.market === "spot" ? "spot" : "perp";
      const adapter = market === "spot" ? this.spot : this.futures;
      const snapshot = adapter.normalizeDepthSnapshot(
        symbol,
        {
          lastUpdateId: Number(data.lastUpdateId ?? 0),
          bids: data.bids,
          asks: data.asks
        },
        Date.now()
      );
      this.engine.ingestBookSnapshot(snapshot);
      this.engine.getSymbol(symbol, market).book.retainNearest(20);
      this.depthSynced.add(symbol);
      this.emitLocalBook(symbol, true);
    }
    onDepthDiff(msg) {
      const symbol = String(msg.s || "").toUpperCase();
      if (!symbol || !this.coins.some((c) => c.symbol === symbol)) return;
      if (this.config.depthMode === "partial-ws") {
        this.applyPartialBookSnapshot(symbol, {
          lastUpdateId: msg.u,
          bids: msg.b,
          asks: msg.a
        });
        return;
      }
      if (!this.depthSynced.has(symbol)) {
        const buf = this.depthBuffers.get(symbol) ?? [];
        buf.push(msg);
        if (buf.length > 800) buf.splice(0, buf.length - 800);
        this.depthBuffers.set(symbol, buf);
        if (!this.depthSyncing.has(symbol)) void this.syncSymbolBook(symbol);
        return;
      }
      this.applyDepthDiff(msg);
    }
    /**
     * Binance has no depth500 websocket. Seed REST `/depth?limit=500`, then
     * apply `@depth@100ms` diffs so the ladder stays 500 levels deep.
     */
    async syncSymbolBook(symbol) {
      if (this.config.depthMode === "partial-ws") return;
      if (typeof globalThis.window !== "undefined") return;
      if (this.closed || this.depthSyncing.has(symbol)) return;
      if (!this.coins.some((c) => c.symbol === symbol)) return;
      this.depthSyncing.add(symbol);
      this.depthSynced.delete(symbol);
      const market = this.config.market === "spot" ? "spot" : "perp";
      try {
        const fetchDepth = this.config.fetchDepth ?? fetchVenueDepth;
        const raw = await fetchDepth("binance", symbol, market, BOOK_DEPTH);
        if (this.closed) return;
        if (!raw.bids.length && !raw.asks.length) throw new Error("empty depth");
        const adapter = market === "spot" ? this.spot : this.futures;
        const snapshot = adapter.normalizeDepthSnapshot(
          symbol,
          { lastUpdateId: raw.lastUpdateId ?? 0, bids: raw.bids, asks: raw.asks },
          Date.now()
        );
        const lastId = snapshot.lastUpdateId ?? 0;
        const buffered = this.depthBuffers.get(symbol) ?? [];
        const start = buffered.findIndex(
          (e) => market === "spot" ? e.U <= lastId + 1 && e.u >= lastId + 1 : e.U <= lastId && e.u >= lastId
        );
        this.engine.ingestBookSnapshot(snapshot);
        this.engine.getSymbol(symbol, market).book.retainNearest(BOOK_DEPTH);
        this.depthBuffers.set(symbol, []);
        if (start < 0) {
          const newer = buffered.filter((e) => e.u > lastId);
          if (newer.length === 0) {
            this.depthSynced.add(symbol);
            this.emitLocalBook(symbol, true);
            return;
          }
          this.depthBuffers.set(symbol, newer.slice(-800));
          setTimeout(() => {
            if (!this.closed) void this.syncSymbolBook(symbol);
          }, 400);
          return;
        }
        this.depthSynced.add(symbol);
        for (const ev of buffered.slice(start)) {
          if (!this.depthSynced.has(symbol)) break;
          if (!this.applyDepthDiff(ev, false)) break;
        }
        if (this.depthSynced.has(symbol)) this.emitLocalBook(symbol, true);
        else {
          setTimeout(() => {
            if (!this.closed) void this.syncSymbolBook(symbol);
          }, 400);
        }
      } catch (err) {
        console.warn(
          `[feed] depth ${BOOK_DEPTH} snapshot failed for ${symbol}:`,
          err instanceof Error ? err.message : err
        );
        setTimeout(() => {
          if (!this.closed) void this.syncSymbolBook(symbol);
        }, 2e3);
      } finally {
        this.depthSyncing.delete(symbol);
      }
    }
    applyDepthDiff(msg, resync = true) {
      const market = this.config.market === "spot" ? "spot" : "perp";
      const delta = market === "spot" ? this.spot.normalizeDepthDelta(msg) : this.futures.normalizeDepthDelta(msg);
      const book = this.engine.getSymbol(delta.symbol, market).book;
      const prevId = book.lastUpdateId;
      if (msg.pu != null && prevId && msg.pu > prevId) {
        this.depthSynced.delete(delta.symbol);
        if (resync && !this.depthSyncing.has(delta.symbol)) void this.syncSymbolBook(delta.symbol);
        return false;
      }
      this.engine.ingestBookDelta(delta);
      if (book.stale) {
        book.stale = false;
        this.depthSynced.delete(delta.symbol);
        if (resync && !this.depthSyncing.has(delta.symbol)) void this.syncSymbolBook(delta.symbol);
        return false;
      }
      book.retainNearest(BOOK_DEPTH);
      this.emitLocalBook(delta.symbol);
      return true;
    }
    emitLocalBook(symbol, force = false) {
      const now = Date.now();
      if (!force && now - (this.lastBookEmit.get(symbol) ?? 0) < 300) return;
      this.lastBookEmit.set(symbol, now);
      const market = this.config.market === "spot" ? "spot" : "perp";
      const book = this.engine.getSymbol(symbol, market).book;
      const bids = book.sortedLevels("bid").slice(0, BOOK_DEPTH);
      const asks = book.sortedLevels("ask").slice(0, BOOK_DEPTH);
      if (!bids.length && !asks.length) return;
      const bestBid = bids[0]?.price ?? 0;
      const bestAsk = asks[0]?.price ?? 0;
      const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
      this.emit({
        type: "book",
        symbol,
        bids,
        asks,
        mid,
        spread: bestBid && bestAsk ? bestAsk - bestBid : 0,
        bidTotal: bids.reduce((s, l) => s + l.quoteValue, 0),
        askTotal: asks.reduce((s, l) => s + l.quoteValue, 0)
      });
    }
    handleTrade(trade, exchange = "binance") {
      if (!this.coins.some((c) => c.symbol === trade.symbol)) return;
      if (this.feedsEngine(exchange)) {
        this.engine.ingestTrade(trade);
        this.lastEngineTradeAt.set(exchange, Date.now());
      }
      const seqKey = `${exchange}:${trade.symbol}`;
      const next = (this.tradeCount.get(seqKey) ?? 0) + 1;
      this.tradeCount.set(seqKey, next);
      if (exchange === "binance") this.tradeCount.set(trade.symbol, next);
      for (const listener of this.rawTradeListeners) {
        try {
          listener(trade, exchange);
        } catch (err) {
          console.error("[feed] raw trade listener failed:", err instanceof Error ? err.message : err);
        }
      }
      const floor = minUsdFor(trade.symbol, this.coins);
      if (trade.quoteValue < floor) return;
      let relativeClass = "NORMAL";
      let tier = null;
      let tag = "";
      if (exchange === "binance") {
        const engine2 = this.engine.getSymbol(trade.symbol, this.config.market);
        const rel = engine2.largeTrades.relativeSize(trade.quoteValue);
        tier = engine2.largeTrades.absoluteTier(trade.quoteValue);
        relativeClass = rel.classification;
        tag = relativeClass !== "NORMAL" ? relativeClass : "";
        if (tier) tag = tag ? `${tag} T${tier}` : `T${tier}`;
      }
      this.emit({
        type: "trade",
        trade: {
          id: `${exchange}-${trade.symbol}-${trade.tradeId ?? trade.timestamp}-${next}`,
          symbol: trade.symbol,
          timestamp: trade.timestamp,
          side: trade.side,
          price: trade.price,
          quoteValue: trade.quoteValue,
          tag,
          relativeClass,
          tier,
          exchange,
          market: this.config.market
        }
      });
    }
    handleVenueTrade(trade, exchange) {
      if (this.coins.some((c) => c.symbol === trade.symbol && c.venue === "equity")) return;
      this.handleTrade(trade, exchange);
    }
    setVenueUp(exchange, connected) {
      this.venueUp[exchange] = connected;
      const live = this.exchanges.filter((id) => this.venueUp[id]).map((id) => EXCHANGE_LABELS[id]);
      this.emit({
        type: "status",
        connected: live.length > 0,
        message: live.length ? `Live \xB7 ${live.join(" \xB7 ")}` : `Disconnected (${EXCHANGE_LABELS[exchange]}) \u2014 reconnecting\u2026`
      });
    }
    emitAllSummaries(now) {
      const overview = [];
      for (const coin of this.coins) {
        const engine2 = this.engine.getSymbol(coin.symbol, this.config.market);
        const full = {
          "10s": engine2.snapshot("10s", now),
          "30s": engine2.snapshot("30s", now),
          "1m": engine2.snapshot("1m", now),
          "5m": engine2.snapshot("5m", now),
          "15m": engine2.snapshot("15m", now)
        };
        const windows = {
          "10s": stripPassive(full["10s"]),
          "30s": stripPassive(full["30s"]),
          "1m": stripPassive(full["1m"]),
          "5m": stripPassive(full["5m"]),
          "15m": stripPassive(full["15m"])
        };
        const passive = full["1m"].passiveLiquidity;
        if (passive.mid > 0) {
          this.emit({ type: "passive_liquidity", symbol: coin.symbol, snapshot: passive });
        }
        const states = this.lastStates.get(coin.symbol) ?? {};
        for (const key3 of ["10s", "1m", "5m"]) {
          const w = full[key3];
          const prev = states[key3] ?? null;
          if (w.state !== prev && w.state !== "NO_SIGNAL" && isVolatileWindow(w)) {
            this.emit({
              type: "state_change",
              symbol: coin.symbol,
              window: key3,
              state: w.state,
              delta: w.delta,
              previousState: prev
            });
          }
          states[key3] = w.state;
        }
        this.lastStates.set(coin.symbol, states);
        overview.push({
          symbol: coin.symbol,
          label: coin.label,
          price: windows["10s"].price,
          delta10s: windows["10s"].delta,
          state10s: windows["10s"].state
        });
        this.emit({
          type: "summary",
          summary: {
            timestamp: now,
            symbol: coin.symbol,
            market: this.config.market,
            price: windows["10s"].price,
            tradeCount: this.tradeCount.get(coin.symbol) ?? 0,
            windows
          }
        });
      }
      this.emit({ type: "overview", coins: overview });
    }
    emit(event) {
      const tagged = { ...event, market: this.config.market === "spot" ? "spot" : "perp" };
      for (const l of this.listeners) l(tagged);
    }
  };

  // src/pattern-recognition/pattern-types.ts
  var PATTERN_ENGINE_VERSION = "pattern-recognition/v1.2.0";
  var CANDLE_LABELS = [
    "BUYER_IN_CONTROL",
    "SELLER_IN_CONTROL",
    "STOP_HUNT_LOW",
    "STOP_HUNT_HIGH",
    "BUYER_ABSORBED",
    "SELLER_ABSORBED",
    "ASKS_PULLED",
    "BIDS_PULLED",
    "UNCLASSIFIED"
  ];

  // src/pattern-recognition/pattern-definitions.ts
  var PATTERN_LIBRARY_VERSION = 2;
  var PATTERN_DEFINITIONS = [
    {
      id: "BULLISH_LIQUIDITY_REVERSAL",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BULLISH",
      title: "Bullish Liquidity Reversal",
      badge: "BR",
      minBars: 4,
      maxBars: 6,
      specificity: 80,
      supersedes: ["SELLER_TRAP_FORMING"],
      minFormingStages: 2,
      failWhen: {
        minStage: 2,
        control: ["SELLER_IN_CONTROL"],
        specialEvent: ["BUYER_ABSORBED"],
        labels: ["SELLER_IN_CONTROL", "BUYER_ABSORBED"]
      },
      stages: [
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"], repeat: true },
        { liquidity: ["BIDS_PULLED"], labels: ["BIDS_PULLED"], optional: true },
        { specialEvent: ["STOP_HUNT_LOW"], labels: ["STOP_HUNT_LOW"] },
        { liquidity: ["BIDS_PULLED"], labels: ["BIDS_PULLED"], optional: true },
        { specialEvent: ["SELLER_ABSORBED"], labels: ["SELLER_ABSORBED"] },
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"] }
      ]
    },
    {
      id: "BEARISH_LIQUIDITY_REVERSAL",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BEARISH",
      title: "Bearish Liquidity Reversal",
      badge: "ER",
      minBars: 4,
      maxBars: 6,
      specificity: 80,
      supersedes: ["BUYER_TRAP_FORMING"],
      minFormingStages: 2,
      failWhen: {
        minStage: 2,
        control: ["BUYER_IN_CONTROL"],
        specialEvent: ["SELLER_ABSORBED"],
        labels: ["BUYER_IN_CONTROL", "SELLER_ABSORBED"]
      },
      stages: [
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"], repeat: true },
        { liquidity: ["ASKS_PULLED"], labels: ["ASKS_PULLED"], optional: true },
        { specialEvent: ["STOP_HUNT_HIGH"], labels: ["STOP_HUNT_HIGH"] },
        { liquidity: ["ASKS_PULLED"], labels: ["ASKS_PULLED"], optional: true },
        { specialEvent: ["BUYER_ABSORBED"], labels: ["BUYER_ABSORBED"] },
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"] }
      ]
    },
    {
      id: "BULLISH_CONTINUATION",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BULLISH",
      title: "Bullish Continuation",
      badge: "BC",
      minBars: 3,
      maxBars: 6,
      specificity: 50,
      minFormingStages: 2,
      failWhen: {
        minStage: 2,
        control: ["SELLER_IN_CONTROL"],
        specialEvent: ["BUYER_ABSORBED"],
        labels: ["SELLER_IN_CONTROL", "BUYER_ABSORBED"]
      },
      stages: [
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"], repeat: true },
        { liquidity: ["ASKS_PULLED"], labels: ["ASKS_PULLED"], repeat: true },
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"], repeat: true }
      ]
    },
    {
      id: "BEARISH_CONTINUATION",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BEARISH",
      title: "Bearish Continuation",
      badge: "SC",
      minBars: 3,
      maxBars: 6,
      specificity: 50,
      minFormingStages: 2,
      failWhen: {
        minStage: 2,
        control: ["BUYER_IN_CONTROL"],
        specialEvent: ["SELLER_ABSORBED"],
        labels: ["BUYER_IN_CONTROL", "SELLER_ABSORBED"]
      },
      stages: [
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"], repeat: true },
        { liquidity: ["BIDS_PULLED"], labels: ["BIDS_PULLED"], repeat: true },
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"], repeat: true }
      ]
    },
    {
      id: "FAILED_BEARISH_REVERSAL",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BULLISH",
      title: "Failed Bearish Reversal",
      badge: "FB",
      minBars: 3,
      maxBars: 5,
      specificity: 70,
      minFormingStages: 2,
      failWhen: { minStage: 2, control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"] },
      stages: [
        { specialEvent: ["STOP_HUNT_HIGH"], labels: ["STOP_HUNT_HIGH"] },
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"], repeat: true },
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"] }
      ]
    },
    {
      id: "FAILED_BULLISH_REVERSAL",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BEARISH",
      title: "Failed Bullish Reversal",
      badge: "FU",
      minBars: 3,
      maxBars: 5,
      specificity: 70,
      minFormingStages: 2,
      failWhen: { minStage: 2, control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"] },
      stages: [
        { specialEvent: ["STOP_HUNT_LOW"], labels: ["STOP_HUNT_LOW"] },
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"], repeat: true },
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"] }
      ]
    },
    {
      id: "BUYER_TRAP_FORMING",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BEARISH",
      title: "Buyer Trap Forming",
      badge: "BT",
      minBars: 3,
      maxBars: 6,
      specificity: 40,
      completesOnMatch: false,
      minFormingStages: 3,
      failWhen: { minStage: 2, control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"] },
      stages: [
        { control: ["BUYER_IN_CONTROL"], labels: ["BUYER_IN_CONTROL"], repeat: true },
        { liquidity: ["ASKS_PULLED"], labels: ["ASKS_PULLED"], optional: true },
        { specialEvent: ["STOP_HUNT_HIGH"], labels: ["STOP_HUNT_HIGH"] },
        { liquidity: ["ASKS_PULLED"], labels: ["ASKS_PULLED"], optional: true },
        { specialEvent: ["BUYER_ABSORBED"], labels: ["BUYER_ABSORBED"] }
      ]
    },
    {
      id: "SELLER_TRAP_FORMING",
      version: PATTERN_LIBRARY_VERSION,
      direction: "BULLISH",
      title: "Seller Trap Forming",
      badge: "SR",
      minBars: 3,
      maxBars: 6,
      specificity: 40,
      completesOnMatch: false,
      minFormingStages: 3,
      failWhen: { minStage: 2, control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"] },
      stages: [
        { control: ["SELLER_IN_CONTROL"], labels: ["SELLER_IN_CONTROL"], repeat: true },
        { liquidity: ["BIDS_PULLED"], labels: ["BIDS_PULLED"], optional: true },
        { specialEvent: ["STOP_HUNT_LOW"], labels: ["STOP_HUNT_LOW"] },
        { liquidity: ["BIDS_PULLED"], labels: ["BIDS_PULLED"], optional: true },
        { specialEvent: ["SELLER_ABSORBED"], labels: ["SELLER_ABSORBED"] }
      ]
    }
  ];
  function patternVersionTag(id, version) {
    return `${id}:v${version}`;
  }
  function requiredStageCount(def) {
    return def.stages.filter((s) => !s.optional).length;
  }

  // src/pattern-recognition/pattern-confidence.ts
  function scorePatternConfidence(def, candles, requiredMatched, statusIsComplete) {
    const totalRequired = Math.max(1, requiredStageCount(def));
    const stageCompletion = statusIsComplete ? 1 : clamp(requiredMatched / totalRequired, 0, 1);
    const labelConfidence = meanLabelConfidence(candles);
    const { supporting, conflict, sweepQuality, controlShift } = supportingEvidence(def, candles);
    const components = {
      stageCompletion,
      labelConfidence,
      supportingEvidence: supporting,
      conflictPenalty: conflict
    };
    const raw = 100 * labelConfidence * supporting * conflict;
    const confidence = Math.round(clamp(raw, 0, 100));
    return {
      confidence,
      evidence: {
        labelConfidence,
        sweepQuality,
        controlShift,
        supportingEvidence: supporting,
        conflictPenalty: conflict,
        components
      }
    };
  }
  function meanLabelConfidence(candles) {
    if (!candles.length) return 0.7;
    const values = candles.map((c) => {
      if (c.labelConfidence == null || !Number.isFinite(c.labelConfidence)) return 0.7;
      return clamp(c.labelConfidence, 0, 1);
    });
    return values.reduce((s, v) => s + v, 0) / values.length;
  }
  function supportingEvidence(def, candles) {
    const byLabel = groupByLabel(candles);
    const scores = [];
    const conflicts = [];
    const huntLow = lastOf(byLabel, "STOP_HUNT_LOW");
    const huntHigh = lastOf(byLabel, "STOP_HUNT_HIGH");
    const sellerAbs = lastOf(byLabel, "SELLER_ABSORBED");
    const buyerAbs = lastOf(byLabel, "BUYER_ABSORBED");
    const buyerCtrl = lastOf(byLabel, "BUYER_IN_CONTROL");
    const sellerCtrl = lastOf(byLabel, "SELLER_IN_CONTROL");
    if (def.direction === "BULLISH") {
      pushPos(scores, huntLow?.sweepQuality);
      pushPos(scores, sellerAbs?.passiveBuyerDefense);
      pushPos(scores, sellerAbs?.bidReplenishment);
      pushPos(scores, buyerCtrl?.aggressiveBuyPower);
      pushPos(scores, buyerCtrl?.upsideBattleSpread);
      pushNeg(conflicts, sellerAbs?.aggressiveSellPower);
      pushNeg(conflicts, buyerCtrl?.aggressiveSellPower);
      pushNeg(conflicts, huntLow && invert(huntLow.sweepQuality));
    }
    if (def.direction === "BEARISH") {
      pushPos(scores, huntHigh?.sweepQuality);
      pushPos(scores, buyerAbs?.passiveSellerDefense);
      pushPos(scores, buyerAbs?.askReplenishment);
      pushPos(scores, sellerCtrl?.aggressiveSellPower);
      pushPos(scores, sellerCtrl?.downsideBattleSpread);
      pushNeg(conflicts, buyerAbs?.aggressiveBuyPower);
      pushNeg(conflicts, sellerCtrl?.aggressiveBuyPower);
    }
    const last = candles[candles.length - 1];
    if (def.direction === "BULLISH") {
      pushPos(scores, last?.upsideFuel);
      if ((last?.upsideFuelVelocity ?? 0) > 0) pushPos(scores, last?.upsideFuel);
    }
    if (def.direction === "BEARISH") {
      pushPos(scores, last?.downsideFuel);
      if ((last?.downsideFuelVelocity ?? 0) > 0) pushPos(scores, last?.downsideFuel);
    }
    const supporting = scores.length ? clamp(0.85 + 0.3 * mean(scores), 0.75, 1.15) : 1;
    const conflict = conflicts.length ? clamp(1 - 0.35 * mean(conflicts), 0.55, 1) : 1;
    const sweepQuality = huntLow?.sweepQuality ?? huntHigh?.sweepQuality ?? null;
    const controlShift = controlShiftScore(candles);
    return { supporting, conflict, sweepQuality, controlShift };
  }
  function controlShiftScore(candles) {
    if (candles.length < 2) return null;
    const first = candles[0];
    const last = candles[candles.length - 1];
    const buyShift = (last.aggressiveBuyPower ?? 50) - (first.aggressiveBuyPower ?? 50);
    const sellShift = (last.aggressiveSellPower ?? 50) - (first.aggressiveSellPower ?? 50);
    if (first.aggressiveBuyPower == null && last.aggressiveBuyPower == null && first.aggressiveSellPower == null && last.aggressiveSellPower == null) {
      return null;
    }
    return clamp(50 + (buyShift - sellShift) / 2, 0, 100);
  }
  function groupByLabel(candles) {
    const map = /* @__PURE__ */ new Map();
    for (const c of candles) {
      const list = map.get(c.label) ?? [];
      list.push(c);
      map.set(c.label, list);
    }
    return map;
  }
  function lastOf(map, label) {
    const list = map.get(label);
    return list?.[list.length - 1];
  }
  function pushPos(into, raw) {
    const n = toUnit(raw);
    if (n != null) into.push(n);
  }
  function pushNeg(into, raw) {
    const n = toUnit(raw);
    if (n != null) into.push(n);
  }
  function invert(raw) {
    const n = toUnit(raw);
    return n == null ? null : 1 - n;
  }
  function toUnit(raw) {
    if (raw == null || !Number.isFinite(raw)) return null;
    if (raw < 0) return 0;
    if (raw <= 1) return raw;
    return clamp(raw / 100, 0, 1);
  }
  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }
  function withScoredCandidate(def, partial, candles, requiredMatched) {
    const complete = partial.status === "CONFIRMED" || partial.status === "FORMING" && def.completesOnMatch === false && partial.progress >= 1;
    const { confidence, evidence } = scorePatternConfidence(def, candles, requiredMatched, complete || partial.progress >= 1);
    return {
      id: def.id,
      version: def.version,
      patternVersion: patternVersionTag(def.id, def.version),
      direction: def.direction,
      title: def.title,
      badge: def.badge,
      ...partial,
      confidence,
      evidence
    };
  }

  // src/pattern-recognition/pattern-matcher.ts
  function matchPatternWindow(def, window, statusOverride) {
    if (!window.length) return null;
    const raw = matchStages(def, window);
    if (!raw) return null;
    const candles = raw.hits.flatMap((h) => h.candles);
    if (!candles.length) return null;
    if (candles[candles.length - 1].timestamp !== window[window.length - 1].timestamp) {
      return null;
    }
    const requiredMatched = countRequiredHits(def, raw.hits);
    const totalRequired = requiredStageCount(def);
    const minForming = def.minFormingStages ?? 2;
    const barsUsed = window.length;
    if (raw.partial) {
      if (requiredMatched < minForming) return null;
      if (barsUsed > def.maxBars) return null;
      return toMatch(def, window, raw, "FORMING", statusOverride);
    }
    if (barsUsed < def.minBars || barsUsed > def.maxBars) return null;
    if (requiredMatched < totalRequired) return null;
    const completeStatus = def.completesOnMatch === false ? "FORMING" : "CONFIRMED";
    return toMatch(def, window, raw, completeStatus, statusOverride);
  }
  function bestMatchForDefinition(def, buffer, statusOverride) {
    if (!buffer.length) return null;
    const maxLen = Math.min(def.maxBars, buffer.length);
    let best = null;
    for (let len = maxLen; len >= 1; len--) {
      const window = buffer.slice(buffer.length - len);
      const match = matchPatternWindow(def, window, statusOverride);
      if (!match) continue;
      if (!best || rankMatch(match) > rankMatch(best)) best = match;
    }
    return best;
  }
  function matchLooksFailed(def, previous, last, nextMatch) {
    if (!previous) return false;
    if (previous.status !== "FORMING" && previous.status !== "PREVIEW") return false;
    if (!def.failWhen) return false;
    if (previous.stage < def.failWhen.minStage) return false;
    if (!failWhenMatches(def.failWhen, last)) return false;
    if (!nextMatch) return true;
    if (nextMatch.candidate.stage < previous.stage) return true;
    if (nextMatch.candidate.startTimestamp > previous.startTimestamp && nextMatch.candidate.stage < previous.stage) {
      return true;
    }
    return false;
  }
  function matchExpired(def, previous, lastTimestamp, barSeconds, nextMatch) {
    if (!previous) return false;
    if (previous.status !== "FORMING" && previous.status !== "PREVIEW") return false;
    if (nextMatch && nextMatch.candidate.startTimestamp === previous.startTimestamp) return false;
    const elapsedBars = Math.floor((lastTimestamp - previous.startTimestamp) / Math.max(1, barSeconds));
    return elapsedBars + 1 > def.maxBars;
  }
  function matchStages(def, candles) {
    let i = 0;
    const hits = [];
    for (let s = 0; s < def.stages.length; s++) {
      const stage = def.stages[s];
      const minR = stage.minRepeats ?? (stage.optional ? 0 : 1);
      const maxR = stage.maxRepeats ?? (stage.repeat ? Number.POSITIVE_INFINITY : 1);
      i = skipUnclassified(candles, i);
      let before;
      if (stage.optionalBefore?.length && i < candles.length) {
        const c = candles[i];
        if (stage.optionalBefore.includes(c.label) && !candleMatchesStage(c, stage)) {
          before = c;
          i += 1;
          i = skipUnclassified(candles, i);
        }
      }
      const captured = [];
      while (i < candles.length && captured.length < maxR && candleMatchesStage(candles[i], stage)) {
        captured.push(candles[i]);
        i += 1;
        if (!stage.repeat) break;
        i = skipUnclassified(candles, i);
      }
      if (captured.length < minR) {
        if (stage.optional || minR === 0) {
          if (before) i -= 1;
          continue;
        }
        if (i >= candles.length && hits.length > 0) {
          return { hits, partial: true };
        }
        return null;
      }
      hits.push({ stageIndex: s, candles: before ? [before, ...captured] : captured });
    }
    i = skipUnclassified(candles, i);
    if (i !== candles.length) return null;
    return { hits, partial: false };
  }
  function skipUnclassified(candles, i) {
    while (i < candles.length && candles[i].label === "UNCLASSIFIED") i += 1;
    return i;
  }
  function candleMatchesStage(candle, stage) {
    const cls = candle.classification;
    const hasDim = !!(stage.control?.length || stage.liquidity?.length || stage.specialEvent?.length);
    const hasLabels = !!stage.labels?.length;
    if (!hasDim && !hasLabels) return false;
    if (stage.control?.length) {
      const control = cls?.primaryState.control;
      if (control && stage.control.includes(control)) {
      } else if (hasLabels && stage.labels.includes(candle.label) && stage.control.includes(candle.label)) {
      } else {
        return false;
      }
    }
    if (stage.liquidity?.length) {
      const event = cls?.liquidityBehavior.dominantEvent;
      const byDim = event != null && stage.liquidity.includes(event);
      const byLabel = hasLabels && stage.labels.some((l) => candle.label === l && stage.liquidity.includes(l));
      if (!byDim && !byLabel) return false;
    }
    if (stage.specialEvent?.length) {
      const type = cls?.specialEvent.type;
      const byDim = type != null && stage.specialEvent.includes(type);
      const byLabel = hasLabels && stage.labels.some((l) => candle.label === l && stage.specialEvent.includes(l));
      if (!byDim && !byLabel) return false;
    }
    if (!hasDim && hasLabels) {
      return stage.labels.includes(candle.label);
    }
    return true;
  }
  function failWhenMatches(fail, candle) {
    const cls = candle.classification;
    if (fail.labels?.length && fail.labels.includes(candle.label)) return true;
    if (fail.control?.length && cls && fail.control.includes(cls.primaryState.control)) return true;
    if (fail.specialEvent?.length && cls?.specialEvent.type && fail.specialEvent.includes(cls.specialEvent.type)) {
      return true;
    }
    return false;
  }
  function countRequiredHits(def, hits) {
    let n = 0;
    for (const hit of hits) {
      const stage = def.stages[hit.stageIndex];
      if (stage && !stage.optional) n += 1;
    }
    return n;
  }
  function toMatch(def, window, raw, status, statusOverride) {
    const requiredMatched = countRequiredHits(def, raw.hits);
    const totalRequired = requiredStageCount(def);
    const progress = totalRequired === 0 ? 1 : Math.min(1, requiredMatched / totalRequired);
    const first = window[0];
    const last = window[window.length - 1];
    const finalStatus = statusOverride ?? status;
    const confirmed = finalStatus === "CONFIRMED" ? last.timestamp : null;
    const candidate = withScoredCandidate(
      def,
      {
        status: finalStatus,
        startTimestamp: first.timestamp,
        confirmedTimestamp: confirmed,
        failedTimestamp: null,
        barsUsed: window.length,
        stage: requiredMatched,
        totalStages: totalRequired,
        progress,
        matchedLabels: window.map((c) => c.label),
        candleTimestamps: window.map((c) => c.timestamp)
      },
      window,
      requiredMatched
    );
    return { candidate, candles: window, requiredMatched };
  }
  function rankMatch(match) {
    const statusRank = match.candidate.status === "CONFIRMED" ? 400 : match.candidate.status === "FORMING" || match.candidate.status === "PREVIEW" ? 200 : 0;
    return statusRank + match.candidate.progress * 50 + match.candidate.confidence * 0.1 + match.candles.length;
  }
  function pickPrimary(candidates) {
    const live = candidates.filter(
      (c) => c.status === "FORMING" || c.status === "CONFIRMED" || c.status === "PREVIEW"
    );
    if (!live.length) return null;
    const superseded = /* @__PURE__ */ new Set();
    for (const c of live) {
      for (const id of supersedesOf(c.id)) {
        const other = live.find((x) => x.id === id);
        if (!other) continue;
        const evolved = c.status === "CONFIRMED" || c.progress >= other.progress;
        if (evolved) superseded.add(id);
      }
    }
    const remaining = live.filter((c) => !superseded.has(c.id));
    const pool = remaining.length ? remaining : live;
    return [...pool].sort(compareCandidates)[0] ?? null;
  }
  function supersedesOf(id) {
    if (id === "BULLISH_LIQUIDITY_REVERSAL") return ["SELLER_TRAP_FORMING"];
    if (id === "BEARISH_LIQUIDITY_REVERSAL") return ["BUYER_TRAP_FORMING"];
    return [];
  }
  function compareCandidates(a, b) {
    const statusRank = (s) => {
      if (s === "CONFIRMED") return 4;
      if (s === "FORMING") return 3;
      if (s === "PREVIEW") return 2;
      return 0;
    };
    const ds = statusRank(b.status) - statusRank(a.status);
    if (ds) return ds;
    if (b.progress !== a.progress) return b.progress - a.progress;
    const specA = specificityOf(a.id);
    const specB = specificityOf(b.id);
    if (specB !== specA) return specB - specA;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.id.localeCompare(b.id);
  }
  function specificityOf(id) {
    switch (id) {
      case "BULLISH_LIQUIDITY_REVERSAL":
      case "BEARISH_LIQUIDITY_REVERSAL":
        return 80;
      case "FAILED_BEARISH_REVERSAL":
      case "FAILED_BULLISH_REVERSAL":
        return 70;
      case "BULLISH_CONTINUATION":
      case "BEARISH_CONTINUATION":
        return 50;
      case "BUYER_TRAP_FORMING":
      case "SELLER_TRAP_FORMING":
        return 40;
      default:
        return 0;
    }
  }

  // src/pattern-recognition/pattern-recognition-engine.ts
  var DEFAULT_BUFFER = 40;
  var EVENT_BUFFER = 80;
  function streamKey(symbol, timeframe) {
    return `${symbol}|${timeframe}`;
  }
  function timeframeToSeconds(timeframe) {
    const t = timeframe.trim();
    if (t === "1D" || t === "1d") return 86400;
    if (t.endsWith("h") || t.endsWith("H")) return (Number.parseInt(t, 10) || 1) * 3600;
    if (t.endsWith("m") || t.endsWith("M")) return (Number.parseInt(t, 10) || 1) * 60;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n * 60 : 60;
  }
  function minutesToTimeframe(minutes) {
    if (minutes === 1440) return "1D";
    if (minutes === 240) return "4h";
    if (minutes === 120) return "2h";
    if (minutes === 60) return "1h";
    return `${minutes}m`;
  }
  var PatternRecognitionEngine = class {
    bufferSize;
    definitions;
    streams = /* @__PURE__ */ new Map();
    constructor(options = {}) {
      this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER;
      this.definitions = options.definitions ?? PATTERN_DEFINITIONS;
    }
    ingest(candle, options) {
      const state = this.stream(candle.symbol, candle.timeframe);
      if (options?.preview) {
        return this.evaluate(state, candle.symbol, candle.timeframe, candle);
      }
      const last = state.buffer.last();
      if (!last || last.timestamp !== candle.timestamp) {
        state.buffer.push(candle);
      } else {
        const arr = state.buffer.toArray();
        arr[arr.length - 1] = candle;
        state.buffer.clear();
        for (const item of arr) state.buffer.push(item);
      }
      return this.evaluate(state, candle.symbol, candle.timeframe, null);
    }
    snapshot(symbol, timeframe) {
      const state = this.streams.get(streamKey(symbol, timeframe));
      if (!state) return emptySnapshot2(symbol, timeframe);
      return this.evaluate(state, symbol, timeframe, null, { alerts: false });
    }
    labels(symbol, timeframe) {
      return this.streams.get(streamKey(symbol, timeframe))?.buffer.toArray() ?? [];
    }
    events(symbol, timeframe) {
      if (symbol && timeframe) {
        return this.streams.get(streamKey(symbol, timeframe))?.events.toArray() ?? [];
      }
      const out = [];
      for (const [key3, state] of this.streams) {
        if (symbol && !key3.startsWith(`${symbol}|`)) continue;
        out.push(...state.events.toArray());
      }
      return out.sort((a, b) => a.startTimestamp - b.startTimestamp);
    }
    reset(symbol, timeframe) {
      if (symbol && timeframe) {
        this.streams.delete(streamKey(symbol, timeframe));
        return;
      }
      if (symbol) {
        for (const key3 of [...this.streams.keys()]) {
          if (key3.startsWith(`${symbol}|`)) this.streams.delete(key3);
        }
        return;
      }
      this.streams.clear();
    }
    stream(symbol, timeframe) {
      const key3 = streamKey(symbol, timeframe);
      let state = this.streams.get(key3);
      if (!state) {
        state = {
          buffer: new RingBuffer(this.bufferSize),
          lastById: /* @__PURE__ */ new Map(),
          events: new RingBuffer(EVENT_BUFFER),
          lastAlertKey: /* @__PURE__ */ new Map()
        };
        this.streams.set(key3, state);
      }
      return state;
    }
    evaluate(state, symbol, timeframe, preview, opts) {
      const emitAlerts = opts?.alerts !== false;
      const finalized = state.buffer.toArray();
      const buffer = preview ? [...finalized, preview] : finalized;
      const statusOverride = preview ? "PREVIEW" : void 0;
      const last = buffer[buffer.length - 1];
      const currentLabel = last?.label ?? null;
      const barSeconds = timeframeToSeconds(timeframe);
      const live = [];
      const alerts = [];
      for (const def of this.definitions) {
        const match = bestMatchForDefinition(def, buffer, statusOverride);
        const prev = state.lastById.get(def.id);
        if (preview) {
          if (match) live.push(downgradeConfirmed(match.candidate));
          else if (prev && (prev.status === "FORMING" || prev.status === "PREVIEW" || prev.status === "CONFIRMED")) {
            live.push(prev.status === "CONFIRMED" ? prev : { ...prev, status: "PREVIEW" });
          }
          continue;
        }
        if (last && matchLooksFailed(def, prev, last, match)) {
          const failed = failCandidate(prev, last.timestamp, "Opposite control regained");
          live.push(failed);
          this.recordEvent(state, symbol, timeframe, failed);
          if (emitAlerts) {
            const alert = maybeAlert(state, symbol, timeframe, failed, last.timestamp);
            if (alert) alerts.push(alert);
          }
          state.lastById.delete(def.id);
          continue;
        }
        if (last && !match && matchExpired(def, prev, last.timestamp, barSeconds, match)) {
          const expired = expireCandidate(prev, last.timestamp);
          this.recordEvent(state, symbol, timeframe, expired);
          state.lastById.delete(def.id);
          continue;
        }
        if (match) {
          const candidate = match.candidate;
          live.push(candidate);
          if (emitAlerts) {
            const alert = maybeAlert(state, symbol, timeframe, candidate, last?.timestamp ?? candidate.startTimestamp, prev);
            if (alert) alerts.push(alert);
          }
          if (candidate.status === "CONFIRMED" && prev?.status !== "CONFIRMED") {
            this.recordEvent(state, symbol, timeframe, candidate);
          }
          state.lastById.set(def.id, candidate);
          continue;
        }
        if (prev?.status === "CONFIRMED" && last) {
          const elapsed = Math.floor((last.timestamp - prev.startTimestamp) / Math.max(1, barSeconds)) + 1;
          if (elapsed <= def.maxBars) {
            live.push(prev);
            continue;
          }
        }
        if (prev?.status === "FORMING" || prev?.status === "PREVIEW") {
          live.push(prev);
          continue;
        }
        state.lastById.delete(def.id);
      }
      const primary = pickPrimary(live);
      const markers = markersFrom(live, last?.timestamp ?? 0);
      return {
        symbol,
        timeframe,
        currentLabel,
        primaryPattern: primary,
        candidates: [...live].sort((a, b) => b.confidence - a.confidence),
        markers,
        alerts,
        engineVersion: PATTERN_ENGINE_VERSION,
        nextState: null
      };
    }
    recordEvent(state, symbol, timeframe, candidate) {
      state.events.push({
        patternId: candidate.id,
        patternVersion: candidate.patternVersion || patternVersionTag(candidate.id, candidate.version),
        symbol,
        timeframe,
        startTimestamp: candidate.startTimestamp,
        confirmedTimestamp: candidate.confirmedTimestamp,
        failedTimestamp: candidate.failedTimestamp,
        direction: candidate.direction,
        status: candidate.status,
        confidence: candidate.confidence,
        matchedLabels: candidate.matchedLabels,
        candleTimestamps: candidate.candleTimestamps,
        engineVersion: PATTERN_ENGINE_VERSION,
        outcome: null
      });
    }
  };
  function emptySnapshot2(symbol, timeframe) {
    return {
      symbol,
      timeframe,
      currentLabel: null,
      primaryPattern: null,
      candidates: [],
      markers: [],
      alerts: [],
      engineVersion: PATTERN_ENGINE_VERSION,
      nextState: null
    };
  }
  function downgradeConfirmed(candidate) {
    if (candidate.status !== "CONFIRMED") {
      return { ...candidate, status: "PREVIEW" };
    }
    return {
      ...candidate,
      status: "PREVIEW",
      confirmedTimestamp: null
    };
  }
  function failCandidate(prev, at, reason) {
    return {
      ...prev,
      status: "FAILED",
      failedTimestamp: at,
      failReason: reason
    };
  }
  function expireCandidate(prev, at) {
    return {
      ...prev,
      status: "EXPIRED",
      failedTimestamp: at,
      failReason: "Max bars exceeded while forming"
    };
  }
  function maybeAlert(state, symbol, timeframe, candidate, timestamp, prev) {
    let type = null;
    if (candidate.status === "CONFIRMED" && prev?.status !== "CONFIRMED") type = "PATTERN_CONFIRMED";
    else if (candidate.status === "FAILED") type = "PATTERN_FAILED";
    else if (candidate.status === "FORMING") {
      const stageChanged = !prev || prev.stage < candidate.stage || prev.id !== candidate.id;
      const startChanged = prev?.startTimestamp !== candidate.startTimestamp;
      if (stageChanged || startChanged && candidate.stage >= 2) type = "PATTERN_FORMING";
    }
    if (!type) return null;
    const key3 = `${candidate.id}:${type}:${candidate.startTimestamp}:${candidate.stage}`;
    if (state.lastAlertKey.get(candidate.id) === key3) return null;
    state.lastAlertKey.set(candidate.id, key3);
    const verb = type === "PATTERN_CONFIRMED" ? "confirmed" : type === "PATTERN_FAILED" ? "failed" : "forming";
    return {
      type,
      symbol,
      timeframe,
      patternId: candidate.id,
      patternVersion: candidate.patternVersion,
      status: candidate.status,
      stage: candidate.stage,
      confidence: candidate.confidence,
      timestamp,
      message: `${candidate.title} ${verb} \xB7 ${candidate.confidence}% \xB7 ${timeframe}`
    };
  }
  function markersFrom(candidates, lastTimestamp) {
    const live = candidates.filter(
      (c) => c.status === "FORMING" || c.status === "CONFIRMED" || c.status === "PREVIEW"
    );
    const primary = pickPrimary(live);
    if (!primary) return [];
    const time = primary.status === "CONFIRMED" && primary.confirmedTimestamp != null ? primary.confirmedTimestamp : lastTimestamp;
    return [toPatternMarker(primary, time)];
  }
  function toPatternMarker(candidate, time) {
    return {
      time,
      badge: candidate.badge,
      patternId: candidate.id,
      title: candidate.title,
      status: candidate.status,
      confidence: candidate.confidence,
      direction: candidate.direction,
      stage: candidate.stage,
      totalStages: candidate.totalStages,
      progress: candidate.progress,
      matchedLabels: candidate.matchedLabels,
      barsUsed: candidate.barsUsed
    };
  }
  function replayPatterns(candles, engine2 = new PatternRecognitionEngine()) {
    const snapshots = [];
    if (!candles.length) return { snapshots, last: null };
    const symbol = candles[0].symbol;
    const timeframe = candles[0].timeframe;
    engine2.reset(symbol, timeframe);
    for (const candle of candles) {
      snapshots.push(engine2.ingest(candle));
    }
    return { snapshots, last: snapshots[snapshots.length - 1] ?? null };
  }

  // src/pattern-recognition/candle-classification.ts
  var DEFAULT_CLASSIFICATION_CONFIG = DEFAULT_CONFIG.candleClassification;
  function classifyCandleStructure(bar, options = {}) {
    const config = options.config ?? DEFAULT_CLASSIFICATION_CONFIG;
    const prior = options.prior ?? [];
    const metrics = options.metrics ?? null;
    const control = deriveControl(bar);
    const liquidity = deriveLiquidityBehavior(bar, prior, metrics, config);
    const special = deriveSpecialEvent(bar, prior);
    const outcome = deriveOutcome(bar, control.control, special.type);
    const primaryDisplayLabel = derivePrimaryDisplayLabel(
      control,
      liquidity,
      special,
      config
    );
    return {
      primaryState: control,
      liquidityBehavior: liquidity,
      specialEvent: special,
      outcome,
      primaryDisplayLabel
    };
  }
  function metricsFromLabeledFields(candle) {
    if (!candle) return null;
    const hasAny = candle.bidConsumption != null || candle.askConsumption != null || candle.bidWithdrawal != null || candle.askWithdrawal != null || candle.bidReplenishment != null || candle.askReplenishment != null || candle.bidSurvival != null || candle.askSurvival != null;
    if (!hasAny) return null;
    return {
      bidConsumption: candle.bidConsumption ?? null,
      askConsumption: candle.askConsumption ?? null,
      bidWithdrawal: candle.bidWithdrawal ?? null,
      askWithdrawal: candle.askWithdrawal ?? null,
      bidReplenishment: candle.bidReplenishment ?? null,
      askReplenishment: candle.askReplenishment ?? null,
      bidSurvival: candle.bidSurvival ?? null,
      askSurvival: candle.askSurvival ?? null
    };
  }
  function stateFromScore(score, config = DEFAULT_CLASSIFICATION_CONFIG) {
    if (score == null || !Number.isFinite(score)) return "NO_DATA";
    const s = clamp(score, 0, 100);
    const b = config.stateBuckets;
    if (s < b.low) return "LOW";
    if (s < b.normal) return "NORMAL";
    if (s < b.elevated) return "ELEVATED";
    if (s < b.strong) return "STRONG";
    return "EXTREME";
  }
  function pickDominantLiquidityEvent(behaviors, config = DEFAULT_CLASSIFICATION_CONFIG) {
    const ranked = behaviors.filter((b) => b.event !== "NONE" && b.score != null && Number.isFinite(b.score)).map((b) => ({ ...b, score: b.score })).sort((a, b) => b.score - a.score || a.event.localeCompare(b.event));
    const top = ranked[0];
    if (!top) return "NONE";
    const second = ranked[1];
    const margin = second ? top.score - second.score : top.score;
    const scoreOk = top.score >= config.minimumDominanceScore;
    const marginOk = margin >= config.minimumDominanceMargin;
    const percentileOk = top.percentile == null || !Number.isFinite(top.percentile) || top.percentile >= config.minimumDominancePercentile;
    const relativeExtreme = top.percentile != null && Number.isFinite(top.percentile) && top.percentile >= Math.max(config.minimumDominancePercentile, 85) && top.score >= config.minimumDominanceScore - 10;
    if ((scoreOk || relativeExtreme) && marginOk && percentileOk) return top.event;
    return "NONE";
  }
  function deriveControl(bar) {
    const win = barWinner(bar);
    if (win === "AGGRESSIVE_BUYERS") {
      return { control: "BUYER_IN_CONTROL", confidence: controlConfidence(bar) };
    }
    if (win === "AGGRESSIVE_SELLERS") {
      return { control: "SELLER_IN_CONTROL", confidence: controlConfidence(bar) };
    }
    if (win === "PASSIVE_SELLERS" || win === "PASSIVE_BUYERS") {
      return { control: "BALANCED", confidence: Math.min(0.55, absorbConfidence(bar)) };
    }
    if (win === "BALANCED") {
      return { control: "BALANCED", confidence: 0.45 };
    }
    return { control: "UNCLEAR", confidence: 0.35 };
  }
  function deriveLiquidityBehavior(bar, prior, metrics, config) {
    const quality = resolveDataQuality2(metrics);
    const fromBook = metrics != null && hasBookLiquidity(metrics);
    const bidConsumption = metricView(
      metrics?.bidConsumption ?? null,
      metrics?.bidConsumptionPercentile ?? null,
      metrics?.bidConsumptionZ ?? null,
      metrics?.rawBidConsumed ?? null,
      config
    );
    const askConsumption = metricView(
      metrics?.askConsumption ?? null,
      metrics?.askConsumptionPercentile ?? null,
      metrics?.askConsumptionZ ?? null,
      metrics?.rawAskConsumed ?? null,
      config
    );
    const bidPulling = metricView(
      metrics?.bidWithdrawal ?? null,
      metrics?.bidWithdrawalPercentile ?? null,
      metrics?.bidWithdrawalZ ?? null,
      metrics?.rawBidCancelled ?? null,
      config
    );
    const askPulling = metricView(
      metrics?.askWithdrawal ?? null,
      metrics?.askWithdrawalPercentile ?? null,
      metrics?.askWithdrawalZ ?? null,
      metrics?.rawAskCancelled ?? null,
      config
    );
    const bidReplenishment = metricView(
      metrics?.bidReplenishment ?? null,
      metrics?.bidReplenishmentPercentile ?? null,
      null,
      metrics?.rawBidReplenished ?? null,
      config
    );
    const askReplenishment = metricView(
      metrics?.askReplenishment ?? null,
      metrics?.askReplenishmentPercentile ?? null,
      null,
      metrics?.rawAskReplenished ?? null,
      config
    );
    const bidSurvival = metricView(metrics?.bidSurvival ?? null, null, null, null, config);
    const askSurvival = metricView(metrics?.askSurvival ?? null, null, null, null, config);
    if (!fromBook) {
      const vac = vacuumKind(bar, prior);
      if (vac === "UPSIDE") {
        const stretch = vacuumStretchScore(bar, prior);
        if (askPulling.score == null) {
          askPulling.score = stretch;
          askPulling.state = stateFromScore(stretch, config);
          askPulling.percentile = null;
        }
      } else if (vac === "DOWNSIDE") {
        const stretch = vacuumStretchScore(bar, prior);
        if (bidPulling.score == null) {
          bidPulling.score = stretch;
          bidPulling.state = stateFromScore(stretch, config);
          bidPulling.percentile = null;
        }
      }
    }
    const candidates = [
      { event: "BIDS_CONSUMED", score: bidConsumption.score, percentile: bidConsumption.percentile },
      { event: "ASKS_CONSUMED", score: askConsumption.score, percentile: askConsumption.percentile },
      { event: "BIDS_PULLED", score: bidPulling.score, percentile: bidPulling.percentile },
      { event: "ASKS_PULLED", score: askPulling.score, percentile: askPulling.percentile },
      { event: "BIDS_REPLENISHED", score: bidReplenishment.score, percentile: bidReplenishment.percentile },
      { event: "ASKS_REPLENISHED", score: askReplenishment.score, percentile: askReplenishment.percentile },
      { event: "BIDS_SURVIVING", score: bidSurvival.score, percentile: bidSurvival.percentile },
      { event: "ASKS_SURVIVING", score: askSurvival.score, percentile: askSurvival.percentile }
    ];
    const dominantEvent = quality === "NO_DATA" || quality === "STALE_DATA" || quality === "LOW_CONFIDENCE" ? softDominantWhenPartial(candidates, quality, config) : pickDominantLiquidityEvent(candidates, config);
    return {
      bidConsumption,
      bidPulling,
      bidReplenishment,
      bidSurvival,
      askConsumption,
      askPulling,
      askReplenishment,
      askSurvival,
      dominantEvent,
      dataQuality: quality
    };
  }
  function softDominantWhenPartial(candidates, quality, config) {
    if (quality === "NO_DATA") {
      return pickDominantLiquidityEvent(candidates, config);
    }
    if (quality === "STALE_DATA" || quality === "LOW_CONFIDENCE") {
      return "NONE";
    }
    return pickDominantLiquidityEvent(candidates, config);
  }
  function deriveSpecialEvent(bar, prior) {
    const hunt = stopHuntKind(bar, prior);
    if (hunt === "HIGH") {
      return { type: "STOP_HUNT_HIGH", confidence: huntConfidence(bar, "HIGH") };
    }
    if (hunt === "LOW") {
      return { type: "STOP_HUNT_LOW", confidence: huntConfidence(bar, "LOW") };
    }
    const location = barLocationFromPrior(bar, prior);
    const absorbed = barAbsorbed(bar);
    const win = barWinner(bar);
    if (location === "AT_SUPPORT" && (absorbed === "SELLERS" || win === "PASSIVE_BUYERS" || win === "AGGRESSIVE_BUYERS")) {
      return { type: "HELD_SUPPORT", confidence: clamp(0.5 + (absorbed === "SELLERS" ? 0.25 : 0.1), 0.45, 0.92) };
    }
    if (location === "AT_RESISTANCE" && (absorbed === "BUYERS" || win === "PASSIVE_SELLERS" || win === "AGGRESSIVE_SELLERS")) {
      return { type: "REJECTED_RESISTANCE", confidence: clamp(0.5 + (absorbed === "BUYERS" ? 0.25 : 0.1), 0.45, 0.92) };
    }
    if (location === "ABOVE_RESISTANCE" && win === "AGGRESSIVE_BUYERS") {
      return { type: "BREAKOUT_ACCEPTANCE", confidence: controlConfidence(bar) };
    }
    if (location === "BELOW_SUPPORT" && win === "AGGRESSIVE_SELLERS") {
      return { type: "BREAKDOWN_ACCEPTANCE", confidence: controlConfidence(bar) };
    }
    if (absorbed === "SELLERS") {
      return { type: "SELLER_ABSORBED", confidence: absorbConfidence(bar) };
    }
    if (absorbed === "BUYERS") {
      return { type: "BUYER_ABSORBED", confidence: absorbConfidence(bar) };
    }
    if (win === "PASSIVE_SELLERS") {
      return { type: "BUYER_ABSORBED", confidence: Math.min(0.72, absorbConfidence(bar)) };
    }
    if (win === "PASSIVE_BUYERS") {
      return { type: "SELLER_ABSORBED", confidence: Math.min(0.72, absorbConfidence(bar)) };
    }
    return { type: null, confidence: null };
  }
  function deriveOutcome(bar, control, special) {
    const range = Math.max(bar.high - bar.low, 1e-9);
    const body = Math.abs(bar.close - bar.open);
    const move = bar.close - bar.open;
    const closePos = (bar.close - bar.low) / range;
    const direction = move > 0 ? "UP" : move < 0 ? "DOWN" : "NONE";
    const bodyFrac = body / range;
    const followed = control === "BUYER_IN_CONTROL" && move > 0 || control === "SELLER_IN_CONTROL" && move < 0;
    if (special === "STOP_HUNT_LOW" || special === "STOP_HUNT_HIGH") {
      const reversedInBar = special === "STOP_HUNT_LOW" && closePos >= 0.58 || special === "STOP_HUNT_HIGH" && closePos <= 0.42;
      if (reversedInBar) {
        return {
          type: "REVERSAL",
          direction: special === "STOP_HUNT_LOW" ? "UP" : "DOWN",
          confidence: huntConfidence(bar, special === "STOP_HUNT_LOW" ? "LOW" : "HIGH")
        };
      }
      return { type: "PENDING", direction, confidence: null };
    }
    if (special === "BUYER_ABSORBED" || special === "SELLER_ABSORBED") {
      if (bodyFrac < 0.3) {
        return { type: "NO_FOLLOW_THROUGH", direction: "NONE", confidence: absorbConfidence(bar) };
      }
      return { type: "PRICE_FAILED", direction, confidence: absorbConfidence(bar) };
    }
    if (followed && bodyFrac >= 0.3) {
      return { type: "PRICE_FOLLOWED", direction, confidence: controlConfidence(bar) };
    }
    if (followed) {
      return { type: "CONTINUATION", direction, confidence: clamp(controlConfidence(bar) * 0.85, 0.4, 0.9) };
    }
    if (control === "BUYER_IN_CONTROL" || control === "SELLER_IN_CONTROL") {
      return { type: "NO_FOLLOW_THROUGH", direction, confidence: 0.5 };
    }
    if (bodyFrac < 0.25) {
      return { type: "NEUTRAL", direction: "NONE", confidence: 0.4 };
    }
    return { type: "NEUTRAL", direction, confidence: 0.4 };
  }
  function derivePrimaryDisplayLabel(control, liquidity, special, config) {
    if (special.type && special.confidence != null && special.confidence >= config.strongSpecialEventConfidence) {
      return specialEventToCandleLabel(special.type);
    }
    if ((control.control === "BUYER_IN_CONTROL" || control.control === "SELLER_IN_CONTROL") && control.confidence >= config.strongControlConfidence) {
      return control.control;
    }
    if (liquidity.dominantEvent !== "NONE") {
      const metric = metricForDominant(liquidity, liquidity.dominantEvent);
      if (metric && config.headlineLiquidityStates.includes(metric.state)) {
        const mapped = liquidityEventToCandleLabel(liquidity.dominantEvent);
        if (mapped) return mapped;
      }
    }
    if (control.control === "BUYER_IN_CONTROL" || control.control === "SELLER_IN_CONTROL") {
      return control.control;
    }
    return "UNCLASSIFIED";
  }
  function specialEventToCandleLabel(type) {
    switch (type) {
      case "STOP_HUNT_HIGH":
        return "STOP_HUNT_HIGH";
      case "STOP_HUNT_LOW":
        return "STOP_HUNT_LOW";
      case "BUYER_ABSORBED":
        return "BUYER_ABSORBED";
      case "SELLER_ABSORBED":
        return "SELLER_ABSORBED";
      case "HELD_SUPPORT":
      case "BREAKOUT_ACCEPTANCE":
      case "FAILED_BEARISH_REVERSAL":
        return "BUYER_IN_CONTROL";
      case "REJECTED_RESISTANCE":
      case "BREAKDOWN_ACCEPTANCE":
      case "FAILED_BULLISH_REVERSAL":
        return "SELLER_IN_CONTROL";
      default:
        return "UNCLASSIFIED";
    }
  }
  function liquidityEventToCandleLabel(event) {
    if (event === "ASKS_PULLED") return "ASKS_PULLED";
    if (event === "BIDS_PULLED") return "BIDS_PULLED";
    if (event === "ASKS_CONSUMED") return "BUYER_IN_CONTROL";
    if (event === "BIDS_CONSUMED") return "SELLER_IN_CONTROL";
    return null;
  }
  function metricForDominant(layer, event) {
    switch (event) {
      case "BIDS_CONSUMED":
        return layer.bidConsumption;
      case "ASKS_CONSUMED":
        return layer.askConsumption;
      case "BIDS_PULLED":
        return layer.bidPulling;
      case "ASKS_PULLED":
        return layer.askPulling;
      case "BIDS_REPLENISHED":
        return layer.bidReplenishment;
      case "ASKS_REPLENISHED":
        return layer.askReplenishment;
      case "BIDS_SURVIVING":
        return layer.bidSurvival;
      case "ASKS_SURVIVING":
        return layer.askSurvival;
      default:
        return null;
    }
  }
  function metricView(score, percentile, zScore, rawValue, config) {
    if (score == null || !Number.isFinite(score)) {
      return {
        score: null,
        state: "NO_DATA",
        percentile: percentile ?? null,
        zScore: zScore ?? null,
        rawValue: rawValue ?? null
      };
    }
    return {
      score: clamp(score, 0, 100),
      state: stateFromScore(score, config),
      percentile: percentile ?? null,
      zScore: zScore ?? null,
      rawValue: rawValue ?? null
    };
  }
  function resolveDataQuality2(metrics) {
    if (!metrics) return "NO_DATA";
    if (metrics.dataStale) return "STALE_DATA";
    if (metrics.dataQualityScore != null && metrics.dataQualityScore < 35) return "LOW_CONFIDENCE";
    if (!hasBookLiquidity(metrics)) {
      if (metrics.bidSurvival != null || metrics.askSurvival != null) return "PARTIAL_DATA";
      return "NO_DATA";
    }
    const known = [
      metrics.bidConsumption,
      metrics.askConsumption,
      metrics.bidWithdrawal,
      metrics.askWithdrawal,
      metrics.bidReplenishment,
      metrics.askReplenishment
    ].filter((v) => v != null).length;
    if (known < 4) return "PARTIAL_DATA";
    if (metrics.dataQualityScore != null && metrics.dataQualityScore < 50) return "LOW_CONFIDENCE";
    return "OK";
  }
  function hasBookLiquidity(metrics) {
    return metrics.bidConsumption != null || metrics.askConsumption != null || metrics.bidWithdrawal != null || metrics.askWithdrawal != null || metrics.bidReplenishment != null || metrics.askReplenishment != null;
  }
  function volumeOf(bar) {
    if (typeof bar.volume === "number" && Number.isFinite(bar.volume)) return bar.volume;
    return (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
  }
  function barWinner(bar) {
    const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
    const mid = (bar.high + bar.low) / 2 || bar.close;
    const move = mid ? (bar.close - bar.open) / mid : 0;
    const range = bar.high - bar.low;
    const body = Math.abs(bar.close - bar.open);
    const stalled = Math.abs(move) < 45e-5 || range > 0 && body / range < 0.3;
    if (delta > 0 && stalled) return "PASSIVE_SELLERS";
    if (delta < 0 && stalled) return "PASSIVE_BUYERS";
    if (delta > 0 && move > 0) return "AGGRESSIVE_BUYERS";
    if (delta < 0 && move < 0) return "AGGRESSIVE_SELLERS";
    return "BALANCED";
  }
  function barAbsorbed(bar) {
    const vol = volumeOf(bar);
    const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
    const range = Math.max(bar.high - bar.low, 1e-9);
    const closePos = (bar.close - bar.low) / range;
    const dominated = vol > 0 && Math.abs(delta / vol) >= 0.25;
    if (dominated && delta < 0 && closePos >= 0.55) return "SELLERS";
    if (dominated && delta > 0 && closePos <= 0.45) return "BUYERS";
    return null;
  }
  function priorSwingLevels(prior) {
    if (!prior.length) return { support: null, resistance: null };
    const recent = prior.slice(-16);
    let resistance = -Infinity;
    let support = Infinity;
    for (const b of recent) {
      if (b.high > resistance) resistance = b.high;
      if (b.low < support) support = b.low;
    }
    if (!Number.isFinite(resistance) || !Number.isFinite(support)) return { support: null, resistance: null };
    return { support, resistance };
  }
  function recentBarAtr(prior, bar) {
    const look = prior.slice(-8);
    if (!look.length) return Math.max(bar.high - bar.low, (bar.close || 1) * 2e-3);
    let s = 0;
    for (const b of look) s += Math.max(b.high - b.low, 0);
    return s / look.length || Math.max(bar.high - bar.low, (bar.close || 1) * 2e-3);
  }
  function vacuumKind(bar, prior) {
    const buy = bar.totalBuy ?? 0;
    const sell = bar.totalSell ?? 0;
    const vol = buy + sell;
    const range = bar.high - bar.low;
    if (range <= 0) return null;
    const atr = recentBarAtr(prior, bar);
    const closePos = (bar.close - bar.low) / range;
    const move = bar.close - bar.open;
    const expanded = range >= atr * 1.15;
    const ran = Math.abs(move) >= atr * 0.45;
    if (!expanded && !ran) return null;
    const deltaPct = vol > 0 ? (buy - sell) / vol : move > 0 ? 0.3 : move < 0 ? -0.3 : 0;
    if (deltaPct >= 0.18 && move > 0 && closePos >= 0.62) return "UPSIDE";
    if (deltaPct <= -0.18 && move < 0 && closePos <= 0.38) return "DOWNSIDE";
    if (move > 0 && closePos >= 0.72 && range >= atr * 1.35) return "UPSIDE";
    if (move < 0 && closePos <= 0.28 && range >= atr * 1.35) return "DOWNSIDE";
    return null;
  }
  function vacuumStretchScore(bar, prior) {
    const atr = recentBarAtr(prior, bar);
    const range = bar.high - bar.low;
    const stretch = atr > 0 ? range / atr : 1;
    return clamp(40 + (stretch - 1) * 35, 0, 100);
  }
  function stopHuntKind(bar, prior) {
    const { support, resistance } = priorSwingLevels(prior);
    if (support == null || resistance == null || resistance <= support) return null;
    const atr = recentBarAtr(prior, bar);
    const range = bar.high - bar.low;
    if (range <= 0) return null;
    const closePos = (bar.close - bar.low) / range;
    const band = Math.max((resistance - support) * 0.08, atr * 0.35);
    if (bar.high >= resistance + band * 0.2 && bar.close < resistance && closePos <= 0.42) return "HIGH";
    if (bar.low <= support - band * 0.2 && bar.close > support && closePos >= 0.58) return "LOW";
    return null;
  }
  function barLocationFromPrior(bar, prior) {
    const { support, resistance } = priorSwingLevels(prior);
    if (support == null || resistance == null || resistance <= support) return "UNKNOWN";
    const band = Math.max((resistance - support) * 0.12, (bar.close || 1) * 15e-4);
    if (bar.close > resistance + band * 0.15) return "ABOVE_RESISTANCE";
    if (bar.close < support - band * 0.15) return "BELOW_SUPPORT";
    if (bar.high >= resistance - band) return "AT_RESISTANCE";
    if (bar.low <= support + band) return "AT_SUPPORT";
    return "MID_RANGE";
  }
  function huntConfidence(bar, kind) {
    const range = Math.max(bar.high - bar.low, 1e-9);
    const closePos = (bar.close - bar.low) / range;
    const extremity = kind === "LOW" ? closePos : 1 - closePos;
    return clamp(0.55 + extremity * 0.4, 0.5, 0.98);
  }
  function absorbConfidence(bar) {
    const vol = volumeOf(bar);
    const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
    const imb = vol > 0 ? delta / vol : 0;
    const range = Math.max(bar.high - bar.low, 1e-9);
    const body = Math.abs(bar.close - bar.open) / range;
    return clamp(0.45 + imb * 0.4 + (1 - body) * 0.15, 0.4, 0.96);
  }
  function controlConfidence(bar) {
    const vol = volumeOf(bar);
    const delta = Math.abs((bar.totalBuy ?? 0) - (bar.totalSell ?? 0));
    const imb = vol > 0 ? delta / vol : 0;
    return clamp(0.5 + imb * 0.45, 0.45, 0.97);
  }

  // src/pattern-recognition/candle-label-adapter.ts
  var EMPTY_METRICS = {
    aggressiveBuyPower: null,
    aggressiveSellPower: null,
    passiveBuyerDefense: null,
    passiveSellerDefense: null,
    upsideBattleSpread: null,
    downsideBattleSpread: null,
    bidWithdrawal: null,
    askWithdrawal: null,
    bidReplenishment: null,
    askReplenishment: null,
    bidConsumption: null,
    askConsumption: null,
    bidSurvival: null,
    askSurvival: null,
    sweepQuality: null
  };
  function labelFootprintBar(bar, prior, timeframe, metrics) {
    const classification = classifyCandleStructure(bar, {
      prior,
      metrics: metricsFromLabeledFields(metrics)
    });
    const conf = metrics?.labelConfidence ?? classification.specialEvent.confidence ?? classification.primaryState.confidence;
    return {
      timestamp: bar.time,
      symbol: bar.symbol,
      timeframe,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: volumeOf2(bar),
      label: classification.primaryDisplayLabel,
      labelConfidence: conf,
      classification,
      ...EMPTY_METRICS,
      ...pickMetrics(metrics),
      sweepQuality: metrics?.sweepQuality ?? sweepQualityOf(bar, prior, classification)
    };
  }
  function labelFootprintBars(bars, timeframe, options) {
    const finalized = [];
    const end = options?.lastIsLive && bars.length ? bars.length - 1 : bars.length;
    for (let i = 0; i < end; i++) {
      finalized.push(labelFootprintBar(bars[i], bars.slice(0, i), timeframe));
    }
    const preview = options?.lastIsLive && bars.length ? labelFootprintBar(bars[bars.length - 1], bars.slice(0, bars.length - 1), timeframe) : null;
    return { finalized, preview };
  }
  function volumeOf2(bar) {
    if (typeof bar.volume === "number" && Number.isFinite(bar.volume)) return bar.volume;
    return (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
  }
  function sweepQualityOf(bar, prior, classification) {
    const kind = classification.specialEvent.type === "STOP_HUNT_HIGH" ? "HIGH" : classification.specialEvent.type === "STOP_HUNT_LOW" ? "LOW" : stopHuntKind(bar, prior);
    if (!kind) return null;
    const { support, resistance } = priorSwingLevels2(prior);
    const range = Math.max(bar.high - bar.low, 1e-9);
    if (kind === "HIGH" && resistance != null) {
      const swept = Math.max(0, bar.high - resistance);
      const rejected = Math.max(0, bar.high - bar.close);
      return clamp(swept / range * 0.5 + rejected / range * 0.5, 0, 1) * 100;
    }
    if (kind === "LOW" && support != null) {
      const swept = Math.max(0, support - bar.low);
      const rejected = Math.max(0, bar.close - bar.low);
      return clamp(swept / range * 0.5 + rejected / range * 0.5, 0, 1) * 100;
    }
    const closePos = (bar.close - bar.low) / range;
    const wick = kind === "LOW" ? closePos : 1 - closePos;
    return clamp(wick, 0, 1) * 100;
  }
  function priorSwingLevels2(prior) {
    if (!prior.length) return { support: null, resistance: null };
    const recent = prior.slice(-16);
    let resistance = -Infinity;
    let support = Infinity;
    for (const b of recent) {
      if (b.high > resistance) resistance = b.high;
      if (b.low < support) support = b.low;
    }
    if (!Number.isFinite(resistance) || !Number.isFinite(support)) return { support: null, resistance: null };
    return { support, resistance };
  }
  function pickMetrics(metrics) {
    if (!metrics) return {};
    const out = {};
    for (const key3 of Object.keys(EMPTY_METRICS)) {
      const value = metrics[key3];
      if (value !== void 0) out[key3] = value;
    }
    if (metrics.labelConfidence !== void 0) out.labelConfidence = metrics.labelConfidence;
    if (metrics.upsideFuel !== void 0) out.upsideFuel = metrics.upsideFuel;
    if (metrics.downsideFuel !== void 0) out.downsideFuel = metrics.downsideFuel;
    if (metrics.fuelImbalance !== void 0) out.fuelImbalance = metrics.fuelImbalance;
    if (metrics.fuelState !== void 0) out.fuelState = metrics.fuelState;
    if (metrics.upsideFuelVelocity !== void 0) out.upsideFuelVelocity = metrics.upsideFuelVelocity;
    if (metrics.downsideFuelVelocity !== void 0) out.downsideFuelVelocity = metrics.downsideFuelVelocity;
    return out;
  }

  // src/footprint/rollup.ts
  function rollup(bars, tfMinutes) {
    if (tfMinutes <= 0) return [];
    const bucket2 = tfMinutes * 60;
    const byTime = /* @__PURE__ */ new Map();
    for (const bar of bars) {
      const t = bar.time - bar.time % bucket2;
      let acc = byTime.get(t);
      if (!acc) {
        acc = {
          time: t,
          openTime: bar.time,
          closeTime: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          totalBuy: 0,
          totalSell: 0,
          trades: 0,
          buyTrades: 0,
          sellTrades: 0,
          largestBuy: 0,
          largestSell: 0,
          levels: /* @__PURE__ */ new Map()
        };
        byTime.set(t, acc);
      }
      if (bar.time <= acc.openTime) {
        acc.openTime = bar.time;
        acc.open = bar.open;
      }
      if (bar.time >= acc.closeTime) {
        acc.closeTime = bar.time;
        acc.close = bar.close;
      }
      acc.high = Math.max(acc.high, bar.high);
      acc.low = Math.min(acc.low, bar.low);
      acc.totalBuy += bar.totalBuy;
      acc.totalSell += bar.totalSell;
      acc.trades += bar.trades;
      acc.buyTrades += bar.buyTrades ?? 0;
      acc.sellTrades += bar.sellTrades ?? 0;
      acc.largestBuy = Math.max(acc.largestBuy, bar.largestBuy ?? 0);
      acc.largestSell = Math.max(acc.largestSell, bar.largestSell ?? 0);
      for (const level2 of bar.levels) {
        const entry = acc.levels.get(level2.price);
        if (entry) {
          entry.buy += level2.buy;
          entry.sell += level2.sell;
        } else {
          acc.levels.set(level2.price, { price: level2.price, buy: level2.buy, sell: level2.sell });
        }
      }
    }
    const first = bars[0];
    return [...byTime.values()].sort((a, b) => a.time - b.time).map((acc) => ({
      symbol: first?.symbol ?? "",
      exchange: first?.exchange ?? "binance",
      market: first?.market ?? "perp",
      time: acc.time,
      open: acc.open,
      high: acc.high,
      low: acc.low,
      close: acc.close,
      totalBuy: acc.totalBuy,
      totalSell: acc.totalSell,
      trades: acc.trades,
      buyTrades: acc.buyTrades,
      sellTrades: acc.sellTrades,
      largestBuy: acc.largestBuy,
      largestSell: acc.largestSell,
      levels: [...acc.levels.values()].sort((a, b) => a.price - b.price)
    }));
  }

  // src/pattern-recognition/candle-classification-types.ts
  var CONTROL_STATES = [
    "BUYER_IN_CONTROL",
    "SELLER_IN_CONTROL",
    "BALANCED",
    "UNCLEAR"
  ];
  var DOMINANT_LIQUIDITY_EVENTS = [
    "ASKS_CONSUMED",
    "BIDS_CONSUMED",
    "ASKS_PULLED",
    "BIDS_PULLED",
    "ASKS_REPLENISHED",
    "BIDS_REPLENISHED",
    "ASKS_SURVIVING",
    "BIDS_SURVIVING",
    "NONE"
  ];

  // src/pattern-recognition/transition-table.ts
  var MAX_SEQUENCE_DEPTH = 5;
  var LABEL_SET = new Set(CANDLE_LABELS);
  function isCandleLabel(value) {
    return LABEL_SET.has(value);
  }
  function normalizeLabel(value) {
    if (value && isCandleLabel(value)) return value;
    return "UNCLASSIFIED";
  }
  function ngramKey(patternId, labels) {
    const seq = labels.join(">");
    return patternId ? `@${patternId}|${seq}` : seq;
  }
  var TransitionTable = class {
    streams = /* @__PURE__ */ new Map();
    observe(symbol, timeframe, contextLabels, nextLabel, patternId, maxDepth = MAX_SEQUENCE_DEPTH) {
      const labels = contextLabels.map(normalizeLabel);
      if (!labels.length) return;
      const next = normalizeLabel(nextLabel);
      const stream = this.stream(symbol, timeframe);
      const depth = Math.min(maxDepth, labels.length);
      for (let d = 1; d <= depth; d++) {
        const slice = labels.slice(-d);
        this.bump(stream, ngramKey(null, slice), next);
        if (patternId) this.bump(stream, ngramKey(patternId, slice), next);
      }
    }
    lookup(symbol, timeframe, contextLabels, depth, patternId) {
      const labels = contextLabels.map(normalizeLabel);
      if (depth < 1 || labels.length < depth) return emptyCounts();
      const slice = labels.slice(-depth);
      const row = this.streams.get(streamKey2(symbol, timeframe))?.get(ngramKey(patternId, slice));
      if (!row) return emptyCounts();
      let total = 0;
      const byLabel = /* @__PURE__ */ new Map();
      for (const [label, n] of row) {
        byLabel.set(label, n);
        total += n;
      }
      return { total, byLabel };
    }
    sampleCount(symbol, timeframe) {
      const stream = this.streams.get(streamKey2(symbol, timeframe));
      if (!stream) return 0;
      let n = 0;
      for (const [key3, row] of stream) {
        if (key3.includes("|") || key3.startsWith("@")) continue;
        if (!key3.includes(">")) {
          for (const c of row.values()) n += c;
        }
      }
      return n;
    }
    clear(symbol, timeframe) {
      if (symbol && timeframe) {
        this.streams.delete(streamKey2(symbol, timeframe));
        return;
      }
      this.streams.clear();
    }
    stream(symbol, timeframe) {
      const key3 = streamKey2(symbol, timeframe);
      let stream = this.streams.get(key3);
      if (!stream) {
        stream = /* @__PURE__ */ new Map();
        this.streams.set(key3, stream);
      }
      return stream;
    }
    bump(stream, key3, next) {
      let row = stream.get(key3);
      if (!row) {
        row = /* @__PURE__ */ new Map();
        stream.set(key3, row);
      }
      row.set(next, (row.get(next) ?? 0) + 1);
    }
  };
  function streamKey2(symbol, timeframe) {
    return `${symbol}|${timeframe}`;
  }
  function emptyCounts() {
    return { total: 0, byLabel: /* @__PURE__ */ new Map() };
  }

  // src/pattern-recognition/dimension-transition-table.ts
  var DimensionTransitionTable = class {
    streams = /* @__PURE__ */ new Map();
    observe(symbol, timeframe, dimension, context, next, patternId, maxDepth = MAX_SEQUENCE_DEPTH) {
      if (!context.length) return;
      const stream = this.stream(symbol, timeframe, dimension);
      const depth = Math.min(maxDepth, context.length);
      for (let d = 1; d <= depth; d++) {
        const slice = context.slice(-d);
        this.bump(stream, ngramKey(null, slice), next);
        if (patternId) this.bump(stream, ngramKey(patternId, slice), next);
      }
    }
    lookup(symbol, timeframe, dimension, context, depth, patternId) {
      if (depth < 1 || context.length < depth) return { total: 0, byValue: /* @__PURE__ */ new Map() };
      const slice = context.slice(-depth);
      const row = this.streams.get(streamKey3(symbol, timeframe, dimension))?.get(ngramKey(patternId, slice));
      if (!row) return { total: 0, byValue: /* @__PURE__ */ new Map() };
      let total = 0;
      const byValue = /* @__PURE__ */ new Map();
      for (const [value, n] of row) {
        byValue.set(value, n);
        total += n;
      }
      return { total, byValue };
    }
    clear(symbol, timeframe) {
      if (symbol && timeframe) {
        for (const dim of ["control", "specialEvent", "liquidity"]) {
          this.streams.delete(streamKey3(symbol, timeframe, dim));
        }
        return;
      }
      this.streams.clear();
    }
    stream(symbol, timeframe, dimension) {
      const key3 = streamKey3(symbol, timeframe, dimension);
      let stream = this.streams.get(key3);
      if (!stream) {
        stream = /* @__PURE__ */ new Map();
        this.streams.set(key3, stream);
      }
      return stream;
    }
    bump(stream, key3, next) {
      let row = stream.get(key3);
      if (!row) {
        row = /* @__PURE__ */ new Map();
        stream.set(key3, row);
      }
      row.set(next, (row.get(next) ?? 0) + 1);
    }
  };
  function streamKey3(symbol, timeframe, dimension) {
    return `${symbol}|${timeframe}|${dimension}`;
  }
  var SPECIAL_EVENT_PREDICT_VALUES = [
    "NONE",
    "STOP_HUNT_HIGH",
    "STOP_HUNT_LOW",
    "BUYER_ABSORBED",
    "SELLER_ABSORBED",
    "HELD_SUPPORT",
    "REJECTED_RESISTANCE",
    "FAILED_BULLISH_REVERSAL",
    "FAILED_BEARISH_REVERSAL",
    "BREAKOUT_ACCEPTANCE",
    "BREAKDOWN_ACCEPTANCE"
  ];
  function controlToken(control) {
    return control;
  }
  function specialEventToken(type) {
    return type ?? "NONE";
  }
  function liquidityToken(event) {
    return event;
  }

  // src/pattern-recognition/prediction-eval.ts
  var CALIBRATION_BUCKETS = [
    [0.5, 0.6],
    [0.6, 0.7],
    [0.7, 0.8],
    [0.8, 0.9],
    [0.9, 1.0001]
  ];
  var PredictionEvaluation = class {
    total = 0;
    top1Hits = 0;
    top2Hits = 0;
    buckets = CALIBRATION_BUCKETS.map(([lo, hi]) => ({ lo, hi, predictions: 0, hits: 0 }));
    byLabel = /* @__PURE__ */ new Map();
    byTimeframe = /* @__PURE__ */ new Map();
    byDepth = /* @__PURE__ */ new Map();
    byPattern = /* @__PURE__ */ new Map();
    confusion = /* @__PURE__ */ new Map();
    record(prediction, actual, meta) {
      const actualLabel = normalizeLabel(actual);
      this.total += 1;
      const top = prediction.prediction;
      const second = prediction.secondPrediction;
      const hit1 = top === actualLabel;
      const hit2 = hit1 || second === actualLabel;
      if (hit1) this.top1Hits += 1;
      if (hit2) this.top2Hits += 1;
      const p = prediction.probability;
      for (const bucket2 of this.buckets) {
        if (p >= bucket2.lo && p < bucket2.hi) {
          bucket2.predictions += 1;
          if (hit1) bucket2.hits += 1;
          break;
        }
      }
      bump(this.byLabel, actualLabel, hit1);
      if (meta?.timeframe) bump(this.byTimeframe, meta.timeframe, hit1);
      bump(this.byDepth, String(prediction.sequenceDepth), hit1);
      bump(this.byPattern, meta?.patternId ?? prediction.patternId ?? "none", hit1);
      const predicted = top ?? "NONE";
      let row = this.confusion.get(predicted);
      if (!row) {
        row = /* @__PURE__ */ new Map();
        this.confusion.set(predicted, row);
      }
      row.set(actualLabel, (row.get(actualLabel) ?? 0) + 1);
    }
    snapshot() {
      return {
        total: this.total,
        top1Hits: this.top1Hits,
        top2Hits: this.top2Hits,
        top1Accuracy: this.total ? this.top1Hits / this.total : null,
        top2Accuracy: this.total ? this.top2Hits / this.total : null,
        calibration: this.buckets.map((b) => ({
          lo: b.lo,
          hi: b.hi > 1 ? 1 : b.hi,
          predictions: b.predictions,
          hits: b.hits,
          hitRate: b.predictions ? b.hits / b.predictions : null
        })),
        byLabel: Object.fromEntries(this.byLabel),
        byTimeframe: Object.fromEntries(this.byTimeframe),
        byDepth: Object.fromEntries(this.byDepth),
        byPattern: Object.fromEntries(this.byPattern),
        confusion: confusionObject(this.confusion)
      };
    }
    reset() {
      this.total = 0;
      this.top1Hits = 0;
      this.top2Hits = 0;
      for (const b of this.buckets) {
        b.predictions = 0;
        b.hits = 0;
      }
      this.byLabel.clear();
      this.byTimeframe.clear();
      this.byDepth.clear();
      this.byPattern.clear();
      this.confusion.clear();
    }
  };
  function bump(map, key3, hit) {
    const row = map.get(key3) ?? { n: 0, hits: 0 };
    row.n += 1;
    if (hit) row.hits += 1;
    map.set(key3, row);
  }
  function confusionObject(map) {
    const out = {};
    for (const label of ["NONE", ...CANDLE_LABELS]) {
      const row = map.get(label);
      if (!row) continue;
      out[label] = Object.fromEntries(row);
    }
    for (const [pred, row] of map) {
      if (out[pred]) continue;
      out[pred] = Object.fromEntries(row);
    }
    return out;
  }

  // src/pattern-recognition/next-state-predictor.ts
  var DEFAULT_PREDICTOR_OPTIONS = {
    minimumTopProbability: 0.6,
    minimumPredictionMargin: 0.15,
    minimumSampleCount: 100,
    maxDepth: MAX_SEQUENCE_DEPTH
  };
  var DISPLAY_TOP = 4;
  var NextFootprintStatePredictor = class {
    table = new TransitionTable();
    dimensions = new DimensionTransitionTable();
    evaluation = new PredictionEvaluation();
    pending = /* @__PURE__ */ new Map();
    options;
    constructor(options = {}) {
      this.options = {
        minimumTopProbability: options.minimumTopProbability ?? DEFAULT_PREDICTOR_OPTIONS.minimumTopProbability,
        minimumPredictionMargin: options.minimumPredictionMargin ?? DEFAULT_PREDICTOR_OPTIONS.minimumPredictionMargin,
        minimumSampleCount: options.minimumSampleCount ?? DEFAULT_PREDICTOR_OPTIONS.minimumSampleCount,
        maxDepth: options.maxDepth ?? DEFAULT_PREDICTOR_OPTIONS.maxDepth
      };
    }
    /**
     * Record a completed transition T-1 → T. Call this only after candle T is final.
     * Evaluates the previous prediction against `nextLabel` (no lookahead).
     */
    observeCompleted(input) {
      const key3 = streamKey4(input.symbol, input.timeframe);
      const pending = this.pending.get(key3);
      if (pending) {
        this.evaluation.record(pending, input.nextLabel, {
          timeframe: input.timeframe,
          patternId: input.patternId ?? pending.patternId
        });
        this.pending.delete(key3);
      }
      this.table.observe(
        input.symbol,
        input.timeframe,
        input.contextLabels,
        input.nextLabel,
        input.patternId,
        this.options.maxDepth
      );
      this.observeDimensions(input);
    }
    /** Train from a finalized tape. Pair i-1 → i never inspects i+1. */
    trainFromCandles(candles, patternAt) {
      for (let i = 1; i < candles.length; i++) {
        const ctx = candles.slice(0, i);
        const first = ctx[0];
        const next = candles[i];
        if (!first) continue;
        this.table.observe(
          first.symbol,
          first.timeframe,
          ctx.map((c) => c.label),
          next.label,
          patternAt?.[i - 1] ?? null,
          this.options.maxDepth
        );
        this.observeDimensions({
          symbol: first.symbol,
          timeframe: first.timeframe,
          patternId: patternAt?.[i - 1] ?? null,
          contextControls: ctx.map((c) => controlToken(c.classification?.primaryState.control ?? "UNCLEAR")),
          nextControl: controlToken(next.classification?.primaryState.control ?? "UNCLEAR"),
          contextSpecialEvents: ctx.map((c) => specialEventToken(c.classification?.specialEvent.type ?? null)),
          nextSpecialEvent: specialEventToken(next.classification?.specialEvent.type ?? null),
          contextLiquidityEvents: ctx.map(
            (c) => liquidityToken(c.classification?.liquidityBehavior.dominantEvent ?? "NONE")
          ),
          nextLiquidityEvent: liquidityToken(next.classification?.liquidityBehavior.dominantEvent ?? "NONE")
        });
      }
    }
    predict(input) {
      const labels = input.contextLabels.map(normalizeLabel);
      const dims = this.dimensionPredictions(input, labels);
      const empty = emptyPrediction(input.patternId ?? null);
      if (!labels.length) return { ...empty, ...dims };
      const picked = this.pickCounts(input.symbol, input.timeframe, labels, input.patternId ?? null);
      if (!picked || picked.counts.total <= 0) return { ...empty, ...dims };
      const ranked = rankDistribution(picked.counts.byLabel, picked.counts.total);
      const top = ranked[0];
      const second = ranked[1];
      const topP = top?.p ?? 0;
      const secondP = second?.p ?? 0;
      const margin = topP - secondP;
      const enoughSamples = picked.counts.total >= this.options.minimumSampleCount;
      const clear = enoughSamples && topP >= this.options.minimumTopProbability && margin >= this.options.minimumPredictionMargin && top != null;
      const confidenceScore2 = scorePredictionConfidence({
        topP,
        margin,
        sampleCount: picked.counts.total,
        depth: picked.depth,
        minSamples: this.options.minimumSampleCount
      });
      const result = {
        status: clear ? "PREDICTED" : "NO_CLEAR_PREDICTION",
        prediction: top?.label ?? null,
        probability: round4(topP),
        secondPrediction: second?.label ?? null,
        secondProbability: round4(secondP),
        margin: round4(margin),
        confidence: bandFor(clear, confidenceScore2, topP, margin, picked.counts.total),
        confidenceScore: confidenceScore2,
        sampleCount: picked.counts.total,
        sequenceDepth: picked.depth,
        patternId: picked.patternId,
        distribution: toDisplayDistribution(ranked),
        ...dims
      };
      if (input.remember !== false) {
        this.pending.set(streamKey4(input.symbol, input.timeframe), result);
      }
      return result;
    }
    reset(symbol, timeframe) {
      this.table.clear(symbol, timeframe);
      this.dimensions.clear(symbol, timeframe);
      if (symbol && timeframe) this.pending.delete(streamKey4(symbol, timeframe));
      else this.pending.clear();
      if (!symbol) this.evaluation.reset();
    }
    dimensionPredictions(input, labels) {
      return {
        nextControl: this.predictDimension(
          input.symbol,
          input.timeframe,
          "control",
          input.contextControls ?? labels,
          CONTROL_STATES,
          input.patternId ?? null
        ),
        nextSpecialEvent: this.predictDimension(
          input.symbol,
          input.timeframe,
          "specialEvent",
          input.contextSpecialEvents ?? labels,
          SPECIAL_EVENT_PREDICT_VALUES,
          input.patternId ?? null
        ),
        nextDominantLiquidity: this.predictDimension(
          input.symbol,
          input.timeframe,
          "liquidity",
          input.contextLiquidityEvents ?? labels,
          DOMINANT_LIQUIDITY_EVENTS,
          input.patternId ?? null
        )
      };
    }
    observeDimensions(input) {
      if (input.contextControls?.length && input.nextControl) {
        this.dimensions.observe(
          input.symbol,
          input.timeframe,
          "control",
          input.contextControls,
          input.nextControl,
          input.patternId,
          this.options.maxDepth
        );
      }
      if (input.contextSpecialEvents?.length && input.nextSpecialEvent) {
        this.dimensions.observe(
          input.symbol,
          input.timeframe,
          "specialEvent",
          input.contextSpecialEvents,
          input.nextSpecialEvent,
          input.patternId,
          this.options.maxDepth
        );
      }
      if (input.contextLiquidityEvents?.length && input.nextLiquidityEvent) {
        this.dimensions.observe(
          input.symbol,
          input.timeframe,
          "liquidity",
          input.contextLiquidityEvents,
          input.nextLiquidityEvent,
          input.patternId,
          this.options.maxDepth
        );
      }
    }
    predictDimension(symbol, timeframe, dimension, context, alphabet, patternId) {
      const empty = {
        status: "NO_CLEAR_PREDICTION",
        prediction: null,
        probability: 0,
        secondPrediction: null,
        secondProbability: 0,
        margin: 0,
        sampleCount: 0,
        distribution: {}
      };
      if (!context.length) return empty;
      const maxD = Math.min(this.options.maxDepth, context.length);
      let best = null;
      for (let d = maxD; d >= 1; d--) {
        if (patternId) {
          const cond = this.dimensions.lookup(symbol, timeframe, dimension, context, d, patternId);
          if (cond.total >= this.options.minimumSampleCount) {
            best = { ...cond, depth: d };
            break;
          }
        }
        const uncond = this.dimensions.lookup(symbol, timeframe, dimension, context, d, null);
        if (uncond.total >= this.options.minimumSampleCount) {
          best = { ...uncond, depth: d };
          break;
        }
        if (uncond.total > (best?.total ?? 0)) best = { ...uncond, depth: d };
      }
      if (!best || best.total <= 0) return empty;
      const ranked = [...alphabet].map((value) => ({
        value,
        n: best.byValue.get(value) ?? 0,
        p: (best.byValue.get(value) ?? 0) / best.total
      })).filter((r) => r.n > 0).sort((a, b) => b.p - a.p || a.value.localeCompare(b.value));
      const top = ranked[0];
      const second = ranked[1];
      const topP = top?.p ?? 0;
      const secondP = second?.p ?? 0;
      const margin = topP - secondP;
      const clear = best.total >= this.options.minimumSampleCount && topP >= this.options.minimumTopProbability && margin >= this.options.minimumPredictionMargin && top != null;
      const distribution = {};
      let other = 0;
      ranked.forEach((row, i) => {
        if (i < DISPLAY_TOP) distribution[row.value] = round4(row.p);
        else other += row.p;
      });
      if (other > 0) distribution.OTHER = round4(other);
      return {
        status: clear ? "PREDICTED" : "NO_CLEAR_PREDICTION",
        prediction: top?.value ?? null,
        probability: round4(topP),
        secondPrediction: second?.value ?? null,
        secondProbability: round4(secondP),
        margin: round4(margin),
        sampleCount: best.total,
        distribution
      };
    }
    pickCounts(symbol, timeframe, labels, patternId) {
      const maxD = Math.min(this.options.maxDepth, labels.length);
      const minN = this.options.minimumSampleCount;
      for (let d = maxD; d >= 1; d--) {
        if (patternId) {
          const cond = this.table.lookup(symbol, timeframe, labels, d, patternId);
          if (cond.total >= minN) return { counts: cond, depth: d, patternId };
        }
        const uncond = this.table.lookup(symbol, timeframe, labels, d, null);
        if (uncond.total >= minN) return { counts: uncond, depth: d, patternId: null };
      }
      let best = null;
      for (let d = maxD; d >= 1; d--) {
        const uncond = this.table.lookup(symbol, timeframe, labels, d, null);
        if (uncond.total > (best?.counts.total ?? 0)) best = { counts: uncond, depth: d, patternId: null };
      }
      return best;
    }
  };
  function rankDistribution(byLabel, total) {
    const rows = [];
    for (const label of CANDLE_LABELS) {
      const n = byLabel.get(label) ?? 0;
      if (!n) continue;
      rows.push({ label, p: n / total, n });
    }
    rows.sort((a, b) => b.p - a.p || a.label.localeCompare(b.label));
    return rows;
  }
  function toDisplayDistribution(ranked) {
    const out = {};
    let other = 0;
    ranked.forEach((row, i) => {
      if (i < DISPLAY_TOP) out[row.label] = round4(row.p);
      else other += row.p;
    });
    if (other > 0) out.OTHER = round4(other);
    return out;
  }
  function scorePredictionConfidence(input) {
    const sampleScore = clamp(Math.log((input.sampleCount + 1) / input.minSamples) / Math.log(20), 0, 1);
    const depthScore = clamp(input.depth / MAX_SEQUENCE_DEPTH, 0, 1);
    const marginScore = clamp(input.margin / 0.4, 0, 1);
    const raw = 100 * (0.35 * input.topP + 0.25 * marginScore + 0.25 * sampleScore + 0.15 * depthScore);
    return Math.round(clamp(raw, 0, 100));
  }
  function bandFor(clear, score, topP, margin, n) {
    if (!clear) return "LOW";
    if (score >= 70 && topP >= 0.7 && margin >= 0.2 && n >= 400) return "HIGH";
    return "MODERATE";
  }
  function emptyPrediction(patternId) {
    return {
      status: "NO_CLEAR_PREDICTION",
      prediction: null,
      probability: 0,
      secondPrediction: null,
      secondProbability: 0,
      margin: 0,
      confidence: "LOW",
      confidenceScore: 0,
      sampleCount: 0,
      sequenceDepth: 0,
      patternId,
      distribution: {}
    };
  }
  function round4(n) {
    return Math.round(n * 1e4) / 1e4;
  }
  function streamKey4(symbol, timeframe) {
    return `${symbol}|${timeframe}`;
  }
  function toCurrentPattern(candidate) {
    if (!candidate) return null;
    const preview = candidate.status === "PREVIEW";
    return {
      id: candidate.id,
      status: preview ? "FORMING" : candidate.status,
      progress: Math.round(clamp(candidate.progress, 0, 1) * 100),
      confidence: candidate.confidence,
      title: candidate.title,
      preview
    };
  }

  // src/pattern-recognition/from-bars.ts
  var PATTERN_TF_MINUTES = [1, 5, 15, 30, 45, 60, 120, 240, 1440];
  function historyPatternView(bars, timeframeMinutes2, options) {
    const tf = minutesToTimeframe(timeframeMinutes2);
    const { finalized, preview } = labelFootprintBars(bars, tf, { lastIsLive: options?.lastIsLive });
    const engine2 = new PatternRecognitionEngine();
    const { snapshots, last } = replayPatterns(finalized, engine2);
    const byKey = /* @__PURE__ */ new Map();
    for (const snap of snapshots) {
      for (const candidate of snap.candidates) {
        if (candidate.status !== "CONFIRMED" && candidate.status !== "FORMING" && candidate.status !== "PREVIEW") {
          continue;
        }
        const key3 = `${candidate.id}:${candidate.startTimestamp}`;
        const time = candidate.status === "CONFIRMED" ? candidate.confirmedTimestamp ?? candidate.candleTimestamps[candidate.candleTimestamps.length - 1] ?? 0 : candidate.candleTimestamps[candidate.candleTimestamps.length - 1] ?? candidate.startTimestamp;
        byKey.set(key3, toPatternMarker(candidate, time));
      }
    }
    const predictor = options?.predictor ?? new NextFootprintStatePredictor();
    if (!options?.predictor && finalized.length) {
      const patternAt = snapshots.map((s) => s.primaryPattern?.id ?? null);
      predictor.trainFromCandles(finalized, patternAt);
    }
    const nextState = finalized.length ? predictor.predict({
      symbol: finalized[0].symbol,
      timeframe: tf,
      contextLabels: finalized.map((c) => c.label),
      patternId: last?.primaryPattern?.id ?? null,
      remember: false
    }) : null;
    let snapshot = last;
    if (preview) snapshot = engine2.ingest(preview, { preview: true });
    if (snapshot) snapshot.nextState = nextState;
    const live = snapshot?.primaryPattern;
    if (live && (live.status === "FORMING" || live.status === "PREVIEW" || live.status === "CONFIRMED")) {
      const time = live.candleTimestamps[live.candleTimestamps.length - 1] ?? live.startTimestamp;
      byKey.set(`${live.id}:${live.startTimestamp}`, toPatternMarker(live, time));
    }
    return { snapshot, markers: [...byKey.values()] };
  }
  function mergeByTime(bars) {
    if (bars.length <= 1) return bars;
    return rollup(bars, 1);
  }
  function completedTfBar(minuteBars, timeframeMinutes2, closedMinuteTime) {
    if (timeframeMinutes2 <= 1) {
      return minuteBars.find((b) => b.time === closedMinuteTime) ?? null;
    }
    const bucketSec = timeframeMinutes2 * 60;
    if (closedMinuteTime % bucketSec !== 0) return null;
    const start = closedMinuteTime - bucketSec;
    const slice = minuteBars.filter((b) => b.time >= start && b.time < closedMinuteTime);
    if (!slice.length) return null;
    return rollup(slice, timeframeMinutes2)[0] ?? null;
  }
  function currentTfBar(minuteBars, timeframeMinutes2, currentMinuteTime) {
    const bucketSec = timeframeMinutes2 * 60;
    const start = currentMinuteTime - currentMinuteTime % bucketSec;
    const slice = minuteBars.filter((b) => b.time >= start && b.time <= currentMinuteTime);
    if (!slice.length) return null;
    return rollup(slice, timeframeMinutes2)[0] ?? null;
  }

  // src/pattern-recognition/live-hub.ts
  var MINUTE_CAP = 1600;
  var PatternLiveHub = class {
    engine = new PatternRecognitionEngine();
    predictor;
    bySymbol = /* @__PURE__ */ new Map();
    lastSnap = /* @__PURE__ */ new Map();
    constructor(options) {
      this.predictor = options?.predictor ?? new NextFootprintStatePredictor();
    }
    observeClosed(bars) {
      const alerts = [];
      const dirty = [];
      const grouped = /* @__PURE__ */ new Map();
      for (const bar of bars) {
        const key3 = `${bar.symbol}|${bar.market}`;
        const list = grouped.get(key3) ?? [];
        list.push(bar);
        grouped.set(key3, list);
      }
      for (const [key3, list] of grouped) {
        const [symbol, market] = key3.split("|");
        const result = this.observeSymbol(symbol, market, list);
        alerts.push(...result.alerts);
        if (result.ingested) dirty.push(symbol);
      }
      return { alerts, dirty: [...new Set(dirty)] };
    }
    snapshot(symbol, timeframeMinutes2, market = "perp") {
      return this.lastSnap.get(`${symbol}|${market}|${minutesToTimeframe(timeframeMinutes2)}`) ?? null;
    }
    snapshotsForSymbol(symbol, market = "perp") {
      const prefix = `${symbol}|${market}|`;
      const out = [];
      for (const [key3, snap] of this.lastSnap) {
        if (key3.startsWith(prefix)) out.push(snap);
      }
      return out;
    }
    observeSymbol(symbol, market, incoming) {
      const buf = this.buf(symbol, market);
      const mergedIncoming = mergeByTime(incoming).sort((a, b) => a.time - b.time);
      const alerts = [];
      let ingested = false;
      for (const bar of mergedIncoming) {
        const existing = buf.minutes.toArray();
        if (existing.some((b) => b.time === bar.time)) {
          replaceMinute(buf.minutes, bar);
        } else {
          buf.minutes.push(bar);
        }
        if (bar.time < buf.lastMinute) continue;
        buf.lastMinute = bar.time;
        const closed = this.closeTimeframes(symbol, market, buf, bar.time);
        alerts.push(...closed.alerts);
        if (closed.ingested) ingested = true;
      }
      this.previewTimeframes(symbol, market, buf);
      return { alerts, ingested };
    }
    closeTimeframes(symbol, market, buf, closedMinute) {
      const alerts = [];
      let ingested = false;
      const minutes = mergeByTime(buf.minutes.toArray()).sort((a, b) => a.time - b.time);
      for (const tf of PATTERN_TF_MINUTES) {
        const completed = completedTfBar(minutes, tf, closedMinute);
        if (!completed) continue;
        const last = buf.lastTf.get(tf);
        if (last != null && last >= completed.time) continue;
        buf.lastTf.set(tf, completed.time);
        ingested = true;
        const priorTf = rollup(
          minutes.filter((b) => b.time < completed.time),
          tf
        ).slice(-20);
        const candle = labelFootprintBar(completed, priorTf, minutesToTimeframe(tf));
        const tfName = minutesToTimeframe(tf);
        const snapKey = `${symbol}|${market}|${tfName}`;
        const prevSnap = this.lastSnap.get(snapKey);
        const priorLabels = this.engine.labels(symbol, tfName);
        if (priorLabels.length) {
          this.predictor.observeCompleted({
            symbol,
            timeframe: tfName,
            contextLabels: priorLabels.map((c) => c.label),
            nextLabel: candle.label,
            patternId: prevSnap?.primaryPattern?.id ?? null,
            contextControls: priorLabels.map((c) => controlToken(c.classification?.primaryState.control ?? "UNCLEAR")),
            nextControl: controlToken(candle.classification.primaryState.control),
            contextSpecialEvents: priorLabels.map((c) => specialEventToken(c.classification?.specialEvent.type ?? null)),
            nextSpecialEvent: specialEventToken(candle.classification.specialEvent.type),
            contextLiquidityEvents: priorLabels.map(
              (c) => liquidityToken(c.classification?.liquidityBehavior.dominantEvent ?? "NONE")
            ),
            nextLiquidityEvent: liquidityToken(candle.classification.liquidityBehavior.dominantEvent)
          });
        }
        const snap = this.engine.ingest(candle);
        const labeled = this.engine.labels(symbol, tfName);
        snap.nextState = this.predictor.predict({
          symbol,
          timeframe: tfName,
          contextLabels: labeled.map((c) => c.label),
          patternId: snap.primaryPattern?.id ?? null,
          contextControls: labeled.map((c) => controlToken(c.classification?.primaryState.control ?? "UNCLEAR")),
          contextSpecialEvents: labeled.map((c) => specialEventToken(c.classification?.specialEvent.type ?? null)),
          contextLiquidityEvents: labeled.map(
            (c) => liquidityToken(c.classification?.liquidityBehavior.dominantEvent ?? "NONE")
          )
        });
        this.lastSnap.set(snapKey, snap);
        alerts.push(...snap.alerts);
      }
      return { alerts, ingested };
    }
    previewTimeframes(symbol, market, buf) {
      const minutes = mergeByTime(buf.minutes.toArray()).sort((a, b) => a.time - b.time);
      const last = minutes[minutes.length - 1];
      if (!last) return;
      for (const tf of PATTERN_TF_MINUTES) {
        if (tf <= 1) continue;
        const forming = currentTfBar(minutes, tf, last.time);
        if (!forming || forming.time === buf.lastTf.get(tf)) continue;
        const priorTf = rollup(
          minutes.filter((b) => b.time < forming.time),
          tf
        ).slice(-20);
        const candle = labelFootprintBar(forming, priorTf, minutesToTimeframe(tf));
        const tfName = minutesToTimeframe(tf);
        const snap = this.engine.ingest(candle, { preview: true });
        const labeled = this.engine.labels(symbol, tfName);
        snap.nextState = this.predictor.predict({
          symbol,
          timeframe: tfName,
          contextLabels: labeled.map((c) => c.label),
          patternId: snap.primaryPattern?.id ?? null,
          remember: false,
          contextControls: labeled.map((c) => controlToken(c.classification?.primaryState.control ?? "UNCLEAR")),
          contextSpecialEvents: labeled.map((c) => specialEventToken(c.classification?.specialEvent.type ?? null)),
          contextLiquidityEvents: labeled.map(
            (c) => liquidityToken(c.classification?.liquidityBehavior.dominantEvent ?? "NONE")
          )
        });
        this.lastSnap.set(`${symbol}|${market}|${tfName}`, snap);
      }
    }
    buf(symbol, market) {
      const key3 = `${symbol}|${market}`;
      let buf = this.bySymbol.get(key3);
      if (!buf) {
        buf = { minutes: new RingBuffer(MINUTE_CAP), lastMinute: 0, lastTf: /* @__PURE__ */ new Map() };
        this.bySymbol.set(key3, buf);
      }
      return buf;
    }
  };
  function replaceMinute(buf, bar) {
    const arr = buf.toArray();
    const idx = arr.findIndex((b) => b.time === bar.time);
    if (idx < 0) {
      buf.push(bar);
      return;
    }
    arr[idx] = bar;
    buf.clear();
    for (const item of arr) buf.push(item);
  }

  // src/level-interaction/types.ts
  var LEVEL_EVENT_SHORT = {
    FAIL_UP: "FAIL \u2191",
    FAIL_DOWN: "FAIL \u2193",
    RECLAIM_UP: "REC \u2191",
    RECLAIM_DOWN: "REC \u2193"
  };
  var LEVEL_EVENT_PRIORITY = {
    RECLAIM_UP: 100,
    RECLAIM_DOWN: 100,
    FAIL_UP: 80,
    FAIL_DOWN: 80
  };
  var FAIL_RECLAIM_WICK_GAP = 14;
  function failReclaimLabelY(barHighY, gap = FAIL_RECLAIM_WICK_GAP) {
    return barHighY - gap;
  }

  // src/level-interaction/config.ts
  var DEFAULT_LEVEL_INTERACTION_CONFIG = {
    minConsecutiveCloses: 2,
    atrPenetration: 0.08,
    bpsPenetration: 4,
    minPenetrationPrice: 0,
    minRangeAtr: 0.12,
    minAttemptVolume: 0,
    altVolumeRatio: 0.45,
    altDispBps: 12,
    cooldownBars: 3,
    reclaimWindowBars: 12,
    lineExtendBars: 2,
    maxEventLines: 24,
    atrLookback: 8,
    minAtrBars: 2,
    zonePadAtr: 0.12,
    zoneMergeAtr: 0.35,
    swingLookback: 48,
    imbalanceRatio: 3,
    aggressionRatio: 0.18,
    effortHigh: 62,
    resultStrong: 55,
    resultWeak: 28,
    maxTrackedLevels: 48,
    weights: {
      levelSignificance: 0.15,
      timeVolumeBeyond: 0.25,
      aggressiveFlow: 0.18,
      effortResult: 0.15,
      passiveDefense: 0.12,
      followThrough: 0.15
    }
  };
  function mergeLevelInteractionConfig(partial) {
    if (!partial) return { ...DEFAULT_LEVEL_INTERACTION_CONFIG, weights: { ...DEFAULT_LEVEL_INTERACTION_CONFIG.weights } };
    return {
      ...DEFAULT_LEVEL_INTERACTION_CONFIG,
      ...partial,
      weights: { ...DEFAULT_LEVEL_INTERACTION_CONFIG.weights, ...partial.weights ?? {} }
    };
  }

  // src/footprint/displacement-cvd.ts
  var EPS = 1e-12;
  function aggressiveVolumes(bar) {
    const buy = Number(bar.aggressiveBuy ?? bar.totalBuy ?? 0);
    const sell = Number(bar.aggressiveSell ?? bar.totalSell ?? 0);
    return {
      buy: Number.isFinite(buy) && buy > 0 ? buy : 0,
      sell: Number.isFinite(sell) && sell > 0 ? sell : 0
    };
  }
  function displacementDirection(bps2, neutralBps = 1) {
    if (!Number.isFinite(bps2)) return "NEUTRAL";
    if (bps2 > neutralBps) return "BULLISH";
    if (bps2 < -neutralBps) return "BEARISH";
    return "NEUTRAL";
  }
  function computeDisplacement(bar, opts) {
    const open = Number(bar.open);
    const high = Number(bar.high);
    const low = Number(bar.low);
    const close = Number(bar.close);
    const atr = opts?.atr;
    const neutralBps = opts?.neutralBps ?? 1;
    if (![open, high, low, close].every((n) => Number.isFinite(n)) || open <= 0) {
      return {
        displacementRaw: 0,
        displacementPct: 0,
        displacementBps: 0,
        rangeRaw: 0,
        rangeBps: 0,
        bodyEfficiency: 0,
        displacementATR: null,
        direction: "NEUTRAL"
      };
    }
    const displacementRaw = close - open;
    const displacementPct = displacementRaw / open * 100;
    const displacementBps = displacementRaw / open * 1e4;
    const rangeRaw = Math.max(0, high - low);
    const rangeBps = rangeRaw / open * 1e4;
    const bodyEfficiency = Math.abs(displacementRaw) / Math.max(rangeRaw, EPS);
    const displacementATR = atr != null && Number.isFinite(atr) && atr > 0 ? displacementRaw / atr : null;
    return {
      displacementRaw,
      displacementPct,
      displacementBps,
      rangeRaw,
      rangeBps,
      bodyEfficiency: Math.min(1, Math.max(0, bodyEfficiency)),
      displacementATR,
      direction: displacementDirection(displacementBps, neutralBps)
    };
  }
  function flowDataQuality(bar) {
    if (bar.flowQuality) return bar.flowQuality;
    const { buy, sell } = aggressiveVolumes(bar);
    if (bar.hasFootprint === false && buy + sell <= 0) return "UNAVAILABLE";
    if (buy + sell <= 0) return "UNAVAILABLE";
    if (bar.hasFootprint === false) return "PARTIAL";
    return "GOOD";
  }

  // src/market-sequence/label-selector.ts
  function deriveEffortResult(buyEffort, sellEffort, upResult, downResult, cfg) {
    if (buyEffort >= cfg.effortHigh && upResult >= cfg.resultStrong) return "BUYERS_EFFECTIVE";
    if (buyEffort >= cfg.effortHigh && upResult <= cfg.resultWeak) return "BUYERS_INEFFECTIVE";
    if (sellEffort >= cfg.effortHigh && downResult >= cfg.resultStrong) return "SELLERS_EFFECTIVE";
    if (sellEffort >= cfg.effortHigh && downResult <= cfg.resultWeak) return "SELLERS_INEFFECTIVE";
    return "UNCLEAR";
  }

  // src/market-sequence/adapters.ts
  function resultScore(dispBps, dir, neutral = 2) {
    const raw = dir === "UP" ? dispBps : -dispBps;
    if (raw <= 0) return Math.max(0, 20 + raw);
    return Math.min(100, Math.round(raw / Math.max(neutral * 8, 1) * 100));
  }
  function effortScores(buy, sell, delta) {
    const vol = buy + sell;
    if (vol <= 0) return { buyEffort: 0, sellEffort: 0 };
    const dAmp = Math.min(1, Math.abs(delta) / vol) * 40;
    return {
      buyEffort: Math.round(Math.min(100, buy / vol * 70 + (delta > 0 ? dAmp : 0))),
      sellEffort: Math.round(Math.min(100, sell / vol * 70 + (delta < 0 ? dAmp : 0)))
    };
  }

  // src/level-interaction/evidence.ts
  function levelSide(type) {
    if (type === "HISTORICAL_SUPPORT" || type === "SWING_LOW" || type === "PREV_15M_LOW") {
      return "LOW";
    }
    return "HIGH";
  }
  function zoneBounds(level2) {
    const lo = level2.zoneLow ?? level2.price;
    const hi = level2.zoneHigh ?? level2.price;
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), mid: (lo + hi) / 2 };
  }
  function farBoundary(level2) {
    const z = zoneBounds(level2);
    return levelSide(level2.type) === "HIGH" ? z.hi : z.lo;
  }
  function priorAtr(bars, index, cfg) {
    const start = Math.max(0, index - cfg.atrLookback);
    const end = index;
    if (end - start < cfg.minAtrBars) return null;
    let sum = 0;
    let n = 0;
    let prevClose = start > 0 ? bars[start - 1]?.close ?? null : null;
    for (let i = start; i < end; i++) {
      const b = bars[i];
      if (!b || !Number.isFinite(b.high) || !Number.isFinite(b.low)) continue;
      const tr = prevClose != null ? Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)) : b.high - b.low;
      if (tr > 0 && Number.isFinite(tr)) {
        sum += tr;
        n += 1;
      }
      prevClose = b.close;
    }
    if (n < cfg.minAtrBars || !(sum > 0)) return null;
    return sum / n;
  }
  function penetrationTolerance(price, atr, cfg) {
    const tick = tickSize(price);
    const fromAtr = atr != null && atr > 0 ? atr * cfg.atrPenetration : 0;
    const fromBps = price > 0 ? price * (cfg.bpsPenetration / 1e4) : 0;
    return Math.max(tick, fromAtr, fromBps, cfg.minPenetrationPrice);
  }
  function volumeBeyondLevel(bar, boundary, side2) {
    const levels2 = bar.levels ?? [];
    if (!levels2.length) return { ratio: null, beyond: 0, total: 0 };
    let beyond = 0;
    let total = 0;
    for (const lv of levels2) {
      const vol = (lv.buy || 0) + (lv.sell || 0);
      if (!(vol > 0)) continue;
      total += vol;
      if (side2 === "HIGH" && lv.price > boundary) beyond += vol;
      if (side2 === "LOW" && lv.price < boundary) beyond += vol;
    }
    if (!(total > 0)) return { ratio: null, beyond, total };
    return { ratio: beyond / total, beyond, total };
  }
  function imbalanceBeyond(bar, boundary, side2, ratio) {
    const levels2 = bar.levels ?? [];
    if (!levels2.length) return null;
    let count = 0;
    for (const lv of levels2) {
      const onFar = side2 === "HIGH" ? lv.price > boundary : lv.price < boundary;
      if (!onFar) continue;
      const buy = lv.buy || 0;
      const sell = lv.sell || 0;
      if (buy >= sell * ratio && buy > 0) count += 1;
      else if (sell >= buy * ratio && sell > 0) count += 1;
    }
    return count;
  }
  function aggressiveVolumes2(bar) {
    const buy = Number(bar.aggressiveBuy ?? bar.totalBuy ?? 0);
    const sell = Number(bar.aggressiveSell ?? bar.totalSell ?? 0);
    return {
      buy: Number.isFinite(buy) && buy > 0 ? buy : 0,
      sell: Number.isFinite(sell) && sell > 0 ? sell : 0
    };
  }
  function barIsValid(bar) {
    return [bar.open, bar.high, bar.low, bar.close].every((n) => Number.isFinite(n) && n > 0) && bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close);
  }
  function isNarrowOrQuiet(bar, atr, cfg) {
    const range = bar.high - bar.low;
    if (atr != null && atr > 0 && range < atr * cfg.minRangeAtr) return true;
    const { buy, sell } = aggressiveVolumes2(bar);
    if (cfg.minAttemptVolume > 0 && buy + sell < cfg.minAttemptVolume) return true;
    return false;
  }
  function collectEvidence(bar, level2, atr, cfg, consecutiveBeyond, consecutiveOriginal) {
    const side2 = levelSide(level2.type);
    const boundary = farBoundary(level2);
    const tol = penetrationTolerance(bar.close || level2.price, atr, cfg);
    const disp = computeDisplacement(bar, { atr });
    const { buy, sell } = aggressiveVolumes2(bar);
    const vol = buy + sell;
    const delta = vol > 0 ? buy - sell : null;
    const deltaRatio = vol > 0 && delta != null ? delta / vol * 100 : null;
    const quality = flowDataQuality({
      aggressiveBuy: buy,
      aggressiveSell: sell,
      hasFootprint: bar.hasFootprint ?? Boolean(bar.levels?.length || vol > 0)
    });
    const closeBeyond = side2 === "HIGH" ? bar.close >= boundary + tol : bar.close <= boundary - tol;
    const penetrated = side2 === "HIGH" ? bar.high >= boundary + tol : bar.low <= boundary - tol;
    const wickOnly = penetrated && !closeBeyond;
    const bodyBeyond = side2 === "HIGH" ? Math.min(bar.open, bar.close) > boundary : Math.max(bar.open, bar.close) < boundary;
    const volBeyond = volumeBeyondLevel(bar, boundary, side2);
    const efforts = effortScores(buy, sell, delta ?? 0);
    const upResult = resultScore(disp.displacementBps, "UP");
    const downResult = resultScore(disp.displacementBps, "DOWN");
    const effort = deriveEffortResult(efforts.buyEffort, efforts.sellEffort, upResult, downResult, {
      effortHigh: cfg.effortHigh,
      resultStrong: cfg.resultStrong,
      resultWeak: cfg.resultWeak,
      maxBarsBetweenStages: 8,
      maxSequenceBars: 24,
      expansionDispBps: 18,
      maxActiveSequences: 32
    });
    const effortSide = efforts.buyEffort >= cfg.effortHigh && efforts.buyEffort >= efforts.sellEffort ? "BUYERS" : efforts.sellEffort >= cfg.effortHigh ? "SELLERS" : "UNCLEAR";
    const followThrough = side2 === "HIGH" ? disp.displacementBps > 0 && bar.close > bar.open : disp.displacementBps < 0 && bar.close < bar.open;
    const ask = bar.askDefense;
    const bid = bar.bidDefense;
    return {
      closeBeyond,
      penetrated,
      wickOnly,
      bodyBeyond,
      consecutiveClosesBeyond: consecutiveBeyond,
      consecutiveClosesOriginal: consecutiveOriginal,
      volumeBeyondRatio: volBeyond.ratio,
      timeBeyondMs: bar.timeBeyondMs ?? null,
      delta,
      deltaRatio,
      displacementBps: disp.displacementBps,
      displacementAtr: disp.displacementATR,
      bodyEfficiency: disp.bodyEfficiency,
      effortSide,
      effortEffective: effort === "BUYERS_EFFECTIVE" || effort === "SELLERS_EFFECTIVE",
      imbalanceBeyond: imbalanceBeyond(bar, boundary, side2, cfg.imbalanceRatio),
      askDefense: ask != null && Number.isFinite(ask) ? ask : null,
      bidDefense: bid != null && Number.isFinite(bid) ? bid : null,
      followThrough,
      dataQuality: quality === "GOOD" ? "GOOD" : quality === "UNAVAILABLE" ? "UNAVAILABLE" : "PARTIAL"
    };
  }
  function canConfirmReclaim(ev, cfg, hadLossOrAcceptedBreak, barsSinceLoss, incomplete) {
    if (incomplete) return false;
    if (!hadLossOrAcceptedBreak) return false;
    if (barsSinceLoss > cfg.reclaimWindowBars) return false;
    if (ev.closeBeyond) return false;
    return ev.consecutiveClosesOriginal >= cfg.minConsecutiveCloses;
  }
  function clamp012(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }
  function eventConfidence(eventType, ev, level2, cfg) {
    const w = cfg.weights;
    const parts = [];
    const significance = clamp012((level2.strength ?? level2.confidence ?? 55) / 100);
    parts.push({ w: w.levelSignificance, v: significance });
    const vol = ev.volumeBeyondRatio != null ? clamp012(ev.volumeBeyondRatio / 0.55) : null;
    const time = ev.timeBeyondMs != null ? clamp012(ev.timeBeyondMs / 6e4) : null;
    if (vol != null || time != null) {
      const tv = Math.max(vol ?? 0, time ?? 0);
      parts.push({ w: w.timeVolumeBeyond, v: tv });
    }
    if (ev.deltaRatio != null) {
      const flow = clamp012(Math.abs(ev.deltaRatio) / 50);
      const imb = ev.imbalanceBeyond != null ? clamp012(ev.imbalanceBeyond / 3) : 0;
      parts.push({ w: w.aggressiveFlow, v: Math.max(flow, imb * 0.7) });
    }
    const effort = ev.effortEffective ? 0.85 : ev.effortSide !== "UNCLEAR" ? 0.45 : 0.2;
    parts.push({ w: w.effortResult, v: effort });
    const defense = eventType.endsWith("_UP") ? ev.askDefense : ev.bidDefense;
    if (defense != null) {
      parts.push({ w: w.passiveDefense, v: clamp012(defense / 100) });
    }
    parts.push({ w: w.followThrough, v: ev.followThrough ? 0.9 : 0.25 });
    const weightSum = parts.reduce((s, p) => s + p.w, 0);
    if (!(weightSum > 0)) return 50;
    const raw = parts.reduce((s, p) => s + p.w / weightSum * p.v, 0);
    let score = Math.round(40 + raw * 55);
    if (ev.dataQuality === "UNAVAILABLE") score -= 8;
    if (defense == null) score -= 4;
    if (eventType.startsWith("RECLAIM") && ev.deltaRatio == null) {
      score = Math.max(score, 58);
    }
    return Math.max(35, Math.min(95, score));
  }
  function eventReasons(eventType, ev, level2) {
    const side2 = eventType.endsWith("_UP") ? "above" : "below";
    const name = level2.type.replace(/_/g, " ").toLowerCase();
    const out = [];
    if (eventType.startsWith("FAIL")) {
      out.push(`Break attempt ${side2} ${name} failed to hold`);
      out.push("Price returned without holding beyond the level");
      if (ev.deltaRatio != null && Math.abs(ev.deltaRatio) >= 25) {
        out.push(`Strong ${ev.deltaRatio > 0 ? "positive" : "negative"} delta did not hold the break`);
      }
      if (eventType === "FAIL_UP" && ev.askDefense != null && ev.askDefense >= 60) {
        out.push("Ask defense present during the failed break");
      }
      if (eventType === "FAIL_DOWN" && ev.bidDefense != null && ev.bidDefense >= 60) {
        out.push("Bid defense present during the failed break");
      }
    } else {
      out.push(`Returned across ${name} after a prior loss/break`);
      out.push(`${ev.consecutiveClosesOriginal} close${ev.consecutiveClosesOriginal === 1 ? "" : "s"} back on the original side`);
      if (ev.followThrough) out.push("Price response after the reclaim");
    }
    return out;
  }
  function eventInvalidation(eventType) {
    if (eventType.startsWith("FAIL")) {
      return ["Immediate continuation through the level", "A later confirmed hold beyond the same level"];
    }
    return ["Loss of the reclaimed side within the reclaim window", "Failed to hold the original side"];
  }

  // src/level-interaction/levels.ts
  var PERIOD_15M = 15 * 60;
  function confirmedSwings(bars, upto) {
    const out = [];
    const lastConfirmable = Math.min(upto - 2, bars.length - 3);
    for (let i = 2; i <= lastConfirmable; i++) {
      const a = bars[i - 2];
      const b = bars[i - 1];
      const c = bars[i];
      const d = bars[i + 1];
      const e = bars[i + 2];
      if (!a || !b || !c || !d || !e) continue;
      const knownAt = e.time;
      if (c.high >= a.high && c.high >= b.high && c.high >= d.high && c.high >= e.high) {
        out.push({ index: i, time: c.time, price: c.high, knownAt, kind: "HIGH" });
      }
      if (c.low <= a.low && c.low <= b.low && c.low <= d.low && c.low <= e.low) {
        out.push({ index: i, time: c.time, price: c.low, knownAt, kind: "LOW" });
      }
    }
    return out;
  }
  function clusterSwings(swings, kind, atr, cfg, timeframe, atTime) {
    const pad = atr != null && atr > 0 ? atr * cfg.zonePadAtr : 0;
    const merge2 = atr != null && atr > 0 ? atr * cfg.zoneMergeAtr : 0;
    const items = swings.filter((s) => s.kind === kind && s.knownAt <= atTime);
    if (!items.length) return [];
    const sorted = [...items].sort((a, b) => a.price - b.price);
    const groups = [];
    let cur = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i];
      const prev = cur[cur.length - 1];
      if (merge2 > 0 && s.price - prev.price <= merge2) cur.push(s);
      else {
        groups.push(cur);
        cur = [s];
      }
    }
    groups.push(cur);
    const type = kind === "HIGH" ? "HISTORICAL_RESISTANCE" : "HISTORICAL_SUPPORT";
    return groups.map((g) => {
      const prices = g.map((x) => x.price);
      const lo = Math.min(...prices) - pad;
      const hi = Math.max(...prices) + pad;
      const latest = g.reduce((a, b) => a.knownAt >= b.knownAt ? a : b);
      const tests = g.length;
      return {
        id: `${type}:${latest.time}:${latest.price}`,
        type,
        price: kind === "HIGH" ? Math.max(...prices) : Math.min(...prices),
        zoneLow: lo,
        zoneHigh: hi,
        timeframe,
        createdAt: Math.min(...g.map((x) => x.time)),
        knownAt: latest.knownAt,
        strength: Math.min(90, 45 + tests * 12),
        confidence: Math.min(88, 50 + tests * 10)
      };
    });
  }
  function timeframeMinutes(tf) {
    const m = /^(\d+)/.exec(tf);
    if (!m) return 15;
    return Number(m[1]);
  }
  function previous15mLevel(bars, index, timeframe) {
    if (timeframeMinutes(timeframe) >= 15) return [];
    const cur = bars[index];
    if (!cur) return [];
    const periodStart = cur.time - cur.time % PERIOD_15M;
    const prevStart = periodStart - PERIOD_15M;
    let hi = -Infinity;
    let lo = Infinity;
    let lastT = 0;
    for (let i = 0; i < index; i++) {
      const b = bars[i];
      if (!b) continue;
      if (b.time < prevStart || b.time >= periodStart) continue;
      if (b.high > hi) hi = b.high;
      if (b.low < lo) lo = b.low;
      lastT = b.time;
    }
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi <= 0) return [];
    const knownAt = periodStart;
    return [
      {
        id: `PREV_15M_HIGH:${knownAt}:${hi}`,
        type: "PREV_15M_HIGH",
        price: hi,
        timeframe,
        createdAt: lastT,
        knownAt,
        strength: 48,
        confidence: 52
      },
      {
        id: `PREV_15M_LOW:${knownAt}:${lo}`,
        type: "PREV_15M_LOW",
        price: lo,
        timeframe,
        createdAt: lastT,
        knownAt,
        strength: 48,
        confidence: 52
      }
    ];
  }
  function swingLevels(swings, atTime, timeframe) {
    const out = [];
    const highs = swings.filter((s) => s.kind === "HIGH" && s.knownAt <= atTime);
    const lows = swings.filter((s) => s.kind === "LOW" && s.knownAt <= atTime);
    const lastH = highs[highs.length - 1];
    const lastL = lows[lows.length - 1];
    if (lastH) {
      out.push({
        id: `SWING_HIGH:${lastH.time}:${lastH.price}`,
        type: "SWING_HIGH",
        price: lastH.price,
        timeframe,
        createdAt: lastH.time,
        knownAt: lastH.knownAt,
        strength: 50,
        confidence: 50
      });
    }
    if (lastL) {
      out.push({
        id: `SWING_LOW:${lastL.time}:${lastL.price}`,
        type: "SWING_LOW",
        price: lastL.price,
        timeframe,
        createdAt: lastL.time,
        knownAt: lastL.knownAt,
        strength: 50,
        confidence: 50
      });
    }
    return out;
  }
  function collectLevelsKnownAt(bars, index, cfg, timeframe, extras = []) {
    const bar = bars[index];
    if (!bar) return extras.filter((l) => l.knownAt <= (bars[index - 1]?.time ?? 0));
    const atTime = bar.time;
    const swings = confirmedSwings(bars, index);
    const atr = priorAtr(bars, index, cfg);
    const hist = [
      ...clusterSwings(swings, "HIGH", atr, cfg, timeframe, atTime),
      ...clusterSwings(swings, "LOW", atr, cfg, timeframe, atTime)
    ];
    const recentSwings = swings.slice(-cfg.swingLookback);
    const swingsLv = swingLevels(recentSwings, atTime, timeframe);
    const prev15 = previous15mLevel(bars, index, timeframe);
    const extra = extras.filter((l) => l.knownAt <= atTime);
    const all = [...hist, ...swingsLv, ...prev15, ...extra];
    const dedup = /* @__PURE__ */ new Map();
    for (const lv of all) {
      if (lv.knownAt > atTime) continue;
      const key3 = `${lv.type}:${lv.price.toFixed(6)}`;
      const prev = dedup.get(key3);
      if (!prev || lv.knownAt >= prev.knownAt) dedup.set(key3, lv);
    }
    return [...dedup.values()].slice(-cfg.maxTrackedLevels);
  }

  // src/level-interaction/engine.ts
  function newTrack(level2) {
    return {
      level: level2,
      side: levelSide(level2.type),
      failedBreak: "NONE",
      reclaim: "NONE",
      consecutiveBeyond: 0,
      consecutiveOriginal: 0,
      attemptOriginTime: null,
      attemptOriginIndex: null,
      lostAt: null,
      lostAtIndex: null,
      everLost: false,
      lastConfirmBar: -999,
      lastConfirmType: null,
      attemptId: 0,
      sweepAttempt: false
    };
  }
  function eventId(levelId, type, origin, attempt) {
    return `${type}:${levelId}:${origin}:${attempt}`;
  }
  function lineStyle(type) {
    if (type === "FAIL_UP") return { pattern: "DASHED", color: "#f59e0b", label: "FAIL \u2191" };
    if (type === "FAIL_DOWN") return { pattern: "DASHED", color: "#84cc16", label: "FAIL \u2193" };
    if (type === "RECLAIM_UP") return { pattern: "DOTTED", color: "#22c55e", label: "REC \u2191" };
    return { pattern: "DOTTED", color: "#ef4444", label: "REC \u2193" };
  }
  function emptyAnnotation(time) {
    return {
      time,
      compactLabel: null,
      secondaryLabels: [],
      events: [],
      status: "CONFIRMED",
      forming: []
    };
  }
  function pickCompact(events) {
    if (!events.length) return null;
    const ranked = [...events].sort((a, b) => {
      const pa = LEVEL_EVENT_PRIORITY[a.eventType];
      const pb = LEVEL_EVENT_PRIORITY[b.eventType];
      if (pb !== pa) return pb - pa;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });
    return ranked[0]?.compactLabel ?? null;
  }
  function dedupCandleEvents(events) {
    const byType = /* @__PURE__ */ new Map();
    for (const ev of events) {
      const prev = byType.get(ev.eventType);
      if (!prev || (ev.confidence ?? 0) > (prev.confidence ?? 0)) byType.set(ev.eventType, ev);
    }
    return [...byType.values()];
  }
  function returnedToOriginal(bar, level2, tol) {
    const side2 = levelSide(level2.type);
    const boundary = farBoundary(level2);
    if (side2 === "HIGH") return bar.close <= boundary + tol * 0.25;
    return bar.close >= boundary - tol * 0.25;
  }
  function makeEvent(type, track, bar, originTime, ev, cfg, status) {
    const confirmed = status === "CONFIRMED";
    const { buy, sell } = aggressiveVolumes2(bar);
    const reasons = eventReasons(type, ev, track.level);
    return {
      id: eventId(track.level.id, type, originTime, track.attemptId),
      type,
      eventType: type,
      status,
      confidence: eventConfidence(type, ev, track.level, cfg),
      levelId: track.level.id,
      levelType: track.level.type,
      levelPrice: track.level.price,
      zoneLow: track.level.zoneLow,
      zoneHigh: track.level.zoneHigh,
      timeframe: track.level.timeframe,
      eventOriginTime: originTime,
      confirmedAt: confirmed ? bar.time : void 0,
      confirmationCandleId: confirmed ? String(bar.time) : void 0,
      originBarTime: originTime,
      confirmBarTime: confirmed ? bar.time : null,
      direction: type.endsWith("_UP") ? "UP" : "DOWN",
      compactLabel: LEVEL_EVENT_SHORT[type],
      dataQuality: ev.dataQuality,
      reasons,
      reason: reasons,
      invalidation: eventInvalidation(type),
      sweepReclaim: type.startsWith("RECLAIM") && track.sweepAttempt,
      metrics: {
        delta: ev.delta,
        deltaRatio: ev.deltaRatio,
        priceProgressAtr: ev.displacementAtr,
        volumeBeyondRatio: ev.volumeBeyondRatio,
        timeBeyondMs: ev.timeBeyondMs,
        askDefense: ev.askDefense,
        bidDefense: ev.bidDefense,
        aggressiveBuy: buy || null,
        aggressiveSell: sell || null
      }
    };
  }
  function cooldownOk(track, index, type, cfg) {
    if (track.lastConfirmType !== type) return true;
    return index - track.lastConfirmBar >= cfg.cooldownBars;
  }
  function stepTrack(track, bar, index, ev, cfg, incomplete, atr) {
    const confirmed = [];
    const forming = [];
    const origin = track.attemptOriginTime ?? bar.time;
    const failType = track.side === "HIGH" ? "FAIL_UP" : "FAIL_DOWN";
    const reclaimType = track.side === "HIGH" ? "RECLAIM_DOWN" : "RECLAIM_UP";
    const tol = penetrationTolerance(bar.close || track.level.price, atr, cfg);
    const backInside = returnedToOriginal(bar, track.level, tol);
    if (ev.closeBeyond) {
      track.consecutiveBeyond += 1;
      track.consecutiveOriginal = 0;
      if (track.attemptOriginTime == null) {
        track.attemptOriginTime = bar.time;
        track.attemptOriginIndex = index;
      }
      if (track.failedBreak === "ATTACK" || track.failedBreak === "PENETRATION" || track.failedBreak === "FAILURE_FORMING") {
        track.failedBreak = "FAILURE_INVALIDATED";
      }
      if (!track.everLost) {
        track.everLost = true;
        track.lostAt = bar.time;
        track.lostAtIndex = index;
      }
      track.reclaim = "LEVEL_LOST";
      return { confirmed, forming };
    }
    if (ev.penetrated && !ev.closeBeyond) {
      if (track.attemptOriginTime == null) {
        track.attemptOriginTime = bar.time;
        track.attemptOriginIndex = index;
      }
      track.consecutiveBeyond = 0;
      track.consecutiveOriginal += 1;
      track.sweepAttempt = true;
      if (track.failedBreak === "NONE" || track.failedBreak === "FAILURE_INVALIDATED" || track.failedBreak === "FAILED_UP" || track.failedBreak === "FAILED_DOWN") {
        track.failedBreak = backInside ? "PENETRATION" : "ATTACK";
      } else if (track.failedBreak === "ATTACK") {
        track.failedBreak = "PENETRATION";
      }
      if (track.everLost) {
        track.reclaim = track.reclaim === "LEVEL_LOST" ? "RETURN_ATTEMPT" : track.reclaim;
      }
    } else {
      track.consecutiveBeyond = 0;
      if (backInside) track.consecutiveOriginal += 1;
      else track.consecutiveOriginal = 0;
    }
    if ((track.failedBreak === "ATTACK" || track.failedBreak === "PENETRATION" || track.failedBreak === "FAILURE_FORMING") && backInside) {
      track.failedBreak = "FAILURE_FORMING";
      const hadAttempt = ev.penetrated || track.attemptOriginTime != null;
      const laterBar = track.attemptOriginIndex != null && index > track.attemptOriginIndex;
      const failReady = !incomplete && hadAttempt && backInside && !ev.closeBeyond && !track.everLost && laterBar;
      if (failReady && cooldownOk(track, index, failType, cfg)) {
        const originFail = track.attemptOriginTime ?? bar.time;
        track.failedBreak = failType === "FAIL_UP" ? "FAILED_UP" : "FAILED_DOWN";
        track.lastConfirmBar = index;
        track.lastConfirmType = failType;
        confirmed.push(makeEvent(failType, track, bar, originFail, ev, cfg, "CONFIRMED"));
        track.attemptId += 1;
        track.attemptOriginTime = null;
        track.attemptOriginIndex = null;
        track.sweepAttempt = false;
      } else if (hadAttempt) {
        forming.push(makeEvent(failType, track, bar, track.attemptOriginTime ?? bar.time, ev, cfg, incomplete ? "PROVISIONAL" : "FORMING"));
      }
    }
    const barsSinceLoss = track.lostAtIndex != null ? index - track.lostAtIndex : cfg.reclaimWindowBars + 1;
    if (track.everLost && backInside) {
      if (track.reclaim === "NONE" || track.reclaim === "LEVEL_LOST" || track.reclaim === "RECLAIM_FAILED") {
        track.reclaim = ev.penetrated || track.consecutiveOriginal > 0 ? "RECLAIM_FORMING" : "LEVEL_LOST";
      } else if (track.reclaim === "RETURN_ATTEMPT") {
        track.reclaim = "RECLAIM_FORMING";
      }
      if (canConfirmReclaim(ev, cfg, track.everLost, barsSinceLoss, incomplete) && cooldownOk(track, index, reclaimType, cfg)) {
        track.reclaim = reclaimType === "RECLAIM_UP" ? "RECLAIMED_UP" : "RECLAIMED_DOWN";
        track.lastConfirmBar = index;
        track.lastConfirmType = reclaimType;
        const originRec = track.lostAt ?? track.attemptOriginTime ?? bar.time;
        confirmed.push(makeEvent(reclaimType, track, bar, originRec, ev, cfg, "CONFIRMED"));
        track.attemptId += 1;
        track.attemptOriginTime = null;
        track.attemptOriginIndex = null;
        track.everLost = false;
        track.lostAt = null;
        track.lostAtIndex = null;
        track.failedBreak = "NONE";
        track.level = {
          ...track.level,
          type: "RECLAIMED_LEVEL",
          id: `RECLAIMED_LEVEL:${track.level.id}`
        };
      } else if (track.reclaim === "RECLAIM_FORMING" || track.reclaim === "RETURN_ATTEMPT") {
        forming.push(makeEvent(reclaimType, track, bar, track.lostAt ?? origin, ev, cfg, incomplete ? "PROVISIONAL" : "FORMING"));
      }
    } else if (track.everLost && !backInside && !ev.closeBeyond) {
      track.reclaim = "LEVEL_LOST";
    }
    if (track.reclaim === "RECLAIM_FORMING" && ev.closeBeyond) {
      track.reclaim = "RECLAIM_FAILED";
    }
    return { confirmed, forming };
  }
  function toLines(events, bars, cfg) {
    const confirmed = events.filter((e) => e.status === "CONFIRMED");
    const sliced = confirmed.slice(-cfg.maxEventLines);
    const timeIndex = new Map(bars.map((b, i) => [b.time, i]));
    return sliced.map((e) => {
      const style = lineStyle(e.eventType);
      const confirmIdx = e.confirmBarTime != null ? timeIndex.get(e.confirmBarTime) : void 0;
      const endIdx = confirmIdx != null ? Math.min(bars.length - 1, confirmIdx + cfg.lineExtendBars) : confirmIdx;
      const endTime = endIdx != null ? bars[endIdx]?.time ?? e.confirmBarTime ?? e.eventOriginTime : e.confirmBarTime ?? e.eventOriginTime;
      return {
        eventId: e.id,
        eventType: e.eventType,
        price: e.levelPrice,
        zoneLow: e.zoneLow,
        zoneHigh: e.zoneHigh,
        startTime: e.eventOriginTime,
        endTime,
        confirmTime: e.confirmedAt,
        ...style
      };
    });
  }
  function mergeLevels(auto, injected, extras, atTime) {
    const all = [...injected, ...auto, ...extras].filter((l) => l.knownAt <= atTime);
    const map = /* @__PURE__ */ new Map();
    for (const lv of all) {
      const prev = map.get(lv.id);
      if (!prev) map.set(lv.id, lv);
    }
    return [...map.values()];
  }
  function annotateLevelInteractions(bars, opts = {}) {
    const cfg = mergeLevelInteractionConfig(opts.cfg);
    const timeframe = opts.timeframe ?? "15m";
    const lastIsLive = Boolean(opts.lastIsLive);
    const useAuto = opts.autoLevels ?? opts.levels == null;
    const injected = opts.levels ?? [];
    const byTime = /* @__PURE__ */ new Map();
    const mem = {
      tracks: /* @__PURE__ */ new Map(),
      extras: [...opts.extraLevels ?? []],
      confirmed: [],
      forming: []
    };
    if (!bars.length) {
      return { events: [], confirmed: [], lines: [], byTime, levelsUsed: [] };
    }
    const last = bars.length - 1;
    const levelsUsed = [];
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const incomplete = Boolean(bar.incomplete) || lastIsLive && i === last;
      const ann = emptyAnnotation(bar.time);
      ann.status = incomplete ? "PROVISIONAL" : "CONFIRMED";
      if (!barIsValid(bar)) {
        byTime.set(bar.time, ann);
        continue;
      }
      const atr = priorAtr(bars, i, cfg);
      const auto = useAuto ? collectLevelsKnownAt(bars, i, cfg, timeframe, mem.extras) : [];
      const known = mergeLevels(auto, injected, mem.extras, bar.time);
      for (const lv of known) {
        if (!levelsUsed.some((x) => x.id === lv.id)) levelsUsed.push(lv);
        if (!mem.tracks.has(lv.id)) mem.tracks.set(lv.id, newTrack(lv));
      }
      const candleConfirmed = [];
      const candleForming = [];
      for (const lv of known) {
        const track = mem.tracks.get(lv.id);
        if (!track) continue;
        const snapshot = incomplete ? {
          ...track,
          level: { ...track.level }
        } : null;
        const ev = collectEvidence(
          bar,
          track.level,
          atr,
          cfg,
          track.consecutiveBeyond + /* preview increment happens in step */
          0,
          track.consecutiveOriginal
        );
        const previewBeyond = ev.closeBeyond ? track.consecutiveBeyond + 1 : 0;
        const previewOriginal = !ev.closeBeyond && returnedToOriginal(bar, track.level, penetrationTolerance(bar.close, atr, cfg)) ? track.consecutiveOriginal + 1 : ev.closeBeyond ? 0 : track.consecutiveOriginal;
        const evNow = {
          ...ev,
          consecutiveClosesBeyond: previewBeyond,
          consecutiveClosesOriginal: previewOriginal
        };
        const quiet = isNarrowOrQuiet(bar, atr, cfg) && !ev.penetrated && !ev.closeBeyond;
        if (quiet) {
          if (snapshot) Object.assign(track, snapshot);
          continue;
        }
        const out = stepTrack(track, bar, i, evNow, cfg, incomplete, atr);
        if (incomplete && snapshot) {
          Object.assign(track, snapshot);
          candleForming.push(...out.forming, ...out.confirmed.map((e) => ({ ...e, status: "PROVISIONAL", confirmedAt: void 0, confirmBarTime: null })));
        } else {
          candleForming.push(...out.forming);
          for (const evnt of out.confirmed) {
            if (mem.confirmed.some((x) => x.id === evnt.id)) continue;
            const atrNow = atr != null && atr > 0 ? atr : evnt.levelPrice * 4e-3;
            const band = Math.max(atrNow * Math.max(cfg.zoneMergeAtr, 0.5), evnt.levelPrice * 4e-3);
            const interval = i > 0 ? Math.max(1, bar.time - (bars[i - 1]?.time ?? bar.time - 1)) : 1;
            const nearDup = mem.confirmed.some((x) => x.eventType === evnt.eventType && Math.abs(x.levelPrice - evnt.levelPrice) <= band && evnt.confirmBarTime != null && x.confirmBarTime != null && Math.abs(evnt.confirmBarTime - x.confirmBarTime) <= interval * 3);
            if (nearDup) continue;
            mem.confirmed.push(evnt);
            candleConfirmed.push(evnt);
          }
        }
      }
      const display = candleConfirmed.length ? dedupCandleEvents(candleConfirmed) : [];
      ann.events = display;
      ann.forming = candleForming;
      ann.secondaryLabels = [...new Set(display.map((e) => e.compactLabel))];
      ann.compactLabel = pickCompact(display);
      byTime.set(bar.time, ann);
    }
    const lines = toLines(mem.confirmed, bars, cfg);
    return {
      events: mem.confirmed,
      confirmed: mem.confirmed,
      lines,
      byTime,
      levelsUsed
    };
  }
  function fmtEventClock(time) {
    if (time == null) return "\u2014";
    if (time > 1e11) return new Date(time).toISOString().replace("T", " ").slice(0, 19) + " UTC";
    return String(time);
  }
  function formatLevelEventTooltip(event, extras) {
    const m = event.metrics;
    const kind = event.eventType === "FAIL_UP" ? "Failed upward break" : event.eventType === "FAIL_DOWN" ? "Failed downward break" : event.eventType === "RECLAIM_UP" ? "Bullish reclaim" : "Bearish reclaim";
    const cvd = extras?.cvd;
    const lines = [
      `${event.compactLabel}  ${kind}  ${event.status}`,
      "",
      `Level: ${event.levelType.replace(/_/g, " ")}  ${event.levelPrice}`,
      event.zoneLow != null && event.zoneHigh != null ? `Zone: ${event.zoneLow} \u2013 ${event.zoneHigh}` : null,
      `Timeframe: ${event.timeframe}`,
      `Origin: ${fmtEventClock(event.eventOriginTime)}`,
      `Confirmed: ${fmtEventClock(event.confirmedAt ?? event.confirmBarTime)}`,
      `Candle: ${event.confirmationCandleId ?? "\u2014"}`,
      `Confidence: ${event.confidence ?? "\u2014"}  \xB7  Data: ${event.dataQuality}`,
      m.aggressiveBuy != null || m.aggressiveSell != null ? `Aggressive: buy ${m.aggressiveBuy != null ? Math.round(m.aggressiveBuy) : "\u2014"}  sell ${m.aggressiveSell != null ? Math.round(m.aggressiveSell) : "\u2014"}` : "Aggressive: n/a",
      m.delta != null ? `Delta: ${m.delta >= 0 ? "+" : ""}${Math.round(m.delta)}` : "Delta: n/a",
      m.deltaRatio != null ? `Delta ratio: ${m.deltaRatio >= 0 ? "+" : ""}${m.deltaRatio.toFixed(1)}%` : "Delta ratio: n/a",
      cvd != null && Number.isFinite(cvd) ? `CVD: ${cvd >= 0 ? "+" : ""}${Math.round(cvd)}` : "CVD: see candle CVD label",
      m.priceProgressAtr != null ? `Price progress: ${m.priceProgressAtr.toFixed(2)} ATR` : "Price progress: n/a",
      m.volumeBeyondRatio != null ? `Volume beyond level: ${Math.round(m.volumeBeyondRatio * 100)}%` : "Volume beyond level: n/a",
      m.askDefense != null ? `Ask defense: ${Math.round(m.askDefense)}` : "Ask defense: unavailable",
      m.bidDefense != null ? `Bid defense: ${Math.round(m.bidDefense)}` : "Bid defense: unavailable",
      event.sweepReclaim ? "Kind: sweep reclaim" : null,
      "",
      "Confirmation",
      ...event.reason.map((r) => `\u2022 ${r}`),
      "",
      "Invalidation",
      ...event.invalidation.map((r) => `\u2022 ${r}`)
    ];
    return lines.filter((x) => x != null).join("\n");
  }

  // src/level-interaction/adapters.ts
  function projectLevelEventLine(line, viewport) {
    const i0 = viewport.times.findIndex((t) => t >= line.startTime);
    const i1 = viewport.times.findIndex((t) => t >= line.endTime);
    const start = i0 >= 0 ? i0 : 0;
    const end = i1 >= 0 ? i1 : viewport.times.length - 1;
    const visible = viewport.times.some((t) => t >= line.startTime && t <= line.endTime) || viewport.times[0] != null && viewport.times[viewport.times.length - 1] != null && line.startTime <= viewport.times[viewport.times.length - 1] && line.endTime >= viewport.times[0];
    return {
      eventId: line.eventId,
      price: line.price,
      x0: viewport.xForIndex(Math.max(0, start)),
      x1: viewport.xForIndex(Math.max(start, end)),
      y: viewport.yForPrice(line.price),
      yZoneLow: line.zoneLow != null ? viewport.yForPrice(line.zoneLow) : void 0,
      yZoneHigh: line.zoneHigh != null ? viewport.yForPrice(line.zoneHigh) : void 0,
      visible
    };
  }
  function projectFailReclaimLabel(confirmTime, barHigh, viewport, gap = 14) {
    const i = viewport.times.indexOf(confirmTime);
    return {
      x: i >= 0 ? viewport.xForIndex(i) : viewport.xForIndex(0),
      y: viewport.yForPrice(barHigh) - gap,
      visible: i >= 0
    };
  }

  // src/spot/types.ts
  var SPOT_EXCHANGE_IDS = ["binance", "bybit", "okx", "bitstamp"];
  var SPOT_CHART_TF_MINUTES = [1, 5, 15, 30, 45, 60, 120, 240];
  var DEFAULT_IMBALANCE_RATIO = 3;
  var DEFAULT_SPOT_DEDUP = 24e3;
  var DEFAULT_SPOT_HISTORY_BARS = 512;

  // src/spot/venues.ts
  function isSpotExchangeId(value) {
    return SPOT_EXCHANGE_IDS.includes(value);
  }
  function asSpotExchange(exchange) {
    return isSpotExchangeId(exchange) ? exchange : null;
  }

  // src/spot/dedupe.ts
  var TradeDeduper = class {
    constructor(capacity) {
      this.capacity = capacity;
      this.keys = new Array(capacity);
    }
    keys;
    write = 0;
    filled = 0;
    seen = /* @__PURE__ */ new Set();
    accept(exchange, symbol, tradeId) {
      if (tradeId === void 0 || tradeId === "") return true;
      const key3 = `${exchange}|${symbol}|${tradeId}`;
      if (this.seen.has(key3)) return false;
      if (this.filled === this.capacity) {
        const evicted = this.keys[this.write];
        if (evicted !== void 0) this.seen.delete(evicted);
      }
      this.keys[this.write] = key3;
      this.write = (this.write + 1) % this.capacity;
      if (this.filled < this.capacity) this.filled += 1;
      this.seen.add(key3);
      return true;
    }
  };

  // src/spot/cvd.ts
  var SLOPE_MS = 6e4;
  var SpotCvdBook = class {
    venues = /* @__PURE__ */ new Map();
    aggregated = new CVDEngine(SLOPE_MS);
    venue(exchange) {
      let engine2 = this.venues.get(exchange);
      if (!engine2) {
        engine2 = new CVDEngine(SLOPE_MS);
        this.venues.set(exchange, engine2);
      }
      return engine2;
    }
    onTrade(exchange, timestamp, buyQuote, sellQuote, price) {
      this.venue(exchange).onTrade(timestamp, buyQuote, sellQuote, price);
      this.aggregated.onTrade(timestamp, buyQuote, sellQuote, price);
    }
    snapshot(exchange, now) {
      if (exchange === "all") return this.aggregated.snapshot(now);
      return this.venue(exchange).snapshot(now);
    }
    value(exchange) {
      if (exchange === "all") return this.aggregated.value;
      return this.venue(exchange).value;
    }
  };

  // src/spot/efficiency.ts
  var EffortVsResult = class {
    constructor(sampleSize = 256) {
      this.sampleSize = sampleSize;
      this.volPerDollar = new RollingDistribution(sampleSize);
      this.volPerBps = new RollingDistribution(sampleSize);
      this.absDelta = new RollingDistribution(sampleSize);
      this.absMovePct = new RollingDistribution(sampleSize);
    }
    volPerDollar;
    volPerBps;
    absDelta;
    absMovePct;
    measure(input, recordHistory = true) {
      const priceChange = input.close - input.open;
      const priceChangePercent = pctChange(input.open, input.close);
      const absDelta = Math.abs(input.delta);
      const absMove = Math.abs(priceChange);
      const absMovePct = Math.abs(priceChangePercent);
      const absBps = absMovePct * 100;
      const volumePerDollar = absMove < 1e-12 ? input.totalVolume > 0 ? Number.POSITIVE_INFINITY : 0 : safeDiv(input.totalVolume, absMove);
      const volumePerBps = absBps < 1e-9 ? input.totalVolume > 0 ? Number.POSITIVE_INFINITY : 0 : safeDiv(input.totalVolume, absBps);
      if (recordHistory && Number.isFinite(volumePerDollar) && volumePerDollar > 0 && absMove > 0) {
        this.volPerDollar.add(volumePerDollar);
      }
      if (recordHistory && Number.isFinite(volumePerBps) && volumePerBps > 0 && absBps > 0) {
        this.volPerBps.add(volumePerBps);
      }
      if (recordHistory && absDelta > 0) this.absDelta.add(absDelta);
      if (recordHistory && absMovePct > 0) this.absMovePct.add(absMovePct);
      const rank = this.rankEfficiency(volumePerDollar);
      const effortVsResult = this.classify(input.delta, priceChange, volumePerDollar, absDelta);
      return {
        priceChange,
        priceChangePercent,
        totalVolume: input.totalVolume,
        delta: input.delta,
        absDelta,
        volumePerDollar: Number.isFinite(volumePerDollar) ? volumePerDollar : 0,
        volumePerBps: Number.isFinite(volumePerBps) ? volumePerBps : 0,
        rank,
        effortVsResult
      };
    }
    rankEfficiency(volumePerDollar) {
      if (!Number.isFinite(volumePerDollar) || volumePerDollar <= 0) return "LOW";
      if (this.volPerDollar.size < 8) return "NORMAL";
      const rank = this.volPerDollar.percentileRank(volumePerDollar);
      if (rank >= 80) return "LOW";
      if (rank <= 10) return "EXTREME";
      if (rank <= 30) return "HIGH";
      return "NORMAL";
    }
    classify(delta, priceChange, volumePerDollar, absDelta) {
      if (this.absDelta.size < 8) return "INSUFFICIENT";
      const deltaRank = this.absDelta.percentileRank(absDelta);
      if (deltaRank < 35) return "BALANCED";
      const buyers = delta > 0;
      const movedWith = buyers ? priceChange > 0 : priceChange < 0;
      const effortRank = Number.isFinite(volumePerDollar) ? this.volPerDollar.size >= 8 ? this.volPerDollar.percentileRank(volumePerDollar) : 50 : 90;
      const inefficient = effortRank >= 70 || !movedWith;
      const efficient = movedWith && effortRank <= 40;
      if (buyers && inefficient) return "BUYERS_INEFFICIENT";
      if (buyers && efficient) return "BUYERS_EFFICIENT";
      if (!buyers && inefficient) return "SELLERS_INEFFICIENT";
      if (!buyers && efficient) return "SELLERS_EFFICIENT";
      return "BALANCED";
    }
  };

  // src/spot/absorption.ts
  var SpotAbsorptionDetector = class {
    absDelta = new RollingDistribution(256);
    absMove = new RollingDistribution(256);
    observe(absDelta, absMovePct) {
      if (absDelta > 0) this.absDelta.add(absDelta);
      if (absMovePct > 0) this.absMove.add(absMovePct);
    }
    detect(input) {
      const total = input.buyVolume + input.sellVolume;
      const empty = {
        detected: false,
        type: null,
        confidence: 0,
        usedBookEvidence: false
      };
      if (total <= 0) return empty;
      const absDelta = Math.abs(input.delta);
      const absMove = Math.abs(input.priceChangePercent);
      const deltaRank = this.absDelta.size >= 8 ? this.absDelta.percentileRank(absDelta) : 50;
      const moveRank = this.absMove.size >= 8 ? this.absMove.percentileRank(absMove) : 50;
      const largeFlow = deltaRank >= 65;
      const littleDisplacement = moveRank <= 40 || absMove < 0.02;
      const nearAsk = input.buyNearAskShare >= 0.55;
      const nearBid = input.sellNearBidShare >= 0.55;
      const askRepl = (input.askReplenishment ?? 0) >= 0.35;
      const bidRepl = (input.bidReplenishment ?? 0) >= 0.35;
      const bookOk = input.hasBook;
      if (input.delta > 0 && largeFlow && littleDisplacement && input.priceChangePercent <= 0.08) {
        const touch = nearAsk || askRepl;
        if (!touch) return empty;
        const usedBook = bookOk && (nearAsk || askRepl);
        const confidence = clamp(
          0.45 + (nearAsk ? 0.15 : 0) + (askRepl ? 0.15 : 0) + (littleDisplacement ? 0.1 : 0) + (deltaRank >= 80 ? 0.1 : 0),
          0,
          1
        );
        if (confidence < 0.55) return empty;
        return {
          detected: true,
          type: "PASSIVE_SELL_ABSORPTION",
          confidence,
          usedBookEvidence: usedBook
        };
      }
      if (input.delta < 0 && largeFlow && littleDisplacement && input.priceChangePercent >= -0.08) {
        const touch = nearBid || bidRepl;
        if (!touch) return empty;
        const usedBook = bookOk && (nearBid || bidRepl);
        const confidence = clamp(
          0.45 + (nearBid ? 0.15 : 0) + (bidRepl ? 0.15 : 0) + (littleDisplacement ? 0.1 : 0) + (deltaRank >= 80 ? 0.1 : 0),
          0,
          1
        );
        if (confidence < 0.55) return empty;
        return {
          detected: true,
          type: "PASSIVE_BUY_ABSORPTION",
          confidence,
          usedBookEvidence: usedBook
        };
      }
      return empty;
    }
  };
  function nearTouchShare(executedNear, sideVolume) {
    return safeDiv(executedNear, sideVolume);
  }

  // src/spot/classifier.ts
  var SpotFlowClassifier = class {
    delta = new RollingDistribution(256);
    absDelta = new RollingDistribution(256);
    volume = new RollingDistribution(256);
    lastAbsDelta = 0;
    lastAccel = 0;
    observe(delta, totalVolume) {
      this.delta.add(delta);
      this.absDelta.add(Math.abs(delta));
      if (totalVolume > 0) this.volume.add(totalVolume);
    }
    classify(input, commit = false) {
      const z = this.delta.size >= 8 ? this.delta.zScore(input.delta, 1) : this.bootstrapZ(input.deltaPercent);
      const dp = input.deltaPercent;
      let flow = "BALANCED";
      if (z >= 1.5 && dp >= 0.2) flow = "STRONG_SPOT_BUYING";
      else if (z >= 0.55 && dp >= 0.08) flow = "SPOT_BUYING";
      else if (z <= -1.5 && dp <= -0.2) flow = "STRONG_SPOT_SELLING";
      else if (z <= -0.55 && dp <= -0.08) flow = "SPOT_SELLING";
      const flags = [];
      if (input.absorption === "PASSIVE_SELL_ABSORPTION") flags.push("BUY_ABSORPTION");
      if (input.absorption === "PASSIVE_BUY_ABSORPTION") flags.push("SELL_ABSORPTION");
      if (input.cvdDivergence === "BULLISH") flags.push("BULLISH_CVD_DIVERGENCE");
      if (input.cvdDivergence === "BEARISH") flags.push("BEARISH_CVD_DIVERGENCE");
      const absNow = Math.abs(input.delta);
      const dropped = this.lastAbsDelta > 0 && absNow < this.lastAbsDelta * 0.5;
      const decelerating = input.cvdAcceleration < this.lastAccel && Math.abs(input.cvdAcceleration) < Math.abs(this.lastAccel);
      if (dropped && decelerating && this.lastAbsDelta > 0) {
        if (this.lastAbsDelta > 0 && input.priorAbsDelta >= 0) flags.push("BUYER_EXHAUSTION");
        if (this.lastAbsDelta < 0 || input.priorAbsDelta < 0) flags.push("SELLER_EXHAUSTION");
      }
      if (this.absDelta.size >= 8 && this.absDelta.percentileRank(this.lastAbsDelta) >= 70 && dropped) {
        if (input.priorAbsDelta > 0 && input.priceChangePercent >= 0) {
          if (!flags.includes("BUYER_EXHAUSTION")) flags.push("BUYER_EXHAUSTION");
        }
        if (input.priorAbsDelta < 0 && input.priceChangePercent <= 0) {
          if (!flags.includes("SELLER_EXHAUSTION")) flags.push("SELLER_EXHAUSTION");
        }
      }
      if (commit) {
        this.observe(input.delta, input.totalVolume);
        this.lastAbsDelta = input.delta;
        this.lastAccel = input.cvdAcceleration;
      }
      const bias = flow.includes("BUYING") ? "BUY" : flow.includes("SELLING") ? "SELL" : "NEUTRAL";
      return { flow, flags, bias };
    }
    bootstrapZ(deltaPercent2) {
      return clamp(deltaPercent2 * 4, -3, 3);
    }
  };
  function deltaPercent(buy, sell) {
    return safeDiv(buy - sell, buy + sell);
  }

  // src/spot/comparison.ts
  function biasFromDelta(delta, deltaPercent2, flow) {
    if (flow?.includes("BUYING") || flow?.includes("BUY")) return "BUY";
    if (flow?.includes("SELLING") || flow?.includes("SELL")) return "SELL";
    if (deltaPercent2 >= 0.12 && delta > 0) return "BUY";
    if (deltaPercent2 <= -0.12 && delta < 0) return "SELL";
    return "NEUTRAL";
  }
  function relation(spot, futures) {
    if (spot === "BUY" && futures === "BUY") return "BROAD_BUYING_CONFIRMATION";
    if (spot === "SELL" && futures === "SELL") return "BROAD_SELLING_CONFIRMATION";
    if (spot === "BUY" && futures === "SELL") return "SPOT_FUTURES_DIVERGENCE";
    if (spot === "SELL" && futures === "BUY") return "SPOT_FUTURES_DIVERGENCE";
    if (spot === "BUY" && futures === "NEUTRAL") return "SPOT_LED_BUYING";
    if (spot === "SELL" && futures === "NEUTRAL") return "SPOT_LED_SELLING";
    if (spot === "NEUTRAL" && futures === "BUY") return "FUTURES_LED_BUYING";
    if (spot === "NEUTRAL" && futures === "SELL") return "FUTURES_LED_SELLING";
    return "NEUTRAL";
  }
  function oiChangePercent(oiUsd, prevOiUsd) {
    if (oiUsd == null || prevOiUsd == null || prevOiUsd <= 0) return null;
    return (oiUsd - prevOiUsd) / prevOiUsd * 100;
  }
  function compareSpotFutures(spot, ctx) {
    const fw = ctx.futures;
    const oiPct = oiChangePercent(ctx.oiUsd, ctx.prevOiUsd);
    const shortLiq = fw?.forcedBuyVolume ?? 0;
    const longLiq = fw?.forcedSellVolume ?? 0;
    const futuresCvd = fw ? fw.aggressiveBuyVolume - fw.aggressiveSellVolume : 0;
    const spotLeg = {
      aggressiveBuyVolume: spot.aggressiveBuyVolume,
      aggressiveSellVolume: spot.aggressiveSellVolume,
      delta: spot.delta,
      cvd: spot.cvd,
      efficiency: spot.efficiency.rank,
      oiChangePercent: null,
      liquidationUsd: 0,
      shortLiquidationUsd: 0,
      longLiquidationUsd: 0
    };
    const futuresLeg = {
      aggressiveBuyVolume: fw?.aggressiveBuyVolume ?? 0,
      aggressiveSellVolume: fw?.aggressiveSellVolume ?? 0,
      delta: fw?.delta ?? 0,
      cvd: futuresCvd,
      efficiency: fw?.priceImpactEfficiency ?? "NORMAL",
      oiChangePercent: oiPct,
      liquidationUsd: shortLiq + longLiq,
      shortLiquidationUsd: shortLiq,
      longLiquidationUsd: longLiq
    };
    const spotBias = biasFromDelta(spot.delta, spot.deltaPercent, spot.flow);
    const futuresBias = biasFromDelta(fw?.delta ?? 0, fw?.deltaPercent ?? 0);
    const rel = relation(spotBias, futuresBias);
    const priceChange = spot.efficiency.priceChangePercent;
    const futuresDelta = fw?.delta ?? 0;
    const oiUp = oiPct != null && oiPct > 0.05;
    const oiDown = oiPct != null && oiPct < -0.05;
    const futuresBuy = futuresDelta > 0 && (fw?.deltaPercent ?? 0) > 0.05;
    const futuresSell = futuresDelta < 0 && (fw?.deltaPercent ?? 0) < -0.05;
    const spotBuy = spotBias === "BUY";
    const spotSell = spotBias === "SELL";
    const spotWeak = !spotBuy;
    const liqTotal = shortLiq + longLiq;
    const shortCovering = liqTotal > 0 && shortLiq >= longLiq * 1.25 && shortLiq / Math.max(fw?.aggressiveBuyVolume ?? 1, 1) >= 0.08;
    const longWiping = liqTotal > 0 && longLiq >= shortLiq * 1.25 && longLiq / Math.max(fw?.aggressiveSellVolume ?? 1, 1) >= 0.08;
    let interpretation = "UNCLEAR";
    if (priceChange > 0 && futuresBuy && oiDown && shortCovering && spotWeak) {
      interpretation = "SHORT_COVERING_DOMINATED_RALLY";
    } else if (priceChange < 0 && futuresSell && oiDown && longWiping) {
      interpretation = "LONG_LIQUIDATION_DELEVERAGING";
    } else if (priceChange > 0 && futuresBuy && oiUp && spotBuy) {
      interpretation = "NEW_LEVERAGED_BUYING_SPOT_CONFIRMATION";
    } else if (priceChange < 0 && futuresSell && oiUp && spotSell) {
      interpretation = "NEW_SHORTS_SPOT_SELLING";
    } else if (rel === "SPOT_LED_BUYING") {
      interpretation = "SPOT_LED_BUYING";
    } else if (rel === "FUTURES_LED_BUYING") {
      interpretation = "FUTURES_LED_BUYING";
    } else if (rel === "BROAD_BUYING_CONFIRMATION") {
      interpretation = "BROAD_BUYING";
    } else if (rel === "BROAD_SELLING_CONFIRMATION") {
      interpretation = "BROAD_SELLING";
    } else if (rel === "SPOT_FUTURES_DIVERGENCE") {
      interpretation = "DIVERGENCE";
    } else if (rel === "SPOT_LED_SELLING" || rel === "FUTURES_LED_SELLING") {
      interpretation = "DIVERGENCE";
    }
    return {
      spot: spotLeg,
      futures: futuresLeg,
      spotBias,
      futuresBias,
      relation: rel,
      interpretation
    };
  }

  // src/spot/flow-engine.ts
  function emptyVenue() {
    return { buy: 0, sell: 0, buyCount: 0, sellCount: 0, largestBuy: 0, largestSell: 0 };
  }
  function addTrade(acc, side2, quote) {
    if (side2 === "BUY") {
      acc.buy += quote;
      acc.buyCount += 1;
      if (quote > acc.largestBuy) acc.largestBuy = quote;
    } else {
      acc.sell += quote;
      acc.sellCount += 1;
      if (quote > acc.largestSell) acc.largestSell = quote;
    }
  }
  function sumVenues(venues, exchange) {
    if (exchange !== "all") return venues.get(exchange) ?? emptyVenue();
    const out = emptyVenue();
    for (const v of venues.values()) {
      out.buy += v.buy;
      out.sell += v.sell;
      out.buyCount += v.buyCount;
      out.sellCount += v.sellCount;
      if (v.largestBuy > out.largestBuy) out.largestBuy = v.largestBuy;
      if (v.largestSell > out.largestSell) out.largestSell = v.largestSell;
    }
    return out;
  }
  function toStats(exchange, acc, cvd) {
    const delta = acc.buy - acc.sell;
    return {
      exchange,
      aggressiveBuyVolume: acc.buy,
      aggressiveSellVolume: acc.sell,
      delta,
      deltaPercent: deltaPercent(acc.buy, acc.sell),
      cvd,
      tradeCount: acc.buyCount + acc.sellCount,
      buyTradeCount: acc.buyCount,
      sellTradeCount: acc.sellCount,
      averageBuySize: safeDiv(acc.buy, acc.buyCount),
      averageSellSize: safeDiv(acc.sell, acc.sellCount),
      largestBuy: acc.largestBuy,
      largestSell: acc.largestSell
    };
  }
  function mergeMinutes(bars) {
    const first = bars[0];
    const last = bars[bars.length - 1];
    if (!first || !last) return null;
    const venues = /* @__PURE__ */ new Map();
    let buyNearAsk = 0;
    let sellNearBid = 0;
    let askRepl = null;
    let bidRepl = null;
    let hasBook = false;
    for (const bar of bars) {
      buyNearAsk += bar.buyNearAsk;
      sellNearBid += bar.sellNearBid;
      hasBook = hasBook || bar.hasBook;
      if (bar.askReplenishment != null) askRepl = bar.askReplenishment;
      if (bar.bidReplenishment != null) bidRepl = bar.bidReplenishment;
      for (const [ex, acc] of bar.venues) {
        const dest = venues.get(ex) ?? emptyVenue();
        dest.buy += acc.buy;
        dest.sell += acc.sell;
        dest.buyCount += acc.buyCount;
        dest.sellCount += acc.sellCount;
        if (acc.largestBuy > dest.largestBuy) dest.largestBuy = acc.largestBuy;
        if (acc.largestSell > dest.largestSell) dest.largestSell = acc.largestSell;
        venues.set(ex, dest);
      }
    }
    return {
      time: first.time,
      open: first.open,
      high: Math.max(...bars.map((b) => b.high)),
      low: Math.min(...bars.map((b) => b.low)),
      close: last.close,
      venues,
      buyNearAsk,
      sellNearBid,
      askReplenishment: askRepl,
      bidReplenishment: bidRepl,
      hasBook
    };
  }
  var SymbolSpotState = class {
    constructor(symbol, imbalanceRatio) {
      this.symbol = symbol;
      this.imbalanceRatio = imbalanceRatio;
      for (const tf of SPOT_CHART_TF_MINUTES) this.effort.set(tf, new EffortVsResult());
    }
    cvd = new SpotCvdBook();
    minutes = [];
    open = null;
    book = null;
    futures = null;
    oiUsd = null;
    prevOiUsd = null;
    askReplenishment = null;
    bidReplenishment = null;
    price = 0;
    effort = /* @__PURE__ */ new Map();
    absorb = new SpotAbsorptionDetector();
    classifier = new SpotFlowClassifier();
    lastSignedDelta = 0;
    bookState = new LocalOrderBook();
    liquidityResponse = new LiquidityResponseEngine(DEFAULT_CONFIG.liquidityResponse);
    lastBuy = 0;
    lastSell = 0;
    ingest(trade, exchange) {
      const time = barTime(trade.timestamp, 1);
      if (this.open && this.open.time !== time) {
        if (time > this.open.time) this.closeOpen();
        else return;
      }
      if (!this.open) {
        this.open = {
          time,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          venues: /* @__PURE__ */ new Map(),
          buyNearAsk: 0,
          sellNearBid: 0
        };
      }
      const bar = this.open;
      bar.high = Math.max(bar.high, trade.price);
      bar.low = Math.min(bar.low, trade.price);
      bar.close = trade.price;
      this.price = trade.price;
      let acc = bar.venues.get(exchange);
      if (!acc) {
        acc = emptyVenue();
        bar.venues.set(exchange, acc);
      }
      addTrade(acc, trade.side, trade.quoteValue);
      const buyQ = trade.side === "BUY" ? trade.quoteValue : 0;
      const sellQ = trade.side === "SELL" ? trade.quoteValue : 0;
      this.cvd.onTrade(exchange, trade.timestamp, buyQ, sellQ, trade.price);
      this.liquidityResponse.onTrade(trade, trade.quoteValue >= 1e5);
      if (this.book && trade.timestamp - this.book.timestamp <= 2e3) {
        const tick = Math.max((this.book.ask - this.book.bid) * 0.5, this.book.ask * 5e-5);
        if (trade.side === "BUY" && trade.price >= this.book.ask - tick) bar.buyNearAsk += trade.quoteValue;
        if (trade.side === "SELL" && trade.price <= this.book.bid + tick) bar.sellNearBid += trade.quoteValue;
      }
    }
    ingestBook(book) {
      const bid = book.bids[0]?.price ?? 0;
      const ask = book.asks[0]?.price ?? 0;
      if (bid > 0 && ask > 0) this.book = { bid, ask, timestamp: book.timestamp };
      this.bookState.applySnapshot(book);
      const live = this.open ? sumVenues(this.open.venues, "all") : emptyVenue();
      const buyDelta = Math.max(0, live.buy - this.lastBuy);
      const sellDelta = Math.max(0, live.sell - this.lastSell);
      this.lastBuy = live.buy;
      this.lastSell = live.sell;
      this.liquidityResponse.onBook(book.timestamp, this.bookState, buyDelta, sellDelta);
    }
    ingestBinanceWindow(window) {
      this.askReplenishment = window.askReplenishmentRate;
      this.bidReplenishment = window.bidReplenishmentRate;
    }
    setFutures(window) {
      this.futures = window;
    }
    setOi(oiUsd) {
      if (this.oiUsd != null && this.oiUsd > 0 && oiUsd !== this.oiUsd) this.prevOiUsd = this.oiUsd;
      this.oiUsd = oiUsd;
    }
    closeStale(now) {
      if (!this.open) return;
      if (this.open.time >= barTime(now, 1)) return;
      this.closeOpen();
    }
    snapshot(exchange, now) {
      this.closeStale(now);
      const windows = {};
      for (const tf of SPOT_CHART_TF_MINUTES) {
        const rolled = this.roll(tf, exchange);
        if (rolled) windows[tf] = rolled;
      }
      const exchanges = {};
      const liveVenues = this.currentVenues();
      for (const id of SPOT_EXCHANGE_IDS) {
        exchanges[id] = toStats(id, liveVenues.get(id) ?? emptyVenue(), this.cvd.value(id));
      }
      const aggregated = toStats("all", sumVenues(liveVenues, "all"), this.cvd.value("all"));
      const primary = windows[1] ?? this.liveWindow(exchange, now);
      const liquidityResponse = this.buildLiquidity(primary, now);
      return {
        symbol: this.symbol,
        price: this.price,
        timestamp: now,
        exchange,
        imbalanceRatio: this.imbalanceRatio,
        windows,
        exchanges,
        aggregated,
        comparison: primary ? compareSpotFutures(primary, { futures: this.futures, oiUsd: this.oiUsd, prevOiUsd: this.prevOiUsd }) : null,
        liquidityResponse
      };
    }
    buildLiquidity(primary, now) {
      if (!primary) return emptyLiquidityResponse();
      const fut = this.futures;
      return this.liquidityResponse.snapshot(
        {
          now,
          windowMs: 6e4,
          buy: primary.aggressiveBuyVolume,
          sell: primary.aggressiveSellVolume,
          buyCount: primary.buyTradeCount,
          sellCount: primary.sellTradeCount,
          largeBuyCount: 0,
          largeSellCount: 0,
          priceStart: primary.open,
          priceEnd: primary.close,
          priceHigh: primary.high,
          priceLow: primary.low,
          cvdDirection: primary.cvdDirection,
          oiChangePercent: null,
          shortLiquidationUsd: 0,
          longLiquidationUsd: 0,
          bookEmpty: this.bookState.empty(),
          lastBookAgeMs: this.book ? Math.max(0, now - this.book.timestamp) : 0,
          exchangeCount: Math.max(1, this.open?.venues.size ?? 1),
          oiExpected: false,
          liquidationExpected: false
        },
        fut?.liquidityResponse ? {
          snapshot: fut.liquidityResponse,
          oiChangePercent: this.oiUsd != null && this.prevOiUsd != null && this.prevOiUsd > 0 ? (this.oiUsd - this.prevOiUsd) / this.prevOiUsd * 100 : null,
          forcedBuyVolume: fut.forcedBuyVolume,
          forcedSellVolume: fut.forcedSellVolume
        } : null
      );
    }
    currentVenues() {
      const out = /* @__PURE__ */ new Map();
      const src = this.open?.venues;
      if (!src) return out;
      for (const [ex, acc] of src) {
        out.set(ex, { ...acc });
      }
      return out;
    }
    closeOpen() {
      const bar = this.open;
      if (!bar) return;
      this.open = null;
      const closed = {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        venues: bar.venues,
        buyNearAsk: bar.buyNearAsk,
        sellNearBid: bar.sellNearBid,
        askReplenishment: this.askReplenishment,
        bidReplenishment: this.bidReplenishment,
        hasBook: this.book != null
      };
      this.minutes.push(closed);
      if (this.minutes.length > DEFAULT_SPOT_HISTORY_BARS) this.minutes.shift();
      const acc = sumVenues(closed.venues, "all");
      const delta = acc.buy - acc.sell;
      this.absorb.observe(Math.abs(delta), Math.abs(safeDiv(closed.close - closed.open, closed.open) * 100));
      this.classifier.observe(delta, acc.buy + acc.sell);
      for (const tf of SPOT_CHART_TF_MINUTES) {
        const bucket2 = tf * 60;
        const lastMinute = closed.time % bucket2 === bucket2 - 60;
        if (!lastMinute) continue;
        const slice = this.minutes.filter((b) => b.time >= closed.time - (tf - 1) * 60 && b.time <= closed.time);
        const merged = mergeMinutes(slice);
        if (!merged) continue;
        const m = sumVenues(merged.venues, "all");
        this.effort.get(tf)?.measure(
          { open: merged.open, close: merged.close, totalVolume: m.buy + m.sell, delta: m.buy - m.sell },
          true
        );
      }
      this.lastSignedDelta = delta;
    }
    closedSlice(tf) {
      if (!this.minutes.length) return [];
      const last = this.minutes[this.minutes.length - 1];
      const from = last.time - (tf - 1) * 60;
      return this.minutes.filter((b) => b.time >= from);
    }
    liveSlice(tf) {
      const closed = this.closedSlice(tf);
      if (!this.open) return closed;
      const live = {
        time: this.open.time,
        open: this.open.open,
        high: this.open.high,
        low: this.open.low,
        close: this.open.close,
        venues: this.open.venues,
        buyNearAsk: this.open.buyNearAsk,
        sellNearBid: this.open.sellNearBid,
        askReplenishment: this.askReplenishment,
        bidReplenishment: this.bidReplenishment,
        hasBook: this.book != null
      };
      const from = live.time - (tf - 1) * 60;
      return [...closed.filter((b) => b.time >= from && b.time !== live.time), live];
    }
    roll(tf, exchange) {
      const bars = this.liveSlice(tf);
      const merged = mergeMinutes(bars);
      if (!merged) return this.liveWindow(exchange, Date.now());
      return this.toWindow(tf, merged, exchange);
    }
    liveWindow(exchange, now) {
      if (!this.open) return null;
      const live = {
        time: this.open.time,
        open: this.open.open,
        high: this.open.high,
        low: this.open.low,
        close: this.open.close,
        venues: this.open.venues,
        buyNearAsk: this.open.buyNearAsk,
        sellNearBid: this.open.sellNearBid,
        askReplenishment: this.askReplenishment,
        bidReplenishment: this.bidReplenishment,
        hasBook: this.book != null
      };
      return this.toWindow(1, live, exchange, now);
    }
    toWindow(tf, bar, exchange, now = Date.now()) {
      const acc = sumVenues(bar.venues, exchange);
      const stats = toStats(exchange, acc, this.cvd.value(exchange));
      const effort = this.effort.get(tf) ?? new EffortVsResult();
      const efficiency2 = effort.measure(
        { open: bar.open, close: bar.close, totalVolume: acc.buy + acc.sell, delta: acc.buy - acc.sell },
        false
      );
      const absorption = this.absorb.detect({
        buyVolume: acc.buy,
        sellVolume: acc.sell,
        delta: acc.buy - acc.sell,
        priceChangePercent: efficiency2.priceChangePercent,
        buyNearAskShare: nearTouchShare(bar.buyNearAsk, acc.buy),
        sellNearBidShare: nearTouchShare(bar.sellNearBid, acc.sell),
        askReplenishment: bar.askReplenishment,
        bidReplenishment: bar.bidReplenishment,
        hasBook: bar.hasBook
      });
      const cvdSnap = this.cvd.snapshot(exchange, now);
      const classified = this.classifier.classify({
        delta: stats.delta,
        deltaPercent: stats.deltaPercent,
        totalVolume: acc.buy + acc.sell,
        priceChangePercent: efficiency2.priceChangePercent,
        cvdDivergence: cvdSnap.divergence,
        cvdAcceleration: cvdSnap.acceleration,
        priorAbsDelta: this.lastSignedDelta,
        absorption: absorption.type
      });
      return {
        ...stats,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        efficiency: efficiency2,
        absorption,
        flow: classified.flow,
        flags: classified.flags,
        cvdDirection: cvdSnap.direction,
        cvdDivergence: cvdSnap.divergence
      };
    }
  };
  var SpotFlowEngine = class {
    constructor(imbalanceRatio = DEFAULT_IMBALANCE_RATIO) {
      this.imbalanceRatio = imbalanceRatio;
    }
    symbols = /* @__PURE__ */ new Map();
    deduper = new TradeDeduper(DEFAULT_SPOT_DEDUP);
    ingestTrade(trade, exchange) {
      if (trade.marketType !== "spot") return false;
      const spotEx = asSpotExchange(exchange);
      if (!spotEx) return false;
      if (!this.deduper.accept(exchange, trade.symbol, trade.tradeId)) return false;
      this.get(trade.symbol).ingest(trade, spotEx);
      return true;
    }
    ingestBook(book) {
      if (book.marketType !== "spot") return;
      this.get(book.symbol).ingestBook(book);
    }
    ingestBinanceWindow(symbol, window) {
      this.get(symbol).ingestBinanceWindow(window);
    }
    setFuturesWindow(symbol, window) {
      this.get(symbol).setFutures(window);
    }
    setOi(symbol, oiUsd) {
      this.get(symbol).setOi(oiUsd);
    }
    snapshot(symbol, exchange = "all", now = Date.now()) {
      return this.get(symbol).snapshot(exchange, now);
    }
    get(symbol) {
      let state = this.symbols.get(symbol);
      if (!state) {
        state = new SymbolSpotState(symbol, this.imbalanceRatio);
        this.symbols.set(symbol, state);
      }
      return state;
    }
  };

  // src/client/browser-hub.ts
  var WATCHLIST_KEY = "orderflow.activeWatchlist";
  var FOOTPRINT_PUSH_MS = 250;
  var FOOTPRINT_TICK_MS = 1e3;
  var SPOT_FLOW_MS = 2e3;
  function loadActiveSymbols() {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return [...DEFAULT_ACTIVE_SYMBOLS];
      const parsed = JSON.parse(raw);
      const symbols = Array.isArray(parsed.symbols) ? parsed.symbols.map((s) => String(s ?? "").toUpperCase()).filter(Boolean) : [];
      return symbols.length ? symbols : [...DEFAULT_ACTIVE_SYMBOLS];
    } catch {
      return [...DEFAULT_ACTIVE_SYMBOLS];
    }
  }
  function saveActiveSymbols(symbols) {
    localStorage.setItem(
      WATCHLIST_KEY,
      JSON.stringify({ symbols, updatedAt: (/* @__PURE__ */ new Date()).toISOString() })
    );
  }
  function compactCandidate(p) {
    return {
      id: p.id,
      version: p.patternVersion,
      direction: p.direction,
      title: p.title,
      badge: p.badge,
      status: p.status,
      confidence: p.confidence,
      progress: Math.round(p.progress * 100),
      startTimestamp: p.startTimestamp,
      confirmedTimestamp: p.confirmedTimestamp,
      barsUsed: p.barsUsed,
      stage: p.stage,
      totalStages: p.totalStages,
      matchedLabels: p.matchedLabels,
      evidence: {
        labelConfidence: p.evidence.labelConfidence,
        sweepQuality: p.evidence.sweepQuality,
        controlShift: p.evidence.controlShift,
        supportingEvidence: p.evidence.supportingEvidence,
        stageCompletion: p.evidence.components.stageCompletion
      }
    };
  }
  function compactNextState(next) {
    if (!next) return null;
    return {
      status: next.status,
      prediction: next.prediction,
      probability: next.probability,
      secondPrediction: next.secondPrediction,
      secondProbability: next.secondProbability,
      margin: next.margin,
      confidence: next.confidence,
      confidenceScore: next.confidenceScore,
      sampleCount: next.sampleCount,
      sequenceDepth: next.sequenceDepth,
      distribution: next.distribution
    };
  }
  function compactMarker(m) {
    return {
      t: m.time,
      badge: m.badge,
      id: m.patternId,
      title: m.title,
      status: m.status,
      confidence: m.confidence,
      direction: m.direction,
      stage: m.stage,
      totalStages: m.totalStages,
      progress: Math.round(m.progress * 100),
      matchedLabels: m.matchedLabels,
      barsUsed: m.barsUsed
    };
  }
  function compactPatternSnapshot(snap) {
    return {
      timeframe: snap.timeframe,
      currentLabel: snap.currentLabel,
      primary: snap.primaryPattern ? compactCandidate(snap.primaryPattern) : null,
      currentPattern: toCurrentPattern(snap.primaryPattern),
      nextState: compactNextState(snap.nextState),
      markers: snap.markers.map(compactMarker)
    };
  }
  var BrowserOrderFlowHub = class {
    coins = resolveWatchlist(loadActiveSymbols());
    perpFeed = null;
    spotFeed = null;
    perpAgg = new FootprintAggregator({ market: "perp" });
    spotAgg = new FootprintAggregator({ market: "spot" });
    spotHub = new SpotFlowEngine(DEFAULT_IMBALANCE_RATIO);
    patternHub = new PatternLiveHub();
    listeners = /* @__PURE__ */ new Set();
    footprintSub = null;
    timers = [];
    started = false;
    restartChain = Promise.resolve();
    getConfig() {
      return {
        coins: this.coins,
        catalog: FULL_WATCHLIST_CATALOG,
        crypto: this.coins.filter((c) => c.venue === "crypto"),
        stocks: this.coins.filter((c) => c.venue === "equity"),
        market: "perp",
        markets: ["perp", "spot"],
        stockSource: "binance-perp",
        exchanges: ["binance"],
        spotExchanges: ["binance"],
        exchangeLabels: EXCHANGE_LABELS,
        imbalanceRatio: DEFAULT_IMBALANCE_RATIO,
        history: { enabled: false, retentionDays: 0 },
        watchlist: { lockedByEnv: false, path: "localStorage" },
        tiers: DEFAULT_CONFIG.largeTradeThresholds,
        relative: {
          large: DEFAULT_CONFIG.relative.largePercentile,
          veryLarge: DEFAULT_CONFIG.relative.veryLargePercentile,
          extreme: DEFAULT_CONFIG.relative.extremePercentile
        },
        clientMode: true
      };
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    emit(ev) {
      for (const listener of this.listeners) {
        try {
          listener(ev);
        } catch (err) {
          console.error("[client] listener failed", err);
        }
      }
    }
    handleMessage(msg) {
      if (msg.type !== "sub_footprint") return;
      const requested = Array.isArray(msg.symbols) ? msg.symbols.map((s) => String(s ?? "").toUpperCase()) : [String(msg.symbol ?? "").toUpperCase()];
      const symbols = [...new Set(requested)].filter((symbol) => this.coins.some((c) => c.symbol === symbol));
      if (!symbols.length) return;
      const market = String(msg.market ?? "").toLowerCase() === "spot" ? "spot" : "perp";
      const exchangeRaw = String(msg.exchange ?? "binance").toLowerCase();
      const exchanges = exchangeRaw === "all" ? ["binance"] : exchangeRaw === "binance" ? ["binance"] : ["binance"];
      this.footprintSub = { symbols, market, exchanges };
      this.pushLiveFootprint();
    }
    start() {
      if (this.started) return;
      this.started = true;
      this.createFeeds();
      this.perpFeed?.start();
      this.spotFeed?.start();
      this.timers.push(setInterval(() => this.pushLiveFootprint(), FOOTPRINT_PUSH_MS));
      this.timers.push(
        setInterval(() => {
          this.broadcastFootprintTicks("perp");
          this.broadcastFootprintTicks("spot");
        }, FOOTPRINT_TICK_MS)
      );
      this.timers.push(
        setInterval(() => {
          const now = Date.now();
          for (const coin of this.coins.filter((c) => c.venue === "crypto")) {
            this.emit({ type: "spot_flow", market: "spot", snapshot: this.spotHub.snapshot(coin.symbol, "all", now) });
          }
        }, SPOT_FLOW_MS)
      );
    }
    stop() {
      this.started = false;
      for (const t of this.timers) clearInterval(t);
      this.timers = [];
      this.perpFeed?.stop();
      this.spotFeed?.stop();
      this.perpFeed = null;
      this.spotFeed = null;
    }
    setWatchlist(symbols) {
      const next = resolveWatchlist(symbols);
      if (!next.length) throw new Error("Pick at least one coin");
      saveActiveSymbols(next.map((c) => c.symbol));
      this.coins = next;
      this.restartFeeds("watchlist");
      return { coins: this.coins, restartRequired: false };
    }
    /** Same payload as Node `/api/patterns` — runs fully in the browser. */
    recognizePatterns(body) {
      const symbol = String(body.symbol ?? "BTCUSDT").toUpperCase();
      const market = String(body.market ?? "").toLowerCase() === "spot" ? "spot" : "perp";
      const tf = Math.max(1, Math.min(1440, Math.floor(Number(body.tf) || 15)));
      const bars = (body.bars ?? []).slice(-400).map((w) => ({
        symbol,
        exchange: "binance",
        market,
        time: w.t,
        open: w.o,
        high: w.h,
        low: w.l,
        close: w.c,
        totalBuy: w.tb ?? 0,
        totalSell: w.ts ?? 0,
        trades: w.n ?? 0,
        buyTrades: w.bt,
        sellTrades: w.st,
        largestBuy: w.lb,
        largestSell: w.ls,
        levels: (w.lv ?? []).map(([price, buy, sell]) => ({ price, buy, sell }))
      }));
      const view = historyPatternView(bars, tf, { lastIsLive: Boolean(body.lastIsLive) });
      return {
        symbol,
        tf,
        currentLabel: view.snapshot?.currentLabel ?? null,
        primary: view.snapshot?.primaryPattern ? compactCandidate(view.snapshot.primaryPattern) : null,
        currentPattern: toCurrentPattern(view.snapshot?.primaryPattern ?? null),
        nextState: compactNextState(view.snapshot?.nextState ?? null),
        markers: view.markers.map(compactMarker)
      };
    }
    restartFeeds(reason) {
      this.restartChain = this.restartChain.catch(() => void 0).then(async () => {
        try {
          this.perpFeed?.stop();
        } catch {
        }
        try {
          this.spotFeed?.stop();
        } catch {
        }
        await new Promise((r) => setTimeout(r, 50));
        if (!this.started) return;
        this.createFeeds();
        this.perpFeed?.start();
        this.spotFeed?.start();
        this.emit({
          type: "watchlist",
          coins: this.coins,
          active: this.coins.map((c) => c.symbol),
          reason
        });
      });
    }
    createFeeds() {
      const cryptoCoins = this.coins.filter((c) => c.venue === "crypto");
      const noRestDepth = async () => ({ bids: [], asks: [] });
      this.perpFeed = new LiveBinanceFeed({
        coins: this.coins,
        market: "perp",
        summaryMs: 2e3,
        exchanges: ["binance"],
        engineTradeVenues: ["binance"],
        engineTradeFallbackMs: 0,
        depthMode: "partial-ws",
        fetchDepth: noRestDepth
      });
      this.spotFeed = new LiveBinanceFeed({
        coins: cryptoCoins,
        market: "spot",
        summaryMs: 2e3,
        exchanges: ["binance"],
        engineTradeVenues: ["binance"],
        engineTradeFallbackMs: 0,
        depthMode: "partial-ws",
        fetchDepth: noRestDepth
      });
      this.perpFeed.onAnyTrade((trade, exchange) => {
        this.perpAgg.ingest(trade, exchange);
      });
      this.spotFeed.onAnyTrade((trade, exchange) => {
        if (!this.spotHub.ingestTrade(trade, exchange)) return;
        this.spotAgg.ingest(trade, exchange);
      });
      this.perpFeed.on((ev) => {
        if (ev.type === "summary") {
          this.spotHub.setFuturesWindow(ev.summary.symbol, ev.summary.windows["1m"]);
        }
        this.emit({ ...ev, market: "perp" });
      });
      this.spotFeed.on((ev) => {
        if (ev.type === "book") {
          this.spotHub.ingestBook({
            symbol: ev.symbol,
            marketType: "spot",
            timestamp: Date.now(),
            bids: ev.bids,
            asks: ev.asks
          });
        }
        if (ev.type === "summary") {
          this.spotHub.ingestBinanceWindow(ev.summary.symbol, ev.summary.windows["1m"]);
        }
        this.emit({ ...ev, market: "spot" });
      });
    }
    aggFor(market) {
      return market === "spot" ? this.spotAgg : this.perpAgg;
    }
    pushLiveFootprint() {
      const sub = this.footprintSub;
      if (!sub) return;
      const rec = this.aggFor(sub.market);
      for (const symbol of sub.symbols) {
        const bars = [];
        for (const exchange of sub.exchanges) {
          const bar = rec.currentBar(symbol, exchange);
          if (bar) bars.push({ exchange, bar: toWire(bar) });
        }
        if (!bars.length) continue;
        this.emit({ type: "footprint_live", symbol, market: sub.market, bars });
      }
    }
    broadcastFootprintTicks(market) {
      const rec = this.aggFor(market);
      rec.closeStale();
      const closed = rec.peekClosed();
      if (closed.length) {
        const { alerts, dirty } = this.patternHub.observeClosed(closed);
        for (const alert of alerts) {
          this.emit({ type: "pattern_alert", market, alert });
        }
        for (const symbol of dirty) {
          const snapshots = this.patternHub.snapshotsForSymbol(symbol, market);
          if (!snapshots.length) continue;
          this.emit({
            type: "pattern_snapshot",
            market,
            symbol,
            snapshots: snapshots.map(compactPatternSnapshot)
          });
        }
      }
      const bars = [];
      for (const coin of this.coins) {
        if (market === "spot" && coin.venue === "equity") continue;
        const bar = rec.currentBar(coin.symbol, "binance");
        if (bar) bars.push({ symbol: coin.symbol, exchange: "binance", bar: toWire(bar) });
      }
      if (!bars.length) return;
      this.emit({ type: "footprint_tick", market, bars });
    }
  };
  var hub = new BrowserOrderFlowHub();
  globalThis.window.OrderFlowClient = {
    getConfig: () => hub.getConfig(),
    start: () => hub.start(),
    stop: () => hub.stop(),
    subscribe: (listener) => hub.subscribe(listener),
    handleMessage: (msg) => hub.handleMessage(msg),
    setWatchlist: (symbols) => hub.setWatchlist(symbols),
    recognizePatterns: (body) => hub.recognizePatterns(body),
    annotateLevelInteractions,
    formatLevelEventTooltip,
    projectLevelEventLine,
    projectFailReclaimLabel,
    failReclaimLabelY,
    LEVEL_EVENT_SHORT,
    catalog: FULL_WATCHLIST_CATALOG
  };
})();
//# sourceMappingURL=client.bundle.js.map
