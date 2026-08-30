# QuasarOS Documentation Index

## Purpose

This directory contains the authoritative V1 specifications for QuasarOS and QuasarOceanScope.

## Reading order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../AGENTS.md` | Mandatory rules for all agents |
| 2 | `Plan.md` | Product scope, milestones, and delivery plan |
| 3 | `Arc.md` | System architecture and component boundaries |
| 4 | `Tech.md` | Approved technologies and rationale |
| 5 | `DataModeling.md` | Canonical scientific data model |
| 6 | `DataSources.md` | Approved real-data sources and acquisition policy |
| 7 | `Implement.md` | Implementation strategy and repository organization |
| 8 | `Design.md` | User experience and interface specification |
| 9 | `Test.md` | Verification, validation, and release gates |

## Canonical Schema and Contract Package Versioning

- **Contract Package:** `quasar-contracts v1.2.0`
- **Schema Protocol Version:** `2.0.0`
- **Canonical Schemas:** 54 fully synchronized and certified JSON Schemas (`schemas/canonical/*.json`)
- **Pydantic Contract Source:** `quasar_contracts/models/` (Python 3.11+ source of truth)
- **TypeScript Interface Bindings:** `packages/contracts/src/` (generated via synchronized codegen)
- **Verification Suites:** 245 automated unit/integration tests (`python -m unittest discover tests`) with 0 schema drift (`python scripts/generate_schemas.py --verify`).

## Evidence & Verification Reports

- [TASK-09A WebGL2 Architecture and Capability Preflight Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_09a_webgl2_architecture_and_capability_report.md)
- [TASK-08 WebGPU Volume Ray-Marching Renderer Closure Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08_webgpu_volume_raymarching_renderer_final_report.md)
- [TASK-08E WebGPU Independent Validation Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08e_webgpu_renderer_independent_validation_report.md)
- [TASK-08D Provisional Pick & Reconciliation Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08d_provisional_pick_and_authoritative_reconciliation_report.md)
- [TASK-08C Volume Raymarching Renderer Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08c_webgpu_volume_raymarching_renderer_report.md)
- [TASK-08B WebGPU Resources & Uploads Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08b_webgpu_resources_and_upload_report.md)
- [TASK-08A WebGPU Renderer Preflight Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_08a_webgpu_renderer_preflight_report.md)
- [TASK-03 Final Pipeline Closure Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_03_first_temperature_volume_pipeline_report.md)
- [TASK-03D Scientific Validation & Benchmarks Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_03d_scientific_pipeline_validation_report.md)
- [TASK-02 Closure Report](file:///C:/Users/Ranji/Downloads/ocanscope3d/task_02_canonical_scientific_contracts_final_report.md)
- [TASK-02A Dataset Readiness Matrix](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/11-evidence/scientific-validation/task-02a/readiness_matrix.md)
- [TASK-02A First Volume Dataset Decision](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/11-evidence/scientific-validation/task-02a/first_volume_dataset_decision.md)
- [TASK-02B Ingestion Specification](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/11-evidence/scientific-validation/task-02b/copernicus_temperature_pipeline_spec.md)
- [TASK-02C Campaign Data Cryptographic Evidence](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/campaigns/manifest.json)
- [TASK-02D Grid Topology Verification](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/03-science-data/GridTopology.md)
- [TASK-02E Vertical Coordinate Transforms](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/03-science-data/VerticalCoordinates.md)
- [TASK-02F Missing Data and Masking Specifications](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/03-science-data/MissingDataAndMasks.md)
- [TASK-02G In Situ Observation Models](file:///C:/Users/Ranji/Downloads/ocanscope3d/docs/03-science-data/ObservationModel.md)

## Authority order

If documents conflict, use this precedence:

1. `AGENTS.md`
2. `docs/03-science-data/` for scientific data semantics (`DataPrecisionPolicy.md`, `GridTopology.md`, `VerticalCoordinates.md`, etc.)
3. `docs/02-architecture/` for architecture (`Arc.md`, `APIContracts.md`, etc.)
4. `Tech.md` for technology decisions
5. `docs/08-testing/` and `Test.md` for release and validation requirements
6. `Implement.md` for implementation conventions
7. `docs/01-product/` and `Design.md` for UI behavior
8. `Plan.md` for scheduling

A conflict must still be reported and corrected. Precedence is not permission to leave contradictory documents unresolved.

## Project terminology

- **QuasarOS:** overall browser-native scientific visualization platform.
- **QuasarOceanScope:** oceanographic application inside QuasarOS.
- **Ocean Overview:** CesiumJS geospatial workspace.
- **Scientific Volume Lab:** Babylon.js scientific rendering workspace.
- **Canonical data:** analysis-ready scientific representation preserving source meaning and precision.
- **Rendering product:** optimized, potentially quantized data used by the GPU.
- **Authoritative data:** original provider data or a traceable canonical transformation.
- **Fixture:** test-only data that must never be presented as operational data.

## Document status

All documents in this directory define the V1 target. Implementation may initially be incomplete, but agents must not silently redefine the target based on incomplete code.

## Change policy

A major change to architecture, technology, scientific semantics, or release criteria requires:

- Description of the problem.
- Proposed decision.
- Alternatives.
- Scientific consequences.
- Performance consequences.
- Migration impact.
- Testing impact.
- Maintainer/orchestrator approval.


