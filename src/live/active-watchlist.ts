import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ACTIVE_SYMBOLS,
  FULL_WATCHLIST_CATALOG,
  resolveWatchlist,
  type WatchCoin,
} from './watchlist.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const ACTIVE_WATCHLIST_PATH = join(ROOT, 'data', 'active-watchlist.json');

export interface ActiveWatchlistFile {
  symbols: string[];
  updatedAt?: string;
}

function normalizeSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols) {
    const symbol = String(raw ?? '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

/** SYMBOLS=AVAX,NEAR wins over the saved file when set. */
export function symbolsFromEnv(): string[] | null {
  const raw = process.env.SYMBOLS ?? '';
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? list : null;
}

export async function loadActiveSymbols(): Promise<string[]> {
  const fromEnv = symbolsFromEnv();
  if (fromEnv) return fromEnv;
  try {
    const raw = await readFile(ACTIVE_WATCHLIST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ActiveWatchlistFile;
    const symbols = normalizeSymbols(parsed?.symbols);
    if (symbols.length) return symbols;
  } catch {
    /* first run or bad file */
  }
  return [...DEFAULT_ACTIVE_SYMBOLS];
}

export async function saveActiveSymbols(symbols: string[]): Promise<string[]> {
  const cleaned = normalizeSymbols(symbols);
  if (!cleaned.length) {
    throw new Error('Pick at least one coin');
  }
  // Drop unknown symbols that are not in catalog (except keep them if already custom).
  const known = new Set(FULL_WATCHLIST_CATALOG.map((c) => c.symbol));
  const filtered = cleaned.filter((s) => known.has(s) || s.endsWith('USDT'));
  if (!filtered.length) throw new Error('Pick at least one coin');

  await mkdir(dirname(ACTIVE_WATCHLIST_PATH), { recursive: true });
  const payload: ActiveWatchlistFile = {
    symbols: filtered,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(ACTIVE_WATCHLIST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filtered;
}

export async function loadActiveWatchlist(): Promise<WatchCoin[]> {
  return resolveWatchlist(await loadActiveSymbols());
}
