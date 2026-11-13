import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.anomaly_detector import evaluate_synthetic_benchmark


def main():
    metrics = evaluate_synthetic_benchmark()
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
