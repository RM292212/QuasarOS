# Test Data Policy

**File:** `docs/03-science-data/TestDataPolicy.md`  
**Status:** Normative

## Test-data classes

### Real pinned fixture

A small immutable subset acquired from an approved provider.

### Derived real fixture

A deterministic product generated from a pinned real fixture.

### Synthetic analytical fixture

Generated data with known mathematical behavior.

### Invalid fixture

Intentionally malformed metadata or values used to test rejection paths.

## Usage rules

| Test type | Required data |
|---|---|
| Provider integration | Real pinned fixture |
| Scientific validation | Real pinned plus independent reference |
| End-to-end workflow | Real pinned fixture |
| Performance benchmark | Real pinned fixture |
| Renderer analytical test | Synthetic analytical fixture allowed |
| Error handling | Invalid fixture allowed |
| Unit conversion | Synthetic or reference table |
| Model-observation comparison | Real pinned model and observation |

## Fixture manifest

Every fixture shall declare:

- Fixture ID.
- Classification.
- Source or generation method.
- Licence.
- Checksum.
- Size.
- Variables.
- Coordinates and time.
- Expected results.
- Permitted test uses.
- Retention policy.

## Repository policy

Only small, legally redistributable fixtures may be committed. Larger fixtures shall be downloaded through the bootstrap workflow and verified by checksum.

## Synthetic-data labeling

Synthetic fixtures shall use unmistakable names and metadata. They shall never be published in the normal dataset catalog or shown as real ocean conditions.

## Determinism

Generated fixtures shall use fixed parameters and deterministic generation. Randomized property tests shall record seeds on failure.

## Privacy and security

Fixtures shall not contain credentials, confidential provider content, or unnecessary personal information. Restricted real data remain outside public CI unless an approved secure test environment exists.

## Updates

Changing a fixture’s bytes, source version, expected values, or generation method creates a new fixture version and requires reference-result review.
