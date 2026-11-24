# Design: Kindling

The source of truth for how Kindling looks and moves. Decisions and references are recorded here (2026-11-23, run `kindling-ui-upgrade`). Tokens and components (§5–§6) are filled in by Phase 1, from `frontend/src/design/tokens.css`.

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
*(Phase 1 fills this from `frontend/src/design/tokens.css`. It evolves the existing tokens: color layers and text levels, the hairline, one accent, the status set, AA contrast in light and dark, type scale, 8px spacing, a small radius scale.)*

## 6. Components
*(Phase 1 fills this. Base components, each with default, hover, focus, disabled, loading, empty and error states, rendered on the dev-only `/__styleguide` route.)*

## 7. Rules
- **Tokens only.** No raw hex, px or ms values in components. `npm run lint:tokens` enforces it (rules and allowlist in §5).
- **Reuse before creating.** Screens import from the base components; a new pattern needs a DESIGN.md entry first.
- **Every state is designed:**
  - loading: skeletons shaped like the content;
  - empty: one sentence saying what would be here, plus one action;
  - error: what failed, plus retry;
  - long names: truncate, with the full name in a tooltip;
  - 0 and 1 items.
- **Microcopy is for a rep or CSM:** "9 schools ready to buy this week", not "PQL results".
- **The data contract is frozen** (`frontend/src/types.ts`). Keep URL state (`?screen`, `as_of`, `school`). Keep the drawer props `{ type, school, onClose }`.

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
