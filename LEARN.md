# Learn Kindling

A tutor guide for explaining Kindling end to end. Read it once, then do "Check yourself" in writing before you open the answers.

Status as of 2026-11-11. The code is moving fast, so re-check TASKS.md and `results/` before Friday.

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
- **GTM concept:** Usage signals, point-in-time features. It has two modes: last 10 school days (the real approach) and last 14 calendar days (the naive baseline).
- **Status:** BUILT (code exists and tests pass; TASKS.md box not checked yet).

### 3. PQL score (`pql.py`)

- **What it does:** Scores each free, not-yet-converted school from 0 to 100. Points for breadth (active teachers, max 30), depth (aha teachers, max 35), an admin signing up (15), and spreading (more active teachers than last window, 10). Minus 10 if lots of tutors were built but students barely used them. 60 or higher means "Ready." It returns the top 3 reasons with the number.
- **Why it exists:** Sales wants a ranked call list with reasons they can say out loud.
- **GTM concept:** PQL (product-qualified lead), scored at the account level, not the user level. The weights were set by reasoning, not tuned on results (stated in the code).
- **Status:** BUILT (not yet checked off in TASKS.md).

### 4. Health score (`health.py`)

- **What it does:** Will score each paying school 0 to 100 from trends in active teachers and sessions over school-day windows, plus days until renewal, with top 3 reasons.
- **Why it exists:** Customer success needs to know who to help before renewal.
- **GTM concept:** Customer health score, churn prediction, retention. Feeds NRR.
- **Status:** PLANNED. The file doesn't exist yet.

### 5. Backtest (`backtest.py`)

- **What it does:** Pretends it is every Monday from Sep 1, 2025 to Jul 31, 2026. On each Monday it scores using only data up to that day. It records the first Monday each school hits "Ready." Then, and only then, it checks the hidden truth: did that school convert after the flag?
- **Why it exists:** It's the proof. Without it, a score is just an opinion.
- **GTM concept:** Backtesting, precision, recall, lead time, beating a baseline.
- **Status:** PQL backtest BUILT, results in `results/pql_backtest.md`. Health backtest PLANNED.

The PQL results (I re-ran them and they match the file):

| | Naive: 5+ tutors built | Kindling PQL |
|---|---|---|
| Schools flagged | 93 | 30 |
| Flagged that converted | 34 | 22 |
| Precision | 37% | 73% |
| Recall | 100% (34/34) | 65% (22/34) |
| Median lead time | 53 days | 30 days |
| Top 20 on Feb 2, 2026 that later converted | 4/20 | 6/20 |

How to read it:

- The naive rule catches everyone because it flags almost everyone. 59 of its 93 flags are wrong. Reps would waste most calls.
- Kindling is right about 3 times in 4. It beats the 60% precision target.
- Kindling misses the 70% recall target (65%). Be upfront about that.
- Lead time of 30 days beats the 14-day target.

What I found digging in (my own queries, not in the results file):

- The 8 wrong Kindling flags are all "stalled" schools. Those are built to look exactly like buyers but never buy. Zero flags went to solo stars, builders, or dormant schools.
- The 12 misses: 6 are the "quiet" converters (only 2 teachers), and 6 are decoy schools that bought anyway (5 solo stars, 1 builder).
- For the PQL score, school-day windows barely changed the result. A calendar-day version got the same precision and recall, with 27.5 days median lead time instead of 30. The school-days idea is expected to matter much more for the health score, which isn't built yet. Don't claim it already proved itself for PQL.

### 6. Alerts and n8n (`api.py`, `n8n/kindling_weekly.json`)

- **What it does:** A small API returns PQL and health scores for a date. An n8n workflow runs weekly: call the API, split by team, and post to two Slack channels (sales and customer success). Optional Clay node to enrich flagged accounts.
- **Why it exists:** A score nobody sees is worthless. Alerts put it where reps already work.
- **GTM concept:** Routing, orchestration, enrichment.
- **Status:** PLANNED.

### 7. Dashboard (`dashboard/app.py`)

- **What it does:** Streamlit page with four tiles (Ready to buy, At risk, ARR at risk, Projected NRR), two ranked tables, and a backtest tab comparing naive vs season-aware with breaks shaded.
- **Why it exists:** Gives the GTM lead a "is this working?" view.
- **GTM concept:** NRR, ARR at risk, pipeline reporting.
- **Status:** PLANNED.

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

In this run, 34 free schools convert: all 28 converters, 5 solo stars, and 1 builder.

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
- **healthy_break_renewal tests "a break is not a churn."** Right before a Jan 15 or Feb 1 renewal, the recent past is winter break or Thanksgiving. A calendar-day health score sees usage collapse and raises a false alarm on a perfectly happy school. This is the trap the school-days idea is built to avoid. Because the health score isn't built yet, this test hasn't been run.
- **stalled is a different kind of decoy.** It's not there to be beaten. It's the honest floor: some schools look perfect and still don't buy. It keeps precision from looking too good to be true.

### The school calendar

From `config.py`:

- First day of school Aug 18, 2025. Last day Jun 5, 2026. Before and after is summer.
- Thanksgiving: Nov 24 to Nov 28, 2025.
- Winter break: Dec 20, 2025 to Jan 4, 2026.
- Spring break: Mar 14 to Mar 22, 2026.

That gives 190 school days, 72 weekend days, 30 break days, and 73 summer days.

Teachers are much less likely to show up off school days: 8% as likely on weekends, 4% on breaks, 2% in summer. In my run, the average number of active teachers per day was 641 on school days, 52 on weekends, 28 on breaks, and 11 in summer. Weekly active teacher-days fell from about 3,400 in mid-December to about 200 over winter break, then went back to about 3,450 the week of Jan 5.

PROGRESS.md still shows older numbers (677, 1,584 teachers). Those came from before the `stalled` archetype was added. Quote the numbers from a fresh run.

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

Real check in the simulated data (my query): for the 46 healthy paid schools, student sessions in the calendar window ending Dec 1 were 8,664 vs 16,578 the window before, a 48% "drop." On the school-day window it was 15,715 vs 16,054, about 2%.

One detail: on a day that isn't a school day, the school-day window just ends at the last school day. In the data, every calendar day carries a running count of school days so far (`instr_idx`), which makes this easy to compute.

---

## Why you can trust the results

A skeptical interviewer's first thought on any backtest is "you cheated, maybe by accident." RULES.md is built to answer that.

- **The scorer never reads the truth table.** Only `backtest.py` may. If the scorer could see the hidden archetype, perfect scores would be trivial. A test (`test_engine_never_reads_truth`) scans the engine files and fails if they mention `truth`.
- **No future data.** Every feature takes an explicit "as of" date and reads only events on or before it. Leaking even one day of the future makes results look great and mean nothing. The test deletes every event after the as-of date, recomputes features, and checks nothing changed. It runs on three dates, including Jan 5, right after winter break.
- **A flag only counts if it comes before the purchase.** Flagging a school the day after it bought isn't a prediction.
- **No secret tuning.** If weights are ever tuned on results, the year must be split (tune on fall, report on spring) and that has to be written down. The PQL code says its weights were set by reasoning, not tuning.
- **Report bad numbers.** No rounding up. That's why the 65% recall, below the 70% target, sits right in the results.
- **A baseline to beat.** A number alone means nothing. Beating the rule most teams start with ("5+ tutors built") is the claim.
- **No LLM computes scores.** An LLM may only turn already-computed reasons into prose. Scores stay reproducible and explainable.

All 5 tests pass as of today.

---

## Words to know

| Term | Plain meaning in this project |
|---|---|
| PQL | Product-qualified lead. A free account whose usage says it's ready for a sales conversation. Here: a free school scoring 60+. |
| Health score | 0 to 100 for a paying school. Low means likely to leave. Planned. |
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

"I'm building a project called Kindling, aimed at the kind of motion Flint runs. Teachers adopt for free, and it watches usage to tell sales which free schools are actually ready to buy, and customer success which paying schools are slipping before renewal. The twist is it counts school days, not calendar days, so winter break doesn't look like churn. I test it on a simulated school year with hidden outcomes. The buying score is done and beats a simple baseline on precision. The churn side is next."

### 2 minutes

"In a bottom-up motion, a teacher signs up, tells colleagues, and eventually the school buys. Across hundreds of schools, nobody can eyeball who's ready. And on the paid side, you want to catch a school fading well before renewal.

I didn't have real data, so I wrote a simulator: 200 fake schools over a 2025-26 school year with real break dates. Each school has a hidden type. Some are real buyers. Some are decoys, like one superstar teacher whose colleagues never join, or teachers who build lots of tutors their students never use. There are even schools that look exactly like buyers but never buy, like after a budget freeze.

The buying score is account-level and rules-based: how many teachers are active, whether their students are really using it, whether an admin showed up, and whether it's spreading. Every score comes with its top 3 reasons, so a rep knows what to say on the call.

To test it, I replay the year every Monday using only data up to that day, then check against the hidden outcomes. Compared to the common 'built 5+ tutors' rule, precision went from 37% to 73%, with about a month of lead time. It catches 65% of buyers, which is under my 70% goal, and the misses are mostly schools where only two teachers ever used it.

Next is the health score for renewals. That's where school days should really matter, since a calendar-based model would panic every December. Then n8n to route alerts to Slack, and a dashboard. I'd love to hear how you think about this at Flint."

---

## Questions Jemel might ask

**1. Why synthetic data?**
I don't have access to a real company's usage data, and I wouldn't want to use real schools. Synthetic data also gives me known answers, so I can grade the score, and lets me plant specific traps on purpose. The tradeoff: it only proves the score handles the patterns I built. Real data would be messier.

**2. Why not just use an LLM?**
Scores need to be the same every time, explainable, and testable on a backtest. An LLM scoring accounts would be hard to audit and costly to run across every school every week. In the rules, an LLM is only allowed to turn already-computed reasons into nicer sentences.

**3. How do you know it works?**
The backtest. It replays every Monday using only past data and checks against hidden outcomes. Tests make sure the scorer can't read the answers or see the future. It beats a simple baseline on precision (73% vs 37%). It's honest where it misses: 65% recall, under my 70% target.

**4. What would change with real data?**
Real event names and messier tracking. Real calendars that differ by district, so the school calendar would have to be per school, not one for everyone. Outcomes that depend on things usage can't see, like budget timing. I'd re-check the weights on a holdout period, and probably add firmographic enrichment through something like Clay.

**5. How is this different from what Flint already does?**
Honestly, I don't know your internals. I'd love to ask: how do you decide which schools sales talks to today, and how do you handle breaks in your churn signals?

**6. Why rules instead of ML?**
Reps trust a score they can explain, and rules give exact reasons. I also don't have real labeled data to train on. The plan includes a logistic regression on the same backtest as an honest comparison. If it clearly wins, that's worth knowing.

**7. Why measure at the school level instead of the teacher level?**
Schools buy, not teachers. One excited teacher is a user. Several teachers with real student use, plus an admin, is a buying account. The solo-star decoy exists to test exactly this.

**8. What's the hardest part so far?**
Being honest about results. For example, the school-days idea barely changed the buying score. It should matter much more for churn, but I haven't built that yet, so I can't claim it.

---

## Check yourself

Write your answers first. Then open the answers below.

1. In one sentence each: what does the PQL score do, and what does the health score do?
2. Which parts of Kindling are built today, and which are only planned?
3. What makes a solo_star school a decoy, and which part of the PQL score stops it from being flagged?
4. The naive baseline flagged all 20 builders schools. Why, and what in Kindling's score handles them?
5. Why does healthy_break_renewal exist, and why hasn't it been tested yet?
6. On a normal two weeks of school, how many school days are in a 14-calendar-day window? So when do the two window types disagree?
7. A healthy school renews Jan 15, 2026. On Dec 1, a calendar-day model says activity is down 50%. Explain why, using the calendar.
8. What is the difference between precision and recall? Give Kindling's PQL numbers for each.
9. Why are the `stalled` schools in the simulator, if no score can tell them apart from buyers?
10. Name two ways the project prevents cheating in the backtest, and what the test for each one does.

<details><summary>Answers</summary>

1. The PQL score ranks free schools by how ready they are to buy (0 to 100, Ready at 60+). The health score will rank paying schools by how likely they are to renew, so customer success can step in 45+ days early.

2. Built: the calendar and simulator, the point-in-time features (school-day and calendar modes), the PQL score with reasons, the naive "5+ tutors" baseline, the PQL backtest with results, and the tests (all 5 pass). TASKS.md still shows Phase 1 unchecked, but the code exists. Planned: health score and its backtest, the API, Slack formatting, n8n workflow, Clay node, dashboard, HTML report, logistic regression comparison, README, demo video.

3. It has one very heavy teacher, so a user-level score would rank it near the top. But colleagues never follow, so it's a user, not a buying account. Kindling caps breadth points and gives points for several active and "aha" teachers, plus an admin. A lone teacher can't reach 60. Its best score in the backtest was 37.

4. Builders create many tutors, so "built 5+ tutors" fires. But students barely use those tutors. Kindling scores student sessions (the "aha" teachers) instead of tutor counts, and subtracts 10 points when 20+ tutors exist with fewer sessions than tutors. Best builder score: 40.

5. It checks that a churn model doesn't panic when a renewal comes right after a break, when recent usage naturally looks dead. It can't be tested yet because the health score and its backtest aren't built.

6. Exactly 10. So they agree on normal weeks and disagree only when the window includes a break (or summer).

7. The window Nov 18 to Dec 1 includes Thanksgiving break (Nov 24 to 28), so it has only 5 school days. The window before (Nov 4 to 17) has 10. Same usage per school day, half the school days, so it looks like a 50% drop. The school-day window compares 10 school days to 10 school days and sees no change.

8. Precision: of the flagged schools, how many converted. Recall: of the schools that converted, how many were flagged first. Kindling: 73% precision (22 of 30), 65% recall (22 of 34). The naive rule: 37% and 100%.

9. They're the realistic false positive. Real schools sometimes look ready and still don't buy because of budgets or leadership changes. Including them keeps precision honest instead of too good to be true. All 8 of Kindling's wrong flags were stalled schools.

10. Any two of these. The scorer never reads the truth table: a test scans engine files and fails if they mention `truth`. No future data: a test deletes all events after the as-of date and checks the features don't change. Also, a flag counts only if it comes before the conversion, and weights can't be secretly tuned on results.

</details>
