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

# ---------- per-district calendars ----------
# Real districts don't share breaks. The South starts in early August and ends
# in May; New England starts after Labor Day, takes a February and an April
# vacation, and runs to late June; Texas takes spring break in early March.
# A score that hard-codes one national calendar misreads every district whose
# breaks fall on different weeks.
#
# "national" is the one calendar every school used before district calendars.
# The default simulated world still puts every school on it, so the headline
# backtest numbers don't move. `simulate.py --calendars district` builds a
# second world where each school follows its region's calendar.
# All dates are illustrative for 2025-26, not any real district's calendar.
SHARED_CALENDAR = "national"

CALENDARS = {
    "national": {"first_day": FIRST_DAY, "last_day": LAST_DAY, "breaks": BREAKS},
    "northeast": {
        "first_day": date(2025, 9, 2), "last_day": date(2026, 6, 19),
        "breaks": [
            (date(2025, 11, 26), date(2025, 11, 30)),  # Thanksgiving, Wed-Sun
            (date(2025, 12, 24), date(2026, 1, 4)),    # Winter break
            (date(2026, 2, 14), date(2026, 2, 22)),    # February vacation
            (date(2026, 4, 18), date(2026, 4, 26)),    # April vacation
        ],
    },
    "southeast": {
        "first_day": date(2025, 8, 6), "last_day": date(2026, 5, 22),
        "breaks": [
            (date(2025, 11, 22), date(2025, 11, 30)),  # Thanksgiving week
            (date(2025, 12, 20), date(2026, 1, 5)),    # Winter break
            (date(2026, 4, 4), date(2026, 4, 12)),     # Spring break around Easter
        ],
    },
    "midwest": {
        "first_day": date(2025, 8, 20), "last_day": date(2026, 6, 3),
        "breaks": [
            (date(2025, 11, 26), date(2025, 11, 30)),  # Thanksgiving, Wed-Sun
            (date(2025, 12, 20), date(2026, 1, 4)),    # Winter break
            (date(2026, 3, 21), date(2026, 3, 29)),    # Spring break
        ],
    },
    "southwest": {
        "first_day": date(2025, 8, 13), "last_day": date(2026, 5, 28),
        "breaks": [
            (date(2025, 11, 22), date(2025, 11, 30)),  # Thanksgiving week
            (date(2025, 12, 20), date(2026, 1, 5)),    # Winter break
            (date(2026, 3, 7), date(2026, 3, 15)),     # Early-March spring break
        ],
    },
    "west": {
        "first_day": date(2025, 8, 25), "last_day": date(2026, 6, 11),
        "breaks": [
            (date(2025, 11, 22), date(2025, 11, 30)),  # Thanksgiving week
            (date(2025, 12, 20), date(2026, 1, 4)),    # Winter break
            (date(2026, 3, 28), date(2026, 4, 5)),     # Spring break
        ],
    },
}

# In the district world a school follows its district's calendar. Districts here
# are named after a city, so every school in one district shares a region and a
# calendar. Independent schools follow their region's typical calendar.
REGION_CALENDAR = {
    "Northeast": "northeast", "Southeast": "southeast", "Midwest": "midwest",
    "Southwest": "southwest", "West": "west",
}

DISTRICT_DB_PATH = ROOT / "data" / "kindling_districts.duckdb"
ADMIN_NOISE_DB_PATH = ROOT / "data" / "kindling_admin_noise.duckdb"

# ---------- demo date and replay range ----------
# The simulated year ends Jul 31, 2026, so the real "today" means nothing to
# the demo. The API and UI default to this date. Checked 2026-11-23: its
# 10-school-day window (Jan 20 - Feb 2) is fully after winter break, with
# paid-school activity back to 96% of the pre-break level, and 17 schools
# renew 30-60 days out (Apr 1).
DEMO_AS_OF = date(2026, 2, 2)
REPLAY_START = date(2025, 9, 1)  # first Monday the backtests replay

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
# Admin rule (run 3, off by default). An admin signing up means a buying
# conversation has started, so a school with an admin is "Ready" on less usage.
# Target profile, the quiet converter: two active teachers (15) + the admin (15)
# + either one teacher with heavy student use (~12) or the teacher count growing
# (10) clears 40. Set by reasoning about that profile, not tuned on backtest
# results. `python -m kindling.backtest pql_admin` reports it as a separate run.
PQL_ADMIN_READY_THRESHOLD = 40

# Threshold sweep (`python -m kindling.backtest sweep`): the business rule a
# threshold is picked by. Reps can work a list where 6 in 10 buy; CS can absorb
# 1 false alarm in 20 healthy schools. Both are assumptions for Flint to set.
TUNE_PQL_MIN_PRECISION = 0.60
TUNE_HEALTH_MAX_FALSE_ALARM = 0.05

# Health scoring weights
HEALTH_TEACHER_TREND_MAX = 40    # teacher retention vs prior window
HEALTH_SESSION_TREND_MAX = 35    # session retention vs prior window
HEALTH_RENEWAL_BUFFER_MAX = 15   # urgency buffer (full points when renewal is far away)
HEALTH_SEAT_UTIL_MAX = 10        # active teachers as share of licensed seats
HEALTH_RENEWAL_BUFFER_DAYS = 45  # flag this many days before renewal
HEALTH_RISK_THRESHOLD = 70       # score below this → "At risk"
# A 10-school-day trend needs 10 school days. Before a school's year has produced
# one full window there is nothing to measure, so health isn't scored yet. Found
# by the district world: schools starting after Labor Day were scored on an empty
# window on Sep 1 and flagged at risk.
HEALTH_MIN_SCHOOL_DAYS = WINDOW_SCHOOL_DAYS


def mondays(start: date = REPLAY_START, end: date = END):
    """Every Monday from start (itself a Monday) to end, inclusive."""
    d = start
    while d <= end:
        yield d
        d += timedelta(days=7)


def all_days():
    d = START
    while d <= END:
        yield d
        d += timedelta(days=1)


def day_kind(d: date, calendar_id: str = SHARED_CALENDAR) -> str:
    """Classify a calendar day on one school calendar: instructional, weekend, break, or summer."""
    cal = CALENDARS[calendar_id]
    if d < cal["first_day"] or d > cal["last_day"]:
        return "summer"
    if any(a <= d <= b for a, b in cal["breaks"]):
        return "break"
    if d.weekday() >= 5:
        return "weekend"
    return "instructional"
