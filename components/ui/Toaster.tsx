'use client';
import { dismiss, useToasts } from '@/lib/toast';
import { CrossIcon } from '@/components/scene/Icons';

export function Toaster() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`k7-pop k7-outline k7-shadow-sm pointer-events-auto flex max-w-[440px] items-center gap-3 rounded-[12px] px-4 py-3 text-[14px] font-semibold ${
            t.tone === 'error' ? 'bg-white text-danger' : t.tone === 'success' ? 'bg-grass text-ink' : 'bg-ink text-white'
          }`}
        >
          <span>{t.message}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className="k7-label rounded-[6px] border-[3px] border-current px-2 py-0.5"
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">
            <CrossIcon size={12} color="currentColor" />
          </button>
        </div>
      ))}
    </div>
  );
}
