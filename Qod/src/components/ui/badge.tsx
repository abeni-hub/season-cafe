import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type Tone = 'green' | 'clay' | 'neutral' | 'blue' | 'amber' | 'red' | 'outline';

const tones: Record<Tone, string> = {
  green: 'bg-forest-wash text-forest-deep border-forest/15',
  clay: 'bg-clay-wash text-clay-deep border-clay/20',
  neutral: 'bg-paper-deep text-ink-soft border-line',
  blue: 'bg-[#e8eef1] text-[#33525e] border-[#c9d8de]',
  amber: 'bg-[#f7edd7] text-[#7a5a17] border-[#ead7ad]',
  red: 'bg-[#f6e3dd] text-[#8d2f24] border-[#e7c3b8]',
  outline: 'bg-transparent text-muted border-line',
};

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
