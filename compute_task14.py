import json, numpy as np
import sys
import os
sys.path.insert(0, os.path.abspath('packages/services/src'))
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
from quasar_services.observations.collocation_engine import CollocationEngine

with open("data/canonical/observations/argo_ensemble_arabian_sea.json", "r") as f:
    ensemble = json.load(f)

engine = ScientificAnalysisEngine()
colloc = CollocationEngine(engine)

all_temp_diffs = []
all_sal_diffs = []
sample_count = 0

for prof in ensemble["profiles"]:
    # Add depth_m if missing
    for lvl in prof["levels"]:
        if "depth_m" not in lvl:
            lvl["depth_m"] = lvl["pressure_dbar"]
        if "temp_qc" not in lvl:
            lvl["temp_qc"] = lvl["qc_flag"]
        if "psal_qc" not in lvl:
            lvl["psal_qc"] = lvl["qc_flag"]
        if "psal" not in lvl:
            lvl["psal"] = lvl["psal_psu"]
            
    res = colloc.collocate_argo_profile(prof)
    print(f"Profile {prof['platform_id']}:")
    print(f"  Temp bias: {res['metrics']['temperature_bias_c']:.3f}, RMSE: {res['metrics']['temperature_rmse_c']:.3f}")
    print(f"  Sal bias: {res['metrics']['salinity_bias']:.3f}, RMSE: {res['metrics']['salinity_rmse']:.3f}")
    
    for t in res["collocation_table"]:
        all_temp_diffs.append(t["temperature_delta_c"])
        all_sal_diffs.append(t["salinity_delta"])
        sample_count += 1

tbias = np.mean(all_temp_diffs)
trmse = np.sqrt(np.mean(np.array(all_temp_diffs)**2))
tmae = np.mean(np.abs(all_temp_diffs))

sbias = np.mean(all_sal_diffs)
srmse = np.sqrt(np.mean(np.array(all_sal_diffs)**2))
smae = np.mean(np.abs(all_sal_diffs))

print("=== ENSEMBLE METRICS ===")
print(f"Samples: {sample_count}")
print(f"Temp bias: {tbias:.3f} C, MAE: {tmae:.3f} C, RMSE: {trmse:.3f} C")
print(f"Sal bias: {sbias:.3f} psu, MAE: {smae:.3f} psu, RMSE: {srmse:.3f} psu")
