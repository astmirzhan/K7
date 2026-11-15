/**
 * Page scroll lock shared by every overlay. Overlays can stack (stage sheet + badge screen) and close in any
 * order, so the lock is counted: the page scrolls again only when the last overlay is gone.
 */
let locks = 0;

export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  locks += 1;
  document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = '';
  };
}
