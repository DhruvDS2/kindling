# Resume plan: kindling-ui-upgrade (paused 2026-11-23)

The run spec is `docs/UI-UPGRADE-RUN.md`. Decisions live in `DESIGN.md` (§2 references with Details IDs, §3 behavior specs, §4 motion tokens, §8 banned list). Option history is in `docs/design/OPTIONS.md`.

## Where we are
**Phase 1 (tokens + base components): in progress, paused mid-lane.**
- Phase 0 (audit, options, picks) is done and committed.
- Phase 2 (5 screen lanes) and Phase 3 (QA + gate) have not started.

| Branch | Commit | State |
|---|---|---|
| `main` | `1235173` | Untouched by this run |
| `ui` | `19e7830` | Untouched by this run (the previous UI run, gate PASSED) |
| `ui-upgrade` | the commit that adds this file | Phase 0 docs, DESIGN.md, this plan. Pushed |
| `ui-upgrade-p1-base` | `f88ff67` "wip: paused" | Phase 1 lane work in progress. Pushed. **Not merged** |

Local worktree: `.worktrees/p1-base`, on `ui-upgrade-p1-base`. It has its own `node_modules` with `motion` 14.14, an empty `.env`, and its own DuckDB.

## Locked picks (full detail and IDs in DESIGN.md §2)
- **Structure:**
  - 1A grouped sidebar, with the week pager in the top bar
  - 2A columned table: sticky header, sort, skeleton rows, j/k
  - 3B number + context line (Brief) · 3A ruled four-stat row (Backtest)
  - 4A record properties + 4C pager (drawer)
  - 5A line + grouped bars (drawer chart) · 5B labeled hero bar (Backtest)
- **Motion:**
  - 6A cross-fade page transitions
  - 7A count-through numbers
  - 8A travelling hover highlight · 8B one pale row action (Open · Copy email · Send to Slack, keyboard-reachable)
  - 9A first-load skeleton fill
  - 10B week ruler: under the pager, one tick per Monday, breaks shaded, click or drag to scrub. Gray, with ember only for the current week
- **Drawer:** Preymaker (`d653fb4471a2412a8e4d903b8e7fad24`), taking its panel look, scrim and open/close motion. Adapted to a right-side clip wipe: open 320ms, close 200ms (DESIGN.md §3.1). Content stays 4A + 4C. The footer has "Next school →" wired to j/k.
- **Week stepping (spec, no reference):**
  - the table stays visible with an inline "Updating…" mark;
  - rows swap in place, and re-ranked rows slide to their new position;
  - no skeleton after first load.
- **Color rule:** we take motion only, so a reference's colors never disqualify it.

## Phase 1 lane state (`ui-upgrade-p1-base`, from the lane's stop report)
- **Done:**
  - `frontend/src/design/tokens.css`: light and warm-dark color, type, space, size, radius, z-index, motion and reduced motion, with the old names kept as deprecated aliases.
    - `--accent-strong` #B5421C, 5.3:1 on paper (ember text was 3.5:1, which failed). 0 AA failures in either theme.
  - `frontend/src/design/base.css`, `motion.ts` (`dur`/`ease`/`tr`; no literal ms), `dates.ts`.
  - `frontend/scripts/lint-tokens.mjs` plus `npm run lint:tokens`. Baseline: **862 findings** outside `src/design` (the screens), which Phase 2 burns down to 0.
  - `docs/design/research/evidence-phase1.md`: notes for all 8 inspected references.
- **Half-done:**
  - **Before anything else:** `frontend/src/main.tsx` must import `./design/tokens.css` **before** `index.css`. The old `:root` colors were moved out of `index.css`, so on this WIP branch the screens currently render with no colors.
  - `npm run styleguide:check` is declared in `package.json`, but `scripts/styleguide-check.mjs` doesn't exist yet.
- **Not started:**
  - every component in `frontend/src/design/components/` (empty);
  - the dev-only `/__styleguide` route;
  - the Playwright check and the styleguide screenshots (`docs/design/styleguide/`);
  - DESIGN.md §5–§7;
  - the Phase 1 gates.
  - Component plan: `k-`-prefixed CSS classes, motion values via `motion.ts`, and stagger delays via numeric CSS variables × `--stagger-row`.
- **Decision to review on resume:** the lane made the "Ready" status color a petrol blue (#1F6A86), separate from the ember accent. Ember is now only "act on this". Confirm, or ask for a warmer status color.
- **References already inspected; don't call `get_inspiration` again for these:**
  - `d653fb4471a2412a8e4d903b8e7fad24` (Preymaker)
  - `9fc27e0cc796475cbfbe169634192f2b` (Lassie)
  - `9627d9b834f34941aa28a0eeb7445982` (Linear)
  - `Y0VPNY276UbNgPlkXkpnKz` (Sui)
  - `274e851af7a54b8395cc6212b2586452` (Paradigm)
  - `ecSttagJdpcXow3QAxKwha` (Terminal Industries)
  - `b136df2f789242cabc6bb9f9678d5f82` (Eleken)
  - `dcdab50fb7bc47d480acbacf3cee8c4c` (Playground)

  Still to inspect in Phase 2:
  - `72fa6ef47c9c457c8dca22242e11c89a` (Stripe 3A, lane D)
  - `vv6RCiVeskBADYBiDAVmwm` (Effortel 5B, lane D)
  - `cbd2a5b294bd45fe8925c9d1abccda21` (Auar 3B, lane B)
  - `926aafb981e2477e972d50500c79fc47` (Index 5A, lane C)
  - `09667cf64a0f4ecdad4fa77b2c9f6e6d` (V7 Labs 6A, lane A)

## What's left
1. **Finish Phase 1:**
   - Add the `tokens.css` import.
   - Build the base components (full list in the run spec and DESIGN.md §3) and the `/__styleguide` route.
   - Run the Playwright behavior check (drawer Esc and focus, j/k, ruler ←/→, reduced motion) and take light and dark styleguide screenshots.
   - Write DESIGN.md §5–§7.
   - Pass the gates: build 0 errors, pytest green, `lint:tokens` 0 inside `src/design`, `npm run screenshots` clean.
2. **Merge** `ui-upgrade-p1-base` into `ui-upgrade`, then run `npm install` in the main `frontend/` (for `motion`).
3. **Phase 2,** 5 parallel lanes, each in its own worktree cut from `ui-upgrade`, importing only from the base:
   - A: shell, transitions, the date control wiring, code-splitting (<300 kB initial JS)
   - B: Brief + Ready
   - C: At risk + drawer
   - D: Backtest
   - E: Prospects / Pipeline / Automations
4. **Phase 3:**
   - Gates: build 0 errors, pytest green, `npm run screenshots` clean, `lint:tokens` 0 everywhere.
   - After-screenshots in light and dark plus `docs/design/COMPARE.md`.
   - 3 Playwright videos.
   - Self-review against the banned list and the 10 audit problems.
   - Perf and reduced-motion checks.
   - `docs/gates/UI-UPGRADE-GATE.md` with a ≤40-line CONTEXT FOR CLAUDE block. Then STOP.

## Safety rules (unchanged)
- Never commit to, merge into, rebase, reset or push `main` or `ui`. Pushing `ui-upgrade` and its lane branches is allowed (no force).
- Frontend only. `types.ts` is frozen. Every number comes from the API.
- Run the API with `N8N_NOTIFY_WEBHOOK= SLACK_WEBHOOK_SALES= SLACK_WEBHOOK_CS= ANTHROPIC_API_KEY=`.
- Lane worktrees need an empty `.env`, `python3 -m kindling.simulate`, and their own `node_modules` (`cp -cR`, never a symlink).
- `docs/design/refs/` is gitignored (third-party frames; the repo is public). Re-download it from the Details links if needed.

## Resume
```bash
cd ~/personal-projects/kindling
git fetch origin && git switch ui-upgrade && git pull --ff-only
git worktree list                      # expect .worktrees/p1-base on ui-upgrade-p1-base
# if the worktree is gone (e.g. a fresh machine):
#   git worktree add .worktrees/p1-base ui-upgrade-p1-base && : > .worktrees/p1-base/.env
#   (cd frontend && npm install) && cp -cR frontend/node_modules .worktrees/p1-base/frontend/node_modules
#   (cd .worktrees/p1-base/frontend && npm install) && (cd .worktrees/p1-base && python3 -m kindling.simulate)
claude
```
Then paste into Claude Code:
> Resume RUN kindling-ui-upgrade (docs/UI-UPGRADE-RUN.md) from docs/RESUME-PLAN.md. Finish Phase 1 on branch ui-upgrade-p1-base in .worktrees/p1-base: first add the tokens.css import in main.tsx, then the base components, /__styleguide, the Playwright check and DESIGN.md §5–§7, and pass the Phase 1 gates. Merge into ui-upgrade, then run the Phase 2 lanes and Phase 3. Same safety rules; don't re-inspect the 8 references already in evidence-phase1.md.
