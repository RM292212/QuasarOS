# Scientific Validation References

**File:** `docs/03-science-data/ScientificValidationReferences.md`  
**Status:** Normative reference registry

## Metadata and coordinates

### CF Metadata Conventions

- Official site: https://cfconventions.org/
- Current conventions: https://cfconventions.org/cf-conventions/cf-conventions.html
- Standard-name table: https://cfconventions.org/standard-names.html

Use for coordinate identification, standard names, grid mappings, time coordinates, bounds, missing values, and dimensionless vertical coordinates.

## Seawater thermodynamics

### TEOS-10

- Official site: https://www.teos-10.org/
- Manual: https://www.teos-10.org/pubs/TEOS-10_Manual.pdf
- Primer: https://www.teos-10.org/pubs/TEOS-10_Primer.pdf

Use approved GSW implementations for Absolute Salinity, Conservative Temperature, density, sound speed, and related quantities. Archive measured Practical Salinity separately from derived Absolute Salinity.

## Argo

- GDAC access: https://argo.ucsd.edu/data/data-from-gdacs/
- Data-management documentation: https://www.argodatamgt.org/Documentation

Use official Argo user manuals, NetCDF format documentation, and QC manuals for profiles, adjusted values, data modes, error fields, and QC flags.

## World Ocean Atlas

- WOA23: https://www.ncei.noaa.gov/products/world-ocean-atlas
- Product documentation: https://doi.org/10.25923/a78k-gq49

Use WOA as a climatological reference, not a simultaneous observation. Match month, season, or annual compositing period.

## Bathymetry

- GEBCO: https://www.gebco.net/data-products-gridded-bathymetry-data

Use the selected grid release documentation, licence, attribution, elevation convention, and source identifier.

## Copernicus Marine

- Product catalog: https://data.marine.copernicus.eu/products
- Global physics product: https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description

Pin exact dataset IDs and review the corresponding Product User Manual and Quality Information Document.

## Numerical validation

Scientific calculations shall be compared against:

- Official library examples.
- Provider documentation.
- Independently implemented reference calculations.
- Known analytical cases.
- Pinned real-data values.

Reference versions and retrieval dates shall be recorded in validation reports.
