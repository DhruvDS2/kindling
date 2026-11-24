import type { ReactNode } from 'react';
import './StatusPill.css';

export type StatusTone = 'ready' | 'risk' | 'healthy' | 'neutral';

/** Maps the API's status words (types.ts) to a tone. Unknown words are neutral. */
export function statusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case 'Ready': return 'ready';
    case 'At risk': return 'risk';
    case 'Healthy': return 'healthy';
    default: return 'neutral';
  }
}

/**
 * A status word on its subtle status color. The word is always printed: color is never the
 * only signal (DESIGN.md §1). Use for status only, never for emphasis.
 */
export function StatusPill({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return <span className={['k-pill', `k-pill--${tone}`, className ?? ''].join(' ').trim()}>{children}</span>;
}
