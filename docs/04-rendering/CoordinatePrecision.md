# Coordinate Precision

**File:** `docs/04-rendering/CoordinatePrecision.md`  
**Status:** Normative

## Problem

Global Earth coordinates and small ocean-grid spacing exceed the stable precision of ordinary single-precision world-space rendering when handled naively.

## Coordinate pipeline

    source coordinates
      → geographic coordinates
      → ECEF
      → local ENU relative to ROI origin
      → normalized volume coordinates
      → display coordinates

Scientific values and coordinates remain in canonical precision outside shaders.

## Local origin

Regional scenes shall use a local origin near the ROI center. The render manifest stores:

- Geographic origin.
- ECEF origin.
- ENU basis.
- Volume bounds.
- Normalization transform.
- Vertical exaggeration.

## Camera-relative rendering

Large scene geometry should be rendered relative to the camera or local origin. CPU-side transformations use double precision. GPU shaders use stable local `float32` values.

## High/low splitting

When local coordinates are insufficient, 64-bit positions may be split into high and low 32-bit components:

    position ≈ positionHigh + positionLow

This shall be used only where measurement demonstrates a need.

## Volume coordinates

Sampling uses normalized coordinates in `[0,1]³`. Transformations between normalized volume, physical grid, geographic, and display coordinates shall be explicit and testable.

## Vertical exaggeration

Vertical exaggeration applies only after physical coordinate reconstruction. Picking and exact queries reverse the display transform before requesting canonical values.

## Precision requirements

- Avoid subtracting large nearly equal world coordinates in shaders.
- Do not encode longitude/latitude directly as mesh x/y positions for regional precision-sensitive rendering.
- Preserve double precision for CPU geographic conversion.
- Record rendering-origin changes.
- Rebase only between frames, never during a draw.

## Validation

Test:

- Large and small ROIs.
- Equatorial, polar, and antimeridian regions.
- Shallow layers.
- High vertical exaggeration.
- Camera movement far from origin.
- Round-trip screen-to-geographic picking.
