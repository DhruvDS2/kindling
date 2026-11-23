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


# ---------- shared helpers for the experiment runs (5.1–5.3) ----------

PCT_ROWS = {"precision", "recall", "recall (churners)", "false alarm rate"}


def _fmt(table: pd.DataFrame) -> pd.DataFrame:
    out = table.copy().astype(object)
    for col in out.columns:
        out[col] = [f"{v:.0%}" if k in PCT_ROWS else
                    (f"{v:.0f}" if isinstance(v, float) else v)
                    for k, v in table[col].items()]
    return out


def _connect_or_exit(path):
    if not path.exists():
        rel = path.relative_to(C.ROOT) if path.is_relative_to(C.ROOT) else path
        sys.exit(f"{rel} not found. Build it first (see the Makefile: make experiments).")
    return connect(path)


def _write(name: str, lines: list[str]):
    C.RESULTS_DIR.mkdir(exist_ok=True)
    (C.RESULTS_DIR / name).write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


# ---------- 5.1 per-district calendars ----------

def run_districts():
    """Health and PQL in the district world: one national calendar vs each district's own."""
    con = _connect_or_exit(C.DISTRICT_DB_PATH)
    truth = con.sql("SELECT * FROM truth").df()
    cal_of = con.sql("SELECT school_id, calendar_id FROM schools").df()
    dates = list(mondays())
    modes = {
        "Naive: calendar windows": "calendar",
        "School days, one national calendar": "school_days_shared",
        "Kindling: school days, district calendars": "school_days",
    }
    health_res, pql_res, by_cal = {}, {}, {}
    for label, mode in modes.items():
        feats = account_features(con, dates, mode=mode)
        scored = health.score(feats)
        health_res[label] = evaluate_health(scored, truth)
        pql_res[label] = evaluate(pql.score(feats), truth)
        healthy = truth[truth.churns_on.isna()].school_id
        fa = first_risk_flags(scored)
        fa = fa[fa.school_id.isin(healthy)].merge(cal_of, on="school_id")
        by_cal[label] = fa.calendar_id.value_counts()
    paid_cal = cal_of[cal_of.school_id.isin(truth[truth.renews.notna()].school_id)]
    healthy_cal = cal_of[cal_of.school_id.isin(truth[truth.churns_on.isna() & truth.renews.notna()].school_id)]
    fa_table = pd.DataFrame(by_cal).reindex(sorted(paid_cal.calendar_id.unique())).fillna(0).astype(int)
    fa_table.insert(0, "healthy paid schools", healthy_cal.calendar_id.value_counts())
    fa_table.index.name = "calendar"

    _write("district_calendar_backtest.md", [
        "# District calendars backtest", "",
        "A second simulated world (`python -m kindling.simulate --calendars district`): same "
        "schools and archetypes, but each school follows its district's calendar (different "
        "start and end dates, February and April vacations in the Northeast, early-March spring "
        "break in the Southwest). Scoring rules and thresholds are unchanged from the main backtest.", "",
        "## Health (paying schools)", "", _fmt(pd.DataFrame(health_res)).to_markdown(), "",
        "## False alarms by calendar", "",
        "Healthy schools flagged at risk at least once, by the calendar the school actually follows.", "",
        fa_table.to_markdown(), "",
        "## PQL (free schools)", "", _fmt(pd.DataFrame(pql_res)).to_markdown(), "",
    ])


# ---------- 5.2 admin-signup threshold (run 3) ----------

def _pql_extra(scored: pd.DataFrame, truth: pd.DataFrame, teachers: pd.DataFrame) -> dict:
    """Recall on real converters only (not decoys that bought by chance), and on small ones."""
    flags = first_flags(scored).merge(truth, on="school_id")
    hit = flags.converts_on.notna() & (pd.to_datetime(flags.converts_on) > pd.to_datetime(flags.first_flag))
    hits = set(flags[hit].school_id)
    real = truth[(truth.archetype == "converter") & truth.converts_on.notna()
                 & truth.school_id.isin(scored.school_id)]
    small = real[real.school_id.isin(teachers[teachers.n <= 3].school_id)]
    stalled = flags[flags.archetype == "stalled"]
    return {
        "real converters caught": f"{len(hits & set(real.school_id))} / {len(real)}",
        "small converters (≤3 teachers) caught": f"{len(hits & set(small.school_id))} / {len(small)}",
        "stalled schools flagged": len(stalled),
        "flagged by the admin rule": int((scored.groupby("school_id").ready_rule
                                          .apply(lambda r: (r == "admin").any())).sum())
                                     if "ready_rule" in scored else 0,
    }


def _admin_table(path) -> pd.DataFrame:
    con = _connect_or_exit(path)
    truth = con.sql("SELECT * FROM truth").df()
    teachers = con.sql("SELECT school_id, count(*) AS n FROM teachers "
                       "WHERE role = 'teacher' GROUP BY 1").df()
    feats = account_features(con, list(mondays()), mode="school_days")
    runs = {
        "Naive: 5+ tutors built": pql.naive_activation(feats),
        f"Run 2: score ≥ {pql.READY_THRESHOLD}": pql.score(feats),
        f"Run 3: + admin rule (≥ {pql.ADMIN_READY_THRESHOLD} with an admin)":
            pql.score(feats, admin_threshold=pql.ADMIN_READY_THRESHOLD),
    }
    return pd.DataFrame({k: {**evaluate(v, truth), **_pql_extra(v, truth, teachers)}
                         for k, v in runs.items()})


def run_pql_admin():
    lines = [
        "# PQL run 3: lower threshold for schools with an admin", "",
        f"Run 2 is the headline PQL backtest: Ready at score ≥ {pql.READY_THRESHOLD}. Run 3 keeps "
        f"that rule and adds one: a school where an admin has signed up is also Ready at ≥ "
        f"{pql.ADMIN_READY_THRESHOLD}. The aim is the quiet converters run 2 misses (2–3 teachers, "
        "lighter use). Weights unchanged; the 40 comes from reasoning about the quiet-converter "
        "profile (see config.py), not from these results.", "",
        "## Default world", "", _fmt(_admin_table(C.DB_PATH)).to_markdown(), "",
        "**Caveat.** In the default simulator only converter-shaped schools (converters and "
        "stalled) ever get an admin signup, so an admin rule is favoured by construction. "
        "The stress test below gives admins to non-buying schools too.", "",
    ]
    if C.ADMIN_NOISE_DB_PATH.exists():
        lines += [
            "## Stress test: admins at 25% of non-buying schools", "",
            "Same world, but a quarter of solo-star, builder and dormant schools also get an "
            "admin signup 1–8 weeks after their first teacher (`simulate.py --admin-noise 0.25`).", "",
            _fmt(_admin_table(C.ADMIN_NOISE_DB_PATH)).to_markdown(), "",
        ]
    _write("pql_admin_threshold.md", lines)


# ---------- 5.3 threshold sweep (ready for real data) ----------

PQL_SWEEP = list(range(30, 95, 5))
HEALTH_SWEEP = list(range(40, 95, 5))


def _split(scored: pd.DataFrame):
    asof = pd.to_datetime(scored.as_of)
    return scored[asof <= pd.Timestamp(TRAIN_CUTOFF)], scored[asof > pd.Timestamp(TRAIN_CUTOFF)]


def _pick(rows: list[dict], ok, better) -> dict:
    """Best row that meets the business rule, or None if no row does."""
    passing = [r for r in rows if ok(r)]
    return max(passing, key=better) if passing else None


def run_sweep(db_path=None):
    """Sweep the Ready and At-risk thresholds. Pick on fall, report on spring (RULES.md #3).

    On synthetic data this is a dry run: config.py is not changed. Point --db at a
    database built from real usage and outcomes (same schema) to tune for real.
    """
    path = db_path or C.DB_PATH
    con = _connect_or_exit(path)
    truth = con.sql("SELECT * FROM truth").df()
    feats = account_features(con, list(mondays()), mode="school_days")

    pql_base, health_base = pql.score(feats), health.score(feats)
    pql_rows, health_rows = [], []
    for t in PQL_SWEEP:
        s = pql_base.assign(status=np.where(pql_base.pql_score >= t, "Ready", "Not yet"))
        fall, spring = (evaluate(x, truth) for x in _split(s))
        pql_rows.append({"threshold": t,
                         "fall flagged": fall["schools flagged"], "fall precision": fall["precision"],
                         "fall recall": fall["recall"],
                         "spring flagged": spring["schools flagged"], "spring precision": spring["precision"],
                         "spring recall": spring["recall"],
                         "spring lead (days)": spring["median lead time (days)"]})
    for t in HEALTH_SWEEP:
        s = health_base.assign(status=np.where(health_base.health_score < t, "At risk", "Healthy"))
        fall, spring = (evaluate_health(x, truth) for x in _split(s))
        health_rows.append({"threshold": t,
                            "fall recall": fall["recall (churners)"], "fall false alarms": fall["false alarm rate"],
                            "spring recall": spring["recall (churners)"],
                            "spring false alarms": spring["false alarm rate"]})

    pql_pick = _pick(pql_rows, lambda r: r["fall precision"] >= C.TUNE_PQL_MIN_PRECISION,
                     lambda r: (r["fall recall"], r["threshold"]))
    health_pick = _pick(health_rows, lambda r: r["fall false alarms"] <= C.TUNE_HEALTH_MAX_FALSE_ALARM,
                        lambda r: (r["fall recall"], -r["threshold"]))

    def table(rows, current, pick):
        df = pd.DataFrame(rows).set_index("threshold")
        out = df.copy().astype(object)
        for c in df.columns:
            out[c] = [f"{v:.0%}" if ("precision" in c or "recall" in c or "alarm" in c) else
                      (f"{v:.0f}" if isinstance(v, float) else v) for v in df[c]]
        out.index = [f"{t}" + (" ← config" if t == current else "") +
                     (" ← fall pick" if pick and t == pick["threshold"] else "") for t in df.index]
        out.index.name = "threshold"
        return out.to_markdown()

    def verdict(pick, current, rule, holds):
        if pick is None:
            return f"No threshold met the rule ({rule}) on fall. Keep the config value and revisit the rule."
        spring = ("it also meets the rule on spring" if holds(pick)
                  else "it **fails the same rule on spring**, so don't adopt it")
        if pick["threshold"] == current:
            return f"Fall pick ({rule}): **{pick['threshold']}**, same as config.py; {spring}."
        return (f"Fall pick ({rule}): **{pick['threshold']}** vs {current} in config.py; {spring}. "
                "config.py is not changed by this run.")

    src = path.relative_to(C.ROOT) if path.is_relative_to(C.ROOT) else path
    _write("threshold_sweep.md", [
        "# Threshold sweep", "",
        f"Data: `{src}`. Each threshold is picked on fall Mondays (≤ {TRAIN_CUTOFF}) and reported "
        "on spring Mondays, so the pick is never graded on the data it was chosen from (RULES.md #3).", "",
        "**On synthetic data this is a dry run.** It shows how thresholds will be set once real "
        "outcomes exist; it does not change config.py. Fall and spring see different schools "
        "(spring only scores schools that hadn't converted by January; fall can only catch "
        "churners whose decline starts in fall), so compare rows within a column, not across halves.", "",
        f"## PQL Ready threshold (business rule: fall precision ≥ {C.TUNE_PQL_MIN_PRECISION:.0%}, then most recall)", "",
        table(pql_rows, pql.READY_THRESHOLD, pql_pick), "",
        verdict(pql_pick, pql.READY_THRESHOLD, f"precision ≥ {C.TUNE_PQL_MIN_PRECISION:.0%}",
                lambda r: r["spring precision"] >= C.TUNE_PQL_MIN_PRECISION), "",
        f"## Health At-risk threshold (business rule: fall false alarms ≤ {C.TUNE_HEALTH_MAX_FALSE_ALARM:.0%}, then most recall)", "",
        table(health_rows, health.RISK_THRESHOLD, health_pick), "",
        verdict(health_pick, health.RISK_THRESHOLD, f"false alarms ≤ {C.TUNE_HEALTH_MAX_FALSE_ALARM:.0%}",
                lambda r: r["spring false alarms"] <= C.TUNE_HEALTH_MAX_FALSE_ALARM), "",
        "## On real data", "",
        "1. Load real usage into the same tables (`schools`, `teachers`, `events`, `school_calendars`) "
        "and real outcomes into `truth` (converted on / churned on). Outcomes only ever feed this module.",
        "2. Wait for one semester of outcomes, then run `python -m kindling.backtest sweep --db <path>`.",
        "3. Adopt a new threshold only if its spring row holds up, and log the change in PROGRESS.md.",
        "4. Agree the two business rules above with sales and CS first: they decide the threshold, not the sweep.",
    ])


if __name__ == "__main__":
    args = sys.argv[1:]
    which = args[0] if args else "pql"
    db_arg = None
    if "--db" in args:
        from pathlib import Path
        db_arg = Path(args[args.index("--db") + 1]).resolve()
    if which == "pql":
        run_pql()
    elif which == "health":
        run_health()
    elif which == "lr":
        run_lr_pql()
        run_lr_health()
    elif which == "districts":
        run_districts()
    elif which == "pql_admin":
        run_pql_admin()
    elif which == "sweep":
        run_sweep(db_arg)
    else:
        sys.exit(f"unknown backtest: {which}")
