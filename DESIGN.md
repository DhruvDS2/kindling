# Design: Kindling

## Vibe
Calm, factual, fast to scan. This is an internal tool a rep checks on Monday morning, so it should feel like a good spreadsheet rather than a marketing site. Every number has its reason next to it.

## Colors

| Token | Hex | Use |
|---|---|---|
| `ink` | `#1C1B19` | Text |
| `paper` | `#FAF8F5` | Background |
| `muted` | `#6B6760` | Secondary text, axis labels |
| `line` | `#E4E0D9` | Borders, gridlines |
| `ember` | `#E2572B` | Brand accent, ready-to-buy (PQL) |
| `risk` | `#B42318` | At-risk accounts |
| `steady` | `#2F7D5B` | Healthy accounts |
| `naive` | `#9A958C` | Baseline model in comparisons |

Don't rely on color alone. Every status also gets a word ("Ready," "At risk," "Healthy").

## Fonts
- **Inter** for UI and body text
- **JetBrains Mono** for numbers in tables and scores (tabular figures line up)

## Components

**Score chip:** the score number plus a status word, colored by status.
> `84 · Ready` &nbsp; `38 · At risk` &nbsp; `91 · Healthy`

**Reason list:** always exactly the top 3 reasons, each one short and concrete.
> 4 teachers active in the last 10 school days · 230 student sessions · Admin signed up

**Account row:** name · type · score chip · top reason · days to renewal (paid) · ARR.

**Slack alert** (one block per account):
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

**Results table:** naive vs. season-aware side by side, the better number in bold, one-sentence takeaway under it.

## Dashboard layout (Streamlit)
1. Top row: 4 stat tiles: Ready to buy (count), At risk (count), ARR at risk, Projected NRR
2. Two ranked tables: Ready to buy · At risk
3. Backtest tab: the results table + one chart (alerts over the year, naive vs. season-aware, breaks shaded)
