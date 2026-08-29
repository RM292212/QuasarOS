# Future Roadmap

**Document:** `docs/01-product/FutureRoadmap.md`  
**Status:** Directional; not a commitment  
**Baseline:** Begins after V1 acceptance

## 1. Roadmap principles

Future work shall:

1. Preserve scientific correctness and provenance.
2. Extend existing contracts rather than bypassing them.
3. Be justified by user needs and measured performance.
4. Avoid parallel rendering engines without a formal architecture decision.
5. Add data sources only after access, licence, metadata, and validation review.
6. Keep WebGL 2.0 parity for essential workflows unless an approved future decision changes support policy.
7. Treat AI-generated analysis as assistive and auditable, not authoritative.
8. Add Rust/WASM or TypeGPU only after profiling demonstrates a specific need.

## 2. Horizon 0 — V1 stabilization

### Objectives

- Resolve V1 production defects.
- Improve bootstrap reliability.
- Harden source adapters.
- Tune brick sizes, cache budgets, and quality profiles.
- Expand browser and GPU coverage.
- Improve accessibility and documentation.
- Establish operational monitoring and release cadence.

### Exit indicators

- Stable error rate.
- Reproducible performance.
- No critical scientific defects.
- Provider changes detected and handled.
- V1 journeys remain continuously validated.

## 3. Horizon 1 — Expanded physical-ocean analysis

### Candidate capabilities

- Multiple simultaneous scalar layers with explicit compositing rules.
- Improved isosurface extraction and caching.
- Streamlines, pathlines, and stream tubes.
- Vertical sections along user-defined transects.
- Eddy and front exploration tools.
- Thermocline, halocline, and mixed-layer diagnostics.
- Brunt–Väisälä frequency and stratification products.
- Barrier-layer thickness.
- Potential density and additional TEOS-10 quantities.
- Better staggered-grid support.
- Time interpolation for scientifically approved products.
- Side-by-side and difference workspaces.

### Required safeguards

- Algorithm validation.
- Unit and coordinate compatibility.
- Derived-product provenance.
- Clear uncertainty and resolution disclosure.

## 4. Horizon 2 — Broader observation integration

### Candidate platforms

- BGC-Argo.
- Gliders.
- CTD and XCTD casts.
- XBT profiles.
- Moored and drifting buoys.
- Coastal ADCP.
- HF-radar surface currents.
- Tide gauges.
- Ship tracks.
- Satellite SST and altimetry overlays.

### Candidate capabilities

- Observation-platform adapters.
- Observation-density maps.
- Profile curtains.
- Trajectory-aware collocation.
- Multi-profile statistics.
- Platform-specific QC interpretation.
- Near-real-time update notifications.
- Observation supersession and delayed-mode updates.

### Constraints

Each platform requires explicit schemas, source-QC retention, licence review, and independent scientific validation.

## 5. Horizon 3 — Biogeochemistry and ocean colour

### Candidate variables

- Dissolved oxygen.
- Chlorophyll-a.
- Nitrate.
- Phosphate.
- Silicate.
- pH.
- Suspended particulate matter.
- Apparent oxygen utilization.
- Oxygen saturation.
- Primary production.
- Kd490 and other ocean-colour products.

### Product rules

- Satellite ocean-colour products remain surface fields.
- Depth-resolved BGC models may be volume-rendered.
- BGC-Argo remains profile-based unless a derived field is explicitly generated.
- Sensor calibration, adjusted values, uncertainty, and QC shall be retained.
- Logarithmic scaling shall be enabled only where scientifically appropriate.

## 6. Horizon 4 — Advanced grids and global scale

### Candidate capabilities

- Curvilinear-grid rendering without full Cartesian resampling.
- Sigma and terrain-following coordinates.
- Rotated grids.
- Unstructured meshes.
- Adaptive regional-to-global LOD.
- Multi-resolution coastline and bathymetry.
- Cross-dateline and polar support.
- Multi-region sessions.
- Distributed processing for very large products.
- Cloud-native virtual datasets through Kerchunk or VirtualiZarr.

### Architectural work

- Extend `GridAdapter` contracts.
- Add topology-specific render-product generators.
- Establish validation datasets for every new grid family.
- Preserve canonical coordinates and avoid irreversible preprocessing.

## 7. Horizon 5 — Ensemble and uncertainty visualization

### Candidate capabilities

- Ensemble-member selection.
- Ensemble mean and spread.
- Percentile volumes.
- Probability-of-threshold fields.
- Confidence and uncertainty overlays.
- Observation uncertainty propagation.
- Comparison across model products.
- Sensitivity analysis.
- Visual provenance graph.

### Scientific requirements

- Ensemble semantics shall be provider-aware.
- Uncertainty and variability shall not be conflated.
- Statistical aggregation shall record missing-member policy and weighting.
- Visual encodings shall remain interpretable and accessible.

## 8. Horizon 6 — Acoustic and multidisciplinary modules

### Candidate ocean-acoustic inputs

- Temperature.
- Salinity.
- Pressure or depth.
- Sound speed.
- Bathymetry.
- Seabed properties.
- Surface conditions.
- Current fields where relevant.

### Candidate capabilities

- Sound-speed profiles and sections.
- Derived acoustic layers.
- Interface to separately validated propagation services.
- Visualization of transmission-loss products.
- Scenario provenance.

QuasarOceanScope shall not implement or claim validated acoustic prediction merely from visualizing sound-speed fields. Any acoustic simulation requires a dedicated scientific specification and validation program.

## 9. Horizon 7 — Collaboration and reproducible workspaces

### Candidate capabilities

- Saved projects.
- Shareable immutable scene links.
- Annotations.
- Review comments.
- Team collections.
- Reproducible analysis notebooks.
- Server-side report generation.
- Dataset citation exports.
- Role-aware sharing.
- Audit history.

### Security requirements

- Authorization on every shared resource.
- No credentials in shared state.
- Immutable references for published analyses.
- Retention and privacy controls.

## 10. Horizon 8 — Extended immersive and outreach experiences

### Candidate capabilities

- WebXR exploration.
- Classroom presentation mode.
- Guided tours.
- Kiosk mode.
- Museum installations.
- Narrative comparisons.
- Sonification of selected profiles.
- Improved mobile and tablet interaction.
- Offline curated packages where licensing permits.

Immersive features shall not block accessibility alternatives or the standard browser workflow.

## 11. Horizon 9 — AI-assisted workflows

### Candidate capabilities

- Natural-language catalog search.
- Suggested compatible datasets.
- Plain-language metadata explanation.
- Assisted transfer-function presets.
- Automated report drafting from explicit results.
- Data-quality anomaly triage.
- Documentation and provenance summarization.
- Agent-assisted ingestion configuration.

### Mandatory controls

- AI output shall be labelled.
- Dataset and calculation references shall be shown.
- The system shall not fabricate measurements, metadata, or provider access.
- Scientific calculations shall execute through validated deterministic services.
- Users shall be able to inspect the underlying values and algorithms.
- Sensitive or restricted data shall follow deployment policy.
- AI suggestions shall not silently modify published products.

## 12. Horizon 10 — Operational maturity

### Candidate capabilities

- Multi-region production deployments.
- High-availability control services.
- Managed processing queues.
- Disaster recovery.
- Provider-health monitoring.
- Dataset freshness alerts.
- Service-level objectives.
- Automated rollback.
- Cost and storage optimization.
- Formal certification for specific institutional workflows where required.

Certification, if pursued, shall be scoped to named deployments, datasets, procedures, and authorities. It shall not be inferred from general product capability.

## 13. Explicitly conditional technologies

### Rust and WebAssembly

May be adopted for profiled bottlenecks such as:

- Decompression.
- Coordinate transformation.
- Isosurface extraction.
- Specialized binary parsing.
- CPU fallback calculations.

Adoption requires benchmark evidence, a stable interface, browser compatibility review, and maintenance ownership.

### TypeGPU

May be evaluated in isolated experimental modules. It shall not replace Babylon.js renderer integration or shared backend contracts without an approved architecture decision.

### NanoVDB or sparse-volume formats

May be used for genuinely sparse fields or masks. Dense ocean temperature and salinity fields shall continue using dense multiresolution bricks unless evidence supports a change.

## 14. Roadmap prioritization criteria

Candidate work shall be ranked by:

1. Scientific value.
2. User demand.
3. Data availability and licence.
4. Validation feasibility.
5. Performance impact.
6. Accessibility impact.
7. Operational complexity.
8. Compatibility with current architecture.
9. Maintenance cost.
10. Security and privacy risk.

## 15. Roadmap governance

Before a roadmap item enters implementation, it shall have:

- Product problem statement.
- Named users.
- Scientific owner.
- Technical owner.
- Data-source review.
- Architecture impact assessment.
- Acceptance criteria.
- Testing strategy.
- Performance budget.
- Accessibility review.
- Security review.
- Delivery and rollback plan.

This roadmap shall not be interpreted as authorization to implement a future feature outside the approved milestone and task graph.

