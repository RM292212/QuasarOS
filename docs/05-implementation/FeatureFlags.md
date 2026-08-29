# Feature Flags

**File:** `docs/05-implementation/FeatureFlags.md`  
**Status:** Normative

## Purpose

Feature flags support controlled rollout, backend capability variation, and experimental isolation. They shall not replace versioning, authorization, or scientific validation.

## Flag classes

- `release`: staged product rollout.
- `capability`: enabled only when backend/device supports it.
- `experiment`: temporary controlled evaluation.
- `operations`: emergency disable switch.
- `permission`: presentation derived from server authorization.

## Required metadata

Each flag includes:

- Stable key.
- Description.
- Owner.
- Type.
- Default.
- Environments.
- Creation date.
- Expiration or review date.
- Removal task.
- Scientific impact.
- Telemetry requirement.

## Evaluation

Server-controlled scientific or security-sensitive flags are evaluated server-side. Frontend flags may control presentation only when they cannot grant unauthorized access.

Capability flags consider actual WebGPU/WebGL2 limits, not browser-name checks.

## Examples

- WebGPU backend enabled.
- Temporal accumulation.
- Compute-particle implementation.
- Isosurface extraction.
- BGC variable group.
- Advanced diagnostics.
- Outreach stories.
- Experimental multi-volume mode.

## Rules

- Default safely when flag service is unavailable.
- Do not change units, algorithms, QC, or derivation silently.
- Include relevant flag state in reproducibility records.
- Avoid nested flag combinations without tests.
- Do not permanently retain completed rollout flags.
- Experiments shall not use restricted data without approval.

## Removal

After rollout:

1. Confirm stable behavior.
2. Remove inactive branch.
3. Remove flag configuration.
4. Update tests and documentation.
5. Record the final behavior.

## Testing

CI shall test required flag combinations, defaults, disabled paths, and production-safe fallback behavior.
