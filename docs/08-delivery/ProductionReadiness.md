# ProductionReadiness.md

## Purpose

Define the checklist a service, feature, dataset integration, or renderer capability must satisfy before production use.

## Ownership

- Named engineering owner.
- Named operational escalation owner.
- Scientific owner for scientific behavior.
- Security and data-governance contacts where applicable.
- Current architecture and dependency documentation.

## Reliability

- Health, readiness, and startup behavior defined.
- Timeouts, retries, cancellation, and idempotency tested.
- Resource requests, limits, and scaling policy established.
- Failure modes and degraded behavior documented.
- Backup and restoration validated.
- Single points of failure reviewed.
- Capacity estimate and load test completed.
- Operational runbook published.

## Observability

- Structured logs contain correlation and release information.
- Metrics and traces cover critical boundaries.
- Dashboards exist.
- Alerts are actionable and tested.
- SLOs and error-budget policy are defined.
- Scientific integrity probes exist for data-facing behavior.
- Deployment annotations appear in dashboards.

## Security and privacy

- Threat model reviewed.
- Authentication and authorization tests pass.
- Least-privileged service identity configured.
- Secrets use the approved manager.
- Dependency, image, and infrastructure scans pass.
- Network policy and CORS policy reviewed.
- Data classification, retention, and logging policy documented.

## Scientific and data quality

- Units, coordinates, time, depth, masks, and QC semantics validated.
- Provenance is complete.
- Exact and approximate results are clearly distinguished.
- Real-data and analytic-reference tests pass.
- Dataset licensing and attribution are recorded.
- Product versioning and correction procedures are defined.
- WebGPU and WebGL 2 parity is demonstrated when rendering is involved.

## Delivery

- CI/CD gates are enforced.
- Database migration and rollback strategy reviewed.
- Feature-flag and emergency-disable behavior tested.
- Staging deployment completed.
- Browser, accessibility, and P0 end-to-end tests pass.
- Release and rollback procedures rehearsed.
- Documentation and user-facing limitations are current.

## Approval

Production readiness requires engineering, operations, product, and applicable scientific/security approval. Unresolved items must have an explicit risk acceptance, owner, compensating control, and expiry date. Scientific corruption risk, missing recovery capability, or absent authorization boundaries cannot be waived.
