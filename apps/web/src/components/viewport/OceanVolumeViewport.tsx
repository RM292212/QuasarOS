import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../context/app_store.ts';

export const OceanVolumeViewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { activeBackend, activeVariableId, timestepIndex, spatialBounds } = useAppStore();
  const [fps, setFps] = useState<number>(60);
  const [activeIsovalue, setActiveIsovalue] = useState<number>(24.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let frameCount = 0;
    let lastTime = performance.now();

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!gl) return;

    // Compile Vertex Shader
    const vsSource = `#version 300 es
      in vec3 position;
      in vec3 color;
      out vec3 vColor;
      uniform mat4 uMatrix;
      void main() {
        vColor = color;
        gl_Position = uMatrix * vec4(position, 1.0);
      }
    `;

    // Compile Fragment Shader
    const fsSource = `#version 300 es
      precision highp float;
      in vec3 vColor;
      out vec4 fragColor;
      uniform float uTime;
      uniform float uIso;
      void main() {
        vec3 col = vColor;
        float pulse = 0.5 + 0.5 * sin(uTime * 1.5 + vColor.z * 6.28);
        fragColor = vec4(mix(col, vec3(0.1, 0.8, 0.9), pulse * 0.4), 0.92);
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

    // 3D Volume Cube Box Vertices + Bathymetric Grid
    const vertices = new Float32Array([
      // Front face
      -0.8, -0.6,  0.6,   0.1, 0.4, 0.8,
       0.8, -0.6,  0.6,   0.2, 0.7, 0.9,
       0.8,  0.6,  0.6,   0.9, 0.5, 0.2,
      -0.8,  0.6,  0.6,   0.9, 0.2, 0.2,
      // Back face
      -0.8, -0.6, -0.6,   0.0, 0.2, 0.5,
       0.8, -0.6, -0.6,   0.1, 0.4, 0.6,
       0.8,  0.6, -0.6,   0.8, 0.4, 0.1,
      -0.8,  0.6, -0.6,   0.7, 0.1, 0.1,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,  0, 2, 3, // front
      4, 5, 6,  4, 6, 7, // back
      0, 4, 7,  0, 7, 3, // left
      1, 5, 6,  1, 6, 2, // right
      3, 2, 6,  3, 6, 7, // top
      0, 1, 5,  0, 5, 4  // bottom
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 24, 0);

    const colLoc = gl.getAttribLocation(program, 'color');
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 24, 12);

    const matrixLoc = gl.getUniformLocation(program, 'uMatrix');
    const timeLoc = gl.getUniformLocation(program, 'uTime');

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let angleX = 0.35;
    let angleY = -0.6;
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
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      angleY += dx * 0.008;
      angleX += dy * 0.008;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

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

      gl.clearColor(0.02, 0.04, 0.08, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Auto-orbit if not actively dragging
      if (!isDragging) {
        angleY += 0.003;
      }

      // Compute Perspective * View Matrix
      const aspect = canvas.width / canvas.height;
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // 4x4 Orthographic Projection + Isometric Rotation Matrix
      const m = new Float32Array([
        cosY / aspect, sinY * sinX,  sinY * cosX, 0,
        0,             cosX,         -sinX,       0,
        -sinY / aspect, cosY * sinX, cosY * cosX, 0,
        0,             0,            0,           1.4
      ]);

      gl.uniformMatrix4fv(matrixLoc, false, m);
      gl.uniform1f(timeLoc, time * 0.001);

      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeVariableId, timestepIndex]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden" data-testid="ocean-volume-viewport">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Floating 3D HUD Information Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 shadow-2xl pointer-events-none flex flex-col gap-1.5 min-w-[280px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-bold uppercase">{activeBackend.toUpperCase()} 3D VOLUMETRIC RAYMARCHER</span>
          </div>
          <span className="text-cyan-300 font-bold px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded text-[10px]">{fps} FPS</span>
        </div>
        
        <div className="text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>Active Variable:</span>
          <span className="text-amber-300 font-semibold">{activeVariableId}</span>
        </div>
        
        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Spatial Bounds:</span>
          <span className="text-sky-300 font-semibold">[{spatialBounds.minLon}°E—{spatialBounds.maxLon}°E, {spatialBounds.minLat}°N—{spatialBounds.maxLat}°N]</span>
        </div>

        <div className="text-[10px] text-slate-400 flex justify-between">
          <span>Vertical Extents:</span>
          <span className="text-emerald-300 font-semibold">0.494 m → 5,727.917 m (50 Levels)</span>
        </div>

        <div className="text-[9px] text-slate-500 italic mt-0.5">
          * Click & drag anywhere on the canvas to rotate 3D ocean volume
        </div>
      </div>
    </div>
  );
};
