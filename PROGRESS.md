# Progress: Kindling

## Done
- **2026-11-11:** Repo skeleton, requirements, `.gitignore`.
- **2026-11-11:** Planning docs written (PRD, ARCHITECTURE, DESIGN, RULES, TASKS, PROGRESS).
- **2026-11-11:** `config.py` with the 2025–26 school calendar (Thanksgiving, winter, spring breaks, summer).
- **2026-11-11:** `simulate.py` runs in ~1 second: 200 schools, ~1,500 teachers, ~300K events.
  - Free (current mix): 28 converter, 10 stalled, 24 solo_star, 20 builders, 38 dormant. 34 free schools convert: 28 converters plus 6 decoys that bought anyway.
  - Paid: 34 healthy, 12 expander, 22 churner, 12 healthy_break_renewal (renewals right after breaks, built to trip naive churn models).

- **2026-11-11:** Sanity check passed. Avg active teachers per day (first simulator version): 677 on school days, 53 on weekends, 28 on breaks, 11 in summer. Winter break drops weekly activity from ~3,600 to ~200 and it recovers in January, so the seasonal trap is real in the data.

- **2026-11-11:** Phase 1 done: `features.py` (point-in-time, school-day and calendar windows), `pql.py` (rules score + top 3 reasons), `backtest.py pql`, 5 passing integrity tests (no future data, no reading truth, score shape).
- **2026-11-11:** PQL backtest, run 2 (the one to quote), every Monday Sep 2025 to Jul 2026:

  | | Naive: 5+ tutors built | Kindling PQL |
  |---|---|---|
  | Schools flagged | 93 | 30 |
  | Precision (flagged that converted) | 37% | **73%** |
  | Recall (converters caught first) | **100%** (34/34) | 65% (22/34) |
  | Median lead time | 53 days | 30 days |
  | Top 20 on Feb 2 that converted | 4/20 | 6/20 |

  Against the 28 *real* converters only (excluding 6 decoys that bought by chance), Kindling caught 22/28 = 79%. The 6 it missed all had only 2 teachers.

  Read: Kindling sends reps about a third as many schools and twice as many of them buy. The cost is that it misses "quiet" converters with only 2 teachers and light use. The naive rule catches everyone because it flags almost everyone.

- **Honest caveat:** for the PQL, school-day windows don't beat calendar windows yet (same precision and recall; 30 vs 27.5 days lead time). The school-days idea still has to prove itself in the health score.

## What broke
- **2026-11-11:** `rng.choice(...).item()` failed because numpy returned a plain `date` from a list of dates. Fixed by picking with an integer index.

- **2026-11-11:** PQL run 1 scored 100% precision. That was a simulator problem, not a win: every school that looked like a buyer bought. Added realism to the *simulator* (not the scorer): 10 "stalled" schools that behave like converters but never buy (budget freeze), and 25% of converters made "quiet" (2 teachers, lighter use). Scorer weights were not changed between runs.
- **2026-11-11:** `asof` is a reserved word in DuckDB (ASOF joins). Renamed the CTE.

## Decisions
- Dropped the AI cold-email step from scope. The project is scoring + alerts only.
- Clay is a documented production plug-in point, not used on synthetic data (it can't enrich fake schools).
- Windows are measured in school days, not calendar days. This is the core idea the backtest tests.
- **2026-11-23:** Clay stays a manual, documented plug-in point and won't be wired into n8n. The enrichment flow was tested by hand on Nov 17 (it works; synthetic contacts return "No Profile Found"). Wiring it needs Clay's paid plan for API access and adds nothing to the demo.
- **2026-11-23:** Experiments (district calendars, admin rule, threshold sweep) are separate runs with their own results files. The default world and headline numbers stay fixed, so the pitch doesn't move under the UI work.

## Known issues (found by the tutor review)
- `healthy_break_renewal` behaves exactly like `healthy`; only its renewal dates differ, and many healthy schools share those dates. In Phase 2, group false alarms by **renewal date**, not archetype.
- Expansion size isn't modeled (seats and ARR never change), so NRR has no expansion dollars yet.
- PQL weights and `AHA_SESSIONS` live in their modules, not `config.py`, against RULES.md. Move them.
- Variable `third` in `free_converter` holds the second colleague who joined. Rename.

- **2026-11-12:** Phase 2 done: `health.py` (rules score 0–100, 4 signals: teacher trend 40pts, session trend 35pts, renewal urgency 15pts, seat utilisation 10pts). Health backtest result:
  - Naive calendar windows: 55% churn recall, **100% false alarm rate** (fires on every healthy school around winter break)
  - School-day windows: 41% churn recall, **0% false alarm rate**
  - The school-days idea proves itself here. Jan 5 snapshot: 37 false alarms (calendar) vs 3 (school days).

- **2026-11-12:** Phase 3 done: `api.py` (FastAPI, GET /pql, GET /health, GET /slack/pql, GET /slack/health), `n8n/kindling_weekly.json` (schedule → score → IF → Slack #sales + #customer-success).

- **2026-11-12:** Phase 4 mostly done: Streamlit dashboard (4 tiles, PQL table, health table, backtest tab with break-shaded chart), logistic regression comparison (trained fall, tested spring), README.

  LR comparison results:
  - PQL: LR gets 100% recall / 48% precision vs rules 67% recall / 64% precision. Rules more precise.
  - Health: LR catches more churners (55% vs 27%) but 88% false alarm rate vs 0% for rules. LR doesn't understand breaks.

- **2026-11-16:** n8n workflow wired end-to-end and tested live.
  - Slack workspace created (#sales, #customer-success). Both webhooks tested and confirmed working.
  - Anthropic API key added, stored securely as an n8n Header Auth credential (not hardcoded in JSON).
  - Full pipeline ran successfully: score → flag → Claude drafts email → Slack message posts to #sales.
  - Gmail compose button added to #sales Slack message — clicking it opens Gmail with subject and body pre-filled, ready to send with one click.
  - Email prompt redesigned around proven SDR templates: under 90 words, 3rd-grade reading level, one question only, no links/attachments, write like you talk. Outputs `SUBJECT:` / `BODY:` format to avoid JSON parsing issues.
  - Removed the "AI cold-email out of scope" decision — it is now implemented and working.

- **2026-11-16:** Synthetic data upgraded to look realistic; pandas `.name` bug fixed.
  - `simulate.py`: each school now has a real US city + state (tied to region), a district name for district-type schools (e.g. "Philadelphia Public Schools"), a named contact (first + last), a job title (Principal / Curriculum Director / Technology Coordinator / Director of Instruction), and a generated `.edu` email address.
  - `features.py`: SQL SELECT extended to pull `city`, `state`, `district`, `contact_name`, `contact_title`, `contact_email` from the schools table so they flow through the entire pipeline.
  - `api.py`: Fixed a silent bug where `r.name` on a pandas row returns the *index label* (a number like 42) instead of the school name column. Fixed to `r["name"]`. Both `/pql` and `/health` endpoints now return all contact fields.
  - `dashboard/app.py`: School cards now show a second meta line — e.g. `Sarah Johnson · Principal · Fresno, CA`.
  - `n8n/kindling_weekly.json`: Email prompt now passes contact name, title, and location to Claude, and the opening line uses the contact's first name ("Hi Ashley"). Slack blocks show `_Fresno, CA · Ashley White (Principal)_` under each school name.
  - Database regenerated: 200 schools, 1,760 teachers, 347,551 events — all names and contacts look real.

- **2026-11-16/17:** React GTM console built and shipped (`frontend/`).
  - Five screens: Monday brief (KPI cards + last n8n sync), Ready to buy (ranked PQL table + drill-down drawer), At risk (health table + renewal dates), Backtest (interactive bar chart Kindling vs naive), Automations (n8n run history).
  - Stack: React + Vite + TypeScript + TanStack Query v5.
  - Design tokens: paper `#FAF8F5`, ember `#E2572B` (PQL), risk `#B42318` (health), steady `#2F7D5B`.
  - "Send to #cs-alerts" button in the At risk drawer fires a one-off Slack alert for a specific school without waiting for Monday's automation.
  - Sidebar shows live badge counts (ready to buy, at risk). Sync pill shows time since last n8n run.

- **2026-11-17:** n8n email prompt upgraded using learnings from Clay prompting experiments.
  - New rules: open with a specific signal number (not "I noticed"), para 1 never starts with "I", banned words list (noticed, data, metrics, analytics, reaching out, hope this finds you, touching base), under 80 words, first name only, 2 sentences per para max.
  - Output format unchanged: `SUBJECT:` / `BODY:` on two lines.
  - Updated via n8n REST API (PUT `/api/v1/workflows/...`) — no manual re-import needed.

- **2026-11-17:** Clay set up for mock demo enrichment.
  - Workspace created, `kindling_pql_leads.csv` (7 Ready schools) imported as a table.
  - "Personalized Email" AI column built using school signals as structured prompt input. Column chips (not typed `{{variables}}`) required for variable substitution — discovered and fixed.
  - Enrich Person tried on all 7 rows — all returned "No Profile Found" (expected: synthetic contacts don't exist on LinkedIn). Noted as a production limitation, not a bug.
  - Clay free tier has no API/webhook access — operates as a parallel manual tool, not wired into n8n.

- **2026-11-17:** GitHub push protection incident resolved.
  - Slack webhook URLs in `n8n/kindling_weekly.json` triggered GitHub secret scanning on push.
  - Fixed by: redacting URLs to `YOUR_SLACK_WEBHOOK_SALES` / `YOUR_SLACK_WEBHOOK_CS` in the JSON file, using GitHub's allow-secret bypass for the historical commit.
  - `.env` (with real keys) stays gitignored — never committed.

- **2026-11-17:** Slack webhooks regenerated and full end-to-end demo confirmed working.
  - Old webhooks had been auto-revoked by Slack (unrelated to GitHub redaction).
  - New webhooks created from api.slack.com/apps → Incoming Webhooks → Add New Webhook (one for #sales, one for #customer-success).
  - `.env` and n8n both updated with new URLs.
  - Full pipeline confirmed live: n8n fires → Kindling API → Claude Haiku drafts email → Slack #sales receives ranked school list + AI email + Gmail deeplink button. #customer-success correctly skipped (no health alerts).
  - README rewritten with full architecture diagram, results tables, setup instructions, API endpoint table, data model, GTM workflow story, and limits section.

- **2026-11-17 (session 2):** Major UI overhaul + 3 n8n workflows + outreach tracking shipped.

  **Monday Brief rewritten — now fully interactive:**
  - Stat tiles are clickable: Ready to Buy navigates to that screen, At Risk navigates to At Risk, etc.
  - NRR tile now shows real calculation from actual ARR data ($624K total, 4 at-risk schools) with inline breakdown panel (retained ARR, at-risk ARR, projected upside). Previously was a fake hardcoded 104%.
  - Watch list always shows 3 schools — fills with lowest-health schools if fewer than 3 genuinely at risk, flagged `_watch` so CS knows the difference.
  - School rows in the watch list are clickable and navigate to the relevant screen with the drawer auto-opened.
  - Prospects card at bottom of brief shows top 3 cold leads.

  **Prospects screen built (new tab):**
  - Top 10 prioritized cold leads scored on 4 signals: contact on file (40pts), district school (25pts), paying customers in same state (25pts), prior engagement (10pts).
  - Expandable signal breakdown per school. Click a row → OutreachBar appears.
  - OutreachBar: Slack (via n8n → #sales), Gmail compose deeplink, LinkedIn contact search, Twitter/X school search.
  - Cold email draft (Claude-style template) for PQL=0 schools; dormant draft for PQL 1–19.
  - Dormant schools (PQL 1–19) shown in a separate group below Top 10.

  **Health threshold fixed:**
  - `HEALTH_RISK_THRESHOLD` raised from 50 → 70 in `config.py`. Previous threshold meant no school ever scored below it, so watch list showed "Healthy" schools. Now 4 schools (scores 51, 56, 68, 69) genuinely show as At Risk.

  **Channel routing fixed:**
  - `AccountDetail` drawer now routes Ready schools → #sales, everything else → #customer-success. Previously all non-PQL schools were routed to #sales incorrectly.

  **New FastAPI endpoints:**
  - `GET /outreach/stale?days=14` — schools contacted N+ days ago with no PQL improvement (powers follow-up workflow)
  - `GET /prospects/top10` — top 10 cold leads ranked by priority signals
  - `POST /notify/slack` — now also writes to `data/outreach_log.json` after sending
  - `GET /pipeline/funnel`, `GET /snapshot/pql/schools`, `POST /snapshot/pql` — pipeline tracking

  **Pipeline screen built:** Funnel view of all schools by stage (Cold → Dormant → Active → Ready → Converted).

  **3 n8n workflows now live (all Published):**
  - `kindling_weekly.json` ("Kindling notify (manual)", created 14 Nov) — Mon 8am brief. Full chain: GET /pql → Claude drafts email → Slack #sales + #cs. Confirmed working end-to-end with Anthropic API key.
  - `kindling_notify.json` ("Kindling notify (manual)", created 17 Nov) — on-demand webhook. UI sends to this, routes to #sales or #customer-success based on school status.
  - `kindling_followup.json` ("Kindling follow-up reminders") — Mon 9am. Fetches stale leads from API, posts nudge to #sales if any schools contacted 14+ days ago with no PQL movement.

  **Outreach tracking:** `data/outreach_log.json` created. Every Slack send from the UI logs school ID, name, channel, date, and PQL at time of contact.

  **GitHub committed and pushed:**
  - 31 files, 5631 insertions. All new screens, workflows, endpoints, outreach log.
  - GitHub push protection blocked Slack webhook URLs in new JSON files — redacted to placeholders for GitHub, real URLs restored locally.
  - Pre-commit hook added at `.git/hooks/pre-commit` — blocks commits containing live Slack webhook URLs or Anthropic keys going forward.
  - README rewritten: 3 workflows documented, full setup instructions for new contributors, all API endpoints listed.

  **Anthropic API key confirmed:**
  - Stored as "Header Auth account" credential in n8n (created 16 Nov). Never in any file.
  - Confirmed working: weekly workflow ran manually end-to-end, Claude-drafted email appeared in #sales Slack message.

  **Localtunnel URLs updated in n8n** (all 4 HTTP Request nodes that call the local API now point to `https://famous-candles-add.loca.lt`). Will need updating again on next restart.

- **2026-11-23:** Re-baselined every published number against the current code (task 5.0).
  - Found: `results/*.md`, README, `report.py` and the explainer page still quoted numbers from older code. Two changes had moved them and nobody reran the backtests: the Nov 16 simulator update (contacts and cities use extra random draws, so the simulated world shifted; same seed, different schools) and the Nov 17 health threshold change from 50 to 70.
  - Current numbers (what `make backtest` prints today):

    | | Naive | Kindling |
    |---|---|---|
    | PQL schools flagged | 93 | 31 |
    | PQL precision | 37% | **77%** |
    | PQL recall | **100%** (34/34) | 71% (24/34); 24/28 real converters = 86% |
    | PQL median lead time | 56 days | 28 days |
    | Health churners flagged 45+ days early | 21/22 (95%) | 17/22 (77%) |
    | Health false alarm rate | 100% (58/58) | **0%** (0/58) |
    | Jan 5 snapshot | 78 flagged, 57 healthy | 3 flagged, 0 healthy |

  - LR comparison (train fall, test spring): PQL LR 40% precision / 91% recall vs rules 70% / 70%. Health LR 82% recall / 100% false alarms vs rules 59% / 0%.
  - All 7 wrong PQL flags are stalled schools. The 4 real converters missed had 2–3 teachers.
  - Honest note: for the PQL, calendar windows now do slightly *better* than school days (25 vs 24 converters caught, 78% vs 77% precision). School days prove themselves on health only.
  - The health threshold went 50 → 70 for a UI reason (nobody showed at risk on the current date), not by tuning on backtest results. It raised health recall from 41% to 77% with false alarms still at 0%.
  - `report.py` headline tiles now read from `results/*.md` instead of hardcoded numbers, so they can't drift again.
  - Pre-commit hook false positive: it blocked the explainer page because the page *describes* the key prefix the hook looks for. Reworded the page.

- **2026-11-23:** Per-district calendars (task 5.1).
  - `config.py`: `CALENDARS` holds the national calendar plus five regional ones (Northeast starts after Labor Day with February and April vacations; Southeast and Southwest start in early August and end in May; spring breaks range from early March to mid April). `REGION_CALENDAR` maps a school to one.
  - `simulate.py --calendars district` builds `data/kindling_districts.duckdb`: same schools and archetypes, but activity follows each school's own calendar. The default world is unchanged: every table matches the old database row for row, apart from the new `calendar_id` column (verified with `assert_frame_equal`).
  - `features.py`: windows are now counted per school on its own calendar (`school_days`). `school_days_shared` keeps the old one-national-calendar behaviour as a baseline. In the default world, all three modes produce the same features as before (verified).
  - Result (`results/district_calendar_backtest.md`): health false alarms are 100% naive, **83%** on school days with one national calendar, and **0%** on district calendars. The false alarms under the national calendar are spread across all five regions. PQL barely moves (78–79% precision in all three).
  - Bug found by the district world: Northeast schools start Sep 2, so on Sep 1 the scorer measured an empty window, scored 52.5 and flagged all 12 healthy Northeast schools (21% false alarm rate before the fix). Fix: health isn't scored until a school's year has one full window of school days (`HEALTH_MIN_SCHOOL_DAYS = 10`). This is not weight tuning, and the default world is unchanged (every Monday from Sep 1 already had 11 school days).
  - Bug I introduced and fixed in the same task: once every school is filtered out (August, before school starts), `health.score` crashed on the empty frame and `/backtest` returned 500. Both scorers now handle empty input, and there's a test for it. Side effect: the API backtest chart now shows 0 alerts in August instead of scoring schools on empty summer windows.
  - Tests: 12 passing. Added: default world is all on the national calendar; a Northeast window skips April vacation on its own calendar but not on the national one; health isn't scored before a full window; scorers survive a summer date. The no-future-data test now also copies `school_calendars` (calendars are published before the year starts, so they stay whole).
  - Demo use: answers "what about districts with different breaks?" with a number: one national calendar fires on 83% of healthy schools, district calendars on 0%.

- **2026-11-23:** PQL run 3, a lower Ready threshold when an admin has signed up (task 5.2).
  - `pql.score(features, admin_threshold=40)`: a school with an admin is also Ready at score ≥ 40. Off by default. `ready_rule` says which rule fired. The 40 comes from the quiet-converter profile (2 teachers + admin + one heavy-use teacher or growth ≈ 40), not from results.
  - Default world: catches 26/28 real converters vs 24/28 for run 2, and 9/11 small converters (≤3 teachers) vs 7/11. Flags 35 vs 31 schools; precision 74% vs 77% (2 more stalled schools flagged).
  - Caveat: in the simulator only converter-shaped schools ever get an admin, which flatters the rule. Stress test (`simulate.py --admin-noise 0.25`, a separate random stream, so every other event is identical): flags 46, precision **63%**, still 26/28 real converters.
  - Decision: keep run 2 as the default. Real data has to show whether admin signups predict buying. A UI option is a separate "warming" list instead of "Ready".

- **2026-11-23:** Threshold sweep, ready for real data (task 5.3).
  - `backtest.py sweep [--db path]`: sweeps the PQL Ready threshold (30–90) and the health At-risk threshold (40–90). It picks on fall Mondays and grades on spring (RULES.md #3). The business rules are `TUNE_PQL_MIN_PRECISION = 0.60` and `TUNE_HEALTH_MAX_FALSE_ALARM = 0.05` (assumptions for Flint to set).
  - Health: the fall pick is 70, the same as config, and it holds on spring (59% recall, 0% false alarms). It sits right at the edge: 75 already gives 14% spring false alarms.
  - PQL: the fall pick is 35 (65% fall precision), which **fails the same rule on spring** (50%). 60 stays. This is why the sweep grades on held-out data.
  - config.py is not changed by the sweep. On synthetic data it's a dry run; the README's "Running with real data" section now covers the real-data steps.

- **2026-11-23:** Pre-UI readiness audit (task 5.5). Verdict: **READY WITH GAPS** (`docs/gates/PRE-UI-READINESS.md`).
  - Ran as specified in `docs/PRE-UI-AUDIT-RUN.md`: 3 read-only lanes in parallel, one worktree each, at commit 3fc7e2b. Lane reports are in `docs/gates/lane-*.md` and screenshots in `docs/gates/screens/`.
  - Scoring core: all GREEN. Results regenerate byte-for-byte, 12/12 tests pass, and no future-data leak showed up across 3 modes × 2 worlds × 6 dates. The health score and churn backtest are done.
  - Blockers before UI work:
    - The API and frontend default `as_of` to the real date, past the simulated year.
    - `GET /backtest` serves proxy numbers, with Kindling's false alarms hard-coded to 0, under a "real backtest output" label.
    - Schools stay in the CS list after renewal, and "at risk" has three definitions.
    - `npm run build` fails on 5 TypeScript errors.
  - Biggest gap: the school detail view has no data behind it (no history, usage or calendar endpoints), and its drawer shows hard-coded signal dates.
  - Rule breach during the audit: loading the Streamlit dashboard sent 3 anonymous usage-telemetry POSTs to Streamlit's collector (default `gatherUsageStats`). Nothing else left localhost and no Slack messages were sent. Future runs should disable it.
  - The 30-second pitch in LEARN.md is stale: it says 73% (now 77%), "under my 70% goal" (71% now meets it) and "churn side is next" (built).

- **2026-11-23:** UI run (P2) on branch `ui`. Gate: **PASSED** (`docs/gates/UI-GATE.md`). `main` frozen at `1235173` throughout.
  - **Phase 0 (blockers, done in order):**
    - **Date:** the API defaults to the pinned demo date (`DEMO_AS_OF = 2026-02-02`) and returns 400 outside the simulated year. `/meta` gives the UI its dates and thresholds.
    - **Backtest numbers:** `backtest.py` writes `results/*.json` next to each `.md`, stamped with source file, run time and commit. `/backtest/results` serves them, and the proxy `/backtest` metrics are gone.
    - **Lifecycle:** health stops scoring at the renewal date, and `status == "At risk"` is the only at-risk definition.
    - **Build:** `npm run build` is green.
    - **New endpoints:** `/schools/{id}`, `/history`, `/usage`, `/calendars/{id}`. Reasons come with points, and health ranks them by points lost.
  - **Correction found by the lifecycle fix:** the scorer had been raising alarms on schools that had already renewed. Removing them:
    - moves the naive health false alarms from 100% to 98% (57/58);
    - moves the district world's national-calendar result from **83% to 19%** (11/58). District calendars stay at 0%.
    - Kindling's own numbers are unchanged. README, LEARN.md and the explainer page are corrected on `ui`; `main` still has 83% and 100% until `ui` is merged.
  - **Lanes**, 3 in parallel worktrees, each merged into `ui` with no conflicts:
    - A: sales view, CS view, Monday brief.
    - B: school detail drawer, with usage over time, both windows, score history, and reasons with points.
    - C: backtest view from the results files, plus Prospects, Pipeline and Automations fixes.
  - **Tests:** 33, up from 12. The truth-table scan now covers `api.py`, `report.py` and `dashboard/app.py`; the future-data test covers all 3 window modes; and there's a test that flags only count before conversion.
  - **New dependency:** `playwright` (frontend dev only). Reason: the gate needs screenshots of every screen. `npm run screenshots` uses the installed Chrome and fails on console errors or failed API calls.
  - **Streamlit:** a read-only backup now, with no Slack path and no webhook secrets.

- **2026-11-23 → 11-24:** UI upgrade run (`kindling-ui-upgrade`) on branch `ui-upgrade`. **The UI is done.** Gate: **PASSED** (`docs/gates/UI-UPGRADE-GATE.md`). `main` (`1235173`) and `ui` (`19e7830`) were untouched throughout. Paused twice (travel, then overnight) and resumed from `docs/RESUME-PLAN.md` each time.
  - **Goal:** upgrade the existing console so it reads like a carefully designed B2B product (Linear / Attio / Stripe level) and not "vibecoded". Precise, warm, calm, with restrained motion.
  - **Phase 0, audit and picks:**
    - `docs/design/AUDIT.md` found 10 problems: box soup; ember doing five jobs (and failing AA as text); 13 font sizes; 6,500px lists; a Brief that didn't brief; no motion explaining change; the native date input; a lab-report Backtest; no tokens or dark theme; red left-border alerts.
    - References: details.so for motion only, real products for structure. Dhruv picked:
      - **Structure:** 1A grouped sidebar, 2A table, 3B/3A stats, 4A properties + 4C pager, 5A/5B charts.
      - **Motion:** 6A cross-fade, 7A count-through, 8A hover + 8B row actions, 9A first-load fill, 10B week ruler.
      - **Drawer:** the Preymaker drawer.
      - **"Ready":** warm ochre (#80560F light, #E0B25C dark). Ember is the single "act on this" accent.
    - All recorded with Details IDs in DESIGN.md §2–§3.
  - **Phase 1, tokens and base:**
    - `frontend/src/design/`: light plus warm-dark tokens, every text pair AA.
    - `motion` 14 for layout and shared transitions.
    - About 25 base components: shell, table, drawer, week pager and ruler, stats, toasts…
    - A dev-only `/__styleguide`, and `npm run lint:tokens` (no raw hex, px or ms outside `tokens.css`).
  - **Phase 2, 5 parallel lanes:**
    - **A, shell:** week pager and ruler, in-place week stepping, the 6A cross-fade, code-split.
    - **B:** the Brief (narrative, deltas, sparklines) and Ready to buy.
    - **C:** At risk and the school drawer: Preymaker right-side wipe, j/k pager, "Next school →", and the school-days / calendar-days toggle.
    - **D:** an editorial Backtest (headline, four-stat row, bars that grow once, district before/after).
    - **E:** Prospects, Pipeline and Automations on base components.
  - **Phase 3, QA and gate:**
    - Cleanup: deprecated aliases and legacy files removed; dark chart shades fixed; one root toast system.
    - `npm run design:capture` records after-screens (light and dark), 3 videos, long tasks and reduced motion.
    - A perf pass: memoized table rows, viewport-only reorder, deferred week updates, drawer transitions, idle Backtest sections.
  - **Results:**

    | Check | Result |
    |---|---|
    | Build | 0 TypeScript errors |
    | Tests | pytest 33 passed |
    | Token lint | 862 → **0** |
    | Initial JS | 739 kB → **258 KiB** |
    | Long tasks | **0** on every transition in the production build (week step 9 and 85 rows, drawer open, drawer j/k, switch to Backtest) |
    | Reduced motion | Fades only |
    | Banned "vibecoded" tells | All 7 absent |
    | Audit problems | All 10 FIXED, with screenshots |

    Evidence: `docs/design/COMPARE.md` (before / after / reference per screen), `docs/design/after/`, `docs/design/videos/`.
  - **Perf lesson:** the first measurement (dev server, a heavily loaded machine) showed 50–150ms long tasks. In the production build every transition was already under 50ms of CPU. Measure perf on `vite preview`, and use per-task CPU time when the machine is busy.
  - **Repo hygiene:** `docs/design/refs/` (third-party reference frames) is gitignored, because the repo is public. The Details MCP ran out of monthly credits mid-run; every reference was already recorded.
  - **Housekeeping:** `origin/ui-upgrade-p3-perf` still points at an old WIP commit. The lane squashed it locally, and a normal push was rejected; it isn't force-pushed. All its final commits are in `ui-upgrade`.

## What's left
- Dhruv: review `ui-upgrade` (the finished UI) and decide the merge: `ui-upgrade` → `ui` → `main`. Merging also brings `main`'s README and LEARN.md up to date (they still say 83% / 100%).
- **2-minute demo video (TASKS 4.5): next.** The UI is done.
- Re-import `n8n/kindling_weekly.json` into n8n (it no longer sends today's date).
- Tidy the stale `origin/ui-upgrade-p3-perf` branch (force-push or delete, Dhruv's call).
- Non-blocking follow-ups from the gate: small base component APIs, and the unused Tailwind directives in `index.css`.
- On real data: tune thresholds with `backtest.py sweep --db`, source real district calendars, and rerun the admin rule

## How real data would work
Replace `simulate.py` with a live query against Flint's production DB (or read replica). `features.py`, scoring rules, API, frontend, and n8n all stay the same. Main calibration work: tune thresholds on real conversion outcomes (a few weeks of data), add per-district calendars, handle messier real-world usage patterns. The architecture is correct — it just needs real data to dial in the numbers.
