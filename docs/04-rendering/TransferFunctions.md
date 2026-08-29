# Transfer Functions

**File:** `docs/04-rendering/TransferFunctions.md`  
**Status:** Normative

## Model

A transfer function maps a physical scalar value to premultiplied RGBA.

It contains:

- Variable registry ID.
- Physical domain.
- Unit.
- Scale mode.
- Ordered color points.
- Ordered opacity points.
- Under-range policy.
- Over-range policy.
- Missing-value policy.
- Reference sampling distance.
- Preset identity and version.

## GPU representation

The default representation is a one-dimensional RGBA texture. Resolution shall be sufficient for the variable range and validated against the control-point definition.

Optional preintegrated transfer functions may use a two-dimensional lookup table for large sampling steps.

## Scale modes

- Linear.
- Logarithmic for strictly valid positive domains.
- Symmetric logarithmic where scientifically approved.
- Discrete categorical mapping for categorical variables.

The scale transformation shall be visible and reproducible.

## Opacity

Opacity is defined relative to a reference step and corrected for actual ray step. Missing values always produce zero opacity unless a dedicated diagnostic mode is active.

## Presets

Presets include:

- Variable compatibility.
- Physical range.
- Units.
- Palette.
- Opacity curve.
- Scientific purpose.
- Version.
- Accessibility notes.

A preset shall not silently clip scientifically relevant values without displaying the active range.

## Visibility metadata

Transfer-function updates generate a scalar-bin visibility mask used by empty-space skipping. This update shall be conservative.

## UI requirements

The editor provides:

- Numeric domain controls.
- Color and opacity control points.
- Unit labels.
- Histogram where available.
- Reset and presets.
- Accessible numeric editing.
- Under/over/missing controls.

## Validation

Test interpolation, endpoints, unit conversion, narrow opacity windows, non-monotonic curves, preintegration, visibility masks, and WebGPU/WebGL2 equivalence.
