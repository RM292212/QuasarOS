# Gradient and Lighting

**File:** `docs/04-rendering/GradientAndLighting.md`  
**Status:** Normative

## Purpose

Gradients and lighting improve structural perception but shall remain optional because they can imply boundaries not directly measured.

## Gradient methods

### On-the-fly central difference

Uses neighboring scalar samples and physical voxel spacing. Appropriate for reference quality when residency and bandwidth permit.

### Precomputed gradient bricks

Generated during processing and stored at full or reduced precision. Requires additional storage and synchronized residency.

### Lower-resolution gradients

Uses a coarser gradient representation for interactive lighting.

## Physical spacing

Gradient computation shall account for anisotropic voxel spacing:

    gx = (f(x+h)-f(x-h)) / (2×dx)
    gy = (f(y+h)-f(y-h)) / (2×dy)
    gz = (f(z+h)-f(z-h)) / (2×dz)

Missing or invalid neighbors shall not create artificial gradients.

## Brick boundaries

Brick halos are required for stable gradients across brick edges. If a neighbor is unavailable, use a conservative one-sided estimate or disable lighting locally.

## Lighting model

The default lighting model may include:

- Ambient contribution.
- Diffuse directional lighting.
- Optional specular contribution.
- Gradient-magnitude modulation.

Lighting shall affect displayed color, not scalar values or opacity classification unless explicitly designed and documented.

## Normal orientation

Normals derive from the scalar gradient. Transfer-function convention shall determine whether the gradient direction is reversed for visual interpretation.

## Controls

- Lighting enabled.
- Gradient quality.
- Light direction.
- Ambient strength.
- Diffuse strength.
- Specular strength.
- Gradient threshold.

## Scientific safeguards

- Provide an unlit mode.
- Label lighting as visual enhancement.
- Avoid shadows suggesting unsupported geometry.
- Do not use noisy gradients for exact feature claims.
- Reset temporal history when lighting configuration changes materially.

## Validation

Test analytical gradients, anisotropic spacing, brick boundaries, masks, constant fields, and parity between WebGPU and WebGL2.
