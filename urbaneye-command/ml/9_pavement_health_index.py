"""
UrbanEye - Phase 4: Municipal Pavement Condition Index (PCI) & Configurable Cost Engine
Calculates segment-level road health (0-100 PCI) and configurable PWD SOR repair costs.
"""

from typing import List, Dict

class MunicipalPavementHealthEngine:
    def __init__(
        self,
        rate_bitumen_per_m3: float = 4800.0,   # PWD SOR Bitumen Cold Mix rate per m3
        rate_milling_per_m2: float = 350.0,     # Surface milling rate per m2
        base_mobilization_fee: float = 750.0   # Fixed base setup & labor fee per defect
    ):
        self.rate_bitumen = rate_bitumen_per_m3
        self.rate_milling = rate_milling_per_m2
        self.base_fee = base_mobilization_fee

    def calculate_configurable_repair_cost(
        self,
        area_m2: float,
        depth_cm: float,
        volume_m3: float = None
    ) -> float:
        """
        Calculates PWD SOR repair cost based on material volume, surface milling area, and base fee.
        """
        vol = volume_m3 if volume_m3 is not None else (area_m2 * (depth_cm / 100.0) * 0.70)
        material_cost = vol * self.rate_bitumen
        milling_cost = area_m2 * self.rate_milling
        total = round(material_cost + milling_cost + self.base_fee)
        return float(total)

    def calculate_segment_pci(
        self,
        defects: List[Dict],
        segment_length_km: float = 1.0,
        lane_width_m: float = 3.5
    ) -> Dict[str, any]:
        """
        Calculates Pavement Condition Index (PCI) for a road segment (100 = Pristine, 0 = Failed).
        """
        segment_area_m2 = (segment_length_km * 1000.0) * lane_width_m
        total_defect_area_m2 = sum(d.get('area_m2', 0.5) for d in defects)
        
        severity_weight = sum(
            (1.5 if d.get('severity') == 'CRITICAL' else 1.0) * (d.get('depth_cm', 5.0) / 5.0)
            for d in defects
        )

        deduct_points = (total_defect_area_m2 / segment_area_m2) * 100.0 * 25.0 + (severity_weight * 3.5)
        pci_score = max(0.0, min(100.0, round(100.0 - deduct_points, 1)))

        rating = "EXCELLENT"
        if pci_score < 40.0:
            rating = "POOR / CRITICAL REPAIR REQUIRED"
        elif pci_score < 70.0:
            rating = "FAIR / FAIR MAINTENANCE"
        elif pci_score < 85.0:
            rating = "GOOD"

        return {
            'pci_score': pci_score,
            'rating': rating,
            'pothole_count': len(defects),
            'total_defect_area_m2': round(total_defect_area_m2, 2),
            'est_total_repair_cost': sum(self.calculate_configurable_repair_cost(d.get('area_m2', 0.5), d.get('depth_cm', 5.0)) for d in defects)
        }

if __name__ == "__main__":
    print("[+] Testing Municipal Pavement Condition Index (PCI) & Configurable Cost Engine...")
    engine = MunicipalPavementHealthEngine()

    cost = engine.calculate_configurable_repair_cost(area_m2=1.2, depth_cm=6.5)
    print(f"Configurable PWD SOR Repair Cost (1.2m2, 6.5cm depth): INR {cost:.2f}")

    sample_defects = [
        {'area_m2': 1.2, 'depth_cm': 6.5, 'severity': 'HIGH'},
        {'area_m2': 0.8, 'depth_cm': 8.2, 'severity': 'CRITICAL'},
        {'area_m2': 1.5, 'depth_cm': 7.0, 'severity': 'CRITICAL'},
    ]
    pci_res = engine.calculate_segment_pci(sample_defects)
    print(f"Segment PCI Score: {pci_res['pci_score']} / 100 | Rating: {pci_res['rating']}")
    print(f"Total Segment Repair Estimate: INR {pci_res['est_total_repair_cost']:.2f}")

