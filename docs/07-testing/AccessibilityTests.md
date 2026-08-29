# AccessibilityTests.md

## Purpose

Verify that QuasarOS is usable by people with visual, motor, auditory, and cognitive disabilities and conforms to WCAG 2.2 Level AA.

## Test layers

1. **Static checks**
   - ESLint accessibility rules run on every pull request.
   - Components must use semantic HTML before ARIA.
   - Every form control requires a programmatic label.
   - Interactive elements must expose an accessible name, role, state, and value.

2. **Automated browser checks**
   - Playwright and axe-core scan every major route, modal, panel, and application state.
   - Automated scans must report no critical or serious violations.
   - Known limitations of canvas and WebGL/WebGPU content require manual verification.

3. **Keyboard tests**
   - Every action is reachable without a pointer.
   - Tab order follows visual and semantic order.
   - Focus is visible and never trapped outside an intentional modal.
   - `Escape` closes dismissible overlays.
   - Workspace shortcuts do not override browser or assistive-technology shortcuts.
   - Canvas workspaces provide keyboard alternatives for camera movement, picking, slicing, clipping, and time navigation.

4. **Screen-reader tests**
   - Test with NVDA and Firefox or Chrome on Windows.
   - Test with VoiceOver and Safari on macOS.
   - Verify landmarks, headings, status messages, dialogs, tables, charts, and validation errors.
   - Dynamic loading, renderer fallback, inspection results, and job completion use appropriate live regions without excessive announcements.

5. **Visual accessibility**
   - Normal text contrast is at least 4.5:1.
   - Large text and essential graphical objects meet at least 3:1.
   - Information is not communicated by color alone.
   - UI remains usable at 200% browser zoom and with reflow at a 320 CSS-pixel viewport where applicable.
   - Reduced-motion preferences disable nonessential animation and smooth camera transitions.

## Scientific visualization requirements

- Every transfer function has a textual name, numeric range, units, and accessible control list.
- Color maps must identify whether they are sequential, diverging, cyclic, or categorical.
- Missing, masked, below-detection, and out-of-domain values use distinct labels and non-color cues.
- The 3-D canvas must have an accessible summary describing dataset, variable, time, region, renderer, and active layers.
- Exact picked values must be available in an HTML inspector.
- Charts and profiles provide an accessible table or downloadable equivalent.
- Animation controls provide play state, current time, speed, and frame-step controls.

## Required scenarios

- Application shell and workspace navigation.
- Dataset browser and filters.
- Cesium overview and location selection.
- Volume Lab controls and inspector.
- Timeline and playback.
- Transfer-function editor.
- Observation explorer.
- Profile comparison.
- Error, empty, loading, degraded-renderer, and offline states.
- Authentication and permission-denied states.
- Operational and Outreach modes.

## Evidence and gates

Accessibility reports, screenshots, keyboard recordings, and manual test notes are retained as CI artifacts. A release is blocked by any critical or serious automated violation, inaccessible P0 workflow, keyboard trap, missing focus indicator, or unresolved WCAG 2.2 AA defect.

References:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/quickref/
- https://playwright.dev/docs/accessibility-testing
