import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../context/app_store.ts';

export const OceanVolumeViewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { activeBackend, activeVariableId, timestepIndex, spatialBounds, healthProbeState } = useAppStore();
  const [fps, setFps] = useState<number>(60);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isStaleFrame, setIsStaleFrame] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataStats, setDataStats] = useState<{ min: number; max: number; date: string; varCode: string }>({
    min: 9.37,
    max: 30.36,
    date: '2026-08-24',
    varCode: 'thetao'
  });

  // Extract pure variable code (thetao, so, uo, vo, zos)
  const varCode = activeVariableId.split(' ')[0].toLowerCase();
  const activeFetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // If backend is known to be offline, mark as stale and avoid immediate fetch until reconnected
    if (healthProbeState === 'offline') {
      setIsStaleFrame(true);
      return;
    }

    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const abortCtrl = new AbortController();
    activeFetchAbortRef.current = abortCtrl;

    setIsLoadingData(true);
    setLoadError(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let frameCount = 0;
    let lastTime = performance.now();

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!gl) return;

    // Fetch Authoritative 3D Scalar Field for the active day and variable
    fetch(`/api/v1/analysis/volume-grid?variable=${varCode}&time_index=${timestepIndex}&depth_levels=16&lat_res=32&lon_res=32`, {
      signal: abortCtrl.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((json) => {
        if (abortCtrl.signal.aborted || !json) return;

        setDataStats({
          min: json.min_val,
          max: json.max_val,
          date: json.timestamp_iso,
          varCode: json.variable
        });
        setIsLoadingData(false);
        setIsStaleFrame(false);

        // Normalize scalar data to 0.0 - 1.0 for texture (and mark NaNs as -1.0)
        const rawData: number[] = json.data;
        const dMin = json.min_val;
        const dMax = json.max_val > json.min_val ? json.max_val : json.min_val + 1.0;
        
        const texData = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          const val = rawData[i];
          if (val <= -900.0) {
            texData[i] = 0; // Land / Missing mask
          } else {
            const norm = Math.max(0, Math.min(1, (val - dMin) / (dMax - dMin)));
            texData[i] = Math.round(norm * 254) + 1; // 1-255 valid ocean
          }
        }

        // Upload to 3D Texture (16 depth x 32 lat x 32 lon)
        const [D, H, W] = json.shape.length === 3 ? json.shape : [1, json.shape[0], json.shape[1]];
        const volTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, volTex);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, W, H, D, 0, gl.RED, gl.UNSIGNED_BYTE, texData);

        // WebGL2 Vertex Shader: Draws Bounding Box & Ray Direction Vectors
        const vsSource = `#version 300 es
          in vec3 aPos;
          out vec3 vLocalPos;
          uniform mat4 uMVP;
          void main() {
            vLocalPos = aPos;
            gl_Position = uMVP * vec4(aPos, 1.0);
          }
        `;

        // WebGL2 Fragment Shader: Real Front-to-Back Volume Raymarching with Transfer Function
        const fsSource = `#version 300 es
          precision highp float;
          precision highp sampler3D;
          in vec3 vLocalPos;
          out vec4 fragColor;
          uniform sampler3D uVolumeTex;
          uniform mat4 uInvMVP;
          uniform vec3 uCamPos;
          uniform float uMinVal;
          uniform float uMaxVal;
          uniform float uStepSize;

          // Perceptually Uniform Thermal / Oceanic Colormap
          vec4 evaluateTransferFunction(float scalarNorm) {
            if (scalarNorm <= 0.005) {
              return vec4(0.0); // Transparent land / missing mask
            }
            // Sequential ocean gradient: Deep Blue -> Cyan -> Emerald -> Yellow -> Red
            float s = clamp(scalarNorm, 0.0, 1.0);
            vec3 c;
            if (s < 0.25) {
              c = mix(vec3(0.05, 0.15, 0.55), vec3(0.1, 0.6, 0.8), s / 0.25);
            } else if (s < 0.5) {
              c = mix(vec3(0.1, 0.6, 0.8), vec3(0.1, 0.85, 0.5), (s - 0.25) / 0.25);
            } else if (s < 0.75) {
              c = mix(vec3(0.1, 0.85, 0.5), vec3(0.95, 0.8, 0.1), (s - 0.5) / 0.25);
            } else {
              c = mix(vec3(0.95, 0.8, 0.1), vec3(0.9, 0.15, 0.15), (s - 0.75) / 0.25);
            }
            float alpha = 0.03 + 0.35 * smoothstep(0.1, 0.9, s);
            return vec4(c, alpha);
          }

          void main() {
            vec3 rayStart = vLocalPos + 0.5;
            vec3 rayDir = normalize(vLocalPos - uCamPos);
            vec3 p = rayStart;
            vec4 accum = vec4(0.0);

            // Step through 3D volume along view ray
            for (int i = 0; i < 96; i++) {
              if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0) {
                break;
              }
              float s = texture(uVolumeTex, p).r;
              vec4 col = evaluateTransferFunction(s);
              
              // Front-to-back compositing
              accum.rgb += (1.0 - accum.a) * col.rgb * col.a;
              accum.a += (1.0 - accum.a) * col.a;
              
              if (accum.a >= 0.95) break;
              p += rayDir * uStepSize;
            }

            // Grid coordinate background blend
            vec3 bg = vec3(0.015, 0.03, 0.06);
            fragColor = vec4(mix(bg, accum.rgb, accum.a), 1.0);
          }
        `;

        const createShader = (type: number, src: string) => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };

        const program = gl.createProgram()!;
        gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        gl.useProgram(program);

        // Cube volume geometry vertices
        const boxVertices = new Float32Array([
          -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
          -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
        ]);
        const boxIndices = new Uint16Array([
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
          0, 4, 7, 0, 7, 3, 1, 5, 6, 1, 6, 2,
          3, 2, 6, 3, 6, 7, 0, 1, 5, 0, 5, 4
        ]);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, boxVertices, gl.STATIC_DRAW);

        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, boxIndices, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 12, 0);

        const mvpLoc = gl.getUniformLocation(program, 'uMVP');
        const camLoc = gl.getUniformLocation(program, 'uCamPos');
        const stepLoc = gl.getUniformLocation(program, 'uStepSize');
        gl.uniform1f(stepLoc, 0.012);

        let angleX = 0.45;
        let angleY = -0.5;
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        const onMouseDown = (e: MouseEvent) => {
          isDragging = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        };
        const onMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          angleY += (e.clientX - lastMouseX) * 0.008;
          angleX += (e.clientY - lastMouseY) * 0.008;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        };
        const onMouseUp = () => { isDragging = false; };

        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        const render = (time: number) => {
          frameCount++;
          if (time - lastTime >= 1000) {
            setFps(Math.round((frameCount * 1000) / (time - lastTime)));
            frameCount = 0;
            lastTime = time;
          }

          if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
          }

          gl.clearColor(0.015, 0.03, 0.06, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          if (!isDragging) {
            angleY += 0.002;
          }

          const aspect = canvas.width / canvas.height;
          const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
          const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

          const mvp = new Float32Array([
            cosY / aspect, sinY * sinX,  sinY * cosX, 0,
            0,             cosX,         -sinX,       0,
            -sinY / aspect, cosY * sinX, cosY * cosX, 0,
            0,             0,            0,           1.25
          ]);

          gl.uniformMatrix4fv(mvpLoc, false, mvp);
          gl.uniform3f(camLoc, -sinY * 1.5, -sinX * 1.5, cosY * cosX * 1.5);

          gl.bindVertexArray(vao);
          gl.drawElements(gl.TRIANGLES, boxIndices.length, gl.UNSIGNED_SHORT, 0);

          animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return; // Cancelled intentionally
        console.warn('Volume texture load error:', err?.message || err);
        setIsLoadingData(false);
        setIsStaleFrame(true);
        setLoadError(err?.message || 'Failed to load volume grid');
      });

    return () => {
      if (activeFetchAbortRef.current) {
        activeFetchAbortRef.current.abort();
      }
      if (animId) cancelAnimationFrame(animId);
    };
  }, [activeVariableId, timestepIndex, healthProbeState]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden" data-testid="ocean-volume-viewport">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Loading Indicator */}
      {isLoadingData && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-30 pointer-events-none">
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg text-cyan-300 font-mono text-xs shadow-2xl">
            <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Streaming Authoritative 3D Scalar Field (Day {timestepIndex + 1}/7)...</span>
          </div>
        </div>
      )}

      {/* Floating 3D HUD Information Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 shadow-2xl pointer-events-none flex flex-col gap-1.5 min-w-[300px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isStaleFrame ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className={`${isStaleFrame ? 'text-amber-300' : 'text-emerald-300'} font-bold uppercase`}>
              {activeBackend.toUpperCase()} 3D OCEAN VOLUME {isStaleFrame ? '(STALE / RECONNECTING)' : ''}
            </span>
          </div>
          <span className="text-cyan-300 font-bold px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded text-[10px]">{fps} FPS</span>
        </div>
        
        <div className="text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>Active Variable:</span>
          <span className="text-amber-300 font-semibold">{dataStats.varCode.toUpperCase()} ({activeVariableId.split('(')[0]})</span>
        </div>

        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Observed Range:</span>
          <span className="text-cyan-300 font-semibold">{dataStats.min.toFixed(3)} → {dataStats.max.toFixed(3)}</span>
        </div>
        
        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Spatial Bounds:</span>
          <span className="text-sky-300 font-semibold">[{spatialBounds.minLon}°E—{spatialBounds.maxLon}°E, {spatialBounds.minLat}°N—{spatialBounds.maxLat}°N]</span>
        </div>

        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Vertical Extents:</span>
          <span className="text-emerald-300 font-semibold">0.494 m → 5,727.917 m (50 Levels)</span>
        </div>

        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Timestep:</span>
          <span className="text-white font-bold">{dataStats.date} (Day {timestepIndex + 1}/7)</span>
        </div>

        <div className="text-[9px] text-slate-500 italic mt-0.5">
          * Click & drag anywhere on the canvas to rotate 3D ocean volume
        </div>
      </div>
    </div>
  );
};
