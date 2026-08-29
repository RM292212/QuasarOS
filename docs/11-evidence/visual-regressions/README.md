# Visual Regressions

This directory stores approved visual baselines, comparison results, diff images, and review records for UI and 3-D rendering.

## Required artifact set

A visual-regression result may contain:

- Expected image.
- Actual image.
- Diff image.
- Comparison metadata.
- Pixel or perceptual-difference metrics.
- Test trace.
- Renderer diagnostics.
- Approval or rejection record.

## Naming

Use a stable scenario identifier:

`<scenario>-<browser>-<renderer>-<viewport>-<theme>.<extension>`

Run-specific outputs additionally include the release or commit and UTC timestamp.

## Baseline dimensions

Baselines are separated when output may legitimately differ by:

- Browser engine.
- Operating system.
- Renderer backend.
- Viewport.
- Device-pixel ratio.
- Theme.
- Reduced-motion or contrast mode.
- Approved physical-GPU environment.

Avoid creating vendor-specific baselines when a shared deterministic baseline is sufficient.

## Required metadata

- Scenario and test identifier.
- Release and commit.
- Browser, operating system, GPU, and driver.
- Renderer and quality profile.
- Viewport and device-pixel ratio.
- Dataset and product version.
- Camera and scene-state identifier.
- Comparison algorithm and threshold.
- Difference result.
- Reviewer and review decision.

## Baseline changes

A baseline update requires:

1. A linked intentional design or renderer change.
2. Full-resolution diff review.
3. Confirmation that scientific probes still pass.
4. Accessibility review when layout, color, focus, or text changes.
5. Rendering and scientific review when geometry, masking, transfer functions, or data placement changes.
6. A committed rationale.

CI must never approve a new baseline automatically.

## Limitations

Visual comparison does not prove scientific correctness. Every scientific reference scene must also verify values, coordinates, masks, transfer-function parameters, and renderer state.

## Storage

Keep stable baselines in the approved versioned baseline store. Large run outputs belong in CI or evidence object storage. Production-release review records are retained with release evidence.
