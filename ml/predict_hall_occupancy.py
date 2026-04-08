import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    args = parser.parse_args()

    model_path = Path(args.model)

    if not model_path.exists():
        print(json.dumps({"predictions": []}))
        sys.exit(0)

    raw = sys.stdin.read().strip()

    if not raw:
        print(json.dumps({"predictions": []}))
        sys.exit(0)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"predictions": []}))
        sys.exit(0)

    rows = payload.get("rows", [])

    if not rows:
        print(json.dumps({"predictions": []}))
        sys.exit(0)

    try:
        model = joblib.load(model_path)
        df = pd.DataFrame(rows)
        preds = np.clip(model.predict(df), 0, 1)

        output = {
            "predictions": [
                {"attendance_rate": float(value)} for value in preds.tolist()
            ]
        }
        print(json.dumps(output))
    except Exception as error:
        print(json.dumps({"predictions": [], "error": str(error)}))
        sys.exit(0)


if __name__ == "__main__":
    main()