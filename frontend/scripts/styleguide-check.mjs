// Phase 1 gate for the dev-only /__styleguide route (needs `npm run dev`; no API calls are made).
//   UI_URL=http://localhost:5173 npm run styleguide:check
// 1. Full-page screenshots, light and dark → docs/design/styleguide/ (OUT to override).
// 2. Behavior checks:
//    - the drawer opens, Esc closes it, pointer events are cleared at once, focus returns;
//    - j/k (and ↓) move table focus, ↵ opens the focused row, Esc returns focus to that row;
//    - the WeekRuler responds to ←/→ and Home/End, and emits one settled change per burst of keys;
//    - stepping a week reorders rows with a layout slide, and rows that cross the line tint once;
//    - with reducedMotion: 'reduce', the drawer fades and never animates clip-path.
// Fails on console errors. Uses installed Chrome (channel "chrome") when present.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const UI = process.env.UI_URL ?? 'http://localhost:5173';
const OUT = resolve(here, process.env.OUT ?? '../../docs/design/styleguide');
mkdirSync(OUT, { recursive: true });

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const problems = [];
const passed = [];
const check = (ok, label, detail = '') => (ok ? passed : problems).push(ok ? label : `${label}${detail ? `: ${detail}` : ''}`);

async function open(opts = {}, theme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, ...opts });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push(`console (${theme}): ${m.text()}`); });
  page.on('pageerror', e => problems.push(`page error (${theme}): ${e.message}`));
  // The styleguide is sample data only; never let it reach an API or send anything.
  await page.route(u => !u.href.startsWith(UI) && !/fonts\.(googleapis|gstatic)\.com/.test(u.href), r => r.abort());
  await page.route(`${UI}/**`, r => (r.request().method() === 'GET' ? r.continue() : r.abort()));
  await page.goto(`${UI}/__styleguide?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="sg-table"] tr[data-key]', { timeout: 15000 });
  await page.waitForTimeout(1200);  // first-load reveals and count-ups settle
  return { ctx, page };
}

// ── 1. Screenshots ──────────────────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await open({}, theme);
  const file = resolve(OUT, `styleguide-${theme}.png`);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${file}`);
  await ctx.close();
}

// ── 2. Behavior ─────────────────────────────────────────────────────────
{
  const { ctx, page } = await open();

  // Drawer: open, clip-path animates, Esc closes, pointer events cleared at once, focus returns.
  const trigger = page.getByTestId('sg-open-drawer');
  await trigger.click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor();
  const clipWhileOpening = await page.evaluate(() => new Promise(res => {
    const seen = [];
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector('[role="dialog"]');
      if (el) seen.push(getComputedStyle(el).clipPath);
      if (performance.now() - t0 < 250) requestAnimationFrame(tick); else res(seen);
    };
    tick();
  }));
  check(clipWhileOpening.some(v => /inset\(0(px|%)? 0(px|%)? 0(px|%)? [1-9]/.test(v)), 'drawer opens with a right-side clip wipe', JSON.stringify(clipWhileOpening.slice(0, 3)));
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  const pointerAtClose = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    return el ? getComputedStyle(el).pointerEvents : 'gone';
  });
  check(pointerAtClose === 'none' || pointerAtClose === 'gone', 'pointer events cleared immediately on close', pointerAtClose);
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  check(true, 'Esc closes the drawer');
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  check(focusBack === 'sg-open-drawer', 'focus returns to the opener', String(focusBack));

  // Table keyboard: j/k move focus; ↵ opens the focused row; Esc returns focus to it.
  const keys = await page.$$eval('[data-testid="sg-table"] tr[data-key]', rows => rows.map(r => r.getAttribute('data-key')));
  await page.$eval('[data-testid="sg-table"] tr[data-key]', r => r.focus());
  const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-key'));
  await page.keyboard.press('j');
  const afterJ = await active();
  await page.keyboard.press('j');
  const afterJJ = await active();
  await page.keyboard.press('k');
  const afterK = await active();
  await page.keyboard.press('ArrowDown');
  const afterDown = await active();
  check(afterJ === keys[1] && afterJJ === keys[2] && afterK === keys[1] && afterDown === keys[2], 'j/k and ↓ move table focus', `${keys.slice(0, 3)} → ${afterJ},${afterJJ},${afterK},${afterDown}`);
  await page.keyboard.press('Enter');
  await dialog.waitFor();
  const title = await dialog.locator('h2').innerText();
  const rowName = await page.$eval(`tr[data-key="${keys[2]}"]`, r => r.getAttribute('aria-label'));
  check(title.trim() === rowName, '↵ opens the focused row in the drawer', `${title} vs ${rowName}`);
  await page.waitForTimeout(400);
  await page.keyboard.press('j');
  await page.waitForTimeout(300);
  const paged = await dialog.locator('h2').innerText();
  check(paged.trim() !== title.trim(), 'j pages the drawer to the next record');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  check((await active()) === keys[2], 'Esc returns focus to the originating row', String(await active()));

  // WeekRuler: ←/→, Home/End; one settled change per burst.
  const ruler = page.getByTestId('week-ruler').first();
  await ruler.focus();
  const now = async () => Number(await ruler.getAttribute('aria-valuenow'));
  const settled = async () => Number((await page.getByTestId('sg-settled').innerText()).match(/\d+/)[0]);
  const v0 = await now();
  const s0 = await settled();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const v3 = await now();
  await page.waitForTimeout(700);
  const s1 = await settled();
  await page.keyboard.press('ArrowLeft');
  const v2 = await now();
  await page.keyboard.press('Home');
  const vHome = await now();
  await page.keyboard.press('End');
  const vEnd = await now();
  const max = Number(await ruler.getAttribute('aria-valuemax'));
  check(v3 === v0 + 3 && v2 === v0 + 2 && vHome === 0 && vEnd === max, 'WeekRuler responds to ←/→ and Home/End', `${v0}→${v3}→${v2}, home ${vHome}, end ${vEnd}/${max}`);
  check(s1 === s0 + 1, 'WeekRuler emits one settled change per burst of keys', `${s0} → ${s1}`);

  // Week change (§3.2): rows slide to their new rank (layout transform mid-flight), crossers tint once.
  const order = () => page.$$eval('[data-testid="sg-table"] tr[data-key]', rows => rows.map(r => r.getAttribute('data-key')));
  const before = await order();
  await page.evaluate(() => {
    window.__moving = false; window.__tinted = [];
    const t0 = performance.now();
    const tick = () => {
      for (const r of document.querySelectorAll('[data-testid="sg-table"] tr[data-key]')) {
        const tf = getComputedStyle(r).transform;
        if (tf && tf !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(tf)) window.__moving = true;
        if (r.hasAttribute('data-crossed') && !window.__tinted.includes(r.dataset.key)) window.__tinted.push(r.dataset.key);
      }
      if (performance.now() - t0 < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByTestId('sg-step-table').click();
  await page.waitForTimeout(1000);
  const after = await order();
  const moving = await page.evaluate(() => window.__moving);
  const tinted = await page.evaluate(() => window.__tinted);
  check(after.join() !== before.join() && moving, 'stepping a week reorders rows with a layout slide', `${before} → ${after}, moving ${moving}`);
  check(tinted.length > 0, 'rows that cross the ready line get one tint', JSON.stringify(tinted));
  await ctx.close();
}

// Reduced motion: the drawer fades; clip-path never animates.
{
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  // Start sampling every frame before the click, so the whole fade is observed.
  await page.evaluate(() => {
    window.__samples = [];
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector('[role="dialog"]');
      if (el) { const cs = getComputedStyle(el); window.__samples.push({ clip: cs.clipPath, opacity: Number(cs.opacity) }); }
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByTestId('sg-open-drawer').click();
  await page.waitForTimeout(1600);
  const samples = await page.evaluate(() => window.__samples);
  check(samples.length > 0 && samples.every(s => s.clip === 'none'), 'reduced motion: no clip-path animation on the drawer', JSON.stringify([...new Set(samples.map(s => s.clip))]));
  check(samples.some(s => s.opacity < 1), 'reduced motion: the drawer fades in instead', JSON.stringify(samples.slice(0, 2)));
  await page.keyboard.press('Escape');
  await ctx.close();
}

await browser.close();
for (const p of passed) console.log(`ok   ${p}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + [...new Set(problems)].map(p => `FAIL ${p}`).join('\n'));
  process.exit(1);
}
console.log(`\n${passed.length} checks passed, no console errors`);
