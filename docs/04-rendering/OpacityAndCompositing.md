# Opacity and Compositing

**File:** `docs/04-rendering/OpacityAndCompositing.md`  
**Status:** Normative

## Compositing order

Volume samples are composited front-to-back:

    accumulatedColor +=
      (1 - accumulatedAlpha) × sampleColor × sampleAlpha

    accumulatedAlpha +=
      (1 - accumulatedAlpha) × sampleAlpha

The ray terminates when remaining transmittance falls below the quality-profile threshold.

## Step-size correction

Transfer-function opacity is defined relative to a reference step. For step `d`:

    alpha_d = 1 - pow(1 - alpha_reference, d / reference_step)

This prevents brightness and opacity from changing incorrectly when sampling distance changes.

## Premultiplication

Internal compositing should use premultiplied color. Texture and final framebuffer conventions shall be consistent across WebGPU, WebGL2, Babylon.js, and post-processing.

## Invalid samples

Land, below-seabed, source-missing, QC-rejected, and outside-domain samples contribute zero opacity.

## Early termination

Suggested remaining-transmittance thresholds:

- Interactive: `0.01`.
- Balanced: `0.002`.
- Reference: `0.0005`.

Final values are profile-controlled and benchmarked.

## Surface integration

Bathymetry, isosurfaces, observations, and transparent volume layers require explicit depth behavior. Opaque terrain is rendered with depth testing. Transparent overlays use documented ordering or weighted techniques where appropriate.

## Multiple volumes

Multi-volume compositing is deferred from mandatory V1. Future support shall define:

- Sampling alignment.
- Transfer-function interaction.
- Blend semantics.
- Depth ordering.
- Performance limits.
- Scientific interpretation.

## Validation

Compare against CPU reference integration for constant extinction, known layers, varying step sizes, early termination, alpha saturation, masks, and transfer-function extremes.
