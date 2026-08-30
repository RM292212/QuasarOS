"""
QuasarOS Scientific Data Class Discriminators & Taxonomies

Establishes the core data class discriminators, scientific roles, processing levels,
and operational status classifications across ocean model volumes, waves, satellite rasters,
in-situ observations, bathymetry, climatology, and derived products.
"""

from enum import Enum


class DataClassDiscriminator(str, Enum):
    """
    Discriminator classifying the fundamental scientific structure and rendering path.
    Enforces typed discriminated unions across all dataset representations.
    """
    model_volume = "model_volume"
    wave_grid = "wave_grid"
    satellite_grid = "satellite_grid"
    profile_observations = "profile_observations"
    trajectory_observations = "trajectory_observations"
    time_series_observations = "time_series_observations"
    bathymetry_grid = "bathymetry_grid"
    climatology_grid = "climatology_grid"
    visualization_product = "visualization_product"
    derived_product = "derived_product"


class ScientificRole(str, Enum):
    """Authoritative scientific role of the dataset in QuasarOS."""
    MODEL = "model"
    OBSERVATION = "observation"
    CLIMATOLOGY = "climatology"
    BATHYMETRY = "bathymetry"
    SATELLITE = "satellite"
    DERIVED = "derived"
    RENDER_ACCELERATION = "rendering_acceleration"
    TEST_FIXTURE = "test_fixture"


class ProcessingLevel(str, Enum):
    """Standard processing level classification (NASA / CEOS / Operational standard)."""
    L0 = "L0"  # Raw telemetry/uncalibrated
    L1 = "L1"  # Sensor calibration applied, unmapped
    L2 = "L2"  # Geolocated profile or geophysical swath
    L3 = "L3"  # Gridded single-sensor geophysical product
    L4 = "L4"  # Gap-free multi-sensor analyzed/interpolated product
    ANALYSIS_FORECAST = "ANALYSIS_FORECAST"  # Numerical ocean model simulation / analysis
    REANALYSIS = "REANALYSIS"  # Historical reanalysis run
    CLIMATOLOGY = "CLIMATOLOGY"  # Long-term statistical climatology
    TERRAIN_MODEL = "TERRAIN_MODEL"  # Bathymetric digital elevation model
    DERIVED_DIAGNOSTIC = "DERIVED_DIAGNOSTIC"  # Derived oceanographic diagnostic (TEOS-10, MLD, etc.)


class OperationalStatus(str, Enum):
    """Operational maturity and release qualification status."""
    OPERATIONAL = "operational"
    PRE_OPERATIONAL = "pre_operational"
    RESEARCH = "research"
    DEMONSTRATION = "demonstration"
    RETIRED = "retired"
    SYNTHETIC = "synthetic"  # Allowed ONLY for test_fixture
