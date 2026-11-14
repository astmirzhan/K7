import type { HTMLAttributes, ReactNode } from 'react';

/** White card with 4px ink outline and hard shadow (the "Panel" component of the design). */
export function Panel({
  children,
  className = '',
  tone = 'white',
  shadow = 'lg',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; tone?: 'white' | 'mist' | 'yellow' | 'ink' | 'pink' | 'dashed'; shadow?: 'none' | 'sm' | 'md' | 'lg' }) {
  const bg = {
    white: 'bg-white',
    mist: 'bg-mist',
    yellow: 'bg-yellow',
    ink: 'bg-ink text-white',
    pink: 'bg-pink',
    dashed: 'bg-mist border-dashed',
  }[tone];
  const sh = { none: '', sm: 'k7-shadow-sm', md: 'k7-shadow', lg: 'k7-shadow-lg' }[shadow];
  return (
    <div {...rest} className={`k7-outline rounded-[16px] ${bg} ${sh} ${className}`}>
      {children}
    </div>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-[3px] w-full bg-lilac ${className}`} />;
}
