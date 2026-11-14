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

ENGINE_MODULES = ["features.py", "pql.py", "health.py"]  # add api.py as it lands


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    if not C.DB_PATH.exists():
        from kindling import simulate
        simulate.main()
    return C.DB_PATH


@pytest.mark.parametrize("as_of", [date(2025, 11, 3), date(2026, 1, 5), date(2026, 3, 23)])
def test_features_never_use_future_events(db_path, tmp_path, as_of):
    """Deleting every event after as_of must not change any feature."""
    full = duckdb.connect(str(db_path), read_only=True)
    before = account_features(full, [as_of])
    full.close()

    cut_path = tmp_path / "cut.duckdb"
    cut = duckdb.connect(str(cut_path))
    cut.execute(f"ATTACH '{db_path}' AS src (READ_ONLY)")
    for t in ("calendar", "schools", "teachers", "events"):
        cut.execute(f"CREATE TABLE {t} AS SELECT * FROM src.{t}")
    cut.execute("DELETE FROM events WHERE day > ?", [as_of])
    after = account_features(cut, [as_of])
    cut.close()

    pd.testing.assert_frame_equal(before.reset_index(drop=True), after.reset_index(drop=True))


def test_engine_never_reads_truth():
    root = Path(C.ROOT) / "kindling"
    for name in ENGINE_MODULES:
        src = (root / name).read_text()
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
