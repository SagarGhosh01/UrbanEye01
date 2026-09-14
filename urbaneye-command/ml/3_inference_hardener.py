"""
UrbanEye - Step 3: Inference Pipeline Hardening
Implements:
1. Dynamic Trapezoid Road Surface ROI Filter (rejects off-road/screen false positives)
2. Multi-Frame Temporal IoU Consistency Queue (confirms detections across N consecutive frames)
3. Confidence & NMS threshold tuning (conf=0.45, iou=0.50)
"""

import cv2
import numpy as np
from collections import deque
from typing import List, Dict, Tuple

class HardenedPotholeDetector:
    def __init__(
        self,
        conf_threshold: float = 0.45,
        iou_threshold: float = 0.50,
        temporal_window_size: int = 3,
        min_temporal_confirmations: int = 2,
        roi_top_ratio: float = 0.40,  # Road region starts at 40% from top of camera frame
        roi_bottom_width_pct: float = 0.95,
        roi_top_width_pct: float = 0.50
    ):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.window_size = temporal_window_size
        self.min_confirmations = min_temporal_confirmations
        
        # Geometry ratios for road region trapezoid
        self.roi_top_ratio = roi_top_ratio
        self.roi_bottom_width_pct = roi_bottom_width_pct
        self.roi_top_width_pct = roi_top_width_pct
        
        # Deque for tracking frame-to-frame candidate bounding boxes
        self.frame_history = deque(maxlen=self.window_size)

    def generate_road_roi_mask(self, frame_shape: Tuple[int, int]) -> np.ndarray:
        """
        Creates a binary trapezoid mask isolating the road surface based on camera mounting angle.
        """
        h, w = frame_shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)

        # Trapezoid vertices
        top_y = int(h * self.roi_top_ratio)
        bottom_y = h

        top_w = int(w * self.roi_top_width_pct)
        bottom_w = int(w * self.roi_bottom_width_pct)

        top_x1 = (w - top_w) // 2
        top_x2 = top_x1 + top_w

        bottom_x1 = (w - bottom_w) // 2
        bottom_x2 = bottom_x1 + bottom_w

        pts = np.array([
            [bottom_x1, bottom_y],
            [top_x1, top_y],
            [top_x2, top_y],
            [bottom_x2, bottom_y]
        ], dtype=np.int32)

        cv2.fillPoly(mask, [pts], 255)
        return mask

    def is_inside_road_roi(self, bbox: List[int], roi_mask: np.ndarray) -> bool:
        """
        Checks if the center of the bounding box falls within the road surface ROI mask.
        """
        x1, y1, x2, y2 = bbox
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)

        h, w = roi_mask.shape
        if 0 <= cx < w and 0 <= cy < h:
            return roi_mask[cy, cx] > 0
        return False

    @staticmethod
    def calculate_iou(boxA: List[int], boxB: List[int]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        unionArea = boxAArea + boxBArea - interArea

        return interArea / float(unionArea) if unionArea > 0 else 0.0

    def process_frame_detections(
        self,
        raw_detections: List[Dict],
        frame: np.ndarray
    ) -> List[Dict]:
        """
        Filters raw model detections through ROI road mask and temporal consistency queue.
        raw_detections format: [{'bbox': [x1, y1, x2, y2], 'conf': 0.88, 'class': 'pothole'}]
        """
        roi_mask = self.generate_road_roi_mask(frame.shape)

        # 1. Filter out off-road / screen false positives outside road trapezoid
        valid_roi_boxes = []
        for det in raw_detections:
            if det['conf'] >= self.conf_threshold:
                if self.is_inside_road_roi(det['bbox'], roi_mask):
                    valid_roi_boxes.append(det)

        # 2. Add current frame detections to temporal history queue
        self.frame_history.append(valid_roi_boxes)

        # 3. Multi-frame temporal confirmation
        confirmed_detections = []
        if len(self.frame_history) > 0:
            current_boxes = self.frame_history[-1]
            for c_det in current_boxes:
                matches_in_past_frames = 0
                for past_frame in list(self.frame_history)[:-1]:
                    for p_det in past_frame:
                        if self.calculate_iou(c_det['bbox'], p_det['bbox']) >= 0.30:
                            matches_in_past_frames += 1
                            break

                # Check if detected across min_confirmations out of N frames
                total_hits = 1 + matches_in_past_frames
                if total_hits >= self.min_confirmations:
                    c_det['temporal_score'] = total_hits / len(self.frame_history)
                    confirmed_detections.append(c_det)

        return confirmed_detections


if __name__ == "__main__":
    print("[+] Testing Hardened Pothole Detector (ROI + Temporal Queue)...")
    detector = HardenedPotholeDetector()
    
    # Dummy frame 640x480
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Test box 1 (Inside road ROI)
    road_pothole = {'bbox': [200, 300, 350, 400], 'conf': 0.86, 'class': 'pothole'}
    
    # Test box 2 (Outside road ROI - screen false positive)
    screen_false_pos = {'bbox': [10, 10, 100, 100], 'conf': 0.92, 'class': 'pothole'}
    
    # Simulate Frame 1
    det_f1 = detector.process_frame_detections([road_pothole, screen_false_pos], test_frame)
    print(f"Frame 1 Confirmed Detections: {len(det_f1)} (Screen false positive rejected by ROI!)")
    
    # Simulate Frame 2
    det_f2 = detector.process_frame_detections([road_pothole], test_frame)
    print(f"Frame 2 Confirmed Detections: {len(det_f2)} (Temporal confirmation passed!)")

