/**
 * QuasarOS Binary Brick Payload Decoders.
 *
 * Implements decoding for:
 * 1. IEEE 754 Half-Float ('f16', 'r16float') -> Float32Array + Raw Uint16 buffer + Bitwise/Categorical Validity Mask
 * 2. Quantized Normalized Integer ('u16', 'r16uint') -> Uint16 buffer + Scaled Float32Array + Validity Mask
 *
 * Scientific Invariants:
 * - Valid 0.0°C / physical zero is strictly preserved and NEVER converted to missing.
 * - Missing flags (e.g. 65535 or NaN/Inf) are cleanly separated into validityMask = 0 and scalarData = NaN.
 * - Raw buffers are preserved intact for direct zero-copy WebGPU/WebGL2 texture uploads.
 */

import type {
  BrickGeometryContract,
  BrickPayloadContract,
  BrickRepresentation,
} from '../types.ts';
import type { DecodedBrick } from './types.ts';
import { BrickDecodeError } from './errors.ts';

/**
 * Fast scalar IEEE 754 Float16 -> Float32 converter.
 */
export function decodeHalfFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;

  if (e === 0) {
    // Subnormal or Zero
    return (s ? -1 : 1) * 5.9604644775390625e-8 * f; // 2^-24 * f
  }
  if (e === 0x1f) {
    // Infinity or NaN
    return f ? NaN : (s ? -Infinity : Infinity);
  }
  // Normalized: (-1)^s * 2^(e-15) * (1 + f/1024)
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

/**
 * Decodes Float16 binary payload buffer.
 */
export function decodeFloat16Payload(
  decompressedBytes: Uint8Array,
  geometry: BrickGeometryContract,
  payloadMetadata: BrickPayloadContract
): DecodedBrick {
  const brickKey = geometry.brick_key;
  if (decompressedBytes.byteLength % 2 !== 0) {
    throw new BrickDecodeError(brickKey, `Payload byte length ${decompressedBytes.byteLength} is not an even multiple of 2 bytes.`);
  }

  // Create 16-bit view over decompressed buffer (aligned copy if byteOffset is unaligned)
  const uint16View = decompressedBytes.byteOffset % 2 === 0
    ? new Uint16Array(decompressedBytes.buffer, decompressedBytes.byteOffset, decompressedBytes.byteLength / 2)
    : new Uint16Array(decompressedBytes.buffer.slice(decompressedBytes.byteOffset, decompressedBytes.byteOffset + decompressedBytes.byteLength));

  const totalVoxels = uint16View.length;
  const scalarData = new Float32Array(totalVoxels);
  const validityMask = new Uint8Array(totalVoxels);

  let validVoxelsCount = 0;
  let missingVoxelsCount = 0;
  let scalarMin = Infinity;
  let scalarMax = -Infinity;

  for (let i = 0; i < totalVoxels; i++) {
    const rawVal = uint16View[i];
    const val = decodeHalfFloat(rawVal);

    if (Number.isNaN(val) || !Number.isFinite(val)) {
      scalarData[i] = NaN;
      validityMask[i] = 0;
      missingVoxelsCount++;
    } else {
      scalarData[i] = val;
      validityMask[i] = 1;
      validVoxelsCount++;
      if (val < scalarMin) scalarMin = val;
      if (val > scalarMax) scalarMax = val;
    }
  }

  if (validVoxelsCount === 0) {
    scalarMin = 0.0;
    scalarMax = 0.0;
  }

  const sampleShape = (geometry.sample_shape ?? [66, 66, 32]) as [number, number, number];
  const interiorValidShape = (geometry.interior_valid_shape ?? [64, 64, 31]) as [number, number, number];
  const haloPadding = (geometry.halo_padding ?? [1, 1, 0]) as [number, number, number];
  const sampleOrigin = (geometry.sample_origin ?? [0, 0, 0]) as [number, number, number];

  const memorySizeBytes =
    uint16View.byteLength + scalarData.byteLength + validityMask.byteLength + 256;

  return {
    brickKey,
    representation: 'f16',
    sampleShape,
    interiorValidShape,
    haloPadding,
    sampleOrigin,
    spatialBounds: geometry.spatial_bounds,
    minDepthM: geometry.min_depth_m,
    maxDepthM: geometry.max_depth_m,
    scalarMin,
    scalarMax,
    totalVoxels,
    validVoxelsCount,
    missingVoxelsCount,
    isEmptyOrMasked: validVoxelsCount === 0,
    scalarData,
    rawBuffer: uint16View,
    validityMask,
    quantization: null,
    decodedAtMs: Date.now(),
    memorySizeBytes,
  };
}

/**
 * Decodes Uint16 quantized binary payload buffer.
 */
export function decodeUint16Payload(
  decompressedBytes: Uint8Array,
  geometry: BrickGeometryContract,
  payloadMetadata: BrickPayloadContract
): DecodedBrick {
  const brickKey = geometry.brick_key;
  if (decompressedBytes.byteLength % 2 !== 0) {
    throw new BrickDecodeError(brickKey, `Payload byte length ${decompressedBytes.byteLength} is not an even multiple of 2 bytes.`);
  }

  const quant = payloadMetadata.quantization;
  if (!quant) {
    throw new BrickDecodeError(brickKey, 'Missing quantization contract for u16 representation.');
  }

  const reservedMissing = quant.reserved_missing_code ?? 65535;
  const scale = quant.scale_factor;
  const offset = quant.add_offset;

  const uint16View = decompressedBytes.byteOffset % 2 === 0
    ? new Uint16Array(decompressedBytes.buffer, decompressedBytes.byteOffset, decompressedBytes.byteLength / 2)
    : new Uint16Array(decompressedBytes.buffer.slice(decompressedBytes.byteOffset, decompressedBytes.byteOffset + decompressedBytes.byteLength));

  const totalVoxels = uint16View.length;
  const scalarData = new Float32Array(totalVoxels);
  const validityMask = new Uint8Array(totalVoxels);

  let validVoxelsCount = 0;
  let missingVoxelsCount = 0;
  let scalarMin = Infinity;
  let scalarMax = -Infinity;

  for (let i = 0; i < totalVoxels; i++) {
    const code = uint16View[i];
    if (code === reservedMissing) {
      scalarData[i] = NaN;
      validityMask[i] = 0;
      missingVoxelsCount++;
    } else {
      const val = code * scale + offset;
      scalarData[i] = val;
      validityMask[i] = 1;
      validVoxelsCount++;
      if (val < scalarMin) scalarMin = val;
      if (val > scalarMax) scalarMax = val;
    }
  }

  if (validVoxelsCount === 0) {
    scalarMin = 0.0;
    scalarMax = 0.0;
  }

  const sampleShape = (geometry.sample_shape ?? [66, 66, 32]) as [number, number, number];
  const interiorValidShape = (geometry.interior_valid_shape ?? [64, 64, 31]) as [number, number, number];
  const haloPadding = (geometry.halo_padding ?? [1, 1, 0]) as [number, number, number];
  const sampleOrigin = (geometry.sample_origin ?? [0, 0, 0]) as [number, number, number];

  const memorySizeBytes =
    uint16View.byteLength + scalarData.byteLength + validityMask.byteLength + 256;

  return {
    brickKey,
    representation: 'u16',
    sampleShape,
    interiorValidShape,
    haloPadding,
    sampleOrigin,
    spatialBounds: geometry.spatial_bounds,
    minDepthM: geometry.min_depth_m,
    maxDepthM: geometry.max_depth_m,
    scalarMin,
    scalarMax,
    totalVoxels,
    validVoxelsCount,
    missingVoxelsCount,
    isEmptyOrMasked: validVoxelsCount === 0,
    scalarData,
    rawBuffer: uint16View,
    validityMask,
    quantization: quant,
    decodedAtMs: Date.now(),
    memorySizeBytes,
  };
}

/**
 * Decodes decompressed brick bytes according to representation discriminator.
 */
export function decodeBrickPayload(
  representation: BrickRepresentation,
  decompressedBytes: Uint8Array,
  geometry: BrickGeometryContract,
  payloadMetadata: BrickPayloadContract
): DecodedBrick {
  if (representation === 'f16') {
    return decodeFloat16Payload(decompressedBytes, geometry, payloadMetadata);
  } else if (representation === 'u16') {
    return decodeUint16Payload(decompressedBytes, geometry, payloadMetadata);
  }
  throw new BrickDecodeError(geometry.brick_key, `Unsupported representation '${representation}'.`);
}
