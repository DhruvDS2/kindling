# UI upgrade gate (run `kindling-ui-upgrade`)

**Verdict: PASSED.** Every gate in the run spec's Phase 3 is green.
- **Build:** TypeScript 0 errors.
- **Tests:** pytest 33 passed.
- **Screenshots:** `npm run screenshots` clean on the production build.
- **Token lint:** 0 findings (from 862).
- **After-screens and videos:** light and dark after-screens plus 3 videos.
- **Long tasks:** 0 on every transition in the production build.
- **Reduced motion:** fades only.
- **Self-review:** all 7 banned tells absent, and the 10 audit problems FIXED.

| | Hash |
|---|---|
| `main` (untouched; `origin/main` the same) | `1235173` |
| `ui` (untouched; `origin/ui` the same) | `19e7830` |
| `ui-upgrade` | the commit that adds this file (pushed) |
| Merged lane branches (kept, pushed) | `ui-upgrade-p1-base` · `-lane-a-shell` · `-lane-b-brief-ready` · `-lane-c-risk-drawer` · `-lane-d-backtest` · `-lane-e-secondary` · `-p3-perf` |

## Gates
| Gate | Result | Command |
|---|---|---|
| Build | 0 TypeScript errors; `vite build` ✓. Initial JS **258 KiB** (entry chunk; was 739 kB, budget <300 kB). recharts loads only with Backtest | `cd frontend && npm run build` |
| Python tests | **33 passed**; backend untouched by this run | `python3 -m pytest -q` |
| Screenshots | No console errors, no failed API calls (production preview) | `npm run screenshots` |
| Token lint | **0 findings** across `src/` (baseline 862). No raw hex, px or ms outside `design/tokens.css` | `npm run lint:tokens` |
| After-screens | `docs/design/after/` (light and dark, same names as `before/`), with `docs/design/COMPARE.md` showing before, after and reference | `npm run design:capture` |
| Videos | `docs/design/videos/01-change-as-of.webm`, `02-open-drawer.webm`, `03-load-backtest.webm` | same |
| Long tasks (prod) | **0** on: week step (9 rows), week step (85 rows), drawer open, drawer `j`, page switch to Backtest (`docs/design/capture-report.json`) | same |
| Reduced motion | Fades only. Animated properties: opacity, color, background-color. No transform, clip-path, size or position | same |

The perf lane measured largest main-thread CPU task per transition, median/max in ms, before → after. Production: 7 runs, load 6.5–8.7. Dev: 5 runs.

| Transition | Prod before | Prod after | Dev before | Dev after |
|---|---|---|---|---|
| Week step (9 rows) | 11/16 | 9/22 | 36/48 | 19/28 |
| Week step (85 rows) | 30/33 | 19/26 | 152/155 | 34/38 |
| Drawer open | 26/29 | 15/17 | 93/96 | 31/35 |
| Drawer `j` | 15/24 | 9/16 | 47/57 | 26/27 |
| Backtest switch | 31/38 | 32/37 | 99/109 | 99/105 |

The Backtest switch still costs about 32ms in prod: that's the recharts chart mounting. It's under 50ms, but it's the one transition that didn't improve.

## Self-review: banned list (DESIGN.md §8)
| Tell | Verdict | Evidence |
|---|---|---|
| Rounded cards with drop shadows; card grids; icon-in-circle tiles | **FIXED** | Sections sit on the page, divided by hairlines; stats share one baseline. Shadows only on popovers. `after/light-01-brief.png`, `after/light-07-backtest-full.png` |
| Purple/blue gradients, glass, glows, gradient text, emoji, blobs | **NOT PRESENT** | Grep is clean, and the "✓" glyphs are gone. `after/light-03-ready-drawer.png` |
| Default shadcn/Tailwind look; decorative icons | **NOT PRESENT** | Own components with `k-` classes, and only functional line icons (search, chevrons, close). Tailwind's reset is still loaded (follow-up). `after/light-02-ready.png` |
| Rainbow badges; colored left-border alert cards | **FIXED** | One accent (ember) and four status colors. Outreach buttons lost their Slack, LinkedIn and Gmail brand colors; red left bars are gone. `after/light-08-prospects.png`, `after/light-04-at-risk.png` |
| Centered everything; equal weight; giant numbers without context | **FIXED** | Left-aligned, a display title plus a narrative line, every number with a context line. `after/light-09-pipeline.png`, `after/light-01-brief.png` |
| Placeholder copy; generic empty states | **FIXED** | Rep copy ("10 cold schools worth a first call") and specific empty states ("No snapshots yet. Save one for Feb 2, 2026…"). `after/light-08-prospects.png`, `after/light-09-pipeline.png` |
| Animating everything on load; bouncy easing; >400ms transitions | **FIXED** | Motion is 120/200/320ms; 600ms only for chart reveals, once. No overshoot. 0 long tasks. `videos/*.webm`, `capture-report.json` |

## Self-review: the 10 audit problems (`docs/design/AUDIT.md`)
| # | Problem | Verdict | Evidence |
|---|---|---|---|
| 1 | Box soup | **FIXED**: structure from alignment, whitespace and hairlines | `after/light-01-brief.png`, `after/light-07-backtest-full.png` |
| 2 | Ember did five jobs; small ember text failed AA | **FIXED**: ember marks "act on this" only. Ready is ochre. `--accent-strong` #B5421C is 5.3:1 | `after/light-02-ready.png` |
| 3 | No type system (13 sizes, 600 weight, mono dates) | **FIXED**: 1 display size, 3 text sizes and a label size; weights 400/500; tabular numerals; mono only for hashes | DESIGN.md §5, `after/light-04-at-risk.png` |
| 4 | Ranked lists were walls (6,500px) | **FIXED**: defaults to the 9 Ready schools; sticky sortable table, score meter, j/k, row actions | `after/light-02-ready.png`, `after/light-02-ready-full.png` |
| 5 | The Brief didn't brief | **FIXED**: a narrative sentence, plus changes vs last week and 8-week sparklines | `after/light-01-brief.png` |
| 6 | Nothing explained change | **FIXED**: count-through, rows that slide to their new rank, the drawer wipe and pager, the page cross-fade | `videos/01-change-as-of.webm`, `videos/02-open-drawer.webm` |
| 7 | Native date input; confusing real-world "n8n" date | **FIXED**: a week pager and week ruler (breaks shaded, ember only for the current week); "Alerts sent Nov 17 (n8n)" in the sidebar footer | `after/light-01-brief.png` |
| 8 | Backtest read like a lab report | **FIXED**: a headline sentence, a ruled four-stat row, bars that grow once (naive wins marked), stamped tables, the district before/after toggle | `after/light-07-backtest-full.png`, `videos/03-load-backtest.webm` |
| 9 | No tokens beyond color; no dark theme | **FIXED**: full tokens, warm dark theme, lint enforced (0) | `after/dark-*.png` |
| 10 | Alert styling; giant numbers; messy secondary screens | **FIXED**: no left bars; Pipeline numbers with context; Automations right-aligned, repeat runs marked | `after/light-09-pipeline.png`, `after/light-10-automations.png` |

## Decisions and deviations
- **Picks:** Dhruv's picks are recorded in DESIGN.md §2. Two depart from the original spec:
  - the drawer uses the Preymaker right-side wipe instead of a shared-element transition from the row;
  - "Ready" is warm ochre, not petrol blue.
- **No date control on Backtest and Automations,** because neither depends on `as_of`. Backtest shows its replay range instead.
- **Code-splitting:** the shell itself is a lazy chunk (fetched in parallel with `/meta` at boot), to keep initial JS under 300 kB without switching every component to `LazyMotion`.
- **References:** the Details MCP ran out of monthly credits mid-run. Five references (6A, 3A, 3B, 5A, 5B) were implemented from the saved frames and notes instead of a fresh `get_inspiration`.
- **Gate script:** `design-capture.mjs` ignores 0-second animations in the reduced-motion check. View-transition groups carry 0s size/position keyframes that move nothing; this happens on every build.

## Follow-ups (not blocking)
- **Base component APIs** that lanes worked around locally:
  - WeekPager `testid` prop
  - `LazyMotion`/`m.*`
  - the view-transition root fix moved into `PageTransition.css`
  - a small SegmentedControl size
  - a Nav hover callback
  - a Drawer exit-complete callback
  - Drawer arrow-key propagation
  - a focus fallback when the focused control disappears
- **Unused Tailwind directives** in `index.css`.
- **A full-page screenshot artifact:** the fixed sidebar shows once mid-page in `*-full.png`. Users don't see it.
- **Carried over from the earlier UI run:**
  - re-import `n8n/kindling_weekly.json` into n8n;
  - `main`'s README and LEARN.md still say 83% / 100% until `ui` merges.
- **Merging `ui-upgrade` → `ui` → `main` is Dhruv's call.**

## Preview `ui-upgrade` locally
```bash
cd ~/personal-projects/kindling && git switch ui-upgrade && git pull --ff-only
python3 -m kindling.simulate
uvicorn kindling.api:app --port 8000                       # terminal 1 (your .env makes Send post for real)
cd frontend && npm install && npm run dev                  # terminal 2 (or: npm run build && npx vite preview --port 5173)
open http://localhost:5173                                  # Monday brief, demo date Feb 2, 2026
open "http://localhost:5173/?screen=risk&as_of=2026-01-05"  # the winter-break story: open any Healthy school
open http://localhost:5173/__styleguide                     # every base component, every state (dev only)
cd frontend && npm run design:capture                       # re-run this gate's captures and checks
```

## CONTEXT FOR CLAUDE
```text
Kindling: a PLG scoring console for K-12 edtech (PQL + health). FastAPI + DuckDB backend, React 19 + Vite + TS
+ TanStack Query + recharts + motion 14 frontend. Branch ui-upgrade is the finished design upgrade
(gate PASSED, docs/gates/UI-UPGRADE-GATE.md). main 1235173 and ui 19e7830 are untouched; merging is Dhruv's call.
Never commit to, merge into, rebase, reset or push main/ui unless Dhruv says so.
Design source of truth: DESIGN.md.
  §2 references with Details IDs (the Details MCP is out of credits; don't re-call)
  §3 behavior specs: drawer = Preymaker right-side clip wipe, open 320ms / close 200ms; 4A properties;
     4C pager via src/drawerList.tsx; "Next school →"; week stepping in place, no skeleton after first load
  §4 motion: 120/200/320/600ms, enter cubic-bezier(.2,.8,.2,1), exit (.4,0,1,1); reduced motion = fades only
  §5 tokens in frontend/src/design/tokens.css: the only file allowed raw values. Light + warm dark.
     Ember = the single accent; Ready = ochre #80560F; At risk red; Healthy green
  §6 components in src/design/components; §7 rules; §8 banned list
Code map:
  src/design/ (base, k- classes); src/shell/ (nav, top bar, week pager + ruler, lazy screens)
  src/screens/{MondayBrief,ReadyToBuy,AtRisk,Backtest,Prospects,Pipeline,Automations}.tsx plus subfolders
  src/components/AccountDetail.tsx + components/detail/ (drawer); components/backtest/
  asOf.tsx: as_of context, keepPreviousData, useIsUpdating. types.ts is the frozen API contract.
Rules that bite:
  every number comes from the API at runtime (thresholds from /meta); backtest tables keep source/run/commit;
  drawer props stay {type, school, onClose}; keep URL state ?screen/as_of/school and data-nav hooks;
  npm run lint:tokens must stay 0; reuse base components before adding patterns (add to DESIGN.md §6)
Gates:
  cd frontend && npm run build (initial JS < 300 kB) ; python3 -m pytest -q ;
  npm run lint:tokens ; npm run screenshots ;
  npm run design:capture (after-shots, videos, long tasks, reduced motion)
  Measure perf on a production build (vite preview) on a quiet machine; dev and contention inflate long tasks.
Safe API runs: prefix N8N_NOTIFY_WEBHOOK= SLACK_WEBHOOK_SALES= SLACK_WEBHOOK_CS= ANTHROPIC_API_KEY=
Worktrees: empty .env, python3 -m kindling.simulate, cp -cR node_modules (never symlink).
docs/design/refs/ is gitignored (third-party frames; the repo is public).
Open follow-ups: listed in UI-UPGRADE-GATE.md (base APIs, Tailwind directives, n8n re-import, main docs stale).
```
