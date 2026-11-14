import type { ReactNode } from 'react';

/** Wooden sign on a post (11 Level complete). */
export function Sign({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="k7-outline k7-shadow-sm relative min-w-[200px] rounded-[8px] bg-wood px-6 py-3 text-center">
        <div className="absolute inset-x-2 top-1 h-[3px] bg-[#a06a36]" />
        <div className="absolute inset-x-2 bottom-1 h-[3px] bg-wood-dark" />
        {children}
      </div>
      <div className="h-16 w-4 border-x-4 border-ink bg-[#7a4a22]" />
    </div>
  );
}
