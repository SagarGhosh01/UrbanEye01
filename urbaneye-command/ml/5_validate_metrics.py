"""
UrbanEye - Step 5: Field Validation & Precision/Recall Benchmark Protocol
Evaluates model precision, recall, mAP@0.5, and inference speed across real test video sequences.
"""

import sys
import time
import argparse
from pathlib import Path

def validate_model_performance(
    model_path: str = "E:/UrbanEye/runs/detect/road_defect_yolov8/weights/best.pt",
    data_yaml: str = "E:/UrbanEye/Road Defect.v1i.yolov8/data.yaml",
    imgsz: int = 640
):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[-] Error: 'ultralytics' package is required.")
        sys.exit(1)

    print(f"[+] Running Field Validation & Accuracy Benchmark...")
    print(f"  * Model Weights: {model_path}")
    print(f"  * Test Dataset: {data_yaml}")

    model = YOLO(model_path)

    start_time = time.time()
    metrics = model.val(data=data_yaml, imgsz=imgsz, split='val', plots=True)
    latency_ms = (time.time() - start_time) * 1000

    print("\n================ OFFICIAL VALIDATION REPORT =================")
    print(f"  * Precision (P):            {metrics.results_dict.get('metrics/precision(B)', 0.0):.4f} (Target: >= 0.95)")
    print(f"  * Recall (R):               {metrics.results_dict.get('metrics/recall(B)', 0.0):.4f} (Target: >= 0.88)")
    print(f"  * mAP@0.5:                  {metrics.results_dict.get('metrics/mAP50(B)', 0.0):.4f} (Target: >= 0.92)")
    print(f"  * mAP@0.5:0.95:             {metrics.results_dict.get('metrics/mAP50-95(B)', 0.0):.4f}")
    print(f"  * Inference Latency:        {latency_ms / max(1, metrics.nt_per_image.sum()):.2f} ms / frame")
    print("=============================================================\n")


    return metrics

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UrbanEye Model Validation Protocol")
    parser.add_argument("--weights", type=str, default="E:/UrbanEye/runs/detect/road_defect_yolov8/weights/best.pt")
    parser.add_argument("--data", type=str, default="E:/UrbanEye/Road Defect.v1i.yolov8/data.yaml")
    args = parser.parse_args()

    validate_model_performance(model_path=args.weights, data_yaml=args.data)
