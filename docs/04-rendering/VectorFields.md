# Vector Fields

**File:** `docs/04-rendering/VectorFields.md`  
**Status:** Normative

## Supported representations

- Arrow glyphs.
- Particles.
- Streamlines.
- Pathlines.
- Stream tubes.
- Magnitude scalar field.
- Surface-current vectors.

V1 requires magnitude plus at least one directional representation.

## Scientific preparation

Before rendering:

1. Identify component variables.
2. Validate units and time.
3. Resolve staggering.
4. Destagger through an approved method if needed.
5. Rotate grid-relative components into a common basis.
6. Preserve vertical-component sign.
7. Generate validity masks.

## Magnitude

Horizontal magnitude:

    speed = sqrt(u² + v²)

Three-dimensional magnitude:

    speed = sqrt(u² + v² + w²)

The active definition shall be shown.

## Particles

WebGPU may use compute-based particle integration. WebGL2 may use transform feedback or CPU workers.

Integration options:

- Euler for lowest quality.
- Midpoint or RK2 as default.
- RK4 only when performance and accuracy justify it.

Particles shall stop or respawn when encountering invalid cells, land, seabed, or domain boundaries.

## Scaling

Visual glyph length and particle trail length are display parameters. They shall not modify reported vector magnitude.

Vertical exaggeration requires a separate display transform so weak vertical velocities are not misrepresented as physically equal to horizontal flow.

## Interpolation

Vector interpolation requires all necessary valid components. Components shall be sampled in a common basis.

## Performance

Use instancing, density limits, screen-space culling, bounded particle buffers, and adaptive updates.

## Validation

Test uniform flow, rotational flow, divergent flow, zero flow, staggered grids, rotated grids, boundaries, missing components, and WebGPU/WebGL2 directional parity.
