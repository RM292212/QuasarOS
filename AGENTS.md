# QuasarOS Agent Instructions

This file defines mandatory instructions for every coding, review, testing, documentation, and orchestration agent working in the QuasarOS repository.

## 1. Required reading order

Before modifying code, every agent must read:

1. `README.md`
2. `docs/INDEX.md`
3. `docs/Plan.md`
4. `docs/Arc.md`
5. `docs/Tech.md`
6. Documents directly relevant to the assigned subsystem
7. `docs/Test.md`

An agent must not infer architecture exclusively from existing source code when the documentation specifies a different target architecture.

## 2. Governing principles

All work must preserve the following principles:

- Scientific correctness is more important than visual novelty.
- Performance optimizations must have documented error bounds.
- Authoritative values must remain separate from rendering values.
- Units must never be silently changed.
- Missing values must never be interpreted as physical zero.
- Observation QC must be retained.
- Time semantics must distinguish reference time, lead time, valid time, observation time, and ingestion time.
- WebGPU and WebGL 2 must remain valid 3D renderers.
- Large scientific arrays must not be represented as object-heavy JSON.
- Bulk scientific data must not be proxied through FastAPI unnecessarily.
- User-facing product data must come from approved real sources.
- Every derived product must preserve lineage.

## 3. Scope discipline

Agents must implement only their assigned scope.

Agents must not:

- Replace Babylon.js with Three.js.
- combine CesiumJS and Babylon.js in one GPU context.
- introduce TypeGPU into the production renderer without an approved decision.
- introduce Rust/WASM without benchmark evidence and approval.
- create a new custom binary format without a versioned specification.
- change canonical schemas without coordinating every consumer.
- add a second state-management framework.
- perform large numerical loops on the React render path.
- store large typed arrays in React component state.
- hardcode credentials, private URLs, or access tokens.
- invent operational data.
- silently fabricate missing metadata.
- use unapproved interpolation for scientific products.

If the task requires an architectural deviation, stop and report the issue instead of silently implementing a different architecture.

## 4. Task input contract

Every agent assignment must identify:

- Task identifier.
- Objective.
- Required reading.
- Allowed files or packages.
- Forbidden files or packages.
- Dependencies.
- Input contracts.
- Expected outputs.
- Acceptance criteria.
- Required tests.
- Required commands.
- Required artifacts.
- Handoff recipient.

If any item is missing and prevents safe implementation, the agent must report it as a blocker.

## 5. Task output contract

Every completed task must return:

- Summary of implementation.
- Files created.
- Files modified.
- Public interfaces added or changed.
- Data schemas added or changed.
- Assumptions.
- Tests added.
- Commands executed.
- Test results.
- Performance results, if relevant.
- Known limitations.
- Follow-up tasks.
- Breaking changes.
- Evidence artifacts.

A task is not complete merely because code compiles.

## 6. File ownership

Agents should receive exclusive ownership of a bounded file set.

General ownership boundaries:

- Architecture documents: architecture/orchestrator agent.
- Scientific schemas: scientific-data agent.
- API schema and backend contracts: backend-contract agent.
- WGSL shaders: WebGPU-renderer agent.
- GLSL shaders: WebGL2-renderer agent.
- Shared rendering mathematics: render-core agent.
- React UI: frontend agent.
- Cesium overview: geospatial agent.
- Data ingestion: ingestion agent.
- Scientific validation: validation agent.
- Integration files: integration agent.

Agents must not modify files outside their ownership unless the task explicitly permits it.

## 7. Dependency rules

Preferred dependency direction:

```text
UI
    ↓
application/domain interfaces
    ↓
data client and renderer interfaces
    ↓
backend APIs / rendering backends
```

Scientific-domain types must not depend on:

- React.
- Babylon.js.
- CesiumJS.
- Browser UI components.

Renderer-independent mathematics must not depend on a specific renderer unless unavoidable.

WebGPU and WebGL 2 implementations must depend on shared rendering contracts rather than on each other.

## 8. Scientific-data rules

Every dataset and variable must retain:

- Provider.
- Product identifier.
- Dataset identifier.
- Source URL or source reference.
- Version.
- Original variable name.
- Canonical variable identifier.
- Units.
- CF standard name where available.
- Dimensions.
- Grid topology.
- CRS/grid mapping.
- Vertical-coordinate definition.
- Time semantics.
- Missing-value definition.
- QC information.
- Uncertainty fields where available.
- Processing history.
- Licence and attribution requirements.

Do not convert unknown values into guessed metadata. Mark unavailable metadata explicitly.

## 9. Rendering rules

The primary rendering method is image-order volume ray casting with adaptive ray marching.

The production renderer must support:

- WebGPU through WGSL.
- WebGL 2 through GLSL ES 3.00.
- Front-to-back compositing.
- Step-size-corrected opacity.
- Early ray termination.
- Ocean-domain clipping.
- Bathymetry clipping.
- Brick-level empty-space skipping.
- Multiresolution fallback.
- Validity masks.
- Transfer-function-aware occupancy.
- Deterministic quality mode.
- Context/device-loss recovery.

Rendering code must not use the displayed color as the source for exact scientific values.

## 10. WebGPU/WebGL parity

Backend parity means equivalent scientific behavior, not identical implementation.

Both backends must use:

- The same coordinate transforms.
- The same transfer-function definition.
- The same clipping model.
- The same opacity correction.
- The same validity semantics.
- The same quality-level meaning.
- The same source metadata.

Backend-specific quality reductions are permitted only when documented and visible to the user.

## 11. Performance rules

Performance work must include measurement.

Every performance claim must record:

- Commit.
- Browser and version.
- Operating system.
- CPU.
- GPU.
- GPU driver where available.
- Viewport.
- Dataset.
- Brick size.
- Precision.
- Transfer function.
- Camera.
- Quality profile.
- Warm or cold cache.
- Median frame time.
- 95th- and 99th-percentile frame time.
- CPU and GPU memory where measurable.

Do not report FPS alone.

## 12. Real-data rules

User-facing development, screenshots, demos, and end-to-end acceptance tests must use approved real data.

Automated acquisition must:

- Use documented official endpoints.
- Respect licences and access restrictions.
- Support retries and resumption where possible.
- Verify expected metadata.
- Verify checksums when stable checksums are available.
- Record acquisition time and product version.
- Never commit secrets.

Synthetic analytical fixtures are allowed only for unit tests requiring exact ground truth.

## 13. Testing requirements

Every implementation task must add or update tests appropriate to its layer.

Minimum expectations:

- Domain logic: unit tests.
- API changes: schema and integration tests.
- Data ingestion: metadata, dimension, unit, and checksum tests.
- Rendering changes: analytical and image-conformance tests.
- UI changes: component and end-to-end tests.
- Performance-sensitive changes: benchmark comparison.
- Scientific algorithms: comparison with trusted reference implementation.

Tests must not be disabled to make a task pass.

## 14. Security rules

- No secrets in code, logs, documentation examples, or fixtures.
- Validate all external metadata and filenames.
- Prevent path traversal.
- Apply decompression and allocation limits.
- Validate requested spatial and temporal bounds.
- Limit analysis-job resource usage.
- Avoid dynamically executing source-provided code.
- Treat NetCDF, Zarr metadata, text files, and uploaded files as untrusted input.
- Use least-privilege service credentials.

## 15. Error-handling rules

Errors must be classified as:

- Validation error.
- Authentication/authorization error.
- Source unavailable.
- Dataset unavailable.
- Unsupported topology.
- Unsupported variable.
- Data corruption.
- Processing failure.
- GPU initialization failure.
- GPU context/device loss.
- Resource limit.
- Canceled/stale request.
- Internal error.

Errors must include a stable machine-readable code and a safe human-readable message.

## 16. Cancellation and stale work

Long operations must carry:

- Task ID.
- Dataset version.
- Scene version.
- Request priority.
- Cancellation signal.

When the user changes ROI, time, variable, or dataset:

- Stale network requests should be canceled.
- Stale Worker output must be rejected.
- Stale GPU uploads must not update the active page table.
- Stale backend jobs must be canceled where supported.

## 17. Documentation requirements

When implementation changes a public contract, update the corresponding canonical document in the same change.

Do not duplicate authoritative definitions across multiple documents. Link to the canonical definition.

## 18. Completion definition

A task is complete only when:

- Its acceptance criteria are satisfied.
- Required tests pass.
- Type checking passes.
- Linting passes.
- Relevant documentation is updated.
- No new secrets are introduced.
- Scientific assumptions are documented.
- Performance budgets remain satisfied or regressions are approved.
- The orchestrator receives a complete handoff.

