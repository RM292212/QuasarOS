# Rollback.md

## Purpose

Restore a known-good QuasarOS state when a deployment, migration, configuration, or scientific product causes unacceptable impact.

## Rollback principles

- Prefer traffic rollback to destructive data rollback.
- Preserve evidence before cleanup.
- Never assume database downgrade is safe.
- Immutable scientific assets are corrected by version change, not overwrite.
- Rollback decisions prioritize scientific correctness over availability.

## Application rollback

1. Declare rollback ownership.
2. Stop progressive rollout.
3. Record current and target artifact digests.
4. Confirm target compatibility with the current database schema and public configuration.
5. Route traffic to the previous healthy deployment.
6. Restore the compatible frontend entry point.
7. Verify API health and dependency checks.
8. Run P0 and scientific smoke tests.
9. Monitor errors, latency, queue depth, and browser telemetry.
10. Close or escalate the incident.

Do not rebuild the old version. Promote its previously signed immutable artifact.

## Database changes

Schema rollback is allowed only when the downgrade was tested and no newer data would be lost or misinterpreted. For expand-and-contract releases, leave additive schema in place and roll back application code.

If a destructive migration caused loss or corruption:

- Stop writes.
- Invoke backup and point-in-time recovery.
- Restore into an isolated environment first.
- Reconcile external object storage and jobs.
- Follow `BackupAndRecovery.md`.

## Configuration and feature flags

Use an approved operational flag to disable an isolated feature when doing so returns the system to a tested state. Record who changed the flag, reason, previous value, new value, and expiry. Flags do not replace artifact rollback for systemic failures.

## Scientific products

If a published product is incorrect:

1. Remove it from selection or mark it invalid.
2. Identify affected users, exports, and analyses.
3. Preserve the original version and provenance.
4. Publish a corrected new product version.
5. Rerun scientific validation.
6. Communicate impact and correction.

## Roll-forward

Prefer a roll-forward when stored data is already written in a new representation, downgrade is unsafe, or the correction is smaller and better understood than restoration.

## Completion

Rollback is complete only after user workflows, exact values, manifests, authentication, jobs, and monitoring are verified and a follow-up issue or incident review is assigned.
