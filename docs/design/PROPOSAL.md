# Proposal: Kindling UI upgrade

This proposal fixes the 10 problems in `AUDIT.md` without changing the information architecture, the data, or the warm palette.

**Wireframes** assume a 1440×900 viewport and the demo date.

**Structure picks are locked:**
- 1A: grouped sidebar, with the week pager in the top bar
- 2A: columned table with j/k
- 3B: Brief stats
- 3A: Backtest stat row
- 4A: properties drawer, plus the 4C pager
- 5A: drawer chart
- 5B: Backtest hero bars

Motion picks (slots 6–10) are pending; the motion notes below show the default each option would replace (see `OPTIONS.md`).

**Every number** in these sketches comes from the API at runtime: `/stats`, `/pql`, `/health`, `/schools/*`, `/backtest/results`. Deltas and sparklines come from calling the same endpoints for earlier Mondays. The backend is not touched.

**Global changes** (Phase 1 tokens and base components):
- **Structure:** no section cards. Sections are separated by whitespace and one hairline; tables sit on the page.
- **Accent:** ember means "act on this" (primary button, focus ring, the "ready" line). Status gets its own set: ready, at risk, healthy, neutral. "Ready" stops using the brand color.
- **Type:** one display size, three text sizes. Weights 400 and 500 (600 only in table headers). Tabular numerals in Inter; JetBrains Mono only for IDs and commit hashes.
- **Shape:** radius 4 for controls, 0 for tables and panels, 6 for the drawer edge. No shadows except the drawer and popovers, both using one elevation token.
- **Dark theme:** warm, not gray-blue: bg #161513, ink #EDEAE4.
- **Motion:**
  - fast (120ms) for hover and press;
  - base (200ms) for state;
  - slow (320ms) for panels and pages;
  - reveal (600ms, once) for charts;
  - enter easing (0.2, 0.8, 0.2, 1), exit easing (0.4, 0, 1, 1);
  - reduced motion means fades only.

---

## Shell (all screens)
```
┌──────────────┬──────────────────────────────────────────────────────────────────────────┐
│ ● Kindling   │  Monday brief                                   ‹  Mon, Feb 2, 2026 ▾  ›  │
│              │  Feb 2: 9 schools ready to buy, 4 paying schools slipping.        demo ⟲  │
│ Brief        ├──────────────────────────────────────────────────────────────────────────┤
│ Ready     9  │                                                                          │
│ At risk   4  │   (screen content: sits on the page, hairlines between sections)         │
│ ──────────   │                                                                          │
│ Pipeline     │                                                                          │
│ Prospects    │                                                                          │
│ Backtest     │                                                                          │
│ Automations  │                                                                          │
│              │                                                                          │
│ Alerts sent  │                                                                          │
│ Nov 17 (n8n) │                                                                          │
└──────────────┴──────────────────────────────────────────────────────────────────────────┘
```
**What changes vs today:**
- **Sidebar:** 200px. The active item gets a background layer and ink text: no white card, no shadow. Counts are plain tabular numbers, not colored badges.
- **Navigation groups:** a hairline separates the daily screens (Brief, Ready, At risk) from the supporting ones.
- **n8n status:** moves to the sidebar footer, worded as "Alerts sent Nov 17". It no longer sits next to the simulated date.
- **Header:** title at display size, weight 500, -0.02em tracking. A narrative subtitle built from `/stats`.
- **Date control:** the 1A week pager, in the top bar, replaces the native input. Slot 10 decides how it opens: 10A morphs into a panel, 10B is a week ruler. ‹ › step one Monday at a time, ▾ opens the school-year picker with breaks marked, and ⟲ returns to the demo date.

**Motion:**
- **Route change:** View Transition cross-fade (180ms); the title slides up 4px.
- **Date change:** numbers count to their new values (200ms), and rows that move rank slide to their new position (layout animation, 320ms).
- **Nav:** the active-item background slides between items (motion `layoutId`, 200ms).

---

## Brief (stats per 3B: a number with one context line under it)
```
 Monday brief
 Feb 2: 9 schools ready to buy, 4 paying schools slipping. $23,600 renews at risk.

 Ready to buy          At risk             ARR at risk             Projected NRR
 9                     4                   $23,600                 89.2%
 +2 vs Jan 26  ▁▂▄▅▇   +1 vs Jan 26  ▂▂▃▅  of $624,000 paid ARR    $44,000 churned to date
 ──────────────────────────────────────────────────────────────────────────────────────────
 Ready to buy · top 5                                                       All 9 →
  1  Quillon Reach Academy        90 ━━━━━━━━━  5 teachers, heavy student use   new this week
  2  Marrow Landing Academy       90 ━━━━━━━━━  5 teachers, heavy student use
  …
 ──────────────────────────────────────────────────────────────────────────────────────────
 Slipping · renewal ahead                                                   All 4 →
  Sedgely Crossing Country Day    34 ━━━▏      renews in 27 days · $5,600   teachers down 67%
  …
 ──────────────────────────────────────────────────────────────────────────────────────────
 Alerts: last n8n run Nov 17 · 7 sales alerts · 1 email drafted                Automations →
```
**What changes vs today:**
- **The four tiles become four stat blocks** on one baseline, divided by hairlines: no boxes.
- **Each block has context:** the change vs the previous Monday (`/stats` called for as_of − 7) and an 8-week sparkline (`/stats` for the last 8 Mondays).
- **The narrative line is built from the same `/stats`** call, so its numbers are never typed into the code.
- **"New this week"** comes from comparing this Monday's Ready set with last Monday's.
- **Lists use the shared table row:** score meter, one top reason; the full reasons live in Ready and the drawer.

**Motion:**
- On first load, stat numbers count up once (reveal, 600ms) and sparklines draw once.
- On a date change, numbers count to their new values (200ms) and list rows reorder with layout animation.
- Nothing loops.

---

## Ready to buy (table per 2A)
```
 Ready to buy
 9 of 85 free schools are ready this week. Ranked by readiness score.

 [ Ready 9 | All 85 ]   ⌕ Find a school                     j/k move · ↵ open · / search
 ┌ sticky ─────────────────────────────────────────────────────────────────────────────────┐
 │ #   School                        Score ▾          Why                       Contact     │
 ├─────────────────────────────────────────────────────────────────────────────────────────┤
 │ 1   Quillon Reach Academy         90 ━━━━━━━━━▏    5 heavy-use teachers 35   A. White  ⋯ │
 │     Independent · Fresno, CA                       5 active 30 · admin 15    Principal   │
 │ 2   Marrow Landing Academy        90 ━━━━━━━━━▏    …                                     │
 │ …                                                                                       │
 │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ready line · score 60 (from /meta) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
 │ 10  Thistle Landing Academy       58 ━━━━━━▏       …                                     │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
   hover a row → quick actions appear at the right: Open · Copy email · Send to #sales
```
**What changes vs today:**
- **A real table (2A):**
  - sticky header;
  - sort by score, name or teachers;
  - skeleton rows shaped like real rows;
  - keyboard: **j/k** (and ↑↓) move, ↵ opens the drawer, `/` focuses search, Esc clears.
  - Long names truncate with a tooltip.
- **Default filter is "Ready"** (9 rows), so the page shows the work for the week.
- **Score meter:** a thin bar with the ready-line tick at 60, taken from `/meta`.
- **Reasons inline:** two lines, with points as quiet tabular numbers.
- **The ready divider stays**, restyled as a hairline with a label instead of a colored band.

**Motion:**
- First load: rows enter staggered (30ms per row, first 10 only; opacity plus 4px).
- Hover: the row background changes over 120ms and the actions fade in.
- Date change: rows reorder with layout animation (320ms), and rows that newly cross the line briefly tint once.

---

## At risk
```
 At risk
 4 of 56 paying schools with a renewal ahead are slipping. $23,600 ARR.

 [ At risk 4 | All 56 ]   ⌕ Find a school
 ┌ sticky ─────────────────────────────────────────────────────────────────────────────────┐
 │ School                          Health          Renews            ARR      Why          │
 ├─────────────────────────────────────────────────────────────────────────────────────────┤
 │ Sedgely Crossing Country Day    34 ━━━▏         27 days · Mar 1   $5,600   Teachers down │
 │ Independent · Milwaukee, WI     At risk                                     67% (3 → 1)  │
 │ …                                                                                       │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```
**What changes vs today:**
- **The same table system as Ready**, with health meter, renewal countdown and right-aligned ARR.
- **The red left border goes.** Status is the "At risk" word under the meter, in the status color.
- **The renewal countdown is the second most important column.** Days in tabular figures; the date in muted text.

**Motion:** same as Ready. Clicking a row starts the drawer's shared-element transition.

---

## School detail drawer (4A record properties panel + 4C pager, chart per 5A)
```
 ┌──────────────────────────────────────────────── 640px ─┐
 │ ‹ ›  2 of 4 at risk · j/k                           ✕   │  ← pager (4C): steps through the list you came from
 │ Sedgely Crossing Country Day                            │
 │ 34  At risk   ━━━▏                                      │  ← shared element from the row
 ├─────────────────────────────────────────────────────────┤
 │ Renews            Mar 1, 2026 · in 27 days              │  ← properties (4A): label / value rows,
 │ ARR               $5,600 · 14 seats                     │     hairlines, labels muted, values ink
 │ Type · location   Independent · Milwaukee, WI           │
 │ Calendar          national · 86 school days so far      │
 │ Contact           Patricia Brown · Technology Coord.    │
 ├─────────────────────────────────────────────────────────┤
 │ Why it's at risk                                 points │
 │ Active teachers down 67% vs the prior window (3 → 1)  13/40
 │ Student sessions down 68% (73 → 23)                   11/35
 │ 7% of 14 licensed seats active                         1/10
 ├─────────────────────────────────────────────────────────┤
 │ Usage                       [ School days | Calendar days ]
 │  line: active teachers per week · bars: sessions (5A)   │
 │  ░break░ shaded from the school's own calendar          │
 │  └ last 10 school days ┘└ prior 10 ┘  (morphs on toggle)│
 │ "On school days activity fell 67%; breaks are skipped." │
 │ ▸ Day by day (the two windows, close-up)                │
 ├─────────────────────────────────────────────────────────┤
 │ Score every Monday   Kindling ── naive ─ ─   line at 70 │
 ├─────────────────────────────────────────────────────────┤
 │ [ Send to #customer-success ]   Mark contacted          │
 └─────────────────────────────────────────────────────────┘
```
**What changes vs today:**
- **Width:** 640px.
- **The header leads with the decision:** score and status.
- **Properties (4A):** the facts become a label/value list, as Attio's record panel does, instead of a grid of tiles.
- **Pager (4C):** "2 of 4" and **j/k** move through the list the rep came from, without closing the drawer. URL `school=` updates.
- **Reasons come before the charts:** a readable list with points, no chips.
- **Usage chart (5A):** a line for active teachers, bars for sessions, breaks shaded. A School days / Calendar days toggle morphs the highlighted window and the change sentence.
- **The day-by-day close-up** collapses under a disclosure.
- **Kept:** score history, real signal dates, the footer actions.

**Motion:**
- **Open:** set by slot 6+ (6C grows from the row, 6D carries the row into the detail). Default: the row's name and score move into the header (shared element, 320ms, enter easing).
- **Pager:** j/k cross-fades the body (200ms) while the header text swaps in place (7B-style).
- **Charts:** reveal once (600ms). The toggle morphs the window band and line (200ms). Close uses exit easing, 200ms.
- **Reduced motion:** fades only.

---

## Backtest
```
 Backtest
 Replayed every Monday, Sep 1, 2025 – Jul 27, 2026. The scorer never saw outcomes.

 Kindling raised 0 false alarms on healthy schools. The naive model raised 57.
 Reps get a list where 77% buy, against 37% for "built 5+ tutors".

 Precision        Recall           False alarms        Lead time          ← 3A ruled four-stat row
 77%  vs 37%      71%  vs 100%     0%  vs 98%          28 d  vs 56 d         (Kindling first, naive muted)
 ──────────────────────────────────────────────────────────────────────────────────────────

 False alarms on healthy schools   naive    ███████████████████████████ 98%
                                   Kindling ▏0%
 Ready schools that bought         naive    ██████████ 37%
                                   Kindling ████████████████████ 77%
 Converters caught first           naive    ███████████████████████████ 100%   ← naive wins, shown
                                   Kindling ███████████████████ 71%
 ──────────────────────────────────────────────────────────────────────────────────────────
 Full results         precision · recall · lead time, both scores (tables)
 results/pql_backtest.md · run Nov 23, 7:12 PM · 814a258     (quiet stamp under each)
 ──────────────────────────────────────────────────────────────────────────────────────────
 At-risk alerts, week by week (chart, breaks shaded)
 ──────────────────────────────────────────────────────────────────────────────────────────
 Experiment: district calendars        [ One national calendar | District calendars ]
 False alarms 19% → 0%   (the bars morph between the two states)
 ▸ Admin rule   ▸ Threshold sweep   ▸ Rules vs logistic regression   (collapsed)
```
**What changes vs today:**
- **An editorial page:** a headline sentence, then a **3A ruled four-stat row**, then **5B labeled hero bars** (one labeled bar per metric, Kindling vs naive), then the full tables.
- **The duplicate summary mini-cards are removed.**
- **Every value in the sentences and bars is looked up** by row label in `/backtest/results`.
- **Rows where naive wins stay visible.**
- **The district experiment is a before/after toggle.** The other experiments collapse under disclosure rows.
- **The stamp stays visible but quiet:** muted text, mono only for the hash.

**Motion:**
- Comparison bars grow once when scrolled into view (reveal, 600ms).
- The district toggle morphs the bars (200ms).
- Disclosures open with a height animation (200ms).

---

## Prospects, Pipeline, Automations (base components only)
```
 Prospects — 10 cold schools worth a first call            Pipeline — 9 ready, 76 not yet
 table: # · School · Priority meter · Why · PQL · Contact  stat blocks (no boxes) + snapshot table
 outreach actions = one neutral button group (no brand colors)   empty: "No snapshots yet — save one for Feb 2" [Save snapshot]

 Automations — Alert runs from n8n
 table: Run date · Sales alerts · CS alerts · Emails · Status pill   (numbers right-aligned, duplicates marked "same day")
```
**What changes vs today:**
- **Restyled with the shared table, stat block, empty state, button and status pill.** No new patterns.
- **The outreach bar** loses the Slack, LinkedIn and Gmail brand colors.
- **Pipeline's giant numbers** get context.
- **Automations right-aligns its numbers** and shows dates in Inter.

**Motion:** base hover and press only.
