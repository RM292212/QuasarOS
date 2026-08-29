# Real Data Policy

**File:** `docs/03-science-data/RealDataPolicy.md`  
**Status:** Normative

## Requirement

Product demonstrations, bootstrap workflows, integration tests, scientific validation, benchmarks, and acceptance scenarios shall use pinned subsets of real provider data.

## Approved source classes

- Operational or reanalysis ocean models.
- In-situ observations.
- Climatologies.
- Bathymetry.
- Satellite products.
- Provider-published analysis products.

Sources shall be registered in `DataSources.md` and the dataset registry.

## Bootstrap requirements

Each real-data fixture shall define:

- Provider.
- Product and dataset ID.
- Source endpoint or acquisition query.
- ROI.
- Time range.
- Depth range.
- Variables.
- Licence and attribution.
- Retrieval method.
- Checksum.
- Expected dimensions and units.
- Validation rules.

## Prohibited substitutions

Synthetic or randomly generated data shall not be used to claim:

- Operational readiness.
- Scientific correctness against real products.
- Provider integration.
- Real-world performance.
- Model-observation accuracy.
- Data-source availability.

## Allowed synthetic use

Synthetic data are permitted only for isolated tests such as:

- Constant scalar fields.
- Linear gradients.
- Known spheres.
- Thin layers.
- Missing-data patterns.
- Analytical interpolation.
- Renderer parity.

Such data shall be clearly classified as `TEST_FIXTURE`.

## Source outages

If a provider is unavailable, previously pinned and legally retained source assets may be used. The system shall not silently replace them with generated data.

## Privacy and restrictions

Real observations shall be reviewed for access and privacy constraints. Restricted datasets require authorization and shall not appear in public bootstrap packages.

## Evidence

Acceptance evidence records source identifiers, checksums, retrieval dates, licences, processing versions, and any subset operations.
