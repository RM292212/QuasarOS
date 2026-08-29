# LocalDevelopment.md

## Purpose

Provide a repeatable local environment for frontend, backend, worker, data-pipeline, and renderer development.

## Prerequisites

- Git.
- Current project-supported Node.js release.
- Corepack and pnpm.
- Project-supported Python release.
- `uv`.
- Docker with Compose support.
- A browser supporting WebGL 2; WebGPU is recommended.
- Optional local GPU debugging tools.

Exact versions are defined by repository tool-version files and lockfiles.

## Initial setup

1. Clone the repository.
2. Copy `.env.example` to the local untracked environment file.
3. Run `corepack enable`.
4. Run `pnpm install --frozen-lockfile`.
5. Run `uv sync --all-groups`.
6. Start dependencies with `docker compose up -d postgres redis object-store identity`.
7. Apply migrations through the repository migration command.
8. Run the minimal or demo data bootstrap.
9. Start the API, worker, and frontend through repository scripts.
10. Open the local HTTPS or approved localhost URL.

Repository scripts are the source of truth; developers should not duplicate long commands in personal instructions.

## Local services

| Service | Purpose |
|---|---|
| PostgreSQL/PostGIS | Catalog, observations, jobs, provenance |
| Redis-compatible service | Queue, coordination, bounded cache |
| S3-compatible object store | Manifests, bricks, source fixtures |
| Mock OIDC provider | Local authentication |
| API | Metadata and scientific endpoints |
| Worker | Processing and analysis |
| Web | React, Cesium, and Babylon application |

## Development modes

- Frontend-only with deterministic API fixtures.
- Full-stack local.
- WebGPU renderer.
- Forced WebGL 2 fallback.
- Offline and network-failure simulation.
- Operational or Outreach mode.
- Minimal or demo dataset profile.

## Data safety

Local configuration must never point to production databases, queues, or writable production storage. Production credentials are not supported in local environment files.

## Common checks

Before opening a pull request, run:

- Formatting and linting.
- Type checking.
- Unit tests.
- Contract generation checks.
- Affected integration tests.
- Frontend build.
- P0 browser smoke test.

## Reset

The local reset command may delete local containers, volumes, and generated data only after displaying the targeted environment. It must refuse production-like hosts and credentials.
