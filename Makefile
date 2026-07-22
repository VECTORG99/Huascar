.DEFAULT_GOAL := help

.PHONY: help install build test test-unit test-integration docker-build docker-up docker-down docker-logs clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (root + frontend + agent-creator) and create .env
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example — edit with your keys"; fi
	@echo "Installing root dependencies..."
	npm ci
	@echo "Installing frontend dependencies..."
	@if [ -d frontend/node_modules ]; then cd frontend && npm ci; else cd frontend && npm install; fi
	@echo "Installing agent-creator dependencies..."
	@if [ -d agent-creator/node_modules ]; then cd agent-creator && npm ci; else cd agent-creator && npm install; fi

build: ## Build backend (tsc) and frontend (Next.js)
	@echo "Building backend..."
	npm run build
	@echo "Building frontend..."
	cd frontend && npm run build

test: test-unit test-integration ## Run all tests (unit + integration)

test-unit: ## Run backend unit tests
	@echo "Running unit tests..."
	npm run test:unit

test-integration: ## Run backend integration tests
	@echo "Running integration tests..."
	npm test

docker-build: ## Build all Docker images
	@echo "Building Docker images..."
	docker compose build

docker-up: ## Start Docker containers in detached mode
	@echo "Starting Docker containers..."
	docker compose up -d

docker-down: ## Stop and remove Docker containers
	@echo "Stopping Docker containers..."
	docker compose down

docker-logs: ## Tail logs from running Docker containers
	docker compose logs -f

clean: ## Remove build artifacts (dist, .next, agent-creator/dist)
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf frontend/.next
	rm -rf agent-creator/dist
