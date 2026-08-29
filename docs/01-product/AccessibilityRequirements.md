# Accessibility Requirements

**Document:** `docs/01-product/AccessibilityRequirements.md`  
**Status:** Normative  
**Target:** WCAG 2.2 Level AA where applicable

## 1. Accessibility objective

QuasarOceanScope shall make its essential scientific workflows usable by people with diverse visual, motor, auditory, cognitive, and vestibular needs. A 3-D canvas does not remove the obligation to provide accessible controls, descriptions, values, and alternatives.

## 2. Conformance scope

Accessibility requirements apply to:

- Application shell.
- Navigation.
- Dataset browser.
- Timeline.
- Transfer-function editor.
- Layer controls.
- Inspector.
- Profile and comparison charts.
- Dialogs.
- Notifications.
- Authentication screens.
- Canvas interaction controls.
- Outreach stories.
- Export workflows.
- Documentation required to complete V1 journeys.

## 3. Semantic structure

- **A11Y-SEM-001:** Pages shall have a unique descriptive title.
- **A11Y-SEM-002:** The application shall use appropriate landmarks for header, navigation, main content, complementary panels, and footer or status areas.
- **A11Y-SEM-003:** Heading levels shall be logical and shall not be selected only for visual size.
- **A11Y-SEM-004:** Buttons, links, inputs, tabs, sliders, trees, lists, and dialogs shall use correct native semantics or tested ARIA patterns.
- **A11Y-SEM-005:** Controls shall have accessible names describing their action and current context.
- **A11Y-SEM-006:** Required fields, errors, and help text shall be programmatically associated with controls.

## 4. Keyboard access

- **A11Y-KEY-001:** All essential V1 actions shall be operable without a pointer.
- **A11Y-KEY-002:** Focus order shall follow the visual and logical workflow.
- **A11Y-KEY-003:** Focus shall never become trapped except within an intentional modal dialog.
- **A11Y-KEY-004:** Modal dialogs shall restore focus to the invoking control when closed.
- **A11Y-KEY-005:** Visible focus shall meet contrast and area requirements.
- **A11Y-KEY-006:** Keyboard shortcuts shall be documented and shall avoid common browser or assistive-technology conflicts.
- **A11Y-KEY-007:** Single-character shortcuts shall be disabled, remappable, or active only when the relevant component has focus.
- **A11Y-KEY-008:** Users shall be able to skip repeated navigation and move to the main workspace.
- **A11Y-KEY-009:** Canvas camera controls shall provide keyboard alternatives for orbit, pan, zoom, and reset.
- **A11Y-KEY-010:** Sliders shall support arrow keys, larger increments, and direct numeric input where precision matters.

## 5. Focus management

Focus shall be moved intentionally when:

- A dialog opens.
- A new analysis result becomes the active task.
- An error prevents continuation.
- A route changes substantially.
- A selected observation opens its details.

Focus shall not be moved merely because:

- A brick finishes loading.
- A frame refines.
- A background request completes.
- Time animation advances.

## 6. Color and contrast

- **A11Y-COLOR-001:** Text and essential icons shall meet WCAG AA contrast.
- **A11Y-COLOR-002:** Information shall not be communicated by color alone.
- **A11Y-COLOR-003:** QC state shall use text or symbols in addition to color.
- **A11Y-COLOR-004:** Transfer-function presets shall include color-vision-considerate options.
- **A11Y-COLOR-005:** Users shall be able to identify missing, invalid, selected, and warning states without relying only on hue.
- **A11Y-COLOR-006:** Focus indicators shall remain visible across application backgrounds.
- **A11Y-COLOR-007:** Chart series shall use labels, line styles, markers, or direct annotations in addition to color.

Scientific palettes that cannot meet all interface contrast requirements may be used inside the visualization if:

- The legend is accessible.
- Exact values are available.
- Alternative palettes are offered.
- UI text and controls remain compliant.
- The scientific reason is documented.

## 7. Text and scaling

- **A11Y-TEXT-001:** Interface text shall remain usable at 200% browser zoom.
- **A11Y-TEXT-002:** Essential content shall reflow without requiring two-dimensional page scrolling at the documented narrow viewport, except for intrinsically two-dimensional scientific content.
- **A11Y-TEXT-003:** Text shall not be embedded in images when equivalent HTML text is practical.
- **A11Y-TEXT-004:** Units, timestamps, and variable names shall not be truncated without an accessible way to reveal them.
- **A11Y-TEXT-005:** Plain-language descriptions shall be provided for specialist terms in Outreach Mode.

## 8. Pointer and touch

- **A11Y-PTR-001:** Essential actions shall not depend on path-based or multipoint gestures.
- **A11Y-PTR-002:** Gestures shall have button or keyboard alternatives.
- **A11Y-PTR-003:** Touch targets shall meet the project’s minimum target-size policy.
- **A11Y-PTR-004:** Drag operations such as transfer-function editing shall provide numeric or button-based alternatives.
- **A11Y-PTR-005:** Pointer cancellation shall prevent accidental activation where feasible.
- **A11Y-PTR-006:** Hover-only content shall also be available through focus or activation.

## 9. Motion and animation

- **A11Y-MOTION-001:** The application shall honor `prefers-reduced-motion`.
- **A11Y-MOTION-002:** Reduced-motion mode shall disable or minimize camera fly-throughs, decorative transitions, particle trails, and nonessential interpolation.
- **A11Y-MOTION-003:** Time animation shall provide pause and stop controls.
- **A11Y-MOTION-004:** Automatically moving content shall not begin unexpectedly when it could interfere with comprehension.
- **A11Y-MOTION-005:** No content shall flash at unsafe frequencies.
- **A11Y-MOTION-006:** Canvas interaction shall not require device motion.

## 10. Canvas and 3-D alternatives

The canvas shall have:

- An accessible name.
- A concise description of the active scene.
- Current dataset, variable, time, units, and refinement state in accessible HTML.
- Keyboard-accessible camera controls.
- A reset-view action.
- An inspector that exposes selected values in HTML.
- A tabular or textual alternative for essential selected data.
- Status text when rendering is unavailable.

The system is not required to describe every voxel through accessibility APIs. It is required to expose the scientific state and selected values needed to complete the essential workflows.

## 11. Charts

Profile and comparison charts shall provide:

- Descriptive title.
- Axis names and units.
- Series names.
- Accessible legend.
- Keyboard-accessible series or point exploration where practical.
- Tabular data alternative.
- Download or copy option where authorized.
- Non-color distinction between model, observation, residual, and rejected values.
- A textual summary of comparison metrics.

Tooltips shall be available through keyboard focus, not hover alone.

## 12. Transfer-function editor

The transfer-function editor shall provide:

- Accessible name and instructions.
- Numeric minimum and maximum.
- Numeric editing of control-point position and opacity.
- Keyboard creation, selection, movement, and deletion of control points.
- A textual list of control points.
- Palette name and description.
- Immediate but non-disruptive status updates.
- A reset-to-preset action.

## 13. Timeline

The timeline shall provide:

- Current valid time as text.
- Model reference time and forecast lead where applicable.
- Previous and next step buttons.
- Play and pause.
- Playback-rate control.
- Direct time selection.
- Missing-step indication.
- No reliance on a visually positioned thumb alone.

Time changes during playback shall not flood screen readers. Announcements shall be throttled or provided on demand.

## 14. Notifications and live regions

- Routine brick refinement shall not be announced repeatedly.
- Completion of a user-requested analysis shall be announced.
- Blocking errors shall use an assertive or focused error pattern.
- Non-blocking status changes shall use a polite live region.
- Repeated identical failures shall be consolidated.
- Notifications shall remain available in a status or event panel.

## 15. Forms and validation

- Errors shall identify the field and corrective action.
- Validation shall not rely only on color.
- Previously valid input shall be preserved after recoverable errors.
- Date, time, coordinate, depth, and unit formats shall be documented.
- Numeric inputs shall expose valid ranges and units.

## 16. Cognitive accessibility

The interface shall:

- Use consistent terminology.
- Keep primary controls in stable locations.
- Provide reset and undo where practical.
- Avoid unexplained abbreviations.
- Group advanced controls.
- Use progressive disclosure.
- Explain disabled controls.
- Avoid unnecessary time limits.
- Provide confirmation for destructive actions.
- Retain context when switching workspaces.

## 17. Testing

Accessibility verification shall include:

- Automated scanning.
- Keyboard-only testing.
- Screen-reader testing on at least one supported desktop combination.
- Zoom and reflow testing.
- Contrast verification.
- Reduced-motion testing.
- Touch-target review.
- Manual canvas-alternative review.
- Chart and transfer-function editor review.

Automated tools alone cannot satisfy acceptance.

## 18. Accessibility exceptions

Any exception shall include:

- Affected component and requirement.
- User impact.
- Technical or scientific reason.
- Available alternative.
- Owner.
- Remediation milestone.
- Approval.

Critical V1 workflows shall not be waived without product and accessibility approval.

