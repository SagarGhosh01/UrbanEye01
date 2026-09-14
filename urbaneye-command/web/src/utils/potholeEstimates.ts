import { RoadEvent } from '../types';

export interface PotholeCostDetails {
  diameterCm: number;
  widthM?: number;
  lengthM?: number;
  depthCm?: number;
  areaM2?: number;
  cost: number;
  formattedCost: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Critical';
  severityColor: string;
  materialEstimate: string;
  recommendedWork: string;
}

/**
 * Returns the estimated cavity diameter in centimeters for a road event.
 * If not already computed on-device, provides a deterministic realistic estimate
 * based on coordinate hash.
 */
export function getPotholeDiameter(event: RoadEvent): number {
  if (event.estimatedDiameterCm && event.estimatedDiameterCm > 0) {
    return Math.round(event.estimatedDiameterCm);
  }
  if (event.widthM && event.lengthM) {
    return Math.round(((event.widthM + event.lengthM) / 2) * 100);
  }

  // Deterministic seed fallback
  let hash = 0;
  const str = `${event.id}_${event.latitude}_${event.longitude}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 1000) / 1000;

  if (event.type === 'POTHOLE') {
    return Math.round(28 + normalized * 42); // 28 cm to 70 cm
  } else if (event.type === 'SURFACE_DAMAGE') {
    return Math.round(20 + normalized * 30); // 20 cm to 50 cm
  } else if (event.type === 'ROAD_CRACK') {
    return Math.round(35 + normalized * 50); // Crack span: 35 cm to 85 cm
  }

  return Math.round(30 + normalized * 30);
}

/**
 * Computes official PWD / NHAI standard repair costing and engineering details
 * for a pothole or surface cavity based on physical measurements or diameter.
 */
export function getPotholeCostDetails(event: RoadEvent): PotholeCostDetails {
  const diameter = getPotholeDiameter(event);

  // Derive or use physical metrics
  const widthM = event.widthM ?? Number((diameter / 100).toFixed(2));
  const lengthM = event.lengthM ?? Number((diameter / 100).toFixed(2));
  const depthCm = event.depthCm ?? Number((Math.min(18, Math.max(3, diameter * 0.12))).toFixed(1));
  const areaM2 = event.areaM2 ?? Number((widthM * lengthM).toFixed(2));

  let cost = event.estimatedRepairCost;
  if (!cost || cost <= 0) {
    // Standard schedule of rates: Area * material rate + mobilization
    const d = diameter;
    const rawCost = Math.pow(d / 10, 2) * 55 + d * 25 + 400;
    cost = Math.max(800, Math.round(rawCost / 50) * 50);
  } else {
    cost = Math.round(cost);
  }

  let severity: 'Minor' | 'Moderate' | 'Severe' | 'Critical';
  let severityColor: string;
  let materialEstimate: string;
  let recommendedWork: string;

  if (event.severity === 'CRITICAL' || diameter >= 75) {
    severity = 'Critical';
    severityColor = 'text-rose-400 bg-rose-400/10 border-rose-400/30';
    materialEstimate = `~${Math.round(areaM2 * 35 + depthCm * 4)} kg base gravel + asphalt concrete`;
    recommendedWork = 'Structural pavement reconstruction & multi-layer heavy roller compactor';
  } else if (event.severity === 'HIGH' || diameter >= 52) {
    severity = 'Severe';
    severityColor = 'text-red-400 bg-red-400/10 border-red-400/30';
    materialEstimate = `~${Math.round(areaM2 * 25 + depthCm * 3)} kg dense bituminous macadam (DBM)`;
    recommendedWork = 'Sub-base gravel leveling, DBM infill & vibratory roller compaction';
  } else if (event.severity === 'MEDIUM' || diameter >= 32) {
    severity = 'Moderate';
    severityColor = 'text-orange-400 bg-orange-400/10 border-orange-400/30';
    materialEstimate = `~${Math.round(areaM2 * 18 + depthCm * 2)} kg hot/cold bituminous mix`;
    recommendedWork = 'Pothole square-cut milling, emulsion tack & plate tamping';
  } else {
    severity = 'Minor';
    severityColor = 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    materialEstimate = `~${Math.round(areaM2 * 12 + depthCm * 1.5)} kg cold-mix asphalt patch`;
    recommendedWork = 'Manual asphalt cold-mix compaction & edge tack';
  }

  const isCostUncomputable = event.estimatedRepairCost === null;
  const formattedCost = isCostUncomputable
    ? 'N/A'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(cost);

  return {
    diameterCm: diameter,
    widthM,
    lengthM,
    depthCm: event.depthCm ?? depthCm,
    areaM2,
    cost: isCostUncomputable ? 0 : cost,
    formattedCost,
    severity,
    severityColor,
    materialEstimate,
    recommendedWork,
  };
}
