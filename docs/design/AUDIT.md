# Design audit: Kindling console (before the upgrade)

Audited on branch `ui-upgrade` at `19e7830` (identical to `ui`), 2026-11-23. All screenshots are in `docs/design/before/`:
- `light-*` and `dark-*`: 1440×900, scored at the demo date. Drawers are captured at 1440×1800.
- `*-full.png`: whole pages.

Measurements below come from `frontend/src`: 4,333 lines, inline styles throughout, Tailwind loaded but unused.

## 1. What exists today

### Tokens (`src/index.css`)
| Group | What's there |
|---|---|
| Color | 16 variables, light only: `--paper #FAF8F5`, `--nav #F5F2ED`, `--card #FFF`, `--ink #1C1B19`, `--body #3A3833`, `--muted #6B6760`, `--line #E4E0D9`, `--row-divider`/`--break-shade #EFEBE5`, `--ember #E2572B` (+ chip bg/text), `--risk #B42318` (+ chip bg), `--steady #2F7D5B`, `--naive #9A958C` |
| Type | Inter (UI) and JetBrains Mono (numbers), from Google Fonts. Body 14px. No type tokens. |
| Space / radius / shadow / motion | **None.** All inline. |
| Dark theme | **None.** `dark-*.png` are byte-identical to `light-*.png`. |

### Type in practice
- **13 font sizes:** 10, 11, 12, 13, 14, 15, 16, 18, 22, 24, 28, 32, 40. The most used are 13 (72×) and 12 (68×).
- **4 weights:** 600 is the workhorse (48×). Then 500 (23×), 700 (5×), 400 (3×). Page titles are 28px/700 with no letter-spacing.
- **Numbers line up only because they're set in JetBrains Mono**, which is also used for dates ("Tue, Nov 17, 2026"), chips and table cells (21 uses). `font-variant-numeric: tabular-nums` appears in 1 file.
- **One all-caps, letter-spaced label** (MondayBrief:130).

### Color in practice
- Tokens are used well (157× `--muted`, 71× `--ink`).
- But components still hold **7 raw hex** values, including Slack/LinkedIn/Gmail brand colors in Prospects, plus **9 hand-written rgba shadows**.
- **Ember does several jobs:**
  - brand mark;
  - "Ready" status;
  - links ("View all");
  - the primary CTA ("Snapshot");
  - sidebar badges;
  - the Kindling chart series.
- **Contrast:**
  - ember text on paper is 3.5:1, and white on an ember button is 3.7:1. Both fail AA for normal text.
  - `--naive` gray as text is 3.0:1, which fails.
  - ink, muted, risk, steady and the chip pairs pass.

### Shape, depth and motion
- **10 different corner radii:** 1, 2, 3, 4, 6, 8, 10, 12, 20, 50%. Radius 12 (15×) wraps almost every section.
- **Shadows:** on the drawer (`-8px 0 32px`), tooltips and the active nav item.
- **Motion:** almost none. There's a skeleton pulse, three 100–150ms hover/opacity transitions, and a 150ms fade on the drawer overlay. Changing `as_of` swaps every number and row instantly.

### Components (all inline-styled, all one-offs)
- App shell: a 220px warm sidebar with an orange square as the logo, plus a header with the title, a native `<input type="date">` and an "n8n" pill.
- Stat tiles (Brief, Pipeline, Backtest summaries), score chip, reason list with points, status pill (Automations), filter toggles (Ready, At risk).
- Tables: hand-rolled in each screen, with no shared component.
- The drawer and its 5 chart and detail components, the backtest results table, source stamp and weekly chart, skeletons.

## 2. "Vibecoded" tells from the banned list: what's present
| Tell | Present? | Where (screenshot) |
|---|---|---|
| Everything wrapped in rounded cards with shadows | **Yes (bordered, mostly without shadows).** Every screen section is a white radius-12 card on paper; Backtest nests cards inside cards | `light-01-brief`, `light-07-backtest`, `light-09-pipeline`, `light-10-automations` |
| Card grids of identical tiles | **Yes.** 4 identical KPI tiles (Brief), 2 giant-number tiles (Pipeline), 2×2 summary mini-cards (Backtest) | `light-01-brief`, `light-09-pipeline`, `light-07-backtest` |
| Icon-in-a-colored-circle stat tiles | No | |
| Purple/blue gradients, glass, glows, gradient text, blobs | No | |
| Emoji | **Minor.** "✓ Sent", "✓ Marked contacted" (Streamlit backup has emoji) | drawer footer |
| Default shadcn/Tailwind look; decorative lucide icons | No icons. But **native browser controls**: the date input (mm/dd/yyyy, OS chrome), "Show schools ▼" glyphs | header on every screen, `light-09-pipeline` |
| Rainbow badges (>1 accent + status) | **Yes.** Ember (accent and Ready), red badges, green pills, plus Slack purple / LinkedIn blue / Gmail red outreach buttons | `light-08-prospects` (outreach bar), sidebar |
| Colored left-border "alert" cards | **Yes.** At-risk rows get `inset 3px red`; MissingRuns has `borderLeft 3px red` | `light-04-at-risk` |
| Centered everything | No. Left-aligned throughout (good) | |
| Equal visual weight / no hierarchy | **Yes.** 4 equal tiles; 85 ready rows each with 3 equally weighted reason lines; every section header the same weight | `light-02-ready-full` (6,500px), `light-01-brief` |
| Giant numbers with no context | **Partly.** Pipeline's "76" / "9" with "No earlier snapshot to compare" | `light-09-pipeline` |
| Placeholder copy / generic empty states | **Partly.** No "Lorem", but analyst copy where a rep needs plain language: "PQL backtest", "recall (churners)", "flagged that converted", "PQL score 60 or higher". Empty states are plain paragraphs in cards | `light-07-backtest`, `light-09-pipeline` |
| Animating everything on load; bouncy; slow | No. The opposite problem: no motion explains anything | |

## 3. Keep
- **Information architecture:** 7 screens, sidebar order, "Monday brief" as home, drill-down into one drawer, URL state (`?screen`, `as_of`, `school`).
- **Data honesty:** every number from the API, reasons with points, backtest tables with source / run / commit, and the rows where naive wins.
- **The drawer's content model:** the usage chart with the school's own breaks, both windows drawn under it, the day-by-day close-up, the sentence that explains the change, and the Kindling vs naive score history. This is the strongest thing in the product (`light-06-drawer-jan5`).
- **The warm paper palette and Inter.** The warmth is what separates Kindling from generic gray SaaS. It needs a scale, not a replacement.
- **One accent color as an idea:** ember. It just needs to stop doubling as a status color and as link text.
- **Status words next to color** (DESIGN.md rule), and left alignment everywhere.

## 4. Top 10 problems, ranked by impact
1. **Box soup.** Every section is a white rounded card on paper, and Backtest nests cards in cards. Structure comes from boxes instead of alignment, hairlines and whitespace, which is the single biggest "template" signal. *(light-01, -07, -09, -10)*
2. **Ember does five jobs.** It's the brand, a status ("Ready"), link text, the CTA and a chart series. There's no single "act on this" color. Small ember text fails AA (3.5:1), and the outreach bar adds three third-party brand colors. *(light-01, -08)*
3. **No type system.** 13 sizes, 600 as the default weight, 28px/700 titles with no tracking. Monospace is used for dates and labels as well as numbers, so everything reads as equally loud and slightly "code-y". *(all)*
4. **Ranked lists are walls, not tables.** Ready is 85 rows × 3 reason lines (6,500px) with no sticky header, sort, keyboard navigation or visual score. "These 9 matter this week" is lost in the length. *(light-02-full, light-04-full)*
5. **The Brief doesn't brief.** Four equal tiles and two lists. Nothing says what changed since last week (no deltas, no sparklines), and there's no one-sentence summary a rep can act on. *(light-01)*
6. **Nothing explains change.** Changing `as_of` swaps every number and row instantly. The drawer pops in. There's no hover or press feedback beyond a background tint. *(behavior; no screenshot)*
7. **Native and unstyled controls.** The OS date input (mm/dd/yyyy) is the main control of the whole app. "Show schools ▼" uses text glyphs. The header's "Last n8n run · Nov 17, 2026" shows a real-world date next to a simulated one, which confuses. *(header, light-09)*
8. **Backtest reads like a lab report.** It's 5,700px of cards. The summary cards repeat table rows, and the copy is analyst-speak. The story ("Kindling: 0 false alarms where the naive model hit 98%") isn't the headline. *(light-07, light-07-full)*
9. **No tokens beyond color, and no dark theme.** 10 radii, ad-hoc paddings (`12px 16px`, `10px 14px`, `5px 10px`, …), hand-written shadows, 7 raw hex values in components. Nothing enforces consistency. *(dark-* identical to light-*)*
10. **Alert styling and secondary screens.**
    - Red left-border rows on At risk.
    - Pipeline's giant numbers with no context.
    - Automations: duplicate runs, numbers left-aligned in mono.
    - Generic empty states, all inside cards.

    *(light-04, -09, -10)*

Also noted, for the lanes: the JS bundle is ~700 kB (a single chunk); the drawer is 720px wide with no transition origin; tables don't truncate long school names.
