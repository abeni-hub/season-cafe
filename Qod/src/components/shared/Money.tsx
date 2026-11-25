import { useCurrency } from '@/hooks/useStore';
import { formatCents } from '@/utils/money';

export function Money({ cents, compact }: { cents: number; compact?: boolean }) {
  const currency = useCurrency();
  return <>{formatCents(cents, currency, { compact })}</>;
}
