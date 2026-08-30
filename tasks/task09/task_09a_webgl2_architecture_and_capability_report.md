# TASK-09A: WebGL2 Architecture and Capability Preflight Report

**Milestone:** M3 — WebGL2 Scientific Volume Rendering Subsystem  
**Task Identifier:** TASK-09A (WebGL2 Architecture and Capability Preflight)  
**Role:** WebGL2 Architecture and Capability Lead  
**Status:** `TASK-09A COMPLETE — WEBGL2 ARCHITECTURE APPROVED`  
**Date:** 2026-08-30T22:35:00+05:30  
**Directives & Standards:** `AGENTS.md` (§ 1, § 2, § 3, § 6, § 7, § 8, § 9, § 10, § 11, § 13, § 14, § 15, § 18), `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`  
**Upstream Inputs:** `packages/renderer-webgpu/`, `packages/runtime/`, `task_08r_webgpu_parallel_production_handoff_reconciliation_report.md`  
**Target Package:** `@quasar/renderer-webgl2` (`packages/renderer-webgl2/`)  
**Preflight Manifest:** `data/manifests/webgl2/task_09a_preflight.json`  

---

## 1. Executive Summary

TASK-09A establishes the authoritative architectural blueprint, texture format fallback matrix, GLSL ES 3.00 raymarching shader specification, depth coordinate reconstruction, Beer-Lambert step-size opacity correction, empty-space skipping, and provisional picking protocol for the WebGL2 rendering subsystem (`@quasar/renderer-webgl2`).

This ensures complete mathematical, scientific, and behavioral parity between the WebGPU production renderer (`@quasar/renderer-webgpu`) and the WebGL2 fallback renderer (`@quasar/renderer-webgl2`) as governed by `AGENTS.md` § 9 and § 10.

### Certified Baseline
- **Active Snapshot ID:** `copernicus-phy-thetao-20260824-20260830-ca826087`
- **Visualization Product ID:** `vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087` (v1)
- **Target Variable:** `sea_water_potential_temperature` (Canonical Units: `degree_Celsius`, Range: $[9.3747, 30.3618]^\circ\text{C}$)
- **Grid Structure:** $66 \times 66 \times 32$ allocated voxels ($64 \times 64 \times 31$ interior valid + $[1, 1, 0]$ horizontal halo), 31 non-uniform Copernicus depth levels ($0.494\,\text{m}$ to $453.938\,\text{m}$).

---

## 2. WebGL2 Package Architecture & Module Layout

The package `@quasar/renderer-webgl2` (`packages/renderer-webgl2/`) is structured with strict separation of concerns, zero UI/DOM contamination, and direct integration with `@quasar/runtime` and `@quasar/client`:

```text
packages/renderer-webgl2/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Public barrel export
│   ├── types.ts                  # WebGL2 types, context interfaces, configs
│   ├── errors.ts                 # Standardized RENDER_* WebGL2 error hierarchy
│   ├── context/
│   │   ├── index.ts              # Context management exports
│   │   ├── gl_context.ts         # WebGL2 context acquisition & extension probes
│   │   └── capabilities.ts       # Hardware limits & extension registry
│   ├── resources/
│   │   ├── index.ts              # Resource management exports
│   │   ├── texture_3d.ts         # 3D scalar & mask texture allocation & uploading
│   │   ├── depth_lut.ts          # 1D Depth LUT texture / UBO management
│   │   ├── transfer_function.ts  # 256x1 RGBA colormap texture manager
│   │   └── budget_tracker.ts     # 50 MiB GPU texture memory enforcement
│   ├── shaders/
│   │   ├── index.ts              # GLSL ES 3.00 shader string exports
│   │   ├── raymarch.vert.glsl.ts # Fullscreen triangle vertex shader
│   │   ├── raymarch.frag.glsl.ts # Core volume raymarching fragment shader
│   │   └── picking.frag.glsl.ts  # Single-ray picking fragment shader
│   ├── pipeline/
│   │   ├── index.ts              # Pipeline exports
│   │   ├── program.ts            # Shader program compilation & uniform link
│   │   ├── uniform_buffer.ts     # UBO binding & uniform packing
│   │   └── raymarching_renderer.ts # Main WebGL2 render pass execution
│   └── picking/
│       ├── index.ts              # Picking exports
│       ├── webgl2_picker.ts      # Offscreen FBO single-pixel readback
│       └── reconciliation.ts     # Integration with ProvisionalPickMapper
└── test/
    ├── context_capabilities.test.ts
    ├── resources_upload.test.ts
    ├── raymarching_pipeline.test.ts
    └── picking_readback.test.ts
```

---

## 3. WebGL2 Texture Format Selection & Fallback Matrix

WebGL2 core specifications provide built-in 3D textures (`gl.TEXTURE_3D`, `gl.texStorage3D`, `gl.texSubImage3D`). The texture formats and fallback mechanisms are defined as follows:

| Texture Role | Target Format | Internal Format | Format / Type | Filtering Mode | Fallback / Software Strategy |
|:---|:---|:---|:---|:---|:---|
| **Float16 Scalar Volume** | `r16f` | `gl.R16F` | `gl.RED`, `gl.HALF_FLOAT` | Linear (`OES_texture_float_linear` / `EXT_color_buffer_half_float`) | Manual 8-tap trilinear interpolation in GLSL when linear filtering extension is unsupported |
| **Quantized Uint16 Scalar Volume** | `r16ui` | `gl.R16UI` | `gl.RED_INTEGER`, `gl.UNSIGNED_SHORT` | Nearest | In-shader affine de-quantization: $S = \text{float}(u) \cdot \text{scale} + \text{offset}$ with manual GLSL trilinear filtering |
| **Validity Mask** | `r8ui` | `gl.R8UI` | `gl.RED_INTEGER`, `gl.UNSIGNED_BYTE` | Nearest (`gl.NEAREST`) | Point sampling via `texelFetch` / `texture` for empty-space skipping |
| **Transfer Function** | `rgba8` | `gl.RGBA8` | `gl.RGBA`, `gl.UNSIGNED_BYTE` | Linear (`gl.LINEAR`), Clamp (`gl.CLAMP_TO_EDGE`) | Standard 2D $256 \times 1$ texture |
| **Copernicus Depth LUT** | `r32f` | `gl.R32F` or UBO | `gl.RED`, `gl.FLOAT` | Nearest / Uniform Array | Array of 31 floats representing standard vertical levels ($0.494\,\text{m}$ to $453.938\,\text{m}$) |

### 3.1 Software Trilinear Interpolation Math in GLSL ES 3.00
For unfilterable `r16ui` or non-extended `r16f`, the fragment shader performs software 8-tap trilinear interpolation:
```glsl
float sampleTrilinearScalar(usampler3D tex, vec3 coord, vec3 texSize, float scale, float offset) {
    vec3 pos = coord * texSize - 0.5;
    vec3 i0 = floor(pos);
    vec3 f = fract(pos);
    ivec3 c000 = ivec3(i0);
    
    float v000 = float(texelFetch(tex, c000 + ivec3(0,0,0), 0).r) * scale + offset;
    float v100 = float(texelFetch(tex, c000 + ivec3(1,0,0), 0).r) * scale + offset;
    float v010 = float(texelFetch(tex, c000 + ivec3(0,1,0), 0).r) * scale + offset;
    float v110 = float(texelFetch(tex, c000 + ivec3(1,1,0), 0).r) * scale + offset;
    float v001 = float(texelFetch(tex, c000 + ivec3(0,0,1), 0).r) * scale + offset;
    float v101 = float(texelFetch(tex, c000 + ivec3(1,0,1), 0).r) * scale + offset;
    float v011 = float(texelFetch(tex, c000 + ivec3(0,1,1), 0).r) * scale + offset;
    float v111 = float(texelFetch(tex, c000 + ivec3(1,1,1), 0).r) * scale + offset;
    
    float v00 = mix(v000, v100, f.x);
    float v10 = mix(v010, v110, f.x);
    float v01 = mix(v001, v101, f.x);
    float v11 = mix(v011, v111, f.x);
    
    float v0 = mix(v00, v10, f.y);
    float v1 = mix(v01, v11, f.y);
    
    return mix(v0, v1, f.z);
}
```

---

## 4. GLSL ES 3.00 Raymarching Architecture Specification

```
                         WEBGL2 RAYMARCHING PIPELINE
+-------------------------------------------------------------------------------+
| 1. Ray Origin & Direction: Camera Eye & Unprojected Frustum in [0, 1]^3       |
| 2. Smits-Kay Ray-AABB Slab Intersection: [0, 1]^3 -> [tNear, tFar]           |
| 3. 6-Plane Analytical Clipping: Clamp [tNear, tFar] against [uClipMin..uClipMax]|
| 4. Front-to-Back Raymarching Loop (dt = uStepSize):                           |
|    a. Point-sample r8ui validity mask at current position                     |
|    b. If mask == 0u -> Skip sample (Empty-Space Skipping)                     |
|    c. Non-Uniform Depth LUT Sampling: piecewise linear mix across 31 levels    |
|    d. Scalar Sampling (r16f or r16ui de-quantization)                         |
|    e. Transfer Function LUT (256x1 RGBA) -> sampleColor                       |
|    f. Beer-Lambert Opacity Correction:                                        |
|       alphaCorr = 1.0 - pow(max(0.0, 1.0 - sampleColor.a), dt / uRefStepSize) |
|    g. Front-to-back accumulation:                                             |
|       accumColor += (1.0 - accumAlpha) * alphaCorr * sampleColor.rgb          |
|       accumAlpha += (1.0 - accumAlpha) * alphaCorr                            |
|    h. Early Ray Termination: if (accumAlpha >= 0.95) break;                   |
+-------------------------------------------------------------------------------+
```

### 4.1 Smits-Kay Ray-AABB Intersection
```glsl
bool intersectBox(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax, out float tNear, out float tFar) {
    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    tNear = max(max(tmin.x, tmin.y), tmin.z);
    tFar = min(min(tmax.x, tmax.y), tmax.z);
    tNear = max(0.0, tNear);
    return tNear <= tFar && tFar > 0.0;
}
```

### 4.2 Non-Uniform Vertical Depth LUT Continuous Reconstruction
Continuous depth reconstruction in GLSL ES 3.00 evaluates:
```glsl
float getPhysicalDepth(float normalizedW, int depthCount, float depthLevels[31]) {
    if (depthCount < 2) return normalizedW;
    float maxIdx = float(depthCount - 1);
    float continuousIdx = clamp(normalizedW * maxIdx, 0.0, maxIdx);
    int lowerIdx = int(floor(continuousIdx));
    int upperIdx = min(depthCount - 1, lowerIdx + 1);
    float frac = continuousIdx - float(lowerIdx);
    return mix(depthLevels[lowerIdx], depthLevels[upperIdx], frac);
}
```

### 4.3 Opacity Correction & Early Ray Termination
Identical Beer-Lambert formulation matching WebGPU:
$$\alpha_{\text{corr}} = 1.0 - (1.0 - \alpha_{\text{sample}})^{\frac{\Delta t}{\Delta t_{\text{ref}}}}$$
Compositing loop executes with strict early termination at $\alpha_{\text{acc}} \ge 0.95$.

---

## 5. Provisional Picking in WebGL2

WebGL2 provisional picking executes a dedicated single-pixel pass:
1. An offscreen Framebuffer Object (FBO) with an `RGBA32F` (or packed `RGBA8`) color attachment is bound.
2. A single-pixel scissor box / viewport (`1x1`) is configured at the target cursor coordinate.
3. The picking fragment shader marches the ray until the first valid volume hit (`mask == 1u` and `scalar >= uScalarMin`), writing:
   $$\text{gl\_FragColor} = \text{vec4}(u_{\text{hit}}, v_{\text{hit}}, w_{\text{hit}}, \text{scalar}_{\text{hit}})$$
4. Synchronous or PBO-backed readback via `gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, pixelData)` retrieves the normalized coordinate and sampled scalar.
5. The result is passed to `@quasar/runtime`'s `ProvisionalPickMapper.mapHit()`, yielding:
   - `ProvisionalRenderPickResponse`: Instant approximate UI feedback.
   - `ReconcilePickRequest`: Exact geographic query payload for authoritative backend verification.

---

## 6. Preflight Sign-Off & Release Declaration

| Requirement | Specification | Status |
|:---|:---|:---:|
| Package Scope | `@quasar/renderer-webgl2` in `packages/renderer-webgl2/` | **APPROVED** |
| Texture Formats | `gl.R16F`, `gl.R16UI`, `gl.R8UI`, `gl.RGBA8`, `gl.R32F` Depth LUT | **APPROVED** |
| Raymarching Math | Smits-Kay AABB, 6-plane clipping, Beer-Lambert correction | **APPROVED** |
| Depth Coordinates | 31-level Copernicus non-uniform depth LUT interpolation | **APPROVED** |
| Empty-Space Skipping| `gl.R8UI` mask check with physical $0.0^\circ\text{C}$ preservation | **APPROVED** |
| Provisional Picking | `gl.readPixels` offscreen pass $\to$ `ProvisionalPickMapper` | **APPROVED** |
| Memory Limits | Hard 50 MiB GPU texture memory budget | **APPROVED** |
| Machine Manifest | `data/manifests/webgl2/task_09a_preflight.json` | **DELIVERED** |

```text
TASK-09A COMPLETE — WEBGL2 ARCHITECTURE APPROVED
```
