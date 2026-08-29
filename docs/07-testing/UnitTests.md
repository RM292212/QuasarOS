# UnitTests.md

## Purpose

Provide fast, deterministic verification of isolated behavior in frontend, backend, processing, and scientific packages.

## Frontend scope

Use Vitest and Testing Library for:

- Domain models and schema decoders.
- Unit formatting and conversion.
- Coordinate transforms.
- Timeline and transfer-function state.
- Dataset-selection reducers.
- Cache keys and LRU decisions.
- Request generation and cancellation.
- Generation-ID rejection of stale work.
- Accessibility semantics of controls.
- Error-state mapping.
- Reproducibility serialization and restoration.

Tests query rendered components by role, label, or visible text. Implementation-detail selectors and broad snapshots are discouraged.

## Backend scope

Use pytest for:

- API service rules.
- Authorization decisions.
- Pagination and filtering.
- Job state machines.
- Idempotency.
- Manifest construction.
- Object-key generation.
- Provenance records.
- Error mapping.
- Retry classification.
- Configuration validation.

I/O boundaries are replaced with narrow fakes or mocks. Tests of actual databases, queues, and storage belong in integration suites.

## Scientific scope

Use analytic arrays and independent expected values for:

- Unit conversion.
- Longitude wrapping.
- Depth and pressure handling.
- Time/calendar conversion.
- Interpolation.
- Gradients.
- Vector magnitude and direction.
- Statistical summaries.
- Collocation distance and time windows.
- Mask and QC propagation.
- Brick min/max and multiresolution aggregation.

Every numerical assertion declares an appropriate tolerance and unit.

## Test structure

Follow arrange, act, assert. Each test has one clear behavioral reason to fail. Parameterize meaningful cases rather than duplicating tests. Randomized tests record their seed and minimize failures when possible.

## Determinism

Unit tests must not depend on:

- Real network access.
- Uncontrolled current time.
- Execution order.
- Developer locale or timezone.
- Random values without a fixed seed.
- Machine-specific paths.
- GPU scheduling.

## Coverage policy

Changed critical logic requires direct tests. Branch coverage is emphasized for error paths, coordinate boundaries, authorization, masking, and job transitions. Coverage exclusions require an explanatory comment and review.
