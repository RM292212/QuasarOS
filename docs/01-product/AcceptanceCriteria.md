# Acceptance Criteria

**Document:** `docs/01-product/AcceptanceCriteria.md`  
**Status:** Normative release contract

## 1. Acceptance policy

QuasarOceanScope V1 is accepted only when all P0 criteria pass and every waived P1 criterion has:

- A documented reason.
- An identified owner.
- A risk assessment.
- A target milestone.
- Product and scientific approval.

Passing UI demonstrations alone is insufficient. Acceptance requires machine-readable test results and retained evidence.

## 2. Environment record

Every acceptance run shall record:

- Source commit and build identifier.
- Application and schema versions.
- Browser and browser version.
- Operating system.
- CPU, memory, GPU, and driver where available.
- Renderer backend.
- Viewport and device-pixel ratio.
- Dataset manifest version and checksums.
- Network profile.
- Cache state.
- Quality profile.
- Date and operator or CI identity.

## 3. AC-01 — Reproducible bootstrap

### Given

A clean supported development environment with valid source credentials where required.

### When

The documented bootstrap procedure is executed twice.

### Then

- Mandatory services start successfully.
- Pinned real datasets are acquired or reused.
- Checksums are verified.
- Processing outputs are generated.
- Catalog entries are published only after validation.
- The second run is idempotent.
- No duplicate dataset identities or corrupt products are created.
- A machine-readable bootstrap report is produced.

## 4. AC-02 — Catalog integrity

A published V1 dataset shall expose:

- Provider and product.
- Dataset identity and version.
- Licence and attribution.
- Spatial and temporal coverage.
- Variables and dimensions.
- Units and standard names where available.
- Grid and vertical-coordinate classification.
- Processing and provenance identity.
- Available rendering products.

Metadata shall match the pinned source and processing records.

## 5. AC-03 — WebGPU volume workflow

On a supported WebGPU reference device:

1. Open the V1 model dataset.
2. Select temperature.
3. Open the Scientific Volume Lab.
4. Observe a coarse 3-D result before full refinement.
5. Rotate and zoom.
6. Change the transfer function.
7. Apply a depth range and clipping plane.
8. Select another time.
9. Inspect an exact value.

Acceptance requires:

- No uncaught application or shader errors.
- Correct renderer badge.
- Progressive refinement.
- Bounded cache behavior.
- Correct units and time.
- Exact value matching the canonical query reference within tolerance.

## 6. AC-04 — WebGL 2.0 fallback workflow

With WebGPU disabled or unavailable:

- The application selects WebGL 2.0.
- The same dataset and variable can be opened.
- The view remains 3-D.
- Volume rendering, transfer functions, clipping, time selection, observation overlays, and exact inspection work.
- Reduced quality is disclosed.
- No 2-D-only replacement is used.
- Scientific query values match the WebGPU workflow.

## 7. AC-05 — Scientific scalar correctness

For pinned validation locations and times:

- Canonical temperature and salinity values match independently read source-derived references.
- Units and conversions match the data model.
- Fill values and invalid masks produce no valid result.
- Land and below-seabed cells are not rendered as water values.
- Quantized GPU values are not labelled exact.
- Interpolation method and tolerance are documented.

## 8. AC-06 — Rendering analytical correctness

Analytical renderer scenes shall verify:

- Constant scalar field.
- Monotonic gradient.
- Thin layer.
- Masked subvolume.
- Land/seabed intersection.
- LOD transition.
- Transfer-function empty region.
- Early termination.
- Variable step-size opacity correction.

WebGPU and WebGL2 results shall satisfy the approved probe-value and image-comparison tolerances.

## 9. AC-07 — Progressive streaming

For the V1 benchmark scene:

- The first visible result uses available coarse data.
- Visible bricks receive higher priority than hidden bricks.
- Camera movement cancels or deprioritizes obsolete requests.
- Missing high-resolution bricks do not become zero-valued data.
- Cache use does not exceed configured limits beyond documented transient allowance.
- Time switching does not display bricks from the wrong time step.
- Refinement state is visible.

## 10. AC-08 — Time semantics

The UI and APIs shall correctly identify:

- Model reference time.
- Forecast lead or period where applicable.
- Valid time.
- Observation time.
- Climatology period.
- Ingestion time.
- Processing time.

A test shall prove that changing valid time retrieves the correct model field and does not relabel reference time as valid time.

## 11. AC-09 — Argo profile integrity

For the pinned Argo profile:

- Platform identifier and cycle match the source.
- Position and observation time match the source.
- Pressure, temperature, salinity, adjusted values, data modes, and QC flags are preserved where present.
- The selected QC policy is visible.
- Rejected levels do not contribute to statistics.
- Profile values match independent source reading within tolerance.

## 12. AC-10 — Model-observation comparison

For a pinned collocation case:

- The selected model product and time are recorded.
- Spatial and temporal separations are reported.
- Vertical interpolation is performed only within valid coverage.
- Units are compatible.
- Residual uses the documented sign convention.
- Valid-pair count, bias, MAE, and RMSE match an independent reference implementation within tolerance.
- Changing QC policy updates valid pairs and metrics.
- Provenance is exportable.

## 13. AC-11 — Bathymetry and vertical exaggeration

- GEBCO or the approved bathymetry source is attributed.
- Bathymetry is represented as terrain or seabed geometry.
- Volume rays do not accumulate ocean scalar values below the seabed.
- Vertical exaggeration is visibly displayed.
- Inspector depth remains the true scientific depth.
- Changing exaggeration does not change exact queried values.

## 14. AC-12 — Current visualization

- Current component basis and units are visible.
- Derived speed matches the approved formula.
- Directional visualization follows the transformed vector basis.
- Changing particle or glyph density does not alter vector values.
- Vertical display scaling is identified separately.

## 15. AC-13 — Reproducibility export

The export shall contain:

- Schema version.
- Application version.
- Dataset and product identifiers.
- Source or processing version.
- Variable and units.
- Time selection.
- ROI and depth range.
- Camera and clipping configuration.
- Transfer function.
- Renderer and quality profile.
- QC policy.
- Derivation and collocation settings.
- Analysis results where applicable.

The export shall contain no credentials, bearer tokens, cookies, or signed object-storage URLs.

## 16. AC-14 — Failure recovery

Acceptance scenarios shall include:

- One failed brick request.
- Complete temporary network loss.
- Invalid or expired signed URL.
- Backend analysis failure.
- WebGPU device loss or WebGL context loss.
- Invalid source metadata.
- Insufficient model-observation overlap.

The application shall preserve valid state, avoid displaying corrupt values, provide a specific error, and offer recovery where possible.

## 17. AC-15 — Performance

The benchmark report shall demonstrate:

- Time to application usability.
- Time to first coarse volume.
- Time to target refinement.
- Median, p95, and p99 frame time.
- Main-thread long tasks.
- CPU memory.
- GPU memory estimate or tracked allocations.
- Network bytes.
- Brick-cache hit rate.
- Time-step switching behavior.
- Exact query and collocation latency.

Targets are defined in `V1Requirements.md`. Any exception requires release approval and shall not be hidden.

## 18. AC-16 — Memory and resource lifecycle

After repeated dataset, variable, time, and workspace changes:

- GPU resources from abandoned scenes are released.
- Worker tasks are cancelled or completed.
- Event listeners do not grow without bound.
- CPU and GPU caches return to configured steady-state budgets.
- No persistent increase exceeds the approved leak threshold.
- Context-loss recovery does not duplicate active resources.

## 19. AC-17 — Accessibility

The essential V1 journey shall pass:

- Keyboard-only navigation.
- Visible focus.
- Accessible names and labels.
- Logical heading and landmark structure.
- Contrast requirements.
- Reduced-motion behavior.
- Non-color status indicators.
- Chart data alternative.
- Status announcements for loading and errors.
- Automated accessibility checks plus manual review.

## 20. AC-18 — Security

Acceptance shall verify:

- Authentication and authorization where enabled.
- API input validation.
- SQL-injection resistance.
- Path and archive traversal protection.
- CORS and CSP policy.
- Signed URL scope and expiration.
- Rate and size limits.
- Secret scanning.
- Dependency and image scanning.
- No sensitive information in exports or client logs.

## 21. AC-19 — Browser compatibility

The supported-browser matrix shall complete the defined journeys. Capability differences shall select documented quality profiles rather than producing incorrect output.

At minimum:

- WebGPU path on current stable Chrome or Edge on a supported platform.
- WebGL2 path on current stable Chrome, Edge, Firefox, and Safari where WebGL2 is available.
- Unsupported-path guidance for devices that meet neither backend requirement.

## 22. AC-20 — Documentation and evidence

Release evidence shall include:

- Test reports.
- Scientific comparison tables.
- Benchmark reports.
- Browser matrix.
- Accessibility report.
- Security report.
- Dataset manifests and checksums.
- Screenshots or recordings of mandatory journeys.
- Known limitations.
- Licence and attribution review.
- Release decision and approvals.

## 23. Definition of accepted V1

V1 is accepted when:

1. All P0 requirements are implemented.
2. All mandatory acceptance criteria pass.
3. No unresolved critical scientific, security, accessibility, or data-integrity defect exists.
4. WebGPU and WebGL2 both complete the essential workflow.
5. Release evidence is attached to the release commit.
6. Known limitations are accurate and publicly documented.

