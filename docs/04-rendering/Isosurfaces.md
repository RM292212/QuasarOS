# Isosurfaces

**File:** `docs/04-rendering/Isosurfaces.md`  
**Status:** Normative

## Scope

V1 supports one active isosurface per scalar field. The threshold is expressed in physical units.

## Extraction strategies

### Ray-marched isosurface

Detect threshold crossings during volume ray traversal and refine the first crossing. Preferred for interactive threshold changes.

### Precomputed mesh

Use Marching Cubes or a validated equivalent for export, stable geometry, or WebGL2 performance profiles.

### WebGPU compute extraction

May generate meshes or compact surface representations when limits and performance justify it.

## Crossing detection

A crossing occurs when consecutive valid samples bracket the threshold. Refine using bounded bisection or interpolation. Invalid samples shall not create a crossing.

## Normals

Normals derive from physical-spacing-aware gradients. Brick halos shall prevent visible seams.

## LOD behavior

An isosurface generated from a coarse LOD shall be labelled approximate. LOD transitions should use hysteresis or replacement after finer data are ready.

## Masks and boundaries

Extraction shall respect:

- Land masks.
- Seabed.
- Missing data.
- ROI.
- Depth range.
- Clipping planes.
- Dataset domain.

## Controls

- Threshold.
- Color.
- Opacity.
- Lighting.
- Smoothing mode.
- Quality.
- Optional visible side.

Smoothing shall be disclosed because it changes displayed geometry.

## Mesh generation requirements

Generated meshes record:

- Dataset and variable.
- Time.
- Threshold and units.
- Source LOD.
- Extraction algorithm and version.
- Coordinate transform.
- Mask policy.
- Precision.

## Validation

Use analytical sphere, plane, layered field, masked field, and brick-boundary fixtures. Compare geometry against known surfaces and verify no surface forms across missing regions.
