# Keyboard Controls

**File:** `docs/06-design/KeyboardControls.md`  
**Status:** Normative

## Global controls

| Key | Action |
|---|---|
| `?` | Open keyboard-help dialog |
| `Ctrl/Cmd + K` | Open global search |
| `1` | Open Ocean Overview |
| `2` | Open Scientific Volume Lab |
| `Esc` | Close transient UI or cancel active interaction |
| `Shift + R` | Reset active workspace view |
| `Space` | Play or pause timeline when timeline context is active |

Single-character shortcuts shall be disabled while typing in an input.

## 3-D viewport controls

When the viewport is focused:

| Key | Action |
|---|---|
| Arrow keys | Orbit camera |
| `Shift + Arrow` | Pan camera |
| `+` / `-` | Zoom |
| `Home` | Fit active volume or ROI |
| `I` | Inspect view-center position |
| `C` | Toggle clipping controls |
| `S` | Toggle active slice |
| `B` | Toggle bathymetry |
| `O` | Toggle observation layer |
| `R` | Reset camera |

Movement increments shall be configurable and reduced when modifiers indicate precision.

## Timeline controls

- Left/right: previous or next step.
- Shift + left/right: jump by larger interval.
- Home/end: first or last available time.
- Space: play/pause.
- Up/down: playback speed.

## Panels

- `Tab` and `Shift+Tab`: normal focus navigation.
- Arrow keys: navigate trees, tabs, and menus according to ARIA patterns.
- Enter/Space: activate.
- Escape: close popover or cancel edit.

## Transfer-function editor

Keyboard users can:

- Add a control point.
- Select previous/next point.
- Move point by small or large increments.
- Edit numeric value, opacity, and color.
- Delete selected point.
- Restore preset.

## Requirements

Shortcuts shall be discoverable, remappable where practical, and shall not conflict with browser or assistive-technology commands. Actions must have visible button alternatives.
