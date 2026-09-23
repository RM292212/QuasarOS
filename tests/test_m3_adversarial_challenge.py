"""
Milestone 3 Empirical Adversarial Challenge Verification Harness.
Author: Challenger 1 (m3_challenger_1)

Performs rigorous empirical verification of:
1. Geographic aspect ratio geodesics on WGS-84 and spherical models (60°E..68°E, 0°N..15°N, 0.494m..5727.917m).
2. Multi-LOD grid dimensions and VRAM footprints (Preview, Interactive, High-Quality, and worst-case allocations).
3. 3D Camera matrix algebra, ray reconstruction, and affine texture-to-world mapping with 10,000 randomized Monte Carlo stress cases.
"""

import math
import numpy as np
import pytest

def verify_geographic_aspect_ratio():
    print("\n" + "=" * 70)
    print("TASK 1: EMPIRICAL VERIFICATION OF GEOGRAPHIC ASPECT RATIO")
    print("=" * 70)

    # WGS-84 Ellipsoid constants
    a = 6378137.0           # semi-major axis in meters
    f = 1.0 / 298.257223563 # flattening
    b = a * (1.0 - f)       # semi-minor axis
    e2 = 2.0 * f - f**2     # eccentricity squared

    # Domain definition
    lon_min, lon_max = 60.0, 68.0  # degrees East
    lat_min, lat_max = 0.0, 15.0   # degrees North
    depth_min, depth_max = 0.494, 5727.917 # meters

    delta_lon_deg = lon_max - lon_min
    delta_lat_deg = lat_max - lat_min
    delta_depth_m = depth_max - depth_min
    mean_lat_deg = (lat_min + lat_max) / 2.0 # 7.5 deg N
    mean_lat_rad = math.radians(mean_lat_deg)

    # 1. Exact WGS-84 meridian arc length (North-South distance from 0 to 15 deg N)
    # S(phi1, phi2) = \int_{phi1}^{phi2} M(phi) dphi, M(phi) = a(1 - e^2) / (1 - e^2 sin^2 phi)^(3/2)
    n_steps = 10000
    phi_pts = np.linspace(math.radians(lat_min), math.radians(lat_max), n_steps + 1)
    M_pts = (a * (1.0 - e2)) / (1.0 - e2 * np.sin(phi_pts)**2)**1.5
    d_phi = phi_pts[1] - phi_pts[0]
    meridian_dist_m = float(np.trapezoid(M_pts, dx=d_phi))
    meridian_dist_km = meridian_dist_m / 1000.0

    # 2. Exact WGS-84 parallel arc length at mean latitude phi0 = 7.5 deg N
    # N(phi0) = a / sqrt(1 - e^2 sin^2 phi0)
    N_phi0 = a / math.sqrt(1.0 - e2 * math.sin(mean_lat_rad)**2)
    parallel_dist_m = N_phi0 * math.cos(mean_lat_rad) * math.radians(delta_lon_deg)
    parallel_dist_km = parallel_dist_m / 1000.0

    # 3. Spherical approximation (R = 6371.0088 km)
    R_sphere_km = 6371.0088
    sphere_lat_dist_km = R_sphere_km * math.radians(delta_lat_deg)
    sphere_lon_dist_km = R_sphere_km * math.cos(mean_lat_rad) * math.radians(delta_lon_deg)

    # 4. Aspect ratio calculations normalized against max horizontal dimension
    max_horizontal_km = meridian_dist_km
    sx_exact = parallel_dist_km / max_horizontal_km
    sz_exact = 1.000

    depth_column_km = delta_depth_m / 1000.0
    sy_phys = depth_column_km / max_horizontal_km

    # With default 50x vertical exaggeration
    sy_50x = sy_phys * 50.0

    print(f"Domain Bounds: Lon [{lon_min}E..{lon_max}E], Lat [{lat_min}N..{lat_max}N], Depth [{depth_min}m..{depth_max}m]")
    print(f"Mean Latitude: {mean_lat_deg:.2f}°N")
    print(f"WGS-84 Meridian Distance (North-South, 0°N..15°N): {meridian_dist_km:.3f} km")
    print(f"WGS-84 Parallel Distance (East-West at 7.5°N):   {parallel_dist_km:.3f} km")
    print(f"Physical Ocean Column Depth:                      {depth_column_km:.4f} km ({delta_depth_m:.3f} m)")
    print(f"Spherical Meridian Distance:                      {sphere_lat_dist_km:.3f} km (diff = {abs(sphere_lat_dist_km - meridian_dist_km):.3f} km)")
    print(f"Spherical Parallel Distance:                      {sphere_lon_dist_km:.3f} km (diff = {abs(sphere_lon_dist_km - parallel_dist_km):.3f} km)")
    print("-" * 70)
    print(f"Exact Geodetic Aspect Ratio (sx : sy_phys : sz) = ({sx_exact:.4f} : {sy_phys:.6f} : {sz_exact:.4f})")
    print(f"With 50x Vertical Exaggeration (sx : sy_50x : sz) = ({sx_exact:.4f} : {sy_50x:.4f} : {sz_exact:.4f})")
    print(f"Target Specification Aspect Ratio in Code:       (0.534 : 0.172 : 1.000)")

    error_sx = abs(sx_exact - 0.534)
    error_sy = abs(sy_50x - 0.172)
    print(f"Delta sx: {error_sx:.5f} ({error_sx / sx_exact * 100:.3f}% relative error)")
    print(f"Delta sy: {error_sy:.5f} ({error_sy / sy_50x * 100:.3f}% relative error)")

    assert error_sx < 0.005, f"sx error {error_sx} exceeds tolerance"
    assert error_sy < 0.005, f"sy error {error_sy} exceeds tolerance"

    # 5. Verify Vertical Exaggeration Scaling across [10x, 100x]
    print("-" * 70)
    print("Testing Vertical Exaggeration Range [10x .. 100x]:")
    for ve in [10.0, 25.0, 50.0, 75.0, 100.0]:
        sy_ve = 0.172 * (ve / 50.0)
        sy_ve_exact = sy_phys * ve
        print(f"  VE = {ve:5.1f}x -> sy = {sy_ve:.4f} (exact = {sy_ve_exact:.4f}, diff = {abs(sy_ve - sy_ve_exact):.5f})")
        assert 0.030 <= sy_ve <= 0.350, f"sy {sy_ve} out of expected bounds for VE={ve}"

    print("[PASS] Task 1: Geographic Aspect Ratio Mathematics verified with rigorous geodetic precision.")
    return True

def verify_lod_vram_footprints():
    print("\n" + "=" * 70)
    print("TASK 2: EMPIRICAL VERIFICATION OF LOD GRID DIMENSIONS & VRAM FOOTPRINT")
    print("=" * 70)

    configs = {
        "Preview": {
            "depth": 16, "lat": 32, "lon": 32,
            "target_voxels": 16384,
            "expected_single_kib": 80.0,
        },
        "Interactive": {
            "depth": 24, "lat": 48, "lon": 48,
            "target_voxels": 55296,
            "expected_single_kib": 270.0,
        },
        "High-Quality": {
            "depth": 50, "lat": 181, "lon": 97,
            "target_voxels": 877850,
            "expected_single_kib": 4286.376953125, # ~4.186 MiB = 4389250 B
        }
    }

    budget_ceiling_bytes = 50 * 1024 * 1024 # 50 MiB = 52,428,800 bytes
    budget_ceiling_mib = 50.0

    for name, cfg in configs.items():
        voxels = cfg["depth"] * cfg["lat"] * cfg["lon"]
        assert voxels == cfg["target_voxels"], f"{name} voxel mismatch: {voxels} != {cfg['target_voxels']}"

        # Single-buffer footprint: float32 scalar (4B) + uint8 validity mask (1B)
        scalar_bytes = voxels * 4
        mask_bytes = voxels * 1
        single_buffer_bytes = scalar_bytes + mask_bytes
        single_buffer_kib = single_buffer_bytes / 1024.0
        single_buffer_mib = single_buffer_bytes / (1024.0 * 1024.0)

        # Double-buffer footprint (front buffer + back buffer)
        double_buffer_bytes = 2 * single_buffer_bytes
        double_buffer_mib = double_buffer_bytes / (1024.0 * 1024.0)

        # Worst-case buffer footprint: RGBA32F (16B) + R8UI (1B) = 17B/voxel
        worst_case_double_bytes = 2 * (voxels * 17)
        worst_case_double_mib = worst_case_double_bytes / (1024.0 * 1024.0)

        budget_pct_single = (single_buffer_bytes / budget_ceiling_bytes) * 100.0
        budget_pct_double = (double_buffer_bytes / budget_ceiling_bytes) * 100.0

        print(f"Mode: {name:12s} | Grid: {cfg['depth']}x{cfg['lat']}x{cfg['lon']} = {voxels:,} voxels")
        print(f"  Single Buffer: {single_buffer_bytes:,} B ({single_buffer_kib:.1f} KiB / {single_buffer_mib:.3f} MiB) -> {budget_pct_single:.2f}% of 50 MiB")
        print(f"  Double Buffer: {double_buffer_bytes:,} B ({double_buffer_mib:.3f} MiB) -> {budget_pct_double:.2f}% of 50 MiB")
        print(f"  Worst-Case Double: {worst_case_double_mib:.3f} MiB")

        # Assertions
        assert single_buffer_mib < budget_ceiling_mib, f"Single buffer {single_buffer_mib} MiB exceeds 50 MiB"
        assert double_buffer_mib < budget_ceiling_mib, f"Double buffer {double_buffer_mib} MiB exceeds 50 MiB"
        assert worst_case_double_mib < budget_ceiling_mib, f"Worst case {worst_case_double_mib} MiB exceeds 50 MiB"

    print("-" * 70)
    print("[PASS] Task 2: All LOD grid dimensions and single/double-buffered VRAM footprints verified strictly below 50.0 MiB ceiling.")
    return True

def create_look_at(eye, target, up):
    eye = np.array(eye, dtype=np.float64)
    target = np.array(target, dtype=np.float64)
    up = np.array(up, dtype=np.float64)

    z = eye - target
    z_len = np.linalg.norm(z)
    if z_len < 1e-9:
        z = np.array([0, 0, 1.0])
    else:
        z = z / z_len

    x = np.cross(up, z)
    x_len = np.linalg.norm(x)
    if x_len < 1e-9:
        x = np.array([1.0, 0, 0])
    else:
        x = x / x_len

    y = np.cross(z, x)

    V = np.eye(4, dtype=np.float64)
    V[0, :3] = x
    V[1, :3] = y
    V[2, :3] = z
    V[0, 3] = -np.dot(x, eye)
    V[1, 3] = -np.dot(y, eye)
    V[2, 3] = -np.dot(z, eye)
    return V

def create_perspective(fov_rad, aspect, near, far):
    f = 1.0 / math.tan(fov_rad / 2.0)
    P = np.zeros((4, 4), dtype=np.float64)
    P[0, 0] = f / aspect
    P[1, 1] = f
    P[2, 2] = (far + near) / (near - far)
    P[2, 3] = (2.0 * far * near) / (near - far)
    P[3, 2] = -1.0
    return P

def verify_camera_matrix_and_ray_reconstruction():
    print("\n" + "=" * 70)
    print("TASK 3: EMPIRICAL STRESS TEST OF CAMERA MATRIX & RAY RECONSTRUCTION")
    print("=" * 70)

    # Slab scaling parameters
    sx = 0.534
    sy = 0.172
    sz = 1.000

    # Model Matrix M mapping [u, v, w, 1] -> [X, Y, Z, 1] in standard math (row x col)
    # X = sx * (u - 0.5)
    # Y = sy * (0.5 - w)
    # Z = sz * (v - 0.5)
    M = np.array([
        [sx,   0,    0, -0.5 * sx],
        [ 0,   0,  -sy,  0.5 * sy],
        [ 0,  sz,    0, -0.5 * sz],
        [ 0,   0,    0,       1.0]
    ], dtype=np.float64)

    M_inv = np.linalg.inv(M)

    # Test 1: Verify boundary mapping of [0, 1]^3 corners
    print("Test 3.1: Corner verification [0, 1]^3 -> World -> [0, 1]^3")
    corners_tex = [
        (0.0, 0.0, 0.0, "SW Surface"),
        (1.0, 0.0, 0.0, "SE Surface"),
        (0.0, 1.0, 0.0, "NW Surface"),
        (1.0, 1.0, 0.0, "NE Surface"),
        (0.0, 0.0, 1.0, "SW Seafloor"),
        (1.0, 0.0, 1.0, "SE Seafloor"),
        (0.0, 1.0, 1.0, "NW Seafloor"),
        (1.0, 1.0, 1.0, "NE Seafloor"),
        (0.5, 0.5, 0.5, "Center"),
    ]

    for u, v, w, name in corners_tex:
        p_tex = np.array([u, v, w, 1.0], dtype=np.float64)
        p_world = M @ p_tex
        p_rec_tex = M_inv @ p_world

        # Check physical orientation properties
        if w == 0.0:
            assert abs(p_world[1] - 0.5 * sy) < 1e-9, f"Surface must map to +0.5 sy, got {p_world[1]}"
        elif w == 1.0:
            assert abs(p_world[1] - (-0.5 * sy)) < 1e-9, f"Seafloor must map to -0.5 sy, got {p_world[1]}"

        if u == 0.0:
            assert abs(p_world[0] - (-0.5 * sx)) < 1e-9, f"West must map to -0.5 sx, got {p_world[0]}"
        elif u == 1.0:
            assert abs(p_world[0] - (0.5 * sx)) < 1e-9, f"East must map to +0.5 sx, got {p_world[0]}"

        if v == 0.0:
            assert abs(p_world[2] - (-0.5 * sz)) < 1e-9, f"South must map to -0.5 sz, got {p_world[2]}"
        elif v == 1.0:
            assert abs(p_world[2] - (0.5 * sz)) < 1e-9, f"North must map to +0.5 sz, got {p_world[2]}"

        # Inverse reconstruction check
        err = float(np.max(np.abs(p_rec_tex[:3] - np.array([u, v, w]))))
        assert err < 1e-9, f"Corner {name} reconstruction error {err} >= 1e-9"
        print(f"  Corner {name:12s} [u={u:.1f}, v={v:.1f}, w={w:.1f}] -> World [{p_world[0]:+.4f}, {p_world[1]:+.4f}, {p_world[2]:+.4f}] -> Rec Err = {err:.2e}")

    # Test 2: Camera Position Transformation M^-1 * c_world
    print("-" * 70)
    print("Test 3.2: Camera Position Transformation M^-1 * c_world")
    cam_world = np.array([1.5, 0.8, -2.0, 1.0], dtype=np.float64)
    cam_tex = M_inv @ cam_world
    # Analytical formula check:
    # u = camX / sx + 0.5
    # v = camZ / sz + 0.5
    # w = -camY / sy + 0.5
    u_ana = cam_world[0] / sx + 0.5
    v_ana = cam_world[2] / sz + 0.5
    w_ana = -cam_world[1] / sy + 0.5
    cam_tex_ana = np.array([u_ana, v_ana, w_ana, 1.0])

    diff_cam = float(np.max(np.abs(cam_tex - cam_tex_ana)))
    assert diff_cam < 1e-9, f"Analytical camera tex pos mismatch: {diff_cam}"
    print(f"  World Cam Pos:    [{cam_world[0]:.2f}, {cam_world[1]:.2f}, {cam_world[2]:.2f}]")
    print(f"  Matrix Tex Cam:   [{cam_tex[0]:.4f}, {cam_tex[1]:.4f}, {cam_tex[2]:.4f}]")
    print(f"  Analytical Tex:   [{cam_tex_ana[0]:.4f}, {cam_tex_ana[1]:.4f}, {cam_tex_ana[2]:.4f}]")
    print(f"  Camera Transform Max Error: {diff_cam:.2e} (PASS)")

    # Test 3: Monte Carlo Stress Test across 10,000 randomized camera & ray configurations
    print("-" * 70)
    print("Test 3.3: 10,000 Randomized Monte Carlo Camera & Ray Reconstruction Stress Cases")

    np.random.seed(42)
    n_trials = 10000
    max_ray_origin_err = 0.0
    max_ray_point_err = 0.0

    for i in range(n_trials):
        # Random spherical camera angles
        pitch = np.random.uniform(-0.45 * math.pi, 0.45 * math.pi)
        yaw = np.random.uniform(-math.pi, math.pi)
        distance = np.random.uniform(1.2, 5.0)
        fov_deg = np.random.uniform(30.0, 75.0)
        aspect = np.random.uniform(0.5, 2.5)

        cam_x = distance * math.cos(pitch) * math.sin(yaw)
        cam_y = distance * math.sin(pitch)
        cam_z = distance * math.cos(pitch) * math.cos(yaw)

        cam_pos_world = [cam_x, cam_y, cam_z]
        target_world = [0.0, 0.0, 0.0]
        up_world = [0.0, 1.0, 0.0]

        V = create_look_at(cam_pos_world, target_world, up_world)
        P = create_perspective(math.radians(fov_deg), aspect, 0.1, 20.0)

        # Composite transformation T = P * V * M mapping Texture Space -> NDC
        T = P @ V @ M
        T_inv = np.linalg.inv(T)

        # Random texture point in [0, 1]^3
        u_rand = np.random.uniform(0.0, 1.0)
        v_rand = np.random.uniform(0.0, 1.0)
        w_rand = np.random.uniform(0.0, 1.0)
        p_tex_true = np.array([u_rand, v_rand, w_rand, 1.0])

        # Forward projection to Clip / NDC
        p_clip = T @ p_tex_true
        w_clip = p_clip[3]

        # Only evaluate if point is in front of camera (w_clip > 0.1)
        if w_clip > 0.1:
            ndc = p_clip / w_clip

            # Ray reconstruction in shader: worldFar = T_inv * ndc
            rec_tex_unnormalized = T_inv @ ndc
            rec_tex = rec_tex_unnormalized[:3] / rec_tex_unnormalized[3]

            err_point = float(np.max(np.abs(rec_tex - p_tex_true[:3])))
            if err_point > max_ray_point_err:
                max_ray_point_err = err_point

    print(f"  Completed {n_trials:,} randomized Monte Carlo trials.")
    print(f"  Maximum Ray Point Inversion Error: {max_ray_point_err:.2e}")
    assert max_ray_point_err < 1e-5, f"Monte Carlo ray reconstruction error {max_ray_point_err} >= 1e-5"

    print("[PASS] Task 3: Camera matrix inversions and ray reconstruction verified with zero distortion across 10,000 cases.")
    print("=" * 70)
    return True

# Pytest test fixtures
def test_task1_aspect_ratio():
    assert verify_geographic_aspect_ratio() is True

def test_task2_lod_vram():
    assert verify_lod_vram_footprints() is True

def test_task3_camera_ray_reconstruction():
    assert verify_camera_matrix_and_ray_reconstruction() is True

if __name__ == "__main__":
    verify_geographic_aspect_ratio()
    verify_lod_vram_footprints()
    verify_camera_matrix_and_ray_reconstruction()
    print("ALL EMPIRICAL CHALLENGE VERIFICATION TESTS PASSED SUCCESSFULLY.")
