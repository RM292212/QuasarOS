import os
import re

content = """```markdown
# API Reports

This directory stores generated evidence that QuasarOS APIs conform to their published OpenAPI, JSON Schema, authentication, error, pagination, and scientific-response contracts.

## Required reports

Release qualification should provide:

- OpenAPI schema validation report.
- Runtime response conformance report.
- Generated-client consistency report.
- Breaking-change assessment.
- Authentication and authorization test report.
- Error-model conformance report.
- Pagination, filtering, and sorting report.
- Exact-query scientific metadata report.
- Signed-asset access report.

## Naming

Use:

`<release>-<environment>-<suite>-<timestamp>.<extension>`

Example:

`v1.4.0-staging-openapi-conformance-20260829.json`

Timestamps use UTC in `YYYYMMDDTHHMMSSZ` form.

## Required metadata

Every report must identify:

- Release and Git commit.
- API and schema version.
- Environment.
- Test suite and tool version.
- Execution timestamp.
- Result status.
- Passed, failed, skipped, and expected-failure counts.
- Failure details.
- Artifact checksum.
- Related task or release identifier.

## Accepted formats

- Markdown for reviewed summaries.
- JSON for machine-readable results.
- HTML for generated interactive reports.
- JUnit XML for CI ingestion.

## Security

Reports must not contain access tokens, cookies, passwords, unrestricted signed URLs, private connection details, or complete sensitive request payloads. Redaction must occur before publication.

## Retention

Reports used by a production release are retained with the release evidence. Pull-request reports may follow normal CI artifact expiry unless referenced by an incident, accepted exception, or scientific investigation.

## Policy

Generated reports must not be edited to change results. Corrections require a new run or an accompanying signed review note explaining the discrepancy.
```

```markdown
# Benchmarks

This directory stores reproducible performance, scalability, memory, and rendering benchmark evidence.

## Required benchmark groups

- Application bootstrap.
- Catalog and API latency.
- Time to first coarse volume.
- Time to target rendering quality.
- Brick fetch, decode, validation, and upload.
- Frame-time distribution.
- Timeline playback and scrubbing.
- Exact-value and collocation latency.
- Worker throughput.
- Database and object-storage performance.
- CPU, browser, worker, and GPU memory.
- WebGPU and WebGL 2 comparison.
- Cold-cache and warm-cache behavior.

## Naming

Use:

`<release>-<environment>-<benchmark>-<renderer>-<timestamp>.<extension>`

Use `none` as the renderer when the benchmark is not renderer-specific.

## Required metadata

Each result includes:

- Release, commit, and artifact digest.
- Benchmark-suite version.
- Browser and operating system.
- CPU, memory, GPU, and driver.
- Renderer and quality profile.
- Viewport and device-pixel ratio.
- Dataset and product version.
- Network and cache condition.
- Iteration count and warm-up policy.
- Median, p95, p99, minimum, and maximum where applicable.
- Baseline and percentage change.
- Test seed and configuration.

## Baselines

Baselines are reviewed, immutable records. A failing benchmark must not automatically replace its baseline. Baseline updates require an explanation of the intentional change and confirmation that scientific correctness was preserved.

## Large artifacts

Traces and profiles may be stored in approved external artifact storage. Commit only small summaries and manifests to the repository.

## Release gate

A statistically significant regression greater than the approved budget requires investigation. P0 regressions greater than the blocking threshold require remediation or a documented, time-limited exception.
```

```markdown
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
```

```markdown
# Licence Reports

This directory stores software dependency, container package, font, icon, dataset, and scientific-source licence evidence.

## Required reports

- JavaScript dependency licence inventory.
- Python dependency licence inventory.
- Container operating-system package licence inventory.
- Frontend asset, icon, and font inventory.
- Dataset and observation-source licence inventory.
- Third-party notice bundle.
- Incompatible or unknown licence findings.
- Attribution verification report.

## Naming

Use:

`<release>-<scope>-licences-<timestamp>.<extension>`

The directory name uses British spelling, while report fields may preserve the spelling emitted by source tools.

## Required fields

Each inventory entry should include:

- Package, asset, or dataset name.
- Version or product revision.
- Source or canonical URL.
- Licence identifier.
- Copyright notice where required.
- Distribution classification.
- Attribution requirement.
- Modification or source-disclosure obligation.
- Approval state.
- Reviewer and review date.

Use SPDX identifiers when available.

## Dataset requirements

Scientific data entries additionally record:

- Provider.
- Product name and version.
- Retrieval date.
- Redistribution rights.
- Citation.
- Required acknowledgement.
- Access restrictions.
- Derived-product obligations.
- Original source checksum.

## Policy

Unknown, conflicting, or prohibited licences block distribution until reviewed. Automated classification is evidence, not final legal approval.

Reports must not imply that QuasarOS ownership extends to third-party software or scientific data.

## Retention

Licence reports and notices associated with a release are retained for the supported lifetime of that release and according to organizational legal-retention policy.

References:

- https://spdx.dev/
- https://spdx.org/licenses/
```

```markdown
# Release Reports

This directory stores the final evidence bundle for every QuasarOS release candidate and production release.

## Required release report

Each release has one primary Markdown report named:

`<release>-release-report.md`

Supporting machine-readable evidence may use JSON, HTML, XML, CSV, or signed attestations.

## Required sections

1. Release identifier and date.
2. Git commit and artifact digests.
3. Included features, fixes, and tasks.
4. Known limitations.
5. Database schema revision.
6. Infrastructure revision.
7. Feature-flag defaults.
8. Scientific product compatibility.
9. Quality-gate results.
10. Browser and renderer matrix.
11. Scientific-validation summary.
12. Accessibility and security status.
13. Performance and memory comparison.
14. Migration and rollback readiness.
15. Deployment timeline.
16. Canary and post-deployment results.
17. Accepted exceptions.
18. Approvals.

## Evidence links

The report links to:

- API reports.
- Test and coverage reports.
- Browser recordings.
- Benchmark reports.
- Licence reports.
- Scientific-validation reports.
- Security reports.
- Visual-regression reviews.
- Migration evidence.
- SBOM, signatures, and build provenance.
- Operational dashboards or snapshots.

## Approval record

Record the decision and identity of:

- Release manager.
- Engineering owner.
- Product owner.
- Quality owner.
- Scientific owner.
- Security owner where required.
- Platform or operations owner.

## Integrity

Release evidence refers to immutable artifact digests. A report must not identify a mutable image tag as the sole artifact identity.

Changes after approval create a new release candidate and require rerunning affected gates.

## Retention

Production release reports and referenced evidence are retained for the supported lifetime of the release and any longer audit, scientific reproducibility, contractual, or incident requirement.
```

```markdown
# Scientific Validation

This directory stores evidence that QuasarOS preserves the scientific meaning of source data through ingestion, transformation, analysis, querying, and rendering.

## Required validation groups

- Coordinate and longitude handling.
- Vertical-coordinate, depth, height, and pressure semantics.
- Time and calendar handling.
- Variable identity and unit conversion.
- Fill-value, mask, and QC propagation.
- Spatial, vertical, and temporal interpolation.
- Multiresolution aggregation.
- Brick boundaries and halos.
- Exact-value queries.
- Profile extraction.
- Model-observation collocation.
- Derived quantities.
- WebGPU and WebGL 2 scientific parity.
- Frozen real-data reference cases.

## Naming

Use:

`<release>-<dataset-or-suite>-scientific-validation-<timestamp>.<extension>`

## Required metadata

Each report identifies:

- Release, commit, and processor version.
- Dataset, source, and product version.
- Source checksum.
- Variables and canonical units.
- Coordinate and calendar conventions.
- Validation method.
- Independent reference implementation or published reference.
- Absolute and relative tolerances.
- Expected and observed values.
- Pass, failure, or review-required status.
- Scientific reviewer.

## Numerical evidence

Machine-readable comparison tables should contain coordinates, time, vertical position, expected value, observed value, difference, tolerance, units, QC state, and method.

Tolerance changes require scientific rationale and review. A tolerance must not be widened solely to make an unexplained failure pass.

## Rendering evidence

Rendering validation must include numerical probes or analytic reference scenes. Screenshots alone do not establish scientific correctness.

## Failures

Any unexplained sign error, axis reversal, unit mismatch, time mismatch, invalid interpolation, hidden missing value, QC error, or provenance loss blocks release.

## Retention

Scientific-validation evidence is retained with every production release and with every published scientific product version required for reproducibility.
```

```markdown
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
```

```markdown
# Security Reports

This directory stores security assessment, scanning, threat-model, remediation, and release-approval evidence.

## Required report types

- Static application security analysis.
- Dependency vulnerability scan.
- Container and operating-system scan.
- Secret scan.
- Infrastructure policy scan.
- SBOM and provenance verification.
- Dynamic application security assessment.
- API authorization test report.
- Threat-model review.
- Penetration-test summary where required.
- Remediation and risk-acceptance record.

## Naming

Use:

`<release>-<scope>-security-<timestamp>.<extension>`

Sensitive reports may use an opaque evidence identifier rather than a descriptive public filename.

## Required metadata

Each report contains:

- Release and commit.
- Scanned artifact digest.
- Tool and rule-set version.
- Execution environment.
- Scan timestamp.
- Finding identifiers and severities.
- Affected components.
- Exploitability assessment.
- Remediation status.
- Owner and due date.
- Accepted-risk authority and expiry where applicable.

## Handling

Security reports may contain information useful to attackers. Store detailed findings in access-controlled evidence storage. Repository content should contain sanitized summaries and durable references.

Never include:

- Active credentials.
- Full authentication tokens.
- Exploit payloads.
- unrestricted signed URLs.
- Private keys.
- Sensitive production topology beyond approved disclosure.
- Personal information unrelated to the finding.

## Release policy

Unresolved critical or high exploitable findings block release. Medium and lower findings require triage, ownership, and remediation deadlines according to policy.

A risk acceptance must identify impact, compensating controls, approver, and expiry. Risk acceptance does not change the underlying finding result.

## Integrity and retention

Generated reports must not be edited to hide findings. Store the original report checksum. Security evidence follows the organization’s restricted-access and retention policy and may outlive normal CI artifacts.
```

```markdown
# Visual Regressions

This directory stores approved visual baselines, comparison results, diff images, and review records for UI and 3-D rendering.

## Required artifact set

A visual-regression result may contain:

- Expected image.
- Actual image.
- Diff image.
- Comparison metadata.
- Pixel or perceptual-difference metrics.
- Test trace.
- Renderer diagnostics.
- Approval or rejection record.

## Naming

Use a stable scenario identifier:

`<scenario>-<browser>-<renderer>-<viewport>-<theme>.<extension>`

Run-specific outputs additionally include the release or commit and UTC timestamp.

## Baseline dimensions

Baselines are separated when output may legitimately differ by:

- Browser engine.
- Operating system.
- Renderer backend.
- Viewport.
- Device-pixel ratio.
- Theme.
- Reduced-motion or contrast mode.
- Approved physical-GPU environment.

Avoid creating vendor-specific baselines when a shared deterministic baseline is sufficient.

## Required metadata

- Scenario and test identifier.
- Release and commit.
- Browser, operating system, GPU, and driver.
- Renderer and quality profile.
- Viewport and device-pixel ratio.
- Dataset and product version.
- Camera and scene-state identifier.
- Comparison algorithm and threshold.
- Difference result.
- Reviewer and review decision.

## Baseline changes

A baseline update requires:

1. A linked intentional design or renderer change.
2. Full-resolution diff review.
3. Confirmation that scientific probes still pass.
4. Accessibility review when layout, color, focus, or text changes.
5. Rendering and scientific review when geometry, masking, transfer functions, or data placement changes.
6. A committed rationale.

CI must never approve a new baseline automatically.

## Limitations

Visual comparison does not prove scientific correctness. Every scientific reference scene must also verify values, coordinates, masks, transfer-function parameters, and renderer state.

## Storage

Keep stable baselines in the approved versioned baseline store. Large run outputs belong in CI or evidence object storage. Production-release review records are retained with release evidence.
```
"""

mapping = {
    "api reports": "docs/11-evidence/API-reports/README.md",
    "benchmarks": "docs/11-evidence/benchmarks/README.md",
    "browser recordings": "docs/11-evidence/browser-recordings/README.md",
    "licence reports": "docs/11-evidence/licence-reports/README.md",
    "release reports": "docs/11-evidence/release-reports/README.md",
    "scientific validation": "docs/11-evidence/scientific-validation/README.md",
    "screenshots": "docs/11-evidence/screenshots/README.md",
    "security reports": "docs/11-evidence/security-reports/README.md",
    "visual regressions": "docs/11-evidence/visual-regressions/README.md"
}

blocks = re.findall(r"```markdown\r?\n(.*?)\r?\n```", content, re.DOTALL)
print(f"Found {len(blocks)} evidence blocks.")

for b in blocks:
    first_line = b.strip().split("\n")[0].lstrip("#").strip().lower()
    target_rel = mapping.get(first_line)
    if target_rel:
        full_path = os.path.normpath(target_rel)
        parent_dir = os.path.dirname(full_path)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(b.strip() + "\n")
        print(f"[CREATED] {target_rel}")
    else:
        print(f"Warning: No mapping found for header '{first_line}'")
