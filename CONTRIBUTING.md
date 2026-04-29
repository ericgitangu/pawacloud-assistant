# Contributing

## Local setup

```bash
# backend (python 3.12)
cd backend
python -m venv venv
. venv/bin/activate
pip install -r requirements.txt

# rust extension (optional — the python fallback works identically)
cd ../rust-core
maturin develop --release

# frontend (pnpm 9)
cd ../frontend
pnpm install
```

## Running

```bash
make dev-backend    # uvicorn on :8000
make dev-frontend   # next dev on :3000
make test           # pytest + doctests + cargo test
```

Or just `make dev` to bring everything up under docker compose.

## Branch model

- `main` — protected, every change lands via PR
- `feat/<short-name>` — new features
- `fix/<short-name>` — bug fixes
- `chore/<short-name>` — tooling, infra, docs-only changes

Squash-merge into `main`. Delete the branch after merge.

## Commit messages

[Conventional Commits](https://conventionalcommits.org) — enforced by commitlint
in the `.husky/commit-msg` hook. Lowercase body, no trailing period, no
adjectives. Examples:

```
feat: typed sse consumer for documents
fix: tighten event_counts return type
chore: extend /health/metrics with document benchmarks
docs: add growth playbook
```

## Pre-commit

`.husky/pre-commit` runs ruff (backend), eslint+tsc (frontend), cargo
fmt+clippy (rust) on staged changes. Commits won't go through with style
or type errors. Don't bypass with `--no-verify`.

## Pull requests

Use the template that opens automatically. Every PR must:

- pass CI (backend tests, rust tests, frontend build)
- have a clear summary and a manual test plan
- reference an issue if one exists

Reviews are encouraged but not blocking on a solo branch. Self-merges are
fine for docs and infra; feature branches benefit from a second pair of eyes
when one is available.

## Reporting issues

Use one of the templates under [Issues](../../issues/new/choose). For
security concerns, see [SECURITY.md](SECURITY.md).
