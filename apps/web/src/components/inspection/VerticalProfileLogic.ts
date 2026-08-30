/**
 * Vertical Sounding Profile Mathematics and SVG/Canvas Renderer.
 *
 * Implements:
 * 1. 31-level Copernicus non-uniform depth coordinate mapping (0.494m to 453.938m).
 * 2. Piecewise linear interpolation and monotonic depth scale.
 * 3. Robust handling of missing, masked, or below-seabed data points.
 * 4. SVG generator with semantic data attributes, axes ticks, grid lines, and responsive viewport viewBox.
 */

import type { PhysicalCellState, VerticalProfileLevelSample, VerticalProfileQueryResponse } from '@quasar/client';
import type { VerticalProfileChartModel, VerticalProfileDataPoint } from './types.ts';

// 31 Copernicus standard depth levels (meters)
export const COPERNICUS_31_DEPTH_LEVELS = [
  0.494025, 1.541375, 2.645669, 3.819495, 5.078224, 6.440614, 7.92956, 9.572997,
  11.405, 13.46714, 15.81007, 18.49556, 21.59882, 25.21141, 29.44473, 34.43415,
  40.34405, 47.37369, 55.76429, 65.80727, 77.85385, 92.32607, 109.7293, 130.666,
  155.8507, 186.1256, 222.4752, 266.0403, 318.1274, 380.213, 453.9377
];

export interface ChartDimensions {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
  width: 360,
  height: 480,
  marginTop: 24,
  marginRight: 24,
  marginBottom: 48,
  marginLeft: 56,
};

/**
 * Transform VerticalProfileQueryResponse into VerticalProfileChartModel.
 */
export function buildVerticalProfileChartModel(
  response: VerticalProfileQueryResponse
): VerticalProfileChartModel {
  const dataPoints: VerticalProfileDataPoint[] = [];
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < response.samples.length; i++) {
    const s = response.samples[i];
    const isValValid =
      s.value_state === 'valid' &&
      s.scientific_value !== null &&
      s.scientific_value !== undefined &&
      !isNaN(s.scientific_value);

    const val = isValValid ? (s.scientific_value as number) : null;
    if (val !== null) {
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    dataPoints.push({
      levelIndex: s.level_index ?? i,
      depthM: s.depth_m,
      scientificValue: val,
      valueState: s.value_state,
      isGap: !isValValid,
    });
  }

  // Handle edge case where all values are missing
  if (minVal === Infinity || maxVal === -Infinity) {
    minVal = 0.0;
    maxVal = 30.0;
  } else if (Math.abs(maxVal - minVal) < 1e-3) {
    minVal -= 1.0;
    maxVal += 1.0;
  }

  const minDepth = dataPoints.length > 0 ? dataPoints[0].depthM : COPERNICUS_31_DEPTH_LEVELS[0];
  const maxDepth =
    dataPoints.length > 0
      ? dataPoints[dataPoints.length - 1].depthM
      : COPERNICUS_31_DEPTH_LEVELS[COPERNICUS_31_DEPTH_LEVELS.length - 1];

  return {
    datasetId: response.dataset_id,
    variableId: response.variable_id,
    canonicalUnits: response.canonical_units,
    requestedLongitudeDeg: response.requested_longitude_deg,
    requestedLatitudeDeg: response.requested_latitude_deg,
    resolvedLongitudeDeg: response.resolved_longitude_deg,
    resolvedLatitudeDeg: response.resolved_latitude_deg,
    horizontalDistanceDeltaKm: response.horizontal_distance_delta_km,
    resolvedTimeUtc: response.resolved_time_utc,
    sourceAssetId: response.source_asset_id,
    sourceAssetSha256: response.source_asset_sha256,
    totalLevels: response.total_levels,
    validLevelsCount: response.valid_levels_count,
    dataPoints,
    minDepthM: minDepth,
    maxDepthM: maxDepth,
    minValue: minVal,
    maxValue: maxVal,
  };
}

/**
 * Depth mapping modes:
 * - 'log': Logarithmic or non-uniform square-root compression (better for upper ocean boundary layer)
 * - 'linear': Linear metric depth
 * - 'level_index': Uniform level spacing
 */
export type DepthScaleMode = 'linear' | 'log' | 'level_index';

/**
 * Map depth (m) to Y-pixel coordinate within [yMin, yMax].
 */
export function mapDepthToY(
  depthM: number,
  minDepthM: number,
  maxDepthM: number,
  yMin: number,
  yMax: number,
  mode: DepthScaleMode = 'linear'
): number {
  if (mode === 'log') {
    const offset = 1.0;
    const logMin = Math.log(minDepthM + offset);
    const logMax = Math.log(maxDepthM + offset);
    const logVal = Math.log(Math.max(minDepthM, Math.min(maxDepthM, depthM)) + offset);
    const t = (logVal - logMin) / (logMax - logMin);
    return yMin + t * (yMax - yMin);
  }

  // Linear metric depth
  const t = (depthM - minDepthM) / (maxDepthM - minDepthM);
  return yMin + Math.max(0.0, Math.min(1.0, t)) * (yMax - yMin);
}

/**
 * Map scalar value to X-pixel coordinate within [xMin, xMax].
 */
export function mapValueToX(
  val: number,
  minValue: number,
  maxValue: number,
  xMin: number,
  xMax: number
): number {
  const t = (val - minValue) / (maxValue - minValue);
  return xMin + Math.max(0.0, Math.min(1.0, t)) * (xMax - xMin);
}

/**
 * Generate complete SVG XML string representing 31-level vertical profile chart.
 */
export function generateVerticalProfileSvg(
  model: VerticalProfileChartModel,
  dims: ChartDimensions = DEFAULT_CHART_DIMENSIONS,
  scaleMode: DepthScaleMode = 'linear'
): string {
  const plotWidth = dims.width - dims.marginLeft - dims.marginRight;
  const plotHeight = dims.height - dims.marginTop - dims.marginBottom;
  const xMin = dims.marginLeft;
  const xMax = dims.marginLeft + plotWidth;
  const yMin = dims.marginTop;
  const yMax = dims.marginTop + plotHeight;

  // Generate continuous line segments separating missing gaps
  const segments: Array<Array<{ x: number; y: number; dp: VerticalProfileDataPoint }>> = [];
  let currentSegment: Array<{ x: number; y: number; dp: VerticalProfileDataPoint }> = [];

  for (const dp of model.dataPoints) {
    if (dp.scientificValue !== null && !dp.isGap) {
      const x = mapValueToX(dp.scientificValue, model.minValue, model.maxValue, xMin, xMax);
      const y = mapDepthToY(dp.depthM, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode);
      currentSegment.push({ x, y, dp });
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Build SVG elements
  const svgLines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dims.width} ${dims.height}" width="${dims.width}" height="${dims.height}" class="quasar-profile-chart" role="img" aria-label="31-Level Ocean Sounding Profile Chart">`,
    `  <style>`,
    `    .bg { fill: #0b1120; }`,
    `    .grid { stroke: #1e293b; stroke-width: 1; stroke-dasharray: 2,2; }`,
    `    .axis-line { stroke: #475569; stroke-width: 1.5; }`,
    `    .axis-text { fill: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; }`,
    `    .axis-label { fill: #cbd5e1; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 600; text-anchor: middle; }`,
    `    .profile-line { fill: none; stroke: #38bdf8; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }`,
    `    .data-point { fill: #0284c7; stroke: #bae6fd; stroke-width: 1.5; cursor: pointer; }`,
    `    .gap-point { fill: #475569; stroke: #64748b; stroke-width: 1; stroke-dasharray: 2,2; }`,
    `  </style>`,
    `  <rect width="${dims.width}" height="${dims.height}" class="bg" rx="6" />`,
  ];

  // Grid & X Ticks (Temperature)
  const xTickCount = 5;
  for (let i = 0; i <= xTickCount; i++) {
    const val = model.minValue + (i / xTickCount) * (model.maxValue - model.minValue);
    const x = xMin + (i / xTickCount) * plotWidth;
    svgLines.push(`  <line x1="${x.toFixed(1)}" y1="${yMin}" x2="${x.toFixed(1)}" y2="${yMax}" class="grid" />`);
    svgLines.push(`  <text x="${x.toFixed(1)}" y="${yMax + 14}" class="axis-text" text-anchor="middle">${val.toFixed(1)}</text>`);
  }

  // Grid & Y Ticks (Depth)
  const depthTicks = [0.5, 50, 100, 200, 300, 450];
  for (const d of depthTicks) {
    if (d >= model.minDepthM && d <= model.maxDepthM + 5) {
      const y = mapDepthToY(d, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode);
      svgLines.push(`  <line x1="${xMin}" y1="${y.toFixed(1)}" x2="${xMax}" y2="${y.toFixed(1)}" class="grid" />`);
      svgLines.push(`  <text x="${xMin - 6}" y="${(y + 3).toFixed(1)}" class="axis-text" text-anchor="end">${d.toFixed(0)}m</text>`);
    }
  }

  // Draw Axes
  svgLines.push(`  <line x1="${xMin}" y1="${yMin}" x2="${xMin}" y2="${yMax}" class="axis-line" />`);
  svgLines.push(`  <line x1="${xMin}" y1="${yMax}" x2="${xMax}" y2="${yMax}" class="axis-line" />`);

  // Axis Labels
  svgLines.push(`  <text x="${(xMin + plotWidth / 2).toFixed(1)}" y="${dims.height - 12}" class="axis-label">Temperature (${model.canonicalUnits})</text>`);
  svgLines.push(`  <text x="14" y="${(yMin + plotHeight / 2).toFixed(1)}" class="axis-label" transform="rotate(-90 14 ${(yMin + plotHeight / 2).toFixed(1)})">Depth (m)</text>`);

  // Draw Segments
  for (const seg of segments) {
    if (seg.length > 1) {
      const pathData = seg.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
      svgLines.push(`  <path d="${pathData}" class="profile-line" />`);
    }
  }

  // Draw Data Points & Gaps
  for (const dp of model.dataPoints) {
    const y = mapDepthToY(dp.depthM, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode);
    if (dp.scientificValue !== null && !dp.isGap) {
      const x = mapValueToX(dp.scientificValue, model.minValue, model.maxValue, xMin, xMax);
      svgLines.push(
        `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="data-point" data-level="${dp.levelIndex}" data-depth="${dp.depthM.toFixed(3)}" data-value="${dp.scientificValue.toFixed(3)}" />`
      );
    } else {
      // Mark gap or seabed boundary
      svgLines.push(
        `  <circle cx="${xMin.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" class="gap-point" data-level="${dp.levelIndex}" data-depth="${dp.depthM.toFixed(3)}" data-state="${dp.valueState}" />`
      );
    }
  }

  svgLines.push(`</svg>`);
  return svgLines.join('\n');
}
