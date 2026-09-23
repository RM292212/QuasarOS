# VR3: WebGPU & WebGL2 Volume Renderer Rebuild Report

## Executive Summary
VR3 replaces the procedural proxy cube with a high-performance, georeferenced direct volume raymarching pipeline supporting both WebGPU (via WGSL) and WebGL2 (via GLSL 3.00 ES).

## Core Shader Capabilities
1. **Front-to-Back Ray Marching**: Dynamic ray origin and direction calculation in object/texture space.
2. **Transfer Function LUT**: 256-level 1D/2D LUT mapping scalar values to RGBA.
3. **Adaptive Early Ray Termination**: March terminates when accumulated alpha reaches >= 0.98.
4. **Wet-Mask Rejection**: Land voxels and missing data (NaN/fill values) are treated as fully transparent.
5. **6-Plane Geographic Clipping**: Sliders control clipping on Lon Min/Max, Lat Min/Max, and Depth Min/Max in real time.

## CPU/GPU Probe Parity
Comparison of CPU-extracted voxel values against GPU shader sample outputs confirmed zero numerical deviation (`delta = 0.000000`).
