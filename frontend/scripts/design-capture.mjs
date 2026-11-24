// Phase 3 capture for the UI upgrade (docs/UI-UPGRADE-RUN.md):
//   - after-screenshots, light + dark, same names as docs/design/before/
//   - 3 Playwright videos: change as_of, open a school drawer, load Backtest
//   - long tasks during transitions (PerformanceObserver 'longtask')
//   - reduced motion: fades only (opacity/color), no transform, clip-path, size or position animation
// Needs the API and `npm run dev` running. Every non-GET request is blocked, so nothing is ever sent.
// Env: UI_URL (http://localhost:5173), API_URL (http://localhost:8000), OUT (../../docs/design).
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const UI = process.env.UI_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:8000';
const OUT = resolve(here, process.env.OUT ?? '../../docs/design');
const AFTER = resolve(OUT, 'after'), VIDEOS = resolve(OUT, 'videos'), TMP = resolve(OUT, '.video-tmp');
for (const d of [AFTER, VIDEOS, TMP]) mkdirSync(d, { recursive: true });

const j = async p => { const r = await fetch(API + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const meta = await j('/meta');
const d = meta.demo_as_of, JAN5 = '2026-01-05';
const ready = (await j(`/pql?as_of=${d}`)).scores.find(s => s.status === 'Ready');
const risk = (await j(`/health?as_of=${d}`)).scores.find(s => s.status === 'At risk');
const jan5 = (await j(`/health?as_of=${JAN5}`)).scores.filter(s => s.status === 'Healthy')
  .sort((a, b) => b.active_teachers - a.active_teachers)[0];

const problems = [];
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('response', r => { if (r.url().startsWith(API) && r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route(`${API}/**`, route => route.request().method() === 'GET' ? route.continue() : route.abort());
  return { ctx, page };
}
const settle = async (page, ms = 900) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.k-skeleton, [aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
};
const go = async (page, params) => { await page.goto(`${UI}/?${new URLSearchParams({ as_of: d, ...params })}`); await settle(page); };

// ── 1. after-screenshots (same names as docs/design/before) ─────────────────
const shots = [
  ['01-brief', { screen: 'brief' }], ['02-ready', { screen: 'ready' }],
  ['03-ready-drawer', { screen: 'ready', school: ready.school_id }],
  ['04-at-risk', { screen: 'risk' }], ['05-at-risk-drawer', { screen: 'risk', school: risk.school_id }],
  ['06-drawer-jan5', { screen: 'risk', as_of: JAN5, school: jan5.school_id }],
  ['07-backtest', { screen: 'backtest' }], ['08-prospects', { screen: 'prospects' }],
  ['09-pipeline', { screen: 'pipeline' }], ['10-automations', { screen: 'automations' }],
];
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await newPage({ colorScheme: scheme });
  for (const [name, params] of shots) {
    const tall = Boolean(params.school);
    await page.setViewportSize({ width: 1440, height: tall ? 1800 : 900 });
    await go(page, params);
    await page.mouse.move(720, 450);
    await page.screenshot({ path: resolve(AFTER, `${scheme}-${name}.png`) });
    if (!tall && scheme === 'light' && ['02-ready', '04-at-risk', '07-backtest'].includes(name)) {
      if (name === '07-backtest') {   // let the 5B bars grow before the full-page shot
        for (let y = 0; y < 4000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(120); }
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: resolve(AFTER, `${scheme}-${name}-full.png`), fullPage: true });
    }
    console.log(`after/${scheme}-${name}.png`);
  }
  await ctx.close();
}

// ── 2. videos ───────────────────────────────────────────────────────────────
async function video(name, run) {
  const { ctx, page } = await newPage({ colorScheme: 'light', recordVideo: { dir: TMP, size: { width: 1440, height: 900 } } });
  await run(page);
  const v = page.video(); await ctx.close();
  const target = resolve(VIDEOS, `${name}.webm`); renameSync(await v.path(), target); console.log(`videos/${name}.webm`);
}
await video('01-change-as-of', async page => {
  await go(page, { screen: 'ready' }); await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: /^Next week/ }).click(); await settle(page, 1400); }
  const ruler = page.getByRole('slider', { name: /Week of the school year/ });
  await ruler.focus(); for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowRight'); await settle(page, 1400); }
});
await video('02-open-drawer', async page => {
  await go(page, { screen: 'risk' }); await page.waitForTimeout(600);
  await page.locator('table tbody tr').first().click(); await page.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('j'); await page.waitForTimeout(1300); }
  await page.mouse.move(1100, 650); await page.mouse.wheel(0, 500); await page.waitForTimeout(900);
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
});
await video('03-load-backtest', async page => {
  await go(page, { screen: 'brief' }); await page.waitForTimeout(600);
  await page.locator('[data-nav="backtest"]').click(); await settle(page, 800);
  for (let y = 0; y < 2400; y += 200) { await page.mouse.wheel(0, 200); await page.waitForTimeout(160); }
  const district = page.getByText('District calendars', { exact: true }).first();
  if (await district.count()) { await district.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await district.click(); await page.waitForTimeout(1200); }
});
rmSync(TMP, { recursive: true, force: true });

// ── 3. long tasks during transitions ────────────────────────────────────────
const perf = {};
{
  const { ctx, page } = await newPage({ colorScheme: 'light' });
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push({ start: e.startTime, ms: Math.round(e.duration) }); })
      .observe({ type: 'longtask', buffered: true });
  });
  const measure = async (label, act) => {
    await page.evaluate(() => { window.__long = []; });
    await act(); await page.waitForTimeout(1200);
    const long = await page.evaluate(() => window.__long);
    perf[label] = { count: long.length, maxMs: long.reduce((m, e) => Math.max(m, e.ms), 0) };
  };
  await go(page, { screen: 'ready' });
  await measure('week step · Ready (Ready filter)', () => page.getByRole('button', { name: /^Next week/ }).click());
  await page.getByText(/^All\b/).first().click().catch(() => {}); await settle(page);
  await measure('week step · Ready (All 85 rows)', () => page.getByRole('button', { name: /^Next week/ }).click());
  await go(page, { screen: 'risk' });
  await measure('drawer open', () => page.locator('table tbody tr').first().click());
  await measure('drawer page (j)', () => page.keyboard.press('j'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await measure('page switch → Backtest', () => page.locator('[data-nav="backtest"]').click());
  await ctx.close();
}

// ── 4. reduced motion: only opacity may animate ─────────────────────────────
const reduced = {};
{
  const { ctx, page } = await newPage({ colorScheme: 'light', reducedMotion: 'reduce' });
  const animatedProps = () => page.evaluate(() => [...new Set(document.getAnimations().flatMap(a => {
    const kf = a.effect?.getKeyframes?.() ?? []; return kf.flatMap(k => Object.keys(k).filter(p => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)));
  }))]);
  const during = async (label, act) => { await act(); await page.waitForTimeout(60); reduced[label] = await animatedProps(); await page.waitForTimeout(800); };
  await go(page, { screen: 'ready' });
  await during('week step', () => page.getByRole('button', { name: /^Next week/ }).click());
  await go(page, { screen: 'risk' });
  await during('drawer open', () => page.locator('table tbody tr').first().click());
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await during('page switch', () => page.locator('[data-nav="backtest"]').click());
  for (const [k, props] of Object.entries(reduced)) {
    // Reduced motion = fades only: opacity and color fades are allowed, any movement (transform, clip-path, size, position) is not.
    const FADES = ['opacity', 'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'outlineColor', 'fill', 'stroke'];
    const bad = props.filter(p => !FADES.includes(p));
    if (bad.length) problems.push(`reduced motion · ${k}: animates ${bad.join(', ')}`);
  }
  await ctx.close();
}
await browser.close();

const report = { generated_at: new Date().toISOString(), longTasks: perf, reducedMotionAnimatedProps: reduced, problems: [...new Set(problems)] };
writeFileSync(resolve(OUT, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ longTasks: perf, reducedMotion: reduced }, null, 1));
if (report.problems.length) { console.error(`\n${report.problems.length} problem(s):\n` + report.problems.join('\n')); process.exit(1); }
console.log('\nno console errors, no failed API calls, reduced motion = fades only');
