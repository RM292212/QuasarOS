"""
QuasarOS Coordinate and Depth Resolver.

Provides:
- Non-uniform vertical depth Look-Up Table (LUT) binary search across 31 levels.
- Geodetic nearest-neighbor index lookup over regular 1/12 degree horizontal grid.
- Haversine geodetic distance delta calculation in kilometers.
- Exact and nearest temporal timestep matching.
- Strict domain and depth bounds validation with structured error handling.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

from quasar_contracts.exact_value_contracts import (
    SelectionInterpolationContract,
    SelectionMethod,
    TimeSelectorMode,
    VerticalSelectorType,
)
from quasar_services.query.errors import (
    CoordinateOutOfBoundsException,
    DepthOutOfBoundsException,
    TemporalOutOfBoundsException,
)

# Standard 50-level Copernicus depth Look-Up Table (meters, positive downward)
DEPTH_LUT_METERS_50: List[float] = [
    0.49402499198913574, 1.5413750410079956, 2.6456689834594727, 3.8194949626922607,
    5.078224182128906, 6.440614223480225, 7.92956018447876, 9.572997093200684,
    11.404999732971191, 13.467140197753906, 15.810070037841797, 18.495559692382812,
    21.598819732666016, 25.211410522460938, 29.444730758666992, 34.43415069580078,
    40.344051361083984, 47.37369155883789, 55.76428985595703, 65.80726623535156,
    77.85385131835938, 92.3260726928711, 109.72930145263672, 130.66600036621094,
    155.85069274902344, 186.12559509277344, 222.47520446777344, 266.0403137207031,
    318.1274108886719, 380.2130126953125, 453.9377136230469, 541.0889282226562,
    643.5667724609375, 763.3331298828125, 902.3392944335938, 1062.43994140625,
    1245.291015625, 1452.2509765625, 1684.2840576171875, 1941.8929443359375,
    2225.077880859375, 2533.3359375, 2865.702880859375, 3220.820068359375,
    3597.031982421875, 3992.48388671875, 4405.22412109375, 4833.291015625,
    5274.7841796875, 5727.9169921875
]

# Legacy 31-level depth Look-Up Table
DEPTH_LUT_METERS_31: List[float] = DEPTH_LUT_METERS_50[:31]

# Default standard depth levels (50 levels)
DEPTH_LUT_METERS: List[float] = list(DEPTH_LUT_METERS_50)

# Arabian Sea operational domain bounds
ARABIAN_SEA_MIN_LATITUDE: float = 0.0
ARABIAN_SEA_MAX_LATITUDE: float = 15.0
ARABIAN_SEA_MIN_LONGITUDE: float = 60.0
ARABIAN_SEA_MAX_LONGITUDE: float = 68.0

# Legacy regional bounds
LEGACY_MIN_LATITUDE: float = -3.0
LEGACY_MAX_LATITUDE: float = 12.0
LEGACY_MIN_LONGITUDE: float = 80.0
LEGACY_MAX_LONGITUDE: float = 88.0

# Active default spatial bounds and resolution for Arabian Sea Copernicus domain
MIN_LATITUDE: float = ARABIAN_SEA_MIN_LATITUDE
MAX_LATITUDE: float = ARABIAN_SEA_MAX_LATITUDE
MIN_LONGITUDE: float = ARABIAN_SEA_MIN_LONGITUDE
MAX_LONGITUDE: float = ARABIAN_SEA_MAX_LONGITUDE
LAT_POINTS: int = 181
LON_POINTS: int = 97
LAT_STEP: float = (MAX_LATITUDE - MIN_LATITUDE) / (LAT_POINTS - 1)   # 1/12 deg
LON_STEP: float = (MAX_LONGITUDE - MIN_LONGITUDE) / (LON_POINTS - 1)  # 1/12 deg

# Standard operational timestamps
AVAILABLE_TIMESTAMPS: List[str] = [
    "2026-08-24T00:00:00Z",
    "2026-08-25T00:00:00Z",
    "2026-08-26T00:00:00Z",
    "2026-08-27T00:00:00Z",
    "2026-08-28T00:00:00Z",
    "2026-08-29T00:00:00Z",
    "2026-08-30T00:00:00Z",
]


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two points on a sphere in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return R * c


def pressure_to_depth_m(pressure_dbar: float, latitude_deg: float) -> float:
    """
    Convert ocean pressure in dbar to depth in meters.
    Utilizes standard TEOS-10 oceanographic gravitational acceleration formulation.
    """
    # Standard UNESCO/TEOS-10 hydrostatic gravity variation with latitude
    sin_lat = math.sin(math.radians(latitude_deg))
    g = 9.780318 * (1.0 + 5.2788e-3 * sin_lat**2 + 2.36e-5 * sin_lat**4)
    # Standard mean ocean density: ~1025 kg/m^3
    # 1 dbar = 10000 Pa -> depth = 10000 * p / (rho * g)
    depth = (pressure_dbar * 10000.0) / (1025.0 * g)
    return max(0.0, depth)


class CoordinateResolver:
    """
    Resolves scientific request coordinates against native discrete grid dimensions.
    """

    def __init__(
        self,
        depth_lut: Optional[List[float]] = None,
        min_lat: float = MIN_LATITUDE,
        max_lat: float = MAX_LATITUDE,
        min_lon: float = MIN_LONGITUDE,
        max_lon: float = MAX_LONGITUDE,
        lat_points: int = LAT_POINTS,
        lon_points: int = LON_POINTS,
        available_timestamps: Optional[List[str]] = None,
    ):
        self.depth_lut = depth_lut or list(DEPTH_LUT_METERS)
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lon = min_lon
        self.max_lon = max_lon
        self.lat_points = lat_points
        self.lon_points = lon_points
        self.lat_step = (max_lat - min_lat) / (lat_points - 1)
        self.lon_step = (max_lon - min_lon) / (lon_points - 1)
        self.available_timestamps = available_timestamps or list(AVAILABLE_TIMESTAMPS)

        # Precompute coordinate arrays
        self.lat_coords = [min_lat + i * self.lat_step for i in range(lat_points)]
        self.lon_coords = [min_lon + j * self.lon_step for j in range(lon_points)]

    def resolve_horizontal(
        self,
        latitude_deg: float,
        longitude_deg: float,
        selection: Optional[SelectionInterpolationContract] = None,
    ) -> Tuple[int, int, float, float, float]:
        """
        Resolve requested latitude & longitude to nearest native grid node.

        Returns:
            (lat_idx, lon_idx, resolved_lat, resolved_lon, distance_delta_km)
        """
        allows_extrap = selection.allows_extrapolation if selection else False
        max_extrap_deg = selection.max_horizontal_extrapolation_deg if selection else 0.0

        # Longitude normalization: [0, 360] -> [-180, 180] if necessary
        norm_lon = longitude_deg
        if norm_lon > 180.0:
            norm_lon -= 360.0

        # Boundary checks
        lat_out_min = self.min_lat - latitude_deg
        lat_out_max = latitude_deg - self.max_lat
        lat_out = max(0.0, lat_out_min, lat_out_max)

        lon_out_min = self.min_lon - norm_lon
        lon_out_max = norm_lon - self.max_lon
        lon_out = max(0.0, lon_out_min, lon_out_max)

        # Tolerance check for small floating point inaccuracies (e.g. 1e-4)
        tol = 1e-4
        if lat_out > tol or lon_out > tol:
            if not allows_extrap:
                raise CoordinateOutOfBoundsException(
                    f"Requested coordinates ({latitude_deg:.4f} N, {longitude_deg:.4f} E) lie outside the spatial domain "
                    f"[{self.min_lat} to {self.max_lat} N, {self.min_lon} to {self.max_lon} E]. Extrapolation is disabled.",
                    details={
                        "requested_latitude": latitude_deg,
                        "requested_longitude": longitude_deg,
                        "domain_bounds": {
                            "min_latitude": self.min_lat,
                            "max_latitude": self.max_lat,
                            "min_longitude": self.min_lon,
                            "max_longitude": self.max_lon,
                        },
                    },
                )
            elif max_extrap_deg > 0.0 and (lat_out > max_extrap_deg or lon_out > max_extrap_deg):
                raise CoordinateOutOfBoundsException(
                    f"Requested coordinates exceed maximum allowed horizontal extrapolation ({max_extrap_deg} deg).",
                    details={
                        "requested_latitude": latitude_deg,
                        "requested_longitude": longitude_deg,
                        "max_horizontal_extrapolation_deg": max_extrap_deg,
                    },
                )

        # Nearest neighbor index lookup
        raw_lat_idx = int(round((latitude_deg - self.min_lat) / self.lat_step))
        raw_lon_idx = int(round((norm_lon - self.min_lon) / self.lon_step))

        lat_idx = max(0, min(self.lat_points - 1, raw_lat_idx))
        lon_idx = max(0, min(self.lon_points - 1, raw_lon_idx))

        resolved_lat = float(self.lat_coords[lat_idx])
        resolved_lon = float(self.lon_coords[lon_idx])
        distance_km = haversine_distance_km(latitude_deg, norm_lon, resolved_lat, resolved_lon)

        return lat_idx, lon_idx, resolved_lat, resolved_lon, distance_km

    def resolve_vertical(
        self,
        selector_type: VerticalSelectorType,
        target_value: Optional[float] = None,
        latitude_deg: float = 0.0,
        selection: Optional[SelectionInterpolationContract] = None,
    ) -> Tuple[int, float, float]:
        """
        Resolve vertical coordinate against depth LUT.

        Returns:
            (depth_idx, resolved_depth_m, depth_delta_m)
        """
        allows_extrap = selection.allows_extrapolation if selection else False
        max_extrap_m = selection.max_vertical_extrapolation_m if selection else 0.0

        if selector_type == VerticalSelectorType.SEA_SURFACE:
            return 0, float(self.depth_lut[0]), 0.0

        if selector_type == VerticalSelectorType.SEA_FLOOR:
            last_idx = len(self.depth_lut) - 1
            return last_idx, float(self.depth_lut[last_idx]), 0.0

        if selector_type == VerticalSelectorType.GRID_LEVEL_INDEX:
            k = int(target_value or 0)
            if k < 0 or k >= len(self.depth_lut):
                raise DepthOutOfBoundsException(
                    f"Grid level index {k} is out of bounds [0, {len(self.depth_lut) - 1}].",
                    details={"grid_level_index": k, "max_index": len(self.depth_lut) - 1},
                )
            return k, float(self.depth_lut[k]), 0.0

        # Physical depth in meters or pressure in dbar
        if selector_type == VerticalSelectorType.PRESSURE_DBAR:
            req_depth = pressure_to_depth_m(target_value or 0.0, latitude_deg)
        else:
            req_depth = float(target_value if target_value is not None else 0.0)

        # Depth out-of-bounds validation
        min_depth = self.depth_lut[0]
        max_depth = self.depth_lut[-1]

        if req_depth < 0.0:
            if not allows_extrap or abs(req_depth) > max_extrap_m:
                raise DepthOutOfBoundsException(
                    f"Negative physical depth ({req_depth:.2f} m) is out of bounds.",
                    details={"requested_depth_m": req_depth, "min_depth_m": min_depth},
                )

        if req_depth > max_depth + 10.0:  # 10m leeway
            if not allows_extrap or (req_depth - max_depth) > max_extrap_m:
                raise DepthOutOfBoundsException(
                    f"Requested depth {req_depth:.2f} m exceeds maximum model depth {max_depth:.2f} m.",
                    details={"requested_depth_m": req_depth, "max_depth_m": max_depth},
                )

        # Look-Up Table binary/nearest search
        best_idx = 0
        best_diff = abs(self.depth_lut[0] - req_depth)
        for i, d in enumerate(self.depth_lut):
            diff = abs(d - req_depth)
            if diff < best_diff:
                best_diff = diff
                best_idx = i

        resolved_depth = float(self.depth_lut[best_idx])
        depth_delta = abs(resolved_depth - req_depth)

        return best_idx, resolved_depth, depth_delta

    def resolve_time(
        self,
        target_time_utc: Optional[str] = None,
        time_selector_mode: TimeSelectorMode = TimeSelectorMode.EXACT_UTC_TIMESTAMP,
    ) -> Tuple[int, str]:
        """
        Resolve target time against available timesteps.

        Returns:
            (timestep_idx, resolved_time_utc)
        """
        if not target_time_utc:
            # Default to latest operational timestep
            last_idx = len(self.available_timestamps) - 1
            return last_idx, self.available_timestamps[last_idx]

        # Exact match check
        norm_req = target_time_utc.replace("+00:00", "Z")
        if not norm_req.endswith("Z") and not ("+" in norm_req or "-" in norm_req[10:]):
            norm_req += "Z"

        for i, ts in enumerate(self.available_timestamps):
            if ts == norm_req or ts.startswith(norm_req.rstrip("Z")):
                return i, ts

        # Nearest available timestep parsing
        try:
            req_dt = datetime.fromisoformat(target_time_utc.replace("Z", "+00:00"))
        except Exception as e:
            raise TemporalOutOfBoundsException(
                f"Invalid ISO 8601 target time '{target_time_utc}': {str(e)}",
                details={"target_time_utc": target_time_utc},
            )

        # Check temporal coverage range
        ts_dts = [datetime.fromisoformat(ts.replace("Z", "+00:00")) for ts in self.available_timestamps]
        min_dt = ts_dts[0]
        max_dt = ts_dts[-1]

        # If year or month is clearly outside coverage (e.g. > 15 days out)
        delta_sec_min = (req_dt - min_dt).total_seconds()
        delta_sec_max = (req_dt - max_dt).total_seconds()

        if time_selector_mode == TimeSelectorMode.EXACT_UTC_TIMESTAMP:
            # If requesting exact timestamp and date doesn't match any available slice
            matching = [
                (i, ts) for i, dt, ts in zip(range(len(ts_dts)), ts_dts, self.available_timestamps)
                if dt.date() == req_dt.date()
            ]
            if matching:
                return matching[0][0], matching[0][1]

            raise TemporalOutOfBoundsException(
                f"Requested time '{target_time_utc}' is not available in snapshot coverage [{self.available_timestamps[0]} to {self.available_timestamps[-1]}].",
                details={
                    "requested_time_utc": target_time_utc,
                    "available_timestamps": self.available_timestamps,
                },
            )

        # Nearest available timestep
        best_idx = 0
        best_diff = abs((ts_dts[0] - req_dt).total_seconds())
        for i, dt in enumerate(ts_dts):
            diff = abs((dt - req_dt).total_seconds())
            if diff < best_diff:
                best_diff = diff
                best_idx = i

        return best_idx, self.available_timestamps[best_idx]
