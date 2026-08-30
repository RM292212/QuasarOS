/**
 * QuasarOS Snapshot Pinner.
 *
 * Implements authoritative session snapshot pinning to ensure immutable, reproducible
 * dataset sessions across 3D rendering, brick streaming, and point queries.
 *
 * Prevents silent mid-session dataset mutation if the backend operational pointer advances.
 */

import { QuasarClientError, SnapshotMutationError } from './errors.ts';
import type {
  CatalogOverview,
  DatasetFamilySummary,
  PinnedSnapshotSession,
  SnapshotSummary,
} from './types.ts';

export class SnapshotPinner {
  private _session: PinnedSnapshotSession | null = null;

  /**
   * Return currently pinned session, or null if unpinned.
   */
  getPinnedSession(): PinnedSnapshotSession | null {
    return this._session;
  }

  /**
   * Return currently pinned session, or throw if not initialized.
   */
  requirePinnedSession(): PinnedSnapshotSession {
    if (!this._session) {
      throw new QuasarClientError(
        'No active dataset snapshot has been pinned for this session. Call pinFromCatalog() or initializeSession() first.'
      );
    }
    return this._session;
  }

  /**
   * Directly pin an explicit snapshot session.
   */
  pinSession(session: PinnedSnapshotSession): PinnedSnapshotSession {
    this._session = { ...session };
    return this._session;
  }

  /**
   * Discover and pin the active operational snapshot from a CatalogOverview payload.
   *
   * @param catalog The catalog overview response data.
   * @param targetDatasetId Optional dataset ID to select. If omitted, uses the first available dataset.
   */
  pinFromCatalog(catalog: CatalogOverview, targetDatasetId?: string): PinnedSnapshotSession {
    if (!catalog.datasets || catalog.datasets.length === 0) {
      throw new QuasarClientError('Cannot pin snapshot: Catalog contains no dataset families.');
    }

    let dataset: DatasetFamilySummary | undefined;
    if (targetDatasetId) {
      dataset = catalog.datasets.find((d) => d.datasetId === targetDatasetId);
      if (!dataset) {
        throw new QuasarClientError(`Dataset '${targetDatasetId}' not found in catalog overview.`);
      }
    } else {
      dataset = catalog.datasets[0];
    }

    const activeSnapshotId = dataset.activeSnapshotId;
    const snapshot: SnapshotSummary | undefined = catalog.activeSnapshots.find(
      (s) => s.snapshotId === activeSnapshotId && s.datasetId === dataset!.datasetId
    ) ?? catalog.activeSnapshots.find((s) => s.snapshotId === activeSnapshotId);

    if (!snapshot) {
      throw new QuasarClientError(
        `Active snapshot '${activeSnapshotId}' for dataset '${dataset.datasetId}' was not found in activeSnapshots list.`
      );
    }

    const visProductId = snapshot.visualizationProductId || `vis_${dataset.datasetId}_${snapshot.snapshotId}`;

    const session: PinnedSnapshotSession = {
      datasetId: dataset.datasetId,
      snapshotId: snapshot.snapshotId,
      visualizationProductId: visProductId,
      productVersion: 'v1',
      manifestSha256: snapshot.sourceSha256, // Guaranteed immutable baseline digest
      sourceSha256: snapshot.sourceSha256,
      pinnedAtUtc: new Date().toISOString(),
      shape: [...snapshot.shape],
      temporalRange: {
        start: dataset.temporalRange?.start ?? snapshot.startDate,
        end: dataset.temporalRange?.end ?? snapshot.endDate,
      },
    };

    this._session = session;
    return session;
  }

  /**
   * Verify that a newly fetched catalog is strictly consistent with the pinned session.
   * Throws SnapshotMutationError if the operational active snapshot has drifted.
   */
  verifySessionConsistency(currentCatalog: CatalogOverview): void {
    if (!this._session) {
      return;
    }

    const dataset = currentCatalog.datasets.find((d) => d.datasetId === this._session!.datasetId);
    if (!dataset) {
      throw new QuasarClientError(
        `Consistency check failed: Pinned dataset '${this._session.datasetId}' no longer present in catalog.`
      );
    }

    if (dataset.activeSnapshotId !== this._session.snapshotId) {
      throw new SnapshotMutationError(
        this._session.datasetId,
        this._session.snapshotId,
        dataset.activeSnapshotId
      );
    }
  }

  /**
   * Clear pinned session state.
   */
  clear(): void {
    this._session = null;
  }
}
