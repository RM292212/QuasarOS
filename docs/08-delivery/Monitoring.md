# Monitoring.md

## Purpose

Define monitoring for availability, performance, scientific integrity, security, and operational capacity.

## Signals

### Metrics

Collect:

- HTTP request count, latency, status, and route.
- Active requests and rate-limit decisions.
- Job submissions, queue depth, age, duration, retry, and failure.
- Database connections, query latency, locks, storage, and replication state.
- Object-store requests, latency, errors, and transferred bytes.
- Cache hit ratio and eviction.
- Worker CPU, memory, temporary disk, and cancellation.
- Dataset publication and validation failures.
- Browser startup, renderer selection, device/context loss, and asset failures.
- Brick fetch, decode, upload, and cache metrics.
- Exact-query and collocation latency.
- Backup freshness and restoration-test status.

Labels must be bounded. Dataset IDs, user IDs, URLs, and arbitrary errors are not metric labels.

### Logs

Use structured JSON with timestamp, severity, service, environment, release, trace ID, correlation ID, event name, and safe context. Never log tokens, cookies, secrets, unrestricted signed URLs, or full sensitive scientific requests.

### Traces

Trace API requests, database calls, object access, queue publication, jobs, and downstream processing. Propagate standard trace context across HTTP and queue boundaries.

## Service-level indicators

Track:

- Successful API availability.
- P95 API latency.
- Catalog query success.
- Exact-query success and latency.
- Asset delivery success.
- Job completion within expected duration.
- Time to first coarse volume from browser telemetry.
- Percentage of sessions with successful renderer initialization.

Targets are defined in environment-specific SLO configuration.

## Scientific integrity monitoring

Run scheduled synthetic probes that verify:

- Known catalog entries.
- Manifest and object checksums.
- Exact values at reference coordinates.
- Units and product versions.
- Observation profile retrieval.
- A fixed collocation result.
- WebGPU and WebGL 2 render-manifest decoding.

Scientific probe failure alerts even when ordinary availability remains healthy.

## Alert design

Alerts must be actionable and include severity, impact, dashboard, runbook, and owner. Use multi-window burn-rate alerts for SLOs where practical. Avoid paging on transient single-instance failures that orchestration handles safely.

## Dashboards

Provide service overview, API, workers, database, object storage, browser/rendering, data pipeline, scientific probes, security, and release dashboards.

## Retention

Retention follows operational, privacy, and audit requirements. High-cardinality debugging data uses shorter retention than incident and release evidence.

Reference:

- https://opentelemetry.io/docs/
