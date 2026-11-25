import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-cream hover:bg-forest-deep shadow-sm',
  accent: 'bg-clay text-cream hover:bg-clay-deep shadow-sm',
  outline: 'border border-forest/30 bg-transparent text-forest hover:bg-forest-wash/75',
  ghost: 'text-ink-soft hover:bg-paper-deep',
  danger: 'bg-[#8d2f24] text-white hover:bg-[#712419]',
  subtle: 'bg-paper-deep text-ink hover:bg-line',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
