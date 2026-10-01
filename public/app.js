const _noopEl = {
  textContent: '',
  innerHTML: '',
  className: '',
  style: {},
  value: '',
  hidden: false,
  disabled: false,
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  prepend() {},
  appendChild() { return null; },
  remove() {},
  closest() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  get children() { return []; },
  get lastChild() { return null; },
  get dataset() { return {}; },
};
const $ = (id) => document.getElementById(id) || _noopEl;

const MAX_TAPE = 150;
const MAX_EVENTS = 80;
let eventCount = 0;

let selectedTf = '10s';
let selectedSymbol = 'AVAXUSDT';
let selectedExchange = 'all';
let dataMode = 'perp'; // perp | spot | compare
let imbalanceRatio = 3;
const SPOT_EXCHANGES = ['binance', 'bybit', 'okx', 'bitstamp'];
const summariesByMarket = { perp: {}, spot: {} };
const spotFlowBySymbol = {};
let lastSpotFlow = null;
const feedStatus = {
  perp: { connected: false, message: '' },
  spot: { connected: false, message: '' },
};

function footprintMarket() {
  return dataMode === 'perp' ? 'perp' : 'spot';
}

function isSpotView() {
  return dataMode !== 'perp';
}
let lastSummary = null;
const summaries = {};
const tapeBySymbol = {};
const eventsBySymbol = {};
let config = null;
const seenTradeIds = new Set();
const openTabs = []; // list of { symbol, label }

const STATE_META = {
  NO_SIGNAL: { title: 'Normal activity', help: 'Nothing unusually large or persistent in this window.' },
  LARGE_BUY_FLOW: { title: 'Heavy aggressive buying', help: 'Large buyers are hitting the ask. Check if price is actually rising (effective) or stalling (absorption).' },
  LARGE_SELL_FLOW: { title: 'Heavy aggressive selling', help: 'Large sellers are hitting the bid. Check price response.' },
  PERSISTENT_BUY_FLOW: { title: 'Sustained buying pressure', help: 'Aggressive buying continued over this window — not just one print.' },
  PERSISTENT_SELL_FLOW: { title: 'Sustained selling pressure', help: 'Aggressive selling continued over this window.' },
  BUY_BURST: { title: 'Buy burst', help: 'Many aggressive buys clustered in seconds — could be one order split into pieces.' },
  SELL_BURST: { title: 'Sell burst', help: 'Many aggressive sells clustered in seconds.' },
  BUYER_ABSORPTION: { title: 'Buyer absorption', help: 'Lots of aggressive buying but price barely rose. Passive sellers may be absorbing buyers.' },
  SELLER_ABSORPTION: { title: 'Seller absorption', help: 'Lots of aggressive selling but price barely fell. Passive buyers may be absorbing sellers.' },
  LIQUIDITY_VACUUM_UP: { title: 'Thin asks — price jumping', help: 'Buyers consuming limited ask liquidity; price moving up quickly.' },
  LIQUIDITY_VACUUM_DOWN: { title: 'Thin bids — price dropping', help: 'Sellers consuming limited bid liquidity; price moving down quickly.' },
  FLOW_EXHAUSTION_BUY: { title: 'Buy flow fading', help: 'Strong buying was happening but is now decelerating.' },
  FLOW_EXHAUSTION_SELL: { title: 'Sell flow fading', help: 'Strong selling was happening but is now decelerating.' },
};

const IMPACT_HELP = {
  LOW: 'Flow did not move price much — possible absorption',
  NORMAL: 'Typical price response for this asset',
  HIGH: 'Price moved more than usual for this flow',
  EXTREME: 'Unusually strong price reaction',
};

const TF_LABEL = {
  '10s': 'last 10 seconds',
  '30s': 'last 30 seconds',
  '1m': 'last 1 minute',
  '5m': 'last 5 minutes',
  '15m': 'last 15 minutes',
};


const EX_SHORT = { binance: 'BN', bybit: 'BY', okx: 'OKX', bitget: 'BG', hyperliquid: 'HL', dydx: 'DX', bitstamp: 'BS' };
const DEFAULT_EXCHANGES = ['binance', 'bybit', 'okx', 'bitget', 'hyperliquid', 'dydx', 'bitstamp'];

function fmtUsd(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function fmtPrice(p) {
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTierUsd(n) {
  if (n >= 1e6) return `$${n / 1e6}M+`;
  if (n >= 1e3) return `$${n / 1e3}K+`;
  return `$${n}+`;
}

function stateClass(state) {
  if (!state || state === 'NO_SIGNAL') return '';
  if (state.includes('ABSORPTION')) return 'absorption';
  if (state.includes('BURST')) return 'burst';
  if (state.includes('BUY') || state.includes('UP')) return 'buy-flow';
  if (state.includes('SELL') || state.includes('DOWN')) return 'sell-flow';
  return '';
}

function decodeFlags(trade) {
  const badges = [];
  if (trade.tier) badges.push({ cls: 'tier', text: `T${trade.tier}`, tip: tierTip(trade.tier) });
  if (trade.relativeClass && trade.relativeClass !== 'NORMAL') {
    badges.push({ cls: 'rel', text: trade.relativeClass.replace('_', ' '), tip: relativeTip(trade.relativeClass) });
  }
  return badges;
}

function tierTip(t) {
  if (!config?.tiers) return '';
  const map = { 1: config.tiers.tier1, 2: config.tiers.tier2, 3: config.tiers.tier3, 4: config.tiers.tier4 };
  return `Single print ≥ ${fmtTierUsd(map[t] ?? 0)}`;
}

function relativeTip(cls) {
  const p = config?.relative;
  if (!p) return 'Unusually large vs recent trades on this symbol';
  if (cls === 'LARGE') return `Bigger than ~${p.large}% of recent prints`;
  if (cls === 'VERY_LARGE') return `Top ~${100 - p.veryLarge}% — bigger than ~${p.veryLarge}% of recent prints`;
  if (cls === 'EXTREME') return `Top ~${100 - p.extreme}% — extremely rare size for this symbol`;
  return '';
}

function renderTierLegend() {
  if (!config?.tiers) return;
  const t = config.tiers;
  $('tier-legend').innerHTML = [
    ['T1', t.tier1],
    ['T2', t.tier2],
    ['T3', t.tier3],
    ['T4', t.tier4],
  ]
    .map(([label, usd]) => `<li><strong>${label}</strong> ${fmtTierUsd(usd)} per print</li>`)
    .join('');
}

function coinStore(map, symbol) {
  if (!map[symbol]) map[symbol] = [];
  return map[symbol];
}

function tradeExchange(trade) {
  return trade.exchange || 'binance';
}

function coinIsEquity(symbol = selectedSymbol) {
  return config?.coins?.find((c) => c.symbol === symbol)?.venue === 'equity';
}

function activeExchanges() {
  if (isSpotView()) {
    const enabled = new Set(config?.spotExchanges ?? SPOT_EXCHANGES);
    return SPOT_EXCHANGES.filter((id) => enabled.has(id));
  }
  const ids = config?.exchanges?.length ? config.exchanges : DEFAULT_EXCHANGES;
  return coinIsEquity() ? ['binance'] : ids;
}

function tradeMarket(trade) {
  return trade?.market === 'spot' ? 'spot' : 'perp';
}

function tradeMatchesExchange(trade) {
  if (tradeMarket(trade) !== footprintMarket()) return false;
  if (coinIsEquity(trade.symbol)) return tradeExchange(trade) === 'binance';
  if (selectedExchange === 'all') return true;
  return tradeExchange(trade) === selectedExchange;
}

function klineExchange() {
  return selectedExchange === 'all' ? 'binance' : selectedExchange;
}

function addTapeRow(trade) {
  if (!trade.symbol) return;
  if (seenTradeIds.has(trade.id)) return;
  seenTradeIds.add(trade.id);
  if (seenTradeIds.size > MAX_TAPE * 8) seenTradeIds.clear();

  const list = coinStore(tapeBySymbol, trade.symbol);
  list.unshift(trade);
  if (list.length > MAX_TAPE) list.length = MAX_TAPE;

  if (trade.symbol === selectedSymbol && tradeMatchesExchange(trade)) appendTapeRow(trade);
}

function makeTapeRowEl(trade) {
  const div = document.createElement('div');
  div.className = `tape-row ${trade.side.toLowerCase()}`;
  div.dataset.id = trade.id;
  const sideLabel = trade.side === 'BUY' ? 'Aggressive BUY' : 'Aggressive SELL';
  const sideSub = trade.side === 'BUY' ? 'hit ask' : 'hit bid';
  const flags = decodeFlags(trade)
    .map((b) => `<span class="flag ${b.cls}" title="${b.tip}">${b.text}</span>`)
    .join('');
  const ex = tradeExchange(trade);
  const exLabel = EX_SHORT[ex] ?? ex;
  div.innerHTML =
    `<span class="time">${fmtTime(trade.timestamp)}</span>` +
    `<span class="ex-badge" title="${ex}">${exLabel}</span>` +
    `<span class="action"><span class="action-main side-${trade.side.toLowerCase()}">${sideLabel}</span><span class="action-sub">${sideSub}</span></span>` +
    `<span class="price">${fmtPrice(trade.price)}</span>` +
    `<span class="notional">${fmtUsd(trade.quoteValue)}</span>` +
    `<span class="flags">${flags || '<span class="flag dim">—</span>'}</span>`;
  return div;
}

function appendTapeRow(trade) {
  const container = $('tape');
  container.prepend(makeTapeRowEl(trade));
  while (container.children.length > MAX_TAPE) container.lastChild.remove();
  $('tape-count').textContent = `${container.children.length} shown`;
}

function renderTape() {
  const container = $('tape');
  container.innerHTML = '';
  const list = (tapeBySymbol[selectedSymbol] ?? []).filter(tradeMatchesExchange);
  for (const trade of list) container.appendChild(makeTapeRowEl(trade));
  $('tape-count').textContent = `${list.length} shown`;
}

const EVENT_ICONS = { burst: '⚡', alert: '⚠', large: '◆', state: '◉', absorption: '⊘', move: '◎', info: '·' };

function addEvent(opts) {
  if (!opts || !opts.symbol || opts.symbol === '*') return;
  if (opts.market && opts.market !== footprintMarket()) return;

  const item = {
    kind: opts.kind,
    title: opts.title,
    detail: opts.detail || '',
    cls: opts.cls || opts.kind,
    symbol: opts.symbol,
    time: Date.now(),
  };

  const list = coinStore(eventsBySymbol, item.symbol);
  list.unshift(item);
  if (list.length > MAX_EVENTS) list.length = MAX_EVENTS;

  if (item.symbol === selectedSymbol) appendEvent(item);
}

function makeEventEl(item) {
  const div = document.createElement('div');
  div.className = `event-card ${item.cls}`;
  div.innerHTML =
    `<div class="event-icon">${EVENT_ICONS[item.kind] ?? '·'}</div>` +
    `<div class="event-body">` +
      `<div class="event-top"><span class="event-kind">${item.kind.toUpperCase()}</span><span class="event-time">${fmtTime(item.time)}</span></div>` +
      `<div class="event-title">${item.title}</div>` +
      (item.detail ? `<div class="event-detail">${item.detail}</div>` : '') +
    `</div>`;
  return div;
}

function appendEvent(item) {
  const container = $('events');
  container.prepend(makeEventEl(item));
  while (container.children.length > MAX_EVENTS) container.lastChild.remove();
  $('events-count').textContent = `${container.children.length} events`;
}

function renderEvents() {
  const container = $('events');
  container.innerHTML = '';
  const list = eventsBySymbol[selectedSymbol] ?? [];
  for (const item of list) container.appendChild(makeEventEl(item));
  $('events-count').textContent = `${list.length} events`;
}

function clearMainPanels() {
  lastSummary = null;
  $('price').textContent = '—';
  $('price-change').textContent = '—';
  $('price-change').className = 'price-change';
  $('state-badge').textContent = 'NO_SIGNAL';
  $('state-badge').className = 'state-badge';
  $('state-title').textContent = 'Waiting for this coin…';
  $('state-help').textContent = 'Each coin has its own tape, events, and price. Nothing is mixed.';
  $('delta').textContent = '$0';
  $('delta').className = 'value';
  $('delta-pct').textContent = '—';
  $('score').textContent = '0';
  $('score').style.color = 'inherit';
  $('impact').textContent = '—';
  $('confidence').textContent = '—';
  $('buy-vol').textContent = '$0';
  $('sell-vol').textContent = '$0';
  $('buy-bar').style.width = '50%';
  $('sell-bar').style.width = '50%';
  $('compare-row').innerHTML = '';
  $('absorption-box').classList.add('hidden');
  if ($('battle-winner')) $('battle-winner').textContent = '—';
  if ($('battle-state')) $('battle-state').textContent = '—';
  if ($('battle-evidence')) $('battle-evidence').textContent = '';
  if ($('battle-agg-buy')) $('battle-agg-buy').textContent = '0';
  renderLiquidityResponse();
  if ($('battle-pas-sell')) $('battle-pas-sell').textContent = '0';
  if ($('battle-agg-sell')) $('battle-agg-sell').textContent = '0';
  if ($('battle-pas-buy')) $('battle-pas-buy').textContent = '0';
}

function syncExchangeTabs() {
  const enabled = new Set(activeExchanges());
  const equity = coinIsEquity();
  const spot = isSpotView();
  if (equity && selectedExchange !== 'binance') selectedExchange = 'binance';
  if (!equity && selectedExchange !== 'all' && !enabled.has(selectedExchange)) selectedExchange = 'all';
  document.querySelectorAll('#chart-ex-tabs [data-ex]').forEach((btn) => {
    const id = btn.dataset.ex;
    const allowed = id === 'all' ? !equity && enabled.size > 1 : enabled.has(id);
    btn.hidden = !allowed;
    btn.disabled = !allowed;
    btn.classList.toggle('active', id === selectedExchange);
  });
}

function applySymbolFilter() {
  document.querySelectorAll('.coin-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.symbol === selectedSymbol);
  });
  lastSummary = summaries[selectedSymbol] ?? null;
  lastSpotFlow = spotFlowBySymbol[selectedSymbol] ?? null;
  if (isSpotView()) {
    updateSpotUi();
  } else if (lastSummary) {
    updateUi();
  } else {
    clearMainPanels();
  }
  syncExchangeTabs();
  renderTape();
  renderEvents();
  rebuildChart();
  seedFootprintKlines();
  subscribeFootprint();
  renderSpotCompare();
}

function chipHtml(c) {
  return `
    <button class="coin-chip ${c.symbol === selectedSymbol ? 'active' : ''}" data-symbol="${c.symbol}" type="button">
      <span class="coin-label">${c.label}</span>
      <span class="coin-delta" id="delta-${c.symbol}">—</span>
    </button>`;
}

let coinNavBound = false;
function renderCoinBar(assets) {
  const crypto = assets.filter((c) => c.venue !== 'equity');
  const stocks = assets.filter((c) => c.venue === 'equity');
  $('crypto-bar').innerHTML = crypto.map(chipHtml).join('');
  $('stock-bar').innerHTML = stocks.map(chipHtml).join('');

  if (!coinNavBound) {
    coinNavBound = true;
    document.querySelector('.asset-nav')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.coin-chip');
      if (!chip) return;
      const sym = chip.dataset.symbol;
      openCoinBrowserTab(sym);
      chip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

/**
 * Open another coin in a new Chrome tab at /btc, /eth, …
 * This tab stays on its own coin from the URL.
 */
function openCoinBrowserTab(symbol) {
  if (!symbol || !config?.coins?.some((c) => c.symbol === symbol)) return;
  const path = pathForSymbol(symbol);
  if (symbol === selectedSymbol && location.pathname === path) return;
  window.open(`${path}${location.search}`, '_blank', 'noopener,noreferrer');
}

function openTab(symbol, label, { fromRoute = false, newBrowserTab = true } = {}) {
  // From the UI: open a real browser tab for a different coin.
  if (!fromRoute && newBrowserTab && symbol !== selectedSymbol) {
    openCoinBrowserTab(symbol);
    return;
  }
  if (isSpotView() && config?.coins?.find((c) => c.symbol === symbol)?.venue === 'equity') {
    applyDataMode('perp');
  }
  if (!openTabs.find((t) => t.symbol === symbol)) {
    openTabs.push({ symbol, label });
  }
  selectedSymbol = symbol;
  liveLastPrice = 0;
  liveLastPriceAt = 0;
  renderOpenTabs();
  applySymbolFilter();
  if (!fromRoute) syncCoinRoute(true);
}

function closeTab(symbol) {
  const idx = openTabs.findIndex((t) => t.symbol === symbol);
  if (idx < 0) return;
  openTabs.splice(idx, 1);
  if (selectedSymbol === symbol) {
    // Closing the active coin tab — leave this browser tab on the same coin
    // (URL is the source of truth). Re-add the tab chip if emptied.
    if (!openTabs.length) {
      const coin = config?.coins?.find((c) => c.symbol === selectedSymbol) ?? config?.coins?.[0];
      if (coin) {
        openTabs.push({ symbol: coin.symbol, label: coin.label });
        selectedSymbol = coin.symbol;
      }
    } else {
      // Switch UI highlight only if user closed a non-route tab; keep URL coin.
      const routeCoin = findCoinBySlug(parseCoinRoute().slug);
      if (routeCoin) selectedSymbol = routeCoin.symbol;
      else selectedSymbol = openTabs[Math.min(idx, openTabs.length - 1)].symbol;
    }
  }
  renderOpenTabs();
  applySymbolFilter();
  syncCoinRoute(true);
}

function renderOpenTabs() {
  const container = $('open-tabs');
  if (!container) return;
  container.innerHTML = openTabs
    .map((t) => `
      <div class="open-tab ${t.symbol === selectedSymbol ? 'active' : ''}" data-symbol="${t.symbol}">
        <span class="open-tab-label">${t.label}</span>
        <span class="open-tab-delta" id="tab-delta-${t.symbol}">—</span>
        ${openTabs.length > 1 ? `<button class="open-tab-close" data-close="${t.symbol}" title="Close tab">×</button>` : ''}
      </div>`)
    .join('');

  container.onclick = (e) => {
    const closeBtn = e.target.closest('.open-tab-close');
    if (closeBtn) {
      e.stopPropagation();
      closeTab(closeBtn.dataset.close);
      return;
    }
    const tab = e.target.closest('.open-tab');
    if (tab) openCoinBrowserTab(tab.dataset.symbol);
  };
}
/** URL slug for a coin — /btc, /eth, /aapl */
function coinSlug(coin) {
  if (!coin) return '';
  return String(coin.label || String(coin.symbol).replace(/USDT$/i, '')).toLowerCase();
}

function pathForSymbol(symbol = selectedSymbol) {
  const coin = config?.coins?.find((c) => c.symbol === symbol);
  const slug = coinSlug(coin) || String(symbol).replace(/USDT$/i, '').toLowerCase();
  return dataMode === 'spot' ? `/spot/${slug}` : `/${slug}`;
}

function parseCoinRoute(pathname = location.pathname) {
  const parts = String(pathname || '/').split('/').filter(Boolean);
  if (parts.length === 1) return { mode: null, slug: parts[0].toLowerCase() };
  if (parts.length === 2 && (parts[0] === 'spot' || parts[0] === 'perp')) {
    return { mode: parts[0], slug: parts[1].toLowerCase() };
  }
  return { mode: null, slug: null };
}

function findCoinBySlug(slug) {
  if (!slug || !config?.coins?.length) return null;
  const s = String(slug).toLowerCase();
  return (
    config.coins.find((c) => coinSlug(c) === s) ||
    config.coins.find((c) => String(c.symbol).toLowerCase() === s) ||
    config.coins.find((c) => String(c.symbol).toLowerCase() === `${s}usdt`) ||
    null
  );
}

let syncingFromRoute = false;

function syncCoinRoute(replace = false) {
  if (syncingFromRoute || !selectedSymbol) return;
  const path = pathForSymbol(selectedSymbol);
  const coin = config?.coins?.find((c) => c.symbol === selectedSymbol);
  if (coin) document.title = `${coin.label} — Order Flow`;
  if (location.pathname === path) return;
  // Keep the address bar aligned with this tab's coin (no in-page coin hopping).
  const url = `${path}${location.search}${location.hash}`;
  history.replaceState({ symbol: selectedSymbol, mode: dataMode }, '', url);
}

function applyRouteFromLocation({ replace = false } = {}) {
  const route = parseCoinRoute();
  syncingFromRoute = true;
  try {
    if (route.mode === 'spot' || route.mode === 'perp') {
      applyDataMode(route.mode);
    }
    const coin = findCoinBySlug(route.slug);
    if (coin) {
      openTabs.length = 0;
      openTabs.push({ symbol: coin.symbol, label: coin.label });
      selectedSymbol = coin.symbol;
      liveLastPrice = 0;
      liveLastPriceAt = 0;
      renderOpenTabs();
      applySymbolFilter();
    }
  } finally {
    syncingFromRoute = false;
  }
  syncCoinRoute(true);
}

function setupCoinRouting() {
  // Browser back/forward: reload-style apply of the path coin in this tab.
  window.addEventListener('popstate', () => applyRouteFromLocation({ replace: true }));
}

function updateOverview(coins, market = 'perp') {
  if (market === 'spot' && !isSpotView()) return;
  if (market !== 'spot' && isSpotView()) return;
  for (const c of coins) {
    const el = $(`delta-${c.symbol}`);
    if (el) {
      el.textContent = fmtUsd(c.delta10s);
      el.className = `coin-delta ${c.delta10s > 0 ? 'pos' : c.delta10s < 0 ? 'neg' : ''}`;
    }
    const chip = document.querySelector(`.coin-chip[data-symbol="${c.symbol}"]`);
    if (chip) chip.classList.toggle('hot', c.state10s && c.state10s !== 'NO_SIGNAL');
    // Update open tab delta
    const tabEl = $(`tab-delta-${c.symbol}`);
    if (tabEl) {
      tabEl.textContent = fmtUsd(c.delta10s);
      tabEl.className = `open-tab-delta ${c.delta10s > 0 ? 'pos' : c.delta10s < 0 ? 'neg' : ''}`;
    }
  }
}

function windowData(summary, tf) {
  return summary?.windows?.[tf] ?? summary?.windows?.['10s'];
}

function tfShort(tf = chartTfMinutes) {
  if (tf >= 1440 && tf % 1440 === 0) return `${tf / 1440}D`;
  if (tf % 60 === 0) return `${tf / 60}h`;
  return `${tf}m`;
}

function updateUi() {
  if (isSpotView()) return;
  if (!lastSummary || lastSummary.symbol !== selectedSymbol) return;
  const w = windowData(lastSummary, selectedTf);
  renderPassiveStrength(lastSummary);
  renderMarketDecision(lastSummary);
  if (!w) return;

  const meta = STATE_META[w.state] ?? { title: w.state, help: '' };

  $('price').textContent = lastSummary.price > 0 ? `$${fmtPrice(lastSummary.price)}` : '—';
  const coin = config?.coins?.find((c) => c.symbol === lastSummary.symbol);
  const venue =
    coin?.venue === 'equity'
      ? 'Binance TradFi perp'
      : selectedExchange === 'all'
        ? 'multi-exchange'
        : selectedExchange;
  $('symbol-label').textContent = `${coin?.label ?? lastSummary.symbol} · ${venue} · tape ≥ ${fmtUsd(coin?.minUsd ?? 0)}`;
  $('state-badge').textContent = w.state.replace(/_/g, ' ');
  $('state-badge').className = `state-badge ${stateClass(w.state)}`;
  $('state-title').textContent = meta.title;
  $('state-help').textContent = meta.help;

  const ch = w.priceChangePercent;
  const chEl = $('price-change');
  chEl.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(3)}% in ${selectedTf}`;
  chEl.className = `price-change ${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}`;

  $('flow-window-label').textContent = TF_LABEL[selectedTf] ?? selectedTf;

  const deltaEl = $('delta');
  deltaEl.textContent = fmtUsd(w.delta);
  deltaEl.className = `value ${w.delta >= 0 ? 'pos' : 'neg'}`;

  const dp = (w.deltaPercent * 100).toFixed(0);
  $('delta-pct').textContent = w.delta >= 0 ? `${dp}% buy-side dominance` : `${Math.abs(dp)}% sell-side dominance`;

  $('score').textContent = w.largeFlowDirectionalScore;
  $('score').style.color = w.largeFlowDirectionalScore > 0 ? 'var(--buy)' : w.largeFlowDirectionalScore < 0 ? 'var(--sell)' : 'inherit';

  $('impact').textContent = w.priceImpactEfficiency;
  $('impact-help').textContent = IMPACT_HELP[w.priceImpactEfficiency] ?? '';

  $('confidence').textContent = `${Math.round(w.confidence * 100)}%`;

  const mult = w.delta >= 0 ? w.flowMultipleBuy : w.flowMultipleSell;
  $('flow-multiple').textContent =
    mult > 1 ? `${mult.toFixed(1)}× normal ${w.delta >= 0 ? 'buy' : 'sell'} flow` : 'Near normal volume';

  const total = w.aggressiveBuyVolume + w.aggressiveSellVolume || 1;
  $('buy-bar').style.width = `${(w.aggressiveBuyVolume / total) * 100}%`;
  $('sell-bar').style.width = `${(w.aggressiveSellVolume / total) * 100}%`;
  $('buy-vol').textContent = fmtUsd(w.aggressiveBuyVolume);
  $('sell-vol').textContent = fmtUsd(w.aggressiveSellVolume);

  const absBox = $('absorption-box');
  if (w.absorption.detected) {
    absBox.classList.remove('hidden');
    $('absorption-title').textContent = w.absorption.type?.replace(/_/g, ' ') ?? 'Absorption';
    $('absorption-text').textContent =
      w.absorption.type === 'BUYER_ABSORPTION'
        ? 'Heavy buying but price is not rising — sellers may be absorbing.'
        : 'Heavy selling but price is not falling — buyers may be absorbing.';
  } else {
    absBox.classList.add('hidden');
  }

  renderFlowBattle(w);
  renderCompare(lastSummary);
  renderLiquidityResponse();
}

function renderPassiveStrength(summary) {
  const el = document.getElementById('passive-strength');
  if (!el) return;
  const read =
    summary?.windows?.['1m']?.passiveStrength ??
    summary?.windows?.['10s']?.passiveStrength ??
    null;
  if (!read || read.dataStatus === 'NO_DATA' || !read.bids) {
    el.className = 'passive-strength';
    el.textContent = 'Passive —';
    el.title = 'Waiting for resting liquidity behavior';
    return;
  }
  const bid = Math.round(read.bids.strength);
  const ask = Math.round(read.asks.strength);
  const spread = Math.round(read.passiveStrengthSpread);
  const winner = read.passiveWinner === 'BIDS' ? 'BIDS'
    : read.passiveWinner === 'ASKS' ? 'ASKS'
      : 'BALANCED';
  const arrow = (trend) => (trend === 'RISING' || trend === 'STRENGTHENING' ? '↑' : trend === 'FALLING' || trend === 'WEAKENING' ? '↓' : '→');
  el.className = `passive-strength ${winner === 'BIDS' ? 'bids' : winner === 'ASKS' ? 'asks' : ''}`;
  el.textContent = winner === 'BALANCED'
    ? `Passive balanced · Ask ${ask}${arrow(read.asks.trend)} Bid ${bid}${arrow(read.bids.trend)}`
    : `Passive ${winner} ${spread >= 0 ? '+' : ''}${spread} · Ask ${ask}${arrow(read.asks.trend)} Bid ${bid}${arrow(read.bids.trend)}`;
  el.title = 'Ask vs bid defense — open Market Decision details for wall diagnostics';
}

let decisionPaintedAt = 0;
let decisionAdvanced = false;

function renderMarketDecision(summary) {
  const el = document.getElementById('decision-panel') || document.getElementById('wall-map');
  if (!el) return;
  const now = Date.now();
  if (now - decisionPaintedAt < 400 && el.dataset.ready === '1' && el.dataset.advanced === String(decisionAdvanced)) {
    return;
  }
  const w =
    summary?.windows?.['1m'] ??
    summary?.windows?.['10s'] ??
    summary?.windows?.[selectedTf] ??
    null;
  if (!w) {
    el.innerHTML = '<p class="decision-empty">Waiting for market read</p>';
    el.dataset.ready = '0';
    return;
  }
  decisionPaintedAt = now;
  el.dataset.ready = '1';
  el.dataset.advanced = String(decisionAdvanced);
  el.className = decisionAdvanced ? 'decision-panel advanced' : 'decision-panel';

  const td = w.tradeDecision;
  const battle = w.marketBattle;
  const passive = w.passiveStrength;
  const map = w.wallMap;
  const view = buildDecisionView(td, battle, passive, map, summary?.price, w?.locationContext);

  el.innerHTML = decisionAdvanced
    ? renderDecisionAdvanced(view, map)
    : renderDecisionDefault(view);

  el.querySelector('[data-decision-toggle]')?.addEventListener('click', () => {
    decisionAdvanced = !decisionAdvanced;
    el.dataset.ready = '0';
    renderMarketDecision(summary);
  });
}

function buildDecisionView(td, battle, passive, map, price, locationContext = null) {
  const metrics = td?.metrics ?? {};
  const askDef = Math.round(
    passive?.asks?.strength ??
    metrics.passiveSellerDefense ??
    battle?.upside?.passive?.defensePower ??
    0,
  );
  const bidDef = Math.round(
    passive?.bids?.strength ??
    metrics.passiveBuyerDefense ??
    battle?.downside?.passive?.defensePower ??
    0,
  );
  const askTrend = decisionTrendArrow(passive?.asks?.trend);
  const bidTrend = decisionTrendArrow(passive?.bids?.trend);
  const adv = bidDef - askDef;
  const advantage = Math.abs(adv) < 8 ? 'BALANCED'
    : adv > 0 ? `BIDS +${Math.abs(adv)}`
      : `ASKS +${Math.abs(adv)}`;

  const buyer = metrics.buyerControl;
  const seller = metrics.sellerControl;
  let controlSide = 'BALANCED';
  let controlScore = 50;
  if (buyer != null && seller != null) {
    if (buyer >= seller + 8) { controlSide = 'BUYERS'; controlScore = Math.round(buyer); }
    else if (seller >= buyer + 8) { controlSide = 'SELLERS'; controlScore = Math.round(seller); }
    else { controlSide = 'BALANCED'; controlScore = Math.round((buyer + seller) / 2); }
  } else if (battle?.summary?.state === 'BUYERS_IN_CONTROL') {
    controlSide = 'BUYERS';
    controlScore = Math.round(battle.upside?.aggressive?.power ?? 60);
  } else if (battle?.summary?.state === 'SELLERS_IN_CONTROL') {
    controlSide = 'SELLERS';
    controlScore = Math.round(battle.downside?.aggressive?.power ?? 60);
  }
  const controlTrend = controlSide === 'BUYERS' ? decisionTrendArrow(passive?.bids?.trend)
    : controlSide === 'SELLERS' ? decisionTrendArrow(passive?.asks?.trend)
      : '→';

  const current = pickCurrentBattle(battle, map, metrics, {
    askDef,
    bidDef,
  });
  const decision = mapDecision(td, current);
  // Only surface data quality when it actually blocks or is bad — not routine PARTIAL warm-up.
  const dataBad = metrics.dataQuality === 'NO_DATA' || metrics.dataQuality === 'STALE' || metrics.dataQuality === 'LOW_CONFIDENCE'
    ? metrics.dataQuality
    : battle?.dataHealth?.status === 'STALE_TRADES' || battle?.dataHealth?.status === 'NO_TRADES'
      ? battle.dataHealth.status
      : null;

  const loc = locationContext;
  const locationState = loc?.locationContext
    ? String(loc.locationContext).replaceAll('_', ' ')
    : 'UNKNOWN';

  return {
    price,
    controlSide,
    controlScore,
    controlTrend,
    askDef,
    bidDef,
    askTrend,
    bidTrend,
    advantage,
    current,
    decision,
    dataBad,
    relevantAsk: map?.strongestRelevantAsk ?? battle?.upside?.relevantWall ?? null,
    relevantBid: map?.strongestRelevantBid ?? battle?.downside?.relevantWall ?? null,
    strongestAsk: map?.strongestOverallAsk ?? map?.strongestAsk ?? null,
    strongestBid: map?.strongestOverallBid ?? map?.strongestBid ?? null,
    locationState,
    locationPrice: price ?? null,
    locationSupport: loc?.nearestSupport?.price != null ? fmtPx(loc.nearestSupport.price) : null,
    locationResistance: loc?.nearestResistance?.price != null ? fmtPx(loc.nearestResistance.price) : null,
    locationSupportBps: loc?.distanceToSupportBps ?? null,
    locationResistanceBps: loc?.distanceToResistanceBps ?? null,
  };
}

function pickCurrentBattle(battle, map, metrics = {}, defense = {}) {
  const up = battle?.upside;
  const down = battle?.downside;

  const buyAttack = Number(up?.aggressive?.power ?? up?.aggressive?.score ?? metrics.buyerControl ?? 0);
  const sellAttack = Number(down?.aggressive?.power ?? down?.aggressive?.score ?? metrics.sellerControl ?? 0);
  const askDefense = Number(
    up?.passive?.defensePower ?? up?.passive?.strength ?? metrics.passiveSellerDefense ?? defense.askDef ?? 0,
  );
  const bidDefense = Number(
    down?.passive?.defensePower ?? down?.passive?.strength ?? metrics.passiveBuyerDefense ?? defense.bidDef ?? 0,
  );

  const upScore = Number(up?.battleScore ?? 0);
  const downScore = Number(down?.battleScore ?? 0);
  // Prefer the live interaction: higher battle score, else stronger attack.
  const useUp = upScore === downScore ? buyAttack >= sellAttack : upScore > downScore;

  const wallBattle = map?.battle;
  if (wallBattle?.attackSide === 'BUY' && (wallBattle.currentlyAttackedAsk || wallBattle.attacked)) {
    const target = wallBattle.currentlyAttackedAsk || wallBattle.attacked;
    const attack = Math.round(wallBattle.attackPower ?? buyAttack);
    const def = Math.round(target.wallStrength ?? target.strength ?? askDefense);
    return packBattle('UP', 'Buy Attack', 'Ask Defense', attack, def, humanBattleState(wallBattle.verdict || up?.state, 'UP'), target.price, 'ASK');
  }
  if (wallBattle?.attackSide === 'SELL' && (wallBattle.currentlyAttackedBid || wallBattle.attacked)) {
    const target = wallBattle.currentlyAttackedBid || wallBattle.attacked;
    const attack = Math.round(wallBattle.attackPower ?? sellAttack);
    const def = Math.round(target.wallStrength ?? target.strength ?? bidDefense);
    return packBattle('DOWN', 'Sell Attack', 'Bid Defense', attack, def, humanBattleState(wallBattle.verdict || down?.state, 'DOWN'), target.price, 'BID');
  }

  if (useUp) {
    const state = humanBattleState(up?.state, 'UP');
    const wall = up?.relevantWall ?? map?.strongestRelevantAsk ?? null;
    // Even when engine says NO_MEANINGFUL, still show attack vs ask defense numbers.
    return packBattle('UP', 'Buy Attack', 'Ask Defense', Math.round(buyAttack), Math.round(askDefense), state, wall?.price ?? null, 'ASK');
  }

  const state = humanBattleState(down?.state, 'DOWN');
  const wall = down?.relevantWall ?? map?.strongestRelevantBid ?? null;
  return packBattle('DOWN', 'Sell Attack', 'Bid Defense', Math.round(sellAttack), Math.round(bidDefense), state, wall?.price ?? null, 'BID');
}

function packBattle(kind, attackLabel, defenseLabel, attack, defense, state, wallPrice, wallSide) {
  const quiet = attack < 12 && defense < 12;
  return {
    kind,
    attackLabel,
    defenseLabel,
    attack,
    defense,
    attackTrend: attack >= defense + 6 ? '↑' : attack + 6 <= defense ? '↓' : '→',
    defenseTrend: defense >= attack + 6 ? '↑' : defense + 6 <= attack ? '↓' : '→',
    state: quiet ? 'NO CLEAR BATTLE' : state,
    wallPrice,
    wallSide,
  };
}

function humanBattleState(state, kind) {
  const s = String(state || '');
  if (s === 'BUYERS_WINNING' || s === 'BUYERS_BREAKING_WALL') return 'BUYERS BREAKING ASKS';
  if (s === 'SELLERS_WINNING' || s === 'SELLERS_BREAKING_WALL') return 'SELLERS BREAKING BIDS';
  if (s === 'SELLERS_DEFENDING') return 'SELLERS DEFENDING';
  if (s === 'BUYERS_DEFENDING') return 'BUYERS DEFENDING';
  if (s === 'SELLER_ABSORPTION') return 'BUYER ABSORPTION';
  if (s === 'BUYER_ABSORPTION') return 'SELLER ABSORPTION';
  if (s === 'UPSIDE_VACUUM') return 'UPSIDE VACUUM';
  if (s === 'DOWNSIDE_VACUUM') return 'DOWNSIDE VACUUM';
  if (s === 'COMPRESSION') return 'COMPRESSION';
  if (s === 'BALANCED') return kind === 'UP' ? 'BUYERS TESTING ASKS' : 'SELLERS TESTING BIDS';
  if (s === 'NO_MEANINGFUL_BATTLE' || s === 'LOW_CONFIDENCE' || !s || s === 'NONE') {
    return kind === 'UP' ? 'BUYERS TESTING ASKS' : 'SELLERS TESTING BIDS';
  }
  return s.replaceAll('_', ' ');
}

function mapDecision(td, current) {
  const phase = td?.phase || 'NO_TRADE';
  const action = td?.action || 'WAIT';
  let label = 'WAIT';
  if (action === 'LONG' && phase === 'LONG_CONFIRMATION') label = 'LONG';
  else if (action === 'SHORT' && phase === 'SHORT_CONFIRMATION') label = 'SHORT';
  else if (phase === 'LONG_SETUP_FORMING') label = 'LONG FORMING';
  else if (phase === 'SHORT_SETUP_FORMING') label = 'SHORT FORMING';
  else if (action === 'LONG') label = 'LONG';
  else if (action === 'SHORT') label = 'SHORT';

  const confidence = Math.round(td?.confidence ?? 0);
  // Confirmed trades: show why. WAIT/FORMING: only blocker / need — never partial gate chatter.
  const reasons = (label === 'LONG' || label === 'SHORT')
    ? (td?.reasons ?? []).slice(0, 3).map(humanReason)
    : [];
  const blocker = label === 'WAIT' || label.includes('FORMING')
    ? primaryBlocker(td?.blockers ?? [], current)
    : '';
  const need = formingNeed(label, current, td);
  const tone = label === 'LONG FORMING' || label === 'SHORT FORMING' ? 'forming'
    : label.startsWith('LONG') ? 'long'
      : label.startsWith('SHORT') ? 'short'
        : 'wait';
  const headline = label === 'LONG' || label === 'SHORT'
    ? (reasons[0] || current.state)
    : (need ? `Need: ${need}` : (blocker || current.state));

  return { label, confidence, reasons, blocker, need, tone, headline };
}

const BLOCKER_PRIORITY = [
  'BUYER_ABSORBED',
  'SELLER_ABSORBED',
  'seller_defense_strong',
  'buyer_defense_strong',
  'fuel_balanced',
  'conflicting_long_short_conditions',
  'no_price_follow_through',
  'no_ask_side_weakening',
  'no_bid_side_weakening',
  'ask_replenishment_high',
  'bid_replenishment_high',
  'weak_buyer_control',
  'weak_seller_control',
  'weak_upside_fuel',
  'weak_downside_fuel',
  'ask_replenishment_unknown',
  'bid_replenishment_unknown',
  'insufficient_data',
];

function primaryBlocker(blockers, current) {
  if (!blockers.length) {
    if (current.state === 'BUYER ABSORPTION') return 'Buyers being absorbed';
    if (current.state === 'SELLER ABSORPTION') return 'Sellers being absorbed';
    if (current.state.includes('DEFENDING')) {
      return current.kind === 'UP' ? 'Ask defense holding' : 'Bid defense holding';
    }
    if (current.state === 'NO CLEAR BATTLE') return 'Battle still balanced';
    return '';
  }
  const ordered = [...blockers].sort((a, b) => {
    const ia = BLOCKER_PRIORITY.indexOf(a);
    const ib = BLOCKER_PRIORITY.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return humanBlocker(ordered[0]);
}

function humanBlocker(code) {
  const map = {
    BUYER_ABSORPTION: 'Buyers being absorbed',
    BUYER_ABSORBED: 'Buyers being absorbed',
    SELLER_ABSORPTION: 'Sellers being absorbed',
    SELLER_ABSORBED: 'Sellers being absorbed',
    seller_defense_strong: 'Ask defense holding',
    buyer_defense_strong: 'Bid defense holding',
    fuel_balanced: 'No fuel edge yet',
    conflicting_long_short_conditions: 'Long and short both active',
    no_price_follow_through: 'No price follow-through',
    no_ask_side_weakening: 'Ask defense still holding',
    no_bid_side_weakening: 'Bid defense still holding',
    ask_replenishment_high: 'Ask defense replenishing',
    bid_replenishment_high: 'Bid defense replenishing',
    weak_buyer_control: 'Buyer attack too weak',
    weak_seller_control: 'Seller attack too weak',
    weak_upside_fuel: 'Buyer attack too weak',
    weak_downside_fuel: 'Seller attack too weak',
    insufficient_data: 'Order-book data incomplete',
    ask_replenishment_unknown: 'Ask defense untested',
    bid_replenishment_unknown: 'Bid defense untested',
  };
  return map[code] || String(code || '').replaceAll('_', ' ');
}

function humanReason(code) {
  const map = {
    buyers_in_control: 'Buyers in control',
    sellers_in_control: 'Sellers in control',
    upside_fuel_strong: 'Buy attack rising',
    upside_fuel_dominant: 'Buy attack rising',
    downside_fuel_strong: 'Sell attack rising',
    downside_fuel_dominant: 'Sell attack rising',
    fuel_directional_edge: 'Fuel edge confirmed',
    seller_defense_weak: 'Ask defense falling',
    buyer_defense_weak: 'Bid defense falling',
    ask_side_weakening: 'Ask defense weakening',
    bid_side_weakening: 'Bid defense weakening',
    asks_pulled: 'Asks pulled',
    asks_consumed: 'Asks consumed',
    bids_pulled: 'Bids pulled',
    bids_consumed: 'Bids consumed',
    ask_replenishment_low: 'Ask refill weak',
    bid_replenishment_low: 'Bid refill weak',
    no_buyer_absorption: 'No buyer absorption',
    no_seller_absorption: 'No seller absorption',
    price_followed_up: 'Price following',
    price_following_up: 'Price following',
    price_followed_down: 'Price following',
    price_following_down: 'Price following',
    ask_survival_low: 'Ask survival weak',
    bid_survival_low: 'Bid survival weak',
  };
  return map[code] || String(code || '').replaceAll('_', ' ');
}

function formingNeed(label, current, td) {
  if (label === 'LONG FORMING') {
    if (!td?.metrics?.priceFollowedUp) return 'price follow-through';
    if ((td?.metrics?.passiveSellerDefense ?? 100) > 45) return 'ask defense to weaken';
    return 'confirmation';
  }
  if (label === 'SHORT FORMING') {
    if (!td?.metrics?.priceFollowedDown) return 'price follow-through';
    if ((td?.metrics?.passiveBuyerDefense ?? 100) > 45) return 'bid defense to weaken';
    return 'confirmation';
  }
  if (label === 'WAIT' && current.state.includes('TESTING')) return 'one side to break defense';
  return '';
}

function decisionTrendArrow(trend) {
  if (trend === 'RISING' || trend === 'STRENGTHENING') return '↑';
  if (trend === 'FALLING' || trend === 'WEAKENING') return '↓';
  return '→';
}

function fmtPx(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toFixed(5);
}

function strengthBar(value) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return `<span class="decision-bar"><span style="width:${v}%"></span></span>`;
}

function askDefenseTip(view) {
  const a = view.relevantAsk;
  if (!a) return 'Ask defense summary';
  return `Relevant ask ${fmtPx(a.price)} · strength ${Math.round(a.strength)}`;
}

function bidDefenseTip(view) {
  const b = view.relevantBid;
  if (!b) return 'Bid defense summary';
  return `Relevant bid ${fmtPx(b.price)} · strength ${Math.round(b.strength)}`;
}

function renderDecisionDefault(view) {
  const d = view.decision;
  const c = view.current;
  const wallLine = c.wallPrice != null
    ? `<div class="decision-wall">${c.wallSide} ${fmtPx(c.wallPrice)}</div>`
    : '';
  const dataLine = view.dataBad
    ? `<div class="decision-data-warn">DATA QUALITY ${String(view.dataBad).replaceAll('_', ' ')}</div>`
    : '';
  const confLine = (d.label === 'LONG' || d.label === 'SHORT' || d.label.includes('FORMING'))
    ? `<div class="decision-conf">Confidence ${d.confidence}%</div>`
    : '';
  // WAIT / FORMING: one blocker or need. LONG / SHORT: up to 3 reasons. Never both.
  let detailLine = '';
  if (d.label === 'LONG' || d.label === 'SHORT') {
    if (d.reasons.length) detailLine = `<div class="decision-why">${d.reasons.map(escapeHtml).join(' · ')}</div>`;
    else if (d.headline) detailLine = `<div class="decision-why">${escapeHtml(d.headline)}</div>`;
  } else if (d.label.includes('FORMING') && d.need) {
    detailLine = `<div class="decision-blocker">Need: ${escapeHtml(d.need)}</div>`;
  } else if (d.blocker) {
    detailLine = `<div class="decision-blocker">${escapeHtml(d.blocker)}</div>`;
  }

  return `
    <section class="decision-card decision-card-main ${d.tone}">
      <div class="decision-kicker">TRADE DECISION</div>
      <div class="decision-action">${escapeHtml(d.label)}</div>
      ${confLine}
      ${detailLine}
      ${dataLine}
    </section>

    <section class="decision-card decision-card-compact">
      <div class="decision-kicker">MARKET LOCATION</div>
      <div class="decision-location-state">${escapeHtml(view.locationState || 'UNKNOWN')}</div>
      <div class="decision-location-grid">
        <div><span>Price</span><strong>${fmtPx(view.locationPrice)}</strong></div>
        <div><span>Support</span><strong>${view.locationSupport ?? '—'}${view.locationSupportBps != null ? ` · ${Math.round(view.locationSupportBps)} bps` : ''}</strong></div>
        <div><span>Resistance</span><strong>${view.locationResistance ?? '—'}${view.locationResistanceBps != null ? ` · ${Math.round(view.locationResistanceBps)} bps` : ''}</strong></div>
      </div>
    </section>

    <section class="decision-card">
      <div class="decision-kicker">CURRENT BATTLE</div>
      <div class="decision-battle-row">
        <span>${escapeHtml(c.attackLabel)}</span>
        <strong>${c.attack} ${c.attackTrend}</strong>
      </div>
      ${strengthBar(c.attack)}
      <div class="decision-battle-row">
        <span>${escapeHtml(c.defenseLabel)}</span>
        <strong>${c.defense} ${c.defenseTrend}</strong>
      </div>
      ${strengthBar(c.defense)}
      <div class="decision-state">${escapeHtml(c.state)}</div>
      ${wallLine}
    </section>

    <section class="decision-card decision-card-compact decision-hide-narrow">
      <div class="decision-kicker">MARKET CONTROL</div>
      <div class="decision-control ${view.controlSide.toLowerCase()}">
        <strong>${escapeHtml(view.controlSide)}</strong>
        <span>${view.controlScore} ${view.controlTrend}</span>
      </div>
    </section>

    <section class="decision-card decision-hide-narrow">
      <div class="decision-kicker">PASSIVE DEFENSE</div>
      <div class="decision-battle-row" title="${escapeHtml(askDefenseTip(view))}">
        <span>Asks</span><strong>${view.askDef} ${view.askTrend}</strong>
      </div>
      <div class="decision-battle-row" title="${escapeHtml(bidDefenseTip(view))}">
        <span>Bids</span><strong>${view.bidDef} ${view.bidTrend}</strong>
      </div>
      <div class="decision-advantage">Advantage ${escapeHtml(view.advantage)}</div>
      <div class="decision-relevant">
        Rel ask ${view.relevantAsk ? `${fmtPx(view.relevantAsk.price)} · ${Math.round(view.relevantAsk.strength)}` : '—'}
        · Rel bid ${view.relevantBid ? `${fmtPx(view.relevantBid.price)} · ${Math.round(view.relevantBid.strength)}` : '—'}
      </div>
    </section>

    <button type="button" class="decision-toggle" data-decision-toggle>View liquidity details</button>
  `;
}

function renderDecisionAdvanced(view, map) {
  const px = fmtPx;
  const usd = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  };
  const metricLabel = (metric) => {
    if (!metric || metric.value == null || !Number.isFinite(metric.value)) {
      return String(metric?.state || 'UNTESTED').replaceAll('_', ' ');
    }
    return String(Math.round(metric.value));
  };
  const row = (level) => {
    if (!level) return '';
    const tip = [
      `${level.side} ${px(level.price)}`,
      `Strength ${Math.round(level.strength)}`,
      level.strengthConfidence != null ? `Confidence ${Math.round(level.strengthConfidence)}%` : '',
      `Refill ${metricLabel(level.replenishmentScore)}`,
      `Cancellation ${metricLabel(level.cancellationScore)}`,
      `Consumption ${metricLabel(level.consumptionScore)}`,
      `Survival ${metricLabel(level.survivalScore ?? level.survival)}`,
      `Persistence ${metricLabel(level.persistenceScore)}`,
      `Reliability ${metricLabel(level.reliabilityScore)}`,
      level.wallMaturity ? `Maturity ${level.wallMaturity}` : '',
      `Distance ${Number(level.distanceBps).toFixed(1)} bps`,
      `Depth ${usd(level.currentSize)}`,
    ].filter(Boolean).join('\n');
    return `<div class="wall-row" title="${escapeHtml(tip)}">
      <span class="px">${px(level.price)} ${decisionTrendArrow(level.trend)}</span>
      <span class="wall-bar"><span style="width:${Math.max(0, Math.min(100, level.strength))}%"></span></span>
      <span class="score">${Math.round(level.strength)}</span>
      <span class="wall-state">${String(level.state || '').replaceAll('_', ' ')} · ${Number(level.distanceBps).toFixed(1)} bps</span>
    </div>`;
  };
  const pick = (label, level) => `<div>${label}<strong>${level ? `${px(level.price)} · ${Math.round(level.strength)}` : '—'}</strong></div>`;
  const base = renderDecisionDefault(view).replace('View liquidity details', 'Hide liquidity details');

  return `
    ${base}
    <section class="decision-card decision-details">
      <div class="decision-kicker">LIQUIDITY DETAILS</div>
      <div class="wall-summary">
        ${pick('Relevant ask', view.relevantAsk)}
        ${pick('Relevant bid', view.relevantBid)}
        ${pick('Strongest ask', view.strongestAsk)}
        ${pick('Strongest bid', view.strongestBid)}
      </div>
      <div class="wall-side-label">ASKS</div>
      ${(map?.asks || []).map(row).join('') || '<p class="decision-empty">No significant asks</p>'}
      <div class="wall-mid">Price ${px(map?.currentPrice ?? view.price)}</div>
      ${(map?.bids || []).map(row).join('') || '<p class="decision-empty">No significant bids</p>'}
      <div class="wall-side-label">BIDS</div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function battleLabel(s) {
  return (s ?? '—').replace(/_/g, ' ');
}

function renderFlowBattle(w) {
  const b = w?.flowBattle;
  if (!b) {
    if ($('battle-winner')) $('battle-winner').textContent = '—';
    return;
  }
  const set = (id, v) => { if ($(id)) $(id).textContent = v; };
  set('battle-agg-buy', Math.round(b.battle?.aggressiveBuyerStrength ?? 0));
  set('battle-pas-sell', Math.round(b.battle?.passiveSellerStrength ?? 0));
  set('battle-agg-sell', Math.round(b.battle?.aggressiveSellerStrength ?? 0));
  set('battle-pas-buy', Math.round(b.battle?.passiveBuyerStrength ?? 0));
  set('battle-winner', `Winner: ${battleLabel(b.winner?.winner)}`);
  set('battle-state', battleLabel(b.state));
  const conf = Math.round((b.winner?.confidence ?? 0) * 100);
  set('battle-conf', `Confidence ${conf}% · not a probability`);
  const ev = (b.winner?.evidence ?? []).slice(0, 3).join(' · ');
  if ($('battle-evidence')) $('battle-evidence').textContent = ev;
}

function renderCompare(summary) {
  const impulse = summary.windows['10s'];
  const sustained = summary.windows['5m'];
  if (!impulse || !sustained) return;

  const rows = [
    { label: '10s impulse', w: impulse, desc: 'Right now' },
    { label: '5m sustained', w: sustained, desc: 'Still going?' },
  ];

  $('compare-row').innerHTML = rows
    .map(({ label, w, desc }) => {
      const meta = STATE_META[w.state]?.title ?? w.state;
      return `
      <div class="compare-card">
        <div class="compare-label">${label} <span class="muted">${desc}</span></div>
        <div class="compare-state ${stateClass(w.state)}">${meta}</div>
        <div class="compare-delta" style="color:${w.delta >= 0 ? 'var(--buy)' : 'var(--sell)'}">${fmtUsd(w.delta)} net</div>
        <div class="compare-sub">${(w.deltaPercent * 100).toFixed(0)}% side dominance · ${w.priceImpactEfficiency} impact</div>
      </div>`;
    })
    .join('');
}

function isCompareMode() {
  return dataMode === 'compare';
}

function lrLabel(value) {
  return String(value ?? '—').replace(/_/g, ' ');
}

function currentLiquidityResponse() {
  const tfKey = String(chartTfMinutes);
  if (isSpotView()) {
    const base = lastSpotFlow?.liquidityResponse;
    if (!base) return null;
    const tf = base.byTf?.[tfKey] ?? base.byTf?.[chartTfMinutes];
    return tf ? { ...base, ...tf } : base;
  }
  const w = lastSummary?.windows?.['1m'] ?? lastSummary?.windows?.[selectedTf] ?? lastSummary?.windows?.['10s'];
  const base = w?.liquidityResponse;
  if (!base) return null;
  const tf = base.byTf?.[tfKey] ?? base.byTf?.[chartTfMinutes];
  return tf && chartTfMinutes >= 1 ? { ...base, ...tf } : base;
}

function lrTone(state) {
  if (!state) return '';
  if (state.includes('ABSORB') || state.includes('DEFEND')) return 'abs';
  if (state.includes('VACUUM')) return 'vac';
  if (state.includes('BUY')) return 'buy';
  if (state.includes('SELL')) return 'sell';
  return '';
}

function lrMetric(label, value, cls = '') {
  return `<div class="lr-metric"><span class="k">${label}</span><span class="v ${cls}">${value}</span></div>`;
}

function lrTip(text, title) {
  if (!title) return text;
  return `<span class="lr-tip" title="${String(title).replace(/"/g, '&quot;')}">${text}</span>`;
}

function depthChangeLabel(depth) {
  if (!depth || depth.changePercent == null) {
    return depth?.changeReason ? `UNKNOWN · ${String(depth.changeReason).replace(/_/g, ' ')}` : 'UNKNOWN';
  }
  const n = depth.changePercent;
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;
}

function renderLiquidityResponse() {
  const el = $('lr-metrics');
  if (!el) return;
  const lr = currentLiquidityResponse();
  const stateEl = $('lr-state');
  const confEl = $('lr-conf');
  const whyEl = $('lr-why');
  const revEl = $('lr-reversal');
  const primaryEl = $('lr-primary');
  if (!lr) {
    if (stateEl) {
      stateEl.textContent = 'BALANCED';
      stateEl.className = 'lr-state';
    }
    if (confEl) {
      confEl.textContent = 'LOW';
      confEl.className = 'lr-conf';
    }
    if (primaryEl) primaryEl.innerHTML = '';
    el.innerHTML = lrMetric('Aggression', '—') + lrMetric('Executed', '—') + lrMetric('Delta', '—');
    if (whyEl) whyEl.classList.add('hidden');
    if (revEl) revEl.classList.add('hidden');
    return;
  }
  const score = Number.isFinite(lr.confidenceScore) ? Math.round(lr.confidenceScore) : (lr.confidence === 'HIGH' ? 80 : lr.confidence === 'MEDIUM' ? 55 : 22);
  const confLabel = lr.confidence ?? (score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW');
  const mechanics = lr.marketMechanics ?? lr.state ?? 'BALANCED';
  if (stateEl) {
    stateEl.textContent = lrLabel(mechanics);
    stateEl.className = `lr-state ${lrTone(mechanics)}`;
  }
  if (confEl) {
    confEl.textContent = `${confLabel} · ${score} / 100`;
    confEl.className = `lr-conf ${String(confLabel).toLowerCase()}`;
  }
  const cross = isCompareMode() && lr.compare
    ? lrLabel(lr.compare.note || lr.compare.relation)
    : 'N/A';
  if (primaryEl) {
    primaryEl.innerHTML = [
      lrMetric('State', lrLabel(lr.state), lrTone(lr.state)),
      lrMetric('Confidence', `${score} / 100`, String(confLabel).toLowerCase()),
      lrMetric('Data quality', `${Math.round(lr.dataQuality ?? 0)} / 100`),
      lrMetric('Data consistency', `${Math.round(lr.dataConsistency ?? lr.consistency?.score ?? 0)} / 100`),
      lrMetric('Effort vs result', lrLabel(lr.effort)),
      lrMetric('Cross-market', cross),
      lrMetric('Entry context', lrLabel(lr.entryContext ?? 'NO_ENTRY')),
    ].join('');
  }
  const px = lr.priceMovePercent ?? 0;
  const buyPct = lr.norms?.aggressiveBuy?.percentile;
  const sellPct = lr.norms?.aggressiveSell?.percentile;
  const movePct = lr.norms?.priceDisplacement?.percentile;
  const ask = lr.askDepth;
  const bid = lr.bidDepth;
  const da = lr.deltaAnalysis;
  el.innerHTML = `
    <div class="lr-section">
      <h3>Aggression</h3>
      ${lrMetric('Aggressive buy', buyPct == null ? '—' : lrTip(`${Math.round(buyPct)}th · ${lrLabel(percentileBandUi(buyPct))}`, percentileTip(buyPct)))}
      ${lrMetric('Aggressive sell', sellPct == null ? '—' : lrTip(`${Math.round(sellPct)}th · ${lrLabel(percentileBandUi(sellPct))}`, percentileTip(sellPct)))}
      ${lrMetric('Delta', `${fmtUsd(lr.delta ?? 0)}${da?.direction ? ` · ${da.direction}` : ''}`, (lr.delta ?? 0) >= 0 ? 'pos' : 'neg')}
    </div>
    <div class="lr-section">
      <h3>Ask response</h3>
      ${lrMetric('Current depth', fmtUsd(ask?.current ?? 0))}
      ${lrMetric('Depth percentile', ask?.currentPercentile == null ? '—' : lrTip(`${Math.round(ask.currentPercentile)}th`, percentileTip(ask.currentPercentile)))}
      ${lrMetric('Depth change', lrTip(depthChangeLabel(ask), askChangeTip(ask)))}
      ${lrMetric('Consumed', fmtUsd(ask?.consumed ?? 0))}
      ${lrMetric('Cancelled', fmtUsd(ask?.cancelled ?? 0))}
      ${lrMetric('Replenished', fmtUsd(ask?.replenished ?? 0))}
      ${lrMetric('State', lrLabel(ask?.changeState ?? lr.askResponse ?? '—'))}
    </div>
    <div class="lr-section">
      <h3>Bid response</h3>
      ${lrMetric('Current depth', fmtUsd(bid?.current ?? 0))}
      ${lrMetric('Depth percentile', bid?.currentPercentile == null ? '—' : lrTip(`${Math.round(bid.currentPercentile)}th`, percentileTip(bid.currentPercentile)))}
      ${lrMetric('Depth change', lrTip(depthChangeLabel(bid), askChangeTip(bid)))}
      ${lrMetric('Consumed', fmtUsd(bid?.consumed ?? 0))}
      ${lrMetric('Cancelled', fmtUsd(bid?.cancelled ?? 0))}
      ${lrMetric('Replenished', fmtUsd(bid?.replenished ?? 0))}
      ${lrMetric('State', lrLabel(bid?.changeState ?? lr.bidResponse ?? '—'))}
    </div>
    <div class="lr-section">
      <h3>Price response</h3>
      ${lrMetric('Move', `${px >= 0 ? '+' : ''}${px.toFixed(2)}%`, px > 0 ? 'pos' : px < 0 ? 'neg' : '')}
      ${lrMetric('Displacement', movePct == null ? '—' : lrTip(`${Math.round(movePct)}th percentile`, percentileTip(movePct)))}
      ${lrMetric('Efficiency', lr.efficiency ?? '—')}
    </div>`;
  if (whyEl) {
    const facts = [...(lr.why ?? [])];
    if (isCompareMode() && lr.compare) {
      facts.push({
        label: 'Spot/Futures confirmation',
        value: lr.compare.confirmed ? 'YES' : lr.compare.relation.replace(/_/g, ' '),
      });
    }
    whyEl.classList.toggle('hidden', !facts.length);
    whyEl.innerHTML = facts.length
      ? `<strong>WHY?</strong><ul>${facts.map((f) => `<li>${lrTip(`${f.label}: ${f.value}`, f.tooltip || f.detail || '')}</li>`).join('')}</ul>`
      : '';
  }
  if (revEl) {
    const rev = lr.reversal;
    if (rev?.detected) {
      revEl.classList.remove('hidden');
      revEl.textContent = `POTENTIAL REVERSAL CONDITIONS DETECTED · ${(rev.kind ?? '').toLowerCase()} · ${(rev.reasons ?? []).join(' · ')}`;
    } else {
      revEl.classList.add('hidden');
      revEl.textContent = '';
    }
  }
}

function percentileBandUi(p) {
  if (p < 20) return 'VERY_LOW';
  if (p < 40) return 'LOW';
  if (p < 60) return 'NORMAL';
  if (p < 80) return 'ELEVATED';
  if (p < 95) return 'HIGH';
  return 'EXTREME';
}

function percentileTip(p) {
  const n = Math.round(Number(p) || 0);
  return `This value is higher than ${n}% and lower than ${100 - n}% of comparable historical observations.`;
}

function askChangeTip(depth) {
  if (!depth) return '';
  if (depth.changePercent == null) {
    return 'Displayed band depth change is unknown because the previous snapshot was missing, reset, or unsynchronized.';
  }
  const dir = depth.changePercent >= 0 ? 'increased' : 'decreased';
  return `Displayed ask/bid liquidity inside the configured price band ${dir} ${Math.abs(depth.changePercent).toFixed(0)}% relative to the previous valid snapshot.`;
}

function updateSummary(s) {
  const market = s.market === 'spot' ? 'spot' : 'perp';
  summariesByMarket[market][s.symbol] = s;
  if (market === 'perp') {
    summaries[s.symbol] = s;
    // Never paint Market Battle for a different coin (stops BTC flash on /sol).
    if (s.symbol === selectedSymbol && !isSpotView()) {
      lastSummary = s;
      updateUi();
    }
  }
}

function setStatus(connected, message) {
  const el = $('status');
  el.textContent = connected ? (message || 'Live') : message;
  // Match Connecting / Reconnecting / Connection error (case-insensitive).
  const connecting = !connected && /connect/i.test(message || '');
  el.className = `status ${connected ? 'live' : connecting ? 'connecting' : 'offline'}`;
}

function refreshStatus() {
  if (fpLiveSocket?.readyState !== WebSocket.OPEN) {
    setStatus(false, 'Reconnecting…');
    return;
  }
  const s = feedStatus[footprintMarket()] ?? feedStatus.perp;
  setStatus(s.connected, s.message || (s.connected ? 'Live' : 'Connecting…'));
}

function setupDataMode() {
  $('data-mode-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    applyDataMode(btn.dataset.mode);
    syncCoinRoute();
  });
  $('imb-ratio')?.addEventListener('change', () => {
    const n = Number($('imb-ratio').value);
    if (Number.isFinite(n) && n >= 1.2) imbalanceRatio = n;
    scheduleDraw();
  });
}

function applyDataMode(mode) {
  if (mode !== 'perp' && mode !== 'spot') return;
  dataMode = mode;
  document.querySelectorAll('#data-mode-tabs [data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const spot = isSpotView();
  $('chart-title').textContent = mode === 'perp' ? 'Order flow footprint' : 'Spot order flow footprint';
  $('chart-hint').textContent =
    'Cells = aggressive fills. Ladder: resting book · solid = consumed (filled) · hatched pink = pulled. Absorption = consumed but price stalled.';
  $('imb-cfg').classList.toggle('hidden', !spot);
  refreshStatus();
  const coins = visibleCoins();
  if (coins.length && !coins.some((coin) => coin.symbol === selectedSymbol)) selectedSymbol = coins[0].symbol;
  initChart();
  seedFootprintKlines();
  subscribeFootprint();
  scheduleDraw();
}

function spotWindow(snap, tfMinutes = chartTfMinutes) {
  return snap?.windows?.[String(tfMinutes)] ?? snap?.windows?.['1'] ?? snap?.windows?.[1] ?? null;
}

function flowTitle(flow) {
  if (!flow) return 'SPOT';
  if (flow.includes('BUYING')) return 'SPOT BUYERS';
  if (flow.includes('SELLING')) return 'SPOT SELLERS';
  return 'SPOT BALANCED';
}

function updateSpotUi() {
  const snap = lastSpotFlow;
  if (!snap || snap.symbol !== selectedSymbol) {
    renderSpotHud(null);
    renderSpotCompare();
    renderLiquidityResponse();
    return;
  }
  const w = spotWindow(snap) ?? snap.aggregated;
  const coin = config?.coins?.find((c) => c.symbol === snap.symbol);
  const venue = selectedExchange === 'all' ? 'multi-exchange spot' : `${selectedExchange} spot`;
  $('symbol-label').textContent = `${coin?.label ?? snap.symbol} · ${venue}`;
  if (w && $('price')) {
    $('price').textContent = snap.price > 0 ? `$${fmtPrice(snap.price)}` : '—';
    const ch = w.efficiency?.priceChangePercent ?? 0;
    const chEl = $('price-change');
    chEl.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(3)}% in ${tfShort(chartTfMinutes)}`;
    chEl.className = `price-change ${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}`;
    $('state-badge').textContent = (w.flow ?? 'BALANCED').replace(/_/g, ' ');
    $('state-badge').className = `state-badge ${w.flow?.includes('BUY') ? 'buy-flow' : w.flow?.includes('SELL') ? 'sell-flow' : w.flags?.length ? 'absorption' : ''}`;
    $('state-title').textContent = flowTitle(w.flow);
    const flags = (w.flags ?? []).map((f) => f.replace(/_/g, ' ')).join(' · ');
    $('state-help').textContent = flags
      ? flags
      : 'Spot footprint measures executed aggressive buys and sells — not resting limit orders.';
    $('delta').textContent = fmtUsd(w.delta);
    $('delta').className = `value ${w.delta >= 0 ? 'pos' : 'neg'}`;
    $('delta-pct').textContent = `${w.deltaPercent >= 0 ? '+' : ''}${(w.deltaPercent * 100).toFixed(1)}% delta`;
    $('impact').textContent = w.efficiency?.rank ?? '—';
    $('impact-help').textContent = (w.efficiency?.effortVsResult ?? '').replace(/_/g, ' ');
    $('score').textContent = w.cvdDirection === 'UP' ? 'CVD ↑' : w.cvdDirection === 'DOWN' ? 'CVD ↓' : 'CVD →';
    $('score').style.color = w.cvdDirection === 'UP' ? 'var(--buy)' : w.cvdDirection === 'DOWN' ? 'var(--sell)' : 'inherit';
    $('confidence').textContent = w.absorption?.detected ? `${Math.round(w.absorption.confidence * 100)}%` : '—';
    $('flow-multiple').textContent = w.absorption?.type ? w.absorption.type.replace(/_/g, ' ') : 'No absorption';
    const total = (w.aggressiveBuyVolume ?? 0) + (w.aggressiveSellVolume ?? 0) || 1;
    $('buy-bar').style.width = `${((w.aggressiveBuyVolume ?? 0) / total) * 100}%`;
    $('sell-bar').style.width = `${((w.aggressiveSellVolume ?? 0) / total) * 100}%`;
    $('buy-vol').textContent = fmtUsd(w.aggressiveBuyVolume ?? 0);
    $('sell-vol').textContent = fmtUsd(w.aggressiveSellVolume ?? 0);
    const absBox = $('absorption-box');
    if (w.absorption?.detected) {
      absBox.classList.remove('hidden');
      $('absorption-title').textContent = w.absorption.type.replace(/_/g, ' ');
      $('absorption-text').textContent = w.absorption.type === 'PASSIVE_SELL_ABSORPTION'
        ? 'Aggressive spot buying is not lifting price — passive sellers appear to be absorbing. Not a trade signal.'
        : 'Aggressive spot selling is not dropping price — passive buyers appear to be absorbing. Not a trade signal.';
    } else {
      absBox.classList.add('hidden');
    }
  }
  renderSpotHud(snap);
  renderSpotCompare();
  renderLiquidityResponse();
}

function renderSpotHud(snap) {
  const el = $('spot-hud');
  if (!el) return;
  if (!snap) {
    el.innerHTML = '';
    return;
  }
  const w = spotWindow(snap) ?? snap.aggregated;
  const title = flowTitle(w.flow);
  const cls = title.includes('BUY') ? 'buy' : title.includes('SELL') ? 'sell' : 'neutral';
  const cvd = w.cvdDirection === 'UP' ? '↑' : w.cvdDirection === 'DOWN' ? '↓' : '→';
  const venueBits = SPOT_EXCHANGES.map((id) => {
    const v = snap.exchanges?.[id];
    if (!v) return `${id}: —`;
    return `${id[0].toUpperCase()}${id.slice(1)} ${fmtUsd(v.delta)}`;
  });
  el.innerHTML = `
    <div class="spot-hud-title ${cls}">${title}</div>
    <div class="spot-hud-metric"><span class="label">Agg Buy</span><span class="value pos">${fmtUsd(w.aggressiveBuyVolume)}</span></div>
    <div class="spot-hud-metric"><span class="label">Agg Sell</span><span class="value neg">${fmtUsd(w.aggressiveSellVolume)}</span></div>
    <div class="spot-hud-metric"><span class="label">Delta</span><span class="value ${w.delta >= 0 ? 'pos' : 'neg'}">${fmtUsd(w.delta)}</span></div>
    <div class="spot-hud-metric"><span class="label">Delta %</span><span class="value ${w.delta >= 0 ? 'pos' : 'neg'}">${w.deltaPercent >= 0 ? '+' : ''}${(w.deltaPercent * 100).toFixed(1)}%</span></div>
    <div class="spot-hud-metric"><span class="label">CVD</span><span class="value">${cvd}</span></div>
    <div class="spot-hud-metric"><span class="label">Efficiency</span><span class="value">${w.efficiency?.rank ?? '—'}</span></div>
    <div class="spot-hud-ex">${venueBits.join(' · ')} · Agg ${fmtUsd(snap.aggregated?.delta ?? w.delta)}</div>`;
}

function sfRow(k, v, cls = '') {
  return `<div class="sf-row"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`;
}

function renderSpotCompare() {
  const panel = $('spot-compare-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  const snap = lastSpotFlow;
  const w = snap ? spotWindow(snap) : null;
  const cmp = snap?.comparison;
  const fut = summaries[selectedSymbol]?.windows?.['1m'] ?? summaries[selectedSymbol]?.windows?.['5m'];
  const futLr = fut?.liquidityResponse;
  const cmpLr = snap?.liquidityResponse?.compare;
  const priceCh = w?.efficiency?.priceChangePercent ?? 0;
  $('sf-price').textContent = snap?.price ? `${priceCh >= 0 ? '+' : ''}${priceCh.toFixed(2)}%` : '—';
  const interp = lrLabel(cmpLr?.note || cmpLr?.relation || cmp?.interpretation || 'UNRESOLVED');
  const interpEl = $('sf-interpretation');
  interpEl.textContent = interp;
  interpEl.className = `sf-interpretation ${
    interp.includes('DIVERGENCE') || interp.includes('COVERING') || interp.includes('LIQUIDATION') || interp.includes('INEFFICIENT') ? 'warn'
      : interp.includes('SELL') ? 'sell'
      : interp.includes('BUY') ? 'buy' : ''
  }`;

  const spotLeg = cmpLr?.spot;
  const futLeg = cmpLr?.futures;
  const spotLr = snap?.liquidityResponse;
  $('sf-spot').innerHTML = `<h3>Spot</h3>
    ${sfRow('State', lrLabel(spotLeg?.state ?? spotLr?.state ?? w?.flow ?? '—'))}
    ${sfRow('Agg Buy', fmtUsd(w?.aggressiveBuyVolume ?? 0), 'pos')}
    ${sfRow('Agg Sell', fmtUsd(w?.aggressiveSellVolume ?? 0), 'neg')}
    ${sfRow('Delta', fmtUsd(spotLeg?.delta ?? w?.delta ?? 0), (spotLeg?.delta ?? w?.delta ?? 0) >= 0 ? 'pos' : 'neg')}
    ${sfRow('CVD', (spotLeg?.cvdDirection ?? w?.cvdDirection) === 'UP' ? '↑' : (spotLeg?.cvdDirection ?? w?.cvdDirection) === 'DOWN' ? '↓' : '→')}
    ${sfRow('Efficiency', spotLeg?.efficiency ?? w?.efficiency?.rank ?? '—')}
    ${sfRow('Liquidity', lrLabel(spotLeg?.bookResponse ?? spotLr?.askResponse ?? '—'))}`;

  const oi = futLeg?.oiChangePercent ?? futLr?.oiChangePercent;
  const shortLiq = futLeg?.shortLiquidationUsd ?? fut?.forcedBuyVolume ?? 0;
  const longLiq = futLeg?.longLiquidationUsd ?? fut?.forcedSellVolume ?? 0;
  $('sf-futures').innerHTML = `<h3>Futures</h3>
    ${sfRow('State', lrLabel(futLeg?.state ?? futLr?.state ?? '—'))}
    ${sfRow('Agg Buy', fmtUsd(fut?.aggressiveBuyVolume ?? 0), 'pos')}
    ${sfRow('Agg Sell', fmtUsd(fut?.aggressiveSellVolume ?? 0), 'neg')}
    ${sfRow('Delta', fmtUsd(futLeg?.delta ?? fut?.delta ?? 0), (futLeg?.delta ?? fut?.delta ?? 0) >= 0 ? 'pos' : 'neg')}
    ${sfRow('OI', oi == null ? '—' : `${oi >= 0 ? '+' : ''}${oi.toFixed(2)}%`)}
    ${sfRow('OI context', lrLabel(futLeg?.oiInterpretation ?? futLr?.oiInterpretation ?? '—'))}
    ${sfRow('Short liq', fmtUsd(shortLiq))}
    ${sfRow('Long liq', fmtUsd(longLiq))}
    ${sfRow('Efficiency', futLeg?.efficiency ?? futLr?.efficiency ?? '—')}`;

  const combinedEl = $('sf-combined');
  if (combinedEl) {
    const conf = cmpLr?.confidenceScore ?? 0;
    combinedEl.innerHTML = `<h3>Combined</h3>
      ${sfRow('Cross-market', interp)}
      ${sfRow('Confidence', `${Math.round(conf)} / 100`)}
      ${sfRow('Confirmed', cmpLr?.confirmed ? 'YES' : 'NO')}
      ${sfRow('Entry', lrLabel(spotLr?.entryContext ?? 'NO_ENTRY'))}`;
  }

  const bits = SPOT_EXCHANGES.map((id) => {
    const v = snap?.exchanges?.[id];
    return v ? `${id}: ${fmtUsd(v.delta)}` : null;
  }).filter(Boolean);
  $('sf-exchanges').textContent = bits.length ? `Venue delta · ${bits.join(' · ')}` : '';

  const sfLiq = $('sf-liquidity');
  if (sfLiq) {
    if (!cmpLr) {
      sfLiq.textContent = 'Cross-market confirmation: waiting for independent spot and futures books…';
    } else {
      sfLiq.innerHTML = `<strong>${interp}</strong>
        · Spot ${lrLabel(cmpLr.spot.aggression)} · ${lrLabel(cmpLr.spot.bookResponse)} · ${cmpLr.spot.efficiency} efficiency
        · Futures ${lrLabel(cmpLr.futures.aggression)} · ${lrLabel(cmpLr.futures.bookResponse)} · ${cmpLr.futures.efficiency} efficiency
        ${cmpLr.futures.oiChangePercent == null ? '' : ` · OI ${cmpLr.futures.oiChangePercent >= 0 ? '+' : ''}${cmpLr.futures.oiChangePercent.toFixed(2)}%`}
        ${cmpLr.inefficient ? ' · inefficient' : ''}`;
    }
  }
}

function ingestSpotFlow(snapshot) {
  if (!snapshot?.symbol) return;
  spotFlowBySymbol[snapshot.symbol] = snapshot;
  const w = spotWindow(snapshot, 1) ?? snapshot.aggregated;
  if (isSpotView()) {
    const el = $(`delta-${snapshot.symbol}`);
    if (el && w) {
      el.textContent = fmtUsd(w.delta);
      el.className = `coin-delta ${w.delta > 0 ? 'pos' : w.delta < 0 ? 'neg' : ''}`;
    }
    const tabEl = $(`tab-delta-${snapshot.symbol}`);
    if (tabEl && w) {
      tabEl.textContent = fmtUsd(w.delta);
      tabEl.className = `open-tab-delta ${w.delta > 0 ? 'pos' : w.delta < 0 ? 'neg' : ''}`;
    }
  }
  if (snapshot.symbol === selectedSymbol) {
    lastSpotFlow = snapshot;
    if (isSpotView()) updateSpotUi();
  }
}

function setupTabs() {
  $('tf-tabs')?.addEventListener?.('click', (e) => {
    const btn = e.target.closest('.tf-tab');
    if (!btn) return;
    selectedTf = btn.dataset.tf;
    document.querySelectorAll('#tf-tabs .tf-tab').forEach((b) => b.classList.toggle('active', b === btn));
    if (isSpotView()) updateSpotUi();
    else updateUi();
  });
}

// ═══════ Footprint / Order Flow Chart (canvas-based) ═══════

const CHART_TFS = [1, 5, 15, 30, 45, 60, 120, 240, 1440];
let chartTfMinutes = 15;
const FP_COLS_KEY = 'fpGridCols';
const FP_COLS_MIN = 1;
const FP_COLS_MAX = 4;

function readFpCols() {
  const n = Number(localStorage.getItem(FP_COLS_KEY));
  if (!Number.isFinite(n)) return 1;
  return Math.min(FP_COLS_MAX, Math.max(FP_COLS_MIN, Math.round(n)));
}

let fpColsPerRow = readFpCols();

function applyFpCols(cols = fpColsPerRow) {
  const n = Math.min(FP_COLS_MAX, Math.max(FP_COLS_MIN, Math.round(Number(cols)) || 1));
  fpColsPerRow = n;
  localStorage.setItem(FP_COLS_KEY, String(n));
  const grid = document.getElementById('fp-grid');
  if (grid) grid.style.setProperty('--fp-cols', String(n));
  const select = document.getElementById('fp-cols-select');
  if (select && select.value !== String(n)) select.value = String(n);
  resizeAllFpViews();
}
/** Current in-progress 1m bar per `symbol_exchange_1`, pushed by the server. */
const footprintStore = {};
/** Persisted bars from /api/footprint, already rolled up to the active timeframe. */
const fpHistoryStore = {};
/** Pattern markers keyed by historyKey(symbol, tf, exchange). */
const fpPatternStore = {};
const fpKlineSeed = {};
let fpKlineReq = 0;
let fpHistoryReq = 0;
let fpHistoryEnabled = false;
let fpRetentionDays = 30;
let fpLiveSocket = null;
let fpLastLiveMinuteBySymbol = {};
/** @type {Map<string, { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, panBars: number, livePrice: number, liveAt: number, dragging: boolean, dragX: number, card: HTMLElement }>} */
const fpViews = new Map();
let fpDrawRaf = 0;
const fpDirty = new Set();
let fpDirtyAll = false;
let fpGridBound = false;

/** Width of the resting-liquidity ladder drawn beside the newest footprint bar. */
const PASSIVE_RAIL_W = 176;
/** Cancelled/added notional per level decays with this half-life so the rail shows recent behaviour. */
const PASSIVE_DECAY_HALFLIFE_MS = 45_000;
/** @type {Map<string, { at: number, levels: Map<string, object> }>} */
const fpPassiveLedgers = new Map();
/** Live depth ladders from the `book` stream, keyed by `market_symbol`. */
const fpBooks = new Map();

function ingestOrderBook(ev) {
  const market = ev.market === 'spot' ? 'spot' : 'perp';
  if (market !== footprintMarket() || !ev.symbol) return;
  const bids = Array.isArray(ev.bids) ? ev.bids : [];
  const asks = Array.isArray(ev.asks) ? ev.asks : [];
  if (!bids.length && !asks.length) return;
  fpBooks.set(`${market}_${ev.symbol}`, { bids, asks, at: Date.now() });
  scheduleDraw(ev.symbol);
}

function orderBookFor(symbol) {
  return fpBooks.get(`${footprintMarket()}_${symbol}`) ?? null;
}

/**
 * Turns the stream of resting book marks into per-level passive accounting:
 * resting size, consumed (filled by aggression), pulled (cancelled), and added.
 * The book snapshot only carries current size and the last event, so magnitudes
 * are accumulated here from successive snapshots.
 *
 * Idempotent: redrawing with the same marks produces zero deltas.
 */
function updatePassiveLedger(symbol, marks) {
  const now = Date.now();
  let led = fpPassiveLedgers.get(symbol);
  if (!led) {
    led = { at: now, levels: new Map() };
    fpPassiveLedgers.set(symbol, led);
  }
  const decay = Math.pow(0.5, Math.max(0, now - led.at) / PASSIVE_DECAY_HALFLIFE_MS);
  led.at = now;
  for (const lv of led.levels.values()) {
    lv.cancelBid *= decay;
    lv.cancelAsk *= decay;
    lv.consumeBid *= decay;
    lv.consumeAsk *= decay;
    lv.addBid *= decay;
    lv.addAsk *= decay;
    lv.live = false;
  }

  for (const mark of marks) {
    const price = Number(mark.price);
    if (!Number.isFinite(price)) continue;
    const key = price.toFixed(6);
    let lv = led.levels.get(key);
    if (!lv) {
      lv = {
        price, bid: 0, ask: 0,
        cancelBid: 0, cancelAsk: 0,
        consumeBid: 0, consumeAsk: 0,
        addBid: 0, addAsk: 0,
        event: 'NONE', live: false,
      };
      led.levels.set(key, lv);
    }
    const event = String(mark.event ?? '');
    const restingBid = Number(mark.restingBid) || 0;
    const restingAsk = Number(mark.restingAsk) || 0;
    const dBid = restingBid - lv.bid;
    const dAsk = restingAsk - lv.ask;
    if (dBid > 0) lv.addBid += dBid;
    else if (dBid < 0) {
      const drop = -dBid;
      if (event === 'CONSUME_BID') lv.consumeBid += drop;
      else lv.cancelBid += drop;
    }
    if (dAsk > 0) lv.addAsk += dAsk;
    else if (dAsk < 0) {
      const drop = -dAsk;
      if (event === 'CONSUME_ASK') lv.consumeAsk += drop;
      else lv.cancelAsk += drop;
    }
    lv.bid = restingBid;
    lv.ask = restingAsk;
    lv.event = event;
    lv.live = restingBid > 0 || restingAsk > 0;
  }

  for (const [key, lv] of led.levels) {
    const residue = lv.cancelBid + lv.cancelAsk + lv.consumeBid + lv.consumeAsk + lv.addBid + lv.addAsk;
    if (!lv.live && residue < 1) led.levels.delete(key);
  }
  return led;
}

/** Rolls the ledger up to the chart's display bucket so rows line up with footprint rows. */
function bucketPassiveLedger(led, bucket) {
  const out = new Map();
  for (const lv of led.levels.values()) {
    const p = priceToTick(lv.price, bucket);
    const key = p.toFixed(8);
    let row = out.get(key);
    if (!row) {
      row = {
        price: p, bid: 0, ask: 0,
        cancelBid: 0, cancelAsk: 0,
        consumeBid: 0, consumeAsk: 0,
        addBid: 0, addAsk: 0,
      };
      out.set(key, row);
    }
    row.bid += lv.bid;
    row.ask += lv.ask;
    row.cancelBid += lv.cancelBid;
    row.cancelAsk += lv.cancelAsk;
    row.consumeBid += lv.consumeBid;
    row.consumeAsk += lv.consumeAsk;
    row.addBid += lv.addBid;
    row.addAsk += lv.addAsk;
  }
  return [...out.values()];
}

/** Live-bar totals from the passive ledger: consumed vs pulled. */
function passiveLedgerTotals(symbol) {
  const led = fpPassiveLedgers.get(symbol);
  if (!led) return { consumeBid: 0, consumeAsk: 0, cancelBid: 0, cancelAsk: 0 };
  let consumeBid = 0;
  let consumeAsk = 0;
  let cancelBid = 0;
  let cancelAsk = 0;
  for (const lv of led.levels.values()) {
    consumeBid += lv.consumeBid || 0;
    consumeAsk += lv.consumeAsk || 0;
    cancelBid += lv.cancelBid || 0;
    cancelAsk += lv.cancelAsk || 0;
  }
  return { consumeBid, consumeAsk, cancelBid, cancelAsk };
}

function visibleCoins() {
  const coins = config?.coins ?? [];
  if (isSpotView()) return coins.filter((c) => c.venue !== 'equity');
  return coins;
}

function selectedFootprintCoins() {
  return visibleCoins();
}

function syncFootprintSymbolPicker() {
  const select = document.getElementById('chart-symbol-select');
  if (!select) return;
  const coins = visibleCoins();
  select.innerHTML = coins
    .map((coin) => `<option value="${coin.symbol}"${coin.symbol === selectedSymbol ? ' selected' : ''}>${coin.label}</option>`)
    .join('');
  select.disabled = coins.length < 2;
}

function noteLivePrice(symbol, price) {
  if (!Number.isFinite(price) || price <= 0) return;
  const view = fpViews.get(symbol);
  if (view) {
    view.livePrice = price;
    view.liveAt = Date.now();
  }
}

function latestLivePrice(symbol, fallback) {
  const view = fpViews.get(symbol);
  if (view?.livePrice > 0 && Date.now() - view.liveAt < 90_000) return view.livePrice;
  return fallback;
}

function fpLayout(cssWidth) {
  const leftPad = 8;
  const priceAxisWidth = 70;
  const candleW = 6;
  const cellW = 88;
  const gap = 6;
  // Resting book ladder sits between the newest bar and the price axis. It is
  // dropped on narrow charts so the footprint itself always keeps its columns.
  const railW = cssWidth >= 360 ? (cssWidth >= 720 ? PASSIVE_RAIL_W : 148) : 0;
  const barWidth = candleW + cellW;
  const stride = barWidth + gap;
  const availW = Math.max(1, cssWidth - priceAxisWidth - railW - leftPad);
  const visibleBars = Math.max(1, Math.floor(availW / stride));
  return { leftPad, priceAxisWidth, railW, candleW, cellW, barWidth, gap, stride, visibleBars };
}

function clampFpPan(view, storeSize, cssWidth) {
  const { visibleBars } = fpLayout(cssWidth);
  const maxPan = Math.max(0, storeSize - visibleBars);
  view.panBars = Math.max(0, Math.min(view.panBars, maxPan));
  return maxPan;
}

function cssChartWidth(view) {
  if (!view?.canvas) return 0;
  return view.canvas.width / devicePixelRatio;
}

function scheduleDraw(symbol) {
  if (symbol) fpDirty.add(symbol);
  else fpDirtyAll = true;
  if (fpDrawRaf) return;
  fpDrawRaf = requestAnimationFrame(() => {
    fpDrawRaf = 0;
    if (fpDirtyAll) {
      for (const sym of fpViews.keys()) drawFootprint(sym);
      fpDirty.clear();
      fpDirtyAll = false;
      return;
    }
    for (const sym of fpDirty) drawFootprint(sym);
    fpDirty.clear();
  });
}

function snapChartToLive() {
  for (const view of fpViews.values()) view.panBars = 0;
  scheduleDraw();
}

function resizeFpView(symbol) {
  const view = fpViews.get(symbol);
  if (!view?.canvas?.parentElement) return;
  const rect = view.canvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  view.canvas.width = w * devicePixelRatio;
  view.canvas.height = h * devicePixelRatio;
  view.ctx = view.canvas.getContext('2d');
  view.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function resizeAllFpViews() {
  for (const symbol of fpViews.keys()) resizeFpView(symbol);
  scheduleDraw();
}

function bindFpCanvas(symbol, canvas) {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const view = fpViews.get(symbol);
    if (!view) return;
    const W = cssChartWidth(view);
    const bars = footprintBars(symbol);
    const { stride } = fpLayout(W);
    view.panBars += (e.deltaX + e.deltaY) / stride;
    clampFpPan(view, bars.length, W);
    scheduleDraw(symbol);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    const view = fpViews.get(symbol);
    if (!view) return;
    view.dragging = true;
    view.dragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    const view = fpViews.get(symbol);
    if (!view?.dragging) return;
    const W = cssChartWidth(view);
    const bars = footprintBars(symbol);
    const { stride } = fpLayout(W);
    view.panBars += (e.clientX - view.dragX) / stride;
    view.dragX = e.clientX;
    clampFpPan(view, bars.length, W);
    scheduleDraw(symbol);
  });
  const endDrag = () => {
    const view = fpViews.get(symbol);
    if (!view) return;
    view.dragging = false;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointermove', (e) => {
    const view = fpViews.get(symbol);
    if (!view || view.dragging) return;
    showPatternTip(symbol, e);
  });
  canvas.addEventListener('pointerleave', () => hidePatternTip(symbol));
}

function buildFpGrid() {
  const grid = document.getElementById('fp-grid');
  if (!grid) return;
  const coins = selectedFootprintCoins();
  fpViews.clear();
  grid.innerHTML = '';
  applyFpCols(fpColsPerRow);
  for (const coin of coins) {
    const card = document.createElement('section');
    card.className = 'fp-card';
    card.dataset.symbol = coin.symbol;
    card.id = `fp-card-${coin.symbol}`;
    card.innerHTML = `
      <header class="fp-card-head">
        <span class="fp-card-title">${coin.label}</span>
        <span class="fp-card-meta" data-fp-meta>—</span>
      </header>
      <div class="fp-card-canvas"></div>
      <div class="fp-pattern-tip hidden" data-fp-pattern-tip></div>
    `;
    const host = card.querySelector('.fp-card-canvas');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    grid.appendChild(card);
    fpViews.set(coin.symbol, {
      canvas,
      ctx: canvas.getContext('2d'),
      panBars: 0,
      livePrice: 0,
      liveAt: 0,
      dragging: false,
      dragX: 0,
      card,
      patternHits: [],
    });
    bindFpCanvas(coin.symbol, canvas);
    card.addEventListener('pointerdown', () => focusFootprintSymbol(coin.symbol));
  }
  syncFootprintSymbolPicker();
  syncFootprintFocus();
  $('symbol-label').textContent = coins.length
    ? coins.map((c) => c.label).join(' · ')
    : '—';
  resizeAllFpViews();
  requestAnimationFrame(resizeAllFpViews);
}

function focusFootprintSymbol(symbol) {
  if (!symbol || selectedSymbol === symbol) return;
  if (!visibleCoins().some((c) => c.symbol === symbol)) return;
  selectedSymbol = symbol;
  syncFootprintSymbolPicker();
  syncFootprintFocus();
  subscribeFootprint();
  scheduleDraw(symbol);
}

function syncFootprintFocus() {
  for (const [symbol, view] of fpViews) {
    view.card?.classList.toggle('focus', symbol === selectedSymbol);
  }
}

function initChart() {
  if (!fpGridBound) {
    fpGridBound = true;
    window.addEventListener('resize', resizeAllFpViews);
    document.getElementById('chart-tf-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ctf]');
      if (!btn) return;
      chartTfMinutes = Number(btn.dataset.ctf);
      document.querySelectorAll('#chart-tf-tabs .chart-tf-tab').forEach((b) => b.classList.toggle('active', b === btn));
      snapChartToLive();
      seedFootprintKlines();
    });
    document.getElementById('chart-ex-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ex]');
      if (!btn || btn.disabled) return;
      selectedExchange = btn.dataset.ex;
      syncExchangeTabs();
      snapChartToLive();
      seedFootprintKlines();
      subscribeFootprint();
    });
    document.getElementById('chart-live-btn')?.addEventListener('click', snapChartToLive);
    document.getElementById('chart-symbol-select')?.addEventListener('change', (e) => {
      const symbol = e.target.value;
      if (!visibleCoins().some((c) => c.symbol === symbol)) return;
      focusFootprintSymbol(symbol);
    });
    document.getElementById('fp-cols-select')?.addEventListener('change', (e) => {
      applyFpCols(e.target.value);
    });
  }
  buildFpGrid();
}

function getFootprintStore(symbol, tf = chartTfMinutes, exchange = 'binance') {
  const key = `${footprintMarket()}_${symbol}_${exchange}_${tf}`;
  if (!footprintStore[key]) footprintStore[key] = new Map();
  return footprintStore[key];
}

function historyKey(symbol, tf, exchange) {
  return `${footprintMarket()}_${symbol}_${exchange}_${tf}`;
}

function getFpHistory(symbol = selectedSymbol, tf = chartTfMinutes, exchange = selectedExchange) {
  return fpHistoryStore[historyKey(symbol, tf, exchange)] ?? new Map();
}

function getFpKlineSeed(symbol, tf = chartTfMinutes, exchange = klineExchange()) {
  const key = `${footprintMarket()}_${symbol}_${exchange}_${tf}`;
  if (!fpKlineSeed[key]) fpKlineSeed[key] = new Map();
  return fpKlineSeed[key];
}

function cloneFpBar(bar) {
  const levels = new Map();
  for (const [k, v] of bar.levels.entries()) {
    levels.set(k, { price: v.price, buy: v.buy, sell: v.sell });
  }
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    closeTime: bar.closeTime ?? bar.time,
    totalBuy: bar.totalBuy,
    totalSell: bar.totalSell,
    buyTrades: bar.buyTrades ?? 0,
    sellTrades: bar.sellTrades ?? 0,
    largestBuy: bar.largestBuy ?? 0,
    largestSell: bar.largestSell ?? 0,
    levels,
  };
}

function fpKlineInterval(tf = chartTfMinutes) {
  if (tf === 1440) return '1d';
  if (tf === 240) return '4h';
  if (tf === 120) return '2h';
  if (tf === 60) return '1h';
  if (tf === 45) return '15m';
  return `${tf}m`;
}

function wireBarToFp(w) {
  const levels = new Map();
  for (const [price, buy, sell] of w.lv ?? []) {
    levels.set(price.toFixed(6), { price, buy, sell });
  }
  return {
    time: w.t,
    open: w.o,
    high: w.h,
    low: w.l,
    close: w.c,
    totalBuy: w.tb ?? 0,
    totalSell: w.ts ?? 0,
    buyTrades: w.bt ?? 0,
    sellTrades: w.st ?? 0,
    largestBuy: w.lb ?? 0,
    largestSell: w.ls ?? 0,
    levels,
  };
}

/**
 * Run async work over items with a hard concurrency cap.
 * Avoids bursting 2×N requests when the grid has many coins.
 */
async function mapPool(items, concurrency, worker) {
  const list = [...items];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, list.length || 1)) }, async () => {
    while (cursor < list.length) {
      const idx = cursor++;
      await worker(list[idx], idx);
    }
  });
  await Promise.all(runners);
}

/**
 * Loads stored footprint history for every visible symbol/timeframe.
 * Caps parallel fetches, then only pulls klines for charts still short on history.
 */
async function loadFootprintHistory() {
  const tf = chartTfMinutes;
  const exchange = selectedExchange;
  const market = footprintMarket();
  const req = ++fpHistoryReq;
  const coins = selectedFootprintCoins();
  let enabled = fpHistoryEnabled;

  await mapPool(coins, 4, async (coin) => {
    if (req !== fpHistoryReq) return;
    try {
      const params = new URLSearchParams({
        symbol: coin.symbol,
        exchange,
        tf: String(tf),
        limit: '600',
        days: String(Math.min(fpRetentionDays, 14)),
        market,
      });
      const data = await fetch(`/api/footprint?${params}`).then((r) => r.json());
      if (req !== fpHistoryReq) return;
      if (!data?.enabled) {
        enabled = false;
        return;
      }
      enabled = true;
      const map = new Map();
      for (const w of data.bars ?? []) map.set(w.t, wireBarToFp(w));
      fpHistoryStore[historyKey(coin.symbol, tf, exchange)] = map;
      fpPatternStore[historyKey(coin.symbol, tf, exchange)] = {
        currentLabel: data.patterns?.currentLabel ?? null,
        primary: data.patterns?.primary ?? null,
        currentPattern: data.patterns?.currentPattern ?? null,
        nextState: data.patterns?.nextState ?? null,
        markers: data.patterns?.markers ?? [],
      };
      scheduleDraw(coin.symbol);
      void refreshPatternMarkers(coin.symbol, true);
    } catch {
      /* keep whatever history we already had */
    }
  });

  if (req !== fpHistoryReq) return;
  fpHistoryEnabled = enabled;
}

function seedFootprintKlines() {
  void (async () => {
    if (fpHistoryEnabled) await loadFootprintHistory();
    await seedFromKlines();
  })();
}

async function seedFromKlines() {
  const tf = chartTfMinutes;
  const exchange = klineExchange();
  const market = footprintMarket();
  // 1m stays live-only (server aggregator). 5m+ backfill closed candles from venue klines.
  if (tf < 5) {
    scheduleDraw();
    return;
  }
  const req = ++fpKlineReq;
  // Prefer Postgres history when present — only backfill empty/thin charts with klines.
  const coins = selectedFootprintCoins().filter((coin) => {
    const hist = getFpHistory(coin.symbol, tf, selectedExchange);
    return hist.size < 24;
  });
  if (!coins.length) {
    scheduleDraw();
    return;
  }

  const liveOpenT = fpCandleTime(Date.now(), tf);

  await mapPool(coins, 3, async (coin) => {
    if (req !== fpKlineReq || tf !== chartTfMinutes || klineExchange() !== exchange) return;
    try {
      const rows = await fetch(
        `/api/klines?symbol=${encodeURIComponent(coin.symbol)}&interval=${fpKlineInterval(tf)}&exchange=${encodeURIComponent(exchange)}&market=${encodeURIComponent(market)}&limit=300`,
      ).then((r) => r.json());
      if (req !== fpKlineReq || tf !== chartTfMinutes || klineExchange() !== exchange) return;
      if (!Array.isArray(rows) || !rows.length) return;
      let candles = rows
        .map((k) => ({
          time: Math.floor(Number(k[0]) / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5] ?? 0),
          quote: Number(k[7] ?? k[6] ?? 0),
          takerBuy: Number(k[10] ?? k[9] ?? NaN),
        }))
        .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.close));
      if (tf === 45) candles = aggregateToMinutes(candles, 45);
      const seed = getFpKlineSeed(coin.symbol, tf, exchange);
      seed.clear();
      for (const c of candles) {
        const bar = {
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          levels: new Map(),
          totalBuy: 0,
          totalSell: 0,
        };
        // Closed history keeps kline backfill. Open candle is created by live 1m.
        if (c.time < liveOpenT) {
          fillKlineProxyLevels(bar, c.volume, c.quote, c.takerBuy);
        }
        seed.set(c.time, bar);
      }
      // Always create the open candle shell if the venue list is lagging.
      if (!seed.has(liveOpenT)) {
        const last = [...seed.values()].sort((a, b) => a.time - b.time).at(-1);
        const px = latestLivePrice(coin.symbol, last?.close ?? 0);
        if (px > 0) {
          seed.set(liveOpenT, {
            time: liveOpenT,
            open: last?.close ?? px,
            high: px,
            low: px,
            close: px,
            levels: new Map(),
            totalBuy: 0,
            totalSell: 0,
          });
        }
      }
      scheduleDraw(coin.symbol);
      void refreshPatternMarkers(coin.symbol, true);
    } catch {
      /* live 1m rollup still works */
    }
  });
}

function klineQuoteUsd(volume, quote, high, low, close) {
  const typical = (high + low + close) / 3;
  if (Number.isFinite(quote) && quote > 0) return quote;
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(typical) || typical <= 0) return 0;
  return volume * typical;
}

function fillKlineProxyLevels(bar, volume, quote, takerBuy) {
  const usd = klineQuoteUsd(volume, quote, bar.high, bar.low, bar.close);
  if (usd <= 0) return bar;
  const range = Math.max(bar.high - bar.low, tickSize((bar.high + bar.low) / 2));
  const body = range > 0 ? Math.abs(bar.close - bar.open) / range : 0;
  let buyFrac = 0.5;
  if (Number.isFinite(takerBuy) && takerBuy >= 0 && volume > 0) {
    buyFrac = Math.min(0.9, Math.max(0.1, takerBuy / volume));
  } else if (bar.close > bar.open) {
    buyFrac = 0.52 + 0.28 * Math.min(1, body);
  } else if (bar.close < bar.open) {
    buyFrac = 0.48 - 0.28 * Math.min(1, body);
  }
  const buyUsd = usd * buyFrac;
  const sellUsd = usd - buyUsd;
  const tick = tickSize((bar.high + bar.low) / 2);
  let lo = priceToTick(bar.low, tick);
  let hi = priceToTick(bar.high, tick);
  if (hi < lo) {
    const swap = lo;
    lo = hi;
    hi = swap;
  }
  const n = Math.max(1, Math.round((hi - lo) / tick) + 1);
  const step = n <= 14 ? tick : tick * Math.max(1, Math.ceil(n / 14));
  const prices = [];
  for (let p = lo; p <= hi + step * 0.001; p += step) {
    prices.push(priceToTick(p, step));
  }
  if (!prices.length) prices.push(priceToTick(bar.close, tick));
  const peak = priceToTick(bar.close, step);
  const span = Math.max(hi - lo, step);
  const weights = prices.map((p) => Math.max(0.12, 1 - Math.abs(p - peak) / span));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  bar.levels = new Map();
  bar.totalBuy = buyUsd;
  bar.totalSell = sellUsd;
  prices.forEach((p, i) => {
    const w = weights[i] / wsum;
    bar.levels.set(p.toFixed(6), { price: p, buy: buyUsd * w, sell: sellUsd * w });
  });
  return bar;
}

function levelCoverage(bar) {
  if (!bar.levels?.size) return 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const lv of bar.levels.values()) {
    if ((lv.buy + lv.sell) <= 0) continue;
    if (lv.price < lo) lo = lv.price;
    if (lv.price > hi) hi = lv.price;
  }
  if (!Number.isFinite(lo)) return 0;
  return (hi - lo) / Math.max(bar.high - bar.low, 1e-9);
}

function mergeFootprintBar(target, src) {
  target.high = Math.max(target.high, src.high);
  target.low = Math.min(target.low, src.low);
  const srcT = src.closeTime ?? src.time ?? 0;
  const tgtT = target.closeTime ?? target.time ?? 0;
  if (srcT >= tgtT) {
    target.close = src.close;
    target.closeTime = srcT;
  }
  target.totalBuy += src.totalBuy;
  target.totalSell += src.totalSell;
  target.buyTrades = (target.buyTrades ?? 0) + (src.buyTrades ?? 0);
  target.sellTrades = (target.sellTrades ?? 0) + (src.sellTrades ?? 0);
  target.largestBuy = Math.max(target.largestBuy ?? 0, src.largestBuy ?? 0);
  target.largestSell = Math.max(target.largestSell ?? 0, src.largestSell ?? 0);
  for (const lv of src.levels.values()) {
    const k = lv.price.toFixed(6);
    if (!target.levels.has(k)) target.levels.set(k, { price: lv.price, buy: 0, sell: 0 });
    const d = target.levels.get(k);
    d.buy += lv.buy;
    d.sell += lv.sell;
  }
}

function aggregateFrom1m(symbol, tfMinutes) {
  const venues = selectedExchange === 'all' ? activeExchanges() : [selectedExchange];
  const out = new Map();
  const bucket = tfMinutes * 60;
  // Only the open higher-TF candle receives live 1m rolls. Stale minutes must
  // not rebuild closed buckets like 15:15 / 15:30 after a refresh.
  const liveOpenT = fpCandleTime(Date.now(), tfMinutes);
  for (const ex of venues) {
    for (const bar of getFootprintStore(symbol, 1, ex).values()) {
      const t = bar.time - (bar.time % bucket);
      if (t !== liveOpenT) continue;
      if (!out.has(t)) {
        out.set(t, {
          time: t,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          levels: new Map(),
          totalBuy: 0,
          totalSell: 0,
          buyTrades: 0,
          sellTrades: 0,
          largestBuy: 0,
          largestSell: 0,
        });
      }
      mergeFootprintBar(out.get(t), bar);
    }
  }
  return out;
}

function live1mStore(symbol) {
  if (selectedExchange !== 'all') return getFootprintStore(symbol, 1, selectedExchange);
  const venues = activeExchanges();
  if (venues.length === 1) return getFootprintStore(symbol, 1, venues[0]);
  const out = new Map();
  for (const ex of venues) {
    for (const bar of getFootprintStore(symbol, 1, ex).values()) {
      if (!out.has(bar.time)) out.set(bar.time, cloneFpBar(bar));
      else mergeFootprintBar(out.get(bar.time), bar);
    }
  }
  return out;
}

function footprintBars(symbol = selectedSymbol, tf = chartTfMinutes) {
  const live = tf === 1 ? live1mStore(symbol) : aggregateFrom1m(symbol, tf);
  const hist = fpHistoryEnabled ? getFpHistory(symbol, tf, selectedExchange) : new Map();
  const kline = tf >= 5 ? getFpKlineSeed(symbol, tf) : new Map();
  if (hist.size === 0 && kline.size === 0 && live.size === 0) return [];

  const liveOpenT = fpCandleTime(Date.now(), tf);
  const out = new Map();
  for (const bar of hist.values()) out.set(bar.time, cloneFpBar(bar));
  for (const bar of live.values()) {
    if (!out.has(bar.time)) out.set(bar.time, cloneFpBar(bar));
    else mergeFootprintBar(out.get(bar.time), bar);
  }
  for (const k of kline.values()) {
    const existing = out.get(k.time);
    if (!existing) {
      out.set(k.time, cloneFpBar(k));
      continue;
    }
    // Open candle footprint comes from live 1m — do not inject kline proxy into it.
    if (k.time === liveOpenT) continue;
    // Closed candles: keep / restore backfill levels when coverage is thin.
    if ((k.totalBuy + k.totalSell) > 0 && levelCoverage(existing) < 0.5) {
      for (const [key, lv] of k.levels) {
        if (!existing.levels.has(key)) {
          existing.levels.set(key, { price: lv.price, buy: lv.buy, sell: lv.sell });
          existing.totalBuy += lv.buy;
          existing.totalSell += lv.sell;
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

function fpCandleTime(ts, tf = chartTfMinutes) {
  const s = Math.floor(ts / 1000);
  return s - (s % (tf * 60));
}

function tickSize(price) {
  if (price >= 10000) return 10;
  if (price >= 1000) return 1;
  if (price >= 100) return 0.5;
  if (price >= 10) return 0.1;
  if (price >= 1) return 0.01;
  return 0.001;
}

function priceToTick(price, tick) {
  return Math.round(price / tick) * tick;
}

function ingestTradeToChart(trade) {
  // Server aggregator owns the live bar and pushes it over WS. The tape is
  // filtered to large prints, so building from it here would understate volume.
  if (fpLiveSocket?.readyState === WebSocket.OPEN) return;
  if (tradeMarket(trade) !== footprintMarket()) return;
  const tick = tickSize(trade.price);
  const level = priceToTick(trade.price, tick);
  const lk = level.toFixed(6);
  const store = getFootprintStore(trade.symbol, 1, tradeExchange(trade));
  const t = fpCandleTime(trade.timestamp, 1);
  if (!store.has(t)) {
    store.set(t, {
      time: t, open: trade.price, high: trade.price, low: trade.price, close: trade.price,
      levels: new Map(), totalBuy: 0, totalSell: 0,
    });
  }
  const bar = store.get(t);
  bar.high = Math.max(bar.high, trade.price);
  bar.low = Math.min(bar.low, trade.price);
  bar.close = trade.price;
  bar.closeTime = t;
  noteLivePrice(trade.symbol, trade.price);
  if (!bar.levels.has(lk)) bar.levels.set(lk, { price: level, buy: 0, sell: 0 });
  const lv = bar.levels.get(lk);
  if (trade.side === 'BUY') { lv.buy += trade.quoteValue; bar.totalBuy += trade.quoteValue; }
  else { lv.sell += trade.quoteValue; bar.totalSell += trade.quoteValue; }
  if (trade.symbol && tradeMatchesExchange(trade)) {
    scheduleDraw(trade.symbol);
  }
}

function displayBucket(high, low, chartH) {
  const raw = tickSize((high + low) / 2);
  const range = Math.max(high - low, raw);
  const maxRows = Math.max(8, Math.floor(chartH / 20));
  let bucket = raw;
  while (range / bucket > maxRows) bucket *= 2;
  return bucket;
}

function bucketBarLevels(bar, bucket) {
  const map = new Map();
  for (const lv of bar.levels.values()) {
    const p = priceToTick(lv.price, bucket);
    const k = p.toFixed(8);
    if (!map.has(k)) map.set(k, { price: p, buy: 0, sell: 0 });
    const b = map.get(k);
    b.buy += lv.buy;
    b.sell += lv.sell;
  }
  return [...map.values()];
}

function liveFlowBattle(symbol = selectedSymbol) {
  const snap = summaries[symbol];
  return snap?.windows?.[selectedTf]?.flowBattle
    ?? snap?.windows?.['10s']?.flowBattle
    ?? null;
}

function fpBarWinner(bar) {
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const mid = (bar.high + bar.low) / 2 || bar.close;
  const move = mid ? (bar.close - bar.open) / mid : 0;
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const stalled = Math.abs(move) < 0.00045 || (range > 0 && body / range < 0.3);
  if (delta > 0 && stalled) return { id: 'PASSIVE_SELLERS', short: 'P.SELL', color: '#fbbf24' };
  if (delta < 0 && stalled) return { id: 'PASSIVE_BUYERS', short: 'P.BUY', color: '#60a5fa' };
  if (delta > 0 && move > 0) return { id: 'AGGRESSIVE_BUYERS', short: 'A.BUY', color: '#22c55e' };
  if (delta < 0 && move < 0) return { id: 'AGGRESSIVE_SELLERS', short: 'A.SELL', color: '#ef4444' };
  return { id: 'BALANCED', short: '', color: '#8b949e' };
}

/** Split 0–1 weights into integers that sum to 100. */
function percentsSum100(weights) {
  const floors = weights.map((w) => Math.floor(Math.max(0, w) * 100));
  let left = 100 - floors.reduce((sum, n) => sum + n, 0);
  const order = weights
    .map((w, i) => ({ i, frac: Math.max(0, w) * 100 - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < left; k++) floors[order[k].i] += 1;
  return floors;
}

/**
 * Four readings per candle, summing to 100%.
 * Buy volume that lifted the close is asks consumed; buy volume that did not is buyers absorbed.
 * Sell volume that pushed the close down is bids consumed; sell volume that did not is sellers absorbed.
 * The largest share is marked strong.
 */
function barBattlePercents(bar) {
  const buy = bar.totalBuy ?? 0;
  const sell = bar.totalSell ?? 0;
  const vol = buy + sell;
  if (vol <= 0) return null;
  const range = bar.high - bar.low;
  const closePos = range > 0 ? Math.min(1, Math.max(0, (bar.close - bar.low) / range)) : 0.5;
  const buyShare = buy / vol;
  const sellShare = sell / vol;
  const rows = [
    { text: 'Asks', color: '#22c55e', weight: buyShare * closePos },
    { text: 'Bids', color: '#ef4444', weight: sellShare * (1 - closePos) },
    { text: 'Sell abs', color: '#60a5fa', weight: sellShare * closePos },
    { text: 'Buy abs', color: '#fbbf24', weight: buyShare * (1 - closePos) },
  ];
  const pcts = percentsSum100(rows.map((row) => row.weight));
  let best = 0;
  for (let i = 1; i < pcts.length; i++) if (pcts[i] > pcts[best]) best = i;
  return rows.map((row, i) => ({ text: row.text, color: row.color, pct: pcts[i], strong: i === best && pcts[i] > 0 }));
}

function barAbsorbed(bar) {
  const vol = (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const dominated = vol > 0 && Math.abs(delta / vol) >= 0.25;
  if (dominated && delta < 0 && closePos >= 0.55) return 'SELLERS';
  if (dominated && delta > 0 && closePos <= 0.45) return 'BUYERS';
  return null;
}

function priorSwingLevels(prior) {
  if (!prior.length) return { support: null, resistance: null, supportTouches: 0, resistanceTouches: 0 };
  const recent = prior.slice(-24);
  const atr = recentBarAtr(prior, recent[recent.length - 1]);
  const tol = Math.max(atr * 0.28, (recent[recent.length - 1].close || 1) * 0.0008);

  const pivotLows = [];
  const pivotHighs = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const p = recent[i];
    const l = recent[i - 1];
    const r = recent[i + 1];
    if (p.low <= l.low && p.low <= r.low) pivotLows.push(p.low);
    if (p.high >= l.high && p.high >= r.high) pivotHighs.push(p.high);
  }

  const window16 = prior.slice(-16);
  let absHigh = -Infinity;
  let absLow = Infinity;
  for (const b of window16) {
    if (b.high > absHigh) absHigh = b.high;
    if (b.low < absLow) absLow = b.low;
  }
  if (!Number.isFinite(absHigh) || !Number.isFinite(absLow)) {
    return { support: null, resistance: null, supportTouches: 0, resistanceTouches: 0 };
  }

  const supportPick = pickClusteredLevel(pivotLows, absLow, tol, 'support');
  const resistancePick = pickClusteredLevel(pivotHighs, absHigh, tol, 'resistance');
  return {
    support: supportPick.level,
    resistance: resistancePick.level,
    supportTouches: supportPick.touches,
    resistanceTouches: resistancePick.touches,
  };
}

function pickClusteredLevel(pivots, extreme, tol, side) {
  const points = pivots.slice();
  if (Number.isFinite(extreme)) points.push(extreme);
  if (!points.length) return { level: extreme, touches: 1 };
  const sorted = points.slice().sort((a, b) => a - b);
  const clusters = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && p - last.max <= tol) {
      last.sum += p;
      last.count += 1;
      last.max = p;
    } else {
      clusters.push({ sum: p, count: 1, min: p, max: p });
    }
  }
  let best = clusters[0];
  for (const c of clusters) {
    if (c.count > best.count) best = c;
    else if (c.count === best.count) {
      const bestMean = best.sum / best.count;
      const mean = c.sum / c.count;
      if (side === 'support' ? mean < bestMean : mean > bestMean) best = c;
    }
  }
  const mean = best.sum / best.count;
  const level = Math.abs(extreme - mean) <= tol * 1.25 ? extreme : mean;
  return { level, touches: best.count };
}

function barLocationFromPrior(bar, prior) {
  const { support, resistance } = priorSwingLevels(prior);
  if (support == null || resistance == null || resistance <= support) return 'UNKNOWN';
  const band = Math.max((resistance - support) * 0.12, (bar.close || 1) * 0.0015);
  if (bar.close > resistance + band * 0.15) return 'ABOVE_RESISTANCE';
  if (bar.close < support - band * 0.15) return 'BELOW_SUPPORT';
  if (bar.high >= resistance - band) return 'AT_RESISTANCE';
  if (bar.low <= support + band) return 'AT_SUPPORT';
  return 'MID_RANGE';
}

function recentBarAtr(prior, bar) {
  const look = prior.slice(-8);
  if (!look.length) return Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
  let s = 0;
  for (const b of look) s += Math.max(b.high - b.low, 0);
  return s / look.length || Math.max(bar.high - bar.low, (bar.close || 1) * 0.002);
}

function barVacuumKind(bar, prior) {
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
  const deltaPct = vol > 0 ? (buy - sell) / vol : (move > 0 ? 0.3 : move < 0 ? -0.3 : 0);
  if (deltaPct >= 0.18 && move > 0 && closePos >= 0.62) return 'UPSIDE';
  if (deltaPct <= -0.18 && move < 0 && closePos <= 0.38) return 'DOWNSIDE';
  if (move > 0 && closePos >= 0.72 && range >= atr * 1.35) return 'UPSIDE';
  if (move < 0 && closePos <= 0.28 && range >= atr * 1.35) return 'DOWNSIDE';
  return null;
}

function absorptionReversalKind(bar) {
  const abs = barAbsorbed(bar);
  if (abs === 'SELLERS' && bar.close >= bar.open) return 'SELLER';
  if (abs === 'BUYERS' && bar.close <= bar.open) return 'BUYER';
  return null;
}

/**
 * Stop hunt = pierce swing / equal high-low stop liquidity, reject back inside,
 * with flow evidence of absorption or aggressive flip — not a naked wick.
 */
function stopHuntKind(bar, prior) {
  const levels = priorSwingLevels(prior);
  const { support, resistance } = levels;
  if (support == null || resistance == null || resistance <= support) return null;
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  if (range <= 0) return null;
  if (range < atr * 0.55) return null;
  const closePos = (bar.close - bar.low) / range;
  const band = Math.max((resistance - support) * 0.08, atr * 0.35);
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const bodyFrac = Math.abs(bar.close - bar.open) / range;

  const highPierce = bar.high >= resistance + band * 0.2;
  const lowPierce = bar.low <= support - band * 0.2;
  const highReject = bar.close < resistance && closePos <= 0.42 && upperWick / range >= 0.32;
  const lowReject = bar.close > support && closePos >= 0.58 && lowerWick / range >= 0.32;

  if (highPierce && closePos >= 0.7 && bodyFrac >= 0.45) return null;
  if (lowPierce && closePos <= 0.3 && bodyFrac >= 0.45) return null;

  if (highPierce && highReject && huntFlowConfirms(bar, 'HIGH', prior)) {
    if (levels.resistanceTouches < 2 && closePos > 0.35) return null;
    return 'HIGH';
  }
  if (lowPierce && lowReject && huntFlowConfirms(bar, 'LOW', prior)) {
    if (levels.supportTouches < 2 && closePos < 0.65) return null;
    return 'LOW';
  }
  return null;
}

function huntFlowConfirms(bar, kind, prior) {
  const absorbed = barAbsorbed(bar);
  const win = fpBarWinner(bar);
  const vol = (bar.totalBuy ?? 0) + (bar.totalSell ?? 0);
  const delta = (bar.totalBuy ?? 0) - (bar.totalSell ?? 0);
  const range = Math.max(bar.high - bar.low, 1e-9);
  const closePos = (bar.close - bar.low) / range;
  const deltaPct = vol > 0 ? delta / vol : 0;
  const priorVac =
    prior.length > 0 ? barVacuumKind(prior[prior.length - 1], prior.slice(0, -1)) : null;
  const vacuumInto =
    (kind === 'LOW' && priorVac === 'DOWNSIDE') || (kind === 'HIGH' && priorVac === 'UPSIDE');

  if (kind === 'LOW') {
    if (absorbed === 'SELLERS') return true;
    if (win.id === 'PASSIVE_BUYERS' || win.id === 'AGGRESSIVE_BUYERS') return true;
    if (vol > 0 && deltaPct <= -0.12 && closePos >= 0.62) return true;
    if (vacuumInto && closePos >= 0.68) return true;
    if (vol > 0 && vol < 50 && closePos >= 0.7) return true;
    return false;
  }
  if (absorbed === 'BUYERS') return true;
  if (win.id === 'PASSIVE_SELLERS' || win.id === 'AGGRESSIVE_SELLERS') return true;
  if (vol > 0 && deltaPct >= 0.12 && closePos <= 0.38) return true;
  if (vacuumInto && closePos <= 0.32) return true;
  if (vol > 0 && vol < 50 && closePos <= 0.3) return true;
  return false;
}

/** Vacuum stretch score 0–100 — only extreme stretches clear the dominance gate. */
function vacuumStretchScore(bar, prior) {
  const atr = recentBarAtr(prior, bar);
  const range = bar.high - bar.low;
  const stretch = atr > 0 ? range / atr : 1;
  return Math.max(0, Math.min(100, 40 + (stretch - 1) * 35));
}

const LIQ_DOMINANCE_SCORE = 70;
const LIQ_DOMINANCE_MARGIN = 15;

const ER_MEANINGFUL_EFFORT = 60;
const ER_STRONG_EFFORT = 75;
const ER_MEANINGFUL_RESULT = 50;
const ER_STRONG_RESULT = 70;
const ER_LOW_RESULT = 30;
const ER_DEFENSE_MIN = 60;

function erPctRank(values, value) {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!xs.length || !(value > 0)) return value > 0 ? 55 : 0;
  let below = 0;
  let atOrBelow = 0;
  for (const v of xs) {
    if (v < value) below += 1;
    if (v <= value) atOrBelow += 1;
  }
  return ((below + atOrBelow) / 2 / xs.length) * 100;
}

function erMedian(values) {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Client footprint effort vs result — mirrors the TS engine for candle labels.
 * Uses only `bar` + prior bars (no future).
 */
function evaluateEffortResultForBar(bar, prior, sellerDefense = null, buyerDefense = null) {
  const range = Math.max((bar.high ?? 0) - (bar.low ?? 0), 1e-12);
  const closePos = Math.min(1, Math.max(0, ((bar.close ?? 0) - (bar.low ?? 0)) / range));
  const upDisp = Math.max((bar.close ?? 0) - (bar.open ?? 0), 0);
  const downDisp = Math.max((bar.open ?? 0) - (bar.close ?? 0), 0);
  const buyVol = Math.max(0, bar.totalBuy ?? 0);
  const sellVol = Math.max(0, bar.totalSell ?? 0);
  const buyTrades = Math.max(0, bar.buyTrades ?? 0);
  const sellTrades = Math.max(0, bar.sellTrades ?? 0);
  const buyIntensity = buyTrades > 0 ? buyVol / buyTrades : buyVol;
  const sellIntensity = sellTrades > 0 ? sellVol / sellTrades : sellVol;
  const atr = recentBarAtr(prior, bar) || range;
  const medRange = erMedian(prior.map((b) => (b.high ?? 0) - (b.low ?? 0))) || range;

  const buyVolHist = prior.map((b) => b.totalBuy ?? 0).concat(buyVol);
  const sellVolHist = prior.map((b) => b.totalSell ?? 0).concat(sellVol);
  const upHist = prior.map((b) => Math.max((b.close ?? 0) - (b.open ?? 0), 0)).concat(upDisp);
  const downHist = prior.map((b) => Math.max((b.open ?? 0) - (b.close ?? 0), 0)).concat(downDisp);

  const buyEffort = Math.min(100, Math.max(0,
    0.45 * erPctRank(buyVolHist, buyVol) +
    0.2 * erPctRank(prior.map((b) => {
      const t = b.buyTrades ?? 0;
      return t > 0 ? (b.totalBuy ?? 0) / t : (b.totalBuy ?? 0);
    }).concat(buyIntensity), buyIntensity) +
    0.2 * (buyVol > 0 ? Math.min(1, Math.max(0, buyVol - sellVol) / buyVol) * 100 : 0) +
    0.15 * (buyVol > 0 ? Math.min(1, (bar.largestBuy ?? 0) / buyVol) * 100 : 0),
  ));
  const sellEffort = Math.min(100, Math.max(0,
    0.45 * erPctRank(sellVolHist, sellVol) +
    0.2 * erPctRank(prior.map((b) => {
      const t = b.sellTrades ?? 0;
      return t > 0 ? (b.totalSell ?? 0) / t : (b.totalSell ?? 0);
    }).concat(sellIntensity), sellIntensity) +
    0.2 * (sellVol > 0 ? Math.min(1, Math.max(0, sellVol - buyVol) / sellVol) * 100 : 0) +
    0.15 * (sellVol > 0 ? Math.min(1, (bar.largestSell ?? 0) / sellVol) * 100 : 0),
  ));

  const scale = Math.max(atr, medRange, 1e-12);
  const upResult = Math.min(100, Math.max(0,
    0.35 * Math.min(2, upDisp / scale) / 2 * 100 +
    0.25 * erPctRank(upHist, upDisp) +
    0.25 * closePos * 100 +
    0.15 * (prior.length && bar.close > prior[prior.length - 1].close ? 100 : 25),
  ));
  const downResult = Math.min(100, Math.max(0,
    0.35 * Math.min(2, downDisp / scale) / 2 * 100 +
    0.25 * erPctRank(downHist, downDisp) +
    0.25 * (1 - closePos) * 100 +
    0.15 * (prior.length && bar.close < prior[prior.length - 1].close ? 100 : 25),
  ));

  const buyEff = buyEffort < 5 ? upResult : Math.min(100, 0.55 * Math.min(100, (upResult / Math.max(buyEffort, 1)) * 100) + 0.45 * upResult);
  const sellEff = sellEffort < 5 ? downResult : Math.min(100, 0.55 * Math.min(100, (downResult / Math.max(sellEffort, 1)) * 100) + 0.45 * downResult);

  let buyAttack = 'NO_MEANINGFUL_BUY_ATTACK';
  if (buyEffort >= ER_MEANINGFUL_EFFORT) {
    if (buyEffort >= ER_STRONG_EFFORT && upResult <= ER_LOW_RESULT && sellerDefense != null && sellerDefense >= ER_DEFENSE_MIN) {
      buyAttack = 'BUYER_ABSORPTION';
    } else if (buyEffort >= ER_STRONG_EFFORT && upResult >= ER_STRONG_RESULT) buyAttack = 'BUY_ATTACK_SUCCESSFUL';
    else if (buyEffort >= ER_MEANINGFUL_EFFORT && upResult >= ER_MEANINGFUL_RESULT) buyAttack = 'BUY_ATTACK_WEAK';
    else if (upResult <= ER_LOW_RESULT) buyAttack = 'BUY_ATTACK_FAILED';
    else buyAttack = 'BUY_ATTACK_WEAK';
  }

  let sellAttack = 'NO_MEANINGFUL_SELL_ATTACK';
  if (sellEffort >= ER_MEANINGFUL_EFFORT) {
    if (sellEffort >= ER_STRONG_EFFORT && downResult <= ER_LOW_RESULT && buyerDefense != null && buyerDefense >= ER_DEFENSE_MIN) {
      sellAttack = 'SELLER_ABSORPTION';
    } else if (sellEffort >= ER_STRONG_EFFORT && downResult >= ER_STRONG_RESULT) sellAttack = 'SELL_ATTACK_SUCCESSFUL';
    else if (sellEffort >= ER_MEANINGFUL_EFFORT && downResult >= ER_MEANINGFUL_RESULT) sellAttack = 'SELL_ATTACK_WEAK';
    else if (downResult <= ER_LOW_RESULT) sellAttack = 'SELL_ATTACK_FAILED';
    else sellAttack = 'SELL_ATTACK_WEAK';
  }

  let interpretation = 'NO_CLEAR_RESULT';
  if (buyAttack === 'BUYER_ABSORPTION' || (buyEffort >= ER_STRONG_EFFORT && upResult <= ER_LOW_RESULT)) {
    interpretation = 'BUYERS_ABSORBED';
  } else if (sellAttack === 'SELLER_ABSORPTION' || (sellEffort >= ER_STRONG_EFFORT && downResult <= ER_LOW_RESULT)) {
    interpretation = 'SELLERS_ABSORBED';
  } else if (upResult >= ER_STRONG_RESULT && buyEffort < ER_STRONG_EFFORT && buyEffort >= 35 && (sellerDefense == null || sellerDefense <= 35)) {
    interpretation = 'UPSIDE_VACUUM';
  } else if (downResult >= ER_STRONG_RESULT && sellEffort < ER_STRONG_EFFORT && sellEffort >= 35 && (buyerDefense == null || buyerDefense <= 35)) {
    interpretation = 'DOWNSIDE_VACUUM';
  } else if (buyAttack === 'BUY_ATTACK_SUCCESSFUL' || (buyEffort >= ER_STRONG_EFFORT && upResult >= ER_STRONG_RESULT)) {
    interpretation = 'BUYERS_EFFECTIVE';
  } else if (sellAttack === 'SELL_ATTACK_SUCCESSFUL' || (sellEffort >= ER_STRONG_EFFORT && downResult >= ER_STRONG_RESULT)) {
    interpretation = 'SELLERS_EFFECTIVE';
  } else if (buyEffort < ER_MEANINGFUL_EFFORT && sellEffort < ER_MEANINGFUL_EFFORT) {
    interpretation = 'NO_CLEAR_RESULT';
  } else {
    interpretation = 'BALANCED';
  }

  const levels = Array.isArray(bar.levels) ? bar.levels : [];
  let buyNearHigh = 0;
  let sellNearLow = 0;
  let buyTot = 0;
  let sellTot = 0;
  const highCut = (bar.high ?? 0) - range * 0.25;
  const lowCut = (bar.low ?? 0) + range * 0.25;
  for (const lv of levels) {
    const b = lv.buy ?? lv[1] ?? 0;
    const s = lv.sell ?? lv[2] ?? 0;
    const px = lv.price ?? lv[0] ?? 0;
    buyTot += b;
    sellTot += s;
    if (px >= highCut) buyNearHigh += b;
    if (px <= lowCut) sellNearLow += s;
  }
  let aggressionLocation = 'MID';
  if (buyVol >= sellVol) {
    if (buyTot > 0 && buyNearHigh / buyTot >= 0.55) aggressionLocation = 'HIGH';
    else if (buyTot > 0 && buyNearHigh / buyTot >= 0.35) aggressionLocation = 'UPPER_THIRD';
  } else if (sellTot > 0 && sellNearLow / sellTot >= 0.55) aggressionLocation = 'LOW';
  else if (sellTot > 0 && sellNearLow / sellTot >= 0.35) aggressionLocation = 'LOWER_THIRD';

  const reasons = [];
  if (interpretation === 'BUYERS_EFFECTIVE') reasons.push('high buy effort', 'strong upward result');
  else if (interpretation === 'SELLERS_EFFECTIVE') reasons.push('high sell effort', 'strong downward result');
  else if (interpretation === 'BUYERS_ABSORBED') {
    reasons.push('high buy effort', 'poor upward displacement');
    if (sellerDefense != null && sellerDefense >= ER_DEFENSE_MIN) reasons.push('strong ask defense');
  } else if (interpretation === 'SELLERS_ABSORBED') {
    reasons.push('high sell effort', 'poor downward displacement');
    if (buyerDefense != null && buyerDefense >= ER_DEFENSE_MIN) reasons.push('strong bid defense');
  } else if (interpretation === 'UPSIDE_VACUUM') reasons.push('moderate buy effort', 'easy upward movement');
  else if (interpretation === 'DOWNSIDE_VACUUM') reasons.push('moderate sell effort', 'easy downward movement');

  return {
    buyEffort: Math.round(buyEffort),
    sellEffort: Math.round(sellEffort),
    upResult: Math.round(upResult),
    downResult: Math.round(downResult),
    buyEfficiency: Math.round(buyEff),
    sellEfficiency: Math.round(sellEff),
    buyAttackState: buyAttack,
    sellAttackState: sellAttack,
    interpretation,
    aggressionLocation,
    sellerDefense,
    buyerDefense,
    closePosition: closePos,
    reasons,
  };
}

function effortResultTraderLabel(interpretation) {
  switch (interpretation) {
    case 'BUYERS_EFFECTIVE': return 'BUYERS EFFECTIVE';
    case 'SELLERS_EFFECTIVE': return 'SELLERS EFFECTIVE';
    case 'BUYERS_ABSORBED': return 'BUYERS ABSORBED';
    case 'SELLERS_ABSORBED': return 'SELLERS ABSORBED';
    case 'UPSIDE_VACUUM': return 'UPSIDE VACUUM';
    case 'DOWNSIDE_VACUUM': return 'DOWNSIDE VACUUM';
    case 'BALANCED': return 'BALANCED';
    default: return 'NO CLEAR RESULT';
  }
}

function effortResultStory(er) {
  if (!er) return null;
  const label = effortResultTraderLabel(er.interpretation);
  if (er.interpretation === 'NO_CLEAR_RESULT') return null;
  const color =
    er.interpretation === 'BUYERS_EFFECTIVE' || er.interpretation === 'SELLERS_ABSORBED' || er.interpretation === 'UPSIDE_VACUUM'
      ? '#22c55e'
      : er.interpretation === 'SELLERS_EFFECTIVE' || er.interpretation === 'BUYERS_ABSORBED' || er.interpretation === 'DOWNSIDE_VACUUM'
        ? '#ef4444'
        : '#8b949e';
  const badge =
    er.interpretation === 'BUYERS_EFFECTIVE' || er.interpretation === 'SELLERS_ABSORBED' || er.interpretation === 'UPSIDE_VACUUM'
      ? 'LONG'
      : er.interpretation === 'SELLERS_EFFECTIVE' || er.interpretation === 'BUYERS_ABSORBED' || er.interpretation === 'DOWNSIDE_VACUUM'
        ? 'SHORT'
        : 'WAIT';
  const effort = er.interpretation.startsWith('BUY') || er.interpretation === 'UPSIDE_VACUUM' ? er.buyEffort : er.sellEffort;
  const result = er.interpretation.startsWith('BUY') || er.interpretation === 'UPSIDE_VACUUM' ? er.upResult : er.downResult;
  return {
    badge,
    line1: label,
    line2: `effort ${effort} · result ${result}`,
    color,
    effortResult: er,
  };
}

function locationTraderLabelFromBar(bar, prior) {
  const loc = barLocationFromPrior(bar, prior);
  if (loc === 'AT_SUPPORT') return 'AT SUPPORT';
  if (loc === 'BELOW_SUPPORT') return 'BELOW SUPPORT';
  if (loc === 'AT_RESISTANCE') return 'AT RESISTANCE';
  if (loc === 'ABOVE_RESISTANCE') return 'ABOVE RESISTANCE';
  if (loc === 'MID_RANGE') return 'BETWEEN LEVELS';
  return '';
}

function withLocationSubtitle(story, locLabel) {
  if (!story || !locLabel) return story;
  return { ...story, line2: locLabel, locationLabel: locLabel };
}

/**
 * Layered candle story (CONTROL / LIQUIDITY / SPECIAL / OUTCOME).
 * Compact headline priority: special → control → extreme dominant liquidity.
 * No next-bar lookahead.
 */
function strategyStoryForBar(allBars, idx) {
  const bar = allBars[idx];
  const prior = allBars.slice(Math.max(0, idx - 20), idx);
  const win = fpBarWinner(bar);
  const absorbed = barAbsorbed(bar);
  const location = barLocationFromPrior(bar, prior);
  const locLabel = locationTraderLabelFromBar(bar, prior);
  const move = bar.close - bar.open;
  const range = Math.max(bar.high - bar.low, 1e-9);
  const bodyFrac = Math.abs(move) / range;
  const vac = barVacuumKind(bar, prior);
  const stretch = vacuumStretchScore(bar, prior);

  // Effort vs result is the primary candle interpretation (who attacked vs who won).
  const battle = barBattlePercents(bar);
  let sellerDefense = null;
  let buyerDefense = null;
  if (battle) {
    const buyAbs = battle.find((r) => r.text === 'Buy abs');
    const sellAbs = battle.find((r) => r.text === 'Sell abs');
    // Proxy defense from failed aggression share on the candle.
    sellerDefense = buyAbs?.pct ?? null;
    buyerDefense = sellAbs?.pct ?? null;
  }
  const er = evaluateEffortResultForBar(bar, prior, sellerDefense, buyerDefense);
  const erStory = effortResultStory(er);

  // CONTROL
  let control = 'UNCLEAR';
  if (win.id === 'AGGRESSIVE_BUYERS') control = 'BUYER_IN_CONTROL';
  else if (win.id === 'AGGRESSIVE_SELLERS') control = 'SELLER_IN_CONTROL';
  else if (win.id === 'PASSIVE_BUYERS' || win.id === 'PASSIVE_SELLERS' || win.id === 'BALANCED') control = 'BALANCED';

  // SPECIAL EVENT
  let special = null;
  const hunt = stopHuntKind(bar, prior);
  if (hunt === 'HIGH') special = 'STOP_HUNT_HIGH';
  else if (hunt === 'LOW') special = 'STOP_HUNT_LOW';
  else if (location === 'AT_SUPPORT' && (absorbed === 'SELLERS' || win.id === 'PASSIVE_BUYERS' || win.id === 'AGGRESSIVE_BUYERS')) {
    special = 'HELD_SUPPORT';
  } else if (location === 'AT_RESISTANCE' && (absorbed === 'BUYERS' || win.id === 'PASSIVE_SELLERS' || win.id === 'AGGRESSIVE_SELLERS')) {
    special = 'REJECTED_RESISTANCE';
  } else if (er.interpretation === 'SELLERS_ABSORBED' || absorbed === 'SELLERS' || win.id === 'PASSIVE_BUYERS') special = 'SELLER_ABSORBED';
  else if (er.interpretation === 'BUYERS_ABSORBED' || absorbed === 'BUYERS' || win.id === 'PASSIVE_SELLERS') special = 'BUYER_ABSORBED';

  // LIQUIDITY — heuristic pull only; never forced as headline without dominance.
  let askPull = vac === 'UPSIDE' ? stretch : 0;
  let bidPull = vac === 'DOWNSIDE' ? stretch : 0;
  // Consumption proxy from battle shares (display only; not book accounting).
  let askConsume = 0;
  let bidConsume = 0;
  if (battle) {
    const asks = battle.find((r) => r.text === 'Asks');
    const bids = battle.find((r) => r.text === 'Bids');
    askConsume = asks?.pct ?? 0;
    bidConsume = bids?.pct ?? 0;
  }
  const liqCandidates = [
    { event: 'ASKS_PULLED', score: askPull },
    { event: 'BIDS_PULLED', score: bidPull },
    { event: 'ASKS_CONSUMED', score: askConsume },
    { event: 'BIDS_CONSUMED', score: bidConsume },
  ].sort((a, b) => b.score - a.score);
  const topLiq = liqCandidates[0];
  const secondLiq = liqCandidates[1];
  const liqDominant =
    topLiq &&
    topLiq.score >= LIQ_DOMINANCE_SCORE &&
    topLiq.score - (secondLiq?.score ?? 0) >= LIQ_DOMINANCE_MARGIN
      ? topLiq.event
      : 'NONE';

  // OUTCOME (same candle only)
  let outcome = 'NEUTRAL';
  let outcomeDir = move > 0 ? 'UP' : move < 0 ? 'DOWN' : 'NONE';
  if (special === 'STOP_HUNT_LOW' || special === 'STOP_HUNT_HIGH') {
    outcome = 'REVERSAL';
    outcomeDir = special === 'STOP_HUNT_LOW' ? 'UP' : 'DOWN';
  } else if (special === 'BUYER_ABSORBED' || special === 'SELLER_ABSORBED') {
    outcome = bodyFrac < 0.3 ? 'NO_FOLLOW_THROUGH' : 'PRICE_FAILED';
  } else if (
    (control === 'BUYER_IN_CONTROL' && move > 0) ||
    (control === 'SELLER_IN_CONTROL' && move < 0)
  ) {
    outcome = bodyFrac >= 0.3 ? 'PRICE_FOLLOWED' : 'CONTINUATION';
  }

  const detail = {
    control,
    liquidity: liqDominant,
    special,
    outcome,
    outcomeDir,
    askPull,
    bidPull,
    askConsume,
    bidConsume,
    effortResult: er,
    location,
    locationLabel: locLabel,
  };

  // Prefer compact effort/result trader labels over legacy control copy.
  if (erStory && (
    er.interpretation === 'BUYERS_EFFECTIVE' ||
    er.interpretation === 'SELLERS_EFFECTIVE' ||
    er.interpretation === 'BUYERS_ABSORBED' ||
    er.interpretation === 'SELLERS_ABSORBED' ||
    er.interpretation === 'UPSIDE_VACUUM' ||
    er.interpretation === 'DOWNSIDE_VACUUM'
  )) {
    // Keep stop-hunt / structure specials first — they are location events.
    if (special !== 'STOP_HUNT_HIGH' && special !== 'STOP_HUNT_LOW' && special !== 'HELD_SUPPORT' && special !== 'REJECTED_RESISTANCE') {
      return withLocationSubtitle({ ...erStory, detail }, locLabel);
    }
  }

  // Headline priority: special → control → extreme liquidity
  if (special === 'STOP_HUNT_HIGH') {
    return withLocationSubtitle({ badge: 'SHORT', line1: 'Stop hunt high', line2: outcomeLine(outcome, outcomeDir), color: '#e879f9', detail }, locLabel || 'AT RESISTANCE');
  }
  if (special === 'STOP_HUNT_LOW') {
    return withLocationSubtitle({ badge: 'LONG', line1: 'Stop hunt low', line2: outcomeLine(outcome, outcomeDir), color: '#e879f9', detail }, locLabel || 'AT SUPPORT');
  }
  if (special === 'HELD_SUPPORT') {
    return { badge: 'LONG', line1: 'Held support', line2: locLabel || 'AT SUPPORT', color: '#22c55e', detail };
  }
  if (special === 'REJECTED_RESISTANCE') {
    return { badge: 'SHORT', line1: 'Rejected resist', line2: locLabel || 'AT RESISTANCE', color: '#ef4444', detail };
  }
  if (erStory) {
    return withLocationSubtitle({ ...erStory, detail }, locLabel);
  }
  if (special === 'SELLER_ABSORBED') {
    return withLocationSubtitle({ badge: biasFromControl(control, 'WAIT'), line1: 'Sellers absorbed', line2: 'bids held', color: '#7dd3fc', detail }, locLabel);
  }
  if (special === 'BUYER_ABSORBED') {
    return withLocationSubtitle({ badge: biasFromControl(control, 'WAIT'), line1: 'Buyers absorbed', line2: 'asks held', color: '#fbbf24', detail }, locLabel);
  }

  if (control === 'BUYER_IN_CONTROL') {
    const sub = locLabel || (liqDominant !== 'NONE' && topLiq.score >= 85
      ? liqHeadline(liqDominant)
      : outcomeLine(outcome, outcomeDir));
    return { badge: 'LONG', line1: 'Buyer in control', line2: sub, color: '#22c55e', detail };
  }
  if (control === 'SELLER_IN_CONTROL') {
    const sub = locLabel || (liqDominant !== 'NONE' && topLiq.score >= 85
      ? liqHeadline(liqDominant)
      : outcomeLine(outcome, outcomeDir));
    return { badge: 'SHORT', line1: 'Seller in control', line2: sub, color: '#ef4444', detail };
  }

  if (liqDominant !== 'NONE' && topLiq.score >= 85) {
    const badge = liqDominant.includes('ASK') ? 'LONG' : 'SHORT';
    return {
      badge,
      line1: liqHeadline(liqDominant),
      line2: locLabel || outcomeLine(outcome, outcomeDir),
      color: badge === 'LONG' ? '#22d3ee' : '#fb923c',
      detail,
    };
  }

  return { badge: 'WAIT', line1: locLabel || 'No clear edge', line2: locLabel ? 'location only' : '', color: '#8b949e', detail };
}

function biasFromControl(control, fallback) {
  if (control === 'BUYER_IN_CONTROL') return 'LONG';
  if (control === 'SELLER_IN_CONTROL') return 'SHORT';
  return fallback;
}

/** Compact live-candle badge from tradeDecision when available. */
function liveDecisionStory(symbol) {
  const summary = symbol === selectedSymbol ? lastSummary : null;
  const w = summary?.windows?.['1m'] ?? summary?.windows?.['10s'] ?? null;
  const td = w?.tradeDecision;
  if (!td) {
    return { badge: 'NOW', line1: 'This candle', line2: 'still forming', color: '#60a5fa' };
  }
  const battle = w.marketBattle;
  const current = pickCurrentBattle(battle, w.wallMap);
  const mapped = mapDecision(td, current);
  const color = mapped.label.startsWith('LONG') ? '#22c55e'
    : mapped.label.startsWith('SHORT') ? '#ef4444'
      : '#8b949e';
  const line2 = mapped.label === 'WAIT'
    ? (mapped.blocker || current.state || 'waiting')
    : (mapped.reasons[0] || current.state || '');
  return {
    badge: mapped.label === 'LONG FORMING' || mapped.label === 'SHORT FORMING' ? mapped.label : mapped.label,
    line1: mapped.label === 'WAIT' ? (current.state || 'No clear edge') : (current.state || mapped.headline || ''),
    line2: String(line2).slice(0, 28),
    color,
  };
}

function outcomeLine(outcome, dir) {
  if (outcome === 'PRICE_FOLLOWED') return dir === 'UP' ? 'price followed up' : dir === 'DOWN' ? 'price followed down' : 'price followed';
  if (outcome === 'REVERSAL') return dir === 'UP' ? 'reversed up' : dir === 'DOWN' ? 'reversed down' : 'reversal';
  if (outcome === 'CONTINUATION') return 'continuation';
  if (outcome === 'NO_FOLLOW_THROUGH') return 'no follow-through';
  if (outcome === 'PRICE_FAILED') return 'price failed';
  if (outcome === 'PENDING') return 'pending';
  return '';
}

function liqHeadline(event) {
  switch (event) {
    case 'ASKS_PULLED': return 'Asks pulled';
    case 'BIDS_PULLED': return 'Bids pulled';
    case 'ASKS_CONSUMED': return 'Asks consumed';
    case 'BIDS_CONSUMED': return 'Bids consumed';
    case 'ASKS_REPLENISHED': return 'Asks replenished';
    case 'BIDS_REPLENISHED': return 'Bids replenished';
    case 'ASKS_SURVIVING': return 'Asks surviving';
    case 'BIDS_SURVIVING': return 'Bids surviving';
    default: return '';
  }
}

/** Detailed multi-layer tooltip text for a story. */
function strategyStoryTooltip(story) {
  if (!story?.detail) return '';
  const d = story.detail;
  const er = d.effortResult;
  if (er) {
    const effLabel = (n) => (n >= 70 ? 'HIGH' : n >= 45 ? 'MOD' : 'LOW');
    const lines = [
      'FOOTPRINT RESULT',
      `Buy Effort  ${er.buyEffort}`,
      `Sell Effort  ${er.sellEffort}`,
      `Up Result  ${er.upResult}`,
      `Down Result  ${er.downResult}`,
      `Buy Efficiency  ${effLabel(er.buyEfficiency)}`,
      `Sell Efficiency  ${effLabel(er.sellEfficiency)}`,
    ];
    if (er.sellerDefense != null) lines.push(`Seller Defense  ${Math.round(er.sellerDefense)}`);
    if (er.buyerDefense != null) lines.push(`Buyer Defense  ${Math.round(er.buyerDefense)}`);
    lines.push(`Aggression Loc  ${fmtToken(er.aggressionLocation)}`);
    lines.push(`Interpretation  ${effortResultTraderLabel(er.interpretation)}`);
    if (er.reasons?.length) {
      lines.push('Reason:');
      for (const r of er.reasons) lines.push(`  ${r}`);
    }
    lines.push('', `CONTROL  ${fmtToken(d.control)}`);
    lines.push(`SPECIAL  ${fmtToken(d.special || 'NONE')}`);
    lines.push(`OUTCOME  ${fmtToken(d.outcome)}${d.outcomeDir && d.outcomeDir !== 'NONE' ? ' ' + d.outcomeDir : ''}`);
    return lines.join('\n');
  }
  const lines = [
    `CONTROL  ${fmtToken(d.control)}`,
    `LIQUIDITY  ${fmtToken(d.liquidity)}`,
    `  ask consumed ${Math.round(d.askConsume)}  pulled ${Math.round(d.askPull)}`,
    `  bid consumed ${Math.round(d.bidConsume)}  pulled ${Math.round(d.bidPull)}`,
    `SPECIAL  ${fmtToken(d.special || 'NONE')}`,
    `OUTCOME  ${fmtToken(d.outcome)}${d.outcomeDir && d.outcomeDir !== 'NONE' ? ' ' + d.outcomeDir : ''}`,
  ];
  return lines.join('\n');
}

function fmtToken(v) {
  return String(v || 'NONE').replace(/_/g, ' ').toLowerCase();
}

function drawBarBattlePercents(ctx, rows, cx, y0, maxW) {
  if (!rows?.length) return;
  const lineH = 11;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  rows.forEach((row, i) => {
    const y = y0 + i * lineH;
    const label = `${row.text} ${row.pct}%`;
    ctx.font = row.strong ? '700 9px Inter, system-ui, sans-serif' : '500 9px Inter, system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(label, cx, y, maxW);
    ctx.globalAlpha = row.strong ? 1 : 0.5;
    ctx.fillStyle = row.color;
    ctx.fillText(label, cx, y, maxW);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function drawBarStrategyTitle(ctx, story, cx, maxW) {
  if (!story) return;
  const title = story.line1 || '';
  const sub = story.line2 || '';
  const maxTextW = Math.max(72, Math.min(maxW, 132));
  const top = 14;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const drawLine = (text, y, font, color) => {
    if (!text) return;
    ctx.font = font;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, y, maxTextW);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y, maxTextW);
  };
  drawLine(story.badge, top, 'bold 11px Inter, system-ui, sans-serif', story.color);
  drawLine(title, top + 15, '600 11px Inter, system-ui, sans-serif', '#f4f6f9');
  if (sub) drawLine(sub, top + 29, '500 10px Inter, system-ui, sans-serif', '#c5ccd6');
  ctx.restore();
}

const PATTERN_LABEL_NAMES = {
  BUYER_IN_CONTROL: 'Buyer In Control',
  SELLER_IN_CONTROL: 'Seller In Control',
  STOP_HUNT_LOW: 'Stop Hunt Low',
  STOP_HUNT_HIGH: 'Stop Hunt High',
  BUYER_ABSORBED: 'Buyer Absorbed',
  SELLER_ABSORBED: 'Seller Absorbed',
  ASKS_PULLED: 'Asks Pulled',
  BIDS_PULLED: 'Bids Pulled',
  ASKS_CONSUMED: 'Asks Consumed',
  BIDS_CONSUMED: 'Bids Consumed',
  HELD_SUPPORT: 'Held Support',
  REJECTED_RESISTANCE: 'Rejected Resistance',
  BALANCED: 'Balanced',
  UNCLEAR: 'Unclear',
  NONE: 'None',
  UNCLASSIFIED: 'Unclassified',
  OTHER: 'Other',
};

const PATTERN_FULL_NAMES = {
  BR: 'bullish reversal',
  ER: 'bearish reversal',
  BC: 'bullish continuation',
  SC: 'bearish continuation',
  FB: 'failed bearish reversal',
  FU: 'failed bullish reversal',
  BT: 'buyer trap',
  SR: 'seller trap',
  BULLISH_LIQUIDITY_REVERSAL: 'bullish reversal',
  BEARISH_LIQUIDITY_REVERSAL: 'bearish reversal',
  BULLISH_CONTINUATION: 'bullish continuation',
  BEARISH_CONTINUATION: 'bearish continuation',
  FAILED_BEARISH_REVERSAL: 'failed bearish reversal',
  FAILED_BULLISH_REVERSAL: 'failed bullish reversal',
  BUYER_TRAP_FORMING: 'buyer trap',
  SELLER_TRAP_FORMING: 'seller trap',
};

function patternFullName(marker) {
  if (!marker) return '';
  return (
    PATTERN_FULL_NAMES[marker.badge] ||
    PATTERN_FULL_NAMES[marker.id] ||
    String(marker.title || marker.badge || '').toLowerCase()
  );
}

function patternStatusLabel(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FORMING' || s === 'PREVIEW') return 'FORMING';
  if (s === 'CONFIRMED') return 'CONFIRMED';
  if (s === 'FAILED') return 'FAILED';
  if (s === 'EXPIRED') return 'EXPIRED';
  return String(status || '').toUpperCase();
}

function patternProgressPct(marker) {
  const n = Number(marker?.progress);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function titleCaseName(name) {
  if (!name) return '';
  return String(name).replace(/\b\w/g, (c) => c.toUpperCase());
}

function pct1(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

function patternHudText(marker) {
  const name = patternFullName(marker);
  const st = patternStatusLabel(marker.status);
  const statusBit = name.includes('still forming') ? '' : `  ${st}`;
  return `${name}${statusBit}  ${Math.round(marker.confidence ?? 0)}%`;
}

function patternStoreKey(symbol, tf = chartTfMinutes, exchange = selectedExchange) {
  return historyKey(symbol, tf, exchange);
}

function patternMarkersFor(symbol) {
  return fpPatternStore[patternStoreKey(symbol)]?.markers ?? [];
}

function drawPatternBadge(ctx, marker, cx, y) {
  const text = patternFullName(marker);
  if (!text) return { x: cx - 16, y: y - 10, w: 32, h: 18 };
  const confirmed = marker.status === 'CONFIRMED';
  const forming = marker.status === 'FORMING' || marker.status === 'PREVIEW';
  const color = marker.direction === 'BULLISH' ? '#4ade80' : marker.direction === 'BEARISH' ? '#fb923c' : '#94a3b8';
  ctx.save();
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(148, Math.max(72, Math.ceil(ctx.measureText(text).width) + 10));
  const h = 16;
  const x = cx - w / 2;
  ctx.globalAlpha = confirmed ? 1 : forming ? 0.88 : 0.6;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x, y - h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y + 0.5, w - 8);
  ctx.restore();
  return { x, y: y - h / 2, w, h };
}

function showPatternTip(symbol, event) {
  const view = fpViews.get(symbol);
  const tip = view?.card?.querySelector('[data-fp-pattern-tip]');
  if (!view || !tip) return;
  const rect = view.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = (view.patternHits ?? []).find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  if (!hit?.marker) {
    tip.classList.add('hidden');
    return;
  }
  const m = hit.marker;
  const seq = (m.matchedLabels ?? []).map((l) => PATTERN_LABEL_NAMES[l] || l).join(' → ');
  const status = patternStatusLabel(m.status);
  tip.classList.remove('hidden');
  tip.innerHTML = `<strong>${escapeHtml(patternFullName(m) || m.title || m.id)}</strong>
    <span>Status: ${escapeHtml(status)}</span>
    <span>Progress: ${patternProgressPct(m) ?? '—'}%</span>
    <span>Pattern confidence: ${Math.round(m.confidence ?? 0)}%</span>
    <span>Sequence: ${escapeHtml(seq)}</span>
    <span>Bars: ${m.barsUsed ?? '—'} · ${m.stage ?? '?'}/${m.totalStages ?? '?'}</span>`;
  const host = view.card?.querySelector('.fp-card-canvas');
  const maxX = (host?.clientWidth ?? 200) - 220;
  tip.style.left = `${Math.max(8, Math.min(x + 12, maxX))}px`;
  tip.style.top = `${Math.max(8, y + 14)}px`;
}

function hidePatternTip(symbol) {
  const view = fpViews.get(symbol);
  view?.card?.querySelector('[data-fp-pattern-tip]')?.classList.add('hidden');
}

function applyPatternSnapshot(ev) {
  if (!ev?.symbol || (ev.market && ev.market !== footprintMarket())) return;
  const tfName = tfShort(chartTfMinutes);
  const row = (ev.snapshots ?? []).find((s) => s.timeframe === tfName);
  if (!row) return;
  const key = patternStoreKey(ev.symbol);
  const prev = fpPatternStore[key] ?? { markers: [] };
  const incoming = row.markers ?? [];
  const confirmedIncoming = incoming.filter((m) => m.status === 'CONFIRMED');
  const rest = (prev.markers ?? []).filter((m) => {
    if (m.status !== 'CONFIRMED') return false;
    return !confirmedIncoming.some((c) => c.id === m.id && c.t === m.t);
  });
  fpPatternStore[key] = {
    currentLabel: row.currentLabel ?? prev.currentLabel,
    primary: row.primary ?? prev.primary,
    currentPattern: row.currentPattern ?? prev.currentPattern,
    nextState: row.nextState ?? prev.nextState,
    markers: [...rest, ...incoming],
  };
  scheduleDraw(ev.symbol);
}

function ingestPatternAlert(alert) {
  if (!alert?.symbol) return;
  const bearish = /BEARISH|BUYER_TRAP|FAILED_BULLISH/.test(alert.patternId || '');
  if (!canFireAlert(`${alert.symbol}:${alert.patternId}:${alert.type}:${alert.timestamp}`, 60_000)) return;
  pushFpAlert({
    id: `pat-${alert.symbol}-${alert.patternId}-${alert.timestamp}`,
    symbol: alert.symbol,
    kind: (alert.type || 'pattern').replace('PATTERN_', '').toLowerCase(),
    side: bearish ? 'sell' : 'buy',
    title: alert.message || `${alert.patternId} ${alert.status}`,
    detail: `${alert.patternId} · ${alert.status} · ${alert.timeframe}`,
    at: alert.timestamp || Date.now(),
  });
}

const patternRefreshAt = {};

function fpBarToWire(bar) {
  const lv = [];
  if (bar.levels) {
    for (const lvRow of bar.levels.values()) lv.push([lvRow.price, lvRow.buy, lvRow.sell]);
  }
  return {
    t: bar.time, o: bar.open, h: bar.high, l: bar.low, c: bar.close,
    tb: bar.totalBuy ?? 0, ts: bar.totalSell ?? 0, n: 0,
    lv,
  };
}

async function refreshPatternMarkers(symbol, force = false) {
  const now = Date.now();
  if (!force && now - (patternRefreshAt[symbol] ?? 0) < 8_000) return;
  patternRefreshAt[symbol] = now;
  const bars = footprintBars(symbol);
  if (bars.length < 3) return;
  const lastIsLive = bars[bars.length - 1]?.time === fpCandleTime(Date.now(), chartTfMinutes);
  try {
    const data = await fetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        tf: chartTfMinutes,
        market: footprintMarket(),
        lastIsLive,
        bars: bars.slice(-300).map(fpBarToWire),
      }),
    }).then((r) => r.json());
    if (!data || data.error) return;
    fpPatternStore[patternStoreKey(symbol)] = {
      currentLabel: data.currentLabel ?? null,
      primary: data.primary ?? null,
      currentPattern: data.currentPattern ?? null,
      nextState: data.nextState ?? null,
      markers: data.markers ?? [],
    };
    scheduleDraw(symbol);
  } catch {
    /* live chart still works without markers */
  }
}

function drawBattleHud(ctx, leftPad, plotRight, symbol = selectedSymbol) {
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let text;
  let color = '#8b949e';
  if (isSpotView()) {
    const snap = spotFlowBySymbol[symbol];
    const w = snap ? spotWindow(snap) : null;
    if (w) {
      color = w.flow?.includes('BUY') ? '#22c55e' : w.flow?.includes('SELL') ? '#ef4444' : '#8b949e';
      text = `${(w.flow ?? 'BALANCED').replace(/_/g, ' ')}  ·  Δ ${fmtUsd(w.delta)}`;
    } else {
      text = 'Spot flow waiting…';
    }
  } else {
    const b = liveFlowBattle(symbol);
    if (b?.winner?.winner) {
      const w = b.winner.winner;
      color = w.includes('PASSIVE_SELL') ? '#fbbf24'
        : w.includes('PASSIVE_BUY') ? '#60a5fa'
        : w.includes('AGGRESSIVE_BUY') ? '#22c55e'
        : w.includes('AGGRESSIVE_SELL') ? '#ef4444'
        : '#8b949e';
      text = battleLabel(w);
    } else {
      text = 'Flow battle waiting…';
    }
  }
  ctx.fillStyle = 'rgba(13, 17, 23, 0.88)';
  ctx.fillRect(leftPad, 18, Math.min(plotRight - leftPad, 420), 14);
  ctx.fillStyle = color;
  ctx.fillText(text, leftPad + 4, 25);
}

function fmtPriceAxis(p) {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(5);
}

function drawFootprint(symbol = selectedSymbol) {
  const view = fpViews.get(symbol);
  if (!view?.ctx || !view.canvas) return;
  const W = view.canvas.width / devicePixelRatio;
  const H = view.canvas.height / devicePixelRatio;
  const ctx = view.ctx;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);

  const liveBtn = document.getElementById('chart-live-btn');
  const bars = footprintBars(symbol);
  if (bars.length === 0) {
    liveBtn?.classList.add('hidden');
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for footprint…', W / 2, H / 2);
    const meta = view.card?.querySelector('[data-fp-meta]');
    if (meta) meta.textContent = 'loading';
    return;
  }

  const { leftPad, priceAxisWidth, railW, candleW, cellW, barWidth, stride, visibleBars } = fpLayout(W);
  const topPad = 72;
  const bottomPad = 100;
  const chartH = H - topPad - bottomPad;
  clampFpPan(view, bars.length, W);
  liveBtn?.classList.toggle('hidden', [...fpViews.values()].every((v) => v.panBars < 0.15));

  const pan = Math.round(view.panBars);
  const endIdx = bars.length - pan;
  const startIdx = Math.max(0, endIdx - visibleBars);
  const visible = bars.slice(startIdx, endIdx);

  if (visible.length === 0) {
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No footprint bars yet', W / 2, H / 2);
    return;
  }

  // Bucket from the full loaded series so panning does not re-merge price levels
  // on the same candle (e.g. 01:30 looking different when you drag left).
  let seriesHigh = -Infinity;
  let seriesLow = Infinity;
  for (const bar of bars) {
    if (bar.high > seriesHigh) seriesHigh = bar.high;
    if (bar.low < seriesLow) seriesLow = bar.low;
  }
  const bucket = displayBucket(seriesHigh, seriesLow, chartH);

  let globalHigh = -Infinity;
  let globalLow = Infinity;
  for (const bar of visible) {
    if (bar.high > globalHigh) globalHigh = bar.high;
    if (bar.low < globalLow) globalLow = bar.low;
  }
  const lastBar = visible[visible.length - 1];
  const livePx = latestLivePrice(symbol, lastBar?.close ?? 0);
  const nowBucket = fpCandleTime(Date.now(), chartTfMinutes);
  const lastIsLive = pan < 0.15 && lastBar?.time === nowBucket;
  if (livePx) {
    globalHigh = Math.max(globalHigh, livePx);
    globalLow = Math.min(globalLow, livePx);
  }
  const book = orderBookFor(symbol);
  if (book && pan < 0.15 && Number.isFinite(globalHigh) && Number.isFinite(globalLow)) {
    const midPx = livePx || (globalHigh + globalLow) / 2;
    const capLo = midPx * 0.7;
    const capHi = midPx * 1.3;
    for (const lvl of book.bids) {
      const p = Number(lvl.price);
      if (p >= capLo && p < globalLow) globalLow = p;
    }
    for (const lvl of book.asks) {
      const p = Number(lvl.price);
      if (p <= capHi && p > globalHigh) globalHigh = p;
    }
  }
  globalHigh = priceToTick(globalHigh, bucket) + bucket * 2;
  globalLow = priceToTick(globalLow, bucket) - bucket * 2;
  const priceRange = globalHigh - globalLow || bucket;
  const numRows = Math.max(1, Math.round(priceRange / bucket));
  const rowH = chartH / numRows;

  function yForPrice(p) {
    return topPad + ((globalHigh - p) / priceRange) * chartH;
  }

  const bucketed = visible.map((bar) => bucketBarLevels(bar, bucket));
  let maxSide = 0;
  for (const levels of bucketed) {
    for (const lv of levels) {
      if (lv.buy > maxSide) maxSide = lv.buy;
      if (lv.sell > maxSide) maxSide = lv.sell;
    }
  }

  ctx.textBaseline = 'middle';

  const plotRight = W - priceAxisWidth - railW;
  const steps = Math.floor(priceRange / bucket);
  const labelEvery = Math.max(1, Math.floor(steps / 16));
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i += labelEvery) {
    const p = globalLow + i * bucket;
    const y = yForPrice(p);
    if (y < topPad || y > topPad + chartH) continue;
    ctx.strokeStyle = '#1c2128';
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(plotRight + railW, y);
    ctx.stroke();
    ctx.fillStyle = '#d0d7e2';
    ctx.fillText(fmtPriceAxis(p), W - 4, y);
  }

  const patternState = fpPatternStore[patternStoreKey(symbol)] ?? {};
  const primary = patternState.primary;
  const latestMarker = [...(patternState.markers ?? [])].sort((a, b) => (b.t ?? 0) - (a.t ?? 0))[0];
  const shown = primary?.badge ? primary : latestMarker;
  const labelName = PATTERN_LABEL_NAMES[patternState.currentLabel] || patternState.currentLabel || '';

  view.patternHits = [];
  const patternByTime = new Map();
  for (const marker of patternMarkersFor(symbol)) {
    if (marker?.t != null) patternByTime.set(marker.t, marker);
  }

  for (let i = 0; i < visible.length; i++) {
    const bar = visible[i];
    const levels = bucketed[i];
    const x = plotRight - (visible.length - i) * stride;
    const cellX = x + candleW + 2;
    const half = cellW / 2;
    const cx = x + barWidth / 2;
    const isLiveBar = lastIsLive && i === visible.length - 1;
    if (!isLiveBar) {
      drawBarStrategyTitle(ctx, strategyStoryForBar(bars, startIdx + i), cx, barWidth - 4);
    } else {
      drawBarStrategyTitle(ctx, liveDecisionStory(symbol), cx, barWidth - 4);
    }
    const marker = patternByTime.get(bar.time);
    if (marker) {
      const hit = drawPatternBadge(ctx, marker, cx, 54);
      view.patternHits.push({ ...hit, marker });
    }
    const poc = levels.reduce((best, lv) => (lv.buy + lv.sell > best.vol ? { vol: lv.buy + lv.sell, price: lv.price } : best), { vol: 0, price: 0 });

    ctx.fillStyle = '#12171f';
    ctx.fillRect(cellX, topPad, cellW, chartH);

    const liveEdge = lastIsLive && i === visible.length - 1 && livePx;
    const up = (liveEdge ? livePx : bar.close) >= bar.open;
    const wickX = x + candleW / 2;
    const barHigh = liveEdge ? Math.max(bar.high, livePx) : bar.high;
    const barLow = liveEdge ? Math.min(bar.low, livePx) : bar.low;
    const barClose = liveEdge ? livePx : bar.close;
    ctx.strokeStyle = up ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wickX, yForPrice(barHigh));
    ctx.lineTo(wickX, yForPrice(barLow));
    ctx.stroke();
    const bodyTop = yForPrice(Math.max(bar.open, barClose));
    const bodyBot = yForPrice(Math.min(bar.open, barClose));
    ctx.fillStyle = up ? '#22c55e' : '#ef4444';
    ctx.fillRect(x + 1, bodyTop, candleW - 2, Math.max(2, bodyBot - bodyTop));

    ctx.strokeStyle = '#2a3342';
    ctx.beginPath();
    ctx.moveTo(cellX + half, topPad);
    ctx.lineTo(cellX + half, topPad + chartH);
    ctx.stroke();

    const rh = Math.max(1, rowH - 1);
    const sellBox = half - 2;
    const buyBox = cellW - half - 2;
    const barWin = fpBarWinner(bar);
    const engineAbs =
      lastSummary?.windows?.[selectedTf]?.absorption?.type ??
      lastSummary?.windows?.['10s']?.absorption?.type ??
      lastSummary?.windows?.['1m']?.absorption?.type;
    for (const lv of levels) {
      const y = yForPrice(lv.price);
      const total = lv.buy + lv.sell;
      if (total <= 0) continue;
      if (lv.sell > 0) {
        const a = 0.22 + 0.58 * (lv.sell / Math.max(maxSide, 1));
        ctx.fillStyle = `rgba(239, 68, 68, ${a})`;
        ctx.fillRect(cellX + 1, y - rh / 2, sellBox, rh);
      }
      if (lv.buy > 0) {
        const a = 0.22 + 0.58 * (lv.buy / Math.max(maxSide, 1));
        ctx.fillStyle = `rgba(34, 197, 94, ${a})`;
        ctx.fillRect(cellX + half + 1, y - rh / 2, buyBox, rh);
      }

      // Passive sellers absorbing aggressive buys (gold on ask/buy half)
      const pasSell =
        (barWin.id === 'PASSIVE_SELLERS' || engineAbs === 'BUYER_ABSORPTION') &&
        lv.buy >= lv.sell * 1.4 &&
        lv.buy > maxSide * 0.12;
      // Passive buyers absorbing aggressive sells (blue on bid/sell half)
      const pasBuy =
        (barWin.id === 'PASSIVE_BUYERS' || engineAbs === 'SELLER_ABSORPTION') &&
        lv.sell >= lv.buy * 1.4 &&
        lv.sell > maxSide * 0.12;
      if (pasSell) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.fillRect(cellX + half + 1, y - rh / 2, buyBox, rh);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(cellX + half + 1, y - rh / 2 + 0.5, buyBox - 0.5, rh - 1);
      } else if (pasBuy) {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.28)';
        ctx.fillRect(cellX + 1, y - rh / 2, sellBox, rh);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(cellX + 1, y - rh / 2 + 0.5, sellBox - 0.5, rh - 1);
      }

      const imbBuy = lv.buy >= lv.sell * imbalanceRatio && lv.buy > maxSide * 0.15;
      const imbSell = lv.sell >= lv.buy * imbalanceRatio && lv.sell > maxSide * 0.15;
      if (imbBuy && !pasSell) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX + half + 1, y - rh / 2 + 0.5, buyBox - 0.5, rh - 1);
      } else if (imbSell && !pasBuy) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX + 1, y - rh / 2 + 0.5, sellBox - 0.5, rh - 1);
      }

      if (poc.vol > 0 && lv.price === poc.price) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX + 1, y - rh / 2 + 0.5, cellW - 2, rh - 1);
      }
      if (lv.sell > 0) {
        drawFpCellText(ctx, fmtVolShort(lv.sell), cellX + 1, y, sellBox, rh, 'right', '#fff1f2');
      }
      if (lv.buy > 0) {
        drawFpCellText(ctx, fmtVolShort(lv.buy), cellX + half + 1, y, buyBox, rh, 'left', '#ecfdf5');
      }
    }

    // Live bar: resting liquidity, replenishment, cancellation (withdraw), absorption
    if (i === visible.length - 1 && pan < 0.15) {
      drawLiveLiquidityMarks(ctx, { cellX, cellW, yForPrice, rh, topPad, chartH });
    }

    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c6cdd8';
    const d = new Date(bar.time * 1000);
    let timeLabel;
    if (chartTfMinutes >= 1440) {
      timeLabel = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    } else {
      timeLabel = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    ctx.fillText(timeLabel, cx, topPad + chartH + 14);

    const delta = bar.totalBuy - bar.totalSell;
    const barUsd = bar.totalBuy + bar.totalSell;
    if (barUsd > 0) {
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillStyle = delta >= 0 ? '#4ade80' : '#f87171';
      ctx.fillText(`${delta >= 0 ? '+' : '-'}${fmtVolShort(Math.abs(delta))}`, x + barWidth / 2, topPad + chartH + 28);
    }
    const battle = barBattlePercents(bar);
    drawBarBattlePercents(ctx, battle, cx, topPad + chartH + 40, barWidth - 2);
  }

  if (railW > 0) {
    drawPassiveRail(ctx, symbol, {
      x0: plotRight,
      railW,
      yForPrice,
      rh: Math.max(1, rowH - 1),
      topPad,
      chartH,
      bucket,
      livePx,
    });
  }

  if (livePx) {
    drawChartPriceLine(ctx, yForPrice(livePx), '#60a5fa', `LIVE ${fmtPriceAxis(livePx)}`, leftPad, plotRight + railW);
  }

  drawLocationLevelBoxes(ctx, symbol, bars, {
    leftPad,
    plotRight: plotRight + railW,
    yForPrice,
    topPad,
    chartH,
    livePx,
  });

  const storyIdx = Math.max(0, bars.length - (lastIsLive && bars.length > 1 ? 2 : 1));
  const story = bars.length ? strategyStoryForBar(bars, storyIdx) : null;
  const meta = view.card?.querySelector('[data-fp-meta]');
  if (meta) {
    const px = livePx || lastBar?.close || 0;
    const nxt = patternState.nextState;
    const cur = patternState.currentPattern;
    const pat = cur
      ? `${cur.title} ${Math.round(cur.progress ?? 0)}%`
      : shown?.badge
        ? titleCaseName(patternFullName(shown))
        : labelName
          ? `no sequence · ${labelName}`
          : 'no sequence';
    const nextBit = nxt?.prediction
      ? ` · next ${PATTERN_LABEL_NAMES[nxt.prediction] || nxt.prediction} ${pct1(nxt.probability)}`
      : '';
    const fuel = lastSummary?.windows?.['1m']?.marketFuel ?? lastSummary?.windows?.['10s']?.marketFuel;
    const fuelBit = fuel?.upsideFuel == null
      ? ''
      : ` · fuel ${Math.round(fuel.upsideFuel)}/${Math.round(fuel.downsideFuel ?? 0)} ${String(fuel.state || '').replace(/_/g, ' ').toLowerCase()}`;
    meta.textContent = story?.line1
      ? `${fmtPriceAxis(px)} · ${story.line1}${story.line2 ? ` · ${story.line2}` : ''} · ${pat}${nextBit}${fuelBit}`
      : `${fmtPriceAxis(px)} · ${pat}${nextBit}${fuelBit}`;
    meta.title = strategyStoryTooltip(story) || '';
  }
  ctx.lineWidth = 1;
}

function chartLocationLevels(symbol, bars) {
  const summary = symbol === selectedSymbol ? lastSummary : (summaries?.[symbol] ?? null);
  const loc =
    summary?.windows?.['1m']?.locationContext ??
    summary?.windows?.['10s']?.locationContext ??
    summary?.windows?.[String(chartTfMinutes)]?.locationContext ??
    null;
  let support = Number(loc?.nearestSupport?.price);
  let resistance = Number(loc?.nearestResistance?.price);
  if (!Number.isFinite(support)) support = null;
  if (!Number.isFinite(resistance)) resistance = null;

  if ((support == null || resistance == null) && bars?.length >= 3) {
    const prior = bars.slice(0, Math.max(0, bars.length - (bars[bars.length - 1]?.time === fpCandleTime(Date.now()) ? 1 : 0)));
    const swings = priorSwingLevels(prior.length ? prior : bars);
    if (support == null) support = swings.support;
    if (resistance == null) resistance = swings.resistance;
  }

  const price = Number(summary?.price) || bars?.[bars.length - 1]?.close || null;
  const state = loc?.locationContext
    ? String(loc.locationContext)
    : inferLocationState(price, support, resistance);
  return {
    support,
    resistance,
    state,
    supportBps: loc?.distanceToSupportBps ?? distBps(price, support),
    resistanceBps: loc?.distanceToResistanceBps ?? distBps(price, resistance),
    price,
  };
}

function distBps(price, level) {
  if (!(price > 0) || !(level > 0)) return null;
  return (Math.abs(price - level) / price) * 10_000;
}

function inferLocationState(price, support, resistance) {
  if (!(price > 0)) return 'UNKNOWN';
  if (support == null && resistance == null) return 'NONE';
  const near = Math.max((price || 1) * 0.0012, 1e-9);
  if (support != null && Math.abs(price - support) <= near) return 'AT_SUPPORT';
  if (resistance != null && Math.abs(price - resistance) <= near) return 'AT_RESISTANCE';
  if (support != null && price < support) return 'BELOW_SUPPORT';
  if (resistance != null && price > resistance) return 'ABOVE_RESISTANCE';
  if (support != null && Math.abs(price - support) <= near * 2.5) return 'NEAR_SUPPORT';
  if (resistance != null && Math.abs(price - resistance) <= near * 2.5) return 'NEAR_RESISTANCE';
  if (support != null && resistance != null && price > support && price < resistance) return 'BETWEEN_LEVELS';
  return 'UNKNOWN';
}

function locationStateLabel(state) {
  return String(state || 'UNKNOWN').replaceAll('_', ' ');
}

function locationStateColor(state) {
  const s = String(state || '');
  if (s.includes('SUPPORT')) return '#34d399';
  if (s.includes('RESISTANCE')) return '#f87171';
  if (s === 'BETWEEN_LEVELS') return '#93c5fd';
  if (s.includes('ABOVE') || s.includes('BREAKOUT')) return '#fb923c';
  if (s.includes('BELOW') || s.includes('BREAKDOWN')) return '#c084fc';
  return '#94a3b8';
}

/**
 * Location kind label on the footprint chart (AT SUPPORT / ABOVE RESISTANCE / …).
 * Zone bands themselves are not drawn.
 */
function drawLocationLevelBoxes(ctx, symbol, bars, layout) {
  const { plotRight, topPad, livePx } = layout;
  const levels = chartLocationLevels(symbol, bars);
  void livePx;

  ctx.save();
  const state = levels.state || 'UNKNOWN';
  const color = locationStateColor(state);
  let detail = locationStateLabel(state);
  if (state.includes('SUPPORT') && levels.supportBps != null) {
    detail += ` · ${Math.round(levels.supportBps)} bps`;
  } else if (state.includes('RESISTANCE') && levels.resistanceBps != null) {
    detail += ` · ${Math.round(levels.resistanceBps)} bps`;
  } else if (levels.support != null && levels.resistance != null) {
    detail += ` · S ${fmtPriceAxis(levels.support)} / R ${fmtPriceAxis(levels.resistance)}`;
  }
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(detail).width;
  const bx = plotRight - tw - 22;
  const by = topPad + 8;
  ctx.fillStyle = 'rgba(8, 11, 16, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  roundRectPath(ctx, bx, by, tw + 16, 22, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(detail, bx + 8, by + 11);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawChartPriceLine(ctx, y, color, label, leftPad, plotRight, labelOffset = 0) {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(leftPad, y);
  ctx.lineTo(plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const padX = 7;
  const padY = 4;
  const tw = ctx.measureText(label).width;
  const bx = leftPad + 4;
  const by = y - 12 - labelOffset;
  const bw = tw + padX * 2;
  const bh = 18;
  ctx.fillStyle = 'rgba(8, 11, 16, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const r = 5;
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, bx + padX, by + bh / 2);
  ctx.restore();
}

/**
 * Live-bar overlay. The resting sizes themselves live in the passive rail, so
 * this only marks executed-side events: consumption (filled), absorption
 * (filled but price stalled), and pulls (cancelled without a fill).
 */
function drawLiveLiquidityMarks(ctx, { cellX, cellW, yForPrice, rh, topPad, chartH }) {
  const marks = currentLiquidityResponse()?.levels ?? [];
  if (!marks.length) return;
  ctx.save();
  ctx.lineWidth = 1;
  for (const mark of marks) {
    const y = yForPrice(mark.price);
    if (y < topPad + 1 || y > topPad + chartH - 1) continue;
    const event = String(mark.event || '');

    // Thin edge strip: passive size still resting on this side of the level.
    if (mark.restingBid > 0) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.fillRect(cellX + 1, y - rh / 2 + 1, 2, Math.max(2, rh - 2));
    }
    if (mark.restingAsk > 0) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
      ctx.fillRect(cellX + cellW - 3, y - rh / 2 + 1, 2, Math.max(2, rh - 2));
    }

    // Consumption: resting size filled by aggressive trades.
    if (event.startsWith('CONSUME') && rh >= 6) {
      const askSide = event.includes('ASK');
      const x0 = askSide ? cellX + cellW - 11 : cellX + 3;
      const s = Math.min(6, Math.max(3, rh - 3));
      const y0 = y - s / 2;
      ctx.fillStyle = askSide ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(x0, y0, s, s);
    }

    // Passive orders pulled from the book without being traded against.
    if (event.startsWith('WITHDRAW') && rh >= 7) {
      const askSide = event.includes('ASK');
      const x0 = askSide ? cellX + cellW - 12 : cellX + 4;
      const s = Math.min(7, Math.max(4, rh - 3));
      const y0 = y - s / 2;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + s, y0 + s);
      ctx.moveTo(x0 + s, y0);
      ctx.lineTo(x0, y0 + s);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Absorption at this level (consumed + price not following).
    if (event.startsWith('ABSORPTION')) {
      ctx.strokeStyle = event === 'ABSORPTION_ASK' ? '#fbbf24' : '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cellX + 2, y - rh / 2 + 1, cellW - 4, Math.max(2, rh - 2));
      ctx.lineWidth = 1;
    }
  }
  ctx.restore();
}

/**
 * Resting book ladder pinned to the price axis: passive buyers (bids) grow left
 * from the centre, passive sellers (asks) grow right.
 * Behind each resting bar:
 *   - solid green/red extension = size recently consumed (filled)
 *   - hatched pink extension = size cancelled / pulled (not filled)
 */
function quoteOf(lvl) {
  const q = Number(lvl?.quoteValue);
  if (q > 0) return q;
  const price = Number(lvl?.price);
  const qty = Number(lvl?.quantity);
  return price > 0 && qty > 0 ? price * qty : 0;
}

/** Resting sizes from the live book; consume/pull overlays stay on the passive ledger. */
function railRows(symbol, bucket) {
  const book = orderBookFor(symbol);
  const fresh = Boolean(book && Date.now() - book.at < 20_000);
  const marks = symbol === selectedSymbol ? (currentLiquidityResponse()?.levels ?? []) : [];
  const led = marks.length ? updatePassiveLedger(symbol, marks) : null;
  const map = new Map();
  const ensure = (price) => {
    const p = priceToTick(price, bucket);
    const key = p.toFixed(8);
    let row = map.get(key);
    if (!row) {
      row = {
        price: p, bid: 0, ask: 0,
        cancelBid: 0, cancelAsk: 0,
        consumeBid: 0, consumeAsk: 0,
        addBid: 0, addAsk: 0,
      };
      map.set(key, row);
    }
    return row;
  };
  if (led) {
    for (const row of bucketPassiveLedger(led, bucket)) {
      const dest = ensure(row.price);
      if (!fresh) {
        dest.bid += row.bid;
        dest.ask += row.ask;
      }
      dest.cancelBid += row.cancelBid;
      dest.cancelAsk += row.cancelAsk;
      dest.consumeBid += row.consumeBid;
      dest.consumeAsk += row.consumeAsk;
    }
  }
  if (fresh && book) {
    for (const lvl of book.bids) {
      const q = quoteOf(lvl);
      if (q > 0) ensure(lvl.price).bid += q;
    }
    for (const lvl of book.asks) {
      const q = quoteOf(lvl);
      if (q > 0) ensure(lvl.price).ask += q;
    }
  }
  return { rows: [...map.values()], fresh, hasBook: Boolean(book) };
}

function drawPassiveRail(ctx, symbol, { x0, railW, yForPrice, rh, topPad, chartH, bucket, livePx }) {
  const { rows, fresh, hasBook } = railRows(symbol, bucket);

  ctx.save();
  ctx.fillStyle = '#0b0f15';
  ctx.fillRect(x0, topPad, railW, chartH);
  ctx.strokeStyle = '#1c2128';
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, topPad);
  ctx.lineTo(x0 + 0.5, topPad + chartH);
  ctx.stroke();

  const mid = x0 + railW / 2;
  const halfW = railW / 2 - 4;

  // Header
  ctx.font = 'bold 8px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText('BID', mid - 3, topPad - 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fb923c';
  ctx.fillText('ASK', mid + 3, topPad - 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7d8794';
  ctx.fillText(fresh ? 'BOOK 500' : hasBook ? 'BOOK 500 · STALE' : 'BOOK 500', mid, topPad - 32);
  ctx.fillStyle = '#86efac';
  ctx.fillText('■ consumed', mid - 28, topPad - 8);
  ctx.fillStyle = '#f472b6';
  ctx.fillText('╱╱ pulled', mid + 32, topPad - 8);

  if (!rows.length) {
    ctx.fillStyle = '#5b6572';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText(hasBook ? 'book stale' : 'waiting for book', mid, topPad + chartH / 2);
    ctx.restore();
    return;
  }

  let peak = 0;
  let totalBid = 0;
  let totalAsk = 0;
  let cancelBid = 0;
  let cancelAsk = 0;
  let consumeBid = 0;
  let consumeAsk = 0;
  for (const row of rows) {
    peak = Math.max(
      peak,
      row.bid + row.cancelBid + row.consumeBid,
      row.ask + row.cancelAsk + row.consumeAsk,
    );
    totalBid += row.bid;
    totalAsk += row.ask;
    cancelBid += row.cancelBid;
    cancelAsk += row.cancelAsk;
    consumeBid += row.consumeBid;
    consumeAsk += row.consumeAsk;
  }
  if (peak <= 0) peak = 1;

  const sizeCol = Math.min(40, Math.max(28, halfW * 0.46));
  const barMax = Math.max(8, halfW - sizeCol);
  const wFor = (v) => (v > 0 ? Math.max(1, Math.sqrt(v / peak) * barMax) : 0);
  const barH = Math.max(2, Math.min(rh - 1, 14));
  const sizeLabels = [];
  for (const row of rows) {
    const y = yForPrice(row.price);
    if (y < topPad + 1 || y > topPad + chartH - 1) continue;
    const y0 = y - barH / 2;

    const bidW = wFor(row.bid);
    const bidConsumeW = wFor(row.consumeBid);
    const bidCancelW = wFor(row.cancelBid);
    const bidOrigin = mid - sizeCol;
    if (bidW) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.62)';
      ctx.fillRect(bidOrigin - bidW, y0, bidW, barH);
    }
    if (bidConsumeW) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.72)';
      ctx.fillRect(bidOrigin - bidW - bidConsumeW, y0, bidConsumeW, barH);
    }
    if (bidCancelW) {
      drawPulledBlock(ctx, bidOrigin - bidW - bidConsumeW - bidCancelW, y0, bidCancelW, barH);
    }

    const askW = wFor(row.ask);
    const askConsumeW = wFor(row.consumeAsk);
    const askCancelW = wFor(row.cancelAsk);
    const askOrigin = mid + sizeCol;
    if (askW) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.62)';
      ctx.fillRect(askOrigin, y0, askW, barH);
    }
    if (askConsumeW) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.72)';
      ctx.fillRect(askOrigin + askW, y0, askConsumeW, barH);
    }
    if (askCancelW) {
      drawPulledBlock(ctx, askOrigin + askW + askConsumeW, y0, askCancelW, barH);
    }
    if (row.bid > 0) sizeLabels.push({ side: 'bid', y, v: row.bid });
    if (row.ask > 0) sizeLabels.push({ side: 'ask', y, v: row.ask });
  }

  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textBaseline = 'middle';
  for (const side of ['bid', 'ask']) {
    const used = [];
    const items = sizeLabels.filter((l) => l.side === side).sort((a, b) => b.v - a.v);
    for (const item of items) {
      if (used.some((y) => Math.abs(y - item.y) < 11)) continue;
      used.push(item.y);
      const text = fmtVolShort(item.v);
      if (side === 'bid') {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#a5f3fc';
        ctx.fillText(text, mid - 3, item.y);
      } else {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fed7aa';
        ctx.fillText(text, mid + 3, item.y);
      }
    }
  }

  ctx.strokeStyle = '#2a3342';
  ctx.beginPath();
  ctx.moveTo(mid + 0.5, topPad);
  ctx.lineTo(mid + 0.5, topPad + chartH);
  ctx.stroke();
  if (livePx) {
    const y = yForPrice(livePx);
    if (y >= topPad && y <= topPad + chartH) {
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(x0 + 1, y - 0.75, railW - 2, 1.5);
    }
  }

  // Footer: resting · consumed · pulled
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  const fy = topPad + chartH + 14;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(fmtVolShort(totalBid), mid - 4, fy);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fb923c';
  ctx.fillText(fmtVolShort(totalAsk), mid + 4, fy);
  if (consumeBid + consumeAsk > 0) {
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'right';
    ctx.fillText(`■${fmtVolShort(consumeBid)}`, mid - 4, fy + 12);
    ctx.textAlign = 'left';
    ctx.fillText(`■${fmtVolShort(consumeAsk)}`, mid + 4, fy + 12);
  }
  if (cancelBid + cancelAsk > 0) {
    ctx.fillStyle = '#f472b6';
    ctx.textAlign = 'right';
    ctx.fillText(`✕${fmtVolShort(cancelBid)}`, mid - 4, fy + 24);
    ctx.textAlign = 'left';
    ctx.fillText(`✕${fmtVolShort(cancelAsk)}`, mid + 4, fy + 24);
  }
  ctx.restore();
}

/** Hatched block marking passive size that was cancelled rather than filled. */
function drawPulledBlock(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(244, 114, 182, 0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += 4) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

function updateFpLevNow(livePx) {
  const el = document.getElementById('fp-lev-now');
  if (!el) return;
  el.textContent = livePx ? `live ${fmtPriceAxis(livePx)}` : 'live —';
  el.className = 'fp-lev-now';
  el.title = 'Live last price';
}

function fmtVolLabel(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function fmtVolShort(v) {
  const n = Math.abs(v);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 100_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function drawFpCellText(ctx, text, x, y, w, h, align, fill = '#ffffff') {
  if (!text || h < 8 || w < 12) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y - h / 2 + 0.5, Math.max(1, w - 2), Math.max(1, h - 1));
  ctx.clip();
  const fs = Math.min(12, Math.max(9, Math.floor(h * 0.72)));
  ctx.font = `700 ${fs}px JetBrains Mono, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const maxW = Math.max(10, w - 6);
  const tx = align === 'right' ? x + w - 3 : x + 3;
  ctx.lineWidth = Math.max(2.5, fs * 0.28);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, tx, y, maxW);
  ctx.fillStyle = fill;
  ctx.fillText(text, tx, y, maxW);
  ctx.restore();
}

function rebuildChart() {
  snapChartToLive();
}

function subscribeFootprint() {
  if (fpLiveSocket?.readyState !== WebSocket.OPEN) return;
  const coins = selectedFootprintCoins();
  if (!coins.length) return;
  fpLiveSocket.send(JSON.stringify({
    type: 'sub_footprint',
    symbol: selectedSymbol || coins[0].symbol,
    symbols: coins.map((c) => c.symbol),
    exchange: selectedExchange,
    market: footprintMarket(),
  }));
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

/**
 * Applies the server's in-progress 1m bar. Only the current minute is kept:
 * once it closes it belongs to persisted history, so we refetch instead of
 * holding it locally and counting it twice.
 */
function applyLiveFootprint(ev) {
  if (!ev?.symbol || !fpViews.has(ev.symbol)) return;
  if (ev.market && ev.market !== footprintMarket()) return;
  const bars = ev.bars ?? [];
  if (!bars.length) return;

  const minute = bars[0].bar.t;
  if (minute !== fpLastLiveMinuteBySymbol[ev.symbol]) {
    fpLastLiveMinuteBySymbol[ev.symbol] = minute;
    const prefix = `${footprintMarket()}_${ev.symbol}_`;
    for (const key of Object.keys(footprintStore)) {
      if (key.startsWith(prefix) && key.endsWith('_1')) delete footprintStore[key];
    }
  }

  for (const { exchange, bar } of bars) {
    const store = getFootprintStore(ev.symbol, 1, exchange);
    store.clear();
    store.set(bar.t, wireBarToFp(bar));
    ingestAlertBar(ev.symbol, exchange, bar);
    noteLivePrice(ev.symbol, bar.c);
  }
  evaluateSymbolAlerts(ev.symbol);
  void refreshPatternMarkers(ev.symbol);
  scheduleDraw(ev.symbol);
}

function applyFootprintTick(ev) {
  if (ev.market && ev.market !== footprintMarket()) return;
  const rows = ev.bars ?? [];
  if (!rows.length) return;
  const touched = new Set();
  for (const row of rows) {
    if (!row?.symbol || !row?.bar || !row?.exchange) continue;
    const store = getFootprintStore(row.symbol, 1, row.exchange);
    const t = row.bar.t;
    // Keep only the live minute in the in-progress store.
    if (!store.has(t) || store.size > 1) {
      for (const key of [...store.keys()]) {
        if (key !== t) store.delete(key);
      }
    }
    store.set(t, wireBarToFp(row.bar));
    ingestAlertBar(row.symbol, row.exchange, row.bar);
    noteLivePrice(row.symbol, row.bar.c);
    touched.add(row.symbol);
  }
  for (const symbol of touched) {
    evaluateSymbolAlerts(symbol);
    scheduleDraw(symbol);
  }
}

// ═══════ Footprint Alerts (session toasts, all coins) ═══════

const ALERT_TF_MINUTES = [5, 15, 30, 60]; // stop-hunt (and other alert stories) on 5m, 15m, 30m and 1h
const ALERT_KEEP_1M = 1440; // ~24h of 1m bars → enough prior for 5m / 15m / 30m / 1h vacuum context
const ALERT_MAX_SESSION = 80;
const ALERT_TOAST_MS = 7000;
const alertFpStore = {};
const alertSeen = new Map();
const sessionAlerts = [];
let alertUiBound = false;
let extensionBridgeReady = false;
const OF_ALERT_SOURCE = 'oderflow-alerts';

function publishFpAlert(alert) {
  try {
    window.postMessage({ source: OF_ALERT_SOURCE, type: 'alert', alert }, window.location.origin);
  } catch { /* ignore */ }
}

function publishFpAlertSnapshot() {
  try {
    window.postMessage({ source: OF_ALERT_SOURCE, type: 'snapshot', alerts: sessionAlerts.slice(0, ALERT_MAX_SESSION) }, window.location.origin);
  } catch { /* ignore */ }
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== OF_ALERT_SOURCE) return;
  if (data.type === 'bridge-ready') extensionBridgeReady = true;
  if (data.type === 'request-snapshot') publishFpAlertSnapshot();
});

function alertStoreKey(symbol, exchange) {
  return `${footprintMarket()}_${symbol}_${exchange}_1`;
}

function getAlertStore(symbol, exchange) {
  const key = alertStoreKey(symbol, exchange);
  if (!alertFpStore[key]) alertFpStore[key] = new Map();
  return alertFpStore[key];
}

function trimAlertStore(store) {
  if (store.size <= ALERT_KEEP_1M) return;
  const times = [...store.keys()].sort((a, b) => a - b);
  const drop = times.length - ALERT_KEEP_1M;
  for (let i = 0; i < drop; i++) store.delete(times[i]);
}

function ingestAlertBar(symbol, exchange, wire) {
  const store = getAlertStore(symbol, exchange);
  const bar = wireBarToFp(wire);
  store.set(bar.time, bar);
  trimAlertStore(store);
  noteLivePrice(symbol, bar.close);
}

function alertBarsForSymbol(symbol, tf = chartTfMinutes) {
  const exchanges = selectedExchange === 'all' ? activeExchanges() : [selectedExchange];
  if (tf === 1) {
    const out = new Map();
    for (const ex of exchanges) {
      for (const bar of getAlertStore(symbol, ex).values()) {
        if (!out.has(bar.time)) out.set(bar.time, cloneFpBar(bar));
        else mergeFootprintBar(out.get(bar.time), bar);
      }
    }
    return [...out.values()].sort((a, b) => a.time - b.time);
  }
  const bucket = tf * 60;
  const out = new Map();
  for (const ex of exchanges) {
    for (const bar of getAlertStore(symbol, ex).values()) {
      const t = bar.time - (bar.time % bucket);
      if (!out.has(t)) {
        const c = cloneFpBar(bar);
        c.time = t;
        out.set(t, c);
      } else {
        mergeFootprintBar(out.get(t), bar);
      }
    }
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

function countImbalanceLevels(bar, ratio = imbalanceRatio) {
  let buyDom = 0;
  let sellDom = 0;
  if (!bar?.levels) return { buyDom, sellDom };
  for (const lv of bar.levels.values()) {
    const buy = lv.buy ?? 0;
    const sell = lv.sell ?? 0;
    const hi = Math.max(buy, sell);
    const lo = Math.min(buy, sell);
    if (hi < 800) continue;
    if (lo <= 0) {
      if (buy > sell) buyDom += 1;
      else if (sell > buy) sellDom += 1;
      continue;
    }
    if (hi / lo < ratio) continue;
    if (buy > sell) buyDom += 1;
    else sellDom += 1;
  }
  return { buyDom, sellDom };
}

function alertLabel(symbol) {
  return config?.coins?.find((c) => c.symbol === symbol)?.label ?? symbol.replace('USDT', '');
}

function canFireAlert(key, cooldownMs = 90_000) {
  const now = Date.now();
  const last = alertSeen.get(key) ?? 0;
  if (now - last < cooldownMs) return false;
  alertSeen.set(key, now);
  if (alertSeen.size > 400) {
    const cutoff = now - 10 * 60_000;
    for (const [k, t] of alertSeen) {
      if (t < cutoff) alertSeen.delete(k);
    }
  }
  return true;
}

function barIsVolatile(bar, prior = []) {
  if (!bar) return false;
  const mid = bar.close || bar.open || 0;
  if (!(mid > 0)) return false;
  const range = Math.max(0, (bar.high ?? bar.close) - (bar.low ?? bar.close));
  const body = Math.abs((bar.close ?? mid) - (bar.open ?? mid));
  const rangePct = (range / mid) * 100;
  const bodyPct = (body / mid) * 100;
  if (bodyPct >= 0.35) return true;
  if (rangePct >= 0.6) return true;
  const sample = prior.slice(-14);
  if (sample.length >= 5) {
    const atr = sample.reduce((s, b) => s + Math.max(0, (b.high ?? b.close) - (b.low ?? b.close)), 0) / sample.length;
    if (atr > 0 && range >= atr * 1.25) return true;
  }
  return false;
}

function pingVolatility(alert) {
  if (extensionBridgeReady) return;
  if (typeof Notification === 'undefined') return;
  const title = alert.title || 'Volatility';
  const body = alert.detail || '';
  const tag = `vol-${alert.symbol}`;
  const show = () => {
    try {
      new Notification(title, { body, tag, silent: false });
    } catch { /* ignore */ }
  };
  if (Notification.permission === 'granted') show();
  else if (Notification.permission === 'default') {
    Notification.requestPermission().then((p) => { if (p === 'granted') show(); });
  }
}

function pushFpAlert(alert) {
  sessionAlerts.unshift(alert);
  if (sessionAlerts.length > ALERT_MAX_SESSION) sessionAlerts.length = ALERT_MAX_SESSION;
  renderAlertList();
  showAlertToast(alert);
  pingVolatility(alert);
  publishFpAlert(alert);
}

function evaluateSymbolAlerts(symbol) {
  for (const tf of ALERT_TF_MINUTES) evaluateSymbolAlertsOnTf(symbol, tf);
}

function evaluateSymbolAlertsOnTf(symbol, tfMinutes) {
  const bars = alertBarsForSymbol(symbol, tfMinutes);
  if (!bars.length) return;
  const idx = bars.length - 1;
  const bar = bars[idx];
  if (!barIsVolatile(bar, bars.slice(0, idx))) return;
  const story = strategyStoryForBar(bars, idx);
  if (!story) return;
  const kind =
    story.line1 === 'Asks consumed' || story.line1 === 'ASKS CONSUMED' ? { key: 'consume-ask', side: 'buy' }
      : story.line1 === 'Bids consumed' || story.line1 === 'BIDS CONSUMED' ? { key: 'consume-bid', side: 'sell' }
        : story.line1 === 'Buyers absorbed' || story.line1 === 'BUYERS ABSORBED' ? { key: 'absorb-buy', side: 'sell' }
          : story.line1 === 'Sellers absorbed' || story.line1 === 'SELLERS ABSORBED' ? { key: 'absorb-sell', side: 'buy' }
            : story.line1 === 'BUYERS EFFECTIVE' || story.line1 === 'UPSIDE VACUUM' ? { key: 'buyers-effective', side: 'buy' }
              : story.line1 === 'SELLERS EFFECTIVE' || story.line1 === 'DOWNSIDE VACUUM' ? { key: 'sellers-effective', side: 'sell' }
            : story.line1 === 'Stop hunt low' || (story.line1 === 'Stop hunt' && story.line2?.includes('low'))
              ? { key: 'hunt-low', side: 'buy' }
              : story.line1 === 'Stop hunt high' || (story.line1 === 'Stop hunt' && story.line2?.includes('high'))
                ? { key: 'hunt-high', side: 'sell' }
                : story.line1 === 'Held support' ? { key: 'held-support', side: 'buy' }
                  : story.line1 === 'Rejected resist' ? { key: 'reject-resist', side: 'sell' }
                    : story.detail?.special === 'STOP_HUNT_LOW' ? { key: 'hunt-low', side: 'buy' }
                      : story.detail?.special === 'STOP_HUNT_HIGH' ? { key: 'hunt-high', side: 'sell' }
                        : null;
  if (!kind) return;

  const label = alertLabel(symbol);
  const tf = tfShort(tfMinutes);
  const barKey = bar.time;
  if (!canFireAlert(`${symbol}:story:${kind.key}:${tf}:${barKey}`, 120_000)) return;

  pushFpAlert({
    id: `${symbol}-${kind.key}-${tf}-${barKey}`,
    symbol,
    kind: kind.key,
    side: kind.side,
    title: `${label} · ${story.line1}`,
    detail: `${story.line2 || 'setup'} · ${tf} · range expanding`,
    at: Date.now(),
  });
}

function setupAlertUi() {
  if (alertUiBound) return;
  alertUiBound = true;
  const bell = document.getElementById('alert-bell');
  const panel = document.getElementById('alert-panel');
  const clearBtn = document.getElementById('alert-clear');
  const list = document.getElementById('alert-list');
  const toasts = document.getElementById('alert-toasts');
  bell?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('watchlist-panel')?.classList.add('hidden');
    panel?.classList.toggle('hidden');
  });
  clearBtn?.addEventListener('click', () => {
    sessionAlerts.length = 0;
    renderAlertList();
    publishFpAlertSnapshot();
  });
  list?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-alert-symbol]');
    if (!row) return;
    openAlertSymbol(row.dataset.alertSymbol);
  });
  toasts?.addEventListener('click', (e) => {
    const toast = e.target.closest('[data-alert-symbol]');
    if (!toast) return;
    openAlertSymbol(toast.dataset.alertSymbol);
  });
  document.addEventListener('click', (e) => {
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || bell?.contains(e.target)) return;
    panel.classList.add('hidden');
  });
}

// ═══════ Watchlist editor ═══════

let watchlistUiBound = false;
let watchlistCatalog = [];
let watchlistDraft = new Set();
let watchlistTab = 'crypto';
let watchlistLocked = false;

async function loadWatchlistPanel() {
  const data = await fetch('/api/watchlist').then((r) => r.json());
  watchlistCatalog = data.catalog ?? [];
  watchlistDraft = new Set(data.active ?? []);
  watchlistLocked = Boolean(data.lockedByEnv);
  const hint = document.getElementById('watchlist-hint');
  const saveBtn = document.getElementById('watchlist-save');
  if (watchlistLocked) {
    if (hint) hint.textContent = 'Locked by SYMBOLS env — unset it to edit from the UI.';
    if (saveBtn) saveBtn.disabled = true;
  } else {
    if (hint) hint.textContent = 'Toggle coins, then Save. Live feeds reconnect automatically.';
    if (saveBtn) saveBtn.disabled = false;
  }
  renderWatchlistGrid();
}

function renderWatchlistGrid() {
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;
  const rows = watchlistCatalog.filter((c) =>
    watchlistTab === 'equity' ? c.venue === 'equity' : c.venue !== 'equity',
  );
  grid.innerHTML = rows
    .map((coin) => {
      const on = watchlistDraft.has(coin.symbol);
      return `<label class="watchlist-chip ${on ? 'on' : ''} ${coin.venue === 'equity' ? 'equity' : ''}">
        <input type="checkbox" data-wl-symbol="${coin.symbol}" ${on ? 'checked' : ''} ${watchlistLocked ? 'disabled' : ''} />
        ${coin.label}
      </label>`;
    })
    .join('');
  const status = document.getElementById('watchlist-status');
  if (status) status.textContent = `${watchlistDraft.size} selected`;
}

async function saveWatchlistFromUi() {
  const status = document.getElementById('watchlist-status');
  const saveBtn = document.getElementById('watchlist-save');
  if (watchlistLocked) return;
  if (watchlistDraft.size < 1) {
    if (status) status.textContent = 'Pick at least one coin';
    return;
  }
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    const res = await fetch('/api/watchlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: [...watchlistDraft] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    config.coins = data.coins ?? [];
    config.catalog = watchlistCatalog;
    if (!config.coins.some((c) => c.symbol === selectedSymbol)) {
      selectedSymbol = config.coins[0]?.symbol ?? selectedSymbol;
    }
    initChart();
    seedFootprintKlines();
    subscribeFootprint();
    scheduleDraw();
    if (status) {
      status.textContent = data.restartRequired
        ? 'Saved — restart pnpm run ui for live feeds'
        : 'Saved — feeds reconnected';
    }
  } catch (err) {
    if (status) status.textContent = err instanceof Error ? err.message : 'Save failed';
  } finally {
    if (saveBtn && !watchlistLocked) saveBtn.disabled = false;
  }
}

function setupWatchlistUi() {
  if (watchlistUiBound) return;
  watchlistUiBound = true;
  const btn = document.getElementById('watchlist-btn');
  const panel = document.getElementById('watchlist-panel');
  const closeBtn = document.getElementById('watchlist-close');
  const grid = document.getElementById('watchlist-grid');
  const tabs = document.getElementById('watchlist-tabs');

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('alert-panel')?.classList.add('hidden');
    const opening = panel?.classList.contains('hidden');
    panel?.classList.toggle('hidden');
    if (opening) void loadWatchlistPanel();
  });
  closeBtn?.addEventListener('click', () => panel?.classList.add('hidden'));
  tabs?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-wl-tab]');
    if (!tab) return;
    watchlistTab = tab.dataset.wlTab;
    tabs.querySelectorAll('[data-wl-tab]').forEach((b) => b.classList.toggle('active', b === tab));
    renderWatchlistGrid();
  });
  grid?.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-wl-symbol]');
    if (!input || watchlistLocked) return;
    const symbol = input.dataset.wlSymbol;
    if (input.checked) watchlistDraft.add(symbol);
    else watchlistDraft.delete(symbol);
    renderWatchlistGrid();
  });
  document.getElementById('watchlist-all')?.addEventListener('click', () => {
    if (watchlistLocked) return;
    for (const coin of watchlistCatalog) {
      if (watchlistTab === 'equity' ? coin.venue === 'equity' : coin.venue !== 'equity') {
        watchlistDraft.add(coin.symbol);
      }
    }
    renderWatchlistGrid();
  });
  document.getElementById('watchlist-none')?.addEventListener('click', () => {
    if (watchlistLocked) return;
    for (const coin of watchlistCatalog) {
      if (watchlistTab === 'equity' ? coin.venue === 'equity' : coin.venue !== 'equity') {
        watchlistDraft.delete(coin.symbol);
      }
    }
    renderWatchlistGrid();
  });
  document.getElementById('watchlist-save')?.addEventListener('click', () => void saveWatchlistFromUi());
  document.addEventListener('click', (e) => {
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || btn?.contains(e.target)) return;
    panel.classList.add('hidden');
  });
}

function bitunixTradeUrl(symbol) {
  const pair = String(symbol || '').toUpperCase();
  if (!pair) return '';
  return `https://www.bitunix.com/contract-trade/${pair}`;
}

function dashboardCoinPath(symbol) {
  const coin = config?.coins?.find((c) => c.symbol === symbol);
  const slug = coinSlug(coin) || String(symbol || '').replace(/USDT$/i, '').toLowerCase();
  return slug ? `/${slug}` : '';
}

function openAlertSymbol(symbol) {
  if (!symbol) return;
  const appPath = dashboardCoinPath(symbol);
  if (appPath && (symbol !== selectedSymbol || location.pathname !== appPath)) {
    window.open(`${appPath}${location.search}`, '_blank', 'noopener,noreferrer');
  }
  const url = bitunixTradeUrl(symbol);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
  document.getElementById('alert-panel')?.classList.add('hidden');
}

function renderAlertList() {
  const list = document.getElementById('alert-list');
  const count = document.getElementById('alert-count');
  if (count) count.textContent = String(sessionAlerts.length);
  if (!list) return;
  if (!sessionAlerts.length) {
    list.innerHTML = '<div class="alert-empty">No alerts yet — ping when the 5m, 15m, 30m or 1h range is expanding</div>';
    return;
  }
  list.innerHTML = sessionAlerts.map((a) => `
    <button type="button" class="alert-row ${a.side}" data-alert-symbol="${a.symbol}">
      <span class="alert-row-kind">${a.kind}</span>
      <span class="alert-row-title">${escapeHtml(a.title)}</span>
      <span class="alert-row-detail">${escapeHtml(a.detail)}</span>
      <span class="alert-row-time">${fmtTime(a.at)}</span>
    </button>
  `).join('');
}

function showAlertToast(alert) {
  const host = document.getElementById('alert-toasts');
  if (!host) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `alert-toast ${alert.side}`;
  el.dataset.alertSymbol = alert.symbol;
  el.innerHTML = `
    <span class="alert-toast-kind">${alert.kind}</span>
    <span class="alert-toast-title">${escapeHtml(alert.title)}</span>
    <span class="alert-toast-detail">${escapeHtml(alert.detail)}</span>
  `;
  host.prepend(el);
  while (host.children.length > 5) host.lastChild?.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, ALERT_TOAST_MS);
}

// ═══════ End Footprint Chart ═══════

async function init() {
  setupTabs();
  setupDataMode();
  setupAlertUi();
  setupWatchlistUi();
  setupCoinRouting();
  try {
    config = await fetch('/api/config').then((r) => r.json());
    fpHistoryEnabled = Boolean(config.history?.enabled);
    fpRetentionDays = Number(config.history?.retentionDays) || 30;
    imbalanceRatio = Number(config.imbalanceRatio) || 3;
    if ($('imb-ratio') !== _noopEl) $('imb-ratio').value = String(imbalanceRatio);

    // Resolve URL coin BEFORE any panel defaults to BTC (was flashing Market Battle as BTC on /sol).
    const route = parseCoinRoute();
    const routeCoin = findCoinBySlug(route.slug);
    selectedSymbol =
      routeCoin?.symbol ?? config.coins?.[0]?.symbol ?? selectedSymbol;

    const initialMode =
      route.mode === 'spot' || route.mode === 'perp'
        ? route.mode
        : config.market === 'spot'
          ? 'spot'
          : 'perp';
    applyDataMode(initialMode);
    applyRouteFromLocation({ replace: true });
    if (!openTabs.length) {
      const coin = config.coins.find((c) => c.symbol === selectedSymbol) ?? config.coins[0];
      if (coin) {
        openTabs.push({ symbol: coin.symbol, label: coin.label });
        selectedSymbol = coin.symbol;
        renderOpenTabs();
        applySymbolFilter();
      }
      syncCoinRoute(true);
    }
  } catch {
    initChart();
  }
  renderAlertList();
  connectLiveSocket();
}

/** Browser↔server WS: reconnect with backoff so one drop is not terminal. */
const WS_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
let wsRetryAttempt = 0;
let wsRetryTimer = null;

function connectLiveSocket() {
  if (wsRetryTimer) {
    clearTimeout(wsRetryTimer);
    wsRetryTimer = null;
  }

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  fpLiveSocket = ws;

  ws.onopen = () => {
    wsRetryAttempt = 0;
    setStatus(true, 'Live');
    subscribeFootprint();
  };

  ws.onclose = () => {
    if (fpLiveSocket === ws) fpLiveSocket = null;
    setStatus(false, 'Reconnecting…');
    const delay = WS_BACKOFF_MS[Math.min(wsRetryAttempt, WS_BACKOFF_MS.length - 1)];
    wsRetryAttempt += 1;
    wsRetryTimer = setTimeout(connectLiveSocket, delay);
  };

  ws.onerror = () => setStatus(false, 'Connection error');

  ws.onmessage = (msg) => {
    let ev;
    try {
      ev = JSON.parse(msg.data);
    } catch {
      return;
    }

    switch (ev.type) {
      case 'status': {
        const m = ev.market === 'spot' ? 'spot' : 'perp';
        feedStatus[m] = { connected: Boolean(ev.connected), message: ev.message ?? '' };
        refreshStatus();
        break;
      }
      case 'trade':
        if (ev.trade && ev.market) ev.trade.market = ev.market;
        if (ev.trade) noteLivePrice(ev.trade.symbol, ev.trade.price);
        ingestTradeToChart(ev.trade);
        if (ev.trade?.symbol) scheduleDraw(ev.trade.symbol);
        break;
      case 'footprint_live':
        applyLiveFootprint(ev);
        break;
      case 'footprint_tick':
        applyFootprintTick(ev);
        break;
      case 'pattern_snapshot':
        applyPatternSnapshot(ev);
        break;
      case 'pattern_alert':
        ingestPatternAlert(ev.alert);
        break;
      case 'spot_flow':
        ingestSpotFlow(ev.snapshot);
        break;
      case 'book':
        ingestOrderBook(ev);
        break;
      case 'summary':
        if (ev.summary && ev.market) ev.summary.market = ev.market;
        updateSummary(ev.summary);
        if (ev.summary?.symbol) scheduleDraw(ev.summary.symbol);
        break;
      case 'overview':
        updateOverview(ev.coins, ev.market === 'spot' ? 'spot' : 'perp');
        break;
      case 'watchlist': {
        if (Array.isArray(ev.coins)) {
          config.coins = ev.coins;
          if (!config.coins.some((c) => c.symbol === selectedSymbol)) {
            selectedSymbol = config.coins[0]?.symbol ?? selectedSymbol;
          }
          initChart();
          seedFootprintKlines();
          subscribeFootprint();
          scheduleDraw();
        }
        break;
      }
      default:
        break;
    }
  };
}

init();
