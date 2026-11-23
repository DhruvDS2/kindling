# District calendars backtest

A second simulated world (`python -m kindling.simulate --calendars district`): same schools and archetypes, but each school follows its district's calendar (different start and end dates, February and April vacations in the Northeast, early-March spring break in the Southwest). Scoring rules and thresholds are unchanged from the main backtest.

## Health (paying schools)

|                                        | Naive: calendar windows   | School days, one national calendar   | Kindling: school days, district calendars   |
|:---------------------------------------|:--------------------------|:-------------------------------------|:--------------------------------------------|
| churners flagged ≥45 days early        | 22 / 22                   | 18 / 22                              | 17 / 22                                     |
| recall (churners)                      | 100%                      | 82%                                  | 77%                                         |
| median lead time on churners (days)    | 100                       | 76                                   | 80                                          |
| false alarms (healthy flagged at risk) | 58                        | 48                                   | 0                                           |
| false alarm rate                       | 100%                      | 83%                                  | 0%                                          |

## False alarms by calendar

Healthy schools flagged at risk at least once, by the calendar the school actually follows.

| calendar   |   healthy paid schools |   Naive: calendar windows |   School days, one national calendar |   Kindling: school days, district calendars |
|:-----------|-----------------------:|--------------------------:|-------------------------------------:|--------------------------------------------:|
| midwest    |                     12 |                        12 |                                   10 |                                           0 |
| northeast  |                     12 |                        12 |                                   10 |                                           0 |
| southeast  |                     14 |                        14 |                                   14 |                                           0 |
| southwest  |                      6 |                         6 |                                    6 |                                           0 |
| west       |                     14 |                        14 |                                    8 |                                           0 |

## PQL (free schools)

|                                           | Naive: calendar windows   | School days, one national calendar   | Kindling: school days, district calendars   |
|:------------------------------------------|:--------------------------|:-------------------------------------|:--------------------------------------------|
| schools flagged                           | 32                        | 33                                   | 32                                          |
| flagged that converted                    | 25                        | 26                                   | 25                                          |
| precision                                 | 78%                       | 79%                                  | 78%                                         |
| converters caught before converting       | 25 / 34                   | 26 / 34                              | 25 / 34                                     |
| recall                                    | 74%                       | 76%                                  | 74%                                         |
| median lead time (days)                   | 29                        | 28                                   | 29                                          |
| top 20 on 2026-02-02 that later converted | 8 / 20                    | 8 / 20                               | 8 / 20                                      |

