import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../context/app_store.ts';

export const TimelineController: React.FC = () => {
  const {
    timestepIndex,
    totalTimesteps,
    currentDateIso,
    timesteps,
    isPlaying,
    playbackState,
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

  // Keyboard accessibility: Left/Right arrow keys for stepping, Space for play/pause, Home/End for boundaries
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

  const getPlaybackBadgeColor = () => {
    switch (playbackState) {
      case 'PLAYING':
        return 'bg-emerald-950 text-emerald-300 border-emerald-700';
      case 'BUFFERING':
        return 'bg-amber-950 text-amber-300 border-amber-700';
      case 'READY':
        return 'bg-sky-950 text-sky-300 border-sky-700';
      default:
        return 'bg-slate-850 text-slate-300 border-slate-750';
    }
  };

  return (
    <div
      data-testid="timeline-controller"
      className="bg-scientific-panel border-t border-scientific-border px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4 select-none z-20 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-slate-200 hover:text-white border border-scientific-border transition-colors focus:ring-2 focus:ring-sky-400 focus:outline-none"
          title="Jump to Start (Home)"
          aria-label="Jump to start (Home key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Step Previous */}
        <button
          type="button"
          data-testid="btn-timeline-prev"
          onClick={prevTimestep}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-slate-200 hover:text-white border border-scientific-border transition-colors focus:ring-2 focus:ring-sky-400 focus:outline-none"
          title="Step Previous (Arrow Left)"
          aria-label="Step previous (Arrow Left key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          data-testid="btn-timeline-play"
          onClick={togglePlayback}
          className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors border focus:ring-2 focus:ring-cyan-300 focus:outline-none ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-900/40'
              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-900/40'
          }`}
          title="Play / Pause Timeline (Space)"
          aria-label={isPlaying ? 'Pause timeline playback (Space key)' : 'Play timeline playback (Space key)'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-slate-200 hover:text-white border border-scientific-border transition-colors focus:ring-2 focus:ring-sky-400 focus:outline-none"
          title="Step Next (Arrow Right)"
          aria-label="Step next (Arrow Right key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
        </button>

        {/* Jump to End */}
        <button
          type="button"
          data-testid="btn-timeline-last"
          onClick={() => setTimestepIndex(totalTimesteps - 1)}
          className="p-1.5 rounded bg-scientific-card hover:bg-slate-800 text-slate-200 hover:text-white border border-scientific-border transition-colors focus:ring-2 focus:ring-sky-400 focus:outline-none"
          title="Jump to Latest (End)"
          aria-label="Jump to latest (End key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>

        {/* Playback FSM Status Badge */}
        <span
          data-testid="timeline-playback-state"
          className={`ml-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getPlaybackBadgeColor()}`}
          title={`Playback FSM state: ${playbackState}`}
        >
          {playbackState}
        </span>
      </div>

      {/* Center: Discrete Multi-Day Timeline Scrubber Bar */}
      <div className="flex-1 max-w-2xl flex flex-col gap-1.5 px-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium text-[11px]">DATE:</span>
            <span data-testid="timeline-current-date" className="text-sky-300 font-bold tracking-wide">
              {currentDateIso}
            </span>
            <span className="text-[10px] text-slate-300">
              (Step {timestepIndex + 1}/{totalTimesteps})
            </span>
          </div>

          {/* Stale Generation / Cancellation Tag */}
          <div
            data-testid="timeline-generation-tag"
            className="flex items-center gap-1.5 text-[10px] text-slate-300"
            title="Active temporal request generation epoch token (superseded in-flight downloads are cancelled)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="font-semibold text-slate-200">GEN #{activeGeneration}</span>
          </div>
        </div>

        {/* Discrete Step Nodes */}
        <div
          data-testid="timeline-step-nodes"
          className="flex items-center justify-between gap-1 relative bg-slate-900/90 p-1 rounded border border-scientific-border"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalTimesteps - 1}
          aria-valuenow={timestepIndex}
          aria-valuetext={`Day ${timestepIndex + 1} of ${totalTimesteps}: ${currentDateIso}`}
          aria-label="7-Day Timeline Scrubber"
        >
          {timesteps.map((tsDate, idx) => {
            const isSelected = idx === timestepIndex;
            return (
              <button
                key={tsDate}
                type="button"
                data-testid={`timeline-step-btn-${idx}`}
                onClick={() => setTimestepIndex(idx)}
                className={`flex-1 py-1 px-1 rounded text-center font-mono text-[10px] transition-all focus:outline-none focus:ring-1 focus:ring-sky-400 ${
                  isSelected
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/40 border border-sky-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`Select timestep ${tsDate} (Day ${idx + 1})`}
                aria-label={`Select day ${idx + 1}: ${tsDate}`}
                aria-current={isSelected ? 'date' : undefined}
              >
                {tsDate.slice(5)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Operational Period Badge */}
      <div className="hidden xl:flex flex-col items-end font-mono text-[10px] text-slate-300">
        <span className="text-slate-200 font-semibold">7-DAY OPERATIONAL CYCLE</span>
        <span>2026-08-24 → 2026-08-30</span>
      </div>
    </div>
  );
};
