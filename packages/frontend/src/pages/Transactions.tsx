import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Search,
  Activity,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  useAssets,
  useTransactionsWithAssets,
  usePositions,
  useCreateTransaction,
  useDeleteTransaction,
  useRealizedGainsTotal,
  useExchangeRate,
} from '../api/hooks';
import { formatCurrency, formatNumber, formatDate, todayLocal } from '../lib/format';
import CurrencyValue, { toInr } from '../components/CurrencyValue';
import type { TransactionWithAsset, TransactionType, Asset, Position } from '../api/types';

export default function Transactions() {
  const { data: transactions, isLoading: txLoading } = useTransactionsWithAssets();
  const { data: positions, isLoading: posLoading } = usePositions();
  const { data: assets } = useAssets();
  const { data: realizedGains } = useRealizedGainsTotal();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isLoading = txLoading || posLoading;

  const filteredTransactions = transactions?.filter(
    (t) =>
      searchQuery === '' ||
      t.asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    const filtered = filteredTransactions ?? [];

    const totalBuyValue = filtered
      .filter((t) => t.type === 'buy')
      .reduce((sum, t) => sum + toInr(t.quantity * t.price + (t.fees ?? 0), t.asset.currency || 'INR', usdToInr), 0);

    const totalSellValue = filtered
      .filter((t) => t.type === 'sell')
      .reduce((sum, t) => sum + toInr(t.quantity * t.price - (t.fees ?? 0), t.asset.currency || 'INR', usdToInr), 0);

    const matchingPositions = (positions ?? []).filter(
      (p) =>
        searchQuery === '' ||
        p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const unrealizedGain = matchingPositions.reduce((sum, p) => sum + toInr(p.unrealizedGain, p.currency, usdToInr), 0);
    const totalCost = matchingPositions.reduce((sum, p) => sum + toInr(p.totalCost, p.currency, usdToInr), 0);
    const unrealizedPct = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;

    const filteredRealizedGain =
      searchQuery === ''
        ? (realizedGains ?? 0)
        : matchingPositions.reduce((sum, p) => sum + toInr(p.realizedGain, p.currency, usdToInr), 0);

    const realizedCostBasis = Math.abs(totalSellValue - filteredRealizedGain);
    const realizedPct = realizedCostBasis > 0 ? (filteredRealizedGain / realizedCostBasis) * 100 : 0;

    return {
      count: filtered.length,
      totalBuyValue,
      realizedGain: filteredRealizedGain,
      realizedPct,
      unrealizedGain,
      unrealizedPct,
    };
  }, [filteredTransactions, positions, searchQuery, realizedGains, usdToInr]);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Transactions</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary"
          disabled={!assets || assets.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
      {/* Summary Stats */}
      {usdToInr && (
        <p className="text-xs text-surface-500 text-right tabular-nums -mb-4">
          1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Transactions"
          value={String(stats.count)}
          icon={Activity}
          variant="accent"
        />
        <StatCard
          label="Total Invested"
          value={formatCurrency(stats.totalBuyValue, 'INR')}
          usdSubValue={usdToInr ? formatCurrency(stats.totalBuyValue / usdToInr, 'USD') : undefined}
          icon={Wallet}
          variant="brand"
        />
        <StatCard
          label="Realized P&L"
          value={`${stats.realizedGain >= 0 ? '+' : ''}${formatCurrency(stats.realizedGain, 'INR')}`}
          usdSubValue={usdToInr ? `${stats.realizedGain >= 0 ? '+' : ''}${formatCurrency(stats.realizedGain / usdToInr, 'USD')}` : undefined}
          subValue={stats.realizedPct !== 0 ? `${stats.realizedPct >= 0 ? '+' : ''}${stats.realizedPct.toFixed(2)}%` : undefined}
          icon={stats.realizedGain >= 0 ? TrendingUp : TrendingDown}
          isPositive={stats.realizedGain >= 0}
        />
        <StatCard
          label="Unrealized P&L"
          value={`${stats.unrealizedGain >= 0 ? '+' : ''}${formatCurrency(stats.unrealizedGain, 'INR')}`}
          usdSubValue={usdToInr ? `${stats.unrealizedGain >= 0 ? '+' : ''}${formatCurrency(stats.unrealizedGain / usdToInr, 'USD')}` : undefined}
          subValue={stats.unrealizedPct !== 0 ? `${stats.unrealizedPct >= 0 ? '+' : ''}${stats.unrealizedPct.toFixed(2)}%` : undefined}
          icon={stats.unrealizedGain >= 0 ? TrendingUp : TrendingDown}
          isPositive={stats.unrealizedGain >= 0}
        />
      </div>

      {/* Search */}
      <Card padding="sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by symbol or name..."
            className="input pl-10"
          />
        </div>
      </Card>

      {/* Transaction History */}
      {filteredTransactions && filteredTransactions.length > 0 ? (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Date</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Asset</th>
                  <th className="table-header text-right">Quantity</th>
                  <th className="table-header text-right">Price</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filteredTransactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} usdToInr={usdToInr} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={History}
            title="No transactions"
            description={
              transactions?.length === 0
                ? 'Add your first transaction to start tracking.'
                : 'No transactions match your search.'
            }
          />
        </Card>
      )}
      </div>

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        assets={assets ?? []}
        positions={positions ?? []}
      />
    </div>
  );
}

function TransactionRow({ tx, usdToInr }: { tx: TransactionWithAsset; usdToInr: number | null }) {
  const deleteTransaction = useDeleteTransaction();
  const cur = tx.asset.currency || 'INR';

  const handleDelete = () => {
    if (confirm(`Delete this ${tx.asset.symbol} transaction?`)) {
      deleteTransaction.mutate(tx.id);
    }
  };

  return (
    <tr className="hover:bg-surface-800/30">
      <td className="table-cell text-surface-400">
        {formatDate(tx.transactionDate)}
      </td>
      <td className="table-cell">
        <span
          className={clsx(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            tx.type === 'buy'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          )}
        >
          {tx.type === 'buy' ? (
            <ArrowDownRight className="w-3 h-3" />
          ) : (
            <ArrowUpRight className="w-3 h-3" />
          )}
          {tx.type.toUpperCase()}
        </span>
      </td>
      <td className="table-cell">
        <div>
          <p className="font-medium text-surface-100">{tx.asset.symbol}</p>
          <p className="text-xs text-surface-500">{tx.asset.name}</p>
        </div>
      </td>
      <td className="table-cell text-right tabular-nums">
        {formatNumber(tx.quantity)}
      </td>
      <td className="table-cell text-right tabular-nums">
        <CurrencyValue value={tx.price} currency={cur} usdToInr={usdToInr} />
      </td>
      <td className="table-cell text-right tabular-nums font-medium">
        <CurrencyValue value={tx.quantity * tx.price + (tx.fees ?? 0)} currency={cur} usdToInr={usdToInr} />
      </td>
      <td className="table-cell text-center">
        <button
          onClick={handleDelete}
          disabled={deleteTransaction.isPending}
          className="p-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function TransactionModal({
  isOpen,
  onClose,
  assets,
  positions,
}: {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  positions: Position[];
}) {
  const createTransaction = useCreateTransaction();

  const [formData, setFormData] = useState({
    assetId: '',
    type: 'buy' as TransactionType,
    quantity: '',
    price: '',
    fees: '',
    transactionDate: todayLocal(),
    notes: '',
  });

  const selectedAsset = assets.find((a) => a.id === formData.assetId);
  const selectedCurrency = selectedAsset?.currency ?? 'INR';
  const selectedPosition = positions.find((p) => p.assetId === formData.assetId);
  const maxSellQuantity = selectedPosition?.quantity ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createTransaction.mutateAsync({
        assetId: formData.assetId,
        type: formData.type,
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        fees: formData.fees ? parseFloat(formData.fees) : undefined,
        transactionDate: formData.transactionDate,
        notes: formData.notes || undefined,
      });
      onClose();
      setFormData({
        assetId: '',
        type: 'buy',
        quantity: '',
        price: '',
        fees: '',
        transactionDate: todayLocal(),
        notes: '',
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div>
          <label className="label">Transaction Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, type: 'buy' }))}
              className={clsx(
                'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                formData.type === 'buy'
                  ? 'bg-green-600 text-white'
                  : 'bg-surface-800/50 text-surface-400 hover:bg-surface-700/50'
              )}
            >
              <ArrowDownRight className="w-4 h-4" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, type: 'sell' }))}
              className={clsx(
                'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                formData.type === 'sell'
                  ? 'bg-red-600 text-white'
                  : 'bg-surface-800/50 text-surface-400 hover:bg-surface-700/50'
              )}
            >
              <ArrowUpRight className="w-4 h-4" />
              Sell
            </button>
          </div>
        </div>

        {/* Asset Selection */}
        <div>
          <label className="label">Asset</label>
          <select
            value={formData.assetId}
            onChange={(e) => setFormData((f) => ({ ...f, assetId: e.target.value }))}
            className="input"
            required
          >
            <option value="">Select an asset</option>
            {assets.map((asset) => {
              const position = positions.find((p) => p.assetId === asset.id);
              return (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} - {asset.name}
                  {position ? ` (Qty: ${formatNumber(position.quantity)})` : ''}
                </option>
              );
            })}
          </select>
          {formData.type === 'sell' && selectedPosition && (
            <p className="text-xs text-surface-500 mt-1">
              Available to sell: {formatNumber(maxSellQuantity)}
            </p>
          )}
        </div>

        {/* Quantity & Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              step="any"
              min="0"
              max={formData.type === 'sell' ? maxSellQuantity : undefined}
              value={formData.quantity}
              onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Price per Unit</label>
            <input
              type="number"
              step="any"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData((f) => ({ ...f, price: e.target.value }))}
              className="input"
              required
            />
          </div>
        </div>

        {/* Date & Fees */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Transaction Date</label>
            <input
              type="date"
              value={formData.transactionDate}
              onChange={(e) =>
                setFormData((f) => ({ ...f, transactionDate: e.target.value }))
              }
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Fees (optional)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={formData.fees}
              onChange={(e) => setFormData((f) => ({ ...f, fees: e.target.value }))}
              className="input"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
            className="input min-h-[60px]"
            placeholder="Any notes..."
          />
        </div>

        {/* Total Preview */}
        {formData.quantity && formData.price && (
          <div className="p-4 rounded-xl bg-surface-800/50">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Subtotal</span>
              <span className="text-surface-200">
                {formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.price), selectedCurrency)}
              </span>
            </div>
            {formData.fees && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-surface-400">Fees</span>
                <span className="text-surface-200">
                  {formatCurrency(parseFloat(formData.fees), selectedCurrency)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium mt-2 pt-2 border-t border-surface-700">
              <span className="text-surface-100">Total</span>
              <span className="text-surface-100">
                {formatCurrency(
                  parseFloat(formData.quantity) * parseFloat(formData.price) +
                    (formData.fees ? parseFloat(formData.fees) : 0),
                  selectedCurrency
                )}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTransaction.isPending}
            className={clsx(
              'btn',
              formData.type === 'buy' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500',
              'text-white'
            )}
          >
            {createTransaction.isPending
              ? 'Processing...'
              : `${formData.type === 'buy' ? 'Buy' : 'Sell'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
