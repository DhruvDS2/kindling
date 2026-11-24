import { useCallback, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'motion/react';
import { dur, ease } from '../motion';
import './PageTransition.css';

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/**
 * 6A page transitions (DESIGN.md §3.7). Returns `go(update)`: runs a state update (e.g. setScreen)
 * inside a View Transition when the browser supports it, so only the content region (<PageView>)
 * cross-fades: out over --motion-fast, in over --motion-fast after half of that (≤ 180ms total,
 * no movement). The nav and top bar are excluded and stay still. Elsewhere it just updates, and
 * <PageView> plays a plain fade-in.
 */
export function usePageTransition() {
  return useCallback((update: () => void) => {
    const doc = document as ViewTransitionDoc;
    if (!doc.startViewTransition) { update(); return; }
    doc.documentElement.dataset.pageTransition = 'on';
    const vt = doc.startViewTransition(() => flushSync(update));
    vt.finished.finally(() => { delete doc.documentElement.dataset.pageTransition; });
  }, []);
}

/** The content region that cross-fades. Key it by screen: <PageView key={screen}>. */
export function PageView({ children, className }: { children: ReactNode; className?: string }) {
  const supportsVT = typeof document !== 'undefined' && 'startViewTransition' in document;
  if (supportsVT) return <div className={['k-page', className ?? ''].join(' ').trim()}>{children}</div>;
  return (
    <motion.div
      className={['k-page', className ?? ''].join(' ').trim()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: dur('fast'), ease: ease('enter'), delay: dur('fast') / 2 }}
    >
      {children}
    </motion.div>
  );
}
