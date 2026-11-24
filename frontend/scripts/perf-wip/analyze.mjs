// node analyze.mjs <profileDir> <distDir> [slugFilter]
// For each transition: main-thread tasks > 45ms from the trace (with a breakdown of their top-level
// work), and the JS self/inclusive time inside those tasks from the CPU profile, mapped through sourcemaps.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { SourceMapConsumer } from '/Users/dhruvsharma/personal-projects/kindling/.worktrees/p3-perf/frontend/node_modules/source-map-js/source-map.js';

const [dir, dist, filter] = process.argv.slice(2);
const maps = new Map();
function mapFor(url) {
  const m = url.match(/\/assets\/[^?]+\.js/);
  if (!m || !dist) return null;
  if (maps.has(m[0])) return maps.get(m[0]);
  const p = resolve(dist, '.' + m[0] + '.map');
  const c = existsSync(p) ? new SourceMapConsumer(JSON.parse(readFileSync(p, 'utf8'))) : null;
  maps.set(m[0], c);
  return c;
}
function nameOf(cf) {
  const c = mapFor(cf.url);
  let file = cf.url.replace(/^https?:\/\/[^/]+\//, '').replace(/^node_modules\/(\.vite\/deps\/)?/, 'nm:').replace(/\?.*$/, '');
  let fn = cf.functionName || '(anon)';
  if (c) {
    const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber });
    if (o.source) { file = o.source.replace(/^.*node_modules\//, 'nm:').replace(/^.*\/src\//, 'src/'); if (o.name) fn = o.name; file += ':' + o.line; }
  } else if (cf.lineNumber >= 0) file += ':' + (cf.lineNumber + 1);
  return `${fn} ${file}`;
}

for (const f of readdirSync(dir).filter(f => f.endsWith('.cpuprofile') && (!filter || f.includes(filter))).sort()) {
  const slug = f.replace(/\.cpuprofile$/, '');
  const prof = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
  const tracePath = resolve(dir, slug + '.trace.json');
  const trace = existsSync(tracePath) ? JSON.parse(readFileSync(tracePath, 'utf8')) : null;
  const evs = trace ? (trace.traceEvents ?? trace) : [];
  // renderer main thread: the one with CrRendererMain
  const mainTid = evs.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const mains = evs.filter(e => mainTid && e.pid === mainTid.pid && e.tid === mainTid.tid);
  const tasks = mains.filter(e => e.name === 'RunTask' && e.ph === 'X' && e.dur > (Number(process.env.MIN ?? 45) * 1000));
  console.log(`\n══ ${slug}: ${tasks.length} task(s) > 45ms`);
  // map profile time to trace time: profile.startTime is in µs on the same clock as trace ts.
  const nodes = new Map(prof.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const times = []; let t = prof.startTime;
  for (let i = 0; i < prof.samples.length; i++) { t += prof.timeDeltas[i]; times.push(t); }
  for (const task of tasks) {
    const a = task.ts, b = task.ts + task.dur;
    // breakdown of direct children by name
    const kids = mains.filter(e => e.ph === 'X' && e.ts >= a && e.ts + (e.dur ?? 0) <= b && e !== task);
    const by = {};
    for (const k of kids) if (['FunctionCall', 'EventDispatch', 'TimerFire', 'Layout', 'UpdateLayoutTree', 'Paint', 'PrePaint', 'Layerize', 'v8.run', 'EvaluateScript', 'v8.compile', 'ParseHTML', 'FireAnimationFrame', 'HitTest', 'MajorGC', 'MinorGC', 'RunMicrotasks', 'v8.evaluateModule', 'ScheduleStyleRecalculation', 'UpdateLayer', 'Commit', 'IntersectionObserverController::computeIntersections', 'ResizeObserverController::DeliverObservations'].includes(k.name)) by[k.name] = (by[k.name] ?? 0) + k.dur / 1000;
    console.log(`  task ${(task.dur / 1000).toFixed(0)}ms @${((a - (evs.find(e => e.name === 'TracingStartedInBrowser')?.ts ?? a)) / 1000).toFixed(0)}  ` +
      Object.entries(by).sort((x, y) => y[1] - x[1]).slice(0, 9).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' '));
    const self = {}, incl = {};
    let n = 0;
    for (let i = 0; i < prof.samples.length; i++) {
      if (times[i] < a || times[i] > b) continue;
      const dt = (prof.timeDeltas[i + 1] ?? 100) / 1000;
      n += dt;
      let id = prof.samples[i];
      const sn = nameOf(nodes.get(id).callFrame);
      self[sn] = (self[sn] ?? 0) + dt;
      const seen = new Set();
      while (id != null) { const nm = nameOf(nodes.get(id).callFrame); if (!seen.has(nm)) { incl[nm] = (incl[nm] ?? 0) + dt; seen.add(nm); } id = parent.get(id); }
    }
    console.log(`   self:`); for (const [k, v] of Object.entries(self).sort((x, y) => y[1] - x[1]).slice(0, 14)) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`);
    console.log(`   inclusive (src/ only):`); for (const [k, v] of Object.entries(incl).filter(([k]) => / src\//.test(k)).sort((x, y) => y[1] - x[1]).slice(0, 18)) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`);
    console.log(`   inclusive (motion/react-dom):`); for (const [k, v] of Object.entries(incl).filter(([k]) => /nm:(motion|framer|react-dom|react_dom|recharts)/.test(k)).sort((x, y) => y[1] - x[1]).slice(0, 14)) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`);
  }
}
