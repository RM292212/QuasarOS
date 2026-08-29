# Control Plane Architecture

**File:** `docs/02-architecture/ControlPlaneArchitecture.md`  
**Status:** Normative

## Definition

The control plane manages identities, metadata, policy, orchestration, analysis requests, and access decisions. It does not carry normal high-volume brick traffic.

## Responsibilities

- Provider and product registry.
- Dataset catalog.
- Publication state.
- User authentication and authorization.
- Render-manifest discovery.
- Signed data-URL issuance.
- Observation search.
- Exact scientific queries.
- Analysis-job lifecycle.
- Provenance.
- Reproducibility exports.
- Configuration and feature capabilities.

## Core entities

- Provider.
- Product.
- Source asset.
- Dataset.
- Dataset version.
- Variable.
- Grid.
- Time axis.
- Observation platform.
- Profile.
- Render product.
- Processing run.
- Analysis job.
- Analysis result.
- Provenance record.
- Access policy.

## Publication lifecycle

    DISCOVERED
      → ACQUIRED
      → VALIDATING
      → VALIDATED
      → PROCESSING
      → READY
      → PUBLISHED

Failure states retain reports but remain undiscoverable to normal viewers. Reprocessing creates a new immutable product identity before catalog activation.

## Job lifecycle

    QUEUED → RUNNING → SUCCEEDED
                    ↘ FAILED
                    ↘ CANCELLED

Jobs contain:

- Input identities.
- Parameters.
- Requesting identity.
- Algorithm version.
- Resource class.
- Progress.
- Result reference.
- Error code.
- Creation and completion times.

## Access control

Authorization decisions consider:

- User or service identity.
- Role.
- Dataset licence/access class.
- Operation.
- Spatial or temporal restrictions.
- Export policy.
- Quota.

Signed URLs shall inherit the authorization scope and expire quickly.

## Consistency

- Metadata writes use database transactions.
- Published catalog pointers reference immutable products.
- Object assets are uploaded and validated before publication.
- Clients may use ETags for metadata consistency.
- Event consumers shall be idempotent.

## Availability

API replicas are stateless. Database, queue, and object-store dependencies expose readiness. If analysis workers fail, browsing and already-published visualization should remain available.

## Prohibited responsibilities

The control plane shall not:

- Stream every brick through FastAPI.
- Store multidimensional arrays in relational JSON fields.
- Execute long scientific jobs in request handlers.
- Infer scientific metadata during user requests.
- Expose unpublished products.

