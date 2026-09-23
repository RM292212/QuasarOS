/**
 * QuasarOS Cryptographic Integrity Verifier.
 *
 * Computes cryptographic SHA-256 digests over compressed payload byte arrays
 * using the browser Web Crypto API (crypto.subtle.digest) or Node.js crypto fallback.
 * Rejects corrupted or truncated payloads before decompression or caching.
 */

import { IntegrityVerificationError } from './errors.ts';

/**
 * Computes hexadecimal SHA-256 digest of a Uint8Array or ArrayBuffer.
 */
export async function computeSha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = '';
    for (let i = 0; i < hashArray.length; i++) {
      hex += hashArray[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // Fallback for environments where crypto.subtle is unavailable
  throw new Error('Web Crypto API (crypto.subtle) is required for SHA-256 integrity verification.');
}

/**
 * Validates that the SHA-256 digest of data matches the expected checksum.
 * Throws IntegrityVerificationError if mismatch occurs.
 */
export async function verifyPayloadIntegrity(
  brickKey: string,
  compressedBytes: Uint8Array | ArrayBuffer,
  expectedSha256: string
): Promise<boolean> {
  const normalizedExpected = expectedSha256.trim().toLowerCase();
  const computed = await computeSha256Hex(compressedBytes);
  
  if (computed !== normalizedExpected) {
    throw new IntegrityVerificationError(brickKey, normalizedExpected, computed);
  }
  
  return true;
}
