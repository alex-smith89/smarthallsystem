import io
import os
import json
import tempfile
import unittest
import importlib.util
from contextlib import redirect_stdout
from unittest.mock import patch

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor


TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.dirname(TESTS_DIR)

TRAIN_PATH = os.path.join(ML_DIR, "train_hall_occupancy_model.py")
PREDICT_PATH = os.path.join(ML_DIR, "predict_hall_occupancy.py")


def load_module(module_name, file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


train_model = load_module("train_model", TRAIN_PATH)
predict = load_module("predict", PREDICT_PATH)


class TestHallOccupancyML(unittest.TestCase):
    def setUp(self):
        self.sample_rows = [
            {
                "course_name": "Math",
                "year": 1,
                "exam_type": "Mid",
                "num_students": 30,
                "duration_hours": 2,
            },
            {
                "course_name": "Physics",
                "year": 2,
                "exam_type": "Final",
                "num_students": 45,
                "duration_hours": 3,
            },
        ]

    def run_predict_main(self, model_path, stdin_text):
        stdout = io.StringIO()

        with patch("sys.argv", ["predict_hall_occupancy.py", "--model", model_path]):
            with patch("sys.stdin", io.StringIO(stdin_text)):
                with redirect_stdout(stdout):
                    try:
                        predict.main()
                    except SystemExit as e:
                        self.assertEqual(e.code, 0)

        return stdout.getvalue().strip()

    def test_training_file_exists(self):
        self.assertTrue(os.path.exists(TRAIN_PATH))

    def test_prediction_file_exists(self):
        self.assertTrue(os.path.exists(PREDICT_PATH))

    def test_predict_returns_empty_when_model_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_model = os.path.join(tmpdir, "missing.joblib")
            payload = json.dumps({"rows": self.sample_rows})

            output_text = self.run_predict_main(missing_model, payload)
            output = json.loads(output_text)

            self.assertIn("predictions", output)
            self.assertEqual(output["predictions"], [])

    def test_predict_returns_empty_for_invalid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = os.path.join(tmpdir, "dummy.joblib")
            joblib.dump("dummy", model_path)

            output_text = self.run_predict_main(model_path, "not valid json")
            output = json.loads(output_text)

            self.assertIn("predictions", output)
            self.assertEqual(output["predictions"], [])

    def test_predict_returns_empty_for_missing_rows(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = os.path.join(tmpdir, "dummy.joblib")
            joblib.dump("dummy", model_path)

            payload = json.dumps({"rows": []})

            output_text = self.run_predict_main(model_path, payload)
            output = json.loads(output_text)

            self.assertIn("predictions", output)
            self.assertEqual(output["predictions"], [])

    def test_predict_returns_predictions_for_valid_input(self):
        X = pd.DataFrame(
            [
                {"feature1": 10, "feature2": 1},
                {"feature1": 20, "feature2": 0},
                {"feature1": 30, "feature2": 1},
                {"feature1": 40, "feature2": 0},
            ]
        )
        y = [0.2, 0.4, 0.6, 0.8]

        model = RandomForestRegressor(n_estimators=10, random_state=42)
        model.fit(X, y)

        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = os.path.join(tmpdir, "model.joblib")
            joblib.dump(model, model_path)

            payload = json.dumps(
                {
                    "rows": [
                        {"feature1": 15, "feature2": 1},
                        {"feature1": 35, "feature2": 0},
                    ]
                }
            )

            output_text = self.run_predict_main(model_path, payload)
            output = json.loads(output_text)

            self.assertIn("predictions", output)
            self.assertEqual(len(output["predictions"]), 2)

            for item in output["predictions"]:
                self.assertIn("attendance_rate", item)
                self.assertIsInstance(item["attendance_rate"], float)
                self.assertGreaterEqual(item["attendance_rate"], 0.0)
                self.assertLessEqual(item["attendance_rate"], 1.0)


if __name__ == "__main__":
    unittest.main()