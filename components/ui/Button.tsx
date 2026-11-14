'use client';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ink' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-yellow text-ink hover:bg-[#ffd43b]',
  secondary: 'bg-white text-ink hover:bg-mist',
  ink: 'bg-ink text-yellow hover:bg-[#3b2676]',
  ghost: 'bg-transparent text-ink border-transparent shadow-none hover:bg-white/40',
  danger: 'bg-white text-danger hover:bg-[#ffeef2]',
};
const SIZE: Record<Size, string> = {
  sm: 'h-10 px-4 text-[20px]',
  md: 'h-12 px-5 text-[24px]',
  lg: 'h-14 px-7 text-[28px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return [
    'font-display inline-flex items-center justify-center gap-2 rounded-[10px] k7-outline select-none',
    'leading-none whitespace-nowrap transition-transform active:translate-y-[3px] active:shadow-none',
    variant === 'ghost' ? '' : 'k7-shadow-sm',
    'disabled:opacity-60 disabled:pointer-events-none',
    VARIANT[variant],
    SIZE[size],
    extra,
  ].join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  pending = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; pending?: boolean; children: ReactNode }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || pending} aria-busy={pending || undefined} className={buttonClass(variant, size, className)}>
      {pending ? <span className="inline-block h-3 w-3 animate-pulse rounded-sm bg-current" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <Link href={href} {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
