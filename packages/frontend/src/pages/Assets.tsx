import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  Wallet,
  Tag as TagIcon,
  Tags as TagsIcon,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Scissors,
  RefreshCw,
  PiggyBank,
  Scale,
  X,
  CheckSquare,
} from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import AssetClassBadge from '../components/AssetClassBadge';
import TagBadge from '../components/TagBadge';
import ManualAssetForm from '../components/ManualAssetForm';
import PhysicalMetalForm from '../components/PhysicalMetalForm';
import MetalTransactionForm from '../components/MetalTransactionForm';
import UpdateBalanceModal from '../components/UpdateBalanceModal';
import DepositWithdrawForm from '../components/DepositWithdrawForm';
import {
  useAsset,
  useAssets,
  useCreateAsset,
  useDeleteAsset,
  useSearch,
  useTags,
  useSetAssetTags,
  useBulkTagAssets,
  usePositions,
  useTransactionsWithAssets,
  useExchangeRate,
  useApplyStockSplit,
  usePortfolioSummary,
} from '../api/hooks';
import { formatCurrency, formatNumber, formatPercent, formatDate, formatRelativeTime } from '../lib/format';
import type { AssetClass, Provider, Tag, SearchResult, Position, TransactionWithAsset } from '../api/types';

import CurrencyValue, { toInr } from '../components/CurrencyValue';

const isIndianSymbol = (symbol: string) =>
  symbol.endsWith('.NS') || symbol.endsWith('.BO');

// ── Hierarchical filter system ──────────────────────────────────

type PrimaryCategory = 'all' | 'india' | 'international' | 'metals' | 'crypto' | 'cash_equiv' | 'physical';

interface SubFilterDef {
  value: string;
  label: string;
  children?: { value: string; label: string }[];
}

const GOV_SCHEME_CLASSES: AssetClass[] = ['ppf', 'epf', 'nps'];
const METAL_CLASSES: AssetClass[] = ['gold', 'gold_physical', 'silver', 'silver_physical', 'metals'];
const CASH_EQUIV_CLASSES: AssetClass[] = ['cash', 'fixed_deposit', 'bonds', 'lended'];
const PHYSICAL_ASSET_CLASSES: AssetClass[] = ['real_estate', 'vehicle'];

const PRIMARY_CATEGORIES: { value: PrimaryCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'india', label: 'India' },
  { value: 'international', label: 'International' },
  { value: 'metals', label: 'Commodities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash_equiv', label: 'Cash & Equivalents' },
  { value: 'physical', label: 'Physical Assets' },
];

const SUB_FILTERS: Record<PrimaryCategory, SubFilterDef[]> = {
  all: [],
  india: [
    { value: 'all', label: 'All' },
    { value: 'in_stocks', label: 'Stocks' },
    { value: 'in_etf', label: 'ETFs' },
    { value: 'mf_equity', label: 'MF Equity' },
    { value: 'mf_debt', label: 'MF Debt' },
    {
      value: 'gov_schemes', label: 'Gov Schemes',
      children: [
        { value: 'ppf', label: 'PPF' },
        { value: 'epf', label: 'EPF' },
        { value: 'nps', label: 'NPS' },
      ],
    },
  ],
  international: [
    { value: 'all', label: 'All' },
    { value: 'us_stocks', label: 'US Stocks' },
    { value: 'us_etf', label: 'US ETFs' },
    { value: 'other_intl', label: 'Other' },
  ],
  metals: [
    { value: 'all', label: 'All' },
    { value: 'gold', label: 'Gold ETF' },
    { value: 'gold_physical', label: 'Gold (Physical)' },
    { value: 'silver', label: 'Silver ETF' },
    { value: 'silver_physical', label: 'Silver (Physical)' },
    { value: 'other_metals', label: 'Commodities' },
  ],
  crypto: [],
  cash_equiv: [
    { value: 'all', label: 'All' },
    { value: 'cash', label: 'Cash (Savings)' },
    { value: 'fixed_deposit', label: 'Fixed Deposit' },
    { value: 'bonds', label: 'Bonds' },
    { value: 'lended', label: 'Lended' },
  ],
  physical: [
    { value: 'all', label: 'All' },
    { value: 'real_estate', label: 'Property' },
    { value: 'vehicle', label: 'Vehicle' },
  ],
};

const MF_CLASSES: AssetClass[] = ['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt'];
const MANUAL_ASSET_CLASSES: Set<AssetClass> = new Set(['ppf', 'epf', 'nps', 'fixed_deposit', 'bonds', 'cash', 'lended', 'real_estate', 'vehicle', 'external_portfolio', 'gold_physical', 'silver_physical']);
const PHYSICAL_METAL_CLASSES: Set<AssetClass> = new Set(['gold_physical', 'silver_physical']);

function getAssetPrimaryCategory(assetClass: string, symbol: string): PrimaryCategory {
  if (METAL_CLASSES.includes(assetClass as AssetClass)) return 'metals';
  if (PHYSICAL_ASSET_CLASSES.includes(assetClass as AssetClass)) return 'physical';
  if (CASH_EQUIV_CLASSES.includes(assetClass as AssetClass)) return 'cash_equiv';
  if (GOV_SCHEME_CLASSES.includes(assetClass as AssetClass)) return 'india';
  if (MF_CLASSES.includes(assetClass as AssetClass)) return 'india';
  if (assetClass === 'crypto') return 'crypto';
  if (assetClass === 'external_portfolio') return 'all';
  if (assetClass === 'stocks' || assetClass === 'etf') {
    return isIndianSymbol(symbol) ? 'india' : 'international';
  }
  return isIndianSymbol(symbol) ? 'india' : 'international';
}

function matchesSubFilter(p: Position, sub: string): boolean {
  const indian = isIndianSymbol(p.symbol);
  switch (sub) {
    case 'in_stocks': return p.assetClass === 'stocks' && indian;
    case 'in_etf': return p.assetClass === 'etf' && indian;
    case 'mf_equity': return p.assetClass === 'mutual_fund_equity' || p.assetClass === 'mutual_fund';
    case 'mf_debt': return p.assetClass === 'mutual_fund_debt';
    case 'gov_schemes': return GOV_SCHEME_CLASSES.includes(p.assetClass);
    case 'ppf': return p.assetClass === 'ppf';
    case 'epf': return p.assetClass === 'epf';
    case 'nps': return p.assetClass === 'nps';
    case 'us_stocks': return p.assetClass === 'stocks' && !indian;
    case 'us_etf': return p.assetClass === 'etf' && !indian;
    case 'other_intl': return getAssetPrimaryCategory(p.assetClass, p.symbol) === 'international' && p.assetClass !== 'stocks' && p.assetClass !== 'etf';
    case 'gold': return p.assetClass === 'gold';
    case 'gold_physical': return p.assetClass === 'gold_physical';
    case 'silver': return p.assetClass === 'silver';
    case 'silver_physical': return p.assetClass === 'silver_physical';
    case 'other_metals': return p.assetClass === 'metals';
    case 'cash': return p.assetClass === 'cash';
    case 'fixed_deposit': return p.assetClass === 'fixed_deposit';
    case 'bonds': return p.assetClass === 'bonds';
    case 'lended': return p.assetClass === 'lended';
    case 'real_estate': return p.assetClass === 'real_estate';
    case 'vehicle': return p.assetClass === 'vehicle';
    default: return false;
  }
}

function getSubsForPrimary(primary: PrimaryCategory, subs: Set<string>): string[] {
  const allSubValues = SUB_FILTERS[primary]
    .flatMap((sf) => [sf.value, ...(sf.children?.map((c) => c.value) ?? [])]);
  return allSubValues.filter((v) => v !== 'all' && subs.has(v));
}

function matchesSelection(p: Position, primaries: Set<PrimaryCategory>, subs: Set<string>): boolean {
  if (primaries.size === 0 && subs.size === 0) return true;

  const assetPrimary = getAssetPrimaryCategory(p.assetClass, p.symbol);

  for (const sub of subs) {
    if (matchesSubFilter(p, sub)) return true;
  }

  for (const primary of primaries) {
    const activeSubs = getSubsForPrimary(primary, subs);
    if (activeSubs.length === 0 && assetPrimary === primary) return true;
  }

  return false;
}

interface ColFilter {
  symbol: string;
  name: string;
  assetClass: string;
  tagIds: string[];
}

const EMPTY_COL_FILTER: ColFilter = {
  symbol: '',
  name: '',
  assetClass: '',
  tagIds: [],
};

function matchesColFilters(
  p: Position,
  f: ColFilter,
  assetTagMap: Map<string, string[]>,
): boolean {
  if (f.symbol && !p.symbol.toLowerCase().includes(f.symbol.toLowerCase())) return false;
  if (f.name && !p.name.toLowerCase().includes(f.name.toLowerCase())) return false;
  if (f.assetClass && p.assetClass !== f.assetClass) return false;
  if (f.tagIds.length > 0) {
    const tags = assetTagMap.get(p.assetId) ?? [];
    if (!f.tagIds.some((tid) => tags.includes(tid))) return false;
  }
  return true;
}

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: 'stocks', label: 'Stocks' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund_equity', label: 'Mutual Fund - Equity' },
  { value: 'mutual_fund_debt', label: 'Mutual Fund - Debt' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'real_estate', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'gold', label: 'Gold ETF' },
  { value: 'gold_physical', label: 'Gold (Physical)' },
  { value: 'silver', label: 'Silver ETF' },
  { value: 'silver_physical', label: 'Silver (Physical)' },
  { value: 'metals', label: 'Commodities' },
  { value: 'ppf', label: 'PPF' },
  { value: 'epf', label: 'EPF' },
  { value: 'nps', label: 'NPS' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'lended', label: 'Lended' },
  { value: 'cash', label: 'Cash' },
  { value: 'external_portfolio', label: 'External Portfolio' },
];

type SortField = 'symbol' | 'name' | 'assetClass' | 'quantity' | 'averageCost' | 'currentPrice' | 'invested' | 'currentValue' | 'pnl' | 'pnlPercent';
type SortDirection = 'asc' | 'desc';

function compareFn(a: Position, b: Position, field: SortField, dir: SortDirection, usdToInr: number | null): number {
  const inr = (v: number, cur: string) => toInr(v, cur, usdToInr);
  let cmp = 0;
  switch (field) {
    case 'symbol':
      cmp = a.symbol.localeCompare(b.symbol);
      break;
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'assetClass':
      cmp = a.assetClass.localeCompare(b.assetClass);
      break;
    case 'quantity':
      cmp = a.quantity - b.quantity;
      break;
    case 'averageCost':
      cmp = inr(a.averageCost, a.currency) - inr(b.averageCost, b.currency);
      break;
    case 'currentPrice':
      cmp = inr(a.currentPrice ?? 0, a.currency) - inr(b.currentPrice ?? 0, b.currency);
      break;
    case 'invested':
      cmp = inr(a.totalCost, a.currency) - inr(b.totalCost, b.currency);
      break;
    case 'currentValue':
      cmp = inr(a.currentValue, a.currency) - inr(b.currentValue, b.currency);
      break;
    case 'pnl':
      cmp = inr(a.unrealizedGain, a.currency) - inr(b.unrealizedGain, b.currency);
      break;
    case 'pnlPercent':
      cmp = a.unrealizedGainPercent - b.unrealizedGainPercent;
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

type AllocDimension = 'bySubCategory' | 'byAssetClass' | 'byGeography' | 'byInstrumentType' | 'byRiskProfile' | 'byCurrency' | 'byLiquidity' | 'byOwnership';

const ALLOC_MF_CLASSES = new Set(['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt']);

function getAllocDimensionLabel(dimension: AllocDimension, assetClass: string, symbol: string, currency: string): string {
  const indian = isIndianSymbol(symbol);
  switch (dimension) {
    case 'byAssetClass':
      switch (assetClass) {
        case 'stocks': return 'Stocks'; case 'etf': return 'ETF';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Fund';
        case 'gold': return 'Gold'; case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver'; case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'bySubCategory':
      switch (assetClass) {
        case 'stocks': return indian ? 'Indian Stocks' : 'US Stocks';
        case 'etf': return indian ? 'Indian ETFs' : 'US ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': return 'MF Equity';
        case 'mutual_fund_debt': return 'MF Debt';
        case 'gold': return 'Gold ETF'; case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver ETF'; case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'byGeography':
      if (METAL_CLASSES.includes(assetClass as AssetClass)) return 'Metals';
      if (CASH_EQUIV_CLASSES.includes(assetClass as AssetClass)) return 'Cash & Equivalents';
      if (assetClass === 'real_estate' || assetClass === 'vehicle') return 'Physical Assets';
      if (assetClass === 'crypto') return 'Crypto';
      if (assetClass === 'external_portfolio') return 'External';
      if (GOV_SCHEME_CLASSES.includes(assetClass as AssetClass) || ALLOC_MF_CLASSES.has(assetClass)) return 'India';
      return indian ? 'India' : 'International';
    case 'byInstrumentType':
      switch (assetClass) {
        case 'stocks': return 'Equities'; case 'etf': return 'ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Funds';
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical': case 'metals': return 'Commodities';
        case 'ppf': case 'epf': case 'nps': return 'Gov Schemes';
        case 'fixed_deposit': case 'bonds': return 'Fixed Income';
        case 'crypto': return 'Crypto'; case 'lended': return 'Lended'; case 'cash': return 'Cash';
        case 'real_estate': case 'vehicle': return 'Physical Assets';
        case 'external_portfolio': return 'External Portfolio';
        default: return 'Other';
      }
    case 'byRiskProfile':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical':
        case 'metals': case 'crypto':
        case 'external_portfolio':
          return 'Growth Investment';
        case 'mutual_fund_debt': case 'bonds': case 'fixed_deposit': return 'Protective Investment';
        case 'lended': return 'Lended';
        case 'epf': case 'ppf': case 'nps': return 'Retirement';
        case 'real_estate': case 'vehicle': return 'Physical Asset';
        case 'cash': return 'Cash';
        default: return 'Other';
      }
    case 'byLiquidity':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'mutual_fund_debt': case 'crypto': case 'cash': case 'bonds':
        case 'fixed_deposit': case 'external_portfolio':
        case 'gold': case 'silver': case 'metals':
          return 'Liquid';
        case 'gold_physical': case 'silver_physical':
        case 'ppf': case 'epf': case 'nps':
        case 'lended': case 'real_estate': case 'vehicle':
          return 'Non-Liquid';
        default: return 'Other';
      }
    case 'byCurrency':
      return currency || 'INR';
    case 'byOwnership':
      return assetClass === 'external_portfolio' ? "Dad's Portfolio" : 'My Portfolio';
  }
}

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: positions, isLoading: posLoading } = usePositions();
  const { data: allTransactions, isLoading: txLoading } = useTransactionsWithAssets();
  const { data: allAssets } = useAssets();
  const { data: tags } = useTags();
  const { data: summary } = usePortfolioSummary();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = summary?.usdToInr ?? usdInrRate?.rate ?? null;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [splitTarget, setSplitTarget] = useState<{ assetId: string; symbol: string; name: string } | null>(null);
  const [balanceTarget, setBalanceTarget] = useState<Position | null>(null);
  const [depositTarget, setDepositTarget] = useState<Position | null>(null);
  const [metalTxTarget, setMetalTxTarget] = useState<Position | null>(null);
  const [selectedPrimaries, setSelectedPrimaries] = useState<Set<PrimaryCategory>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('currentValue');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [colFilter, setColFilter] = useState<ColFilter>({ ...EMPTY_COL_FILTER });
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [dimensionFilter, setDimensionFilter] = useState<{ dimension: AllocDimension; label: string } | null>(null);

  useEffect(() => {
    const dim = searchParams.get('dimension') as AllocDimension | null;
    const label = searchParams.get('label');
    if (dim && label) {
      setDimensionFilter({ dimension: dim, label });
      setSearchParams({}, { replace: true });
    }
  }, []);

  const isLoading = posLoading || txLoading;

  const assetTagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allAssets?.forEach((a) => {
      if (a.tags?.length) map.set(a.id, a.tags.map((t) => t.id));
    });
    return map;
  }, [allAssets]);

  const txByAsset = useMemo(() => {
    const map = new Map<string, TransactionWithAsset[]>();
    allTransactions?.forEach((tx) => {
      const list = map.get(tx.assetId) ?? [];
      list.push(tx);
      map.set(tx.assetId, list);
    });
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)));
    }
    return map;
  }, [allTransactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' || field === 'name' || field === 'assetClass' ? 'asc' : 'desc');
    }
  };

  const filteredPositions = useMemo(() => {
    if (!positions) return [];
    return positions
      .filter((p) => {
        if (dimensionFilter) {
          const label = getAllocDimensionLabel(dimensionFilter.dimension, p.assetClass, p.symbol, p.currency);
          if (label !== dimensionFilter.label) return false;
        }
        return matchesSelection(p, selectedPrimaries, selectedSubs) && matchesColFilters(p, colFilter, assetTagMap);
      })
      .sort((a, b) => compareFn(a, b, sortField, sortDir, usdToInr));
  }, [positions, selectedPrimaries, selectedSubs, sortField, sortDir, colFilter, assetTagMap, usdToInr, dimensionFilter]);

  const activeFilterCount = useMemo(() => {
    let count = selectedPrimaries.size + selectedSubs.size;
    if (colFilter.symbol) count++;
    if (colFilter.name) count++;
    if (colFilter.assetClass) count++;
    if (colFilter.tagIds.length > 0) count++;
    if (dimensionFilter) count++;
    return count;
  }, [colFilter, selectedPrimaries, selectedSubs, dimensionFilter]);

  const togglePrimary = (value: PrimaryCategory) => {
    setSelectedPrimaries((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
        setSelectedSubs((prevSubs) => {
          const nextSubs = new Set(prevSubs);
          const allSubValues = SUB_FILTERS[value]
            .flatMap((sf) => [sf.value, ...(sf.children?.map((c) => c.value) ?? [])]);
          allSubValues.forEach((sv) => nextSubs.delete(sv));
          return nextSubs;
        });
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) {
        next.delete(sub);
      } else {
        next.add(sub);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedPrimaries(new Set());
    setSelectedSubs(new Set());
    setColFilter({ ...EMPTY_COL_FILTER });
    setDimensionFilter(null);
  };

  const toggleTagFilter = (tagId: string) =>
    setColFilter((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter((id) => id !== tagId)
        : [...f.tagIds, tagId],
    }));

  const isFiltered = activeFilterCount > 0;

  const totals = useMemo(() => {
    if (!filteredPositions.length) return null;

    // When unfiltered, use server-computed summary for consistent values with Dashboard
    if (!isFiltered && summary) {
      const rate = summary.usdToInr;
      return {
        invested: summary.totalCost,
        current: summary.totalValue,
        pnl: summary.totalGain,
        pnlPercent: summary.totalGainPercent,
        investedUsd: rate ? summary.totalCost / rate : null,
        currentUsd: rate ? summary.totalValue / rate : null,
        pnlUsd: rate ? summary.totalGain / rate : null,
      };
    }

    const METAL_SELL_FACTOR = 0.95;
    const invested = filteredPositions.reduce((s, p) => s + toInr(p.totalCost, p.currency, usdToInr), 0);
    const current = filteredPositions.reduce((s, p) => {
      const val = toInr(p.currentValue, p.currency, usdToInr);
      return s + (PHYSICAL_METAL_CLASSES.has(p.assetClass) ? val * METAL_SELL_FACTOR : val);
    }, 0);
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const investedUsd = usdToInr ? invested / usdToInr : null;
    const currentUsd = usdToInr ? current / usdToInr : null;
    const pnlUsd = usdToInr ? pnl / usdToInr : null;
    return { invested, current, pnl, pnlPercent, investedUsd, currentUsd, pnlUsd };
  }, [filteredPositions, usdToInr, isFiltered, summary]);

  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedAssets(new Set(filteredPositions.map((p) => p.assetId)));
  }, [filteredPositions]);

  const clearSelection = useCallback(() => {
    setSelectedAssets(new Set());
    setBulkSelectMode(false);
  }, []);

  const allVisibleSelected = filteredPositions.length > 0 && selectedAssets.size === filteredPositions.length
    && filteredPositions.every((p) => selectedAssets.has(p.assetId));

  if (isLoading) {
    return <LoadingPage />;
  }

  const hasNoPositions = !positions || positions.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 animate-fade-in">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-surface-100">Assets</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showFilters
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] leading-none bg-brand-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (bulkSelectMode) clearSelection();
              else setBulkSelectMode(true);
            }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              bulkSelectMode
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            <TagsIcon className="w-4 h-4" />
            Bulk Tag
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {totals && (
        <div className="space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-surface-500 tabular-nums">
            {filteredPositions.length} asset{filteredPositions.length !== 1 ? 's' : ''}
          </p>
          {usdToInr && (
            <p className="text-xs text-surface-500 tabular-nums">
              1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="stat-label">Total Value</p>
            <p className="stat-value text-surface-100">{formatCurrency(totals.current, 'INR')}</p>
            {totals.currentUsd !== null && (
              <p className="text-xs text-surface-500 mt-0.5">{formatCurrency(totals.currentUsd, 'USD')}</p>
            )}
          </Card>
          <Card>
            <p className="stat-label">Current Invested</p>
            <p className="stat-value text-surface-100">{formatCurrency(totals.invested, 'INR')}</p>
            {totals.investedUsd !== null && (
              <p className="text-xs text-surface-500 mt-0.5">{formatCurrency(totals.investedUsd, 'USD')}</p>
            )}
          </Card>
          <Card>
            <p className="stat-label">Total P&L</p>
            <p className={clsx('stat-value', totals.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
              {totals.pnl >= 0 ? '+' : ''}{formatCurrency(totals.pnl, 'INR')}
            </p>
            {totals.pnlUsd !== null && (
              <p className={clsx('text-xs mt-0.5', totals.pnl >= 0 ? 'text-green-400/60' : 'text-red-400/60')}>
                {totals.pnl >= 0 ? '+' : ''}{formatCurrency(totals.pnlUsd, 'USD')}
              </p>
            )}
          </Card>
          <Card>
            <p className="stat-label">P&L %</p>
            <p className={clsx('stat-value', totals.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400')}>
              {totals.pnlPercent >= 0 ? '+' : ''}{formatPercent(totals.pnlPercent)}
            </p>
          </Card>
        </div>
        </div>
      )}

      {/* Dimension filter badge from Dashboard */}
      {dimensionFilter && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span className="text-xs text-surface-500">Filtered by:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-600/20 text-brand-400 ring-1 ring-brand-500/40">
            {dimensionFilter.label}
            <button
              type="button"
              onClick={() => setDimensionFilter(null)}
              className="hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {/* Primary category chips (multi-select) */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setSelectedPrimaries(new Set()); setSelectedSubs(new Set()); }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              selectedPrimaries.size === 0
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
            )}
          >
            All
          </button>
          {PRIMARY_CATEGORIES.filter((c) => c.value !== 'all').map((cat) => (
            <button
              type="button"
              key={cat.value}
              onClick={() => togglePrimary(cat.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selectedPrimaries.has(cat.value)
                  ? 'bg-brand-600/20 text-brand-400 ring-1 ring-brand-500/40'
                  : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sub-category chips for each selected primary (multi-select) */}
        {[...selectedPrimaries].map((primary) => {
          const subs = SUB_FILTERS[primary].filter((sf) => sf.value !== 'all');
          if (subs.length === 0) return null;
          const label = PRIMARY_CATEGORIES.find((c) => c.value === primary)?.label ?? primary;
          return (
            <div key={primary} className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap pl-2 border-l-2 border-surface-700">
                <span className="text-[10px] uppercase tracking-wider text-surface-600 mr-1">{label}</span>
                {subs.map((sf) => {
                  const isParentActive = selectedSubs.has(sf.value);
                  const hasActiveChild = sf.children?.some((c) => selectedSubs.has(c.value));
                  return (
                    <button
                      type="button"
                      key={sf.value}
                      onClick={() => toggleSub(sf.value)}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        isParentActive || hasActiveChild
                          ? 'bg-brand-600/30 text-brand-300 ring-1 ring-brand-500/30'
                          : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800/50'
                      )}
                    >
                      {sf.label}
                    </button>
                  );
                })}
              </div>

              {/* Level 3 children for active sub-filters with children */}
              {subs.filter((sf) => sf.children && (selectedSubs.has(sf.value) || sf.children.some((c) => selectedSubs.has(c.value)))).map((sf) => (
                <div key={`${sf.value}-children`} className="flex items-center gap-1.5 flex-wrap pl-4 border-l-2 border-surface-700/50">
                  {sf.children!.map((child) => (
                    <button
                      type="button"
                      key={child.value}
                      onClick={() => toggleSub(child.value)}
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                        selectedSubs.has(child.value)
                          ? 'bg-surface-700 text-surface-100 ring-1 ring-surface-500/40'
                          : 'text-surface-500 hover:text-surface-200'
                      )}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <Card padding="sm" className="shrink-0">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1 block">Symbol</label>
                <input
                  type="text"
                  value={colFilter.symbol}
                  onChange={(e) => setColFilter((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="Filter by symbol..."
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1 block">Name</label>
                <input
                  type="text"
                  value={colFilter.name}
                  onChange={(e) => setColFilter((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Filter by name..."
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1 block">Class</label>
                <select
                  value={colFilter.assetClass}
                  onChange={(e) => setColFilter((f) => ({ ...f, assetClass: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="">All Classes</option>
                  {ASSET_CLASSES.map((ac) => (
                    <option key={ac.value} value={ac.value}>{ac.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-surface-800/50 border border-surface-700">
                  {tags && tags.length > 0 ? (
                    tags.map((tag) => {
                      const isActive = colFilter.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagFilter(tag.id)}
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all',
                            isActive
                              ? 'ring-1 ring-white/30 shadow-sm'
                              : 'opacity-40 hover:opacity-70'
                          )}
                          style={{ backgroundColor: tag.color + (isActive ? '' : '40'), color: isActive ? '#fff' : undefined }}
                        >
                          {tag.name}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-surface-500">No tags</span>
                  )}
                </div>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex justify-end gap-3">
                {(selectedPrimaries.size > 0 || selectedSubs.size > 0) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPrimaries(new Set()); setSelectedSubs(new Set()); }}
                    className="text-xs text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    Clear category filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Bulk action bar */}
      {selectedAssets.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-brand-600/10 border border-brand-500/20 animate-fade-in shrink-0">
          <CheckSquare className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span className="text-sm text-surface-200 font-medium">
            {selectedAssets.size} asset{selectedAssets.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setIsBulkTagModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 transition-colors"
          >
            <TagsIcon className="w-3.5 h-3.5" />
            Tag Selected
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Positions Table */}
      {filteredPositions.length > 0 ? (
        <Card padding="sm" className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full table-fixed">
              <colgroup>
                {bulkSelectMode && <col className="w-8" />}
                <col className="w-8" />
                <col style={{ width: '18%' }} />
                <col className="w-[68px]" />
                <col style={{ width: '6%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-surface-700 bg-surface-900">
                  {bulkSelectMode && (
                    <th className="table-header w-8">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={() => allVisibleSelected ? clearSelection() : selectAllVisible()}
                        className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 cursor-pointer"
                        title={allVisibleSelected ? 'Deselect all' : 'Select all visible'}
                      />
                    </th>
                  )}
                  <th className="table-header w-8"></th>
                  <SortableHeader field="name" label="Name" current={sortField} dir={sortDir} onSort={handleSort} />
                  <SortableHeader field="assetClass" label="Class" current={sortField} dir={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader field="quantity" label="Qty" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="averageCost" label="Avg Cost" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="currentPrice" label="LTP" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="currentValue" label="Current" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="invested" label="Invested" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="pnl" label="P&L" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader field="pnlPercent" label="P&L%" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <th className="table-header text-right">Upd.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filteredPositions.map((position) => (
                  <Fragment key={position.assetId}>
                    <PositionRow
                      position={position}
                      usdToInr={usdToInr}
                      isExpanded={expandedAssetId === position.assetId}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedAssets.has(position.assetId)}
                      onToggle={() =>
                        setExpandedAssetId((prev) =>
                          prev === position.assetId ? null : position.assetId
                        )
                      }
                      onSelectToggle={() => toggleAssetSelection(position.assetId)}
                      onTagClick={() => {
                        setSelectedAssetId(position.assetId);
                        setIsTagModalOpen(true);
                      }}
                      onSplitClick={() =>
                        setSplitTarget({
                          assetId: position.assetId,
                          symbol: position.symbol,
                          name: position.name,
                        })
                      }
                      onUpdateBalance={() => setBalanceTarget(position)}
                      onDeposit={() => setDepositTarget(position)}
                      onMetalTransaction={() => setMetalTxTarget(position)}
                    />
                    {expandedAssetId === position.assetId && (
                      <TransactionRows
                        transactions={txByAsset.get(position.assetId) ?? []}
                        symbol={position.symbol}
                        currentPrice={position.currentPrice ?? 0}
                        currency={position.currency || 'INR'}
                        usdToInr={usdToInr}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPositions.some((p) => PHYSICAL_METAL_CLASSES.has(p.assetClass)) && (
            <p className="text-[11px] text-surface-500 px-4 pb-3 pt-1 shrink-0">
              * Physical metal prices reflect Indian rates (import duty + GST) with a 5% deduction for making charges, impurities & wear.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Wallet}
            title="No assets found"
            description={
              hasNoPositions && activeFilterCount === 0
                ? "You haven't added any assets yet. Add an asset and record transactions to see your portfolio."
                : 'No assets match your current filters.'
            }
            action={
              hasNoPositions &&
              activeFilterCount === 0 && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Asset
                </button>
              )
            }
          />
        </Card>
      )}

      {/* Add Asset Modal */}
      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Update Balance Modal */}
      {balanceTarget && (
        <UpdateBalanceModal
          isOpen={!!balanceTarget}
          onClose={() => setBalanceTarget(null)}
          position={balanceTarget}
        />
      )}

      {/* Deposit / Withdraw Modal */}
      {depositTarget && (
        <DepositWithdrawForm
          isOpen={!!depositTarget}
          onClose={() => setDepositTarget(null)}
          position={depositTarget}
        />
      )}

      {/* Metal Buy/Sell Modal */}
      {metalTxTarget && (
        <MetalTransactionForm
          isOpen={!!metalTxTarget}
          onClose={() => setMetalTxTarget(null)}
          position={metalTxTarget}
        />
      )}

      {/* Tag Modal */}
      {selectedAssetId && (
        <TagAssetModal
          isOpen={isTagModalOpen}
          onClose={() => {
            setIsTagModalOpen(false);
            setSelectedAssetId(null);
          }}
          assetId={selectedAssetId}
          tags={tags || []}
        />
      )}

      {/* Bulk Tag Modal */}
      <BulkTagModal
        isOpen={isBulkTagModalOpen}
        onClose={() => setIsBulkTagModalOpen(false)}
        assetIds={selectedAssets}
        tags={tags || []}
        allAssets={allAssets}
        onDone={clearSelection}
      />

      {/* Stock Split Modal */}
      {splitTarget && (
        <StockSplitModal
          isOpen={!!splitTarget}
          onClose={() => setSplitTarget(null)}
          assetId={splitTarget.assetId}
          symbol={splitTarget.symbol}
          name={splitTarget.name}
          transactions={(txByAsset.get(splitTarget.assetId) ?? []).slice().reverse()}
        />
      )}
    </div>
  );
}

function SortableHeader({
  field,
  label,
  current,
  dir,
  onSort,
  align,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'right' | 'center';
}) {
  const isActive = current === field;
  return (
    <th
      className={clsx('table-header cursor-pointer select-none hover:text-surface-100 transition-colors', align === 'right' && 'text-right', align === 'center' && 'text-center')}
      onClick={() => onSort(field)}
    >
      <span className={clsx('inline-flex items-center gap-1', align === 'right' && 'justify-end', align === 'center' && 'justify-center')}>
        {label}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </span>
    </th>
  );
}

function PositionRow({
  position,
  usdToInr,
  isExpanded,
  bulkSelectMode,
  isSelected,
  onToggle,
  onSelectToggle,
  onTagClick,
  onSplitClick,
  onUpdateBalance,
  onDeposit,
  onMetalTransaction,
}: {
  position: Position;
  usdToInr: number | null;
  isExpanded: boolean;
  bulkSelectMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelectToggle: () => void;
  onTagClick: () => void;
  onSplitClick: () => void;
  onUpdateBalance: () => void;
  onDeposit: () => void;
  onMetalTransaction: () => void;
}) {
  const deleteAsset = useDeleteAsset();
  const setAssetTags = useSetAssetTags();
  const { data: assetWithTags } = useAsset(position.assetId);
  const cur = position.currency || 'INR';
  const isManual = MANUAL_ASSET_CLASSES.has(position.assetClass);
  const isMetal = PHYSICAL_METAL_CLASSES.has(position.assetClass);

  // Physical metals: 5% deduction for making charges, impurities, and wear
  const METAL_SELL_FACTOR = 0.95;
  const adjPrice = isMetal && position.currentPrice ? position.currentPrice * METAL_SELL_FACTOR : position.currentPrice;
  const adjValue = isMetal ? position.currentValue * METAL_SELL_FACTOR : position.currentValue;
  const adjGain = adjValue - position.totalCost;
  const adjGainPercent = position.totalCost > 0 ? (adjGain / position.totalCost) * 100 : 0;
  const isPositive = adjGain >= 0;

  const handleDelete = () => {
    if (confirm(`Delete ${position.symbol}? This will also delete all transactions.`)) {
      deleteAsset.mutate(position.assetId);
    }
  };

  return (
    <tr className={clsx('group relative hover:bg-surface-800/30 transition-colors', isExpanded && 'bg-surface-800/20', isSelected && 'bg-brand-500/5')}>
      {bulkSelectMode && (
        <td className="table-cell w-8">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelectToggle}
            className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 cursor-pointer"
          />
        </td>
      )}
      <td className="table-cell w-8">
        <button
          onClick={onToggle}
          className="p-1 rounded text-surface-400 hover:text-surface-100 transition-colors"
        >
          <ChevronRight className={clsx('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>
      </td>
      <td className="table-cell">
        <div>
          <span
            onClick={onToggle}
            className="text-surface-200 text-sm leading-snug cursor-pointer select-all break-words"
          >
            {position.name}
          </span>
          {isManual && assetWithTags?.institution && (
            <p className="text-[11px] text-surface-500 mt-0.5">{assetWithTags.institution}</p>
          )}
          {assetWithTags?.tags && assetWithTags.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {assetWithTags.tags.slice(0, 2).map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  onRemove={() => {
                    const remaining = assetWithTags.tags!.filter((t) => t.id !== tag.id).map((t) => t.id);
                    setAssetTags.mutate({ assetId: position.assetId, tagIds: remaining });
                  }}
                />
              ))}
              {assetWithTags.tags.length > 2 && (
                <span className="text-xs text-surface-500">+{assetWithTags.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        {/* Hover actions */}
        <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 bg-surface-800 border border-surface-700 rounded-lg px-1 py-0.5 shadow-lg z-10">
          {isMetal ? (
            <button
              onClick={onMetalTransaction}
              className="p-1.5 rounded text-surface-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Buy / Sell metal"
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          ) : isManual ? (
            <>
              <button
                onClick={onUpdateBalance}
                className="p-1.5 rounded text-surface-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                title="Update balance"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDeposit}
                className="p-1.5 rounded text-surface-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                title="Deposit / Withdraw"
              >
                <PiggyBank className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={onSplitClick}
              className="p-1.5 rounded text-surface-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Apply stock split"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onTagClick}
            className="p-1.5 rounded text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
            title="Manage tags"
          >
            <TagIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteAsset.isPending}
            className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete asset and all transactions"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="table-cell text-center">
        <AssetClassBadge assetClass={position.assetClass} size="sm" />
      </td>
      <td className="table-cell text-right tabular-nums">
        {formatNumber(position.quantity)}{isMetal && <span className="text-surface-500 text-xs ml-0.5">g</span>}
      </td>
      <td className="table-cell text-right tabular-nums">
        <CurrencyValue value={position.averageCost} currency={cur} usdToInr={usdToInr} />
      </td>
      <td className="table-cell text-right tabular-nums font-medium text-surface-100">
        {adjPrice
          ? (
            <span title={isMetal ? `Market: ${formatCurrency(position.currentPrice!, cur)} · 5% deducted for charges/impurities` : undefined}>
              <CurrencyValue value={adjPrice} currency={cur} usdToInr={usdToInr} />
              {isMetal && <span className="text-surface-500 text-[10px] ml-0.5">*</span>}
            </span>
          )
          : '—'}
      </td>
      <td className="table-cell text-right tabular-nums font-medium text-surface-100">
        <span title={isMetal ? 'After 5% selling deduction' : undefined}>
          <CurrencyValue value={adjValue} currency={cur} usdToInr={usdToInr} />
        </span>
      </td>
      <td className="table-cell text-right tabular-nums">
        <CurrencyValue value={position.totalCost} currency={cur} usdToInr={usdToInr} />
      </td>
      <td className={clsx('table-cell text-right tabular-nums font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
        <CurrencyValue value={adjGain} currency={cur} usdToInr={usdToInr} sign />
      </td>
      <td className={clsx('table-cell text-right tabular-nums font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
        {isPositive ? '+' : ''}{formatPercent(adjGainPercent)}
      </td>
      <td className="table-cell text-right text-xs text-surface-500" title={assetWithTags?.lastUpdated ? new Date(Number(assetWithTags.lastUpdated)).toLocaleString() : ''}>
        {formatRelativeTime(assetWithTags?.lastUpdated)}
      </td>
    </tr>
  );
}

function TransactionRows({
  transactions,
  symbol,
  currentPrice,
  currency,
  usdToInr,
}: {
  transactions: TransactionWithAsset[];
  symbol: string;
  currentPrice: number;
  currency: string;
  usdToInr: number | null;
}) {
  const thClass = 'text-xs font-medium text-surface-500 uppercase tracking-wider py-2 px-3';

  if (transactions.length === 0) {
    return (
      <tr>
        <td colSpan={11} className="px-6 py-4">
          <p className="text-sm text-surface-500 text-center">No transactions found for {symbol}</p>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="bg-surface-800/40">
        <td colSpan={11} className="px-6 py-2">
          <div className="mb-2 text-xs font-medium text-surface-500 uppercase tracking-wider">{symbol}</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={clsx(thClass, 'text-left')}>Date</th>
                  <th className={clsx(thClass, 'text-left')}>Type</th>
                  <th className={clsx(thClass, 'text-right')}>Qty</th>
                  <th className={clsx(thClass, 'text-right')}>Buy Price</th>
                  <th className={clsx(thClass, 'text-right')}>Invested</th>
                  <th className={clsx(thClass, 'text-right')}>Current</th>
                  <th className={clsx(thClass, 'text-right')}>P&L</th>
                  <th className={clsx(thClass, 'text-right')}>P&L %</th>
                  <th className={clsx(thClass, 'text-left')}>Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {transactions.map((tx) => {
                  const invested = tx.quantity * tx.price + (tx.fees ?? 0);
                  const curVal = tx.type === 'buy' ? tx.quantity * currentPrice : 0;
                  const pnl = tx.type === 'buy' ? curVal - invested : 0;
                  const pnlPct = tx.type === 'buy' && invested > 0 ? (pnl / invested) * 100 : 0;
                  const isBuy = tx.type === 'buy';
                  const isPositive = pnl >= 0;

                  return (
                    <tr key={tx.id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="py-2 px-3 text-sm text-surface-300">{formatDate(tx.transactionDate)}</td>
                      <td className="py-2 px-3">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {isBuy ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-right tabular-nums text-surface-300">
                        {formatNumber(tx.quantity)}
                      </td>
                      <td className="py-2 px-3 text-sm text-right tabular-nums text-surface-300">
                        <CurrencyValue value={tx.price} currency={currency} usdToInr={usdToInr} />
                      </td>
                      <td className="py-2 px-3 text-sm text-right tabular-nums text-surface-200">
                        <CurrencyValue value={invested} currency={currency} usdToInr={usdToInr} />
                      </td>
                      <td className="py-2 px-3 text-sm text-right tabular-nums font-medium text-surface-100">
                        {isBuy
                          ? <CurrencyValue value={curVal} currency={currency} usdToInr={usdToInr} />
                          : <span className="text-surface-500">—</span>}
                      </td>
                      <td className={clsx('py-2 px-3 text-sm text-right tabular-nums font-medium', isBuy ? (isPositive ? 'text-green-400' : 'text-red-400') : 'text-surface-500')}>
                        {isBuy
                          ? <CurrencyValue value={pnl} currency={currency} usdToInr={usdToInr} sign />
                          : '—'}
                      </td>
                      <td className={clsx('py-2 px-3 text-sm text-right tabular-nums font-medium', isBuy ? (isPositive ? 'text-green-400' : 'text-red-400') : 'text-surface-500')}>
                        {isBuy
                          ? <>{isPositive ? '+' : ''}{formatPercent(pnlPct)}</>
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-sm text-surface-500 truncate max-w-[120px]">{tx.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </>
  );
}

function AddAssetModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'market' | 'account' | 'metal'>('market');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    assetClass: 'stocks' as AssetClass,
  });

  const { data: searchResults, isLoading: searching } = useSearch(searchQuery);
  const createAsset = useCreateAsset();

  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result);
    setFormData({
      symbol: result.symbol,
      name: result.name,
      assetClass: result.assetClass,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = manualMode || selectedResult
      ? {
          symbol: formData.symbol,
          name: formData.name,
          assetClass: formData.assetClass,
          provider: (selectedResult?.provider || 'manual') as Provider,
        }
      : null;

    if (!data) return;

    try {
      await createAsset.mutateAsync(data);
      handleClose();
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedResult(null);
    setManualMode(false);
    setFormData({ symbol: '', name: '', assetClass: 'stocks' });
    setTab('market');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Asset" size="lg">
      {/* Tab toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => { setTab('market'); setManualMode(false); setSelectedResult(null); setSearchQuery(''); }}
          className={clsx(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
            tab === 'market'
              ? 'border-brand-500 bg-brand-600/20 text-brand-400'
              : 'border-surface-700 text-surface-400 hover:text-surface-200'
          )}
        >
          Market Asset
        </button>
        <button
          type="button"
          onClick={() => { setTab('metal'); setManualMode(false); setSelectedResult(null); setSearchQuery(''); }}
          className={clsx(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
            tab === 'metal'
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
              : 'border-surface-700 text-surface-400 hover:text-surface-200'
          )}
        >
          Physical Metal
        </button>
        <button
          type="button"
          onClick={() => { setTab('account'); setManualMode(false); setSelectedResult(null); setSearchQuery(''); }}
          className={clsx(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
            tab === 'account'
              ? 'border-brand-500 bg-brand-600/20 text-brand-400'
              : 'border-surface-700 text-surface-400 hover:text-surface-200'
          )}
        >
          Gov / Cash Account
        </button>
      </div>

      {tab === 'metal' ? (
        <PhysicalMetalForm onSuccess={handleClose} onCancel={handleClose} />
      ) : tab === 'account' ? (
        <ManualAssetForm onSuccess={handleClose} onCancel={handleClose} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Search */}
          {!manualMode && !selectedResult && (
            <div>
              <label className="label">Search for Asset</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by symbol or name (e.g., AAPL, Bitcoin)"
                  className="input pl-10"
                />
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                  {searching ? (
                    <p className="text-sm text-surface-500 py-4 text-center">
                      Searching...
                    </p>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <button
                        key={`${result.symbol}-${index}`}
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="w-full p-3 rounded-xl bg-surface-800/50 hover:bg-surface-700/50 text-left transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-surface-100">
                            {result.symbol}
                          </p>
                          <p className="text-sm text-surface-400">{result.name}</p>
                        </div>
                        <AssetClassBadge assetClass={result.assetClass} size="sm" />
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-surface-500 py-4 text-center">
                      No results found
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="mt-4 text-sm text-brand-400 hover:text-brand-300"
              >
                Or add manually →
              </button>
            </div>
          )}

          {/* Selected/Manual Form */}
          {(selectedResult || manualMode) && (
            <>
              <div>
                <label className="label">Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))
                  }
                  className="input"
                  required
                  disabled={!!selectedResult}
                />
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Asset Class</label>
                <select
                  value={formData.assetClass}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      assetClass: e.target.value as AssetClass,
                    }))
                  }
                  className="input"
                >
                  {ASSET_CLASSES.map((ac) => (
                    <option key={ac.value} value={ac.value}>
                      {ac.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedResult && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedResult(null);
                    setSearchQuery('');
                  }}
                  className="text-sm text-surface-400 hover:text-surface-200"
                >
                  ← Search for different asset
                </button>
              )}
            </>
          )}

          {/* Submit */}
          {(selectedResult || manualMode) && (
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createAsset.isPending}
                className="btn btn-primary"
              >
                {createAsset.isPending ? 'Adding...' : 'Add Asset'}
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function BulkTagModal({
  isOpen,
  onClose,
  assetIds,
  tags,
  allAssets,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  assetIds: Set<string>;
  tags: Tag[];
  allAssets: { id: string; tags?: Tag[] }[] | undefined;
  onDone: () => void;
}) {
  const bulkTag = useBulkTagAssets();
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const assetIdSet = assetIds;
    allAssets?.forEach((a) => {
      if (assetIdSet.has(a.id) && a.tags) {
        a.tags.forEach((t) => counts.set(t.id, (counts.get(t.id) ?? 0) + 1));
      }
    });
    return counts;
  }, [assetIds, allAssets]);

  const total = assetIds.size;

  const getTagState = (tagId: string): 'all' | 'some' | 'none' => {
    if (pendingAdd.has(tagId)) return 'all';
    if (pendingRemove.has(tagId)) return 'none';
    const count = tagCounts.get(tagId) ?? 0;
    if (count === 0) return 'none';
    if (count === total) return 'all';
    return 'some';
  };

  const cycleTag = (tagId: string) => {
    const state = getTagState(tagId);
    const nextAdd = new Set(pendingAdd);
    const nextRemove = new Set(pendingRemove);

    if (state === 'none') {
      nextAdd.add(tagId);
      nextRemove.delete(tagId);
    } else if (state === 'all') {
      nextAdd.delete(tagId);
      nextRemove.add(tagId);
    } else {
      nextAdd.add(tagId);
      nextRemove.delete(tagId);
    }
    setPendingAdd(nextAdd);
    setPendingRemove(nextRemove);
  };

  const hasChanges = pendingAdd.size > 0 || pendingRemove.size > 0;

  const handleApply = async () => {
    const ids = [...assetIds];
    if (pendingAdd.size > 0) {
      await bulkTag.mutateAsync({ assetIds: ids, tagIds: [...pendingAdd], action: 'add' });
    }
    if (pendingRemove.size > 0) {
      await bulkTag.mutateAsync({ assetIds: ids, tagIds: [...pendingRemove], action: 'remove' });
    }
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    onDone();
    onClose();
  };

  const handleClose = () => {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Tag ${total} Asset${total > 1 ? 's' : ''}`} size="sm">
      <div className="space-y-4">
        {tags.length > 0 ? (
          <div className="space-y-2">
            {tags.map((tag) => {
              const state = getTagState(tag.id);
              const count = tagCounts.get(tag.id) ?? 0;
              const isPending = pendingAdd.has(tag.id) || pendingRemove.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => cycleTag(tag.id)}
                  className={clsx(
                    'w-full p-3 rounded-xl text-left transition-all flex items-center justify-between',
                    state === 'all'
                      ? 'bg-surface-700/50 border border-surface-600'
                      : state === 'some'
                        ? 'bg-surface-700/30 border border-surface-700'
                        : 'bg-surface-800/30 hover:bg-surface-800/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                    <div>
                      <p className={clsx('font-medium', isPending ? 'text-brand-300' : 'text-surface-100')}>{tag.name}</p>
                      {tag.description && <p className="text-xs text-surface-500">{tag.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state === 'some' && !isPending && (
                      <span className="text-xs text-surface-500">{count}/{total}</span>
                    )}
                    {state === 'all' && <span className="text-brand-400 text-sm">✓</span>}
                    {state === 'some' && !isPending && <span className="text-amber-400 text-sm">—</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-surface-500 text-center py-8">
            No tags created yet. Go to Tags page to create some.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button onClick={handleClose} className="btn btn-secondary">Cancel</button>
          <button
            onClick={handleApply}
            disabled={!hasChanges || bulkTag.isPending}
            className="btn btn-primary"
          >
            {bulkTag.isPending ? 'Applying...' : hasChanges ? 'Apply Changes' : 'No Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TagAssetModal({
  isOpen,
  onClose,
  assetId,
  tags,
}: {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  tags: Tag[];
}) {
  const { data: assetWithTags } = useAsset(assetId);
  const setTags = useSetAssetTags();

  const currentTagIds = assetWithTags?.tags?.map((t) => t.id) || [];

  const toggleTag = (tagId: string) => {
    const newTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId];

    setTags.mutate({ assetId, tagIds: newTagIds });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Tags">
      <div className="space-y-4">
        {tags.length > 0 ? (
          <div className="space-y-2">
            {tags.map((tag) => {
              const isSelected = currentTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={clsx(
                    'w-full p-3 rounded-xl text-left transition-all flex items-center justify-between',
                    isSelected
                      ? 'bg-surface-700/50 border border-surface-600'
                      : 'bg-surface-800/30 hover:bg-surface-800/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <p className="font-medium text-surface-100">{tag.name}</p>
                      {tag.description && (
                        <p className="text-xs text-surface-500">
                          {tag.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-brand-400 text-sm">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-surface-500 text-center py-8">
            No tags created yet. Go to Tags page to create some.
          </p>
        )}

        <div className="pt-4 border-t border-surface-700">
          <button onClick={onClose} className="btn btn-secondary w-full">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StockSplitModal({
  isOpen,
  onClose,
  assetId,
  symbol,
  name,
  transactions,
}: {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  symbol: string;
  name: string;
  transactions: TransactionWithAsset[];
}) {
  const [ratio, setRatio] = useState<number>(2);
  const applySplit = useApplyStockSplit();

  const previewTx = transactions.slice(0, 5);

  const handleApply = () => {
    if (ratio <= 0 || ratio === 1) return;
    if (!confirm(`Apply 1:${ratio} split to ${symbol}? This will adjust all ${transactions.length} transactions.`)) return;
    applySplit.mutate(
      { assetId, ratio },
      {
        onSuccess: () => onClose(),
        onError: (err) => alert(`Split failed: ${err.message}`),
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stock Split — ${symbol}`}>
      <div className="space-y-5">
        <p className="text-sm text-surface-400">{name}</p>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">
            Split Ratio
          </label>
          <div className="flex items-center gap-3">
            <span className="text-surface-300 text-sm whitespace-nowrap">1 share becomes</span>
            <input
              type="number"
              min={2}
              step={1}
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))}
              className="input w-24 text-center tabular-nums"
            />
            <span className="text-surface-300 text-sm">shares</span>
          </div>
        </div>

        {previewTx.length > 0 && ratio > 0 && ratio !== 1 && (
          <div>
            <p className="text-sm font-medium text-surface-300 mb-2">Preview</p>
            <div className="bg-surface-800/40 rounded-xl border border-surface-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-surface-500 text-xs">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Before</th>
                    <th className="p-2 text-center">→</th>
                    <th className="p-2 text-right">After</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTx.map((tx) => (
                    <tr key={tx.id} className="border-t border-surface-700/50">
                      <td className="p-2 text-surface-400">{formatDate(tx.transactionDate)}</td>
                      <td className="p-2">
                        <span className={tx.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-right tabular-nums text-surface-300">
                        {formatNumber(tx.quantity)} @ {formatCurrency(tx.price, tx.asset.currency || 'INR')}
                      </td>
                      <td className="p-2 text-center text-surface-500">→</td>
                      <td className="p-2 text-right tabular-nums text-surface-100">
                        {formatNumber(tx.quantity * ratio)} @ {formatCurrency(tx.price / ratio, tx.asset.currency || 'INR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 5 && (
                <p className="text-xs text-surface-500 p-2 text-center border-t border-surface-700/50">
                  … and {transactions.length - 5} more transactions
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applySplit.isPending || ratio <= 0 || ratio === 1}
            className="btn btn-primary flex-1"
          >
            {applySplit.isPending ? 'Applying…' : `Apply 1:${ratio} Split`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
