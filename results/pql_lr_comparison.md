# PQL: rules vs logistic regression

Trained on Mondays ≤ 2025-12-31 (fall). Tested on Mondays > 2025-12-31 (spring). LR uses the same point-in-time features; weights were not hand-tuned.

|                                           | Rules (spring only)   | Logistic regression (trained fall)   |
|:------------------------------------------|:----------------------|:-------------------------------------|
| schools flagged                           | 22                    | 44                                   |
| flagged that converted                    | 14                    | 21                                   |
| precision                                 | 64%                   | 48%                                  |
| converters caught before converting       | 14 / 21               | 21 / 21                              |
| recall                                    | 67%                   | 100%                                 |
| median lead time (days)                   | 28                    | 36                                   |
| top 20 on 2026-02-02 that later converted | 6 / 20                | 9 / 20                               |
