"""The API contract the UI is built on (docs/gates/PRE-UI-READINESS.md §4).

Endpoints are plain functions, so they are called directly (no HTTP client needed).
"""
import json
from datetime import date

import pytest
from fastapi import HTTPException

from kindling import api, config as C, health


def body(resp):
    return json.loads(resp.body)


# ---------- blocker 1: the date contract ----------

def test_no_date_means_the_pinned_demo_date():
    assert api._parse_date(None) == C.DEMO_AS_OF
    assert api._parse_date("") == C.DEMO_AS_OF
    assert body(api.get_pql(None))["as_of"] == C.DEMO_AS_OF.isoformat()


@pytest.mark.parametrize("bad", ["2026-11-23", "2025-07-31", "2026-08-01", "not-a-date"])
def test_dates_outside_the_simulated_year_are_rejected(bad):
    with pytest.raises(HTTPException) as e:
        api._parse_date(bad)
    assert e.value.status_code == 400


def test_meta_tells_the_ui_its_dates_and_thresholds():
    m = body(api.get_meta())
    assert m["demo_as_of"] == C.DEMO_AS_OF.isoformat()
    assert (m["sim_start"], m["sim_end"]) == (C.START.isoformat(), C.END.isoformat())
    assert m["thresholds"]["health_at_risk_below"] == health.RISK_THRESHOLD


# ---------- blocker 2: backtest numbers come from backtest.py ----------

def test_backtest_results_are_the_files_backtest_py_wrote():
    out = body(api.get_backtest_results())
    runs = {r["id"]: r for r in out["runs"]}
    assert {"pql_backtest", "health_backtest"} <= set(runs)
    for run in runs.values():
        assert run["source"].startswith("results/") and run["generated_at"]
        on_disk = json.loads((C.RESULTS_DIR / f"{run['id']}.json").read_text())
        assert run == on_disk
    # the displayed cells are exactly what the markdown file prints
    md = (C.RESULTS_DIR / "pql_backtest.md").read_text()
    for row in runs["pql_backtest"]["tables"][0]["rows"]:
        line = next(l for l in md.splitlines() if l.startswith(f"| {row['label']} "))
        assert [c.strip() for c in line.strip("|").split("|")][1:] == row["display"]


def test_weekly_backtest_series_has_no_graded_metrics():
    out = body(api.get_backtest())
    assert "results" not in out
    assert out["weeks"][0]["date"] == C.REPLAY_START.isoformat()
    jan5 = next(w for w in out["weeks"] if w["date"] == "2026-01-05")
    assert jan5["naive"] > jan5["kindling"]


# ---------- blocker 3: one lifecycle, one "at risk" ----------

def test_one_at_risk_definition_everywhere():
    d = C.DEMO_AS_OF.isoformat()
    rows = body(api.get_health(d))["scores"]
    stats = body(api.get_stats(d))
    at_risk = [r for r in rows if r["status"] == "At risk"]
    assert stats["at_risk"] == len(at_risk)
    assert stats["arr_at_risk"] == sum(r["arr"] for r in at_risk)
    assert all(r["days_to_renewal"] > 0 for r in rows)          # past renewals are gone
    assert all(r["renewal_date"] > d for r in rows)


# ---------- the school detail contract ----------

def first(plan: str) -> str:
    con = api.connect()
    return con.execute("SELECT school_id FROM schools WHERE plan_at_start = ? ORDER BY 1 LIMIT 1",
                       [plan]).fetchone()[0]


def test_school_detail_has_both_windows():
    sid = first("paid")
    out = body(api.get_school(sid, "2026-01-05"))
    sd, cal = out["windows"]["school_days"], out["windows"]["calendar"]
    assert sd["end"] == cal["end"] == "2026-01-05"
    # the first Monday back: 10 school days reach back past winter break, 14 calendar days don't
    assert sd["start"] < "2025-12-20" < cal["start"]


def test_history_and_usage_never_pass_as_of():
    sid = first("free")
    d = "2026-02-02"
    hist = body(api.get_school_history(sid, d, "school_days"))
    assert all(p["as_of"] <= d for p in hist["points"])
    use = body(api.get_school_usage(sid, d))
    assert use["days"][-1]["day"] == d
    assert {x["kind"] for x in use["days"]} <= {"instructional", "weekend", "break", "summer"}


def test_calendar_breaks_match_config():
    cal = body(api.get_calendar(C.SHARED_CALENDAR))
    assert [(b["start"], b["end"]) for b in cal["breaks"]] == [
        (a.isoformat(), b.isoformat()) for a, b in C.BREAKS]
    with pytest.raises(HTTPException):
        api.get_calendar("nowhere")
