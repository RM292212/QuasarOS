# Error and Empty States

**File:** `docs/06-design/ErrorAndEmptyStates.md`  
**Status:** Normative

## Principles

- Explain what happened.
- Explain whether displayed data remain valid.
- Offer a direct recovery action.
- Avoid blank panels and blank canvases.
- Distinguish missing data from system failure.

## Error anatomy

Each error state includes:

- Short title.
- Plain-language explanation.
- Error category.
- Affected dataset, layer, or operation.
- Recommended action.
- Retry where appropriate.
- Request ID for support-relevant errors.
- Technical details disclosure for authorized users.

## Workspace errors

### Renderer unavailable

Explain WebGPU failure, WebGL2 fallback status, browser requirements, and recovery options.

### Brick failure

Continue showing lower-resolution data where possible. Mark the scene incomplete and offer retry.

### Invalid scientific metadata

Do not render guessed data. Identify missing coordinate, unit, grid, or time metadata.

### Access denied

Explain that access is restricted without revealing hidden resource details.

### Analysis failure

Preserve selected profile and settings. Show the failed processing stage and whether parameters can be corrected.

## Empty states

Examples:

- No dataset selected.
- No variable available.
- No observations in ROI/time.
- No valid profile levels after QC.
- No compatible model for comparison.
- No saved views.
- No search results.
- No visible values under the transfer function.

Every empty state shall distinguish user filters from actual data absence.

## Missing-data language

Use specific terms:

- Missing in source.
- Outside domain.
- Land.
- Below seabed.
- Rejected by QC.
- Not yet loaded.
- Temporarily unavailable.

## Notification policy

- Toast: brief successful action.
- Inline message: local recoverable issue.
- Banner: scene-wide warning.
- Modal: destructive or blocking decision.
- Status panel: persistent operational details.

Essential errors shall not disappear automatically.
