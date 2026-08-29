# VisualRegressionTests.md

## Purpose

Detect unintended changes to application layout, scientific visual encoding, and 3-D scene composition.

## Scope

Capture stable reference images for:

- Application shell and navigation.
- Dataset browser.
- Cesium overview.
- Volume Lab.
- Timeline.
- Transfer-function editor.
- Observation explorer.
- Profile comparison.
- Loading, empty, error, offline, and degraded-renderer states.
- Operational and Outreach modes.
- Responsive breakpoints.
- High-contrast and reduced-motion configurations.
- WebGPU and WebGL 2 reference scenes.

## Deterministic setup

Visual tests use:

- Pinned browser and operating-system images.
- Fixed viewport and device-pixel ratio.
- Bundled fonts.
- Fixed locale and timezone.
- Frozen clock and animation frame.
- Deterministic fixture data.
- Fixed camera, transfer function, quality profile, and sample count.
- Disabled cursor blinking and nonessential transitions.
- Completed or deliberately paused streaming state.

GPU baselines are separated by backend and approved environment when vendor differences are material.

## Comparison policy

Use:

- Exact or near-exact comparison for DOM-based UI.
- Region masks for unavoidable nondeterministic browser chrome or timestamps.
- Tolerant perceptual comparison for 3-D output.
- Semantic and scientific assertions alongside every important visual assertion.

A broad threshold must never hide a local scientific defect. Render tests additionally probe known values, coordinates, masks, and active parameters.

## Baseline updates

Baselines are immutable CI inputs. Updating them requires:

1. A linked intentional design or rendering change.
2. Review of the image diff at full resolution.
3. Confirmation that both supported renderers remain conformant.
4. Scientific review when color mapping, geometry, masking, or data placement changes.
5. Committed baseline and rationale.

CI must never accept new images automatically.

## Failure artifacts

Retain expected, actual, diff, metadata, console log, renderer diagnostics, and scene-state export. The artifact must identify browser, operating system, GPU/backend, viewport, dataset version, and commit.

## Gate

Unreviewed visual changes, missing layers, unreadable labels, layout overlap, incorrect color mapping, brick seams, coordinate displacement, or unexplained backend differences block release.
