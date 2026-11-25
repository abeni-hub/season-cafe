import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line bg-cream', className)}>
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
  return (
    <div className={cn('mb-5 flex flex-wrap gap-1 border-b border-line', className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors',
              active
                ? 'border-clay text-forest-deep'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-clay-wash text-clay-deep' : 'bg-paper-deep text-muted')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
