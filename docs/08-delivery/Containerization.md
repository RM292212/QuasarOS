# Containerization.md

## Purpose

Define container-image construction, runtime behavior, security, and compatibility for QuasarOS services.

## Images

Maintain separate production images for:

- `web`: static frontend and approved reverse-proxy configuration.
- `api`: FastAPI application.
- `worker`: ingestion, processing, and analysis workers.
- `scheduler`: scheduled catalog and maintenance jobs.
- `migration`: database migration tooling.
- Optional observability or local-development dependencies use upstream pinned images.

The API, worker, scheduler, and migration images may share a reviewed base while retaining separate entry points.

## Build requirements

- Use multi-stage builds.
- Pin base images by digest.
- Copy only required runtime files.
- Install dependencies from lockfiles.
- Remove package-manager caches and build tools from runtime stages.
- Generate an SBOM.
- Scan for operating-system and language vulnerabilities.
- Attach source revision and build metadata as OCI labels.
- Produce multi-architecture images only after architecture-specific tests pass.

Scientific native libraries must use pinned, tested builds. Changing a compiler, BLAS implementation, or scientific dependency requires numerical regression testing.

## Runtime requirements

Containers must:

- Run as a non-root numeric user.
- Use a read-only root filesystem where practical.
- Write only to declared temporary or mounted paths.
- Handle `SIGTERM` and stop accepting new work before shutdown.
- Expose separate liveness and readiness endpoints.
- Emit structured logs to stdout or stderr.
- Avoid embedding secrets.
- Declare realistic CPU and memory requests and limits.
- Use a minimal init process when child-process reaping is required.

## Filesystem layout

| Path | Purpose |
|---|---|
| `/app` | Immutable application |
| `/tmp/quasar` | Bounded temporary files |
| `/config` | Read-only runtime configuration |
| `/var/run/quasar` | Optional runtime sockets or state |

Scientific source and generated products must use object storage, not container filesystems.

## Health behavior

- Liveness checks process health only.
- Readiness checks required dependencies and ability to serve new work.
- Startup checks allow migration, shader preparation, or model initialization without premature restarts.
- Workers report readiness only when they can accept their assigned resource class.

## Local orchestration

The local Compose profile includes web, API, worker, scheduler, PostgreSQL/PostGIS, Redis-compatible queue/cache, object storage, and mock identity services. Production configuration must not reuse development credentials or exposed ports.

## Image promotion

The same image digest moves from staging to production. Rebuilding an image for production is prohibited. Emergency fixes create a new digest and follow the expedited release process.
