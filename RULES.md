# Rules: Kindling

These apply to any human or AI writing code in this repo.

## Coding style
- Python 3.12+, type hints on public functions, small functions with one job.
- Feature logic lives in **SQL** (DuckDB). Python orchestrates and scores.
- Every scoring function takes an explicit `as_of: date`. No hidden "today."
- Name things in GTM language: `pql_score`, `health_score`, `active_teachers_10sd` (sd = school days).
- Constants live in `config.py`. No magic numbers in scoring code without a comment explaining why.
- Every score returns its **reasons** along with the number.
- Keep dependencies minimal (see `requirements.txt`). Add one only with a reason in PROGRESS.md.
- Run `pytest` before saying anything works.

## The AI must never
1. **Read the `truth` table outside `backtest.py`** or tests. The scorer has to be blind to outcomes.
2. **Use events after `as_of`** in any feature. Peeking at the future makes every result fake.
3. **Tune weights by looking at backtest results on the full year** without saying so. If weights are tuned, split the year (tune on fall, report on spring) and write it down.
4. **Invent or round up results.** Report the numbers the code actually prints, including bad ones.
5. **Use real people or real school names**, or attach simulated usage to any real organization.
6. **Use an LLM to compute scores.** LLMs may only turn already-computed reasons into prose.
7. **Commit secrets.** Slack webhooks, API keys and Clay/HubSpot tokens go in `.env`, which is git-ignored.
8. **Make large rewrites in one step.** Follow TASKS.md one task at a time and update PROGRESS.md after each.
9. **Delete or weaken a test to make it pass.** Fix the code, or explain in PROGRESS.md why the test was wrong.
