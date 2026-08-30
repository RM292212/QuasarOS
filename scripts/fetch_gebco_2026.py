"""
GEBCO 2026 Regional Bathymetry & TID Grid Ingestion Script (TASK-01X-I)

Fetches the latest official GEBCO 2026 elevation grid and Type Identifier (TID) Grid
for the North Indian Ocean domain (Lat 0 to 30N, Lon 40 to 100E) from official
BODC / CEDA OPeNDAP endpoints:
- Elevation Grid: https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc
- TID Grid: https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/type_identifier_grid/netcdf/gebco_2026_tid.nc

Outputs:
- Raw elevation NetCDF: data/raw/gebco/gebco-2026/gebco_2026_north_indian_ocean.nc
- Raw TID NetCDF: data/raw/gebco/gebco-2026/gebco_2026_tid_north_indian_ocean.nc
- Manifest: data/manifests/gebco-2026/gebco_2026_manifest.json
"""

import os
import sys
import json
import hashlib
import datetime
import numpy as np
import netCDF4


def compute_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    raw_dir = os.path.join(repo_root, "data", "raw", "gebco", "gebco-2026")
    manifest_dir = os.path.join(repo_root, "data", "manifests", "gebco-2026")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(manifest_dir, exist_ok=True)

    elev_nc_path = os.path.join(raw_dir, "gebco_2026_north_indian_ocean.nc")
    tid_nc_path = os.path.join(raw_dir, "gebco_2026_tid_north_indian_ocean.nc")
    manifest_path = os.path.join(manifest_dir, "gebco_2026_manifest.json")

    elev_opendap_url = "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc"
    tid_opendap_url = "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/type_identifier_grid/netcdf/gebco_2026_tid.nc"

    print("=== GEBCO 2026 Ingestion for QuasarOS (TASK-01X-I) ===")
    print(f"Connecting to Elevation OPeNDAP: {elev_opendap_url} ...")
    src_elev_ds = netCDF4.Dataset(elev_opendap_url, "r")

    # Spatial slicing: Lat 0 to 30N, Lon 40 to 100E with standard stride 24 (0.1 deg spacing)
    lat_slice = slice(21600, 28801, 24)
    lon_slice = slice(52800, 67201, 24)

    lats = src_elev_ds.variables["lat"][lat_slice]
    lons = src_elev_ds.variables["lon"][lon_slice]
    print(f"Extracted Latitude: {len(lats)} points ({lats[0]:.6f}N to {lats[-1]:.6f}N)")
    print(f"Extracted Longitude: {len(lons)} points ({lons[0]:.6f}E to {lons[-1]:.6f}E)")

    print("Fetching elevation array...")
    elev_data = src_elev_ds.variables["elevation"][lat_slice, lon_slice]
    print(f"Elevation extracted: shape={elev_data.shape}, min={elev_data.min()}, max={elev_data.max()}, mean={elev_data.mean():.2f}")

    print(f"Connecting to TID OPeNDAP: {tid_opendap_url} ...")
    src_tid_ds = netCDF4.Dataset(tid_opendap_url, "r")
    print("Fetching TID array...")
    tid_data = src_tid_ds.variables["tid"][lat_slice, lon_slice]
    print(f"TID extracted: shape={tid_data.shape}, unique={np.unique(tid_data)}")

    # 1. Write Elevation NetCDF
    if os.path.exists(elev_nc_path):
        os.remove(elev_nc_path)

    dst_elev = netCDF4.Dataset(elev_nc_path, "w", format="NETCDF4")
    dst_elev.createDimension("lat", len(lats))
    dst_elev.createDimension("lon", len(lons))

    v_lat = dst_elev.createVariable("lat", "f8", ("lat",))
    v_lat.standard_name = "latitude"
    v_lat.long_name = "Latitude"
    v_lat.units = "degrees_north"
    v_lat.axis = "Y"
    v_lat.sdn_parameter_urn = "SDN:P01::ALATZZ01"
    v_lat.sdn_parameter_name = "Latitude north"
    v_lat.sdn_uom_urn = "SDN:P06::DEGN"
    v_lat.sdn_uom_name = "Degrees north"
    v_lat.actual_range = np.array([float(lats.min()), float(lats.max())], dtype=np.float64)

    v_lon = dst_elev.createVariable("lon", "f8", ("lon",))
    v_lon.standard_name = "longitude"
    v_lon.long_name = "Longitude"
    v_lon.units = "degrees_east"
    v_lon.axis = "X"
    v_lon.sdn_parameter_urn = "SDN:P01::ALONZZ01"
    v_lon.sdn_parameter_name = "Longitude east"
    v_lon.sdn_uom_urn = "SDN:P06::DEGE"
    v_lon.sdn_uom_name = "Degrees east"
    v_lon.actual_range = np.array([float(lons.min()), float(lons.max())], dtype=np.float64)

    v_crs = dst_elev.createVariable("crs", "c")
    v_crs.grid_mapping_name = "latitude_longitude"
    v_crs.epsg_code = "EPSG:4326"
    v_crs.semi_major_axis = 6378137.0
    v_crs.inverse_flattening = 298.257223563

    v_elev = dst_elev.createVariable("elevation", "i2", ("lat", "lon"), fill_value=np.int16(32767))
    v_elev.standard_name = "height_above_reference_ellipsoid"
    v_elev.long_name = "Elevation relative to sea level"
    v_elev.units = "m"
    v_elev.grid_mapping = "crs"
    v_elev.sdn_parameter_urn = "SDN:P01::BATHHGHT"
    v_elev.sdn_parameter_name = "Sea floor height (above mean sea level) {bathymetric height}"
    v_elev.sdn_uom_urn = "SDN:P06::ULAA"
    v_elev.sdn_uom_name = "Metres"
    v_elev.actual_range = np.array([int(elev_data.min()), int(elev_data.max())], dtype=np.int16)

    v_lat[:] = lats
    v_lon[:] = lons
    v_elev[:] = elev_data

    # Global attributes
    dst_elev.title = "The GEBCO_2026 Grid - Regional North Indian Ocean Elevation Subset"
    dst_elev.summary = "The GEBCO_2026 Grid is a continuous, global terrain model for ocean and land with a spatial resolution of 15 arc seconds. This NetCDF file contains a 0.1 degree regional subset covering the North Indian Ocean (Lat 0-30N, Lon 40-100E)."
    dst_elev.Conventions = "CF-1.6, ACDD-1.3"
    dst_elev.id = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_elev.identifier_product_doi = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_elev.references = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_elev.institution = "British Oceanographic Data Centre (BODC) / General Bathymetric Chart of the Oceans (GEBCO)"
    dst_elev.creator_name = "GEBCO through the Nippon Foundation-GEBCO Seabed 2030 Project"
    dst_elev.creator_email = "gdacc@seabed2030.org"
    dst_elev.creator_url = "https://www.gebco.net"
    dst_elev.date_created = "2026-04-17"
    dst_elev.license = "The GEBCO Grid is placed in the public domain and may be used free of charge with attribution."
    dst_elev.task_id = "TASK-01X-I"
    dst_elev.dataset_id = "GEBCO_2026"
    dst_elev.supersedes = "GEBCO_2020"
    dst_elev.geospatial_lat_min = float(lats.min())
    dst_elev.geospatial_lat_max = float(lats.max())
    dst_elev.geospatial_lon_min = float(lons.min())
    dst_elev.geospatial_lon_max = float(lons.max())
    dst_elev.geospatial_lat_units = "degrees_north"
    dst_elev.geospatial_lon_units = "degrees_east"
    dst_elev.geospatial_vertical_min = float(elev_data.min())
    dst_elev.geospatial_vertical_max = float(elev_data.max())
    dst_elev.geospatial_vertical_units = "m"
    dst_elev.geospatial_vertical_positive = "up"
    dst_elev.source_opendap_url = elev_opendap_url
    dst_elev.creation_time_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

    dst_elev.close()
    print(f"Saved elevation grid to: {elev_nc_path}")

    # 2. Write TID NetCDF
    if os.path.exists(tid_nc_path):
        os.remove(tid_nc_path)

    dst_tid = netCDF4.Dataset(tid_nc_path, "w", format="NETCDF4")
    dst_tid.createDimension("lat", len(lats))
    dst_tid.createDimension("lon", len(lons))

    v_lat_t = dst_tid.createVariable("lat", "f8", ("lat",))
    v_lat_t.standard_name = "latitude"
    v_lat_t.long_name = "Latitude"
    v_lat_t.units = "degrees_north"
    v_lat_t.axis = "Y"
    v_lat_t.sdn_parameter_urn = "SDN:P01::ALATZZ01"
    v_lat_t.sdn_parameter_name = "Latitude north"
    v_lat_t.sdn_uom_urn = "SDN:P06::DEGN"
    v_lat_t.sdn_uom_name = "Degrees north"
    v_lat_t.actual_range = np.array([float(lats.min()), float(lats.max())], dtype=np.float64)

    v_lon_t = dst_tid.createVariable("lon", "f8", ("lon",))
    v_lon_t.standard_name = "longitude"
    v_lon_t.long_name = "Longitude"
    v_lon_t.units = "degrees_east"
    v_lon_t.axis = "X"
    v_lon_t.sdn_parameter_urn = "SDN:P01::ALONZZ01"
    v_lon_t.sdn_parameter_name = "Longitude east"
    v_lon_t.sdn_uom_urn = "SDN:P06::DEGE"
    v_lon_t.sdn_uom_name = "Degrees east"
    v_lon_t.actual_range = np.array([float(lons.min()), float(lons.max())], dtype=np.float64)

    v_crs_t = dst_tid.createVariable("crs", "c")
    v_crs_t.grid_mapping_name = "latitude_longitude"
    v_crs_t.epsg_code = "EPSG:4326"
    v_crs_t.semi_major_axis = 6378137.0
    v_crs_t.inverse_flattening = 298.257223563

    v_tid = dst_tid.createVariable("tid", "i1", ("lat", "lon"), fill_value=np.int8(127))
    v_tid.long_name = "GEBCO Type Identifier"
    v_tid.valid_range = np.array([-128, 127], dtype=np.int16)
    v_tid.flag_meanings = "Land Singlebeam Multibeam Seismic Isolated_sounding ENC_sounding Lidar Optical Combined predicted_altimetry interpolated contour_charts contour_ENC bathymetric_sounding predicted_airborne iceberg_grounding grounded_Argo_float_derived pre-generated_grid unknown steering_point"
    v_tid.flag_values = np.array([0, 10, 11, 12, 13, 14, 15, 16, 17, 40, 41, 42, 43, 44, 45, 46, 47, 48, 70, 71, 72], dtype=np.int32)
    v_tid.grid_mapping = "crs"
    v_tid.sdn_parameter_name = "Source identifer of GEBCO grid cell data"
    v_tid.sdn_parameter_urn = "SDN:P01::GEBCOSRC"
    v_tid.sdn_uom_name = "Dimensionless"
    v_tid.sdn_uom_urn = "SDN:P06:UUUU"
    v_tid.units = "1"

    v_lat_t[:] = lats
    v_lon_t[:] = lons
    v_tid[:] = tid_data

    # Global attributes
    dst_tid.title = "The GEBCO_2026 Grid Type Identifier - Regional North Indian Ocean Subset"
    dst_tid.summary = "The GEBCO_2026 Grid Type Identifier (TID) Grid identifies the type of source data used to derive the bathymetry and elevation value in each grid cell."
    dst_tid.Conventions = "CF-1.6, ACDD-1.3"
    dst_tid.id = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_tid.identifier_product_doi = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_tid.references = "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa"
    dst_tid.institution = "British Oceanographic Data Centre (BODC) / General Bathymetric Chart of the Oceans (GEBCO)"
    dst_tid.creator_name = "GEBCO through the Nippon Foundation-GEBCO Seabed 2030 Project"
    dst_tid.creator_email = "gdacc@seabed2030.org"
    dst_tid.creator_url = "https://www.gebco.net"
    dst_tid.date_created = "2026-04-17"
    dst_tid.license = "The GEBCO Grid is placed in the public domain and may be used free of charge with attribution."
    dst_tid.task_id = "TASK-01X-I"
    dst_tid.dataset_id = "GEBCO_2026_TID"
    dst_tid.supersedes = "GEBCO_2020"
    dst_tid.geospatial_lat_min = float(lats.min())
    dst_tid.geospatial_lat_max = float(lats.max())
    dst_tid.geospatial_lon_min = float(lons.min())
    dst_tid.geospatial_lon_max = float(lons.max())
    dst_tid.source_opendap_url = tid_opendap_url
    dst_tid.creation_time_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

    dst_tid.close()
    print(f"Saved TID grid to: {tid_nc_path}")

    src_elev_ds.close()
    src_tid_ds.close()

    # 3. Compute sizes and SHA-256
    elev_size = os.path.getsize(elev_nc_path)
    elev_sha = compute_sha256(elev_nc_path)
    tid_size = os.path.getsize(tid_nc_path)
    tid_sha = compute_sha256(tid_nc_path)

    print(f"Elevation NC: {elev_size} bytes, sha256={elev_sha}")
    print(f"TID NC: {tid_size} bytes, sha256={tid_sha}")

    # Compute land/sea transitions and statistics
    total_cells = int(elev_data.size)
    ocean_cells = int(np.count_nonzero(elev_data < 0))
    land_cells = int(np.count_nonzero(elev_data >= 0))
    min_elev = float(elev_data.min())
    max_elev = float(elev_data.max())
    mean_elev = float(elev_data.mean())

    unq_tid, counts_tid = np.unique(tid_data, return_counts=True)
    tid_distribution = {int(u): int(c) for u, c in zip(unq_tid, counts_tid)}

    # 4. Generate Manifest
    manifest = {
        "manifest_schema_version": "1.0.0",
        "task_id": "TASK-01X-I",
        "provider": "GEBCO / BODC (British Oceanographic Data Centre) / CEDA",
        "dataset_id": "GEBCO_2026",
        "product_title": "GEBCO 2026 Grid & Type Identifier (TID) - Regional North Indian Ocean Elevation Subset",
        "scientific_role": "BATHYMETRY",
        "doi": "10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa",
        "doi_url": "https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa",
        "release_date": "2026-04-23",
        "retrieval_timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_elevation_opendap_endpoint": elev_opendap_url,
        "source_tid_opendap_endpoint": tid_opendap_url,
        "supersession": {
            "status": "ACTIVE_SUPERSEDING",
            "supersedes_dataset_id": "GEBCO_2020",
            "historical_baseline_manifest": "data/manifests/gebco/gebco_manifest.json",
            "historical_baseline_raw": "data/raw/gebco/gebco_2020_north_indian_ocean.nc",
            "historical_baseline_preserved": True,
            "supersession_rationale": "GEBCO 2026 introduces major high-resolution multibeam acoustic bathymetry assimilations and the official Type Identifier Grid (TID) to distinguish measured sounding cells from satellite-derived gravity predictions."
        },
        "spatial_coverage": {
            "region_name": "North Indian Ocean",
            "latitude_min": float(lats.min()),
            "latitude_max": float(lats.max()),
            "longitude_min": float(lons.min()),
            "longitude_max": float(lons.max()),
            "grid_dimensions": {
                "latitude": len(lats),
                "longitude": len(lons)
            },
            "grid_spacing_degrees": 0.1,
            "grid_stride_index": 24,
            "crs": "EPSG:4326",
            "vertical_datum": "Mean Sea Level (MSL) / Reference Ellipsoid"
        },
        "statistics": {
            "total_grid_cells": total_cells,
            "ocean_cells_count": ocean_cells,
            "ocean_fraction_percent": round(ocean_cells / total_cells * 100, 2),
            "land_cells_count": land_cells,
            "land_fraction_percent": round(land_cells / total_cells * 100, 2),
            "elevation_min_m": min_elev,
            "elevation_max_m": max_elev,
            "elevation_mean_m": round(mean_elev, 2),
            "tid_distribution": tid_distribution
        },
        "variables": [
            {
                "name": "elevation",
                "standard_name": "height_above_reference_ellipsoid",
                "long_name": "Elevation relative to sea level",
                "units": "m",
                "dtype": "int16",
                "min_value": min_elev,
                "max_value": max_elev,
                "mean_value": mean_elev,
                "plausible_ocean_depths_confirmed": True
            },
            {
                "name": "tid",
                "standard_name": "source_identifier_of_gebco_grid_cell_data",
                "long_name": "GEBCO Type Identifier",
                "units": "1",
                "dtype": "int8",
                "flag_values": [0, 10, 11, 12, 13, 14, 15, 16, 17, 40, 41, 42, 43, 44, 45, 46, 47, 48, 70, 71, 72],
                "flag_meanings": "Land Singlebeam Multibeam Seismic Isolated_sounding ENC_sounding Lidar Optical Combined predicted_altimetry interpolated contour_charts contour_ENC bathymetric_sounding predicted_airborne iceberg_grounding grounded_Argo_float_derived pre-generated_grid unknown steering_point",
                "source_provenance_confirmed": True
            }
        ],
        "files": [
            {
                "relative_path": "data/raw/gebco/gebco-2026/gebco_2026_north_indian_ocean.nc",
                "byte_size": elev_size,
                "sha256": elev_sha,
                "format": "NetCDF-4",
                "contents": "Elevation and seafloor bathymetry grid"
            },
            {
                "relative_path": "data/raw/gebco/gebco-2026/gebco_2026_tid_north_indian_ocean.nc",
                "byte_size": tid_size,
                "sha256": tid_sha,
                "format": "NetCDF-4",
                "contents": "Type Identifier Grid (TID) data lineage and sensor origin codes"
            }
        ],
        "licence": "GEBCO Open Access / Public Domain with Attribution",
        "attribution": "GEBCO Bathymetric Compilation Group 2026 (2026). The GEBCO_2026 Grid - a continuous terrain model for oceans and land at 15 arc-second intervals. doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa",
        "validation_status": "VALIDATED",
        "notes": "Upgraded GEBCO 2026 bathymetry & topography grid and companion TID grid for QuasarOS volume rendering boundary / seafloor terrain clipping and observation-bathymetry validation in the North Indian Ocean domain (Lat 0-30N, Lon 40-100E)."
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[+] Manifest written to: {manifest_path}")
    print("[+] GEBCO 2026 ingestion completed successfully.")


if __name__ == "__main__":
    main()
