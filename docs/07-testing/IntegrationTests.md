# IntegrationTests.md

## Purpose

Verify behavior across real component boundaries while keeping scenarios smaller and more diagnosable than end-to-end tests.

## Integration boundaries

- API and PostgreSQL/PostGIS.
- API and Redis or queue.
- API and object storage.
- API and identity provider.
- Worker and queue.
- Worker and scientific processing libraries.
- Catalog service and published manifests.
- Browser API client and live API.
- Render coordinator and browser data worker.
- Cesium or Babylon integration and shared application state.

## Environment

Integration tests use disposable containers or isolated namespaces. External public data services are replaced by recorded or local fixtures unless the test is explicitly marked `external`. Database migrations run from an empty database before tests begin.

## Required suites

### Catalog

- Dataset creation, filtering, spatial queries, version selection, and retirement.
- Transactional publication.
- Concurrent registration and duplicate prevention.

### Asset delivery

- Signed URL generation and expiry.
- Range requests, cache headers, content length, checksum, and media type.
- Permission boundaries between public and restricted products.

### Jobs

- Submission, idempotency, queue delivery, progress, cancellation, retry, and terminal states.
- Worker restart and duplicate message delivery.
- Persistence of provenance and error records.

### Observations and analysis

- Spatial and temporal discovery.
- Profile retrieval and QC filtering.
- Model-observation collocation.
- JSON and Arrow response equivalence.
- Dateline, depth-sign, and boundary cases.

### Rendering data path

- Manifest decoding.
- Brick index lookup.
- Fetch, decompression, validation, upload preparation, and cancellation.
- Generation handling so stale responses cannot enter the active scene.

## Isolation

Each test receives unique identifiers, schema or transaction isolation, storage prefix, and queue namespace. Tests may run in parallel and must clean up even after failure.

## Assertions

Integration tests verify persisted state, emitted events, API output, checksums, and resource cleanup. Mock only beyond the boundary being tested.

## Gate

All deterministic integration suites must pass on every merge. Flaky tests are treated as defects: quarantine requires an owner, issue, rationale, and expiry date.
