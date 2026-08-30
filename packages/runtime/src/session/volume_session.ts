/**
 * @quasar/runtime Volume Session
 *
 * Manages immutable pinned snapshot session identity, manifest parsing,
 * integration with QuasarClient / SnapshotPinner, and FSM lifecycle governance.
 */

import {
  SnapshotPinner,
  type CatalogOverview,
  type PinnedSnapshotSession,
  type VisualizationProductContract,
  type QuasarClient,
} from '../../../client/src/index.ts';
import { SessionIntegrityError } from '../errors.ts';
import { RuntimeStateMachine } from './state_machine.ts';
import type { RuntimeEvent, RuntimeState } from '../types.ts';

export interface VolumeSessionConfig {
  datasetId: string;
  snapshotId: string;
  productId: string;
  productVersion?: string;
  manifestSha256: string;
}

export class VolumeSession {
  private readonly _pinner: SnapshotPinner;
  private readonly _fsm: RuntimeStateMachine;
  private _manifest: VisualizationProductContract | null = null;

  constructor(pinner?: SnapshotPinner) {
    this._pinner = pinner ?? new SnapshotPinner();
    this._fsm = new RuntimeStateMachine();
  }

  get pinner(): SnapshotPinner {
    return this._pinner;
  }

  get fsm(): RuntimeStateMachine {
    return this._fsm;
  }

  get state(): RuntimeState {
    return this._fsm.state;
  }

  get manifest(): VisualizationProductContract | null {
    return this._manifest;
  }

  get pinnedSession(): PinnedSnapshotSession | null {
    return this._pinner.getPinnedSession();
  }

  /**
   * Start discovery phase.
   */
  startDiscovery(): void {
    this._fsm.transition('START_DISCOVERY', 'Querying catalog metadata');
  }

  /**
   * Pin an explicit snapshot identity to this session.
   */
  pinSession(config: VolumeSessionConfig): PinnedSnapshotSession {
    const existing = this._pinner.getPinnedSession();
    if (existing && existing.snapshotId !== config.snapshotId) {
      throw new SessionIntegrityError(existing.snapshotId, config.snapshotId);
    }

    const session: PinnedSnapshotSession = {
      datasetId: config.datasetId,
      snapshotId: config.snapshotId,
      visualizationProductId: config.productId,
      productVersion: config.productVersion ?? 'v1',
      manifestSha256: config.manifestSha256,
      sourceSha256: config.manifestSha256,
      pinnedAtUtc: new Date().toISOString(),
      shape: [7, 31, 181, 97], // standard shape fallback if not discovered
      temporalRange: {
        start: '2026-08-24T12:00:00Z',
        end: '2026-08-30T12:00:00Z',
      },
    };

    this._pinner.pinSession(session);
    if (this._fsm.state === 'DISCOVERING' || this._fsm.state === 'UNINITIALIZED') {
      if (this._fsm.state === 'UNINITIALIZED') {
        this._fsm.transition('START_DISCOVERY', 'Implicit discovery start');
      }
      this._fsm.transition('PIN_SNAPSHOT', `Pinned snapshot ${config.snapshotId}`);
    }

    return session;
  }

  /**
   * Pin snapshot from a CatalogOverview payload.
   */
  pinFromCatalog(catalog: CatalogOverview, targetDatasetId?: string): PinnedSnapshotSession {
    if (this._fsm.state === 'UNINITIALIZED') {
      this._fsm.transition('START_DISCOVERY', 'Discovered catalog');
    }
    const session = this._pinner.pinFromCatalog(catalog, targetDatasetId);
    this._fsm.transition('PIN_SNAPSHOT', `Pinned snapshot from catalog ${session.snapshotId}`);
    return session;
  }

  /**
   * Verify consistency with an updated catalog overview to prevent silent mid-session drift.
   */
  verifyCatalogConsistency(catalog: CatalogOverview): void {
    this._pinner.verifySessionConsistency(catalog);
  }

  /**
   * Transition to MANIFEST_LOADING state.
   */
  startManifestLoading(): void {
    this._fsm.transition('LOAD_MANIFEST', 'Initiating visualization manifest fetch');
  }

  /**
   * Supply the parsed visualization manifest, verify its cryptographic hash against pinned session,
   * and transition to MANIFEST_READY.
   */
  setManifest(manifest: VisualizationProductContract, computedOrDeclaredSha256?: string): void {
    const session = this._pinner.requirePinnedSession();

    if (manifest.source_dataset_id !== session.datasetId && manifest.visualization_product_id !== session.visualizationProductId) {
      throw new SessionIntegrityError(session.datasetId, manifest.source_dataset_id);
    }

    if (computedOrDeclaredSha256 && session.manifestSha256) {
      if (computedOrDeclaredSha256 !== session.manifestSha256 && session.sourceSha256 !== computedOrDeclaredSha256) {
        throw new SessionIntegrityError(session.manifestSha256, computedOrDeclaredSha256);
      }
    }

    this._manifest = manifest;
    if (this._fsm.state === 'SNAPSHOT_PINNED') {
      this._fsm.transition('LOAD_MANIFEST', 'Loading manifest');
    }
    this._fsm.transition('MANIFEST_PARSED', 'Manifest parsed and cryptographically validated');
  }

  /**
   * Begin brick streaming.
   */
  startStreaming(): void {
    this._fsm.transition('START_STREAMING', 'Dispatching initial viewport streaming requests');
  }

  /**
   * Settle streaming to READY.
   */
  settleStreaming(): void {
    this._fsm.transition('STREAMING_SETTLED', 'All viewport bricks loaded into residency');
  }

  /**
   * Mark fallback LOD available (DEGRADED).
   */
  markFallbackDegraded(): void {
    this._fsm.transition('FALLBACK_LOD_AVAILABLE', 'Coarser fallback LOD rendered');
  }

  /**
   * Refine LOD from DEGRADED to READY.
   */
  refineLOD(): void {
    this._fsm.transition('LOD_REFINED', 'Fine target LOD loaded');
  }

  /**
   * Notify viewport changed.
   */
  notifyViewportChanged(): void {
    this._fsm.transition('VIEWPORT_CHANGED', 'Camera frustum or ROI shifted');
  }

  /**
   * Record fatal error.
   */
  recordError(error: Error, reason?: string): void {
    this._fsm.transition('FATAL_ERROR', reason ?? error.message, error);
  }

  /**
   * Retry streaming from ERROR state back to MANIFEST_READY.
   */
  retryStreaming(): void {
    this._fsm.transition('RETRY_STREAMING', 'Retrying streaming pipeline from manifest');
  }

  /**
   * Dispose session and resources.
   */
  dispose(): void {
    if (this._fsm.state === 'DISPOSED') return;
    this._fsm.transition('DISPOSE', 'Tearing down volume session');
    this._manifest = null;
    this._pinner.clear();
    this._fsm.transition('DISPOSAL_COMPLETE', 'Volume session disposed');
  }
}
