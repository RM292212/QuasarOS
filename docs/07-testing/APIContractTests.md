# APIContractTests.md

## Purpose

Verify that HTTP APIs, event payloads, signed asset requests, and generated clients remain compatible with the published contracts.

## Sources of truth

- Versioned OpenAPI document.
- JSON Schema event definitions.
- Shared domain schemas.
- Error model and pagination contract.
- Render-manifest and brick-index schemas.
- Authentication and authorization policy.

Generated schemas must not be edited manually.

## Required checks

### Schema validation

For every endpoint, validate:

- Path, query, header, and body parameters.
- Required and optional fields.
- String formats, enums, bounds, and nullability.
- Response status, headers, media type, and body.
- Structured errors for every declared failure.
- Rejection of malformed or unsupported values.
- Treatment of unknown fields according to the schema.

### Compatibility

Contract changes are classified as:

- **Patch:** descriptions, examples, or nonsemantic corrections.
- **Additive:** optional fields, new endpoints, or new enum handling with tolerant clients.
- **Breaking:** removed or renamed fields, stricter bounds, changed meaning, new required fields, or incompatible status behavior.

Breaking changes require a new API version or an approved migration period.

### Behavioral contracts

Tests cover:

- Cursor pagination stability and invalid cursors.
- Filtering, sorting, and spatial bounds.
- Conditional requests using `ETag` and `If-None-Match`.
- Range requests and immutable cache headers for scientific assets.
- Idempotency keys for job-creating requests.
- Cancellation and job-state transitions.
- Rate-limit response headers and retry guidance.
- Correlation IDs.
- Signed URL expiry, scope, and content binding.
- Authorization for anonymous, authenticated, administrative, and service identities.

### Scientific contracts

Exact-value, profile, collocation, and derived-field responses must include:

- Dataset and product version.
- Variable identifier and canonical units.
- Coordinates and coordinate reference information.
- Time and calendar semantics.
- QC or masking state.
- Method and interpolation metadata.
- Provenance identifiers.
- Explicit missing-value representation.

## Consumer tests

The TypeScript API client and supported automated clients run against a deterministic server fixture. Each client verifies decoding of current responses and graceful handling of additive fields. Backend tests verify that examples in the OpenAPI document are executable.

## Negative and property tests

Generate valid and invalid payloads around numeric limits, coordinate boundaries, temporal boundaries, empty collections, Unicode text, large filters, and unsupported media types. Randomized tests must be reproducible through recorded seeds.

## Release gate

CI fails when:

- Runtime behavior differs from the published schema.
- Generated clients contain uncommitted changes.
- A breaking change lacks versioning approval.
- An endpoint emits undocumented status codes or error shapes.
- Scientific provenance or units are omitted.
