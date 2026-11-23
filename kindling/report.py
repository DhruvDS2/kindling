"""Generate a static HTML results report.

Run:  python -m kindling.report
Output: results/report.html
"""
from __future__ import annotations

import base64
import io
from datetime import date, timedelta
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import pandas as pd

from kindling import config as C, health, pql
from kindling.features import account_features, connect

# design tokens
INK     = "#1C1B19"
PAPER   = "#FAF8F5"
MUTED   = "#6B6760"
LINE    = "#E4E0D9"
EMBER   = "#E2572B"
RISK    = "#B42318"
STEADY  = "#2F7D5B"
NAIVE   = "#9A958C"


def _chart_png() -> str:
    """Return base64-encoded PNG of at-risk flags over the year."""
    con = connect()
    dates = []
    d = date(2025, 9, 1)
    while d <= C.END:
        dates.append(d)
        d += timedelta(days=7)

    feats_sd  = account_features(con, dates, mode="school_days")
    feats_cal = account_features(con, dates, mode="calendar")
    sd_scored  = health.score(feats_sd)
    cal_scored = health.naive_health(feats_cal)

    sd_counts  = sd_scored.groupby("as_of").apply(lambda g: (g.status == "At risk").sum())
    cal_counts = cal_scored.groupby("as_of").apply(lambda g: (g.status == "At risk").sum())

    fig, ax = plt.subplots(figsize=(10, 4), facecolor=PAPER)
    ax.set_facecolor(PAPER)

    breaks = [
        ("Thanksgiving",  date(2025, 11, 24), date(2025, 11, 28)),
        ("Winter break",  date(2025, 12, 20), date(2026, 1,  4)),
        ("Spring break",  date(2026, 3,  14), date(2026, 3,  22)),
    ]
    for label, lo, hi in breaks:
        ax.axvspan(pd.Timestamp(lo), pd.Timestamp(hi), color=LINE, alpha=0.8, zorder=0)
        ax.text(pd.Timestamp(lo + timedelta(days=1)), ax.get_ylim()[1] * 0.95,
                label, fontsize=7, color=MUTED, va="top")

    ax.plot(cal_counts.index, cal_counts.values, color=NAIVE, lw=2, label="Naive (calendar days)")
    ax.plot(sd_counts.index,  sd_counts.values,  color=STEADY, lw=2, label="Kindling (school days)")

    ax.set_xlabel("", color=MUTED)
    ax.set_ylabel("Schools flagged at risk", color=MUTED, fontsize=9)
    ax.tick_params(colors=MUTED, labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor(LINE)
    ax.grid(axis="y", color=LINE, linewidth=0.5)
    ax.legend(fontsize=9, framealpha=0, labelcolor=INK)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor=PAPER)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def _read_md_table(path: Path) -> str:
    """Extract just the markdown table from a results file."""
    if not path.exists():
        return "<p><em>Not generated yet — run the backtest first.</em></p>"
    lines = path.read_text().splitlines()
    table_lines = [l for l in lines if l.startswith("|")]
    if not table_lines:
        return "<pre>" + path.read_text() + "</pre>"
    # convert simple markdown table to HTML
    rows = []
    for i, line in enumerate(table_lines):
        cells = [c.strip() for c in line.strip("|").split("|")]
        tag = "th" if i == 0 else "td"
        if i == 1:  # separator row
            continue
        rows.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>")
    return "<table>" + "\n".join(rows) + "</table>"


def _md_cell(path: Path, row: str, col: int) -> str:
    """One cell from a results table, so headline tiles always match the latest backtest.

    col 1 is the first result column (the baseline), col 2 the second (Kindling).
    """
    if not path.exists():
        return "?"
    for line in path.read_text().splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells and cells[0] == row and len(cells) > col:
            return cells[col]
    return "?"


def build():
    chart_b64 = _chart_png()

    pql_md, health_md = C.RESULTS_DIR / "pql_backtest.md", C.RESULTS_DIR / "health_backtest.md"
    health_lr_md = C.RESULTS_DIR / "health_lr_comparison.md"
    pql_prec, pql_prec_naive = _md_cell(pql_md, "precision", 2), _md_cell(pql_md, "precision", 1)
    pql_lead = _md_cell(pql_md, "median lead time (days)", 2)
    fa, fa_naive = _md_cell(health_md, "false alarm rate", 2), _md_cell(health_md, "false alarm rate", 1)
    health_lead = _md_cell(health_md, "median lead time on churners (days)", 2)
    lr_fa = _md_cell(health_lr_md, "false alarm rate", 2)

    pql_table    = _read_md_table(pql_md)
    health_table = _read_md_table(health_md)
    pql_lr_table = _read_md_table(C.RESULTS_DIR / "pql_lr_comparison.md")
    hlth_lr_table = _read_md_table(health_lr_md)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kindling — Results</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body   {{ background: {PAPER}; color: {INK}; font-family: Inter, system-ui, sans-serif;
            max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; line-height: 1.6; }}
  h1     {{ font-size: 1.8rem; margin-bottom: 0.25rem; }}
  h2     {{ font-size: 1.1rem; color: {MUTED}; font-weight: 400; margin-top: 0; }}
  h3     {{ font-size: 1rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid {LINE}; padding-bottom: 0.25rem; }}
  table  {{ border-collapse: collapse; width: 100%; font-size: 0.875rem; margin: 1rem 0; }}
  th     {{ background: {LINE}; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; }}
  td     {{ padding: 0.45rem 0.75rem; border-bottom: 1px solid {LINE}; font-family: 'JetBrains Mono', monospace; }}
  tr:last-child td {{ border-bottom: none; }}
  .tiles {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }}
  .tile  {{ background: white; border: 1px solid {LINE}; border-radius: 6px; padding: 1rem; }}
  .tile .label {{ font-size: 0.75rem; color: {MUTED}; text-transform: uppercase; letter-spacing: 0.05em; }}
  .tile .val   {{ font-size: 1.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-top: 0.2rem; }}
  .ember {{ color: {EMBER}; }}
  .risk  {{ color: {RISK}; }}
  .steady{{ color: {STEADY}; }}
  .note  {{ font-size: 0.8rem; color: {MUTED}; margin-top: 0.5rem; }}
  img    {{ width: 100%; border: 1px solid {LINE}; border-radius: 4px; margin-top: 0.5rem; }}
  .cols  {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }}
</style>
</head>
<body>

<h1>🔥 Kindling</h1>
<h2>Flags free schools ready to buy and paying schools about to churn — from product usage alone.</h2>

<div class="tiles">
  <div class="tile">
    <div class="label">Precision · PQL</div>
    <div class="val ember">{pql_prec}</div>
    <div class="note">vs {pql_prec_naive} naive</div>
  </div>
  <div class="tile">
    <div class="label">False alarm rate · Health</div>
    <div class="val steady">{fa}</div>
    <div class="note">vs {fa_naive} calendar-day baseline</div>
  </div>
  <div class="tile">
    <div class="label">Lead time · PQL</div>
    <div class="val">{pql_lead}d</div>
    <div class="note">median before conversion</div>
  </div>
  <div class="tile">
    <div class="label">Lead time · Health</div>
    <div class="val">{health_lead}d</div>
    <div class="note">median before churn</div>
  </div>
</div>

<h3>PQL backtest — free schools ready to buy</h3>
<p class="note">Replayed every Monday Sep 2025 – Jul 2026. Flag counts as a hit only if conversion happens <em>after</em> the flag.</p>
{pql_table}

<h3>Health backtest — paying schools at risk of churning</h3>
<p class="note">Same replay. Flag counts as early if it arrives ≥45 days before renewal. False alarms = healthy schools incorrectly flagged.</p>
{health_table}

<h3>At-risk flags per Monday — naive vs season-aware</h3>
<p class="note">Shaded regions are school breaks. The calendar-day model fires on every healthy school around winter break.</p>
<img src="data:image/png;base64,{chart_b64}" alt="At-risk flags over time">

<div class="cols">
  <div>
    <h3>PQL: rules vs logistic regression</h3>
    <p class="note">Trained fall semester, tested spring. Same point-in-time features.</p>
    {pql_lr_table}
  </div>
  <div>
    <h3>Health: rules vs logistic regression</h3>
    <p class="note">LR catches more churners but fires {lr_fa} false alarms — it doesn't understand breaks.</p>
    {hlth_lr_table}
  </div>
</div>

<h3>Limits</h3>
<ul>
  <li>Synthetic data only. The simulator plants the traps the scorer handles.</li>
  <li>School-day windows don't help the PQL score: calendar windows score about the same. The health false-alarm result is where school days prove themselves.</li>
  <li>Stalled schools (budget freezes) look identical to buyers, so no usage score can avoid them. They are where the wrong PQL flags come from.</li>
  <li>One shared calendar. Production needs a per-district calendar.</li>
</ul>

</body>
</html>"""

    out = C.RESULTS_DIR / "report.html"
    out.write_text(html)
    print(f"Wrote {out.relative_to(C.ROOT)}")
    return out


if __name__ == "__main__":
    build()
