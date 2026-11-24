# Threshold sweep

Data: `data/kindling.duckdb`. Each threshold is picked on fall Mondays (≤ 2025-12-31) and reported on spring Mondays, so the pick is never graded on the data it was chosen from (RULES.md #3).

**On synthetic data this is a dry run.** It shows how thresholds will be set once real outcomes exist; it does not change config.py. Fall and spring see different schools (spring only scores schools that hadn't converted by January; fall can only catch churners whose decline starts in fall), so compare rows within a column, not across halves.

## PQL Ready threshold (business rule: fall precision ≥ 60%, then most recall)

| threshold      |   fall flagged | fall precision   | fall recall   |   spring flagged | spring precision   | spring recall   |   spring lead (days) |
|:---------------|---------------:|:-----------------|:--------------|-----------------:|:-------------------|:----------------|---------------------:|
| 30             |             40 | 52%              | 78%           |               49 | 45%                | 96%             |                   36 |
| 35 ← fall pick |             31 | 65%              | 74%           |               40 | 50%                | 87%             |                   36 |
| 40             |             24 | 62%              | 56%           |               30 | 63%                | 83%             |                   29 |
| 45             |             20 | 75%              | 56%           |               28 | 68%                | 83%             |                   29 |
| 50             |             20 | 75%              | 56%           |               28 | 68%                | 83%             |                   26 |
| 55             |             17 | 82%              | 52%           |               25 | 72%                | 78%             |                   26 |
| 60 ← config    |             15 | 87%              | 48%           |               23 | 70%                | 70%             |                   24 |
| 65             |             15 | 87%              | 48%           |               22 | 68%                | 65%             |                   22 |
| 70             |             14 | 86%              | 44%           |               21 | 67%                | 61%             |                   18 |
| 75             |             12 | 83%              | 37%           |               19 | 68%                | 57%             |                   19 |
| 80             |              7 | 86%              | 22%           |               17 | 71%                | 52%             |                   20 |
| 85             |              4 | 75%              | 11%           |               14 | 64%                | 39%             |                   18 |
| 90             |              4 | 75%              | 11%           |               14 | 64%                | 39%             |                   18 |

Fall pick (precision ≥ 60%): **35** vs 60 in config.py; it **fails the same rule on spring**, so don't adopt it. config.py is not changed by this run.

## Health At-risk threshold (business rule: fall false alarms ≤ 5%, then most recall)

| threshold               | fall recall   | fall false alarms   | spring recall   | spring false alarms   |
|:------------------------|:--------------|:--------------------|:----------------|:----------------------|
| 40                      | 9%            | 0%                  | 18%             | 0%                    |
| 45                      | 9%            | 0%                  | 36%             | 0%                    |
| 50                      | 9%            | 0%                  | 41%             | 0%                    |
| 55                      | 14%           | 0%                  | 45%             | 0%                    |
| 60                      | 14%           | 0%                  | 59%             | 0%                    |
| 65                      | 14%           | 0%                  | 59%             | 0%                    |
| 70 ← config ← fall pick | 27%           | 0%                  | 59%             | 0%                    |
| 75                      | 27%           | 0%                  | 73%             | 3%                    |
| 80                      | 27%           | 0%                  | 77%             | 17%                   |
| 85                      | 27%           | 3%                  | 82%             | 66%                   |
| 90                      | 32%           | 33%                 | 82%             | 100%                  |

Fall pick (false alarms ≤ 5%): **70**, same as config.py; it also meets the rule on spring.

## On real data

1. Load real usage into the same tables (`schools`, `teachers`, `events`, `school_calendars`) and real outcomes into `truth` (converted on / churned on). Outcomes only ever feed this module.
2. Wait for one semester of outcomes, then run `python -m kindling.backtest sweep --db <path>`.
3. Adopt a new threshold only if its spring row holds up, and log the change in PROGRESS.md.
4. Agree the two business rules above with sales and CS first: they decide the threshold, not the sweep.
