# Temporal Rendering

**File:** `docs/04-rendering/TemporalRendering.md`  
**Status:** Normative

## Time-step rendering

Each render frame has one explicit current scientific valid time. Bricks from another time shall not be sampled unless documented temporal interpolation is enabled.

## Time switching

1. Increment time-generation ID.
2. Preserve current frame as fallback if scientifically and visually appropriate.
3. Request coarse bricks for the new time.
4. Replace old content only when coherent new-time coverage is available.
5. Refine visible bricks.
6. Cancel obsolete requests.

The UI shall not label old-time fallback as the newly selected time.

## Prefetch

Prefetch may include:

- Next playback time.
- Previous time for reverse playback.
- Neighboring time around a selected step.
- Commonly visible coarse bricks.

Prefetch obeys network, CPU, and GPU budgets.

## Temporal interpolation

Disabled by default in V1. When enabled later, it requires:

- Compatible variables.
- Compatible grids.
- Valid bracketing times.
- Documented interpolation method.
- Missing-data policy.
- Visible interpolated-state indicator.

## Temporal anti-aliasing

Temporal accumulation may reduce jitter noise. History includes:

- Color.
- Transmittance.
- Depth or hit information.
- Confidence.
- Previous camera transforms.

History is rejected after:

- Dataset or variable change.
- Time change.
- Transfer-function change.
- Clipping change.
- Large camera movement.
- LOD replacement.
- Device/context restoration.
- Significant observation-layer change.

## Playback

During playback, quality may prioritize stable frame cadence and coarse coverage. On pause, the renderer refines toward the selected settled profile.

## Validation

Test time identity, stale request rejection, forward/reverse playback, missing time steps, prefetch limits, history rejection, and no accidental blending of unrelated times.
