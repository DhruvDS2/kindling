# Learn Kindling

A tutor guide for explaining Kindling end to end. Read it once, then do "Check yourself" in writing before you open the answers.

Status as of 2026-11-23. Every number here comes from a fresh run that day (`make backtest`, `make experiments`). If the code changes, rerun them and check `results/` before quoting anything.

---

## The project in 3 sentences

Kindling watches how schools use a free-to-start K-12 product and tells the sales team which free schools are ready to buy, and tells customer success which paying schools are about to leave, each with the top 3 reasons. It measures activity in school days instead of calendar days, so a quiet winter break doesn't look like a school quitting. It proves itself by replaying a fake school year where the true outcomes are known but hidden from the scorer.

---

## The story

Picture a company like Flint. A teacher finds the product, signs up for free, and uses it with her class. She tells the teacher next door. Soon five teachers at the school use it. Then an administrator signs up to see what's going on. At some point the school pays.

Now multiply that by hundreds of schools. The sales team can't watch them all. They need someone to say "call these 10 schools this week, and here's why."

The paying side has the opposite problem. A school paid for a year. If its teachers quietly stop using the product, the school probably won't renew. Customer success needs to know early, while there is still time to help. Kindling aims for 45+ days before the renewal date.

There is a catch that makes schools harder than normal software customers. Schools shut down on a schedule. Thanksgiving, winter break, spring break, summer. Usage drops to almost nothing, then comes back. A simple system sees the drop and screams "this school is leaving!" every December. Reps learn to ignore the alerts. Then the alerts are useless.

Kindling's answer: only count days when school is actually in session.

---

## How it works, step by step

### 1. Simulator (`simulate.py`, `config.py`)

- **What it does:** Builds a fake school year (Aug 1, 2025 to Jul 31, 2026) of 200 schools: 120 free, 80 paid. Each school gets a hidden "type" (archetype) that decides how it behaves. Writes everything to one DuckDB file.
- **Why it exists:** Real usage data with known outcomes isn't available, and you can't use a real company's customers. A simulator also lets you plant traps on purpose.
- **GTM concept:** Product event data, the kind a CDP like Segment collects. Event names: `teacher_signed_up`, `admin_signed_up`, `teacher_active`, `tutor_created`, `student_session`, `plan_converted`, `plan_renewed`, `plan_expanded`, `plan_churned`.
- **Status:** BUILT.

### 2. Features (`features.py`)

- **What it does:** For any "as of" date, turns raw events into a few numbers per school: active teachers, student sessions, tutors created, "aha" teachers (a teacher whose students had 20+ sessions in the window), whether an admin signed up, and the same counts for the previous window.
- **Why it exists:** Scores need simple, comparable numbers, not millions of rows.
- **GTM concept:** Usage signals, point-in-time features. It has three modes:
  - the last 10 school days on the school's own calendar (the real approach);
  - the last 10 school days on one national calendar (the old approach, kept as a baseline);
  - the last 14 calendar days (the naive baseline).
- **Status:** BUILT.

### 3. PQL score (`pql.py`)

- **What it does:** Scores each free, not-yet-converted school from 0 to 100. Points for breadth (active teachers, max 30), depth (aha teachers, max 35), an admin signing up (15), and spreading (more active teachers than last window, 10). Minus 10 if lots of tutors were built but students barely used them. 60 or higher means "Ready." It returns the top 3 reasons with the number.
- **Why it exists:** Sales wants a ranked call list with reasons they can say out loud.
- **GTM concept:** PQL (product-qualified lead), scored at the account level, not the user level. The weights were set by reasoning, not tuned on results (stated in the code).
- **Status:** BUILT. An opt-in "admin rule" (Ready at 40 if an admin has signed up) was tested as a separate run and stays off (see Experiments).

### 4. Health score (`health.py`)

- **What it does:** Scores each paying school from 0 to 100 and returns the top 3 reasons. Below 70 means "At risk." The points:
  - active-teacher trend vs the previous window: 40;
  - student-session trend: 35;
  - renewal urgency: 15, draining away inside the 45 days before renewal;
  - share of licensed seats in use: 10.

  A school isn't scored until its year has produced one full window of 10 school days, because before that there's no trend to measure.
- **Why it exists:** Customer success needs to know who to help before renewal.
- **GTM concept:** Customer health score, churn prediction, retention. Feeds NRR.
- **Status:** BUILT.

### 5. Backtest (`backtest.py`)

- **What it does:** Pretends it is every Monday from Sep 1, 2025 to Jul 31, 2026. On each Monday it scores using only data up to that day. It records the first Monday each school hits "Ready." Then, and only then, it checks the hidden truth: did that school convert after the flag?
- **Why it exists:** It's the proof. Without it, a score is just an opinion.
- **GTM concept:** Backtesting, precision, recall, lead time, beating a baseline.
- **Status:** BUILT for both scores. Results are in `results/pql_backtest.md` and `results/health_backtest.md`.

The PQL results:

| | Naive: 5+ tutors built | Kindling PQL |
|---|---|---|
| Schools flagged | 93 | 31 |
| Flagged that converted | 34 | 24 |
| Precision | 37% | 77% |
| Recall | 100% (34/34) | 71% (24/34) |
| Median lead time | 56 days | 28 days |
| Top 20 on Feb 2, 2026 that later converted | 4/20 | 8/20 |

How to read it:

- The naive rule catches everyone because it flags almost everyone. 59 of its 93 flags are wrong, so reps would waste most of their calls.
- Kindling is right about 3 times in 4, beating the 60% precision target.
- Kindling just meets the 70% recall target (71%). Counting only the 28 real converters, and leaving out the 6 decoys that bought by chance, it catches 24 (86%).
- A 28-day lead time beats the 14-day target.

What I found digging in (my own queries, not in the results file):

- All 7 wrong Kindling flags are "stalled" schools, which are built to look exactly like buyers but never buy. No flags went to solo stars, builders, or dormant schools.
- The 10 misses: 4 real converters that only ever had 2 or 3 teachers, plus 6 decoys that bought anyway (4 solo stars, 2 builders).
- For the PQL score, school-day windows don't help. A calendar-day version does slightly better: 78% precision, 74% recall, 29 days lead. Don't claim school days help the buying score. They prove themselves on churn.

The health results:

| | Naive: calendar windows | Kindling: school-day windows |
|---|---|---|
| Churners flagged 45+ days before renewal | 21/22 (95%) | 17/22 (77%) |
| Median lead time on those churners | 114 days | 80 days |
| Healthy schools ever flagged at risk (false alarms) | 57/58 (98%) | **0/58 (0%)** |

How to read it:

- The naive model catches more churners because it flags nearly every school at some point (57 of the 58 healthy ones), mostly around breaks. On Monday Jan 5, the first day back from winter break, it flags 78 schools, 57 of them healthy. Kindling flags 3, none of them healthy. CS would learn to ignore the naive alerts within a month.
- The honest cost of school days is a few churners caught later or missed (77% vs 95%), and a shorter lead time (80 vs 114 days). Say so.
- **The threshold has a history.** It started at 50. On Nov 17 it was raised to 70 because at 50 no school showed as at risk in the dashboard. That was a UI reason, not tuning on results. Health recall went from 41% to 77%, with false alarms still at 0.
  - A later threshold sweep picked 70 on fall data, independently, and it held up on spring.
- **The margin is thin.** The lowest score any healthy school reaches before its renewal is 72, two points above the line. At 75, spring false alarms already start (3%), and at 80 they reach 17%.

A logistic regression was trained on fall and tested on spring with the same features, as an honest comparison:
- PQL: it gets more recall (91% vs 70%) but much lower precision (40% vs 70%).
- Health: it catches more churners (82% vs 59%) but flags every healthy school (100% false alarms vs 0%). It doesn't know what a break is.

### 6. Experiments (separate runs; they never change the numbers above)

- **District calendars:** see the section below. One national calendar false-alarms on 19% of healthy schools (11 of 58) in a world where districts break on different weeks. District calendars: 0%.
- **Admin rule (PQL run 3):** Ready at 40 if an admin has signed up, aimed at the quiet converters.
  - Default world: it catches 26 of 28 real converters instead of 24, and precision dips from 77% to 74%.
  - Stress test where admins also sign up at schools that never buy: precision falls to 63%.
  - It stays off. Real data has to show that admin signups predict buying.
- **Threshold sweep:** picks thresholds on fall and checks them on spring, so a pick is never graded on the data it came from.
  - Health: it picks 70, which holds on spring.
  - PQL: the fall pick is 35, which fails the same precision rule on spring, so 60 stays.
  - On real data it runs with `python -m kindling.backtest sweep --db <path>`.

### 7. Alerts and n8n (`api.py`, `n8n/*.json`)

- **What it does:** A FastAPI app returns PQL and health scores for a date. Three n8n workflows:
  - Weekly, Monday 8am: score, have Claude draft a first email from the computed reasons, post to Slack #sales and #customer-success.
  - On demand: the UI sends one school to the right channel.
  - Follow-up, Monday 9am: nudges #sales about schools contacted 14+ days ago with no movement.
- **Why it exists:** A score nobody sees is worthless. Alerts put it where reps already work.
- **GTM concept:** Routing, orchestration, enrichment.
- **Status:** BUILT. Clay enrichment was tested by hand and deliberately not wired in: it needs a paid plan and adds nothing to the demo.

### 8. Dashboard (`frontend/`, `dashboard/app.py`)

- **What it does:** A React console with a Monday brief, Ready to buy, At risk, Prospects, Pipeline, Backtest and Automations. The original Streamlit page (four tiles, two ranked tables, a backtest tab with breaks shaded) is kept as a backup.
- **Why it exists:** Gives the GTM lead a "is this working?" view.
- **GTM concept:** NRR, ARR at risk, pipeline reporting.
- **Status:** BUILT. A Nov 23 audit found the React screens need fixes before the demo: they scored "today" instead of a date in the simulated year, and the backtest screen showed made-up numbers. That work happens on the `ui` branch.

---

## The simulator up close

Every school gets a secret archetype. The scorer never sees it. The backtest uses it to grade the scorer.

### Free schools (120)

| Archetype | Count | What it does in the sim | Real world |
|---|---|---|---|
| converter | 28 | One champion teacher, then 2 to 5 colleagues join over the next 2 to 10 weeks with real student use. 80% get an admin signup. All 28 buy. A quarter are "quiet": only 1 colleague, lighter use. | The classic bottom-up land: a champion spreads it, leadership notices, the school buys. |
| stalled | 10 | Exactly like a converter, but never buys. | Budget freeze, new principal. Nothing in usage can predict this. |
| solo_star | 24 | One very heavy user (more sessions than a converter's champion). Half get a second teacher who fades fast. 10% buy anyway. | The superfan teacher whose colleagues never follow. |
| builders | 20 | 3 to 6 teachers who build lots of tutors, but students barely use them. 5% buy anyway. | Teachers exploring at a PD day. Lots of clicks, no classroom adoption. |
| dormant | 38 | 1 or 2 teachers who try it and fade within days. | Signed up, poked around, left. The bulk of any free funnel. |

In this run, 34 free schools convert: all 28 converters, 4 solo stars, and 2 builders.

### Paid schools (80)

All paid schools start Aug 1 with 6 to 30 seats at an illustrative $400 per seat per year. Renewals fall between Jan 15 and Jul 1, 2026.

| Archetype | Count | What it does in the sim | Real world |
|---|---|---|---|
| healthy | 34 | 60 to 90% of seats active all year. Renews. | A happy customer. |
| expander | 12 | Starts at 60% of seats active, then new teachers keep joining until near renewal. Expands. | Growing adoption. Upsell opportunity. |
| churner | 22 | 70 to 140 days before renewal, most teachers stop over a 30 to 60 day stretch. A few stay. Churns at renewal. | The quiet fade before a non-renewal. |
| healthy_break_renewal | 12 | Behaves like healthy, but renews Jan 15, Feb 1, or Apr 1, right after a break. | A fine customer whose renewal sits right after a holiday. |

### Why the decoys exist

A decoy is a school that looks like one thing to a lazy rule but is really another. Without decoys, any score looks good, because the only active schools would be buyers.

- **solo_star tests "account, not user."** If you score your most active user, the solo star wins. But one teacher is a user, not a school ready to buy. Kindling caps the breadth points and rewards several teachers, so a solo star can't reach 60. In the backtest, its best score was 37.
- **builders tests "real use, not clicks."** Building tutors feels like engagement. The naive baseline ("any teacher built 5+ tutors") falls for it and flagged all 20. Kindling rewards student sessions and subtracts points when tutors pile up unused. Best builder score: 40.
- **healthy_break_renewal tests "a break is not a churn."** Right before a Jan 15 or Feb 1 renewal, the recent past is winter break or Thanksgiving. A calendar-day health score sees usage collapse and raises a false alarm on a perfectly happy school. This is the trap the school-days idea is built to avoid. Tested: calendar windows flag all 12 of these schools at some point; school-day windows flag none.
- **stalled is a different kind of decoy.** It's not there to be beaten. It's the honest floor: some schools look perfect and still don't buy. It keeps precision from looking too good to be true.

### The school calendar

From `config.py`:

- First day of school Aug 18, 2025. Last day Jun 5, 2026. Before and after is summer.
- Thanksgiving: Nov 24 to Nov 28, 2025.
- Winter break: Dec 20, 2025 to Jan 4, 2026.
- Spring break: Mar 14 to Mar 22, 2026.

That gives 190 school days, 72 weekend days, 30 break days, and 73 summer days.

Teachers are much less likely to show up off school days: 8% as likely on weekends, 4% on breaks, 2% in summer. In the current run, the average number of active teachers per day is 765 on school days, 62 on weekends, 33 on breaks, and 13 in summer. Weekly active teacher-days fall from about 4,100 in mid-December to about 240 over winter break, then come back to about 4,270 the week of Jan 5.

That's the one national calendar every school follows in the default world. A second simulated world gives each district its own calendar (see "District calendars" below).

---

## The one big idea: school days, not calendar days

A "window" is the stretch of recent time you look at. "Usage in the last 2 weeks" is a window. The question is what "last 2 weeks" means.

- **Calendar-day window:** the last 14 days on the calendar, whatever they were.
- **School-day window:** the last 10 days school was in session, skipping weekends and breaks.

On a normal fortnight these are identical: 14 calendar days contain exactly 10 school days. They only differ around breaks. That's the point.

### Worked example: Maple Example School

A made-up paying school. 8 teachers, each active every school day. Nothing is wrong. It renews Jan 15, 2026, so customer success wants any warning by Monday Dec 1, 2025 (45 days ahead).

On Monday Dec 1, both approaches compare "this window" to "the window before."

**Calendar days:**

- This window: Nov 18 to Dec 1. That includes Thanksgiving week. Only 5 school days (Nov 18 to 21, Dec 1). 8 teachers x 5 = 40 teacher-days.
- Previous window: Nov 4 to Nov 17. 10 school days. 80 teacher-days.
- Verdict: "Activity down 50%." False alarm on a healthy school.

**School days:**

- This window: last 10 school days, Nov 11 to Dec 1, skipping Thanksgiving. 80 teacher-days.
- Previous window: the 10 school days before that, Oct 28 to Nov 10. 80 teacher-days.
- Verdict: flat. No alarm. Correct.

It gets worse on Monday Jan 5, the first day back. The last 14 calendar days (Dec 23 to Jan 5) hold just 1 school day, vs 9 in the 14 before. A calendar window sees a drop of nearly 90%. The school-day window (Dec 9 to Jan 5) still holds 10 normal school days.

Real check in the simulated data (my query): for the 46 healthy paid schools, student sessions in the calendar window ending Dec 1 were 10,269, vs 19,345 in the window before: a 47% "drop." On the school-day window it was 19,965 vs 19,109, up 4%.

One detail: on a day that isn't a school day, the school-day window just ends at the last school day. In the data, every calendar day carries a running count of school days so far (`instr_idx`), which makes this easy to compute.

---

## District calendars, and checking the checker

Real districts don't share breaks. New England starts after Labor Day and takes a February and an April vacation. Texas takes spring break in early March. The South starts in early August and finishes in May. One national calendar gets every one of those districts wrong.

How it's built:
- `config.py` holds the national calendar plus five regional ones.
- Every school has a `calendar_id`, and the `school_calendars` table holds each calendar's days.
- Feature windows count school days on each school's own calendar.
- The default world still puts every school on the national calendar, so the headline numbers above don't move.
- A second world (`python -m kindling.simulate --calendars district`) puts each school on its district's calendar.

Health results in the district world:

| | Calendar windows | School days, one national calendar | School days, district calendars |
|---|---|---|---|
| Healthy schools flagged (false alarms) | 57/58 (98%) | 11/58 (19%) | **0/58 (0%)** |
| Churners flagged 45+ days before renewal | 22/22 | 18/22 | 17/22 |

The national calendar's false alarms come from four of the five regions. When a district's spring break or last day doesn't match the national calendar, those days count as "school days" with nobody using the product.

An earlier version of this table said 83% for the national calendar. That number was inflated: the scorer kept scoring schools *after* their renewal date, and schools in regions whose year ends in May looked dead all through June. Once a school has renewed there's nothing left to predict, so health now stops scoring it at its renewal date. The calendar effect is real, but it's 19% → 0%, not 83% → 0%.

**Checking the checker.** The first run of the district world did *not* give 0%. District calendars still flagged 12 healthy schools, a 21% false-alarm rate, and all 12 were Northeast schools flagged on Sep 1.
- **Why:** Northeast schools start Sep 2, so on Sep 1 their 10-school-day window was empty. An empty window and an empty window before it scores as "no data, neutral," which comes to 52.5, under the 70 line.
- **The fix was a rule, not a tweak:** don't score health until a school's year has one full window of school days.
- The default world didn't change at all. Every Monday from Sep 1 already had 11 school days on the national calendar, so the bug had been invisible there.
- **The lesson:** a new world tests the harness as well as the score. If I had only quoted "district calendars beat the national calendar," the 21% would have looked like a district-calendar weakness when it was really a scorer bug.

---

## Why you can trust the results

A skeptical interviewer's first thought on any backtest is "you cheated, maybe by accident." RULES.md is built to answer that.

- **The scorer never reads the truth table.** Only `backtest.py` may. If the scorer could see the hidden archetype, perfect scores would be trivial. A test (`test_engine_never_reads_truth`) scans the engine files and fails if they mention `truth`.
- **No future data.** Every feature takes an explicit "as of" date and reads only events on or before it. Leaking even one day of the future makes results look great and mean nothing. The test deletes every event after the as-of date, recomputes features, and checks nothing changed. It runs on three dates, including Jan 5, right after winter break.
- **A flag only counts if it comes before the purchase.** Flagging a school the day after it bought isn't a prediction.
- **No secret tuning.** If weights are ever tuned on results, the year must be split (tune on fall, report on spring) and that has to be written down. The PQL code says its weights were set by reasoning, not tuning.
- **Report bad numbers.** No rounding up. That's why the trade-offs sit right in the results: school-day windows catch fewer churners than the naive model (77% vs 95%), and they don't help the buying score at all.
- **A baseline to beat.** A number alone means nothing. Beating the rule most teams start with ("5+ tutors built") is the claim.
- **No LLM computes scores.** An LLM may only turn already-computed reasons into prose. Scores stay reproducible and explainable.

All 12 tests pass as of Nov 23. They also cover the district calendars, the admin rule, and dates before school starts.

---

## Words to know

| Term | Plain meaning in this project |
|---|---|
| PQL | Product-qualified lead. A free account whose usage says it's ready for a sales conversation. Here: a free school scoring 60+. |
| Health score | 0 to 100 for a paying school. Low means likely to leave. Below 70 is "At risk." |
| District calendar | The school year a district actually runs: its own start, end and breaks. Each school's windows are counted on its own. |
| Churn | A paying customer not renewing. |
| Expansion | A paying customer buying more, like more seats. |
| NRR | Net revenue retention. Revenue from last year's customers this year, counting expansion and churn, divided by what they paid last year. Over 100% means growth from existing customers. |
| CDP | Customer data platform, like Segment. Collects product events in one place. The simulator writes Segment-style events. |
| Point-in-time | Computing a feature using only what was known on that date. |
| Backtest | Replaying the past day by day and grading the predictions against what really happened. |
| Precision | Of the schools you flagged, the share that really converted. Low precision = wasted rep time. |
| Recall | Of the schools that converted, the share you flagged first. Low recall = missed deals. |
| Lead time | How many days before the event you flagged it. Longer = more time to act. |
| Baseline | The simple rule you compare against, to prove the fancy one is worth it. |
| Archetype | The hidden behavior type the simulator gives each school. |
| Ground truth | What really happened: the `truth` table. Only the backtest sees it. |

---

## Explaining it to Jemel

### 30 seconds

"I'm building a project called Kindling, aimed at the kind of motion Flint runs. Teachers adopt for free, and it watches usage to tell sales which free schools are actually ready to buy, and customer success which paying schools are slipping before renewal. The twist is it counts school days, not calendar days, so winter break doesn't look like churn. I test it on a simulated school year with hidden outcomes. Both sides are built: the buying score is right 77% of the time, against 37% for a simple rule. The churn side catches 77% of churners at least 45 days before renewal, with zero false alarms on healthy schools."

### 2 minutes

"In a bottom-up motion, a teacher signs up, tells colleagues, and eventually the school buys. Across hundreds of schools, nobody can eyeball who's ready. And on the paid side, you want to catch a school fading well before renewal.

I didn't have real data, so I wrote a simulator: 200 fake schools over a 2025-26 school year with real break dates. Each school has a hidden type. Some are real buyers. Some are decoys, like one superstar teacher whose colleagues never join, or teachers who build lots of tutors their students never use. There are even schools that look exactly like buyers but never buy, like after a budget freeze.

The buying score is account-level and rules-based: how many teachers are active, whether their students are really using it, whether an admin showed up, and whether it's spreading. Every score comes with its top 3 reasons, so a rep knows what to say on the call.

To test it, I replay the year every Monday using only data up to that day, then check against the hidden outcomes. Compared to the common 'built 5+ tutors' rule, precision went from 37% to 77%, with about four weeks of lead time. It catches 71% of buyers, just over my 70% goal. The misses are mostly schools where only two or three teachers ever used it.

The health score is where school days earn their keep. A calendar-day model flags 57 of the 58 healthy schools at some point in the year, mostly around winter break. Kindling flags none of them, and still catches 77% of churners at least 45 days before renewal. I also gave every district its own calendar in a second simulation. One national calendar still false-alarms on about one healthy school in five; district calendars bring that to zero.

Alerts go to Slack through n8n, with Claude drafting the first email from the computed reasons, and there's a dashboard. I'd love to hear how you think about this at Flint."

---

## Questions Jemel might ask

**1. Why synthetic data?**
I don't have access to a real company's usage data, and I wouldn't want to use real schools. Synthetic data also gives me known answers, so I can grade the score, and lets me plant specific traps on purpose. The tradeoff: it only proves the score handles the patterns I built. Real data would be messier.

**2. Why not just use an LLM?**
Scores need to be the same every time, explainable, and testable on a backtest. An LLM scoring accounts would be hard to audit and costly to run across every school every week. In the rules, an LLM is only allowed to turn already-computed reasons into nicer sentences.

**3. How do you know it works?**
The backtest. It replays every Monday using only past data and checks against hidden outcomes. Tests make sure the scorer can't read the answers or see the future. The buying score beats a simple baseline on precision (77% vs 37%), with 71% recall, just over my 70% target. On churn: 0 false alarms vs 57 for a calendar-day model, while catching 77% of churners 45+ days out. It's honest about the cost: the calendar-day model catches more churners (95%), because it flags everyone.

**4. What would change with real data?**
Real event names and messier tracking. Real calendars that differ by district. That part is built: each school's windows follow its own calendar, and it's tested in a second simulated world. In production the calendars have to come from somewhere, like district websites or asking the admin at onboarding. Outcomes depend on things usage can't see, like budget timing. Thresholds would be re-set on real outcomes with the sweep tool: tune on one semester, check on the next. Firmographic enrichment through Clay works by hand today.

**5. How is this different from what Flint already does?**
Honestly, I don't know your internals. I'd love to ask: how do you decide which schools sales talks to today, and how do you handle breaks in your churn signals?

**6. Why rules instead of ML?**
Reps trust a score they can explain, and rules give exact reasons. I also don't have real labeled data to train on. I did run a logistic regression on the same backtest, trained on fall and tested on spring, as an honest comparison.
- For buying, it gets more recall but much lower precision: 40% vs 70%.
- For churn, it catches more churners, 82% vs 59%, but flags every healthy school. It doesn't know what a break is.

**7. Why measure at the school level instead of the teacher level?**
Schools buy, not teachers. One excited teacher is a user. Several teachers with real student use, plus an admin, is a buying account. The solo-star decoy exists to test exactly this.

**8. What's the hardest part so far?**
Being honest about results, and checking the checker.
- The school-days idea doesn't help the buying score; calendar windows do slightly better there. It proved itself on churn instead.
- When I gave districts their own calendars, Kindling flagged 12 healthy Northeast schools on Sep 1. They start after Labor Day, so there was nothing to measure yet, and the scorer read an empty window as a collapse.
- The fix was a rule, not a weight tweak: no health score until a school has 10 school days of data.

---

## Check yourself

Write your answers first. Then open the answers below.

1. In one sentence each: what does the PQL score do, and what does the health score do?
2. Which parts of Kindling are built today, and which are only planned?
3. What makes a solo_star school a decoy, and which part of the PQL score stops it from being flagged?
4. The naive baseline flagged all 20 builders schools. Why, and what in Kindling's score handles them?
5. Why does healthy_break_renewal exist, and what happened when it was tested?
6. On a normal two weeks of school, how many school days are in a 14-calendar-day window? So when do the two window types disagree?
7. A healthy school renews Jan 15, 2026. On Dec 1, a calendar-day model says activity is down 50%. Explain why, using the calendar.
8. What is the difference between precision and recall? Give Kindling's PQL numbers for each.
9. Why are the `stalled` schools in the simulator, if no score can tell them apart from buyers?
10. Name two ways the project prevents cheating in the backtest, and what the test for each one does.
11. In the district-calendar world, Kindling first flagged 12 healthy Northeast schools on Sep 1. Why, and what fixed it?

<details><summary>Answers</summary>

1. The PQL score ranks free schools by how ready they are to buy (0 to 100, Ready at 60+). The health score ranks paying schools by how likely they are to renew (At risk below 70), so customer success can step in 45+ days early.

2. Built:
   - the scoring side: the simulator (plus district-calendar and admin-noise worlds), point-in-time features, both scores with reasons, both backtests with baselines;
   - the comparisons: the logistic regression comparison, the three experiments;
   - delivery: the API, three n8n workflows with Slack, the React and Streamlit dashboards, the HTML report, the README;
   - 12 passing tests.

   Not done: the UI fixes from the Nov 23 audit (in progress on the `ui` branch) and the demo video. Clay was deliberately left as a manual step.

3. It has one very heavy teacher, so a user-level score would rank it near the top. But colleagues never follow, so it's a user, not a buying account. Kindling caps breadth points and gives points for several active and "aha" teachers, plus an admin. A lone teacher can't reach 60. Its best score in the backtest was 37.

4. Builders create many tutors, so "built 5+ tutors" fires. But students barely use those tutors. Kindling scores student sessions (the "aha" teachers) instead of tutor counts, and subtracts 10 points when 20+ tutors exist with fewer sessions than tutors. Best builder score: 40.

5. It checks that a churn model doesn't panic when a renewal comes right after a break, when recent usage naturally looks dead. Tested: calendar windows flag all 12 at some point in the year; school-day windows flag none.

6. Exactly 10. So they agree on normal weeks and disagree only when the window includes a break (or summer).

7. The window Nov 18 to Dec 1 includes Thanksgiving break (Nov 24 to 28), so it has only 5 school days. The window before (Nov 4 to 17) has 10. Same usage per school day, half the school days, so it looks like a 50% drop. The school-day window compares 10 school days to 10 school days and sees no change.

8. Precision: of the flagged schools, how many converted. Recall: of the schools that converted, how many were flagged first. Kindling: 77% precision (24 of 31), 71% recall (24 of 34). The naive rule: 37% and 100%.

9. They're the realistic false positive. Real schools sometimes look ready and still don't buy because of budgets or leadership changes. Including them keeps precision honest instead of too good to be true. All 7 of Kindling's wrong flags were stalled schools.

10. Any two of these. The scorer never reads the truth table: a test scans engine files and fails if they mention `truth`. No future data: a test deletes all events after the as-of date and checks the features don't change. Also, a flag counts only if it comes before the conversion, and weights can't be secretly tuned on results.

11. Northeast schools start Sep 2, so on Sep 1 both their current and previous 10-school-day windows were empty. The scorer treats "no data" as neutral, which adds up to 52.5, under the 70 line. The fix: don't score health until a school's year has one full window of school days. It didn't change the default world, where every Monday from Sep 1 already had 11 school days.

</details>
