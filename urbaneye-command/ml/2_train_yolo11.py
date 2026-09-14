"""
UrbanEye - Step 2: YOLOv11x-seg Fine-Tuning & Augmentation Pipeline
Fine-tunes YOLOv11x-seg (or YOLOv11m-seg) on the unified dataset with domain-specific road augmentations
(brightness/contrast jitter, rainy surface simulation, perspective warps, shadow variations).
"""

import sys
import argparse
from pathlib import Path

def train_yolo_pothole_model(
    data_yaml: str = "E:/UrbanEye/Road Defect.v1i.yolov8/data.yaml",
    model_name: str = "yolo11m-seg.pt",  # Or yolo11x-seg.pt for server-side
    epochs: int = 100,
    imgsz: int = 640,
    batch_size: int = 16,
    device: str = "0",  # CUDA device or 'cpu'
):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[-] Error: 'ultralytics' package is required. Install via `pip install ultralytics`.")
        sys.exit(1)

    print(f"[+] Initializing YOLOv11 Fine-Tuning Pipeline...")
    print(f"  * Base Model: {model_name}")
    print(f"  * Dataset Config: {data_yaml}")
    print(f"  * Epochs: {epochs} | Image Size: {imgsz} | Batch Size: {batch_size}")

    model = YOLO(model_name)


    # Fine-tuning parameters optimized for road defect accuracy & false positive suppression
    train_args = {
        'data': data_yaml,
        'epochs': epochs,
        'imgsz': imgsz,
        'batch': batch_size,
        'device': device,
        'project': 'E:/UrbanEye/runs/pothole_yolo11',
        'name': 'yolo11_pothole_run',
        'exist_ok': True,
        'pretrained': True,
        'optimizer': 'AdamW',
        'lr0': 0.001,
        'lrf': 0.01,
        'momentum': 0.937,
        'weight_decay': 0.0005,
        'warmup_epochs': 3.0,
        # Augmentations for real-world driving (rain, shadows, perspective, dirt)
        'hsv_h': 0.015,       # Hue variation
        'hsv_s': 0.7,         # Saturation (wet asphalt reflectivity)
        'hsv_v': 0.4,         # Brightness (shadows, low-light night driving)
        'degrees': 10.0,      # Camera tilt angle
        'translate': 0.1,     # Shaking/vibration
        'scale': 0.5,         # Scale variations (near/far potholes)
        'shear': 2.0,         # Road perspective distortion
        'perspective': 0.0005,# Dashboard mounting perspective
        'flipud': 0.0,        # No upside-down roads
        'fliplr': 0.5,        # Left/right road symmetry
        'mosaic': 1.0,        # Multi-scene mosaic (forces learning complex road background contexts)
        'mixup': 0.15,       # Blends images to prevent overfitting
        'erasing': 0.4,       # Simulates vehicle occlusions & mud patches
        'plots': True,
        'save': True,
    }

    print("[+] Starting Ultralytics fine-tuning process...")
    results = model.train(**train_args)

    print("[+] Training Complete!")
    print(f"[+] Best Model Weights Saved To: {Path('E:/UrbanEye/runs/pothole_yolo11/yolo11_pothole_run/weights/best.pt').absolute()}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UrbanEye YOLOv11 Pothole Training Pipeline")
    parser.add_argument("--data", type=str, default="E:/UrbanEye/Road Defect.v1i.yolov8/data.yaml")
    parser.add_argument("--model", type=str, default="yolo11m-seg.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", type=str, default="cpu")  # Defaults to cpu if CUDA unavailable

    args = parser.parse_args()
    train_yolo_pothole_model(
        data_yaml=args.data,
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        imgsz=args.imgsz,
        device=args.device
    )
