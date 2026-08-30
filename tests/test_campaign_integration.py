"""
Test suite for Unified Multi-Source Campaign Manifest & Integration (TASK-01K)
"""

import os
import json
import unittest


class TestUnifiedCampaignManifest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.campaign_manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "campaigns", "campaign_north_indian_ocean_2026.json"
        )

    def test_campaign_manifest_exists_and_valid(self):
        self.assertTrue(os.path.exists(self.campaign_manifest_path), "Unified campaign manifest missing")
        with open(self.campaign_manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertEqual(data.get("campaign_id"), "campaign_north_indian_ocean_2026")
        self.assertTrue(data.get("scientific_foundation", {}).get("all_sources_validated"))
        
        sources = data.get("sources", [])
        self.assertEqual(len(sources), 8, "Expected 8 distinct real-data source holdings")

        task_ids = {s["task_id"] for s in sources}
        expected_tasks = {
            "TASK-01B", "TASK-01C", "TASK-01D", "TASK-01E",
            "TASK-01F", "TASK-01G", "TASK-01H", "TASK-01I"
        }
        self.assertEqual(task_ids, expected_tasks)

        for s in sources:
            self.assertEqual(s["validation_status"], "VALIDATED")
            self.assertGreater(s["total_bytes"], 0)


if __name__ == "__main__":
    unittest.main()
