# Lane A gate: scoring core (pre-UI audit, read-only)

Audited at commit 3fc7e2b in `.worktrees/lane-a-scoring-core`, 2026-11-23, Python 3.14.7. Judged from code and real runs only.

## Commands run (all from the worktree)
```
python3 -m kindling.simulate            # 200 schools, 1,760 teachers, 347,551 events; 34 converters, 22 churners
python3 -m kindling.backtest pql | health | lr
make experiments                        # districts + admin-noise worlds, then districts / pql_admin / sweep
git diff --stat results/                # empty: regenerated results are byte-identical to committed
python3 -m pytest -q                    # 12 passed in 1.85s
grep -rn -w -i truth --include='*.py' . # plus grep for converts_on/churns_on/archetype/events reads in api.py, report.py, dashboard/app.py
scratch probes (lane-a/probe1-4.py): future-data check across 3 modes x 2 worlds x 6 dates; PQL calendar mode; reason/threshold/edge-date checks
```

## Component table
| Component | Gate | Status | Evidence |
|---|---|---|---|
| Simulator (default, district, admin-noise worlds) | GREEN | DONE | All three build; archetype mix 28/10/24/20/38 free, 34/12/22/12 paid |
| Point-in-time features (school_days, school_days_shared, calendar) | GREEN | DONE | No leak in any mode or world (scratch probe, 36 combos, 0 diffs). The test suite covers only one mode (see below) |
| PQL score + top-3 reasons | GREEN | DONE | `pql.score`; statuses {Ready, Not yet}; `ready_rule` {score, admin, None} |
| Naive PQL baseline (5+ tutors) | GREEN | DONE | 93 flagged, 37% precision |
| PQL backtest | GREEN | DONE | Matches committed `results/pql_backtest.md`. The spec's numbers are stale (table below) |
| Health score + top-3 reasons | GREEN | DONE | `health.py`; scores 80 paid schools; skips schools with fewer than 10 school days elapsed. Lifecycle gaps are listed under fragile points |
| Churn backtest (health vs calendar windows) | GREEN | DONE | `backtest health`: 0 vs 58 false alarms, 17/22 vs 21/22 churners caught early |
| LR comparison (train fall, test spring) | GREEN | DONE | `backtest lr` output matches committed files |
| Experiments: districts / pql_admin / sweep | GREEN | DONE | All three regenerate byte-identical results files |
| Integrity tests | GREEN (pass) | PARTIAL (coverage) | 12/12 pass. Gaps listed under anti-cheating |
| README numbers | GREEN | DONE | Every number matches code. The framing issue is noted below |
| LEARN.md numbers and status | RED | stale | Nov 11 numbers and status. 14 mismatches below |
| API `/backtest` metrics (cross-lane) | RED | PARTIAL | Kindling false alarms hard-coded to `0`. "False alarms" are measured against Kindling, not truth. Lead is −50 vs 10 (see fragile point 6) |

## Numbers: spec vs committed results vs code now
| Metric | Spec / LEARN (Nov 11) | Committed `results/` | Code now |
|---|---|---|---|
| PQL flagged, naive vs Kindling | 93 vs 30 | 93 vs 31 | 93 vs **31** |
| Precision | 37% vs 73% | 37% vs 77% | 37% vs **77%** |
| Recall | 100% vs 65% (22/34) | 100% vs 71% | 100% vs **71% (24/34)** |
| Median lead (days) | 53 vs 30 | 56 vs 28 | **56 vs 28** (28.5 printed as "28") |
| Top 20 on Feb 2 that converted | 4/20 vs 6/20 | 4/20 vs 8/20 | 4/20 vs **8/20** |
| Health, calendar vs school-day: churners caught ≥45d | n/a (planned) | 21/22 vs 17/22 | 21/22 (95%) vs **17/22 (77%)** |
| Health median lead on churners | n/a | 114 vs 80 | 114 vs **80** |
| Health false alarms (healthy schools) | n/a | 58 (100%) vs 0 | 58 (100%) vs **0 (0%)** |
| LR PQL spring, rules vs LR | n/a | 70%/70% vs 40%/91% (precision/recall) | same |
| LR health spring, rules vs LR | n/a | 13/22, 0 false alarms vs 18/22, 58 false alarms | same |
| District world health false alarms (calendar / national / district) | n/a | 100% / 83% / 0% | same |
| District world PQL precision | n/a | 78% / 79% / 78% | same |
| Admin rule, default vs noise | n/a | 35 flagged, 74%; 46 flagged, 63% | same |
| Sweep picks | n/a | PQL 35 (fails on spring), health 70 | same |

## Mismatches
1. Spec (all four headline numbers) and LEARN.md §5 table: 30/73%/65%/30d/6-of-20 should be 31/77%/71%/28d/8-of-20. Naive lead is 56, not 53.
2. LEARN.md: "Kindling misses the 70% recall target (65%)". Recall is now 71%, so the target is **met**. The 2-minute pitch line "under my 70% goal" and Q&A 3 ("65% recall, under my 70% target") understate the result.
3. LEARN.md: "8 wrong flags, all stalled". Now 7, still all stalled.
4. LEARN.md: "12 misses: 6 quiet converters, 6 decoys (5 solo, 1 builder)". Now 10 misses: 4 converters, 4 solo_star, 2 builders.
5. LEARN.md: "calendar-day version got the same precision and recall, 27.5 vs 30 lead". Now calendar windows are slightly **better** for PQL: 78% precision, 74% recall, 29-day lead, vs 77%, 71%, 28.5.
6. LEARN.md: "Lead time of 30 days". Now 28.
7. LEARN.md 2-minute pitch and Q&A 3: "37% to 73%" and "73% vs 37%" should both say 77%.
8. LEARN.md 30-second pitch: "The churn side is next". It is built. The 2-minute pitch's "Next is the health score" is also stale.
9. LEARN.md status lines: health score PLANNED, health backtest PLANNED, LR "plan includes" (Q6). All three are built.
10. LEARN.md healthy_break_renewal: "this test hasn't been run". It has: calendar windows flag 12/12, school days 0/12.
11. LEARN.md Q8 ("haven't built [churn], can't claim it") and Check-yourself answers 2 and 5: stale.
12. LEARN.md "All 5 tests pass". There are now 12 tests (9 functions, one run on 3 dates).
13. README "Why it works" puts the PQL row (37% to 77%) under "measure in school days, not calendar days". That gain comes from the scoring rule vs the 5+ tutors rule, not from the window type. Known limits does admit "School days don't help the PQL score".
14. README omits what the health score gives up: recall drops 95% to 77% and lead drops 114 to 80 days vs calendar windows. Calendar windows' recall is inflated because they flag every school, but the README should still show the trade-off (RULES #4 spirit).

## Anti-cheating findings
- **(a) Truth reads: PASS, partly enforced.** `test_engine_never_reads_truth` scans only `features.py`, `pql.py` and `health.py`. It does not scan `api.py`, `report.py`, `dashboard/app.py` or `simulate.py`; the code comment says "add api.py as it lands", and that was never done. Manual grep finds `truth` only in `simulate.py` (the writer), `backtest.py` and tests. `api.py`, `report.py` and `dashboard/app.py` have no `truth`, `converts_on`, `churns_on` or `archetype` reads and no raw `FROM events`. The check is plain text, so a dynamically built table name would slip past it.
  - Outcome events (`plan_converted`, `plan_churned`, `plan_renewed`) live in `events`. Only the point-in-time filter keeps them out of the features.
- **(b) Future data: PASS, partly enforced.** The test deletes events after `as_of` and compares features on 3 dates (Nov 3, Jan 5, Mar 23), but only in the default `school_days` mode on the default world. It does not cover `calendar` or `school_days_shared` mode, the district world, scores (only features), or edge dates (Sep 1, summer). My scratch probe extended it to 3 modes x 2 worlds x 6 dates, with features, PQL and health all compared: 0 diffs. So no leak today, but the guarantee is untested for the naive and district modes. The calendar tables are copied whole, which is deliberate (published ahead).
- **(c) Flags only before conversion: PASS, not tested.** `evaluate` counts a hit only when `converts_on > first_flag`. `pql.score` and `naive_activation` drop schools with a `plan_converted` event on or before `as_of`. No test checks either rule. `test_pql_score_shape` checks only `plan_at_start == "free"`. Health has no equivalent filter: churned and renewed schools stay scored after their renewal date (346 rows for churned schools). A churner flag after `churns_on` gets a negative lead and is never counted as early, so the metrics stay honest.

## School days vs calendar windows: verdict
- **Health, default world: school days win on false alarms.** 0 vs 58 healthy schools flagged (calendar windows fire on 9 schools Dec 29 and 48 on Jan 5). They lose on recall (77% vs 95%) and lead (80 vs 114 days).
- **Health, district world: district calendars are needed.** District school days give 0 false alarms, one national calendar gives 48 (83%), calendar windows 58 (100%). Recall is 77% / 82% / 100%.
- **PQL, both worlds: no win.** Default world: calendar windows 78%/74% vs school days 77%/71% (my run; nothing published). District world: 78% / 79% / 78%.
- Bottom line: school days are proven for health only, and at a recall cost.

## LEARN.md scoring-side status reconciliation
| LEARN.md item (Nov 11) | Claimed | Actual |
|---|---|---|
| Simulator | BUILT | BUILT, plus district and admin-noise worlds |
| Point-in-time features | BUILT | BUILT, 3 modes |
| PQL score | BUILT | BUILT, plus opt-in admin rule |
| Naive baseline | BUILT | BUILT |
| PQL backtest | BUILT | BUILT, numbers changed (table above) |
| "5 integrity tests" | 5 pass | 12 pass, coverage gaps above |
| Health score + churn backtest | PLANNED | BUILT (DONE) |
| LR comparison | PLANNED | BUILT |

## Fragile points the UI will lean on
1. **Health threshold sits on a cliff.** Healthy schools bottom out at 71–74 against a cutoff of 70; the lowest healthy scores are 71, 72, 72, 73, 73, 73, 74, 74. The sweep shows spring false alarms jump from 0% at 70 to 14% at 75 and 66% at 80. Small weight changes would wreck the "0 false alarms" headline.
2. **The 45-day early cut is knife-edge.** Churner leads include 41, 42, 44 and 44 days, so weekly cadence decides whether 4 of the 5 late churners count.
3. **No lifecycle statuses.** Health returns only {At risk, Healthy}. Renewed and churned schools keep being scored after `renewal_date` with "Renewal date has passed" (1,392 rows; 87 At risk). There is no Renewed, Churned or Not-scored-yet status, and schools with fewer than 10 school days are silently left out. PQL silently drops converted schools.
4. **Health reasons are ranked by points earned, not points lost.** "Renewal in 63 days" (15 pts) can outrank "Active teachers down 75%" (10 pts). All 198 at-risk rows still show at least one "down" reason in the top 3, but the biggest drag isn't always first. 27 Ready PQL rows have fewer than 3 reasons.
5. **Edge dates.** The API defaults `as_of` to `date.today()` (2026-11-23), which is past the simulated END of 2026-07-31. Scores freeze at the last school-day window, so the same 7 Ready and 4–6 At risk schools show from June to November. Before the first school day (Aug 4), both PQL and health return empty frames.
6. **API `/backtest` disagrees with `results/`.** It reports naive "false alarms" of 541 (school-weeks measured against Kindling, not truth) vs Kindling `0` (hard-coded). Its "median lead" is the median `days_to_renewal` over all at-risk rows (−50 vs 10). It starts Aug 4 instead of Sep 1 and shades only the national breaks. A backtest view built on this endpoint would contradict `results/health_backtest.md`.
7. **PQL has no score exactly 60.** Scores are coarse (…56, 57, 58, 59, 61, 63…), with 47 rows in 55–64. Sweep: 60 and 65 give identical fall results; 45 and 50 differ only in spring lead (29 vs 26 days).
