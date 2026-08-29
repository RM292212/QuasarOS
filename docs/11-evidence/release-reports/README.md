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
