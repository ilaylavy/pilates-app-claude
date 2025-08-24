.PHONY: help setup build up down logs test lint format clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Initial project setup
	@echo "Setting up the project..."
	cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt
	cd mobile && npm install

build: ## Build all services
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs from all services
	docker-compose logs -f

start: down up logs  ## reset the backend and logs

backend-logs: ## Show backend logs
	docker-compose logs -f backend

db-logs: ## Show database logs
	docker-compose logs -f postgres

test-backend: ## Run backend tests
	docker-compose exec backend python -m pytest tests/ -v

test-mobile: ## Run mobile tests
	cd mobile && npm test

test: test-backend test-mobile ## Run all tests

lint-backend: ## Lint backend code
	docker-compose exec backend python -m black . && docker-compose exec backend python -m isort . && docker-compose exec backend python -m flake8 .

lint-mobile: ## Lint mobile code
	cd mobile && npm run lint

lint: lint-backend lint-mobile ## Lint all code

format: ## Format all code
	docker-compose exec backend python -m black . && docker-compose exec backend python -m isort .
	cd mobile && npm run format

migration: ## Create new database migration
	@read -p "Enter migration message: " msg; \
	docker-compose exec backend python -m alembic revision --autogenerate -m "$$msg"

migrate: ## Run database migrations
	docker-compose exec backend python -m alembic upgrade head

seed: ## Seed database with initial data
	docker-compose exec backend python -m app.scripts.seed_manager seed --type heavy
seed-list: ## List available seed scripts
	docker-compose exec backend python -m app.scripts.seed_manager list

clean: ## Clean up containers and volumes
	docker-compose down -v
	docker system prune -f

reset-db: clean up migrate seed ## Reset database completely