"""
UrbanEye - Test Local YOLOv8 Road Defect Model
===============================================
Runs local inference using the trained Road Defect model on any image.
Displays class predictions (Pothole, Crack, Surface Damage),
confidence scores, and bounding box coordinates.

Usage:
    python test_local_road_model.py --image path/to/road_image.jpg
"""

import os
import sys
import argparse
from pathlib import Path
from ultralytics import YOLO

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[2]
MODEL_PT = ROOT_DIR / "runs" / "detect" / "road_defect_yolov8" / "weights" / "best.pt"
FALLBACK_PT = ROOT_DIR / "runs" / "detect" / "train" / "weights" / "best.pt"

CLASS_MAP = {
    "D00": ("ROAD_CRACK", "Longitudinal Wheel-mark Crack"),
    "D10": ("ROAD_CRACK", "Transverse Crack"),
    "D20": ("ROAD_CRACK", "Alligator / Net Crack"),
    "D40": ("POTHOLE", "Road Cavity Depression"),
    "D43": ("SURFACE_DAMAGE", "Crosswalk / Marking Wear"),
    "D44": ("SURFACE_DAMAGE", "Lane Line Wear"),
    "D50": ("SURFACE_DAMAGE", "Surface Corruption / Utility Cover"),
}

def test_image(image_path, conf_threshold=0.35):
    target_model = MODEL_PT if MODEL_PT.exists() else FALLBACK_PT
    if not target_model.exists():
        print(f"[!] Error: Model checkpoint not found at {target_model}")
        return

    print("=" * 65)
    print("URBANEYE LOCAL MODEL INFERENCE TEST")
    print(f"Model: {target_model}")
    print(f"Input: {image_path}")
    print("=" * 65)

    model = YOLO(str(target_model))
    results = model.predict(source=image_path, conf=conf_threshold, save=True)

    print("\nDETECTION RESULTS:")
    print("-" * 65)
    total_found = 0

    for r in results:
        boxes = r.boxes
        total_found += len(boxes)
        for box in boxes:
            cls_id = int(box.cls[0].item())
            cls_raw_name = r.names[cls_id]
            conf = float(box.conf[0].item())
            xyxy = [round(v, 1) for v in box.xyxy[0].tolist()]

            mapped_type, description = CLASS_MAP.get(cls_raw_name, ("UNKNOWN", cls_raw_name))

            print(f"Class: [{mapped_type}] ({cls_raw_name}: {description})")
            print(f"Confidence: {round(conf * 100, 1)}%")
            print(f"Bounding Box (xyxy): {xyxy}")
            print("-" * 65)

    if total_found == 0:
        print("✓ No defects detected above confidence threshold.")
    else:
        print(f"Total defects identified: {total_found}")
        print(f"Visualized annotated image saved to: {results[0].save_dir}")
    print("=" * 65)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test UrbanEye Local Road Model")
    parser.add_argument("--image", type=str, required=True, help="Path to road photo")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    args = parser.parse_args()

    test_image(args.image, conf_threshold=args.conf)
