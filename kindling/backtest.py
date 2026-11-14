"""Backtest: replay the year every Monday and compare flags to the hidden truth.

This is the only module allowed to read the `truth` table.

Run:  python -m kindling.backtest pql
      python -m kindling.backtest health
"""
from __future__ import annotations

import sys
from datetime import date, timedelta

import pandas as pd

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from kindling import config as C
from kindling import health, pql
from kindling.features import account_features, connect

SNAPSHOT = date(2026, 2, 2)  # mid-year "Monday morning" for the top-20 check


def mondays(start=date(2025, 9, 1), end=C.END):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=7)


def first_flags(scored: pd.DataFrame) -> pd.DataFrame:
    ready = scored[scored.status == "Ready"]
    return ready.groupby("school_id", as_index=False).as_of.min().rename(columns={"as_of": "first_flag"})


def evaluate(scored: pd.DataFrame, truth: pd.DataFrame) -> dict:
    free = truth[truth.school_id.isin(scored.school_id.unique())]
    flags = first_flags(scored).merge(free[["school_id", "converts_on"]], on="school_id")
    flags["first_flag"] = pd.to_datetime(flags.first_flag)
    flags["converts_on"] = pd.to_datetime(flags.converts_on)
    hit = flags.converts_on.notna() & (flags.converts_on > flags.first_flag)

    converters = free.converts_on.notna().sum()
    lead = (flags.converts_on - flags.first_flag).dt.days[hit]

    snap = scored[scored.as_of == pd.Timestamp(SNAPSHOT)].nlargest(20, "pql_score")
    snap = snap.merge(free[["school_id", "converts_on"]], on="school_id")
    top20_conv = (pd.to_datetime(snap.converts_on) > pd.Timestamp(SNAPSHOT)).sum()

    return {
        "schools flagged": len(flags),
        "flagged that converted": int(hit.sum()),
        "precision": hit.sum() / len(flags) if len(flags) else 0.0,
        "converters caught before converting": f"{int(hit.sum())} / {converters}",
        "recall": hit.sum() / converters if converters else 0.0,
        "median lead time (days)": float(lead.median()) if len(lead) else float("nan"),
        f"top 20 on {SNAPSHOT} that later converted": f"{top20_conv} / {len(snap)}",
    }


def run_pql():
    con = connect()
    truth = con.sql("SELECT * FROM truth").df()
    feats = account_features(con, list(mondays()), mode="school_days")
    results = {
        "Naive: 5+ tutors built": evaluate(pql.naive_activation(feats), truth),
        "Kindling PQL score": evaluate(pql.score(feats), truth),
    }
    table = pd.DataFrame(results)
    fmt = table.copy()
    for col in fmt.columns:
        fmt[col] = [f"{v:.0%}" if k in ("precision", "recall") else
                    (f"{v:.0f}" if isinstance(v, float) else v)
                    for k, v in table[col].items()]
    C.RESULTS_DIR.mkdir(exist_ok=True)
    md = ["# PQL backtest", "",
          f"Replayed every Monday from {date(2025, 9, 1)} to {C.END}. "
          f"A school is flagged the first Monday its score reaches {pql.READY_THRESHOLD}. "
          "A flag counts as a hit only if the school converts *after* the flag.", "",
          fmt.to_markdown(), ""]
    (C.RESULTS_DIR / "pql_backtest.md").write_text("\n".join(md))
    print(fmt.to_string())
    return table


def first_risk_flags(scored: pd.DataFrame) -> pd.DataFrame:
    """First Monday each paid school was flagged At risk."""
    at_risk = scored[scored.status == "At risk"]
    return at_risk.groupby("school_id", as_index=False).as_of.min().rename(
        columns={"as_of": "first_flag"})


def evaluate_health(scored: pd.DataFrame, truth: pd.DataFrame) -> dict:
    paid_truth = truth[truth.school_id.isin(scored.school_id.unique())]
    churners = paid_truth[paid_truth.churns_on.notna()]
    healthy = paid_truth[paid_truth.churns_on.isna()]

    flags = first_risk_flags(scored)

    # churners flagged 45+ days before renewal
    churn_flags = flags.merge(churners[["school_id", "churns_on"]], on="school_id")
    churn_flags["first_flag"] = pd.to_datetime(churn_flags.first_flag)
    churn_flags["churns_on"] = pd.to_datetime(churn_flags.churns_on)
    lead = (churn_flags.churns_on - churn_flags.first_flag).dt.days
    early = (lead >= health.RENEWAL_BUFFER_DAYS)

    # false alarms: healthy schools flagged at risk
    false_alarms = flags[flags.school_id.isin(healthy.school_id)].school_id.nunique()

    return {
        "churners flagged ≥45 days early": f"{int(early.sum())} / {len(churners)}",
        "recall (churners)": early.sum() / len(churners) if len(churners) else 0.0,
        "median lead time on churners (days)": float(lead[early].median()) if early.any() else float("nan"),
        "false alarms (healthy flagged at risk)": false_alarms,
        "false alarm rate": false_alarms / len(healthy) if len(healthy) else 0.0,
    }


def run_health():
    con = connect()
    truth = con.sql("SELECT * FROM truth").df()
    dates = list(mondays())
    feats_sd = account_features(con, dates, mode="school_days")
    feats_cal = account_features(con, dates, mode="calendar")

    results = {
        "Naive: calendar windows": evaluate_health(health.naive_health(feats_cal), truth),
        "Kindling: school-day windows": evaluate_health(health.score(feats_sd), truth),
    }
    table = pd.DataFrame(results)
    fmt = table.copy()
    pct_rows = {"recall (churners)", "false alarm rate"}
    for col in fmt.columns:
        fmt[col] = [f"{v:.0%}" if k in pct_rows else
                    (f"{v:.0f}" if isinstance(v, float) else v)
                    for k, v in table[col].items()]

    C.RESULTS_DIR.mkdir(exist_ok=True)
    md = ["# Health backtest", "",
          f"Replayed every Monday from {date(2025, 9, 1)} to {C.END}. "
          f"A school is flagged the first Monday its score drops below {health.RISK_THRESHOLD}. "
          f"A churner flag counts as early if it comes ≥{health.RENEWAL_BUFFER_DAYS} days before renewal. "
          "False alarms are healthy schools incorrectly flagged at risk.", "",
          fmt.to_markdown(), ""]
    (C.RESULTS_DIR / "health_backtest.md").write_text("\n".join(md))
    print(fmt.to_string())
    return table


# ---------- logistic regression comparison (4.3) ----------
# Train on fall semester (Mondays ≤ Dec 31), test on spring (Jan 1 onwards).
# Reported alongside rules so the comparison is honest.

TRAIN_CUTOFF = date(2025, 12, 31)


def _pql_lr_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["has_admin"] = out.admin_signed_up_on.notna().astype(int)
    out["teacher_growth"] = (out.active_teachers - out.active_teachers_prev).clip(lower=0)
    return out[["active_teachers", "student_sessions", "aha_teachers",
                "tutors_created", "has_admin", "teacher_growth"]].fillna(0)


def _health_lr_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["days_to_renewal"] = (
        pd.to_datetime(out.renewal_date) - pd.to_datetime(out.as_of)
    ).dt.days.fillna(999).clip(lower=0)
    out["teacher_ratio"] = (out.active_teachers / out.active_teachers_prev.replace(0, np.nan)).fillna(1).clip(0, 2)
    out["session_ratio"] = (out.student_sessions / out.student_sessions_prev.replace(0, np.nan)).fillna(1).clip(0, 2)
    out["seat_util"] = (out.active_teachers / out.seats.replace(0, np.nan)).fillna(0).clip(0, 1)
    return out[["teacher_ratio", "session_ratio", "days_to_renewal", "seat_util"]].fillna(0)


def run_lr_pql():
    """Logistic regression vs rules on the PQL backtest. Train fall, test spring."""
    con = connect()
    truth = con.sql("SELECT * FROM truth").df()
    all_dates = list(mondays())
    train_dates = [d for d in all_dates if d <= TRAIN_CUTOFF]
    test_dates = [d for d in all_dates if d > TRAIN_CUTOFF]

    feats_all = account_features(con, all_dates, mode="school_days")

    def prep(feats, dates, truth):
        df = pql.score(feats[feats.as_of.isin([pd.Timestamp(d) for d in dates])].copy())
        df = df.merge(truth[["school_id", "converts_on"]], on="school_id", how="left")
        df["label"] = (df.converts_on.notna() &
                       (pd.to_datetime(df.converts_on) > pd.to_datetime(df.as_of))).astype(int)
        return df

    train_df = prep(feats_all, train_dates, truth)
    test_df = prep(feats_all, test_dates, truth)

    X_train = _pql_lr_features(train_df)
    X_test = _pql_lr_features(test_df)
    scaler = StandardScaler().fit(X_train)
    clf = LogisticRegression(max_iter=500, class_weight="balanced")
    clf.fit(scaler.transform(X_train), train_df["label"])

    # apply LR score to test set, use same threshold logic
    test_df = test_df.copy()
    test_df["pql_score"] = (clf.predict_proba(scaler.transform(X_test))[:, 1] * 100).round()
    test_df["status"] = test_df.pql_score.apply(lambda s: "Ready" if s >= pql.READY_THRESHOLD else "Not yet")

    rules_test = feats_all[feats_all.as_of.isin([pd.Timestamp(d) for d in test_dates])]
    rules_scored = pql.score(rules_test)

    lr_eval_df = test_df.drop(columns=["converts_on", "label"], errors="ignore")
    results = {
        "Rules (spring only)": evaluate(rules_scored, truth),
        "Logistic regression (trained fall)": evaluate(lr_eval_df, truth),
    }
    table = pd.DataFrame(results)
    fmt = table.copy()
    for col in fmt.columns:
        fmt[col] = [f"{v:.0%}" if k in ("precision", "recall") else
                    (f"{v:.0f}" if isinstance(v, float) else v)
                    for k, v in table[col].items()]
    print("\n=== PQL: Rules vs Logistic Regression (spring test set) ===")
    print(fmt.to_string())

    md_path = C.RESULTS_DIR / "pql_lr_comparison.md"
    md = ["# PQL: rules vs logistic regression", "",
          f"Trained on Mondays ≤ {TRAIN_CUTOFF} (fall). Tested on Mondays > {TRAIN_CUTOFF} (spring). "
          "LR uses the same point-in-time features; weights were not hand-tuned.", "",
          fmt.to_markdown(), ""]
    md_path.write_text("\n".join(md))
    return table


def run_lr_health():
    """Logistic regression vs rules on the health backtest. Train fall, test spring."""
    con = connect()
    truth = con.sql("SELECT * FROM truth").df()
    all_dates = list(mondays())
    train_dates = [d for d in all_dates if d <= TRAIN_CUTOFF]
    test_dates = [d for d in all_dates if d > TRAIN_CUTOFF]

    feats_all = account_features(con, all_dates, mode="school_days")

    def prep(feats, dates, truth):
        df = health.score(feats[feats.as_of.isin([pd.Timestamp(d) for d in dates])].copy())
        df["days_to_renewal"] = (
            pd.to_datetime(df.renewal_date) - pd.to_datetime(df.as_of)
        ).dt.days.fillna(999)
        df = df.merge(truth[["school_id", "churns_on"]], on="school_id", how="left")
        # label: will churn and renewal is within 180 days
        df["label"] = (df.churns_on.notna() &
                       (df.days_to_renewal <= 180) &
                       (df.days_to_renewal >= 0)).astype(int)
        return df

    train_df = prep(feats_all, train_dates, truth)
    test_df = prep(feats_all, test_dates, truth)

    X_train = _health_lr_features(train_df)
    X_test = _health_lr_features(test_df)
    scaler = StandardScaler().fit(X_train)
    clf = LogisticRegression(max_iter=500, class_weight="balanced")
    clf.fit(scaler.transform(X_train), train_df["label"])

    test_df = test_df.copy()
    test_df["health_score"] = (100 - clf.predict_proba(scaler.transform(X_test))[:, 1] * 100).round()
    test_df["status"] = test_df.health_score.apply(
        lambda s: "At risk" if s < health.RISK_THRESHOLD else "Healthy")

    rules_test = feats_all[feats_all.as_of.isin([pd.Timestamp(d) for d in test_dates])]
    rules_scored = health.score(rules_test)

    lr_eval_df = test_df.drop(columns=["churns_on", "label", "days_to_renewal"], errors="ignore")
    results = {
        "Rules (spring only)": evaluate_health(rules_scored, truth),
        "Logistic regression (trained fall)": evaluate_health(lr_eval_df, truth),
    }
    table = pd.DataFrame(results)
    fmt = table.copy()
    pct_rows = {"recall (churners)", "false alarm rate"}
    for col in fmt.columns:
        fmt[col] = [f"{v:.0%}" if k in pct_rows else
                    (f"{v:.0f}" if isinstance(v, float) else v)
                    for k, v in table[col].items()]
    print("\n=== Health: Rules vs Logistic Regression (spring test set) ===")
    print(fmt.to_string())

    md_path = C.RESULTS_DIR / "health_lr_comparison.md"
    md = ["# Health: rules vs logistic regression", "",
          f"Trained on Mondays ≤ {TRAIN_CUTOFF} (fall). Tested on Mondays > {TRAIN_CUTOFF} (spring). "
          "LR uses the same point-in-time features.", "",
          fmt.to_markdown(), ""]
    md_path.write_text("\n".join(md))
    return table


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "pql"
    if which == "pql":
        run_pql()
    elif which == "health":
        run_health()
    elif which == "lr":
        run_lr_pql()
        run_lr_health()
    else:
        sys.exit(f"unknown backtest: {which}")
