/**
 * @quasar/renderer-webgpu GPU Residency Adapter
 * Synchronizes GPU texture allocations and bindings with RenderPacket resident bricks.
 * Maintains LRU eviction and memory budget compliance (50 MiB) on the GPU side.
 */

import { GPUResourceManager } from '../resources/resource_manager.ts';
import { GPUBudgetTracker } from '../resources/budget_tracker.ts';
import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type {
  ResidentGPUBrick,
  ResidencyAdapterConfig,
  GPUAllocatedTexture,
  GPUAllocatedBuffer,
} from '../types.ts';

export class GPUResidencyAdapter {
  readonly resourceManager: GPUResourceManager;
  readonly budgetTracker: GPUBudgetTracker;
  private readonly _residentBricks: Map<string, ResidentGPUBrick> = new Map();
  private readonly _enableValidityMasks: boolean;
  private _depthLutBuffer: GPUAllocatedBuffer | null = null;
  private _transferFunctionTexture: GPUAllocatedTexture | null = null;

  constructor(device: GPUDevice, config: ResidencyAdapterConfig = {}) {
    this.budgetTracker = new GPUBudgetTracker({
      maxTextureMemoryBytes: config.maxTextureBudgetBytes ?? 50 * 1024 * 1024,
    });
    this.resourceManager = new GPUResourceManager(device, this.budgetTracker);
    this._enableValidityMasks = config.enableValidityMasks ?? true;
  }

  get residentBricksCount(): number {
    return this._residentBricks.size;
  }

  get depthLutBuffer(): GPUAllocatedBuffer | null {
    return this._depthLutBuffer;
  }

  get transferFunctionTexture(): GPUAllocatedTexture | null {
    return this._transferFunctionTexture;
  }

  hasBrick(brickKey: string): boolean {
    return this._residentBricks.has(brickKey);
  }

  getBrick(brickKey: string): ResidentGPUBrick | undefined {
    const brick = this._residentBricks.get(brickKey);
    if (brick) {
      brick.lastAccessTimestamp = performance.now();
    }
    return brick;
  }

  /**
   * Synchronize GPU residency with an incoming RenderPacket.
   * Uploads any newly resident bricks, updates Depth LUT and Transfer Function LUT,
   * and evicts unreferenced GPU bricks if memory budget requires it.
   */
  synchronizePacket(packet: RenderPacket): void {
    const now = performance.now();
    const activeKeys = new Set<string>();

    // 1. Sync Depth LUT Buffer if present
    if (packet.depthLutEntriesM && packet.depthLutEntriesM.length > 0) {
      const lutId = `depth_lut_${packet.datasetId}`;
      if (!this._depthLutBuffer || this._depthLutBuffer.id !== lutId) {
        if (this._depthLutBuffer) {
          this.resourceManager.destroyBuffer(this._depthLutBuffer.id);
        }
        this._depthLutBuffer = this.resourceManager.uploadDepthLUTBuffer(
          lutId,
          packet.depthLutEntriesM
        );
      }
    }

    // 2. Sync Colormap Transfer Function LUT Texture if present
    if (packet.transferFunction) {
      const tfId = `tf_lut_${packet.transferFunction.colormap_name || 'custom'}`;
      if (!this._transferFunctionTexture || this._transferFunctionTexture.id !== tfId) {
        if (this._transferFunctionTexture) {
          this.resourceManager.destroyTexture(this._transferFunctionTexture.id);
        }
        this._transferFunctionTexture = this.resourceManager.uploadTransferFunctionLUT(
          tfId,
          packet.transferFunction
        );
      }
    }

    // 3. Mark active bricks and pin them
    for (const brick of packet.bricks) {
      activeKeys.add(brick.brickKey);
    }

    // Unpin bricks not in active list
    for (const [key, gpuBrick] of this._residentBricks.entries()) {
      if (!activeKeys.has(key)) {
        gpuBrick.isPinned = false;
      }
    }

    // 4. Upload any active bricks that are not yet on GPU
    for (const brick of packet.bricks) {
      if (this._residentBricks.has(brick.brickKey)) {
        const gpuBrick = this._residentBricks.get(brick.brickKey)!;
        gpuBrick.lastAccessTimestamp = now;
        gpuBrick.isPinned = true;
        continue;
      }

      // Check if we need to evict unpinned bricks to make room
      const [nx, ny, nz] = brick.sampleShape;
      const bpe = 2; // rawBuffer is Uint16Array (r16uint or r16float)
      const textureBytes = nx * ny * nz * bpe;
      const maskBytes = this._enableValidityMasks && brick.validityMask ? nx * ny * nz * 1 : 0;
      const totalNeeded = textureBytes + maskBytes;

      this.ensureTextureBudget(totalNeeded);

      // Upload scalar texture
      const scalarTexId = `tex_${brick.brickKey}`;
      const scalarTexture = this.resourceManager.uploadTexture3D({
        id: scalarTexId,
        width: nx,
        height: ny,
        depth: nz,
        format: 'r16uint', // raw quantized 16-bit uint representation
        data: brick.rawBuffer,
      });

      // Upload validity mask texture if enabled
      let validityMaskTexture: GPUAllocatedTexture | undefined;
      if (this._enableValidityMasks && brick.validityMask && brick.validityMask.length > 0) {
        const maskTexId = `mask_${brick.brickKey}`;
        validityMaskTexture = this.resourceManager.uploadTexture3D({
          id: maskTexId,
          width: nx,
          height: ny,
          depth: nz,
          format: 'r8uint',
          data: brick.validityMask,
        });
      }

      const residentBrick: ResidentGPUBrick = {
        brickKey: brick.brickKey,
        lodLevel: brick.lodLevel,
        timestepIndex: brick.timestepIndex,
        brickIndices: brick.brickIndices,
        sampleShape: brick.sampleShape,
        scalarTexture,
        validityMaskTexture,
        lastAccessTimestamp: now,
        isPinned: true,
        destroy: () => {
          this.evictBrick(brick.brickKey);
        },
      };

      this._residentBricks.set(brick.brickKey, residentBrick);
    }
  }

  /**
   * Evict a single brick from GPU residency.
   */
  evictBrick(brickKey: string): boolean {
    const resident = this._residentBricks.get(brickKey);
    if (!resident) {
      return false;
    }

    this.resourceManager.destroyTexture(resident.scalarTexture.id);
    if (resident.validityMaskTexture) {
      this.resourceManager.destroyTexture(resident.validityMaskTexture.id);
    }

    this._residentBricks.delete(brickKey);
    return true;
  }

  /**
   * Ensure sufficient GPU texture budget by evicting LRU unpinned bricks.
   */
  ensureTextureBudget(bytesNeeded: number): void {
    while (!this.budgetTracker.canAllocateTexture(bytesNeeded)) {
      // Find oldest unpinned brick
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;

      for (const [key, brick] of this._residentBricks.entries()) {
        if (!brick.isPinned && brick.lastAccessTimestamp < oldestTimestamp) {
          oldestTimestamp = brick.lastAccessTimestamp;
          oldestKey = key;
        }
      }

      if (!oldestKey) {
        // Cannot evict any more (all are pinned)
        break;
      }

      this.evictBrick(oldestKey);
    }
  }

  /**
   * Evict all bricks and clean up GPU memory.
   */
  clear(): void {
    for (const key of Array.from(this._residentBricks.keys())) {
      this.evictBrick(key);
    }
    if (this._depthLutBuffer) {
      this.resourceManager.destroyBuffer(this._depthLutBuffer.id);
      this._depthLutBuffer = null;
    }
    if (this._transferFunctionTexture) {
      this.resourceManager.destroyTexture(this._transferFunctionTexture.id);
      this._transferFunctionTexture = null;
    }
  }

  dispose(): void {
    this.clear();
    this.resourceManager.dispose();
  }
}
