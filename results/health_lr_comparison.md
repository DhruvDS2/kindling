# Health: rules vs logistic regression

Trained on Mondays ≤ 2025-12-31 (fall). Tested on Mondays > 2025-12-31 (spring). LR uses the same point-in-time features.

|                                        | Rules (spring only)   | Logistic regression (trained fall)   |
|:---------------------------------------|:----------------------|:-------------------------------------|
| churners flagged ≥45 days early        | 6 / 22                | 12 / 22                              |
| recall (churners)                      | 27%                   | 55%                                  |
| median lead time on churners (days)    | 72                    | 86                                   |
| false alarms (healthy flagged at risk) | 0                     | 51                                   |
| false alarm rate                       | 0%                    | 88%                                  |
