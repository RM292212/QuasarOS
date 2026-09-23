import React from 'react';
import { useAppStore } from '../../context/app_store.ts';

export const DatasetNavigation: React.FC = () => {
  const {
    activeDatasetId,
    activeSnapshotId,
    activeVariableId,
    availableVariables,
    spatialBounds,
    setActiveVariable,
    setActiveDataset,
  } = useAppStore();

  const DATASET_OPTIONS = [
    { id: 'copernicus_phy_thetao', label: 'CMEMS Global Physics (θ, S, u, v)' },
    { id: 'hycom_ocean_analysis', label: 'HYCOM GLBy0.08 Ocean Analysis' },
    { id: 'incois_wavewatch3', label: 'INCOIS WaveWatch-III Indian Ocean' },
    { id: 'gebco_2026_bathymetry', label: 'GEBCO 2026 High-Res Bathymetry' },
    { id: 'woa23_climatology', label: 'NOAA NCEI WOA23 Climatology' },
  ];

  return (
    <div
      data-testid="dataset-navigation"
      className="bg-scientific-panel/90 backdrop-blur border-b border-scientific-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      {/* Left: Active Dataset & Variable Selection */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Dataset Family Info */}
        <div className="flex items-center gap-2">
          <label htmlFor="dataset-select" className="text-scientific-muted font-mono uppercase text-[11px]">
            Dataset:
          </label>
          <div className="relative">
            <select
              id="dataset-select"
              data-testid="dataset-selector"
              value={activeDatasetId}
              onChange={(e) => setActiveDataset(e.target.value)}
              className="bg-scientific-card border border-scientific-border rounded px-2.5 py-1 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none appearance-none pr-8 cursor-pointer hover:border-emerald-600 transition-colors"
            >
              {DATASET_OPTIONS.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-scientific-muted">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Variable Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="variable-select" className="text-scientific-muted font-mono uppercase text-[11px]">
            Variable:
          </label>
          <div className="relative">
            <select
              id="variable-select"
              data-testid="variable-selector"
              value={activeVariableId}
              onChange={(e) => setActiveVariable(e.target.value)}
              className="bg-scientific-card border border-scientific-border rounded px-2.5 py-1 text-xs font-mono text-sky-300 focus:border-sky-500 focus:outline-none appearance-none pr-8 cursor-pointer hover:border-sky-600 transition-colors"
            >
              {availableVariables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-scientific-muted">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Spatial Domain Bounds & Depth Extents */}
      <div className="flex items-center gap-3 font-mono text-[11px] text-gray-300 flex-wrap">
        {/* Geodetic Box Indicator */}
        <div
          data-testid="spatial-bounds-pill"
          className="flex items-center gap-2 bg-scientific-card px-2.5 py-1 rounded border border-scientific-border"
          title="Geodetic Spatial Bounds (WGS-84)"
        >
          <span className="text-scientific-muted">LON:</span>
          <span className="text-sky-300">
            [{spatialBounds.minLon.toFixed(1)}°E, {spatialBounds.maxLon.toFixed(1)}°E]
          </span>
          <span className="text-scientific-border">|</span>
          <span className="text-scientific-muted">LAT:</span>
          <span className="text-sky-300">
            [{spatialBounds.minLat.toFixed(1)}°N, {spatialBounds.maxLat.toFixed(1)}°N]
          </span>
        </div>

        {/* Vertical Depth Extents */}
        <div
          data-testid="depth-extents-pill"
          className="flex items-center gap-2 bg-scientific-card px-2.5 py-1 rounded border border-scientific-border"
          title="Vertical Depth Range (50 Non-Uniform Levels)"
        >
          <span className="text-scientific-muted">DEPTH:</span>
          <span className="text-amber-300">
            {spatialBounds.minDepthM.toFixed(3)} m → 5727.917 m
          </span>
          <span className="px-1.5 py-0.2 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded text-[9px]">
            50 LVLS
          </span>
        </div>
      </div>
    </div>
  );
};
