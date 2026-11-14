'use client';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Pill with uppercase label. Active = ink background with yellow text (nav, filters, tabs). */
export function chipClass(active: boolean, size: 'sm' | 'md' = 'md', extra = ''): string {
  return [
    'k7-label inline-flex items-center justify-center gap-1.5 rounded-[8px] border-[3px] border-ink whitespace-nowrap',
    'transition-colors select-none',
    size === 'sm' ? 'h-7 px-2.5 text-[10px]' : 'h-9 px-3.5',
    active ? 'bg-ink text-yellow' : 'bg-white text-ink hover:bg-mist',
    extra,
  ].join(' ');
}

export function Chip({
  active = false,
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: 'sm' | 'md'; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} {...rest} className={chipClass(active, size, className) + ' disabled:opacity-50'}>
      {children}
    </button>
  );
}

export function ChipLink({
  href,
  active = false,
  size = 'md',
  className = '',
  children,
  ...rest
}: { href: string; active?: boolean; size?: 'sm' | 'md'; className?: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} {...rest} className={chipClass(active, size, className)}>
      {children}
    </Link>
  );
}

/** Static label pill (no interaction): e.g. "PHOTO REPORT", "CONNECTED". */
export function Tag({
  tone = 'ink',
  className = '',
  children,
}: {
  tone?: 'ink' | 'white' | 'grass' | 'yellow' | 'lilac';
  className?: string;
  children: ReactNode;
}) {
  const t = {
    ink: 'bg-ink text-yellow',
    white: 'bg-white text-ink',
    grass: 'bg-grass text-ink',
    yellow: 'bg-yellow text-ink',
    lilac: 'bg-lilac text-ink',
  }[tone];
  return (
    <span className={`k7-label inline-flex h-7 items-center gap-1.5 rounded-[8px] border-[3px] border-ink px-2.5 text-[10px] ${t} ${className}`}>
      {children}
    </span>
  );
}
