# Options: Kindling UI upgrade

**Final picks (Dhruv, 2026-11-23):**
- **Structure:** 1A, 2A, 3B (Brief), 3A (Backtest), 4A + 4C pager, 5A (drawer chart), 5B (Backtest bars)
- **Motion:** 6A, 7A, 8A + 8B, 9A, 10B
- **Drawer:** [Preymaker](https://www.details.so/inspo/preymaker-7fad24) (`d653fb4471a2412a8e4d903b8e7fad24`), not 6C
- **Kept as behavior specs, no reference needed:** 6D's "Next school →" footer and 9B's in-place week stepping
- **Color rule:** a reference's colors never disqualify it, because we take motion only
- Everything is recorded in `DESIGN.md`. This file is the option history.

**Rule (Dhruv, Phase 0 corrections):**
- **App structure** follows real products: Linear for lists, sidebar and keyboard; Attio for the record panel; Stripe for stat rows.
- **details.so** is used **only for motion and detail feel.**
- Every details.so reference below is a real catalog entry, with its ID and link copied from Details search results.
- We take patterns only, never logos or brand text.
- Images are in `docs/design/refs/`.

**Verification:**
- Structure IDs: recorded by research agent R1 from its search results. 6 of 14 were cross-checked against the orchestrator's own searches (Linear, Heimdall, xAI, Obsidian, Eleken).
- Motion IDs: from the orchestrator's 6 searches on 2026-11-23.
- `get_inspiration` hasn't been called for any entry yet. It runs for each picked entry before Phase 1 implementation.

## Locked structure picks (slots 1–5)
| Slot | Pick | Real-product pattern | details.so entry (pattern image) | Image |
|---|---|---|---|---|
| 1 Shell | **1A**: grouped sidebar; the week-step date pager moves into the top bar | Linear sidebar: groups, counts, keyboard | [linear-445982](https://www.details.so/inspo/linear-445982) · `9627d9b834f34941aa28a0eeb7445982` | `1A-linear-grouped-sidebar-shell.jpg` |
| 2 Table | **2A**: columned table, sticky header, sort, skeleton rows, keyboard j/k | Linear list views | [sui-xkpnkz](https://www.details.so/inspo/sui-xkpnkz) · `Y0VPNY276UbNgPlkXkpnKz` | `2A-sui-columned-table-skeleton-rows.jpg` |
| 3 Stats | **3B** for the Brief (a number with a context line) | Stripe dashboard metric + comparison line | [auar-ccda21](https://www.details.so/inspo/auar-ccda21) · `cbd2a5b294bd45fe8925c9d1abccda21` | `3B-auar-number-with-context-line.jpg` |
| 3 Stats | **3A** for the Backtest (ruled four-stat row) | Stripe stat rows | [stripe-11c89a](https://www.details.so/inspo/stripe-11c89a) · `72fa6ef47c9c457c8dca22242e11c89a` | `3A-stripe-ruled-four-stat-row.jpg` (cropped; gradient excluded) |
| 4 Drawer | **4A**: record properties panel | Attio record panel: label/value property rows | [tryplayground-ee8c4c](https://www.details.so/inspo/tryplayground-ee8c4c) · `dcdab50fb7bc47d480acbacf3cee8c4c` | `4A-playground-record-properties-panel.jpg` |
| 4 Drawer | **+ the pager from 4C**: j/k between schools inside the drawer | Linear issue view: "3 / 9 ↑↓" | [linear-445982](https://www.details.so/inspo/linear-445982) (same entry as 1A) | `4C-linear-record-view-pager.jpg` |
| 5 Charts | **5A** for the drawer chart | Line chart with grouped bars | [index-79fc47](https://www.details.so/inspo/index-79fc47) · `926aafb981e2477e972d50500c79fc47` | `5A-index-line-chart-grouped-bars.jpg` |
| 5 Charts | **5B** labeled hero bar for the Backtest | One labeled comparison bar per metric | [effortel-davmwm](https://www.details.so/inspo/effortel-davmwm) · `vv6RCiVeskBADYBiDAVmwm` | `5B-effortel-labeled-hero-bar.jpg` |

**Not picked, kept for the record:**
- 1B: [obsidianos-78c05c](https://www.details.so/inspo/obsidianos-78c05c)
- 2B: [zero-ab728b](https://www.details.so/inspo/zero-ab728b)
- 2C: [heimdallpower-umpqfx](https://www.details.so/inspo/heimdallpower-umpqfx)
- 3C: [x-d21f0f](https://www.details.so/inspo/x-d21f0f)
- 4B: [steven-8ae226](https://www.details.so/inspo/steven-8ae226)
- 5C: [eleken-8d5f82](https://www.details.so/inspo/eleken-8d5f82)

Full notes: `research/R1-slots-1-5.md`.

## Motion options (slots 6–10): pick one per line
Searches were the categories you named, each filtered to SaaS and Minimal. Rejected: everything theatrical, which covers most of the catalog (stepped wipes, full-screen color blocks, preloaders, glyph scrambles, image zooms).

### 6. Page transitions (switching screens)
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **6A** | [V7 Labs](https://www.details.so/inspo/v7labs-9f6e6d) · `09667cf64a0f4ecdad4fa77b2c9f6e6d` · `6A-v7labs-crossfade-page-transition.jpg` | Header and nav stay still; the outgoing page fades out while the incoming one fades in with a brief overlap. No movement at all. | The calmest possible switch; a rep jumping between screens all day never waits on it | Marketing site; we'd run it in ≤180ms |
| **6B** | [Effortel](https://www.details.so/inspo/effortel-j2zojx) · `VFSLvsLzQXoQpXyfj2ZoJX` · `6B-effortel-dim-to-full-page-transition.jpg` | Nav fixed; the new page arrives dimmed and resolves to full strength, headline first. | Slightly more "arrival" feel; the title settles before the table | Tagged Corporate, not Minimal |

### 6+. Drawer open (row to school detail, contextual transition). Not one of the 10 slots, but it's the most important motion in the app
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **6C** | [ONTO](https://www.details.so/inspo/studio-onto-swzj3c) · `p3fzlTmm5sgzCU4jsWzj3c` · `6C-onto-panel-grows-from-origin.jpg` | The panel grows out of the clicked item's own box, and its title stays readable throughout. We stop at drawer width (640px) instead of full screen. | The school you clicked visibly becomes the drawer: name and score keep their place | Portfolio site; the source grows to full viewport, we won't |

No details.so category is named "Drawer" (the search said so), hence the contextual-transition entries.

### 7. Number change + list reorder (changing `as_of`)
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **7A** | [Lassie](https://www.details.so/inspo/lassie-192f2b) · `9fc27e0cc796475cbfbe169634192f2b` · `7A-lassie-count-through-values.jpg` | A big figure counts through intermediate values to its new value (2% → 41% → 96% → 98%), with no scramble, on a warm off-white page. | The same warm, quiet register as Kindling's paper palette. A date change counts 9 to 11 | Serif display type; we keep Inter |

**Gap:** no catalog entry shows a list reordering. Rows sliding to their new rank uses motion's layout animation, Linear-style, per the run spec.

### 8. Hover / press / focus micro-interactions
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **8A** | [Linear](https://www.details.so/inspo/linear-445982) · `9627d9b834f34941aa28a0eeb7445982` · `8A-linear-nav-hover-highlight.jpg` | A soft, low-contrast rounded highlight under the hovered nav item, which travels between items; dark panels open below. | The sidebar and table rows get one consistent hover language | Same entry as 1A and 4C |
| **8B** | [Terminal Industries](https://www.details.so/inspo/terminal-industries-axkwha) · `ecSttagJdpcXow3QAxKwha` · `8B-terminal-rows-with-quiet-action.jpg` | A bordered stack of rows: title and metadata, with one pale action button at the right of each. | The model for "quick actions on the row" (Open · Copy email · Send) without loud buttons | Careers page; the clip doesn't show hover timing |

### 9. Loading + empty states
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **9A** | [Paradigm (table)](https://www.details.so/inspo/paradigmai-586452) · `274e851af7a54b8395cc6212b2586452` · `9A-paradigm-table-populating-cells.jpg` | The table shows its "generating / analyzing" states, then cells fill progressively. No spinner. | Skeleton rows the shape of the real rows that fill in reading order on first load | Same site as 9B |

**Gap:** no empty-state references in the catalog. Empty states follow the real-product pattern: one sentence saying what would be here, plus one action.

### 10. Date control (the `as_of` week pager in the top bar)
| | Entry | We'd take | Why it fits Kindling | Caveat |
|---|---|---|---|---|
| **10B** | [Eleken](https://www.details.so/inspo/eleken-8d5f82) · `b136df2f789242cabc6bb9f9678d5f82` · `10B-eleken-week-scale.jpg` | A horizontal week scale. | A school-year ruler under the pager: one tick per Monday, breaks marked, drag or click to scrub | Same entry R1 had as 5C |

## Removed for color (Dhruv, 2026-11-23)

Each was removed because the reference itself is colorful. The images moved to `refs/removed-colorful/`.

- **6D**: full-color architectural photography (blue sky, imagery fills the viewport)
- **7B**: red dotted-ring graphic as the focal element
- **9B**: blue / orange processing indicators and colored result cells
- **10A**: purple illumination around the cards (also a banned 'glow' tell)

**Remaining after removal:**
- **6:** 6A, 6B (page) · 6C (drawer open)
- **7:** 7A only
- **8:** 8A, 8B
- **9:** 9A only
- **10:** 10B only (it has one small orange sphere; otherwise gray)

**Note:** by the same measure (Hasler–Süsstrunk colorfulness on the preview frame), the most colorful references overall are the locked structure picks 2A (49), 3B (119), 4A (50) and 5B (48). They stay locked; only their layout carries over.

## Appendix: every result each motion search returned (in order; Details guidance)
- **Page transition:**
  [V7 Labs](https://www.details.so/inspo/v7labs-9f6e6d) ·
  [Optikka](https://www.details.so/inspo/optikka-j9ctvi) ·
  [Dapper](https://www.details.so/inspo/dapper-k6fgiu) ·
  [Good Fella](https://www.details.so/inspo/good-fella-qiwcrb) ·
  [Geolava](https://www.details.so/inspo/geolava-05e0e1) ·
  [Terminal Industries](https://www.details.so/inspo/terminal-industries-opkzf0) ·
  [NEVERHACK](https://www.details.so/inspo/neverhack-j4z2yh) ·
  [Effortel](https://www.details.so/inspo/effortel-j2zojx) ·
  [Steven](https://www.details.so/inspo/steven-89b1eb) ·
  [Tesoro](https://www.details.so/inspo/tesoroxp-qyitca)
- **Contextual transition:**
  [Dropbox](https://www.details.so/inspo/dropbox-k6uhoa) ·
  [Cyphr](https://www.details.so/inspo/cyphr-zu6emz) ·
  [ONTO](https://www.details.so/inspo/studio-onto-swzj3c) ·
  [Clément Grellier](https://www.details.so/inspo/clementgrellier-y6ovjt) ·
  [TrueKind](https://www.details.so/inspo/truekindskincare-879mkl) ·
  [Made in UX Studio](https://www.details.so/inspo/madeinuxstudio-j8xr64) ·
  [Dgrees](https://www.details.so/inspo/dgrees-xkpznt) ·
  [Composites](https://www.details.so/inspo/composites-xlctm9) ·
  [Fluid Glass](https://www.details.so/inspo/fluid-86b272) ·
  [Tomoya Okada](https://www.details.so/inspo/tomoyaokada-69mk94)
- **Drawer** (no category match):
  [ToDesktop](https://www.details.so/inspo/todesktop-cdd52b) ·
  [Framer](https://www.details.so/inspo/framer-348038) ·
  [Brew](https://www.details.so/inspo/brew-14ee30) ·
  [Paradigm](https://www.details.so/inspo/paradigmai-586452) ·
  [Twenty](https://www.details.so/inspo/twenty-4097db) ·
  [Adaline](https://www.details.so/inspo/adaline-iqefqb) ·
  [Fora](https://www.details.so/inspo/fora-1fb06c) ·
  [Obsidian](https://www.details.so/inspo/obsidianos-78c05c) ·
  [Linear](https://www.details.so/inspo/linear-445982) ·
  [Flowty](https://www.details.so/inspo/flowty-62bdcf)
- **Stats:**
  [Lassie](https://www.details.so/inspo/lassie-192f2b) ·
  [Flabbergast](https://www.details.so/inspo/flabbergast-unvuzt) ·
  [xAI](https://www.details.so/inspo/x-d21f0f) ·
  [Heimdall Power](https://www.details.so/inspo/heimdallpower-umpqfx) ·
  [Aave](https://www.details.so/inspo/aave-117ac9) ·
  [Antimetal](https://www.details.so/inspo/antimetal-aca29b) ·
  [Duna](https://www.details.so/inspo/duna-ad4e22) ·
  [Stripe](https://www.details.so/inspo/stripe-b18509) ·
  [Good Fella](https://www.details.so/inspo/good-fella-48zln5) ·
  [NEVERHACK](https://www.details.so/inspo/neverhack-j9s1o8)
- **Rows:**
  [U x Machina](https://www.details.so/inspo/uxmachina-d9x2xp) ·
  [Ponder](https://www.details.so/inspo/ponder-8e62ef) ·
  [Terminal Industries](https://www.details.so/inspo/terminal-industries-axkwha) ·
  [Made With GSAP](https://www.details.so/inspo/madewithgsap-xlgmbn) ·
  [OhMD](https://www.details.so/inspo/ohmd-9b7a85) ·
  [Vooban](https://www.details.so/inspo/vooban-cviw7m) ·
  [MyHealthPrac](https://www.details.so/inspo/myhealthprac-j8oqb6) ·
  [Grail](https://www.details.so/inspo/grail-app-7b504d) ·
  [Roboto Studio](https://www.details.so/inspo/robotostudio-on6gva) ·
  [Vooban (stats)](https://www.details.so/inspo/vooban-j4s7te)
- **Morphing** (no category match):
  [Flowty](https://www.details.so/inspo/flowty-62bdcf) ·
  [Twenty](https://www.details.so/inspo/twenty-9ddfa0) ·
  [Framer](https://www.details.so/inspo/framer-348038) ·
  [Jitter](https://www.details.so/inspo/jitter-mo81ef) ·
  [Paradigm](https://www.details.so/inspo/paradigmai-fe0a99) ·
  [Adaline](https://www.details.so/inspo/adaline-iqeevj) ·
  [Antimetal](https://www.details.so/inspo/antimetal-9d75e8) ·
  [Modulify](https://www.details.so/inspo/modulify-dbe630) ·
  [Medusmo](https://www.details.so/inspo/medusmo-d8rim0) ·
  [Eleken](https://www.details.so/inspo/eleken-8d5f82)

More results are available for each search (`hasMore: true`). Ask for "more" on a slot and I'll page with that search's `nextSearchArguments`.
