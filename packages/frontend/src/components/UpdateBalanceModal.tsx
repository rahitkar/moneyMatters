import { useState } from 'react';
import Modal from './Modal';
import { useUpdateBalance } from '../api/hooks';
import { formatCurrency } from '../lib/format';
import type { Position } from '../api/types';

interface UpdateBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

export default function UpdateBalanceModal({ isOpen, onClose, position }: UpdateBalanceModalProps) {
  const [balance, setBalance] = useState('');
  const updateBalance = useUpdateBalance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(balance);
    if (isNaN(val) || val < 0) return;

    try {
      await updateBalance.mutateAsync({ assetId: position.assetId, balance: val });
      setBalance('');
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const invested = position.totalCost;
  const currentVal = position.currentValue;
  const ccy = position.currency || 'INR';
  const ccyLabel = ccy === 'INR' ? 'INR' : ccy;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update Balance — ${position.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-surface-500">Total Deposited</p>
            <p className="text-surface-200 font-medium">{formatCurrency(invested, ccy)}</p>
          </div>
          <div>
            <p className="text-surface-500">Current Value</p>
            <p className="text-surface-200 font-medium">{formatCurrency(currentVal, ccy)}</p>
          </div>
        </div>

        <div>
          <label className="label">Current Balance ({ccyLabel})</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="Enter current balance"
            className="input"
            min="0"
            step="0.01"
            required
            autoFocus
          />
          {balance && !isNaN(parseFloat(balance)) && (
            <p className="text-xs text-surface-500 mt-1">
              P&L will be{' '}
              <span className={parseFloat(balance) - invested >= 0 ? 'text-green-400' : 'text-red-400'}>
                {parseFloat(balance) - invested >= 0 ? '+' : ''}
                {formatCurrency(parseFloat(balance) - invested, ccy)}
              </span>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={updateBalance.isPending} className="btn btn-primary">
            {updateBalance.isPending ? 'Updating...' : 'Update Balance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
