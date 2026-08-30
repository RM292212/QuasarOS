"""
Copernicus Ocean Colour L4 Chlorophyll-a Ingestion & Validation Script
TASK-01D: Subsets daily gap-free multi-sensor L4 surface Chlorophyll-a (4km)
over the North Indian Ocean / Arabian Sea (Lat 0-30N, Lon 40-100E) for a 7-day period.
"""

import os
import sys
import json
import hashlib
import datetime
from pathlib import Path
from dotenv import dotenv_values
import numpy as np
import netCDF4 as nc

def load_credentials():
    """Safely loads Copernicus Marine credentials into os.environ in-memory without printing them."""
    env_path = Path('.env')
    if not env_path.exists():
        raise FileNotFoundError('.env file not found.')
    
    env_vars = dotenv_values(env_path)
    username = env_vars.get('COPERNICUS_MARINE_USERNAME') or env_vars.get('COPERNICUSMARINE_SERVICE_USERNAME')
    password = env_vars.get('COPERNICUS_MARINE_PASSWORD') or env_vars.get('COPERNICUSMARINE_SERVICE_PASSWORD')
    
    if not username or not password:
        raise ValueError('Missing Copernicus Marine credentials in .env file.')
    
    os.environ['COPERNICUSMARINE_SERVICE_USERNAME'] = username
    os.environ['COPERNICUSMARINE_SERVICE_PASSWORD'] = password
    print('Copernicus Marine credentials securely configured in environment.')

def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def validate_ocean_colour_netcdf(filepath: Path) -> dict:
    print(f"Validating NetCDF integrity for: {filepath.name} ...")
    with nc.Dataset(filepath, 'r') as ds:
        dims = {k: len(v) for k, v in ds.dimensions.items()}
        
        # Check required dimensions
        if 'time' not in dims or 'latitude' not in dims or 'longitude' not in dims:
            raise ValueError(f"Required dimensions missing in {filepath.name}: found {list(dims.keys())}")
        
        if dims['time'] != 7:
            raise ValueError(f"Expected 7 time steps, found {dims['time']}")
        
        # Check coordinates
        lat_var = ds.variables['latitude']
        lon_var = ds.variables['longitude']
        time_var = ds.variables['time']
        
        lats = lat_var[:]
        lons = lon_var[:]
        times = time_var[:]
        
        if float(lats.min()) < 0.0 or float(lats.max()) > 30.0:
            raise ValueError(f"Latitude range [{float(lats.min())}, {float(lats.max())}] exceeds [0.0, 30.0]")
        if float(lons.min()) < 40.0 or float(lons.max()) > 100.0:
            raise ValueError(f"Longitude range [{float(lons.min())}, {float(lons.max())}] exceeds [40.0, 100.0]")
        
        if not np.all(np.diff(lats) > 0):
            raise ValueError("Latitudes are not strictly monotonically increasing")
        if not np.all(np.diff(lons) > 0):
            raise ValueError("Longitudes are not strictly monotonically increasing")
        
        # Check Chlorophyll-a variable
        chl_key = 'CHL' if 'CHL' in ds.variables else 'CHLA'
        if chl_key not in ds.variables:
            raise ValueError(f"Chlorophyll-a variable (CHL/CHLA) not found in {filepath.name}")
        
        chl_var = ds.variables[chl_key]
        chl_data = chl_var[:]
        
        if isinstance(chl_data, np.ma.MaskedArray):
            valid_values = chl_data.compressed()
        else:
            valid_values = chl_data[~np.isnan(chl_data)]
            
        if len(valid_values) == 0:
            raise ValueError("No valid Chlorophyll-a observations found (all masked/NaN)")
        
        min_chl = float(valid_values.min())
        max_chl = float(valid_values.max())
        mean_chl = float(valid_values.mean())
        
        if min_chl < 0.0:
            raise ValueError(f"Negative Chlorophyll-a concentration encountered: {min_chl}")
        if max_chl > 1000.0:
            raise ValueError(f"Chlorophyll-a concentration unrealistically high: {max_chl}")
        
        # Extract variables metadata
        variables_info = {}
        for var_name, var in ds.variables.items():
            var_attrs = {attr: str(var.getncattr(attr)) for attr in var.ncattrs() if attr not in ['_FillValue']}
            fill_val = var.getncattr('_FillValue') if '_FillValue' in var.ncattrs() else None
            
            variables_info[var_name] = {
                'dimensions': list(var.dimensions),
                'shape': list(var.shape),
                'dtype': str(var.dtype),
                'units': var_attrs.get('units', ''),
                'standard_name': var_attrs.get('standard_name', ''),
                'long_name': var_attrs.get('long_name', ''),
                'fill_value': float(fill_val) if fill_val is not None and not isinstance(fill_val, str) else str(fill_val) if fill_val is not None else None
            }
        
        global_attrs = {attr: str(ds.getncattr(attr)) for attr in ds.ncattrs()}
        
        stats = {
            'min_value': min_chl,
            'max_value': max_chl,
            'mean_value': mean_chl,
            'total_cells': int(chl_data.size),
            'valid_cells': int(len(valid_values)),
            'non_negative_confirmed': bool((valid_values >= 0).all()),
            'plausible_ocean_range_confirmed': True
        }
        
        return {
            'file_format': ds.file_format,
            'dimensions': dims,
            'variables': variables_info,
            'chl_stats': stats,
            'global_attributes': global_attrs,
            'coordinates': {
                'latitude_min': float(lats.min()),
                'latitude_max': float(lats.max()),
                'latitude_count': len(lats),
                'longitude_min': float(lons.min()),
                'longitude_max': float(lons.max()),
                'longitude_count': len(lons),
                'time_steps': len(times),
                'time_units': str(time_var.units) if 'units' in time_var.ncattrs() else 'days since 1900-01-01',
                'time_values': [float(t) for t in times]
            }
        }

def main():
    load_credentials()
    import copernicusmarine

    raw_dir = Path('data/raw/copernicus/ocean-colour')
    manifest_dir = Path('data/manifests/copernicus-ocean-colour')
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    product_id = 'OCEANCOLOUR_GLO_BGC_L4_NRT_009_102'
    dataset_id = 'cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D'
    out_name = 'copernicus_ocean_colour_chl_l4_7day.nc'
    out_path = raw_dir / out_name

    min_lon = 40.0
    max_lon = 100.0
    min_lat = 0.0
    max_lat = 30.0
    
    start_dt = "2026-08-22T00:00:00"
    end_dt = "2026-08-28T23:59:59"

    print(f"\n--- Subsetting {dataset_id} -> {out_name} ---")
    print(f"  Geographic ROI: Lat [{min_lat}, {max_lat}] N, Lon [{min_lon}, {max_lon}] E")
    print(f"  Temporal bounds: {start_dt} to {end_dt}")

    copernicusmarine.subset(
        dataset_id=dataset_id,
        variables=['CHL'],
        minimum_longitude=min_lon,
        maximum_longitude=max_lon,
        minimum_latitude=min_lat,
        maximum_latitude=max_lat,
        start_datetime=start_dt,
        end_datetime=end_dt,
        output_directory=raw_dir,
        output_filename=out_name,
        file_format='netcdf',
        overwrite=True,
        disable_progress_bar=False
    )

    if not out_path.exists():
        raise FileNotFoundError(f"Expected output file was not created: {out_path}")

    byte_size = out_path.stat().st_size
    sha256_hash = compute_sha256(out_path)
    meta = validate_ocean_colour_netcdf(out_path)

    print(f"  Saved: {out_path} ({byte_size:,} bytes)")
    print(f"  SHA-256: {sha256_hash}")
    print(f"  Dimensions: {meta['dimensions']}")
    print(f"  CHL Stats: Min={meta['chl_stats']['min_value']:.4f} mg/m3, Max={meta['chl_stats']['max_value']:.4f} mg/m3, Mean={meta['chl_stats']['mean_value']:.4f} mg/m3")
    print(f"  Valid Cells: {meta['chl_stats']['valid_cells']:,} / {meta['chl_stats']['total_cells']:,}")

    # Build ISO timestamps for 7 daily steps
    # Copernicus time unit: days since 1900-01-01
    base_date = datetime.date(1900, 1, 1)
    iso_timestamps = [
        (base_date + datetime.timedelta(days=int(t))).isoformat() + "T00:00:00Z"
        for t in meta['coordinates']['time_values']
    ]

    manifest = {
        'manifest_schema_version': '1.0.0',
        'task_id': 'TASK-01D',
        'provider': 'Copernicus Marine Service / ACRI-ST / GlobColour (E.U. Copernicus Programme)',
        'product_id': product_id,
        'dataset_id': dataset_id,
        'product_title': 'Global Ocean Colour Bio-Geo-Chemical L4 Plankton (Chlorophyll-a) Gap-Free Multi-Sensor 4km Daily NRT',
        'scientific_role': 'SATELLITE_SURFACE_CHLOROPHYLL_OBSERVATION',
        'source_url': f'https://data.marine.copernicus.eu/product/{product_id}/description',
        'retrieval_timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'geographic_bounds': {
            'region_description': 'North Indian Ocean / Arabian Sea / Bay of Bengal',
            'minimum_latitude': meta['coordinates']['latitude_min'],
            'maximum_latitude': meta['coordinates']['latitude_max'],
            'latitude_grid_points': meta['coordinates']['latitude_count'],
            'minimum_longitude': meta['coordinates']['longitude_min'],
            'maximum_longitude': meta['coordinates']['longitude_max'],
            'longitude_grid_points': meta['coordinates']['longitude_count'],
            'spatial_resolution_km': 4.0,
            'crs': 'EPSG:4326'
        },
        'vertical_bounds': {
            'vertical_layer': 'sea_surface',
            'depth_m': 0.0,
            'coordinate_name': None,
            'notes': 'Satellite optical observation representing the upper optical penetration layer of the water column (surface field)'
        },
        'temporal_bounds': {
            'start_datetime_utc': f"{iso_timestamps[0]}",
            'end_datetime_utc': f"{iso_timestamps[-1]}",
            'time_steps_count': len(iso_timestamps),
            'temporal_resolution': 'P1D (Daily)',
            'time_units': meta['coordinates']['time_units'],
            'time_values': meta['coordinates']['time_values'],
            'iso_timestamps': iso_timestamps
        },
        'variables': [
            {
                'name': 'CHL',
                'canonical_name': 'chlorophyll_a',
                'standard_name': 'mass_concentration_of_chlorophyll_a_in_sea_water',
                'long_name': 'Chlorophyll-a concentration - Mean of the binned pixels',
                'units': 'milligram m-3',
                'dtype': 'float32',
                'dimensions': ['time', 'latitude', 'longitude'],
                'shape': meta['variables']['CHL']['shape'],
                'min_value_mg_m3': meta['chl_stats']['min_value'],
                'max_value_mg_m3': meta['chl_stats']['max_value'],
                'mean_value_mg_m3': meta['chl_stats']['mean_value'],
                'total_cells': meta['chl_stats']['total_cells'],
                'valid_cells': meta['chl_stats']['valid_cells'],
                'non_negative_confirmed': meta['chl_stats']['non_negative_confirmed'],
                'plausible_ocean_range_confirmed': meta['chl_stats']['plausible_ocean_range_confirmed']
            }
        ],
        'files': [
            {
                'relative_path': 'data/raw/copernicus/ocean-colour/copernicus_ocean_colour_chl_l4_7day.nc',
                'filename': out_name,
                'byte_size': byte_size,
                'sha256': sha256_hash,
                'format': 'NetCDF-4',
                'dimensions': meta['dimensions'],
                'variables_metadata': meta['variables']
            }
        ],
        'licence': 'Copernicus Sentinel Data / E.U. Open Data Policy',
        'attribution': 'E.U. Copernicus Marine Service Information; GlobColour; https://doi.org/10.48670/moi-00281',
        'validation_status': 'VALIDATED',
        'notes': 'Regional 4km daily multi-sensor gap-free L4 surface chlorophyll-a satellite product for QuasarOS surface biological / bio-optical visualization and comparison against BGC-Argo floats in the North Indian Ocean domain (Lat 0-30N, Lon 40-100E, 7-day daily time series).'
    }

    manifest_path = manifest_dir / 'copernicus_ocean_colour_manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest successfully written to: {manifest_path}")

if __name__ == '__main__':
    main()
