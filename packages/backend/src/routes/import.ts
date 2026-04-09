import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { assetService } from '../services/asset.service.js';
import { holdingService } from '../services/holding.service.js';
import { transactionService } from '../services/transaction.service.js';
import { marketDataService } from '../services/market-data.service.js';
import { ASSET_CLASSES, TRANSACTION_TYPES, type AssetClass, type TransactionType } from '../db/schema.js';
import { dateToLocal } from '../lib/date.js';
import {
  isMutualFundRow,
  normalizeFundLabel,
  classifyMutualFund,
  mutualFundSymbolCandidates,
} from '../lib/mf-helpers.js';

const importRowSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().optional(),
  assetClass: z.enum(ASSET_CLASSES).optional(),
  quantity: z.number().positive(),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

const importDataSchema = z.object({
  rows: z.array(importRowSchema),
  skipExisting: z.boolean().optional().default(false),
  fundSourceId: z.string().optional(),
});

const csvMappingSchema = z.object({
  symbolColumn: z.string(),
  nameColumn: z.string().optional(),
  assetClassColumn: z.string().optional(),
  quantityColumn: z.string(),
  purchasePriceColumn: z.string(),
  purchaseDateColumn: z.string(),
  notesColumn: z.string().optional(),
  dateFormat: z.string().optional().default('YYYY-MM-DD'),
});

export async function importRoutes(fastify: FastifyInstance) {
  // Import holdings from structured data
  fastify.post<{ Body: z.infer<typeof importDataSchema> }>(
    '/holdings',
    async (request, reply) => {
      const validation = importDataSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const { rows, skipExisting } = validation.data;
      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as { row: number; error: string }[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
          // Check if asset exists
          let asset = await assetService.getBySymbol(request.userId, row.symbol);

          if (!asset) {
            // Try to get asset info from market data
            const searchResults = await marketDataService.search(row.symbol);
            const matchingResult = searchResults.find(
              (r) => r.symbol.toUpperCase() === row.symbol.toUpperCase()
            );

            const assetClass: AssetClass = row.assetClass || 
              matchingResult?.assetClass || 
              'stocks';

            const provider = matchingResult?.provider || 'manual';
            const name = row.name || matchingResult?.name || row.symbol;

            // Create the asset
            asset = await assetService.create({
              userId: request.userId,
              symbol: row.symbol.toUpperCase(),
              name,
              assetClass,
              provider,
            });
          } else if (skipExisting) {
            results.skipped++;
            continue;
          }

          // Create the holding
          await holdingService.create(request.userId, {
            assetId: asset.id,
            quantity: row.quantity,
            purchasePrice: row.purchasePrice,
            purchaseDate: row.purchaseDate,
            notes: row.notes,
          });

          results.imported++;
        } catch (error) {
          results.errors.push({
            row: i + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        results,
      };
    }
  );

  // Parse CSV and return preview (client sends parsed CSV data)
  fastify.post<{
    Body: {
      data: Record<string, string>[];
      mapping: z.infer<typeof csvMappingSchema>;
    };
  }>('/csv/preview', async (request, reply) => {
    const { data, mapping } = request.body;

    const mappingValidation = csvMappingSchema.safeParse(mapping);
    if (!mappingValidation.success) {
      return reply.status(400).send({ error: mappingValidation.error.errors });
    }

    const m = mappingValidation.data;
    const preview: z.infer<typeof importRowSchema>[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];

      try {
        const parsedRow = {
          symbol: row[m.symbolColumn]?.trim() || '',
          name: m.nameColumn ? row[m.nameColumn]?.trim() : undefined,
          assetClass: m.assetClassColumn
            ? (row[m.assetClassColumn]?.trim().toLowerCase() as AssetClass)
            : undefined,
          quantity: parseFloat(row[m.quantityColumn] || '0'),
          purchasePrice: parseFloat(row[m.purchasePriceColumn] || '0'),
          purchaseDate: formatDate(row[m.purchaseDateColumn], m.dateFormat),
          notes: m.notesColumn ? row[m.notesColumn]?.trim() : undefined,
        };

        const validation = importRowSchema.safeParse(parsedRow);
        if (validation.success) {
          preview.push(validation.data);
        } else {
          errors.push({
            row: i + 1,
            error: validation.error.errors.map((e) => e.message).join(', '),
          });
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }

    return {
      preview,
      errors,
      totalRows: data.length,
    };
  });

  // Import from CSV data (client sends parsed CSV)
  fastify.post<{
    Body: {
      data: Record<string, string>[];
      mapping: z.infer<typeof csvMappingSchema>;
      skipExisting?: boolean;
    };
  }>('/csv/import', async (request, reply) => {
    const { data, mapping, skipExisting = false } = request.body;

    const mappingValidation = csvMappingSchema.safeParse(mapping);
    if (!mappingValidation.success) {
      return reply.status(400).send({ error: mappingValidation.error.errors });
    }

    const m = mappingValidation.data;
    const rows: z.infer<typeof importRowSchema>[] = [];
    const parseErrors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        const parsedRow = {
          symbol: row[m.symbolColumn]?.trim() || '',
          name: m.nameColumn ? row[m.nameColumn]?.trim() : undefined,
          assetClass: m.assetClassColumn
            ? (row[m.assetClassColumn]?.trim().toLowerCase() as AssetClass)
            : undefined,
          quantity: parseFloat(row[m.quantityColumn] || '0'),
          purchasePrice: parseFloat(row[m.purchasePriceColumn] || '0'),
          purchaseDate: formatDate(row[m.purchaseDateColumn], m.dateFormat),
          notes: m.notesColumn ? row[m.notesColumn]?.trim() : undefined,
        };

        const validation = importRowSchema.safeParse(parsedRow);
        if (validation.success) {
          rows.push(validation.data);
        } else {
          parseErrors.push({
            row: i + 1,
            error: validation.error.errors.map((e) => e.message).join(', '),
          });
        }
      } catch (error) {
        parseErrors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }

    // Now import the valid rows
    const importResult = await importHoldings(rows, skipExisting, request.userId);

    return {
      success: true,
      results: {
        ...importResult,
        parseErrors,
      },
    };
  });

  // ============ ZERODHA TRADEBOOK IMPORT ============
  //
  // Two modes (body.kind): `stocks` (NSE/BSE equities & ETFs) vs `mutual_funds` (segment MF).
  // Rows that do not match the selected mode are reported in filteredOut and not imported.

  const tradebookBodySchema = z.object({
    data: z.array(z.record(z.string())),
    kind: z.enum(['stocks', 'mutual_funds']).default('stocks'),
  });

  fastify.post<{
    Body: z.infer<typeof tradebookBodySchema>;
  }>('/tradebook', async (request, reply) => {
    const validation = tradebookBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.errors });
    }

    const { data, kind } = validation.data;

    if (!data || data.length === 0) {
      return reply.status(400).send({ error: 'No data provided' });
    }

    const rows: TradebookRow[] = [];
    const parseErrors: { row: number; error: string }[] = [];
    const filteredOut: { row: number; symbol: string; reason: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        // Skip empty rows
        if (!row.symbol || !row.quantity || !row.price) {
          continue;
        }

        const parsedRow: TradebookRow = {
          symbol: row.symbol?.trim().toUpperCase() || '',
          isin: row.isin?.trim(),
          segment: row.segment?.trim(),
          tradeDate: row.trade_date?.trim() || '',
          exchange: row.exchange?.trim(),
          tradeType: row.trade_type?.trim().toLowerCase() as 'buy' | 'sell',
          quantity: parseFloat(row.quantity || '0'),
          price: parseFloat(row.price || '0'),
          orderExecutionTime: row.order_execution_time?.trim(),
        };

        // Validate required fields
        if (!parsedRow.symbol) {
          parseErrors.push({ row: i + 2, error: 'Missing symbol' });
          continue;
        }
        if (!parsedRow.tradeDate) {
          parseErrors.push({ row: i + 2, error: 'Missing trade_date' });
          continue;
        }
        if (!['buy', 'sell'].includes(parsedRow.tradeType)) {
          parseErrors.push({ row: i + 2, error: `Invalid trade_type: ${parsedRow.tradeType}` });
          continue;
        }
        if (isNaN(parsedRow.quantity) || parsedRow.quantity <= 0) {
          parseErrors.push({ row: i + 2, error: 'Invalid quantity' });
          continue;
        }
        if (isNaN(parsedRow.price) || parsedRow.price <= 0) {
          parseErrors.push({ row: i + 2, error: 'Invalid price' });
          continue;
        }

        const rowIsMF = isMutualFundRow(parsedRow);
        if (kind === 'stocks' && rowIsMF) {
          filteredOut.push({
            row: i + 2,
            symbol: parsedRow.symbol.slice(0, 48),
            reason: 'Mutual fund row — use Zerodha Mutual Funds import',
          });
          continue;
        }
        if (kind === 'mutual_funds' && !rowIsMF) {
          filteredOut.push({
            row: i + 2,
            symbol: parsedRow.symbol.slice(0, 48),
            reason: 'Not a mutual fund row — use Zerodha Stocks import',
          });
          continue;
        }

        rows.push(parsedRow);
      } catch (error) {
        parseErrors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }

    const fundSourceId = await resolveFundSource(kind, request.userId);
    const importResult = await importTradebook(rows, kind, fundSourceId, request.userId);

    return {
      success: true,
      results: {
        ...importResult,
        parseErrors,
        filteredOut,
        fundSourceId,
      },
    };
  });
}

// Helper function to format dates from various formats
function formatDate(dateStr: string | undefined, format: string = 'YYYY-MM-DD'): string {
  if (!dateStr) return '';

  const cleaned = dateStr.trim();

  // If already in correct format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // Try to parse common formats
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return dateToLocal(date);
  }

  // Handle MM/DD/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch && format.startsWith('DD')) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return cleaned;
}

// Helper to import holdings
async function importHoldings(
  rows: z.infer<typeof importRowSchema>[],
  skipExisting: boolean,
  userId: string
) {
  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as { row: number; error: string }[],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      let asset = await assetService.getBySymbol(userId, row.symbol);

      if (!asset) {
        const searchResults = await marketDataService.search(row.symbol);
        const matchingResult = searchResults.find(
          (r) => r.symbol.toUpperCase() === row.symbol.toUpperCase()
        );

        const assetClass: AssetClass = row.assetClass || 
          matchingResult?.assetClass || 
          'stocks';

        asset = await assetService.create({
          userId,
          symbol: row.symbol.toUpperCase(),
          name: row.name || matchingResult?.name || row.symbol,
          assetClass,
          provider: matchingResult?.provider || 'manual',
        });
      } else if (skipExisting) {
        results.skipped++;
        continue;
      }

      await holdingService.create(userId, {
        assetId: asset.id,
        quantity: row.quantity,
        purchasePrice: row.purchasePrice,
        purchaseDate: row.purchaseDate,
        notes: row.notes,
      });

      results.imported++;
    } catch (error) {
      results.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// ============ TRADEBOOK TYPES AND HELPERS ============

interface TradebookRow {
  symbol: string;
  isin?: string;
  segment?: string;
  tradeDate: string;
  exchange?: string;
  tradeType: 'buy' | 'sell';
  quantity: number;
  price: number;
  orderExecutionTime?: string;
}

// Detect asset class from Indian stock symbol patterns (equities / ETFs only)
function detectAssetClass(symbol: string): AssetClass {
  const upper = symbol.toUpperCase();
  
  // ETF patterns for Indian markets
  if (
    upper.includes('ETF') ||
    upper.includes('BEES') ||
    upper.endsWith('IFTY') ||
    upper.includes('NIFTY') ||
    upper.includes('NEXT50') ||
    upper.includes('MOMENTUM') ||
    upper.includes('MOMOMENTUM') ||
    upper.includes('MOREALTY') ||
    upper.includes('SILVERIETF') ||
    upper.includes('GOLDIETF') ||
    upper.includes('AUTOIETF') ||
    upper.includes('FMCGIETF')
  ) {
    return 'etf';
  }
  
  return 'stocks';
}

// Import tradebook transactions (caller must pass rows that all match `kind`)
async function resolveFundSource(
  kind: 'stocks' | 'mutual_funds' | 'holdings',
  userId: string,
  hint?: string
): Promise<string | null> {
  const { db } = await import('../db/index.js');
  const { assets } = await import('../db/schema.js');
  const { eq, and } = await import('drizzle-orm');

  if (hint) {
    const exact = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, hint), eq(assets.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (exact) return exact.id;
  }

  // Zerodha stock imports → look for a "Zerodha" cash asset
  if (kind === 'stocks') {
    const match = await db
      .select({ id: assets.id, name: assets.name })
      .from(assets)
      .where(and(eq(assets.assetClass, 'cash'), eq(assets.userId, userId)));
    const z = match.find((a) => /zerodha/i.test(a.name));
    return z?.id ?? null;
  }

  // MF imports → look for a bank/savings cash asset (not Zerodha/IndMoney)
  if (kind === 'mutual_funds') {
    const match = await db
      .select({ id: assets.id, name: assets.name })
      .from(assets)
      .where(and(eq(assets.assetClass, 'cash'), eq(assets.userId, userId)));
    const bank = match.find((a) => /bank|kotak|savings/i.test(a.name));
    return bank?.id ?? null;
  }

  return null;
}

async function importTradebook(
  rows: TradebookRow[],
  kind: 'stocks' | 'mutual_funds',
  fundSourceId: string | null | undefined,
  userId: string
): Promise<{
  imported: number;
  skipped: number;
  errors: { row: number; symbol: string; error: string }[];
  summary: {
    totalBuys: number;
    totalSells: number;
    uniqueSymbols: number;
  };
}> {
  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as { row: number; symbol: string; error: string }[],
    summary: {
      totalBuys: 0,
      totalSells: 0,
      uniqueSymbols: 0,
    },
  };

  const isMF = kind === 'mutual_funds';

  // Group: MF by ISIN (Zerodha label variants); stocks/ETFs by ticker.
  const groups = new Map<string, TradebookRow[]>();
  for (const row of rows) {
    const isin = row.isin?.trim().toUpperCase();
    const key = isMF
      ? isin
        ? `MF:${isin}`
        : `MFNAME:${normalizeFundLabel(row.symbol)}`
      : `EQ:${row.symbol.toUpperCase()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  results.summary.uniqueSymbols = groups.size;

  for (const [, transactions] of groups) {
    const sample = transactions[0];
    const isin = sample.isin?.trim().toUpperCase();

    const displayName = transactions.reduce(
      (longest, r) => (r.symbol.length > longest.length ? r.symbol : longest),
      sample.symbol
    );
    const mfClass = isMF ? classifyMutualFund(displayName) : null;

    let asset = undefined as Awaited<ReturnType<typeof assetService.getBySymbol>> | undefined;

    if (isMF) {
      if (isin) {
        asset = await assetService.getByIsin(userId, isin);
      }
      if (!asset) {
        for (const cand of mutualFundSymbolCandidates(isin, transactions)) {
          asset = await assetService.getBySymbol(userId, cand);
          if (asset) break;
        }
      }
      if (
        asset &&
        (asset.assetClass === 'stocks' ||
          asset.assetClass === 'etf' ||
          asset.assetClass === 'mutual_fund')
      ) {
        await assetService.update(userId, asset.id, {
          assetClass: mfClass!,
          name: displayName.length >= asset.name.length ? displayName : asset.name,
          isin: isin ?? asset.isin ?? null,
        });
        asset = await assetService.getById(userId, asset.id);
      }
    }

    const equitySymbol = sample.symbol.toUpperCase();
    const yahooSymbol = `${equitySymbol}.NS`;

    if (!asset && !isMF) {
      asset = await assetService.getBySymbol(userId, yahooSymbol);
      if (!asset) {
        asset = await assetService.getBySymbol(userId, equitySymbol);
      }
    }

    if (!asset && isMF) {
      const mfSymbol = isin ?? normalizeFundLabel(displayName);
      asset = await assetService.create({
        userId,
        symbol: mfSymbol,
        isin: isin ?? null,
        name: displayName,
        assetClass: mfClass!,
        provider: 'manual',
        currency: 'INR',
      });
    }

    if (!asset && !isMF) {
      const assetClass = detectAssetClass(equitySymbol);
      let assetName = equitySymbol;
      let currentPrice: number | undefined;
      try {
        const quote = await marketDataService.getQuote(yahooSymbol);
        if (quote) {
          assetName = quote.name;
          currentPrice = quote.price;
        }
      } catch {
        // Ignore quote errors
      }

      asset = await assetService.create({
        userId,
        symbol: yahooSymbol,
        name: assetName,
        assetClass,
        provider: 'yahoo_finance',
        currentPrice,
        currency: 'INR',
      });
    }

    if (!asset) {
      for (const tx of transactions) {
        const rowIndex = rows.indexOf(tx) + 2;
        results.errors.push({
          row: rowIndex,
          symbol: tx.symbol,
          error: 'Could not resolve asset',
        });
      }
      continue;
    }

    const sortedTx = [...transactions].sort((a, b) => {
      const dateCompare = a.tradeDate.localeCompare(b.tradeDate);
      if (dateCompare !== 0) return dateCompare;
      if (a.tradeType === 'buy' && b.tradeType === 'sell') return -1;
      if (a.tradeType === 'sell' && b.tradeType === 'buy') return 1;
      if (a.orderExecutionTime && b.orderExecutionTime) {
        return a.orderExecutionTime.localeCompare(b.orderExecutionTime);
      }
      return 0;
    });

    const reportSymbol = isMF && isin ? displayName : equitySymbol;

    for (const tx of sortedTx) {
      const rowIndex = rows.indexOf(tx) + 2;

      try {
        await transactionService.create(userId, {
          userId,
          assetId: asset.id!,
          type: tx.tradeType as TransactionType,
          quantity: tx.quantity,
          price: tx.price,
          fees: 0,
          fundSourceId: fundSourceId ?? undefined,
          transactionDate: formatDate(tx.tradeDate),
          notes: tx.exchange ? `${tx.exchange}` : undefined,
        });

        results.imported++;
        if (tx.tradeType === 'buy') {
          results.summary.totalBuys++;
        } else {
          results.summary.totalSells++;
        }
      } catch (error) {
        results.errors.push({
          row: rowIndex,
          symbol: reportSymbol,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return results;
}
