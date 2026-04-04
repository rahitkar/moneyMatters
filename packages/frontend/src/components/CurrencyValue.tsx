import { formatCurrency } from '../lib/format';

export function toInr(value: number, currency: string, usdToInr: number | null): number {
  if (currency === 'INR') return value;
  if (currency === 'USD' && usdToInr) return value * usdToInr;
  return value;
}

export default function CurrencyValue({
  value,
  currency,
  usdToInr,
  className,
  sign,
}: {
  value: number;
  currency: string;
  usdToInr: number | null;
  className?: string;
  sign?: boolean;
}) {
  const inrValue = toInr(value, currency, usdToInr);
  const prefix = sign ? (inrValue >= 0 ? '+' : '') : '';

  if (currency === 'INR') {
    return <span className={className}>{prefix}{formatCurrency(value, 'INR')}</span>;
  }

  return (
    <span className={className}>
      <span>{prefix}{formatCurrency(inrValue, 'INR')}</span>
      <span className="block text-[10px] text-surface-500 leading-tight">
        {prefix}{formatCurrency(value, currency)}
      </span>
    </span>
  );
}
