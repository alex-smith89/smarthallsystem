import io
import json
import math
import os
import tempfile
import unittest
import importlib.util
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import pandas as pd


TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.dirname(TESTS_DIR)
TRAIN_PATH = os.path.join(ML_DIR, "train_hall_occupancy_model.py")


def load_module(module_name, file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


train_model = load_module("train_hall_occupancy_model", TRAIN_PATH)


def make_dataset():
    rows = [
        {
            "exam_id": "e1",
            "hall_id": "h1",
            "exam_date": "2025-10-01",
            "exam_subject_code": "CSC101",
            "exam_day_of_week": "Wednesday",
            "exam_month": 10,
            "exam_start_hour": 9,
            "exam_duration_minutes": 90,
            "hall_name": "Hall 1",
            "hall_building": "Main",
            "hall_floor": "Ground",
            "hall_capacity": 60,
            "allocated_count": 55,
            "dominant_program": "BSc CSIT",
            "avg_semester": 1.0,
            "avg_seat_row": 5.0,
            "avg_seat_column": 3.0,
            "present_count": 44,
            "absent_count": 11,
            "attendance_rate": 0.80,
            "occupancy_ratio": 0.73,
            "hall_fill_ratio": 0.92,
            "dataset_split": "train",
        },
        {
            "exam_id": "e2",
            "hall_id": "h2",
            "exam_date": "2025-10-02",
            "exam_subject_code": "CSC102",
            "exam_day_of_week": "Thursday",
            "exam_month": 10,
            "exam_start_hour": 10,
            "exam_duration_minutes": 120,
            "hall_name": "Hall 2",
            "hall_building": "Main",
            "hall_floor": "First",
            "hall_capacity": 72,
            "allocated_count": 60,
            "dominant_program": "BCA",
            "avg_semester": 2.0,
            "avg_seat_row": 6.0,
            "avg_seat_column": 4.0,
            "present_count": 45,
            "absent_count": 15,
            "attendance_rate": 0.75,
            "occupancy_ratio": 0.62,
            "hall_fill_ratio": 0.83,
            "dataset_split": "train",
        },
        {
            "exam_id": "e3",
            "hall_id": "h3",
            "exam_date": "2025-10-03",
            "exam_subject_code": "CSC201",
            "exam_day_of_week": "Friday",
            "exam_month": 10,
            "exam_start_hour": 11,
            "exam_duration_minutes": 90,
            "hall_name": "Hall 3",
            "hall_building": "Block A",
            "hall_floor": "Second",
            "hall_capacity": 80,
            "allocated_count": 50,
            "dominant_program": "BSc CSIT",
            "avg_semester": 3.0,
            "avg_seat_row": 4.5,
            "avg_seat_column": 2.5,
            "present_count": 35,
            "absent_count": 15,
            "attendance_rate": 0.70,
            "occupancy_ratio": 0.44,
            "hall_fill_ratio": 0.62,
            "dataset_split": "validation",
        },
        {
            "exam_id": "e4",
            "hall_id": "h4",
            "exam_date": "2025-10-04",
            "exam_subject_code": "CSC202",
            "exam_day_of_week": "Saturday",
            "exam_month": 10,
            "exam_start_hour": 12,
            "exam_duration_minutes": 60,
            "hall_name": "Hall 4",
            "hall_building": "Block B",
            "hall_floor": "Ground",
            "hall_capacity": 50,
            "allocated_count": 40,
            "dominant_program": "BIM",
            "avg_semester": 4.0,
            "avg_seat_row": 3.5,
            "avg_seat_column": 2.0,
            "present_count": 28,
            "absent_count": 12,
            "attendance_rate": 0.65,
            "occupancy_ratio": 0.56,
            "hall_fill_ratio": 0.80,
            "dataset_split": "validation",
        },
        {
            "exam_id": "e5",
            "hall_id": "h5",
            "exam_date": "2025-10-05",
            "exam_subject_code": "CSC301",
            "exam_day_of_week": "Sunday",
            "exam_month": 10,
            "exam_start_hour": 13,
            "exam_duration_minutes": 90,
            "hall_name": "Hall 5",
            "hall_building": "Block C",
            "hall_floor": "First",
            "hall_capacity": 65,
            "allocated_count": 45,
            "dominant_program": "BSc CSIT",
            "avg_semester": 5.0,
            "avg_seat_row": 4.0,
            "avg_seat_column": 3.0,
            "present_count": 30,
            "absent_count": 15,
            "attendance_rate": 0.67,
            "occupancy_ratio": 0.46,
            "hall_fill_ratio": 0.69,
            "dataset_split": "test",
        },
        {
            "exam_id": "e6",
            "hall_id": "h6",
            "exam_date": "2025-10-06",
            "exam_subject_code": "CSC302",
            "exam_day_of_week": "Monday",
            "exam_month": 10,
            "exam_start_hour": 14,
            "exam_duration_minutes": 120,
            "hall_name": "Hall 6",
            "hall_building": "Block C",
            "hall_floor": "Second",
            "hall_capacity": 70,
            "allocated_count": 50,
            "dominant_program": "BCA",
            "avg_semester": 6.0,
            "avg_seat_row": 5.5,
            "avg_seat_column": 3.5,
            "present_count": 38,
            "absent_count": 12,
            "attendance_rate": 0.76,
            "occupancy_ratio": 0.54,
            "hall_fill_ratio": 0.71,
            "dataset_split": "test",
        },
    ]
    return pd.DataFrame(rows)


class TestTrainHallOccupancyModel(unittest.TestCase):
    def test_build_pipeline_excludes_drop_columns(self):
        df = make_dataset()
        pipeline, features = train_model.build_pipeline(df)

        self.assertIn("exam_subject_code", features)
        self.assertIn("allocated_count", features)
        self.assertIn("hall_fill_ratio", features)

        self.assertNotIn("attendance_rate", features)
        self.assertNotIn("dataset_split", features)
        self.assertNotIn("exam_id", features)
        self.assertNotIn("hall_id", features)
        self.assertNotIn("present_count", features)
        self.assertNotIn("absent_count", features)
        self.assertNotIn("occupancy_ratio", features)

        self.assertTrue(hasattr(pipeline, "fit"))

    def test_evaluate_returns_expected_metrics(self):
        y_true = pd.Series([0.8, 0.6, 0.4])
        preds = [0.7, 0.5, 0.6]

        metrics = train_model.evaluate(y_true, preds)

        self.assertEqual(set(metrics.keys()), {"mae", "rmse", "r2"})

        expected_rmse = math.sqrt(((0.1 ** 2) + (0.1 ** 2) + (0.2 ** 2)) / 3)
        self.assertAlmostEqual(metrics["rmse"], expected_rmse, places=6)

    def test_main_raises_when_dataset_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_path = Path(tmpdir) / "missing.csv"

            with patch.object(train_model, "DATA_PATH", missing_path):
                with self.assertRaises(FileNotFoundError):
                    train_model.main()

    def test_main_raises_when_required_columns_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "data.csv"
            pd.DataFrame([{"exam_subject_code": "CSC101"}]).to_csv(csv_path, index=False)

            with patch.object(train_model, "DATA_PATH", csv_path):
                with self.assertRaises(ValueError) as ctx:
                    train_model.main()

            self.assertIn("Missing required column", str(ctx.exception))

    def test_main_raises_when_training_split_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "data.csv"
            df = make_dataset()
            df["dataset_split"] = [
                "validation",
                "validation",
                "validation",
                "validation",
                "test",
                "test",
            ]
            df.to_csv(csv_path, index=False)

            with patch.object(train_model, "DATA_PATH", csv_path):
                with self.assertRaises(ValueError) as ctx:
                    train_model.main()

            self.assertIn("Training split is empty", str(ctx.exception))

    def test_main_creates_model_and_metrics_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            csv_path = base / "data.csv"
            model_path = base / "model.joblib"
            metrics_path = base / "metrics.json"

            make_dataset().to_csv(csv_path, index=False)

            with patch.object(train_model, "DATA_PATH", csv_path), \
                 patch.object(train_model, "MODEL_PATH", model_path), \
                 patch.object(train_model, "METRICS_PATH", metrics_path):
                with redirect_stdout(io.StringIO()):
                    train_model.main()

            self.assertTrue(model_path.exists())
            self.assertTrue(metrics_path.exists())

            payload = json.loads(metrics_path.read_text(encoding="utf-8"))

            self.assertEqual(payload["target"], "attendance_rate")
            self.assertIn("features", payload)
            self.assertGreater(payload["feature_count"], 0)
            self.assertIn("validation", payload["metrics"])
            self.assertIn("test", payload["metrics"])

            for split in ("validation", "test"):
                for metric in ("mae", "rmse", "r2"):
                    self.assertIn(metric, payload["metrics"][split])
                    self.assertIsInstance(payload["metrics"][split][metric], float)


if __name__ == "__main__":
    unittest.main()