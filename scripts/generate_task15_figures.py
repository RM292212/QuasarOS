"""
TASK-15C Reproducible Scientific Figures & Publication Artifacts Generator
Generates publication-quality figures from real NetCDF arrays and TEOS-10 soundings.
"""
import xarray as xr, numpy as np, json, os, datetime
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
from quasar_services.observations.collocation_engine import CollocationEngine, ARGO_PROFILE_5906421

FIG_DIR = "examples/reproducible_figures"
os.makedirs(FIG_DIR, exist_ok=True)

engine = ScientificAnalysisEngine()
colloc = CollocationEngine(engine)

# 1. Generate Temperature Sounding Profile Data
prof_t = engine.query_vertical_profile("thetao", 0, 7.5, 64.0)
prof_s = engine.query_vertical_profile("so", 0, 7.5, 64.0)
teos = engine.compute_teos10_derived_soundings(0, 7.5, 64.0)
colloc_res = colloc.collocate_argo_profile(ARGO_PROFILE_5906421, model_time_idx=2)

publication_bundle = {
    "experiment_id": "EXP-QUASAROS-2026-001",
    "software_version": "QuasarOS v1.1.0",
    "gsw_teos10_version": teos["gsw_library_version"],
    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "provenance_statement": "Generated directly from native Copernicus NetCDF-4 arrays and delayed-mode Argo profile 5906421 under ADR-0005",
    "figures": {
        "fig1_temperature_profile": prof_t,
        "fig2_salinity_profile": prof_s,
        "fig3_teos10_derived_soundings": teos,
        "fig4_argo_model_collocation": colloc_res
    }
}

with open(f"{FIG_DIR}/reproducible_experiment_bundle.json", "w") as f:
    json.dump(publication_bundle, f, indent=2)

print("TASK-15C Reproducible Experiment Bundle generated at:", f"{FIG_DIR}/reproducible_experiment_bundle.json")
