# OperationsRunbook.md

## Purpose

Provide first-response procedures for common QuasarOS operational symptoms.

## Initial triage

For every alert:

1. Acknowledge the alert.
2. Confirm environment and release.
3. Determine user and scientific impact.
4. Check recent deployments, migrations, flags, and data publications.
5. Open the service overview dashboard.
6. Capture correlation IDs and timestamps.
7. Declare an incident if thresholds are met.
8. Prefer reversible mitigation over speculative repair.

## API unavailable or elevated 5xx

- Check ingress, readiness, replica count, and deployment status.
- Compare failures by route and release.
- Verify database, queue/cache, identity, and object-storage connectivity.
- Check connection-pool saturation and memory limits.
- Remove unhealthy replicas from service.
- Roll back the application if failures correlate with deployment.
- Do not retry non-idempotent requests manually without checking persisted state.

## High API latency

- Inspect route-level p95 and p99 latency.
- Check database slow queries, locks, and connection count.
- Check object-store latency and cache hit ratio.
- Verify request and worker saturation.
- Scale only after identifying the constrained resource.
- Disable expensive optional features through approved flags if necessary.

## Queue backlog

- Check oldest-message age and failure class.
- Verify worker readiness and resource saturation.
- Confirm queue connectivity.
- Scale the appropriate worker class.
- Pause producers if downstream capacity is unsafe.
- Quarantine poison messages; do not discard them without recording provenance.
- Verify duplicate delivery remains idempotent.

## Database saturation

- Identify long-running transactions and blocking locks.
- Check migration or backfill activity.
- Stop the responsible noncritical job.
- Reduce worker concurrency.
- Do not terminate unknown sessions without incident-command approval.
- Fail over only under the managed database procedure.

## Missing or corrupt scientific asset

- Remove the affected product from public visibility.
- Preserve the object and logs for diagnosis.
- Validate manifest, checksum, product version, and storage history.
- Restore an immutable previous object version or republish a corrected product version.
- Run reference scientific probes before re-enabling.

## Renderer failures

- Determine browser, GPU, renderer, and release.
- Check asset delivery and shader errors.
- Verify WebGPU-to-WebGL fallback.
- Disable the affected backend through an operational flag only if fallback is valid.
- Preserve diagnostics; never claim scientific equivalence without conformance checks.

## Backup alert

- Verify the last successful base backup and WAL archive point.
- Escalate immediately if the RPO is at risk.
- Do not delete older backups during investigation.
- Run an isolated restore test after correcting the backup path.

## Closure

Record cause, mitigation, validation, user impact, follow-up owner, and whether incident review is required.
