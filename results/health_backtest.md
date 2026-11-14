# Health backtest

Replayed every Monday from 2025-09-01 to 2026-07-31. A school is flagged the first Monday its score drops below 50. A churner flag counts as early if it comes ≥45 days before renewal. False alarms are healthy schools incorrectly flagged at risk.

|                                        | Naive: calendar windows   | Kindling: school-day windows   |
|:---------------------------------------|:--------------------------|:-------------------------------|
| churners flagged ≥45 days early        | 12 / 22                   | 9 / 22                         |
| recall (churners)                      | 55%                       | 41%                            |
| median lead time on churners (days)    | 86                        | 72                             |
| false alarms (healthy flagged at risk) | 58                        | 0                              |
| false alarm rate                       | 100%                      | 0%                             |
