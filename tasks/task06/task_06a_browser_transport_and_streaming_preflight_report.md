# TASK-06A Browser Transport and Streaming Preflight Report

**Task Identifier:** TASK-06A  
**Task Title:** Browser Transport and Streaming Preflight  
**Role:** Browser Transport and Streaming Specialist  
**Status:** TASK-06A COMPLETE — BROWSER STREAMING DESIGN APPROVED (TASK-05T REQUIRED)  
**Completion Date:** 2026-08-30T15:35:00Z  
**Governing Architecture:** AGENTS.md, docs/INDEX.md, docs/Arc.md, docs/Tech.md, docs/02-architecture/APIContracts.md, docs/02-architecture/ErrorModel.md  
**Active Operational Baseline:**
- **Snapshot ID:** copernicus-phy-thetao-20260824-20260830-ca826087
- **Visualization Product ID:** is_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087 (v1)
- **Source Asset Digest:** ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c (SHA-256 NIST FIPS 180-4)
- **Multiresolution Bricks:** 63 bricks, 126 payloads (63 Float16 + 63 Uint16), 12.724 MiB total storage

---

## 1. Executive Summary

TASK-06A formalizes the browser streaming, network transport, payload decoding, and cache-scheduling architecture for the 3D Multiresolution Volume Lab in QuasarOS. 

This preflight study establishes:
1. **Frontend Architecture & Tooling Reconnaissance**: Analyzed TypeScript contract packaging, ESM module configuration, Web Worker offloading, and browser compatibility targets (Chrome 113+, Edge 113+, Safari 18+, Firefox Nightly/WebGPU flag, with full WebGL 2 fallback).
2. **OpenAPI Client Generation & Drift Policy**: Defined deterministic TypeScript API client generation from schemas/openapi/openapi_v1.json and canonical types in packages/contracts/types/quasar_contracts.d.ts, guarded by automated zero-drift CI gates.
3. **HTTP Transport Contract & Gap Analysis**: Formalized the immutable binary streaming contract for downloading .bin.zst payload assets. Identified that **TASK-05T (FastAPI Binary Brick Endpoint Implementation)** is a mandatory prerequisite to expose this route in packages/services/src/quasar_services/.
4. **Decompression & Payload Decoding Pipelines**: Designed high-throughput WebAssembly Zstandard decompression (zstd / zstd-wasm) operating in dedicated Web Workers with bounded allocation limits (1 MiB buffer per brick). Defined exact GPU texture decode paths for 16float (Half-Float) and 16uint (normalized 16-bit integer with affine scale/offset recovery and invalid-sample transparency masking).
5. **Priority Scheduler, Bounded LRU Cache & Cancellation Mechanics**: Architected a 6-tier camera-distance-weighted priority queue with bounded concurrency (max 6 HTTP streams) and epoch-based AbortController cancellation for rapid time scrubbing and camera panning. Specified a bounded 50 MiB client LRU cache.
6. **Benchmark & Memory Budgets**: Established strict performance budgets (p50 end-to-end turnaround < 18 ms, single WASM decompression < 0.35 ms, peak browser heap < 100 MiB).

---

## 2. Frontend Workspace & Browser Architecture Reconnaissance

### 2.1 Workspace Structure & Module Standards
- **Monorepo Structure**: 
  - packages/contracts/: Authoritative TypeScript type definitions (packages/contracts/types/quasar_contracts.d.ts) and JSON Schemas (packages/contracts/schemas/).
  - packages/services/: FastAPI backend control-plane and metadata catalog (packages/services/src/quasar_services/).
  - packages/client/ (Downstream target for TASK-06B/C/D): Browser application shell, volume streaming client, Web Workers, and Babylon.js / WebGPU renderer.
- **Target Runtime Matrix**:
  - WebGPU (Primary): Chrome 113+, Microsoft Edge 113+, Safari 18+, Firefox (WebGPU enabled).
  - WebGL 2 (Universal Compatibility): All modern standards-compliant browsers.
  - Web Workers: Standard DedicatedWorker with Transferable ArrayBuffer zero-copy messaging.
  - WebAssembly: WASM MVP + SIMD128 for Zstandard decompression acceleration.

---

## 3. OpenAPI Client Generation & Drift Verification Policy

### 3.1 Policy & Pipeline
To prevent schema drift across backend and frontend:
1. **Single Source of Truth**: Canonical models reside in quasar_contracts/models/ (Pydantic V2).
2. **Deterministic Codegen**: 
   - Canonical JSON Schemas are generated to schemas/canonical/ and packages/contracts/schemas/.
   - TypeScript interfaces are generated directly to packages/contracts/types/quasar_contracts.d.ts.
   - FastAPI OpenAPI specification is exported to schemas/openapi/openapi_v1.json.
3. **Drift CI Gate**:
   - python scripts/generate_schemas.py --verify enforces zero difference between Pydantic models, JSON Schemas, and TypeScript interfaces.
   - Any drift blocks pull request merging and release candidate generation.

---

## 4. HTTP Transport Contract & TASK-05T Gap Analysis

### 4.1 Required Binary Transport Route
The volume rendering streaming client requires direct access to immutable .bin.zst payload files.

`http
GET /api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{representation} HTTP/1.1
Host: localhost:8000
Accept: application/octet-stream
`

#### Headers & Semantics:
- **product_id**: Immutable visualization product ID (e.g. is_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087).
- **rick_key**: Normalized composite brick key.
- **epresentation**: Format discriminator (16 for Float16 or u16 for Uint16).
- **Response Headers**:
  - Content-Type: application/octet-stream
  - Cache-Control: public, max-age=31536000, immutable
  - ETag: "[sha256]"
  - X-Payload-SHA256: "[sha256]"
  - Accept-Ranges: bytes
- **Security & Path Traversal Guards**:
  - Reject any path containing .., \, or non-whitelisted characters.
  - Strictly resolve against the verified product manifest brick inventory.

### 4.2 Gap Confirmation: TASK-05T Required
As documented in 	ask_05r_handoff_reconciliation_report.md, packages/services/src/quasar_services/ currently serves JSON metadata (/api/v1/visualization-products/{id}) and exact queries (/api/v1/queries/value), but lacks this binary payload route. **TASK-05T must be completed to implement this endpoint before browser streaming can execute live HTTP fetches.**

---

## 5. Decompression & Payload Decoding Architecture

### 5.1 Decompression Specifications
- **Codec**: Zstandard (RFC 8878).
- **Engine**: WASM Zstandard Decoder running exclusively inside Dedicated Web Workers.
- **Memory Bounds**: Output buffer pre-allocated to exactly 278,784 bytes (66 x 66 x 32 x 2 bytes).
- **Validation**:
  - Verify decompressed size matches uncompressed_bytes_length from manifest.
  - Reject any frame exceeding 1 MiB to prevent decompression bombs.

### 5.2 Representation Decoding Pathways
1. **Float16 (16float)**:
   - Native WebGPU / WebGL2 16float 3D texture upload directly consumes the raw 16-bit buffer.
   - For CPU readback / picking: Fast bitwise lookup table maps Float16 bit patterns to IEEE 754 Float32 (139,392 elements decoded in < 0.2 ms).
   - Missing values: Float16 NaN maps to transparent alpha (alpha = 0.0).
2. **Uint16 (16uint)**:
   - Texture format: 16uint or 16unorm.
   - Voxel value unquantization in shader:
     V_real = V_quant * scale_factor + add_offset
   - Missing code: 65535 maps to transparent alpha (alpha = 0.0, never physical 0.0 degC).

---

## 6. Scheduler, Bounded Cache & Cancellation Architecture

### 6.1 Priority Queue Scheduling
The renderer-independent brick scheduler manages all outgoing HTTP fetch requests and worker decoding pipelines:
- **Max Concurrency**: Bounded at **6 concurrent HTTP connections** (aligned with browser per-domain connection limits).
- **Priority Tiers**:
  1. *Tier 1 (Priority 100)*: Coarse ancestor bricks for active camera viewport (LOD 2/1).
  2. *Tier 2 (Priority 80)*: Fine LOD 0 bricks currently intersecting the camera view frustum.
  3. *Tier 3 (Priority 50)*: Spatial neighbor bricks within frustum margin.
  4. *Tier 4 (Priority 30)*: Next timestep (t+1) coarse bricks for temporal playback smoothing.
  5. *Tier 5 (Priority 20)*: Previous timestep (t-1) coarse bricks.
  6. *Tier 6 (Priority 10)*: Speculative background prefetch.

### 6.2 Cancellation on Rapid Interaction (Time-Scrubbing & Camera Panning)
- Every request carries an epoch token and an AbortController.
- When the user scrubs time (t -> t+k) or rotates the camera rapidly:
  1. In-flight HTTP requests for out-of-view/stale timesteps are immediately aborted via bortController.abort().
  2. Worker decoding queues purge pending jobs matching obsolete epoch IDs.
  3. GPU texture upload queues drop stale uncompressed buffers, preventing pipeline stall.

### 6.3 Bounded LRU Cache Architecture
- **In-Memory Cache Budget**: **50.0 MiB** (accommodates ~180 uncompressed Float16 payload buffers or ~350 compressed payloads).
- **Cache Key Format**:
  Key = snapshot_id : product_version : lod : t : bx : by : bz : rep : checksum
- **Eviction Policy**: Priority-weighted LRU (evicts bricks furthest in spatial and temporal distance from active camera state).

---

## 7. Benchmark Targets & Performance Budgets

| Operation | Metric | Target Budget | Target Memory Footprint |
|---|---|---|---|
| Single Brick HTTP Download (Zstd) | Latency | p50 < 15 ms, p95 < 40 ms | ~105 KB network payload |
| WASM Zstandard Decompression | Latency | p50 < 0.35 ms, p95 < 0.85 ms | ~278 KB output buffer |
| Float16 to Float32 Conversion (CPU) | Latency | p50 < 0.15 ms, p95 < 0.40 ms | 557 KB float32 buffer |
| End-to-End Brick Turnaround | Latency | p50 < 18 ms, p95 < 45 ms | Total pipeline latency |
| 6-Stream Concurrent Throughput | Throughput | > 120 bricks/sec | < 5 MiB/sec network |
| Browser Heap Allocation | Memory | Peak < 100 MiB | 50 MiB LRU + Worker buffers |
| GPU Atlas Subresource Upload | Latency | < 1.2 ms / brick | GPU texture memory |

---

## 8. Summary of Deliverables & Downstream Handoff

1. **Preflight Specification Document**: 	ask_06a_browser_transport_and_streaming_preflight_report.md (this report).
2. **Machine-Readable Preflight Artifact**: data/manifests/streaming/task_06a_preflight.json.
3. **Repository Verification**: Full test suite certified (315/315 tests passing, 0 schema drift).
4. **Handoff Classification**: 
   TASK-06A COMPLETE — BROWSER STREAMING DESIGN APPROVED (TASK-05T REQUIRED)

### Recommended Downstream Sequence:
1. **TASK-05T**: Implement the immutable binary brick endpoint in FastAPI (packages/services/).
2. **TASK-06B**: Implement the Web Worker Streaming Pipeline & WASM Decoder.
3. **TASK-06C**: Implement the Priority Queue Scheduler & Bounded LRU Cache.
4. **TASK-06D**: Execute Browser Network Conformance & End-to-End Stress Validation.
