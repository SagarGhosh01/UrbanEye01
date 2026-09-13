import React, { useState, useEffect } from 'react';
import { SafetyRiskZone, VRUSafetyStats, SafetyRiskLevel } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { ShieldCheck, School, Users, AlertTriangle, Radio, CheckCircle2, ChevronRight, Zap, BellRing, MapPin } from 'lucide-react';

interface SafetyIntelligenceViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const SafetyIntelligenceView: React.FC<SafetyIntelligenceViewProps> = ({ districtId, onSelectOnMap }) => {
  const [zones, setZones] = useState<SafetyRiskZone[]>([]);
  const [stats, setStats] = useState<VRUSafetyStats>({
    overallVruSafetyScore: 78,
    activeSchoolZonesMonitored: 8,
    nearMissCount24h: 10,
    highRiskCrossingsCount: 3,
    vulnerablePedestriansTracked: 450,
  });
  const [interveningId, setInterveningId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [districtId]);

  const loadData = async () => {
    const zonesRes = await intelligenceService.getSafetyZones(districtId);
    if (zonesRes.status === 'SUCCESS') {
      setZones(zonesRes.zones || []);
    }
    const statsRes = await intelligenceService.getSafetyStats(districtId);
    if (statsRes.status === 'SUCCESS' && statsRes.stats) {
      setStats(statsRes.stats);
    }
  };

  const handleIntervene = async (zone: SafetyRiskZone) => {
    setInterveningId(zone.id);
    const res = await intelligenceService.triggerSafetyIntervention(zone.id, 'AUTOMATED_SAFETY_DISPATCH', zone.suggestedIntervention);
    setInterveningId(null);
    if (res.status === 'SUCCESS') {
      setToastMessage(`⚡ Safety Task Dispatched for ${zone.zoneName}!`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const getRiskBadge = (level: SafetyRiskLevel, score: number) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">🔴 CRITICAL ({score.toFixed(1)})</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">🟠 HIGH ({score.toFixed(1)})</span>;
      case 'MODERATE':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">🟡 MODERATE ({score.toFixed(1)})</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🟢 LOW ({score.toFixed(1)})</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Zap className="w-4 h-4 text-yellow-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">VRU SAFETY SCORE</div>
            <div className="text-2xl font-bold text-teal-400 mt-1">{stats.overallVruSafetyScore} / 100</div>
            <div className="text-[11px] text-teal-300/80 mt-0.5 font-medium">Vulnerable Pedestrian Safety</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">SCHOOL ZONES MONITORED</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{stats.activeSchoolZonesMonitored}</div>
            <div className="text-[11px] text-blue-300/80 mt-0.5 font-medium">Active Perimeter Mesh</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <School className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">NEAR-MISS EVENTS (24H)</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.nearMissCount24h}</div>
            <div className="text-[11px] text-amber-300/80 mt-0.5 font-medium">AI Edge Conflict Detections</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">PEDESTRIANS TRACKED</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{stats.vulnerablePedestriansTracked}</div>
            <div className="text-[11px] text-indigo-300/80 mt-0.5 font-medium">Non-PII Density Stream</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Container: Safety Risk Zones */}
      <div className="p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <School className="w-5 h-5 text-teal-400" />
            Vulnerable Road User (VRU) Safety Risk Engine
          </h3>
          <p className="text-xs text-slate-400">
            Real-time pedestrian density, school zone conflict detection, and non-identifiable safety risk monitoring
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-white leading-tight">{zone.zoneName}</h4>
                  {getRiskBadge(zone.riskLevel, zone.riskScore)}
                </div>

                <div className="text-xs text-slate-400 font-mono">Category: {zone.category}</div>

                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-slate-950/60 text-xs border border-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-400">Pedestrians</div>
                    <div className="font-bold text-slate-100">{zone.pedestrianCount}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400">Near-Misses</div>
                    <div className="font-bold text-amber-400">{zone.nearMissCount}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400">Avg Speed</div>
                    <div className="font-bold text-slate-100">{zone.avgSpeedKmh} km/h</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/20 text-xs text-teal-200">
                  <span className="font-bold text-teal-400">Suggested Action: </span>
                  {zone.suggestedIntervention}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  disabled={interveningId === zone.id}
                  onClick={() => handleIntervene(zone)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-[#1E7F73] hover:bg-[#186a60] text-white flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                  Dispatch Safety Task
                </button>

                {onSelectOnMap && (
                  <button
                    onClick={() => onSelectOnMap(zone.latitude, zone.longitude, zone.zoneName)}
                    className="w-full text-[11px] font-semibold text-center text-slate-400 hover:text-white flex items-center justify-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-teal-400" />
                    Locate Zone on GIS Map
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
