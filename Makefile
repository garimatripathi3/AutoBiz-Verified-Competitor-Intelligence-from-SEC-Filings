.PHONY: install install-min run cli eval test notebook clean

install:
	pip install -r requirements.txt

install-min:
	pip install -r requirements-minimal.txt

run:
	uvicorn server.main:app --reload --host 0.0.0.0 --port 8000

cli:
	python -m autobiz.cli --file data/sample/financials.csv --competitor "Acme Corp" --query "Compare our financials to our competitor" --show-trace

eval:
	python -m autobiz.cli --eval

test:
	pytest -q

notebook:
	python build_notebook.py

clean:
	rm -f data/sessions.db data/agent_traces.jsonl
	rm -rf data/chroma data/reports/*.md __pycache__ .pytest_cache
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
