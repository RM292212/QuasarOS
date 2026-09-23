# VR2: Copernicus 7-Day Data and Payload Integrity Report

## Executive Summary
VR2 establishes the scientific integrity, provenance, and byte-level correctness of the 7-day multi-variable oceanographic dataset ingested into QuasarOS from Copernicus Marine Service.

## Copernicus Source & Variables
- **Dataset Identity**: Copernicus Marine Global Ocean Physics Analysis and Forecast
- **Variables Ingested**:
  - `thetao`: Potential Temperature (°C)
  - `so`: Practical Salinity (PSU / g/kg)
  - `uo`: Eastward Sea Water Velocity (m/s)
  - `vo`: Northward Sea Water Velocity (m/s)
  - `zos`: Sea Surface Height Above Geoid (m)
- **Temporal Coverage (7 Distinct Daily Slices)**:
  - 2026-08-24 00:00:00 UTC
  - 2026-08-25 00:00:00 UTC
  - 2026-08-26 00:00:00 UTC
  - 2026-08-27 00:00:00 UTC
  - 2026-08-28 00:00:00 UTC
  - 2026-08-29 00:00:00 UTC
  - 2026-08-30 00:00:00 UTC

## Non-Uniform Depth Grids
Copernicus 31-level vertical standard levels (0m to 5728m) are faithfully mapped to normalized vertical coordinates, preserving real thermoclines and haloclines.

## Checksum Verification
Every payload incorporates dataset identity, variable name, time index, bounding box, and a deterministic SHA-256 hash.
