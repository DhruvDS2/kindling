# Kindling

**Kindling tells you which free schools are ready to buy, and which paying schools are about to churn — using product usage data alone.**

Built for K-12 edtech companies running a product-led growth motion, where teachers adopt for free and buying decisions happen at the school or district level.

---

## What it does

Every Monday morning, Kindling:
- Posts the top ready-to-buy schools to your **#sales** Slack channel, with a Claude-drafted outreach email ready to copy-paste
- Posts at-risk renewal accounts to your **#customer-success** channel
- Sends follow-up nudges for any school you reached out to 2 weeks ago with no response

The GTM console (a React web app) gives your team a live view of every school in the funnel — who's ready, who's at risk, and who to target next.

![Architecture](.github/architecture.png)

---

## Why it works

The core idea: **measure activity in school days, not calendar days.**

Schools go quiet every Thanksgiving, winter break, and spring break. A naive churn model fires a false alarm every December. Kindling uses a rolling window of the last 10 *instructional days*, so a quiet winter break doesn't look like churn.

| | Naive model | Kindling |
|---|---|---|
| **PQL precision** (ready schools that actually buy) | 37% | **77%** |
| **Health false alarm rate** (healthy schools flagged as at-risk) | **98%** | **0%** |

Districts don't share breaks either. In a second simulated world where every school follows its own district's calendar (New England's February and April vacations, Texas's early-March spring break, Southern schools ending in May), counting school days on one national calendar still fires on **19%** of healthy schools (11 of 58). Counting them on each district's calendar: **0%**. Details in `results/district_calendar_backtest.md`.

### Experiments (separate runs, never mixed into the headline numbers)

Run all three with `make experiments`.

| Run | Result | File |
|---|---|---|
| District calendars | Health false alarms: 98% naive → 19% national calendar → **0%** district calendars. PQL unchanged (78–79% precision either way). | `results/district_calendar_backtest.md` |
| PQL run 3: lower threshold (40) when an admin has signed up | Catches 2 of the 4 real converters run 2 misses (26/28 vs 24/28); precision 77% → 74%. If admins also sign up at non-buying schools (stress test), precision falls to 63%. **Off by default.** | `results/pql_admin_threshold.md` |
| Threshold sweep, tuned on fall, graded on spring | Health: fall pick is 70, same as config, and it holds on spring. PQL: fall pick is 35, which fails the same precision rule on spring, so 60 stays. A dry run; ready for real data. | `results/threshold_sweep.md` |

---

## What you get

- **React GTM console** at `localhost:5173` with 7 screens:
  - Monday brief — KPI tiles, at-risk watch list, top cold prospects
  - Ready to buy — ranked list with signals, contact info, one-click Slack send
  - At risk — renewal dates, churn signals, one-click CS alert
  - Prospects — top 10 cold leads ranked by priority, multi-channel outreach bar (Slack, Gmail, LinkedIn, Twitter)
  - Pipeline — funnel view from cold → converted
  - Backtest — Kindling vs naive across a full school year
  - Automations — n8n run history

- **FastAPI scoring engine** at `localhost:8000`

- **3 n8n automations** running on schedule in the cloud

---

## Setup

### What you need

- Python 3.10+
- Node 18+
- An [n8n cloud](https://n8n.io) account (free tier works)
- A Slack workspace with two channels: `#sales` and `#customer-success`
- An [Anthropic API key](https://console.anthropic.com) (for AI email drafting)

---

### Step 1 — Clone and install

```bash
git clone https://github.com/DhruvDS2/kindling.git
cd kindling
pip install -r requirements.txt
```

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
N8N_NOTIFY_WEBHOOK=    # paste from Step 5 below
```

The Slack webhook URLs live inside n8n (not in this file) — you'll add them in Step 4.

---

### Step 3 — Generate data and start the backend

```bash
python -m kindling.simulate    # builds the database (~1 second)
uvicorn kindling.api:app --reload --port 8000
```

The API is now running at `http://localhost:8000`. Test it: open `http://localhost:8000/stats` in your browser.

---

### Step 4 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. You should see the Monday brief.

---

### Step 5 — Expose your API to n8n (localtunnel)

n8n runs in the cloud and can't reach `localhost`. This command creates a temporary public URL:

```bash
npm install -g localtunnel
lt --port 8000
# prints: your url is: https://some-words-here.loca.lt
```

Keep this running alongside uvicorn. **Write down the URL — you'll need it in Step 6.**

> The URL changes every time you restart localtunnel. When it does, update the HTTP Request nodes in `kindling_weekly` and `kindling_followup` inside n8n (see Step 6).

---

### Step 6 — Import the n8n workflows

Do this for each of the 3 files in the `n8n/` folder:

1. Go to [your n8n instance](https://app.n8n.cloud) → **New workflow** → **⋯ menu** → **Import from file**
2. Import the JSON file
3. Add your Slack webhook URLs directly into the **"Post to #sales"** and **"Post to #customer-success"** HTTP Request nodes
   - Get webhook URLs from: Slack workspace → Settings → Manage apps → Incoming Webhooks
4. For workflows that call your API (`kindling_weekly` and `kindling_followup`): replace the placeholder URL in the HTTP Request nodes with your localtunnel URL from Step 5
5. For `kindling_weekly` only: add your Anthropic API key as a **Header Auth** credential
   - In n8n: Credentials → New → Header Auth → name it `Header Auth account` → header: `x-api-key` → value: your key
6. Click **Publish** on each workflow

After publishing `kindling_notify`, copy its production webhook URL and paste it into `.env` as `N8N_NOTIFY_WEBHOOK`, then restart uvicorn.

---

### Step 7 — Test it

Trigger the weekly workflow manually to confirm everything works:

1. Open `kindling_weekly` in n8n
2. Click **Execute**
3. Check your #sales Slack channel — you should see the brief with an AI-drafted email at the bottom

---

## Running with real data

This repo ships with synthetic data (200 fake schools, one full school year). To connect real data:

1. Replace `kindling/simulate.py` with a query against your production database
2. Make sure your schools table has: `school_id`, `name`, `city`, `state`, `calendar_id`, `contact_name`, `contact_title`, `contact_email`, `seats`, `renewal_date`, `arr`
3. Load each district's calendar into `school_calendars` (`calendar_id`, `day`, `kind`, `instr_idx`). Districts publish them before the year starts; NCES district IDs make a good `calendar_id`. Schools without one fall back to a regional calendar.
4. Put real outcomes (converted on, churned on) in the `truth` table. Only `backtest.py` reads it.
5. After one semester of outcomes, tune thresholds on fall and check them on spring:
   ```bash
   python -m kindling.backtest sweep --db path/to/real.duckdb
   ```
   Change `PQL_READY_THRESHOLD` / `HEALTH_RISK_THRESHOLD` in `kindling/config.py` only if the spring row holds up, and log it in PROGRESS.md. The business rules the sweep uses (reps can work a list where 6 in 10 buy; CS can absorb 1 false alarm in 20) are assumptions to agree with sales and CS first.
6. Rerun `python -m kindling.backtest pql_admin` to see whether admin signups predict buying in real data. In the simulation that's partly built in.

Everything else — the scoring engine, API, frontend, and automations — stays the same.

---

## API reference

| Method | Endpoint | What it returns |
|---|---|---|
| GET | `/pql?as_of=YYYY-MM-DD` | PQL scores for all free schools |
| GET | `/health?as_of=YYYY-MM-DD` | Health scores for all paying schools |
| GET | `/stats?as_of=YYYY-MM-DD` | KPI summary (counts, ARR, NRR) |
| GET | `/prospects/top10` | Top 10 cold leads by priority score |
| GET | `/outreach/stale?days=14` | Schools contacted N+ days ago with no PQL movement |
| POST | `/notify/slack` | Send a school alert to Slack and log outreach |
| GET | `/pipeline/funnel` | School counts by pipeline stage |
| GET | `/backtest` | Full season backtest results |
| GET | `/automations/log` | n8n run history |

---

## Known limits

- **Synthetic data only.** The simulator is built to stress-test the scorer. Real data will be messier.
- **Calendars are regional in the simulation.** The district world gives every school in a region the same calendar. Real districts set their own, so production keys calendars by district and needs a source for them (district websites, or ask the admin at onboarding).
- **The default world still uses one national calendar.** That keeps the headline numbers stable; the district world is a separate run.
- **School days don't help the PQL score.** Calendar windows score about the same. School days earn their keep on health.
- **The health threshold has a thin margin.** "At risk" means a health score below 70.
  - **History:** it started at 50 and was raised to 70 on Nov 17, 2026, for a UI reason: at 50, no school ever showed as at risk on the dashboard. It was not tuned on results. The backtest wasn't rerun until Nov 23, when recall turned out to have risen from 41% to 77% with false alarms still at 0%.
  - **Check:** the threshold sweep picks a threshold on fall data and checks it on spring. It independently picks 70, and 70 holds on spring (`results/threshold_sweep.md`).
  - **Margin:** the lowest score any healthy school reaches before its renewal is 72, just two points above the line. At 75, spring false alarms already start (3%), and at 80 they reach 17%. Small weight changes could break the 0% false-alarm result, so re-check it on real data before trusting it.
- **Admin signups are clean in the simulator.** Only converter-shaped schools get admins by default, which flatters any admin rule. The admin rule stays off until real data says otherwise.
- **localtunnel URLs change on restart.** When you reboot, update the 4 HTTP Request nodes across the two API-calling workflows in n8n.
- **Stalled schools are unbeatable.** Schools that look like buyers but never buy (budget freeze) are indistinguishable from real buyers. This is the honest precision ceiling — not a bug.
- **outreach_log.json is a flat file.** Fine for testing; in production this would live in a database.
