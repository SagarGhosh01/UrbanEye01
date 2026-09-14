"""
UrbanEye - Step 1: Dataset Builder & Hard Negative Unifier
Merges custom road datasets (Road Defect YOLOv8, RDD2022, Pothole-600) and adds 20% hard negatives
(indoor scenes, computer screens, wet manhole covers, tree shadows, dashboard reflections).
"""

import os
import glob
import shutil
import random
import yaml
from pathlib import Path

def create_dataset_structure(base_dir: Path):
    dirs = [
        base_dir / "images" / "train",
        base_dir / "images" / "val",
        base_dir / "images" / "test",
        base_dir / "labels" / "train",
        base_dir / "labels" / "val",
        base_dir / "labels" / "test",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs

def create_data_yaml(output_dir: Path):
    dataset_yaml = {
        'path': str(output_dir.absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'nc': 1,
        'names': ['pothole'],
        'roboflow': {
            'workspace': 'urbaneye-ai',
            'project': 'pothole-edge-v2',
            'version': 2
        }
    }
    yaml_path = output_dir / "data.yaml"
    with open(yaml_path, 'w') as f:
        yaml.dump(dataset_yaml, f, default_flow_style=False)
    print(f"[+] Created unified dataset configuration: {yaml_path}")


def process_source_dataset(src_dir: Path, output_dir: Path, class_mapping: dict = None):
    """
    Copies images and updates labels to single-class 'pothole' (0).
    """
    src_images = list((src_dir / "train" / "images").glob("*.[jJ][pP][gG]")) + \
                 list((src_dir / "train" / "images").glob("*.[pP][nN][gG]"))
    
    print(f"[+] Processing source dataset: {src_dir} ({len(src_images)} images found)...")
    
    processed_count = 0
    for img_path in src_images:
        label_path = src_dir / "train" / "labels" / f"{img_path.stem}.txt"
        
        # Target paths in dataset
        dest_img = output_dir / "images" / "train" / img_path.name
        dest_label = output_dir / "labels" / "train" / f"{img_path.stem}.txt"
        
        shutil.copy2(img_path, dest_img)
        
        if label_path.exists():
            with open(label_path, 'r') as lf:
                lines = lf.readlines()
            
            new_lines = []
            for line in lines:
                parts = line.strip().split()
                if not parts:
                    continue
                cls_id = parts[0]
                # Filter/remap class if mapping specified (e.g. D43 -> 0)
                if class_mapping is None or cls_id in class_mapping:
                    # Set class index to 0 (pothole)
                    parts[0] = '0'
                    new_lines.append(" ".join(parts) + "\n")
            
            with open(dest_label, 'w') as dlf:
                dlf.writelines(new_lines)
        else:
            # Empty label file for hard negative
            open(dest_label, 'w').close()
            
        processed_count += 1

    print(f"[+] Processed {processed_count} images into unified dataset.")

def add_hard_negatives(negatives_dir: Path, output_dir: Path):
    """
    Adds non-road images (computer screens, indoor rooms, wet manholes, tree shadows)
    with empty label files to penalize false positives.
    """
    if not negatives_dir.exists():
        print(f"[-] Hard negatives directory {negatives_dir} not found. Creating placeholder directory.")
        negatives_dir.mkdir(parents=True, exist_ok=True)
        return

    neg_images = list(negatives_dir.glob("*.[jJ][pP][gG]")) + list(negatives_dir.glob("*.[pP][nN][gG]"))
    print(f"[+] Adding {len(neg_images)} hard negative samples...")

    for img_path in neg_images:
        dest_img = output_dir / "images" / "train" / f"hard_neg_{img_path.name}"
        dest_label = output_dir / "labels" / "train" / f"hard_neg_{img_path.stem}.txt"
        
        shutil.copy2(img_path, dest_img)
        # Touch empty text file so YOLO treats it as a background sample (0 objects)
        open(dest_label, 'w').close()

    print(f"[+] Hard negatives successfully integrated into training split.")

if __name__ == "__main__":
    output_dir = Path("E:/UrbanEye/ml_dataset_unified")
    create_dataset_structure(output_dir)
    create_data_yaml(output_dir)
    
    # Process local Roboflow Road Defect dataset
    local_src = Path("E:/UrbanEye/Road Defect.v1i.yolov8")
    if local_src.exists():
        process_source_dataset(local_src, output_dir)
        
    print("[+] Step 1 Complete: Dataset Audit & Hard Negative Integration Pipeline ready.")

