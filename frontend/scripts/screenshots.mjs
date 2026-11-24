// Screenshot every screen of the console with Playwright, and fail on console errors
// or failed API calls. Needs the API and the UI running:
//   uvicorn kindling.api:app --port 8000      (repo root)
//   npm run dev                                (frontend/)
//   npm run screenshots                        (frontend/)
// Env: UI_URL (http://localhost:5173), API_URL (http://localhost:8000),
//      OUT (../docs/gates/screens), PREFIX (ui), AS_OF (demo date from /meta).
// Uses your installed Google Chrome (channel "chrome"), so no browser download is needed.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const UI = process.env.UI_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:8000';
const OUT = resolve(here, process.env.OUT ?? '../../docs/gates/screens');
const PREFIX = process.env.PREFIX ?? 'ui';
mkdirSync(OUT, { recursive: true });

const j = async (path) => { const r = await fetch(`${API}${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };
const meta = await j('/meta');
const asOf = process.env.AS_OF ?? meta.demo_as_of;
const readySchool = (await j(`/pql?as_of=${asOf}`)).scores.find(s => s.status === 'Ready');
const riskSchool = (await j(`/health?as_of=${asOf}`)).scores.find(s => s.status === 'At risk');
// The idea in one picture: a healthy school on the first Monday back from winter break.
const JAN5 = '2026-01-05';
const jan5Healthy = (await j(`/health?as_of=${JAN5}`)).scores
  .filter(s => s.status === 'Healthy').sort((x, y) => y.active_teachers - x.active_teachers)[0];

const shots = [
  ['01-brief', { screen: 'brief' }],
  ['02-ready', { screen: 'ready' }],
  ['03-ready-detail', { screen: 'ready', school: readySchool?.school_id }],
  ['04-at-risk', { screen: 'risk' }],
  ['05-at-risk-detail', { screen: 'risk', school: riskSchool?.school_id }],
  ['06-pipeline', { screen: 'pipeline' }],
  ['07-prospects', { screen: 'prospects' }],
  ['08-backtest', { screen: 'backtest' }],
  ['09-automations', { screen: 'automations' }],
  ['10-brief-jan5', { screen: 'brief', as_of: JAN5 }],
  ['11-detail-healthy-jan5', { screen: 'risk', as_of: JAN5, school: jan5Healthy?.school_id }],
];

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); }
catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', e => problems.push(`page error: ${e.message}`));
page.on('response', r => { if (r.url().startsWith(API) && r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
// Never let a screenshot run send anything: block every POST to the API.
await page.route(`${API}/**`, route => route.request().method() === 'GET' ? route.continue() : route.abort());

for (const [name, params] of shots) {
  if ('school' in params && !params.school) { problems.push(`${name}: no school to open`); continue; }
  const p = new URLSearchParams({ as_of: asOf, ...params });
  await page.goto(`${UI}/?${p}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 15000 }).catch(() => {});
  await page.mouse.move(700, 400);   // recharts paints some series on first pointer move in headless Chrome
  await page.waitForTimeout(800);
  const file = resolve(OUT, `${PREFIX}-${name}.png`);
  if (params.school) {
    // The drawer is fixed to the viewport: shoot a tall viewport, not the (long) page behind it.
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: file });
    await page.setViewportSize({ width: 1440, height: 900 });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  console.log(`saved ${file}`);
}
await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('\nno console errors, no failed API calls');
