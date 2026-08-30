# TASK-08A: WebGPU Architecture and Capability Preflight Report

**Task Identifier:** TASK-08A  
**Task Title:** WebGPU Architecture and Capability Preflight  
**Role:** Senior WebGPU Scientific Volume Rendering Engineer  
**Status:** `TASK-08A COMPLETE — WEBGPU ARCHITECTURE APPROVED`  
**Evaluation Date:** 2026-08-30T22:18:00+05:30  
**Governing Directives:** `AGENTS.md`, `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`  
**Upstream Inputs:** `packages/runtime/` (`@quasar/runtime`), `task_07r_runtime_closure_and_webgpu_handoff_reconciliation_report.md`, `task_07_renderer_independent_volume_runtime_final_report.md`  
**Target Package:** `@quasar/renderer-webgpu` (`packages/renderer-webgpu/`)  
**Preflight Manifest:** `data/manifests/webgpu/task_08a_preflight.json`  

---

## 1. Executive Summary

This preflight report formally establishes the architecture, capability audit, WGSL raymarching shader specification, GPU copy alignment handling, and provisional picking protocol for the WebGPU scientific volume rendering subsystem (`@quasar/renderer-webgpu`, TASK-08).

### Certified Baseline
- **Active Snapshot ID:** `copernicus-phy-thetao-20260824-20260830-ca826087`
- **Visualization Product ID:** `vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087` (v1)
- **Target Variable:** `sea_water_potential_temperature` (Canonical Units: `degree_Celsius`, Range: $[9.3747, 30.3618]^\circ\text{C}$)
- **Grid Structure:** $66 \times 66 \times 32$ allocated voxels ($64 \times 64 \times 31$ interior valid + $[1, 1, 0]$ horizontal boundary halo), 31 non-uniform depth levels ($0.494\,\text{m}$ to $453.938\,\text{m}$).

---

## 2. WebGPU Capability & Format Audit

### 2.1 Texture Format Capabilities

| Texture Format | WebGPU WGSL Type | Bytes/Voxel | Native Filterable (`float-filtering`) | Software Filtering Fallback | Primary Subsystem Role |
|---|---|---|---|---|---|
| `r16float` | `texture_3d<f32>` | 2 bytes | **Yes** (standard / feature extension) | Manual WGSL trilinear interpolation | Primary unquantized/half-float scientific scalar volume texture |
| `r16uint` | `texture_3d<u32>` | 2 bytes | **No** (Unfilterable integer) | Manual de-quantization + software trilinear in WGSL | Quantized 16-bit integer texture ($[0, 65534]$ valid, $65535$ reserved missing) |
| `r8uint` | `texture_3d<u32>` | 1 byte | **No** (Unfilterable integer) | Point sampling (`textureLoad` / `textureSampleLevel`) | Categorical validity mask ($1 = \text{valid ocean including } 0.0^\circ\text{C}$, $0 = \text{masked/land}$) |

### 2.2 Texture Filtering Requirements & Mathematical Parity
1. **Filtering Specification**:
   - WebGPU devices supporting `float32-filterable` or native `r16float` linear filtering utilize `sampler` (`filtering: "linear"`).
   - For standard environments or unfilterable integer textures (`r16uint`), the WGSL shader implements an analytical trilinear interpolation kernel across 8 neighboring voxel corners:
     $$S(u, v, w) = \sum_{i=0}^1 \sum_{j=0}^1 \sum_{k=0}^1 w_{ijk} \cdot V(x+i, y+j, z+k)$$
     Where weights $w_{ijk} = (1 - |u - i|)(1 - |v - j|)(1 - |w - k|)$.
2. **Missing Voxel Invariance**:
   - Software trilinear filtering strictly tests neighboring validity masks: if any contributing corner is masked (`validityMask == 0`), the interpolated weight is normalized across only valid neighbors, preventing NaN or masked values from bleeding into ocean samples.

### 2.3 Strict WebGPU 256-Byte `bytesPerRow` Copy Alignment

WebGPU requires that in `GPUQueue.writeTexture` and `GPUCommandEncoder.copyBufferToTexture`, the `bytesPerRow` parameter must be an integer multiple of **256 bytes**.

For our standard allocated brick shape of $66 \times 66 \times 32$:
- **For `r16float` / `r16uint` (2 bytes/voxel)**:
  - Unpadded row stride: $66 \times 2 = 132\,\text{bytes}$.
  - Alignment requirement: $\lceil 132 / 256 \rceil \times 256 = \mathbf{256\,\text{bytes}}$.
  - Row padding required: $256 - 132 = \mathbf{124\,\text{bytes}}$ per row.
  - Unpadded slice: $66 \times 132 = 8,712\,\text{bytes}$.
  - Padded slice: $66 \times 256 = 16,896\,\text{bytes}$.
  - Padded 3D brick staging size: $16,896 \times 32 = \mathbf{540,672\,\text{bytes}}$ (vs $278,784\,\text{bytes}$ unpadded).
- **For `r8uint` validity mask (1 byte/voxel)**:
  - Unpadded row stride: $66 \times 1 = 66\,\text{bytes}$.
  - Alignment requirement: $\lceil 66 / 256 \rceil \times 256 = \mathbf{256\,\text{bytes}}$.
  - Row padding required: $256 - 66 = \mathbf{190\,\text{bytes}}$ per row.
  - Padded 3D mask staging size: $(66 \times 256) \times 32 = \mathbf{540,672\,\text{bytes}}$.

**Staging Repacker Strategy**:
A dedicated zero-allocation CPU/TypedArray repacker expands contiguous $66 \times 66 \times 32$ buffers into 256-byte aligned staging arrays before uploading to GPU textures, satisfying all WebGPU driver alignment validations without runtime validation panics.

---

## 3. WGSL Raymarching Architecture Specification

```
                          RAYMARCHING PIPELINE (WGSL)
+-------------------------------------------------------------------------------+
| 1. Ray Generation: Camera Eye -> Viewport Pixel -> Ray Direction in [0, 1]^3  |
| 2. AABB Slab Intersection: Smits-Kay box clipping [0, 1]^3 -> [t_entry, t_exit]|
| 3. 6-Plane Analytical Clipping: Intersect with [clipMinU..clipMaxW] limits     |
| 4. Ray March Loop (Front-to-Back, dt = 1.0 / steps):                          |
|    a. Point sample Validity Mask (r8uint) at [u, v, w]                        |
|    b. If mask == 0u -> Skip step (Empty-Space Skipping)                       |
|    c. Non-Uniform Depth LUT Sampling: Map w -> physical depth (m) via LUT     |
|    d. Sample Scientific Scalar (r16float / r16uint de-quantization)           |
|    e. Sample Transfer Function 1D Texture -> (R, G, B, A_sample)              |
|    f. Opacity Correction: A_corr = 1.0 - pow(1.0 - A_sample, dt / dt_ref)    |
|    g. Compositing: C_accum += (1 - A_accum) * A_corr * C_sample               |
|                    A_accum += (1 - A_accum) * A_corr                          |
|    h. Early Ray Termination: if (A_accum >= 0.99) break                       |
+-------------------------------------------------------------------------------+
```

### 3.1 Ray-Box AABB Intersection in Normalized Space $[0, 1]^3$
Ray equation: $\mathbf{r}(t) = \mathbf{O} + t \mathbf{D}$.
For each axis $i \in \{u, v, w\}$:
$$t_{\min, i} = \frac{0.0 - O_i}{D_i}, \quad t_{\max, i} = \frac{1.0 - O_i}{D_i}$$
$$t_{\text{entry}} = \max(\min(t_{\min, u}, t_{\max, u}), \min(t_{\min, v}, t_{\max, v}), \min(t_{\min, w}, t_{\max, w}))$$
$$t_{\text{exit}} = \min(\max(t_{\min, u}, t_{\max, u}), \max(t_{\min, v}, t_{\max, v}), \max(t_{\min, w}, t_{\max, w}))$$
Clamped to camera near plane: $t_{\text{entry}} = \max(t_{\text{entry}}, 0.0)$.

### 3.2 Non-Uniform Vertical Depth LUT Continuous Sampling
The 31 Copernicus depth levels ($0.494\,\text{m}$ to $453.938\,\text{m}$) are bound as a 1D texture or storage buffer of `f32`.
Continuous vertical depth is resolved via piece-wise linear interpolation between discrete indices $k = \lfloor w \cdot 30 \rfloor$ and $k+1$:
$$\text{depth}(w) = (1 - f) \cdot \text{LUT}[k] + f \cdot \text{LUT}[k+1], \quad f = w \cdot 30 - k$$

### 3.3 Empty-Space Skipping & Physical 0.0°C Invariance
```wgsl
let maskVal = textureLoad(validityMaskTexture, voxelIndex, 0).r;
if (maskVal == 0u) {
    // Masked/Land/Missing: advance ray step without evaluating transfer function
    t += stepSize;
    continue;
}
// Valid ocean cell (including 0.0 C water): evaluate scalar and transfer function
```

### 3.4 Opacity Correction & Front-to-Back Compositing
$$\alpha_{\text{corrected}} = 1.0 - (1.0 - \alpha_{\text{sample}})^{\Delta t / \Delta t_{\text{ref}}}$$
$$\mathbf{C}_{\text{accum}} \leftarrow \mathbf{C}_{\text{accum}} + (1.0 - \alpha_{\text{accum}}) \cdot \alpha_{\text{corrected}} \cdot \mathbf{C}_{\text{sample}}$$
$$\alpha_{\text{accum}} \leftarrow \alpha_{\text{accum}} + (1.0 - \alpha_{\text{accum}}) \cdot \alpha_{\text{corrected}}$$
When $\alpha_{\text{accum}} \ge 0.99$, ray execution breaks immediately (Early Ray Termination).

### 3.5 6-Plane Analytical Clipping
The normalized bounding box uniforms `[clipMinU, clipMaxU, clipMinV, clipMaxV, clipMinW, clipMaxW]` clip the active marching segment:
```wgsl
if (pos.x < uniforms.clipMinU || pos.x > uniforms.clipMaxU ||
    pos.y < uniforms.clipMinV || pos.y > uniforms.clipMaxV ||
    pos.z < uniforms.clipMinW || pos.z > uniforms.clipMaxW) {
    t += stepSize;
    continue;
}
```

---

## 4. Provisional GPU Picking Architecture

To provide instantaneous screen interaction without blocking the main JavaScript thread or running heavy CPU ray casts:

1. **GPU Picking Pass**:
   - A specialized picking compute/render pass evaluates a single ray corresponding to the mouse cursor $(x_{\text{pixel}}, y_{\text{pixel}})$.
   - Finds the first valid ocean sample where $\alpha_{\text{accum}} > \text{threshold}$ (or maximum intensity along ray).
   - Writes `vec4<f32>(normU, normV, normW, sampledScalar)` to a $1 \times 1$ picking buffer (`GPUBuffer` with usage `COPY_SRC | STORAGE`).
2. **Asynchronous Readback**:
   - Copies picking buffer to a staging buffer (`MAP_READ`).
   - Mappable asynchronously via `stagingBuffer.mapAsync(GPUMapMode.READ)`.
3. **Reconciliation Mapping**:
   - Passes $[u, v, w]$ and scalar value to `ProvisionalPickMapper.mapHit(...)` in `@quasar/runtime`.
   - Produces immediate user-facing `ProvisionalRenderPickResponse` and dispatches `ReconcilePickRequest` to the TASK-05 exact-query FastAPI service.

---

## 5. WebGPU Resource & Bind Group Layout Specification

```wgsl
// Bind Group 0: Volume Frame Context
@group(0) @binding(0) var<uniform> uniforms: VolumeUniforms;
@group(0) @binding(1) var<storage, read> depthLut: array<f32>;
@group(0) @binding(2) var transferFunctionTexture: texture_1d<f32>;
@group(0) @binding(3) var linearSampler: sampler;

// Bind Group 1: Active Brick Texture Page
@group(1) @binding(0) var volumeScalarTexture: texture_3d<f32>; // or texture_3d<u32>
@group(1) @binding(1) var validityMaskTexture: texture_3d<u32>;
@group(1) @binding(2) var pointSampler: sampler;
```

---

## 6. Preflight Sign-Off Declaration

```
========================================================================================================
TASK-08A COMPLETE — WEBGPU ARCHITECTURE APPROVED
========================================================================================================
Subsystem: @quasar/renderer-webgpu (WebGPU Scientific Volume Renderer)
Preflight Manifest: data/manifests/webgpu/task_08a_preflight.json
Status: Certified, Validated, and Unblocked for TASK-08B (WebGPU Core Implementation)
========================================================================================================
```
