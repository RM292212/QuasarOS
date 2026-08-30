import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../context/app_store.ts';

export const TimelineController: React.FC = () => {
  const {
    timestepIndex,
    totalTimesteps,
    currentDateIso,
    timesteps,
    isPlaying,
    playbackSpeedFps,
    activeGeneration,
    setTimestepIndex,
    nextTimestep,
    prevTimestep,
    togglePlayback,
  } = useAppStore();

  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeedFps));
      playTimerRef.current = setInterval(() => {
        nextTimestep();
      }, intervalMs);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeedFps, nextTimestep]);

  // Keyboard accessibility: Left/Right arrow keys for stepping, Space for play/pause
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextTimestep();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevTimestep();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlayback();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setTimestepIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setTimestepIndex(totalTimesteps - 1);
    }
  };

  return (
    <div
      data-testid="timeline-controller"
      className="bg-scientific-panel border-t border-scientific-border px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4 select-none z-20"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="7-Day Operational Oceanographic Timeline Controller"
    >
      {/* Left: Transport Playback Controls */}
      <div className="flex items-center gap-2">
        {/* Jump to Start */}
        <button
          type="button"
          data-testid="btn-timeline-first"
          onClick={() => setTimestepIndex(0)}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-scientific-muted hover:text-white border border-scientific-border transition-colors"
          title="Jump to Start (Home)"
          aria-label="Jump to start"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Step Previous */}
        <button
          type="button"
          data-testid="btn-timeline-prev"
          onClick={prevTimestep}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-scientific-muted hover:text-white border border-scientific-border transition-colors"
          title="Step Previous (Arrow Left)"
          aria-label="Step previous"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          data-testid="btn-timeline-play"
          onClick={togglePlayback}
          className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400'
              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
          }`}
          title="Play / Pause Timeline (Space)"
          aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline playback'}
        >
          {isPlaying ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Step Next */}
        <button
          type="button"
          data-testid="btn-timeline-next"
          onClick={nextTimestep}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-scientific-muted hover:text-white border border-scientific-border transition-colors"
          title="Step Next (Arrow Right)"
          aria-label="Step next"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
        </button>

        {/* Jump to End */}
        <button
          type="button"
          data-testid="btn-timeline-last"
          onClick={() => setTimestepIndex(totalTimesteps - 1)}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-scientific-muted hover:text-white border border-scientific-border transition-colors"
          title="Jump to Latest (End)"
          aria-label="Jump to latest"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      {/* Center: Discrete Multi-Day Timeline Scrubber Bar */}
      <div className="flex-1 max-w-2xl flex flex-col gap-1.5 px-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-scientific-muted text-[11px]">DATE:</span>
            <span data-testid="timeline-current-date" className="text-sky-300 font-bold tracking-wide">
              {currentDateIso}
            </span>
            <span className="text-[10px] text-gray-400">
              (Step {timestepIndex + 1}/{totalTimesteps})
            </span>
          </div>

          {/* Stale Generation / Cancellation Tag */}
          <div
            data-testid="timeline-generation-tag"
            className="flex items-center gap-1.5 text-[10px] text-scientific-muted"
            title="Active temporal request generation epoch token (superseded in-flight downloads are cancelled)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>GEN #{activeGeneration}</span>
          </div>
        </div>

        {/* Discrete Step Nodes */}
        <div
          data-testid="timeline-step-nodes"
          className="flex items-center justify-between gap-1 relative bg-slate-900/80 p-1 rounded border border-scientific-border"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalTimesteps - 1}
          aria-valuenow={timestepIndex}
          aria-valuetext={currentDateIso}
        >
          {timesteps.map((tsDate, idx) => {
            const isSelected = idx === timestepIndex;
            return (
              <button
                key={tsDate}
                type="button"
                data-testid={`timeline-step-btn-${idx}`}
                onClick={() => setTimestepIndex(idx)}
                className={`flex-1 py-1 px-1 rounded text-center font-mono text-[10px] transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                }`}
                title={`Select timestep ${tsDate}`}
              >
                {tsDate.slice(5)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Operational Period Badge */}
      <div className="hidden xl:flex flex-col items-end font-mono text-[10px] text-scientific-muted">
        <span className="text-gray-300 font-semibold">7-DAY OPERATIONAL CYCLE</span>
        <span>2026-08-24 → 2026-08-30</span>
      </div>
    </div>
  );
};
