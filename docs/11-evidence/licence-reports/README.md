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
