/**
 * QuasarOS 3D Geographic Orientation Gizmo (ENU Compass Triad)
 *
 * Implements:
 * 1. 3D ENU coordinate axis frame (East = Red +X, North = Green +Z, Up = Sky Blue +Y, Down = Amber -Y).
 * 2. Real-time digital compass heading, pitch, and cardinal direction readout.
 * 3. Interactive viewpoint snap buttons (Top/Nadir, North, South, East, West, Iso).
 */

import React from 'react';
import { ENUCompassGizmoModel } from '@quasar/runtime';

export interface OrientationGizmoProps {
  headingDeg: number;
  pitchDeg: number;
  rollDeg?: number;
  onSnapView?: (pitchRad: number, yawRad: number) => void;
  className?: string;
}

function getCardinalDirection(headingDeg: number): string {
  const norm = ((headingDeg % 360) + 360) % 360;
  const cardinals = [
    { name: 'N', min: 348.75, max: 360 },
    { name: 'N', min: 0, max: 11.25 },
    { name: 'NNE', min: 11.25, max: 33.75 },
    { name: 'NE', min: 33.75, max: 56.25 },
    { name: 'ENE', min: 56.25, max: 78.75 },
    { name: 'E', min: 78.75, max: 101.25 },
    { name: 'ESE', min: 101.25, max: 123.75 },
    { name: 'SE', min: 123.75, max: 146.25 },
    { name: 'SSE', min: 146.25, max: 168.75 },
    { name: 'S', min: 168.75, max: 191.25 },
    { name: 'SSW', min: 191.25, max: 213.75 },
    { name: 'SW', min: 213.75, max: 236.25 },
    { name: 'WSW', min: 236.25, max: 258.75 },
    { name: 'W', min: 258.75, max: 281.25 },
    { name: 'WNW', min: 281.25, max: 303.75 },
    { name: 'NW', min: 303.75, max: 326.25 },
    { name: 'NNW', min: 326.25, max: 348.75 },
  ];
  const found = cardinals.find((c) => norm >= c.min && norm < c.max);
  return found ? found.name : 'N';
}

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
  headingDeg,
  pitchDeg,
  rollDeg = 0,
  onSnapView,
  className = '',
}) => {
  const gizmoModel = React.useMemo(() => new ENUCompassGizmoModel(), []);
  gizmoModel.updateFromAngles((pitchDeg * Math.PI) / 180, (-headingDeg * Math.PI) / 180, (rollDeg * Math.PI) / 180);

  const cardinal = getCardinalDirection(headingDeg);
  const size = 96;
  const center = size / 2;
  const radius = 34;

  // Project 3D vector to 2D SVG canvas
  const radH = (headingDeg * Math.PI) / 180.0;
  const radP = (pitchDeg * Math.PI) / 180.0;

  const cosH = Math.cos(radH);
  const sinH = Math.sin(radH);
  const cosP = Math.cos(radP);
  const sinP = Math.sin(radP);

  // Axes in world space:
  // East (+X): [cosH, -sinH * sinP]
  // North (+Z): [-sinH, -cosH * sinP]
  // Up (+Y): [0, cosP]
  const axes = [
    {
      label: 'E',
      fullName: 'East (+X)',
      color: '#ef4444', // Red
      x: center + cosH * radius,
      y: center - (-sinH * sinP) * radius,
      zDepth: -sinH * cosP,
    },
    {
      label: 'N',
      fullName: 'North (+Z)',
      color: '#22c55e', // Green
      x: center + (-sinH) * radius,
      y: center - (-cosH * sinP) * radius,
      zDepth: -cosH * cosP,
    },
    {
      label: 'U',
      fullName: 'Up (+Y Surface)',
      color: '#38bdf8', // Sky Blue
      x: center + 0,
      y: center - cosP * radius,
      zDepth: sinP,
    },
  ];

  // Sort by zDepth so background axes render before foreground
  const sortedAxes = [...axes].sort((a, b) => a.zDepth - b.zDepth);

  return (
    <div
      data-testid="orientation-gizmo"
      className={`bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg p-2 text-slate-200 shadow-2xl flex flex-col items-center gap-1 min-w-[120px] ${className}`}
    >
      {/* 3D Compass Triad SVG Canvas */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible select-none">
          {/* Outer Compass Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="rgba(15, 23, 42, 0.6)"
            stroke="rgba(71, 85, 105, 0.5)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <circle cx={center} cy={center} r={3} fill="#94a3b8" />

          {/* Render 3D Axes lines and tips */}
          {sortedAxes.map((axis) => (
            <g key={axis.label} className="transition-all duration-75">
              <line
                x1={center}
                y1={center}
                x2={axis.x}
                y2={axis.y}
                stroke={axis.color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={axis.x} cy={axis.y} r={7} fill={axis.color} />
              <text
                x={axis.x}
                y={axis.y + 3.5}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {axis.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Digital Heading & Pitch Readout */}
      <div className="flex flex-col items-center font-mono text-[10px] leading-tight w-full border-t border-slate-800/80 pt-1">
        <div className="flex justify-between w-full text-slate-300">
          <span className="text-slate-400">HDG:</span>
          <span data-testid="gizmo-heading-readout" className="text-cyan-300 font-bold">
            {Math.round(headingDeg).toString().padStart(3, '0')}° ({cardinal})
          </span>
        </div>
        <div className="flex justify-between w-full text-slate-300">
          <span className="text-slate-400">PITCH:</span>
          <span data-testid="gizmo-pitch-readout" className="text-emerald-300 font-bold">
            {Math.round(pitchDeg)}°
          </span>
        </div>
      </div>

      {/* Viewport Preset Snap Buttons */}
      {onSnapView && (
        <div className="grid grid-cols-3 gap-1 w-full pt-1 border-t border-slate-800/80 text-[9px] font-mono">
          <button
            onClick={() => onSnapView(Math.PI / 2 - 0.01, 0)}
            data-testid="btn-snap-top"
            title="Snap to Top/Nadir View"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 rounded border border-slate-800 transition text-center"
          >
            Top
          </button>
          <button
            onClick={() => onSnapView(0.05, 0)}
            data-testid="btn-snap-north"
            title="Snap looking North"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 rounded border border-slate-800 transition text-center"
          >
            North
          </button>
          <button
            onClick={() => onSnapView(0.45, -0.55)}
            data-testid="btn-snap-iso"
            title="Snap to Isometric 3D View"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 rounded border border-slate-800 transition text-center font-semibold"
          >
            Iso
          </button>
          <button
            onClick={() => onSnapView(0.05, Math.PI)}
            data-testid="btn-snap-south"
            title="Snap looking South"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 rounded border border-slate-800 transition text-center"
          >
            South
          </button>
          <button
            onClick={() => onSnapView(0.05, -Math.PI / 2)}
            data-testid="btn-snap-east"
            title="Snap looking East"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-red-300 rounded border border-slate-800 transition text-center"
          >
            East
          </button>
          <button
            onClick={() => onSnapView(0.05, Math.PI / 2)}
            data-testid="btn-snap-west"
            title="Snap looking West"
            className="py-0.5 px-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 rounded border border-slate-800 transition text-center"
          >
            West
          </button>
        </div>
      )}
    </div>
  );
};
