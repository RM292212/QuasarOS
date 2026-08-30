/**
 * @quasar/renderer-webgpu 256-Byte Row Alignment Repacker
 *
 * WebGPU GPUQueue.writeTexture() and copyBufferToTexture() strictly require that
 * `bytesPerRow` must be a multiple of 256 bytes.
 *
 * For scientific 3D volume bricks (e.g. 66x66x32 samples of 16-bit float/uint):
 * - Row width: 66 samples * 2 bytes = 132 bytes.
 * - Minimum aligned bytesPerRow = ceil(132 / 256) * 256 = 256 bytes.
 * - Each row contains 132 payload bytes followed by 124 padding bytes.
 *
 * This module performs high-performance, byte-accurate repackaging of arbitrary 3D typed arrays
 * into 256-byte aligned staging memory layouts, and provides zero-padding guarantees.
 */

import { GPUUploadLayoutError } from '../errors.ts';
import type { RepackerOptions, StagingRepackResult } from '../types.ts';

export class RowAlignmentRepacker {
  /**
   * Calculate aligned bytesPerRow for a given row byte size and alignment (default 256).
   */
  static computeBytesPerRow(rowBytes: number, alignment: number = 256): number {
    if (rowBytes <= 0) {
      throw new GPUUploadLayoutError(`Row byte size must be greater than 0, received ${rowBytes}`);
    }
    return Math.ceil(rowBytes / alignment) * alignment;
  }

  /**
   * Repack a contiguous 3D array of elements into a 256-byte row aligned ArrayBuffer.
   *
   * @param sourceData ArrayBufferView containing the unpadded source elements (e.g. Uint16Array, Float32Array, Uint8Array)
   * @param options Dimensions and element size of the volume
   */
  static repack3DVolume(
    sourceData: ArrayBufferView,
    options: RepackerOptions
  ): StagingRepackResult {
    const { width, height, depth, bytesPerElement, alignmentRequirement = 256 } = options;

    if (width <= 0 || height <= 0 || depth <= 0 || bytesPerElement <= 0) {
      throw new GPUUploadLayoutError(
        `Invalid volume dimensions for staging repack: [${width}, ${height}, ${depth}], bytesPerElement=${bytesPerElement}`
      );
    }

    const expectedElements = width * height * depth;
    const actualElements = sourceData.byteLength / bytesPerElement;
    if (actualElements < expectedElements) {
      throw new GPUUploadLayoutError(
        `Source buffer has insufficient elements: expected at least ${expectedElements} (${expectedElements * bytesPerElement} bytes), found ${actualElements} (${sourceData.byteLength} bytes)`
      );
    }

    const unpaddedBytesPerRow = width * bytesPerElement;
    const alignedBytesPerRow = this.computeBytesPerRow(unpaddedBytesPerRow, alignmentRequirement);
    const rowsPerImage = height;
    const bytesPerImage = alignedBytesPerRow * rowsPerImage;
    const totalStagingBytes = bytesPerImage * depth;

    // Allocate zero-initialized destination buffer
    const stagingBuffer = new ArrayBuffer(totalStagingBytes);
    const dstU8 = new Uint8Array(stagingBuffer);
    const srcU8 = new Uint8Array(sourceData.buffer, sourceData.byteOffset, sourceData.byteLength);

    // Copy row by row
    let srcOffset = 0;
    for (let z = 0; z < depth; z++) {
      const sliceDstOffset = z * bytesPerImage;
      for (let y = 0; y < height; y++) {
        const rowDstOffset = sliceDstOffset + y * alignedBytesPerRow;
        dstU8.set(srcU8.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), rowDstOffset);
        srcOffset += unpaddedBytesPerRow;
      }
    }

    return {
      stagingBuffer,
      bytesPerRow: alignedBytesPerRow,
      rowsPerImage,
      totalBytes: totalStagingBytes,
      copySize: [width, height, depth],
    };
  }

  /**
   * Repack a 1D or 2D slice (e.g. LUTs or 2D image) into a 256-byte aligned staging layout.
   */
  static repack2D(
    sourceData: ArrayBufferView,
    width: number,
    height: number,
    bytesPerElement: number,
    alignmentRequirement: number = 256
  ): StagingRepackResult {
    return this.repack3DVolume(sourceData, {
      width,
      height,
      depth: 1,
      bytesPerElement,
      alignmentRequirement,
    });
  }
}
