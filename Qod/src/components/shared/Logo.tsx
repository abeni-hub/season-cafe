import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface LogoProps {
  to?: string;
  invert?: boolean;
  compact?: boolean;
  className?: string;
}

export function Logo({ to = '/', invert = false, compact = false, className }: LogoProps) {
  return (
    <Link to={to} aria-label="Seasons Cake home" className={cn('group inline-flex flex-col leading-none', className)}>
      <span
        className={cn(
          'font-script text-[1.85rem] font-semibold leading-none tracking-tight',
          invert ? 'text-cream' : 'text-forest-deep',
          compact && 'text-[1.55rem]',
        )}
      >
        Seasons
        <span className="ml-1 align-baseline text-[0.62em] font-medium italic text-clay">cake</span>
      </span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className="h-px w-8 bg-clay/70" />
        <span
          className={cn(
            'text-[8px] font-semibold uppercase tracking-[0.42em]',
            invert ? 'text-cream/60' : 'text-ink-soft/60',
          )}
        >
          Delicious &amp; Fresh
        </span>
      </span>
    </Link>
  );
}
