/**
 * @quasar/renderer-webgpu Picking Subsystem - Authoritative Reconciliation Client Integration
 *
 * Implements reconcilePickWithBackend(provisionalPickResult, client):
 * 1. Takes provisional pick result from GpuVolumePicker/ProvisionalPickMapper.
 * 2. Dispatches POST /api/v1/queries/reconcile-pick to TASK-05 FastAPI service via @quasar/client.
 * 3. Returns unified reconciliation result displaying both provisional GPU render value and authoritative native NetCDF value.
 *
 * Conforms strictly to AGENTS.md rule: Rendered display samples are strictly provisional
 * and must never be masqueraded as authoritative scientific observations.
 */

import type {
  QuasarClient,
  QuasarQueryClient,
  ReconcilePickRequest,
  ReconcilePickResponse,
  ProvisionalRenderPickResponse,
  ExactValueQueryResponse,
  RequestOptions,
} from '@quasar/client';
import type { ProvisionalPickResult } from '@quasar/runtime';
import type { GpuPickResult } from './gpu_volume_picker.ts';

export interface UnifiedPickReconciliationResult {
  /** Approximate provisional GPU raymarching feedback */
  provisional: {
    approximateValue: number;
    displayUnits: string;
    lodLevel: number;
    estimatedSampleErrorBound: number;
    worldRayHitPosition: number[];
    approximationNotice: string;
    normalizedCoord?: [number, number, number];
  };
  /** Authoritative certified scientific truth from native NetCDF array */
  authoritative: {
    scientificValue: number;
    canonicalUnits: string;
    valueState: string;
    resolvedCoordinates: {
      latitudeDeg: number;
      longitudeDeg: number;
      depthM: number;
      resolvedTimeUtc: string;
    };
    sourceAssetId: string;
    sourceAssetSha256: string;
    selectionMethodUsed: string;
    gridIndexEvaluated?: number[];
    rawResponse: ExactValueQueryResponse;
  };
  /** Comparison & Lineage metrics */
  comparison: {
    absoluteDifferenceDelta: number | null;
    relativeDifferencePercent: number | null;
    withinEstimatedErrorBound: boolean | null;
    reconciliationNotice: string;
  };
  /** Complete raw server response */
  rawReconcileResponse: ReconcilePickResponse;
}

/**
 * Reconcile a GPU volume pick with the authoritative backend query service.
 *
 * @param pickInput GpuPickResult or ProvisionalPickResult or ReconcilePickRequest
 * @param clientOrQueryClient QuasarClient or QuasarQueryClient instance
 * @param options Network request options (signal, timeout)
 */
export async function reconcilePickWithBackend(
  pickInput: GpuPickResult | ProvisionalPickResult | ReconcilePickRequest,
  clientOrQueryClient: QuasarClient | QuasarQueryClient,
  options?: RequestOptions
): Promise<UnifiedPickReconciliationResult> {
  let reconcileRequest: ReconcilePickRequest;
  let normalizedCoord: [number, number, number] | undefined;

  if ('reconcileRequest' in pickInput) {
    // ProvisionalPickResult from @quasar/runtime
    reconcileRequest = pickInput.reconcileRequest;
    normalizedCoord = [pickInput.normalizedCoord.u, pickInput.normalizedCoord.v, pickInput.normalizedCoord.w];
  } else if ('provisionalPickResult' in pickInput && pickInput.provisionalPickResult) {
    // GpuPickResult with successful hit
    reconcileRequest = pickInput.provisionalPickResult.reconcileRequest;
    normalizedCoord = pickInput.normalizedCoord;
  } else if ('provisional_pick' in pickInput) {
    // Direct ReconcilePickRequest
    reconcileRequest = pickInput;
  } else {
    throw new Error('Invalid pick reconciliation input: No hit or missing provisional pick data.');
  }

  const queryClient: QuasarQueryClient =
    'query' in clientOrQueryClient ? clientOrQueryClient.query : clientOrQueryClient;

  const apiResponse = await queryClient.reconcileProvisionalPick(reconcileRequest, options);
  const data = apiResponse.data;
  const auth = data.authoritative_response;
  const prov = reconcileRequest.provisional_pick;

  return {
    provisional: {
      approximateValue: data.provisional_value,
      displayUnits: prov.display_units,
      lodLevel: data.provisional_lod_level,
      estimatedSampleErrorBound: data.estimated_sample_error_bound,
      worldRayHitPosition: prov.world_ray_hit_position,
      approximationNotice: prov.approximation_notice,
      normalizedCoord,
    },
    authoritative: {
      scientificValue: auth.scientific_value ?? NaN,
      canonicalUnits: auth.canonical_units,
      valueState: auth.value_state,
      resolvedCoordinates: {
        latitudeDeg: auth.resolved_latitude_deg ?? auth.requested_latitude_deg,
        longitudeDeg: auth.resolved_longitude_deg ?? auth.requested_longitude_deg,
        depthM: auth.resolved_depth_m ?? 0.0,
        resolvedTimeUtc: auth.resolved_time_utc,
      },
      sourceAssetId: auth.source_asset_id,
      sourceAssetSha256: auth.source_asset_sha256,
      selectionMethodUsed: auth.selection_method_used,
      gridIndexEvaluated: auth.grid_index_evaluated,
      rawResponse: auth,
    },
    comparison: {
      absoluteDifferenceDelta: data.absolute_difference_delta ?? null,
      relativeDifferencePercent: data.relative_difference_percent ?? null,
      withinEstimatedErrorBound: data.within_estimated_error_bound ?? null,
      reconciliationNotice: data.reconciliation_notice,
    },
    rawReconcileResponse: data,
  };
}
