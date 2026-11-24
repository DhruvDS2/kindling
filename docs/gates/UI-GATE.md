# UI gate (run P2)

**Verdict: PASSED.**
- `npm run build`: 0 errors.
- `pytest`: 33 passed.
- Playwright: 11 screens captured, no console errors, no failed API calls.

Work is on branch `ui` (`main..ui`: 10 first-parent commits, 73 files). `main` was not touched after step c.

| | Hash |
|---|---|
| `main` before the UI run (after the push in step c) | `1235173a3c947244b8533be9042e21f41f54d2fd` |
| `main` after the UI run | `1235173a3c947244b8533be9042e21f41f54d2fd` (same; `origin/main` same) |
| Lane branches (kept; not pushed) | `ui-lane-a-sales-cs` `4d1a7a4` · `ui-lane-b-school-detail` `5bcf325` · `ui-lane-c-backtest` `a63deae` |

## Gate results
| Gate | Result | Command |
|---|---|---|
| Frontend build | `✓ built`, 0 TypeScript errors. Only Vite's >500 kB chunk warning, which predates this run | `cd frontend && npm run build` |
| Python tests | **33 passed**, up from 12. New tests cover the date contract, backtest numbers coming from `backtest.py`'s files, the single "at risk" definition, the detail endpoints, and anti-cheating checks across all modules and all 3 window modes | `python3 -m pytest -q` |
| Screenshots | 11 PNGs in `docs/gates/screens/ui-*.png`. **No console errors, no failed API calls.** POSTs are blocked during capture | `cd frontend && npm run screenshots` |
| Numbers on screen | Every number comes from the API at runtime: `/meta`, `/stats`, `/pql`, `/health`, `/schools/*`, `/calendars/*`, `/backtest`, `/backtest/results`. Every backtest table shows its source file, run timestamp and commit | Lane greps plus a review of the screenshots |

## The four blockers (PRE-UI-READINESS §2)
1. **Pinned date: done.**
   - The API defaults to `DEMO_AS_OF = 2026-02-02` and returns 400 outside 2025-08-01 to 2026-07-31.
   - The UI reads the date from `/meta`, with a date picker over the school year. Screen, date and school live in the URL.
   - Why Feb 2 qualifies: its window (Jan 20 to Feb 2) is fully after winter break, with activity at 96% of the pre-break level, and 17 renewals fall 30 to 60 days out.
2. **Real backtest numbers: done.**
   - `backtest.py` writes `results/*.json` next to each `.md`: the same cells, plus `source`, `generated_at` and `commit` (the stamp gets `-dirty` if code was uncommitted).
   - `GET /backtest/results` serves those files; the API still never reads outcomes.
   - The fake `/backtest` metrics are gone.
3. **CS lifecycle and one "at risk": done.**
   - Health stops scoring a school once its renewal date arrives.
   - `status === 'At risk'` (health below 70, renewal still ahead) is the only definition, used by `/stats`, every screen, the sidebar badges, `/slack/health` and Streamlit.
4. **Green build: done.** Fixed the Prospects query passing React Query's context as `as_of` and the missing screen type, and removed the dead `Slack.tsx`.

## What was built (lanes merged into `ui`, no conflicts)
- **A, sales and CS** (`d22e7fe`):
  - Ready to buy: all free schools ranked, with the top 3 reasons and their points in the list, and a threshold divider from `/meta`.
  - At risk: every paid school with a renewal ahead, with days to renewal, the renewal date, ARR and the top 3 reasons. Filter: At risk / All.
  - Monday brief: tiles come only from `/stats`; the invented NRR "upside" and the "next 90 days" labels are gone.
- **B, school detail** (`814a258`): the drawer shows usage over time with the school's own breaks shaded, and both windows overlaid with a day-by-day close-up. It also shows Kindling vs naive score history, reasons with points, and signals dated from real history. See `ui-11` for Jan 5: calendar days −83%, school days +14%.
- **C, backtest and secondary screens** (`3a77597`):
  - Backtest: the full PQL and churn tables, including the rows where naive wins, the weekly alert chart, and the experiments panel (district calendars first, then admin rule, sweep and LR). Each table shows its source, timestamp and commit.
  - Prospects, Pipeline and Automations: fixed (key warnings, local dates, newest first).

## Found during the run
- **Corrections only `ui` has.** Health no longer scores schools after renewal, which moves two baselines; Kindling's own numbers don't change:
  - Naive false alarms: **100% → 98%** (57 of 58 healthy schools).
  - District world, one national calendar: **83% → 19%** (11 of 58). The old 83% counted alarms on schools that had already renewed.
  - `main`'s README and LEARN.md still say 83% and 100%. They will be correct once `ui` is merged.
- **n8n:** the weekly workflow no longer sends today's date. Re-import `n8n/kindling_weekly.json`, or Monday's run will get 400s from the new API.
- **Minor API quirks (left as is):**
  - Before a calendar's first school day, the school-day window has `start > end`; the UI treats it as empty.
  - `/history` points carry the top 3 reason texts, not `reason_details`.
  - The Prospects cut (PQL < 20) isn't in `/meta`; the UI keeps it as a constant that never appears on screen.
- **Not exercised:** the "Ready by admin rule" label, because the rule is off. Send buttons were never clicked; the captures blocked every POST.

## Screenshots (`docs/gates/screens/`, 1440 wide; drawers in a 1440×1800 viewport)
| File | Shows |
|---|---|
| `ui-01` | Brief |
| `ui-02` | Ready |
| `ui-03` | Ready drawer |
| `ui-04` | At risk |
| `ui-05` | At-risk drawer |
| `ui-06` | Pipeline |
| `ui-07` | Prospects |
| `ui-08` | Backtest |
| `ui-09` | Automations |
| `ui-10` | Brief on Jan 5 |
| `ui-11` | Healthy school's drawer on Jan 5 |

The `react-*` / `streamlit-*` files are the pre-UI audit's "before" shots.

## Preview `ui` locally
```bash
cd ~/personal-projects/kindling
git switch ui                                   # the working tree is already on ui after this run
python3 -m kindling.simulate                    # rebuild the database (~1 s)
uvicorn kindling.api:app --port 8000            # terminal 1. With your .env, "Send to #…" really posts via n8n
cd frontend && npm install && npm run dev       # terminal 2. npm install adds the playwright dev dependency
open http://localhost:5173                                       # Monday brief at the demo date, Feb 2, 2026
open "http://localhost:5173/?screen=risk&as_of=2026-01-05"       # winter-break story: open any Healthy school
open "http://localhost:5173/?screen=backtest"                    # backtest tables with source and timestamp
cd frontend && npm run screenshots              # optional: regenerate docs/gates/screens/ui-*.png
git switch main                                 # back to main (unchanged)
```

## CONTEXT FOR CLAUDE
```text
Project: Kindling. A PLG scoring engine (PQL + health) for K-12 edtech, aimed at Flint. Python/DuckDB/FastAPI
backend, React 19 + Vite + TS + TanStack Query + recharts frontend, n8n -> Slack. Synthetic data from simulate.py.
Branches: main = 1235173 (frozen during the UI run; pushed). ui = this run (pushed to origin, no PR).
  Lane branches ui-lane-* are merged into ui and kept. Never commit to, merge into, rebase, reset or push main
  unless Dhruv says so. Merging ui into main is Dhruv's call.
Read first: docs/gates/UI-GATE.md (this file), docs/gates/PRE-UI-READINESS.md, docs/UI-RUN.md, RULES.md,
  PROGRESS.md (latest entries), README.md ("Known limits").
Rules that bite:
  - Only kindling/backtest.py and tests read the `truth` table (a test scans api.py, report.py, dashboard/app.py too).
  - No future data (tested in all 3 window modes). Report the numbers the code prints.
  - Thresholds aren't tuned on the full year.
  - Every number on screen comes from the API at runtime. Backtest tables show source, generated_at, commit.
  - One "At risk" definition: health.score status (health < 70, renewal still ahead). Don't add another filter.
Dates: the simulated year is 2025-08-01..2026-07-31. DEMO_AS_OF = 2026-02-02 (config.py). The API returns 400
  outside the year. The UI keeps as_of, screen and school in the URL (?screen=risk&as_of=...&school=s008).
Headline numbers (default world, `make backtest`):
  PQL: 31 flagged, 77% precision, 71% recall, 28-day lead (naive: 93 / 37% / 100% / 56).
  Health: 17/22 churners flagged >=45 days early (77%), 0/58 false alarms (naive: 21/22 = 95%, 57/58 = 98%).
  District world: false alarms 98% naive -> 19% on one national calendar -> 0% on district calendars.
  Health threshold 70 sits on a thin margin: the healthy floor is 72; spring false alarms are 3% at 75.
  Corrections only ui has: main's docs still say 100% / 83%, from before health stopped scoring after renewal.
Results: backtest.py writes results/<run>.md plus .json (the same cells). GET /backtest/results serves the JSON.
  Regenerate on a clean tree so the commit stamp is real:
  python3 -m kindling.backtest pql|health|lr|districts|pql_admin|sweep
  (districts and pql_admin need `make experiments` DBs).
API (kindling/api.py): /meta /pql /health /stats /schools/{id} /schools/{id}/history /schools/{id}/usage
  /calendars/{id} /backtest (weekly counts) /backtest/results, plus slack, prospects, pipeline, outreach, automations.
  POST /notify/slack really sends via n8n when .env has N8N_NOTIFY_WEBHOOK.
Frontend: frontend/src/{api.ts,types.ts (the contract),asOf.tsx (useAsOf/usePql/useHealth/useStats),nav.ts}
  screens/* (Brief, Ready, AtRisk, Backtest, Prospects, Pipeline, Automations)
  components/AccountDetail.tsx + components/detail/* (drawer) + components/backtest/*.
  The drawer's props {type, school, onClose} are relied on by the Ready and AtRisk screens.
Gates: cd frontend && npm run build ; python3 -m pytest -q ; npm run screenshots (needs the API on 8000 and Vite
  on 5173; Playwright uses installed Chrome; aborts POSTs; fails on console errors or failed API calls).
Running from the main tree loads the real .env. For safe runs prefix:
  N8N_NOTIFY_WEBHOOK= SLACK_WEBHOOK_SALES= SLACK_WEBHOOK_CS= ANTHROPIC_API_KEY=
Worktrees: .worktrees/<lane> need an empty .env (load_dotenv walks up), `python3 -m kindling.simulate`, and their
  own node_modules (cp -cR, an APFS clone; don't symlink). The frontend reads VITE_API_URL; CORS allows any
  localhost port.
Open items:
  - re-import n8n kindling_weekly.json;
  - LEARN.md/README on main are stale until ui merges;
  - demo video (TASKS 4.5);
  - API quirk: school-day window start > end before the first school day;
  - expose the prospects cut-off (PQL < 20) in /meta;
  - code-split the 700 kB bundle.
```
