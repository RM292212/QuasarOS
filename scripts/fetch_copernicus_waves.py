"""
Copernicus Marine Global Wave Analysis and Forecast Ingestion & Validation Script
TASK-01X-B: Subsets 3-hourly 0.083-deg operational wave product (cmems_mod_glo_wav_anfc_0.083deg_PT3H-i)
over the North Indian Ocean / Arabian Sea (Lat 0-30N, Lon 40-100E) for a 7-day window (2025-04-20 to 2025-04-26).
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

def validate_copernicus_waves_netcdf(filepath: Path) -> dict:
    print(f"Validating NetCDF integrity for: {filepath.name} ...")
    with nc.Dataset(filepath, 'r') as ds:
        dims = {k: len(v) for k, v in ds.dimensions.items()}
        
        # Check required dimensions
        for req_dim in ['time', 'latitude', 'longitude']:
            if req_dim not in dims:
                raise ValueError(f"Required dimension '{req_dim}' missing in {filepath.name}: found {list(dims.keys())}")
        
        if dims['time'] != 56:
            raise ValueError(f"Expected 56 time steps (7 days @ 3-hourly intervals), found {dims['time']}")
        
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
        
        expected_vars = [
            'VHM0', 'VTM02', 'VTPK', 'VMDR', 'VPED', 'VHM0_WW', 'VHM0_SW1', 'VSDX', 'VSDY'
        ]
        
        variables_info = {}
        var_stats = {}
        
        for vname in expected_vars:
            if vname not in ds.variables:
                raise ValueError(f"Required wave variable '{vname}' missing in {filepath.name}")
            
            var = ds.variables[vname]
            arr = var[:]
            if isinstance(arr, np.ma.MaskedArray):
                valid_vals = arr.compressed()
            else:
                valid_vals = arr[~np.isnan(arr)]
            
            if len(valid_vals) == 0:
                raise ValueError(f"No valid observations found for variable '{vname}' (all masked/NaN)")
            
            v_min = float(valid_vals.min())
            v_max = float(valid_vals.max())
            v_mean = float(valid_vals.mean())
            
            # Physical validation checks
            if vname == 'VHM0':
                if v_min < 0.0 or v_max > 25.0:
                    raise ValueError(f"Significant wave height (VHM0) out of physical bounds: [{v_min}, {v_max}] m")
            elif vname in ['VTM02', 'VTPK']:
                if v_min < 0.5 or v_max > 35.0:
                    raise ValueError(f"Wave period ({vname}) out of physical bounds: [{v_min}, {v_max}] s")
            elif vname in ['VMDR', 'VPED']:
                if v_min < 0.0 or v_max > 360.0:
                    raise ValueError(f"Wave direction ({vname}) out of [0, 360] degrees bounds: [{v_min}, {v_max}]")
            elif vname in ['VHM0_WW', 'VHM0_SW1']:
                if v_min < 0.0 or v_max > 25.0:
                    raise ValueError(f"Wind/Swell wave height ({vname}) out of physical bounds: [{v_min}, {v_max}] m")
            elif vname in ['VSDX', 'VSDY']:
                if v_min < -3.0 or v_max > 3.0:
                    raise ValueError(f"Stokes drift velocity ({vname}) out of physical bounds: [{v_min}, {v_max}] m/s")
            
            var_attrs = {attr: str(var.getncattr(attr)) for attr in var.ncattrs() if attr not in ['_FillValue']}
            fill_val = var.getncattr('_FillValue') if '_FillValue' in var.ncattrs() else None
            
            variables_info[vname] = {
                'dimensions': list(var.dimensions),
                'shape': list(var.shape),
                'dtype': str(var.dtype),
                'units': var_attrs.get('units', ''),
                'standard_name': var_attrs.get('standard_name', ''),
                'long_name': var_attrs.get('long_name', ''),
                'fill_value': float(fill_val) if fill_val is not None and not isinstance(fill_val, str) else str(fill_val) if fill_val is not None else None,
                'min_value': v_min,
                'max_value': v_max,
                'mean_value': v_mean,
                'valid_cells': int(len(valid_vals)),
                'total_cells': int(arr.size)
            }
            
            var_stats[vname] = {
                'min': v_min,
                'max': v_max,
                'mean': v_mean,
                'valid_count': len(valid_vals),
                'total_count': int(arr.size)
            }
        
        global_attrs = {attr: str(ds.getncattr(attr)) for attr in ds.ncattrs()}
        
        # Decode time coordinate
        time_units = str(time_var.units) if 'units' in time_var.ncattrs() else 'hours since 1950-01-01'
        calendar = str(time_var.calendar) if 'calendar' in time_var.ncattrs() else 'gregorian'
        date_objs = nc.num2date(times[:], units=time_units, calendar=calendar)
        iso_timestamps = [d.strftime("%Y-%m-%dT%H:%M:%SZ") for d in date_objs]
        
        return {
            'file_format': ds.file_format,
            'dimensions': dims,
            'variables': variables_info,
            'var_stats': var_stats,
            'global_attributes': global_attrs,
            'coordinates': {
                'latitude_min': float(lats.min()),
                'latitude_max': float(lats.max()),
                'latitude_count': len(lats),
                'latitude_step_deg': 0.083333,
                'longitude_min': float(lons.min()),
                'longitude_max': float(lons.max()),
                'longitude_count': len(lons),
                'longitude_step_deg': 0.083333,
                'time_steps': len(times),
                'time_units': time_units,
                'time_calendar': calendar,
                'start_datetime_utc': iso_timestamps[0],
                'end_datetime_utc': iso_timestamps[-1],
                'iso_timestamps': iso_timestamps
            }
        }

def main():
    load_credentials()
    import copernicusmarine

    raw_dir = Path('data/raw/copernicus/waves')
    manifest_dir = Path('data/manifests/copernicus-waves')
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    product_id = 'GLOBAL_ANALYSISFORECAST_WAV_001_027'
    dataset_id = 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i'
    out_name = 'copernicus_waves_20250420_20250426.nc'
    out_path = raw_dir / out_name

    min_lon = 40.0
    max_lon = 100.0
    min_lat = 0.0
    max_lat = 30.0
    
    start_dt = "2025-04-20T00:00:00"
    end_dt = "2025-04-26T23:59:59"

    variables = [
        'VHM0', 'VTM02', 'VTPK', 'VMDR', 'VPED', 'VHM0_WW', 'VHM0_SW1', 'VSDX', 'VSDY'
    ]

    print(f"\n--- Subsetting {dataset_id} -> {out_name} ---")
    print(f"  Geographic ROI: Lat [{min_lat}, {max_lat}] N, Lon [{min_lon}, {max_lon}] E")
    print(f"  Temporal bounds: {start_dt} to {end_dt}")
    print(f"  Target Variables: {variables}")

    if not out_path.exists():
        copernicusmarine.subset(
            dataset_id=dataset_id,
            variables=variables,
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
    meta = validate_copernicus_waves_netcdf(out_path)

    print(f"  Saved: {out_path} ({byte_size:,} bytes)")
    print(f"  SHA-256: {sha256_hash}")
    print(f"  Dimensions: {meta['dimensions']}")
    print(f"  Time Steps: {meta['coordinates']['time_steps']} (from {meta['coordinates']['start_datetime_utc']} to {meta['coordinates']['end_datetime_utc']})")

    variable_descriptors = [
        {
            'name': 'VHM0',
            'canonical_name': 'significant_wave_height',
            'standard_name': 'sea_surface_wave_significant_height',
            'long_name': 'Spectral significant wave height (Hm0)',
            'units': 'm',
            'dtype': meta['variables']['VHM0']['dtype'],
            'dimensions': meta['variables']['VHM0']['dimensions'],
            'shape': meta['variables']['VHM0']['shape'],
            'min_value': meta['variables']['VHM0']['min_value'],
            'max_value': meta['variables']['VHM0']['max_value'],
            'mean_value': meta['variables']['VHM0']['mean_value'],
            'valid_cells': meta['variables']['VHM0']['valid_cells'],
            'total_cells': meta['variables']['VHM0']['total_cells'],
            'description': 'Combined significant wave height of wind sea and all swell wave components.'
        },
        {
            'name': 'VTM02',
            'canonical_name': 'mean_wave_period',
            'standard_name': 'sea_surface_wave_mean_period_from_variance_spectral_density_second_frequency_moment',
            'long_name': 'Spectral moments (0,2) wave period (Tm02)',
            'units': 's',
            'dtype': meta['variables']['VTM02']['dtype'],
            'dimensions': meta['variables']['VTM02']['dimensions'],
            'shape': meta['variables']['VTM02']['shape'],
            'min_value': meta['variables']['VTM02']['min_value'],
            'max_value': meta['variables']['VTM02']['max_value'],
            'mean_value': meta['variables']['VTM02']['mean_value'],
            'valid_cells': meta['variables']['VTM02']['valid_cells'],
            'total_cells': meta['variables']['VTM02']['total_cells'],
            'description': 'Mean zero-crossing wave period computed from spectral variance second moment.'
        },
        {
            'name': 'VTPK',
            'canonical_name': 'peak_wave_period',
            'standard_name': 'sea_surface_wave_period_at_variance_spectral_density_maximum',
            'long_name': 'Wave period at spectral peak / peak period (Tp)',
            'units': 's',
            'dtype': meta['variables']['VTPK']['dtype'],
            'dimensions': meta['variables']['VTPK']['dimensions'],
            'shape': meta['variables']['VTPK']['shape'],
            'min_value': meta['variables']['VTPK']['min_value'],
            'max_value': meta['variables']['VTPK']['max_value'],
            'mean_value': meta['variables']['VTPK']['mean_value'],
            'valid_cells': meta['variables']['VTPK']['valid_cells'],
            'total_cells': meta['variables']['VTPK']['total_cells'],
            'description': 'Wave period corresponding to the frequency bin with highest spectral energy density.'
        },
        {
            'name': 'VMDR',
            'canonical_name': 'mean_wave_direction',
            'standard_name': 'sea_surface_wave_from_direction',
            'long_name': 'Mean wave direction from (Mdir)',
            'units': 'degree',
            'dtype': meta['variables']['VMDR']['dtype'],
            'dimensions': meta['variables']['VMDR']['dimensions'],
            'shape': meta['variables']['VMDR']['shape'],
            'min_value': meta['variables']['VMDR']['min_value'],
            'max_value': meta['variables']['VMDR']['max_value'],
            'mean_value': meta['variables']['VMDR']['mean_value'],
            'valid_cells': meta['variables']['VMDR']['valid_cells'],
            'total_cells': meta['variables']['VMDR']['total_cells'],
            'direction_convention': 'direction_from (0=North, 90=East, 180=South, 270=West; meteorological coming-from convention)',
            'description': 'Mean direction of wave propagation integrated across all frequency and directional bins.'
        },
        {
            'name': 'VPED',
            'canonical_name': 'peak_wave_direction',
            'standard_name': 'sea_surface_wave_from_direction_at_variance_spectral_density_maximum',
            'long_name': 'Wave principal direction at spectral peak',
            'units': 'degree',
            'dtype': meta['variables']['VPED']['dtype'],
            'dimensions': meta['variables']['VPED']['dimensions'],
            'shape': meta['variables']['VPED']['shape'],
            'min_value': meta['variables']['VPED']['min_value'],
            'max_value': meta['variables']['VPED']['max_value'],
            'mean_value': meta['variables']['VPED']['mean_value'],
            'valid_cells': meta['variables']['VPED']['valid_cells'],
            'total_cells': meta['variables']['VPED']['total_cells'],
            'direction_convention': 'direction_from (0=North, 90=East, 180=South, 270=West; meteorological coming-from convention)',
            'description': 'Principal direction of propagation associated with the dominant spectral peak.'
        },
        {
            'name': 'VHM0_WW',
            'canonical_name': 'wind_wave_height',
            'standard_name': 'sea_surface_wind_wave_significant_height',
            'long_name': 'Spectral significant wind wave height',
            'units': 'm',
            'dtype': meta['variables']['VHM0_WW']['dtype'],
            'dimensions': meta['variables']['VHM0_WW']['dimensions'],
            'shape': meta['variables']['VHM0_WW']['shape'],
            'min_value': meta['variables']['VHM0_WW']['min_value'],
            'max_value': meta['variables']['VHM0_WW']['max_value'],
            'mean_value': meta['variables']['VHM0_WW']['mean_value'],
            'valid_cells': meta['variables']['VHM0_WW']['valid_cells'],
            'total_cells': meta['variables']['VHM0_WW']['total_cells'],
            'description': 'Significant wave height partition generated directly by local wind forcing.'
        },
        {
            'name': 'VHM0_SW1',
            'canonical_name': 'swell_wave_height',
            'standard_name': 'sea_surface_primary_swell_wave_significant_height',
            'long_name': 'Spectral significant primary swell wave height',
            'units': 'm',
            'dtype': meta['variables']['VHM0_SW1']['dtype'],
            'dimensions': meta['variables']['VHM0_SW1']['dimensions'],
            'shape': meta['variables']['VHM0_SW1']['shape'],
            'min_value': meta['variables']['VHM0_SW1']['min_value'],
            'max_value': meta['variables']['VHM0_SW1']['max_value'],
            'mean_value': meta['variables']['VHM0_SW1']['mean_value'],
            'valid_cells': meta['variables']['VHM0_SW1']['valid_cells'],
            'total_cells': meta['variables']['VHM0_SW1']['total_cells'],
            'description': 'Significant wave height partition of primary (most energetic) non-local swell system.'
        },
        {
            'name': 'VSDX',
            'canonical_name': 'stokes_drift_u',
            'standard_name': 'sea_surface_wave_stokes_drift_x_velocity',
            'long_name': 'Stokes drift U',
            'units': 'm s-1',
            'dtype': meta['variables']['VSDX']['dtype'],
            'dimensions': meta['variables']['VSDX']['dimensions'],
            'shape': meta['variables']['VSDX']['shape'],
            'min_value': meta['variables']['VSDX']['min_value'],
            'max_value': meta['variables']['VSDX']['max_value'],
            'mean_value': meta['variables']['VSDX']['mean_value'],
            'valid_cells': meta['variables']['VSDX']['valid_cells'],
            'total_cells': meta['variables']['VSDX']['total_cells'],
            'description': 'Eastward (x-component) sea-surface Stokes drift velocity from wave orbital motion.'
        },
        {
            'name': 'VSDY',
            'canonical_name': 'stokes_drift_v',
            'standard_name': 'sea_surface_wave_stokes_drift_y_velocity',
            'long_name': 'Stokes drift V',
            'units': 'm s-1',
            'dtype': meta['variables']['VSDY']['dtype'],
            'dimensions': meta['variables']['VSDY']['dimensions'],
            'shape': meta['variables']['VSDY']['shape'],
            'min_value': meta['variables']['VSDY']['min_value'],
            'max_value': meta['variables']['VSDY']['max_value'],
            'mean_value': meta['variables']['VSDY']['mean_value'],
            'valid_cells': meta['variables']['VSDY']['valid_cells'],
            'total_cells': meta['variables']['VSDY']['total_cells'],
            'description': 'Northward (y-component) sea-surface Stokes drift velocity from wave orbital motion.'
        }
    ]

    manifest = {
        'manifest_schema_version': '1.0.0',
        'task_id': 'TASK-01X-B',
        'provider': 'Copernicus Marine Service / Meteo-France (E.U. Copernicus Programme)',
        'product_id': product_id,
        'dataset_id': dataset_id,
        'product_title': 'Global Ocean Waves Analysis and Forecast (0.083 deg, 3-hourly)',
        'scientific_role': 'PRIMARY_OPERATIONAL_WAVE_PRODUCT',
        'source_url': f'https://data.marine.copernicus.eu/product/{product_id}/description',
        'retrieval_timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'geographic_bounds': {
            'region_description': 'North Indian Ocean / Arabian Sea / Bay of Bengal',
            'minimum_latitude': meta['coordinates']['latitude_min'],
            'maximum_latitude': meta['coordinates']['latitude_max'],
            'latitude_grid_points': meta['coordinates']['latitude_count'],
            'latitude_resolution_deg': 0.083333,
            'minimum_longitude': meta['coordinates']['longitude_min'],
            'maximum_longitude': meta['coordinates']['longitude_max'],
            'longitude_grid_points': meta['coordinates']['longitude_count'],
            'longitude_resolution_deg': 0.083333,
            'spatial_resolution_deg': 0.083333,
            'crs': 'EPSG:4326'
        },
        'vertical_bounds': {
            'vertical_layer': 'sea_surface',
            'depth_m': 0.0,
            'coordinate_name': None,
            'notes': 'Sea-surface wave parameters (spectral integrated quantities and Stokes drift surface velocities)'
        },
        'temporal_bounds': {
            'start_datetime_utc': meta['coordinates']['start_datetime_utc'],
            'end_datetime_utc': meta['coordinates']['end_datetime_utc'],
            'time_steps_count': meta['coordinates']['time_steps'],
            'temporal_resolution': 'PT3H (3-Hourly Instantaneous)',
            'time_units': meta['coordinates']['time_units'],
            'time_calendar': meta['coordinates']['time_calendar'],
            'iso_timestamps': meta['coordinates']['iso_timestamps']
        },
        'directional_conventions': {
            'wave_direction_convention': 'direction_from (meteorological convention, angle in degrees clockwise from true north where 0=from North, 90=from East, 180=from South, 270=from West)',
            'stokes_drift_convention': 'direction_to (oceanographic velocity vector components eastward/northward in m/s)'
        },
        'variables': variable_descriptors,
        'files': [
            {
                'relative_path': 'data/raw/copernicus/waves/copernicus_waves_20250420_20250426.nc',
                'filename': out_name,
                'byte_size': byte_size,
                'sha256': sha256_hash,
                'format': 'NetCDF-4',
                'dimensions': meta['dimensions'],
                'variables_metadata': meta['variables']
            }
        ],
        'licence': 'Copernicus Sentinel Data / E.U. Open Data Policy',
        'attribution': 'E.U. Copernicus Marine Service Information; Meteo-France; https://doi.org/10.48670/moi-00017',
        'validation_status': 'VALIDATED',
        'notes': 'Primary operational 3-hourly 1/12° (~9km) global wave model analysis and forecast dataset subset over the North Indian Ocean domain (Lat 0-30N, Lon 40-100E) spanning 2025-04-20 to 2025-04-26 (56 time steps). Contains complete spectral wave partition variables (VHM0, VTM02, VTPK, VMDR, VPED, VHM0_WW, VHM0_SW1) and surface Stokes drift components (VSDX, VSDY) for 3D/surface wave visualization, sea-state rendering, and upper-ocean wave-current drift diagnostics in QuasarOS.'
    }

    manifest_path = manifest_dir / 'copernicus_waves_manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest successfully written to: {manifest_path}")

if __name__ == '__main__':
    main()
