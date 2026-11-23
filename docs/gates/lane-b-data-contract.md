# Lane B: data contract (pre-UI audit)

Commit 3fc7e2b, default (national-calendar) world, rebuilt with `python -m kindling.simulate`. The API ran on :8101, and every GET route was called with `as_of=2026-02-02` unless noted. No POSTs were sent. Payloads below are real but trimmed.

**Routes in `kindling/api.py` (14):** GET `/pql` `/health` `/stats` `/backtest` `/slack/pql` `/slack/health` `/outreach/stale` `/snapshot/pql/schools` `/pipeline/funnel` `/prospects/top10` `/automations/log`; POST `/notify/slack` `/snapshot/pql` `/log-run`. No route takes a `school_id` path, and none reads `school_calendars`, `events` directly, `teachers`, or `results/`.

## 1. Needs → source → status

| # | View needs | Source today | Status |
|---|---|---|---|
| 1 | PQL score, status, top-3 reasons, free schools ranked | `features.account_features(mode=school_days)` → `pql.score` → **GET /pql** | EXPOSED |
| 2 | Health score, status, top-3 reasons, days to renewal, ARR, seats | `health.score` → **GET /health** | EXPOSED (see gaps 2, 7) |
| 3 | KPI tiles (ready count, at-risk count, ARR at risk, projected NRR) | **GET /stats** | EXPOSED, but the frontend doesn't call it |
| 4 | Contact name, title, email; city, state, district | `schools` → /pql, /health | EXPOSED |
| 5 | School `type`, `students`, `region`, `calendar_id`, `signup_date` | `schools` table (`calendar_id` also in account_features output) | NOT EXPOSED |
| 6 | Absolute `renewal_date`; whether the renewal already happened (renewed, churned, expanded) | `schools.renewal_date`; `events` plan_renewed/plan_churned/plan_expanded | NOT EXPOSED (only `days_to_renewal`) |
| 7 | Score components (aha_teachers, *_prev, tutors_created, admin signup date, school_days_elapsed) | account_features columns | PARTIAL (only active_teachers, student_sessions, and `admin_signed_up` as a bool) |
| 8 | Score history per school, week by week | Computable: account_features over all Mondays takes 0.19 s for 9,600 rows. `pql_snapshots` only fills after a POST | NOT EXPOSED (PQL snapshots are PARTIAL and come back empty) |
| 9 | Raw daily usage per school (active teachers, sessions, tutors) | `events` (+ `teachers.role` filter) | NOT EXPOSED |
| 10 | Calendar + breaks for the school's own calendar | `school_calendars(calendar_id, day, kind, instr_idx)`; `config.CALENDARS` | NOT EXPOSED. /backtest `is_break` uses national `C.BREAKS` only |
| 11 | Window bounds for an as_of (school-day vs calendar-day, current and prior) | Computed inside the features SQL `win` CTE, then dropped | NOT EXPOSED |
| 12 | Backtest weekly at-risk alerts, naive vs Kindling, with breaks | **GET /backtest** `weeks` | EXPOSED (health only) |
| 13 | Headline PQL vs naive metrics | `backtest.evaluate` → `results/pql_backtest.md` | NOT EXPOSED (markdown only) |
| 14 | Headline health vs naive metrics | `backtest.evaluate_health` → `results/health_backtest.md` | PARTIAL: /backtest serves *different* proxy metrics (§3) |
| 15 | Experiments: LR ×2, district calendars, admin rule, threshold sweep | `results/*.md` (+ `report.html`) | NOT EXPOSED (markdown only, no JSON) |
| 16 | Prospects, pipeline, outreach, automations (extra screens) | /prospects/top10, /snapshot/pql/schools, /pipeline/funnel, /outreach/stale, /automations/log | EXPOSED (funnel and snapshot are empty until a POST) |

Example payloads, trimmed:
```jsonc
// GET /pql → 85 scored, 9 Ready
{"as_of":"2026-02-02","scores":[{"school_id":"s149","name":"Quillon Reach Academy","pql_score":90,"status":"Ready",
 "reasons":["5 teachers with heavy student use (156 student sessions)","5 teachers active in the window","An admin signed up"],
 "active_teachers":5,"student_sessions":156,"admin_signed_up":true,"city":"Fresno","state":"CA","district":null,
 "contact_name":"Ashley White","contact_title":"Principal","contact_email":"ashley.white@quillon-reach-academy.edu"}]}
// GET /health → 80 scored, 5 At risk, sorted by score ascending; min days_to_renewal = -18
{"as_of":"2026-02-02","scores":[{"school_id":"s081","name":"Sedgely Crossing Country Day","health_score":34,"status":"At risk",
 "reasons":["Active teachers down 67% vs prior window (3 → 1)","Student sessions down 68% vs prior window (73 → 23)","Renewal in 27 days — in the action window"],
 "days_to_renewal":27,"arr":5600,"active_teachers":1,"seats":14,"city":"Milwaukee","state":"WI","district":null,"contact_name":"…","contact_title":"…","contact_email":"…"}]}
// GET /stats
{"as_of":"2026-02-02","ready_to_buy":9,"at_risk":3,"arr_at_risk":18000,"arr_at_risk_school_count":3,"total_arr":624000,"projected_nrr":0.9712}
// GET /backtest (no as_of; 2.3 s; 52 weeks starting 2025-08-04)
{"weeks":[{"date":"2025-12-29","naive":17,"kindling":3,"is_break":true}],
 "results":[{"metric":"False alarms on healthy schools","naive":541,"kindling":0,"kindling_better":true},
  {"metric":"Alerts fired the week after winter break","naive":78,"kindling":3,"kindling_better":true},
  {"metric":"Median lead time before renewal (days)","naive":-50,"kindling":10,"kindling_better":true}],"takeaway":"The naive model panics…"}
// GET /prospects/top10 → {"top10":[{...PqlScore,"priority_score":100,"signals":[{"label":"Contact on file","pts":40,"detail":"…"}]}],"total_prospects":49}
// GET /automations/log → {"runs":[{"run_at":"2026-11-17","pql_alerts":7,"health_alerts":0,"email_drafts":1,"status":"succeeded"}],"last_run":{…}}
// GET /snapshot/pql/schools → {"as_of":null,"schools":[]}   GET /pipeline/funnel → {"snapshots":[],"latest":null,"prev":null,"moves":[]}
```
These can't be served yet but can be computed today, from a scratch probe: s081 health history `2026-01-05 92 Healthy → 01-19 35 At risk → 02-09 72 Healthy`. Window bounds for as_of 2026-01-05: the school-day window runs 2025-12-09→01-05 (prior window from 11-18), while the calendar window runs 12-23→01-05 (prior window from 12-09).

## 2. Data gaps the UI will hit
1. **Bad default as_of.** `frontend/src/api.ts` sets `DEFAULT_AS_OF` to the browser's today (2026-11-23), which is past `C.END` (2026-07-31). The API scores it anyway: it returns 7 "Ready" schools based on June's last window and `days_to_renewal` as low as **-206**. Every screen uses this default.
2. **Schools past renewal stay in the CS list.** /health still scores schools after their renewal date. On 2026-02-02, 24 rows are past renewal: 17 renewed, **4 already churned**, 3 expanded. `renewal_date` never rolls forward, so "days to renewal" goes negative.
3. **No school detail data.** There is no per-school endpoint, no history, no usage series, no calendar, and no window bounds. That makes view (3) fully blocked.
4. **Backtest headline numbers aren't served.** PQL metrics aren't in the API at all, and the health metrics the API serves don't match backtest.py (§3).
5. **Three definitions of "at risk."** /stats counts At-risk schools with ≥45 days to renewal (3). App, AtRisk and Slack count every At-risk school (5). MondayBrief uses ≤90 days.
6. **Reasons are bare strings.** They have no points or direction. Health sorts them by |points|, so an at-risk school's top 3 can include good news ("Renewal in 88 days", "1 teachers active — stable"; that one is from the Nov-23 call). PQL reasons say "in the window" without giving the window's dates.
7. Admin signup is only a bool, but the DESIGN.md mock needs "Admin signed up 6 days ago." PQL rows have no `seats` or `type`.

## 3. Frontend vs payload mismatches
- `API = 'http://localhost:8000'` is hard-coded. There's no env override, and CORS allows only :5173 and :3000.
- `PqlScore` and `HealthScore` match the payloads field for field, but `status: string` should be a union: `'Ready'|'Not yet'` and `'At risk'|'Healthy'`.
- AtRisk, MondayBrief, Slack and AccountDetail compute the renewal date as `Date.now() + days_to_renewal*86400000`. It should be `as_of + days`, or better, an API `renewal_date`.
- `AccountDetail.tsx` shows a chart placeholder (`TODO: add per-week teacher activity endpoint`). It also pairs each reason with **hard-coded fake dates** `SIGNAL_DATES = ['Jan 26','Jan 5','Dec 1','Aug 18']` (a RULES #4 concern), shows seats as `—` for PQL schools, and infers District vs Independent from `district != null` instead of `schools.type`.
- `Backtest.tsx` labels the API's proxy metrics "Numbers from the real backtest output." That isn't true (§4).
- /stats has no fetcher. The `AutomationRun` type has `id?`, `trigger?` and `cs_alerts?`, which never appear in the payload. The TopProspect, snapshot and funnel types match.

## 4. Backtest metrics: API vs backtest.py
| Metric shown | GET /backtest | backtest.py (`evaluate_health`) | Same? |
|---|---|---|---|
| False alarms | Σ over weeks of schools naive flags *that Kindling calls healthy* (**541** school-weeks). Kindling is **hard-coded 0**. Proxy: Kindling grades itself | distinct schools with no `churns_on` ever flagged: **58 vs 0** | No |
| Median lead time | median `days_to_renewal` over every at-risk school-week, including after renewal: **-50 vs 10** | median (`churns_on` − first flag) for churners flagged ≥45 d early: **114 vs 80** | No |
| Recall on churners | not served | **95% vs 77%** (naive wins) | missing |
| Week after winter break | 78 vs 3 (hard-coded 2026-01-05) | none | API only. A descriptive count, no outcomes needed |
| PQL flagged / precision / recall / lead / top-20 | not served | 93 vs 31 · 37% vs 77% · 100% vs 71% · 56 vs 28 d · 4 vs 8 of 20 (from `results/pql_backtest.md`) | missing |
| Replay range, breaks | Mondays from 2025-08-04 (52); `C.BREAKS` national | Mondays from 2025-09-01 (48); per-school calendars | No |

So the view as it stands shows only the metrics where Kindling wins, and they're computed from proxies, not outcomes. The two where naive wins (recall and lead time) are left out. **Proposal (keeps RULES #1):** backtest.py, the only module allowed to read `truth`, writes `results/<run>.json` next to each `.md`, with the same numbers in a machine-readable form. The API serves those files through `GET /backtest/results` and never opens `truth`. The weekly alert series doesn't need outcomes, so it can stay live (aligned to backtest.py's `mondays()` and per-school calendars) or also go into the JSON. One alternative: `events` holds `plan_converted` and `plan_churned`, which match `truth.converts_on` and `churns_on` by construction (`simulate.py` `_convert`/`paid` writes both). The API could recompute outcomes from those events as CRM-observable facts. Even so, `truth.archetype`, which the admin-rule experiment uses for "real converters" and "stalled flagged", has no event equivalent. Recommended: precomputed JSON.

## 5. Contract the UI should freeze
Keep current names (`pql_score`, `health_score`, `status`, `reasons`, `days_to_renewal`, `arr`, `seats`). All new fields are additive. `as_of` is required by the UI; the server's default should become `C.END`, or the API should return 400 when the date is outside [`C.START`, `C.END`].
```ts
type PqlStatus = 'Ready' | 'Not yet'; type HealthStatus = 'At risk' | 'Healthy';
interface Reason { text: string; points: number }               // reasons stays string[]; add reason_details
interface Window { start: string; end: string; prev_start: string; prev_end: string }
// GET /pql?as_of           EXISTS + fields
interface PqlScore { /* all current fields */ status: PqlStatus; reason_details: Reason[];
  admin_signed_up_on: string | null; aha_teachers: number; active_teachers_prev: number; tutors_created: number;
  type: 'district' | 'independent'; calendar_id: string; seats: number; window: Window }
// GET /health?as_of        EXISTS + fields; default excludes schools whose renewal_date < as_of (or flags them)
interface HealthScore { /* all current fields */ status: HealthStatus; reason_details: Reason[];
  renewal_date: string; renewal_outcome: null | 'renewed' | 'churned' | 'expanded'; // from events ≤ as_of
  alertable: boolean;                                            // At risk && days_to_renewal >= 45 (one rule)
  active_teachers_prev: number; student_sessions: number; student_sessions_prev: number;
  type: 'district' | 'independent'; calendar_id: string; window: Window }
// GET /stats?as_of         EXISTS unchanged (UI must use it for tiles instead of recomputing)
// GET /schools/{id}?as_of  NEW: detail header + both window definitions
interface SchoolDetail { school_id: string; name: string; type: string; plan: 'free' | 'paid'; city: string; state: string;
  district: string | null; calendar_id: string; students: number; seats: number; arr: number; signup_date: string;
  renewal_date: string | null; contact_name: string; contact_title: string; contact_email: string;
  score: PqlScore | HealthScore | null;
  windows: { school_days: Window & { n_school_days: 10 }; calendar: Window & { n_days: 14 } } }
// GET /schools/{id}/history?as_of[&mode=school_days|calendar]   NEW: Mondays ≤ as_of
interface ScorePoint { as_of: string; score: number; status: PqlStatus | HealthStatus; reasons: string[];
  active_teachers: number; student_sessions: number }
// → { school_id, kind: 'pql' | 'health', mode, points: ScorePoint[] }
// GET /schools/{id}/usage?from&to   NEW: daily, ≤ as_of; teacher role only
interface UsageDay { day: string; kind: 'instructional' | 'weekend' | 'break' | 'summer';
  active_teachers: number; student_sessions: number; tutors_created: number }
// GET /calendars/{calendar_id}   NEW: from school_calendars (break = run of kind='break')
interface Calendar { calendar_id: string; first_day: string; last_day: string; breaks: { start: string; end: string }[] }
// GET /backtest            EXISTS, REWORK: keep `weeks` (align to mondays(), per-school breaks); drop/replace `results`
// GET /backtest/results    NEW: served from results/*.json written by backtest.py
interface Metric { key: string; label: string; baseline: number | string; kindling: number | string;
  unit: 'count' | 'pct' | 'days' | 'ratio'; better: 'higher' | 'lower'; kindling_better: boolean }
interface BacktestRun { id: 'pql' | 'health'; baseline_label: string; kindling_label: string;
  replay: { start: string; end: string }; note: string; metrics: Metric[] }
// → { generated_at, commit, pql: BacktestRun, health: BacktestRun,
//     experiments: { id: 'pql_lr' | 'health_lr' | 'district_calendars' | 'pql_admin' | 'threshold_sweep';
//                    title: string; columns: string[]; rows: { label: string; values: (number | string)[] }[]; note: string }[] }
```
Unchanged and outside the four views: /slack/*, /prospects/top10, /snapshot/pql/schools, /pipeline/funnel, /outreach/stale, /automations/log.
