"""
UrbanEye - Train YOLOv8 on Local Road Defect Dataset
====================================================
Dataset: C:/Users/sarka/OneDrive/Documents/Codes/Projects/UrbanEye + App/Road Defect.v1i.yolov8
Classes: ['D00', 'D10', 'D20', 'D40', 'D43', 'D44', 'D50']
- D40: Pothole
- D00, D10, D20: Cracks
- D43, D44, D50: Surface Damage
"""

import os
import sys
import time
from pathlib import Path
from ultralytics import YOLO

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[2]
DATASET_DIR = ROOT_DIR / "Road Defect.v1i.yolov8"
DATA_YAML = DATASET_DIR / "data.yaml"

# Target ONNX destination in Android assets
ANDROID_ASSETS_MODEL = ROOT_DIR / "urbaneye-mobile" / "app" / "src" / "main" / "assets" / "models" / "road_defect_detector.onnx"

def main():
    print("=" * 65)
    print("URBANEYE ROAD DEFECT YOLOV8 MODEL TRAINING")
    print(f"Dataset Path: {DATASET_DIR}")
    print(f"Config YAML: {DATA_YAML}")
    print("=" * 65)

    # 1. Initialize YOLOv8n (nano architecture, edge-mobile friendly)
    model = YOLO("yolov8n.pt")

    # 2. Train on the local Roboflow dataset
    # 15 epochs provides solid transfer learning convergence for road defects on CPU
    epochs = 15
    batch_size = 16
    img_size = 320

    print(f"[*] Training for {epochs} epochs at {img_size}x{img_size}...")
    start_time = time.time()

    model.train(
        data=str(DATA_YAML),
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        workers=2,
        device="cpu",
        patience=8,
        save=True,
        plots=False,
        name="road_defect_yolov8"
    )

    elapsed = round((time.time() - start_time) / 60, 2)
    print(f"\n[✓] Training complete in {elapsed} minutes!")

    # 3. Export to ONNX (opset 12, static shape for mobile NPU/CPU)
    best_weights = model.trainer.save_dir / "weights" / "best.pt"
    print(f"[*] Best PyTorch checkpoint: {best_weights}")
    print(f"[*] Exporting to ONNX Runtime Mobile format ({img_size}x{img_size}, opset 12)...")

    onnx_file = model.export(
        format="onnx",
        imgsz=img_size,
        opset=12,
        simplify=True,
        dynamic=False
    )
    print(f"[✓] Exported ONNX to: {onnx_file}")

    # 4. Copy to Android mobile assets
    ANDROID_ASSETS_MODEL.parent.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(onnx_file, ANDROID_ASSETS_MODEL)
    print(f"[✓] Copied new model to Android assets: {ANDROID_ASSETS_MODEL}")
    print(f"    File size: {round(os.path.getsize(ANDROID_ASSETS_MODEL) / (1024 * 1024), 2)} MB")
    print("=" * 65)

if __name__ == "__main__":
    main()
