# Timeline Design

**File:** `docs/06-design/TimelineDesign.md`  
**Status:** Normative

## Purpose

The timeline communicates time semantics and controls model, observation, climatology, and animation state.

## Display

Show:

- Current valid time.
- Model reference time.
- Forecast lead where applicable.
- Available time steps.
- Observation time window.
- Climatology month or season.
- Missing or unavailable steps.
- Prefetch and loading state.

## Controls

- Previous step.
- Next step.
- Play/pause.
- Playback speed.
- Loop mode.
- Direction.
- Direct time selection.
- Jump to latest.
- Time-window selection for observations.

## Visual encoding

- Available model steps: solid marks.
- Missing steps: gaps or crossed marks.
- Selected step: prominent handle.
- Prefetched step: subtle status.
- Observation times: separate track.
- Climatology: categorical month/season track.

Color shall not be the only indicator.

## Playback behavior

During playback:

- The selected valid time remains readable.
- Coarse data may display first.
- The renderer uses interactive quality.
- Future steps are prefetched within budget.
- Missing steps are skipped only with visible indication.
- Pausing triggers target refinement.

## Time semantics panel

A details popover explains:

- Reference time.
- Valid time.
- Forecast period.
- Observation time.
- Temporal averaging bounds.
- Climatological period.
- Calendar.

## Keyboard

- Left/right: previous/next.
- Home/end: first/last.
- Space: play/pause.
- Up/down: playback speed.
- Numeric or text input: direct time selection.

## Accessibility

Do not announce every playback frame to screen readers. Provide a pause control, current-time text, and an on-demand status summary.

## Restrictions

Temporal interpolation shall not be implied by smooth animation. If interpolation is active, the interpolated state and bracketing times shall be visible.
