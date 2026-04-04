import { useState } from 'react';
import Modal from './Modal';
import { useCreateTransaction } from '../api/hooks';
import { clsx } from 'clsx';
import { formatCurrency } from '../lib/format';
import type { Position } from '../api/types';

interface MetalTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

export default function MetalTransactionForm({ isOpen, onClose, position }: MetalTransactionFormProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [weightGrams, setWeightGrams] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const createTransaction = useCreateTransaction();

  const grams = parseFloat(weightGrams) || 0;
  const ppg = parseFloat(pricePerGram) || 0;
  const totalValue = grams * ppg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grams <= 0 || ppg <= 0) return;
    if (type === 'sell' && grams > position.quantity) return;

    try {
      await createTransaction.mutateAsync({
        assetId: position.assetId,
        type,
        quantity: grams,
        price: ppg,
        transactionDate: date,
        notes: notes.trim() || undefined,
      });
      setWeightGrams('');
      setPricePerGram('');
      setNotes('');
      setType('buy');
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const isBuy = type === 'buy';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${isBuy ? 'Buy' : 'Sell'} — ${position.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current holding summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-surface-500">Holding</p>
            <p className="text-surface-200 font-medium">{position.quantity.toFixed(3)} g</p>
          </div>
          <div>
            <p className="text-surface-500">Avg Cost</p>
            <p className="text-surface-200 font-medium">{formatCurrency(position.averageCost, 'INR')}/g</p>
          </div>
        </div>

        {/* Buy / Sell toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('buy')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
              isBuy
                ? 'border-green-500/50 bg-green-500/20 text-green-400'
                : 'border-surface-700 text-surface-400 hover:text-surface-200'
            )}
          >
            Buy More
          </button>
          <button
            type="button"
            onClick={() => setType('sell')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
              !isBuy
                ? 'border-red-500/50 bg-red-500/20 text-red-400'
                : 'border-surface-700 text-surface-400 hover:text-surface-200'
            )}
          >
            Sell
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Weight (grams)</label>
            <input
              type="number"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              placeholder="0.00"
              className="input"
              min="0.001"
              step="0.001"
              required
              autoFocus
            />
            {type === 'sell' && grams > position.quantity && (
              <p className="text-xs text-red-400 mt-1">Exceeds holding ({position.quantity.toFixed(3)} g)</p>
            )}
          </div>
          <div>
            <label className="label">Price per gram (INR)</label>
            <input
              type="number"
              value={pricePerGram}
              onChange={(e) => setPricePerGram(e.target.value)}
              placeholder="0.00"
              className="input"
              min="0.01"
              step="0.01"
              required
            />
          </div>
        </div>

        {grams > 0 && ppg > 0 && (
          <div className="rounded-lg bg-surface-800/50 border border-surface-700 px-4 py-3 text-sm">
            <span className="text-surface-500">Total {isBuy ? 'cost' : 'proceeds'}:</span>{' '}
            <span className="text-surface-200 font-medium tabular-nums">
              {formatCurrency(totalValue, 'INR')}
            </span>
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
            placeholder={isBuy ? 'e.g. 24K bar from Tanishq' : 'e.g. Sold to jeweller'}
            className="input"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={createTransaction.isPending} className="btn btn-primary">
            {createTransaction.isPending ? 'Saving...' : isBuy ? 'Record Purchase' : 'Record Sale'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
