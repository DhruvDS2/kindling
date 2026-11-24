import type { ReactNode } from 'react';
import { ToastProvider, useToast } from '../../design';

/**
 * Row-action confirmations need a toast region. The shell (lane A) is expected to mount one
 * <ToastProvider> for the whole app; until it does, this mounts one for the screen. It never
 * mounts a second region when an outer provider exists.
 */
export function EnsureToasts({ children }: { children: ReactNode }) {
  let outer = true;
  try {
    // Called on every render (hook order never changes); it only throws when no provider is mounted.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useToast();
  } catch {
    outer = false;
  }
  return outer ? <>{children}</> : <ToastProvider>{children}</ToastProvider>;
}
