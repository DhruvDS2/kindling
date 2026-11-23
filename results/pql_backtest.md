# PQL backtest

Replayed every Monday from 2025-09-01 to 2026-07-31. A school is flagged the first Monday its score reaches 60. A flag counts as a hit only if the school converts *after* the flag.

|                                           | Naive: 5+ tutors built   | Kindling PQL score   |
|:------------------------------------------|:-------------------------|:---------------------|
| schools flagged                           | 93                       | 31                   |
| flagged that converted                    | 34                       | 24                   |
| precision                                 | 37%                      | 77%                  |
| converters caught before converting       | 34 / 34                  | 24 / 34              |
| recall                                    | 100%                     | 71%                  |
| median lead time (days)                   | 56                       | 28                   |
| top 20 on 2026-02-02 that later converted | 4 / 20                   | 8 / 20               |
