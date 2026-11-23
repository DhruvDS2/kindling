# PQL: rules vs logistic regression

Trained on Mondays ≤ 2025-12-31 (fall). Tested on Mondays > 2025-12-31 (spring). LR uses the same point-in-time features; weights were not hand-tuned.

|                                           | Rules (spring only)   | Logistic regression (trained fall)   |
|:------------------------------------------|:----------------------|:-------------------------------------|
| schools flagged                           | 23                    | 52                                   |
| flagged that converted                    | 16                    | 21                                   |
| precision                                 | 70%                   | 40%                                  |
| converters caught before converting       | 16 / 23               | 21 / 23                              |
| recall                                    | 70%                   | 91%                                  |
| median lead time (days)                   | 24                    | 46                                   |
| top 20 on 2026-02-02 that later converted | 8 / 20                | 8 / 20                               |
