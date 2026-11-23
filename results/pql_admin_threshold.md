# PQL run 3: lower threshold for schools with an admin

Run 2 is the headline PQL backtest: Ready at score ≥ 60. Run 3 keeps that rule and adds one: a school where an admin has signed up is also Ready at ≥ 40. The aim is the quiet converters run 2 misses (2–3 teachers, lighter use). Weights unchanged; the 40 comes from reasoning about the quiet-converter profile (see config.py), not from these results.

## Default world

|                                           | Naive: 5+ tutors built   | Run 2: score ≥ 60   | Run 3: + admin rule (≥ 40 with an admin)   |
|:------------------------------------------|:-------------------------|:--------------------|:-------------------------------------------|
| schools flagged                           | 93                       | 31                  | 35                                         |
| flagged that converted                    | 34                       | 24                  | 26                                         |
| precision                                 | 37%                      | 77%                 | 74%                                        |
| converters caught before converting       | 34 / 34                  | 24 / 34             | 26 / 34                                    |
| recall                                    | 100%                     | 71%                 | 76%                                        |
| median lead time (days)                   | 56                       | 28                  | 29                                         |
| top 20 on 2026-02-02 that later converted | 4 / 20                   | 8 / 20              | 8 / 20                                     |
| real converters caught                    | 28 / 28                  | 24 / 28             | 26 / 28                                    |
| small converters (≤3 teachers) caught     | 11 / 11                  | 7 / 11              | 9 / 11                                     |
| stalled schools flagged                   | 10                       | 7                   | 9                                          |
| flagged by the admin rule                 | 0                        | 0                   | 10                                         |

**Caveat.** In the default simulator only converter-shaped schools (converters and stalled) ever get an admin signup, so an admin rule is favoured by construction. The stress test below gives admins to non-buying schools too.

## Stress test: admins at 25% of non-buying schools

Same world, but a quarter of solo-star, builder and dormant schools also get an admin signup 1–8 weeks after their first teacher (`simulate.py --admin-noise 0.25`).

|                                           | Naive: 5+ tutors built   | Run 2: score ≥ 60   | Run 3: + admin rule (≥ 40 with an admin)   |
|:------------------------------------------|:-------------------------|:--------------------|:-------------------------------------------|
| schools flagged                           | 93                       | 31                  | 46                                         |
| flagged that converted                    | 34                       | 24                  | 29                                         |
| precision                                 | 37%                      | 77%                 | 63%                                        |
| converters caught before converting       | 34 / 34                  | 24 / 34             | 29 / 34                                    |
| recall                                    | 100%                     | 71%                 | 85%                                        |
| median lead time (days)                   | 56                       | 28                  | 29                                         |
| top 20 on 2026-02-02 that later converted | 4 / 20                   | 9 / 20              | 9 / 20                                     |
| real converters caught                    | 28 / 28                  | 24 / 28             | 26 / 28                                    |
| small converters (≤3 teachers) caught     | 11 / 11                  | 7 / 11              | 9 / 11                                     |
| stalled schools flagged                   | 10                       | 7                   | 9                                          |
| flagged by the admin rule                 | 0                        | 0                   | 21                                         |

