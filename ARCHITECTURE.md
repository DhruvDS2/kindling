# Architecture: Kindling

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.12+ | Data work, scikit-learn |
| Event source | Simulator writing Segment-style events | Swappable for Segment/RudderStack later |
| Storage | DuckDB (single file) | Fast rolling-window analytics, zero setup |
| Features | SQL in DuckDB | Readable by any GTM/data person |
| Scoring | Rules (explainable) + logistic regression (comparison) | Reps trust reasons; LR is an honest ML baseline |
| API | FastAPI | n8n calls it over HTTP |
| Orchestration | n8n (self-hosted) | Weekly schedule → score → route alerts |
| Alerts | Slack incoming webhooks | Two channels: sales, customer success |
| Enrichment (optional) | Clay table via webhook | Production plug-in point, not used on synthetic data |
| Dashboard | Streamlit + static HTML report | Fast to build, easy to share |
| Tests | pytest | Leakage and scoring checks |

## Folders

```
kindling/
├── kindling/
│   ├── config.py        # calendar, paths, constants
│   ├── simulate.py      # builds the synthetic school year → DuckDB
│   ├── features.py      # point-in-time SQL features
│   ├── pql.py           # PQL score + reasons (free schools)
│   ├── health.py        # health score + reasons (paid schools)
│   ├── backtest.py      # replays the year, scores, compares to truth
│   ├── api.py           # FastAPI: /pql, /health, /alerts
│   └── report.py        # static HTML results report
├── n8n/
│   └── kindling_weekly.json   # importable n8n workflow
├── dashboard/
│   └── app.py           # Streamlit NRR + accounts view
├── tests/
├── data/                # kindling.duckdb (git-ignored)
├── results/             # backtest tables and report
└── *.md                 # PRD, ARCHITECTURE, DESIGN, RULES, TASKS, PROGRESS
```

## Data model (DuckDB)

| Table | Contents | Engine may read? |
|---|---|---|
| `calendar` | day, kind (instructional/weekend/break/summer), running instructional-day index | Yes |
| `schools` | id, name, type, size, region, plan at start, seats, ARR, renewal date | Yes |
| `teachers` | id, school, role (teacher/admin), joined date | Yes |
| `events` | day, school, teacher, event, n (count) | Yes, **only rows with day ≤ as_of** |
| `truth` | hidden archetype and real outcome per school | **No. Backtest only** |

Event names: `teacher_signed_up`, `admin_signed_up`, `teacher_active`, `tutor_created`, `student_session`, `plan_converted`, `plan_renewed`, `plan_expanded`, `plan_churned`.

## Data flow

```
simulate.py ──► DuckDB (calendar, schools, teachers, events | truth)
                    │
          features.py (as_of date, school-day windows)
                    │
          ┌─────────┴─────────┐
       pql.py              health.py
          └─────────┬─────────┘
                    │
     ┌──────────────┼───────────────────────┐
 backtest.py     api.py ◄── n8n (weekly)   dashboard/app.py
 (vs truth)         │
                    └──► Slack #sales / #customer-success
                    └──► (optional) Clay, HubSpot
```

## Key design rules
- **Point-in-time correctness:** every feature takes an `as_of` date and only reads events on or before it.
- **School-day windows:** "last 10 instructional days," not "last 14 calendar days." The naive calendar version exists only as the baseline to beat.
- **The scorer never sees `truth`.** Only `backtest.py` joins it, and a test enforces this.
