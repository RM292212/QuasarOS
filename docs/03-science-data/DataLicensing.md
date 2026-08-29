# Data Licensing

**File:** `docs/03-science-data/DataLicensing.md`  
**Status:** Normative

## Purpose

Every source, canonical product, rendering product, derived product, screenshot, and export shall retain applicable licence and attribution obligations.

## Required licence metadata

Each dataset registry entry shall include:

- Provider.
- Product title and identifier.
- Licence name.
- Licence URL.
- Terms-of-use URL.
- Required attribution text.
- Access class.
- Redistribution permission.
- Derivative-product permission.
- Commercial-use restrictions where applicable.
- Citation.
- Retrieval date.
- Licence-review status.

## Access classes

- `PUBLIC_OPEN`
- `PUBLIC_ATTRIBUTION_REQUIRED`
- `REGISTRATION_REQUIRED`
- `RESTRICTED`
- `INTERNAL`
- `UNKNOWN`

Datasets with `UNKNOWN` licensing shall not be publicly published.

## Derived products

Derived and rendering products shall retain:

- Source provider and product.
- Source licence.
- Transformation description.
- QuasarOS processing version.
- Required source attribution.
- Any additional generated-product licence.

Transformation does not remove upstream licence obligations.

## UI requirements

The application shall expose:

- Provider attribution.
- Product citation.
- Licence link.
- Data-access limitations.
- Source version or retrieval date.

Attribution shall remain available in both Operational and Outreach modes.

## Export requirements

Exports shall include licence and citation metadata. Restricted data shall be exported only when the authenticated user and deployment policy permit it.

## Prohibited behavior

- Removing provider attribution.
- Republishing restricted source files without permission.
- Treating registration-required data as unrestricted.
- Including provider credentials in manifests.
- Assuming that public download means unrestricted redistribution.
- Combining datasets under incompatible terms without review.

## Review process

Before publication:

1. Record source terms.
2. Confirm redistribution and transformation rights.
3. Define attribution placement.
4. Review export behavior.
5. Record reviewer and date.
6. Re-review when provider terms or product versions change.
