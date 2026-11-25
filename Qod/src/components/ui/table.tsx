import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { SPRING_SNAPPY } from '@/lib/motion';

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line bg-cream shadow-[0_1px_0_rgba(38,37,31,0.03)]', className)}>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  const indicatorId = useId();

  return (
    <div className={cn('mb-5 flex flex-wrap gap-1 border-b border-line', className)} role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold transition-colors',
              active ? 'text-forest-deep' : 'text-muted hover:text-ink',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums',
                  active ? 'bg-clay-wash text-clay-deep' : 'bg-paper-deep text-muted',
                )}
              >
                {item.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={indicatorId}
                transition={SPRING_SNAPPY}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-clay"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
