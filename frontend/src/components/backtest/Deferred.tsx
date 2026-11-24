import { startTransition, useEffect, useState, type ReactNode } from 'react';

// Perf (Phase 3): the Backtest page used to mount every section in the one task that its results
// arrived in, then lay all of it out in the next frame (a 62ms task on the page switch). Sections
// below the headline, stats and bars now mount one at a time: each waits for an idle moment, renders
// at transition priority (interruptible), and the next one waits until this one has painted. Every
// section is on the page within a few frames, in the same order, so nothing is hidden for long and
// full-page screenshots still show the whole page.

type Job = { state: 'queued' | 'running' | 'done' | 'cancelled'; start: () => void };
const queue: Job[] = [];
let current: Job | null = null;   // the one section mounting now

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
const whenIdle = (cb: () => void) => {
  const w = window as IdleWindow;
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 250 });
  else window.setTimeout(cb, 0);
};

function pump() {
  if (current) return;
  let job = queue.shift();
  while (job && job.state !== 'queued') job = queue.shift();
  if (!job) return;
  current = job;
  job.state = 'running';
  const j = job;
  whenIdle(() => { if (j.state === 'running') j.start(); else release(j); });
}

/** The job is finished (or gone): let the next section start. */
function release(job: Job) {
  if (current !== job) return;
  current = null;
  pump();
}

/** Renders `fallback` until this section's turn, then `children`. Order follows mount order. */
export function Deferred({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [job] = useState<{ current: Job | null }>(() => ({ current: null }));

  useEffect(() => {
    const j: Job = { state: 'queued', start: () => startTransition(() => setReady(true)) };
    job.current = j;
    queue.push(j);
    pump();
    return () => {
      if (j.state !== 'done') j.state = 'cancelled';
      release(j);   // unmounted before its turn finished: let the next one go
    };
  }, [job]);

  useEffect(() => {
    if (!ready || !job.current) return;
    const j = job.current;
    // Committed. Hand over after the next frame, so the browser paints this section first.
    const raf = requestAnimationFrame(() => window.setTimeout(() => {
      if (j.state === 'running') { j.state = 'done'; release(j); }
    }, 0));
    return () => cancelAnimationFrame(raf);
  }, [ready, job]);

  return <>{ready ? children : fallback}</>;
}
