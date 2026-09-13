import React, { useState, useEffect } from 'react';
import { RouteAnalysisResult, analyzeRoute } from '../services/trafficService';
import { useTheme } from '../contexts/ThemeContext';
import {
  X,
  AlertTriangle,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Radio,
  Sliders,
  UserCheck,
  Zap,
  Navigation,
  Check,
} from 'lucide-react';

interface RouteAnalysisModalProps {
  isOpen: boolean;
  routeId: string | null;
  routeName: string | null;
  onClose: () => void;
}

export const RouteAnalysisModal: React.FC<RouteAnalysisModalProps> = ({
  isOpen,
  routeId,
  routeName,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [analysis, setAnalysis] = useState<RouteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !routeId) return;

    async function loadAnalysis() {
      setLoading(true);
      try {
        const res = await analyzeRoute(routeId!, routeName || undefined);
        setAnalysis(res);
      } catch (err) {
        console.error('Failed to load route analysis:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalysis();
  }, [isOpen, routeId, routeName]);

  if (!isOpen) return null;

  const handleActionClick = (actionTitle: string) => {
    setActionSuccess(`Action Triggered: ${actionTitle}`);
    setTimeout(() => {
      setActionSuccess(null);
    }, 3500);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${

        isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg tracking-tight">
                  {routeName || analysis?.routeName || 'Route Congestion Analysis'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                  Active Analysis
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-Time AI Diversion & Dispatch Engine • Segment Tag: {analysis?.junctionTag || 'Junction 04'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {actionSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {loading || !analysis ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Zap className="w-8 h-8 text-teal-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-300">Computing Alternate Route Diversions & Diagnostics...</span>
            </div>
          ) : (
            <>
              {/* Telemetry Summary Bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Current Flow</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-white mt-0.5">{analysis.vehiclesPerMin} <span className="text-xs text-slate-400 font-normal">veh/min</span></div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Speed Delta</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-red-400 mt-0.5">{analysis.currentSpeedKmh} <span className="text-xs text-slate-400 font-normal">/ {analysis.normalSpeedKmh} km/h</span></div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Estimated Delay</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-amber-400 mt-0.5">+{analysis.delayMinutes} <span className="text-xs text-slate-400 font-normal">min</span></div>
                </div>
              </div>

              {/* Section 1: Bottleneck Root Causes & Diagnostics */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Compass className="w-4 h-4 text-teal-400" />
                  <span>AI Congestion Diagnostics & Root Causes</span>
                </div>

                <div className="space-y-2">
                  {analysis.diagnostics.map((diag, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start space-x-3 text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5 ${
                        diag.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : diag.severity === 'HIGH'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {diag.severity}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-200">{diag.factor}</h4>
                        <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{diag.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Recommended Alternate Diversion Routes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Navigation className="w-4 h-4 text-emerald-400" />
                    <span>Recommended Alternate Diversion Routes</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                    Real-time Flow Optimization
                  </span>
                </div>

                <div className="space-y-3">
                  {analysis.recommendedDiversions.map((div) => (
                    <div key={div.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 transition-all space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-sm text-white">{div.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              SAVES {div.estimatedTimeSavedMin} MIN
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Via {div.via} • Extra Distance: +{div.extraDistanceKm} km</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleActionClick(`Route Diversion Applied: ${div.name}`)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#1E7F73] hover:bg-[#186a60] text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply Diversion</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Municipal Traffic Dispatch Actions */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Municipal Traffic Dispatch Controls:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleActionClick('Traffic Warden Dispatched to Junction 04')}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition text-center"
                  >
                    <UserCheck className="w-4 h-4 text-teal-400" />
                    <span>Dispatch Traffic Warden</span>
                    <span className="text-[10px] text-slate-400 font-normal">Manual Signal Control</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionClick('Green Signal Phase Extended by +15s')}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition text-center"
                  >
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Extend Green Light (+15s)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Dynamic Timing Sync</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionClick('Electronic Gantry VMS Alert Broadcasted')}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition text-center"
                  >
                    <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span>Broadcast VMS Alert</span>
                    <span className="text-[10px] text-slate-400 font-normal">Gantry Display Board</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Bus Edge Sensor Sources: {analysis?.sensorDataSources.join(', ') || 'Fleet #24, #31, #42'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
