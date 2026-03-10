.PHONY: dev dev-backend dev-frontend rust-build test deploy-backend deploy-frontend deploy infra-init infra-plan infra-apply

dev:
	docker compose up --build

dev-backend:
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && pnpm run dev

rust-build:
	cd backend && . venv/bin/activate && cd ../rust-core && pip install maturin && maturin develop --release

test:
	cd backend && . venv/bin/activate && python3 -m pytest tests/ -v --doctest-modules app/services/text_processing.py app/services/response_processing.py

deploy-backend:
	bash scripts/deploy-backend.sh

deploy-frontend:
	bash scripts/deploy-frontend.sh

deploy: deploy-backend deploy-frontend

infra-init:
	cd infra && terraform init

infra-plan:
	cd infra && terraform plan

infra-apply:
	cd infra && terraform apply -auto-approve
