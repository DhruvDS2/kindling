.PHONY: data backtest dashboard api test clean

data:
	python3 -m kindling.simulate

backtest: data
	python3 -m kindling.backtest pql
	python3 -m kindling.backtest health
	python3 -m kindling.backtest lr

report: backtest
	python3 -m kindling.report

dashboard:
	streamlit run dashboard/app.py

api:
	uvicorn kindling.api:app --reload

test:
	pytest -q

clean:
	rm -f data/kindling.duckdb
	rm -f results/*.md results/*.html results/*.png
