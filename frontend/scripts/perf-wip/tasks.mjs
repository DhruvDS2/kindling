// node tasks.mjs trace.json [minMs]: every main-thread task over minMs with its start (ms from trace start) and top work.
import { readFileSync } from 'node:fs';
const [f, min = 8] = process.argv.slice(2);
const t = JSON.parse(readFileSync(f, 'utf8')); const evs = t.traceEvents ?? t;
const m = evs.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
const mains = evs.filter(e => e.pid === m.pid && e.tid === m.tid && e.ph === 'X');
const t0 = Math.min(...mains.map(e => e.ts));
for (const task of mains.filter(e => e.name === 'RunTask' && e.dur > min * 1000)) {
  const kids = mains.filter(e => e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e !== task && e.name !== 'RunTask');
  const by = {};
  for (const k of kids) by[k.name] = (by[k.name] ?? 0) + k.dur / 1000;
  const ev = kids.find(k => k.name === 'EventDispatch')?.args?.data?.type;
  const fc = kids.find(k => k.name === 'FunctionCall')?.args?.data;
  console.log(`${((task.ts - t0) / 1000).toFixed(0).padStart(5)}ms ${(task.dur / 1000).toFixed(1).padStart(6)}ms ${ev ? 'event:' + ev : ''} ${fc ? 'fn:' + (fc.functionName || '?') + '@' + (fc.url || '').split('/').pop() + ':' + fc.lineNumber : ''}  ` +
    Object.entries(by).filter(([k]) => !['FunctionCall', 'EventDispatch', 'RunMicrotasks', 'v8.run', 'V8.BytecodeBudgetInterrupt'].includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(' '));
}
