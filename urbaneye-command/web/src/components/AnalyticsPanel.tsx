import React from 'react';
import { AnalyticsStats } from '../types';
import { Activity, AlertCircle, CheckCircle2, Wrench, Bus, ShieldCheck, IndianRupee } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface AnalyticsPanelProps {
  stats: AnalyticsStats | null;
  districtName?: string;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, districtName }) => {
  const { isDark } = useTheme();

  if (!stats) return null;

  const cardBase = isDark
    ? 'bg-[#0B1C33]/90 border-slate-700/80 hover:border-teal-500/40 hover:shadow-[0_0_20px_rgba(30,127,115,0.15)] backdrop-blur-md'
    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm';

  const labelClr   = isDark ? 'text-slate-300 font-semibold' : 'text-slate-700 font-semibold';
  const hintClr    = isDark ? 'text-slate-400' : 'text-slate-500';
  const numClr     = isDark ? 'text-white'     : 'text-slate-900';
  const trackClr   = isDark ? 'bg-slate-800'   : 'bg-slate-100';
  const targetClr  = isDark ? 'text-slate-400' : 'text-slate-600';
  const borderDivider = isDark ? 'border-slate-700/60' : 'border-slate-100';

  const getHealthMeta = (score: number) => {
    if (score >= 80) {
      return {
        text: 'text-[#2dd4bf]',
        bar: 'bg-gradient-to-r from-[#1E7F73] to-teal-400',
        badgeBg: isDark
          ? 'bg-teal-950/80 text-teal-300 border-teal-700/70 shadow-[0_0_10px_rgba(45,212,191,0.15)]'
          : 'bg-teal-50 text-teal-800 border-teal-200',
        label: 'OPTIMAL HEALTH',
        summary: 'Pavement integrity meets target standard',
      };
    }
    if (score >= 60) {
      return {
        text: 'text-amber-400',
        bar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
        badgeBg: isDark
          ? 'bg-amber-950/80 text-amber-300 border-amber-700/70'
          : 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'MODERATE WEAR',
        summary: 'Early defect cluster accumulation detected',
      };
    }
    return {
      text: 'text-red-400',
      bar: 'bg-gradient-to-r from-red-600 to-rose-400',
      badgeBg: isDark
        ? 'bg-red-950/80 text-red-300 border-red-700/70'
        : 'bg-red-50 text-red-800 border-red-200',
      label: 'CRITICAL ATTENTION',
      summary: 'Significant pavement degradation requiring intervention',
    };
  };

  const health = getHealthMeta(stats.roadHealthScore);
  const cleanDistrictName = (districtName || 'District').replace(/\s*\(.*?\)/g, '').trim();
  const formattedFare = stats.totalRepairCost && stats.totalRepairCost > 0
    ? `₹${stats.totalRepairCost.toLocaleString('en-IN')}`
    : '₹0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 mb-4 sm:mb-5">
      {/* 1. HERO KPI: Road Health Index */}
      <div className={`lg:col-span-4 rounded-xl border p-4 sm:p-5 shadow-lg flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${cardBase}`}>
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E7F73] via-teal-400 to-emerald-400" />
        
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider ${labelClr}`}>
                <Activity className={`w-3.5 h-3.5 ${isDark ? 'text-teal-300' : 'text-teal-600'}`} />
                <span>Road Health Index</span>
              </div>
              <p className={`text-[11px] mt-0.5 ${hintClr}`}>
                Primary jurisdiction condition metric
              </p>
            </div>
            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${health.badgeBg}`}>
              {health.label}
            </span>
          </div>

          {/* Hero Score & Total Repair Fare Pill */}
          <div className="my-3 flex items-baseline justify-between flex-wrap gap-2">
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight font-mono ${health.text}`}>
                {stats.roadHealthScore}
              </span>
              <span className={`text-sm font-bold ${hintClr}`}>/ 100</span>
            </div>

            {/* Total Repair Fare Pill */}
            <div className={`px-2.5 py-1 rounded-lg border text-xs flex items-center space-x-1 font-mono font-bold ${
              isDark ? 'bg-slate-800/80 border-slate-700 text-teal-300' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`} title="Total estimated repair cost for all reported defects">
              <IndianRupee className="w-3 h-3 text-teal-400 shrink-0" />
              <span>Est. Repair Fare: {formattedFare}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Summary */}
        <div className="pt-2">
          <div className={`w-full h-2 rounded-full overflow-hidden mb-2 shadow-inner ${trackClr}`}>
            <div
              className={`h-full ${health.bar} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.max(stats.roadHealthScore, 5)}%` }}
            />
          </div>
          <div className={`flex items-center justify-between text-[11px] font-medium ${hintClr}`}>
            <span className="truncate mr-2">{health.summary}</span>
            <span className={`font-semibold shrink-0 ${targetClr}`}>Target: 80+</span>
          </div>
        </div>
      </div>

      {/* 2. SECONDARY METRICS: 4 equal-height cards spanning top-to-bottom without awkward bottom gaps */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Metric A: New Defects */}
        <div className={`h-full rounded-xl border p-4 shadow-lg flex flex-col justify-between transition-all duration-300 ${
          isDark ? 'bg-[#0B1C33]/90 border-red-900/50 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)] backdrop-blur-md' : 'bg-white border-red-200 hover:border-red-300 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={labelClr}>New Defects</span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="my-auto py-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight font-mono text-red-400">
              {stats.byStatus.new}
            </span>
          </div>

          <div className={`pt-2.5 border-t ${borderDivider} flex items-center justify-between text-[11px] font-medium ${hintClr}`}>
            <span>Pending review</span>
            {stats.byStatus.new > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            ) : (
              <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">Clear</span>
            )}
          </div>
        </div>

        {/* Metric B: Assigned */}
        <div className={`h-full rounded-xl border p-4 shadow-lg flex flex-col justify-between transition-all duration-300 ${cardBase}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={labelClr}>Assigned</span>
            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-100 text-slate-600'}`}>
              <Wrench className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="my-auto py-2">
            <span className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${numClr}`}>
              {stats.byStatus.assigned}
            </span>
          </div>

          <div className={`pt-2.5 border-t ${borderDivider} flex items-center justify-between text-[11px] font-medium ${hintClr}`}>
            <span>Work orders open</span>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Active</span>
          </div>
        </div>

        {/* Metric C: Resolved */}
        <div className={`h-full rounded-xl border p-4 shadow-lg flex flex-col justify-between transition-all duration-300 ${cardBase}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={labelClr}>Resolved</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="my-auto py-2">
            <span className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${numClr}`}>
              {stats.byStatus.resolved}
            </span>
          </div>

          <div className={`pt-2.5 border-t ${borderDivider} flex items-center justify-between text-[11px] font-medium ${hintClr}`}>
            <span>Repaired &amp; verified</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          </div>
        </div>

        {/* Metric D: Bus Sensors */}
        <div className={`h-full rounded-xl border p-4 shadow-lg flex flex-col justify-between transition-all duration-300 ${cardBase}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={labelClr}>Bus Sensors</span>
            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-700'}`}>
              <Bus className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="my-auto py-2 flex items-baseline justify-between">
            <span className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${numClr}`}>
              {stats.activeBusesCount}
            </span>
            <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 rounded-full flex items-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5 animate-pulse" />
              Live
            </span>
          </div>

          <div className={`pt-2.5 border-t ${borderDivider} flex items-center justify-between text-[11px] font-medium ${hintClr}`} title={`${cleanDistrictName} fleet`}>
            <span className="truncate">{cleanDistrictName} fleet</span>
          </div>
        </div>

      </div>
    </div>
  );
};
