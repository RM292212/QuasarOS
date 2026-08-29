# Screenshots

This directory stores reviewed screenshots used as release evidence, documentation support, accessibility evidence, and issue reproduction.

## Screenshot classes

- Application shell.
- Dataset browser.
- Cesium Ocean Overview.
- Babylon Volume Lab.
- Timeline and transfer-function editor.
- Observation explorer.
- Profile comparison.
- Loading, empty, error, and degraded states.
- Operational and Outreach modes.
- Responsive layouts.
- Accessibility and keyboard-focus evidence.
- Renderer fallback and recovery.

## Naming

Use:

`<release>-<browser>-<renderer>-<workspace>-<state>-<timestamp>.png`

Use `dom` or `none` when no 3-D renderer applies.

## Required metadata

Every retained screenshot has an adjacent manifest or an entry in a directory manifest containing:

- Release and commit.
- Browser and operating system.
- Renderer backend.
- Viewport and device-pixel ratio.
- Theme and accessibility preferences.
- Dataset and product version.
- Variable, time, and region.
- Scenario or task identifier.
- Capture timestamp.
- Purpose and review status.

## Capture requirements

- Use deterministic data and state where possible.
- Include the complete relevant UI context.
- Preserve visible units, legends, status, and renderer information.
- Do not crop away error messages needed to interpret the image.
- Use lossless PNG for evidence unless another format is explicitly required.

## Privacy

Remove names, email addresses, tokens, private dataset identifiers, unrestricted signed URLs, local filesystem paths, and unrelated desktop content.

## Limitations

Screenshots are supporting evidence. They do not replace semantic UI assertions, exact-value validation, accessibility testing, or renderer conformance tests.

## Storage

Small reviewed screenshots may be version-controlled. Large collections and transient failure images belong in evidence object storage or CI artifacts with durable manifests.
