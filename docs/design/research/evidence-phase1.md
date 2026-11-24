# Phase 1 evidence: what the references actually do

Phase 1 lane (tokens + base components), 2026-11-23. One `get_inspiration` call per entry, plus bounded `read_inspiration_source` reads for Preymaker (`instructions.md`, `mechanism.json`, and the cited open/close timeline, runtime JS lines 1158–1258). Later lanes: read this instead of calling again.

We take **motion and structure only**. No colors, imagery, logos, copy or media links from any of these. Where a reference's timing breaks DESIGN.md §4 (400ms ceiling, no bounce), our token wins and the note says so.

---

## Preymaker · `d653fb4471a2412a8e4d903b8e7fad24` (drawer: panel, scrim, open/close)
**Observed (7 frames):** a pale full-width panel opens down from the top over a dark page; links rise into place through clipped lines; section rules (hairlines) grow from their left edge; on close the panel retracts and the page brightens. Hovering a link dims its siblings to 0.4 opacity.

**Source (GSAP, cited lines 1158–1258):**
- Open: `set(overlay, {display:'block', pointerEvents:'all'})`, then `clipPath: inset(0% 0% 100% 0%) → inset(0% 0% 0% 0%)` over **1.75s**, `CustomEase(0.14,1,0.34,1)`. Backdrop `opacity 0 → 1` over **1.5s**, `CustomEase(0.19,1,0.22,1)`. Backdrop is 60% black (CSS 229–266).
- Text: `yPercent 150 → 0` inside an `overflow:hidden` parent; links stagger **0.05s** from t=0.2s. Rules: `scaleX 0 → 1`, `transform-origin: left`, **1s**, `CustomEase(0.39,0.575,0.565,1)`.
- Close: state cleared and **`pointerEvents:'none'` set immediately**, then `clipPath → inset(0% 0% 101% 0%)` over **1.25s**; backdrop fades over **0.75s**; text exits `yPercent -100`; rules `scaleX → 0`; `display:none` on complete. Any running timeline is killed before a new one starts.
- Esc, backdrop click and the CLOSE control all call the same close. Focus trap + scroll lock while open (mobile). No reduced-motion branch was verified in the source.

**What we built (DESIGN.md §3.1):** direction changed to a **right-side** wipe: `inset(0 0 0 100%) → inset(0)`. Timings scaled into our tokens: open = `--motion-slow` (320ms) + `--ease-enter`; scrim = `--motion-base`; close = `--motion-base` + `--ease-exit`; header text rises `y 100% → 0` through its own clip over slow; hairlines `scaleX 0 → 1` from the left over slow. Pointer events off at the start of close (copied). The running animation is replaced, not queued (motion does this). Scrim is a warm-ink tint at low alpha, not 60% black, because the list behind must stay legible for the pager. Reduced motion: opacity only, no clip-path.

## Lassie · `9fc27e0cc796475cbfbe169634192f2b` (7A: count-through)
**Observed:** a large percentage counts 2% → 41% → 96% → 98% through intermediate integers; the label sentence below never moves.

**Source summary:** a GSAP tween on a plain object `value 0 → 98`; `onUpdate` calls `setState(Math.round(value))`. Duration 3s, `expo.inOut`, scroll-scrubbed.

**What we built:** `useCountThrough(target)` tweens from the previous value to the new one with `motion`'s `animate()` on a number and renders `Math.round` (or a caller formatter). Duration `--motion-base` (200ms) on change, `--motion-reveal` (600ms) once on first mount; easing `--ease-enter`, never expo/inOut or scrub. Tabular figures so width never jumps. Reduced motion: set instantly.

## Linear · `9627d9b834f34941aa28a0eeb7445982` (1A grouped sidebar, 4C pager, 8A travelling hover)
**Observed:** in the embedded app shot, a ~240px sidebar: workspace switcher row; ungrouped items (Inbox, My issues, Reviews, Pulse); then muted small group labels ("Workspace ▾", "Favorites ▾") with items under them. Rows ~22px tall at ~13px text; the active row has a faint background, no shadow, no border. The record header shows a pager "02 / 145" with up/down chevrons at the right.

**Source:** top-nav items get a rounded translucent highlight; color/background transition **100ms ease-out-quad**; dropdown link hover applies immediately and returns over **120ms**. Dropdown content slides 48px and crossfades over **180ms cubic-bezier(.455,.03,.515,.955)**; the container resizes over 220ms. Motion is gated by `prefers-reduced-motion: no-preference`.

**What we built:** `Nav` with group labels (sentence case, muted, not all-caps), plain tabular counts at the right of an item, a single highlight element shared via `motion` `layoutId` that travels to the hovered item over `--motion-fast` and settles on the active item when the pointer leaves. Pager = "2 of 4" with ‹ › buttons plus j/k.

## Sui · `Y0VPNY276UbNgPlkXkpnKz` (2A: columned table, skeleton rows)
**Observed:** a ruled table: header row; columns Date (muted) · Name (strong, larger) · Location · Category; a trailing square action cell on every row. Ellipsis truncation on long names ("Build on Sui: Technical Workshop x Comets…"). Below the loaded rows, **skeleton rows** with one gray bar per column, each bar at its column's x and roughly the width of real content; skeletons fade to real rows as the list grows.

**Source summary:** rows are `<a>` grid rows; skeletons ("ghost loader") are fading divs per cell, removed on complete. The hover marquee (450ms clip, 25s linear ticker) is **not** taken.

**What we built:** `Table` columns declare `align`, `width`, `skeleton` width; skeleton rows render one bar per column at the column's alignment and shape. Hairline row rules, sticky header, truncation + tooltip on the name column.

## Paradigm · `274e851af7a54b8395cc6212b2586452` (9A: table populating cells)
**Observed:** a spreadsheet whose cells go "Generating…" → "Analyzing…" → filled values, cell by cell, while row labels stay put; freshly filled cells flash a faint tint and settle.

**Source summary:** placeholder phases ~700ms each; per-cell delay **35–80ms random**; `td_flash`/`td_settling` class removed after **600ms**; loop restarts after 4s.

**What we built:** **first load only**, skeleton cells hand off to real cells in **reading order** (row by row, left to right), not random. Per-row offset ≈ 30ms capped at the first 10 rows (PROPOSAL "staggered first-load enter"), each cell an opacity fade over `--motion-base`. No looping, no "Generating…" copy, no flash on first load. The one-time tint is reserved for rows that cross a line on a later week change (§3.2).

## Terminal Industries · `ecSttagJdpcXow3QAxKwha` (8B: pale row action)
**Observed:** a ruled list of rows (title + muted metadata) each with **one pale gray button** at the far right ("APPLY"): light fill, no border, small caps label. The lime cursor glow is decoration and is not taken.

**Source summary:** BorderHover glow layers, opacity transition 0.5s; filters immediate; rows static.

**What we built:** `RowActions`: one pale group (`--bg-subtle` fill, no border, radius 4) at the right of the row, hidden at rest and faded in over `--motion-fast` on row hover **or** keyboard focus inside the row. Label in sentence case (no letter-spaced caps). Buttons are real `<button>`s, Tab-reachable; ↵ / `c` / `s` act on the focused row.

## Eleken · `b136df2f789242cabc6bb9f9678d5f82` (10B: week scale)
**Observed:** a dotted horizontal rule with a small tick per week and "Week 545 … Week 550" labels under the ticks; bars below are pale gray for past weeks and dotted outlines for future ones; one orange sphere marks "now".

**Source summary:** the label row translates −30% → +20% of its width with scroll (smoothing 80); bars switch dotted→solid at fixed Lottie frames. Scroll-scrubbed, no user input.

**What we built:** `WeekRuler`: one tick per Monday on a hairline; month labels (not every week, to avoid crowding); break ranges shaded gray (summer lighter); the selected week marked by a gray handle; **ember only on the current-week (demo date) marker**. Interaction is ours (click/drag to scrub, ←/→, Home/End); settled-week change is emitted once per settle.

## Playground · `dcdab50fb7bc47d480acbacf3cee8c4c` (4A: record properties panel)
**Observed (frames 2–3, embedded app):** a record page "Riley Taylor / Contacted" with a right column "Details ▾" holding label/value rows (Stage · Contacted, Owner · George…, Primary contact · …), a muted label column ~⅓ wide, values in ink, hairlines between groups, and a "Show more" link. A second group ("Guardians") has its own header and "+ Add".

**Source summary:** the header mega-menu: opacity 0→1, y −10→0, spring 0.4s bounce 0.2 (not taken: bounce is banned).

**What we built:** `PropertyList`: two-column grid (label muted at `--text-sm`, value ink), optional group title, hairline between groups, long values truncate with a tooltip, empty value shows an em dash in tertiary text.
