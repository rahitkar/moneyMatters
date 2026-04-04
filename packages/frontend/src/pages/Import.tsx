import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Coins,
} from 'lucide-react';
import { clsx } from 'clsx';
import Papa from 'papaparse';
import Card from '../components/Card';
import { useImportHoldings, useImportTradebook, type TradebookImportResult } from '../api/hooks';
import type { AssetClass } from '../api/types';

// CSV template content
const CSV_TEMPLATE = `Symbol,Name,Asset Class,Quantity,Purchase Price,Purchase Date,Notes
AAPL,Apple Inc.,stocks,10,150.00,2024-01-15,Initial purchase
MSFT,Microsoft Corporation,stocks,5,380.00,2024-01-20,Tech allocation
BTC,Bitcoin,crypto,0.5,42000.00,2024-02-01,DCA buy
ETH,Ethereum,crypto,2,2500.00,2024-02-15,DCA buy
VOO,Vanguard S&P 500 ETF,etf,20,450.00,2024-03-01,Index fund
GOLD,Gold,gold,2,1950.00,2024-03-10,Per troy ounce
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'holdings_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ImportTab = 'holdings' | 'zerodha_stocks' | 'zerodha_mf';

export default function Import() {
  const [activeTab, setActiveTab] = useState<ImportTab>('zerodha_stocks');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">Import Data</h1>
      </div>

      {/* Tab Selector */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('zerodha_stocks')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'zerodha_stocks'
                ? 'bg-brand-600 text-white'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            <TrendingUp className="w-4 h-4" />
            Zerodha Stocks
          </button>
          <button
            onClick={() => setActiveTab('zerodha_mf')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'zerodha_mf'
                ? 'bg-brand-600 text-white'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            <Coins className="w-4 h-4" />
            Zerodha Mutual Funds
          </button>
          <button
            onClick={() => setActiveTab('holdings')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'holdings'
                ? 'bg-brand-600 text-white'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            <FileText className="w-4 h-4" />
            Holdings CSV
          </button>
        </div>
      </Card>

      {activeTab === 'zerodha_stocks' && <ZerodhaTradebookImport kind="stocks" />}
      {activeTab === 'zerodha_mf' && <ZerodhaTradebookImport kind="mutual_funds" />}
      {activeTab === 'holdings' && <HoldingsImport />}
    </div>
  );
}

// ============ ZERODHA TRADEBOOK IMPORT ============

type ZerodhaTradebookKind = 'stocks' | 'mutual_funds';

interface TradebookPreviewRow {
  symbol: string;
  isin?: string;
  segment?: string;
  trade_date: string;
  trade_type: string;
  quantity: number;
  price: number;
  exchange?: string;
}

function ZerodhaTradebookImport({ kind }: { kind: ZerodhaTradebookKind }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [previewRows, setPreviewRows] = useState<TradebookPreviewRow[]>([]);
  const [importResult, setImportResult] = useState<TradebookImportResult['results'] | null>(null);

  const importTradebook = useImportTradebook();

  const handleFilesUpload = useCallback((newFiles: File[]) => {
    const csvFiles = newFiles.filter(
      (f) => f.type === 'text/csv' || f.name.endsWith('.csv')
    );
    if (csvFiles.length === 0) return;

    setFiles((prev) => [...prev, ...csvFiles]);

    // Parse all files
    const allData: Record<string, string>[] = [];
    let completed = 0;

    csvFiles.forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as Record<string, string>[];
          allData.push(...data);
          completed++;

          if (completed === csvFiles.length) {
            setParsedData((prev) => [...prev, ...allData]);

            const preview: TradebookPreviewRow[] = allData
              .filter((r) => r.symbol && r.quantity && r.price)
              .map((r) => ({
                symbol: (r.symbol ?? '').trim().toUpperCase(),
                isin: r.isin?.trim(),
                segment: r.segment?.trim(),
                trade_date: r.trade_date,
                trade_type: r.trade_type?.toLowerCase() ?? '',
                quantity: parseFloat(r.quantity || '0'),
                price: parseFloat(r.price || '0'),
                exchange: r.exchange,
              }));

            setPreviewRows((prev) => [...prev, ...preview]);
            setStep('preview');
          }
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
        },
      });
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFilesUpload(droppedFiles);
    },
    [handleFilesUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      handleFilesUpload(selectedFiles);
    },
    [handleFilesUpload]
  );

  const handleImport = async () => {
    setStep('importing');
    try {
      const result = await importTradebook.mutateAsync({ data: parsedData, kind });
      setImportResult(result.results);
      setStep('complete');
    } catch (error) {
      console.error('Import error:', error);
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setFiles([]);
    setParsedData([]);
    setPreviewRows([]);
    setImportResult(null);
  };

  const buys = previewRows.filter((r) => r.trade_type === 'buy');
  const sells = previewRows.filter((r) => r.trade_type === 'sell');
  const uniqueLineCount =
    kind === 'mutual_funds'
      ? new Set(
          previewRows.map((r) => (r.isin && r.isin.length >= 3 ? r.isin.toUpperCase() : r.symbol))
        ).size
      : new Set(previewRows.map((r) => r.symbol)).size;

  const uploadTitle =
    kind === 'stocks' ? 'Upload Zerodha stock tradebooks' : 'Upload Zerodha mutual fund tradebooks';
  const uploadBlurb =
    kind === 'stocks'
      ? 'Equity and ETF rows only. MF rows in the same file are skipped automatically.'
      : 'Mutual fund (segment MF) rows only. Stock rows are skipped automatically.';
  const inputId = kind === 'stocks' ? 'tradebook-stocks-upload' : 'tradebook-mf-upload';

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <Card>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-surface-700 rounded-xl p-12 text-center hover:border-brand-500/50 transition-colors"
          >
            <Upload className="w-12 h-12 text-surface-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-100 mb-2">{uploadTitle}</h3>
            <p className="text-surface-400 mb-2">
              Drag and drop CSV exports here, or click to browse. You can add multiple year files at
              once.
            </p>
            <p className="text-surface-500 text-sm mb-6">{uploadBlurb}</p>
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id={inputId}
            />
            <label htmlFor={inputId} className="btn btn-primary cursor-pointer">
              <FileText className="w-4 h-4" />
              Select CSV Files
            </label>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-surface-300 mb-3">
              Expected Zerodha tradebook columns
            </h3>
            <div className="bg-surface-900/50 rounded-xl p-4 overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-surface-400">
                    <th className="pr-4 pb-2">symbol</th>
                    {kind === 'mutual_funds' && (
                      <>
                        <th className="pr-4 pb-2">isin</th>
                        <th className="pr-4 pb-2">segment</th>
                      </>
                    )}
                    <th className="pr-4 pb-2">trade_date</th>
                    <th className="pr-4 pb-2">trade_type</th>
                    <th className="pr-4 pb-2">quantity</th>
                    <th className="pr-4 pb-2">price</th>
                    <th className="pr-4 pb-2">exchange</th>
                  </tr>
                </thead>
                <tbody className="text-surface-300">
                  {kind === 'stocks' ? (
                    <>
                      <tr>
                        <td className="pr-4">RELIANCE</td>
                        <td className="pr-4">2024-01-15</td>
                        <td className="pr-4 text-green-400">buy</td>
                        <td className="pr-4">10</td>
                        <td className="pr-4">2500.00</td>
                        <td className="pr-4">NSE</td>
                      </tr>
                      <tr>
                        <td className="pr-4">TCS</td>
                        <td className="pr-4">2024-02-01</td>
                        <td className="pr-4 text-red-400">sell</td>
                        <td className="pr-4">5</td>
                        <td className="pr-4">3800.00</td>
                        <td className="pr-4">NSE</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="pr-4 max-w-[220px] whitespace-normal">
                        AXIS LIQUID FUND - DIRECT GROWTH
                      </td>
                      <td className="pr-4 font-mono text-xs">INF846K01CX4</td>
                      <td className="pr-4">MF</td>
                      <td className="pr-4">2026-01-05</td>
                      <td className="pr-4 text-green-400">buy</td>
                      <td className="pr-4">33.095</td>
                      <td className="pr-4">3021.45</td>
                      <td className="pr-4">BSE</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-surface-500 mt-3">
              Console: Reports → Tradebook → Download (use your equity export on Stocks and your MF
              export on Mutual Funds).
            </p>
          </div>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-surface-100">
                  Import Preview
                </h3>
                <p className="text-sm text-surface-400">
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={reset} className="btn btn-secondary">
                  Start Over
                </button>
                <button
                  onClick={handleImport}
                  disabled={previewRows.length === 0 || importTradebook.isPending}
                  className="btn btn-primary"
                >
                  Import All Transactions
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-surface-100">
                  {previewRows.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/10">
                <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3" /> Buys
                </p>
                <p className="text-2xl font-bold text-green-400">{buys.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10">
                <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Sells
                </p>
                <p className="text-2xl font-bold text-red-400">{sells.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-brand-500/10">
                <p className="text-xs text-surface-500 mb-1">
                  {kind === 'mutual_funds' ? 'Unique schemes (ISIN)' : 'Unique tickers'}
                </p>
                <p className="text-2xl font-bold text-brand-400">{uniqueLineCount}</p>
              </div>
            </div>
          </Card>

          {/* Files List */}
          <Card padding="sm">
            <h4 className="text-sm font-semibold text-surface-300 px-4 pt-2 mb-3">
              Files to Import
            </h4>
            <div className="space-y-1">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-surface-800/30"
                >
                  <FileText className="w-4 h-4 text-surface-500" />
                  <span className="text-sm text-surface-300">{file.name}</span>
                  <span className="text-xs text-surface-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview Table */}
          <Card padding="sm">
            <h4 className="text-sm font-semibold text-surface-300 px-4 pt-2 mb-3">
              Transaction Preview (first 30)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="table-header">Symbol</th>
                    {kind === 'mutual_funds' && (
                      <th className="table-header font-mono text-xs">ISIN</th>
                    )}
                    <th className="table-header">Date</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Quantity</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {previewRows.slice(0, 30).map((row, index) => (
                    <tr key={index} className="hover:bg-surface-800/30">
                      <td className="table-cell font-medium text-surface-100 max-w-[200px]">
                        {row.symbol}
                      </td>
                      {kind === 'mutual_funds' && (
                        <td className="table-cell font-mono text-xs text-surface-400">
                          {row.isin ?? '—'}
                        </td>
                      )}
                      <td className="table-cell text-surface-400">{row.trade_date}</td>
                      <td className="table-cell">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            row.trade_type === 'buy'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {row.trade_type === 'buy' ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {row.trade_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        {row.quantity}
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        ₹{row.price.toFixed(2)}
                      </td>
                      <td className="table-cell text-right tabular-nums text-surface-300">
                        ₹{(row.quantity * row.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 30 && (
                <p className="text-center text-sm text-surface-500 py-4">
                  Showing 30 of {previewRows.length} transactions
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {step === 'importing' && (
        <Card>
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-100 mb-2">
              Importing Transactions...
            </h3>
            <p className="text-surface-400">
              Processing {previewRows.length} rows (
              {kind === 'mutual_funds' ? `${uniqueLineCount} schemes` : `${uniqueLineCount} tickers`})
            </p>
          </div>
        </Card>
      )}

      {step === 'complete' && importResult && (
        <Card>
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-surface-100 mb-2">
              Import Complete!
            </h3>
            <p className="text-surface-400 mb-6">
              Successfully imported {importResult.imported} transactions
            </p>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
              <div className="p-3 rounded-xl bg-green-500/10">
                <p className="text-2xl font-bold text-green-400">
                  {importResult.summary.totalBuys}
                </p>
                <p className="text-xs text-surface-500">Buys</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <p className="text-2xl font-bold text-red-400">
                  {importResult.summary.totalSells}
                </p>
                <p className="text-xs text-surface-500">Sells</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-500/10">
                <p className="text-2xl font-bold text-brand-400">
                  {importResult.summary.uniqueSymbols}
                </p>
                <p className="text-xs text-surface-500">
                  {kind === 'mutual_funds' ? 'MF schemes' : 'Tickers'}
                </p>
              </div>
            </div>

            {(importResult.filteredOut ?? []).length > 0 && (
              <div className="max-w-lg mx-auto mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left">
                <h4 className="text-sm font-semibold text-amber-400 mb-2">
                  Skipped rows (wrong import type) ({(importResult.filteredOut ?? []).length})
                </h4>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {(importResult.filteredOut ?? []).slice(0, 8).map((e, i) => (
                    <p key={`f-${i}`} className="text-xs text-surface-400">
                      Row {e.row} ({e.symbol}): {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {(importResult.errors.length > 0 || importResult.parseErrors.length > 0) && (
              <div className="max-w-lg mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-left">
                <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Import Issues ({importResult.errors.length + importResult.parseErrors.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <p key={`err-${i}`} className="text-xs text-surface-400">
                      {e.symbol}: {e.error}
                    </p>
                  ))}
                  {importResult.parseErrors.slice(0, 5).map((e, i) => (
                    <p key={`parse-${i}`} className="text-xs text-surface-400">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button onClick={reset} className="btn btn-secondary">
                Import More
              </button>
              <a href="/transactions" className="btn btn-primary">
                View Transactions
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ HOLDINGS IMPORT (Original) ============

interface ParsedRow {
  symbol: string;
  name?: string;
  assetClass?: AssetClass;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string;
}

interface ColumnMapping {
  symbolColumn: string;
  nameColumn: string;
  assetClassColumn: string;
  quantityColumn: string;
  purchasePriceColumn: string;
  purchaseDateColumn: string;
  notesColumn: string;
}

function HoldingsImport() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    symbolColumn: '',
    nameColumn: '',
    assetClassColumn: '',
    quantityColumn: '',
    purchasePriceColumn: '',
    purchaseDateColumn: '',
    notesColumn: '',
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; error: string }[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const importHoldings = useImportHoldings();

  const handleFileUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const cols = results.meta.fields || [];

        setCsvData(data);
        setColumns(cols);

        // Auto-detect column mappings
        const autoMapping: ColumnMapping = {
          symbolColumn: findColumn(cols, ['symbol', 'ticker', 'code']),
          nameColumn: findColumn(cols, ['name', 'company', 'asset']),
          assetClassColumn: findColumn(cols, ['class', 'type', 'assetclass', 'asset_class']),
          quantityColumn: findColumn(cols, ['quantity', 'qty', 'shares', 'units', 'amount']),
          purchasePriceColumn: findColumn(cols, ['price', 'cost', 'purchase_price', 'purchaseprice', 'avg_price']),
          purchaseDateColumn: findColumn(cols, ['date', 'purchase_date', 'purchasedate', 'buy_date']),
          notesColumn: findColumn(cols, ['notes', 'comment', 'remarks']),
        };

        setMapping(autoMapping);
        setStep('mapping');
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handlePreview = () => {
    const rows: ParsedRow[] = [];
    const parseErrors: { row: number; error: string }[] = [];

    csvData.forEach((row, index) => {
      try {
        const symbol = row[mapping.symbolColumn]?.trim();
        const quantity = parseFloat(row[mapping.quantityColumn] || '0');
        const purchasePrice = parseFloat(row[mapping.purchasePriceColumn] || '0');
        const purchaseDate = formatDate(row[mapping.purchaseDateColumn]);

        if (!symbol) {
          parseErrors.push({ row: index + 1, error: 'Missing symbol' });
          return;
        }
        if (isNaN(quantity) || quantity <= 0) {
          parseErrors.push({ row: index + 1, error: 'Invalid quantity' });
          return;
        }
        if (isNaN(purchasePrice) || purchasePrice <= 0) {
          parseErrors.push({ row: index + 1, error: 'Invalid price' });
          return;
        }
        if (!purchaseDate) {
          parseErrors.push({ row: index + 1, error: 'Invalid date' });
          return;
        }

        rows.push({
          symbol: symbol.toUpperCase(),
          name: mapping.nameColumn ? row[mapping.nameColumn]?.trim() : undefined,
          assetClass: mapping.assetClassColumn
            ? (row[mapping.assetClassColumn]?.trim().toLowerCase() as AssetClass)
            : undefined,
          quantity,
          purchasePrice,
          purchaseDate,
          notes: mapping.notesColumn ? row[mapping.notesColumn]?.trim() : undefined,
        });
      } catch (error) {
        parseErrors.push({
          row: index + 1,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    });

    setParsedRows(rows);
    setErrors(parseErrors);
    setStep('preview');
  };

  const handleImport = async () => {
    try {
      const result = await importHoldings.mutateAsync({
        rows: parsedRows,
        skipExisting: false,
      });
      setImportResult(result.results);
      setStep('complete');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const reset = () => {
    setStep('upload');
    setCsvData([]);
    setColumns([]);
    setMapping({
      symbolColumn: '',
      nameColumn: '',
      assetClassColumn: '',
      quantityColumn: '',
      purchasePriceColumn: '',
      purchaseDateColumn: '',
      notesColumn: '',
    });
    setParsedRows([]);
    setErrors([]);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {['upload', 'mapping', 'preview', 'complete'].map((s, index) => (
          <div key={s} className="flex items-center">
            <div
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s
                  ? 'bg-brand-600 text-white'
                  : ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > index
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'bg-surface-800 text-surface-500'
              )}
            >
              {index + 1}
            </div>
            {index < 3 && (
              <div
                className={clsx(
                  'w-16 h-0.5 mx-2',
                  ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > index
                    ? 'bg-brand-600'
                    : 'bg-surface-700'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <Card>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-surface-700 rounded-xl p-12 text-center hover:border-brand-500/50 transition-colors"
          >
            <Upload className="w-12 h-12 text-surface-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-100 mb-2">
              Upload CSV File
            </h3>
            <p className="text-surface-400 mb-6">
              Drag and drop your CSV file here, or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="btn btn-primary cursor-pointer">
              <FileText className="w-4 h-4" />
              Select CSV File
            </label>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-300">
                Expected CSV Format
              </h3>
              <button onClick={downloadTemplate} className="btn btn-secondary text-sm">
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
            <div className="bg-surface-900/50 rounded-xl p-4 overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-surface-400">
                    <th className="pr-4 pb-2">Symbol</th>
                    <th className="pr-4 pb-2">Name</th>
                    <th className="pr-4 pb-2">Asset Class</th>
                    <th className="pr-4 pb-2">Quantity</th>
                    <th className="pr-4 pb-2">Price</th>
                    <th className="pr-4 pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="text-surface-300">
                  <tr>
                    <td className="pr-4">AAPL</td>
                    <td className="pr-4">Apple Inc.</td>
                    <td className="pr-4">stocks</td>
                    <td className="pr-4">10</td>
                    <td className="pr-4">150.00</td>
                    <td className="pr-4">2024-01-15</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-surface-500 mt-3">
              <strong>Asset Class options:</strong> stocks, etf, mutual_fund_equity, mutual_fund_debt, crypto, bonds, real_estate, gold, cash
            </p>
          </div>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-surface-100">Map Your Columns</h3>
            <button onClick={reset} className="btn btn-secondary text-sm">
              Start Over
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Symbol Column <span className="text-red-400">*</span>
              </label>
              <select
                value={mapping.symbolColumn}
                onChange={(e) => setMapping((m) => ({ ...m, symbolColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Name Column</label>
              <select
                value={mapping.nameColumn}
                onChange={(e) => setMapping((m) => ({ ...m, nameColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column (optional)</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                Quantity Column <span className="text-red-400">*</span>
              </label>
              <select
                value={mapping.quantityColumn}
                onChange={(e) => setMapping((m) => ({ ...m, quantityColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                Price Column <span className="text-red-400">*</span>
              </label>
              <select
                value={mapping.purchasePriceColumn}
                onChange={(e) => setMapping((m) => ({ ...m, purchasePriceColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                Date Column <span className="text-red-400">*</span>
              </label>
              <select
                value={mapping.purchaseDateColumn}
                onChange={(e) => setMapping((m) => ({ ...m, purchaseDateColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Asset Class Column</label>
              <select
                value={mapping.assetClassColumn}
                onChange={(e) => setMapping((m) => ({ ...m, assetClassColumn: e.target.value }))}
                className="input"
              >
                <option value="">Select column (optional)</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-surface-700">
            <button
              onClick={handlePreview}
              disabled={
                !mapping.symbolColumn ||
                !mapping.quantityColumn ||
                !mapping.purchasePriceColumn ||
                !mapping.purchaseDateColumn
              }
              className="btn btn-primary"
            >
              Preview Import
            </button>
          </div>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-surface-100">Import Preview</h3>
                <p className="text-sm text-surface-400">
                  {parsedRows.length} rows ready to import
                  {errors.length > 0 && `, ${errors.length} rows with errors`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={reset} className="btn btn-secondary">
                  Start Over
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsedRows.length === 0 || importHoldings.isPending}
                  className="btn btn-primary"
                >
                  {importHoldings.isPending ? 'Importing...' : 'Import All'}
                </button>
              </div>
            </div>
          </Card>

          {errors.length > 0 && (
            <Card className="border-red-500/30">
              <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Rows with Errors ({errors.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {errors.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-sm text-surface-400">
                    Row {e.row}: {e.error}
                  </p>
                ))}
              </div>
            </Card>
          )}

          <Card padding="sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="table-header">Symbol</th>
                    <th className="table-header">Name</th>
                    <th className="table-header text-right">Quantity</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {parsedRows.slice(0, 20).map((row, index) => (
                    <tr key={index}>
                      <td className="table-cell font-medium text-surface-100">{row.symbol}</td>
                      <td className="table-cell text-surface-400">{row.name || '—'}</td>
                      <td className="table-cell text-right tabular-nums">{row.quantity}</td>
                      <td className="table-cell text-right tabular-nums">${row.purchasePrice.toFixed(2)}</td>
                      <td className="table-cell text-surface-400">{row.purchaseDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {step === 'complete' && importResult && (
        <Card>
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-brand-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-surface-100 mb-2">Import Complete!</h3>
            <p className="text-surface-400 mb-6">
              Successfully imported {importResult.imported} holdings
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={reset} className="btn btn-secondary">
                Import More
              </button>
              <a href="/holdings" className="btn btn-primary">
                View Holdings
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Helper functions
function findColumn(columns: string[], candidates: string[]): string {
  const lowerCols = columns.map((c) => c.toLowerCase());
  for (const candidate of candidates) {
    const index = lowerCols.indexOf(candidate.toLowerCase());
    if (index !== -1) return columns[index];
  }
  return '';
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return '';
}
