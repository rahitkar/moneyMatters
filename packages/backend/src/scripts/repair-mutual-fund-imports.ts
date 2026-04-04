/**
 * One-off repair for Zerodha mutual fund tradebook imports:
 * - Merge duplicate assets that differ only by hyphen/spacing in the fund name (same normalized key / ISIN).
 * - Reclassify from stocks → mutual_fund_debt | mutual_fund_equity (and set provider manual, INR).
 * - Rebuild FIFO realized gains for merged assets.
 *
 * Run from packages/backend: `npm run db:repair-mf`
 */

import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import type { Asset } from '../db/schema.js';
import {
  classifyMutualFund,
  isLikelyZerodhaMutualFundAsset,
  mutualFundMergeKey,
} from '../lib/mf-helpers.js';
import { transactionService } from '../services/transaction.service.js';

function isIsinSymbol(symbol: string): boolean {
  return /^INF[A-Z0-9]{9}$/i.test(symbol.trim());
}

function pickCanonical(
  group: Asset[],
  txCount: Map<string, number>
): { canonical: Asset; duplicates: Asset[] } {
  const sorted = [...group].sort((a, b) => {
    const aIsin = (a.isin?.trim() && /^INF[A-Z0-9]{9}$/i.test(a.isin!)) ? 1 : 0;
    const bIsin = (b.isin?.trim() && /^INF[A-Z0-9]{9}$/i.test(b.isin!)) ? 1 : 0;
    if (bIsin !== aIsin) return bIsin - aIsin;
    const aInf = isIsinSymbol(a.symbol) ? 1 : 0;
    const bInf = isIsinSymbol(b.symbol) ? 1 : 0;
    if (bInf !== aInf) return bInf - aInf;
    const ac = txCount.get(a.id) ?? 0;
    const bc = txCount.get(b.id) ?? 0;
    if (bc !== ac) return bc - ac;
    return a.id.localeCompare(b.id);
  });
  const canonical = sorted[0]!;
  const duplicates = sorted.slice(1);
  return { canonical, duplicates };
}

async function transactionCountsByAsset(): Promise<Map<string, number>> {
  const rows = await db
    .select({ assetId: schema.transactions.assetId })
    .from(schema.transactions);
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.assetId, (m.get(r.assetId) ?? 0) + 1);
  }
  return m;
}

async function mergeDuplicateGroup(
  canonical: Asset,
  duplicates: Asset[],
  txCount: Map<string, number>
): Promise<void> {
  const dupIds = duplicates.map((d) => d.id);
  const allIds = [canonical.id, ...dupIds];

  await db.delete(schema.realizedGains).where(inArray(schema.realizedGains.assetId, allIds));

  if (dupIds.length > 0) {
    await db
      .update(schema.transactions)
      .set({ assetId: canonical.id })
      .where(inArray(schema.transactions.assetId, dupIds));

    await db
      .update(schema.holdings)
      .set({ assetId: canonical.id })
      .where(inArray(schema.holdings.assetId, dupIds));

    await db
      .update(schema.priceHistory)
      .set({ assetId: canonical.id })
      .where(inArray(schema.priceHistory.assetId, dupIds));

    const dupTags = await db
      .select()
      .from(schema.assetTags)
      .where(inArray(schema.assetTags.assetId, dupIds));

    for (const row of dupTags) {
      await db
        .insert(schema.assetTags)
        .values({ assetId: canonical.id, tagId: row.tagId })
        .onConflictDoNothing();
    }

    await db.delete(schema.assetTags).where(inArray(schema.assetTags.assetId, dupIds));

    await db.delete(schema.assets).where(inArray(schema.assets.id, dupIds));
  }

  const longestName = [canonical, ...duplicates].reduce((a, b) =>
    b.name.length > a.name.length ? b : a
  );
  const mfClass = classifyMutualFund(longestName.name);
  const preferIsinFromCol =
    [canonical, ...duplicates]
      .map((x) => x.isin?.trim().toUpperCase())
      .find((x) => x && /^INF[A-Z0-9]{9}$/.test(x)) ?? null;
  const preferIsinFromSym =
    [canonical, ...duplicates].find((a) => isIsinSymbol(a.symbol))?.symbol.toUpperCase() ?? null;
  const mergedIsin = preferIsinFromCol ?? preferIsinFromSym ?? null;
  const newSymbol = mergedIsin ?? canonical.symbol;

  await db
    .update(schema.assets)
    .set({
      symbol: newSymbol,
      isin: mergedIsin,
      name: longestName.name,
      assetClass: mfClass,
      provider: 'manual',
      currency: 'INR',
    })
    .where(eq(schema.assets.id, canonical.id));

  txCount.set(
    canonical.id,
    dupIds.reduce((n, id) => n + (txCount.get(id) ?? 0), txCount.get(canonical.id) ?? 0)
  );
  for (const id of dupIds) {
    txCount.delete(id);
  }

  await transactionService.rebuildRealizedGainsForAsset(canonical.id);

  console.log(
    `Merged ${duplicates.length} duplicate MF row(s) -> ${newSymbol} (${longestName.name.slice(0, 56)}...)`
  );
}

async function main(): Promise<void> {
  console.log('Repair: mutual fund imports (merge + reclassify)…\n');

  const allAssets = await db.select().from(schema.assets).all();
  let mfAssets = allAssets.filter(isLikelyZerodhaMutualFundAsset);
  let txCount = await transactionCountsByAsset();

  const byKey = new Map<string, Asset[]>();
  for (const a of mfAssets) {
    const key = mutualFundMergeKey(a.symbol, a.isin);
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }

  let mergeCount = 0;
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    const { canonical, duplicates } = pickCanonical(group, txCount);
    if (duplicates.length === 0) continue;
    await mergeDuplicateGroup(canonical, duplicates, txCount);
    mergeCount++;
  }

  console.log(`\nDuplicate groups merged: ${mergeCount}\n`);

  const refreshed = await db.select().from(schema.assets).all();
  mfAssets = refreshed.filter(isLikelyZerodhaMutualFundAsset);

  let reclassCount = 0;
  for (const a of mfAssets) {
    const mfClass = classifyMutualFund(a.name);
    const currency = a.currency ?? 'USD';
    const already =
      (a.assetClass === 'mutual_fund_equity' || a.assetClass === 'mutual_fund_debt') &&
      a.assetClass === mfClass &&
      a.provider === 'manual' &&
      currency === 'INR';
    if (already) continue;

    await db
      .update(schema.assets)
      .set({
        assetClass: mfClass,
        provider: 'manual',
        currency: 'INR',
      })
      .where(eq(schema.assets.id, a.id));
    reclassCount++;
  }

  console.log(`Assets reclassified / normalized: ${reclassCount}`);

  const mfRows = await db
    .select()
    .from(schema.assets)
    .where(
      inArray(schema.assets.assetClass, [
        'mutual_fund',
        'mutual_fund_equity',
        'mutual_fund_debt',
      ])
    );

  const mfIds = new Set(mfRows.map((a) => a.id));

  const sellRows = await db
    .select({ assetId: schema.transactions.assetId })
    .from(schema.transactions)
    .where(eq(schema.transactions.type, 'sell'));

  const mfAssetsWithSells = [
    ...new Set(sellRows.map((r) => r.assetId).filter((id) => mfIds.has(id))),
  ];

  console.log(`\nRebuilding FIFO for ${mfAssetsWithSells.length} MF asset(s) with sells…`);
  for (const assetId of mfAssetsWithSells) {
    await transactionService.rebuildRealizedGainsForAsset(assetId);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
