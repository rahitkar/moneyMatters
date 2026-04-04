import { useState } from 'react';
import Modal from './Modal';
import { useCreateTransaction } from '../api/hooks';
import { clsx } from 'clsx';
import type { Position } from '../api/types';

interface DepositWithdrawFormProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

export default function DepositWithdrawForm({ isOpen, onClose, position }: DepositWithdrawFormProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const createTransaction = useCreateTransaction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    try {
      await createTransaction.mutateAsync({
        assetId: position.assetId,
        type,
        quantity: val,
        price: 1,
        transactionDate: date,
        notes: notes.trim() || undefined,
      });
      setAmount('');
      setNotes('');
      setType('buy');
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const isDeposit = type === 'buy';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${isDeposit ? 'Deposit' : 'Withdraw'} — ${position.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('buy')}
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
            onClick={() => setType('sell')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
              !isDeposit
                ? 'border-red-500/50 bg-red-500/20 text-red-400'
                : 'border-surface-700 text-surface-400 hover:text-surface-200'
            )}
          >
            Withdraw
          </button>
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
            placeholder={isDeposit ? 'e.g. Monthly contribution' : 'e.g. Partial withdrawal'}
            className="input"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={createTransaction.isPending} className="btn btn-primary">
            {createTransaction.isPending ? 'Saving...' : isDeposit ? 'Add Deposit' : 'Record Withdrawal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
