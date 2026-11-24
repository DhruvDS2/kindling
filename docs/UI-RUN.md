# UI run (P2): brief for every lane

Branch `ui` (cut from `main` at `1235173`). Phase 0 (blockers + contract) is done on `ui`; read `git log main..ui`.
Gate doc this run produces: `docs/gates/UI-GATE.md`. Audit it builds on: `docs/gates/PRE-UI-READINESS.md`.

## Hard rules
- **Branches:** each lane works on its own branch `ui-lane-*` in its own worktree, cut from `ui`. The orchestrator merges lanes into `ui`.
  - Lanes never commit to, merge into, rebase, reset or push `main` or `ui`.
  - No pushes, PRs, tags, branch deletes or deploys from a lane.
- **No hardcoded numbers on screen.** Every number, date, threshold, count and percentage on screen comes from the API at runtime (`/meta`, `/stats`, `/pql`, `/health`, `/schools/*`, `/calendars/*`, `/backtest`, `/backtest/results`, ...). Labels like "next 90 days" or "≥ 60" must be built from API values.
  - **Not numbers:** design sizes (px), animation timings, and chart axis padding.
- **The backtest view shows its source.** For every results table: the file it came from (`source`), its run timestamp (`generated_at`), and its commit.
- **One "At risk" definition:** `status === 'At risk'` from the API. Don't add another filter (no "≤ 90 days").
- **Never send anything.** Don't click "Send to #…" or the outreach Slack, Gmail, LinkedIn or X actions, and don't call POST endpoints. Never read `.env`.
- **No dependency installs.** `frontend/node_modules` is shared through a symlink. Available: React 19, TanStack Query 5, recharts 3, Playwright 1.65.
- **Frozen backend.** The API contract is frozen (`frontend/src/types.ts`, `tests/test_api.py`). If you find an API bug, make the smallest fix in `kindling/api.py`, add a test, and say so in your report.
- **Shared frontend files** (`api.ts`, `types.ts`, `asOf.tsx`, `nav.ts`, `index.css`): you may append new exports or CSS at the end. Don't change what's already there.
- **Keep the test hooks:**
  - `data-nav="<screen>"` on sidebar buttons;
  - `?screen=…&as_of=…&school=…` URL params, where `school` opens that school's detail drawer on the ready and risk screens;
  - `data-testid="as-of"`;
  - `AccountDetail`'s props `{ type, school, onClose }`.
- **Design:** follow DESIGN.md and the tokens in `src/index.css`: paper, ember for PQL, risk for health, steady, Inter, and JetBrains Mono for numbers. Inline styles, like the rest of the code. Calm, dense, readable at 1440×900.

## Decisions (accepted defaults)
1. Build on the React console. Streamlit is a read-only backup.
2. The demo date is pinned at **2026-02-02** (`/meta.demo_as_of`). Its window is fully after winter break (activity at 96% of the pre-break level), and 17 renewals fall 30–60 days out. A date picker covers the simulated year.
3. The demo must not depend on n8n or localtunnel. Everything on screen works with just the API and the UI.
4. The experiments get one panel on the backtest view, district calendars first. No world switcher.
5. The admin rule stays off. If `ready_rule === 'admin'` ever appears, label it, but don't build a list for it.
6. The health threshold stays at 70. The thin margin is documented in the README.
7. Prospects, Pipeline and Automations stay, get fixed, and stay out of the demo script.

## Lanes and file ownership
| Lane | Branch | Owns | Builds |
|---|---|---|---|
| A, sales and CS | `ui-lane-a-sales-cs` | `screens/MondayBrief.tsx`, `screens/ReadyToBuy.tsx`, `screens/AtRisk.tsx`, `components/ScoreChip.tsx`, `App.tsx` | Sales view, CS view, Monday brief |
| B, school detail | `ui-lane-b-school-detail` | `components/AccountDetail.tsx`, new `components/detail/*` | The school detail drawer |
| C, backtest and secondary | `ui-lane-c-backtest` | `screens/Backtest.tsx`, new `components/backtest/*`, `screens/Prospects.tsx`, `screens/Pipeline.tsx`, `screens/Automations.tsx` | Backtest view, Prospects / Pipeline / Automations fixes |

## Gates each lane must pass before reporting
- `cd frontend && npm run build`: 0 errors.
- `python3 -m pytest -q` (repo root): green.
- `npm run screenshots` against your own servers: no console errors, no failed API calls. Look at your screens' PNGs yourself.
- Commit on your lane branch with clear messages.
