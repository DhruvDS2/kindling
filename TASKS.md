# Tasks: Kindling

One task at a time. Each one ends with something you can run. Update PROGRESS.md after each.

## Phase 0: Foundation
- [x] 0.1 Repo skeleton, requirements, `.gitignore`
- [x] 0.2 Planning docs (PRD, ARCHITECTURE, DESIGN, RULES, TASKS, PROGRESS)
- [x] 0.3 `config.py`: school calendar with breaks, day kinds
- [x] 0.4 `simulate.py`: 200 schools, hidden archetypes, Segment-style events → DuckDB
- [x] 0.5 Sanity check: weekly active teachers chart shows breaks clearly; archetype counts match the mix

## Phase 1: PQL score (target: before Friday's chat)
- [x] 1.1 `features.py`: point-in-time account features over the last 10 school days (and a naive 14-calendar-day version)
- [x] 1.2 `pql.py`: rules score 0–100 with top 3 reasons
- [x] 1.3 Test: features never read events after `as_of`
- [x] 1.4 Test: no engine module reads `truth`
- [x] 1.5 `backtest.py pql`: replay every Monday, record first flag per school, compare to truth
- [x] 1.6 Baseline: naive "any teacher built 5+ tutors" rule, same backtest
- [x] 1.7 Write results to `results/pql_backtest.md`

## Phase 2: Health score
- [x] 2.1 Health features: active-teacher and session trend over school-day windows, days to renewal
- [x] 2.2 `health.py`: score 0–100 with top 3 reasons
- [x] 2.3 Naive baseline: same logic on calendar-day windows
- [x] 2.4 `backtest.py health`: churners flagged 45+ days early, false alarms, naive vs. season-aware
- [x] 2.5 Results to `results/health_backtest.md`

## Phase 3: Alerts and orchestration
- [x] 3.1 `api.py` (FastAPI): `GET /pql?as_of=`, `GET /health?as_of=`
- [x] 3.2 Slack message formatting per DESIGN.md
- [x] 3.3 `n8n/kindling_weekly.json`: schedule → call API → split → IF → Slack (two channels)
- [x] 3.4 Optional: Clay webhook node for flagged accounts (production plug-in point)

## Phase 4: Show it
- [x] 4.1 Streamlit dashboard per DESIGN.md
- [x] 4.2 Static HTML report with the backtest table and chart
- [x] 4.3 Logistic regression vs. rules on the same backtest (honest comparison)
- [x] 4.4 README: problem, diagram, results table, how to run, limits
- [ ] 4.5 2-minute demo video (deferred: after the UI changes)

## Phase 5: Production realism (separate runs; headline numbers don't move)
- [x] 5.0 Re-baseline every published number against the current code
- [x] 5.1 Per-district calendars: `school_calendars` table, `calendar_id` per school, district world (`simulate.py --calendars district`), `backtest.py districts`
- [x] 5.2 PQL run 3: lower Ready threshold when an admin has signed up, plus an admin-noise stress test (`backtest.py pql_admin`). Off by default.
- [x] 5.3 Threshold sweep, tuned on fall and graded on spring, runnable on real data with `--db` (`backtest.py sweep`)
- [x] 5.4 Clay → n8n: decided not to wire it (see PROGRESS.md decisions)
- [x] 5.5 Pre-UI readiness audit (`docs/PRE-UI-AUDIT-RUN.md` → `docs/gates/PRE-UI-READINESS.md`): READY WITH GAPS

## Phase 6: UI changes
- [ ] Answer the 7 questions in `docs/gates/PRE-UI-READINESS.md` §7
- [ ] Fix the 4 blockers in §2: date contract, backtest numbers from backtest.py, one renewal/"at risk" rule, green build
- [ ] Freeze the data contract in §4 (Phase 0 of the UI run)
- [ ] Build the four views against it, plus the §3 items alongside
