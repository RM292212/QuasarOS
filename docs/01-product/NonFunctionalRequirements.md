# Non-Functional Requirements

**Document:** `docs/01-product/NonFunctionalRequirements.md`  
**Status:** Normative

## 1. Scientific integrity

- **NFR-SCI-001:** Canonical values shall remain distinguishable from rendering values.
- **NFR-SCI-002:** Unit conversion shall use documented, tested transformations.
- **NFR-SCI-003:** Coordinate conversion shall preserve source coordinate metadata and record transformations.
- **NFR-SCI-004:** Derived quantities shall be reproducible from declared inputs and algorithm versions.
- **NFR-SCI-005:** The application shall not infer unavailable scientific metadata without marking the inference.
- **NFR-SCI-006:** Missing or invalid values shall not participate in rendering or statistics as valid measurements.
- **NFR-SCI-007:** Numerical tolerances shall be defined per variable, representation, and operation.
- **NFR-SCI-008:** Scientific validation shall use independent reference calculations where practical.

## 2. Performance

- **NFR-PERF-001:** The application shall progressively render large datasets without requiring full-volume download.
- **NFR-PERF-002:** CPU and GPU caches shall enforce configurable hard or effective budgets.
- **NFR-PERF-003:** Interaction shall prioritize visible, coarse, and time-critical data.
- **NFR-PERF-004:** Obsolete requests shall be cancelled or deprioritized.
- **NFR-PERF-005:** Heavy decoding and scientific transformations shall not routinely block the browser main thread.
- **NFR-PERF-006:** Performance metrics shall include median, p95, and p99 where sufficient samples exist.
- **NFR-PERF-007:** Benchmark results shall identify hardware, browser, viewport, dataset, quality, and cache state.
- **NFR-PERF-008:** Dynamic resolution or sampling changes shall be disclosed through the active quality profile.
- **NFR-PERF-009:** Performance optimizations shall not change exact-query results.

## 3. Scalability

- **NFR-SCALE-001:** Browser memory consumption shall depend primarily on configured cache budgets, not total dataset size.
- **NFR-SCALE-002:** Object storage shall support independent scaling from API services.
- **NFR-SCALE-003:** Processing services shall support partitioned and resumable work.
- **NFR-SCALE-004:** Catalog and observation queries shall be paginated or spatially bounded.
- **NFR-SCALE-005:** The architecture shall support multiple model products without hard-coded provider logic in UI components.
- **NFR-SCALE-006:** New variables shall be introduced through registry and schema mechanisms.

## 4. Availability and resilience

- **NFR-REL-001:** Failure of one optional layer shall not terminate the entire application.
- **NFR-REL-002:** Partial brick failures shall permit lower-resolution fallback where available.
- **NFR-REL-003:** Device or context loss shall be detected and handled.
- **NFR-REL-004:** Retries shall use bounded backoff and shall respect cancellation.
- **NFR-REL-005:** Ingestion shall be idempotent for a pinned source and processing configuration.
- **NFR-REL-006:** Publication shall not expose partially validated datasets.
- **NFR-REL-007:** Services shall expose readiness and liveness information.
- **NFR-REL-008:** Persistent metadata and provenance shall be backed up according to deployment policy.

## 5. Compatibility

- **NFR-COMP-001:** The primary supported desktop browsers shall include current stable Chrome and Edge.
- **NFR-COMP-002:** WebGL 2.0 fallback shall be tested on current stable Firefox and Safari where platform support permits.
- **NFR-COMP-003:** WebGPU shall be capability-detected rather than assumed from browser identity.
- **NFR-COMP-004:** Required texture, buffer, and shader limits shall be checked before selecting a quality profile.
- **NFR-COMP-005:** Unsupported devices shall receive a clear explanation rather than a blank canvas.
- **NFR-COMP-006:** Touch input shall be supported for basic outreach navigation.
- **NFR-COMP-007:** The system shall not support WebGL 1.

## 6. Security and privacy

- **NFR-SEC-001:** All untrusted input shall be validated at service boundaries.
- **NFR-SEC-002:** Authentication and authorization shall be enforced server-side.
- **NFR-SEC-003:** Credentials and tokens shall not be included in source control, logs, URLs intended for sharing, or export artifacts.
- **NFR-SEC-004:** File acquisition and ingestion shall protect against path traversal, archive traversal, decompression bombs, and oversized metadata.
- **NFR-SEC-005:** Database operations shall use parameterized queries or approved ORM mechanisms.
- **NFR-SEC-006:** CORS and CSP shall follow deployment allowlists.
- **NFR-SEC-007:** Signed object URLs shall have bounded lifetime and scope.
- **NFR-SEC-008:** Logs shall avoid unnecessary personal or sensitive data.
- **NFR-SEC-009:** Dependencies and container images shall be scanned before release.
- **NFR-SEC-010:** Public deployments shall enforce rate and resource limits.

## 7. Accessibility

- **NFR-A11Y-001:** The application shall target WCAG 2.2 Level AA for applicable web interface components.
- **NFR-A11Y-002:** Essential workflows shall be keyboard operable.
- **NFR-A11Y-003:** Focus shall be visible and logically ordered.
- **NFR-A11Y-004:** Information shall not rely only on color.
- **NFR-A11Y-005:** Reduced-motion preferences shall be respected.
- **NFR-A11Y-006:** Charts and canvas content shall provide textual or tabular alternatives for essential information.
- **NFR-A11Y-007:** Status changes shall be announced without excessive interruption.
- **NFR-A11Y-008:** Touch targets and text sizing shall meet documented accessibility requirements.

## 8. Usability

- **NFR-USE-001:** The selected dataset, variable, time, units, and rendering status shall remain visible.
- **NFR-USE-002:** Destructive or expensive actions shall require clear intent.
- **NFR-USE-003:** Controls unavailable for scientific reasons shall explain the reason.
- **NFR-USE-004:** Operational and outreach modes shall use the same underlying scientific identities.
- **NFR-USE-005:** Errors shall provide a recommended next action where possible.
- **NFR-USE-006:** Loading states shall distinguish metadata loading, coarse rendering, refinement, analysis, and failure.
- **NFR-USE-007:** Users shall be able to reset the camera and visualization settings.

## 9. Maintainability

- **NFR-MAINT-001:** TypeScript production code shall use strict type checking.
- **NFR-MAINT-002:** Python production interfaces shall use validated schemas and type annotations.
- **NFR-MAINT-003:** Domain contracts shall not depend on React, Babylon.js, or CesiumJS.
- **NFR-MAINT-004:** WebGPU and WebGL2 shall implement a shared renderer-independent contract.
- **NFR-MAINT-005:** Architecture changes shall be documented before incompatible implementation changes.
- **NFR-MAINT-006:** Public API and export schemas shall be versioned.
- **NFR-MAINT-007:** Dependencies shall be pinned according to repository policy.
- **NFR-MAINT-008:** Dead feature flags and obsolete migrations shall be removed through planned maintenance.
- **NFR-MAINT-009:** Code ownership boundaries shall be respected.

## 10. Observability

- **NFR-OBS-001:** Services shall emit structured logs with correlation identifiers.
- **NFR-OBS-002:** Metrics shall cover request latency, errors, job duration, queue depth, storage failures, and cache behavior.
- **NFR-OBS-003:** Browser diagnostics shall record renderer, device limits, frame timing, cache usage, and failed requests without collecting unnecessary identifying information.
- **NFR-OBS-004:** Scientific jobs shall record source and algorithm provenance.
- **NFR-OBS-005:** Production error messages shown to users shall not expose stack traces or secrets.
- **NFR-OBS-006:** Benchmark and release evidence shall be retained with the associated commit.

## 11. Data governance and licensing

- **NFR-DATA-001:** Every published dataset shall identify provider, product, licence, and attribution.
- **NFR-DATA-002:** Access restrictions imposed by a provider shall be preserved.
- **NFR-DATA-003:** Cached or transformed products shall retain source attribution.
- **NFR-DATA-004:** Data retention shall comply with provider terms and deployment policy.
- **NFR-DATA-005:** Source replacement or version changes shall not silently alter previously recorded analyses.
- **NFR-DATA-006:** Checksums or equivalent immutable identities shall be used where source delivery permits.

## 12. Portability and deployment

- **NFR-DEP-001:** The development stack shall be reproducible using documented containerized services.
- **NFR-DEP-002:** Configuration shall be externalized from application binaries.
- **NFR-DEP-003:** Secrets shall use environment or secret-management facilities and shall not be committed.
- **NFR-DEP-004:** Object storage shall use an S3-compatible interface.
- **NFR-DEP-005:** Database migrations shall be versioned and reversible where practical.
- **NFR-DEP-006:** A deployment shall be able to use local MinIO or a managed S3-compatible service without changing domain logic.

## 13. Documentation

- **NFR-DOC-001:** Every externally visible feature shall be described in user or developer documentation.
- **NFR-DOC-002:** Scientific algorithms shall document formulas, assumptions, valid domains, and references.
- **NFR-DOC-003:** Provider adapters shall document access methods, licence constraints, and failure behavior.
- **NFR-DOC-004:** Release notes shall identify schema, data-source, rendering, and scientific changes.
- **NFR-DOC-005:** Documentation examples shall not contain credentials or imply unavailable source access.

