# TASK-08D: Provisional GPU Picking and Exact-Value Reconciliation Report

**Status:** Complete  
**Date:** 2026-08-30  
**Subsystems Involved:** `@quasar/renderer-webgpu` (`src/picking/`), `@quasar/runtime`, `@quasar/client`  
**Governing Directives:** `AGENTS.md` § 2, § 9, § 10, § 13, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`

---

## 1. Executive Summary

TASK-08D delivers the production WebGPU single-ray volume picking and authoritative exact-value query reconciliation pipeline. This subsystem connects hardware-accelerated WebGPU compute raymarching directly to the certified scientific exact query engine from TASK-05.

In strict accordance with `AGENTS.md` governing principles:
- **Scientific Correctness:** Rendered display samples are strictly provisional and must never be masqueraded as authoritative scientific observations.
- **Lineage Preservation:** Every derived product preserves its provenance, exact source asset SHA-256, and evaluation methodology.
- **Confidence Bounds:** Every provisional pick response returns explicit approximation notices and theoretical sample error bounds.

---

## 2. Architecture & Delivered Modules

### 2.1 WebGPU Volume Picking Compute Shader (`volume_picking.wgsl.ts`)
- **Single-Ray Dispatch:** Executes `@compute @workgroup_size(1, 1, 1)` for a single screen/viewport ray $[(x, y)]$.
- **Smits-Kay AABB Volume Clipping:** Calculates entry ($t_{enter}$) and exit ($t_{exit}$) bounds against $[0, 1]^3$ normalized volume box and clipping uniforms.
- **Adaptive Ray Marching:** Steps along the ray (`current_t += step_size`), sampling the active 3D volume texture via `textureSampleLevel(volume_texture, volume_sampler, pos, 0.0)`.
- **First-Hit Evaluation:** Unquantizes physical scalar (`raw * scale + offset`) upon meeting opacity threshold (`raw > opacity_threshold`).
- **GPU Output Buffer (32-byte layout):**
  - `hit_u`, `hit_v`, `hit_w` (`f32[3]`): Normalized volume coordinates $[u, v, w] \in [0, 1]^3$.
  - `scalar_value` (`f32`): Sampled unquantized scalar value.
  - `mask_code` (`u32`): Categorical mask code (1 = ocean, 0 = background/miss).
  - `hit_flag` (`u32`): 1 = Hit, 0 = Miss.
  - `padding` (`u32[2]`): 8-byte alignment padding.

### 2.2 GPU Volume Picker (`gpu_volume_picker.ts`)
- **Lifecycle & Uniform Management:** Allocates 80-byte `UNIFORM` buffer, 32-byte `STORAGE` buffer, 32-byte `MAP_READ` staging buffer, and linear sampler.
- **Asynchronous Readback:** Maps staging buffer via `stagingBuffer.mapAsync(GPUMapModeFlags.READ, 0, 32)`.
- **Provisional Mapping Integration:** Converts normalized $[u, v, w]$ coordinates into WGS84 Geodetic coordinates (`latitudeDeg`, `longitudeDeg`, `depthM`) and Local Cartesian ENU coordinates using `@quasar/runtime` `ProvisionalPickMapper`.
- **Dual Response Synthesizer:** Emits `ProvisionalRenderPickResponse` and prepared `ReconcilePickRequest`.

### 2.3 Authoritative Reconciliation Client Integration (`reconciliation.ts`)
- **Backend Integration:** `reconcilePickWithBackend(pickInput, client, options)` dispatches `POST /api/v1/queries/reconcile-pick` to TASK-05 FastAPI service via `@quasar/client`.
- **Unified Result Presentation:** Synthesizes `UnifiedPickReconciliationResult`:
  - `provisional`: Fast approximate feedback (rendered LOD, approximate value, display units, world ray hit position, approximation notice).
  - `authoritative`: Certified NetCDF native array sample (`scientific_value`, `canonical_units`, resolved coordinates, `source_asset_id`, `source_asset_sha256`, `selection_method_used`).
  - `comparison`: `absoluteDifferenceDelta`, `relativeDifferencePercent`, `withinEstimatedErrorBound`, `reconciliationNotice`.

---

## 3. Automated Test Results

All 20 unit and integration tests in `@quasar/renderer-webgpu` pass with 100% success rate:

```text
> @quasar/renderer-webgpu@1.0.0 test
> node --test

▶ TASK-08D: Provisional GPU Volume Picking Subsystem
  ✔ should compile WGSL volume picking shader string (1.0607ms)
  ✔ should execute GPU picking pass and map hit to ProvisionalRenderPickResponse (1.5584ms)
  ✔ should return hit=false when ray misses volume (0.3255ms)
  ✔ should throw GPUResourceDisposedError when picking after dispose (1.1514ms)
✔ TASK-08D: Provisional GPU Volume Picking Subsystem (5.6636ms)
▶ TASK-08D: Authoritative Reconciliation Client Integration
  ✔ should dispatch reconcile-pick query and synthesize unified reconciliation result (29.1746ms)
✔ TASK-08D: Authoritative Reconciliation Client Integration (29.3421ms)
▶ QuasarOS WebGPU WGSL Volume Raymarching Shaders (2.347ms)
▶ QuasarOS WebGPU Volume Raymarching Pipeline & Renderer (8.425ms)
▶ QuasarOS WebGPU Row Alignment Repacker (256-byte alignment) (12.9649ms)
▶ QuasarOS WebGPU Memory Budget Tracker (0.2984ms)
▶ QuasarOS WebGPU Resource Manager & Uploads (1.7577ms)
▶ QuasarOS WebGPU Residency Adapter & RenderPacket Synchronization (5.3408ms)
ℹ tests 20
ℹ suites 8
ℹ pass 20
ℹ fail 0
```

---

## 4. Deliverables Checklist

- [x] `packages/renderer-webgpu/src/picking/volume_picking.wgsl.ts` (Single-ray WGSL raymarching compute shader)
- [x] `packages/renderer-webgpu/src/picking/gpu_volume_picker.ts` (`GpuVolumePicker` dispatch and readback engine)
- [x] `packages/renderer-webgpu/src/picking/reconciliation.ts` (`reconcilePickWithBackend` client integration)
- [x] `packages/renderer-webgpu/src/picking/index.ts` (Module entrypoint)
- [x] `packages/renderer-webgpu/src/index.ts` (Public export exposure)
- [x] `packages/renderer-webgpu/test/picking_reconciliation.test.ts` (GPU buffer readback and reconciliation tests)
- [x] `task_08d_provisional_pick_and_authoritative_reconciliation_report.md` (Formal task report)

---

**Status:** `TASK-08D COMPLETE — PROVISIONAL PICK RECONCILIATION VALIDATED`