"""Shared settings: the simulated school year and file locations.

Everything here is synthetic. The calendar is a typical US school year;
prices are illustrative, not any real company's pricing.
"""
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "kindling.duckdb"
RESULTS_DIR = ROOT / "results"

SEED = 7

# Simulated timeline: one full school year plus the summer around it.
START = date(2025, 8, 1)
END = date(2026, 7, 31)

FIRST_DAY = date(2025, 8, 18)
LAST_DAY = date(2026, 6, 5)

# (first day off, last day off), inclusive
BREAKS = [
    (date(2025, 11, 24), date(2025, 11, 28)),  # Thanksgiving
    (date(2025, 12, 20), date(2026, 1, 4)),    # Winter break
    (date(2026, 3, 14), date(2026, 3, 22)),    # Spring break
]

N_FREE_SCHOOLS = 120
N_PAID_SCHOOLS = 80
PRICE_PER_SEAT = 400  # illustrative, USD per teacher seat per year

# Feature windows
WINDOW_SCHOOL_DAYS = 10   # instructional days in the main rolling window
WINDOW_CAL_DAYS = 14      # calendar days for the naive baseline

# PQL scoring weights
PQL_BREADTH_MAX = 30      # points for active teacher breadth, capped at 4 teachers
PQL_BREADTH_CAP = 4
PQL_DEPTH_MAX = 35        # points for "aha" teachers (students really using it), capped at 3
PQL_DEPTH_CAP = 3
PQL_ADMIN_POINTS = 15     # admin signed up → buying committee forming
PQL_MOMENTUM_POINTS = 10  # teacher count growing vs prior window
PQL_BUILD_NO_USE = -10    # tutors built but students not using them
PQL_AHA_SESSIONS = 20     # student sessions in one window for a teacher to count as "aha"
PQL_READY_THRESHOLD = 60  # score at or above this → "Ready"

# Health scoring weights
HEALTH_TEACHER_TREND_MAX = 40    # teacher retention vs prior window
HEALTH_SESSION_TREND_MAX = 35    # session retention vs prior window
HEALTH_RENEWAL_BUFFER_MAX = 15   # urgency buffer (full points when renewal is far away)
HEALTH_SEAT_UTIL_MAX = 10        # active teachers as share of licensed seats
HEALTH_RENEWAL_BUFFER_DAYS = 45  # flag this many days before renewal
HEALTH_RISK_THRESHOLD = 70       # score below this → "At risk"


def all_days():
    d = START
    while d <= END:
        yield d
        d += timedelta(days=1)


def day_kind(d: date) -> str:
    """Classify a calendar day: instructional, weekend, break, or summer."""
    if d < FIRST_DAY or d > LAST_DAY:
        return "summer"
    if any(a <= d <= b for a, b in BREAKS):
        return "break"
    if d.weekday() >= 5:
        return "weekend"
    return "instructional"
