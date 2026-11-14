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
- [ ] 4.5 2-minute demo video
