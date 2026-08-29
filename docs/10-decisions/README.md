# Architecture Decision Records

This directory contains Architecture Decision Records for QuasarOS.

ADRs document decisions that materially affect system structure, scientific correctness, rendering, storage, interoperability, deployment, or long-term maintenance.

## Index

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001-babylon-primary-renderer.md) | Babylon.js is the primary Volume Lab renderer | Accepted |
| [ADR-0002](ADR-0002-cesium-separate-workspace.md) | CesiumJS operates in a separate geographic workspace | Accepted |
| [ADR-0003](ADR-0003-webgl2-3d-fallback.md) | WebGL 2 is the required 3-D fallback | Accepted |
| [ADR-0004](ADR-0004-zarr-visualization-storage.md) | Zarr is used for visualization-ready multidimensional storage | Accepted |
| [ADR-0005](ADR-0005-netcdf-source-of-truth.md) | NetCDF is the scientific source of truth for gridded products | Accepted |
| [ADR-0006](ADR-0006-object-storage-data-plane.md) | Object storage is the scientific data plane | Accepted |
| [ADR-0007](ADR-0007-render-vs-scientific-values.md) | Render values and scientific values use separate authority paths | Accepted |

## ADR lifecycle

An ADR has one of these states:

- **Proposed:** under active review.
- **Accepted:** approved and normative.
- **Deprecated:** retained for history but no longer recommended.
- **Superseded:** replaced by a newer ADR.
- **Rejected:** considered but not adopted.

Accepted ADRs are not edited to reverse their decision. A new ADR supersedes the prior record. Minor corrections that do not alter meaning may be applied with an edit note.

## Required structure

Each ADR should contain:

1. Title and stable number.
2. Status.
3. Decision type and owners.
4. Context.
5. Decision.
6. Architectural boundaries.
7. Consequences.
8. Rejected alternatives.
9. Validation or compliance requirements.
10. Superseding or related ADR references where applicable.

## Numbering

ADR numbers are sequential and never reused. Filenames use:

`ADR-NNNN-short-kebab-case-title.md`

The title remains stable after acceptance.

## When an ADR is required

Create an ADR for:

- Renderer or framework selection.
- Data authority and storage-format choices.
- Public API or event versioning strategy.
- Significant package or service boundaries.
- Security trust-boundary decisions.
- Database or infrastructure architecture.
- Scientific approximation policies.
- Cross-backend compatibility policy.
- Decisions that are expensive to reverse.

Routine implementation details do not require an ADR unless they establish a durable cross-team constraint.

## Review

ADRs require architecture review and all applicable domain reviews. Scientific decisions require scientific-owner approval. Security and production-boundary decisions require security or platform approval.

Implementation tasks must reference applicable ADRs in their constraints and acceptance criteria.
