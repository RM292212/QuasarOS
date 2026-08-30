/**
 * UI Application State Store for QuasarOS Web Client.
 *
 * Conforms strictly to AGENTS.md:
 * - NO large TypedArrays or volume buffers in state.
 * - Stores lightweight metadata, selections, UI toggles, and probe status.
 * - Zero external state framework bloat; lightweight subscription-capable vanilla store.
 */

import type { HealthStatus, PinnedSnapshotSession } from '../../../../packages/client/src/types.ts';

export type RenderingBackendChoice = 'auto' | 'webgpu' | 'webgl2';
export type HealthProbeState = 'healthy' | 'degraded' | 'offline' | 'checking';

export interface SpatialBoundsDisplay {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  minDepthM: number;
  maxDepthM: number;
}

export interface AppStoreState {
  // Service health & capabilities
  healthStatus: HealthStatus | null;
  healthProbeState: HealthProbeState;
  backendChoice: RenderingBackendChoice;
  activeBackend: 'webgpu' | 'webgl2' | 'none';
  gpuAdapterName: string;
  isDeviceLost: boolean;

  // Active Dataset & Snapshot Session
  activeDatasetId: string;
  activeSnapshotId: string;
  pinnedSession: PinnedSnapshotSession | null;
  spatialBounds: SpatialBoundsDisplay;
  activeVariableId: string;
  availableVariables: string[];

  // 7-day Temporal State
  timestepIndex: number;
  totalTimesteps: number;
  currentDateIso: string;
  timesteps: string[];
  isPlaying: boolean;
  playbackSpeedFps: number;
  activeGeneration: number;

  // Actions
  setHealthStatus: (status: HealthStatus | null, probeState: HealthProbeState) => void;
  setBackendChoice: (backend: RenderingBackendChoice) => void;
  setActiveBackend: (backend: 'webgpu' | 'webgl2' | 'none', adapterName?: string) => void;
  setDeviceLost: (lost: boolean) => void;
  setPinnedSession: (session: PinnedSnapshotSession | null) => void;
  setActiveDataset: (datasetId: string, snapshotId: string) => void;
  setActiveVariable: (variableId: string) => void;
  setSpatialBounds: (bounds: Partial<SpatialBoundsDisplay>) => void;
  setTimestepIndex: (index: number) => void;
  nextTimestep: () => void;
  prevTimestep: () => void;
  togglePlayback: () => void;
  setPlaying: (playing: boolean) => void;
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
  const listeners = new Set<(state: AppStoreState) => void>();

  const getState: GetStateFn = () => state;

  const setState: SetStateFn = (partial) => {
    const nextState =
      typeof partial === 'function' ? partial(state) : partial;
    if (nextState !== state) {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener(state));
    }
  };

  state = creator(setState, getState);

  // Hook-compatible factory that does not fail in non-React (e.g. Node.js unit test) environments
  const useStore = () => {
    // If in browser/React context, we dynamically bind if available
    return state;
  };

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = (listener: (state: AppStoreState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return useStore;
}

export const useAppStore = createStore((set, get) => ({
  // Defaults conforming to operational baseline dataset
  healthStatus: null,
  healthProbeState: 'checking',
  backendChoice: 'auto',
  activeBackend: 'webgpu',
  gpuAdapterName: 'Hardware WebGPU Adapter',
  isDeviceLost: false,

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
    minLon: 80.0,
    maxLon: 88.0,
    minLat: -3.0,
    maxLat: 12.0,
    minDepthM: 0.494,
    maxDepthM: 453.938,
  },
  activeVariableId: 'sea_water_potential_temperature',
  availableVariables: ['sea_water_potential_temperature'],

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
  isPlaying: false,
  playbackSpeedFps: 2,
  activeGeneration: 1,

  setHealthStatus: (status, probeState) => set({ healthStatus: status, healthProbeState: probeState }),
  setBackendChoice: (choice) => set({ backendChoice: choice }),
  setActiveBackend: (backend, adapterName) =>
    set((state) => ({
      activeBackend: backend,
      gpuAdapterName: adapterName ?? state.gpuAdapterName,
    })),
  setDeviceLost: (lost) => set({ isDeviceLost: lost }),
  setPinnedSession: (session) =>
    set({
      pinnedSession: session,
      activeDatasetId: session?.datasetId ?? '',
      activeSnapshotId: session?.snapshotId ?? '',
    }),
  setActiveDataset: (datasetId, snapshotId) =>
    set({
      activeDatasetId: datasetId,
      activeSnapshotId: snapshotId,
    }),
  setActiveVariable: (variableId) => set({ activeVariableId: variableId }),
  setSpatialBounds: (bounds) =>
    set((state) => ({
      spatialBounds: { ...state.spatialBounds, ...bounds },
    })),
  setTimestepIndex: (index) => {
    const { timesteps, totalTimesteps, activeGeneration } = get();
    if (index >= 0 && index < totalTimesteps) {
      set({
        timestepIndex: index,
        currentDateIso: timesteps[index],
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
      activeGeneration: activeGeneration + 1,
    });
  },
  prevTimestep: () => {
    const { timestepIndex, totalTimesteps, timesteps, activeGeneration } = get();
    const prevIdx = (timestepIndex - 1 + totalTimesteps) % totalTimesteps;
    set({
      timestepIndex: prevIdx,
      currentDateIso: timesteps[prevIdx],
      activeGeneration: activeGeneration + 1,
    });
  },
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeedFps: (fps) => set({ playbackSpeedFps: fps }),
}));
