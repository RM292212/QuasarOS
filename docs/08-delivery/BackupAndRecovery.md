# BackupAndRecovery.md

## Purpose

Define backup, restoration, disaster-recovery, and verification requirements for QuasarOS control-plane data, scientific assets, configuration, and operational evidence.

## Recovery objectives

| Resource | Target RPO | Target RTO |
|---|---:|---:|
| PostgreSQL catalog, users, jobs, provenance | 15 minutes | 4 hours |
| Object-store manifests and derived products | 24 hours or deterministic regeneration | 12 hours |
| Source scientific assets | According to source policy; never assume regeneration | 24 hours |
| Infrastructure and deployment configuration | Last merged revision | 4 hours |
| Secrets and encryption metadata | Provider-defined protected backup | 4 hours |
| Monitoring configuration | Last merged revision | 8 hours |

Stricter contractual targets override this table.

## PostgreSQL

Production PostgreSQL requires:

- Automated encrypted base backups.
- Continuous WAL archiving for point-in-time recovery.
- At least 30 days of recovery points.
- Cross-zone storage and a separately controlled recovery copy.
- Backup encryption with keys independent of database credentials.
- Automated backup-integrity checks.
- Monthly point-in-time restoration exercises.

A successful backup job does not prove recoverability. Restoration must be tested into an isolated environment, migrations applied, and catalog integrity queries executed.

## Object storage

Enable:

- Bucket versioning.
- Server-side encryption.
- Lifecycle policies.
- Deletion protection for source and published scientific products.
- Cross-region or independent-account replication where required.
- Checksums for manifests, indexes, bricks, and downloadable products.

Immutable scientific objects are restored under their original versioned keys. Never overwrite a damaged published product in place. If an asset is regenerated, verify processor version, configuration, source checksums, and output checksums before catalog publication.

## Recovery procedure

1. Declare the recovery incident and appoint a recovery lead.
2. Determine the last known-good timestamp and affected resources.
3. Prevent writes to the damaged environment.
4. Create an isolated replacement environment from reviewed infrastructure code.
5. Restore PostgreSQL to the selected point.
6. Restore or reconnect object-storage versions.
7. Validate schema revision and migration state.
8. Reconcile catalog records with manifests and object checksums.
9. Rotate potentially exposed credentials.
10. run API, exact-query, renderer-manifest, and P0 smoke tests.
11. Reopen traffic gradually.
12. monitor error rates, lag, jobs, and scientific consistency.
13. Record actual RPO, RTO, data loss, and follow-up actions.

## Validation queries

Recovery verification must confirm:

- Catalog records reference existing immutable objects.
- Dataset and product versions remain stable.
- No published product points to temporary storage.
- Job state transitions are valid.
- Provenance links resolve.
- Spatial indexes and constraints are healthy.
- Authentication and authorization operate correctly.
- Exact-value queries match recorded reference cases.

## Test cadence

- Daily: backup completion and WAL archive monitoring.
- Weekly: automated restore into an ephemeral environment.
- Monthly: reviewed application-level restore test.
- Quarterly: complete disaster-recovery exercise.
- Annually: cross-region or independent-account recovery exercise.

References:

- https://www.postgresql.org/docs/current/backup.html
- https://www.postgresql.org/docs/current/continuous-archiving.html
