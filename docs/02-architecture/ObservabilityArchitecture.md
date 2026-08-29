# Observability Architecture

**File:** `docs/02-architecture/ObservabilityArchitecture.md`  
**Status:** Normative

## Objectives

Observability shall answer:

- Is the platform available?
- Is data current and valid?
- Where is latency introduced?
- Are jobs progressing?
- Are caches and GPU resources bounded?
- Which source, dataset, algorithm, and request produced a result?

## Signals

### Logs

Structured JSON logs include:

- Timestamp.
- Severity.
- Service and version.
- Environment.
- Request or correlation ID.
- Safe user or tenant identifier where permitted.
- Dataset, job, and product IDs.
- Event or error code.
- Duration.
- Outcome.

Secrets, signed URLs, raw authorization headers, and sensitive profile data are excluded.

### Metrics

Backend metrics include:

- Request count, latency, and status.
- Job queue depth and age.
- Job duration and failure.
- Provider acquisition failures.
- Validation failures.
- Database and object-storage latency.
- Signed-URL generation.
- Cache hit rate.
- Published-data freshness.

Browser metrics include:

- Renderer backend.
- Time to usable shell.
- Time to first volume.
- Frame-time percentiles.
- Long tasks.
- Brick download, decode, and upload time.
- CPU/GPU cache usage.
- Device/context loss.
- Failed requests.

### Traces

Distributed traces connect:

- Browser API request.
- API handler.
- Database query.
- Job creation.
- Worker execution.
- Object-storage access.
- Result publication.

Large brick traffic may use sampled tracing to control cost.

## Scientific provenance

Scientific operations additionally record:

- Source identity.
- Dataset version.
- Variables and units.
- Coordinate transformations.
- QC policy.
- Algorithm and version.
- Parameters.
- Result identity.

Provenance is durable product metadata, not temporary telemetry.

## Health endpoints

- Liveness: process responds.
- Readiness: required dependencies and configuration are available.
- Dependency diagnostics: restricted administrative access only.

## Alerts

Alert on:

- API error-rate increase.
- Queue age.
- Worker failure loops.
- Data freshness threshold.
- Publication validation failures.
- Object-storage errors.
- Database exhaustion.
- Persistent brick failure.
- Memory budget violations.
- Security events.

## Retention

Telemetry retention follows environment, privacy, and cost policy. Release benchmarks and scientific validation evidence are retained with the release artifacts.

