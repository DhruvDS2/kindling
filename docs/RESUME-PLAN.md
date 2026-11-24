# Resume plan: kindling-ui-upgrade (paused 2026-11-23, second pause)

Spec: `docs/UI-UPGRADE-RUN.md`. Decisions: `DESIGN.md` (§2 references with Details IDs, §3 behavior specs, §4 motion, §5–§6 tokens and components, §7 rules, §8 banned list).

## Where we are
**Phase 3 (QA + gate): in progress.**
- Phases 0, 1 and 2 are done and merged into `ui-upgrade`.
- The only open piece of work is the perf pass (`ui-upgrade-p3-perf`, WIP, not merged). After it: the final capture and the gate doc.

| Branch | Head | State |
|---|---|---|
| `main` | `1235173` | Untouched |
| `ui` | `19e7830` | Untouched |
| `ui-upgrade` | the commit adding this file | All of Phases 0–2 merged, plus the Phase 3 work so far. Pushed |
| `ui-upgrade-p1-base` | `8b5ed70` | Phase 1. Merged |
| `ui-upgrade-lane-a-shell` | `60b0f96` | Shell, week pager and ruler, 6A, code-split (263 kB initial JS). Merged |
| `ui-upgrade-lane-b-brief-ready` | `8fc5e0b` | Brief and Ready. Merged |
| `ui-upgrade-lane-c-risk-drawer` | `22c6665` | At risk and the drawer. Merged |
| `ui-upgrade-lane-d-backtest` | `447d82d` | Backtest. Merged |
| `ui-upgrade-lane-e-secondary` | `26da975` | Prospects, Pipeline, Automations. Merged |
| `ui-upgrade-p3-perf` | `8f8190d` "wip: paused" | Perf pass. **Not merged; its gates haven't run yet** |

Local worktrees remain in `.worktrees/` (lanes a–e are clean; `p3-perf` holds the WIP). Lanes a–e can be removed with `git worktree remove`; their branches are kept.

## Phase 3 done so far (on `ui-upgrade`)
- **Token lint is 0 across `src/`** (it was 862). Deprecated aliases, the legacy `Skeleton.tsx` and the `.skeleton` CSS are gone.
- **Dark break/summer shades lifted:** 1.32 / 1.13:1, matching light.
- **One root `ToastProvider`.**
- **`npm run design:capture`** (`frontend/scripts/design-capture.mjs`) produces:
  - after-screenshots, light and dark, into `docs/design/after/`;
  - 3 videos into `docs/design/videos/`;
  - long-task and reduced-motion checks into `docs/design/capture-report.json`.
- **The first capture ran.** Its after/ and videos/ folders are **local and uncommitted on purpose**: they're re-captured after the perf merge, and committing them twice would bloat the public repo.
- **Docs:** `docs/design/COMPARE.md` (before / after / reference per screen); DESIGN.md documents the Phase 2 patterns.
- **The banned-list grep is clean:** no emoji, placeholder copy, gradients, glass, colored alert borders or card shadows; motion ≤320ms (600ms only for one-time chart reveals); radii 2/4/6 only.
- **Reduced motion:** fades only (opacity and color). Verified by the capture.
- **Reviewed by eye:** Brief, At risk, the dark Jan 5 drawer and Backtest look on-brief.

## Perf: what we know
- The first capture (dev server, a heavily loaded machine with 5 lanes running) saw long tasks:
  - 85-row week step: 148ms
  - drawer open: 92ms
  - drawer `j`: 51ms
  - page switch to Backtest: 107ms
- The perf lane found that **in the production build every transition was already under 50ms of CPU** (14–33ms). The long tasks were mostly machine contention plus dev-mode React.
- Its WIP changes on `ui-upgrade-p3-perf`:
  - cached motion tokens and formatters;
  - `Why` sorts without `localeCompare`;
  - Table re-renders only changed rows and layout-animates only rows near the viewport;
  - week updates are deferred and interruptible;
  - drawer transitions, and the Backtest chunk preloads at idle;
  - Backtest sections mount one per idle turn (`Deferred.tsx`).
  - In dev: 85-row step ~170 → ~37ms; drawer open 82–122 → ~74ms. Some changes are only tsc- and lint-checked.
- Its measurement scripts are in `frontend/scripts/perf-wip/` on that branch. Its next steps:
  - set the Table first-load reveal during render, not in a layout effect;
  - pass the drawer body its last measured width;
  - maybe let NumberFlow write text directly.

## What's left
1. **Finish the perf branch** (`.worktrees/p3-perf`).
   - Run its gates: tsc, `npm run build` (initial JS < 300 kB), pytest, `lint:tokens` 0, `npm run screenshots`, and a behavior check. The behavior check confirms: visible rows still slide, the drawer still wipes and pages without a re-wipe, Backtest bars grow once, and reduced motion is fades only.
   - **Measure long tasks against a production build on a quiet machine**, with nothing else running: `vite build` + `vite preview`, not the dev server.
   - Merge it if it passes; drop any experiment that doesn't help.
2. **Re-run `npm run design:capture` against the production preview,** then commit `docs/design/after/`, `docs/design/videos/` and `capture-report.json`.
3. **Optional base follow-ups** that lanes worked around locally:
   - WeekPager `testid` prop
   - `LazyMotion` / `m.*`
   - move the view-transition root fix into `PageTransition.css`
   - SegmentedControl small size
   - a Nav hover callback
   - a Drawer exit-complete callback
   - stop arrow-key propagation in the Drawer
   - a focus fallback
   - remove the unused Tailwind directives in `index.css`
4. **Write `docs/gates/UI-UPGRADE-GATE.md`:**
   - the verdict, with main/ui hashes unchanged;
   - the gates table;
   - the perf table (prod and dev) and reduced motion;
   - the self-review: the banned list and the 10 audit problems, each FIXED or NOT FIXED with a screenshot;
   - follow-ups and preview commands;
   - a "CONTEXT FOR CLAUDE" block of ≤ 40 lines.

   Push `ui-upgrade`. **STOP.**

## Notes
- **The Details MCP is out of monthly credits.** Every reference is already recorded (DESIGN.md §2, `docs/design/research/`), so no more calls are needed.
- **Picks are locked:**
  - Structure: 1A, 2A, 3B / 3A, 4A + 4C, 5A / 5B.
  - Motion: 6A, 7A, 8A + 8B, 9A, 10B; Preymaker drawer.
  - "Ready" is warm ochre (#80560F light, #E0B25C dark); ember is the single accent.
- **Safety, unchanged:**
  - Never commit to, merge into, rebase, reset or push `main` or `ui`.
  - Frontend only; `types.ts` is frozen; every number comes from the API.
  - Run the API with `N8N_NOTIFY_WEBHOOK= SLACK_WEBHOOK_SALES= SLACK_WEBHOOK_CS= ANTHROPIC_API_KEY=`.
  - Each worktree needs an empty `.env`, `python3 -m kindling.simulate`, and its own `node_modules` (`cp -cR`).

## Resume
```bash
cd ~/personal-projects/kindling
git fetch origin && git switch ui-upgrade && git pull --ff-only
git worktree list          # .worktrees/p3-perf should be on ui-upgrade-p3-perf (8f8190d)
# if missing: git worktree add .worktrees/p3-perf ui-upgrade-p3-perf && : > .worktrees/p3-perf/.env \
#   && (cd frontend && npm install) && cp -cR frontend/node_modules .worktrees/p3-perf/frontend/node_modules \
#   && (cd .worktrees/p3-perf && python3 -m kindling.simulate)
claude
```
Then paste into Claude Code:
> Resume RUN kindling-ui-upgrade from docs/RESUME-PLAN.md (Phase 3). Finish and validate the perf branch ui-upgrade-p3-perf: run its gates, measure long tasks on a production build with nothing else running, and merge it if it passes. Then re-run npm run design:capture against the prod preview, commit the after-shots and videos, write docs/gates/UI-UPGRADE-GATE.md with the self-review and a ≤40-line CONTEXT FOR CLAUDE, push ui-upgrade, and STOP. Same safety rules.
