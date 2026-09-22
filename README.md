# See Your Future, Change Your Future

> **Your future is not predicted. It is shaped.**

An AI-agent MVP that turns a student's personal data (calendar, notes, uploads) into an interactive, editable map of scenarios. Change a decision, and watch scenario likelihoods and the action plan update with transparent reasoning.

## Product overview

- Build a **Personal Brain** from calendar events, notes and documents.
- Generate an **Interactive Future Map**: decisions, opportunities, outcomes and risks with a *Scenario likelihood* (never a prediction).
- **Change a decision** (choose, reject, add time, move an event, mark an assumption wrong) and see the whole map re-score.
- Get a **plan**: three next actions, calendar blocks, one risk, one opportunity. Nothing is executed without confirmation.
- Privacy: *Your data is used only to build your personal scenario map.*

## Architecture

```
            Personal Data
                 ↓
        Cognee Personal Brain
                 ↓
      AWS Strands Future Navigator
              ↙       ↘
   Schedule Analysis   Bright Data Opportunities
              ↘       ↙
      Transparent Scenario Engine
                 ↓
        Interactive Future Map
                 ↓
        User Changes a Decision
                 ↓
   Updated Plan and Scenario Scores
```

- `backend/` FastAPI (port 8000, all routes under `/api`), Pydantic data contract, deterministic scoring engine in `app/scoring/engine.py`.
- `frontend/` Vite + React + TypeScript (port 5173, proxies `/api` to the backend). Ships bundled demo data and an identical scoring implementation in `src/utils/scoring.ts`, so the UI works with no backend and no keys.

## How Cognee is used

Cognee is the Personal Brain. Per user we create a dataset, `add` each source (calendar, notes, uploads), `cognify` it into a knowledge graph, then `search` for commitments, goals, interests, habits and constraints. Every derived attribute keeps `evidence_ids` and `source_ids` so the UI can link back to the record. User corrections ("this is wrong") are stored back as feedback. If Cognee is unavailable (no key, or the import fails on the host Python), a `DemoBrain` returns the same `PersonalProfile` shape from demo data (`brain_mode: "demo"`).

## How Strands is used

`FutureNavigatorAgent` (AWS Strands) orchestrates seven tools: profile lookup, schedule analysis, opportunity search, scenario generation, scoring, simulation and plan drafting. It returns **structured output** matching `FutureGraph` / `ActionPlan`. In demo mode the same orchestration runs as a plain Python path with no model calls, so the graph is deterministic and reproducible.

## How Bright Data is used

Opportunity discovery issues SERP / Web Unlocker requests for hackathons, internships, research programs and events, normalizes each result into an `Opportunity` (title, organization, deadline, url, relevance_score, relevance_reasons) and caches it. Without a key, a demo JSON cache is served (`is_demo: true`, source "Bright Data (demo cache)"). Only public web data is collected.

## How Docker is used

`docker compose up --build` runs the backend (python:3.12-slim + uvicorn) and the frontend (multi-stage node build, served by nginx with `/api/` proxied to the backend). Isolated parsing of uploaded files goes through `backend/app/utils/sandbox.py` (`SandboxRunner.run_python`), which runs a subprocess locally and is the abstraction point for swapping in **Docker Sandbox** (`docker sandbox run`) as an extension.

## Local setup

Backend:
```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```
Frontend:
```bash
cd frontend && npm install && npm run dev
```
Docker:
```bash
cp .env.example .env
docker compose up --build   # then open http://localhost:5173
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_MODE` | `true` | Use bundled demo data and mocks; no keys needed |
| `UPLOAD_MAX_MB` | `5` | Max upload size |
| `COGNEE_API_KEY`, `COGNEE_BASE_URL` | empty | Cognee Personal Brain |
| `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_DATASET_ID` | empty | Bright Data opportunity discovery |
| `AWS_REGION` | `us-west-2` | Strands / Bedrock region |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | empty | AWS credentials for Strands |
| `STRANDS_MODEL_ID` | `claude-sonnet-5` | Model used by the Strands agent |
| `ANTHROPIC_API_KEY` | empty | Alternative model provider for Strands |

## Demo mode

Default. Works with no backend and no keys: the frontend bundles the Sam Patel persona (10 calendar events, 5 notes, 6 opportunities, 14-node future graph) and scores locally. The backend serves the same data from JSON and mocks Cognee / Strands / Bright Data.

## API-key mode

Set `DEMO_MODE=false` and fill the keys in `.env`. Any integration that fails to import or authenticate falls back to its demo implementation independently, so the app never hard-fails.

## Scoring formula

`score = clamp(round(100 * Σ weight_i · value_i), 0, 100)` with values in 0..1.

| Factor | Weight |
|---|---|
| interest_alignment | +0.20 |
| goal_alignment | +0.20 |
| available_time | +0.15 |
| existing_preparation | +0.15 |
| deadline_feasibility | +0.10 |
| opportunity_relevance | +0.10 |
| user_commitment | +0.10 |
| schedule_conflict_penalty | -0.10 |
| workload_penalty | -0.10 |

Decision changes adjust the target node's factors and propagate to descendants (BFS). Schedule pressure: Low if average workload_penalty < 0.35, Medium < 0.6, else High. Implemented identically in `backend/app/scoring/engine.py` and `frontend/src/utils/scoring.ts`.

## Known limitations

- A Python 3.14 host may not install cognee / strands / brightdata-sdk; the app then runs in demo mode.
- Scores are transparent heuristics, not predictions.
- Opportunities are cached; live results depend on Bright Data availability.

## Responsible use

- No predictions: every score is labeled "Scenario likelihood" with its assumptions shown.
- No inference of sensitive traits (health, mental health, race, religion, orientation, politics, disability); neutral, evidence-based wording only.
- Every attribute links to its evidence and source, and can be corrected by the user.
- No external actions (calendar writes, applications, messages) without explicit confirmation.
- Only data the user uploads, or the bundled demo data, is used.
