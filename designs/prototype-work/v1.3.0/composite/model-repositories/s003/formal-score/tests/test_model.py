from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from model import MODEL_ID, OUTPUT_KEYS, score_record


SAMPLE = {
    "enterpriseId": "ENT-SYN-001",
    "enterpriseName": "样例企业",
    "predictionAsOf": "2025-12-31",
    "formalScore": 32.5,
    "formalTier": "黄灯",
    "liquidityCoverage": 0.62,
    "debtDue90Ratio": 0.31,
    "debtDue180Ratio": 0.52,
    "refinancePressure": 0.68,
    "relationExposure": 0.57,
    "anomalyZ": 2.1,
    "cashAvailableMillions": 120.0,
    "cashFlowChange": -0.08,
    "debtDue90Millions": 188.0,
    "debtDue180Millions": 316.0
}


class ModelContractTest(unittest.TestCase):
    def test_model_identity(self):
        self.assertEqual(MODEL_ID, "MODEL-S003-FORMAL-SCORE")

    def test_output_contract(self):
        result = score_record(SAMPLE)
        for key in OUTPUT_KEYS:
            self.assertIn(key, result)

    def test_is_deterministic(self):
        self.assertEqual(score_record(SAMPLE), score_record(dict(SAMPLE)))


if __name__ == "__main__":
    unittest.main()
