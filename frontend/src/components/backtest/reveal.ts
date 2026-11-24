import { useEffect, useState } from 'react';

/**
 * True once the element has been scrolled into view, and never false again (the bars grow
 * once). With reduced motion (or no IntersectionObserver) it is true from the start, so
 * nothing grows.
 */
export function useRevealOnce(reduce: boolean): [(el: Element | null) => void, boolean] {
  const [el, setEl] = useState<Element | null>(null);
  const [seen, setSeen] = useState(false);
  const instant = reduce || typeof IntersectionObserver === 'undefined';
  useEffect(() => {
    if (instant || seen || !el) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen, instant]);
  return [setEl, instant || seen];
}
