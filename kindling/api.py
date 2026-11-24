"""FastAPI: score endpoints consumed by n8n and the dashboard.

Run:  uvicorn kindling.api:app --reload

Dates: every as_of must fall inside the simulated year (C.START..C.END), or the
API answers 400. Leave as_of out to get the pinned demo date (C.DEMO_AS_OF).

Endpoints
---------
GET  /meta                         → demo date, simulated year, replay range, thresholds
GET  /pql?as_of=YYYY-MM-DD         → ranked PQL scores for free schools
GET  /health?as_of=YYYY-MM-DD      → health scores for paying schools whose renewal is still ahead
GET  /stats?as_of=YYYY-MM-DD       → KPI tiles (the one "At risk" definition lives in health.score)
GET  /schools/{id}?as_of=...       → one school: profile, lifecycle, score, both window definitions
GET  /schools/{id}/history?as_of=..&mode=school_days|calendar → weekly scores up to as_of
GET  /schools/{id}/usage?as_of=... → daily usage up to as_of, with each day's kind on its calendar
GET  /calendars/{calendar_id}      → a school calendar: first/last day and breaks
GET  /backtest                     → weekly at-risk counts, naive vs Kindling (no outcomes needed)
GET  /backtest/results             → backtest metrics, served from results/*.json written by backtest.py
GET  /slack/pql?as_of=...          → Slack-formatted blocks for top Ready schools
GET  /slack/health?as_of=...       → Slack-formatted blocks for At risk schools
POST /notify/slack                 → send a school alert to Slack
POST /log-run                      → append an automation run record
GET  /automations/log              → read run log
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from kindling import config as C, health, pql
from kindling.features import account_features, connect

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="Kindling", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",  # any local dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

TOP_N_SLACK = 3
# The order the backtest view shows the results files in.
RESULT_RUNS = ["pql_backtest", "health_backtest", "district_calendar_backtest", "pql_admin_threshold",
               "threshold_sweep", "pql_lr_comparison", "health_lr_comparison"]
_RUN_LOG = C.ROOT / "data" / "run_log.json"
_OUTREACH_LOG = C.ROOT / "data" / "outreach_log.json"


# ---------- helpers ----------

def _parse_date(as_of: Optional[str]) -> date:
    """No date → the pinned demo date. A date outside the simulated year → 400."""
    if not as_of:
        return C.DEMO_AS_OF
    try:
        d = datetime.strptime(as_of, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"as_of must be YYYY-MM-DD, got '{as_of}'")
    if not (C.START <= d <= C.END):
        raise HTTPException(400, f"as_of {d} is outside the simulated year ({C.START} to {C.END}). "
                                 f"Leave it out to use the demo date, {C.DEMO_AS_OF}.")
    return d


def _iso(v) -> Optional[str]:
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    return str(v)[:10]


def _window(r, as_of: date) -> dict:
    """The current window ends at as_of; the prior one ends the day before the current starts."""
    start = pd.Timestamp(r.window_start).date()
    return {"start": start.isoformat(), "end": as_of.isoformat(),
            "prev_start": _iso(r.window_prev_start), "prev_end": (start - timedelta(days=1)).isoformat()}


def _profile(r) -> dict:
    district = r.get("district")
    return {
        "school_id": r.school_id,
        "name": r["name"],
        "type": r.type,
        "calendar_id": r.calendar_id,
        "seats": int(r.seats),
        "city": r.get("city", ""),
        "state": r.get("state", ""),
        "district": district if district is not None and pd.notna(district) else None,
        "contact_name": r.get("contact_name", ""),
        "contact_title": r.get("contact_title", ""),
        "contact_email": r.get("contact_email", ""),
    }


def _pql_row(r, as_of: date) -> dict:
    return {
        **_profile(r),
        "pql_score": int(r.pql_score),
        "status": r.status,
        "ready_rule": r.ready_rule if isinstance(r.ready_rule, str) else None,
        "reasons": r.reasons,
        "reason_details": r.reason_details,
        "active_teachers": int(r.active_teachers),
        "active_teachers_prev": int(r.active_teachers_prev),
        "aha_teachers": int(r.aha_teachers),
        "student_sessions": int(r.student_sessions),
        "student_sessions_prev": int(r.student_sessions_prev),
        "tutors_created": int(r.tutors_created),
        "admin_signed_up": _iso(r.admin_signed_up_on) is not None,
        "admin_signed_up_on": _iso(r.admin_signed_up_on),
        "window": _window(r, as_of),
    }


def _health_row(r, as_of: date) -> dict:
    return {
        **_profile(r),
        "health_score": int(r.health_score),
        "status": r.status,
        "reasons": r.reasons,
        "reason_details": r.reason_details,
        "renewal_date": _iso(r.renewal_date),
        "days_to_renewal": int(r.days_to_renewal),
        "arr": int(r.arr),
        "active_teachers": int(r.active_teachers),
        "active_teachers_prev": int(r.active_teachers_prev),
        "student_sessions": int(r.student_sessions),
        "student_sessions_prev": int(r.student_sessions_prev),
        "window": _window(r, as_of),
    }


def _scored_pql(as_of: date) -> list[dict]:
    con = connect()
    feats = account_features(con, [as_of], mode="school_days")
    scored = pql.score(feats).sort_values("pql_score", ascending=False)
    return [_pql_row(r, as_of) for _, r in scored.iterrows()]


def _scored_health(as_of: date) -> list[dict]:
    """Paying schools whose renewal is still ahead. status == "At risk" is the one
    at-risk definition every screen, tile and Slack alert uses."""
    con = connect()
    feats = account_features(con, [as_of], mode="school_days")
    scored = health.score(feats).sort_values("health_score")
    return [_health_row(r, as_of) for _, r in scored.iterrows()]


# ---------- score endpoints ----------

@app.get("/pql")
def get_pql(as_of: Optional[str] = Query(None)):
    d = _parse_date(as_of)
    return JSONResponse({"as_of": str(d), "scores": _scored_pql(d)})


@app.get("/health")
def get_health(as_of: Optional[str] = Query(None)):
    d = _parse_date(as_of)
    return JSONResponse({"as_of": str(d), "scores": _scored_health(d)})


# ---------- stats ----------

@app.get("/stats")
def get_stats(as_of: Optional[str] = Query(None)):
    d = _parse_date(as_of)
    pql_rows = _scored_pql(d)
    health_rows = _scored_health(d)

    ready_to_buy = sum(1 for r in pql_rows if r["status"] == "Ready")
    at_risk_schools = [r for r in health_rows if r["status"] == "At risk"]
    arr_at_risk = sum(r["arr"] for r in at_risk_schools)

    con = connect()
    total_arr = int(con.execute(
        "SELECT coalesce(sum(arr), 0) FROM schools WHERE plan_at_start = 'paid'").fetchone()[0])
    # churn already booked by as_of: a CRM fact (a plan_churned event), not a prediction
    arr_churned = int(con.execute("""
        SELECT coalesce(sum(s.arr), 0) FROM schools s
        WHERE s.school_id IN (SELECT school_id FROM events WHERE event = 'plan_churned' AND day <= ?)
    """, [d]).fetchone()[0])
    projected_nrr = (total_arr - arr_churned - arr_at_risk) / total_arr if total_arr else 1.0

    return JSONResponse({
        "as_of": str(d),
        "ready_to_buy": ready_to_buy,
        "at_risk": len(at_risk_schools),
        "arr_at_risk": arr_at_risk,
        "arr_at_risk_school_count": len(at_risk_schools),
        "paid_schools_scored": len(health_rows),
        "total_arr": total_arr,
        "arr_churned_to_date": arr_churned,
        "projected_nrr": round(projected_nrr, 4),
        "definitions": {
            "at_risk": f"Health score below {health.RISK_THRESHOLD}, renewal still ahead",
            "ready": f"PQL score {pql.READY_THRESHOLD} or higher",
            "projected_nrr": "(total paid ARR − ARR already churned − ARR at risk) / total paid ARR. "
                             "No expansion revenue: seats never change in the simulation.",
        },
    })


# ---------- meta ----------

@app.get("/meta")
def get_meta():
    replay = list(C.mondays())
    return JSONResponse({
        "demo_as_of": C.DEMO_AS_OF.isoformat(),
        "sim_start": C.START.isoformat(),
        "sim_end": C.END.isoformat(),
        "replay_start": replay[0].isoformat(),
        "replay_end": replay[-1].isoformat(),
        "shared_calendar": C.SHARED_CALENDAR,
        "windows": {"school_days": C.WINDOW_SCHOOL_DAYS, "calendar_days": C.WINDOW_CAL_DAYS},
        "thresholds": {
            "pql_ready": pql.READY_THRESHOLD,
            "pql_admin_ready": pql.ADMIN_READY_THRESHOLD,
            "health_at_risk_below": health.RISK_THRESHOLD,
            "renewal_buffer_days": health.RENEWAL_BUFFER_DAYS,
            "health_min_school_days": health.MIN_SCHOOL_DAYS,
        },
    })


# ---------- one school ----------

def _school_or_404(con, school_id: str) -> dict:
    df = con.execute("SELECT * FROM schools WHERE school_id = ?", [school_id]).df()
    if df.empty:
        raise HTTPException(404, f"school {school_id!r} not found")
    return df.iloc[0]


def _renewal_outcome(con, school_id: str, d: date) -> Optional[str]:
    row = con.execute("""
        SELECT event FROM events WHERE school_id = ? AND day <= ?
          AND event IN ('plan_renewed', 'plan_churned', 'plan_expanded')
        ORDER BY day DESC LIMIT 1""", [school_id, d]).fetchone()
    return {"plan_renewed": "renewed", "plan_churned": "churned",
            "plan_expanded": "expanded"}.get(row[0]) if row else None


@app.get("/schools/{school_id}")
def get_school(school_id: str, as_of: Optional[str] = Query(None)):
    """Profile, lifecycle, current score, and the school-day vs calendar-day windows at as_of."""
    d = _parse_date(as_of)
    con = connect()
    s = _school_or_404(con, school_id)
    feats = {m: account_features(con, [d], mode=m) for m in ("school_days", "calendar")}
    row = {m: f[f.school_id == school_id].iloc[0] for m, f in feats.items()}
    sd = row["school_days"]

    score, kind, outcome = None, None, None
    if s.plan_at_start == "free":
        kind = "pql"
        if _iso(sd.converted_on):
            lifecycle = "converted"
        elif _iso(sd.first_signup) is None:
            lifecycle = "no_signup"
        else:
            lifecycle = "free"
            scored = pql.score(feats["school_days"])
            hit = scored[scored.school_id == school_id]
            if not hit.empty:
                score = _pql_row(hit.iloc[0], d)
    else:
        kind = "health"
        outcome = _renewal_outcome(con, school_id, d)
        scored = health.score(feats["school_days"])
        hit = scored[scored.school_id == school_id]
        if outcome:
            lifecycle = outcome
        elif hit.empty:
            lifecycle = "not_started"  # fewer than one full window of school days so far
        else:
            lifecycle = "paid"
            score = _health_row(hit.iloc[0], d)

    return JSONResponse({
        "as_of": d.isoformat(),
        **_profile(sd),
        "plan": s.plan_at_start,
        "students": int(s.students),
        "region": s.region,
        "signup_date": _iso(s.signup_date),
        "renewal_date": _iso(s.renewal_date),
        "arr": int(s.arr),
        "lifecycle": lifecycle,
        "renewal_outcome": outcome,
        "first_signup": _iso(sd.first_signup),
        "converted_on": _iso(sd.converted_on),
        "score_kind": kind,
        "score": score,
        "school_days_elapsed": int(sd.school_days_elapsed),
        "windows": {
            "school_days": {**_window(row["school_days"], d), "length": C.WINDOW_SCHOOL_DAYS,
                            "unit": "school days", "calendar_id": sd.calendar_id},
            "calendar": {**_window(row["calendar"], d), "length": C.WINDOW_CAL_DAYS,
                         "unit": "calendar days"},
        },
    })


@app.get("/schools/{school_id}/history")
def get_school_history(school_id: str, as_of: Optional[str] = Query(None),
                       mode: str = Query("school_days", pattern="^(school_days|calendar)$")):
    """The school's score every Monday from the replay start up to as_of, in one window mode."""
    d = _parse_date(as_of)
    con = connect()
    s = _school_or_404(con, school_id)
    dates = list(C.mondays(C.REPLAY_START, d))
    points = []
    if dates:
        feats = account_features(con, dates, mode=mode)
        kind = "pql" if s.plan_at_start == "free" else "health"
        scored = (pql.score(feats) if kind == "pql" else health.score(feats))
        scored = scored[scored.school_id == school_id].sort_values("as_of")
        col = "pql_score" if kind == "pql" else "health_score"
        points = [{"as_of": _iso(r.as_of), "score": int(r[col]), "status": r.status, "reasons": r.reasons,
                   "active_teachers": int(r.active_teachers), "student_sessions": int(r.student_sessions)}
                  for _, r in scored.iterrows()]
    return JSONResponse({"school_id": school_id, "as_of": d.isoformat(), "mode": mode,
                         "score_kind": "pql" if s.plan_at_start == "free" else "health", "points": points})


@app.get("/schools/{school_id}/usage")
def get_school_usage(school_id: str, as_of: Optional[str] = Query(None)):
    """Daily usage from the start of the simulated year to as_of (teacher role only),
    with each day's kind on the school's own calendar."""
    d = _parse_date(as_of)
    con = connect()
    s = _school_or_404(con, school_id)
    df = con.execute("""
        SELECT c.day, c.kind,
            count(DISTINCT CASE WHEN e.event = 'teacher_active' AND t.role = 'teacher'
                                THEN e.teacher_id END)                                  AS active_teachers,
            coalesce(sum(CASE WHEN e.event = 'student_session' THEN e.n END), 0)        AS student_sessions,
            coalesce(sum(CASE WHEN e.event = 'tutor_created' AND t.role = 'teacher'
                              THEN e.n END), 0)                                         AS tutors_created
        FROM school_calendars c
        LEFT JOIN events e ON e.day = c.day AND e.school_id = ?
        LEFT JOIN teachers t ON t.teacher_id = e.teacher_id
        WHERE c.calendar_id = ? AND c.day <= ?
        GROUP BY 1, 2 ORDER BY 1
    """, [school_id, s.calendar_id, d]).df()
    days = [{"day": _iso(r.day), "kind": r.kind, "active_teachers": int(r.active_teachers),
             "student_sessions": int(r.student_sessions), "tutors_created": int(r.tutors_created)}
            for _, r in df.iterrows()]
    return JSONResponse({"school_id": school_id, "as_of": d.isoformat(),
                         "calendar_id": s.calendar_id, "days": days})


def _calendar(con, calendar_id: str) -> Optional[dict]:
    cal = con.execute("SELECT day, kind FROM school_calendars WHERE calendar_id = ? ORDER BY day",
                      [calendar_id]).df()
    if cal.empty:
        return None
    instr = cal[cal.kind == "instructional"].day
    breaks, run = [], None
    for _, r in cal.iterrows():  # consecutive 'break' days form one break
        if r.kind == "break":
            run = [r.day, r.day] if run is None else [run[0], r.day]
        elif run is not None:
            breaks.append(run); run = None
    if run is not None:
        breaks.append(run)
    return {"calendar_id": calendar_id, "first_day": _iso(instr.min()), "last_day": _iso(instr.max()),
            "school_days": int(len(instr)),
            "breaks": [{"start": _iso(a), "end": _iso(b)} for a, b in breaks]}


@app.get("/calendars/{calendar_id}")
def get_calendar(calendar_id: str):
    cal = _calendar(connect(), calendar_id)
    if cal is None:
        raise HTTPException(404, f"calendar {calendar_id!r} not found")
    return JSONResponse(cal)


# ---------- backtest ----------

@app.get("/backtest")
def get_backtest():
    """Weekly at-risk counts, naive (calendar windows) vs Kindling (school days), every
    Monday of the replay. Descriptive only: no outcomes needed. The graded metrics
    (precision, recall, false alarms) come from /backtest/results."""
    con = connect()
    dates = list(C.mondays())
    counts = {}
    for label, mode in (("kindling", "school_days"), ("naive", "calendar")):
        scored = health.score(account_features(con, dates, mode=mode))
        at_risk = scored[scored.status == "At risk"]
        counts[label] = at_risk.groupby(at_risk.as_of.dt.date).size().to_dict()
    cal = _calendar(con, C.SHARED_CALENDAR)
    breaks = [(date.fromisoformat(b["start"]), date.fromisoformat(b["end"])) for b in cal["breaks"]]
    first, last = date.fromisoformat(cal["first_day"]), date.fromisoformat(cal["last_day"])
    weeks = []
    for d in dates:
        week = [d + timedelta(days=i) for i in range(7)]
        weeks.append({
            "date": d.isoformat(),
            "naive": int(counts["naive"].get(d, 0)),
            "kindling": int(counts["kindling"].get(d, 0)),
            "is_break": any(a <= x <= b for x in week for a, b in breaks),
            "is_summer": d > last or d + timedelta(days=6) < first,
        })
    return JSONResponse({
        "replay": {"start": dates[0].isoformat(), "end": dates[-1].isoformat()},
        "calendar": cal,
        "weeks": weeks,
    })


@app.get("/backtest/results")
def get_backtest_results():
    """Backtest metrics exactly as backtest.py printed them, read from results/*.json.
    backtest.py is the only module that grades against outcomes; this endpoint only
    serves its files, with each file's source and run timestamp."""
    runs, missing = [], []
    for run_id in RESULT_RUNS:
        path = C.RESULTS_DIR / f"{run_id}.json"
        if path.exists():
            runs.append(json.loads(path.read_text()))
        else:
            missing.append(run_id)
    return JSONResponse({"runs": runs, "missing": missing})


# ---------- Slack formatting ----------

def _pql_block(account: dict) -> dict:
    score = account["pql_score"]
    name = account["name"]
    reasons = account["reasons"]
    text = f"🟢 *{name}* · PQL {score} · Ready\n"
    text += "\n".join(f"• {r}" for r in reasons[:3])
    return {"type": "section", "text": {"type": "mrkdwn", "text": text}}


def _health_block(account: dict) -> dict:
    score = account["health_score"]
    name = account["name"]
    reasons = account["reasons"]
    days = account["days_to_renewal"]
    arr = account["arr"]
    text = (f"🔴 *{name}* · Health {score} · At risk · "
            f"renews in {days} days · ${arr:,} ARR\n")
    text += "\n".join(f"• {r}" for r in reasons[:3])
    return {"type": "section", "text": {"type": "mrkdwn", "text": text}}


def _divider():
    return {"type": "divider"}


def _draft_email(account: dict) -> tuple[str, str]:
    """Return (subject, body) depending on the school's PQL status."""
    name = account["name"]
    first = (account.get("contact_name") or "there").split()[0]
    teachers = account["active_teachers"]
    sessions = account["student_sessions"]
    reasons = account.get("reasons", [])
    status = account.get("status", "Not yet")

    if account.get("pql_score", 0) == 0:
        subject = f"Getting started at {name}"
        body = (
            f"Hi {first},\n\n"
            f"{name} signed up for Kindling a little while back and I wanted to reach out personally. "
            f"Getting a new platform off the ground is always a lift, and I want to make sure you're not stuck on anything.\n\n"
            f"We've helped schools like yours get their first teachers up and running in under a week — "
            f"I'd love to do the same for you. Even a 15-minute call to walk through the setup together "
            f"can make a big difference.\n\n"
            f"Would that be useful? Happy to work around your calendar.\n\nBest,"
        )
    elif status == "Ready":
        subject = f"Upgrading {name} — worth a quick chat?"
        body = (
            f"Hi {first},\n\n"
            f"I've been looking at how {name} has been using the platform — "
            f"{teachers} teachers active with {sessions:,} student sessions is a great sign that it's working for your team.\n\n"
            f"At this point it makes sense to talk about a full license. "
            f"We can lock in pricing now before the next school year planning cycle kicks off, "
            f"and I can walk you through exactly what a full rollout looks like for a school your size.\n\n"
            f"Would a 20-minute call this week work? Happy to fit around your schedule.\n\nBest,"
        )
    else:
        subject = f"How's {name} finding the platform?"
        body = (
            f"Hi {first},\n\n"
            f"Wanted to check in on how things are going at {name}. "
            f"I can see {teachers} teacher{'s' if teachers != 1 else ''} have been exploring the platform "
            f"and wanted to make sure the team is getting what they need out of it.\n\n"
            f"A few things I'd love to understand: Is there anything that's gotten in the way of wider adoption? "
            f"Are there features you haven't had a chance to dig into yet? "
            f"Or is there a better time of year to reconnect?\n\n"
            f"Happy to jump on a quick call to walk through anything — no agenda, just want to make sure "
            f"{name} is set up for success.\n\nBest,"
        )
    return subject, body


def _gmail_url(to_email: str, subject: str, body: str) -> str:
    return (
        "https://mail.google.com/mail/?view=cm&fs=1"
        f"&to={urllib.parse.quote(to_email)}"
        f"&su={urllib.parse.quote(subject)}"
        f"&body={urllib.parse.quote(body)}"
    )


def _pql_blocks_with_email(account: dict) -> list[dict]:
    """Slack blocks for a PQL school: score + reasons + status-appropriate email draft + Gmail button."""
    score = account["pql_score"]
    name = account["name"]
    reasons = account.get("reasons", [])
    status = account.get("status", "Not yet")
    contact_name = account.get("contact_name", "")
    contact_title = account.get("contact_title", "")
    contact_email = account.get("contact_email", "")

    emoji = "🟠" if status == "Ready" else "🔵"
    info = f"{emoji} *{name}* · PQL {score} · {status}\n" + "\n".join(f"• {r}" for r in reasons[:3])
    subject, body = _draft_email(account)
    email_preview = (
        f"*Draft email → {contact_name}* ({contact_title})\n"
        f"*Subject:* {subject}\n\n"
        f"{body}"
    )

    blocks: list[dict] = [
        {"type": "section", "text": {"type": "mrkdwn", "text": info}},
        {"type": "divider"},
        {"type": "section", "text": {"type": "mrkdwn", "text": email_preview}},
    ]

    if contact_email:
        blocks.append({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {"type": "plain_text", "text": "Send in Gmail →"},
                "url": _gmail_url(contact_email, subject, body),
                "style": "primary",
            }]
        })

    return blocks


@app.get("/slack/pql")
def slack_pql(as_of: Optional[str] = Query(None)):
    """Slack blocks for the top Ready schools — POST directly to a webhook."""
    d = _parse_date(as_of)
    scores = [s for s in _scored_pql(d) if s["status"] == "Ready"][:TOP_N_SLACK]
    if not scores:
        return JSONResponse({"blocks": [{"type": "section", "text": {
            "type": "mrkdwn", "text": f"No schools ready to buy as of {d}."}}]})
    header = {"type": "header", "text": {"type": "plain_text",
              "text": f"🔥 {len(scores)} school{'s' if len(scores) != 1 else ''} ready to buy · {d}"}}
    blocks = [header]
    for s in scores:
        blocks.append(_divider())
        blocks.append(_pql_block(s))
    return JSONResponse({"blocks": blocks})


@app.get("/slack/health")
def slack_health(as_of: Optional[str] = Query(None)):
    """Slack blocks for At risk schools (the same definition as every screen), lowest score first."""
    d = _parse_date(as_of)
    scores = [s for s in _scored_health(d) if s["status"] == "At risk"][:TOP_N_SLACK]
    if not scores:
        return JSONResponse({"blocks": [{"type": "section", "text": {
            "type": "mrkdwn",
            "text": f"No at-risk schools as of {d}."}}]})
    arr_at_risk = sum(s["arr"] for s in scores)
    header = {"type": "header", "text": {"type": "plain_text",
              "text": f"⚠️ {len(scores)} school{'s' if len(scores) != 1 else ''} at risk · "
                      f"${arr_at_risk:,} ARR · {d}"}}
    blocks = [header]
    for s in scores:
        blocks.append(_divider())
        blocks.append(_health_block(s))
    return JSONResponse({"blocks": blocks})


# ---------- manual Slack notify ----------

class _NotifyBody(BaseModel):
    school_id: str
    channel: str  # 'sales' or 'cs'
    as_of: Optional[str] = None


@app.post("/notify/slack")
def notify_slack(body: _NotifyBody):
    """Build Slack blocks and forward to n8n, which routes to the right channel."""
    d = _parse_date(body.as_of)
    if body.channel not in ("sales", "cs"):
        raise HTTPException(400, "channel must be 'sales' or 'cs'")

    n8n_webhook = os.environ.get("N8N_NOTIFY_WEBHOOK", "")
    if not n8n_webhook:
        return JSONResponse({"ok": False, "error": "N8N_NOTIFY_WEBHOOK not set — import kindling_notify.json into n8n and add the webhook URL to .env"})

    contacted_account: dict | None = None
    if body.channel == "sales":
        rows = _scored_pql(d)
        contacted_account = next((r for r in rows if r["school_id"] == body.school_id), None)
        if contacted_account is None:
            return JSONResponse({"ok": False, "error": f"school {body.school_id!r} not found"})
        blocks = _pql_blocks_with_email(contacted_account)
    else:
        # cs channel: could be a "Not yet" PQL school or an "At risk" health school
        pql_rows = _scored_pql(d)
        contacted_account = next((r for r in pql_rows if r["school_id"] == body.school_id), None)
        if contacted_account is not None:
            blocks = _pql_blocks_with_email(contacted_account)
        else:
            health_rows = _scored_health(d)
            contacted_account = next((r for r in health_rows if r["school_id"] == body.school_id), None)
            if contacted_account is None:
                return JSONResponse({"ok": False, "error": f"school {body.school_id!r} not found"})
            blocks = [_health_block(contacted_account)]

    payload = json.dumps({"blocks": blocks, "channel": body.channel}).encode()
    req = urllib.request.Request(
        n8n_webhook,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                return JSONResponse({"ok": False, "error": f"n8n returned {resp.status}"})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)})

    # Log the outreach so the follow-up workflow can detect non-responders
    try:
        log: list[dict] = []
        if _OUTREACH_LOG.exists():
            log = json.loads(_OUTREACH_LOG.read_text())
        log.append({
            "school_id": body.school_id,
            "name": contacted_account.get("name", body.school_id) if contacted_account else body.school_id,
            "channel": body.channel,
            "contacted_at": date.today().isoformat(),
            "pql_score_at_contact": contacted_account.get("pql_score", 0) if contacted_account else 0,
        })
        _OUTREACH_LOG.write_text(json.dumps(log[-200:], indent=2))  # keep last 200
    except Exception:
        pass  # never fail a notify just because the log write failed

    return JSONResponse({"ok": True})


@app.get("/outreach/stale")
def outreach_stale(days: int = Query(14)):
    """
    Return schools contacted >= `days` ago whose PQL score hasn't improved since.
    Used by the n8n follow-up workflow to surface non-responders.
    """
    if not _OUTREACH_LOG.exists():
        return JSONResponse({"stale": [], "total": 0})

    try:
        log: list[dict] = json.loads(_OUTREACH_LOG.read_text())
    except (json.JSONDecodeError, OSError):
        return JSONResponse({"stale": [], "total": 0})

    cutoff = date.today() - timedelta(days=days)
    today_str = date.today().isoformat()

    # Deduplicate: keep only the most recent outreach per school
    seen: dict[str, dict] = {}
    for entry in log:
        sid = entry["school_id"]
        if sid not in seen or entry["contacted_at"] > seen[sid]["contacted_at"]:
            seen[sid] = entry

    current_pql = {r["school_id"]: r["pql_score"] for r in _scored_pql(_parse_date(None))}

    stale = []
    for entry in seen.values():
        contacted = date.fromisoformat(entry["contacted_at"])
        if contacted > cutoff:
            continue  # contacted too recently
        current_score = current_pql.get(entry["school_id"], entry["pql_score_at_contact"])
        improved = current_score > entry["pql_score_at_contact"]
        if not improved:
            days_since = (date.today() - contacted).days
            stale.append({
                **entry,
                "days_since_contact": days_since,
                "current_pql_score": current_score,
                "checked_at": today_str,
            })

    stale.sort(key=lambda x: x["days_since_contact"], reverse=True)
    return JSONResponse({"stale": stale, "total": len(stale)})


# ---------- pipeline snapshots ----------

_SNAPSHOT_DDL = """
CREATE TABLE IF NOT EXISTS pql_snapshots (
    as_of     DATE NOT NULL,
    school_id TEXT NOT NULL,
    name      TEXT NOT NULL,
    pql_score INT  NOT NULL,
    status    TEXT NOT NULL,
    PRIMARY KEY (as_of, school_id)
)
"""


@app.post("/snapshot/pql")
def snapshot_pql(as_of: Optional[str] = Query(None)):
    """Score all free schools for as_of and persist to pql_snapshots (idempotent)."""
    d = _parse_date(as_of)
    # Use a single read-write connection so account_features and the INSERT share one handle
    con = connect(read_only=False)
    feats = account_features(con, [d], mode="school_days")
    scored = pql.score(feats).sort_values("pql_score", ascending=False)

    con.execute(_SNAPSHOT_DDL)
    con.execute("DELETE FROM pql_snapshots WHERE as_of = CAST(? AS DATE)", [d])
    rows = [
        (d, row.school_id, row["name"], int(row.pql_score), row.status)
        for _, row in scored.iterrows()
    ]
    con.executemany("INSERT INTO pql_snapshots VALUES (?, ?, ?, ?, ?)", rows)
    con.close()

    return JSONResponse({"ok": True, "as_of": str(d), "count": len(rows)})


@app.get("/snapshot/pql/schools")
def snapshot_pql_schools(as_of: Optional[str] = Query(None), status: Optional[str] = Query(None)):
    """Return individual schools from a snapshot, filtered by status. Defaults to latest snapshot."""
    con = connect()
    has_table = con.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'pql_snapshots'"
    ).fetchone()
    if not has_table:
        con.close()
        return JSONResponse({"as_of": None, "schools": []})

    if as_of:
        d = _parse_date(as_of)
    else:
        row = con.execute("SELECT MAX(as_of) FROM pql_snapshots").fetchone()
        if not row or row[0] is None:
            con.close()
            return JSONResponse({"as_of": None, "schools": []})
        d = row[0]

    query = "SELECT school_id, name, pql_score, status FROM pql_snapshots WHERE as_of = CAST(? AS DATE)"
    params: list = [d]
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY pql_score DESC"

    df = con.execute(query, params).df()
    con.close()
    return JSONResponse({"as_of": str(d)[:10], "schools": df.to_dict(orient="records")})


@app.get("/pipeline/funnel")
def pipeline_funnel(n_weeks: int = Query(8)):
    """Return funnel stage counts per snapshot + moves between the two most recent snapshots."""
    con = connect()

    has_table = con.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'pql_snapshots'"
    ).fetchone()
    if not has_table:
        con.close()
        return JSONResponse({"snapshots": [], "latest": None, "prev": None, "moves": []})

    funnel_df = con.execute("""
        SELECT
            as_of,
            COUNT(CASE WHEN status = 'Not yet' THEN 1 END) AS not_yet,
            COUNT(CASE WHEN status = 'Ready'   THEN 1 END) AS ready
        FROM pql_snapshots
        GROUP BY as_of
        ORDER BY as_of DESC
        LIMIT ?
    """, [n_weeks]).df()

    if funnel_df.empty:
        con.close()
        return JSONResponse({"snapshots": [], "latest": None, "prev": None, "moves": []})

    snapshots = list(reversed([
        {"as_of": str(row["as_of"])[:10], "not_yet": int(row["not_yet"]), "ready": int(row["ready"])}
        for _, row in funnel_df.iterrows()
    ]))

    moves = []
    if len(snapshots) >= 2:
        latest_date = snapshots[-1]["as_of"]
        prev_date = snapshots[-2]["as_of"]
        moves_df = con.execute("""
            SELECT curr.school_id, curr.name, curr.as_of,
                   prev.status AS from_status, curr.status AS to_status
            FROM pql_snapshots curr
            JOIN pql_snapshots prev ON curr.school_id = prev.school_id
            WHERE curr.as_of = CAST(? AS DATE) AND prev.as_of = CAST(? AS DATE)
              AND curr.status != prev.status
            ORDER BY to_status DESC, curr.name
        """, [latest_date, prev_date]).df()
        moves = [
            {
                "school_id": row["school_id"],
                "name": row["name"],
                "as_of": str(row["as_of"])[:10],
                "from_status": row["from_status"],
                "to_status": row["to_status"],
            }
            for _, row in moves_df.iterrows()
        ]

    con.close()
    latest = snapshots[-1] if snapshots else None
    prev = snapshots[-2] if len(snapshots) >= 2 else None
    return JSONResponse({"snapshots": snapshots, "latest": latest, "prev": prev, "moves": moves})


# ---------- run log ----------

class _LogRunBody(BaseModel):
    run_at: str
    pql_alerts: int
    health_alerts: int
    email_drafts: int
    status: str


@app.post("/log-run")
def log_run(body: _LogRunBody):
    runs: list[dict] = []
    if _RUN_LOG.exists():
        try:
            runs = json.loads(_RUN_LOG.read_text())
        except (json.JSONDecodeError, OSError):
            runs = []

    runs.append(body.model_dump())
    runs = runs[-50:]  # keep last 50
    _RUN_LOG.write_text(json.dumps(runs, indent=2))
    return JSONResponse({"ok": True})


@app.get("/prospects/top10")
def prospects_top10(as_of: Optional[str] = Query(None)):
    """
    Score every cold/dormant school (PQL < 20) on four signals and return the
    top 10 worth pursuing.  Each school gets a 0–100 priority score with a
    plain-language breakdown of why it ranked where it did.

    Scoring signals
    ---------------
    has_contact      40 pts   Contact name + email on file → immediately actionable
    is_district      25 pts   District school → more teachers, higher ARR ceiling
    warm_state       25 pts   State has ≥ 1 paying (healthy) customer → reference sell
    some_activity    10 pts   PQL 1–19 (dormant) vs 0 (never opened) → intent was shown
    """
    d = _parse_date(as_of)
    pql_rows = _scored_pql(d)
    health_rows = _scored_health(d)

    # Build set of states that have at least one paying/healthy customer
    paying_states: set[str] = {r["state"] for r in health_rows if r.get("state")}

    prospects = [r for r in pql_rows if r["pql_score"] < 20]

    scored = []
    for s in prospects:
        signals: list[dict] = []
        score = 0

        has_contact = bool(s.get("contact_name") and s.get("contact_email"))
        if has_contact:
            score += 40
            signals.append({"label": "Contact on file", "pts": 40,
                             "detail": f"{s['contact_name']} · {s['contact_email']}"})
        else:
            signals.append({"label": "No contact on file", "pts": 0,
                             "detail": "Find a contact before reaching out"})

        is_district = bool(s.get("district"))
        if is_district:
            score += 25
            signals.append({"label": "District school", "pts": 25,
                             "detail": f"{s['district']} — higher ARR ceiling than independent"})

        warm_state = s.get("state") in paying_states
        if warm_state:
            score += 25
            paying_in_state = sum(1 for r in health_rows if r.get("state") == s.get("state"))
            signals.append({"label": "Reference customers nearby", "pts": 25,
                             "detail": f"{paying_in_state} paying school{'s' if paying_in_state != 1 else ''} already in {s['state']}"})

        has_activity = s["pql_score"] > 0
        if has_activity:
            score += 10
            signals.append({"label": "Some prior activity", "pts": 10,
                             "detail": f"{s['active_teachers']} teacher{'s' if s['active_teachers'] != 1 else ''} tried it · {s['student_sessions']} student sessions"})
        else:
            signals.append({"label": "Zero activity", "pts": 0,
                             "detail": "No teacher or student has opened the product yet"})

        scored.append({**s, "priority_score": score, "signals": signals})

    top10 = sorted(scored, key=lambda x: x["priority_score"], reverse=True)[:10]
    return JSONResponse({"top10": top10, "total_prospects": len(prospects)})


@app.get("/automations/log")
def automations_log():
    if not _RUN_LOG.exists():
        return JSONResponse({"runs": [], "last_run": None})
    try:
        runs = json.loads(_RUN_LOG.read_text())
    except (json.JSONDecodeError, OSError):
        runs = []
    return JSONResponse({"runs": runs, "last_run": runs[-1] if runs else None})
