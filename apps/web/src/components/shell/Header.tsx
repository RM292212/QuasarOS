import React, { useEffect, useState } from 'react';
import { useAppStore, type RenderingBackendChoice } from '../../context/app_store.ts';

export const Header: React.FC = () => {
  const {
    healthProbeState,
    healthStatus,
    backendChoice,
    activeBackend,
    gpuAdapterName,
    isDeviceLost,
    activeDatasetId,
    activeSnapshotId,
    setBackendChoice,
    setHealthStatus,
  } = useAppStore();

  const [isBackendMenuOpen, setIsBackendMenuOpen] = useState(false);

  // Bounded exponential backoff health polling with single in-flight AbortController
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let abortCtrl: AbortController | null = null;
    let currentDelayMs = 2000; // Start with 2s initial delay when checking/reconnecting
    const maxDelayMs = 15000;  // Cap at 15s steady-state

    const pollHealth = async () => {
      if (!mounted) return;

      if (abortCtrl) {
        abortCtrl.abort();
      }
      abortCtrl = new AbortController();

      try {
        const res = await fetch('/health/ready', {
          signal: abortCtrl.signal,
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setHealthStatus(data, 'healthy');
            currentDelayMs = maxDelayMs; // Reset backoff to steady-state 15s on success
          }
        } else {
          if (mounted) {
            setHealthStatus(null, 'degraded');
            currentDelayMs = Math.min(maxDelayMs, currentDelayMs * 1.5);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // Cancelled
        if (mounted) {
          // Genuinely offline - update status honestly
          setHealthStatus(null, 'offline');
          // Exponential backoff with small random jitter
          const jitter = Math.random() * 500;
          currentDelayMs = Math.min(maxDelayMs, (currentDelayMs * 1.8) + jitter);
        }
      } finally {
        if (mounted) {
          timeoutId = setTimeout(pollHealth, currentDelayMs);
        }
      }
    };

    pollHealth();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (abortCtrl) abortCtrl.abort();
    };
  }, [setHealthStatus]);

  const getHealthBadge = () => {
    switch (healthProbeState) {
      case 'healthy':
        return (
          <span
            data-testid="health-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800"
            title="Service endpoints /health/live and /health/ready reporting healthy status"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE : READY
          </span>
        );
      case 'degraded':
        return (
          <span
            data-testid="health-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800"
            title="Service degraded: some endpoints responding slowly"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            DEGRADED
          </span>
        );
      case 'offline':
        return (
          <span
            data-testid="health-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800"
            title="Catalog service unreachable"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            OFFLINE
          </span>
        );
      default:
        return (
          <span
            data-testid="health-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            PROBING...
          </span>
        );
    }
  };

  const handleBackendChange = (choice: RenderingBackendChoice) => {
    setBackendChoice(choice);
    setIsBackendMenuOpen(false);
  };

  return (
    <header
      role="banner"
      className="h-14 bg-scientific-panel border-b border-scientific-border px-4 flex items-center justify-between select-none z-30 relative"
    >
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-white">QuasarOS</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-950 text-sky-400 border border-sky-800/80 rounded font-mono font-semibold">
                3D OceanScope
              </span>
            </div>
            <span className="text-[10px] text-scientific-muted leading-tight font-mono">
              CMEMS GLOBAL-ANALYSISFORECAST-PHY-001-024
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-scientific-border mx-1"></div>

        {/* Health status probe badge */}
        {getHealthBadge()}
      </div>

      {/* Center: Active Pinned Snapshot Indicator */}
      <div className="hidden lg:flex items-center gap-2 bg-scientific-card/80 border border-scientific-border px-3 py-1 rounded-md text-xs font-mono">
        <span className="text-scientific-muted">SNAPSHOT:</span>
        <span
          data-testid="header-snapshot-id"
          className="text-sky-300 font-medium truncate max-w-xs xl:max-w-md"
          title={`Active Snapshot ID: ${activeSnapshotId}`}
        >
          {activeSnapshotId}
        </span>
        <span className="px-1.5 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded text-[10px]">
          PINNED
        </span>
      </div>

      {/* Right Controls: Backend Selector & Hardware State */}
      <div className="flex items-center gap-3">
        {/* Hardware Status / Context Lost Indicator */}
        {isDeviceLost ? (
          <span
            data-testid="device-lost-banner"
            className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded text-xs font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            GPU DEVICE LOST
          </span>
        ) : null}

        {/* Backend Capability Switcher */}
        <div className="relative">
          <button
            type="button"
            data-testid="backend-switcher-btn"
            onClick={() => setIsBackendMenuOpen(!isBackendMenuOpen)}
            className="flex items-center gap-2 bg-scientific-card hover:bg-slate-800 border border-scientific-border hover:border-sky-600 px-3 py-1.5 rounded text-xs font-mono text-scientific-text transition-colors"
            aria-haspopup="listbox"
            aria-expanded={isBackendMenuOpen}
            aria-label="Select 3D Graphics Backend"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="font-medium uppercase">
              {backendChoice === 'auto' ? `Auto (${activeBackend})` : backendChoice}
            </span>
            <svg className="w-3.5 h-3.5 text-scientific-muted" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isBackendMenuOpen && (
            <div
              data-testid="backend-dropdown"
              className="absolute right-0 mt-1 w-56 bg-scientific-card border border-scientific-border rounded shadow-xl py-1 z-50 text-xs font-mono"
              role="listbox"
            >
              <div className="px-3 py-1.5 text-[10px] text-scientific-muted border-b border-scientific-border/50">
                GPU ADAPTER: <span className="text-gray-300 block truncate">{gpuAdapterName}</span>
              </div>
              <button
                type="button"
                data-testid="backend-opt-auto"
                onClick={() => handleBackendChange('auto')}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 ${
                  backendChoice === 'auto' ? 'text-sky-400 bg-sky-950/40 font-semibold' : 'text-gray-300'
                }`}
                role="option"
                aria-selected={backendChoice === 'auto'}
              >
                <span>Auto (WebGPU Preferred)</span>
                {backendChoice === 'auto' && <span>✓</span>}
              </button>
              <button
                type="button"
                data-testid="backend-opt-webgpu"
                onClick={() => handleBackendChange('webgpu')}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 ${
                  backendChoice === 'webgpu' ? 'text-sky-400 bg-sky-950/40 font-semibold' : 'text-gray-300'
                }`}
                role="option"
                aria-selected={backendChoice === 'webgpu'}
              >
                <span>WebGPU (WGSL Raymarch)</span>
                {backendChoice === 'webgpu' && <span>✓</span>}
              </button>
              <button
                type="button"
                data-testid="backend-opt-webgl2"
                onClick={() => handleBackendChange('webgl2')}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 ${
                  backendChoice === 'webgl2' ? 'text-sky-400 bg-sky-950/40 font-semibold' : 'text-gray-300'
                }`}
                role="option"
                aria-selected={backendChoice === 'webgl2'}
              >
                <span>WebGL 2 (GLSL ES 3.00)</span>
                {backendChoice === 'webgl2' && <span>✓</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
