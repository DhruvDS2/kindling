RUN NAME: kindling-pre-ui-audit (P1)
Follow docs/ORCHESTRATOR.md if present: one worktree per lane in ./.worktrees/<name>. Model: Opus, high. Max 3 agents.
Save this prompt as docs/PRE-UI-AUDIT-RUN.md.
READ-ONLY RUN: no code changes, no refactors, no dependency upgrades. Only write files under docs/gates/. Running existing tests, the simulator, the backtests, and local servers on localhost is allowed. No network except localhost. Never touch secrets/.env. Don't send real Slack messages.

══ PHASE −1: RECONCILE ══
Check docs/gates/ and LEARN.md. If an earlier audit exists, re-verify only TODO/PARTIAL items. Judge from code and real runs, not commit messages or LEARN.md. LEARN.md's status (as of Nov 11) says BUILT: simulator, point-in-time features, PQL score, naive baseline, PQL backtest, 5 integrity tests; PLANNED: health score + churn backtest, API, n8n, Slack, dashboard, README, demo video. Verify every item against this list.

══ GOAL ══
Before any UI work starts, produce docs/gates/PRE-UI-READINESS.md answering: what does the dashboard need, what exists, what is missing. The UI in scope: the sales view (free schools ranked by PQL score + top 3 reasons), the CS view (paid schools by health score + top 3 reasons + days to renewal), the school detail (usage over time with school-day vs calendar-day windows and breaks shaded), and the backtest results view (PQL vs naive baseline; churn vs baseline).

══ PHASE 1: LANES (parallel, read-only) ══
LANE A scoring-core: Run the simulator, features, PQL score, and the PQL backtest. Confirm the numbers still match (flagged 30 vs 93, precision 73% vs 37%, recall 65%, median lead 30 vs 53 days). Check whether the health score and churn backtest exist and give each a DONE/PARTIAL/TODO verdict. Confirm all anti-cheating tests pass (no truth-table reads, no future data, flags count only before conversion). State whether the school-days window has been shown to beat calendar windows anywhere yet. Done when there is a GREEN/RED table per component.
LANE B data-contract: List every output the dashboard needs (scores, reasons, score history, raw usage series, calendar/breaks, renewal dates, backtest metrics) and where each one comes from today (DuckDB table, function, file, FastAPI endpoint). Mark each EXPOSED / NOT EXPOSED / PARTIAL with a real example payload. Draft the API/payload shapes the UI should freeze.
LANE C delivery-surface: Audit FastAPI, n8n workflows, Slack alert formatting, any Streamlit or other frontend code, README, and the demo path. Take a Playwright screenshot of any existing UI (save to docs/gates/screens/). Check for a one-command demo run. Give each item a DONE/PARTIAL/TODO verdict and a KEEP/REWORK/REPLACE verdict.

══ PHASE 2: REPORT + GATE ══
The orchestrator merges lane findings into docs/gates/PRE-UI-READINESS.md with these sections:
1. Verdict: READY FOR UI / READY WITH GAPS / BLOCKED (one line why)
2. Required before UI starts (hard blockers, ranked, effort S/M/L). The health score + churn backtest are expected here if not done.
3. Missing but can be built alongside the UI (with stubs)
4. Data contract the UI should freeze (ready to become Phase 0 of the UI run)
5. Current UI/delivery inventory (link screenshots)
6. Pitch check: which claims in the 30-second Flint pitch are currently true, and which aren't yet
7. Questions for Dhruv, each with a recommended default (e.g. keep Streamlit or move to React/Next; where n8n runs in the demo)
Keep it under ~150 lines. Then STOP. Don't start UI work.
