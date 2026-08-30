# TASK-05T Immutable Visualization-Brick Transport Extension Report

**Task Identifier:** TASK-05T  
**Task Title:** Immutable Visualization-Brick Transport Extension  
**Role:** Backend Transport Engineer  
**Status:** TASK-05T COMPLETE — IMMUTABLE BRICK TRANSPORT VALIDATED  
**Completion Date:** 2026-08-30T15:45:00Z  
**Governing Architecture:** `AGENTS.md`, `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/ErrorModel.md`, `task_06a_browser_transport_and_streaming_preflight_report.md`  
**Active Operational Baseline:**
- **Snapshot ID:** `copernicus-phy-thetao-20260824-20260830-ca826087`
- **Visualization Product ID:** `vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087`
- **Visualization Product Root:** `data/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/`
- **Total Bricks & Payloads:** 63 bricks, 126 binary payload assets (63 Float16 `f16` + 63 Uint16 `u16`), 12.724 MiB total compressed storage

---

## 1. Executive Summary

TASK-05T implements the high-throughput, secure, immutable binary transport route for serving sub-volume 3D brick payloads (`.bin.zst`) in FastAPI, resolving the missing transport link identified in the TASK-06A Browser Streaming Preflight study.

This implementation provides:
1. **Immutable Binary Payload Route (`GET /api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{representation}`)**:
   - Direct streaming of zstd-compressed Half-Float (`f16`, `r16float`) and quantized normalized integer (`u16`, `r16uint`) 3D brick arrays.
   - Comprehensive HTTP caching headers: `Cache-Control: public, max-age=31536000, immutable`, `ETag: "<sha256>"`, `X-Payload-SHA256: "<sha256>"`, `X-Payload-Compressed-Bytes`, `X-Payload-Uncompressed-Bytes: 278784`, and `Accept-Ranges: bytes`.
   - Conditional request acceleration via `If-None-Match`, returning `304 Not Modified` with zero-byte payload bodies when cached assets match.
2. **Strict Security & Path Traversal Guards**:
   - Zero acceptance of user-controlled filesystem paths.
   - Bricks resolved exclusively through validated catalog manifests (`_visualization_bricks` dictionary indexing).
   - Multi-layer boundary checks ensuring resolved paths remain strictly within the validated visualization directory root.
   - Complete prevention of host filesystem path leakage in error responses, conforming to `docs/02-architecture/ErrorModel.md`.
3. **Automated OpenAPI 3.1 Specification & Zero Drift**:
   - Regenerated `schemas/openapi/openapi_v1.json` registering the new binary transport route with full parameter and response schemas.
   - Verified 100% schema synchronization across Pydantic models, JSON Schemas, and TypeScript interfaces (`python scripts/generate_schemas.py --verify`).
4. **Comprehensive Unit & Integration Test Suite (`tests/test_brick_transport.py`)**:
   - 9 automated test scenarios validating binary streaming, exact manifest hash conformance, conditional caching (304), representation filtering (400), non-existent asset handling (404), path traversal injection rejection, and zero path leakage.

---

## 2. Architecture & Implementation Details

### 2.1 Route Definition & Parameter Contract

| Parameter | Location | Type | Allowed Values / Format | Description |
|---|---|---|---|---|
| `product_id` | Path | `str` | e.g. `vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087` | Unique visualization product ID |
| `brick_key` | Path | `str` | e.g. `vis_copernicus_phy_thetao_...:v1:lod0:t0:bx0:by0:bz0:sea_water_potential_temperature` | Deterministic composite brick key |
| `representation` | Path | `str` | `f16`, `u16` | Data format discriminator (`f16` = `r16float`, `u16` = `r16uint`) |

### 2.2 HTTP Header Specifications

Responses returned from the endpoint include standard immutable asset headers:

```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Cache-Control: public, max-age=31536000, immutable
ETag: "77306967645596e515ed6af0a73c955e7b6b1fe9d24615e53faf632c1c999a00"
X-Payload-SHA256: 77306967645596e515ed6af0a73c955e7b6b1fe9d24615e53faf632c1c999a00
X-Payload-Compressed-Bytes: 104986
X-Payload-Uncompressed-Bytes: 278784
Accept-Ranges: bytes
```

When client sends `If-None-Match`:
```http
GET /api/v1/visualization-products/.../payloads/f16 HTTP/1.1
If-None-Match: "77306967645596e515ed6af0a73c955e7b6b1fe9d24615e53faf632c1c999a00"

HTTP/1.1 304 Not Modified
ETag: "77306967645596e515ed6af0a73c955e7b6b1fe9d24615e53faf632c1c999a00"
Cache-Control: public, max-age=31536000, immutable
X-Payload-SHA256: 77306967645596e515ed6af0a73c955e7b6b1fe9d24615e53faf632c1c999a00
```

### 2.3 Error Domain Classification (`docs/02-architecture/ErrorModel.md`)

| Scenario | HTTP Status | Error Code | Example Message |
|---|---|---|---|
| Invalid representation (`f32`, `raw`, etc.) | `400 Bad Request` | `RENDER_INVALID_REPRESENTATION` | `Representation 'f32' is invalid. Allowed values are 'f16' and 'u16'.` |
| Path traversal attack (`../`, `\`, etc.) | `400 Bad Request` | `VALIDATION_INVALID_INPUT` | `Path traversal or invalid characters detected in 'brick_key'` |
| Product ID not registered | `404 Not Found` | `RENDER_PRODUCT_NOT_FOUND` | `Visualization product 'vis_unknown' was not found.` |
| Brick key not in product inventory | `404 Not Found` | `RENDER_BRICK_NOT_FOUND` | `Brick '...' was not found in visualization product '...'.` |
| Payload file missing on disk | `404 Not Found` | `RENDER_PAYLOAD_NOT_FOUND` | `Binary payload file for brick '...' is unavailable on storage.` |

---

## 3. Files Created & Modified

### Created Files
- `tests/test_brick_transport.py`: Comprehensive test suite for immutable brick binary streaming.
- `task_05t_immutable_visualization_brick_transport_report.md`: This completion report.

### Modified Files
- `packages/services/src/quasar_services/catalog/errors.py`:
  - Added `BrickNotFoundException` (`RENDER_BRICK_NOT_FOUND`, 404).
  - Added `InvalidRepresentationException` (`RENDER_INVALID_REPRESENTATION`, 400).
  - Added `BrickPayloadNotFoundException` (`RENDER_PAYLOAD_NOT_FOUND`, 404).
- `packages/services/src/quasar_services/catalog/catalog_service.py`:
  - Added `_visualization_bricks` dictionary mapping `product_id -> brick_key -> brick_manifest_dict`.
  - Added `_visualization_product_dirs` mapping `product_id -> product_filesystem_path`.
  - Implemented `resolve_brick_payload(product_id, brick_key, representation)` with strict validation and containment checks.
- `packages/services/src/quasar_services/catalog/router.py`:
  - Mounted route `GET /api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{representation}`.
  - Implemented conditional ETag 304 handling and binary streaming response with exact headers.
- `docs/02-architecture/APIContracts.md`:
  - Updated Core resources table with `/visualization-products/{productId}/bricks/{brickKey}/payloads/{representation}`.
- `schemas/openapi/openapi_v1.json`:
  - Exported updated OpenAPI 3.1 schema (16 registered routes).

---

## 4. Verification & Testing Evidence

### 4.1 Test Execution Results

```powershell
$env:PYTHONPATH="packages/contracts/src;packages/services/src;packages/ingestion/src"
python -m unittest tests.test_brick_transport tests.test_catalog_service tests.test_exact_query_service
```

```text
Ran 31 tests in 0.633s
OK
```

#### Breakdown of `tests/test_brick_transport.py` (9 Tests):
1. `test_get_f16_brick_payload_success`: 200 OK, exact headers, exact compressed bytes length (104,986 bytes), SHA-256 digest match against manifest.
2. `test_get_u16_brick_payload_success`: 200 OK, exact headers, exact compressed bytes length (233,369 bytes), SHA-256 digest match against manifest.
3. `test_multiple_lod_and_timestep_bricks`: Verified multi-LOD (lod0, lod1, lod2) and multi-timestep payload fetches.
4. `test_if_none_match_conditional_304`: Verified 304 Not Modified response with empty body on matching quoted ETag, unquoted SHA, and wildcard `*`.
5. `test_invalid_representation_rejection`: Verified 400 Bad Request and `RENDER_INVALID_REPRESENTATION` on `f32`, `u8`, `raw`, `zstd`, `invalid`.
6. `test_nonexistent_product_id`: Verified 404 Not Found and `RENDER_PRODUCT_NOT_FOUND`.
7. `test_nonexistent_brick_key`: Verified 404 Not Found and `RENDER_BRICK_NOT_FOUND`.
8. `test_path_traversal_attempts_rejected`: Verified rejection of `../../../../etc/passwd`, `..\..\windows\win.ini`, and URL encoded sequences.
9. `test_zero_filesystem_path_leakage_in_error_detail`: Verified error details contain zero internal host directory paths (`C:\`, `/Users/`, etc.).

### 4.2 Schema Drift Verification

```powershell
python scripts/generate_schemas.py --verify
```
```text
[*] Verifying JSON Schemas against Pydantic models in C:\Users\Ranji\Downloads\ocanscope3d\schemas\canonical...
[+] Zero schema drift detected. All schemas are 100% synchronized with Pydantic contracts.
```

---

## 5. Downstream Readiness

TASK-05T unblocks the browser volume streaming client implementation in TASK-06B:
- Browser streaming client can now issue concurrent `GET` requests for immutable brick payloads against local FastAPI dev servers (`http://localhost:8000/api/v1/visualization-products/.../payloads/f16`).
- Browser cache layer can leverage standard browser HTTP caching and `ETag`/`304` mechanics.
- Web Worker decompression workers can directly consume the binary streams without intermediary payload repackaging.

---

## 6. Sign-off Status

**TASK-05T COMPLETE — IMMUTABLE BRICK TRANSPORT VALIDATED**
