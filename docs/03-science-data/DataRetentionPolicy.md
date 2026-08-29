# Data Retention Policy

**File:** `docs/03-science-data/DataRetentionPolicy.md`  
**Status:** Normative

## Data classes

### Authoritative source assets

Retain according to provider terms, reproducibility requirements, storage policy, and checksum identity.

### Canonical scientific products

Retain while any published dataset, derived product, analysis result, or reproducibility record depends on them.

### Rendering products

Regenerable rendering products may use shorter retention, but a published product shall not be deleted while referenced by an active catalog entry.

### Temporary processing assets

Delete after successful publication or failed-job cleanup, subject to a short troubleshooting window.

### Analysis results

Retain according to deployment policy, user role, sensitivity, and reproducibility requirements.

### Logs and telemetry

Retain only for the documented operational, security, and audit period.

## Lifecycle states

- `ACTIVE`
- `SUPERSEDED`
- `ARCHIVED`
- `QUARANTINED`
- `PENDING_DELETION`
- `DELETED`

Superseded data remain addressable when required for reproducibility.

## Deletion safeguards

Before deletion, verify:

- No active catalog reference exists.
- No retained derived product depends on the asset.
- No legal, scientific, audit, or incident hold applies.
- Licence requirements are respected.
- Required provenance remains available.
- Backups follow the same eventual deletion policy.

## Source replacement

A changed upstream file shall create a new source identity when checksum or scientific content changes. Existing analyses shall not silently point to the replacement.

## User-generated records

Saved views and analysis outputs shall have visible retention rules. Users shall be warned before expiration where practical.

## Sensitive data

Restricted or personal data shall use the shortest justified retention and stricter access controls. QuasarOS shall not retain provider credentials in scientific-data records.

## Audit

Deletion operations record:

- Asset identity.
- Reason.
- Requesting identity.
- Approval where required.
- Timestamp.
- Dependency check.
- Deletion outcome.
