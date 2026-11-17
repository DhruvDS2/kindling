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

## What's left
- Re-import latest `n8n/kindling_weekly.json` to pick up contact-personalised prompt and Slack block changes (then re-attach Header Auth credential to "Draft email with Claude" node)
- 3.4 Clay webhook node (optional production plug-in)
- 4.2 Static HTML report
- 4.5 Demo video

## Open questions
- Can the PQL catch quiet converters without flooding reps? Try a lower threshold for schools with an admin signup. Must report it as a separate run.
