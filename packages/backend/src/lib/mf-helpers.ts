import type { AssetClass } from '../db/schema.js';

export interface TradebookRowLike {
  symbol: string;
  segment?: string;
  isin?: string;
}

export function isMutualFundRow(row: TradebookRowLike): boolean {
  const seg = row.segment?.toUpperCase();
  const isin = row.isin?.trim().toUpperCase();
  return seg === 'MF' || (!!isin && isin.startsWith('INF'));
}

/**
 * Zerodha label variants: hyphens, "DIRECT PLAN" vs "DIRECT GROWTH", trailing OPTION.
 * Also aligns "… ELSS TAX SAVER …" with "… TAX SAVER …" (same ISIN at broker).
 */
export function normalizeFundLabel(symbol: string): string {
  let s = symbol
    .trim()
    .toUpperCase()
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\bELSS\b/.test(s) && /\bTAX\s+SAVER\b/.test(s)) {
    s = s.replace(/\bELSS\s+/g, '');
  }

  s = s
    .replace(/\s+DIRECT\s+PLAN\s+GROWTH(\s+OPTION)?$/i, '')
    .replace(/\s+DIRECT\s+GROWTH(\s+OPTION)?$/i, '')
    .replace(/\s+GROWTH(\s+OPTION)?$/i, '')
    .replace(/\s+DIRECT\s+PLAN$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

export function classifyMutualFund(fundName: string): 'mutual_fund_debt' | 'mutual_fund_equity' {
  const u = fundName.toUpperCase();

  const debtPatterns = [
    /\bLIQUID\b/,
    /\bULTRA[- ]SHORT\b/,
    /\bSHORT\s+TERM\b/,
    /\bSHORT\s+DURATION\b/,
    /\bLOW\s+DURATION\b/,
    /\bMEDIUM\s+DURATION\b/,
    /\bLONG\s+DURATION\b/,
    /\bOVERNIGHT\b/,
    /\bMONEY\s+MARKET\b/,
    /\bMONEY\s+MKT\b/,
    /\bGILT\b/,
    /\bCORPORATE\s+BOND\b/,
    /\bCREDIT\s+RISK\b/,
    /\bBANKING\b.*\bPSU\b/,
    /\bDYNAMIC\s+BOND\b/,
    /\bFLOATER\b/,
    /\bDEBT\b/,
    /\bFIXED\s+MATURITY\b/,
    /\bFMP\b/,
    /\bTARGET\s+MATURITY\b/,
    /\bINTERVAL\b/,
    /\bCONSERVATIVE\s+HYBRID\b/,
  ];

  for (const re of debtPatterns) {
    if (re.test(u)) return 'mutual_fund_debt';
  }

  return 'mutual_fund_equity';
}

/** Lookup order prefers legacy .NS fund-name assets, then ISIN as symbol. */
export function mutualFundSymbolCandidates(
  isin: string | undefined,
  rows: Pick<TradebookRowLike, 'symbol'>[]
): string[] {
  const out: string[] = [];
  const syms = [...new Set(rows.map((r) => r.symbol.trim()))];
  for (const s of syms) {
    out.push(`${s.toUpperCase()}.NS`);
  }
  for (const s of syms) {
    out.push(`${normalizeFundLabel(s)}.NS`);
  }
  if (isin) {
    out.push(isin.trim().toUpperCase());
  }
  return [...new Set(out)];
}

/** Assets in DB that were almost certainly imported from Zerodha mutual fund tradebooks. */
export function isLikelyZerodhaMutualFundAsset(a: {
  symbol: string;
  name: string;
  assetClass: AssetClass;
}): boolean {
  if (['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt'].includes(a.assetClass)) {
    return true;
  }
  if (a.assetClass !== 'stocks' && a.assetClass !== 'etf') {
    return false;
  }
  const s = a.symbol.toUpperCase();
  const n = a.name.toUpperCase();
  if (/^INF[A-Z0-9]{9}$/.test(s)) return true;
  if (!s.endsWith('.NS')) return false;
  if (s.includes('FUND') || n.includes('FUND') || /\bFOF\b/.test(n) || /\bFOF\b/.test(s)) {
    return true;
  }
  if (n.includes('ELSS') || n.includes('TAX SAVER')) return true;
  if (n.includes('DIRECT PLAN') || n.includes('DIRECT GROWTH')) return true;
  return false;
}

/** Group key: prefer ISIN when known; else normalized fund name without .NS */
export function mutualFundMergeKey(symbol: string, isin?: string | null): string {
  const i = isin?.trim().toUpperCase();
  if (i && /^INF[A-Z0-9]{9}$/i.test(i)) return `ISIN:${i}`;
  const s = symbol.trim().toUpperCase();
  if (/^INF[A-Z0-9]{9}$/i.test(s)) return `ISIN:${s}`;
  const base = s.replace(/\.NS$/i, '');
  return normalizeFundLabel(base);
}
