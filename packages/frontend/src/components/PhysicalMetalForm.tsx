import { useState } from 'react';
import type { AssetClass } from '../api/types';
import { useCreateAsset, useCreateTransaction } from '../api/hooks';

const METAL_TYPES: { value: AssetClass; label: string; symbol: string }[] = [
  { value: 'gold', label: 'Gold', symbol: 'GOLD' },
  { value: 'silver', label: 'Silver', symbol: 'SILVER' },
];

interface PhysicalMetalFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PhysicalMetalForm({ onSuccess, onCancel }: PhysicalMetalFormProps) {
  const [metalType, setMetalType] = useState<(typeof METAL_TYPES)[number]>(METAL_TYPES[0]);
  const [name, setName] = useState('');
  const [weightGrams, setWeightGrams] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const createAsset = useCreateAsset();
  const createTransaction = useCreateTransaction();
  const isSubmitting = createAsset.isPending || createTransaction.isPending;

  const grams = parseFloat(weightGrams) || 0;
  const ppg = parseFloat(pricePerGram) || 0;
  const totalCost = grams * ppg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grams <= 0 || ppg <= 0) return;

    const label = name.trim() || `Physical ${metalType.label}`;
    const symbol = `${metalType.symbol}-${label.replace(/\s+/g, '-').toUpperCase()}`;

    try {
      const { asset } = await createAsset.mutateAsync({
        symbol,
        name: label,
        assetClass: metalType.value,
        provider: 'metals_api',
        currentPrice: ppg,
        currency: 'INR',
      });

      await createTransaction.mutateAsync({
        assetId: asset.id,
        type: 'buy',
        quantity: grams,
        price: ppg,
        transactionDate: purchaseDate,
        notes: notes.trim() || 'Initial purchase',
      });

      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Metal</label>
        <div className="flex gap-2">
          {METAL_TYPES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMetalType(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                metalType.value === m.value
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                  : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. ${metalType.label} Coins, Jewellery, Bar`}
          className="input"
        />
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
          />
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
          <span className="text-surface-500">Total cost:</span>{' '}
          <span className="text-surface-200 font-medium tabular-nums">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalCost)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Purchase Date</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
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
            placeholder="e.g. 24K, Tanishq"
            className="input"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
          {isSubmitting ? 'Adding...' : `Add ${metalType.label}`}
        </button>
      </div>
    </form>
  );
}
