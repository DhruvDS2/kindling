// What the content region shows while a screen's chunk loads (Suspense) or if it fails to load
// (error boundary). Skeletons are shaped like the screen they stand in for (DESIGN.md §7, 9A).
import { Component, type ReactNode } from 'react';
import { ErrorState, Skeleton } from '../design';
import type { Screen } from '../nav';

function Rows({ count }: { count: number }) {
  return (
    <div className="kshell-skel__table">
      <div className="kshell-skel__row kshell-skel__row--head">
        <Skeleton width="20%" height="label" />
        <Skeleton width="40%" height="label" />
        <Skeleton width="30%" height="label" />
        <Skeleton width="50%" height="label" />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div className="kshell-skel__row" key={i}>
          <span className="kshell-skel__cell">
            <Skeleton width={i % 3 === 0 ? '72%' : i % 3 === 1 ? '58%' : '66%'} />
            <Skeleton width="40%" height="label" />
          </span>
          <Skeleton width="var(--size-meter)" />
          <Skeleton width={i % 2 ? '80%' : '64%'} />
          <Skeleton width="56%" />
        </div>
      ))}
    </div>
  );
}

function Stats() {
  return (
    <div className="kshell-skel__stats">
      {Array.from({ length: 4 }, (_, i) => (
        <span className="kshell-skel__stat" key={i}>
          <Skeleton width="50%" height="label" />
          <Skeleton width="40%" height="display" />
          <Skeleton width="70%" height="label" />
        </span>
      ))}
    </div>
  );
}

/** Suspense fallback for a screen's chunk, shaped like that screen's content. */
export function ScreenSkeleton({ screen }: { screen: Screen }) {
  let body: ReactNode;
  if (screen === 'brief') {
    body = <><Skeleton width="56%" height="line" /><Stats /><Rows count={5} /></>;
  } else if (screen === 'backtest') {
    body = <><Skeleton width="64%" height="display" /><Skeleton width="48%" /><Stats /><Rows count={4} /></>;
  } else if (screen === 'pipeline') {
    body = <><Stats /><Rows count={6} /></>;
  } else {
    body = (
      <>
        <div className="kshell-skel__toolbar">
          <Skeleton width="var(--size-search)" height="control" />
          <Skeleton width="var(--size-meter)" height="control" />
        </div>
        <Rows count={8} />
      </>
    );
  }
  return (
    <div className="kshell-skel" aria-busy="true" data-testid="screen-skeleton">
      <span className="k-sr-only">Loading this screen…</span>
      {body}
    </div>
  );
}

interface BoundaryProps { screen: Screen; onRetry: () => void; children: ReactNode }

/** Catches a failed chunk load (or a screen crash) and offers a retry instead of a blank page. */
export class ScreenBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (prev.screen !== this.props.screen && this.state.error) this.setState({ error: null });
  }

  retry = () => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorState
        title="Couldn't load this screen"
        detail={this.state.error.message}
        onRetry={this.retry}
      />
    );
  }
}
