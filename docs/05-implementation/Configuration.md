# Configuration

**File:** `docs/05-implementation/Configuration.md`  
**Status:** Normative

## Configuration sources

Precedence from highest to lowest:

1. Runtime environment variables.
2. Mounted deployment configuration.
3. Environment-specific configuration file.
4. Repository defaults.

Secrets shall never appear in committed configuration files.

## Configuration groups

### Application

- Environment.
- Public URL.
- API base URL.
- Build version.
- Default workspace.
- Outreach-mode availability.

### Authentication

- OIDC issuer.
- Client ID.
- Audience.
- Redirect URLs.
- Session and token policy.

### Database and queue

- Connection URLs.
- Pool limits.
- Timeouts.
- Queue names.
- Retry and lease settings.

### Object storage

- Endpoint.
- Region.
- Bucket names.
- Public/CDN base URL.
- Signed-URL lifetime.
- Multipart settings.

### Rendering defaults

- Preferred backend.
- Brick-request concurrency.
- CPU/GPU budgets.
- Default quality profile.
- Upload budget.
- Diagnostics state.

### Scientific processing

- Canonical chunk policy.
- Brick dimensions.
- LOD count.
- Precision.
- Regridding method.
- QC policy.
- Collocation tolerances.

## Validation

Applications shall fail fast when mandatory configuration is missing or contradictory. Configuration schemas shall define types, ranges, defaults, and secret classification.

## Frontend configuration

Only public configuration may be embedded into the browser build or loaded from a public runtime endpoint. Database credentials, provider secrets, signing credentials, and private service URLs are prohibited.

## Environment parity

Development, staging, and production use the same configuration keys. Environment-specific behavior shall not be implemented through untracked source-code branches.

## Change control

Changes affecting scientific outputs, persistent identities, public APIs, rendering products, or security require versioning and migration review.
