# VISUALIZATION-REMEDIATION-02R — Initial Root Cause Assessment

## 1. Executive Diagnosis

The previously displayed central viewport showed a smooth synthetic cuboid because:
1. **Placeholder Canvas Viewport:** The React web application had not wired the hardware 3D volumetric raymarcher to the streaming client pipeline or actual NetCDF/Zarr brick slices, instead rendering a procedural geometric cube.
2. **Missing Backend Volume Data Endpoint:** The browser client was querying mock objects rather than streaming the 3D volume grids dynamically per timestep.
3. **Timeline State Disconnect:** Changing the 7-day timestep updated local state but did not trigger texture replacement in the canvas.
4. **Header Probing Status:** The header component's `/health/ready` check had a mismatch in fallback handling when the server was starting up.
5. **Argo/Erddapy Dependency Incompatibility:** `erddapy` 3.3.0 removed `_quote_string_constraints`, breaking `argopy` 1.4.0. Pinning `erddapy==2.3.0` resolved all Argo fetchers and the xarray backend.

## 2. Root Cause Classification Matrix
- Procedural Shader Gradient: **CONFIRMED (Replaced with Real-Data 3D Volume Engine)**
- Timeline Playback Loop: **CONFIRMED (Fixed active generation and frame invalidation)**
- Argo/erddapy Mismatch: **CONFIRMED (Fixed via erddapy==2.3.0)**
- Probing Status: **CONFIRMED (Fixed health probe state transition)**
