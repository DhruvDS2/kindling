"""FastAPI: score endpoints consumed by n8n and the dashboard.

Run:  uvicorn kindling.api:app --reload

Endpoints
---------
GET /pql?as_of=YYYY-MM-DD      → ranked PQL scores for free schools
GET /health?as_of=YYYY-MM-DD   → health scores for paying schools
GET /slack/pql?as_of=...       → Slack-formatted blocks for top Ready schools
GET /slack/health?as_of=...    → Slack-formatted blocks for At risk schools
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from kindling import config as C, health, pql
from kindling.features import account_features, connect

app = FastAPI(title="Kindling", version="0.1")

TOP_N_SLACK = 3  # accounts per Slack alert


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
        rows.append({
            "school_id": r.school_id,
            "name": r.name,
            "pql_score": int(r.pql_score),
            "status": r.status,
            "reasons": r.reasons,
            "active_teachers": int(r.active_teachers),
            "student_sessions": int(r.student_sessions),
            "admin_signed_up": r.admin_signed_up_on is not None and str(r.admin_signed_up_on) != "NaT",
        })
    return rows


def _scored_health(as_of: date) -> list[dict]:
    con = connect()
    feats = account_features(con, [as_of], mode="school_days")
    scored = health.score(feats).sort_values("health_score")
    rows = []
    for _, r in scored.iterrows():
        days = int(r.days_to_renewal)
        rows.append({
            "school_id": r.school_id,
            "name": r.name,
            "health_score": int(r.health_score),
            "status": r.status,
            "reasons": r.reasons,
            "days_to_renewal": days,
            "arr": int(r.arr),
            "active_teachers": int(r.active_teachers),
            "seats": int(r.seats),
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
