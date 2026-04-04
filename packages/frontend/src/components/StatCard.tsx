import { clsx } from 'clsx';
import Card from './Card';

type Variant = 'brand' | 'positive' | 'negative' | 'neutral';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  usdSubValue?: string;
  icon: React.ElementType;
  variant?: Variant;
  /** Shorthand: auto-pick 'positive' or 'negative' based on sign */
  isPositive?: boolean;
  className?: string;
}

const bgMap: Record<Variant, string> = {
  brand: 'bg-brand-500/20',
  positive: 'bg-green-500/20',
  negative: 'bg-red-500/20',
  neutral: 'bg-surface-700/50',
};

const iconColorMap: Record<Variant, string> = {
  brand: 'text-brand-400',
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-surface-400',
};

const valueColorMap: Record<Variant, string> = {
  brand: 'text-surface-100',
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-surface-100',
};

const subValueColorMap: Record<Variant, string> = {
  brand: 'text-surface-500',
  positive: 'text-green-400/60',
  negative: 'text-red-400/60',
  neutral: 'text-surface-500',
};

export default function StatCard({
  label,
  value,
  subValue,
  usdSubValue,
  icon: Icon,
  variant,
  isPositive,
  className,
}: StatCardProps) {
  const v: Variant = variant ?? (isPositive === undefined ? 'neutral' : isPositive ? 'positive' : 'negative');

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="stat-label">{label}</p>
          <p className={clsx('stat-value', valueColorMap[v])}>
            {value}
          </p>
          {usdSubValue && (
            <p className={clsx('text-[10px] mt-0.5', subValueColorMap[v])}>
              {usdSubValue}
            </p>
          )}
          {subValue && <p className="text-sm text-surface-500 mt-1">{subValue}</p>}
        </div>
        <div className={clsx('p-3 rounded-xl shrink-0', bgMap[v])}>
          <Icon className={clsx('w-5 h-5', iconColorMap[v])} />
        </div>
      </div>
    </Card>
  );
}
