# Pre-UI readiness gate

**Run:** `kindling-pre-ui-audit (P1)`, 2026-11-23, audited commit `3fc7e2b`.
**Lanes:** 3 read-only lanes (Opus, high effort), one worktree each.
**Lane reports:**
- [A: scoring core](lane-a-scoring-core.md)
- [B: data contract](lane-b-data-contract.md)
- [C: delivery surface](lane-c-delivery-surface.md)

**Run notes:**
- `docs/ORCHESTRATOR.md` doesn't exist, so the run followed the spec's own worktree layout (`./.worktrees/<lane>`, each with an empty `.env` so no lane could load real secrets).
- Screenshots used Puppeteer-core and headless Chrome. Playwright isn't installed, and installing it needs the network.
- **Rule breach:** loading the Streamlit dashboard sent 3 anonymous usage-telemetry POSTs to `webhooks.fivetran.com`. This is Streamlit's default `gatherUsageStats` setting. Nothing else left localhost: no Slack messages, no API POSTs, no code changes. Future runs should pass `--browser.gatherUsageStats false`.
- The orchestrator spot-checked 9 lane claims against the code and data, and all held. Two counts differ slightly: the lowest healthy score is 72 (lane A said 71), and there are 1,401 post-renewal rows (lane A said 1,392).

## 1. Verdict
**READY WITH GAPS.** The scoring engine is finished and honest:
- The health score and churn backtest are built.
- Every results file regenerates byte-for-byte.
- 36 probes (3 window modes × 2 worlds × 6 dates) found no future-data leaks.

But the API doesn't serve what the school detail and backtest views need. Three data rules (the date, the renewal lifecycle, the meaning of "at risk") must be fixed first, or every screen inherits wrong numbers.

## 2. Required before UI starts (ranked)
| # | Blocker | Why it blocks | Effort |
|---|---|---|---|
| 1 | **Date contract.** The API defaults `as_of` to the real date (2026-11-23), four months after the simulated year ends. The frontend does the same. | Every screen shows a frozen June window: renewals "in -206 days", stale Ready and At-risk lists, an empty Prospects table. | S |
| 2 | **Backtest numbers come from `backtest.py`.** `GET /backtest` hard-codes Kindling's false alarms as `0`. It counts the naive model's "false alarms" against Kindling instead of real outcomes (541 school-weeks), and reports lead times of -50 vs 10 days. The UI labels all this "Numbers from the real backtest output". It leaves out the PQL and the one metric where naive wins (churn recall 95% vs 77%). | The backtest view would contradict `results/` and the pitch (RULES #4). Fix: `backtest.py` writes `results/<run>.json`, and a new `GET /backtest/results` serves those files. The API still never reads `truth` (RULES #1). | M |
| 3 | **One renewal lifecycle and one "at risk" rule.** `/health` keeps scoring schools after their renewal date (on Feb 2: 24 past renewal, 4 of them already churned). "At risk" means three different things: `/stats` requires 45+ days to renewal, the screens take any, and the Monday brief uses ≤90 days. | The CS view and the brief tiles disagree with each other and with `/stats`: 4 vs 0 at risk, $34,800 vs $0 ARR at risk. | S |
| 4 | **Green build.** `npm run build` fails on 5 TypeScript errors: `'prospects'` is missing from the `Screen` type, and `queryFn: fetchTop10Prospects` passes React Query's context object as `as_of`, which also causes the Prospects 400. | The UI run's gates need a passing build. | S |

The health score and churn backtest are **not** blockers. Both are DONE: 17 of 22 churners flagged 45+ days before renewal, 0 of 58 healthy schools flagged.

## 3. Build alongside the UI (stubbed against §4)
- **School detail data (M, the biggest gap):** `/schools/{id}`, `/schools/{id}/history`, `/schools/{id}/usage`, `/calendars/{id}`. None exist yet; the drawer shows "chart coming soon". A full year of weekly history computes in 0.19 s, so no snapshot table is needed.
- **Remove the fabricated signal dates (S):** `AccountDetail.tsx` pairs each reason with dates from a hard-coded `SIGNAL_DATES` array. Use real dates from `/history`, or drop the dates (RULES #4).
- **Reasons with points (S):** add `reason_details`. Rank health reasons by points *lost*, so "Renewal in 63 days" stops outranking "Active teachers down 75%". Scores don't change.
- **Score fields the views show (S):** admin signup date, prior-window counts, `type`, `calendar_id`, `seats`, window dates, `ready_rule`.
- **Weekly backtest series (S):** align it to the backtest's Mondays (starting Sep 1, not Aug 4) and to each school's own breaks.
- **Test gaps (S):** all three anti-cheating guarantees hold today (checked by hand), but tests don't fully enforce them:
  - The truth-table scan skips `api.py`, `report.py` and `dashboard/app.py`.
  - The future-data test covers 1 of the 3 window modes and not the district world.
  - No test checks that a flag only counts before conversion.
- **LEARN.md (S):** the pitch and Q&A date from Nov 11 (14 mismatches). Precision is now 77%, not 73%. Recall is 71%, which *meets* the 70% goal. "The churn side is next" is built.
- **README (S):**
  - It puts the PQL gain under the school-days headline, but that gain comes from the scoring rules.
  - It leaves out what health gives up for its 0% false alarms: recall 95% → 77%, lead 114 → 80 days.
  - It links an architecture image that doesn't exist, leaves `N8N_NOTIFY_WEBHOOK` out of `.env.example` and 5 routes out of the API table, and never mentions Streamlit.
- **TASKS (S):** 3.4 (Clay node) is checked, but no Clay node exists. Mark it "won't do", per the Nov 23 decision.
- **One-command local demo (S):** `make demo` (simulate → API → frontend, with a pinned date). Today it's 4 commands in 2 terminals locally, or about 15 manual steps with n8n, localtunnel, Slack and an Anthropic key.
- **n8n hardening (M, not UI-blocking):**
  - Slack webhooks are pasted inline into n8n nodes.
  - The notify webhook and `/log-run` have no auth but are exposed through the tunnel.
  - The tunnel placeholders are inconsistent; 2 nodes end up as `https://https://`.
  - The workflows score at the real date.
- **Small fixes:**
  - The "1 teachers active" grammar bug reaches Slack.
  - Automations dates shift by a day because of UTC parsing, and the brief treats the oldest run as the latest.
  - Streamlit's tooltip says "health < 50" but the threshold is 70, and its sidebar is unreadable.

## 4. Data contract to freeze (Phase 0 of the UI run)
Full types are in [lane B §5](lane-b-data-contract.md#5-contract-the-ui-should-freeze).

Rules:
- Keep existing names, and make every change additive.
- The UI always sends `as_of`. The API returns 400 for dates outside 2025-08-01 to 2026-07-31.
```ts
type PqlStatus = 'Ready' | 'Not yet';  type HealthStatus = 'At risk' | 'Healthy';
interface Reason { text: string; points: number }
interface Window { start: string; end: string; prev_start: string; prev_end: string }
// GET /pql?as_of             EXISTS + fields
PqlScore    += { status: PqlStatus; reason_details: Reason[]; ready_rule: 'score' | 'admin' | null;
                 admin_signed_up_on: string | null; aha_teachers; active_teachers_prev; tutors_created;
                 type; calendar_id; seats; window: Window }
// GET /health?as_of          EXISTS + fields; leaves out schools past renewal and schools without one full window yet
HealthScore += { status: HealthStatus; reason_details: Reason[]; renewal_date: string;
                 alertable: boolean /* At risk && ≥45 days to renewal: the one rule */;
                 active_teachers_prev; student_sessions_prev; type; calendar_id; window: Window }
// GET /stats?as_of           EXISTS, unchanged; the only source for KPI tiles (counts `alertable`)
// GET /schools/{id}?as_of                NEW  profile + score + windows: { school_days: Window; calendar: Window }
// GET /schools/{id}/history?as_of&mode   NEW  per Monday: { as_of, score, status, reasons, active_teachers, student_sessions }
// GET /schools/{id}/usage?from&to        NEW  per day ≤ as_of: { day, kind, active_teachers, student_sessions, tutors_created }
// GET /calendars/{calendar_id}           NEW  { calendar_id, first_day, last_day, breaks: [{ start, end }] }
// GET /backtest              REWORK  keep `weeks` only (realigned); drop `results`
// GET /backtest/results      NEW  from results/*.json written by backtest.py:
//   { generated_at, commit, pql: Run, health: Run, experiments: [{ id, title, columns, rows, note }] }
//   Run = { baseline_label, kindling_label, replay: { start, end }, metrics: [{ key, label, baseline, kindling, unit, better }] }
```
Unchanged and outside the four views: `/slack/*`, `/prospects/top10`, `/snapshot/pql*`, `/pipeline/funnel`, `/outreach/stale`, `/automations/log`, `/notify/slack`, `/log-run`.

## 5. Current UI and delivery inventory
| Surface | Status | Call | Note |
|---|---|---|---|
| Scoring engine and backtests | DONE | KEEP | Every component GREEN in lane A; 12/12 tests pass |
| API `/pql` `/health` `/stats` `/slack/*` | DONE | KEEP | Date default and lifecycle per §2 |
| API `/backtest` | PARTIAL | REWORK | §2 #2 |
| React console (7 screens) | PARTIAL | REWORK | Build fails; every screen renders, with the bugs above |
| Streamlit dashboard | DONE | Keep as backup | The only UI showing the correct backtest tables. Reads DuckDB directly and posts to Slack itself, a second path that holds secrets |
| n8n weekly / notify / follow-up | DONE / PARTIAL | REWORK | §3 |
| Slack blocks | PARTIAL | REWORK | 🟠 instead of DESIGN's 🟢. The weekly PQL message is rebuilt in an n8n code node instead of using `/slack/pql` |
| Demo path | PARTIAL | REWORK | No one-command demo; video not made |

How the four in-scope views stand today:
- **Sales:** exists, in both React and Streamlit.
- **CS:** exists, but the React version has no days-to-renewal column and keeps past renewals.
- **School detail:** missing; only a placeholder.
- **Backtest:** React shows health only, with the proxy numbers. Streamlit shows the real tables.

Screenshots are in `screens/` at 1440×900. The React ones use the real date, so they show the date bug:
- [brief](screens/react-01-brief.png)
- [ready](screens/react-02-ready.png), [ready drawer](screens/react-03-ready-detail.png)
- [at risk](screens/react-04-at-risk.png), [at-risk drawer showing "in -206 days"](screens/react-05-at-risk-detail.png)
- [pipeline (empty)](screens/react-06-pipeline.png)
- [prospects (Top-10 empty)](screens/react-07-prospects.png)
- [backtest (proxy numbers)](screens/react-08-backtest.png)
- [automations](screens/react-09-automations.png)
- Streamlit, at 2026-02-02: [ready](screens/streamlit-01-ready.png), [at risk](screens/streamlit-02-at-risk.png), [backtest](screens/streamlit-03-backtest.png), [outreach](screens/streamlit-04-outreach.png)

## 6. Pitch check (LEARN.md, "30 seconds")
| Claim | Now |
|---|---|
| Tells sales which free schools are ready to buy | **True.** 77% of flagged schools buy vs 37% for the "5+ tutors built" rule; 28-day median lead |
| Tells CS which paying schools are slipping before renewal | **True**, though the pitch still calls it "next". 17 of 22 churners flagged 45+ days before renewal; 0 of 58 healthy schools flagged |
| Counts school days, so winter break doesn't look like churn | **True for health.** On Jan 5 the naive model flags 57 healthy schools, Kindling 0. District calendars extend this (false alarms 83% on one national calendar → 0%). **Not true for the PQL:** calendar windows do as well there |
| Tested on a simulated year with hidden outcomes | **True.** No leaks found, though tests only partly enforce the three anti-cheating guarantees (§3) |
| The buying score beats a simple baseline on precision | **True:** 77% vs 37% |
| "The churn side is next" | **Stale.** It's built. The 2-minute version is stale too: "73%" is now 77%; "65%, under my 70% goal" is now 71%, goal met; "then n8n, Slack and a dashboard" are all built |
| (Implied by a live demo) the dashboard shows the backtest | **Not yet.** The React backtest view shows proxy numbers that contradict the pitch (§2 #2) |

## 7. Questions for Dhruv (recommended default first)
1. **Which UI do we build on?** Default: the React console. Freeze Streamlit as a dev backup and remove its direct Slack path. React has the screens and the design tokens; Streamlit only wins on the backtest tables, and §2 #2 brings those to React.
2. **What date does the demo show?** Default: pin `2026-02-02`. It's mid-year and after winter break, with 9 schools Ready and 3 at risk with time to act. Add a date picker limited to the school year. `2026-01-05` is the best date for showing the winter-break trap.
3. **Where does n8n run in the demo?** Default: keep n8n cloud, but don't let the demo depend on the tunnel. Run the UI fully locally and show Slack with one live send or a recorded clip. Self-hosting n8n would remove localtunnel but adds Docker.
4. **Do the experiments get UI?** Default: one "Experiments" panel on the backtest view, district calendars first (83% → 0% is the strongest new number). No switcher between simulated worlds.
5. **Should the admin rule appear in the sales view?** Default: no, it stays off. At most, a separate "Warming: admin signed up" list later, never "Ready".
6. **What about the health threshold cliff?** The lowest healthy score is 72 against a threshold of 70; spring false alarms are 0% at 70 and 14% at 75. Default: leave it at 70. Changing it now would mean tuning on the full year (RULES #3). Name the narrow margin if asked.
7. **What about the screens outside the spec** (Prospects, Pipeline, Automations)? Default: keep them, fix the Prospects 400 and the build, and leave them out of the demo script.

**STOP.** No UI work has started.
