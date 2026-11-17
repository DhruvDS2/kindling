# Kindling

A PLG scoring engine for K-12 edtech — flags which free schools are ready to buy and which paying schools are about to churn, from product usage alone. Ships with a React GTM console, a FastAPI backend, and three n8n automations that post to Slack and draft outreach emails with Claude.

## The problem

In a product-led K-12 motion, teachers adopt for free and spread the product inside their school. Across hundreds of schools, two questions are impossible to answer by eye:

1. **Who is ready to buy?** One excited teacher is a user. Several teachers whose students actively use the product is an account ready for a sales conversation.
2. **Who is about to churn?** Usage falls before a renewal — but schools go quiet every winter, spring, and summer break. A naive system fires a false alarm every December.

**The core insight:** measure activity in school days, not calendar days. A rolling window of the last 10 instructional days ignores breaks, so a quiet winter break doesn't look like churn.

## Results

### PQL — free schools ready to buy

| | Naive: 5+ tutors built | Kindling PQL |
|---|---|---|
| Schools flagged | 93 | **30** |
| Precision (flagged that converted) | 37% | **73%** |
| Recall (converters caught first) | 100% | 65% |
| Median lead time | 53 days | 30 days |

Kindling sends reps a third as many schools and twice as many of them buy. The cost: it misses quiet converters with only 2 teachers.

### Health — paying schools at risk of churning

| | Naive: calendar windows | Kindling: school-day windows |
|---|---|---|
| Churners flagged ≥45 days early | 12 / 22 | 9 / 22 |
| Recall | 55% | 41% |
| **False alarm rate** | **100%** | **0%** |

The naive model fires on every single healthy school around winter break. School-day windows cut false alarms to zero — the only result that makes CS alerts trustworthy.

---

## Architecture

```
simulate.py ──► DuckDB (calendar, schools, teachers, events | truth)
                    │
          features.py (as_of date, school-day windows)
                    │
          ┌─────────┴──────────┐
       pql.py              health.py
          └─────────┬──────────┘
                    │
     ┌──────────────┼──────────────────────────┐
 backtest.py     api.py (FastAPI :8000)      frontend/ (React :5173)
 (vs truth)         │
              ┌─────┴──────┐
        localtunnel      Slack (via n8n)
        (exposes :8000)   ├── #sales (ready to buy + AI email)
                          └── #customer-success (at risk)
```

---

## Components

### Scoring engine (`kindling/`)

| File | What it does |
|---|---|
| `simulate.py` | Generates 200 synthetic schools over a 2025–26 school year with realistic archetypes |
| `features.py` | Builds per-school feature vectors using school-day windows (not calendar days) |
| `pql.py` | Rules-based PQL scorer — flags free schools ready to buy |
| `health.py` | Rules-based health scorer — flags paying schools at churn risk |
| `backtest.py` | Replays every Monday Sep 2025–Jun 2026, compares Kindling vs naive baseline |
| `config.py` | Shared constants: window sizes, thresholds, renewal buffer |
| `api.py` | FastAPI server exposing scores, Slack blocks, stats, outreach log, and pipeline data |

### React GTM console (`frontend/`)

Seven screens for sales and CS teams:

| Screen | What it shows |
|---|---|
| **Monday brief** | Clickable KPI tiles (NRR with inline breakdown, ready to buy, at risk, admins) · at-risk watch list · top 3 cold prospects · links directly into other screens |
| **Ready to buy** | Full ranked PQL table with signals, contact info, drill-down drawer, Slack send button |
| **At risk** | Health score table with renewal dates, days remaining, churn signals, CS send button |
| **Pipeline** | Funnel view of all schools by stage (Cold → Dormant → Active → Ready → Converted) |
| **Prospects** | Top 10 prioritised cold leads with signal breakdown + outreach bar (Slack, Gmail, LinkedIn, Twitter). Also shows dormant schools (PQL 1–19). |
| **Backtest** | Interactive bar chart comparing Kindling vs naive across the full season |
| **Automations** | Run history from n8n with status, alert counts, email draft count |

Built with React + Vite + TypeScript + TanStack Query v5. Design tokens: paper `#FAF8F5`, ember `#E2572B` (PQL), risk `#B42318` (health), steady `#2F7D5B`.

### n8n automations (`n8n/`)

Three workflows. All Slack messages are routed exclusively through n8n — no Slack URLs in the app code.

#### `kindling_weekly.json` — Monday 8am brief

```
Every Monday 8am
    └── Build as_of date
         ├── GET /pql ──► Any ready schools?
         │       true ──► Extract top 3 ──► Draft email (Claude Haiku) ──► Post to #sales
         └── GET /slack/health ──► Any at-risk schools?
                 true ──► Post to #customer-success
```

#### `kindling_notify.json` — On-demand account alert

Triggered by webhook when a rep clicks "Send to Slack" in the Kindling UI. Routes to `#sales` for Ready schools, `#customer-success` for At-risk / Not yet schools. Logs the outreach to `data/outreach_log.json` via the API.

#### `kindling_followup.json` — Monday 9am follow-up reminder

```
Every Monday 9am
    └── GET /outreach/stale?days=14
         └── Any non-responders? (contacted 14+ days ago, PQL hasn't moved)
                 true ──► Build reminder message ──► Post to #sales
```

Keeps sales from letting warm leads go cold silently.

### Data (`data/`)

| File | Contents |
|---|---|
| `kindling.duckdb` | Synthetic event database (generated by `simulate.py`) |
| `run_log.json` | n8n automation run history (last 50 runs) |
| `outreach_log.json` | Schools contacted via Slack, with timestamp and PQL at time of contact |

---

## Setup

### Prerequisites

- Python 3.10+
- Node 18+
- npm (for localtunnel: `npm install -g localtunnel`)
- An n8n account (n8n.cloud free tier works)
- A `.env` file (copy `.env.example`)

### 1. Backend

```bash
pip install -r requirements.txt
cp .env.example .env          # fill in N8N_NOTIFY_WEBHOOK (see step 3)

python -m kindling.simulate   # builds data/kindling.duckdb (~1 second)
uvicorn kindling.api:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # starts at http://localhost:5173
```

### 3. Expose the API to n8n (localtunnel)

n8n Cloud can't reach `localhost:8000` directly. Use localtunnel to get a public URL:

```bash
lt --port 8000
# prints something like: your url is: https://famous-candles-add.loca.lt
```

Keep this running alongside uvicorn. The URL changes on each restart — update it in the n8n HTTP Request nodes when it does.

### 4. Import n8n workflows

For each file in `n8n/`:

1. Go to your n8n instance → **New workflow** → **Import from file**
2. Import the JSON
3. Update the localtunnel URL in the HTTP Request node(s):
   - `kindling_weekly.json`: two nodes (`GET /pql` and `GET /slack/health`)
   - `kindling_followup.json`: one node (`GET /outreach/stale`)
   - `kindling_notify.json`: uses a webhook trigger, no localtunnel needed
4. For `kindling_weekly.json`: add your Anthropic API key as a **Header Auth** credential named `Header Auth account` (header: `x-api-key`)
5. Click **Publish**

After publishing `kindling_notify.json`, copy its production webhook URL and add it to your `.env`:

```
N8N_NOTIFY_WEBHOOK=https://your-instance.app.n8n.cloud/webhook/kindling-notify
```

Restart uvicorn for the env var to load.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/pql?as_of=YYYY-MM-DD` | Ranked PQL scores for all free schools |
| `GET` | `/health?as_of=YYYY-MM-DD` | Health scores for all paying schools |
| `GET` | `/stats?as_of=YYYY-MM-DD` | Aggregate KPIs (ready count, at-risk count, ARR, NRR) |
| `GET` | `/slack/pql?as_of=...` | Slack Block Kit payload for top Ready schools |
| `GET` | `/slack/health?as_of=...` | Slack Block Kit payload for At risk schools |
| `GET` | `/backtest` | Season-long backtest results (Kindling vs naive) |
| `POST` | `/notify/slack` | Send a school alert to Slack and log outreach |
| `POST` | `/log-run` | Append an automation run record |
| `GET` | `/automations/log` | Read run history |
| `GET` | `/pipeline/funnel` | School counts by pipeline stage |
| `GET` | `/snapshot/pql/schools` | Schools at a given stage on a given date |
| `POST` | `/snapshot/pql` | Record a stage snapshot for pipeline tracking |
| `GET` | `/prospects/top10` | Top 10 cold leads ranked by priority signals |
| `GET` | `/outreach/stale?days=14` | Schools contacted N+ days ago with no PQL improvement |

---

## Data model

All data is synthetic. 200 schools over a 2025–26 school year. Each school has a hidden archetype that drives its behavior:

**Free schools:** `converter` (spreads, buys), `stalled` (spreads, never buys — budget freeze), `solo_star` (one great teacher, no spread), `builders` (lots of tutors created, students barely use them), `dormant`.

**Paying schools:** `healthy`, `expander`, `churner`, `healthy_break_renewal` (renews right after winter break — the trap for naive churn models).

---

## GTM workflow (what this enables)

```
Monday 8am  — n8n posts top ready-to-buy schools + AI-drafted email to #sales
            — n8n posts at-risk renewal alerts to #customer-success
Monday 9am  — n8n checks for non-responders (14+ days since contact, no PQL movement)
            — posts follow-up nudge to #sales
On demand   — rep opens Kindling, clicks any school, sends Slack alert to right channel
            — Prospects screen shows top 10 cold leads ranked by: contact on file,
              district size, paying customers in same state, prior engagement
```

---

## Limits

- **Synthetic data only.** The simulator plants the exact traps the scorer needs to handle. Real data would be messier.
- **School-day windows help health, barely help PQL.** The calendar vs school-day difference is small for PQL. The health false-alarm story is the proof.
- **Stalled schools are unbeatable.** They look identical to buyers. All wrong PQL flags are stalled schools. This is the honest precision ceiling.
- **One shared calendar.** Real districts have different break schedules. Production would need a per-district calendar.
- **Rules, not ML, for production.** The LR comparison shows rules are more precise for PQL and have zero false alarms for health.
- **localtunnel dependency.** The n8n workflows reach the local FastAPI server via localtunnel. The URL changes on restart — update the HTTP Request nodes in `kindling_weekly` and `kindling_followup` when it does.
- **outreach_log.json is local.** In production this would live in a database, not a flat file.
