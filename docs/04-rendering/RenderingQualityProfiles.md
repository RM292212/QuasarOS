# Rendering Quality Profiles

**File:** `docs/04-rendering/RenderingQualityProfiles.md`  
**Status:** Normative

## Profiles

### Compatibility

For constrained WebGL2 devices.

- Lower render resolution.
- Coarser target LOD.
- Larger ray step.
- Minimal lighting.
- Reduced particles.
- Conservative memory budget.
- No temporal accumulation if unstable.

### Interactive

Used during camera or control movement.

- Dynamic resolution.
- Larger sampling step.
- Early termination threshold favoring speed.
- Coarse-first bricks.
- Reduced gradients and particles.
- Short temporal history.

### Balanced

Default settled-view profile.

- Native or near-native resolution.
- Moderate sampling.
- Target visible LOD.
- Transfer-function skipping.
- Optional lighting and temporal reconstruction.

### Reference

Used for screenshots and scientific visual comparison.

- Stable full target resolution.
- Small sampling step.
- Strict termination threshold.
- Highest permitted visible LOD.
- High-quality gradients.
- Deterministic validation option.
- No hidden dynamic degradation.

## Capability mapping

A profile resolves to backend-specific values:

- Render scale.
- Base ray step.
- Minimum and maximum adaptive steps.
- Early-termination threshold.
- Target LOD error.
- GPU cache budget.
- Upload budget.
- Gradient mode.
- Particle count.
- Temporal sample count.
- Isosurface quality.

## Adaptation

Automatic adaptation may lower quality under frame-time or memory pressure. It shall:

- Stay within profile limits.
- Avoid oscillation through hysteresis.
- Report active quality.
- Restore quality after stabilization.
- Never alter exact-query values.

## Persistence

User-selected profile may persist locally. Device-specific resolved settings shall not be included as scientific data, but shall be included in rendering reproducibility records.

## Validation

Every supported backend and device class shall have tested profile limits. Unsupported combinations shall reduce quality or reject the feature explicitly.
