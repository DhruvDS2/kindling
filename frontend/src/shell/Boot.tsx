// The entry chunk's only UI. Before /meta answers (and while the shell chunk downloads in parallel)
// there is no simulated year, demo date or thresholds, so nothing can be scored yet: show the
// shell's shape, not a "Loading…" line. If the API is down, say so plainly with a retry.
//
// This file is in the initial bundle, so it imports the two base components it needs from their
// own files rather than from the `design` barrel: the barrel re-exports every component, and a
// static import of it would pull motion (the Nav, PageView, Table, …) into the entry chunk.
// Motion lives in the lazy shell chunk instead (see main.tsx).
import { Component, type ReactNode } from 'react';
import { ErrorState } from '../design/components/States';
import { Skeleton } from '../design/components/Skeleton';

export function BootSkeleton() {
  return (
    <div className="kshell-boot" aria-busy="true">
      <span className="k-sr-only">Loading Kindling…</span>
      <div className="kshell-boot__side" aria-hidden="true">
        <Skeleton width="56%" height="control" />
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} width={i % 2 ? '60%' : '76%'} />)}
      </div>
      <div className="kshell-boot__main" aria-hidden="true">
        <div className="kshell-boot__top">
          <Skeleton width="var(--size-search)" height="display" />
          <Skeleton width="var(--size-search)" height="control" />
        </div>
        <Skeleton height="control" />
        <div className="kshell-boot__body">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width={i % 2 ? '72%' : '88%'} />)}
        </div>
      </div>
    </div>
  );
}

export function ApiDown({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div data-testid="api-down" className="kshell-down">
      <ErrorState
        title="Can't reach the Kindling API"
        detail={`${message}. Start it with: uvicorn kindling.api:app`}
        onRetry={onRetry}
        retrying={retrying}
      />
    </div>
  );
}

/** If the shell chunk itself fails to download, offer a reload instead of a blank page. */
export class BootBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="kshell-down">
        <ErrorState title="Couldn't load Kindling" detail={this.state.error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }
}
