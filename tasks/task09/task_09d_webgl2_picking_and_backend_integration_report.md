# TASK-09D: WebGL2 Picking and Backend Integration Report

**Milestone:** M3 — WebGL2 Scientific Volume Rendering Subsystem  
**Task Identifier:** TASK-09D (WebGL2 Picking and Backend Integration)  
**Role:** WebGL2 Picking and Backend Integration Engineer  
**Status:** `TASK-09D COMPLETE — BACKEND FALLBACK AND PICKING VALIDATED`  
**Date:** 2026-08-30T22:40:00+05:30  
**Directives & Standards:** `AGENTS.md` (§ 1, § 2, § 3, § 6, § 7, § 8, § 9, § 10, § 11, § 13, § 14, § 15, § 18), `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`, `ADR-0003-webgl2-3d-fallback.md`  
**Target Package:** `@quasar/renderer-webgl2` (`packages/renderer-webgl2/`)  

---

## 1. Executive Summary

TASK-09D successfully implements the WebGL2 single-ray provisional volume picking engine, offscreen single-pixel framebuffer readback, runtime geodetic coordinate mapping, authoritative backend reconciliation integration with `@quasar/client`, and the unified backend switcher adapter for seamless WebGPU-to-WebGL2 fallback as specified in `ADR-0003`.

All picking components enforce the core scientific principle: **Rendered display samples are strictly provisional and are never masqueraded as authoritative scientific ground truth**. Every provisional hit generates both instant visual feedback (`ProvisionalRenderPickResponse`) and a typed delegation request (`ReconcilePickRequest`) for authoritative evaluation by the backend exact query service against native NetCDF arrays.

---

## 2. Implemented Subsystems & Modules

### 2.1 GLSL ES 3.00 Single-Ray Picking Shaders (`packages/renderer-webgl2/src/shaders/volume_picking.glsl.ts`)
- **Fullscreen Quad Vertex Shader (`VOLUME_PICKING_VERT_GLSL`)**: Generates normalized device coordinates $[-1, 1]$ directly from `gl_VertexID` without requiring vertex buffer allocations.
- **Raymarching Fragment Shader (`VOLUME_PICKING_FRAG_GLSL`)**:
  - Implements Smits-Kay slab intersection algorithm against normalized ocean domain $[0, 1]^3$ clamped to analytical 6-plane clipping box `[uClipMin, uClipMax]`.
  - Performs empty space skipping using `usampler3D uMaskTexture` (`0u = invalid/land/nodata/halo`).
  - Supports dual scalar textures: direct float (`r16f`/`r32f`) and quantized uint (`r16ui`) with in-shader software 8-tap trilinear filtering and affine de-quantization ($S = \text{float}(u) \cdot \text{scale} + \text{offset}$).
  - Detects first opaque voxel hit exceeding `uOpacityThreshold` and outputs:
    $$\text{fragColor} = \text{vec4}(u_{\text{hit}}, v_{\text{hit}}, w_{\text{hit}}, \text{scalar}_{\text{hit}})$$
  - Missing rays or invalid regions write $\text{vec4}(0.0, 0.0, 0.0, 0.0)$.

### 2.2 WebGL2 Volume Picker Engine (`packages/renderer-webgl2/src/picking/webgl2_volume_picker.ts`)
- **`WebGL2VolumePicker`**:
  - Sets up an offscreen Framebuffer Object (FBO) with a $1 \times 1$ `RGBA32F` (or `RGBA8` fallback) color texture attachment.
  - Packs uniform block `VolumePickingUniforms` (80 bytes, std140 layout) with ray origin, ray direction, step size, clip box, and scalar scale/offset.
  - Draws a single full-screen triangle into the $1 \times 1$ viewport with alpha blending and depth testing disabled.
  - Reads back hit data using `gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixelData)`.
  - Coordinates with `@quasar/runtime`'s `ProvisionalPickMapper` to translate $[u, v, w]$ into geodetic coordinates ($\text{lat}, \text{lon}, \text{depth}$), local ENU tangent coordinates, and constructs `ProvisionalRenderPickResponse` + `ReconcilePickRequest`.
  - Strictly manages resource lifecycle and throws `WebGL2ResourceDisposedError` upon use after disposal.

### 2.3 Authoritative Reconciliation Integration (`packages/renderer-webgl2/src/picking/reconciliation.ts`)
- **`reconcilePickWithBackend(pickInput, clientOrQueryClient, options)`**:
  - Accepts `WebGL2PickResult`, `ProvisionalPickResult`, or `ReconcilePickRequest`.
  - Dispatches `POST /api/v1/queries/reconcile-pick` to TASK-05 FastAPI service via `@quasar/client` (`QuasarQueryClient`).
  - Returns `UnifiedPickReconciliationResult` presenting side-by-side:
    1. **Provisional**: Approximate GPU rendered value, display units, LOD level, and error bound notice.
    2. **Authoritative**: Certified scientific ground truth from NetCDF source asset, canonical units, QC state, resolved coordinates, and SHA-256 provenance.
    3. **Comparison**: Absolute difference delta, relative percentage difference, and error bound verification.

### 2.4 Backend Adapter & Switcher (`packages/renderer-webgl2/src/adapter/backend_adapter.ts`)
- **`WebGL2BackendAdapter`**:
  - Implements backend adapter matching `@quasar/renderer-webgpu` interface.
  - Provides `probeBackends()` preflight routine to detect WebGPU and WebGL2 hardware capabilities.
  - Integrates `WebGL2ContextManager`, `WebGL2RaymarchingRenderer`, and `WebGL2VolumePicker`.

---

## 3. Automated Test Suite & Verification

The test suite `packages/renderer-webgl2/test/picking.test.ts` executes natively with Node test runner:

```text
? TASK-09D: WebGL2 Provisional Volume Picking Subsystem
  ? should compile GLSL ES 3.00 volume picking shader strings (0.4507ms)
  ? should execute WebGL2 picking pass, read back FBO pixel, and map hit to ProvisionalRenderPickResponse (1.2857ms)
  ? should return hit=false when ray misses volume (all zero pixel output) (0.1844ms)
  ? should throw WebGL2ResourceDisposedError when picking after dispose (0.4901ms)
? TASK-09D: WebGL2 Provisional Volume Picking Subsystem (3.1147ms)
? TASK-09D: WebGL2 Authoritative Reconciliation Client Integration
  ? should dispatch reconcile-pick query and synthesize unified reconciliation result for WebGL2 hit (19.7975ms)
  ? should probe backends in environment via WebGL2BackendAdapter (0.2568ms)
? TASK-09D: WebGL2 Authoritative Reconciliation Client Integration (20.2015ms)
? tests 6
? suites 2
? pass 6
? fail 0
? cancelled 0
? skipped 0
? todo 0
? duration_ms 211.5222
```

---

## 4. Deliverables & File Changes Summary

| Subsystem / File | Role & Functionality | Status |
|:---|:---|:---:|
| `packages/renderer-webgl2/src/shaders/volume_picking.glsl.ts` | GLSL ES 3.00 single-ray picking shaders ($1 \times 1$ FBO output) | **DELIVERED** |
| `packages/renderer-webgl2/src/shaders/index.ts` | Updated shader barrel exports | **DELIVERED** |
| `packages/renderer-webgl2/src/picking/webgl2_volume_picker.ts` | `WebGL2VolumePicker` engine with FBO readback & `ProvisionalPickMapper` | **DELIVERED** |
| `packages/renderer-webgl2/src/picking/reconciliation.ts` | Client integration for `POST /api/v1/queries/reconcile-pick` | **DELIVERED** |
| `packages/renderer-webgl2/src/picking/index.ts` | Picking subsystem barrel exports | **DELIVERED** |
| `packages/renderer-webgl2/src/adapter/backend_adapter.ts` | `WebGL2BackendAdapter` & capability probe | **DELIVERED** |
| `packages/renderer-webgl2/src/adapter/index.ts` | Adapter barrel exports | **DELIVERED** |
| `packages/renderer-webgl2/src/errors.ts` | Updated error hierarchy matching `ErrorModel.md` | **DELIVERED** |
| `packages/renderer-webgl2/src/index.ts` | Root barrel exports for `@quasar/renderer-webgl2` | **DELIVERED** |
| `packages/renderer-webgl2/test/picking.test.ts` | Unit test suite validating picking, readback, reconciliation, & probing | **DELIVERED** |

---

## 5. Completion Declaration

```text
TASK-09D COMPLETE — BACKEND FALLBACK AND PICKING VALIDATED
```
