'use client';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CrossIcon } from '@/components/scene/Icons';
import { lockScroll } from '@/lib/scroll-lock';
import { Panel } from './Panel';

/** Centered panel on desktop, bottom sheet on phones. Closes on Escape / backdrop. */
export function Modal({
  open,
  onClose,
  children,
  label,
  testId,
  width = 'max-w-[560px]',
  tone = 'white',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  testId?: string;
  width?: string;
  tone?: 'white' | 'mist';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 md:items-center md:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        onMouseDown={(e) => e.stopPropagation()}
        className={`k7-pop w-full ${width} max-h-[92dvh] overflow-y-auto`}
      >
        <Panel tone={tone} className="relative rounded-b-none border-b-0 p-5 md:rounded-b-[16px] md:border-b-4 md:p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[8px] border-[3px] border-ink bg-white hover:bg-mist"
          >
            <CrossIcon size={12} />
          </button>
          {children}
        </Panel>
      </div>
    </div>,
    document.body,
  );
}
