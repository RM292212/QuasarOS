# Operational Mode

**Document:** `docs/01-product/OperationalMode.md`  
**Status:** Normative

## 1. Purpose

Operational Mode is the full scientific interface for researchers, analysts, data engineers, and authorized technical users. It prioritizes traceability, precision, control, diagnostics, and model-observation analysis.

Operational Mode does not by itself certify QuasarOceanScope as an official forecasting or safety-of-life system.

## 2. Entry conditions

Operational Mode shall be available when:

- The deployment enables it.
- The user has permission for restricted datasets or actions.
- Required services and data products are available.

Anonymous users may receive read-only Operational Mode for public datasets according to deployment policy.

## 3. Interface scope

Operational Mode shall expose:

- Provider, product, dataset, run, and variable selection.
- Model reference time, forecast period, valid time, and data freshness.
- Region-of-interest tools.
- Full transfer-function controls.
- Slicing and clipping.
- Quality and renderer controls.
- Bathymetry and context layers.
- Vector visualization.
- Observation filtering and QC controls.
- Profile extraction.
- Exact inspection.
- Model-observation collocation.
- Derived quantities.
- Provenance and reproducibility export.
- Authorized data or analysis exports.
- Diagnostic information appropriate to the user’s role.

## 4. Scientific status bar

The application shall continuously display or make immediately accessible:

- Active provider and product.
- Dataset or run.
- Variable and units.
- Valid time.
- Active depth range.
- Renderer backend.
- Current resolution or refinement state.
- QC policy.
- Whether a field is source, normalized, climatological, or derived.
- Stale, incomplete, or failed-data warnings.

## 5. Data freshness

Operational Mode shall distinguish:

- Source production time.
- Retrieval time.
- Ingestion time.
- Processing completion time.
- Latest available valid time.

Freshness states should include:

- Current.
- Delayed.
- Stale.
- Unknown.
- Processing.
- Failed validation.

Freshness thresholds shall be configurable per product because model cycles and observation frequencies differ.

## 6. Dataset selection

Users shall be able to filter by:

- Provider.
- Product.
- Processing level.
- Variable.
- Spatial coverage.
- Temporal coverage.
- Model cycle.
- Forecast or analysis status.
- Observation platform.
- Publication and validation status.

Restricted products shall not be exposed to unauthorized users through either UI or API.

## 7. Time controls

Operational Mode shall expose:

- Model reference time.
- Forecast lead.
- Valid time.
- Observation time window.
- Climatology period.
- Playback direction and rate.
- Step availability.
- Missing or delayed time steps.

The application shall not interpolate across missing time steps unless the user enables a scientifically supported interpolation mode.

## 8. Quality-control controls

Users shall be able to select an approved QC policy, such as:

- Accept only provider-designated good values.
- Accept good and probably-good values.
- Display all values with QC styling.
- Custom authorized policy.

The interface shall:

- Show the active policy.
- Indicate rejected counts.
- Preserve source flags.
- Recompute comparison statistics when the policy changes.
- Prevent unsupported flag mappings from being treated as authoritative.

## 9. Analysis controls

Operational Mode shall support:

- Exact point query.
- Vertical model profile.
- Observation profile inspection.
- Model-observation collocation.
- Residual profile.
- Bias, MAE, and RMSE.
- Climatological anomaly where compatible.
- Export of analysis metadata and values.

Long-running analysis shall expose:

- Queued, running, completed, failed, and cancelled states.
- Progress where meaningful.
- Cancellation.
- Stable result identity.
- Algorithm and input versions.

## 10. Rendering controls

Operational users shall control:

- Transfer-function range and opacity.
- Palette.
- Linear or scientifically valid alternative scaling.
- Depth limits.
- Clipping planes.
- Slice positions.
- Isosurface threshold.
- Lighting mode.
- Current representation and density.
- Vertical exaggeration.
- Interactive and reference quality.
- Resolution and LOD diagnostics where authorized.

A control that changes only appearance shall not mutate canonical data.

## 11. Exactness and approximation

Operational Mode shall explicitly identify:

- Approximate GPU display values.
- Exact canonical query values.
- Interpolated values.
- Derived values.
- LOD or temporal approximation.
- Missing or not-yet-loaded values.

An approximate rendered value shall never be exported as an exact measurement without an explicit approximation marker.

## 12. Diagnostics

Authorized users may access:

- API health.
- Renderer capabilities.
- Frame timing.
- Brick requests and failures.
- CPU and GPU cache use.
- Active shader variant.
- Dataset manifest identity.
- Processing job identity.
- Correlation or request identifiers.

Diagnostic output shall not reveal credentials or sensitive infrastructure information.

## 13. Alerts and warnings

Operational Mode shall display warnings for:

- Stale data.
- Incomplete processing.
- Missing time steps.
- Unit incompatibility.
- Unsupported grid conversion.
- Low-resolution fallback.
- Excessive temporal or spatial collocation separation.
- Insufficient valid comparison pairs.
- Device or context loss.
- Restricted export.
- Unverified derived products.

Warnings shall be persistent when they affect interpretation.

## 14. Saved configurations

Where enabled, users may save:

- Dataset and variable.
- Time-selection policy.
- ROI.
- Layer configuration.
- Transfer function.
- Camera.
- Clipping and slices.
- Observation filters.
- QC policy.
- Analysis settings.

Saved configurations shall reference immutable dataset or processing identities where reproducibility is required. Secrets and temporary signed URLs shall never be stored.

## 15. Auditability

For deployments requiring audit records, the system should record:

- User or service identity.
- Dataset access.
- Analysis-job creation and cancellation.
- Exports.
- Publication changes.
- Administrative actions.

Audit logs shall follow retention and privacy policy.

## 16. Operational-mode release condition

Operational Mode is ready for V1 when a qualified user can complete the entire model-volume, Argo-profile, collocation, exact-inspection, and reproducibility-export workflow without switching to undocumented tools.

