"""Tests that keep the backtest honest."""
import re
from datetime import date
from pathlib import Path

import duckdb
import pandas as pd
import pytest

from kindling import config as C
from kindling import health, pql
from kindling.features import account_features

# Everything that serves or shows scores must be blind to outcomes. Paths are from the repo root.
ENGINE_MODULES = ["kindling/features.py", "kindling/pql.py", "kindling/health.py",
                  "kindling/api.py", "kindling/report.py", "dashboard/app.py"]


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    if not C.DB_PATH.exists():
        from kindling import simulate
        simulate.main()
    return C.DB_PATH


@pytest.mark.parametrize("mode", ["school_days", "school_days_shared", "calendar"])
@pytest.mark.parametrize("as_of", [date(2025, 11, 3), date(2026, 1, 5), date(2026, 3, 23)])
def test_features_never_use_future_events(db_path, tmp_path, as_of, mode):
    """Deleting every event after as_of must not change any feature, in any window mode."""
    full = duckdb.connect(str(db_path), read_only=True)
    before = account_features(full, [as_of], mode=mode)
    full.close()

    cut_path = tmp_path / "cut.duckdb"
    cut = duckdb.connect(str(cut_path))
    cut.execute(f"ATTACH '{db_path}' AS src (READ_ONLY)")
    # Calendars stay whole: a district publishes its calendar before the year starts.
    for t in ("calendar", "school_calendars", "schools", "teachers", "events"):
        cut.execute(f"CREATE TABLE {t} AS SELECT * FROM src.{t}")
    cut.execute("DELETE FROM events WHERE day > ?", [as_of])
    after = account_features(cut, [as_of], mode=mode)
    cut.close()

    pd.testing.assert_frame_equal(before.reset_index(drop=True), after.reset_index(drop=True))


def test_engine_never_reads_truth():
    for name in ENGINE_MODULES:
        src = (Path(C.ROOT) / name).read_text()
        assert not re.search(r"\btruth\b", src.split('"""', 2)[-1]), f"{name} mentions truth"


def test_pql_score_shape(db_path):
    con = duckdb.connect(str(db_path), read_only=True)
    scored = pql.score(account_features(con, [date(2026, 2, 2)]))
    assert scored.pql_score.between(0, 100).all()
    assert scored.reasons.apply(len).le(3).all()
    assert set(scored.status) <= {"Ready", "Not yet"}
    assert (scored.plan_at_start == "free").all()


def test_health_score_shape(db_path):
    con = duckdb.connect(str(db_path), read_only=True)
    scored = health.score(account_features(con, [date(2026, 2, 2)]))
    assert scored.health_score.between(0, 100).all()
    assert scored.reasons.apply(len).le(3).all()
    assert set(scored.status) <= {"At risk", "Healthy"}
    assert (scored.plan_at_start == "paid").all()


def test_health_fewer_false_alarms_than_naive(db_path):
    """School-day windows must produce fewer false alarms than calendar windows on Jan 5."""
    from kindling.features import account_features as af
    con = duckdb.connect(str(db_path), read_only=True)
    as_of = date(2026, 1, 5)  # first Monday back after winter break — the trap date
    sd_scored  = health.score(af(con, [as_of], mode="school_days"))
    cal_scored = health.naive_health(af(con, [as_of], mode="calendar"))
    sd_alarms  = (sd_scored.status  == "At risk").sum()
    cal_alarms = (cal_scored.status == "At risk").sum()
    assert sd_alarms < cal_alarms, (
        f"School-day windows ({sd_alarms}) should flag fewer schools than "
        f"calendar windows ({cal_alarms}) on {as_of}"
    )


# ---------- per-district calendars ----------

@pytest.fixture(scope="module")
def district_db(tmp_path_factory):
    from kindling import simulate
    path = tmp_path_factory.mktemp("districts") / "districts.duckdb"
    simulate.write(simulate.World(calendars="district").build().frames(), path)
    return path


def test_default_world_puts_every_school_on_the_shared_calendar(db_path):
    con = duckdb.connect(str(db_path), read_only=True)
    ids = con.sql("SELECT DISTINCT calendar_id FROM schools").fetchall()
    assert ids == [(C.SHARED_CALENDAR,)]


def test_district_window_skips_the_districts_own_break(district_db):
    """On the Monday after New England's April vacation, a Northeast school's 10
    school days must reach back past the vacation; the national calendar's window
    must not (the national calendar has no April break)."""
    con = duckdb.connect(str(district_db), read_only=True)
    as_of = date(2026, 4, 27)
    own = account_features(con, [as_of], mode="school_days")
    shared = account_features(con, [as_of], mode="school_days_shared")
    ne = own[own.calendar_id == "northeast"].school_id
    assert len(ne) > 0
    # same school, two windows: on its own calendar the vacation week is skipped,
    # so fewer of its school days are dead and it shows more student activity
    own_ne = own[own.school_id.isin(ne)].student_sessions.sum()
    shared_ne = shared[shared.school_id.isin(ne)].student_sessions.sum()
    assert own_ne > shared_ne


def test_health_not_scored_before_a_full_window(district_db):
    """Northeast schools start Sep 2: on Sep 1 there is no window to measure."""
    con = duckdb.connect(str(district_db), read_only=True)
    feats = account_features(con, [date(2025, 9, 1)], mode="school_days")
    scored = health.score(feats)
    ne_paid = feats[(feats.calendar_id == "northeast") & (feats.plan_at_start == "paid")]
    assert len(ne_paid) > 0
    assert not scored.school_id.isin(ne_paid.school_id).any()


# ---------- admin rule (run 3) ----------

def test_admin_rule_is_off_by_default_and_only_adds_admin_schools(db_path):
    con = duckdb.connect(str(db_path), read_only=True)
    feats = account_features(con, [date(2025, 11, 3), date(2026, 2, 2), date(2026, 3, 23)])
    run2 = pql.score(feats)
    run3 = pql.score(feats, admin_threshold=pql.ADMIN_READY_THRESHOLD)
    # default: exactly the score rule
    assert ((run2.status == "Ready") == (run2.pql_score >= pql.READY_THRESHOLD)).all()
    assert set(run2.ready_rule.dropna()) <= {"score"}
    # run 3 never removes a Ready school, and every school it adds has an admin
    assert (run3.status[run2.status == "Ready"] == "Ready").all()
    added = run3[(run3.status == "Ready") & (run2.status != "Ready")]
    assert (added.ready_rule == "admin").all()
    assert added.admin_signed_up_on.notna().all()
    assert added.pql_score.between(pql.ADMIN_READY_THRESHOLD, pql.READY_THRESHOLD - 1).all()


def test_scores_handle_dates_before_school_starts(db_path):
    """Aug 4 is summer for every school: health scores nobody, and nothing crashes."""
    con = duckdb.connect(str(db_path), read_only=True)
    feats = account_features(con, [date(2025, 8, 4)])
    scored = health.score(feats)
    assert scored.empty and {"health_score", "reasons", "status"} <= set(scored.columns)
    assert set(pql.score(feats).columns) >= {"pql_score", "reasons", "status", "ready_rule"}



# ---------- lifecycle and grading rules ----------

def test_health_stops_scoring_at_renewal(db_path):
    """Once a school's renewal date arrives the outcome is known: nothing left to predict."""
    con = duckdb.connect(str(db_path), read_only=True)
    from kindling.backtest import mondays
    scored = health.score(account_features(con, list(mondays())))
    assert (scored.days_to_renewal > 0).all()


def test_a_flag_only_counts_before_conversion():
    """evaluate() must not credit a flag raised on or after the purchase."""
    from kindling.backtest import evaluate
    truth = pd.DataFrame({"school_id": ["a", "b", "c"],
                          "converts_on": [date(2026, 1, 10), date(2026, 1, 10), None]})
    scored = pd.DataFrame({
        "school_id": ["a", "b", "c"],
        "as_of": pd.to_datetime([date(2026, 1, 5), date(2026, 1, 12), date(2026, 1, 5)]),
        "status": ["Ready", "Ready", "Ready"],
        "pql_score": [70, 70, 70],
    })
    m = evaluate(scored, truth)
    assert m["flagged that converted"] == 1      # only "a" was flagged before it bought
    assert m["converters caught before converting"] == "1 / 2"


def test_reasons_come_with_points(db_path):
    con = duckdb.connect(str(db_path), read_only=True)
    feats = account_features(con, [date(2026, 2, 2)])
    for scored in (pql.score(feats), health.score(feats)):
        for details, top3 in zip(scored.reason_details, scored.reasons):
            assert top3 == [d["text"] for d in details[:3]]
            assert all({"text", "points", "max_points"} <= set(d) for d in details)
    # health ranks by points lost, so an at-risk school's first reason is a real drag
    h = health.score(feats)
    for details in h[h.status == "At risk"].reason_details:
        lost = [d["max_points"] - d["points"] for d in details]
        assert lost == sorted(lost, reverse=True)
