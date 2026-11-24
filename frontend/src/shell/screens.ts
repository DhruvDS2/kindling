// Code-split screens (lane A). Each screen is its own lazy chunk, so heavy dependencies
// (recharts on Backtest, the drawer charts) never load with the shell. preloadScreen() lets the
// shell fetch a chunk on nav hover/focus and before a page transition starts, so the
// cross-fade lands on the screen rather than on its Suspense fallback.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Screen } from '../nav';

const loaders = {
  brief: () => import('../screens/MondayBrief'),
  ready: () => import('../screens/ReadyToBuy'),
  risk: () => import('../screens/AtRisk'),
  pipeline: () => import('../screens/Pipeline'),
  prospects: () => import('../screens/Prospects'),
  backtest: () => import('../screens/Backtest'),
  automations: () => import('../screens/Automations'),
} satisfies Record<Screen, () => Promise<{ default: ComponentType<never> }>>;

type Loaders = typeof loaders;
type ScreenModule<S extends Screen> = Awaited<ReturnType<Loaders[S]>>;
export type ScreenView<S extends Screen> = LazyExoticComponent<ScreenModule<S>['default']>;

const inflight = new Map<Screen, Promise<unknown>>();
const views = new Map<Screen, unknown>();

/** Starts (or reuses) the chunk download for a screen. */
export function preloadScreen<S extends Screen>(screen: S): Promise<ScreenModule<S>> {
  let p = inflight.get(screen);
  if (!p) {
    p = loaders[screen]();
    inflight.set(screen, p);
    p.catch(() => inflight.delete(screen));
  }
  return p as Promise<ScreenModule<S>>;
}

/** The lazy component for a screen; stable across renders until resetScreen(). */
export function screenView<S extends Screen>(screen: S): ScreenView<S> {
  let v = views.get(screen);
  if (!v) {
    v = lazy(() => preloadScreen(screen) as unknown as Promise<{ default: ComponentType<object> }>);
    views.set(screen, v);
  }
  return v as ScreenView<S>;
}

/** Forget a failed chunk (React.lazy caches the failure), so a retry hits the network again. */
export function resetScreen(screen: Screen) {
  inflight.delete(screen);
  views.delete(screen);
}
