# QuasarOS Orchestrator Directive — PROGRAM‑02: TASK‑12 Multivariable Expansion, TASK‑13 Scientific Analysis, and TASK‑14 Observation Fusion

## 1. Authorization

Continue from the existing QuasarOS orchestrator session and preserve all context, artifacts, reports, manifests, contracts, tests, and decisions produced by TASK‑01 through TASK‑11 and RELEASE‑01.

The reported baseline is:

`RELEASE‑01 COMPLETE — QUASAROS v1.0.0 VALIDATED AND DEPLOYED`

Authorize the following controlled program:

`RELEASE‑01F → TASK‑12A → TASK‑12B → TASK‑12C → TASK‑12D → TASK‑12E → TASK‑12F → TASK‑13A → TASK‑13B → TASK‑13C → TASK‑13D → TASK‑13E → TASK‑14A → TASK‑14B → TASK‑14C → TASK‑14D → TASK‑14E → PROGRAM‑02 FINAL VERIFICATION`

The primary objective is to evolve QuasarOS from a validated temperature-volume application into a multivariable scientific ocean analysis system while preserving scientific authority, reproducibility, security, browser performance, and the certified v1.0.0 baseline.

Do not overwrite or mutate QuasarOS v1.0.0. All expansion work must use new product versions, new manifests, new canonical paths, new visualization-product paths, and an isolated development release line.

Suggested development version:

`QuasarOS v1.1.0-dev`

Do not promote a new General Availability release until the complete PROGRAM‑02 final verification passes.

---

## 2. Immediate RELEASE‑01F Documentation Reconciliation

Before beginning TASK‑12, perform a short read-only reconciliation of the RELEASE‑01 closure documents.

Correct or resolve the following reported inconsistencies:

1. The TASK‑04 hierarchy is an anisotropic 2 × 2 horizontal LOD pyramid preserving all vertical levels, not a conventional octree.
2. Replace “Multiresolution Octree Bricks” wherever it incorrectly describes the frozen TASK‑04 product.
3. The closure report describes a “14-stage scientific lineage” but currently enumerates only eight visible stages. Either:
   - Enumerate and verify all 14 actual stages, or
   - Correct the claimed count.
4. Do not describe the current operational lineage as “raw multi-model ingestion” unless multiple models are genuinely active in that exact certified lineage.
5. Distinguish data-source inventory from operationally activated datasets.
6. Replace bare artifact filenames with complete repository-relative paths.
7. Preserve the authority terminology:
   `authoritative native-source value under ADR‑0005`.
8. Verify that “validated and deployed” is supported by actual deployment evidence:
   - Deployment environment.
   - Deployment identifier.
   - Deployment timestamp.
   - Public or controlled endpoint classification.
   - Smoke-test evidence.
   - Rollback evidence.
9. If actual deployment evidence does not exist, correct the status to:
   `VALIDATED AND READY FOR CONTROLLED DEPLOYMENT`.
10. Determine whether release manifests and tags are:
    - SHA‑256 checksummed.
    - Digitally signed.
    - Both.
    - Neither.
11. Do not call checksums signatures.
12. Preserve all original reports in version history. Make corrections transparently rather than concealing earlier wording.
13. Produce:
    `release_01f_closure_documentation_and_program_02_handoff_reconciliation_report.md`

Required status:

`RELEASE‑01F COMPLETE — PROGRAM‑02 PREFLIGHT READY`

Do not start TASK‑12 if RELEASE‑01F discovers an unresolved scientific, integrity, security, deployment, or reproducibility blocker.

---

## 3. Certified Baseline to Preserve

### 3.1 Active v1.0.0 scientific snapshot

Verify the exact values from repository artifacts:

- Product: `GLOBAL_ANALYSISFORECAST_PHY_001_024`
- Active variable: `thetao`
- Reported snapshot:
  `copernicus-phy-thetao-20260824-20260830-ca826087`
- Native-source SHA‑256:
  `ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c`
- Temporal coverage: 2026‑08‑24 through 2026‑08‑30.
- Horizontal domain: 60°E–68°E and 0°N–15°N.
- Geographic description: western tropical Indian Ocean / southern Arabian Sea.
- Current depth subset: approximately 0.494 m through 453.938 m.
- Current vertical levels: 31 non-uniform levels.
- Current shape: 7 × 31 × 181 × 97.
- Total voxels: 3,809,869.
- Valid ocean voxels: 3,618,944.
- Masked/missing voxels: 190,925.

### 3.2 Frozen v1.0.0 architecture

Preserve:

- Native NetCDF‑4 authority under ADR‑0005.
- Lossless canonical Zarr representation.
- Approximate visualization bricks.
- 64 × 64 × 32 brick core for the existing product.
- 1 × 1 × 0 halo.
- Anisotropic 2 × 2 horizontal hierarchy.
- Float16 primary representation.
- Uint16 affine fallback.
- Symbolic validity-mask semantics.
- Five-link SHA‑256 trust chain.
- Exact-value and profile queries reading the native source rather than visualization bricks.
- Browser checksum verification.
- Web Worker decompression.
- Renderer-independent runtime.
- WebGPU renderer.
- WebGL2 fallback.
- Scientific UI.
- Existing memory and concurrency limits.
- Existing accessibility and security policies.

Do not modify the v1.0.0 artifacts in place.

---

## 4. Scientific Expansion Scope

TASK‑12 must expand the operational scientific product in controlled stages.

### Priority 1 — Full-depth temperature

Expand `thetao` from the current top 31 levels to all available verified depth levels for the selected Copernicus product, expected to be approximately 50 levels extending to roughly 5,700 m.

Do not assume the exact number or deepest coordinate. Read and record the actual provider coordinate array.

### Priority 2 — Salinity

Add `so` using the exact provider variable definition and units.

Do not casually describe salinity as PSU unless the source metadata explicitly supports that terminology. Preserve the exact source standard name, long name, units, fill values, coordinates, and valid range.

### Priority 3 — Horizontal currents

Add:

- `uo`
- `vo`

Verify whether they are truly eastward and northward components on the provider grid. Do not assume rotation is unnecessary without checking the product metadata and grid conventions.

### Priority 4 — Sea-surface height

Add:

- `zos`

Treat this as a two-dimensional time-varying surface field, not as a fake three-dimensional volume.

### Deferred unless separately approved

Do not automatically add:

- Vertical velocity.
- Waves.
- Chlorophyll.
- Oxygen.
- Nutrients.
- Bathymetry.
- Argo.
- Gliders.
- TEOS‑10 derived quantities.

These belong to later gated phases in this directive.

---

## 5. Credential and Acquisition Security

Before any new provider download:

1. Confirm provider credentials have been rotated according to repository policy.
2. Record only rotation confirmation, timestamp, credential owner role, and secret-store reference.
3. Never record credential values.
4. Never place credentials in:
   - Source code.
   - Shell history.
   - Reports.
   - Manifests.
   - URLs.
   - Logs.
   - Screenshots.
   - CI output.
   - Git history.
5. Inject credentials through the approved secret mechanism.
6. Block download if rotation cannot be confirmed.
7. Scrub authenticated URLs and query strings from logs.
8. Use provider-supported clients or APIs.
9. Record product IDs, dataset IDs, provider versions, request bounds, request times, publication times, and acquisition times.
10. Enforce the “no future valid timestamp” rule.
11. Classify each timestamp as analysis or forecast using provider metadata.
12. Preserve downloaded native files immutably.
13. Compute SHA‑256 immediately after acquisition.
14. Never overwrite the existing 2025 or 2026 regression and production snapshots.

---

## 6. Agent Allocation and Execution Model

Use no more than five active agents simultaneously across the program.

Each major task may use up to five specialists, but the orchestrator must prevent shared-file races.

Suggested TASK‑12 roles:

1. Scientific Product and Contract Architect.
2. Secure Acquisition and Canonicalization Engineer.
3. Multivariable Bricking and Precision Engineer.
4. Service, Client, Runtime, and Rendering Integration Engineer.
5. Independent Scientific Validation Lead.

Suggested TASK‑13 roles:

1. Scientific Analysis Architecture Lead.
2. Exact Analysis Service Engineer.
3. Oceanographic Derived-Quantity Specialist.
4. Scientific Analysis UI Engineer.
5. Independent Numerical Validation Lead.

Suggested TASK‑14 roles:

1. In-Situ Observation Architecture Lead.
2. Argo/Glider Ingestion and QC Engineer.
3. Model-Observation Collocation Engineer.
4. Observation Visualization and UX Engineer.
5. Independent Observation-Science Validation Lead.

The orchestrator exclusively owns:

- Root configuration.
- Shared lockfiles.
- Shared package manifests.
- Canonical schema generation.
- Shared renderer interfaces.
- CI workflows.
- Documentation indexes.
- Active product catalogs.
- Release manifests.
- Final integration reports.

No two modifying agents may edit the same shared files concurrently.

Completed agents may be used as read-only reviewers but must not be respawned to modify frozen work.

---

# TASK‑12 — Multivariable and Full-Depth Ocean Product Expansion

## 7. TASK‑12A — Scientific Product, Contract, and Capacity Preflight

### Objective

Design and freeze the multivariable expansion before downloading or generating production artifacts.

### Required work

1. Read all governing documents and prior reports.
2. Build a verified artifact registry for v1.0.0.
3. Audit provider metadata for:
   - `thetao`
   - `so`
   - `uo`
   - `vo`
   - `zos`
4. Record for each variable:
   - Product ID.
   - Dataset ID.
   - Standard name.
   - Long name.
   - Native dtype.
   - Units.
   - Coordinates.
   - Grid.
   - Dimension order.
   - Depth coordinates.
   - Time coordinates.
   - Fill value.
   - Missing-value semantics.
   - Valid ranges.
   - Update frequency.
   - Analysis/forecast classification.
5. Verify whether all variables share:
   - Horizontal grid.
   - Timestamp grid.
   - Depth grid.
   - Mask.
6. Do not assume shared coordinates merely because variables come from the same product.
7. Decide whether the new product uses:
   - The same seven-day window for all variables.
   - A new synchronized seven-day window.
   - A versioned snapshot family containing one native file per variable.
8. Preserve source-specific native files and manifests.
9. Estimate exact storage from actual dimensions:
   - Native NetCDF.
   - Canonical Zarr.
   - Visualization products.
   - Service cache.
   - Browser cache.
   - GPU resources.
10. Define scalar, vector, and surface-field contracts.
11. Define a multivariable snapshot-family contract.
12. Define vector-component relationships and orientation.
13. Define variable-specific validity masks where needed.
14. Define units and conversion rules.
15. Define error budgets separately for each variable.
16. Define LOD behavior separately for scalar, vector, and surface data.
17. Determine whether existing brick shapes remain optimal for 50 depth levels.
18. Benchmark candidate vertical strategies:
   - 64 × 64 × 32 with two vertical slabs.
   - 64 × 64 × 64 with one vertical slab.
   - 64 × 64 × 16 with multiple vertical slabs.
   - Other evidence-based candidates.
19. Evaluate halo requirements for vector fields.
20. Define GPU texture formats for each variable.
21. Define browser and GPU memory policies for simultaneous variables.
22. Define what combinations can be loaded concurrently.
23. Define transfer-function and legend requirements by variable.
24. Define current-vector visualization requirements without prematurely committing to a specific rendering technique.
25. Define exact-query and profile requirements.
26. Define acceptance criteria and stop conditions.
27. If contracts must change:
   - Version them explicitly.
   - Update the canonical source models.
   - Regenerate JSON Schema, TypeScript, and OpenAPI artifacts.
   - Run compatibility tests.
   - Do not call intentional synchronized contract evolution “schema drift.”

### Deliverables

- `task_12a_multivariable_scientific_product_and_contract_preflight_report.md`
- `task_12a_variable_inventory.json`
- `task_12a_capacity_and_storage_model.json`
- `task_12a_contract_change_plan.json`
- `task_12a_scientific_error_budgets.json`
- Architecture decision records where required.

### Required status

`TASK‑12A COMPLETE — MULTIVARIABLE EXPANSION DESIGN APPROVED`

Do not acquire production data before this gate passes.

---

## 8. TASK‑12B — Secure Acquisition and Lossless Canonicalization

### Objective

Acquire a synchronized multivariable snapshot family and create lossless canonical representations.

### Required acquisition order

1. Full-depth `thetao`.
2. Full-depth `so`.
3. Full-depth `uo`.
4. Full-depth `vo`.
5. Surface `zos`.

Acquire one variable at a time using isolated staging and promotion.

### Required work

1. Confirm credential rotation.
2. Resolve the latest provider-published synchronized seven-day window that satisfies the no-future-time rule.
3. Record provider publication and acquisition latency.
4. Record analysis-versus-forecast classification for every timestamp and variable.
5. Request the exact spatial domain:
   - 60°E–68°E.
   - 0°N–15°N.
6. Request all approved depth levels for 3D variables.
7. Download each native variable to a unique immutable path.
8. Compute full SHA‑256.
9. Validate:
   - Variable identity.
   - Units.
   - Dimensions.
   - Coordinate monotonicity.
   - Grid bounds.
   - Depth levels.
   - Timestamps.
   - Calendar.
   - Plausible values.
   - Fill values.
   - Missing masks.
   - File completeness.
10. Reject truncated or inconsistent files.
11. Create one canonical Zarr store per source variable or another TASK‑12A-approved layout.
12. Preserve native dtype and values losslessly.
13. Verify voxel-level parity.
14. Verify coordinate-array parity.
15. Verify mask parity.
16. Verify attributes and units.
17. Create immutable manifests.
18. Promote atomically.
19. Create a snapshot-family manifest linking all synchronized variables.
20. Preserve v1.0.0 active catalog entries.
21. Add the new family as a new version rather than silently replacing the certified product.
22. Do not activate the new family for production rendering until TASK‑12F validates it.

### Deliverables

- Immutable native files.
- Canonical Zarr stores.
- Native-source manifests.
- Canonical manifests.
- Snapshot-family manifest.
- Acquisition report:
  `task_12b_multivariable_acquisition_and_canonicalization_report.md`
- Machine-readable parity results.

### Required status

`TASK‑12B COMPLETE — MULTIVARIABLE CANONICAL SNAPSHOT VERIFIED`

---

## 9. TASK‑12C — Multivariable Bricking and Precision Engineering

### Objective

Create deterministic visualization products for full-depth temperature, salinity, currents, and sea-surface height.

### Required work

1. Benchmark the TASK‑12A-approved brick candidates.
2. Measure:
   - Brick count.
   - Payload count.
   - Storage.
   - Compression ratio.
   - Request count.
   - GPU upload cost.
   - Decode time.
   - Browser memory.
   - GPU memory.
   - Cache behavior.
3. Handle 50 or actual full-depth levels without pretending the depth coordinate is uniform.
4. Decide whether vertical slabs are necessary.
5. Preserve the one-dimensional physical depth LUT.
6. Define deterministic brick IDs containing:
   - Product.
   - Product version.
   - Snapshot family.
   - Variable.
   - Component where applicable.
   - Timestamp.
   - LOD.
   - Horizontal index.
   - Vertical index where applicable.
7. Evaluate encoding independently per variable:
   - Float16.
   - Uint16 affine quantization.
   - Float32 only when required by evidence.
8. Define variable-specific quantization scale and offset.
9. Reserve missing codes safely.
10. Preserve symbolic validity-mask semantics.
11. Prevent valid zero values from colliding with missing values.
12. Evaluate joint versus separate storage for `uo` and `vo`.
13. Preserve exact component relationships.
14. Do not derive speed/direction in the visualization product unless approved and fully documented.
15. Design `zos` as a surface product.
16. Validate halos and seams.
17. Validate LOD downsampling scientifically.
18. Generate exact error statistics:
   - Maximum.
   - MAE.
   - RMSE.
   - p50.
   - p90.
   - p95.
   - p99.
   - p99.9.
   - Depth-wise.
   - Timestamp-wise.
   - Variable-wise.
19. Generate deterministic manifests and indexes.
20. Use staging and atomic promotion.
21. Verify repeatable builds.
22. Keep the native source authoritative.

### Deliverables

- Versioned visualization-product trees.
- Variable manifests.
- Brick indexes.
- Quantization metadata.
- Validity masks.
- Depth LUTs.
- Surface-coordinate metadata.
- Error reports.
- `task_12c_multivariable_bricking_and_precision_report.md`

### Required status

`TASK‑12C COMPLETE — MULTIVARIABLE VISUALIZATION PRODUCTS VERIFIED`

---

## 10. TASK‑12D — Service, Client, Runtime, Renderer, and UI Integration

### Objective

Integrate the new product family through the complete QuasarOS stack without regressing v1.0.0 temperature workflows.

### Service requirements

Extend the catalog and query services to support:

- Multivariable snapshot families.
- Variable metadata.
- Full-depth point queries.
- Full-depth profiles.
- Surface-field queries.
- Current-component queries.
- Vector reconciliation.
- Product compatibility information.
- Variable-specific units.
- Variable-specific masks.
- Immutable visualization-product discovery.

Exact scientific queries must read authoritative native sources or approved lossless canonical representations according to ADR‑0005. Approximate visualization bricks must not become exact-query authority.

### Client requirements

Extend the typed client to support:

- Variable discovery.
- Component relationships.
- Full-depth products.
- Surface products.
- Variable-specific decoders.
- Variable-specific error metadata.
- Snapshot-family pinning.
- Cancellation during variable changes.
- Independent checksum verification.
- Memory-aware multi-variable loading.

### Runtime requirements

Extend the renderer-independent runtime to support:

- Scalar 3D fields.
- Vector component fields.
- Surface fields.
- Variable-specific units and ranges.
- Full-depth physical coordinates.
- Vertical slab planning if approved.
- Multi-variable residency accounting.
- Memory arbitration.
- Variable switching.
- Optional synchronized overlays.
- Scientific-state provenance.

### Renderer requirements

WebGPU and WebGL2 must support the approved TASK‑12 designs.

At minimum:

- Full-depth scalar volumes.
- Salinity scalar rendering.
- Current magnitude computed from verified components where approved.
- Component-aware sampling.
- Surface-field rendering for `zos`.
- Correct masks.
- Correct physical-depth mapping.
- Variable-specific transfer functions.
- Variable-specific legends.
- Backend parity.

Do not add decorative vector effects that lack scientific validation.

### UI requirements

Add:

- Variable selector.
- Component metadata.
- Units.
- Full-depth controls.
- Surface/volume mode distinction.
- Current-component inspection.
- Current speed and direction only after validated definitions exist.
- Variable-specific transfer functions.
- Variable-specific legends.
- Full-depth profiles.
- Snapshot-family provenance.
- Encoding/error information.
- Memory-aware warnings for expensive combinations.
- Accessible labels and keyboard operation.

### Regression requirements

The existing v1.0.0 temperature workflow must still pass unchanged.

### Deliverables

- Updated service, client, runtime, renderers, and application.
- Updated generated contracts where approved.
- Integration tests.
- Browser tests.
- `task_12d_multivariable_cross_stack_integration_report.md`

### Required status

`TASK‑12D COMPLETE — MULTIVARIABLE APPLICATION INTEGRATED`

---

## 11. TASK‑12E — Scientific and Platform Validation

### Objective

Independently validate every new variable and full-depth workflow.

### Scientific validation

Compare against authoritative native-source values for:

- Every timestamp.
- Every depth level.
- Every variable.
- Corners.
- Interior ocean.
- Coastlines.
- Missing areas.
- Brick boundaries.
- Vertical slab boundaries.
- LOD transitions.
- Minimum and maximum values.
- Valid zero values.
- Strong gradients.

Validate:

- Full-depth temperature.
- Salinity.
- `uo`.
- `vo`.
- Derived current magnitude if implemented.
- Derived direction if implemented.
- Sea-surface height.
- Exact point queries.
- Profiles.
- GPU picks.
- WebGPU results.
- WebGL2 results.
- CPU references.

### Vector validation

For currents:

1. Verify component orientation.
2. Verify units.
3. Verify grid alignment.
4. Verify speed calculation:
   `speed = sqrt(uo² + vo²)`
   only if `uo` and `vo` are confirmed compatible eastward/northward components.
5. Define direction convention explicitly.
6. Test cardinal and zero-current cases.
7. Handle missing component pairs safely.
8. Never compute a valid vector from one valid and one missing component.

### Full-depth validation

Verify:

- Actual full-depth coordinate array.
- Physical-depth interpolation.
- Vertical slab boundaries.
- Deepest levels.
- No depth-index inversion.
- No uniform-depth assumption.
- Profiles preserve every native level.

### Browser/platform validation

Repeat representative tests on:

- WebGPU.
- WebGL2.
- Integrated GPU.
- Discrete GPU where available.
- Constrained-memory configuration.
- Multiple browsers.
- Multiple DPRs.
- Multiple viewport sizes.

### Performance validation

Measure:

- Variable-switch latency.
- Full-depth startup.
- First visible volume.
- Stable LOD time.
- Memory.
- GPU memory.
- Decode time.
- Upload time.
- Frame-time p50/p95/p99.
- Multi-variable behavior.
- Surface/volume switching.
- Profile latency.
- Exact-query latency.

### Deliverables

- `task_12e_multivariable_scientific_and_platform_validation_report.md`
- Numerical result files.
- CPU-reference comparisons.
- Browser/GPU matrix.
- Performance results.
- Difference images.
- Known-limitations register.

### Required status

`TASK‑12E COMPLETE — MULTIVARIABLE SCIENTIFIC VALIDATION PASSED`

---

## 12. TASK‑12F — Independent Certification and v1.1 Release Gate

### Objective

Independently verify all TASK‑12 work and decide whether the new multivariable product may be promoted.

### Required checks

1. Review every TASK‑12 agent’s scope and completion report.
2. Inspect all diffs.
3. Verify no v1.0.0 artifact was mutated.
4. Verify all new paths are versioned.
5. Verify native-source checksums.
6. Verify canonical parity.
7. Verify visualization error budgets.
8. Verify scalar/vector/surface distinctions.
9. Verify masks.
10. Verify full-depth coordinates.
11. Verify browser integrity chain.
12. Verify exact-query authority.
13. Verify WebGPU/WebGL2 parity.
14. Verify accessibility.
15. Verify security.
16. Verify performance and memory budgets.
17. Run all old and new tests.
18. Verify synchronized schemas.
19. Verify documentation.
20. Verify reproducible builds.

### Deliverables

- `task_12f_independent_multivariable_release_certification_report.md`
- `task_12_multivariable_expansion_final_report.md`
- TASK‑12 release manifest.
- Checksums.
- Requirements traceability matrix.
- Final artifact registry.

### Permitted status

- `TASK‑12 COMPLETE — MULTIVARIABLE OCEAN PRODUCT SCIENTIFICALLY VALIDATED`
- `TASK‑12 CONDITIONALLY APPROVED — DOCUMENTED LIMITATIONS`
- `TASK‑12 BLOCKED — CORRECTIVE ACTION REQUIRED`

Proceed to TASK‑13 only if TASK‑12 is fully approved.

---

# TASK‑13 — Scientific Analysis Engine

## 13. TASK‑13A — Analysis Architecture and Authority Design

Design a scientific analysis layer supporting:

- Point time series.
- Full-depth profiles.
- Arbitrary vertical transects.
- Horizontal slices.
- Depth-range statistics.
- Region-of-interest statistics.
- Time-window statistics.
- Temperature–salinity analysis.
- Current speed and direction.
- Model-derived versus visualization-derived value classification.
- Reproducible exports.

Define which computations are:

- Authoritative server-side analyses.
- Lossless canonical computations.
- Approximate interactive GPU previews.
- UI-only presentation operations.

Approximate bricks must not become the authority for scientific statistics.

Produce:

- `task_13a_scientific_analysis_architecture_report.md`
- Analysis contracts.
- Error and authority model.
- Capacity model.

Required status:

`TASK‑13A COMPLETE — ANALYSIS ARCHITECTURE APPROVED`

---

## 14. TASK‑13B — Exact Analysis Services

Implement authoritative or approved lossless analysis services for:

- Point time series.
- Vertical profiles.
- Transects.
- Horizontal slices.
- Regional statistics.
- Depth-range statistics.
- Time-window statistics.
- Variable comparison.
- Current-vector queries.
- Exportable analysis results.

Requirements:

- Immutable snapshot pinning.
- Coordinate and time bounds.
- Explicit interpolation methods.
- Missing-value propagation.
- Units.
- Sample counts.
- Coverage fractions.
- Provenance.
- Algorithm version.
- Input checksums.
- Deterministic results.
- Bounded requests.
- Cancellation.
- Rate and memory limits.
- Structured errors.
- No arbitrary filesystem access.

Produce:

- Services.
- Contracts.
- Tests.
- Benchmarks.
- `task_13b_exact_scientific_analysis_services_report.md`

Required status:

`TASK‑13B COMPLETE — EXACT ANALYSIS SERVICES VERIFIED`

---

## 15. TASK‑13C — TEOS‑10 and Derived Ocean Quantities

Do not implement TEOS‑10 calculations casually.

Use a verified and pinned TEOS‑10/GSW implementation.

Before computing derived quantities:

1. Verify source temperature type:
   - Potential temperature.
   - In-situ temperature.
   - Conservative Temperature.
2. Verify source salinity type:
   - Practical Salinity.
   - Absolute Salinity.
3. Compute pressure correctly from depth and latitude where required.
4. Convert Practical Salinity to Absolute Salinity using longitude, latitude, and pressure where required.
5. Convert source temperature to Conservative Temperature using the correct pathway.
6. Preserve original source variables.
7. Label every derived result accurately.
8. Record library name and version.
9. Record formula/pathway.
10. Record units.
11. Record uncertainty and limitations.

Candidate derived quantities:

- Absolute Salinity.
- Conservative Temperature.
- In-situ density.
- Potential density anomaly.
- Sound speed.
- Brunt–Väisälä frequency where vertical resolution and assumptions permit.
- Mixed-layer depth using explicitly documented criteria.
- Thermocline metrics using explicitly documented methods.

Do not implement a quantity if required inputs or scientifically valid assumptions are unavailable.

Produce:

- Derived-quantity services.
- Validation against trusted reference cases.
- `task_13c_teos10_and_derived_ocean_quantities_report.md`

Required status:

`TASK‑13C COMPLETE — DERIVED QUANTITIES SCIENTIFICALLY VERIFIED`

---

## 16. TASK‑13D — Scientific Analysis UI

Implement accessible workflows for:

- Time-series plots.
- Full-depth profiles.
- Transect selection and plots.
- Horizontal slices.
- Region selection.
- Statistics tables.
- Temperature–salinity diagrams.
- Current speed/direction inspection.
- Derived-quantity selection.
- Uncertainty and method panels.
- Provenance.
- CSV export.
- JSON export.
- NetCDF or another approved scientific export.
- Publication-quality image export.
- Saved analysis definitions.

Every displayed analysis must show:

- Dataset.
- Snapshot.
- Variable.
- Units.
- Time.
- Location or region.
- Depth or depth range.
- Method.
- Authority classification.
- Input checksum references.
- Algorithm version.
- Missing-data handling.

Produce:

- UI implementation.
- Accessibility tests.
- Browser tests.
- Scientific workflow tests.
- `task_13d_scientific_analysis_ui_report.md`

Required status:

`TASK‑13D COMPLETE — SCIENTIFIC ANALYSIS UI INTEGRATED`

---

## 17. TASK‑13E — Analysis Validation and Certification

Independently validate:

- Time series.
- Profiles.
- Transects.
- Regional statistics.
- Depth statistics.
- Current calculations.
- Temperature–salinity diagrams.
- TEOS‑10 quantities.
- Exports.
- Provenance.
- Reproducibility.
- Browser workflows.
- Security.
- Accessibility.
- Performance.

Compare services against independent Python or GSW reference calculations.

Run the complete TASK‑01 through TASK‑13 test suite.

Produce:

- `task_13e_scientific_analysis_independent_validation_report.md`
- `task_13_scientific_analysis_engine_final_report.md`
- Analysis release manifest.
- Machine-readable validation results.

Required status:

`TASK‑13 COMPLETE — SCIENTIFIC ANALYSIS ENGINE VALIDATED`

Proceed to TASK‑14 only after approval.

---

# TASK‑14 — In-Situ Observation Fusion and Model Comparison

## 18. TASK‑14A — Observation Architecture

Design support for:

- Argo profiles.
- BGC-Argo where approved.
- Glider trajectories and profiles.
- Observation QC.
- Observation provenance.
- Model-observation collocation.
- Platform metadata.
- Time/depth/space tolerances.
- Uncertainty.
- Observation licensing.
- Reproducible comparison workflows.

Do not mix observations into model grids without preserving the original observation values and coordinates.

Produce:

- `task_14a_observation_fusion_architecture_report.md`
- Observation contracts.
- QC policy.
- Collocation policy.

---

## 19. TASK‑14B — Argo and Glider Ingestion

Implement isolated ingestion pipelines for approved observation sources.

Requirements:

- Secure acquisition.
- Immutable native files.
- SHA‑256.
- Provider and licence metadata.
- Platform IDs.
- Profile IDs.
- Exact timestamps.
- Longitude and latitude.
- Pressure/depth.
- Variables and units.
- QC flags.
- Adjusted values where applicable.
- Error estimates.
- Source-version metadata.
- Lossless canonical representation.
- No silent removal of rejected observations.

Produce:

- Canonical observation stores.
- Manifests.
- Tests.
- `task_14b_argo_and_glider_ingestion_report.md`

---

## 20. TASK‑14C — Model-Observation Collocation and Metrics

Implement reproducible collocation using explicit:

- Horizontal distance limits.
- Time-distance limits.
- Vertical interpolation.
- Mask handling.
- Observation QC policy.
- Model timestamp selection.
- Model grid selection.
- Uncertainty treatment.

Produce metrics such as:

- Bias.
- Mean absolute error.
- RMSE.
- Correlation where sample size is sufficient.
- Sample count.
- Coverage.
- Depth-binned error.
- Region-binned error.
- Time-binned error.

Never report metrics without sample counts and selection criteria.

Produce:

- Collocation engine.
- Validation harness.
- `task_14c_model_observation_collocation_report.md`

---

## 21. TASK‑14D — Observation and Comparison UI

Implement:

- Argo profile markers.
- Glider tracks.
- Platform metadata.
- QC filters.
- Observation profile plots.
- Model profile overlays.
- Difference profiles.
- Collocation tables.
- Error summaries.
- Provenance.
- Export.
- Accessible non-map alternatives.

Produce:

- UI.
- Tests.
- Browser evidence.
- `task_14d_observation_and_model_comparison_ui_report.md`

---

## 22. TASK‑14E — Independent Observation Science Validation

Validate:

- Observation values.
- QC handling.
- Coordinates.
- Time.
- Pressure/depth conversion.
- Collocation.
- Interpolation.
- Metrics.
- UI.
- Export.
- Provenance.
- Security.
- Accessibility.
- Reproducibility.

Produce:

- `task_14e_observation_fusion_independent_validation_report.md`
- `task_14_observation_fusion_final_report.md`
- Observation release manifest.

Required status:

`TASK‑14 COMPLETE — OBSERVATION FUSION AND MODEL COMPARISON VALIDATED`

Stop after TASK‑14. Do not start publication-system or further product-expansion work without another directive.

---

# PROGRAM‑02 FINAL VERIFICATION

## 23. Mandatory Final Verification of All Agent Work

After TASK‑14, assign an independent Program Verification Lead.

For every agent and subtask in RELEASE‑01F and TASK‑12 through TASK‑14:

1. Review the assigned scope.
2. Review the completion report.
3. Inspect all changed files.
4. Inspect the complete version-control diff.
5. Confirm no unrelated changes.
6. Confirm no immutable v1.0.0 artifacts were modified.
7. Confirm every reported artifact exists.
8. Confirm every repository-relative path resolves.
9. Parse every JSON, YAML, TOML, and configuration file.
10. Validate manifests against schemas.
11. Recalculate all SHA‑256 values.
12. Verify generated schemas and declarations.
13. Reproduce reported test commands.
14. Rerun affected tests independently.
15. Confirm skipped tests are not counted as passed.
16. Confirm scientific comparisons use authoritative sources.
17. Confirm approximate bricks are not used as exact analytical authority.
18. Confirm browser/GPU evidence is real and attributable.
19. Confirm performance claims record hardware and methodology.
20. Confirm no credentials or secrets are present.
21. Confirm no host or repository paths leak to clients.
22. Confirm accessibility evidence.
23. Confirm known limitations remain documented.
24. Confirm every defect fix has a regression test.
25. Confirm all review gates were actually completed.

## 24. Complete Regression Suite

Run all applicable tests from TASK‑01 through TASK‑14:

- Python tests.
- TypeScript tests.
- Service tests.
- Client tests.
- Runtime tests.
- WebGPU tests.
- WebGL2 tests.
- Application tests.
- Analysis tests.
- Observation tests.
- Browser E2E.
- Real-browser smoke tests.
- Contract tests.
- Schema generation and drift checks.
- OpenAPI validation.
- Manifest validation.
- Checksum validation.
- NetCDF/Zarr parity.
- Mask tests.
- Quantization tests.
- Full-depth tests.
- Vector tests.
- Surface-field tests.
- Depth-LUT tests.
- Brick and halo tests.
- LOD tests.
- Renderer parity.
- CPU references.
- Exact-query tests.
- Profile tests.
- Time-series tests.
- Transect tests.
- Regional-statistics tests.
- TEOS‑10 reference tests.
- Observation QC tests.
- Collocation tests.
- Export tests.
- Security tests.
- Accessibility tests.
- Failure injection.
- Performance smoke tests.
- Clean-build tests.
- Reproducibility tests.
- Secret scans.
- Dependency and licence checks.

Record exact commands, environments, timestamps, exit codes, pass/fail/skip counts, and evidence paths.

## 25. Cross-Layer Scientific Traces

Trace representative values through the complete system for:

- Full-depth temperature.
- Salinity.
- Eastward current.
- Northward current.
- Sea-surface height.
- A valid zero value where available.
- A source-missing cell.
- A land cell.
- A TEOS‑10 derived value.
- An Argo or glider observation.
- A model-observation collocation.

Trace:

`Native source → canonical representation → visualization product where applicable → transport → browser decoder → runtime → renderer → UI → exact service → analysis → export → provenance`

## 26. Final Program Deliverables

Produce:

- `program_02_task_12_14_final_verification_report.md`
- `program_02_requirements_traceability_matrix.json`
- `program_02_cross_layer_scientific_lineage.json`
- `program_02_artifact_registry.json`
- `program_02_checksums.sha256`
- `program_02_known_limitations.md`
- `program_02_security_accessibility_and_reproducibility_report.md`
- Proposed QuasarOS v1.1.0 release manifest.

## 27. Final Permitted Status

Use exactly one:

- `PROGRAM‑02 COMPLETE — MULTIVARIABLE ANALYSIS AND OBSERVATION PLATFORM VALIDATED`
- `PROGRAM‑02 CONDITIONALLY APPROVED — DOCUMENTED LIMITATIONS`
- `PROGRAM‑02 BLOCKED — CORRECTIVE ACTION REQUIRED`

Do not promote v1.1.0 unless every required gate passes.

---

## 28. Global Stop Conditions

Stop if:

- Credentials are not confirmed rotated.
- Native-source checksum fails.
- Variables cannot be synchronized.
- Coordinates or grids are incompatible without an approved strategy.
- Canonical parity fails.
- Mask semantics conflict.
- Full-depth coordinates are treated as uniform.
- Vector orientation is unknown.
- Missing current components are treated as valid vectors.
- Salinity or temperature type is mislabeled.
- TEOS‑10 inputs are scientifically insufficient.
- Visualization bricks become analytical authority.
- v1.0.0 artifacts are modified.
- WebGPU/WebGL2 parity fails.
- Browser integrity verification fails.
- Memory limits are exceeded without controlled degradation.
- Observation QC is discarded.
- Collocation criteria are undocumented.
- Metrics omit sample counts.
- Schema evolution is unsynchronized.
- Security or accessibility gates fail.
- Full regression suite fails.
- Agent-reported results cannot be independently reproduced.

---

## 29. Required Immediate Announcement

Before spawning RELEASE‑01F, output a concise announcement containing:

1. Confirmation of orchestrator continuity.
2. Current QuasarOS v1.0.0 status.
3. Interpretation of RELEASE‑01F.
4. Interpretation of TASK‑12.
5. Planned TASK‑13 and TASK‑14 progression.
6. Governing documents found.
7. Missing or conflicting documents.
8. Active snapshot and SHA‑256.
9. Authority hierarchy.
10. Existing native, canonical, visualization, service, client, runtime, renderer, application, and report paths.
11. Existing release manifest and checksum paths.
12. Credential-rotation status.
13. Proposed new snapshot-family strategy.
14. Proposed variables.
15. Proposed full-depth strategy.
16. Contract-change expectations.
17. Agent assignments.
18. Dependency graph.
19. Owned paths.
20. Read-only paths.
21. Review gates.
22. Known scientific risks.
23. Known technical risks.
24. Security status.
25. Exact final line:

`READY TO ASSIGN RELEASE‑01F AND BEGIN PROGRAM‑02`

After the announcement:

1. Complete RELEASE‑01F.
2. Execute TASK‑12A through TASK‑12F sequentially with approved parallel specialist work.
3. Perform the TASK‑12 independent review.
4. Proceed to TASK‑13 only if TASK‑12 passes.
5. Execute and validate TASK‑13.
6. Proceed to TASK‑14 only if TASK‑13 passes.
7. Execute and validate TASK‑14.
8. Perform PROGRAM‑02 final verification of every task, agent, artifact, test, checksum, and scientific result.
9. Produce the proposed v1.1.0 release manifest.
10. Stop and request authorization before any further roadmap phase.

