/**
 * QuasarOS Geospatial Explorer Overview Viewport (ADR-0002 Compliant)
 *
 * Implements:
 * 1. Dedicated ocean overview workspace isolated from the 3D volume GPU context.
 * 2. Georeferenced ocean basemap with graticules, bathymetric context, and coastlines.
 * 3. Interactive ROI selection presets (Arabian Sea, Bay of Bengal, Equatorial Indian Ocean).
 * 4. Interactive bounding box selection with real-time coordinate updates to app_store.
 * 5. Interactive Argo float marker pins (D1902669_012, R1902581_050, SR1902594_001) with popup cards.
 * 6. "Inspect 3D Volume" bridge transferring spatial bounds into Volume Lab mode.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  useAppStore,
  ROI_PRESETS,
  ARGO_FLOAT_CATALOG,
  GLIDER_CATALOG,
  OTHER_OBSERVATIONS_CATALOG,
  ArgoFloatMetadata,
  GliderMetadata,
  ObservationPlatformMetadata,
  BoundingBox,
} from '../../context/app_store.ts';

// Regional Geodetic Extent for the North Indian Ocean Overview Map
const MAP_BOUNDS = {
  minLon: 40.0,
  maxLon: 102.0,
  minLat: -10.0,
  maxLat: 30.0,
};

// Map projection helpers (Equirectangular Plate Carrée Projection)
function lonToX(lon: number, width: number): number {
  return ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * width;
}

function latToY(lat: number, height: number): number {
  // Invert Y so North is at top
  return ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
}

function xToLon(x: number, width: number): number {
  return MAP_BOUNDS.minLon + (x / width) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
}

function yToLat(y: number, height: number): number {
  return MAP_BOUNDS.maxLat - (y / height) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
}

export interface CesiumOverviewViewportProps {
  onOpenVolumeMode?: () => void;
}

export const CesiumOverviewViewport: React.FC<CesiumOverviewViewportProps> = ({
  onOpenVolumeMode,
}) => {
  const {
    spatialBounds,
    selectedBoundingBox,
    selectedFloatId,
    activeDatasetId,
    setActiveWorkspace,
    selectROI,
    applyROIPreset,
    setSelectedFloat,
  } = useAppStore();

  const [activePresetId, setActivePresetId] = useState<string>('arabian_sea');
  const [isDrawingBox, setIsDrawingBox] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [showCoverageLayers, setShowCoverageLayers] = useState<boolean>(true);
  const [showArgoLayer, setShowArgoLayer] = useState<boolean>(true);
  const [showGliderLayer, setShowGliderLayer] = useState<boolean>(true);
  const [showMooringsLayer, setShowMooringsLayer] = useState<boolean>(true);
  const [hoveredFloat, setHoveredFloat] = useState<ArgoFloatMetadata | null>(null);
  const [popupFloat, setPopupFloat] = useState<ArgoFloatMetadata | null>(
    ARGO_FLOAT_CATALOG.find((f) => f.id === selectedFloatId) || ARGO_FLOAT_CATALOG[0]
  );
  const [popupGlider, setPopupGlider] = useState<GliderMetadata | null>(null);
  const [popupPlatform, setPopupPlatform] = useState<ObservationPlatformMetadata | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const svgWidth = 960;
  const svgHeight = 620;

  // Active Bounding Box coordinates
  const currentBox: BoundingBox = useMemo(() => {
    if (selectedBoundingBox) {
      return selectedBoundingBox;
    }
    return {
      west: spatialBounds.minLon,
      east: spatialBounds.maxLon,
      south: spatialBounds.minLat,
      north: spatialBounds.maxLat,
      minDepthM: spatialBounds.minDepthM,
      maxDepthM: spatialBounds.maxDepthM,
    };
  }, [selectedBoundingBox, spatialBounds]);

  // Projected SVG coordinates for the active bounding box
  const boxRect = useMemo(() => {
    const x1 = lonToX(currentBox.west, svgWidth);
    const x2 = lonToX(currentBox.east, svgWidth);
    const y1 = latToY(currentBox.north, svgHeight); // North is smaller Y
    const y2 = latToY(currentBox.south, svgHeight); // South is larger Y

    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    return { x, y, w, h };
  }, [currentBox, svgWidth, svgHeight]);

  // Handle Preset selection
  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    applyROIPreset(presetId);
  };

  // Handle Float pin click
  const handleFloatClick = (floatMeta: ArgoFloatMetadata) => {
    setSelectedFloat(floatMeta.id, floatMeta.cycleNumber);
    setPopupFloat(floatMeta);
  };

  // Switch to 3D Volume Viewport
  const handleEnterVolumeMode = () => {
    selectROI(currentBox);
    setActiveWorkspace('volume');
    if (onOpenVolumeMode) {
      onOpenVolumeMode();
    }
  };

  // Mouse drag handlers for custom box selection
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((e.clientY - rect.top) / rect.height) * svgHeight;

    setIsDrawingBox(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingBox || !svgRef.current || !drawStart) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(svgWidth, ((e.clientX - rect.left) / rect.width) * svgWidth));
    const y = Math.max(0, Math.min(svgHeight, ((e.clientY - rect.top) / rect.height) * svgHeight));
    setDrawCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (isDrawingBox && drawStart && drawCurrent) {
      const minX = Math.min(drawStart.x, drawCurrent.x);
      const maxX = Math.max(drawStart.x, drawCurrent.x);
      const minY = Math.min(drawStart.y, drawCurrent.y);
      const maxY = Math.max(drawStart.y, drawCurrent.y);

      // Minimum drag threshold to avoid accidental micro-drags
      if (maxX - minX > 15 && maxY - minY > 15) {
        const west = parseFloat(xToLon(minX, svgWidth).toFixed(2));
        const east = parseFloat(xToLon(maxX, svgWidth).toFixed(2));
        const north = parseFloat(yToLat(minY, svgHeight).toFixed(2));
        const south = parseFloat(yToLat(maxY, svgHeight).toFixed(2));

        const newBox: BoundingBox = {
          west,
          east,
          south,
          north,
          minDepthM: currentBox.minDepthM ?? 0.494,
          maxDepthM: currentBox.maxDepthM ?? 5727.917,
        };

        selectROI(newBox);
        setActivePresetId('custom');
      }
    }
    setIsDrawingBox(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // In-progress drawing preview box
  const drawPreviewRect = useMemo(() => {
    if (!isDrawingBox || !drawStart || !drawCurrent) return null;
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    return { x, y, w, h };
  }, [isDrawingBox, drawStart, drawCurrent]);

  // Graticule Lines (Lon: 50, 60, 70, 80, 90, 100; Lat: -10, 0, 10, 20, 30)
  const graticuleLon = [50, 60, 70, 80, 90, 100];
  const graticuleLat = [-10, 0, 10, 20, 30];

  return (
    <div
      className="relative w-full h-full flex flex-col bg-[#050b14] overflow-hidden select-none font-sans text-slate-200"
      data-testid="cesium-overview-viewport"
      role="region"
      aria-label="Geospatial Explorer Overview Viewport"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-lg shadow-2xl">
        {/* Preset Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider">
            ROI Presets:
          </span>
          <div className="flex items-center gap-1">
            {ROI_PRESETS.map((preset) => (
              <button
                key={preset.id}
                data-testid={`roi-preset-${preset.id.replace('_', '-')}`}
                onClick={() => handleSelectPreset(preset.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  activePresetId === preset.id
                    ? 'bg-cyan-600 text-white shadow font-bold ring-1 ring-cyan-400'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Dataset Family Selector */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            Dataset:
          </span>
          <select
            data-testid="select-dataset-family"
            aria-label="Dataset Family"
            className="bg-slate-900 border border-slate-700 text-sky-300 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-sky-400 focus:outline-none"
            defaultValue="cmems_phy"
          >
            <option value="cmems_phy">CMEMS PHY (Mercator 0.083°)</option>
            <option value="hycom_exp">HYCOM Expanded (GLBy0.08)</option>
            <option value="incois_wave">INCOIS Waves (SWAN WaveWatch)</option>
            <option value="gebco_bathy">GEBCO 2026 Bathymetry (15 arcsec)</option>
            <option value="woa23_clim">WOA23 Climatology (0.25° In-Situ)</option>
          </select>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Layer Toggles */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showArgoLayer}
              onChange={(e) => setShowArgoLayer(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-400"
              data-testid="toggle-argo-layer"
            />
            <span>Argo ({ARGO_FLOAT_CATALOG.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showGliderLayer}
              onChange={(e) => setShowGliderLayer(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-400"
              data-testid="toggle-glider-layer"
            />
            <span>RU29 Glider</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showMooringsLayer}
              onChange={(e) => setShowMooringsLayer(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-violet-500 focus:ring-violet-400"
              data-testid="toggle-moorings-layer"
            />
            <span>Moorings / OMNI ({OTHER_OBSERVATIONS_CATALOG.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showCoverageLayers}
              onChange={(e) => setShowCoverageLayers(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-400"
              data-testid="toggle-coverage-layer"
            />
            <span>Coverage</span>
          </label>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Enter Volume Mode CTA */}
        <button
          onClick={handleEnterVolumeMode}
          data-testid="btn-open-volume-mode"
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-500 hover:from-cyan-500 hover:to-sky-400 text-white font-bold font-mono text-xs rounded shadow-lg shadow-sky-500/20 transition-all transform active:scale-95 ring-1 ring-sky-300"
        >
          <span>Inspect 3D Volume</span>
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Main Interactive Geospatial Map Canvas / SVG Area */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full max-h-[calc(100vh-160px)] rounded-xl border border-slate-800 shadow-2xl bg-[#071326] cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <defs>
            {/* Ocean Bathymetry Gradient */}
            <radialGradient id="oceanDeepGrad" cx="55%" cy="60%" r="65%">
              <stop offset="0%" stopColor="#041833" />
              <stop offset="50%" stopColor="#062247" />
              <stop offset="85%" stopColor="#0b2e59" />
              <stop offset="100%" stopColor="#0e3a6e" />
            </radialGradient>

            {/* Selection Box Glow */}
            <filter id="boxGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.7" />
            </filter>
            <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* Ocean Base Layer */}
          <rect width={svgWidth} height={svgHeight} fill="url(#oceanDeepGrad)" rx="12" />

          {/* Bathymetric Depth Contours (Deep Basins & Ridges) */}
          <g className="bathymetry-contours opacity-40">
            {/* Arabian Basin Deep (>4000m) */}
            <path
              d={`M ${lonToX(62, svgWidth)} ${latToY(14, svgHeight)} Q ${lonToX(66, svgWidth)} ${latToY(8, svgHeight)} ${lonToX(68, svgWidth)} ${latToY(2, svgHeight)} Q ${lonToX(64, svgWidth)} ${latToY(3, svgHeight)} ${lonToX(60, svgWidth)} ${latToY(9, svgHeight)} Z`}
              fill="#030f21"
              stroke="#0a2a52"
              strokeWidth="1"
            />
            {/* Bay of Bengal Deep */}
            <path
              d={`M ${lonToX(84, svgWidth)} ${latToY(18, svgHeight)} Q ${lonToX(90, svgWidth)} ${latToY(12, svgHeight)} ${lonToX(88, svgWidth)} ${latToY(4, svgHeight)} Q ${lonToX(82, svgWidth)} ${latToY(8, svgHeight)} ${lonToX(82, svgWidth)} ${latToY(15, svgHeight)} Z`}
              fill="#030f21"
              stroke="#0a2a52"
              strokeWidth="1"
            />
            {/* Central Indian Ridge */}
            <path
              d={`M ${lonToX(68, svgWidth)} ${latToY(0, svgHeight)} L ${lonToX(72, svgWidth)} ${latToY(-8, svgHeight)}`}
              stroke="#1e4d7a"
              strokeWidth="3"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          </g>

          {/* Graticule Grid Lines & Coordinate Labels */}
          <g className="graticule opacity-50 pointer-events-none">
            {graticuleLon.map((lon) => {
              const x = lonToX(lon, svgWidth);
              return (
                <g key={`lon-${lon}`}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={svgHeight}
                    stroke="#1e3a5f"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={x + 4}
                    y={svgHeight - 10}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {lon}°E
                  </text>
                </g>
              );
            })}
            {graticuleLat.map((lat) => {
              const y = latToY(lat, svgHeight);
              return (
                <g key={`lat-${lat}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={svgWidth}
                    y2={y}
                    stroke="#1e3a5f"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={8}
                    y={y - 4}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {lat >= 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Coastlines & Landmass Polygons (Accurate North Indian Ocean Geometry) */}
          <g className="landmasses" fill="#1e293b" stroke="#334155" strokeWidth="1.5">
            {/* Indian Subcontinent Peninsula */}
            <path
              d={`
                M ${lonToX(68.5, svgWidth)} ${latToY(23.5, svgHeight)}
                L ${lonToX(70.0, svgWidth)} ${latToY(21.0, svgHeight)}
                L ${lonToX(72.8, svgWidth)} ${latToY(19.0, svgHeight)}
                L ${lonToX(73.8, svgWidth)} ${latToY(15.5, svgHeight)}
                L ${lonToX(75.5, svgWidth)} ${latToY(12.0, svgHeight)}
                L ${lonToX(77.5, svgWidth)} ${latToY(8.1, svgHeight)}
                L ${lonToX(79.8, svgWidth)} ${latToY(10.3, svgHeight)}
                L ${lonToX(80.3, svgWidth)} ${latToY(13.1, svgHeight)}
                L ${lonToX(83.3, svgWidth)} ${latToY(17.7, svgHeight)}
                L ${lonToX(86.9, svgWidth)} ${latToY(20.5, svgHeight)}
                L ${lonToX(89.0, svgWidth)} ${latToY(22.0, svgHeight)}
                L ${lonToX(91.0, svgWidth)} ${latToY(23.5, svgHeight)}
                L ${lonToX(92.0, svgWidth)} ${latToY(30.0, svgHeight)}
                L ${lonToX(68.5, svgWidth)} ${latToY(30.0, svgHeight)}
                Z
              `}
              fill="#1b2838"
              stroke="#475569"
            />
            {/* Sri Lanka Island */}
            <path
              d={`
                M ${lonToX(79.8, svgWidth)} ${latToY(9.8, svgHeight)}
                L ${lonToX(81.8, svgWidth)} ${latToY(8.5, svgHeight)}
                L ${lonToX(81.8, svgWidth)} ${latToY(6.0, svgHeight)}
                L ${lonToX(80.0, svgWidth)} ${latToY(6.0, svgHeight)}
                L ${lonToX(79.7, svgWidth)} ${latToY(8.0, svgHeight)}
                Z
              `}
              fill="#1b2838"
              stroke="#475569"
            />
            {/* Arabian Peninsula & Horn of Africa */}
            <path
              d={`
                M ${lonToX(40.0, svgWidth)} ${latToY(30.0, svgHeight)}
                L ${lonToX(50.0, svgWidth)} ${latToY(30.0, svgHeight)}
                L ${lonToX(56.0, svgWidth)} ${latToY(26.0, svgHeight)}
                L ${lonToX(59.8, svgWidth)} ${latToY(22.5, svgHeight)}
                L ${lonToX(54.0, svgWidth)} ${latToY(16.5, svgHeight)}
                L ${lonToX(45.0, svgWidth)} ${latToY(12.5, svgHeight)}
                L ${lonToX(43.0, svgWidth)} ${latToY(11.5, svgHeight)}
                L ${lonToX(51.2, svgWidth)} ${latToY(10.5, svgHeight)}
                L ${lonToX(49.0, svgWidth)} ${latToY(5.0, svgHeight)}
                L ${lonToX(42.0, svgWidth)} ${latToY(-2.0, svgHeight)}
                L ${lonToX(40.0, svgWidth)} ${latToY(-10.0, svgHeight)}
                L ${lonToX(40.0, svgWidth)} ${latToY(30.0, svgHeight)}
                Z
              `}
              fill="#152233"
              stroke="#334155"
            />
            {/* Myanmar / Andaman Peninsula */}
            <path
              d={`
                M ${lonToX(92.5, svgWidth)} ${latToY(21.0, svgHeight)}
                L ${lonToX(94.5, svgWidth)} ${latToY(16.0, svgHeight)}
                L ${lonToX(98.5, svgWidth)} ${latToY(10.0, svgHeight)}
                L ${lonToX(100.0, svgWidth)} ${latToY(5.0, svgHeight)}
                L ${lonToX(102.0, svgWidth)} ${latToY(-10.0, svgHeight)}
                L ${lonToX(102.0, svgWidth)} ${latToY(30.0, svgHeight)}
                L ${lonToX(92.5, svgWidth)} ${latToY(30.0, svgHeight)}
                Z
              `}
              fill="#152233"
              stroke="#334155"
            />
            {/* Andaman & Nicobar Archipelago */}
            <g fill="#334155" stroke="#475569">
              <ellipse cx={lonToX(92.9, svgWidth)} cy={latToY(12.5, svgHeight)} rx="3" ry="12" />
              <ellipse cx={lonToX(93.8, svgWidth)} cy={latToY(7.0, svgHeight)} rx="2.5" ry="6" />
            </g>
            {/* Lakshadweep & Maldives Ridge */}
            <g fill="#334155" stroke="#475569">
              <circle cx={lonToX(72.6, svgWidth)} cy={latToY(11.0, svgHeight)} r="2" />
              <circle cx={lonToX(73.5, svgWidth)} cy={latToY(4.2, svgHeight)} r="2.5" />
              <circle cx={lonToX(73.2, svgWidth)} cy={latToY(0.5, svgHeight)} r="2" />
            </g>
          </g>

          {/* Active Dataset Coverage Footprint Outline (CMEMS 60-68°E, 0-15°N) */}
          {showCoverageLayers && (
            <g className="dataset-footprint">
              <rect
                x={lonToX(60.0, svgWidth)}
                y={latToY(15.0, svgHeight)}
                width={lonToX(68.0, svgWidth) - lonToX(60.0, svgWidth)}
                height={latToY(0.0, svgHeight) - latToY(15.0, svgHeight)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                opacity="0.6"
              />
              <text
                x={lonToX(60.5, svgWidth)}
                y={latToY(14.2, svgHeight)}
                fill="#38bdf8"
                fontSize="10"
                fontFamily="monospace"
                opacity="0.8"
              >
                CMEMS Native Footprint (60°–68°E, 0°–15°N)
              </text>
            </g>
          )}

          {/* Active Selected ROI Bounding Box */}
          <g className="selected-roi-box" filter="url(#boxGlow)">
            <rect
              x={boxRect.x}
              y={boxRect.y}
              width={boxRect.w}
              height={boxRect.h}
              fill="#0284c7"
              fillOpacity="0.25"
              stroke="#38bdf8"
              strokeWidth="2.5"
              rx="4"
            />
            {/* Corner Handles */}
            <circle cx={boxRect.x} cy={boxRect.y} r="4" fill="#38bdf8" />
            <circle cx={boxRect.x + boxRect.w} cy={boxRect.y} r="4" fill="#38bdf8" />
            <circle cx={boxRect.x} cy={boxRect.y + boxRect.h} r="4" fill="#38bdf8" />
            <circle cx={boxRect.x + boxRect.w} cy={boxRect.y + boxRect.h} r="4" fill="#38bdf8" />

            {/* ROI Label Tag */}
            <rect
              x={boxRect.x}
              y={Math.max(8, boxRect.y - 20)}
              width="180"
              height="18"
              fill="#0369a1"
              rx="3"
            />
            <text
              x={boxRect.x + 6}
              y={Math.max(20, boxRect.y - 7)}
              fill="#ffffff"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              ROI: {currentBox.west}°E–{currentBox.east}°E, {currentBox.south}°N–{currentBox.north}°N
            </text>
          </g>

          {/* Drag selection in progress */}
          {drawPreviewRect && (
            <rect
              x={drawPreviewRect.x}
              y={drawPreviewRect.y}
              width={drawPreviewRect.w}
              height={drawPreviewRect.h}
              fill="#38bdf8"
              fillOpacity="0.2"
              stroke="#7dd3fc"
              strokeWidth="2"
              strokeDasharray="3,3"
            />
          )}

          {/* Argo Float Marker Pins */}
          {showArgoLayer &&
            ARGO_FLOAT_CATALOG.map((f) => {
              const px = lonToX(f.longitude, svgWidth);
              const py = latToY(f.latitude, svgHeight);
              const isSelected = selectedFloatId === f.id;

              return (
                <g
                  key={f.id}
                  data-testid={`argo-marker-${f.id}`}
                  className="cursor-pointer transition-transform transform hover:scale-125"
                  onClick={() => handleFloatClick(f)}
                  onMouseEnter={() => setHoveredFloat(f)}
                  onMouseLeave={() => setHoveredFloat(null)}
                  filter={isSelected ? 'url(#pinGlow)' : undefined}
                >
                  {/* Pin Ripple */}
                  <circle
                    cx={px}
                    cy={py}
                    r={isSelected ? 10 : 7}
                    fill={isSelected ? '#10b981' : '#34d399'}
                    fillOpacity="0.3"
                    className="animate-ping"
                  />

                  {/* Pin Body */}
                  <circle
                    cx={px}
                    cy={py}
                    r={isSelected ? 6 : 4.5}
                    fill={isSelected ? '#10b981' : '#059669'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />

                  {/* Pin Label */}
                  <text
                    x={px + 8}
                    y={py + 3}
                    fill={isSelected ? '#34d399' : '#e2e8f0'}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    className="pointer-events-none drop-shadow-md"
                  >
                    {f.id}
                  </text>
                </g>
              );
            })}

          {/* Glider Trajectory and Position Marker (RU29 Challenger Glider) */}
          {showGliderLayer &&
            GLIDER_CATALOG.map((g) => {
              const px = lonToX(g.longitude, svgWidth);
              const py = latToY(g.latitude, svgHeight);
              const pointsStr = g.trajectoryPolyline
                .map(([lon, lat]) => `${lonToX(lon, svgWidth)},${latToY(lat, svgHeight)}`)
                .join(' ');

              return (
                <g key={g.id} data-testid={`glider-layer-${g.id}`}>
                  {/* Trajectory line */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="4,3"
                    opacity="0.85"
                  />
                  {/* Waypoints */}
                  {g.trajectoryPolyline.map(([wlon, wlat], idx) => (
                    <circle
                      key={idx}
                      cx={lonToX(wlon, svgWidth)}
                      cy={latToY(wlat, svgHeight)}
                      r="2"
                      fill="#fbbf24"
                    />
                  ))}
                  {/* Glider current pin */}
                  <g
                    className="cursor-pointer transition-transform transform hover:scale-125"
                    onClick={() => setPopupGlider(g)}
                  >
                    <polygon
                      points={`${px},${py - 8} ${px + 7},${py + 6} ${px},${py + 3} ${px - 7},${py + 6}`}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={px + 9}
                      y={py + 3}
                      fill="#fbbf24"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {g.id} ({g.profileCount} prof)
                    </text>
                  </g>
                </g>
              );
            })}

          {/* Moorings and OMNI Buoy Markers */}
          {showMooringsLayer &&
            OTHER_OBSERVATIONS_CATALOG.map((m) => {
              const px = lonToX(m.longitude, svgWidth);
              const py = latToY(m.latitude, svgHeight);
              const isMooring = m.type === 'mooring';

              return (
                <g
                  key={m.id}
                  data-testid={`platform-marker-${m.id}`}
                  className="cursor-pointer transition-transform transform hover:scale-125"
                  onClick={() => setPopupPlatform(m)}
                >
                  <rect
                    x={px - 5}
                    y={py - 5}
                    width="10"
                    height="10"
                    fill={isMooring ? '#8b5cf6' : '#ec4899'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    transform={`rotate(45, ${px}, ${py})`}
                  />
                  <text
                    x={px + 8}
                    y={py + 3}
                    fill={isMooring ? '#c4b5fd' : '#f472b6'}
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {m.name.split(' ')[0]}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Floating Argo Float Details Popup / Card */}
        {popupFloat && (
          <div
            data-testid="argo-popup-card"
            className="absolute bottom-6 right-6 z-20 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-3.5 text-xs font-mono text-slate-200 shadow-2xl flex flex-col gap-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-emerald-300 text-sm">{popupFloat.id}</span>
              </div>
              <button
                onClick={() => setPopupFloat(null)}
                className="text-slate-400 hover:text-white text-xs px-1 rounded hover:bg-slate-800"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px]">WMO ID:</span>
                <span className="font-bold text-white">{popupFloat.wmoId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Cycle:</span>
                <span className="font-bold text-white">#{popupFloat.cycleNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Position:</span>
                <span className="text-sky-300">
                  {popupFloat.latitude.toFixed(3)}°N, {popupFloat.longitude.toFixed(3)}°E
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Date:</span>
                <span className="text-slate-200">{popupFloat.dateIso}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mode:</span>
                <span className="text-amber-300">{popupFloat.dataMode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Data Center:</span>
                <span className="text-slate-200">{popupFloat.dataCenter}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] flex items-center justify-between">
              <span className="text-slate-400">QC Status:</span>
              <span className="text-emerald-400 font-bold">{popupFloat.qcStatus}</span>
            </div>

            <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
              <span>Params:</span>
              {popupFloat.parameters.map((p) => (
                <span key={p} className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px]">
                  {p}
                </span>
              ))}
            </div>

            <div className="pt-1 flex gap-2">
              <button
                onClick={handleEnterVolumeMode}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2 rounded text-center transition"
              >
                Inspect in Volume
              </button>
            </div>
          </div>
        )}
        {/* Floating Glider Details Popup / Card */}
        {popupGlider && (
          <div
            data-testid="glider-popup-card"
            className="absolute bottom-6 right-6 z-20 w-84 bg-slate-900/95 backdrop-blur-md border border-amber-500/70 rounded-lg p-3.5 text-xs font-mono text-slate-200 shadow-2xl flex flex-col gap-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-amber-300 text-sm">{popupGlider.missionName}</span>
              </div>
              <button
                onClick={() => setPopupGlider(null)}
                className="text-slate-400 hover:text-white text-xs px-1 rounded hover:bg-slate-800"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px]">WMO / Platform:</span>
                <span className="font-bold text-white">{popupGlider.wmoId} ({popupGlider.platformName})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Profiles Cast:</span>
                <span className="font-bold text-white">{popupGlider.profileCount} profiles</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Current Loc:</span>
                <span className="text-amber-300">
                  {popupGlider.latitude.toFixed(2)}°N, {popupGlider.longitude.toFixed(2)}°E
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Max Sounding:</span>
                <span className="text-emerald-300">{popupGlider.maxDepthM.toFixed(1)} m</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px]">Provider / Mission:</span>
                <span className="text-slate-200">{popupGlider.provider}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] flex items-center justify-between">
              <span className="text-slate-400">QC Status:</span>
              <span className="text-amber-400 font-bold">{popupGlider.qcStatus}</span>
            </div>

            <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
              <span>Measured:</span>
              {popupGlider.parameters.map((p) => (
                <span key={p} className="px-1 py-0.5 bg-slate-800 text-amber-200 rounded text-[9px]">
                  {p}
                </span>
              ))}
            </div>

            <div className="pt-1 flex gap-2">
              <button
                onClick={handleEnterVolumeMode}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-1 px-2 rounded text-center transition"
              >
                Inspect Mission Area in 3D
              </button>
            </div>
          </div>
        )}

        {/* Floating Mooring/Buoy Details Popup / Card */}
        {popupPlatform && (
          <div
            data-testid="platform-popup-card"
            className="absolute bottom-6 right-6 z-20 w-80 bg-slate-900/95 backdrop-blur-md border border-violet-500/70 rounded-lg p-3.5 text-xs font-mono text-slate-200 shadow-2xl flex flex-col gap-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                <span className="font-bold text-violet-300 text-sm">{popupPlatform.name}</span>
              </div>
              <button
                onClick={() => setPopupPlatform(null)}
                className="text-slate-400 hover:text-white text-xs px-1 rounded hover:bg-slate-800"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px]">Type:</span>
                <span className="font-bold text-white uppercase">{popupPlatform.type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Status:</span>
                <span className="font-bold text-emerald-400 uppercase">{popupPlatform.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Position:</span>
                <span className="text-violet-300">
                  {popupPlatform.latitude.toFixed(2)}°N, {popupPlatform.longitude.toFixed(2)}°E
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Updated:</span>
                <span className="text-slate-200">{popupPlatform.lastUpdateIso}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px]">Agency:</span>
                <span className="text-slate-200">{popupPlatform.provider}</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
              <span>Sensors:</span>
              {popupPlatform.parameters.map((p) => (
                <span key={p} className="px-1 py-0.5 bg-slate-800 text-violet-200 rounded text-[9px]">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Floating Bottom Left Spatial Readout Card */}
        <div
          data-testid="spatial-readout-card"
          className="absolute bottom-6 left-6 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 shadow-2xl flex flex-col gap-1 min-w-[280px]"
        >
          <div className="flex items-center justify-between font-bold text-sky-400 text-xs border-b border-slate-800 pb-1">
            <span>ACTIVE SELECTION BOUNDS</span>
            <span className="text-[10px] text-slate-400 font-normal">WGS84</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] pt-1">
            <div className="flex items-center justify-between gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              <span className="text-slate-400">W Lon:</span>
              <input
                type="number"
                step="0.1"
                min="40.0"
                max={currentBox.east - 0.5}
                value={currentBox.west}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val < currentBox.east) {
                    selectROI({ ...currentBox, west: val });
                    setActivePresetId('custom');
                  }
                }}
                className="w-16 bg-slate-950 text-sky-300 font-semibold px-1 rounded text-right focus:ring-1 focus:ring-sky-400 focus:outline-none"
                data-testid="input-roi-west"
              />
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              <span className="text-slate-400">E Lon:</span>
              <input
                type="number"
                step="0.1"
                min={currentBox.west + 0.5}
                max="102.0"
                value={currentBox.east}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > currentBox.west) {
                    selectROI({ ...currentBox, east: val });
                    setActivePresetId('custom');
                  }
                }}
                className="w-16 bg-slate-950 text-sky-300 font-semibold px-1 rounded text-right focus:ring-1 focus:ring-sky-400 focus:outline-none"
                data-testid="input-roi-east"
              />
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              <span className="text-slate-400">S Lat:</span>
              <input
                type="number"
                step="0.1"
                min="-10.0"
                max={currentBox.north - 0.5}
                value={currentBox.south}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val < currentBox.north) {
                    selectROI({ ...currentBox, south: val });
                    setActivePresetId('custom');
                  }
                }}
                className="w-16 bg-slate-950 text-emerald-300 font-semibold px-1 rounded text-right focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                data-testid="input-roi-south"
              />
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              <span className="text-slate-400">N Lat:</span>
              <input
                type="number"
                step="0.1"
                min={currentBox.south + 0.5}
                max="30.0"
                value={currentBox.north}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > currentBox.south) {
                    selectROI({ ...currentBox, north: val });
                    setActivePresetId('custom');
                  }
                }}
                className="w-16 bg-slate-950 text-emerald-300 font-semibold px-1 rounded text-right focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                data-testid="input-roi-north"
              />
            </div>
            <div className="col-span-2 flex items-center justify-between pt-0.5 text-[10px]">
              <div>
                <span className="text-slate-400">Depth Span: </span>
                <span className="text-emerald-300 font-semibold">
                  {(currentBox.minDepthM ?? 0.494).toFixed(1)}m → {(currentBox.maxDepthM ?? 5727.9).toFixed(1)}m
                </span>
              </div>
              <div>
                <span className="text-slate-400">Area: </span>
                <span className="text-cyan-300 font-semibold">
                  {(Math.abs(currentBox.east - currentBox.west) * Math.abs(currentBox.north - currentBox.south)).toFixed(1)} deg²
                </span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 italic mt-0.5">
            * Drag directly on the map or edit coordinates above to define custom ROI.
          </p>
        </div>
      </div>
    </div>
  );
};
