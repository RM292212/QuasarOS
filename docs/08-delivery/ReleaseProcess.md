# ReleaseProcess.md

## Purpose

Define versioning, release preparation, approval, promotion, verification, and communication.

## Release types

- **Patch:** compatible fixes, security updates, and low-risk operational changes.
- **Minor:** backward-compatible features, new datasets, or additive APIs.
- **Major:** intentionally incompatible API, schema, or user-workflow changes.
- **Emergency:** expedited correction of an active severe incident.

Application versioning and scientific product versioning are independent. Releasing code must not silently change an existing scientific product.

## Preparation

1. Select the release commit.
2. Freeze breaking changes.
3. Confirm release notes and known limitations.
4. Verify generated clients and schemas.
5. Complete quality gates.
6. Review dependencies and vulnerabilities.
7. Review feature flags and defaults.
8. Rehearse database migration and rollback.
9. Verify backup freshness.
10. Build immutable artifacts.
11. Generate SBOM, signatures, and provenance.
12. Create the release candidate.

## Staging qualification

Deploy the release candidate unchanged to staging. Run:

- Database migration verification.
- P0 end-to-end journeys.
- Browser and renderer matrix.
- Accessibility checks.
- Scientific reference probes.
- Security smoke tests.
- Performance and memory comparison.
- Failure recovery tests.
- Operational alert and dashboard validation.

## Production promotion

1. Announce the release window.
2. Verify incident and rollback contacts.
3. Apply compatible migrations.
4. Deploy a limited canary.
5. Run synthetic and scientific smoke tests.
6. Observe one defined canary interval.
7. Increase traffic progressively.
8. Validate queue, database, storage, browser, and renderer metrics.
9. Mark release complete.
10. Publish release notes and monitoring annotation.

## Emergency release

Emergency releases may reduce test scope only with incident-commander approval. Unit, build, targeted regression, security scanning, smoke testing, artifact signing, and rollback planning remain mandatory. Deferred checks run immediately after stabilization.

## Release evidence

Retain commit, tag, image digests, schema revision, approvals, test reports, migration output, deployment timeline, monitoring snapshots, and rollback decision.

## Post-release

Monitor elevated signals through the defined observation period. Review support reports and scientific probes. Remove obsolete feature flags only in a later reviewed change.
