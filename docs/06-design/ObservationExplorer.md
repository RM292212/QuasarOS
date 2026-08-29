# Observation Explorer

**File:** `docs/06-design/ObservationExplorer.md`  
**Status:** Normative

## Purpose

Observation Explorer supports discovery, filtering, selection, visualization, and scientific inspection of in-situ observations.

## Layout

### Filter region

- Platform type.
- Provider.
- Time window.
- Geographic ROI.
- Variable.
- Data mode.
- QC policy.
- Depth range.

### Results

Results may use:

- Map-linked list.
- Compact table.
- Clustered map markers.
- Profile summary cards.

### Details

Selected observation displays:

- Platform identifier.
- Cycle/profile ID.
- Time.
- Position.
- Data mode.
- Available variables.
- Vertical coverage.
- QC summary.
- Provider and provenance.

## Argo profile view

Tabs:

1. Overview.
2. Temperature.
3. Salinity.
4. T–S diagram where supported.
5. QC.
6. Model comparison.
7. Source metadata.

Charts show pressure or depth increasing downward. Raw and adjusted values are visually distinct and labelled.

## Selection synchronization

Selecting an observation:

- Highlights it in Cesium.
- Highlights it in Volume Lab.
- Opens profile details.
- Centers the camera only on explicit command.
- Makes it available to the comparison workflow.

## QC design

QC states use icon, text, and color. Users can inspect rejected levels without including them in calculations. The active QC policy appears above charts.

## Large result sets

Use server-side spatial filtering, pagination, clustering, and list virtualization. Do not retrieve complete profiles for all visible markers.

## Empty states

Explain whether no results arise from:

- ROI.
- Time window.
- Variable.
- Platform filter.
- QC policy.
- Access restrictions.
- Provider outage.

## Actions

- Open in Overview.
- Open in Volume Lab.
- Plot profile.
- Compare with model.
- Copy citation.
- Export permitted values and provenance.
