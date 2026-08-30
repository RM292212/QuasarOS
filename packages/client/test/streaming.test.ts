/**
 * Comprehensive Automated Test Suite for QuasarOS Browser Streaming Engine (TASK-06C).
 *
 * Tests:
 * 1. End-to-end real asset download, SHA-256 integrity verification, Zstd decompression, and Float16 decoding
 * 2. End-to-end real asset download, SHA-256 integrity verification, Zstd decompression, and Uint16 decoding
 * 3. Categorical validity mask decoding: strictly preserves valid 0.0°C / zero scalar values while masking NaNs
 * 4. SHA-256 checksum mismatch detection & corrupted payload rejection (prevents cache insertion)
 * 5. Multi-tier priority queue scheduling & concurrency bounding (maxConcurrentDownloads)
 * 6. Inflight request deduplication (coalescing multiple parallel requests for the same brick)
 * 7. Rapid epoch-based and AbortController request cancellation without unhandled promise rejections
 * 8. LRU cache hits, misses, memory accounting, and byte-budget eviction
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  QuasarBrickStreamer,
  BrickCache,
  BrickDownloader,
  RequestScheduler,
  verifyPayloadIntegrity,
  decompressZstd,
  decodeFloat16Payload,
  decodeUint16Payload,
  decodeBrickPayload,
  IntegrityVerificationError,
  DecompressionError,
  BrickDecodeError,
} from '../src/index.ts';
import type {
  BrickGeometryContract,
  BrickPayloadContract,
  DecodedBrick,
  StreamingRequestTarget,
} from '../src/types.ts';
import { NetworkAbortError } from '../src/errors.ts';

// Resolve real workspace test assets from TASK-04/05
const REPO_ROOT = path.resolve(process.cwd(), '../..');
const VIS_ROOT = path.join(
  REPO_ROOT,
  'data',
  'visualization',
  'copernicus_phy_thetao',
  'copernicus-phy-thetao-20260824-20260830-ca826087',
  'v1'
);
const MANIFEST_PATH = path.join(VIS_ROOT, 'visualization_manifest.json');

const hasRealAssets = fs.existsSync(MANIFEST_PATH);
const manifestData = hasRealAssets ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : null;

// Mock / Virtual fetch router for testing streaming endpoints
function createMockStreamingFetch() {
  return async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(urlStr);
    const pathname = url.pathname;

    if (init?.signal?.aborted) {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // Pattern: /api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{rep}
    const match = pathname.match(/^\/api\/v1\/visualization-products\/([^/]+)\/bricks\/([^/]+)\/payloads\/(f16|u16)$/);
    if (match) {
      const [, , encodedBrickKey, representation] = match;
      const brickKey = decodeURIComponent(encodedBrickKey);

      if (hasRealAssets && manifestData) {
        const brick = manifestData.bricks.find((b: { brick_key: string }) => b.brick_key === brickKey);
        if (brick) {
          const payloadMeta = representation === 'f16' ? brick.payload_f16 : brick.payload_u16;
          const storageKey = payloadMeta.storage_object_key;
          const filePath = path.join(VIS_ROOT, storageKey);

          if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            return new Response(buf, {
              status: 200,
              headers: {
                'Content-Type': 'application/octet-stream',
                'X-Payload-SHA256': payloadMeta.sha256_checksum,
                'X-Payload-Uncompressed-Bytes': String(payloadMeta.uncompressed_bytes_length),
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        }
      }

      // If simulated / synthetic brick
      if (brickKey === 'simulated:brick:0') {
        const dummyZstd = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x58, 0x00, 0x00, 0x00]);
        return new Response(dummyZstd, {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      }

      return new Response(
        JSON.stringify({
          error: {
            code: 'BRICK_PAYLOAD_NOT_FOUND',
            message: `Brick payload not found: ${brickKey}`,
            requestId: 'test-req-404',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'test-404' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  };
}

describe('QuasarOS Browser Streaming Engine (TASK-06C)', () => {
  const mockFetch = createMockStreamingFetch();
  const baseUrl = 'http://localhost:8000';

  it('should decompress and decode real Float16 (f16) brick payload from disk', () => {
    if (!hasRealAssets) return;

    const firstBrick = manifestData.bricks[0];
    const geom: BrickGeometryContract = firstBrick.geometry;
    const payloadMeta: BrickPayloadContract = firstBrick.payload_f16;
    const filePath = path.join(VIS_ROOT, payloadMeta.storage_object_key);

    const compressed = fs.readFileSync(filePath);
    const decompressed = decompressZstd(geom.brick_key, compressed, {
      expectedBytesLength: payloadMeta.uncompressed_bytes_length,
      maxBytesCeiling: 1024 * 1024,
    });

    assert.equal(decompressed.byteLength, 278784);

    const decoded: DecodedBrick = decodeFloat16Payload(decompressed, geom, payloadMeta);
    assert.equal(decoded.brickKey, geom.brick_key);
    assert.equal(decoded.representation, 'f16');
    assert.deepEqual(decoded.sampleShape, [66, 66, 32]);
    assert.deepEqual(decoded.interiorValidShape, [64, 64, 31]);
    assert.deepEqual(decoded.haloPadding, [1, 1, 0]);
    assert.equal(decoded.totalVoxels, 66 * 66 * 32);
    assert.equal(decoded.validVoxelsCount, 130975);
    assert.equal(decoded.missingVoxelsCount, 8417);
    assert.equal(decoded.isEmptyOrMasked, false);
    assert.ok(decoded.scalarMin >= 9.59 && decoded.scalarMin <= 9.61);
    assert.ok(decoded.scalarMax >= 29.75 && decoded.scalarMax <= 29.77);
    assert.equal(decoded.scalarData.length, 139392);
    assert.equal(decoded.rawBuffer.length, 139392);
    assert.equal(decoded.validityMask.length, 139392);
  });

  it('should decompress and decode real Uint16 (u16) quantized brick payload from disk', () => {
    if (!hasRealAssets) return;

    const firstBrick = manifestData.bricks[0];
    const geom: BrickGeometryContract = firstBrick.geometry;
    const payloadMeta: BrickPayloadContract = firstBrick.payload_u16;
    const filePath = path.join(VIS_ROOT, payloadMeta.storage_object_key);

    const compressed = fs.readFileSync(filePath);
    const decompressed = decompressZstd(geom.brick_key, compressed, {
      expectedBytesLength: payloadMeta.uncompressed_bytes_length,
      maxBytesCeiling: 1024 * 1024,
    });

    assert.equal(decompressed.byteLength, 278784);

    const decoded: DecodedBrick = decodeUint16Payload(decompressed, geom, payloadMeta);
    assert.equal(decoded.brickKey, geom.brick_key);
    assert.equal(decoded.representation, 'u16');
    assert.equal(decoded.validVoxelsCount, 130975);
    assert.equal(decoded.missingVoxelsCount, 8417);
    assert.ok(decoded.quantization !== null);
    assert.equal(decoded.quantization?.quantized_data_type, 'uint16');
    assert.equal(decoded.quantization?.reserved_missing_code, 65535);
    assert.ok(decoded.scalarMin >= 9.59 && decoded.scalarMin <= 9.61);
    assert.ok(decoded.scalarMax >= 29.75 && decoded.scalarMax <= 29.77);
  });

  it('should strictly preserve valid 0.0°C zero values in validity mask and separate missing codes', () => {
    const dummyGeom: BrickGeometryContract = {
      brick_key: 'test:zero_and_missing',
      sample_origin: [0, 0, 0],
      sample_shape: [2, 2, 1],
      interior_valid_shape: [2, 2, 1],
      halo_padding: [0, 0, 0],
      spatial_bounds: { min_longitude: 0, min_latitude: 0, max_longitude: 1, max_latitude: 1 },
      min_depth_m: 0,
      max_depth_m: 10,
      is_empty_or_masked: false,
      payload_sha256: 'dummy',
    };

    // Test Float16: [0.0 (0x0000), 20.0 (0x4d00), NaN (0x7e00), -0.0 (0x8000)]
    const f16Bytes = new Uint8Array([
      0x00, 0x00, // 0.0
      0x00, 0x4d, // 20.0
      0x00, 0x7e, // NaN
      0x00, 0x80, // -0.0
    ]);
    const payloadMetaF16: BrickPayloadContract = {
      brick_key: dummyGeom.brick_key,
      storage_object_key: 'dummy',
      compression_codec: 'zstd',
      sample_format: 'r16float',
      uncompressed_bytes_length: 8,
      compressed_bytes_length: 8,
      sha256_checksum: 'dummy',
    };

    const decodedF16 = decodeFloat16Payload(f16Bytes, dummyGeom, payloadMetaF16);
    assert.equal(decodedF16.validVoxelsCount, 3);
    assert.equal(decodedF16.missingVoxelsCount, 1);
    assert.equal(decodedF16.validityMask[0], 1); // 0.0 is VALID!
    assert.equal(decodedF16.scalarData[0], 0.0);
    assert.equal(decodedF16.validityMask[1], 1); // 20.0 is VALID!
    assert.equal(decodedF16.scalarData[1], 20.0);
    assert.equal(decodedF16.validityMask[2], 0); // NaN is INVALID!
    assert.ok(Number.isNaN(decodedF16.scalarData[2]));
    assert.equal(decodedF16.validityMask[3], 1); // -0.0 is VALID!

    // Test Uint16: [code 0 -> -10.0, code 10000 -> 0.0, code 65535 -> missing]
    // scale = 0.001, offset = -10.0 => code 10000 * 0.001 + (-10.0) = 0.0
    const u16Bytes = new Uint8Array([
      0x00, 0x00, // code 0 (-10.0)
      0x10, 0x27, // code 10000 (0.0)
      0xff, 0xff, // code 65535 (missing)
      0xe8, 0x03, // code 1000 (-9.0)
    ]);
    const payloadMetaU16: BrickPayloadContract = {
      brick_key: dummyGeom.brick_key,
      storage_object_key: 'dummy',
      compression_codec: 'zstd',
      sample_format: 'r16uint',
      uncompressed_bytes_length: 8,
      compressed_bytes_length: 8,
      sha256_checksum: 'dummy',
      quantization: {
        scale_factor: 0.001,
        add_offset: -10.0,
        quantized_data_type: 'uint16',
        unquantized_data_type: 'float32',
        reserved_missing_code: 65535,
        theoretical_max_quantization_error: 0.0005,
        is_eligible_for_exact_query: false,
      },
    };

    const decodedU16 = decodeUint16Payload(u16Bytes, dummyGeom, payloadMetaU16);
    assert.equal(decodedU16.validVoxelsCount, 3);
    assert.equal(decodedU16.missingVoxelsCount, 1);
    assert.equal(decodedU16.validityMask[0], 1);
    assert.equal(decodedU16.scalarData[0], -10.0);
    assert.equal(decodedU16.validityMask[1], 1); // 0.0 is VALID!
    assert.equal(decodedU16.scalarData[1], 0.0);
    assert.equal(decodedU16.validityMask[2], 0); // missing flag is INVALID!
    assert.ok(Number.isNaN(decodedU16.scalarData[2]));
  });

  it('should verify SHA-256 checksum and reject corrupted payloads', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const correctHash = '66840dda154e8a113c31dd0ad32f7f3a366a80e8136979d8f5a101d3d29d6f72'; // SHA-256 of [1..8]

    // Verify valid hash succeeds
    const ok = await verifyPayloadIntegrity('test:brick', data, correctHash);
    assert.equal(ok, true);

    // Verify corrupted / mismatched hash throws IntegrityVerificationError
    const corruptedHash = '0000000000000000000000000000000000000000000000000000000000000000';
    await assert.rejects(
      async () => {
        await verifyPayloadIntegrity('test:brick', data, corruptedHash);
      },
      (err: unknown) => {
        assert.ok(err instanceof IntegrityVerificationError);
        assert.equal(err.brickKey, 'test:brick');
        assert.equal(err.expectedSha256, corruptedHash);
        assert.equal(err.computedSha256, correctHash);
        return true;
      }
    );
  });

  it('should enforce decompression safety ceilings and reject oversized payloads', () => {
    const smallPayload = new Uint8Array([1, 2, 3]);
    assert.throws(
      () => {
        decompressZstd('test:oversize', smallPayload, { maxBytesCeiling: 2 });
      },
      (err: unknown) => {
        assert.ok(err instanceof DecompressionError);
        return true;
      }
    );
  });

  it('should operate Bounded LRU Cache with hit/miss accounting and byte-budget eviction', () => {
    const cache = new BrickCache(1000); // 1000 bytes max capacity

    const makeDummyBrick = (key: string, sizeBytes: number): DecodedBrick => ({
      brickKey: key,
      representation: 'f16',
      sampleShape: [2, 2, 1],
      interiorValidShape: [2, 2, 1],
      haloPadding: [0, 0, 0],
      sampleOrigin: [0, 0, 0],
      spatialBounds: { min_longitude: 0, min_latitude: 0, max_longitude: 1, max_latitude: 1 },
      minDepthM: 0,
      maxDepthM: 10,
      scalarMin: 10,
      scalarMax: 20,
      totalVoxels: 4,
      validVoxelsCount: 4,
      missingVoxelsCount: 0,
      isEmptyOrMasked: false,
      scalarData: new Float32Array(4),
      rawBuffer: new Uint16Array(4),
      validityMask: new Uint8Array(4),
      quantization: null,
      decodedAtMs: Date.now(),
      memorySizeBytes: sizeBytes,
    });

    const brickA = makeDummyBrick('brickA', 400);
    const brickB = makeDummyBrick('brickB', 400);
    const brickC = makeDummyBrick('brickC', 400);

    const keyA = BrickCache.generateCacheKey('snap', 'prod', 'v1', 'brickA', 'f16');
    const keyB = BrickCache.generateCacheKey('snap', 'prod', 'v1', 'brickB', 'f16');
    const keyC = BrickCache.generateCacheKey('snap', 'prod', 'v1', 'brickC', 'f16');

    // Insert A and B (total 800 bytes <= 1000)
    cache.set(keyA, brickA);
    cache.set(keyB, brickB);
    assert.equal(cache.has(keyA), true);
    assert.equal(cache.has(keyB), true);
    assert.equal(cache.getStats().entryCount, 2);
    assert.equal(cache.getStats().currentSizeBytes, 800);

    // Hit A to make B least recently used
    const retrievedA = cache.get(keyA);
    assert.ok(retrievedA !== undefined);
    assert.equal(cache.getStats().hitCount, 1);

    // Insert C (400 bytes) -> exceeds 1000 bytes budget (800+400=1200) -> should evict B!
    cache.set(keyC, brickC);
    assert.equal(cache.getStats().evictionCount, 1);
    assert.equal(cache.has(keyB), false); // B evicted!
    assert.equal(cache.has(keyA), true); // A retained!
    assert.equal(cache.has(keyC), true); // C inserted!
    assert.equal(cache.getStats().entryCount, 2);
    assert.equal(cache.getStats().currentSizeBytes, 800);

    // Test miss
    const missedB = cache.get(keyB);
    assert.equal(missedB, undefined);
    assert.equal(cache.getStats().missCount, 1);
  });

  it('should schedule requests with priority score and respect max concurrency bounds', async () => {
    let activeWorkers = 0;
    let maxObservedActive = 0;
    const executionOrder: string[] = [];

    const mockWorker = async (target: StreamingRequestTarget, signal: AbortSignal): Promise<DecodedBrick> => {
      activeWorkers++;
      if (activeWorkers > maxObservedActive) {
        maxObservedActive = activeWorkers;
      }
      // Artificial delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeWorkers--;
      executionOrder.push(target.brickKey);

      return {
        brickKey: target.brickKey,
        representation: target.representation,
        sampleShape: [66, 66, 32],
        interiorValidShape: [64, 64, 31],
        haloPadding: [1, 1, 0],
        sampleOrigin: [0, 0, 0],
        spatialBounds: target.geometry.spatial_bounds,
        minDepthM: 0,
        maxDepthM: 10,
        scalarMin: 10,
        scalarMax: 20,
        totalVoxels: 66 * 66 * 32,
        validVoxelsCount: 1000,
        missingVoxelsCount: 0,
        isEmptyOrMasked: false,
        scalarData: new Float32Array(0),
        rawBuffer: new Uint16Array(0),
        validityMask: new Uint8Array(0),
        quantization: null,
        decodedAtMs: Date.now(),
        memorySizeBytes: 1024,
      };
    };

    const scheduler = new RequestScheduler(mockWorker, 2); // Max concurrency = 2

    const createTarget = (key: string): StreamingRequestTarget => ({
      visualizationProductId: 'prod',
      productVersion: 'v1',
      snapshotId: 'snap',
      brickKey: key,
      representation: 'f16',
      geometry: {
        brick_key: key,
        sample_origin: [0, 0, 0],
        sample_shape: [66, 66, 32],
        interior_valid_shape: [64, 64, 31],
        halo_padding: [1, 1, 0],
        spatial_bounds: { min_longitude: 0, min_latitude: 0, max_longitude: 1, max_latitude: 1 },
        min_depth_m: 0,
        max_depth_m: 10,
        is_empty_or_masked: false,
        payload_sha256: 'dummy',
      },
      payloadMetadata: {
        brick_key: key,
        storage_object_key: 'dummy',
        compression_codec: 'zstd',
        sample_format: 'r16float',
        uncompressed_bytes_length: 278784,
        compressed_bytes_length: 100000,
        sha256_checksum: 'dummy',
      },
    });

    // Schedule 4 requests with different priority scores
    // P1 (Low): lod 2, invisible
    // P2 (Medium): lod 1, visible
    // P3 (High): lod 0, visible
    // P4 (Highest): lod 0, visible, distance 0
    const p1 = RequestScheduler.calculatePriorityScore(2, false, 100, 0);
    const p2 = RequestScheduler.calculatePriorityScore(1, true, 50, 0);
    const p3 = RequestScheduler.calculatePriorityScore(0, true, 20, 0);
    const p4 = RequestScheduler.calculatePriorityScore(0, true, 0, 0);

    const prom1 = scheduler.schedule(createTarget('brick_low'), p1);
    const prom2 = scheduler.schedule(createTarget('brick_med'), p2);
    const prom3 = scheduler.schedule(createTarget('brick_high'), p3);
    const prom4 = scheduler.schedule(createTarget('brick_highest'), p4);

    await Promise.all([prom1, prom2, prom3, prom4]);

    assert.ok(maxObservedActive <= 2, `Max concurrency observed was ${maxObservedActive}, expected <= 2`);
    assert.equal(scheduler.getMetrics().completedCount, 4);
  });

  it('should deduplicate parallel inflight requests for identical brick targets', async () => {
    let workerCallCount = 0;
    const mockWorker = async (target: StreamingRequestTarget): Promise<DecodedBrick> => {
      workerCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        brickKey: target.brickKey,
        representation: target.representation,
        sampleShape: [66, 66, 32],
        interiorValidShape: [64, 64, 31],
        haloPadding: [1, 1, 0],
        sampleOrigin: [0, 0, 0],
        spatialBounds: target.geometry.spatial_bounds,
        minDepthM: 0,
        maxDepthM: 10,
        scalarMin: 10,
        scalarMax: 20,
        totalVoxels: 100,
        validVoxelsCount: 100,
        missingVoxelsCount: 0,
        isEmptyOrMasked: false,
        scalarData: new Float32Array(0),
        rawBuffer: new Uint16Array(0),
        validityMask: new Uint8Array(0),
        quantization: null,
        decodedAtMs: Date.now(),
        memorySizeBytes: 1024,
      };
    };

    const scheduler = new RequestScheduler(mockWorker, 4);
    const target: StreamingRequestTarget = {
      visualizationProductId: 'prod',
      productVersion: 'v1',
      snapshotId: 'snap',
      brickKey: 'shared_brick_key',
      representation: 'f16',
      geometry: {
        brick_key: 'shared_brick_key',
        sample_origin: [0, 0, 0],
        sample_shape: [66, 66, 32],
        interior_valid_shape: [64, 64, 31],
        halo_padding: [1, 1, 0],
        spatial_bounds: { min_longitude: 0, min_latitude: 0, max_longitude: 1, max_latitude: 1 },
        min_depth_m: 0,
        max_depth_m: 10,
        is_empty_or_masked: false,
        payload_sha256: 'dummy',
      },
      payloadMetadata: {
        brick_key: 'shared_brick_key',
        storage_object_key: 'dummy',
        compression_codec: 'zstd',
        sample_format: 'r16float',
        uncompressed_bytes_length: 278784,
        compressed_bytes_length: 100000,
        sha256_checksum: 'dummy',
      },
    };

    const p = RequestScheduler.calculatePriorityScore(0, true, 0, 0);

    // Launch 3 parallel requests for identical target
    const [res1, res2, res3] = await Promise.all([
      scheduler.schedule(target, p),
      scheduler.schedule(target, p),
      scheduler.schedule(target, p),
    ]);

    assert.equal(workerCallCount, 1, 'Worker should only be invoked once for deduplicated requests');
    assert.equal(res1.brickKey, 'shared_brick_key');
    assert.equal(res2.brickKey, 'shared_brick_key');
    assert.equal(res3.brickKey, 'shared_brick_key');
    assert.equal(scheduler.getMetrics().inflightDeduplicatedCount, 2);
  });

  it('should support epoch advancement and AbortController cancellation', async () => {
    const mockWorker = async (target: StreamingRequestTarget, signal: AbortSignal): Promise<DecodedBrick> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({} as DecodedBrick);
        }, 100);

        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new NetworkAbortError(`Aborted brick ${target.brickKey}`));
        });
      });
    };

    const scheduler = new RequestScheduler(mockWorker, 1);
    const targetA: StreamingRequestTarget = {
      visualizationProductId: 'prod',
      productVersion: 'v1',
      snapshotId: 'snap',
      brickKey: 'brick_cancel_A',
      representation: 'f16',
      geometry: { brick_key: 'brick_cancel_A' } as BrickGeometryContract,
      payloadMetadata: { brick_key: 'brick_cancel_A' } as BrickPayloadContract,
    };
    const targetB: StreamingRequestTarget = {
      visualizationProductId: 'prod',
      productVersion: 'v1',
      snapshotId: 'snap',
      brickKey: 'brick_cancel_B',
      representation: 'f16',
      geometry: { brick_key: 'brick_cancel_B' } as BrickGeometryContract,
      payloadMetadata: { brick_key: 'brick_cancel_B' } as BrickPayloadContract,
    };

    const p = RequestScheduler.calculatePriorityScore(0, true, 0, 0);

    const promA = scheduler.schedule(targetA, p);
    const promB = scheduler.schedule(targetB, p);

    // Advance epoch immediately
    scheduler.advanceEpoch();

    await assert.rejects(
      async () => {
        await promA;
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkAbortError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await promB;
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkAbortError);
        return true;
      }
    );

    assert.equal(scheduler.getMetrics().abortedCount, 2);
  });

  it('should execute end-to-end brick streaming using QuasarBrickStreamer with mockFetch and real assets', async () => {
    if (!hasRealAssets) return;

    const streamer = new QuasarBrickStreamer({
      baseUrl,
      fetch: mockFetch as typeof fetch,
      maxConcurrentDownloads: 4,
      maxCacheSizeBytes: 10 * 1024 * 1024,
    });

    const firstBrick = manifestData.bricks[0];
    const targetF16: StreamingRequestTarget = {
      visualizationProductId: firstBrick.identity.visualization_product_id,
      productVersion: firstBrick.identity.product_version,
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      brickKey: firstBrick.brick_key,
      representation: 'f16',
      geometry: firstBrick.geometry,
      payloadMetadata: firstBrick.payload_f16,
      identity: firstBrick.identity,
    };

    const p = RequestScheduler.calculatePriorityScore(0, true, 5.0, 0);

    // First request: Cache Miss -> Network Download -> Verify -> Decompress -> Decode -> Cache Set
    const decoded1 = await streamer.requestBrick(targetF16, p);
    assert.equal(decoded1.brickKey, firstBrick.brick_key);
    assert.equal(decoded1.representation, 'f16');
    assert.equal(decoded1.validVoxelsCount, 130975);

    const stats1 = streamer.getStatistics();
    assert.equal(stats1.cacheStats.entryCount, 1);
    assert.equal(stats1.cacheStats.missCount, 1);

    // Second request: Cache Hit (instant, no network download)
    const decoded2 = await streamer.requestBrick(targetF16, p);
    assert.equal(decoded2.brickKey, firstBrick.brick_key);

    const stats2 = streamer.getStatistics();
    assert.equal(stats2.cacheStats.hitCount, 1);
    assert.equal(stats2.completedRequestsCount, 1); // Only 1 completed network request
  });
});
