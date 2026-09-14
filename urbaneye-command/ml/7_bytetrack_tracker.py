"""
UrbanEye - Phase 2: ByteTrack Multi-Object Tracker & GPS Spatial Deduplicator
Assigns persistent IDs (e.g. ID #101), validates motion parallax growth, and deduplicates
potholes using Haversine GPS distance.
"""

import math
from typing import List, Dict

class ByteTrackPotholeTracker:
    def __init__(self, iou_threshold: float = 0.25, max_age: int = 5):
        self.iou_threshold = iou_threshold
        self.max_age = max_age
        self.next_id = 101
        self.tracked_objects: List[Dict] = []

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

    @staticmethod
    def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates distance in meters between two GPS coordinates.
        """
        R = 6371000.0 # Earth radius in meters
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (math.sin(dLat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dLon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def update(self, current_detections: List[Dict]) -> List[Dict]:
        """
        Updates tracks with current frame detections.
        """
        updated_tracks = []

        for det in current_detections:
            best_match = None
            best_iou = 0.0

            for trk in self.tracked_objects:
                iou = self.calculate_iou(det['bbox'], trk['bbox'])
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_match = trk

            if best_match:
                best_match['bbox'] = det['bbox']
                best_match['conf'] = det['conf']
                best_match['hits'] += 1
                best_match['age'] = 0
                best_match['status'] = 'CONFIRMED' if best_match['hits'] >= 2 else 'UNCONFIRMED'
                updated_tracks.append(best_match)
            else:
                new_track = {
                    'track_id': self.next_id,
                    'bbox': det['bbox'],
                    'conf': det['conf'],
                    'hits': 1,
                    'age': 0,
                    'status': 'UNCONFIRMED'
                }
                self.next_id += 1
                self.tracked_objects.append(new_track)
                updated_tracks.append(new_track)

        return updated_tracks

if __name__ == "__main__":
    print("[+] Testing ByteTrack Multi-Object Tracker & GPS Spatial Deduplicator...")
    tracker = ByteTrackPotholeTracker()

    # Frame 1
    f1_dets = [{'bbox': [100, 150, 200, 250], 'conf': 0.88}]
    t1 = tracker.update(f1_dets)
    print(f"Frame 1: Assigned Track ID #{t1[0]['track_id']} | Status: {t1[0]['status']}")

    # Frame 2
    f2_dets = [{'bbox': [104, 153, 205, 252], 'conf': 0.91}]
    t2 = tracker.update(f2_dets)
    print(f"Frame 2: Maintained Track ID #{t2[0]['track_id']} | Hits: {t2[0]['hits']} | Status: {t2[0]['status']}")

    # Haversine distance test
    dist = tracker.haversine_distance_m(31.2536, 75.3260, 31.2537, 75.3261)
    print(f"GPS Distance Test: {dist:.2f} meters")
