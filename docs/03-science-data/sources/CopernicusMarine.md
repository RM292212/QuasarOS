# Copernicus Marine Service Source Specification

## 1. Overview

The **Copernicus Marine Service** (CMEMS), operated by Mercator Ocean International for the European Union's Copernicus Programme, provides authoritative global and regional ocean numerical simulation, analysis, reanalysis, and forecasting products.

In QuasarOceanScope V1, Copernicus Marine serves as the primary physical numerical ocean-model source for 3D/4D scalar and vector fields across the Indian Ocean, Arabian Sea, and Bay of Bengal.

## 2. Product Information

- **Product Identifier:** `GLOBAL_ANALYSISFORECAST_PHY_001_024`
- **Product Title:** Global Ocean Physics Analysis and Forecast
- **Spatial Resolution:** 1/12° (~0.083° regular equirectangular grid, approx. 9 km at equator)
- **Vertical Grid:** 50 standard depth levels (0.49 m to 5727.9 m)
- **Temporal Coverage:** Multi-year daily and hourly analyses and forecasts (2022-06-01 to present)
- **Official DOI / Reference:** https://doi.org/10.48670/moi-00016
- **Source Portal:** https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024

## 3. Physical Datasets & Variables

QuasarOceanScope ingests the following operational datasets from `GLOBAL_ANALYSISFORECAST_PHY_001_024`:

| Dataset Identifier | Variables | Standard Name | Units | Temporal Resolution | Dimensions |
|---|---|---|---|---|---|
| `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m` | `uo`, `vo` | `eastward_sea_water_velocity`, `northward_sea_water_velocity` | m s⁻¹ | P1D (Daily Mean) | `(time, depth, lat, lon)` |
| `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m` | `thetao` | `sea_water_potential_temperature` | °C | P1D (Daily Mean) | `(time, depth, lat, lon)` |
| `cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m` | `so` | `sea_water_salinity` | 1e-3 (PSU) | P1D (Daily Mean) | `(time, depth, lat, lon)` |
| `cmems_mod_glo_phy_anfc_0.083deg_P1D-m` | `zos`, `mlotst` | `sea_surface_height_above_geoid`, `ocean_mixed_layer_thickness_defined_by_sigma_theta` | m | P1D (Daily Mean) | `(time, lat, lon)` |

## 4. V1 Bootstrap Geographic & Temporal Bounds

For rapid, deterministic bootstrap development, testing, and Argo observation collocation (matching INCOIS Argo float `7902250` cycle 12 on 2025-04-23), the following volume is subsetted and pinned:

- **Longitude Range:** `80.0°E` to `88.0°E` (97 grid points at 0.083° step)
- **Latitude Range:** `-3.0°N` to `12.0°N` (181 grid points at 0.083° step)
- **Vertical Depth Range:** `0.49 m` to `500.0 m` (31 discrete vertical depth levels)
- **Temporal Range:** `2025-04-20T00:00:00` to `2025-04-26T23:59:59` (7 daily time steps)
- **Storage Location:** `data/raw/copernicus/physical/`
- **Manifest File:** `data/manifests/copernicus-physical/copernicus_physical_manifest.json`

## 5. Authentication & Access Discipline

1. Credentials are supplied via `.env` (`COPERNICUS_MARINE_USERNAME`, `COPERNICUS_MARINE_PASSWORD` -> `COPERNICUSMARINE_SERVICE_USERNAME`, `COPERNICUSMARINE_SERVICE_PASSWORD`).
2. Credentials are loaded exclusively in-memory and are never logged, printed, or written to manifests.
3. Subsetting is executed using the official `copernicusmarine` Python client.

## 6. Licensing & Attribution

- **Licence:** Copernicus Sentinel Data / E.U. Open Data Policy
- **Mandatory Attribution:** *E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00016*
