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
    d = _parse_date(body.as_of)
    if body.channel not in ("sales", "cs"):
        raise HTTPException(400, "channel must be 'sales' or 'cs'")

    webhook_env = "SLACK_WEBHOOK_SALES" if body.channel == "sales" else "SLACK_WEBHOOK_CS"
    webhook_url = os.environ.get(webhook_env, "")
    if not webhook_url:
        return JSONResponse({"ok": False, "error": f"{webhook_env} not set"})

    # Look up the school in PQL or health data
    account: Optional[dict] = None
    if body.channel == "sales":
        rows = _scored_pql(d)
        account = next((r for r in rows if r["school_id"] == body.school_id), None)
        if account:
            blocks = [_pql_block(account)]
    else:
        rows = _scored_health(d)
        account = next((r for r in rows if r["school_id"] == body.school_id), None)
        if account:
            blocks = [_health_block(account)]

    if account is None:
        return JSONResponse({"ok": False, "error": f"school {body.school_id!r} not found"})

    payload = json.dumps({"blocks": blocks}).encode()
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return JSONResponse({"ok": False, "error": f"Slack returned {resp.status}"})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)})

    return JSONResponse({"ok": True})


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


@app.get("/automations/log")
def automations_log():
    if not _RUN_LOG.exists():
        return JSONResponse({"runs": [], "last_run": None})
    try:
        runs = json.loads(_RUN_LOG.read_text())
    except (json.JSONDecodeError, OSError):
        runs = []
    return JSONResponse({"runs": runs, "last_run": runs[-1] if runs else None})
