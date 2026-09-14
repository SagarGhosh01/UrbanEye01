"""
UrbanEye - Phase 2: IMU Accelerometer + Camera Sensor Fusion Engine
Cross-validates visual pothole detections against vertical z-axis G-force acceleration spikes
(delta_a_z > 2.2g) recorded when a vehicle wheel impacts a cavity.
"""

import time
import math
from typing import List, Dict, Optional

class IMUSensorFusionEngine:
    def __init__(
        self,
        wheel_to_camera_distance_m: float = 2.5, # Distance from front camera to front axle
        g_force_threshold: float = 2.2,          # Minimum vertical g-force impulse threshold
        fusion_time_window_ms: float = 350.0      # Expected time window matching speed
    ):
        self.wheel_distance_m = wheel_to_camera_distance_m
        self.g_threshold = g_force_threshold
        self.time_window_ms = fusion_time_window_ms
        
        # Ring buffer for recent IMU z-axis acceleration readings [(timestamp_ms, az_g)]
        self.imu_buffer: List[Dict[str, float]] = []

    def log_imu_sample(self, az_g: float, timestamp_ms: Optional[float] = None):
        """
        Logs incoming accelerometer sample from Android / OBD-II telemetry stream.
        """
        now = timestamp_ms or (time.time() * 1000)
        self.imu_buffer.append({'timestamp_ms': now, 'az_g': az_g})
        
        # Retain last 5 seconds of telemetry samples
        cutoff = now - 5000.0
        self.imu_buffer = [s for s in self.imu_buffer if s['timestamp_ms'] >= cutoff]

    def validate_visual_detection(
        self,
        detection_timestamp_ms: float,
        vehicle_speed_kmh: float
    ) -> Dict[str, any]:
        """
        Cross-validates visual pothole detection against IMU buffer.
        """
        if vehicle_speed_kmh <= 1.0:
            return {
                'fused': False,
                'reason': 'Vehicle stationary (speed <= 1 km/h) - IMU impact invalid',
                'max_g_force': 0.0
            }

        speed_ms = vehicle_speed_kmh / 3.6
        expected_delay_ms = (self.wheel_distance_m / speed_ms) * 1000.0
        expected_impact_time = detection_timestamp_ms + expected_delay_ms

        # Search for G-force spike in expected window [expected_impact_time - window, expected_impact_time + window]
        min_t = expected_impact_time - self.time_window_ms
        max_t = expected_impact_time + self.time_window_ms

        matching_spikes = [
            s for s in self.imu_buffer
            if min_t <= s['timestamp_ms'] <= max_t and abs(s['az_g']) >= self.g_threshold
        ]

        if matching_spikes:
            max_spike = max(matching_spikes, key=lambda s: abs(s['az_g']))
            return {
                'fused': True,
                'reason': f"Matched vertical G-force spike of {max_spike['az_g']:.2f}g",
                'max_g_force': max_spike['az_g'],
                'delay_ms': max_spike['timestamp_ms'] - detection_timestamp_ms
            }

        return {
            'fused': False,
            'reason': 'No matching IMU vertical G-force spike found (likely flat photo/screen trigger)',
            'max_g_force': 0.0
        }

if __name__ == "__main__":
    print("[+] Testing IMU Accelerometer Sensor Fusion Engine...")
    fusion = IMUSensorFusionEngine()

    now = time.time() * 1000
    
    # 1. Simulate visual detection at t=0
    det_time = now
    
    # 2. Simulate IMU wheel impact 250ms later (Vehicle speed 36 km/h = 10 m/s, dist 2.5m = 250ms delay)
    fusion.log_imu_sample(az_g=1.0, timestamp_ms=now + 100)
    fusion.log_imu_sample(az_g=3.4, timestamp_ms=now + 240) # Spike!

    res = fusion.validate_visual_detection(detection_timestamp_ms=det_time, vehicle_speed_kmh=36.0)
    print(f"Fusion Status: {res['fused']} | Reason: {res['reason']}")
