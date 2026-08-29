# Adaptive Sampling

**File:** `docs/04-rendering/AdaptiveSampling.md`  
**Status:** Normative

## Purpose

Adaptive sampling reduces ray-march cost while preserving scalar boundaries, opacity, thin layers, and scientific interpretability.

## Sampling distance

The base step is defined in physical or normalized volume space and shall account for anisotropic voxel spacing.

Recommended reference:

    base_step = 0.5 × minimum_physical_voxel_spacing

Quality profiles may modify this value.

## Step regimes

- Empty brick: jump directly to the next brick boundary.
- Transfer-function-invisible brick: skip the brick.
- Low variation: `1.5×–4×` base step.
- Normal variation: `1×` base step.
- High gradient or thin feature: `0.5×–1×` base step.
- Interactive camera movement: increase step and optionally lower resolution.
- Settled reference view: restore target sampling.

## Adaptation inputs

- Brick min/max.
- Transfer-function visibility mask.
- Gradient magnitude.
- Current opacity.
- Distance from camera.
- Projected voxel size.
- LOD.
- Clipping and ROI.
- Temporal stability.
- Quality profile.

## Opacity correction

When step length changes, opacity shall be corrected:

    alpha_corrected = 1 - pow(1 - alpha_reference, step / reference_step)

An extinction-based implementation may use:

    alpha = 1 - exp(-sigma × step)

## Jitter

Use blue-noise or interleaved-gradient-noise jitter to reduce coherent banding. Jitter amplitude shall remain below one local step. Temporal accumulation may reduce noise after camera stabilization.

## Safeguards

- Do not skip a brick solely because its average value is transparent.
- Reduce step size near validity-mask boundaries.
- Prevent stepping across thin visible intervals.
- Clamp minimum and maximum steps.
- Reset temporal history after incompatible state changes.
- Reference quality shall provide deterministic non-jittered validation mode.

## Validation

Test constant fields, gradients, thin layers, sharp transfer functions, masked boundaries, varying voxel spacing, and comparison against a high-sample reference image.
