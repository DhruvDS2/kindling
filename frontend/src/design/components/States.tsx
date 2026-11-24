import type { ReactNode } from 'react';
import { Button } from './Button';
import './States.css';

export interface EmptyStateProps {
  /** One sentence saying what would be here, in the rep's words. */
  children: ReactNode;
  /** One action that helps (e.g. "Show all 85 schools"). */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Empty: one sentence plus one action. Left-aligned, no icon, no box. */
export function EmptyState({ children, action, className }: EmptyStateProps) {
  return (
    <div className={['k-state', className ?? ''].join(' ').trim()} role="status">
      <p className="k-state__text">{children}</p>
      {action && <Button variant="secondary" size="sm" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

export interface ErrorStateProps {
  /** What failed, in plain words: "Couldn't load health scores". */
  title: string;
  /** The underlying message, shown quietly (e.g. the HTTP error). */
  detail?: string;
  onRetry?: () => void;
  /** True while the retry is in flight. */
  retrying?: boolean;
  className?: string;
}

/** Error: what failed, plus retry. */
export function ErrorState({ title, detail, onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div className={['k-state', 'k-state--error', className ?? ''].join(' ').trim()} role="alert">
      <div>
        <p className="k-state__text">{title}</p>
        {detail && <p className="k-state__detail">{detail}</p>}
      </div>
      {onRetry && <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>Try again</Button>}
    </div>
  );
}
