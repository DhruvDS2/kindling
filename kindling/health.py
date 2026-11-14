"""Health score for paying schools.

A rules score from 0 to 100 with its top 3 reasons. Low = likely to churn.
Customer success should act when a school drops below RISK_THRESHOLD with
45+ days until renewal — enough time to actually help.

The key idea: trends are measured over school-day windows, so a drop during
winter break doesn't look like churn on a school renewing in January.
"""
from __future__ import annotations

import pandas as pd

from kindling import config as C

RISK_THRESHOLD       = C.HEALTH_RISK_THRESHOLD
TEACHER_TREND_MAX    = C.HEALTH_TEACHER_TREND_MAX
SESSION_TREND_MAX    = C.HEALTH_SESSION_TREND_MAX
RENEWAL_BUFFER_MAX   = C.HEALTH_RENEWAL_BUFFER_MAX
SEAT_UTILISATION_MAX = C.HEALTH_SEAT_UTIL_MAX
RENEWAL_BUFFER_DAYS  = C.HEALTH_RENEWAL_BUFFER_DAYS


def _teacher_retention(cur, prev) -> float:
    """Fraction of prior-window teacher activity retained (capped at 1.0)."""
    if prev == 0:
        return 1.0 if cur > 0 else 0.5   # no prior data: neutral
    return min(cur / prev, 1.0)


def _session_retention(cur, prev) -> float:
    if prev == 0:
        return 1.0 if cur > 0 else 0.5
    return min(cur / prev, 1.0)


def _reasons(row) -> list[tuple[float, str]]:
    r = []
    days = int(row.days_to_renewal)
    t_ret = _teacher_retention(row.active_teachers, row.active_teachers_prev)
    s_ret = _session_retention(row.student_sessions, row.student_sessions_prev)

    # teacher trend
    t_pts = round(TEACHER_TREND_MAX * t_ret)
    if row.active_teachers_prev > 0:
        pct = round((t_ret - 1) * 100)
        if pct < -5:
            r.append((t_pts, f"Active teachers down {abs(pct)}% vs prior window "
                               f"({int(row.active_teachers_prev)} → {int(row.active_teachers)})"))
        elif pct > 5:
            r.append((t_pts, f"Active teachers up {pct}% vs prior window "
                               f"({int(row.active_teachers_prev)} → {int(row.active_teachers)})"))
        else:
            r.append((t_pts, f"{int(row.active_teachers)} teachers active — stable"))
    else:
        r.append((t_pts, f"{int(row.active_teachers)} teachers active (no prior window)"))

    # session trend
    s_pts = round(SESSION_TREND_MAX * s_ret)
    if row.student_sessions_prev > 0:
        pct = round((s_ret - 1) * 100)
        if pct < -5:
            r.append((s_pts, f"Student sessions down {abs(pct)}% vs prior window "
                               f"({int(row.student_sessions_prev)} → {int(row.student_sessions)})"))
        elif pct > 5:
            r.append((s_pts, f"Student sessions up {pct}% vs prior window "
                               f"({int(row.student_sessions_prev)} → {int(row.student_sessions)})"))
        else:
            r.append((s_pts, f"{int(row.student_sessions)} student sessions — stable"))
    else:
        r.append((s_pts, f"{int(row.student_sessions)} student sessions (no prior window)"))

    # renewal urgency — full points when renewal is far away, zero at or past renewal
    buf_pts = round(RENEWAL_BUFFER_MAX * min(max(days, 0), RENEWAL_BUFFER_DAYS) / RENEWAL_BUFFER_DAYS)
    if days <= 0:
        r.append((0, "Renewal date has passed"))
    elif days <= RENEWAL_BUFFER_DAYS:
        r.append((buf_pts, f"Renewal in {days} days — in the action window"))
    else:
        r.append((buf_pts, f"Renewal in {days} days"))

    # seat utilisation
    if row.seats > 0:
        util = min(row.active_teachers / row.seats, 1.0)
        u_pts = round(SEAT_UTILISATION_MAX * util)
        pct = round(util * 100)
        r.append((u_pts, f"{pct}% of {int(row.seats)} licensed seats active"))

    return r


def score(features: pd.DataFrame) -> pd.DataFrame:
    """Score paying schools for health. Expects output of features.health_features."""
    df = features[features.plan_at_start == "paid"].copy()
    if "days_to_renewal" not in df.columns:
        df["days_to_renewal"] = (
            pd.to_datetime(df.renewal_date) - pd.to_datetime(df.as_of)
        ).dt.days.fillna(999)

    reasons = df.apply(_reasons, axis=1)
    df["health_score"] = reasons.apply(
        lambda r: round(min(max(sum(p for p, _ in r), 0), 100)))
    df["reasons"] = reasons.apply(
        lambda r: [t for _, t in sorted(r, key=lambda x: abs(x[0]), reverse=True)[:3]])
    df["status"] = df.health_score.apply(
        lambda s: "At risk" if s < RISK_THRESHOLD else "Healthy")
    return df


def naive_health(features: pd.DataFrame) -> pd.DataFrame:
    """Baseline: same logic but on calendar-day features.

    Call this with features computed in mode='calendar' to get the naive
    calendar-window comparison. The score formula is identical; the difference
    is in what the prev/cur window numbers contain.
    """
    return score(features)
