"""PQL (product-qualified lead) score for free schools.

A rules score from 0 to 100 with its top 3 reasons. The idea:
  one excited teacher is a user; several teachers whose students actually use
  the product, plus an admin showing up, is an account ready to buy.

Weights were set by reasoning about the motion, not tuned on backtest results.
"""
from __future__ import annotations

import pandas as pd

READY_THRESHOLD = 60

# points
BREADTH_MAX, BREADTH_CAP = 30, 4     # active teachers, capped at 4
DEPTH_MAX, DEPTH_CAP = 35, 3         # "aha" teachers (students really using it), capped at 3
ADMIN_POINTS = 15                    # an admin signed up: the buying committee is forming
MOMENTUM_POINTS = 10                 # more active teachers than the previous window
BUILD_NO_USE_PENALTY = -10           # lots of tutors built, students barely using them


def _reasons(row) -> list[tuple[float, str]]:
    r = []
    a, aha = int(row.active_teachers), int(row.aha_teachers)
    if a:
        r.append((BREADTH_MAX * min(a, BREADTH_CAP) / BREADTH_CAP,
                  f"{a} teacher{'s' if a != 1 else ''} active in the window"))
    if aha:
        r.append((DEPTH_MAX * min(aha, DEPTH_CAP) / DEPTH_CAP,
                  f"{aha} teacher{'s' if aha != 1 else ''} with heavy student use "
                  f"({int(row.student_sessions)} student sessions)"))
    if pd.notna(row.admin_signed_up_on):
        r.append((ADMIN_POINTS, "An admin signed up"))
    if a >= 2 and a > row.active_teachers_prev:
        r.append((MOMENTUM_POINTS, f"Spreading: {int(row.active_teachers_prev)} → {a} active teachers"))
    if row.tutors_created >= 20 and row.student_sessions < row.tutors_created:
        r.append((BUILD_NO_USE_PENALTY,
                  f"{int(row.tutors_created)} tutors built but only {int(row.student_sessions)} student sessions"))
    return r


def score(features: pd.DataFrame) -> pd.DataFrame:
    """Score free, not-yet-converted schools. Expects output of features.account_features."""
    df = features[(features.plan_at_start == "free")
                  & features.converted_on.isna()
                  & features.first_signup.notna()].copy()
    reasons = df.apply(_reasons, axis=1)
    df["pql_score"] = reasons.apply(lambda r: round(min(max(sum(p for p, _ in r), 0), 100)))
    df["reasons"] = reasons.apply(
        lambda r: [t for _, t in sorted(r, key=lambda x: abs(x[0]), reverse=True)[:3]])
    df["status"] = df.pql_score.apply(lambda s: "Ready" if s >= READY_THRESHOLD else "Not yet")
    return df


def naive_activation(features: pd.DataFrame) -> pd.DataFrame:
    """Baseline most teams start with: flag any free school that built 5+ tutors in the window."""
    df = features[(features.plan_at_start == "free")
                  & features.converted_on.isna()
                  & features.first_signup.notna()].copy()
    df["pql_score"] = (df.tutors_created >= 5).astype(int) * 100
    df["reasons"] = df.tutors_created.apply(lambda n: [f"{int(n)} tutors built"])
    df["status"] = df.pql_score.apply(lambda s: "Ready" if s >= READY_THRESHOLD else "Not yet")
    return df
