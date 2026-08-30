# TASK-10A: Scientific UX and Application Architecture Preflight Report

**Milestone:** M4 — Full-Stack Integration & Operational UI  
**Task Identifier:** TASK-10A (Scientific UX and Application Architecture Preflight)  
**Status:** Complete — Scientific UI Architecture Approved  
**Date:** 2026-08-30  
**Role / Author:** Scientific UX and Application Architecture Lead  
**Governing Directives & Standards:** `AGENTS.md` (§ 1, § 2, § 3, § 6, § 7, § 8, § 9, § 10, § 11, § 13, § 14, § 15, § 16, § 18), `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`, `task_08r_webgpu_parallel_production_handoff_reconciliation_report.md`

---

## 1. Executive Summary & Objective

TASK-10A establishes the comprehensive technical and UX architecture for the **QuasarOS 3D OceanScope Application** (`apps/web/`). This specification provides the complete interface blueprint, state-machine choreography, scientific reconciliation mechanics, and accessibility compliance rules required to implement the user-facing operational client.

The application architecture enforces strict adherence to `AGENTS.md` governing principles:
1. **Zero Large Typed Arrays in React Component State:** Large volume buffers, page tables, and transfer-function lookup tables are strictly isolated within the renderer and `@quasar/runtime` engines.
2. **Authoritative vs. Provisional Render Pick Separation:** The UI cleanly separates provisional GPU ray-cast readouts (subject to 16-bit quantization and ray step interpolation) from authoritative canonical float32 values retrieved via the `/queries/value` REST endpoint.
3. **Operational Lineage & Provenance Traceability:** Complete operational data integrity is preserved, showcasing dataset versions, SHA-256 asset hashes, and E.U. Copernicus Marine Service attributions.
4. **WCAG 2.1 AA Accessibility Standards:** Strict keyboard-first interaction models, ARIA application roles, high-contrast colorbar swatches, and `prefers-reduced-motion` compliance.

---

## 2. Application Technology Stack & Topology

- **Location:** `apps/web/`
- **Framework:** React 18+ / Vite / TypeScript (ES2022)
- **Component & Design System:** Tailwind CSS + Astryx-compliant Scientific Design System primitives
- **Chart Engine:** Recharts / SVG for non-uniform vertical coordinate profile rendering
- **Engine Core Integrations:**
  - `@quasar/client`: Typed browser API facade, catalog search, exact-value queries, and HTTP/S3 stream management.
  - `@quasar/runtime`: Renderer-independent coordinate transformers (Geodetic ↔ ENU ↔ Normalized $[0, 1]^3$), 7-day temporal state controller, 6-plane clipping math, and residency planning.
  - `@quasar/renderer-webgpu` & `@quasar/renderer-webgl2`: Hardware-accelerated volume raymarching pipelines.

---

## 3. Core Scientific Layout Subsystems

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Application Header: Health Probe | Backend Switcher | Dataset & Snapshot | Geodetic Box  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌───────────────────────┐  ┌─────────────────────────────────┐  ┌────────────────────┐  │
│  │ Transfer Function     │  │                                 │  │ Scientific Pick    │  │
│  │ & Legend Panel        │  │     3D Volume Raymarching       │  │ & Reconciliation   │  │
│  │                       │  │         Canvas Viewport         │  │                    │  │
│  │ - Colormap Selector   │  │                                 │  │ - Cursor Geodetic  │  │
│  │ - Discrete Colorbar   │  │     (WebGPU / WebGL2 Auto)      │  │ - Prov vs Auth Δ   │  │
│  │ - Opacity Editor      │  │                                 │  │ - 31-Lvl Profile   │  │
│  ├───────────────────────┤  │                                 │  ├────────────────────┤  │
│  │ 6-Plane Clipping      │  │                                 │  │ Provenance Drawer  │  │
│  │ - Depth (0.49-453m)   │  │                                 │  │ - Source SHA-256   │  │
│  │ - Lon/Lat Sliders     │  │                                 │  │ - Copernicus Cite  │  │
│  └───────────────────────┘  └─────────────────────────────────┘  └────────────────────┘  │
│                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 7-Day Temporal Controller Bar: Play/Pause | Step Controls | Timeline Scrubber | Gen Tag  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Application Shell & Header Subsystem
- **Service Health Probe Indicator:** Real-time `/health/ready` probe indicator displaying backend connectivity, latency, and catalog synchronization state (`HEALTHY`, `DEGRADED`, `OFFLINE`).
- **Backend Capability Switcher:** Interactive dropdown (`Auto (WebGPU Preferred)` / `WebGPU` / `WebGL 2`) with live GPU adapter description and context loss status.
- **Dataset & Snapshot Navigator:** Pinned snapshot indicator (`copernicus-phy-thetao-20260824-20260830-ca826087`) with catalog exploration modal.
- **Spatial Bounds Display:** Fixed geodetic pill showing active domain: $\text{Lon: }[80.00^\circ\text{E}, 88.00^\circ\text{E}],\ \text{Lat: }[-3.00^\circ\text{N}, 12.00^\circ\text{N}],\ \text{Depth: }[0.494\,\text{m}, 453.938\,\text{m}]$.

### 3.2 7-Day Operational Temporal Controller Subsystem
- **Discrete Timestep Scrubbing:** 7 daily operational steps ($2026\text{-}08\text{-}24 \to 2026\text{-}08\text{-}30$).
- **Playback Controls:** Play/Pause button with configurable playback rate ($1\,\text{fps} \to 10\,\text{fps}$), Step Previous/Next buttons, and Jump to Start/End.
- **Request Cancellation & Generation Tracking:** Scrubbing increments `activeGeneration` in `VolumeRenderSession`. In-flight chunk streaming and Worker transfers from superseded timesteps are immediately aborted via `AbortController` (`AGENTS.md` § 16).

### 3.3 Scientific Transfer Function & Legend Panel
- **Colormap Palettes:** 4 perceptually uniform scientific colormaps (`Viridis`, `Plasma`, `Turbo`, `Thermal`).
- **Discrete Scientific Colorbar:** Dynamic scalar range display ($10.0^\circ\text{C} \to 32.0^\circ\text{C}$ for sea water potential temperature) with explicit unit annotations (`°C`), major tick labels, and dedicated swatches for `Land Mask` (Skipped / zero opacity) and `Missing Data` (Transparent / NaN).
- **Opacity Control Curve Editor:** Interactive multi-point curve allowing scientists to highlight specific isothermal layers or thermocline boundaries.

### 3.4 6-Plane Physical Clipping Panel
- **Depth Slider (Z-Axis):** Physical depth bounding sliders ($0.494\,\text{m} \to 453.938\,\text{m}$, positive downwards).
- **Geographic Sliders (X/Y-Axes):** Longitude ($80.0^\circ\text{E} \to 88.0^\circ\text{E}$) and Latitude ($-3.0^\circ\text{N} \to 12.0^\circ\text{N}$) clipping sliders.
- **Reset & Inversion Actions:** One-click reset to dataset extents; clipping inversion toggle to isolate sub-regions.

### 3.5 Scientific Inspection & Reconciliation Panel
- **Dual-State Value Inspection:**
  - *Provisional Render Pick:* Near-instant GPU ray-cast intersection returning geodetic coordinate, normalized scalar, and unquantized value with latency $< 16\,\text{ms}$.
  - *Authoritative Server Query:* Asynchronous point query dispatched to `/queries/value` returning lossless float32 precision, grid cell weights, and data quality flags.
- **Reconciliation Delta Display:** Shows absolute delta $|\Delta V| = |V_{\text{prov}} - V_{\text{auth}}|$ and relative error %, alerting the scientist if GPU step-size interpolation diverges from canonical values.
- **31-Level Vertical Profile Chart:** Interactive SVG chart displaying temperature vs. non-uniform Copernicus depth levels ($0.494\,\text{m} \to 453.938\,\text{m}$) at the picked coordinate.

### 3.6 Provenance & Lineage Drawer
- **Authoritative Lineage Readout:** Displays dataset version (`2025.04`), raw file name (`copernicus_phy_thetao_20260824_20260830.nc`), ingestion timestamp, source SHA-256 hash (`ca826087...`), and canonical store path.
- **Attribution & Licencing:** Formal E.U. Copernicus citation and Open Data licence notice.

---

## 4. Accessibility & WCAG 2.1 AA Compliance Policy

| Criterion | Implementation Specification |
|:---|:---|
| **Keyboard Navigation** | Timeline: `ArrowLeft`/`ArrowRight` to step, `Space` for play/pause, `Home`/`End` for bounds. Sliders: `Arrow` keys (1% step) and `PageUp`/`PageDown` (10% step). |
| **Focus Rings** | 2px solid `#38bdf8` high-contrast focus rings with 2px offset on all interactive elements. |
| **ARIA Roles** | Canvas: `role="application"` with dynamic `aria-label` describing active dataset and camera orientation. Sliders and timeline use standard `role="slider"`. |
| **Reduced Motion** | Honors `prefers-reduced-motion: reduce` by disabling camera smoothing, stopping auto-rotation, and snapping timeline steps instantaneously. |
| **Color Contrast** | Minimum 4.5:1 text contrast ratio against dark scientific viewport backdrop. High-contrast colormap legend toggle. |

---

## 5. Preflight Artifacts & Deliverables

1. **Preflight Manifest:** Delivered at `data/manifests/ui/task_10a_preflight.json` (Validated JSON-Schema).
2. **Architecture Specification:** Delivered at `task_10a_scientific_application_and_ux_architecture_report.md`.

---

## 6. Formal Completion Sign-Off

```text
TASK-10A COMPLETE — SCIENTIFIC UI ARCHITECTURE APPROVED
```
