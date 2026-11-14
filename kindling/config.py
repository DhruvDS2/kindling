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
