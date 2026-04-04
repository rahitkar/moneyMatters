import { clsx } from 'clsx';
import type { AssetClass } from '../api/types';

const ASSET_CLASS_CONFIG: Record<
  AssetClass,
  { label: string; color: string; bg: string }
> = {
  stocks: { label: 'Stocks', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  etf: { label: 'ETF', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  mutual_fund: { label: 'Mutual Fund', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  mutual_fund_equity: { label: 'MF Equity', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  mutual_fund_debt: { label: 'MF Debt', color: 'text-teal-400', bg: 'bg-teal-500/20' },
  crypto: { label: 'Crypto', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  bonds: { label: 'Bonds', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  real_estate: { label: 'Real Estate', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  gold: { label: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  silver: { label: 'Silver', color: 'text-slate-300', bg: 'bg-slate-400/20' },
  metals: { label: 'Metals', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  ppf: { label: 'PPF', color: 'text-teal-300', bg: 'bg-teal-400/20' },
  epf: { label: 'EPF', color: 'text-teal-400', bg: 'bg-teal-500/20' },
  nps: { label: 'NPS', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  fixed_deposit: { label: 'Fixed Deposit', color: 'text-emerald-300', bg: 'bg-emerald-400/20' },
  lended: { label: 'Lended', color: 'text-orange-300', bg: 'bg-orange-400/20' },
  cash: { label: 'Cash', color: 'text-green-400', bg: 'bg-green-500/20' },
};

interface AssetClassBadgeProps {
  assetClass: AssetClass;
  size?: 'sm' | 'md';
}

export default function AssetClassBadge({ assetClass, size = 'md' }: AssetClassBadgeProps) {
  const config = ASSET_CLASS_CONFIG[assetClass];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.color,
        config.bg,
        {
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-2.5 py-1 text-xs': size === 'md',
        }
      )}
    >
      {config.label}
    </span>
  );
}

export function getAssetClassColor(assetClass: AssetClass): string {
  const colors: Record<AssetClass, string> = {
    stocks: '#3b82f6',
    etf: '#a855f7',
    mutual_fund: '#6366f1',
    mutual_fund_equity: '#6366f1',
    mutual_fund_debt: '#14b8a6',
    crypto: '#f97316',
    bonds: '#06b6d4',
    real_estate: '#10b981',
    gold: '#eab308',
    silver: '#94a3b8',
    metals: '#f59e0b',
    ppf: '#5eead4',
    epf: '#2dd4bf',
    nps: '#22d3ee',
    fixed_deposit: '#6ee7b7',
    lended: '#fdba74',
    cash: '#22c55e',
  };
  return colors[assetClass];
}
