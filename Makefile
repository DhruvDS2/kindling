.PHONY: data backtest experiments dashboard api test clean

data:
	python3 -m kindling.simulate

backtest: data
	python3 -m kindling.backtest pql
	python3 -m kindling.backtest health
	python3 -m kindling.backtest lr

# Separate runs, each reported in its own results file (they never change the headline numbers)
experiments: data
	python3 -m kindling.simulate --calendars district
	python3 -m kindling.simulate --admin-noise 0.25
	python3 -m kindling.backtest districts
	python3 -m kindling.backtest pql_admin
	python3 -m kindling.backtest sweep

report: backtest
	python3 -m kindling.report

dashboard:
	streamlit run dashboard/app.py

api:
	uvicorn kindling.api:app --reload

test:
	pytest -q

clean:
	rm -f data/*.duckdb
	rm -f results/*.md results/*.html results/*.png
