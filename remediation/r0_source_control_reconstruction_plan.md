# Remediation Wave R0: Source Control Reconstruction Plan

## Objective
To safely stage and commit all verified artifacts, source code, and documentation discovered during `FORENSIC-AUDIT-01` into logical, reviewable commits, leading up to a `v1.1.0-rc.1` tag.

## 1. Files to Ignore (`.gitignore` update)
The following directories and files must be explicitly ignored to prevent repository bloat and credential leaks:
- **Python environments & caches**: `.venv/`, `__pycache__/`, `.pytest_cache/`, `*.pyc`, `.coverage`
- **Node.js environments & builds**: `node_modules/`, `dist/`, `build/`, `.next/`
- **Local data and temporary files**: `scratch/`, `data/` (unless for small fixtures), `*.nc` (outside fixtures), local `.zarr` stores (outside fixtures)
- **IDE/OS files**: `.vscode/`, `.idea/`, `.DS_Store`
- **Secrets & Environment**: `.env`, `.env.local`

## 2. Logical Commit Plan

### Commit 1: Repository Configuration and Ignores
- **Files**: `.gitignore` (updated)
- **Description**: Establish correct ignore patterns for Python/Node environments, data directories, and caches.

### Commit 2: Architectural and Science Documentation Updates
- **Files**: `docs/` (modifications and untracked), `audit/`, `*.md` (root reports), `*.json` (manifests/reports at root)
- **Description**: Commit forensic audit reports, closure documentation, task final reports, and updated science contracts (APIContracts, GridTopology, ObservationModel, etc.).

### Commit 3: Shared Schemas and Contracts
- **Files**: `schemas/`, `packages/`
- **Description**: Baseline the canonical data models, JSON schemas, and any shared TypeScript/Python contracts used across the stack.

### Commit 4: Scientific Backend and Ingestion Scripts
- **Files**: `scripts/`, `examples/`
- **Description**: Commit data ingestion pipelines, multiresolution bricking generators, TEOS-10 scientific calculators, and backend analysis engine files (e.g., `analysis_engine.py`, `collocation_engine.py`).

### Commit 5: Web Application Shell and Renderers
- **Files**: `apps/web/`
- **Description**: Commit the React frontend, WebGPU/WebGL2 volume rendering logic, state stores, and unmounted UI components (transects, T-S diagrams).

### Commit 6: Test Suite and Analytical Fixtures
- **Files**: `tests/`
- **Description**: Commit all test cases (399 Python + client + runtime + renderer tests) and real-data subvolume fixtures (`tests/fixtures/real_data/`, `tests/fixtures/manifests/`).

## 3. Execution Strategy
Wait for Orchestrator approval. Once authorized:
1. Apply the ignores.
2. Stage and commit in the numbered sequence above.
3. Apply the `v1.1.0-rc.1` tag to mark the stable staging milestone as defined by FORENSIC-AUDIT-01.
