# Lane C: delivery surface (pre-UI audit)

Audited at commit 3fc7e2b in `.worktrees/lane-c-delivery-surface`, 2026-11-23. Read-only. I ran the simulator, the API (:8000), Vite dev (:5173) and Streamlit (:8501), and I called only GET endpoints. Screenshots were taken with **Puppeteer-core 24.43 + headless Chrome, standing in for Playwright** (Playwright isn't installed and there's no network to install it). Viewport 1440x900.

**Network caveat:** Streamlit's browser client sent 3 usage-telemetry POSTs to `webhooks.fivetran.com` while I was taking screenshots (Streamlit's default `gatherUsageStats`). Nothing else left localhost. The React UI made no POSTs on load. Future runs should pass `--browser.gatherUsageStats false`.

## 1. Verdict table

| Item | Status | Call | Why |
|---|---|---|---|
| API: `/pql`, `/health` | DONE | KEEP | Correct shape: score, status, 3 reasons, contact, `days_to_renewal`, ARR. But `as_of` defaults to the real date (2026-11-23), which is past the sim year (it ends 2026-07-31). That gives negative renewal days (-206) and stale states. |
| API: `/stats` | DONE | KEEP | 4 tiles per DESIGN. At-risk counts only renewals ≥45d away, but the React brief uses its own `≤90d` rule (includes negatives), so the numbers disagree (0 vs 4 at today's date). |
| API: `/backtest` | PARTIAL | REWORK | Doesn't use `backtest.py` and never grades against truth. Kindling false alarms are **hard-coded `0`**. Naive "false alarms" (541) are naive flags that Kindling calls healthy, which is circular and counts school-weeks. Median lead time is taken over every flag-week (naive **-50**, Kindling 10), so it contradicts `results/health_backtest.md` (114 vs 80; 58 vs 0). No PQL backtest endpoint. Takes 2.3s. |
| API: `/slack/pql`, `/slack/health` | DONE | KEEP | DESIGN-shaped blocks. n8n uses `/slack/health` but not `/slack/pql`. |
| API: `/notify/slack` (POST) | DONE | REWORK | Forwards to the n8n webhook and appends to `data/outreach_log.json` (committed to git). No auth. |
| API: `/outreach/stale`, `/log-run`, `/automations/log` | DONE | REWORK | Flat JSON files, both committed. `stale` scores at the real date. `/log-run` has no auth even though it's exposed through the tunnel. |
| API: `/snapshot/pql` (POST), `/snapshot/pql/schools`, `/pipeline/funnel` | DONE | KEEP | Works, but the funnel is empty until something POSTs a snapshot. That's the n8n weekly run or the Pipeline button. |
| API: `/prospects/top10` | DONE | KEEP | Invented priority score (contact/district/state). Not part of the spec. |
| API: school detail / usage series / calendar | TODO | — | No endpoint for usage over time, school-day vs calendar windows, or breaks. |
| n8n `kindling_weekly` | PARTIAL | REWORK | Mon 8am schedule → `POST /snapshot/pql` + `GET /pql` + `GET /slack/health` → Claude Haiku email (n8n Header Auth credential, which is good) → Slack. Slack webhooks are pasted inline into node URLs (plaintext in the workflow). Tunnel placeholders are inconsistent: `=YOUR_LOCALTUNNEL_URL/...` in 2 nodes, `=https://YOUR_LOCALTUNNEL_URL/...` in 2 (pasting an https URL gives `https://https://`). `as_of` is the real date, so it scores off-sim data. Logs a run only on the sales path. Needs localtunnel. |
| n8n `kindling_notify` | DONE | REWORK | Webhook `POST /kindling-notify` → IF channel → 2 inline Slack webhooks. The webhook is unauthenticated, so anyone with the URL can post to Slack. |
| n8n `kindling_followup` | DONE | KEEP | Mon 9am → `GET /outreach/stale` (tunnel) → IF → #sales. Same inline-webhook pattern. |
| Clay node (TASKS 3.4 checked) | TODO | — | No Clay node in any workflow JSON. `.env.example` has `CLAY_WEBHOOK_URL`, but nothing reads it. |
| Slack formatting vs DESIGN.md | PARTIAL | REWORK | Layout matches. Differences: PQL uses 🟠, not DESIGN's 🟢. The weekly PQL message is rebuilt in an n8n code node (it adds location/contact and a Gmail button with no `to=`) instead of `/slack/pql`. Health reasons say "1 teachers active — stable" (grammar). DESIGN's "Not explained by a school break" reason doesn't exist. |
| React app: build | PARTIAL | REWORK | `npm run build` **fails** with 5 TS errors: `MondayBrief` `Screen` type lacks `'prospects'`, and `Prospects.tsx` has `queryFn: fetchTop10Prospects`. `vite build` alone succeeds (693 kB chunk). `npm run dev` works. |
| React: Monday brief | PARTIAL | REWORK | Renders, but numbers use the real date. 4 "at risk" are past renewals; ARR at risk $34,800 and NRR 94% disagree with `/stats` ($0, 100%). NRR "with upside" is invented. |
| React: Ready to buy (+drawer) | PARTIAL | REWORK | List is good. Drawer: "Weekly activity chart coming soon" placeholder. "Signals" dates are a hard-coded array (`Jan 26, Jan 5, Dec 1`). Shows "— seats". |
| React: At risk (+drawer) | PARTIAL | REWORK | Has no `days to renewal` column (only "Renews May 1"). The drawer shows "in -206 days". Same placeholder and fake signal dates. |
| React: Prospects | PARTIAL | REWORK | The Top-10 table is **empty**. The react-query context gets passed as `as_of` → `GET /prospects/top10?as_of=[object Object]` → 400 (twice). Duplicate React `key` warning in `SchoolGroup`. |
| React: Pipeline | PARTIAL | KEEP | Empty state ("No snapshots yet") until someone clicks the POST button, which I didn't click. |
| React: Backtest | PARTIAL | REWORK | Health only: weekly bars naive vs Kindling, breaks shaded (summer not shaded). The table shows the bad `/backtest` numbers under the label "Numbers from the real backtest output." Subtitle says "Sep 2025 to Jun 2026", but the chart runs Aug–Jul. No PQL vs baseline. In headless Chrome the bars paint only after a mouse move; confirm in a real browser. |
| React: Automations | PARTIAL | KEEP | Shows the committed `run_log.json`. Dates are parsed as UTC, so 2026-11-16 shows as "Sun, Nov 15, 6:00 PM". Rows are unsorted (a 2025-11-01 run sits mid-list). The brief uses `automations[0]` (oldest) as "last run", while the header uses the last element. |
| React: `Slack.tsx` | TODO | REPLACE | Dead screen, not routed. |
| Streamlit `dashboard/app.py` | DONE | REPLACE (or keep as backup) | Closest to DESIGN: 4 tiles, ranked lists, a date picker clamped to the sim year (default 2026-02-02, which gives sane numbers), a backtest tab that embeds the truth-graded `results/*.md` plus a breaks-shaded chart. It reads DuckDB directly, not the API. Bugs: the "health < 50" tooltip contradicts threshold 70; sidebar date and link buttons are near-invisible (light on light); deprecation warnings for `use_container_width`; it posts to Slack directly with `SLACK_WEBHOOK_*`, a second secret path. |
| README | PARTIAL | REWORK | The architecture image `.github/architecture.png` doesn't exist. Step 2 says to fill `N8N_NOTIFY_WEBHOOK`, but `.env.example` doesn't contain it (it lists unused keys instead). The API table omits 5 routes. "Update the 4 HTTP nodes" is actually 5. "3 n8n automations running on schedule in the cloud" can't be verified from the repo. The Streamlit dashboard isn't mentioned. Steps 3–4 work as written. |
| Demo path | PARTIAL | REWORK | No one-command demo (see §3). |

## 2. Coverage of the 4 in-scope views

| Spec view | What exists | What's missing |
|---|---|---|
| Sales: free schools by PQL + top 3 reasons | React Ready to buy (all 86 free schools, sorted, 3 reasons in the drawer, top reason on the brief). Streamlit Ready tab. | A sane `as_of` (pin to a sim date or add a picker; Streamlit has one). Top 3 reasons are inline only in Streamlit. |
| CS: paid schools by health + top 3 reasons + days to renewal | React At risk (filtered to At risk only, renewal date and ARR, reasons in the drawer). Streamlit At risk tab ("Renews in 88d"). | No days-to-renewal column in React. Past-renewal and churned schools are not excluded. The ≥45d rule isn't applied the same way across brief, `/stats` and the list. No view of all paid schools. |
| School detail: usage over time, school-day vs calendar windows, breaks shaded | React drawer: score chip, 3 reasons, a **placeholder** chart box, fake signal dates. Streamlit: nothing. | Everything substantive: a usage-series endpoint, a window overlay, break shading, and real signal dates. This is the biggest gap. |
| Backtest: PQL vs naive; churn vs baseline | React: health only, wrong metrics (see §1). Streamlit: both tables rendered from `results/pql_backtest.md` and `health_backtest.md` (correct, truth-graded), plus a flags-per-Monday chart with breaks shaded. | A structured backtest payload (Lane B) built from `backtest.py`, not the ad-hoc `/backtest`. A PQL panel in React. |

## 3. One-command demo

There's **no one-command demo.** No `make demo`, and the Makefile has no frontend target. Minimum local demo: `python -m kindling.simulate` → `uvicorn kindling.api:app --port 8000` → `cd frontend && npm install && npm run dev`. That's 4 commands across 2 long-running terminals, with no external dependencies. But it defaults to the real date, so the data is past the sim year: 0 at-risk in `/stats`, negative renewal days, the Prospects Top 10 empty, and the Pipeline empty.

Full README path (Slack and n8n working): 7 README steps, about 15 manual actions. That covers clone, pip, `.env`, simulate, uvicorn, npm, global `lt` install and run, importing 3 workflows, hand-editing 5 tunnel URLs and 5 Slack-webhook URL fields, an Anthropic credential, publishing, copying the notify URL into `.env`, restarting uvicorn, and executing.

External dependencies: **n8n cloud, localtunnel (URL changes every restart), a Slack workspace with 2 incoming webhooks, an Anthropic key.** Each tunnel restart means re-editing the nodes. The demo is fragile and can't run offline.

## 4. LEARN.md (status as of Nov 11) vs. today

| LEARN says | Reality now |
|---|---|
| API PLANNED | **Built.** 15 routes in `kindling/api.py`. Bugs as above. |
| n8n PLANNED | **Built.** 3 workflow JSONs. Not runnable without the cloud account and tunnel. The Clay node is missing, even though TASKS 3.4 is checked. |
| Slack PLANNED | **Built.** API blocks plus n8n code-node blocks. Partial DESIGN match. Never verified against real Slack in this audit (by rule). |
| Dashboard PLANNED | **Built twice.** Streamlit (the DESIGN target) and the React console (7 screens, which `npm run build` fails on). |
| README PLANNED | **Built.** Partially accurate (missing image, env-var mismatch, omissions). |
| Demo video PLANNED | **Not done.** TASKS 4.5 is unchecked, "deferred: after the UI changes". No video in the repo. |
| (PQL numbers 30 / 73% / 65% / 30d) | `results/pql_backtest.md` now says 31 / 77% / 71% / 28d (re-baselined in ad4614a). LEARN.md is stale. Lane A owns this. |

## 5. UI bugs seen

1. Prospects Top-10 empty: `as_of=[object Object]` → two 400s.
2. Every React screen scores at the browser's real date (2026-11-23), past the sim year. The header says "Week of Nov 23, 2026". At-risk rows include renewals 145–206 days in the past.
3. React brief and `/stats` disagree: 4 vs 0 at risk, $34,800 vs $0 ARR at risk, NRR 94% vs 100%.
4. The Backtest table shows a hard-coded Kindling `0` and naive lead time `-50`, labelled "real backtest output". The Streamlit backtest tab shows different (correct) numbers.
5. Drawer: chart placeholder, fabricated signal dates, "in -206 days", "— seats" for PQL schools.
6. Automations and sync pill: UTC date parsing shifts days. The "167h ago" sync label comes from committed sample logs. The brief picks the oldest run as "last".
7. Grammar: "1 teachers active — stable" (from `health.py`, so it reaches Slack too).
8. React key warning in `Prospects`/`SchoolGroup`. Bundle is 693 kB, unsplit.
9. Streamlit: the sidebar date input and link buttons are unreadable on the dark sidebar. The embedded results markdown renders as giant H1s. The "health < 50" help text is wrong (the threshold is 70).

## 6. Screenshots (`docs/gates/screens/`)

- `react-01-brief.png`: Monday brief. Tiles show 7 / 4 / $34,800 / 94% at the real date, with stale at-risk rows.
- `react-02-ready.png`: Ready to buy, all 86 free schools, 7 Ready.
- `react-03-ready-detail.png`: school drawer with "chart coming soon" and hard-coded signal dates.
- `react-04-at-risk.png`: At risk, 4 rows with past renewal dates.
- `react-05-at-risk-detail.png`: health drawer showing "Renews May 1 · in -206 days".
- `react-06-pipeline.png`: Pipeline empty state (no snapshots).
- `react-07-prospects.png`: Prospects with an empty Top-10 table (400), cold and dormant lists below.
- `react-08-backtest.png`: health alerts per week, naive vs Kindling, breaks shaded; results table with the hard-coded numbers. Captured after a hover (bars didn't paint before).
- `react-09-automations.png`: run log with UTC-shifted dates.
- `streamlit-01-ready.png`: Streamlit tiles 9 / 3 / $18,000 / 97% at 2026-02-02, Ready list.
- `streamlit-02-at-risk.png`: Streamlit At risk with days to renewal and reasons.
- `streamlit-03-backtest.png`: Streamlit PQL and health results tables from `results/*.md` (viewport-limited; the chart is below the fold).
- `streamlit-04-outreach.png`: Outreach tab with the "webhooks not configured" warning and Notify buttons (not clicked).
