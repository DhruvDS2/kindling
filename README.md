# Kindling

Flags which free schools are ready to buy and which paying schools are about to churn, from product usage alone — and knows the difference between a real drop and winter break.

## The problem

In a product-led K-12 motion, teachers adopt for free and spread the product inside their school. Across hundreds of schools, two questions are impossible to answer by eye:

1. **Who is ready to buy?** One excited teacher is a user. Several teachers whose students actually use the product is an account ready for a sales conversation.
2. **Who is about to churn?** Usage falls before a renewal — but schools go quiet every winter, spring, and summer break. A naive system fires a false alarm every December.

**The core insight:** measure activity in school days, not calendar days. A rolling window of the last 10 instructional days ignores breaks, so a quiet winter break doesn't look like churn.

## Results

### PQL (free schools ready to buy)

| | Naive: 5+ tutors built | Kindling PQL |
|---|---|---|
| Schools flagged | 93 | **30** |
| Precision (flagged that converted) | 37% | **73%** |
| Recall (converters caught first) | 100% | 65% |
| Median lead time | 53 days | 30 days |

Kindling sends reps a third as many schools and twice as many of them buy. The cost: it misses quiet converters with only 2 teachers.

### Health (paying schools at risk of churning)

| | Naive: calendar windows | Kindling: school-day windows |
|---|---|---|
| Churners flagged ≥45 days early | 12 / 22 | 9 / 22 |
| Recall | 55% | 41% |
| **False alarm rate** | **100%** | **0%** |

The naive model fires on every single healthy school around winter break. School-day windows cut false alarms to zero — the only result that makes CS alerts trustworthy.

### Logistic regression vs rules (honest comparison, trained fall / tested spring)

**PQL:** LR gets 100% recall but 48% precision (vs rules: 64% precision, 67% recall). Rules are more precise; LR catches more.

**Health:** LR catches more churners (55% vs 27% recall) but fires 88% false alarms (vs 0% for rules). The LR doesn't understand breaks.

## How it works

```
simulate.py ──► DuckDB (calendar, schools, teachers, events | truth)
                    │
          features.py (as_of date, school-day windows)
                    │
          ┌─────────┴─────────┐
       pql.py              health.py
          └─────────┬─────────┘
                    │
     ┌──────────────┼──────────────────────┐
 backtest.py     api.py ◄── n8n (weekly)  dashboard/app.py
 (vs truth)         │
                    └──► Slack #sales / #customer-success
```

Every score comes with its top 3 reasons so reps know what to say on the call.

## Data

All data is synthetic. 200 schools over a 2025–26 school year. Each school has a hidden archetype that drives its behavior:

**Free schools:** `converter` (spreads, buys), `stalled` (spreads, never buys — budget freeze), `solo_star` (one great teacher, no spread), `builders` (lots of tutors created, students barely use them), `dormant`.

**Paying schools:** `healthy`, `expander`, `churner`, `healthy_break_renewal` (renews right after winter break — the trap for naive churn models).

## Setup

```bash
pip install -r requirements.txt
python -m kindling.simulate          # builds data/kindling.duckdb (~1 second)
python -m kindling.backtest pql      # results/pql_backtest.md
python -m kindling.backtest health   # results/health_backtest.md
python -m kindling.backtest lr       # results/*_lr_comparison.md
pytest -q                            # 5 integrity tests
streamlit run dashboard/app.py       # interactive dashboard
uvicorn kindling.api:app --reload    # API for n8n / Slack
```

## Limits

- **Synthetic data only.** The simulator plants the exact traps the scorer needs to handle. Real data would be messier.
- **School-day windows help health, barely help PQL.** The PQL calendar vs school-day difference is small (same precision/recall, 2.5 days extra lead time). The health false-alarm story is the proof.
- **Stalled schools are unbeatable.** They look identical to buyers. All 8 wrong PQL flags are stalled schools. This is the honest precision ceiling.
- **One shared calendar.** Real districts have different break schedules. Production would need a per-district calendar.
- **Rules, not ML, for production.** The LR comparison shows rules are more precise for PQL and have zero false alarms for health. LR has better recall but at a cost reps and CS teams wouldn't tolerate.
