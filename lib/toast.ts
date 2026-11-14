// Tiny toast store (no deps). <Toaster/> renders it; call toast('…') anywhere on the client.
import { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'success';
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(message: string, opts: { tone?: ToastItem['tone']; action?: ToastItem['action']; ms?: number } = {}): void {
  const id = ++seq;
  items = [...items, { id, message, tone: opts.tone ?? 'info', action: opts.action }];
  emit();
  setTimeout(() => dismiss(id), opts.ms ?? (opts.action ? 8000 : 3500));
}

export function dismiss(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => items,
    () => items,
  );
}
