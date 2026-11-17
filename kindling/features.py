"""Point-in-time account features.

Every feature is computed "as of" a date and only reads events on or before it.

Two window types:
  school_days : the last 10 instructional days (season-aware, the main approach)
  calendar    : the last 14 calendar days (naive baseline)

Both windows have the same length on a normal school fortnight. They differ
around breaks, which is the whole point.
"""
from __future__ import annotations

from datetime import date

import duckdb
import pandas as pd

from kindling import config as C

WINDOW_SCHOOL_DAYS = C.WINDOW_SCHOOL_DAYS
WINDOW_CAL_DAYS = C.WINDOW_CAL_DAYS
AHA_SESSIONS = C.PQL_AHA_SESSIONS

_SQL = """
WITH as_of_dates AS (
    SELECT CAST(unnest($dates) AS DATE) AS as_of
),
-- the instructional-day index at each as_of
idx AS (
    SELECT a.as_of, max(c.instr_idx) AS i
    FROM as_of_dates a JOIN calendar c ON c.day <= a.as_of
    GROUP BY a.as_of
),
-- window bounds: [start, as_of] for current and [prev_start, start) for the prior window
win AS (
    SELECT idx.as_of,
        CASE WHEN $mode = 'school_days' THEN
            (SELECT min(day) FROM calendar WHERE kind = 'instructional' AND instr_idx = greatest(idx.i - $n + 1, 1))
        ELSE idx.as_of - CAST($ncal - 1 AS INTEGER) END AS start,
        CASE WHEN $mode = 'school_days' THEN
            (SELECT min(day) FROM calendar WHERE kind = 'instructional' AND instr_idx = greatest(idx.i - 2 * $n + 1, 1))
        ELSE idx.as_of - CAST(2 * $ncal - 1 AS INTEGER) END AS prev_start
    FROM idx
),
ev AS (
    SELECT w.as_of, e.school_id, e.teacher_id, e.event, e.n, t.role,
           (e.day >= w.start) AS in_cur
    FROM win w
    JOIN events e ON e.day >= w.prev_start AND e.day <= w.as_of
    LEFT JOIN teachers t ON t.teacher_id = e.teacher_id
),
per_teacher AS (
    SELECT as_of, school_id, teacher_id,
        sum(CASE WHEN in_cur AND event = 'student_session' THEN n ELSE 0 END) AS sessions
    FROM ev WHERE role = 'teacher'
    GROUP BY ALL
),
agg AS (
    SELECT as_of, school_id,
        count(DISTINCT CASE WHEN in_cur AND event = 'teacher_active' AND role = 'teacher' THEN teacher_id END) AS active_teachers,
        count(DISTINCT CASE WHEN NOT in_cur AND event = 'teacher_active' AND role = 'teacher' THEN teacher_id END) AS active_teachers_prev,
        sum(CASE WHEN in_cur AND event = 'student_session' THEN n ELSE 0 END) AS student_sessions,
        sum(CASE WHEN NOT in_cur AND event = 'student_session' THEN n ELSE 0 END) AS student_sessions_prev,
        sum(CASE WHEN in_cur AND event = 'tutor_created' THEN n ELSE 0 END) AS tutors_created
    FROM ev GROUP BY ALL
),
aha AS (
    SELECT as_of, school_id, count(*) FILTER (WHERE sessions >= $aha) AS aha_teachers
    FROM per_teacher GROUP BY ALL
),
life AS (
    SELECT a.as_of, s.school_id,
        max(CASE WHEN e.event = 'admin_signed_up' THEN e.day END) AS admin_signed_up_on,
        max(CASE WHEN e.event = 'plan_converted' THEN e.day END) AS converted_on,
        min(CASE WHEN e.event = 'teacher_signed_up' THEN e.day END) AS first_signup
    FROM as_of_dates a CROSS JOIN schools s
    LEFT JOIN events e ON e.school_id = s.school_id AND e.day <= a.as_of
    GROUP BY ALL
)
SELECT l.as_of, s.school_id, s.name, s.type, s.plan_at_start, s.seats, s.arr, s.renewal_date,
    s.city, s.state, s.district, s.contact_name, s.contact_title, s.contact_email,
    l.first_signup, l.admin_signed_up_on, l.converted_on,
    coalesce(g.active_teachers, 0)       AS active_teachers,
    coalesce(g.active_teachers_prev, 0)  AS active_teachers_prev,
    coalesce(g.student_sessions, 0)      AS student_sessions,
    coalesce(g.student_sessions_prev, 0) AS student_sessions_prev,
    coalesce(g.tutors_created, 0)        AS tutors_created,
    coalesce(h.aha_teachers, 0)          AS aha_teachers
FROM life l
JOIN schools s USING (school_id)
LEFT JOIN agg g ON g.as_of = l.as_of AND g.school_id = l.school_id
LEFT JOIN aha h ON h.as_of = l.as_of AND h.school_id = l.school_id
ORDER BY l.as_of, s.school_id
"""


def connect(path=C.DB_PATH, read_only=True) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(path), read_only=read_only)


def account_features(con, as_of_dates: list[date], mode: str = "school_days") -> pd.DataFrame:
    """One row per (as_of, school) with usage features over the chosen window."""
    if mode not in ("school_days", "calendar"):
        raise ValueError("mode must be 'school_days' or 'calendar'")
    params = {"dates": [d.isoformat() for d in as_of_dates], "mode": mode,
              "n": WINDOW_SCHOOL_DAYS, "ncal": WINDOW_CAL_DAYS, "aha": AHA_SESSIONS}
    return con.execute(_SQL, params).df()


def health_features(con, as_of_dates: list[date], mode: str = "school_days") -> pd.DataFrame:
    """Usage trend features for paid schools, plus days to renewal.

    Adds four derived columns on top of account_features:
      teacher_trend_pct  : fractional change in active teachers vs prior window
      session_trend_pct  : fractional change in student sessions vs prior window
      engagement_ratio   : active_teachers / seats (how much of the licence is in use)
      days_to_renewal    : calendar days between as_of and renewal_date
    """
    df = account_features(con, as_of_dates, mode=mode)
    df = df[df.plan_at_start == "paid"].copy()

    renewal = pd.to_datetime(df.renewal_date)
    asof = pd.to_datetime(df.as_of)
    df["days_to_renewal"] = (renewal - asof).dt.days

    df["teacher_trend_pct"] = (
        (df.active_teachers - df.active_teachers_prev)
        / df.active_teachers_prev.clip(lower=1)
    )
    df["session_trend_pct"] = (
        (df.student_sessions - df.student_sessions_prev)
        / df.student_sessions_prev.clip(lower=1)
    )
    df["engagement_ratio"] = df.active_teachers / df.seats.clip(lower=1)

    return df
