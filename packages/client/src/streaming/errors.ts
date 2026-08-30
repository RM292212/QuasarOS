/**
 * QuasarOS Streaming Exceptions.
 *
 * Conforms strictly to docs/02-architecture/ErrorModel.md.
 */

import { QuasarClientError } from '../errors.ts';

/**
 * Thrown when cryptographic SHA-256 validation of downloaded brick payload fails.
 */
export class IntegrityVerificationError extends QuasarClientError {
  readonly expectedSha256: string;
  readonly computedSha256: string;
  readonly brickKey: string;

  constructor(brickKey: string, expectedSha256: string, computedSha256: string) {
    super(
      `[INTEGRITY_MISMATCH] SHA-256 integrity verification failed for brick '${brickKey}'. Expected '${expectedSha256}', computed '${computedSha256}'. Corrupted payload rejected.`
    );
    this.name = 'IntegrityVerificationError';
    this.brickKey = brickKey;
    this.expectedSha256 = expectedSha256;
    this.computedSha256 = computedSha256;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when decompressed payload size violates safety ceilings or expected byte lengths.
 */
export class DecompressionError extends QuasarClientError {
  readonly brickKey: string;
  readonly byteLength: number;

  constructor(brickKey: string, message: string, byteLength = 0) {
    super(`[DECOMPRESSION_FAILED] Failed to decompress brick '${brickKey}': ${message}`);
    this.name = 'DecompressionError';
    this.brickKey = brickKey;
    this.byteLength = byteLength;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when decoding brick representation (f16 / u16) fails.
 */
export class BrickDecodeError extends QuasarClientError {
  readonly brickKey: string;

  constructor(brickKey: string, message: string) {
    super(`[BRICK_DECODE_FAILED] Failed to decode brick '${brickKey}': ${message}`);
    this.name = 'BrickDecodeError';
    this.brickKey = brickKey;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
