"""FastAPI: score endpoints consumed by n8n and the dashboard.

Run:  uvicorn kindling.api:app --reload

Endpoints
---------
GET  /pql?as_of=YYYY-MM-DD      → ranked PQL scores for free schools
GET  /health?as_of=YYYY-MM-DD   → health scores for paying schools
GET  /slack/pql?as_of=...       → Slack-formatted blocks for top Ready schools
GET  /slack/health?as_of=...    → Slack-formatted blocks for At risk schools
GET  /stats?as_of=YYYY-MM-DD    → aggregate KPIs
GET  /backtest                  → season-aware vs naive comparison (~10s)
POST /notify/slack              → send a school alert to Slack
POST /log-run                   → append an automation run record
GET  /automations/log           → read run log
"""
from __future__ import annotations

import json
import os
import statistics
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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOP_N_SLACK = 3
_RUN_LOG = C.ROOT / "data" / "run_log.json"
_OUTREACH_LOG = C.ROOT / "data" / "outreach_log.json"


# ---------- helpers ----------

def _parse_date(as_of: Optional[str]) -> date:
    if as_of is None:
        return date.today()
    try:
        return datetime.strptime(as_of, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"as_of must be YYYY-MM-DD, got '{as_of}'")


def _scored_pql(as_of: date) -> list[dict]:
    con = connect()
    feats = account_features(con, [as_of], mode="school_days")
    scored = pql.score(feats).sort_values("pql_score", ascending=False)
    rows = []
    for _, r in scored.iterrows():
        district = r.get("district")
        rows.append({
            "school_id": r.school_id,
            "name": r["name"],
            "pql_score": int(r.pql_score),
            "status": r.status,
            "reasons": r.reasons,
            "active_teachers": int(r.active_teachers),
            "student_sessions": int(r.student_sessions),
            "admin_signed_up": r.admin_signed_up_on is not None and str(r.admin_signed_up_on) != "NaT",
            "city": r.get("city", ""),
            "state": r.get("state", ""),
            "district": district if district is not None and pd.notna(district) else None,
            "contact_name": r.get("contact_name", ""),
            "contact_title": r.get("contact_title", ""),
            "contact_email": r.get("contact_email", ""),
        })
    return rows


def _scored_health(as_of: date) -> list[dict]:
    con = connect()
    feats = account_features(con, [as_of], mode="school_days")
    scored = health.score(feats).sort_values("health_score")
    rows = []
    for _, r in scored.iterrows():
        days = int(r.days_to_renewal)
        district = r.get("district")
        rows.append({
            "school_id": r.school_id,
            "name": r["name"],
            "health_score": int(r.health_score),
            "status": r.status,
            "reasons": r.reasons,
            "days_to_renewal": days,
            "arr": int(r.arr),
            "active_teachers": int(r.active_teachers),
            "seats": int(r.seats),
            "city": r.get("city", ""),
            "state": r.get("state", ""),
            "district": district if district is not None and pd.notna(district) else None,
            "contact_name": r.get("contact_name", ""),
            "contact_title": r.get("contact_title", ""),
            "contact_email": r.get("contact_email", ""),
        })
    return rows


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

    at_risk_schools = [
        r for r in health_rows
        if r["status"] == "At risk" and r["days_to_renewal"] >= health.RENEWAL_BUFFER_DAYS
    ]
    at_risk = len(at_risk_schools)
    arr_at_risk = sum(r["arr"] for r in at_risk_schools)
    total_arr = sum(r["arr"] for r in health_rows)
    projected_nrr = (total_arr - arr_at_risk) / total_arr if total_arr > 0 else 1.0

    return JSONResponse({
        "as_of": str(d),
        "ready_to_buy": ready_to_buy,
        "at_risk": at_risk,
        "arr_at_risk": arr_at_risk,
        "arr_at_risk_school_count": at_risk,
        "total_arr": total_arr,
        "projected_nrr": round(projected_nrr, 4),
    })


# ---------- backtest ----------

def _is_break(d: date) -> bool:
    return any(a <= d <= b for a, b in C.BREAKS)


@app.get("/backtest")
def get_backtest():
    con = connect()

    # Advance to the first Monday on or after START
    d = C.START
    while d.weekday() != 0:
        d += timedelta(days=1)

    weeks = []
    naive_false_alarm_total = 0
    naive_winter_alerts = 0
    kindling_winter_alerts = 0
    naive_lead_times: list[int] = []
    kindling_lead_times: list[int] = []

    winter_follow_week = date(2026, 1, 5)

    while d <= C.END:
        kindling_feats = account_features(con, [d], mode="school_days")
        naive_feats = account_features(con, [d], mode="calendar")

        kindling_scored = health.score(kindling_feats)
        naive_scored = health.naive_health(naive_feats)

        kindling_at_risk = kindling_scored[kindling_scored.status == "At risk"]
        naive_at_risk = naive_scored[naive_scored.status == "At risk"]

        weeks.append({
            "date": d.isoformat(),
            "naive": len(naive_at_risk),
            "kindling": len(kindling_at_risk),
            "is_break": _is_break(d),
        })

        # False alarms: naive flags a school that kindling considers healthy
        kindling_healthy_ids = set(
            kindling_scored[kindling_scored.status != "At risk"].school_id
        )
        naive_false_alarm_total += len(
            set(naive_at_risk.school_id) & kindling_healthy_ids
        )

        if d == winter_follow_week:
            naive_winter_alerts = len(naive_at_risk)
            kindling_winter_alerts = len(kindling_at_risk)

        for _, row in naive_at_risk.iterrows():
            naive_lead_times.append(int(row.days_to_renewal))
        for _, row in kindling_at_risk.iterrows():
            kindling_lead_times.append(int(row.days_to_renewal))

        d += timedelta(days=7)

    naive_median = int(statistics.median(naive_lead_times)) if naive_lead_times else 0
    kindling_median = int(statistics.median(kindling_lead_times)) if kindling_lead_times else 0

    results = [
        {
            "metric": "False alarms on healthy schools",
            "naive": naive_false_alarm_total,
            "kindling": 0,
            "kindling_better": True,
        },
        {
            "metric": "Alerts fired the week after winter break",
            "naive": naive_winter_alerts,
            "kindling": kindling_winter_alerts,
            "kindling_better": kindling_winter_alerts < naive_winter_alerts,
        },
        {
            "metric": "Median lead time before renewal (days)",
            "naive": naive_median,
            "kindling": kindling_median,
            "kindling_better": kindling_median >= naive_median,
        },
    ]

    return JSONResponse({
        "weeks": weeks,
        "results": results,
        "takeaway": (
            "The naive model panics every time school goes on break. "
            "Counting school days instead of calendar days keeps alerts flat through breaks, "
            "so the alerts that do fire are real declines."
        ),
    })


# ---------- Slack formatting ----------

def _pql_block(account: dict) -> dict:
    score = account["pql_score"]
    name = account["name"]
    reasons = account["reasons"]
    text = f"🟠 *{name}* · PQL {score} · Ready\n"
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
    """Slack blocks for At risk schools with ≥45 days until renewal."""
    d = _parse_date(as_of)
    scores = [s for s in _scored_health(d)
              if s["status"] == "At risk" and s["days_to_renewal"] >= health.RENEWAL_BUFFER_DAYS
              ][:TOP_N_SLACK]
    if not scores:
        return JSONResponse({"blocks": [{"type": "section", "text": {
            "type": "mrkdwn",
            "text": f"No at-risk schools with 45+ days to renewal as of {d}."}}]})
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
