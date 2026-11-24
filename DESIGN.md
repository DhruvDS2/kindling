# Design: Kindling

The source of truth for how Kindling looks and moves. Decisions and references are recorded here (2026-11-23, run `kindling-ui-upgrade`). Tokens and components (§5–§6) were filled in by Phase 1, from `frontend/src/design/tokens.css` and `frontend/src/design/components/`.

## 1. Principles
- **An internal tool a rep opens on Monday morning.** It should feel like a precise, warm, calm B2B product (the bar: Linear, Attio, Vercel, Height), not a marketing site and not a template.
- **Every number has its reason next to it, and every number comes from the API at runtime.** Nothing on screen is typed into the code.
- **Structure comes from alignment, hairlines and whitespace, not boxes.**
- **One accent (ember) marks "the thing to act on".** Status colors are only for status, and every status also has a word: "Ready", "At risk", "Healthy". Color is never the only signal.
- **Motion only explains change:** what's new, what moved, where a panel came from. It is restrained, never bouncy, never decorative.
- **We take motion and structure from references, never their colors, imagery, logos or text.** A reference's colors never disqualify it.

## 2. References (picked by Dhruv; patterns only)
All are details.so entries with their stable ID. Each lane calls `get_inspiration` on its entries before implementing. The reference frames are kept locally in `docs/design/refs/` (gitignored: they're third-party screenshots and this repo is public). Full option notes: `docs/design/OPTIONS.md`.

### Structure
| Slot | Pick | What we take | Details entry (slug · ID) |
|---|---|---|---|
| Shell | 1A | Grouped sidebar (Linear-style groups, counts, keyboard). The week pager lives in the top bar | [linear-445982](https://www.details.so/inspo/linear-445982) · `9627d9b834f34941aa28a0eeb7445982` |
| Table | 2A | Columned table: sticky header, sortable columns, skeleton rows, keyboard j/k | [sui-xkpnkz](https://www.details.so/inspo/sui-xkpnkz) · `Y0VPNY276UbNgPlkXkpnKz` |
| Brief stats | 3B | A number with one context line under it | [auar-ccda21](https://www.details.so/inspo/auar-ccda21) · `cbd2a5b294bd45fe8925c9d1abccda21` |
| Backtest stats | 3A | A ruled four-stat row | [stripe-11c89a](https://www.details.so/inspo/stripe-11c89a) · `72fa6ef47c9c457c8dca22242e11c89a` |
| Drawer content | 4A | Record properties panel: label/value rows (Attio-style) | [tryplayground-ee8c4c](https://www.details.so/inspo/tryplayground-ee8c4c) · `dcdab50fb7bc47d480acbacf3cee8c4c` |
| Drawer pager | 4C | "2 of 4" with j/k between records inside the panel | [linear-445982](https://www.details.so/inspo/linear-445982) · `9627d9b834f34941aa28a0eeb7445982` |
| Drawer chart | 5A | Line plus grouped bars | [index-79fc47](https://www.details.so/inspo/index-79fc47) · `926aafb981e2477e972d50500c79fc47` |
| Backtest bars | 5B | One labeled hero bar per metric | [effortel-davmwm](https://www.details.so/inspo/effortel-davmwm) · `vv6RCiVeskBADYBiDAVmwm` |

### Motion
| Slot | Pick | What we take | Details entry (slug · ID) |
|---|---|---|---|
| Page transitions | 6A | Nav and header stay still; the outgoing page fades out while the incoming one fades in, with a brief overlap. No movement | [v7labs-9f6e6d](https://www.details.so/inspo/v7labs-9f6e6d) · `09667cf64a0f4ecdad4fa77b2c9f6e6d` |
| Drawer | Preymaker | Panel look, scrim and open/close motion only (adapted in §3.1). The content layout stays 4A plus 4C | [preymaker-7fad24](https://www.details.so/inspo/preymaker-7fad24) · `d653fb4471a2412a8e4d903b8e7fad24` |
| Number change | 7A | A figure counts through intermediate values to its new value. No scramble | [lassie-192f2b](https://www.details.so/inspo/lassie-192f2b) · `9fc27e0cc796475cbfbe169634192f2b` |
| Hover | 8A | A soft, low-contrast highlight that travels between hovered items (nav and rows) | [linear-445982](https://www.details.so/inspo/linear-445982) · `9627d9b834f34941aa28a0eeb7445982` |
| Row actions | 8B | One pale action button on the row (scope in §3.4) | [terminal-industries-axkwha](https://www.details.so/inspo/terminal-industries-axkwha) · `ecSttagJdpcXow3QAxKwha` |
| First load | 9A | Skeleton rows shaped like real rows, filling in reading order. No spinner | [paradigmai-586452](https://www.details.so/inspo/paradigmai-586452) · `274e851af7a54b8395cc6212b2586452` |
| Date control | 10B | A week ruler (scope in §3.5) | [eleken-8d5f82](https://www.details.so/inspo/eleken-8d5f82) · `b136df2f789242cabc6bb9f9678d5f82` |

## 3. Behavior specs
### 3.1 Drawer (Preymaker motion, 4A content, 4C pager)
- **Look:** a flat, full-height right panel on our surface color. No shadow, no rounded corners. Hairline rules separate sections. A warm-ink scrim dims the list behind it but leaves it legible, because the pager steps through that list.
- **Open:** a clip-path wipe in from the right edge, `inset(0 0 0 100%) → inset(0)`, over **slow** with the **enter** easing. The scrim fades in over **base**. The header (name, score, status) rises through its own clip, and section hairlines grow from their left edge. Total ≤ slow.
  - Preymaker's own timing (open 1.75s, scrim 1.5s, close 1.25s, staggered link entrances) is not used. It breaks the 400ms ceiling.
- **Close:** the wipe retracts to the right over **base** with the **exit** easing, and the scrim fades out. Pointer events are cleared immediately on close, so the list responds at once.
- **Keys:** Esc closes; j/k (and ↑/↓) move to the previous or next school in the list the rep came from. Focus is trapped inside while open and returns to the originating row on close. The URL `?school=` follows the open school.
- **Footer:** a "Next school →" link (the pattern from 6D) does the same as `j`. It is hidden on the last school.
- **Pager change:** the header text swaps in place and the body cross-fades over **base**. The panel does not re-wipe.
- **Reduced motion:** opacity fades only. No clip and no movement.
- **Props stay `{ type, school, onClose }`.**

### 3.2 Week stepping (the behavior from 9B; no reference)
- After first load, changing `as_of` **never** shows skeletons again.
- The current table stays visible, and a quiet inline "Updating…" mark appears next to the date. When the new data arrives:
  - rows swap in place;
  - rows that changed rank slide to their new position (layout animation, **slow**, enter easing);
  - numbers count through to their new values (7A, **base**).
- Rows that newly cross the Ready or At-risk line get a single, brief background tint. Nothing else animates.

### 3.3 Number change (7A)
- Numbers count through intermediate values to the target over **base**, using tabular figures, so the width never jumps.
- First load counts up once over **reveal**. With reduced motion, numbers swap instantly.

### 3.4 Row actions (8B scope)
- Exactly one pale action group appears at the right of a row on hover **or keyboard focus**: Open · Copy email · Send to Slack.
- It fades in over **fast**. Each action is reachable with Tab, and the shortcuts work on the focused row: ↵ opens, `c` copies the email, `s` sends.
- "Send to Slack" posts for real (`POST /notify/slack`). It confirms with a toast and is never auto-fired.

### 3.5 Week ruler (10B scope)
- **Position:** it sits under the top-bar week pager.
- **Ticks:** one tick per Monday of the school year (from `/meta` and `/calendars/{shared}`). Breaks are shaded, and summer is shaded more lightly.
- **Scrubbing:** click or drag to scrub. Scrubbing drives the 7A count-through and the row reorder (§3.2), debounced to one request per settled week.
- **Color:** gray only. **Orange (ember) is used only for the current-week marker.**
- **Keys:** with the ruler focused, ←/→ step a week, and Home/End jump to the first or last Monday.

### 3.6 Hover / focus (8A)
- One hover language everywhere: a soft, low-contrast background that travels between items (nav and table rows) over **fast**.
- Focus is a 2px ember ring (focus-visible only). Press darkens one step.

### 3.7 Page transitions (6A)
- The nav and top bar stay still. Content cross-fades with a short overlap, using the View Transitions API where supported and a plain fade elsewhere, ≤ 180ms. No movement.

## 4. Motion tokens (fixed by the run spec)
| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | Hover, press |
| `--motion-base` | 200ms | State changes, number count, close |
| `--motion-slow` | 320ms | Panels, pages, row reorder |
| `--motion-reveal` | 600ms | Charts and first-load reveals, once |
| `--ease-enter` | cubic-bezier(0.2, 0.8, 0.2, 1) | Anything appearing or moving in |
| `--ease-exit` | cubic-bezier(0.4, 0, 1, 1) | Anything leaving |

No bounce or overshoot, and no UI transition over 400ms. `prefers-reduced-motion: reduce` means fades only. Libraries: `motion` (motion.dev) for layout and shared transitions; the View Transitions API for route changes.

## 5. Tokens
Source: `frontend/src/design/tokens.css` (the only file allowed raw values). It evolves the pre-upgrade palette rather than replacing it: the warm paper, ink and ember stay; the old names were kept as deprecated aliases during Phase 2 and **removed in Phase 3** once no screen used them. Load order: `tokens.css` → `base.css` → `index.css` (in `main.tsx`).

**Theme.** Light by default. Dark applies when `<html data-theme="dark">` is set, or when the OS prefers dark and `data-theme="light"` isn't set. The dark palette is warm (brown-black, not blue-gray).

### Color
| Group | Token | Light | Dark | Use |
|---|---|---|---|---|
| Background | `--bg-page` | #FAF8F5 | #161513 | The paper every screen sits on |
| | `--bg-subtle` | #F4F1EC | #1B1A17 | Sidebar, segmented track, pale row actions |
| | `--bg-surface` | #FFFFFF | #1F1D1A | Drawer panel, inputs |
| | `--bg-raised` | #FFFFFF | #282521 | Tooltips, toasts (always with `--elevation-popover`) |
| | `--bg-hover` | #F1EDE7 | #25221F | The one travelling hover highlight (8A) |
| | `--bg-press` | #EBE6DF | #2B2824 | Press darkens one step; the open row |
| Text | `--text-primary` | #1C1B19 | #EDEAE4 | Names, values, titles |
| | `--text-secondary` | #4F4B45 | #BDB7AD | Body copy, subtitles |
| | `--text-tertiary` | #68635C | #9C968C | Labels, places, context lines |
| | `--text-disabled` | #A6A097 | #625D56 | Inactive controls only (exempt from 1.4.3; never content) |
| Lines | `--border-faint` | #EFEBE5 | #221F1C | Table row rules |
| | `--border-hairline` | #E4E0D9 | #2F2C28 | Section rules, panel edge |
| | `--border-strong` | #CDC6BB | #46423B | Control outlines, ruler ticks |
| Accent | `--accent` (ember) | #E2572B | #E2572B | Marks only: focus ring, the ready line, the current-week dot. **Never small text** |
| | `--accent-strong` | #B5421C | #F07A4F | AA-safe ember: accent text and the primary button fill |
| | `--accent-strong-press` | #9C3714 | #DE6A40 | Primary button hover/press |
| | `--accent-subtle` | #FBEAE2 | #33201A | The one-time "crossed the line" row tint |
| | `--accent-on` | #FFFFFF | #1A0F0A | Text on `--accent-strong` |
| Status | `--status-ready-fg` / `-bg` | #80560F / #F5ECD8 | #E0B25C / #2B2315 | Ready: warm ochre (hue 38°, distinct from ember at 14°) |
| | `--status-risk-fg` / `-bg` | #B42318 / #FBE9E6 | #F2877A / #301B18 | At risk |
| | `--status-healthy-fg` / `-bg` | #2A7353 / #E5F1EA | #6BC096 / #172820 | Healthy |
| | `--status-neutral-fg` / `-bg` | #68635C / #EFEBE5 | #A9A398 / #25231F | Not yet; the naive model |
| Data (non-text) | `--data-naive` | #9A958C | #7A746B | The naive series in charts |
| | `--data-break` / `--data-summer` | #ECE7E0 / #F3F0EB | #36322B / #2A2722 | Break shading; summer is lighter. Dark lifted in Phase 3: 1.32:1 / 1.13:1 against the surface, matching light's 1.23 / 1.14 |
| Other | `--focus-ring` | = `--accent` | = `--accent` | 2px ring, keyboard focus only |
| | `--scrim` | warm ink at 24% | black at 42% | Behind the drawer; the list stays legible |

**One accent.** Ember means "act on this": the primary button, the focus ring, the ready line and the current-week mark. "Ready" no longer uses ember: it has its own status color (ochre), and status colors are only ever used for status, always next to the status word.

**Old names, retired:** `--paper`, `--ink`, `--ember` and the rest were removed in Phase 3. AA changes they carried still hold: muted text #68635C (was #6B6760), secondary text #4F4B45 (was #3A3833), healthy #2A7353 (was #2F7D5B).

### Contrast (WCAG 2.x, computed from `tokens.css`)
Every text pair is AA (4.5:1) in both themes; the ember mark meets the 3:1 non-text minimum. 0 failures.

| Foreground (minimum) | Light | Dark |
|---|---|---|
| `--text-primary` (4.5) | page 16.2 · subtle 15.3 · surface 17.2 · raised 17.2 · hover 14.8 · press 13.9 | page 15.2 · subtle 14.5 · surface 14.0 · raised 12.7 · hover 13.2 · press 12.2 |
| `--text-secondary` (4.5) | page 8.2 · subtle 7.7 · surface 8.7 · raised 8.7 · hover 7.4 · press 7.0 | page 9.2 · subtle 8.7 · surface 8.4 · raised 7.7 · hover 7.9 · press 7.4 |
| `--text-tertiary` (4.5) | page 5.6 · subtle 5.3 · surface 6.0 · raised 6.0 · hover 5.1 · press 4.8 | page 6.2 · subtle 5.9 · surface 5.7 · raised 5.2 · hover 5.4 · press 5.0 |
| `--accent-strong` (4.5) | page 5.3 · subtle 5.0 · surface 5.6 · hover 4.8 · accent-subtle 4.8 | page 6.6 · subtle 6.3 · surface 6.1 · hover 5.7 · accent-subtle 5.6 |
| `--accent-on` (4.5) | on accent-strong 5.6 · on press 7.1 | on accent-strong 6.8 · on press 5.6 |
| `--status-ready-fg` (4.5) | page 6.1 · surface 6.4 · hover 5.5 · own bg 5.5 | page 9.3 · surface 8.6 · hover 8.1 · own bg 7.9 |
| `--status-risk-fg` (4.5) | page 6.2 · surface 6.6 · hover 5.6 · own bg 5.6 | page 7.4 · surface 6.8 · hover 6.4 · own bg 6.6 |
| `--status-healthy-fg` (4.5) | page 5.4 · surface 5.7 · hover 4.9 · own bg 4.9 | page 8.3 · surface 7.7 · hover 7.2 · own bg 7.1 |
| `--status-neutral-fg` (4.5) | page 5.6 · surface 6.0 · hover 5.1 · own bg 5.0 | page 7.3 · surface 6.7 · hover 6.3 · own bg 6.3 |
| `--accent` mark / focus ring (3.0, non-text) | page 3.5 · surface 3.7 · hover 3.2 | page 4.9 · surface 4.5 · hover 4.2 |

For comparison, before the upgrade ember text on paper was 3.5:1, white on the ember button 3.7:1, and `--naive` text 2.8:1. All three failed; none of those pairs is used for text any more.

### Type
Inter for everything; JetBrains Mono (`--font-mono`, class `.k-mono`) only for IDs and commit hashes. One display size, three text sizes, one label size. Letter-spacing tightens as size grows.

| Token | Size / line | Tracking | Weight | Use |
|---|---|---|---|---|
| `--text-display` | 28 / 32 | −0.022em | 500 | Page titles, stat values, the drawer's school name |
| `--text-lg` | 16 / 24 | −0.011em | 500 | Section titles |
| `--text-md` | 14 / 20 | −0.006em | 400 (500 for names) | Body, table cells |
| `--text-sm` | 13 / 18 | −0.003em | 400 | Secondary lines, nav items, property labels |
| `--text-label` | 12 / 16 | 0 | 400; **600 only for table header labels** | Table headers, pills, ruler months, tooltips |

Weights: `--weight-regular` 400, `--weight-medium` 500, `--weight-strong` 600 (table header labels only). No 700. Sentence case everywhere; no all-caps or letter-spaced labels.

**Tabular numerals:** every metric uses `font-variant-numeric: var(--numeric)` (`tabular-nums`) via `.k-num`. `Table` numeric columns, `NumberFlow`, `StatBlock`, `ScoreMeter`, nav counts and pager labels apply it themselves.

### Space, size, radius, elevation, layers
- **Space (8px scale with a 4px half-step):** `--space-0-5` 4 · `--space-1` 8 · `--space-1-5` 12 · `--space-2` 16 · `--space-3` 24 · `--space-4` 32 · `--space-5` 40 · `--space-6` 48 · `--space-8` 64 · `--space-10` 80.
- **Size:**
  - `--size-hairline` 1, `--size-focus-ring` 2;
  - icons 12/16; `--size-pill` 20;
  - controls 24/32; `--size-row` 40; `--size-meter` 96 (track 4, tick 12); `--size-ruler` 48;
  - `--size-topbar` 64, `--size-sidebar` 200, `--size-drawer` 640;
  - `--size-tooltip` 280, `--size-toast` 360, `--size-search` 240, `--size-row-actions` 288, `--size-content` 1200.
- **Radius:** `--radius-0` 0 (tables, panels, the drawer) · `--radius-1` 2 (bars, ticks) · `--radius-2` 4 (controls, pills, row actions) · `--radius-3` 6 (popovers, toasts). Nothing larger.
- **Elevation:** one token, `--elevation-popover`, for tooltips and toasts. The drawer has **no shadow**: just a hairline edge and the scrim (Preymaker).
- **Layers:** `--z-sticky` 2 · `--z-drawer` 40 · `--z-popover` 50 · `--z-toast` 60.

### Motion
Exactly §4: `--motion-fast` 120ms, `--motion-base` 200ms, `--motion-slow` 320ms, `--motion-reveal` 600ms, `--ease-enter`, `--ease-exit`.
- **Derived tokens, not new speeds:**
  - `--stagger-row` 30ms: first load, first 10 rows only;
  - `--stagger-cell` 12ms: reading order inside a row;
  - `--rise` 4px: the only entrance travel;
  - `--skeleton-pulse` 1600ms: the loading loop.
- **JS reads the same values** at runtime through `design/motion.ts` (`dur('slow')`, `ease('enter')`, `tr('base','exit')`), so CSS and motion.dev animations can't drift apart.
- **Reduced motion** (`prefers-reduced-motion: reduce`):
  - the stagger and `--rise` tokens become 0;
  - skeleton pulses and button spinners stop;
  - components that move or clip (Drawer, Table reorder, Nav/Tabs indicators, NumberFlow, Toast) check `useReduce()` and switch to fades or instant swaps.

## 6. Components
All in `frontend/src/design/components/`, exported from `frontend/src/design/index.ts`. Screens import from `design`, never from a component file. Classes use the `k-` prefix. Every one is rendered, in every state, on the dev-only **`/__styleguide`** route, with sample data and a light/dark switch. Screenshots: `docs/design/styleguide/styleguide-{light,dark}.png`. `npm run styleguide:check` runs the screenshots plus 14 behavior checks. Evidence for each reference: `docs/design/research/evidence-phase1.md`.

| Component | Purpose · key props | States covered | Motion | Reference |
|---|---|---|---|---|
| **AppShell**, **TopBar**, **Nav** | Sidebar + main column. `Nav({ groups: [{id, label?, items: [{id, label, count?}]}], activeId, onSelect, brand?, footer? })`; `TopBar({ title, subtitle?, actions?, below? })`: `actions` takes the WeekPager and UpdatingMark; `below` the WeekRuler | Default, hover, focus-visible, press, active (`aria-current="page"`); counts null / 0 / many; long labels truncate | One hover highlight travels between items via `layoutId` over fast; the active item keeps its own background | 1A, 8A (Linear) |
| **Table** | `Table<T>({ rows, columns: Column<T>[], rowKey, 'aria-label', loading?, error?, empty?, sort?/defaultSort?/onSortChange?, onOpen?, rowActions?, searchRef?, keyboard?: 'table'\|'page', dividers?, tintKeys?, selectedKey?, rowLabel?, onActiveChange?, stickyTop? })`. `Column`: `{ id, header, cell, numeric?, width?, sortValue?, firstDirection?, skeleton?, skeletonLines? }` | Sticky header; sortable headers with `aria-sort`; numeric columns right-aligned and tabular; skeleton (first load), empty (one sentence + action), error (what failed + retry), 1 row, long names (via `TruncatedText`), selected (open) row, divider line ("Ready line · score 60") | **Keys:** j/↓, k/↑ move, ↵ opens, Esc clears, `/` focuses search, single-key row-action shortcuts. **8A:** a highlight travels to the hovered or keyboard row over fast. **9A:** cells fill in reading order on **first load only** (rise + fade, base; rows 30ms apart, first 10). **§3.2:** after that no skeletons; rows slide to their new rank (`layout="position"`, slow, enter) and rows in `tintKeys` get one `--accent-subtle` tint that fades over slow after the slide | 2A (Sui), 8A, 9A (Paradigm) |
| **RowActions** (`Table` `rowActions`) | `[{ id, label, shortcut?, onSelect, disabled? }]`, e.g. Open ↵ · Copy email `c` · Send to Slack `s` | Hidden at rest; shown on row hover **or** keyboard focus; each a Tab-reachable `<button>`; disabled. Floats over the row's right end (or `reserveActions`) | Fades in over fast | 8B (Terminal) |
| **SearchField** | `({ value, onChange, placeholder?, onEscape? })`; pass its ref to `Table searchRef` | Empty with `/` hint, typing, focus ring | n/a | 2A |
| **StatBlock** | `({ label, value, format?, context?, sparkline?, loading?, error?, reveal? })`: a number with one context line | Value, loading (skeleton), error (red context line, value "—"), no value ("—" + reason) | Counts through on change (base); counts up once on first mount (reveal) | 3B |
| **StatRow** | `({ items: StatRowItem[] })`, one `emphasis` | Ruled row between hairlines, hairline dividers, one stat at full ink | As StatBlock | 3A |
| **Sparkline** | `({ values, label })` | ≥2 points; <2 renders nothing | none (lanes may reveal once) | 3B context |
| **NumberFlow**, **useCountThrough** | `NumberFlow({ value, format?, placeholder?, reveal? })`; `useCountThrough(target, { reveal })` | null → placeholder; screen readers get the settled value only | Count-through over base, enter easing; first mount over reveal; reduced motion: instant | 7A (Lassie) |
| **StatusPill** | `({ tone: 'ready'\|'risk'\|'healthy'\|'neutral', children })`; `statusTone(apiStatusWord)` | All four tones; the word is always printed | none | n/a |
| **ScoreMeter** | `({ value, threshold, max?, tone?, showValue?, thresholdLabel?, reveal? })`: **threshold always passed in** (`meta.thresholds.*`) | 0, at threshold, 100; all tones; value hidden; `role="meter"` with a spoken threshold | Fill scales over base; the number counts through | n/a |
| **Drawer**, **DrawerSection** | `Drawer({ open, onClose, title, meta?, pager?: { index, total, onPrev, onNext, label? }, contentKey?, footer?, nextLink?, returnFocusRef?, children })`. Generic: lane C's `AccountDetail` keeps `{ type, school, onClose }` and renders inside it | Open/closed, pager first/middle/last ("Next school →" hidden on last), long title wraps, footer busy button | **Open:** right clip wipe `inset(0 0 0 100%)→inset(0)` over slow, enter; scrim over base; title and meta rise through their own clips; hairlines grow from the left. **Close:** wipe retracts over base, exit; pointer events off immediately. **Pager:** header swaps in place, body cross-fades over base, no re-wipe. **Reduced motion:** opacity only. Focus trap, Esc, focus returns to the row, j/k ↑/↓ | Preymaker (motion), 4A, 4C |
| **PropertyList** | `({ title?, items: [{ label, value, numeric? }] })` | Long values truncate + tooltip; empty value shows "—" | none | 4A (Playground) |
| **Tabs**, **SegmentedControl** | `({ options: [{ id, label, count?, disabled? }], value, onChange, 'aria-label' })`; tabs = `tablist`, segmented = `radiogroup` | Selected, hover, focus, disabled, counts incl. 0; ←/→ Home/End | Indicator moves with `layoutId` over base | n/a |
| **Button**, **Kbd** | `Button({ variant: 'primary'\|'secondary'\|'quiet', size?, loading?, icon?, iconAfter?, shortcut? })` | Default, hover, focus, press, disabled, loading (busy mark, label kept, `aria-busy`), long label truncates | Colors over fast | n/a |
| **WeekPager** | `({ value, min, max, onChange, demoDate?, disabled? })`: ‹ Mon, Feb 2, 2026 ›, steps by Monday | Bounds disable ‹/›; "Demo date" reset when away from it | n/a | 1A top bar |
| **WeekRuler** | `({ mondays, value, onChange, onScrub?, breaks?, current?, disabled? })`; `mondaysBetween(meta.sim_start, meta.sim_end)` | Tick per Monday, month labels, breaks shaded (summer lighter), hover ghost, dragging, focus, disabled; `role="slider"` | Gray only; **ember only for the current-week dot**. Click/drag scrubs (`onScrub` live); ←/→, PageUp/PageDown, Home/End; `onChange` fires once per settled week (on release, or after keys pause for slow) | 10B (Eleken) |
| **UpdatingMark** | `({ active, label? })`: the quiet "Updating…" next to the date | Off, on; `aria-live` | Fades in after a base delay (fast responses never flash it), out over fast | §3.2 |
| **Tooltip**, **TruncatedText** | `Tooltip({ content, children, side? })`; `TruncatedText({ children })` shows the tooltip only when actually cut off, and is then focusable | Hover (after slow), keyboard focus (immediate), repositions on scroll/resize | Fade over fast | n/a |
| **Skeleton** | `({ width?, height?: 'line'\|'label'\|'display'\|'control' })` | Shapes for rows, stats, controls | Gentle pulse; still under reduced motion | 9A |
| **EmptyState**, **ErrorState** | `EmptyState({ children, action? })`: one sentence + one action. `ErrorState({ title, detail?, onRetry?, retrying? })`: what failed + retry | Left-aligned, no icon, no box; retry in flight | none | §7 |
| **ToastProvider**, **useToast** | `useToast()({ message, tone?, action? })`: bottom-left, ~5s, held on hover/focus | Neutral, success, error (`role="alert"`), with action, dismiss | Rise + fade in over base, fade out over fast | §3.4 confirmations |
| **PageView**, **usePageTransition** | `go(update)` wraps a screen change in a View Transition; `<PageView key={screen}>` is the region that fades | Supported → View Transition; otherwise a plain fade | Content only: out over fast, in over fast after half of that (180ms total, no movement); nav and top bar excluded | 6A |

**Wiring notes for the lanes:**
- `Table` is generic. Keep passing the previous rows while a new week loads (TanStack `placeholderData: keepPreviousData`), and it will never show skeletons again.
- Pass `dividers` only when sorted by score.
- Pass a **new** `Set` to `tintKeys` for the rows that crossed the line this week.
- The Drawer pager's `index`/`total` come from the list the rep opened it from; `Table onActiveChange` keeps the two in sync.

### 6.x Patterns added in Phase 2 (lane-local, built only from base components)
- **DrawerListContext** (`src/drawerList.tsx`). The list screens publish the ids of their visible rows in on-screen order. The drawer's 4C pager, j/k and "Next school →" read it. With no provider, there's no pager.
- **Section with a disclosure row** (`components/backtest/Section.tsx`). A section title with a short lede on the left and content on the right. Secondary tables and experiments sit behind a disclosure row: a chevron plus a one-line takeaway, opened with Enter or Space, with its height animated over **base**.
- **Hero bars** (`components/backtest/HeroBars.tsx`, 5B). One row per metric: a Kindling bar in ink over a naive bar in neutral, each with a labeled value. They grow once when scrolled into view (**reveal**) and are full immediately under reduced motion. Rows where naive wins are marked "naive ahead".
- **District before/after** (`components/backtest/DistrictExperiment.tsx`). A SegmentedControl switches the bars between "One national calendar" and "District calendars". Values morph and count through over **base**.
- **Usage, two panels** (`components/detail/Usage.tsx`, 5A). Active teachers as a line above weekly session bars on one shared time axis, with breaks and summer shaded from the school's own calendar. The School days / Calendar days toggle morphs the window markers and the change sentence.
- **Week ruler in the top bar** (`src/shell/ShellTopBar.tsx`). There's no pager or ruler on screens that don't depend on `as_of` (Backtest, Automations); Backtest shows its replay range instead.

## 7. Rules
- **Tokens only.** No raw hex, px or ms values in components; `npm run lint:tokens` enforces it.
  - **Flagged** in every `.ts`/`.tsx`/`.css` under `src/`, except `src/design/tokens.css`:
    - hex colors and `rgb()/rgba()/hsl()/hsla()`;
    - `<n>px`;
    - `<n>ms` and decimal seconds (`0.2s`);
    - numeric values for spacing, size, font, radius and duration props in TS style objects (`padding: 12`, `fontSize: 13`, `fontWeight: 600`, `duration: 0.2`);
    - numeric `font-weight`/`line-height`/`letter-spacing` in CSS.
  - **Allowlist:**
    - the values 0 and 1 (hairlines);
    - percentages;
    - flex, z-index, opacity and order numbers;
    - SVG geometry attributes in JSX (`viewBox`, `d`, `width={16}`, `strokeWidth={1.5}`, …);
    - px inside `@media`/`@container` conditions;
    - comments;
    - a line marked `lint-tokens-allow: <reason>` (unused so far).
  - **Output:** `file:line:col`, a per-folder summary, and a non-zero exit on any finding. `npm run lint:tokens -- src/design` checks one folder.
  - **Status:** `src/design/**` is at **0**. The rest of `src/` starts Phase 2 at a **baseline of 845** findings (`src/screens` 454, `src/components/detail` 146, `src/components/backtest` 143, top-level `src` files 56, `src/components` 46), and Phase 2 burns it down to 0.
- **Reuse before creating.** Screens import from the base components; a new pattern needs a DESIGN.md entry first.
- **Every state is designed:**
  - loading: skeletons shaped like the content;
  - empty: one sentence saying what would be here, plus one action;
  - error: what failed, plus retry;
  - long names: truncate, with the full name in a tooltip;
  - 0 and 1 items.
- **Microcopy is for a rep or CSM:** "9 schools ready to buy this week", not "PQL results".
- **The data contract is frozen** (`frontend/src/types.ts`). Keep URL state (`?screen`, `as_of`, `school`). Keep the drawer props `{ type, school, onClose }`.
- **The styleguide is dev-only.** `/__styleguide` loads only when `import.meta.env.DEV`; the production bundle contains none of it (verified by grepping `dist/`).

## 8. Banned ("vibecoded" tells)
- Everything wrapped in rounded cards with drop shadows; card grids of identical tiles; icon-in-a-colored-circle stat tiles
- Purple/blue gradients, glassmorphism, glows, gradient text, emoji, decorative blobs
- Default shadcn/Tailwind look left unstyled; default lucide icons sprinkled for decoration
- Rainbow badges (more than 1 accent + status colors); colored left-border "alert" cards
- Centered everything; equal visual weight everywhere (no hierarchy); giant numbers with no context
- Placeholder copy ("Lorem", "Dashboard", "Overview", "Welcome back!"); generic empty states
- Animating everything on load; bouncy/overshoot easing; slow (>400ms) UI transitions

## 9. Slack alert format (kept; produced by the API and n8n)
```
🟢 Larkspur Hollow Academy · PQL 84 · Ready
• 4 teachers active in the last 10 school days
• 230 student sessions
• Admin signed up 6 days ago
```
```
🔴 Juniper Bluff Prep · Health 38 · At risk · renews in 52 days · $9,600 ARR
• Active teachers down 60% vs. the prior 10 school days
• Student sessions down 71%
• Not explained by a school break
```
