import React, { useState, useEffect } from 'react';
import { CongestionForecastData, RecurringHotspot, UrbanRecommendation } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { Sparkles, TrendingUp, AlertCircle, Wrench, Navigation, CheckCircle2, ArrowRight, ShieldAlert, Clock, MapPin, Zap } from 'lucide-react';

interface PredictiveIntelligenceViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const PredictiveIntelligenceView: React.FC<PredictiveIntelligenceViewProps> = ({ districtId, onSelectOnMap }) => {
  const [forecast, setForecast] = useState<CongestionForecastData | null>(null);
  const [hotspots, setHotspots] = useState<RecurringHotspot[]>([]);
  const [recommendations, setRecommendations] = useState<UrbanRecommendation[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<'min15' | 'min30' | 'min60'>('min15');

  useEffect(() => {
    loadData();
  }, [districtId]);

  const loadData = async () => {
    const forecastRes = await intelligenceService.getCongestionForecast(districtId);
    if (forecastRes.status === 'SUCCESS' && forecastRes.forecast) {
      setForecast(forecastRes.forecast);
    }
    const hotspotsRes = await intelligenceService.getRecurringHotspots(districtId);
    if (hotspotsRes.status === 'SUCCESS') {
      setHotspots(hotspotsRes.hotspots || []);
    }
    const recsRes = await intelligenceService.getRecommendations(districtId);
    if (recsRes.status === 'SUCCESS') {
      setRecommendations(recsRes.recommendations || []);
    }
  };

  const handleExecuteRec = async (rec: UrbanRecommendation) => {
    setExecutingId(rec.id);
    const actionLabel = rec.type === 'WORK_ORDER' ? 'Municipal Work Order' : rec.type === 'TRAFFIC_REROUTE' ? 'Traffic Reroute Dispatch' : 'Safety Intervention';
    const res = await intelligenceService.executeRecommendation(rec.id, actionLabel);
    setExecutingId(null);
    if (res.status === 'SUCCESS') {
      setToastMessage(`✅ Created ${actionLabel}: ${rec.title}`);
      setTimeout(() => setToastMessage(null), 4000);
      loadData();
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔥 CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ HIGH</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">ℹ️ MEDIUM</span>;
    }
  };

  const currentTF = forecast ? forecast[activeTimeframe] : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Predictive Congestion Timeline */}
      <div className="p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              15 / 30 / 60-Minute Congestion Forecasting Engine
            </h3>
            <p className="text-xs text-slate-400">AI predictive traffic density modeling & delay bottleneck trajectory</p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTimeframe('min15')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min15' ? 'bg-[#1E7F73] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              +15 Mins
            </button>
            <button
              onClick={() => setActiveTimeframe('min30')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min30' ? 'bg-[#1E7F73] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              +30 Mins
            </button>
            <button
              onClick={() => setActiveTimeframe('min60')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTimeframe === 'min60' ? 'bg-[#1E7F73] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              +60 Mins
            </button>
          </div>
        </div>

        {currentTF && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Forecasted Density</div>
                <div className="text-2xl font-bold text-white mt-1">{currentTF.predictedDensityPercent}%</div>
                <div className="text-[11px] text-teal-400 font-semibold mt-0.5">{currentTF.trafficLevel} Traffic State</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-teal-500/40 flex items-center justify-center font-bold text-xs text-teal-300">
                {currentTF.predictedDensityPercent}%
              </div>
            </div>

            <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300">Predicted Bottleneck Locations:</div>
              <div className="space-y-1.5">
                {currentTF.predictedBottlenecks.map((btn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-semibold text-slate-200">{btn.location}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 font-semibold">+{btn.expectedDelayMin} min delay</span>
                      <span className="text-teal-400 font-mono text-[11px]">Conf: {(btn.confidence * 100).toFixed(0)}%</span>
                      {onSelectOnMap && (
                        <button
                          onClick={() => onSelectOnMap(btn.lat, btn.lon, btn.location)}
                          className="text-xs text-[#1E7F73] hover:underline font-bold"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Recurring Hotspots & AI UrbanEye Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Defect Hotspots */}
        <div className="p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
          <div>
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              Recurring Defect Hotspots & Priority Scoring
            </h3>
            <p className="text-xs text-slate-400">High-frequency damage sites prioritized for capital PWD overlay</p>
          </div>

          <div className="space-y-3">
            {hotspots.map((hs) => (
              <div key={hs.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-white leading-tight">{hs.locationName}</h4>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Priority: {hs.maintenancePriority.toFixed(0)} / 100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">30-Day Detections:</span>
                    <span className="font-bold text-white ml-1.5">{hs.recurrenceCount} times</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Defect Type:</span>
                    <span className="font-bold text-teal-300 ml-1.5">{hs.primaryDefectType}</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 text-xs text-slate-300 border border-slate-800">
                  <span className="font-bold text-amber-400">Recommended Intervention: </span>
                  {hs.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations Engine */}
        <div className="p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
          <div>
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              AI UrbanEye Recommendations Engine
            </h3>
            <p className="text-xs text-slate-400">Autonomous actionable work-order & traffic dispatch suggestions</p>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-white leading-tight">{rec.title}</h4>
                  {getUrgencyBadge(rec.urgency)}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400 font-mono">
                    Impact: <strong className="text-teal-400">{rec.impactScore}</strong>
                    {rec.estimatedCostINR ? ` • Est. ₹${rec.estimatedCostINR.toLocaleString('en-IN')}` : ''}
                  </span>

                  {rec.status === 'DISPATCHED' ? (
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                    </span>
                  ) : (
                    <button
                      disabled={executingId === rec.id}
                      onClick={() => handleExecuteRec(rec)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#1E7F73] hover:bg-[#186a60] text-white flex items-center gap-1.5 shadow-sm transition active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      {rec.type === 'WORK_ORDER' ? 'Create Work Order' : 'Deploy Action'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
