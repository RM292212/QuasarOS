/**
 * @quasar/runtime Provisional Pick Mapper
 *
 * Maps screen/viewport ray hit coordinates into:
 * 1. ProvisionalRenderPickResponse: Fast approximate screen feedback containing rendered LOD,
 *    approximate sampled value, world ray hit position, and display units.
 * 2. ReconcilePickRequest: Authoritative delegation payload for TASK-05 exact query service.
 *
 * Scientific rule: Rendered display samples are strictly provisional and must never be
 * masqueraded as authoritative scientific observations.
 */

import type {
  ProvisionalRenderPickResponse,
  ReconcilePickRequest,
  SelectionMethod,
} from '@quasar/client';
import type { GeodeticCoordinate, NormalizedVolumeCoordinate } from '../types.ts';
import type { CoordinateTransformer } from '../coordinates/transformer.ts';

export interface ViewportHitInput {
  /** Normalized volume coordinate [u, v, w] in [0, 1]^3 intersected by ray */
  volumeCoord: NormalizedVolumeCoordinate;
  /** Sampled provisional scalar value from GPU texture/raymarcher */
  provisionalScalarValue: number;
  /** Active LOD level rendered during hit */
  renderedLodLevel: number;
  /** Estimated sample error bound (e.g. quantization or LOD filtering tolerance) */
  estimatedSampleErrorBound?: number;
  /** Target dataset ID */
  datasetId: string;
  /** Target snapshot ID */
  snapshotId: string;
  /** Target visualization product ID */
  visualizationProductId: string;
  /** Canonical variable ID */
  variableId: string;
  /** Display units string */
  displayUnits: string;
  /** Target UTC timestamp */
  targetTimeUtc: string;
  /** Selection method for authoritative reconciliation */
  selectionMethod?: SelectionMethod;
}

export interface ProvisionalPickResult {
  provisionalPick: ProvisionalRenderPickResponse;
  reconcileRequest: ReconcilePickRequest;
  geodeticCoord: GeodeticCoordinate;
  normalizedCoord: NormalizedVolumeCoordinate;
}

export class ProvisionalPickMapper {
  private readonly _transformer: CoordinateTransformer;

  constructor(transformer: CoordinateTransformer) {
    this._transformer = transformer;
  }

  get transformer(): CoordinateTransformer {
    return this._transformer;
  }

  /**
   * Maps a viewport ray hit into a ProvisionalRenderPickResponse and ReconcilePickRequest.
   */
  mapHit(input: ViewportHitInput): ProvisionalPickResult {
    const norm = input.volumeCoord;
    const geodetic = this._transformer.normalizedToGeodetic(norm, true);
    const enu = this._transformer.geodeticToENU(geodetic);

    const provisionalPick: ProvisionalRenderPickResponse = {
      response_type: 'approximate_render_sample',
      visualization_product_id: input.visualizationProductId,
      lod_level: input.renderedLodLevel,
      approximate_value: input.provisionalScalarValue,
      display_units: input.displayUnits,
      world_ray_hit_position: [enu.eastMeters, enu.northMeters, enu.upMeters],
      estimated_sample_error_bound: input.estimatedSampleErrorBound ?? 0.05,
      approximation_notice:
        'Provisional rendered value. Submit ReconcilePickRequest to authoritative service for certified science data.',
    };

    const reconcileRequest: ReconcilePickRequest = {
      provisional_pick: provisionalPick,
      dataset_id: input.datasetId,
      snapshot_id: input.snapshotId,
      variable_id: input.variableId,
      target_time_utc: input.targetTimeUtc,
      latitude_deg: geodetic.latitudeDeg,
      longitude_deg: geodetic.longitudeDeg,
      depth_m: geodetic.depthM,
      selection_method: input.selectionMethod ?? 'trilinear_interpolation',
    };

    return {
      provisionalPick,
      reconcileRequest,
      geodeticCoord: geodetic,
      normalizedCoord: norm,
    };
  }
}
