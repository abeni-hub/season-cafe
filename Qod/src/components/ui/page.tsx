import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({ eyebrow, title, description, actions, backTo, backLabel }: PageHeaderProps) {
  return (
    <div className="mb-7 border-b border-line/70 pb-5">
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-balance text-3xl text-forest-deep sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'forest' | 'clay' | 'neutral' | 'amber';
}

const toneClasses = {
  forest: 'bg-forest-wash text-forest',
  clay: 'bg-clay-wash text-clay',
  neutral: 'bg-paper-deep text-ink-soft',
  amber: 'bg-[#f7edd7] text-[#7a5a17]',
};

export function StatCard({ label, value, hint, icon, tone = 'forest' }: StatCardProps) {
  return (
    <div className="card p-5 transition-colors hover:border-beige">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
        {icon && <span className={cn('rounded-lg p-1.5', toneClasses[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 font-display text-2xl text-forest-deep tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg text-forest-deep">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-paper/45 px-6 py-12 text-center">
      {icon && <div className="rounded-full bg-paper-deep p-3 text-muted">{icon}</div>}
      <div>
        <p className="font-display text-lg text-ink">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
