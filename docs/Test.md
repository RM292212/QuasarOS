# QuasarOS Verification and Test Specification

## 1. Objective

Testing must prove:

- Scientific correctness.
- Rendering correctness.
- WebGPU/WebGL 2 parity.
- Data-source authenticity.
- API correctness.
- performance.
- bounded memory.
- browser compatibility.
- security.
- accessibility.
- deployment readiness.

A visually plausible screenshot is not sufficient evidence.

## 2. Test layers

```text
Static checks
    ↓
Unit tests
    ↓
Component tests
    ↓
Contract tests
    ↓
Integration tests
    ↓
Scientific validation
    ↓
Renderer conformance
    ↓
End-to-end tests
    ↓
Performance and memory
    ↓
Release qualification
```

## 3. Static checks

Required:

- TypeScript type checking.
- Python type/static checks where configured.
- linting.
- formatting.
- dependency checks.
- secret scanning.
- schema validation.
- shader compilation checks.
- documentation link checks where practical.

## 4. Unit tests

### Domain

Test:

- Time conversion.
- forecast valid-time calculation.
- ROI normalization.
- depth-range handling.
- unit conversion.
- transfer-function interpolation.
- QC normalization.
- dataset/variable identity.
- error classification.

### Rendering mathematics

Test:

- Ray-box intersection.
- ray-plane intersection.
- coordinate transformations.
- front-to-back compositing.
- opacity correction.
- brick addressing.
- page-table encoding.
- LOD selection.
- DDA traversal.
- interpolation.
- occupancy-mask intersection.
- clipping.

Analytical synthetic fields are allowed only here and must be clearly marked as test fixtures.

### Scientific calculations

Test:

- Current speed.
- bias.
- RMSE.
- anomaly alignment.
- pressure/depth conversion.
- TEOS-10 calculations.
- density.
- sound speed.
- valid-mask propagation.

Compare against trusted Python/reference libraries.

## 5. Data-source tests

For every approved source adapter:

- Endpoint/configuration validation.
- authentication failure behavior.
- discovery.
- expected product identity.
- expected variables.
- coordinate discovery.
- units.
- dimensions.
- time decoding.
- missing values.
- download retry.
- partial-download handling.
- source-change detection.

Network-dependent tests must be separated from deterministic CI tests.

## 6. Real bootstrap-data tests

Pinned real subsets must validate:

- Provider.
- product ID.
- local checksum.
- geographic bounds.
- time bounds.
- depth bounds.
- variable availability.
- units.
- nonzero valid count.
- expected missing/land cells.
- canonical transformation.
- rendering-product generation.
- provenance.

No test may silently replace unavailable real data with synthetic data.

## 7. Ingestion tests

Test:

- Idempotent rerun.
- interrupted processing recovery.
- corrupt NetCDF.
- missing coordinate variable.
- unsupported calendar.
- unexpected dimension order.
- fill values.
- scale/offset.
- curvilinear coordinates.
- staggered variables.
- sigma-coordinate rejection or support.
- publication only after validation.
- lineage creation.

## 8. API contract tests

Validate:

- OpenAPI schema.
- request validation.
- response validation.
- stable error codes.
- pagination.
- spatial filters.
- temporal filters.
- depth filters.
- authorization.
- cancellation.
- signed URL behavior.
- private-data access denial.
- analysis-job state transitions.

Frontend and backend must test against the same schemas.

## 9. Renderer analytical tests

Use fields with known results:

- Constant scalar.
- linear x/y/z gradient.
- spherical scalar field.
- thin horizontal layer.
- masked half-volume.
- empty volume.
- fully opaque slab.
- bathymetry-clipped field.
- multiple LOD boundary field.

Validate:

- Entry/exit points.
- sampled values.
- accumulated opacity.
- color.
- clipping.
- gradients.
- early termination.
- empty-space skipping.
- LOD fallback.
- no seams across brick halos.

## 10. WebGPU/WebGL 2 conformance

Render the same scene with:

- Same camera.
- same dataset.
- same viewport.
- same transfer function.
- same quality.
- same step definition.
- same clipping.
- same time.
- deterministic jitter configuration.

Compare:

- Probe values.
- ray entry/exit.
- opacity.
- image difference.
- SSIM or equivalent perceptual metric.
- visible brick selection.
- missing-data behavior.

Small backend-specific floating-point differences are acceptable only within declared tolerances.

## 11. Scientific-value tests

Exact queries must be tested against canonical arrays.

For selected known cells and interpolated points, validate:

- Longitude/latitude.
- true depth.
- time.
- source indices.
- source value.
- canonical value.
- interpolation result.
- units.
- validity.
- provenance.

The test must demonstrate that displayed quantization does not replace exact-query values.

## 12. Observation tests

For real Argo profiles, validate:

- WMO ID.
- cycle.
- direction.
- profile time.
- position.
- pressure.
- temperature.
- salinity.
- adjusted/raw values.
- QC.
- data mode.
- source file.

Test missing variables and irregular levels.

## 13. Collocation tests

Validate:

- Temporal matching.
- horizontal neighbour selection.
- vertical interpolation.
- depth/pressure handling.
- mask handling.
- QC policy.
- time and distance tolerances.
- bias.
- RMSE.
- no-valid-level result.
- provenance.

Compare results against an independent reference Python calculation.

## 14. UI tests

Test:

- Dataset selection.
- variable selection.
- unavailable-variable state.
- time selection.
- transfer-function editing.
- colorbar units.
- clipping.
- backend badge.
- observation selection.
- profile display.
- comparison display.
- metadata panel.
- error handling.
- progress/refinement.
- keyboard operation.
- responsive panel behavior.

## 15. End-to-end scenarios

### Scenario A — WebGPU temperature

1. Start services.
2. Load real bootstrap dataset.
3. Open Volume Lab.
4. Select temperature.
5. Select time and depth.
6. Wait for coarse volume.
7. Verify refinement.
8. inspect exact value.
9. change transfer function.
10. capture evidence.

### Scenario B — WebGL 2 fallback

1. Disable/unavailable WebGPU.
2. initialize WebGL 2.
3. load the same dataset.
4. verify full 3D rendering.
5. compare selected probes.
6. verify controls and observations.

### Scenario C — Argo comparison

1. Open overview.
2. select real Argo profile.
3. open profile.
4. request model collocation.
5. display model and observation.
6. verify QC and statistics.
7. verify provenance.

### Scenario D — Time playback

1. Select multiple valid times.
2. begin playback.
3. verify prefetch.
4. change time rapidly.
5. verify stale requests are canceled.
6. verify memory remains bounded.

### Scenario E — Failure recovery

1. Simulate failed brick.
2. verify coarse fallback.
3. retry.
4. simulate GPU context/device loss.
5. verify state restoration or clear fallback.

## 16. Performance tests

Every benchmark records:

- Commit.
- build mode.
- browser/version.
- OS.
- CPU.
- GPU.
- viewport.
- dataset.
- brick shape.
- precision.
- active features.
- cache state.
- renderer backend.

Measure:

- Time to application interactive.
- time to first coarse volume.
- time to selected refinement threshold.
- median frame time.
- p95 frame time.
- p99 frame time.
- main-thread blocking.
- Worker decode time.
- upload time.
- network bytes.
- cache hit rate.
- GPU working set.
- CPU memory.
- dropped animation frames.

Do not report only average FPS.

## 17. Initial performance budgets

These are V1 engineering targets and must be refined with measured hardware classes.

### Recommended desktop, WebGPU

- Interactive median frame time: no more than 16.7 ms for target scenes.
- Dense/high-quality median frame time: no more than 25 ms.
- p95 interactive frame time: no more than 25 ms.
- No routine main-thread task over 50 ms.
- GPU cache bounded by configured adapter budget.

### Recommended desktop, WebGL 2

- Interactive median frame time: no more than 33.3 ms.
- No loss of required 3D functionality.
- Quality reduction must be visible and documented.

### Data

- First useful image must not require the full highest-resolution volume.
- ROI changes must prioritize coarse visible bricks.
- Stale downloads must stop or be ignored.

These are target budgets, not claims of current performance.

## 18. Memory and leak tests

Repeat:

- Dataset changes.
- variable changes.
- time changes.
- workspace switches.
- backend recreation.
- profile selection.
- isosurface creation/destruction.

Verify:

- GPU resources are released.
- Worker count remains bounded.
- event listeners do not accumulate.
- caches obey budgets.
- object URLs are revoked.
- temporary buffers are collectable.
- no monotonic memory growth after settling.

## 19. Browser matrix

Minimum V1 testing:

- Current Chrome/Chromium.
- Current Edge.
- Current Firefox.
- Current Safari where the required APIs are available.

Test both:

- WebGPU path where supported.
- WebGL 2 path.

Also test:

- Integrated GPU class.
- discrete GPU class.
- context/device loss.
- lower texture-size limits.

## 20. Security tests

Test:

- Invalid filenames.
- path traversal.
- oversized metadata.
- decompression bombs.
- invalid Zarr metadata.
- malformed NetCDF.
- unauthorized object access.
- expired signed URLs.
- SQL injection.
- request-bound validation.
- analysis-job quotas.
- secret leakage.
- unsafe logs.
- CORS.
- content security policy.

## 21. Accessibility tests

Validate:

- Keyboard navigation.
- visible focus.
- labels.
- contrast.
- reduced motion.
- colorbar readability.
- non-color status indicators.
- chart summaries.
- zoom behavior.
- screen-reader access to primary controls.

## 22. Visual regression

Capture approved scenes for:

- Temperature volume.
- salinity volume.
- clipping.
- bathymetry.
- WebGL 2.
- WebGPU.
- Argo profile.
- comparison chart.
- loading state.
- error state.

Visual baselines must identify dataset, time, camera, and rendering settings.

## 23. Release gates

A release candidate must pass:

1. Static checks.
2. unit tests.
3. data-schema tests.
4. ingestion tests.
5. API contract tests.
6. scientific validation.
7. WebGPU/WebGL conformance.
8. end-to-end scenarios.
9. performance budgets or approved exceptions.
10. memory/leak tests.
11. browser matrix.
12. security tests.
13. accessibility checks.
14. data licence and attribution review.
15. fixture-exclusion check.
16. documentation review.

## 24. Test evidence

Store or publish:

- Test reports.
- benchmark reports.
- scientific comparison tables.
- browser recordings.
- screenshots.
- image-difference reports.
- memory profiles.
- source-data checksums.
- release-gate summary.

No release claim should rely exclusively on an agent’s written statement that testing was successful.

