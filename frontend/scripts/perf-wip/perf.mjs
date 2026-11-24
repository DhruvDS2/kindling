// Long-task measurement, the same as design-capture.mjs section 3, repeated RUNS times.
// PROFILE=dir also records a CDP CPU profile + a devtools trace around each transition.
import { chromium } from '/Users/dhruvsharma/personal-projects/kindling/.worktrees/p3-perf/frontend/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const UI = process.env.UI_URL ?? 'http://localhost:5501';
const API = process.env.API_URL ?? 'http://localhost:8501';
const RUNS = Number(process.env.RUNS ?? 3);
const PROFILE = process.env.PROFILE;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
if (PROFILE) mkdirSync(PROFILE, { recursive: true });

const meta = await (await fetch(API + '/meta')).json();
const d = meta.demo_as_of;
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const all = {};
const cpuAll = {};
const TRACE = process.env.TRACE;

async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.k-skeleton, [aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

for (let run = 0; run < RUNS; run++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.route(`${API}/**`, r => r.request().method() === 'GET' ? r.continue() : r.abort());
  if (process.env.BLOCK_FONTS) await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push({ start: e.startTime, ms: Math.round(e.duration) }); })
      .observe({ type: 'longtask', buffered: true });
  });
  const cdp = PROFILE ? await ctx.newCDPSession(page) : null;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); }

  const measure = async (label, act) => {
    if (ONLY && !ONLY.test(label)) { await act(); await page.waitForTimeout(1200); return; }
    await page.evaluate(() => { window.__long = []; window.__t0 = performance.now(); });
    const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    if (cdp) {
      await cdp.send('Profiler.start');
      await browser.startTracing(page, { path: `${PROFILE}/${slug}-r${run}.trace.json`, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing'] });
    } else if (TRACE) await browser.startTracing(page, { categories: ['disabled-by-default-devtools.timeline', 'devtools.timeline'] });
    await act(); await page.waitForTimeout(1200);
    let cpu = null;
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop');
      writeFileSync(`${PROFILE}/${slug}-r${run}.cpuprofile`, JSON.stringify(profile));
      await browser.stopTracing();
    } else if (TRACE) {
      const buf = await browser.stopTracing();
      const t = JSON.parse(buf.toString()); const evs = t.traceEvents ?? t;
      const m = evs.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
      const tasks = evs.filter(e => m && e.pid === m.pid && e.tid === m.tid && e.name === 'RunTask' && e.ph === 'X');
      const cpus = tasks.map(e => (e.tdur ?? e.dur) / 1000).sort((a, b) => b - a);
      cpu = { max: Math.round(cpus[0] ?? 0), over50: cpus.filter(x => x > 50).length, top: cpus.slice(0, 3).map(Math.round) };
    }
    const { long, t0 } = await page.evaluate(() => ({ long: window.__long, t0: window.__t0 }));
    (all[label] ??= []).push(long.map(e => ({ at: Math.round(e.start - t0), ms: e.ms })));
    if (cpu) (cpuAll[label] ??= []).push(cpu);
  };

  await page.goto(`${UI}/?as_of=${d}&screen=ready`); await settle(page);
  await measure('week step · Ready (Ready filter)', () => page.getByRole('button', { name: /^Next week/ }).click());
  await page.getByText(/^All\b/).first().click().catch(() => {}); await settle(page);
  await measure('week step · Ready (All 85 rows)', () => page.getByRole('button', { name: /^Next week/ }).click());
  await page.goto(`${UI}/?as_of=${d}&screen=risk`); await settle(page);
  await measure('drawer open', () => page.locator('table tbody tr').first().click());
  await measure('drawer page (j)', () => page.keyboard.press('j'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await measure('page switch → Backtest', () => page.locator('[data-nav="backtest"]').click());
  if (errs.length) console.error('errors:', [...new Set(errs)]);
  await ctx.close();
}
await browser.close();

const rows = Object.entries(all).map(([label, runs]) => {
  const counts = runs.map(r => r.length);
  const max = Math.max(0, ...runs.flat().map(e => e.ms));
  const c = cpuAll[label];
  return { label, counts: counts.join('/'), worst: max, ...(c ? { cpuOver50: c.map(x => x.over50).join('/'), cpuMax: Math.max(...c.map(x => x.max)), cpuTop: c.map(x => x.top.join(',')).join(' | ') } : {}), detail: runs.map(r => r.map(e => `${e.ms}@${e.at}`).join(' ') || '-').join(' | ') };
});
console.table(rows);
