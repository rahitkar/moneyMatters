import { useState } from 'react';
import { Plus, Trash2, Edit2, Layers, Search } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import AssetClassBadge from '../components/AssetClassBadge';
import {
  useAssets,
  usePortfolioHoldings,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
  useDeleteAsset,
  useExchangeRate,
} from '../api/hooks';
import { formatNumber, formatPercent, formatCurrency, todayLocal, formatRelativeTime } from '../lib/format';
import CurrencyValue from '../components/CurrencyValue';
import type { HoldingWithValue, Asset, AssetClass } from '../api/types';

const isIndianSymbol = (symbol: string) =>
  symbol.endsWith('.NS') || symbol.endsWith('.BO');

type PrimaryCategory = 'all' | 'india' | 'international' | 'metals' | 'crypto' | 'cash_equiv';

const GOV_SCHEME_CLASSES: AssetClass[] = ['ppf', 'epf', 'nps'];
const METAL_CLASSES: AssetClass[] = ['gold', 'gold_physical', 'silver', 'silver_physical', 'metals'];
const CASH_EQUIV_CLASSES: AssetClass[] = ['cash', 'fixed_deposit', 'lended'];
const MF_CLASSES: AssetClass[] = ['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt'];

const PRIMARY_CATEGORIES: { value: PrimaryCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'india', label: 'India' },
  { value: 'international', label: 'International' },
  { value: 'metals', label: 'Commodities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash_equiv', label: 'Cash & Equiv.' },
];

function getHoldingPrimaryCategory(assetClass: string, symbol: string): PrimaryCategory {
  if (METAL_CLASSES.includes(assetClass as AssetClass)) return 'metals';
  if (CASH_EQUIV_CLASSES.includes(assetClass as AssetClass)) return 'cash_equiv';
  if (GOV_SCHEME_CLASSES.includes(assetClass as AssetClass)) return 'india';
  if (MF_CLASSES.includes(assetClass as AssetClass)) return 'india';
  if (assetClass === 'crypto') return 'crypto';
  if (assetClass === 'external_portfolio') return 'india';
  return isIndianSymbol(symbol) ? 'india' : 'international';
}

function matchesSelectedPrimaries(h: HoldingWithValue, selected: Set<PrimaryCategory>): boolean {
  if (selected.size === 0) return true;
  return selected.has(getHoldingPrimaryCategory(h.assetClass, h.symbol));
}

export default function Holdings() {
  const { data: holdings, isLoading } = usePortfolioHoldings();
  const { data: assets } = useAssets();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingWithValue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrimaries, setSelectedPrimaries] = useState<Set<PrimaryCategory>>(new Set());

  const togglePrimary = (value: PrimaryCategory) => {
    setSelectedPrimaries((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const filteredHoldings = holdings?.filter((h) => {
    const matchesSearch =
      searchQuery === '' ||
      h.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && matchesSelectedPrimaries(h, selectedPrimaries);
  });

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Holdings</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary"
          disabled={!assets || assets.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Holding
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
      {usdToInr && (
        <p className="text-xs text-surface-500 text-right tabular-nums -mb-4">
          1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {usdInrRate?.fetchedAt && (
            <span className="ml-1.5 text-surface-600">· {formatRelativeTime(usdInrRate.fetchedAt)}</span>
          )}
        </p>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holdings..."
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedPrimaries(new Set())}
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
        </div>
      </Card>

      {/* Holdings Table */}
      {filteredHoldings && filteredHoldings.length > 0 ? (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Asset</th>
                  <th className="table-header text-right">Quantity</th>
                  <th className="table-header text-right">Avg. Cost</th>
                  <th className="table-header text-right">Current Price</th>
                  <th className="table-header text-right">Market Value</th>
                  <th className="table-header text-right">Gain/Loss</th>
                  <th className="table-header text-right">Return</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filteredHoldings.map((holding) => (
                  <HoldingRow
                    key={holding.id}
                    holding={holding}
                    usdToInr={usdToInr}
                    onEdit={() => setEditingHolding(holding)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Layers}
            title="No holdings found"
            description={
              holdings?.length === 0
                ? "You haven't added any holdings yet. Add an asset first, then create a holding."
                : 'No holdings match your search criteria.'
            }
            action={
              holdings?.length === 0 &&
              assets &&
              assets.length > 0 && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Holding
                </button>
              )
            }
          />
        </Card>
      )}
      </div>

      {/* Add/Edit Modal */}
      <HoldingModal
        isOpen={isAddModalOpen || !!editingHolding}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingHolding(null);
        }}
        holding={editingHolding}
        assets={assets || []}
      />
    </div>
  );
}

function HoldingRow({
  holding,
  usdToInr,
  onEdit,
}: {
  holding: HoldingWithValue;
  usdToInr: number | null;
  onEdit: () => void;
}) {
  const deleteAsset = useDeleteAsset();
  const cur = holding.currency || 'INR';

  const handleDelete = () => {
    if (confirm(`Delete ${holding.symbol} and all its transactions? This cannot be undone.`)) {
      deleteAsset.mutate(holding.assetId);
    }
  };

  const isPositive = holding.gain >= 0;

  return (
    <tr className="hover:bg-surface-800/30 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium text-surface-100">{holding.symbol}</p>
            <p className="text-xs text-surface-500 truncate max-w-[150px]">
              {holding.name}
            </p>
          </div>
          <AssetClassBadge assetClass={holding.assetClass} size="sm" />
        </div>
      </td>
      <td className="table-cell text-right tabular-nums">
        {formatNumber(holding.quantity)}
      </td>
      <td className="table-cell text-right tabular-nums">
        <CurrencyValue value={holding.purchasePrice} currency={cur} usdToInr={usdToInr} />
      </td>
      <td className="table-cell text-right tabular-nums">
        {holding.currentPrice
          ? <CurrencyValue value={holding.currentPrice} currency={cur} usdToInr={usdToInr} />
          : '—'}
      </td>
      <td className="table-cell text-right tabular-nums font-medium text-surface-100">
        <CurrencyValue value={holding.currentValue} currency={cur} usdToInr={usdToInr} />
      </td>
      <td
        className={clsx(
          'table-cell text-right tabular-nums font-medium',
          isPositive ? 'text-green-400' : 'text-red-400'
        )}
      >
        <CurrencyValue value={holding.gain} currency={cur} usdToInr={usdToInr} sign />
      </td>
      <td
        className={clsx(
          'table-cell text-right tabular-nums font-medium',
          isPositive ? 'text-green-400' : 'text-red-400'
        )}
      >
        {isPositive ? '+' : ''}
        {formatPercent(holding.gainPercent)}
      </td>
      <td className="table-cell text-center">
        <div className="flex items-center justify-center gap-1">
          <a
            href="/transactions"
            className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
            title="View transactions"
          >
            <Edit2 className="w-4 h-4" />
          </a>
          <button
            onClick={handleDelete}
            disabled={deleteAsset.isPending}
            className="p-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete asset and all transactions"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function HoldingModal({
  isOpen,
  onClose,
  holding,
  assets,
}: {
  isOpen: boolean;
  onClose: () => void;
  holding: HoldingWithValue | null;
  assets: Asset[];
}) {
  const isEditing = !!holding;
  const createHolding = useCreateHolding();
  const updateHolding = useUpdateHolding();

  const [formData, setFormData] = useState({
    assetId: holding?.assetId || '',
    quantity: holding?.quantity.toString() || '',
    purchasePrice: holding?.purchasePrice.toString() || '',
    purchaseDate: holding?.id
      ? todayLocal()
      : todayLocal(),
    notes: '',
  });

  // Reset form when holding changes
  useState(() => {
    if (holding) {
      setFormData({
        assetId: holding.assetId,
        quantity: holding.quantity.toString(),
        purchasePrice: holding.purchasePrice.toString(),
        purchaseDate: todayLocal(),
        notes: '',
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      quantity: parseFloat(formData.quantity),
      purchasePrice: parseFloat(formData.purchasePrice),
      purchaseDate: formData.purchaseDate,
      notes: formData.notes || undefined,
    };

    try {
      if (isEditing) {
        await updateHolding.mutateAsync({ id: holding.id, ...data });
      } else {
        await createHolding.mutateAsync({ assetId: formData.assetId, ...data });
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Holding' : 'Add Holding'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && (
          <div>
            <label className="label">Asset</label>
            <select
              value={formData.assetId}
              onChange={(e) =>
                setFormData((f) => ({ ...f, assetId: e.target.value }))
              }
              className="input"
              required
            >
              <option value="">Select an asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} - {asset.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              step="any"
              min="0"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((f) => ({ ...f, quantity: e.target.value }))
              }
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Purchase Price</label>
            <input
              type="number"
              step="any"
              min="0"
              value={formData.purchasePrice}
              onChange={(e) =>
                setFormData((f) => ({ ...f, purchasePrice: e.target.value }))
              }
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Purchase Date</label>
          <input
            type="date"
            value={formData.purchaseDate}
            onChange={(e) =>
              setFormData((f) => ({ ...f, purchaseDate: e.target.value }))
            }
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData((f) => ({ ...f, notes: e.target.value }))
            }
            className="input min-h-[80px]"
            placeholder="Any notes about this purchase..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createHolding.isPending || updateHolding.isPending}
            className="btn btn-primary"
          >
            {createHolding.isPending || updateHolding.isPending
              ? 'Saving...'
              : isEditing
              ? 'Update'
              : 'Add Holding'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
