# Loading and Progress

**File:** `docs/06-design/LoadingAndProgress.md`  
**Status:** Normative

## Loading phases

The interface distinguishes:

1. Application initialization.
2. Authentication.
3. Catalog loading.
4. Manifest loading.
5. Coarse-volume loading.
6. Progressive refinement.
7. Time-step prefetch.
8. Observation loading.
9. Exact-value query.
10. Analysis processing.
11. Export generation.

## Volume status

Use explicit states:

- `Preparing volume`
- `Loading coarse coverage`
- `Interactive coarse view`
- `Refining visible region`
- `Target quality reached`
- `Incomplete data`
- `Loading failed`

The canvas shall remain interactive while noncritical refinement continues.

## Progress types

### Determinate

Use when total work is known, such as brick count or export generation.

### Indeterminate

Use when provider or server progress cannot be measured.

### Progressive-quality indicator

Show current versus target LOD or quality without implying that all off-screen data are loaded.

## Status placement

- Global startup: central shell.
- Layer load: layer-tree row.
- Volume refinement: viewport status badge.
- Exact query: inspector.
- Analysis job: analysis panel.
- Time prefetch: timeline.
- Background events: status center.

## Interaction

Users may:

- Cancel long analysis.
- Pause playback.
- Retry failed requests.
- Continue with coarse data.
- View failure details.
- Hide nonessential progress notifications.

## Accessibility

Progress indicators expose labels, state, and percentage where known. Brick-level changes shall not generate excessive screen-reader announcements.

## Anti-patterns

- Blocking the whole application during refinement.
- Showing 100% before target quality is visible.
- Using an infinite spinner for a failed request.
- Hiding coarse-resolution status.
- Reporting unavailable bricks as loaded.
- Resetting camera when refinement completes.
