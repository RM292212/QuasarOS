# Browser Recordings

This directory stores browser traces, videos, interaction recordings, console captures, and network diagnostics produced by end-to-end and accessibility testing.

## Supported artifacts

- Playwright traces.
- Browser videos.
- Interaction recordings.
- Console logs.
- Sanitized network archives.
- Accessibility walkthrough recordings.
- Renderer recovery recordings.
- Keyboard-only workflow recordings.
- Device or context-loss demonstrations.

## Naming

Use:

`<release>-<browser>-<renderer>-<scenario>-<timestamp>.<extension>`

Example:

`v1.4.0-chromium-webgpu-volume-inspection-20260829T142500Z.zip`

## Required manifest

Every recording set must include a manifest identifying:

- Release and commit.
- Scenario or test identifier.
- Browser and engine version.
- Operating system.
- GPU and driver where relevant.
- Renderer backend.
- Viewport and device-pixel ratio.
- Dataset and product version.
- Start and end timestamps.
- Pass or failure result.
- Related screenshot, trace, and test report.
- Checksum and storage location.

## Privacy and security

Before retention, remove or redact:

- Access tokens and cookies.
- Authorization headers.
- Passwords.
- Personally identifying account information.
- unrestricted signed URLs.
- Sensitive dataset query parameters.
- Local filesystem paths containing user names.
- Unrelated browser tabs or desktop content.

Production sessions must not be recorded unless an approved incident or support procedure explicitly authorizes it.

## Storage

Large recordings belong in CI or evidence object storage. Repository entries should contain only manifests, small reviewed examples, or durable links.

## Retention

Release qualification recordings are retained with release evidence. Failure recordings may expire after resolution unless required for an incident review, security case, accessibility exception, or scientific investigation.
