/**
 * Pick Reconciliation Logic and Delta Calculation Helper.
 *
 * Implements authoritative mathematical comparisons:
 * - Absolute Delta: |V_prov - V_auth|
 * - Relative Error %: (|V_prov - V_auth| / |V_auth|) * 100
 * - Geodetic Coordinate Resolution Distance (Haversine formula in km)
 * - Error bound verification against estimatedSampleErrorBound
 */

import type {
  ExactValueQueryResponse,
  ProvisionalRenderPickResponse,
  ReconcilePickResponse,
} from '@quasar/client';
import type { CursorCoordinateReadout, PickDeltaMetrics, PickReconciliationModel } from './types.ts';

const EARTH_RADIUS_KM = 6371.0;

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const lat1Rad = (lat1 * Math.PI) / 180.0;
  const lat2Rad = (lat2 * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Compute error delta metrics between provisional rendered value and authoritative server value.
 */
export function computePickDeltaMetrics(
  provisionalVal: number,
  authoritativeVal: number | null | undefined,
  errorBound: number,
  reqLon: number,
  reqLat: number,
  resLon: number,
  resLat: number
): PickDeltaMetrics {
  const coordDistKm = calculateHaversineDistanceKm(reqLon, reqLat, resLon, resLat);

  if (authoritativeVal === null || authoritativeVal === undefined || isNaN(authoritativeVal)) {
    return {
      absoluteDelta: null,
      relativeDeltaPercent: null,
      coordinateResolutionDistanceKm: coordDistKm,
      withinErrorBound: null,
    };
  }

  const absDelta = Math.abs(provisionalVal - authoritativeVal);
  let relPercent: number | null = null;
  if (Math.abs(authoritativeVal) > 1e-9) {
    relPercent = (absDelta / Math.abs(authoritativeVal)) * 100;
  }

  const withinBound = absDelta <= errorBound + 1e-6;

  return {
    absoluteDelta: absDelta,
    relativeDeltaPercent: relPercent,
    coordinateResolutionDistanceKm: coordDistKm,
    withinErrorBound: withinBound,
  };
}

/**
 * Format and construct PickReconciliationModel from server ReconcilePickResponse.
 */
export function buildPickReconciliationModel(
  cursor: CursorCoordinateReadout,
  provisional: ProvisionalRenderPickResponse,
  reconcileResp?: ReconcilePickResponse | null,
  error?: string | null
): PickReconciliationModel {
  if (!reconcileResp) {
    return {
      cursor,
      provisional: {
        approximateValue: provisional.approximate_value,
        displayUnits: provisional.display_units,
        lodLevel: provisional.lod_level,
        estimatedSampleErrorBound: provisional.estimated_sample_error_bound,
        worldRayHitPosition: provisional.world_ray_hit_position,
        approximationNotice: provisional.approximation_notice,
      },
      authoritative: null,
      delta: {
        absoluteDelta: null,
        relativeDeltaPercent: null,
        coordinateResolutionDistanceKm: 0.0,
        withinErrorBound: null,
      },
      isLoading: !error,
      error: error ?? null,
    };
  }

  const auth = reconcileResp.authoritative_response;
  const deltaMetrics = computePickDeltaMetrics(
    reconcileResp.provisional_value,
    auth.scientific_value,
    reconcileResp.estimated_sample_error_bound,
    cursor.longitudeDeg,
    cursor.latitudeDeg,
    auth.resolved_longitude_deg ?? cursor.longitudeDeg,
    auth.resolved_latitude_deg ?? cursor.latitudeDeg
  );

  return {
    cursor,
    provisional: {
      approximateValue: reconcileResp.provisional_value,
      displayUnits: provisional.display_units,
      lodLevel: reconcileResp.provisional_lod_level,
      estimatedSampleErrorBound: reconcileResp.estimated_sample_error_bound,
      worldRayHitPosition: provisional.world_ray_hit_position,
      approximationNotice: provisional.approximation_notice,
    },
    authoritative: {
      scientificValue: auth.scientific_value ?? null,
      canonicalUnits: auth.canonical_units,
      valueState: auth.value_state,
      resolvedCoordinates: {
        longitudeDeg: auth.resolved_longitude_deg ?? cursor.longitudeDeg,
        latitudeDeg: auth.resolved_latitude_deg ?? cursor.latitudeDeg,
        depthM: auth.resolved_depth_m ?? cursor.depthM,
        resolvedTimeUtc: auth.resolved_time_utc,
      },
      sourceAssetId: auth.source_asset_id,
      sourceAssetSha256: auth.source_asset_sha256,
      selectionMethodUsed: auth.selection_method_used,
      gridIndexEvaluated: auth.grid_index_evaluated ?? undefined,
      rawResponse: auth,
    },
    delta: {
      absoluteDelta: reconcileResp.absolute_difference_delta ?? deltaMetrics.absoluteDelta,
      relativeDeltaPercent: reconcileResp.relative_difference_percent ?? deltaMetrics.relativeDeltaPercent,
      coordinateResolutionDistanceKm: deltaMetrics.coordinateResolutionDistanceKm,
      withinErrorBound: reconcileResp.within_estimated_error_bound ?? deltaMetrics.withinErrorBound,
    },
    reconciliationNotice: reconcileResp.reconciliation_notice,
    isLoading: false,
    error: null,
  };
}

/**
 * Render textual / HTML representation for accessibility & testing.
 */
export function formatPickReconciliationSummary(model: PickReconciliationModel): string {
  const c = model.cursor;
  const lines: string[] = [
    `=== SCIENTIFIC PICK RECONCILIATION ===`,
    `Cursor: Lon ${c.longitudeDeg.toFixed(4)}°, Lat ${c.latitudeDeg.toFixed(4)}°, Depth ${c.depthM.toFixed(3)}m, Time ${c.timestampUtc}`,
    `Provisional (GPU Render): ${model.provisional.approximateValue.toFixed(4)} ${model.provisional.displayUnits} (LOD ${model.provisional.lodLevel}, Bound ±${model.provisional.estimatedSampleErrorBound.toFixed(4)})`,
  ];

  if (model.isLoading) {
    lines.push(`Authoritative: Reconciling with canonical server...`);
  } else if (model.error) {
    lines.push(`Authoritative: Error: ${model.error}`);
  } else if (model.authoritative) {
    const auth = model.authoritative;
    const authValStr = auth.scientificValue !== null ? `${auth.scientificValue.toFixed(4)} ${auth.canonicalUnits}` : `[${auth.valueState.toUpperCase()}]`;
    lines.push(`Authoritative (Native NetCDF): ${authValStr}`);
    lines.push(`State: ${auth.valueState} | Method: ${auth.selectionMethodUsed}`);
    lines.push(`Resolved Coord: Lon ${auth.resolvedCoordinates.longitudeDeg.toFixed(4)}°, Lat ${auth.resolvedCoordinates.latitudeDeg.toFixed(4)}°, Depth ${auth.resolvedCoordinates.depthM.toFixed(3)}m`);
    lines.push(`Delta: Absolute Δ = ${model.delta.absoluteDelta !== null ? model.delta.absoluteDelta.toFixed(6) : 'N/A'}, Relative = ${model.delta.relativeDeltaPercent !== null ? model.delta.relativeDeltaPercent.toFixed(4) + '%' : 'N/A'}`);
    lines.push(`Resolution Distance: ${model.delta.coordinateResolutionDistanceKm.toFixed(4)} km`);
    lines.push(`Source SHA-256: ${auth.sourceAssetSha256}`);
  }

  return lines.join('\n');
}
