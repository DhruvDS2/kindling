RUN NAME: kindling-ui-upgrade (P0)
Follow docs/ORCHESTRATOR.md: one worktree per lane in ./.worktrees/<name>, file ownership, frozen contracts. Model: Opus, xhigh. Max 5 agents.
Save this prompt as docs/UI-UPGRADE-RUN.md.

══ BRANCH + SAFETY (hard) ══
Branch `ui-upgrade` cut from `ui`. Never commit to, merge into, rebase, reset or push main or ui. Pushing ui-upgrade is allowed (no force).
Run the API with: N8N_NOTIFY_WEBHOOK= SLACK_WEBHOOK_SALES= SLACK_WEBHOOK_CS= ANTHROPIC_API_KEY=
FRONTEND ONLY. Don't touch kindling/*.py, results/, or the API. frontend/src/types.ts is frozen. Every number still comes from the API at runtime; backtest tables keep source/generated_at/commit. Keep the drawer props {type, school, onClose}. Keep URL state (?screen, as_of, school).

══ GOAL ══
UPGRADE the existing design, don't replace it. Keep what works (information architecture, screens, data, the core palette/type unless the audit shows they're the problem). Make it look like a real, carefully designed B2B product: something Linear, Attio, Vercel or Height would ship. It must NOT look vibecoded. The viewer is a GTM engineer at Flint (K-12 edtech). The feel is precise, warm and calm, with restrained, meaningful motion.

══ "VIBECODED" TELLS: BANNED ══
- Everything wrapped in rounded cards with drop shadows; card grids of identical tiles; icon-in-a-colored-circle stat tiles
- Purple/blue gradients, glassmorphism, glows, gradient text, emoji, decorative blobs
- Default shadcn/Tailwind look left unstyled; default lucide icons sprinkled for decoration
- Rainbow badges (more than 1 accent + status colors); colored left-border "alert" cards
- Centered everything; equal visual weight everywhere (no hierarchy); giant numbers with no context
- Placeholder copy ("Lorem", "Dashboard", "Overview", "Welcome back!"); generic empty states
- Animating everything on load; bouncy/overshoot easing; slow (>400ms) UI transitions

══ WHAT GOOD LOOKS LIKE ══
- A typographic hierarchy that does the work: 1 display size, 2–3 text sizes, weight and color for levels; tabular numerals for every metric
- Structure from alignment, hairline dividers and whitespace, not boxes. A strict grid (8px), consistent left edges
- Dense but readable tables (Linear/Attio-grade): sticky header, row hover, right-aligned numbers, inline sparklines, keyboard nav
- One accent used sparingly for "the thing to act on"; status colors only for status
- Microcopy written for a sales rep / CSM ("12 schools ready to buy this week", not "PQL results")
- Every state designed: loading (skeletons shaped like the content), empty, error, long names, 0 and 1 items
- Motion only to explain change: what's new, what moved, where a panel came from

══ PHASE −1: RECONCILE ══
Check ui-upgrade and the worktrees for existing DESIGN.md, tokens, references or motion work; skip what's done.

══ PHASE 0: AUDIT + OPTIONS (orchestrator + 2 research agents, read-only) → STOP ══
A. Audit the current design:
   - Screenshot every screen + the drawer, light and dark, into docs/design/before/.
   - Write docs/design/AUDIT.md: the current tokens/type/colors/components; which "vibecoded tells" from the banned list are present (with screenshot refs); what to KEEP; the top 10 problems ranked by impact.
B. Find references:
   - Locate Dhruv's details.so material: the Details MCP if connected (search tools for "details"), his boards ("Portfolio (Simple)", "Portfolio (Simple) Round 2" for tone), and any references folder under ~/personal-projects (search for details*, inspiration*, references*, moodboard*, design/refs).
   - If there's no MCP, use Claude in Chrome on details.so.
   - Also read ~/personal-projects/portfolio-simple's DESIGN.md/tokens, so Kindling feels like part of Dhruv's family (shared type/motion feel) while keeping its own product identity.
C. Write docs/design/OPTIONS.md. For each slot below, give 2–3 options. Each option: details.so link (or Details ID/slug), a screenshot in docs/design/refs/, one line saying exactly what we'd take, and why it fits Kindling. Patterns only, never logos or brand text.
   1. Overall layout + app shell/nav (sidebar vs top bar, density)
   2. Data table / ranked list (Ready + At risk)
   3. Stat/metric presentation (Brief)
   4. Side drawer / detail panel (school detail)
   5. Charts: usage line chart + break shading, comparison bars (Backtest)
   6. Page/screen transitions
   7. Number change + list reorder animation (as_of date change)
   8. Hover / press / focus micro-interactions
   9. Loading + empty states
   10. Date control (as_of scrubber/picker)
D. Write docs/design/PROPOSAL.md: for each screen (Brief, Ready, At risk, drawer, Backtest; plus Prospects, Pipeline, Automations restyled with base components only), give an ASCII wireframe of the new layout, what changes vs today, and the motion on it.
E. Print a compact menu: each slot with options labeled 1A/1B/1C and their links, then the top 10 audit problems. STOP and wait for my picks.

══ PHASE 1: TOKENS + BASE (one lane; the gate for all others) ══
After picks: update design/tokens.css + DESIGN.md (evolve the existing tokens, don't throw them away):
- Color: bg layers, text levels, hairline border, ONE accent, status set; AA contrast; light + dark
- Type: families, a fixed scale, weights, line heights, tabular numerals
- Space 8px scale, radius scale (small; tables/panels mostly square-ish)
- Motion: fast 120ms (hover/press), base 200ms (state), slow 320ms (panels/pages), reveal 600ms (charts, once). Enter cubic-bezier(0.2,0.8,0.2,1), exit cubic-bezier(0.4,0,1,1). No bounce. prefers-reduced-motion → fades only
- Library: `motion` (motion.dev) for layout/shared-element transitions; View Transitions API for route changes where supported
- Base components (all states: default/hover/focus/disabled/loading/empty/error): app shell, nav, table (sticky header, sort, keyboard), stat block, status pill, score meter, drawer, tabs, segmented control, button, date control, tooltip, skeleton, empty state, toast
- DESIGN.md rules: tokens only (no raw hex/px/ms in components, enforced by a lint script), reuse before creating, the banned list above copied in
- Build a /__styleguide route rendering every component in every state (dev only)

══ PHASE 2: LANES (parallel; import only from base) ══
LANE A shell + transitions: new shell/nav per pick; route transitions; the as_of control: changing the date animates numbers (count to new value) and reorders lists with layout animation; code-split routes (initial JS < 300 kB).
LANE B Brief + Ready: Brief = a short narrative header ("Feb 2: 12 schools ready, 3 slipping") + key metrics with context (vs last week, sparkline). Ready = a ranked table with score meter, top-3 reasons inline, staggered first-load enter (30ms/row, max 10), hover reveal of quick actions.
LANE C At risk + drawer: same table system; the drawer opens with a shared-element transition from the clicked row; inside it, a health score, renewal countdown, and a usage chart with break periods shaded and a school-day/calendar-day toggle that morphs the line; reasons as a readable list, not chips.
LANE D Backtest: an editorial results page: headline sentence + Kindling vs naive comparison bars that grow once on view; a precision/recall/lead-time table; the district-calendar experiment as a before/after toggle; the source/commit stamp quiet but visible.
LANE E secondary screens: restyle Prospects, Pipeline, Automations with base components only (no new patterns), fix copy and empty states.

══ PHASE 3: QA + GATE ══
- npm run build 0 errors; pytest green (untouched); npm run screenshots passes; token lint passes (0 raw values).
- After-screenshots (light + dark) → docs/design/after/; docs/design/COMPARE.md with before | after | reference per screen.
- 3 Playwright videos → docs/design/videos/: change as_of, open a school drawer, load Backtest.
- A self-review against the banned list and the 10 audit problems: each one FIXED / NOT FIXED with a screenshot.
- Perf: no long tasks during transitions; reduced motion verified.
- Write docs/gates/UI-UPGRADE-GATE.md + a "CONTEXT FOR CLAUDE" block of at most 40 lines; print preview commands. STOP.
