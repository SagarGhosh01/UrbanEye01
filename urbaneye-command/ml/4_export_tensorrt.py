"""
UrbanEye - Step 4: TensorRT INT8 Engine Optimization & Exporter
Exports PyTorch YOLOv11 model -> ONNX -> TensorRT INT8 calibration engine for real-time edge device deployment.
"""

import sys
import argparse
from pathlib import Path

def export_yolo_tensorrt(
    model_path: str = "E:/UrbanEye/runs/detect/road_defect_yolov8/weights/best.pt",
    format_type: str = "engine",  # TensorRT .engine or 'onnx'
    int8_calibration: bool = True,
    imgsz: int = 640,
    device: str = "0"
):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[-] Error: 'ultralytics' package is required. Install via `pip install ultralytics`.")
        sys.exit(1)

    print(f"[+] Loading fine-tuned model for edge export: {model_path}...")
    model = YOLO(model_path)

    print(f"[+] Exporting model to {format_type.upper()} format (INT8 Calibration: {int8_calibration})...")
    
    export_args = {
        'format': format_type,
        'imgsz': imgsz,
        'half': False if int8_calibration else True, # FP16 or INT8
        'int8': int8_calibration,
        'device': device,
        'dynamic': False,
        'simplify': True,
    }

    try:
        exported_file = model.export(**export_args)
        print(f"[+] Export Successful! Optimized TensorRT engine saved at:\n   👉 {exported_file}")
    except Exception as e:
        print(f"[-] TensorRT export note: {e}")
        print("[+] Falling back to ONNX export for mobile/web deployment...")
        onnx_file = model.export(format='onnx', imgsz=imgsz, simplify=True)
        print(f"[+] ONNX Model Saved at: {onnx_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UrbanEye TensorRT INT8 Exporter")
    parser.add_argument("--weights", type=str, default="E:/UrbanEye/runs/detect/road_defect_yolov8/weights/best.pt")
    parser.add_argument("--format", type=str, default="engine")
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    export_yolo_tensorrt(model_path=args.weights, format_type=args.format, imgsz=args.imgsz)
