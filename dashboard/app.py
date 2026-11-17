"""Kindling dashboard — run with: streamlit run dashboard/app.py"""
from __future__ import annotations

import os
import requests
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from kindling import config as C, health, pql
from kindling.features import account_features, connect

# ── design tokens ──────────────────────────────────────────────────────────────
INK      = "#1C1B19"
PAPER    = "#FAF8F5"
MUTED    = "#6B6760"
LINE     = "#E4E0D9"
EMBER    = "#E2572B"
RISK     = "#B42318"
STEADY   = "#2F7D5B"
NAIVE_COL = "#9A958C"

st.set_page_config(page_title="Kindling", page_icon="🔥", layout="wide")
st.markdown(f"""
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  html, body, .stApp {{ background-color: {PAPER} !important; color: {INK}; font-family: Inter, sans-serif; }}
  section[data-testid="stSidebar"] {{ background-color: {INK} !important; }}
  section[data-testid="stSidebar"] p,
  section[data-testid="stSidebar"] span,
  section[data-testid="stSidebar"] label,
  section[data-testid="stSidebar"] h1,
  section[data-testid="stSidebar"] h2,
  section[data-testid="stSidebar"] h3 {{ color: {PAPER} !important; }}
  section[data-testid="stSidebar"] .stCaption {{ color: {NAIVE_COL} !important; }}
  section[data-testid="stSidebar"] pre,
  section[data-testid="stSidebar"] code {{ background: #2d2c29 !important; color: #e8e4dc !important; }}

  /* school cards */
  .school-card {{
    background: white;
    border: 1px solid {LINE};
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.6rem;
  }}
  .school-card-risk {{
    border-left: 3px solid {RISK};
  }}
  .school-card-ready {{
    border-left: 3px solid {EMBER};
  }}
  .card-name {{ font-weight: 600; font-size: 0.95rem; margin-bottom: 0.2rem; }}
  .card-meta {{ font-size: 0.78rem; color: {MUTED}; margin-bottom: 0.5rem; }}
  .card-reasons {{ font-size: 0.82rem; color: {INK}; line-height: 1.6; }}
  .card-reasons li {{ margin-bottom: 0.1rem; }}

  /* chips */
  .chip {{
    display: inline-block;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 0.4rem;
  }}
  .chip-ready   {{ background: {EMBER}22; color: {EMBER}; }}
  .chip-risk    {{ background: {RISK}22;  color: {RISK};  }}
  .chip-healthy {{ background: {STEADY}22; color: {STEADY}; }}
  .chip-notyet  {{ background: {LINE};     color: {MUTED};  }}

  /* score badge */
  .score-ready {{ font-size: 1.3rem; font-weight: 700; color: {EMBER}; font-family: monospace; }}
  .score-risk  {{ font-size: 1.3rem; font-weight: 700; color: {RISK};  font-family: monospace; }}
  .score-ok    {{ font-size: 1.3rem; font-weight: 700; color: {STEADY}; font-family: monospace; }}
  .score-dim   {{ font-size: 1.3rem; font-weight: 700; color: {MUTED};  font-family: monospace; }}

  /* stat tiles */
  div[data-testid="metric-container"] {{
    background: white;
    border: 1px solid {LINE};
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }}

  /* tab text */
  button[data-baseweb="tab"] {{ font-weight: 500; }}

  /* divider */
  hr {{ border-color: {LINE}; margin: 1.2rem 0; }}
</style>
""", unsafe_allow_html=True)


# ── helpers ────────────────────────────────────────────────────────────────────
def score_html(score: int, kind: str) -> str:
    cls = {"ready": "score-ready", "risk": "score-risk",
           "ok": "score-ok"}.get(kind, "score-dim")
    return f'<span class="{cls}">{score}</span>'


def chip(label: str) -> str:
    cls = {"Ready": "chip-ready", "At risk": "chip-risk",
           "Healthy": "chip-healthy", "Not yet": "chip-notyet"}.get(label, "chip-notyet")
    return f'<span class="chip {cls}">{label}</span>'


def _contact_meta(r) -> str:
    parts = []
    name  = r.get("contact_name") or ""
    title = r.get("contact_title") or ""
    city  = r.get("city")  or ""
    state = r.get("state") or ""
    if name and title:
        parts.append(f"{name} · {title}")
    if city and state:
        parts.append(f"{city}, {state}")
    return " · ".join(parts)


def pql_card(r) -> str:
    reasons_html = "".join(f"<li>{re}</li>" for re in r.reasons)
    meta = f"{int(r.active_teachers)} active teachers · {int(r.student_sessions)} student sessions"
    contact = _contact_meta(r)
    contact_html = f'<div class="card-meta">{contact}</div>' if contact else ""
    return f"""
    <div class="school-card school-card-ready">
      <div class="card-name">{r["name"]}{chip("Ready")}</div>
      <div class="card-meta">{meta}</div>
      {contact_html}
      <ul class="card-reasons">{reasons_html}</ul>
    </div>"""


def health_card(r) -> str:
    reasons_html = "".join(f"<li>{re}</li>" for re in r.reasons)
    meta = f"Renews in {int(r.days_to_renewal)}d · ${int(r.arr):,} ARR · {int(r.active_teachers)}/{int(r.seats)} seats active"
    contact = _contact_meta(r)
    contact_html = f'<div class="card-meta">{contact}</div>' if contact else ""
    return f"""
    <div class="school-card school-card-risk">
      <div class="card-name">{r["name"]}{chip("At risk")}</div>
      <div class="card-meta">{meta}</div>
      {contact_html}
      <ul class="card-reasons">{reasons_html}</ul>
    </div>"""


# ── Slack helper ───────────────────────────────────────────────────────────────
def send_slack(text: str, webhook_url: str) -> bool:
    try:
        r = requests.post(webhook_url, json={"text": text}, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


# ── sidebar ─────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🔥 Kindling")
    st.markdown("---")
    as_of = st.date_input("Score as of", value=date(2026, 2, 2),
                           min_value=C.START, max_value=C.END)
    st.caption("All features use only data up to this date.")
    st.markdown("---")
    st.markdown("**Quick access**")
    st.link_button("📧 Open Gmail", "https://mail.google.com", use_container_width=True)
    st.link_button("💬 Open Slack", "https://slack.com/app_redirect", use_container_width=True)
    st.markdown("---")
    st.markdown("**How to run**")
    st.code("streamlit run dashboard/app.py", language="bash")
    st.code("uvicorn kindling.api:app --reload", language="bash")
    st.markdown("---")
    st.caption("All data is synthetic. School names are invented.")

as_of_date = as_of if isinstance(as_of, date) else as_of


# ── data loading ────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300)
def load_scores(as_of_str: str):
    d = date.fromisoformat(as_of_str)
    con = connect()
    feats = account_features(con, [d], mode="school_days")
    pql_df = pql.score(feats).sort_values("pql_score", ascending=False).reset_index(drop=True)
    h_df = health.score(feats).sort_values("health_score").reset_index(drop=True)
    h_df["days_to_renewal"] = (
        pd.to_datetime(h_df.renewal_date) - pd.to_datetime(h_df.as_of)
    ).dt.days.fillna(999).astype(int)
    return pql_df, h_df


pql_df, health_df = load_scores(str(as_of_date))

ready    = pql_df[pql_df.status == "Ready"]
at_risk  = health_df[(health_df.status == "At risk") &
                     (health_df.days_to_renewal >= health.RENEWAL_BUFFER_DAYS)]
arr_at_risk   = at_risk.arr.sum()
total_arr     = health_df.arr.sum()
nrr_projected = (total_arr - arr_at_risk) / total_arr if total_arr else 1.0


# ── stat tiles ──────────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
c1.metric("🟠 Ready to buy",   len(ready),
          help="Free schools with PQL ≥ 60")
c2.metric("🔴 At risk",        len(at_risk),
          help=f"Paying schools · health < 50 · ≥{health.RENEWAL_BUFFER_DAYS}d to renewal")
c3.metric("💸 ARR at risk",    f"${arr_at_risk:,.0f}",
          help="Sum of ARR for at-risk schools")
c4.metric("📈 Projected NRR",  f"{nrr_projected:.0%}",
          help="(Total ARR − at-risk ARR) ÷ Total ARR — floor estimate")

st.markdown("<br>", unsafe_allow_html=True)

# ── tabs ────────────────────────────────────────────────────────────────────────
tab_pql, tab_health, tab_backtest, tab_outreach = st.tabs(["🟠 Ready to buy", "🔴 At risk", "📊 Backtest", "📬 Outreach"])


# ── PQL tab ─────────────────────────────────────────────────────────────────────
with tab_pql:
    left, right = st.columns([3, 2])

    with left:
        st.markdown(f"#### Free schools ready to buy &nbsp;·&nbsp; {as_of_date}",
                    unsafe_allow_html=True)
        if ready.empty:
            st.info("No schools at PQL ≥ 60 on this date.")
        else:
            for _, r in ready.iterrows():
                st.markdown(pql_card(r), unsafe_allow_html=True)

    with right:
        st.markdown("#### Score breakdown")
        # score distribution bar chart
        fig_dist = go.Figure()
        bins = pd.cut(pql_df.pql_score, bins=[0,20,40,60,80,100],
                      labels=["0–20","21–40","41–60","61–80","81–100"])
        counts = bins.value_counts().sort_index()
        colors = [NAIVE_COL, NAIVE_COL, LINE, EMBER, EMBER]
        fig_dist.add_trace(go.Bar(x=counts.index.astype(str), y=counts.values,
                                   marker_color=colors, showlegend=False))
        fig_dist.add_vline(x=2.5, line_dash="dash", line_color=EMBER,
                           annotation_text="threshold (60)",
                           annotation_font_color=EMBER, annotation_font_size=10)
        fig_dist.update_layout(paper_bgcolor="white", plot_bgcolor="white",
                                font={"color": INK, "size": 11},
                                xaxis={"title": "PQL score range", "gridcolor": LINE},
                                yaxis={"title": "Schools", "gridcolor": LINE},
                                margin={"t": 10, "b": 10, "l": 10, "r": 10},
                                height=220)
        st.plotly_chart(fig_dist, use_container_width=True)

        st.markdown("#### All free schools")
        tbl_rows = []
        for _, r in pql_df.iterrows():
            tbl_rows.append({
                "School": r["name"],
                "Score": int(r.pql_score),
                "Status": r.status,
                "Teachers": int(r.active_teachers),
                "Sessions": int(r.student_sessions),
            })
        tbl = pd.DataFrame(tbl_rows)
        st.dataframe(
            tbl,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Score": st.column_config.ProgressColumn(
                    "Score", min_value=0, max_value=100, format="%d"),
                "Status": st.column_config.TextColumn("Status"),
            }
        )


# ── Health tab ───────────────────────────────────────────────────────────────────
with tab_health:
    left, right = st.columns([3, 2])

    with left:
        st.markdown(f"#### Paying schools at risk &nbsp;·&nbsp; {as_of_date}",
                    unsafe_allow_html=True)
        if at_risk.empty:
            st.info(f"No at-risk schools with ≥{health.RENEWAL_BUFFER_DAYS} days to renewal.")
        else:
            for _, r in at_risk.iterrows():
                st.markdown(health_card(r), unsafe_allow_html=True)

    with right:
        st.markdown("#### Health distribution")
        bins_h = pd.cut(health_df.health_score, bins=[0,25,50,75,100],
                        labels=["0–25","26–50","51–75","76–100"])
        counts_h = bins_h.value_counts().sort_index()
        colors_h = [RISK, RISK, NAIVE_COL, STEADY]
        fig_h = go.Figure()
        fig_h.add_trace(go.Bar(x=counts_h.index.astype(str), y=counts_h.values,
                                marker_color=colors_h, showlegend=False))
        fig_h.add_vline(x=1.5, line_dash="dash", line_color=RISK,
                        annotation_text="threshold (50)",
                        annotation_font_color=RISK, annotation_font_size=10)
        fig_h.update_layout(paper_bgcolor="white", plot_bgcolor="white",
                             font={"color": INK, "size": 11},
                             xaxis={"title": "Health score range", "gridcolor": LINE},
                             yaxis={"title": "Schools", "gridcolor": LINE},
                             margin={"t": 10, "b": 10, "l": 10, "r": 10},
                             height=220)
        st.plotly_chart(fig_h, use_container_width=True)

        st.markdown("#### All paying schools")
        h_rows = []
        for _, r in health_df.iterrows():
            h_rows.append({
                "School": r["name"],
                "Health": int(r.health_score),
                "Status": r.status,
                "Days left": int(r.days_to_renewal),
                "ARR": int(r.arr),
            })
        h_tbl = pd.DataFrame(h_rows)
        st.dataframe(
            h_tbl,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Health": st.column_config.ProgressColumn(
                    "Health", min_value=0, max_value=100, format="%d"),
                "ARR": st.column_config.NumberColumn("ARR", format="$%d"),
            }
        )


# ── Backtest tab ─────────────────────────────────────────────────────────────────
with tab_backtest:
    st.markdown("#### Backtest: season-aware vs naive")
    st.caption("Replayed every Monday Sep 2025 – Jul 2026. Scored using only data up to each date.")

    col_a, col_b = st.columns(2)

    with col_a:
        pql_md = C.RESULTS_DIR / "pql_backtest.md"
        st.markdown("**PQL — free schools ready to buy**")
        if pql_md.exists():
            st.markdown(pql_md.read_text())
        else:
            st.info("Run `python -m kindling.backtest pql` to generate.")

    with col_b:
        health_md = C.RESULTS_DIR / "health_backtest.md"
        st.markdown("**Health — paying schools at risk of churning**")
        if health_md.exists():
            st.markdown(health_md.read_text())
        else:
            st.info("Run `python -m kindling.backtest health` to generate.")

    st.markdown("---")
    st.markdown("**At-risk flags per Monday &nbsp;·&nbsp; naive (calendar) vs season-aware (school days)**",
                unsafe_allow_html=True)
    st.caption("Shaded regions = school breaks. The naive model fires on every healthy school around winter break.")

    @st.cache_data(ttl=600)
    def build_flag_chart():
        con = connect()
        dates, d = [], date(2025, 9, 1)
        while d <= C.END:
            dates.append(d)
            d += timedelta(days=7)
        feats_sd  = account_features(con, dates, mode="school_days")
        feats_cal = account_features(con, dates, mode="calendar")
        sd_scored  = health.score(feats_sd)
        cal_scored = health.naive_health(feats_cal)
        sd_c  = sd_scored.groupby("as_of").apply(lambda g: (g.status == "At risk").sum()).reset_index()
        cal_c = cal_scored.groupby("as_of").apply(lambda g: (g.status == "At risk").sum()).reset_index()
        sd_c.columns  = ["as_of", "count"]
        cal_c.columns = ["as_of", "count"]
        return sd_c, cal_c

    sd_counts, cal_counts = build_flag_chart()

    breaks = [
        ("Thanksgiving",  date(2025, 11, 24), date(2025, 11, 28)),
        ("Winter break",  date(2025, 12, 20), date(2026, 1,  4)),
        ("Spring break",  date(2026, 3,  14), date(2026, 3,  22)),
    ]

    fig = go.Figure()
    for label, lo, hi in breaks:
        fig.add_vrect(x0=str(lo), x1=str(hi), fillcolor=LINE, opacity=0.6,
                      layer="below", line_width=0,
                      annotation_text=label, annotation_position="top left",
                      annotation={"font": {"color": MUTED, "size": 10}})

    fig.add_trace(go.Scatter(x=cal_counts.as_of, y=cal_counts["count"],
                             name="Naive (calendar days)",
                             line={"color": NAIVE_COL, "width": 2},
                             fill="tozeroy", fillcolor=f"{NAIVE_COL}18"))
    fig.add_trace(go.Scatter(x=sd_counts.as_of, y=sd_counts["count"],
                             name="Kindling (school days)",
                             line={"color": STEADY, "width": 2.5},
                             fill="tozeroy", fillcolor=f"{STEADY}18"))
    fig.update_layout(
        paper_bgcolor="white", plot_bgcolor="white",
        font={"color": INK, "family": "Inter"},
        legend={"orientation": "h", "y": -0.15},
        xaxis={"gridcolor": LINE, "showgrid": True},
        yaxis={"gridcolor": LINE, "title": "Schools flagged at risk", "showgrid": True},
        margin={"t": 10, "b": 30, "l": 10, "r": 10},
        height=320,
    )
    st.plotly_chart(fig, use_container_width=True)


# ── Outreach tab ─────────────────────────────────────────────────────────────────
with tab_outreach:
    sales_webhook = os.environ.get("SLACK_WEBHOOK_SALES", "")
    cs_webhook    = os.environ.get("SLACK_WEBHOOK_CS", "")

    # top bar
    top_left, top_right, top_spacer = st.columns([1, 1, 4])
    top_left.link_button("📧 Open Gmail", "https://mail.google.com", use_container_width=True)
    top_right.link_button("💬 Open Slack", "https://slack.com/app_redirect", use_container_width=True)

    if not sales_webhook and not cs_webhook:
        st.warning(
            "Slack webhooks not configured. Add `SLACK_WEBHOOK_SALES` and/or "
            "`SLACK_WEBHOOK_CS` to your `.env` file to enable one-click notifications.",
            icon="⚠️",
        )

    st.markdown("<br>", unsafe_allow_html=True)
    left, right = st.columns(2)

    with left:
        st.markdown(f"#### 🟠 Ready to buy &nbsp;·&nbsp; {len(ready)} schools",
                    unsafe_allow_html=True)
        st.caption("Notify your sales channel when you're ready to reach out.")
        if ready.empty:
            st.info("No PQL schools on this date.")
        for _, r in ready.iterrows():
            with st.container(border=True):
                meta_line = f"Score **{int(r.pql_score)}** · {int(r.active_teachers)} teachers · {int(r.student_sessions)} sessions"
                contact   = _contact_meta(r)
                st.markdown(f"**{r['name']}**")
                st.caption(meta_line + (f" · {contact}" if contact else ""))

                notif_key = f"sent_pql_{r['name']}"
                if st.session_state.get(notif_key):
                    st.success("Sent to Slack")
                else:
                    if st.button("Notify Slack", key=f"btn_pql_{r['name']}",
                                 disabled=not bool(sales_webhook)):
                        msg = (
                            f"🔥 *Ready to buy:* {r['name']}\n"
                            f"• Score: {int(r.pql_score)} · "
                            f"{int(r.active_teachers)} active teachers · "
                            f"{int(r.student_sessions)} student sessions"
                        )
                        if contact:
                            msg += f"\n• Contact: {contact}"
                        if send_slack(msg, sales_webhook):
                            st.session_state[notif_key] = True
                            st.rerun()
                        else:
                            st.error("Failed — check your SLACK_WEBHOOK_SALES URL.")

    with right:
        st.markdown(f"#### 🔴 At risk &nbsp;·&nbsp; {len(at_risk)} schools",
                    unsafe_allow_html=True)
        st.caption("Notify your CS channel for renewal risk follow-ups.")
        if at_risk.empty:
            st.info("No at-risk schools on this date.")
        for _, r in at_risk.iterrows():
            with st.container(border=True):
                meta_line = f"Health **{int(r.health_score)}** · Renews in {int(r.days_to_renewal)}d · ${int(r.arr):,} ARR"
                contact   = _contact_meta(r)
                st.markdown(f"**{r['name']}**")
                st.caption(meta_line + (f" · {contact}" if contact else ""))

                notif_key = f"sent_health_{r['name']}"
                if st.session_state.get(notif_key):
                    st.success("Sent to Slack")
                else:
                    if st.button("Notify Slack", key=f"btn_health_{r['name']}",
                                 disabled=not bool(cs_webhook)):
                        msg = (
                            f"⚠️ *At risk:* {r['name']}\n"
                            f"• Health: {int(r.health_score)} · "
                            f"Renews in {int(r.days_to_renewal)}d · "
                            f"${int(r.arr):,} ARR · "
                            f"{int(r.active_teachers)}/{int(r.seats)} seats active"
                        )
                        if contact:
                            msg += f"\n• Contact: {contact}"
                        if send_slack(msg, cs_webhook):
                            st.session_state[notif_key] = True
                            st.rerun()
                        else:
                            st.error("Failed — check your SLACK_WEBHOOK_CS URL.")
