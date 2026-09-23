/**
 * UI Application State Store for QuasarOS Web Client.
 *
 * Conforms strictly to AGENTS.md:
 * - NO large TypedArrays or volume buffers in state.
 * - Stores lightweight metadata, selections, UI toggles, and probe status.
 */

import { useSyncExternalStore } from 'react';
import type { HealthStatus, PinnedSnapshotSession } from '../../../../packages/client/src/types.ts';

export type RenderingBackendChoice = 'auto' | 'webgpu' | 'webgl2';
export type HealthProbeState = 'healthy' | 'degraded' | 'offline' | 'checking';
export type PlaybackState = 'IDLE' | 'READY' | 'PLAYING' | 'BUFFERING';

export type LODMode = 'preview' | 'interactive' | 'high_quality';

export interface LODConfig {
  id: LODMode;
  label: string;
  shortLabel: string;
  depthLevels: number;
  latRes: number;
  lonRes: number;
  voxelCount: number;
  estimatedVramMb: number;
}

export const LOD_CONFIGS: Record<LODMode, LODConfig> = {
  preview: {
    id: 'preview',
    label: 'Preview (Fast)',
    shortLabel: 'Preview',
    depthLevels: 16,
    latRes: 32,
    lonRes: 32,
    voxelCount: 16384,
    estimatedVramMb: 0.08,
  },
  interactive: {
    id: 'interactive',
    label: 'Interactive (Balanced)',
    shortLabel: 'Interactive',
    depthLevels: 24,
    latRes: 48,
    lonRes: 48,
    voxelCount: 55296,
    estimatedVramMb: 0.26,
  },
  high_quality: {
    id: 'high_quality',
    label: 'High Quality (Native Grid)',
    shortLabel: 'High Quality',
    depthLevels: 50,
    latRes: 181,
    lonRes: 97,
    voxelCount: 877850,
    estimatedVramMb: 4.19,
  },
};

export interface GridDimensionInfo {
  sourceDimensions: [number, number, number]; // [50, 181, 97]
  returnedShape: [number, number, number];    // [D, H, W]
  gpuTextureDimensions: [number, number, number]; // [W, H, D]
  voxelCount: number;
  vramBytes: number;
  vramMb: number;
  budgetCeilingMb: number;
  budgetPercent: number;
}

export interface SpatialBoundsDisplay {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  minDepthM: number;
  maxDepthM: number;
}

export type WorkspaceMode = 'overview' | 'volume';

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
  minDepthM?: number;
  maxDepthM?: number;
}

export interface ROIPreset {
  id: string;
  name: string;
  description: string;
  bounds: BoundingBox;
}

export const ROI_PRESETS: ROIPreset[] = [
  {
    id: 'arabian_sea',
    name: 'Arabian Sea',
    description: 'Western Indian Ocean, high salinity and upwelling system (60°–68°E, 0°–15°N)',
    bounds: {
      west: 60.0,
      south: 0.0,
      east: 68.0,
      north: 15.0,
      minDepthM: 0.494,
      maxDepthM: 5727.917,
    },
  },
  {
    id: 'bay_of_bengal',
    name: 'Bay of Bengal',
    description: 'Eastern Indian Ocean, high freshwater runoff and stratification (80°–92°E, 8°–22°N)',
    bounds: {
      west: 80.0,
      south: 8.0,
      east: 92.0,
      north: 22.0,
      minDepthM: 0.494,
      maxDepthM: 4000.0,
    },
  },
  {
    id: 'equatorial_io',
    name: 'Equatorial Indian Ocean',
    description: 'Equatorial current jets and Wyrtki jet dynamics (65°–85°E, 5°S–5°N)',
    bounds: {
      west: 65.0,
      south: -5.0,
      east: 85.0,
      north: 5.0,
      minDepthM: 0.494,
      maxDepthM: 5000.0,
    },
  },
];

export interface ArgoFloatMetadata {
  id: string; // e.g. 'D1902669_012'
  wmoId: number; // 1902669
  cycleNumber: number;
  latitude: number;
  longitude: number;
  dateIso: string;
  dataMode: 'Delayed-Mode' | 'Real-Time' | 'Synthetic BGC';
  dataCenter: string;
  maxDepthM: number;
  qcStatus: string;
  tempProfileQc: number;
  psalProfileQc: number;
  parameters: string[];
}

export interface GliderMetadata {
  id: string; // e.g. 'RU29_Challenger'
  wmoId: string; // '2801900'
  missionName: string;
  platformName: string;
  provider: string;
  latitude: number;
  longitude: number;
  startDateIso: string;
  endDateIso: string;
  maxDepthM: number;
  profileCount: number;
  qcStatus: string;
  parameters: string[];
  trajectoryPolyline: [number, number][]; // [lon, lat][]
}

export interface ObservationPlatformMetadata {
  id: string;
  type: 'argo' | 'glider' | 'buoy' | 'mooring' | 'tide_gauge';
  name: string;
  provider: string;
  latitude: number;
  longitude: number;
  status: 'operational' | 'delayed' | 'offline';
  parameters: string[];
  lastUpdateIso: string;
}

export const GLIDER_CATALOG: GliderMetadata[] = [
  {
    id: 'RU29_Challenger',
    wmoId: '2801900',
    missionName: 'Challenger Glider Indian Ocean Mission',
    platformName: 'RU29 Slocum G2 Glider',
    provider: 'Rutgers University / UWA / INCOIS Collab',
    latitude: 5.82,
    longitude: 80.95,
    startDateIso: '2018-08-12',
    endDateIso: '2018-11-01',
    maxDepthM: 965.0,
    profileCount: 951,
    qcStatus: 'QC Passed (QARTOD Primary Flag 1)',
    parameters: ['temperature', 'salinity', 'density', 'pressure', 'conductivity'],
    trajectoryPolyline: [
      [80.05, 1.15],
      [80.45, 2.35],
      [80.95, 3.80],
      [81.40, 5.20],
      [81.95, 6.75],
      [82.40, 7.80],
      [82.95, 8.65],
    ],
  },
];

export const OTHER_OBSERVATIONS_CATALOG: ObservationPlatformMetadata[] = [
  // --- OMNI Moored Buoy Network (Arabian Sea & Bay of Bengal) ---
  {
    id: 'INCOIS_OMNI_AD06',
    type: 'buoy',
    name: 'INCOIS OMNI Arabian Sea Buoy AD06',
    provider: 'INCOIS / NIOT',
    latitude: 18.50,
    longitude: 67.50,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Surface_Waves', 'Atmospheric_Pressure', 'Wind_Velocity'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_AD07',
    type: 'buoy',
    name: 'INCOIS OMNI Arabian Sea Buoy AD07',
    provider: 'INCOIS / NIOT',
    latitude: 15.00,
    longitude: 69.00,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Surface_Waves', 'Air_Temperature'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_AD08',
    type: 'buoy',
    name: 'INCOIS OMNI Arabian Sea Buoy AD08',
    provider: 'INCOIS / NIOT',
    latitude: 12.00,
    longitude: 68.50,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Current_Profiles', 'Heat_Flux'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_AD09',
    type: 'buoy',
    name: 'INCOIS OMNI Arabian Sea Buoy AD09',
    provider: 'INCOIS / NIOT',
    latitude: 8.25,
    longitude: 73.25,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Wave_Height', 'Radiation'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_BUOY_BD08',
    type: 'buoy',
    name: 'INCOIS OMNI Bay of Bengal Buoy BD08',
    provider: 'INCOIS / NIOT',
    latitude: 18.20,
    longitude: 89.70,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Surface_Waves', 'Atmospheric_Pressure'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_BD09',
    type: 'buoy',
    name: 'INCOIS OMNI Bay of Bengal Buoy BD09',
    provider: 'INCOIS / NIOT',
    latitude: 17.50,
    longitude: 89.10,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Surface_Waves', 'Wind_Direction'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_BD10',
    type: 'buoy',
    name: 'INCOIS OMNI Bay of Bengal Buoy BD10',
    provider: 'INCOIS / NIOT',
    latitude: 14.00,
    longitude: 86.50,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Currents', 'Atmospheric_Pressure'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_OMNI_BD11',
    type: 'buoy',
    name: 'INCOIS OMNI Bay of Bengal Buoy BD11',
    provider: 'INCOIS / NIOT',
    latitude: 11.50,
    longitude: 86.50,
    status: 'operational',
    parameters: ['SST', 'Salinity_Profiles', 'Wave_Spectra', 'Air_Temperature'],
    lastUpdateIso: '2026-08-30',
  },

  // --- Deep-Ocean Tsunami Early Warning System (BPR Stations) ---
  {
    id: 'INCOIS_TSUNAMI_TB05',
    type: 'buoy',
    name: 'INCOIS Tsunami Buoy TB05 (Makran Subduction)',
    provider: 'INCOIS / ITEWS',
    latitude: 20.40,
    longitude: 65.20,
    status: 'operational',
    parameters: ['BPR_Water_Column_Height', 'Acoustic_Pings', 'Surface_Position'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TSUNAMI_TB09',
    type: 'buoy',
    name: 'INCOIS Tsunami Buoy TB09 (Andaman Subduction)',
    provider: 'INCOIS / ITEWS',
    latitude: 11.20,
    longitude: 93.50,
    status: 'operational',
    parameters: ['BPR_Water_Column_Height', 'Acoustic_Pings', 'Tsunami_Alert_Trigger'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TSUNAMI_TB10',
    type: 'buoy',
    name: 'INCOIS Tsunami Buoy TB10 (North Sumatra Trench)',
    provider: 'INCOIS / ITEWS',
    latitude: 6.80,
    longitude: 92.10,
    status: 'operational',
    parameters: ['BPR_Water_Column_Height', 'Tsunami_Trigger_Flag', 'Seafloor_Pressure'],
    lastUpdateIso: '2026-08-30',
  },

  // --- Primary Coastal Tide Gauge Network ---
  {
    id: 'INCOIS_TG_KOCHI',
    type: 'tide_gauge',
    name: 'INCOIS Radar Tide Gauge Station Kochi',
    provider: 'INCOIS / Survey of India',
    latitude: 9.96,
    longitude: 76.27,
    status: 'operational',
    parameters: ['Sea_Level_Anomaly', 'Tidal_Height', 'Water_Pressure'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TG_MUMBAI',
    type: 'tide_gauge',
    name: 'INCOIS Radar Tide Gauge Station Mumbai Apollo Bandar',
    provider: 'INCOIS / Mumbai Port Trust',
    latitude: 18.92,
    longitude: 72.83,
    status: 'operational',
    parameters: ['Sea_Level_Anomaly', 'Tidal_Height', 'Storm_Surge'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TG_CHENNAI',
    type: 'tide_gauge',
    name: 'INCOIS Acoustic Tide Gauge Station Chennai Port',
    provider: 'INCOIS / Chennai Port',
    latitude: 13.08,
    longitude: 80.29,
    status: 'operational',
    parameters: ['Sea_Level_Anomaly', 'Tidal_Height', 'Storm_Surge'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TG_PARADIP',
    type: 'tide_gauge',
    name: 'INCOIS Radar Tide Gauge Station Paradip',
    provider: 'INCOIS / Paradip Port Trust',
    latitude: 20.26,
    longitude: 86.67,
    status: 'operational',
    parameters: ['Sea_Level_Anomaly', 'Tidal_Height', 'Storm_Surge'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'INCOIS_TG_VISAKHAPATNAM',
    type: 'tide_gauge',
    name: 'INCOIS Tide Gauge Station Visakhapatnam',
    provider: 'INCOIS / Visakhapatnam Port',
    latitude: 17.68,
    longitude: 83.21,
    status: 'operational',
    parameters: ['Sea_Level_Anomaly', 'Tidal_Height', 'Storm_Surge'],
    lastUpdateIso: '2026-08-30',
  },

  // --- RAMA Equatorial Moorings ---
  {
    id: 'RAMA_67E_0N',
    type: 'mooring',
    name: 'RAMA Deep Ocean Flux Mooring (67°E, 0°N)',
    provider: 'INCOIS / NOAA PMEL',
    latitude: 0.0,
    longitude: 67.0,
    status: 'operational',
    parameters: ['SST', 'SSS', 'Wind', 'Currents', 'HeatFlux'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'RAMA_80E_12N',
    type: 'mooring',
    name: 'RAMA Deep Ocean Flux Mooring (80.5°E, 12°N)',
    provider: 'INCOIS / NOAA PMEL',
    latitude: 12.0,
    longitude: 80.5,
    status: 'operational',
    parameters: ['SST', 'SSS', 'Wind', 'Currents', 'HeatFlux'],
    lastUpdateIso: '2026-08-30',
  },
  {
    id: 'RAMA_90E_0N',
    type: 'mooring',
    name: 'RAMA Deep Ocean Flux Mooring (90°E, 0°N)',
    provider: 'INCOIS / NOAA PMEL',
    latitude: 0.0,
    longitude: 90.0,
    status: 'operational',
    parameters: ['SST', 'SSS', 'Wind', 'Currents', 'HeatFlux'],
    lastUpdateIso: '2026-08-30',
  },
];

export const ARGO_FLOAT_CATALOG: ArgoFloatMetadata[] = [
  // --- Bay of Bengal Array (80°E - 95°E, 5°N - 20°N) ---
  {
    id: 'D1902669_012',
    wmoId: 1902669,
    cycleNumber: 12,
    latitude: 13.317,
    longitude: 86.817,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902670_045',
    wmoId: 2902670,
    cycleNumber: 45,
    latitude: 15.420,
    longitude: 88.512,
    dateIso: '2026-08-29',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902671_068',
    wmoId: 2902671,
    cycleNumber: 68,
    latitude: 17.890,
    longitude: 89.430,
    dateIso: '2026-08-27',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902672_032',
    wmoId: 2902672,
    cycleNumber: 32,
    latitude: 11.205,
    longitude: 84.610,
    dateIso: '2026-08-30',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902673_089',
    wmoId: 2902673,
    cycleNumber: 89,
    latitude: 8.750,
    longitude: 85.920,
    dateIso: '2026-08-29',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902674_019',
    wmoId: 2902674,
    cycleNumber: 19,
    latitude: 19.120,
    longitude: 87.350,
    dateIso: '2026-08-26',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 1500.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902675_054',
    wmoId: 2902675,
    cycleNumber: 54,
    latitude: 14.630,
    longitude: 91.820,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902676_077',
    wmoId: 2902676,
    cycleNumber: 77,
    latitude: 10.450,
    longitude: 92.400,
    dateIso: '2026-08-30',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },

  // --- Arabian Sea Array (60°E - 76°E, 8°N - 24°N) ---
  {
    id: 'INCOIS_1902501_102',
    wmoId: 1902501,
    cycleNumber: 102,
    latitude: 18.550,
    longitude: 65.410,
    dateIso: '2026-08-29',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902502_088',
    wmoId: 1902502,
    cycleNumber: 88,
    latitude: 20.320,
    longitude: 68.200,
    dateIso: '2026-08-27',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902503_064',
    wmoId: 1902503,
    cycleNumber: 64,
    latitude: 16.140,
    longitude: 70.850,
    dateIso: '2026-08-30',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902504_115',
    wmoId: 1902504,
    cycleNumber: 115,
    latitude: 14.280,
    longitude: 67.920,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902505_042',
    wmoId: 1902505,
    cycleNumber: 42,
    latitude: 12.050,
    longitude: 72.340,
    dateIso: '2026-08-29',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902506_091',
    wmoId: 1902506,
    cycleNumber: 91,
    latitude: 9.870,
    longitude: 74.560,
    dateIso: '2026-08-27',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902507_073',
    wmoId: 1902507,
    cycleNumber: 73,
    latitude: 17.110,
    longitude: 62.480,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_1902508_036',
    wmoId: 1902508,
    cycleNumber: 36,
    latitude: 22.050,
    longitude: 64.910,
    dateIso: '2026-08-26',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 1800.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },

  // --- Equatorial Indian Ocean Array (65°E - 90°E, 5°S - 5°N) ---
  {
    id: 'R1902581_050',
    wmoId: 1902581,
    cycleNumber: 50,
    latitude: 1.827,
    longitude: 76.830,
    dateIso: '2026-08-29',
    dataMode: 'Real-Time',
    dataCenter: 'Coriolis / INCOIS',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'SR1902594_001',
    wmoId: 1902594,
    cycleNumber: 1,
    latitude: 5.359,
    longitude: 80.069,
    dateIso: '2026-08-30',
    dataMode: 'Synthetic BGC',
    dataCenter: 'IFREMER / INCOIS',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL', 'DOXY', 'CHLA', 'BBP700', 'NITRATE', 'PH_IN_SITU_TOTAL'],
  },
  {
    id: 'INCOIS_7902250_012',
    wmoId: 7902250,
    cycleNumber: 12,
    latitude: -1.732,
    longitude: 85.177,
    dateIso: '2025-04-23',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (National Data Centre)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902680_029',
    wmoId: 2902680,
    cycleNumber: 29,
    latitude: 3.450,
    longitude: 72.890,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902681_058',
    wmoId: 2902681,
    cycleNumber: 58,
    latitude: 0.120,
    longitude: 79.450,
    dateIso: '2026-08-27',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902682_094',
    wmoId: 2902682,
    cycleNumber: 94,
    latitude: -3.880,
    longitude: 82.110,
    dateIso: '2026-08-30',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902683_041',
    wmoId: 2902683,
    cycleNumber: 41,
    latitude: -4.560,
    longitude: 75.320,
    dateIso: '2026-08-29',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_2902684_112',
    wmoId: 2902684,
    cycleNumber: 112,
    latitude: 2.760,
    longitude: 87.650,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },

  // --- Southern Indian Ocean / Subtropical Array (60°E - 95°E, 15°S - 6°S) ---
  {
    id: 'INCOIS_6902701_083',
    wmoId: 6902701,
    cycleNumber: 83,
    latitude: -7.210,
    longitude: 68.420,
    dateIso: '2026-08-27',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902702_047',
    wmoId: 6902702,
    cycleNumber: 47,
    latitude: -9.540,
    longitude: 78.150,
    dateIso: '2026-08-29',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902703_120',
    wmoId: 6902703,
    cycleNumber: 120,
    latitude: -12.330,
    longitude: 84.900,
    dateIso: '2026-08-28',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902704_066',
    wmoId: 6902704,
    cycleNumber: 66,
    latitude: -8.890,
    longitude: 92.350,
    dateIso: '2026-08-30',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902705_039',
    wmoId: 6902705,
    cycleNumber: 39,
    latitude: -14.150,
    longitude: 71.680,
    dateIso: '2026-08-26',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902706_095',
    wmoId: 6902706,
    cycleNumber: 95,
    latitude: -6.420,
    longitude: 88.740,
    dateIso: '2026-08-29',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902707_052',
    wmoId: 6902707,
    cycleNumber: 52,
    latitude: -11.080,
    longitude: 94.120,
    dateIso: '2026-08-27',
    dataMode: 'Real-Time',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
  {
    id: 'INCOIS_6902708_108',
    wmoId: 6902708,
    cycleNumber: 108,
    latitude: -13.750,
    longitude: 63.850,
    dateIso: '2026-08-30',
    dataMode: 'Delayed-Mode',
    dataCenter: 'INCOIS (India)',
    maxDepthM: 2000.0,
    qcStatus: 'QC Passed (Flag 1: Good)',
    tempProfileQc: 1,
    psalProfileQc: 1,
    parameters: ['PRES', 'TEMP', 'PSAL'],
  },
];

export interface AppStoreState {
  // Service health & capabilities
  healthStatus: HealthStatus | null;
  healthProbeState: HealthProbeState;
  backendChoice: RenderingBackendChoice;
  activeBackend: 'webgpu' | 'webgl2' | 'none';
  gpuAdapterName: string;
  isDeviceLost: boolean;

  // Workspace Mode (Overview vs Volume)
  activeWorkspace: WorkspaceMode;
  selectedBoundingBox: BoundingBox | null;
  selectedFloatId: string | null;
  selectedCycleNumber: number | null;

  // Active Dataset & Snapshot Session
  activeDatasetId: string;
  activeSnapshotId: string;
  pinnedSession: PinnedSnapshotSession | null;
  spatialBounds: SpatialBoundsDisplay;
  activeVariableId: string;
  availableVariables: string[];

  // Multi-LOD & Grid Information
  lodMode: LODMode;
  gridInfo: GridDimensionInfo | null;

  // 7-day Temporal State & Playback State Machine
  timestepIndex: number;
  totalTimesteps: number;
  currentDateIso: string;
  timesteps: string[];
  referenceTimeUtc: string;
  forecastLeadHours: number;
  productCycle: string;
  playbackState: PlaybackState;
  isPlaying: boolean;
  playbackSpeedFps: number;
  activeGeneration: number;

  // Geological & Bathymetric Visualization Controls
  verticalExaggeration: number;

  // Actions
  setHealthStatus: (status: HealthStatus | null, probeState: HealthProbeState) => void;
  setBackendChoice: (backend: RenderingBackendChoice) => void;
  setActiveBackend: (backend: 'webgpu' | 'webgl2' | 'none', adapterName?: string) => void;
  setDeviceLost: (lost: boolean) => void;
  setActiveWorkspace: (workspace: WorkspaceMode) => void;
  setSelectedBoundingBox: (box: BoundingBox | null) => void;
  setSelectedFloat: (floatId: string | null, cycleNumber?: number | null) => void;
  applyROIPreset: (presetId: string) => void;
  selectROI: (bounds: BoundingBox) => void;
  setPinnedSession: (session: PinnedSnapshotSession | null) => void;
  setActiveDataset: (datasetId: string, snapshotId?: string) => void;
  setActiveVariable: (variableId: string) => void;
  setSpatialBounds: (bounds: Partial<SpatialBoundsDisplay>) => void;
  setLODMode: (mode: LODMode) => void;
  setGridInfo: (info: GridDimensionInfo | null) => void;
  setVerticalExaggeration: (factor: number) => void;
  setTimestepIndex: (index: number) => void;

  nextTimestep: () => void;
  prevTimestep: () => void;
  togglePlayback: () => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPlaybackSpeedFps: (fps: number) => void;
}

type SetStateFn = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>)
) => void;
type GetStateFn = () => AppStoreState;

function createStore(
  creator: (set: SetStateFn, get: GetStateFn) => AppStoreState
) {
  let state: AppStoreState;
  const listeners = new Set<() => void>();

  const getState: GetStateFn = () => state;

  const setState: SetStateFn = (partial) => {
    const nextState =
      typeof partial === 'function' ? partial(state) : partial;
    if (nextState !== state) {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error('Error in store listener:', err);
        }
      });
    }
  };

  state = creator(setState, getState);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Hook-compatible factory that uses useSyncExternalStore in React, or direct state in tests
  const useStore = () => {
    if (typeof useSyncExternalStore === 'function') {
      try {
        return useSyncExternalStore(subscribe, getState);
      } catch {
        // Fallback outside of React rendering context
        return state;
      }
    }
    return state;
  };

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;

  return useStore;
}

export const useAppStore = createStore((set, get) => ({
  // Defaults conforming to operational baseline dataset
  healthStatus: null,
  healthProbeState: 'checking',
  backendChoice: 'auto',
  activeBackend: 'webgl2',
  gpuAdapterName: 'Hardware WebGL2 / WebGPU Ready',
  isDeviceLost: false,

  // Workspace Mode (Overview vs Volume)
  activeWorkspace: 'overview',
  selectedBoundingBox: {
    west: 60.0,
    south: 0.0,
    east: 68.0,
    north: 15.0,
    minDepthM: 0.494,
    maxDepthM: 5727.917,
  },
  selectedFloatId: 'D1902669_012',
  selectedCycleNumber: 12,

  activeDatasetId: 'copernicus_phy_thetao',
  activeSnapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
  pinnedSession: {
    datasetId: 'copernicus_phy_thetao',
    snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
    visualizationProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
    productVersion: 'v1',
    manifestSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    sourceSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    pinnedAtUtc: '2026-08-30T13:00:40Z',
    shape: [7, 31, 181, 97],
    temporalRange: {
      start: '2026-08-24T00:00:00Z',
      end: '2026-08-30T00:00:00Z',
    },
  },
  spatialBounds: {
    minLon: 60.0,
    maxLon: 68.0,
    minLat: 0.0,
    maxLat: 15.0,
    minDepthM: 0.494,
    maxDepthM: 5727.917,
  },
  activeVariableId: 'thetao (Sea Water Potential Temperature, °C)',
  availableVariables: [
    'thetao (Sea Water Potential Temperature, °C)',
    'speed (Velocity Magnitude, m/s)',
    'so (Sea Water Salinity, 1e-3)',
    'uo (Eastward Ocean Current, m/s)',
    'vo (Northward Ocean Current, m/s)',
    'zos (Sea Surface Height Above Geoid, m)',
  ],

  // Multi-LOD & Grid Info
  lodMode: 'interactive',
  gridInfo: {
    sourceDimensions: [50, 181, 97],
    returnedShape: [24, 48, 48],
    gpuTextureDimensions: [48, 48, 24],
    voxelCount: 55296,
    vramBytes: 276480,
    vramMb: 0.26,
    budgetCeilingMb: 50.0,
    budgetPercent: 0.53,
  },

  // 7-day Temporal State & Playback State Machine
  timestepIndex: 6, // Latest operational timestep (2026-08-30)
  totalTimesteps: 7,
  currentDateIso: '2026-08-30',
  timesteps: [
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
    '2026-08-30',
  ],
  referenceTimeUtc: '2026-08-24T00:00:00Z',
  forecastLeadHours: 144,
  productCycle: '20260824_00Z (7-Day Physical Ocean Forecast)',
  playbackState: 'READY',
  isPlaying: false,
  playbackSpeedFps: 2,
  activeGeneration: 1,

  // Geological & Bathymetric Visualization Controls
  verticalExaggeration: 50.0,

  setHealthStatus: (status, probeState) =>
    set((state) => ({
      healthStatus: status,
      healthProbeState: probeState,
      playbackState: probeState === 'offline' ? 'IDLE' : state.playbackState === 'IDLE' ? 'READY' : state.playbackState,
    })),
  setBackendChoice: (choice) => set({ backendChoice: choice }),
  setActiveBackend: (backend, adapterName) =>
    set((state) => ({
      activeBackend: backend,
      gpuAdapterName: adapterName ?? state.gpuAdapterName,
    })),
  setDeviceLost: (lost) => set({ isDeviceLost: lost }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSelectedBoundingBox: (box) => set({ selectedBoundingBox: box }),
  setSelectedFloat: (floatId, cycleNumber) =>
    set({
      selectedFloatId: floatId,
      selectedCycleNumber: cycleNumber !== undefined ? cycleNumber : null,
    }),
  applyROIPreset: (presetId) => {
    const preset = ROI_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      set((state) => ({
        selectedBoundingBox: preset.bounds,
        spatialBounds: {
          minLon: preset.bounds.west,
          maxLon: preset.bounds.east,
          minLat: preset.bounds.south,
          maxLat: preset.bounds.north,
          minDepthM: preset.bounds.minDepthM ?? state.spatialBounds.minDepthM,
          maxDepthM: preset.bounds.maxDepthM ?? state.spatialBounds.maxDepthM,
        },
        activeGeneration: state.activeGeneration + 1,
      }));
    }
  },
  selectROI: (bounds) => {
    set((state) => ({
      selectedBoundingBox: bounds,
      spatialBounds: {
        minLon: bounds.west,
        maxLon: bounds.east,
        minLat: bounds.south,
        maxLat: bounds.north,
        minDepthM: bounds.minDepthM ?? state.spatialBounds.minDepthM,
        maxDepthM: bounds.maxDepthM ?? state.spatialBounds.maxDepthM,
      },
      activeGeneration: state.activeGeneration + 1,
    }));
  },
  setPinnedSession: (session) =>
    set({
      pinnedSession: session,
      activeDatasetId: session?.datasetId ?? '',
      activeSnapshotId: session?.snapshotId ?? '',
    }),
  setActiveDataset: (datasetId, snapshotId) =>
    set((state) => ({
      activeDatasetId: datasetId,
      activeSnapshotId: snapshotId !== undefined ? snapshotId : state.activeSnapshotId,
    })),
  setActiveVariable: (variableId) =>
    set((state) => ({
      activeVariableId: variableId,
      activeGeneration: state.activeGeneration + 1,
    })),
  setSpatialBounds: (bounds) =>
    set((state) => ({
      spatialBounds: { ...state.spatialBounds, ...bounds },
      selectedBoundingBox: {
        west: bounds.minLon ?? state.spatialBounds.minLon,
        east: bounds.maxLon ?? state.spatialBounds.maxLon,
        south: bounds.minLat ?? state.spatialBounds.minLat,
        north: bounds.maxLat ?? state.spatialBounds.maxLat,
        minDepthM: bounds.minDepthM ?? state.spatialBounds.minDepthM,
        maxDepthM: bounds.maxDepthM ?? state.spatialBounds.maxDepthM,
      },
      activeGeneration: state.activeGeneration + 1,
    })),
  setLODMode: (mode) =>
    set((state) => ({
      lodMode: mode,
      activeGeneration: state.activeGeneration + 1,
    })),
  setGridInfo: (info) => set({ gridInfo: info }),
  setVerticalExaggeration: (factor) =>
    set({ verticalExaggeration: Math.max(10.0, Math.min(100.0, factor)) }),
  setTimestepIndex: (index) => {
    const { timesteps, totalTimesteps, activeGeneration } = get();
    if (index >= 0 && index < totalTimesteps) {
      set({
        timestepIndex: index,
        currentDateIso: timesteps[index],
        referenceTimeUtc: '2026-08-24T00:00:00Z',
        forecastLeadHours: index * 24,
        productCycle: '20260824_00Z (7-Day Physical Ocean Forecast)',
        activeGeneration: activeGeneration + 1,
      });
    }
  },
  nextTimestep: () => {
    const { timestepIndex, totalTimesteps, timesteps, activeGeneration } = get();
    const nextIdx = (timestepIndex + 1) % totalTimesteps;
    set({
      timestepIndex: nextIdx,
      currentDateIso: timesteps[nextIdx],
      referenceTimeUtc: '2026-08-24T00:00:00Z',
      forecastLeadHours: nextIdx * 24,
      productCycle: '20260824_00Z (7-Day Physical Ocean Forecast)',
      activeGeneration: activeGeneration + 1,
    });
  },
  prevTimestep: () => {
    const { timestepIndex, totalTimesteps, timesteps, activeGeneration } = get();
    const prevIdx = (timestepIndex - 1 + totalTimesteps) % totalTimesteps;
    set({
      timestepIndex: prevIdx,
      currentDateIso: timesteps[prevIdx],
      referenceTimeUtc: '2026-08-24T00:00:00Z',
      forecastLeadHours: prevIdx * 24,
      productCycle: '20260824_00Z (7-Day Physical Ocean Forecast)',
      activeGeneration: activeGeneration + 1,
    });
  },
  togglePlayback: () =>
    set((state) => {
      const nextPlaying = !state.isPlaying;
      return {
        isPlaying: nextPlaying,
        playbackState: nextPlaying ? 'PLAYING' : 'READY',
      };
    }),
  setPlaying: (playing) =>
    set({
      isPlaying: playing,
      playbackState: playing ? 'PLAYING' : 'READY',
    }),
  setPlaybackState: (state) =>
    set({
      playbackState: state,
      isPlaying: state === 'PLAYING',
    }),
  setPlaybackSpeedFps: (fps) => set({ playbackSpeedFps: fps }),
}));

