import React, { useState, useMemo, useEffect } from 'react';
import { OceanVolumeViewport, CesiumOverviewViewport } from './components/viewport/index.ts';
import { Header, DatasetNavigation, TimelineController } from './components/shell/index.ts';
import { useAppStore } from './context/app_store.ts';
import {
  TransferFunctionModel,
  VolumeQualityModel,
  PhysicalClippingModel,
} from './components/controls/index.ts';
import { TransferFunctionLegendControls } from './components/controls/TransferFunctionLegendControls.tsx';
import {
  PickReconciliationPanel,
  VerticalProfileChart,
  SoundingInspectionPanel,
  ProvenanceDrawer,
  buildPickReconciliationModel,
  buildVerticalProfileChartModel,
  COPERNICUS_31_DEPTH_LEVELS,
  COPERNICUS_50_DEPTH_LEVELS,
} from './components/inspection/index.ts';
import { TransectDraw, HorizontalSlice, TSDiagram } from './components/analysis/index.ts';
import { Teos10SoundingsPanel } from './components/analysis/Teos10SoundingsPanel.tsx';
import { ObservationComparisonPanel, ObservationComparisonModel, getCollocationModelForFloat } from './components/observations/index.ts';
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

type AnalyticalTab = 'all' | 'pick' | 'profile' | 'obs' | 'teos10' | 'transect' | 'slice' | 'ts';

export const App: React.FC = () => {
  const {
    activeWorkspace,
    setActiveWorkspace,
    timestepIndex,
    timesteps,
    currentDateIso,
    activeVariableId,
    spatialBounds,
    selectedFloatId,
  } = useAppStore();

  // Initialize baseline models for transfer function, quality, and physical clipping
  const tfModel = useMemo(
    () =>
      new TransferFunctionModel({
        colormapName: 'thermal',
        domainMin: 1.106397,
        domainMax: 30.776495,
        unit: '°C',
      }),
    []
  );

  useEffect(() => {
    if (tfModel && activeVariableId) {
      const code = activeVariableId.split(' ')[0].toLowerCase();
      tfModel.configureForVariable(code);
    }
  }, [tfModel, activeVariableId]);

  const qualityModel = useMemo(() => new VolumeQualityModel(), []);

  const clippingModel = useMemo(() => {
    const minLon = Math.min(spatialBounds.minLon, spatialBounds.maxLon);
    const maxLon = Math.max(spatialBounds.minLon, spatialBounds.maxLon);
    const safeMaxLon = maxLon > minLon ? maxLon : minLon + 0.1;

    const minLat = Math.min(spatialBounds.minLat, spatialBounds.maxLat);
    const maxLat = Math.max(spatialBounds.minLat, spatialBounds.maxLat);
    const safeMaxLat = maxLat > minLat ? maxLat : minLat + 0.1;

    const minDepth = spatialBounds.minDepthM ?? COPERNICUS_50_DEPTH_LEVELS[0];
    const maxDepth = spatialBounds.maxDepthM ?? COPERNICUS_50_DEPTH_LEVELS[COPERNICUS_50_DEPTH_LEVELS.length - 1];
    const safeMaxDepth = maxDepth > minDepth ? maxDepth : minDepth + 1.0;

    const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: minLon,
        maxLongitudeDeg: safeMaxLon,
        minLatitudeDeg: minLat,
        maxLatitudeDeg: safeMaxLat,
        minDepthM: minDepth,
        maxDepthM: safeMaxDepth,
      },
      lut
    );
    const clippingCtrl = new ClippingController(transformer);
    return new PhysicalClippingModel(clippingCtrl);
  }, [spatialBounds.minLon, spatialBounds.maxLon, spatialBounds.minLat, spatialBounds.maxLat, spatialBounds.minDepthM, spatialBounds.maxDepthM]);

  // UI state for panels and drawers
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticalTab>('all');
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
      display_units: '°C',
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

  // Synchronized Vertical Profile state derived dynamically from active timestep and variable
  const dynamicProfileResp: VerticalProfileQueryResponse = useMemo(() => {
    const activeDate = (timesteps && timesteps[timestepIndex]) || currentDateIso || '2026-08-30';
    const sst = 30.25 + 0.088 * timestepIndex;
    const thermoclineDepth = 180.0 + timestepIndex * 8.0;

    return {
      response_type: 'authoritative_vertical_profile',
      dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
      variable_id: activeVariableId || 'sea_water_potential_temperature',
      canonical_units: activeVariableId?.includes('salinity') ? 'g/kg' : activeVariableId?.includes('speed') ? 'm/s' : '°C',
      requested_latitude_deg: 6.2,
      requested_longitude_deg: 83.5,
      resolved_latitude_deg: 6.208,
      resolved_longitude_deg: 83.504,
      horizontal_distance_delta_km: 0.62,
      resolved_time_utc: `${activeDate}T00:00:00Z`,
      selection_method_used: 'nearest_native_sample',
      total_levels: 31,
      valid_levels_count: 31,
      source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
      source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
      samples: COPERNICUS_31_DEPTH_LEVELS.map((depth, idx) => ({
        level_index: idx,
        depth_m: depth,
        scientific_value: Number((1.09 + (sst - 1.09) * Math.exp(-depth / thermoclineDepth)).toFixed(4)),
        value_state: 'valid' as const,
      })),
    };
  }, [timestepIndex, timesteps, currentDateIso, activeVariableId]);

  const profileModel = useMemo(() => buildVerticalProfileChartModel(dynamicProfileResp), [dynamicProfileResp]);

  const activeObservationModel: ObservationComparisonModel = useMemo(
    () => getCollocationModelForFloat(selectedFloatId),
    [selectedFloatId]
  );

  const tabs: { id: AnalyticalTab; label: string; shortLabel: string }[] = [
    { id: 'all', label: 'All Panels', shortLabel: 'All' },
    { id: 'pick', label: 'Point Pick', shortLabel: 'Pick' },
    { id: 'profile', label: 'Vertical Profile', shortLabel: 'Profile' },
    { id: 'obs', label: 'Model vs Obs', shortLabel: 'Obs' },
    { id: 'teos10', label: 'TEOS-10 Sounding', shortLabel: 'TEOS-10' },
    { id: 'transect', label: 'Transect Draw', shortLabel: 'Transect' },
    { id: 'slice', label: 'Horizontal Slice', shortLabel: 'Slice' },
    { id: 'ts', label: 'T-S Diagram', shortLabel: 'T-S' },
  ];

  return (
    <div
      className="h-screen w-screen flex flex-col bg-scientific-base text-scientific-text overflow-hidden"
      data-testid="quasar-app-root"
    >
      {/* Top Application Header */}
      <Header />

      {/* Dataset & Variable Navigation Bar with Workspace Mode Switcher */}
      <div className="flex items-center justify-between bg-slate-950/90 border-b border-slate-800 px-4 py-1.5 z-20">
        <DatasetNavigation />

        {/* Workspace Mode Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Workspace View Mode"
          className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono text-xs shadow-inner"
        >
          <button
            role="tab"
            id="tab-overview"
            aria-selected={activeWorkspace === 'overview'}
            data-testid="workspace-tab-overview"
            onClick={() => setActiveWorkspace('overview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition ${
              activeWorkspace === 'overview'
                ? 'bg-cyan-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v.183a1.996 1.996 0 01-.64 1.458l-.004.004-.002.002a2 2 0 00-.707 1.442A5.974 5.974 0 0110 16a5.972 5.972 0 01-5.668-7.973z"
                clipRule="evenodd"
              />
            </svg>
            <span>Overview (Cesium)</span>
          </button>

          <button
            role="tab"
            id="tab-volume"
            aria-selected={activeWorkspace === 'volume'}
            data-testid="workspace-tab-volume"
            onClick={() => setActiveWorkspace('volume')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition ${
              activeWorkspace === 'volume'
                ? 'bg-cyan-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
              <path
                fillRule="evenodd"
                d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>Volume Lab (3D)</span>
          </button>
        </div>
      </div>

      {/* Main Viewport & Analytical Workspace Area */}
      <main
        role="main"
        className="flex-1 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 to-[#070b14]"
      >
        {activeWorkspace === 'overview' ? (
          /* ADR-0002 Geospatial Overview Workspace */
          <div className="w-full h-full relative" data-testid="overview-workspace-container">
            <CesiumOverviewViewport onOpenVolumeMode={() => setActiveWorkspace('volume')} />
          </div>
        ) : (
          /* 3D Scientific Volume Lab Workspace */
          <>
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

              <OceanVolumeViewport
                tfModel={tfModel}
                qualityModel={qualityModel}
                clippingModel={clippingModel}
              />
            </div>

            {/* Floating Left Scientific Controls Panel */}
            <div
              data-testid="left-controls-container"
              className="absolute top-4 left-4 z-20 w-80 max-h-[calc(100vh-140px)] overflow-y-auto"
            >
              <TransferFunctionLegendControls
                tfModel={tfModel}
                qualityModel={qualityModel}
                clippingModel={clippingModel}
                onOpenProvenance={() => setIsProvenanceOpen(true)}
              />
            </div>

            {/* Right Collapsible Tabbed Analytical Drawer */}
            {!isDrawerOpen ? (
              <button
                data-testid="drawer-toggle-open"
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Expand analytical workspace drawer"
                className="absolute top-4 right-4 z-20 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sky-400 font-mono text-xs px-3 py-2 rounded-lg shadow-xl flex items-center gap-2 transition focus:ring-2 focus:ring-sky-400 focus:outline-none"
              >
                <span>◀ Analytical Tools (7)</span>
              </button>
            ) : (
              <aside
                data-testid="analytical-drawer"
                role="region"
                aria-label="Analytical Workspace Drawer"
                className="absolute top-4 right-4 z-20 w-80 md:w-96 max-w-[calc(100vw-360px)] max-h-[calc(100vh-140px)] flex flex-col bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg shadow-2xl overflow-hidden text-slate-200"
              >
                {/* Drawer Header & Tab Strip */}
                <div className="p-2.5 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                        Analytical Workspace
                      </h2>
                    </div>
                    <button
                      data-testid="drawer-toggle-close"
                      onClick={() => setIsDrawerOpen(false)}
                      aria-label="Collapse analytical drawer"
                      className="text-slate-400 hover:text-white text-xs font-mono px-2 py-0.5 rounded hover:bg-slate-800 transition focus:ring-1 focus:ring-sky-400 focus:outline-none"
                      title="Collapse drawer"
                    >
                      ▶ Collapse
                    </button>
                  </div>

                  {/* Tab Strip */}
                  <div
                    role="tablist"
                    aria-label="Analytical Tools Tabs"
                    className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono"
                  >
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        role="tab"
                        id={`tab-${tab.id}`}
                        aria-controls={`tabpanel-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        data-testid={`tab-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-2 py-1 rounded whitespace-nowrap font-medium transition focus:outline-none focus:ring-1 focus:ring-sky-400 ${
                          activeTab === tab.id
                            ? 'bg-sky-600 text-white shadow-sm font-bold'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {tab.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drawer Content Area */}
                <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3 max-h-[calc(100vh-210px)]">
                  {(activeTab === 'all' || activeTab === 'transect') && (
                    <div id="tabpanel-transect" role="tabpanel" aria-labelledby="tab-transect">
                      <TransectDraw />
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'slice') && (
                    <div id="tabpanel-slice" role="tabpanel" aria-labelledby="tab-slice">
                      <HorizontalSlice />
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'ts') && (
                    <div id="tabpanel-ts" role="tabpanel" aria-labelledby="tab-ts">
                      <TSDiagram />
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'pick') && (
                    <div id="tabpanel-pick" role="tabpanel" aria-labelledby="tab-pick" className="flex flex-col">
                      {isInspectionExpanded ? (
                        <div className="relative">
                          <PickReconciliationPanel model={pickModel} onReconcileRequest={() => {}} />
                          <button
                            onClick={() => setIsInspectionExpanded(false)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 text-xs font-bold p-1 rounded"
                            title="Collapse Pick Panel"
                            aria-label="Collapse Pick Panel"
                          >
                            ▼
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsInspectionExpanded(true)}
                          className="bg-slate-950/90 border border-slate-700 p-2 rounded text-xs font-mono text-cyan-300 text-left hover:bg-slate-800 transition flex justify-between items-center"
                        >
                          <span>▶ Point Pick & Reconciliation</span>
                        </button>
                      )}
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'profile') && (
                    <div id="tabpanel-profile" role="tabpanel" aria-labelledby="tab-profile" className="flex flex-col">
                      {isProfileExpanded ? (
                        <div className="relative">
                          <SoundingInspectionPanel onClose={() => setIsProfileExpanded(false)} />
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsProfileExpanded(true)}
                          className="bg-slate-950/90 border border-slate-700 p-2 rounded text-xs font-mono text-cyan-300 text-left hover:bg-slate-800 transition flex justify-between items-center"
                        >
                          <span>▶ Vertical Sounding Profile (50 Lvls)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'obs') && (
                    <div id="tabpanel-obs" role="tabpanel" aria-labelledby="tab-obs" className="flex flex-col">
                      {isObservationExpanded ? (
                        <div className="relative">
                          <ObservationComparisonPanel
                            model={activeObservationModel}
                            onClose={() => setIsObservationExpanded(false)}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsObservationExpanded(true)}
                          className="bg-slate-950/90 border border-slate-700 p-2 rounded text-xs font-mono text-emerald-300 text-left hover:bg-slate-800 transition flex justify-between items-center"
                        >
                          <span>▶ Observation vs Model</span>
                        </button>
                      )}
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'teos10') && (
                    <div id="tabpanel-teos10" role="tabpanel" aria-labelledby="tab-teos10">
                      <Teos10SoundingsPanel
                        latitude={mockCursor.latitudeDeg}
                        longitude={mockCursor.longitudeDeg}
                        timeIndex={timestepIndex}
                      />
                    </div>
                  )}
                </div>
              </aside>
            )}
          </>
        )}

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
