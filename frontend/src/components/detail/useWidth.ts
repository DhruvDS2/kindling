import { useLayoutEffect, useState } from 'react';

/** Measures an element's content width (callback ref, so it works when the element mounts late).
 *  Measured before paint, so a freshly paged drawer body never flashes a zero-width chart. */
export function useWidth(initial = 0): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  // Perf (Phase 3): a paged drawer body starts at the width the last page measured, so the layout
  // effect below sets the same value (no re-render) instead of re-rendering the charts synchronously.
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
