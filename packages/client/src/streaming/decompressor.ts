/**
 * QuasarOS Zstandard Payload Decompressor.
 *
 * Utilizes pure-JS / WASM fzstd decompressor with strict buffer bounds:
 * - Expected uncompressed buffer size verification (e.g. 278,784 bytes)
 * - Strict maximum safety ceiling enforcement (e.g. 1.0 MiB / 1,048,576 bytes)
 * - Robust error handling preventing browser heap exhaustion.
 */

import { decompress as fzstdDecompress } from 'fzstd';
import { DecompressionError } from './errors.ts';

export const DEFAULT_UNCOMPRESSED_CEILING_BYTES = 1024 * 1024; // 1.0 MiB
export const STANDARD_BRICK_UNCOMPRESSED_BYTES = 278784; // 66 * 66 * 32 * 2

export interface DecompressOptions {
  expectedBytesLength?: number;
  maxBytesCeiling?: number;
}

/**
 * Decompresses a Zstandard-compressed byte buffer with safety bounds.
 */
export function decompressZstd(
  brickKey: string,
  compressedBytes: Uint8Array,
  options: DecompressOptions = {}
): Uint8Array {
  const maxCeiling = options.maxBytesCeiling ?? DEFAULT_UNCOMPRESSED_CEILING_BYTES;
  const expectedLength = options.expectedBytesLength;

  let decompressed: Uint8Array;
  try {
    decompressed = fzstdDecompress(compressedBytes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DecompressionError(brickKey, `Zstd decompression failed: ${msg}`);
  }

  if (decompressed.byteLength > maxCeiling) {
    throw new DecompressionError(
      brickKey,
      `Decompressed size ${decompressed.byteLength} exceeds safety ceiling of ${maxCeiling} bytes.`,
      decompressed.byteLength
    );
  }

  if (expectedLength !== undefined && expectedLength > 0 && decompressed.byteLength !== expectedLength) {
    throw new DecompressionError(
      brickKey,
      `Decompressed size ${decompressed.byteLength} does not match expected size of ${expectedLength} bytes.`,
      decompressed.byteLength
    );
  }

  return decompressed;
}
