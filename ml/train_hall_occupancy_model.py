import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "ml_hall_occupancy_training.csv"
MODEL_PATH = BASE_DIR / "hall_occupancy_model.joblib"
METRICS_PATH = BASE_DIR / "hall_occupancy_model_metrics.json"

TARGET = "attendance_rate"

DROP_COLS = {
    "exam_id",
    "hall_id",
    "exam_date",
    "present_count",
    "absent_count",
    "occupancy_ratio",
    "attendance_rate",
    "dataset_split",
}


def build_pipeline(df: pd.DataFrame):
    features = [col for col in df.columns if col not in DROP_COLS]

    numeric_features = [
        col for col in features if pd.api.types.is_numeric_dtype(df[col])
    ]
    categorical_features = [col for col in features if col not in numeric_features]

    preprocess = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                    ]
                ),
                numeric_features,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocess", preprocess),
            ("model", model),
        ]
    )

    return pipeline, features


def evaluate(y_true: pd.Series, preds: np.ndarray) -> dict:
    rmse = mean_squared_error(y_true, preds) ** 0.5
    return {
        "mae": float(mean_absolute_error(y_true, preds)),
        "rmse": float(rmse),
        "r2": float(r2_score(y_true, preds)),
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}\n"
            f"Please put ml_hall_occupancy_training.csv inside the ml folder."
        )

    df = pd.read_csv(DATA_PATH)

    required_columns = {"dataset_split", TARGET}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Missing required column(s): {sorted(missing)}")

    train_df = df[df["dataset_split"] == "train"].copy()
    val_df = df[df["dataset_split"] == "validation"].copy()
    test_df = df[df["dataset_split"] == "test"].copy()

    if train_df.empty:
        raise ValueError("Training split is empty.")
    if val_df.empty:
        raise ValueError("Validation split is empty.")
    if test_df.empty:
        raise ValueError("Test split is empty.")

    pipeline, features = build_pipeline(df)

    X_train = train_df[features]
    y_train = train_df[TARGET]

    X_val = val_df[features]
    y_val = val_df[TARGET]

    X_test = test_df[features]
    y_test = test_df[TARGET]

    pipeline.fit(X_train, y_train)

    val_preds = np.clip(pipeline.predict(X_val), 0, 1)
    test_preds = np.clip(pipeline.predict(X_test), 0, 1)

    payload = {
        "target": TARGET,
        "feature_count": len(features),
        "features": features,
        "metrics": {
            "validation": evaluate(y_val, val_preds),
            "test": evaluate(y_test, test_preds),
        },
    }

    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Model saved to: {MODEL_PATH}")
    print(f"Metrics saved to: {METRICS_PATH}")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()