.PHONY: help dev up down test lint migrate seed benchmark clean

# Default target
help: ## Show this help message
	@echo VigilAI - Real-Time Computer Vision Analytics Platform
	@echo.
	@echo Usage: make [target]
	@echo.
	@echo Targets:

# Development
dev: ## Start development services (postgres + redis)
	docker compose up -d postgres redis
	@echo "PostgreSQL and Redis are running."
	@echo "Run 'make migrate' to initialize the database."
	@echo "Run API: python -m uvicorn apps.api.vigilai_api.main:app --reload --port 8000"
	@echo "Run Worker: python -m apps.worker.main"
	@echo "Run Frontend: cd apps/web && npm run dev"

# Docker
up: ## Start all services with Docker Compose
	docker compose up -d --build

down: ## Stop all services
	docker compose down

up-gpu: ## Start all services with GPU support
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build

logs: ## Show logs from all services
	docker compose logs -f

logs-api: ## Show API logs
	docker compose logs -f api

logs-worker: ## Show worker logs
	docker compose logs -f worker

# Database
migrate: ## Run database migrations
	python -m alembic upgrade head

migrate-down: ## Rollback last migration
	python -m alembic downgrade -1

migrate-new: ## Create new migration (usage: make migrate-new MSG="description")
	python -m alembic revision --autogenerate -m "$(MSG)"

seed: ## Seed development data
	python scripts/seed.py

# Testing
test: ## Run all tests
	python -m pytest tests/ -v --tb=short

test-cv: ## Run CV/geometry tests
	python -m pytest tests/test_geometry.py tests/test_analytics.py -v

test-api: ## Run API tests
	python -m pytest tests/test_api.py -v

test-events: ## Run event/rule tests
	python -m pytest tests/test_rules.py tests/test_events.py -v

test-cov: ## Run tests with coverage
	python -m pytest tests/ -v --cov=apps --cov-report=html --cov-report=term

# Code Quality
lint: ## Run linter
	python -m ruff check apps/ tests/
	python -m ruff format --check apps/ tests/

lint-fix: ## Fix linting issues
	python -m ruff check --fix apps/ tests/
	python -m ruff format apps/ tests/

typecheck: ## Run type checker
	python -m mypy apps/api/vigilai_api/ --ignore-missing-imports

# Model / CV
benchmark: ## Run inference benchmark
	python scripts/benchmark.py

train: ## Run training pipeline (requires dataset)
	python scripts/train.py

evaluate: ## Run model evaluation
	python scripts/evaluate.py

export-onnx: ## Export model to ONNX format
	python scripts/export_onnx.py

# Utilities
clean: ## Clean generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache .mypy_cache htmlcov .coverage
	rm -rf apps/web/.next apps/web/out

install: ## Install Python dependencies
	pip install -e ".[dev]"

install-frontend: ## Install frontend dependencies
	cd apps/web && npm install

# Health Check
health: ## Check service health
	@curl -s http://localhost:8000/api/v1/system/health | python -m json.tool 2>/dev/null || echo "API not running"
	@echo "---"
	@curl -s http://localhost:3000 > /dev/null 2>&1 && echo "Frontend: OK" || echo "Frontend: not running"
