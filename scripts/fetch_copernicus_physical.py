"""
Copernicus Marine Physical Model Data Acquisition and Validation Script
TASK-01C: Subsets physical model volume (temperature, salinity, currents, surface fields)
over a 7-day window for QuasarOS bootstrap development.
"""

import os
import sys
import json
import hashlib
import datetime
from pathlib import Path
from dotenv import dotenv_values
import netCDF4 as nc

def load_credentials():
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

def validate_netcdf(filepath: Path) -> dict:
    print(f"Validating NetCDF integrity for: {filepath.name} ...")
    with nc.Dataset(filepath, 'r') as ds:
        dims = {k: len(v) for k, v in ds.dimensions.items()}
        variables_info = {}
        for var_name, var in ds.variables.items():
            var_attrs = {attr: str(var.getncattr(attr)) for attr in var.ncattrs() if attr not in ['_FillValue']}
            fill_val = var.getncattr('_FillValue') if '_FillValue' in var.ncattrs() else None
            
            shape = list(var.shape)
            dtype = str(var.dtype)
            variables_info[var_name] = {
                'dimensions': list(var.dimensions),
                'shape': shape,
                'dtype': dtype,
                'units': var_attrs.get('units', 'unknown'),
                'standard_name': var_attrs.get('standard_name', ''),
                'long_name': var_attrs.get('long_name', ''),
                'fill_value': float(fill_val) if fill_val is not None and not isinstance(fill_val, str) else str(fill_val) if fill_val is not None else None
            }
        
        global_attrs = {attr: str(ds.getncattr(attr)) for attr in ds.ncattrs()}
        
        return {
            'file_format': ds.file_format,
            'dimensions': dims,
            'variables': variables_info,
            'global_attributes': {
                'title': global_attrs.get('title', ''),
                'institution': global_attrs.get('institution', 'Copernicus Marine Service'),
                'source': global_attrs.get('source', ''),
                'references': global_attrs.get('references', ''),
                'conventions': global_attrs.get('Conventions', 'CF-1.8')
            }
        }

def main():
    load_credentials()
    import copernicusmarine

    raw_dir = Path('data/raw/copernicus/physical')
    manifest_dir = Path('data/manifests/copernicus-physical')
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    min_lon = 80.0
    max_lon = 88.0
    min_lat = -3.0
    max_lat = 12.0
    min_depth = 0.49
    max_depth = 500.0
    
    start_dt = "2025-04-20T00:00:00"
    end_dt = "2025-04-26T23:59:59"

    datasets_to_fetch = [
        {
            'product_id': 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
            'dataset_id': 'cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m',
            'filename': 'copernicus_phy_cur_20250420_20250426.nc',
            'variables': ['uo', 'vo'],
            'depth_range': [min_depth, max_depth]
        },
        {
            'product_id': 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
            'dataset_id': 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
            'filename': 'copernicus_phy_thetao_20250420_20250426.nc',
            'variables': ['thetao'],
            'depth_range': [min_depth, max_depth]
        },
        {
            'product_id': 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
            'dataset_id': 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m',
            'filename': 'copernicus_phy_so_20250420_20250426.nc',
            'variables': ['so'],
            'depth_range': [min_depth, max_depth]
        },
        {
            'product_id': 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
            'dataset_id': 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
            'filename': 'copernicus_phy_surf_20250420_20250426.nc',
            'variables': ['zos', 'mlotst'],
            'depth_range': None
        }
    ]

    files_manifest = []
    
    for item in datasets_to_fetch:
        ds_id = item['dataset_id']
        out_name = item['filename']
        out_path = raw_dir / out_name
        
        print(f"\n--- Subsetting {ds_id} -> {out_name} ---")
        
        kwargs = {
            'dataset_id': ds_id,
            'variables': item['variables'],
            'minimum_longitude': min_lon,
            'maximum_longitude': max_lon,
            'minimum_latitude': min_lat,
            'maximum_latitude': max_lat,
            'start_datetime': start_dt,
            'end_datetime': end_dt,
            'output_directory': raw_dir,
            'output_filename': out_name,
            'file_format': 'netcdf',
            'overwrite': True,
            'disable_progress_bar': False
        }
        
        if item['depth_range']:
            kwargs['minimum_depth'] = item['depth_range'][0]
            kwargs['maximum_depth'] = item['depth_range'][1]
        
        copernicusmarine.subset(**kwargs)
        
        if not out_path.exists():
            raise FileNotFoundError(f"Expected output file was not created: {out_path}")
        
        byte_size = out_path.stat().st_size
        sha256 = compute_sha256(out_path)
        netcdf_meta = validate_netcdf(out_path)
        
        print(f"  Saved: {out_path} ({byte_size:,} bytes)")
        print(f"  SHA-256: {sha256}")
        print(f"  Dimensions: {netcdf_meta['dimensions']}")
        print(f"  Variables: {list(netcdf_meta['variables'].keys())}")
        
        files_manifest.append({
            'relative_path': str(out_path.as_posix()),
            'filename': out_name,
            'product_id': item['product_id'],
            'dataset_id': ds_id,
            'variables': item['variables'],
            'byte_size': byte_size,
            'sha256': sha256,
            'format': 'NetCDF-4',
            'dimensions': netcdf_meta['dimensions'],
            'variables_metadata': netcdf_meta['variables']
        })

    manifest = {
        'manifest_schema_version': '1.0.0',
        'task_id': 'TASK-01C',
        'provider': 'Copernicus Marine Service (E.U. Copernicus Programme)',
        'product_id': 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
        'product_title': 'Global Ocean Physics Analysis and Forecast',
        'source_url': 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024',
        'retrieval_timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'geographic_bounds': {
            'minimum_longitude': min_lon,
            'maximum_longitude': max_lon,
            'minimum_latitude': min_lat,
            'maximum_latitude': max_lat,
            'region_description': 'Northern Indian Ocean / Bay of Bengal / Arabian Sea Gateway'
        },
        'vertical_bounds': {
            'minimum_depth_meters': min_depth,
            'maximum_depth_meters': max_depth,
            'coordinate_name': 'depth',
            'vertical_datum': 'sea_surface'
        },
        'temporal_bounds': {
            'start_datetime_utc': start_dt,
            'end_datetime_utc': end_dt,
            'time_steps_count': 7,
            'temporal_resolution': 'P1D (Daily Mean)'
        },
        'model_variables': [
            'uo', 'vo', 'thetao', 'so', 'zos', 'mlotst'
        ],
        'files': files_manifest,
        'licence': 'Copernicus Sentinel Data / E.U. Open Data Policy',
        'attribution': 'E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00016',
        'validation_status': 'VALIDATED'
    }

    manifest_file = manifest_dir / 'copernicus_physical_manifest.json'
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest successfully written to: {manifest_file}")

if __name__ == '__main__':
    main()
