import { useState, useMemo } from 'react';
import Modal from './Modal';
import { useCreateTransaction, useAssets } from '../api/hooks';
import { clsx } from 'clsx';
import { formatCurrency, todayLocal } from '../lib/format';
import type { Position } from '../api/types';

interface DepositWithdrawFormProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

const INTEREST_CLASSES = new Set(['ppf', 'epf', 'nps', 'fixed_deposit']);

export default function DepositWithdrawForm({ isOpen, onClose, position }: DepositWithdrawFormProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [isInterest, setIsInterest] = useState(false);
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [fundSourceId, setFundSourceId] = useState('');

  const createTransaction = useCreateTransaction();
  const { data: allAssets } = useAssets();
  const cashAssets = allAssets?.filter((a) => a.assetClass === 'cash' && a.id !== position.assetId) ?? [];

  const showInterest = INTEREST_CLASSES.has(position.assetClass);
  const isForeignCurrency = position.currency !== 'INR';
  const currencySymbol = position.currency === 'USD' ? '$' : position.currency;

  const computedForeignAmount = useMemo(() => {
    if (!isForeignCurrency) return null;
    const inr = parseFloat(amount);
    const rate = parseFloat(exchangeRate);
    if (isNaN(inr) || isNaN(rate) || rate <= 0) return null;
    return inr / rate;
  }, [amount, exchangeRate, isForeignCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    let quantity: number;
    let price: number;

    if (isForeignCurrency) {
      const rate = parseFloat(exchangeRate);
      if (isNaN(rate) || rate <= 0) return;
      quantity = val / rate;
      price = rate;
    } else {
      quantity = val;
      price = 1;
    }

    try {
      await createTransaction.mutateAsync({
        assetId: position.assetId,
        type: isInterest ? 'buy' : type,
        quantity,
        price,
        fundSourceId: isInterest ? undefined : (fundSourceId || undefined),
        transactionDate: date,
        notes: (isInterest ? (notes.trim() || 'Interest credit') : notes.trim()) || undefined,
      });
      setAmount('');
      setExchangeRate('');
      setNotes('');
      setFundSourceId('');
      setType('buy');
      setIsInterest(false);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const isDeposit = type === 'buy' && !isInterest;
  const modeLabel = isInterest ? 'Interest' : isDeposit ? 'Deposit' : 'Withdraw';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${modeLabel} — ${position.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setType('buy'); setIsInterest(false); }}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
              isDeposit
                ? 'border-green-500/50 bg-green-500/20 text-green-400'
                : 'border-surface-700 text-surface-400 hover:text-surface-200'
            )}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => { setType('sell'); setIsInterest(false); }}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
              type === 'sell'
                ? 'border-red-500/50 bg-red-500/20 text-red-400'
                : 'border-surface-700 text-surface-400 hover:text-surface-200'
            )}
          >
            Withdraw
          </button>
          {showInterest && (
            <button
              type="button"
              onClick={() => { setType('buy'); setIsInterest(true); setFundSourceId(''); }}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
                isInterest
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                  : 'border-surface-700 text-surface-400 hover:text-surface-200'
              )}
            >
              Interest
            </button>
          )}
        </div>

        <div>
          <label className="label">Amount (INR)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input"
            min="0.01"
            step="0.01"
            required
            autoFocus
          />
        </div>

        {isForeignCurrency && (
          <>
            <div>
              <label className="label">Exchange Rate (₹ per {currencySymbol}1)</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="e.g. 85.50"
                className="input"
                min="0.0001"
                step="0.0001"
                required
              />
            </div>
            {computedForeignAmount !== null && (
              <div className="rounded-lg bg-surface-800/50 border border-surface-700 px-4 py-3 text-sm">
                <span className="text-surface-400">
                  {isDeposit ? 'You will receive' : 'You are withdrawing'}{' '}
                </span>
                <span className="text-brand-400 font-semibold tabular-nums">
                  {formatCurrency(computedForeignAmount, position.currency)}
                </span>
                <span className="text-surface-500 ml-1">
                  ({formatCurrency(parseFloat(amount), 'INR')} at {currencySymbol}1 = ₹{parseFloat(exchangeRate).toFixed(2)})
                </span>
              </div>
            )}
          </>
        )}

        {cashAssets.length > 0 && !isInterest && (
          <div>
            <label className="label">{isDeposit ? 'From Account' : 'To Account'}</label>
            <select
              value={fundSourceId}
              onChange={(e) => setFundSourceId(e.target.value)}
              className="input"
            >
              <option value="">— None —</option>
              {cashAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isInterest ? 'e.g. FY 2025-26 interest' : isDeposit ? 'e.g. Monthly contribution' : 'e.g. Partial withdrawal'}
            className="input"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={createTransaction.isPending} className="btn btn-primary">
            {createTransaction.isPending ? 'Saving...' : isInterest ? 'Add Interest' : isDeposit ? 'Add Deposit' : 'Record Withdrawal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
