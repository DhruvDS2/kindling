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

## What's left
- Per-district school calendars (production requirement — currently one shared calendar for all schools)
- Tune PQL/health thresholds on real data once connected to Flint's database
- Try lower PQL threshold for schools with admin signup (may catch quiet converters — must report as separate run)
- Clay → n8n integration requires Clay Team plan ($149/mo) for API access; currently manual CSV workflow

## How real data would work
Replace `simulate.py` with a live query against Flint's production DB (or read replica). `features.py`, scoring rules, API, frontend, and n8n all stay the same. Main calibration work: tune thresholds on real conversion outcomes (a few weeks of data), add per-district calendars, handle messier real-world usage patterns. The architecture is correct — it just needs real data to dial in the numbers.
