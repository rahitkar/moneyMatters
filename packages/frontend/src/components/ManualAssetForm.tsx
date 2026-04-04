import { useState } from 'react';
import { clsx } from 'clsx';
import type { AssetClass } from '../api/types';
import { useCreateAsset, useCreateTransaction } from '../api/hooks';

const CURRENCY_ELIGIBLE: Set<AssetClass> = new Set(['cash', 'fixed_deposit', 'bonds', 'lended']);

const MANUAL_ASSET_TYPES: { value: AssetClass; label: string }[] = [
  { value: 'ppf', label: 'PPF' },
  { value: 'epf', label: 'EPF' },
  { value: 'nps', label: 'NPS' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'bonds', label: 'Bond' },
  { value: 'cash', label: 'Savings Account' },
  { value: 'lended', label: 'Lended Money' },
  { value: 'real_estate', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
];

interface FieldConfig {
  institutionLabel: string;
  showInterestRate: boolean;
  showMaturityDate: boolean;
  maturityLabel?: string;
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
  ppf: { institutionLabel: 'Bank', showInterestRate: true, showMaturityDate: false },
  epf: { institutionLabel: 'Employer', showInterestRate: false, showMaturityDate: false },
  nps: { institutionLabel: 'Fund Manager', showInterestRate: false, showMaturityDate: false },
  fixed_deposit: { institutionLabel: 'Bank', showInterestRate: true, showMaturityDate: true, maturityLabel: 'Maturity Date' },
  bonds: { institutionLabel: 'Issuer', showInterestRate: true, showMaturityDate: true, maturityLabel: 'Maturity Date' },
  cash: { institutionLabel: 'Bank', showInterestRate: false, showMaturityDate: false },
  lended: { institutionLabel: 'Borrower', showInterestRate: true, showMaturityDate: true, maturityLabel: 'Expected Return Date' },
  real_estate: { institutionLabel: 'Location', showInterestRate: false, showMaturityDate: false },
  vehicle: { institutionLabel: 'Make / Model', showInterestRate: false, showMaturityDate: false },
};

interface ManualAssetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ManualAssetForm({ onSuccess, onCancel }: ManualAssetFormProps) {
  const [assetClass, setAssetClass] = useState<AssetClass>('ppf');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  const showCurrency = CURRENCY_ELIGIBLE.has(assetClass);

  const createAsset = useCreateAsset();
  const createTransaction = useCreateTransaction();

  const config = FIELD_CONFIG[assetClass] ?? FIELD_CONFIG.ppf;
  const isSubmitting = createAsset.isPending || createTransaction.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalance);
    if (!name.trim() || isNaN(balance) || balance <= 0) return;

    const symbol = `${assetClass.toUpperCase()}-${name.trim().replace(/\s+/g, '-').toUpperCase()}`;

    try {
      const { asset } = await createAsset.mutateAsync({
        symbol,
        name: name.trim(),
        assetClass,
        provider: 'manual',
        currentPrice: 1,
        currency: showCurrency ? currency : 'INR',
        institution: institution.trim() || null,
        interestRate: interestRate ? parseFloat(interestRate) : null,
        maturityDate: maturityDate || null,
      });

      await createTransaction.mutateAsync({
        assetId: asset.id,
        type: 'buy',
        quantity: balance,
        price: 1,
        transactionDate: depositDate,
        notes: 'Initial balance',
      });

      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Account Type</label>
        <div className="grid grid-cols-3 gap-2">
          {MANUAL_ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setAssetClass(t.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                assetClass === t.value
                  ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                  : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Account Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. ${
            assetClass === 'lended' ? 'John Doe'
            : assetClass === 'real_estate' ? '2BHK Whitefield'
            : assetClass === 'vehicle' ? 'Honda City 2024'
            : 'SBI PPF Account'
          }`}
          className="input"
          required
        />
      </div>

      <div>
        <label className="label">{config.institutionLabel}</label>
        <input
          type="text"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder={config.institutionLabel}
          className="input"
        />
      </div>

      {showCurrency && (
        <div>
          <label className="label">Currency</label>
          <div className="flex gap-2">
            {(['INR', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  currency === c
                    ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                    : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600'
                )}
              >
                {c === 'INR' ? '₹ INR' : '$ USD'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">
            {assetClass === 'real_estate' || assetClass === 'vehicle'
              ? 'Purchase Price (INR)'
              : `Initial Balance (${showCurrency ? currency : 'INR'})`}
          </label>
          <input
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0.00"
            className="input"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
            className="input"
            required
          />
        </div>
      </div>

      {config.showInterestRate && (
        <div>
          <label className="label">Interest Rate (% per annum)</label>
          <input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="e.g. 7.1"
            className="input"
            min="0"
            step="0.01"
          />
        </div>
      )}

      {config.showMaturityDate && (
        <div>
          <label className="label">{config.maturityLabel}</label>
          <input
            type="date"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
            className="input"
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
          {isSubmitting ? 'Creating...' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}
