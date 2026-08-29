# Backend Implementation

**File:** `docs/05-implementation/BackendImplementation.md`  
**Status:** Normative

## Application layout

    apps/api/
      main.py
      routes/
      dependencies/
      middleware/
      schemas/
      services/
      repositories/
      security/
      settings/
      health/

Domain science shall remain in `python/` packages.

## Startup

Startup shall:

1. Validate configuration.
2. Initialize structured logging.
3. Connect to PostgreSQL.
4. Verify schema compatibility.
5. Initialize object-storage and queue clients.
6. Register routes.
7. Expose readiness only after mandatory dependencies pass.

## Route rules

Routes shall:

- Validate Pydantic request and response schemas.
- Call application services.
- Avoid direct SQL.
- Avoid scientific calculations.
- Avoid large file proxying.
- Propagate request and correlation IDs.
- Map domain exceptions through `ErrorHandling.md`.

## Service rules

Services coordinate:

- Authorization.
- Repositories.
- Scientific packages.
- Job submission.
- Provenance.
- Signed URLs.
- Transactions.

## API behavior

- Use `/api/v1`.
- Publish OpenAPI.
- Use cursor pagination.
- Enforce request-size and ROI limits.
- Accept idempotency keys for job creation.
- Support cancellation.
- Use ETags where resource consistency matters.
- Return UTC ISO 8601 timestamps.

## Dependency injection

Database sessions, authenticated identity, settings, repositories, storage, and queue clients shall be injected. Global mutable service state is prohibited.

## Async policy

Use async for network and database I/O. CPU-heavy xarray, NumPy, regridding, decoding, and scientific operations execute in workers rather than blocking API event loops.

## Health

- `/health/live`: process health.
- `/health/ready`: required dependency health.
- Detailed dependency diagnostics: administrator-only.

## Shutdown

Stop accepting new work, finish bounded requests, close clients, release database connections, flush telemetry, and terminate within the configured grace period.
