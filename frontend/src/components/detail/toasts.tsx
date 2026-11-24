// Toasts confirm row and drawer actions (DESIGN.md §3.4). The shell normally mounts one
// <ToastProvider>; this guard adds one only when nothing above does, so the drawer works
// wherever it is opened from (At risk, Ready) without depending on how the shell is built.
import type { ReactNode } from 'react';
import { ToastProvider, useToast, type ToastInput } from '../../design';

/** useToast() that returns null outside a provider instead of throwing. The context read
 *  happens on every render, so hook order never changes. */
export function useOptionalToast(): ((t: ToastInput) => void) | null {
  try {
    // Called unconditionally on every render; only the throw is caught.
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    return useToast();
  } catch {
    return null;
  }
}

export function EnsureToasts({ children }: { children: ReactNode }) {
  const outer = useOptionalToast();
  return outer ? <>{children}</> : <ToastProvider>{children}</ToastProvider>;
}
