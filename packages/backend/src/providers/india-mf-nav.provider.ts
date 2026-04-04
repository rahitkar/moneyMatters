import { normalizeFundLabel } from '../lib/mf-helpers.js';

const BASE = 'https://api.mfapi.in/mf';
const MIN_INTERVAL_MS = 400;

let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestTime + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

function extractIsinsFromMeta(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  const out: string[] = [];
  for (const v of Object.values(meta)) {
    if (typeof v === 'string' && /^INF[A-Z0-9]{9}$/i.test(v.trim())) {
      out.push(v.trim().toUpperCase());
    }
  }
  return [...new Set(out)];
}

export function mfTargetIsin(
  isin: string | null | undefined,
  symbol: string
): string | null {
  const i = isin?.trim().toUpperCase();
  if (i && /^INF[A-Z0-9]{9}$/.test(i)) return i;
  const s = symbol.trim().toUpperCase();
  if (/^INF[A-Z0-9]{9}$/.test(s)) return s;
  return null;
}

interface SearchHit {
  schemeCode: number;
  schemeName: string;
}

async function searchSchemes(query: string): Promise<SearchHit[]> {
  await throttle();
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const code = o.schemeCode;
      const name = o.schemeName;
      if (typeof name !== 'string') return null;
      const n = typeof code === 'number' ? code : parseInt(String(code), 10);
      if (!Number.isFinite(n)) return null;
      return { schemeCode: n, schemeName: name };
    })
    .filter((x): x is SearchHit => x !== null);
}

interface LatestParsed {
  schemeCode: number;
  nav: number;
  schemeName: string;
  isins: string[];
}

async function parseLatestResponse(
  schemeCode: number,
  body: unknown
): Promise<LatestParsed | null> {
  if (!body || typeof body !== 'object') return null;
  const b = body as {
    status?: string;
    meta?: Record<string, unknown>;
    data?: Array<{ date?: string; nav?: string }>;
  };
  if (b.status !== 'SUCCESS' || !b.data?.[0]?.nav) return null;
  const nav = parseFloat(String(b.data[0].nav));
  if (!Number.isFinite(nav) || nav <= 0) return null;
  const schemeName =
    typeof b.meta?.scheme_name === 'string' ? b.meta.scheme_name : '';
  return {
    schemeCode,
    nav,
    schemeName,
    isins: extractIsinsFromMeta(b.meta),
  };
}

async function getLatest(schemeCode: number): Promise<LatestParsed | null> {
  await throttle();
  const res = await fetch(`${BASE}/${schemeCode}/latest`);
  if (!res.ok) return null;
  const body = await res.json();
  return parseLatestResponse(schemeCode, body);
}

function nameMatchScore(assetName: string, schemeName: string): number {
  const a = new Set(
    expandCompoundWords(normalizeFundLabel(assetName))
      .split(' ')
      .filter((w) => w.length > 2)
  );
  const b = new Set(
    expandCompoundWords(normalizeFundLabel(schemeName))
      .split(' ')
      .filter((w) => w.length > 2)
  );
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  return inter / Math.max(a.size, b.size);
}

const COMPOUND_SPLITS: Record<string, string> = {
  FLEXICAP: 'FLEXI CAP',
  SMALLCAP: 'SMALL CAP',
  MIDCAP: 'MID CAP',
  LARGECAP: 'LARGE CAP',
  MULTICAP: 'MULTI CAP',
  BLUECHIP: 'BLUE CHIP',
  MICROCAP: 'MICRO CAP',
};

function expandCompoundWords(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(COMPOUND_SPLITS)) {
    out = out.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
  }
  return out;
}

function searchQueriesFromName(name: string, hasIsin: boolean): string[] {
  const n = normalizeFundLabel(name);
  const expanded = expandCompoundWords(n);
  const variants = [n, expanded];
  const queries: string[] = [];

  // When we have an ISIN, the most reliable search includes "Direct Growth"
  // because mfapi.in returns many irrelevant variants (Bonus/IDCW/Institutional) first
  if (hasIsin) {
    for (const variant of variants) {
      queries.push(`${variant} Direct Growth`.slice(0, 60));
      queries.push(`${variant} Direct Plan Growth`.slice(0, 60));
    }
  }

  for (const variant of variants) {
    const words = variant.split(' ').filter(Boolean);
    if (variant.length > 2) queries.push(variant.slice(0, Math.min(48, variant.length)));
    if (words.length >= 5) queries.push(words.slice(0, 5).join(' '));
    if (words.length >= 4) queries.push(words.slice(0, 4).join(' '));
    if (words.length >= 3) queries.push(words.slice(0, 3).join(' '));
    if (words.length >= 2) queries.push(words.slice(0, 2).join(' '));
  }
  return [...new Set(queries.filter((q) => q.length >= 3))];
}

const isinSchemeCache = new Map<string, number>();

export const indiaMfNavProvider = {
  mfTargetIsin,

  /** @internal */
  async fetchLatestNav(params: {
    isin?: string | null;
    name: string;
    symbol: string;
  }): Promise<number | null> {
    const target = mfTargetIsin(params.isin, params.symbol);

    if (target && isinSchemeCache.has(target)) {
      const cachedCode = isinSchemeCache.get(target)!;
      const latest = await getLatest(cachedCode);
      if (latest?.isins.includes(target)) {
        return latest.nav;
      }
      isinSchemeCache.delete(target);
    }

    const queries = searchQueriesFromName(params.name, !!target);
    const scannedCodes = new Set<number>();
    const noIsinCandidates: { schemeCode: number; score: number; nav: number }[] = [];

    for (const q of queries) {
      const hits = await searchSchemes(q);
      if (hits.length === 0) continue;

      // Pre-filter: if we have an ISIN, prefer hits whose name looks relevant
      const toScan = hits.filter((h) => !scannedCodes.has(h.schemeCode));
      const maxScan = Math.min(15, toScan.length);

      for (let i = 0; i < maxScan; i++) {
        const hit = toScan[i];
        scannedCodes.add(hit.schemeCode);
        const latest = await getLatest(hit.schemeCode);
        if (!latest) continue;

        if (target && latest.isins.includes(target)) {
          isinSchemeCache.set(target, hit.schemeCode);
          return latest.nav;
        }

        if (!target) {
          const score = nameMatchScore(params.name, hit.schemeName);
          noIsinCandidates.push({ schemeCode: hit.schemeCode, score, nav: latest.nav });
        }
      }

      // For no-ISIN path, stop at first query with results
      if (!target && noIsinCandidates.length > 0) break;
    }

    if (!target) {
      if (noIsinCandidates.length === 1) {
        return noIsinCandidates[0].nav;
      }
      if (noIsinCandidates.length > 0) {
        noIsinCandidates.sort((a, b) => b.score - a.score);
        const best = noIsinCandidates[0];
        if (best.score >= 0.35) {
          return best.nav;
        }
      }
    }

    return null;
  },
};
