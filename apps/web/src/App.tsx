import { OceanVolumeViewport } from './components/viewport/OceanVolumeViewport.tsx';
import React, { useState, useMemo } from 'react';
import { Header, DatasetNavigation, TimelineController } from './components/shell/index.ts';
import {
  TransferFunctionModel,
  VolumeQualityModel,
  PhysicalClippingModel,
} from './components/controls/index.ts';
import { TransferFunctionLegendControls } from './components/controls/TransferFunctionLegendControls.tsx';
import {
  PickReconciliationPanel,
  VerticalProfileChart,
  ProvenanceDrawer,
  buildPickReconciliationModel,
  buildVerticalProfileChartModel,
  COPERNICUS_31_DEPTH_LEVELS,
} from './components/inspection/index.ts';
import { TransectDraw, HorizontalSlice, TSDiagram } from './components/analysis/index.ts';
import { Teos10SoundingsPanel } from './components/analysis/Teos10SoundingsPanel.tsx';
import { ObservationComparisonPanel, ObservationComparisonModel } from './components/observations/index.ts';
import {
  ClippingController,
  CoordinateTransformer,
  DepthLookupTable,
} from '../../../packages/runtime/src/index.ts';
import type {
  ExactValueQueryResponse,
  ProvisionalRenderPickResponse,
  ReconcilePickResponse,
  VerticalProfileQueryResponse,
} from '@quasar/client';

export const App: React.FC = () => {
  // Initialize baseline models for transfer function, quality, and physical clipping
  const tfModel = useMemo(
    () =>
      new TransferFunctionModel({
        colormapName: 'viridis',
        domainMin: 9.374713,
        domainMax: 30.361834,
        unit: 'Â°C',
      }),
    []
  );

  const qualityModel = useMemo(() => new VolumeQualityModel(), []);

  const clippingModel = useMemo(() => {
    const lut = new DepthLookupTable(COPERNICUS_31_DEPTH_LEVELS);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: 80.0,
        maxLongitudeDeg: 88.0,
        minLatitudeDeg: -3.0,
        maxLatitudeDeg: 12.0,
        minDepthM: COPERNICUS_31_DEPTH_LEVELS[0],
        maxDepthM: COPERNICUS_31_DEPTH_LEVELS[COPERNICUS_31_DEPTH_LEVELS.length - 1],
      },
      lut
    );
    const clippingCtrl = new ClippingController(transformer);
    return new PhysicalClippingModel(clippingCtrl);
  }, []);

  // UI state for panels and drawers
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [isInspectionExpanded, setIsInspectionExpanded] = useState(true);
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);
  const [isObservationExpanded, setIsObservationExpanded] = useState(true);

  // Baseline Pick Reconciliation state
  const mockCursor = useMemo(
    () => ({
      longitudeDeg: 83.5,
      latitudeDeg: 6.2,
      depthM: 15.81,
      timestampUtc: '2026-08-30T00:00:00Z',
    }),
    []
  );

  const mockProvisional: ProvisionalRenderPickResponse = useMemo(
    () => ({
      response_type: 'approximate_render_sample',
      visualization_product_id: 'vis_copernicus_thetao_20260824_20260830',
      lod_level: 0,
      approximate_value: 28.452,
      display_units: 'Â°C',
      world_ray_hit_position: [12000, -45000, -15.81],
      estimated_sample_error_bound: 0.05,
      approximation_notice: 'Provisional GPU raymarch sample',
    }),
    []
  );

  const mockAuth: ExactValueQueryResponse = useMemo(
    () => ({
      response_type: 'authoritative_scientific_value',
      dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
      variable_id: 'sea_water_potential_temperature',
      scientific_value: 28.421,
      canonical_units: 'degree_Celsius',
      value_state: 'valid',
      requested_latitude_deg: 6.2,
      requested_longitude_deg: 83.5,
      resolved_latitude_deg: 6.208,
      resolved_longitude_deg: 83.504,
      resolved_depth_m: 15.81007,
      resolved_time_utc: '2026-08-30T00:00:00Z',
      grid_index_evaluated: [6, 10, 110, 42],
      selection_method_used: 'trilinear_interpolation',
      source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
      source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    }),
    []
  );

  const mockReconcileResp: ReconcilePickResponse = useMemo(
    () => ({
      response_type: 'authoritative_reconciled_pick',
      provisional_value: 28.452,
      provisional_lod_level: 0,
      estimated_sample_error_bound: 0.05,
      authoritative_response: mockAuth,
      absolute_difference_delta: 0.031,
      relative_difference_percent: 0.109,
      within_estimated_error_bound: true,
      reconciliation_notice: 'Reconciled against native NetCDF float32 ground truth.',
    }),
    [mockAuth]
  );

  const pickModel = useMemo(
    () => buildPickReconciliationModel(mockCursor, mockProvisional, mockReconcileResp),
    [mockCursor, mockProvisional, mockReconcileResp]
  );

  // Baseline 31-level Vertical Profile state
  const mockProfileResp: VerticalProfileQueryResponse = useMemo(
    () => ({
      response_type: 'authoritative_vertical_profile',
      dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
      variable_id: 'sea_water_potential_temperature',
      canonical_units: 'degree_Celsius',
      requested_latitude_deg: 6.2,
      requested_longitude_deg: 83.5,
      resolved_latitude_deg: 6.208,
      resolved_longitude_deg: 83.504,
      horizontal_distance_delta_km: 0.62,
      resolved_time_utc: '2026-08-30T00:00:00Z',
      selection_method_used: 'nearest_native_sample',
      total_levels: 31,
      valid_levels_count: 31,
      source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
      source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
      samples: COPERNICUS_31_DEPTH_LEVELS.map((depth, idx) => ({
        level_index: idx,
        depth_m: depth,
        scientific_value: 29.5 - Math.sqrt(depth) * 0.92,
        value_state: 'valid' as const,
      })),
    }),
    []
  );

  const profileModel = useMemo(() => buildVerticalProfileChartModel(mockProfileResp), [mockProfileResp]);

  const mockObservationModel: ObservationComparisonModel = useMemo(
    () => ({
      argoProfileId: 'R7900912',
      timestamp: '2026-08-30T12:00:00Z',
      latitude: 6.2,
      longitude: 83.5,
      samplesCount: 4,
      rmse: 0.152,
      meanBias: -0.05,
      layers: [
        { depthM: 10, argoTemperature: 28.5, modelTemperature: 28.6, delta: 0.1 },
        { depthM: 50, argoTemperature: 26.2, modelTemperature: 26.1, delta: -0.1 },
        { depthM: 100, argoTemperature: 20.1, modelTemperature: 20.3, delta: 0.2 },
        { depthM: 200, argoTemperature: 14.5, modelTemperature: 14.2, delta: -0.3 }
      ]
    }),
    []
  );

  return (
    <div
      className="h-screen w-screen flex flex-col bg-scientific-base text-scientific-text overflow-hidden"
      data-testid="quasar-app-root"
    >
      {/* Top Application Header */}
      <Header />

      {/* Dataset & Variable Navigation Bar */}
      <DatasetNavigation />

      {/* Main 3D Viewport & Analytical Workspace Area */}
      <main
        role="main"
        className="flex-1 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 to-[#070b14]"
      >
        {/* 3D Volume Raymarching Viewport Mock / Stage */}
        <div className="w-full h-full relative flex items-center justify-center">
          {/* Subtle Grid Backdrop */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.3) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />

          <OceanVolumeViewport />
        </div>

        {/* Floating Left Scientific Controls Panel */}
        <div className="absolute top-4 left-4 z-20 w-80 max-h-[calc(100vh-140px)] overflow-y-auto">
          <TransferFunctionLegendControls
            tfModel={tfModel}
            qualityModel={qualityModel}
            clippingModel={clippingModel}
            onOpenProvenance={() => setIsProvenanceOpen(true)}
          />
        </div>

        {/* Floating Right Analytical Panels (Pick Reconciliation & 31-Level Vertical Profile) */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-3 w-80 max-h-[calc(100vh-140px)] overflow-y-auto">
          <TransectDraw />
          <HorizontalSlice />
          <TSDiagram />

          {/* Pick Reconciliation Panel */}
          {isInspectionExpanded ? (
            <div className="relative">
              <PickReconciliationPanel model={pickModel} onReconcileRequest={() => {}} />
              <button
                onClick={() => setIsInspectionExpanded(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 text-xs"
                title="Collapse Pick Panel"
                aria-label="Collapse Pick Panel"
              >
                â–¼
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsInspectionExpanded(true)}
              className="bg-slate-900/90 border border-slate-700 p-2 rounded text-xs font-mono text-cyan-300 text-left hover:bg-slate-850 transition flex justify-between items-center"
            >
              <span>â–¶ Point Pick & Reconciliation</span>
            </button>
          )}

          {/* 31-Level Vertical Sounding Profile */}
          {isProfileExpanded ? (
            <div className="relative">
              <VerticalProfileChart model={profileModel} width={300} height={260} />
              <button
                onClick={() => setIsProfileExpanded(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 text-xs"
                title="Collapse Profile Chart"
                aria-label="Collapse Profile Chart"
              >
                â–¼
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsProfileExpanded(true)}
              className="bg-slate-900/90 border border-slate-700 p-2 rounded text-xs font-mono text-cyan-300 text-left hover:bg-slate-850 transition flex justify-between items-center"
            >
              <span>â–¶ Vertical Sounding Profile (31 Lvls)</span>
            </button>
          )}

          {/* Observation Comparison Panel */}
          {isObservationExpanded ? (
            <div className="relative">
              <ObservationComparisonPanel model={mockObservationModel} onClose={() => setIsObservationExpanded(false)} />
            </div>
          ) : (
            <button
              onClick={() => setIsObservationExpanded(true)}
              className="bg-slate-900/90 border border-slate-700 p-2 rounded text-xs font-mono text-emerald-300 text-left hover:bg-slate-850 transition flex justify-between items-center"
            >
              <span>â–¶ Observation vs Model</span>
            </button>
          )}
          
          <Teos10SoundingsPanel
            latitude={mockCursor.latitudeDeg}
            longitude={mockCursor.longitudeDeg}
            timeIndex={0}
          />
        </div>

        {/* Lineage & Provenance Slide-Over Drawer */}
        <ProvenanceDrawer
          isOpen={isProvenanceOpen}
          onClose={() => setIsProvenanceOpen(false)}
        />
      </main>

      {/* Bottom 7-Day Operational Timeline Scrubber */}
      <TimelineController />
    </div>
  );
};

