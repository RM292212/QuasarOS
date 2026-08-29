# User Roles

**Document:** `docs/01-product/UserRoles.md`  
**Status:** Normative

## 1. Role model

QuasarOceanScope shall use roles to guide workflows, defaults, permissions, terminology, and acceptance testing. Roles describe user needs and do not imply that all deployments require authentication.

## 2. Scientific researcher

### Goals

- Explore three-dimensional ocean structures.
- Compare variables, times, depths, and regions.
- Inspect exact values.
- Compare observations with model output.
- Reproduce and cite analyses.
- Export data subsets and provenance.

### Required capabilities

- Full Scientific Volume Lab.
- Advanced transfer-function and clipping controls.
- Exact canonical inspection.
- Profile extraction.
- Model-observation collocation.
- Scientific metadata and provenance.
- Quality-control policy selection.
- Reproducibility export.
- Access to supported derived quantities.

### Risks

- Mistaking display interpolation for source resolution.
- Comparing incompatible time or vertical coordinates.
- Using visually attractive but scientifically misleading transfer functions.
- Treating quantized rendering values as analytical values.

The interface shall expose relevant warnings and metadata without blocking legitimate research.

## 3. Operational analyst

### Goals

- Rapidly assess current or forecast conditions.
- Compare model fields with recent observations.
- Identify anomalies, fronts, eddies, stratification, or unusual profiles.
- Track data freshness and processing status.

### Required capabilities

- Fast startup and progressive loading.
- Clear reference, valid, observation, and ingestion timestamps.
- Dataset freshness indicators.
- Stable operational presets.
- Observation filters.
- Comparison summaries.
- Error and stale-data warnings.
- Saved or shareable view configuration, subject to deployment policy.

### Restrictions

The product shall not imply official operational authority unless the deployment and dataset are explicitly certified for that purpose.

## 4. Data engineer

### Goals

- Register providers and products.
- Run acquisition and processing.
- Diagnose metadata, coordinate, chunking, or validation problems.
- Monitor storage and product generation.

### Required capabilities

- Source registry access.
- Acquisition logs.
- Checksums and provenance.
- Validation reports.
- Processing job status.
- Dataset publication controls.
- Version and schema visibility.
- Cache and storage diagnostics.

### Permissions

A production deployment should restrict source registration, processing configuration, and publication to authorized users or service accounts.

## 5. Visualization or rendering engineer

### Goals

- Develop and optimize WebGPU and WebGL2 backends.
- Verify renderer parity.
- Analyze GPU memory, frame time, brick residency, and shader behavior.
- Implement new visualization primitives without altering scientific meaning.

### Required capabilities

- Renderer diagnostics.
- Quality-profile controls.
- Brick and page-table debug views.
- GPU capability information.
- Shader variant identification.
- Timing and memory metrics.
- Deterministic benchmark scenes.

## 6. Educator

### Goals

- Explain ocean structure and dynamics.
- Present guided visual stories.
- Use understandable labels and curated controls.
- Avoid overwhelming learners with specialist configuration.

### Required capabilities

- Outreach mode.
- Guided scenes.
- Simplified variable explanations.
- Safe presets.
- Annotation and legend support.
- Reduced terminology without changing scientific values.
- Easy reset to a known view.

## 7. Student

### Goals

- Explore relationships among temperature, salinity, currents, and depth.
- Understand observations versus numerical models.
- Learn how transfer functions and interpolation affect visualization.
- Inspect source and provenance information.

### Required capabilities

- Guided onboarding.
- Definitions of variables and units.
- Accessible profile and comparison charts.
- Reversible interactions.
- Clear differentiation between model, observation, climatology, and derived data.

## 8. Public or outreach user

### Goals

- Explore an intuitive 3-D ocean experience.
- Understand a limited set of curated phenomena.
- Use the application on common devices without specialist training.

### Required capabilities

- Outreach mode.
- Simplified navigation.
- Curated datasets and presets.
- Plain-language explanations.
- Touch-friendly controls.
- Performance-adaptive quality.
- Accessible alternatives to color-only encoding.

### Restrictions

Advanced processing, arbitrary exports, and operational controls may be hidden.

## 9. Administrator

### Goals

- Configure deployment policy.
- Manage users, roles, quotas, secrets, providers, and retention.
- Review security and operational health.
- Control public availability of data products.

### Required capabilities

- Authentication and authorization configuration.
- Audit records.
- Quota and rate-limit configuration.
- Service health and storage monitoring.
- Dataset visibility management.
- Security and licence policy enforcement.

## 10. Automated client

An automated client may use documented APIs to:

- Query catalogs.
- Request metadata.
- Start permitted analyses.
- Retrieve completed results.
- Verify service health.

Automated clients shall be subject to authentication, authorization, pagination, quotas, and rate limits where configured.

## 11. Anonymous and authenticated access

A deployment may support:

- **Anonymous viewer:** read-only access to public catalog entries and visualization products.
- **Authenticated analyst:** analysis jobs, exports, and saved configurations.
- **Data publisher:** ingestion and publication workflows.
- **Administrator:** deployment and policy management.

Authorization shall be enforced by backend services. Hiding a UI control is not authorization.

## 12. Role-to-mode defaults

| Role | Default mode |
|---|---|
| Scientific researcher | Operational |
| Operational analyst | Operational |
| Data engineer | Operational with diagnostics |
| Rendering engineer | Operational with renderer diagnostics |
| Educator | Outreach |
| Student | Outreach or guided operational |
| Public user | Outreach |
| Administrator | Administrative interface |
| Automated client | API only |

Users with permission may switch modes without changing the underlying scientific data.

