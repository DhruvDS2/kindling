# Health backtest

Replayed every Monday from 2025-09-01 to 2026-07-31. A school is flagged the first Monday its score drops below 70. A churner flag counts as early if it comes ≥45 days before renewal. False alarms are healthy schools incorrectly flagged at risk.

|                                        | Naive: calendar windows   | Kindling: school-day windows   |
|:---------------------------------------|:--------------------------|:-------------------------------|
| churners flagged ≥45 days early        | 21 / 22                   | 17 / 22                        |
| recall (churners)                      | 95%                       | 77%                            |
| median lead time on churners (days)    | 114                       | 80                             |
| false alarms (healthy flagged at risk) | 57                        | 0                              |
| false alarm rate                       | 98%                       | 0%                             |
