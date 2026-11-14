# PRD: Kindling

## One line
Kindling watches product usage at a product-led K-12 company and tells the GTM team **which free schools are ready to buy** and **which paying schools are about to leave**, with the reasons.

## The problem
In a product-led motion, teachers adopt the product for free and spread it inside their school. Across hundreds of schools, nobody can see by eye:

1. **Who is ready to buy?** One excited teacher is a user. Several teachers whose students actually use the product is an account ready for sales.
2. **Who is about to churn?** Usage that falls before a renewal is the earliest warning, but schools go quiet every winter, spring and summer break. A naive system panics every December.

## Who it's for

| User | What they need | What Kindling gives them |
|---|---|---|
| Sales rep | Which free schools to call this week | Ranked PQL list + Slack alert with top 3 reasons |
| Customer success | Which paying schools need help before renewal | Health score + Slack alert 45+ days before renewal |
| GTM / RevOps lead | Is this working? | NRR view + backtest results |

## What it does
1. **Ingests** Segment-style product events (simulated for this demo).
2. **Scores free schools** for purchase readiness (PQL score) at the account level.
3. **Scores paying schools** for health ahead of renewal.
4. **Explains** every score with its top 3 reasons.
5. **Alerts** the right team in Slack, orchestrated by n8n.
6. **Proves it** with a day-by-day backtest against a simulated year where the true outcomes are known.

## The insight this project is built around
**Measure time in school days, not calendar days.** A rolling window of the last 10 *instructional* days ignores breaks, so a quiet winter break doesn't look like churn and a busy week before break doesn't look like an aha moment. The backtest compares this season-aware approach against a naive calendar-day baseline.

## Success metrics (from the backtest)

| Score | Metric | Target |
|---|---|---|
| PQL | Precision of flagged schools (flagged ones that convert) | ≥ 60% |
| PQL | Converters flagged before they convert (recall) | ≥ 70% |
| PQL | Median lead time before conversion | ≥ 14 days |
| Health | Churners flagged 45+ days before renewal | ≥ 70% |
| Health | False alarms on healthy schools | Season-aware model clearly below naive baseline |

Targets are first guesses. Report the real numbers either way.

## Out of scope (v0)
- Writing outreach emails (deliberately cut)
- Real customer data or real school names. All schools are synthetic
- Production deployment, auth, multi-tenant anything

## Data and ethics
Everything is synthetic. School names are invented, pricing is illustrative, and no real person's data is used. If Clay is connected later, it only enriches public, institutional school facts and never gets attached to simulated usage.
