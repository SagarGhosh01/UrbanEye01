import React, { useState } from 'react';
import { RoadEvent, EventStatus, DefectType } from '../types';
import { Eye, CheckCircle2, Wrench, AlertTriangle, Image as ImageIcon, Trash2, MapPin, Bus, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getCategoryColor, getCategoryDisplayName } from '../constants/detectionCategories';
import { getPotholeCostDetails } from '../utils/potholeEstimates';
import { resolveImageSrc } from '../utils/imageUtils';

interface DefectTableProps {
  events: RoadEvent[];
  onUpdateStatus: (eventId: string, status: EventStatus, notes?: string) => Promise<void>;
  onSelectEvent?: (event: RoadEvent) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onPurgeEvents?: () => Promise<void>;
  isLoading?: boolean;
}

export const DefectTable: React.FC<DefectTableProps> = ({
  events,
  onUpdateStatus,
  onSelectEvent,
  onDeleteEvent,
  onPurgeEvents,
  isLoading = false,
}) => {
  const { isDark } = useTheme();

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [notesModalEvent, setNotesModalEvent] = useState<{ id: string; targetStatus: EventStatus } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  /* ── Theme tokens ── */
  const wrap      = isDark ? 'bg-slate-800 border-slate-700'   : 'bg-white border-slate-200';
  const hdrBg     = isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200';
  const titleClr  = isDark ? 'text-white'    : 'text-slate-900';
  const labelClr  = isDark ? 'text-slate-400' : 'text-slate-600';
  const countBg   = isDark ? 'bg-slate-700 text-slate-300'     : 'bg-slate-200 text-slate-700';
  const inputCls  = isDark
    ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder:text-slate-500 focus:ring-[#1E7F73]'
    : 'bg-white border-slate-300 text-slate-800 focus:ring-slate-800';
  const theadBg   = isDark ? 'bg-slate-900 text-slate-400 border-slate-700'  : 'bg-slate-100 text-slate-700 border-slate-200';
  const rowHover  = isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50';
  const divider   = isDark ? 'divide-slate-700' : 'divide-slate-100';
  const cellMain  = isDark ? 'text-slate-200' : 'text-slate-900';
  const cellSub   = isDark ? 'text-slate-500' : 'text-slate-500';
  const cellMono  = isDark ? 'text-slate-400' : 'text-slate-600';
  const thumbBg   = isDark ? 'bg-slate-700 border-slate-600 text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-400';
  const actionBtn = isDark
    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700';
  const emptyClr  = isDark ? 'text-slate-500' : 'text-slate-400';
  const emptyIcon = isDark ? 'text-slate-600' : 'text-slate-300';

  /* ── Filtering ── */
  const filteredEvents = events.filter((e) => {
    if (selectedStatus !== 'ALL' && e.status !== selectedStatus) return false;
    if (selectedType !== 'ALL' && e.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !e.busLabel.toLowerCase().includes(q) &&
        !(e.district?.name.toLowerCase().includes(q)) &&
        !e.type.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  /* ── Status change ── */
  const handleStatusClick = (eventId: string, targetStatus: EventStatus) => {
    setNotesModalEvent({ id: eventId, targetStatus });
    setReviewNote('');
    setModalError(null);
  };

  const submitStatusChange = async () => {
    if (!notesModalEvent) return;
    try {
      setActionLoadingId(notesModalEvent.id);
      setModalError(null);
      await onUpdateStatus(notesModalEvent.id, notesModalEvent.targetStatus, reviewNote);
      setNotesModalEvent(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  /* ── Badges ── */
  const getStatusBadge = (status: EventStatus) => {
    if (isDark) {
      switch (status) {
        case 'NEW':
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-900/50 text-red-300 border border-red-700">NEW ALERT</span>;
        case 'REVIEWED':
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">REVIEWED</span>;
        case 'ASSIGNED_FOR_REPAIR':
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-900/50 text-amber-300 border border-amber-700">ASSIGNED REPAIR</span>;
        case 'RESOLVED':
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700">RESOLVED</span>;
      }
    }
    switch (status) {
      case 'NEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">NEW ALERT</span>;
      case 'REVIEWED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">REVIEWED</span>;
      case 'ASSIGNED_FOR_REPAIR':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">ASSIGNED REPAIR</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">RESOLVED</span>;
    }
  };

  /**
   * Config-driven type badge — colors sourced from detectionCategories.ts.
   * No hex values are hardcoded here; adding a new category to the config
   * automatically gives it the correct badge color in this table.
   */
  const getTypeBadge = (type: DefectType) => {
    const hex = getCategoryColor(type);
    const label = getCategoryDisplayName(type);
    // Derive a subtle translucent background from the category hex
    const bgAlpha = isDark ? '22' : '18'; // ~13% opacity hex suffix
    return (
      <span
        className="font-semibold px-2 py-0.5 rounded text-xs"
        style={{
          color: hex,
          backgroundColor: `${hex}${bgAlpha}`,
          border: `1px solid ${hex}55`,
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${wrap}`}>
      {/* ── Header Controls ──────────────────────────────────── */}
      <div className={`p-3.5 sm:p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${hdrBg}`}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
          <h3 className={`text-sm font-bold tracking-tight ${titleClr}`}>Edge-AI Detection Register</h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${countBg}`}>
            {filteredEvents.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Search bus, route, defect..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full sm:w-auto px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 text-base sm:text-xs min-h-[40px] ${inputCls}`}
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={`flex-1 sm:flex-initial px-2.5 py-2 border rounded-lg focus:outline-none focus:ring-1 text-xs min-h-[40px] cursor-pointer ${inputCls}`}
              style={{ backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
            >
              <option value="ALL">All Defect Types</option>
              <option value="POTHOLE">Potholes</option>
              <option value="ROAD_CRACK">Road Cracks</option>
              <option value="SURFACE_DAMAGE">Surface Wear</option>
              <option value="WATERLOGGING">Waterlogging</option>
              <option value="VEHICLE_FLOW">Vehicle Flow</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`flex-1 sm:flex-initial px-2.5 py-2 border rounded-lg focus:outline-none focus:ring-1 font-medium text-xs min-h-[40px] cursor-pointer ${inputCls}`}
              style={{ backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="ASSIGNED_FOR_REPAIR">Assigned</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
          {onPurgeEvents && events.length > 0 && (
            <button
              onClick={() => setIsPurgeModalOpen(true)}
              className="px-3 py-2 border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold flex items-center space-x-1 transition min-h-[40px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Events</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 1. MOBILE CARD-PER-DEFECT LIST (< md) ────────────────── */}
      <div className="md:hidden divide-y divide-slate-700/60 max-h-[560px] overflow-y-auto p-2.5 space-y-2.5">
        {isLoading ? (
          <div className={`text-center py-10 ${emptyClr}`}>
            <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 mb-2 ${isDark ? 'border-slate-400' : 'border-slate-700'}`} />
            <div>Syncing real-time detection events...</div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={`text-center py-12 px-4 ${emptyClr}`}>
            <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${emptyIcon}`} />
            <p className="font-medium text-xs">No detection events recorded for this district.</p>
            <p className={`text-[11px] mt-1 ${emptyClr}`}>
              Mount phone in bus, open UrbanEye Mobile, and pair using the 6-digit PIN.
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onSelectEvent?.(event)}
              className={`p-3.5 rounded-xl border transition cursor-pointer active:scale-[0.99] ${
                isDark ? 'bg-slate-900/60 border-slate-700 hover:bg-slate-750' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              {/* Card Top: Thumbnail + Type Badge + Status Pill */}
              <div className="flex items-start space-x-3 mb-2.5">
                {event.imageSnippet ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(event.imageSnippet || null);
                    }}
                    className="w-16 h-14 rounded-lg overflow-hidden border border-slate-600 bg-slate-800 shrink-0 relative group"
                  >
                    <img
                      src={resolveImageSrc(event.imageSnippet) || ''}
                      alt="Crop"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-70">
                      <Eye className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className={`w-16 h-14 rounded-lg border border-dashed flex items-center justify-center shrink-0 ${thumbBg}`}>
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex flex-col">
                      <div>{getTypeBadge(event.type)}</div>
                      <span className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {Math.round(event.confidence * 100)}% on-device AI conf
                      </span>
                    </div>
                    {getStatusBadge(event.status)}
                  </div>

                  {/* Pothole Cavity Diameter & Repair Price Pill */}
                  {(() => {
                    const details = getPotholeCostDetails(event);
                    return (
                      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-700/50 text-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-extrabold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30 text-[11px]">
                            Ø {details.diameterCm} cm
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${details.severityColor}`}>
                            {details.severity}
                          </span>
                        </div>
                        <div className="text-right flex items-center space-x-1">
                          <span className="text-[10px] text-slate-400">Fix Est:</span>
                          <span className="font-black text-emerald-400 text-xs">{details.formattedCost}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Card Middle: Telemetry info */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-slate-300 mb-2.5">
                <div className="flex items-center space-x-1.5 truncate">
                  <Bus className="w-3.5 h-3.5 text-[#1E7F73] shrink-0" />
                  <span className="truncate">Bus: <strong>{event.busLabel}</strong></span>
                </div>
                <div className="flex items-center space-x-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="col-span-2 flex items-center space-x-1.5 font-mono text-[10px] text-slate-400 truncate">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</span>
                  {event.speed !== null && event.speed !== undefined && (
                    <span className="text-slate-500">· {Math.round(event.speed)} km/h</span>
                  )}
                </div>
              </div>

              {event.reviewNotes && (
                <div className="text-[10px] text-slate-400 mb-2.5 italic truncate bg-slate-800/60 px-2 py-1 rounded">
                  Note: {event.reviewNotes}
                </div>
              )}

              {/* Card Bottom: Actions with min 44px height */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent?.(event);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 min-h-[44px] transition ${actionBtn}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Action Panel →</span>
                </button>

                {event.status === 'NEW' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusClick(event.id, 'REVIEWED');
                    }}
                    disabled={actionLoadingId === event.id}
                    className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white min-h-[44px] transition"
                  >
                    Review
                  </button>
                )}

                {(event.status === 'NEW' || event.status === 'REVIEWED') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusClick(event.id, 'ASSIGNED_FOR_REPAIR');
                    }}
                    disabled={actionLoadingId === event.id}
                    className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-[#10233D] hover:bg-slate-800 text-white flex items-center space-x-1 min-h-[44px] transition"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Assign</span>
                  </button>
                )}

                {event.status === 'ASSIGNED_FOR_REPAIR' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusClick(event.id, 'RESOLVED');
                    }}
                    disabled={actionLoadingId === event.id}
                    className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-[#1E7F73] hover:bg-[#186a60] text-white flex items-center space-x-1 min-h-[44px] transition"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Resolve</span>
                  </button>
                )}

                {onDeleteEvent && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete this ${event.type.replace(/_/g, ' ')} defect record?`)) {
                        try {
                          setDeletingId(event.id);
                          await onDeleteEvent(event.id);
                        } finally {
                          setDeletingId(null);
                        }
                      }
                    }}
                    disabled={deletingId === event.id}
                    className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/30 border border-transparent min-w-[44px] min-h-[44px] flex items-center justify-center transition"
                    title="Delete record"
                    aria-label="Delete record"
                  >
                    <Trash2 className={`w-4 h-4 ${deletingId === event.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 2. DESKTOP / TABLET DATA TABLE (md+) ───────────────────── */}
      <div className="hidden md:block overflow-x-auto max-h-[460px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`font-semibold sticky top-0 border-b z-10 ${theadBg}`}>
            <tr>
              <th className="py-2.5 px-3 w-16">Thumbnail</th>
              <th className="py-2.5 px-3">Type &amp; Confidence</th>
              <th className="py-2.5 px-3">Est. Cavity Size &amp; Fix Price</th>
              <th className="py-2.5 px-3">Bus Unit</th>
              <th className="py-2.5 px-3">Coordinates (Lat, Lon)</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Officer Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${divider}`}>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={`text-center py-10 ${emptyClr}`}>
                  <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 mb-2 ${isDark ? 'border-slate-400' : 'border-slate-700'}`} />
                  <div>Syncing real-time detection events...</div>
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className={`text-center py-12 ${emptyClr}`}>
                  <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${emptyIcon}`} />
                  <p className="font-medium">No detection events recorded for this district yet.</p>
                  <p className={`text-[11px] mt-1 ${emptyClr}`}>
                    Mount phone in bus, open UrbanEye Mobile, and pair using the 6-digit PIN.
                  </p>
                </td>
              </tr>
            ) : (
              filteredEvents.map((event) => (
                <tr key={event.id} className={`transition ${rowHover}`}>
                  {/* Thumbnail */}
                  <td className="py-2 px-3">
                    {event.imageSnippet ? (
                      <button
                        onClick={() => setPreviewImage(event.imageSnippet || null)}
                        className="relative group w-14 h-10 rounded border border-slate-600/50 overflow-hidden bg-slate-700 block"
                      >
                        <img
                          src={resolveImageSrc(event.imageSnippet) || ''}
                          alt="Crop"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className={`w-14 h-10 rounded border border-dashed flex items-center justify-center ${thumbBg}`}>
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>

                  {/* Type & Confidence */}
                  <td className="py-2 px-3">
                    <div className="flex flex-col space-y-1">
                      <div>{getTypeBadge(event.type)}</div>
                      <div className={`text-[11px] font-medium ${cellSub}`}>
                        Conf: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{Math.round(event.confidence * 100)}%</strong>
                      </div>
                    </div>
                  </td>

                  {/* Est. Cavity Size & Fix Price */}
                  <td className="py-2 px-3">
                    {(() => {
                      const details = getPotholeCostDetails(event);
                      return (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                              Ø {details.diameterCm} cm
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${details.severityColor}`}>
                              {details.severity}
                            </span>
                          </div>
                          <div className="text-xs font-black text-emerald-400 flex items-center">
                            <span className="text-[10px] text-slate-400 mr-1 font-normal">Fix:</span>
                            {details.formattedCost}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Bus Unit */}
                  <td className="py-2 px-3">
                    <div className={`font-medium ${cellMain}`}>{event.busLabel}</div>
                    <div className={`text-[10px] ${cellSub}`}>{event.district?.name}</div>
                  </td>

                  {/* Coordinates */}
                  <td className={`py-2 px-3 font-mono text-[11px] ${cellMono}`}>
                    <div>{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</div>
                    {event.speed !== null && event.speed !== undefined && (
                      <div className={`text-[10px] ${cellSub}`}>Speed: {Math.round(event.speed)} km/h</div>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className={`py-2 px-3 text-[11px] ${cellMono}`}>
                    <div>{new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div className={`text-[10px] ${cellSub}`}>{new Date(event.timestamp).toLocaleDateString()}</div>
                  </td>

                  {/* Status */}
                  <td className="py-2 px-3">
                    {getStatusBadge(event.status)}
                    {event.reviewNotes && (
                      <div className={`text-[10px] mt-0.5 truncate max-w-[130px] ${cellSub}`} title={event.reviewNotes}>
                        Note: {event.reviewNotes}
                      </div>
                    )}
                  </td>

                  {/* Officer Actions */}
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex items-center space-x-1">
                      {onSelectEvent && (
                        <button
                          onClick={() => onSelectEvent(event)}
                          className={`px-2 py-1 text-[11px] font-semibold rounded transition ${actionBtn}`}
                        >
                          Details
                        </button>
                      )}
                      {event.status === 'NEW' && (
                        <button
                          onClick={() => handleStatusClick(event.id, 'REVIEWED')}
                          disabled={actionLoadingId === event.id}
                          className={`px-2 py-1 text-[11px] font-semibold rounded transition ${actionBtn}`}
                        >
                          Review
                        </button>
                      )}
                      {(event.status === 'NEW' || event.status === 'REVIEWED') && (
                        <button
                          onClick={() => handleStatusClick(event.id, 'ASSIGNED_FOR_REPAIR')}
                          disabled={actionLoadingId === event.id}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[#10233D] hover:bg-slate-800 text-white transition flex items-center space-x-1 shadow-sm"
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          <span>Assign</span>
                        </button>
                      )}
                      {event.status === 'ASSIGNED_FOR_REPAIR' && (
                        <button
                          onClick={() => handleStatusClick(event.id, 'RESOLVED')}
                          disabled={actionLoadingId === event.id}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[#1E7F73] hover:bg-[#186a60] text-white transition flex items-center space-x-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          <span>Resolve</span>
                        </button>
                      )}
                      {event.status === 'RESOLVED' && (
                        <span className="text-[11px] text-emerald-500 font-semibold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Closed
                        </span>
                      )}
                      {onDeleteEvent && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Delete this ${event.type.replace(/_/g, ' ')} defect record?`)) {
                              try {
                                setDeletingId(event.id);
                                await onDeleteEvent(event.id);
                              } finally {
                                setDeletingId(null);
                              }
                            }
                          }}
                          disabled={deletingId === event.id}
                          className={`p-1 rounded transition ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/30' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingId === event.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Status Note Modal ─────────────────────────────────── */}
      {notesModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full p-5 border transition-colors pb-[calc(1.25rem+env(safe-area-inset-bottom))] ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}>
            <h4 className={`text-sm font-bold mb-1 ${titleClr}`}>
              Update Defect Status: <span className="text-[#1E7F73]">{notesModalEvent.targetStatus.replace('_', ' ')}</span>
            </h4>
            <p className={`text-xs mb-3 ${labelClr}`}>
              Add engineering notes or contractor dispatch details for the official audit trail.
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Work order #402 dispatched to PWD Ward 14 road crew..."
              rows={3}
              className={`w-full text-base sm:text-xs p-2.5 border rounded-lg focus:outline-none focus:ring-1 mb-3 ${isDark ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder:text-slate-500 focus:ring-[#1E7F73]' : 'border-slate-300 focus:ring-blue-600'}`}
            />
            {modalError && (
              <div className="mb-3 p-2.5 rounded-md bg-red-500/10 border border-red-500/40 text-red-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="flex justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setNotesModalEvent(null)}
                className={`px-4 py-2.5 rounded-lg border font-medium min-h-[44px] ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStatusChange}
                disabled={actionLoadingId !== null}
                className="px-4 py-2.5 rounded-lg bg-[#1E7F73] hover:bg-[#186a60] text-white font-semibold min-h-[44px]"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Purge Modal ───────────────────────────────────────── */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full p-5 border pb-[calc(1.25rem+env(safe-area-inset-bottom))] ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}>
            <div className="flex items-center space-x-3 mb-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${titleClr}`}>Clear Test Detections?</h4>
                <p className={`text-xs ${labelClr}`}>Purge recorded edge events from this register</p>
              </div>
            </div>
            <p className={`text-xs mb-4 p-3 rounded-lg border ${isDark ? 'text-slate-300 bg-slate-900/50 border-slate-700' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
              Are you sure? This will delete <strong>{events.length} defect records</strong> so you can start clean with fresh bus camera streams.
            </p>
            <div className="flex justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={purging}
                className={`px-4 py-2.5 rounded-lg border font-medium min-h-[44px] ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!onPurgeEvents) return;
                  try { setPurging(true); await onPurgeEvents(); setIsPurgeModalOpen(false); }
                  finally { setPurging(false); }
                }}
                disabled={purging}
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center space-x-1.5 disabled:opacity-50 min-h-[44px]"
              >
                <Trash2 className={`w-4 h-4 ${purging ? 'animate-spin' : ''}`} />
                <span>{purging ? 'Clearing...' : 'Yes, Clear All Events'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className={`max-w-2xl w-full rounded-xl p-3 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`flex justify-between items-center px-2 py-1 text-xs font-semibold border-b mb-2 ${isDark ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-100'}`}>
              <span>Edge-AI Camera Frame Snippet</span>
              <button onClick={() => setPreviewImage(null)} className={`text-base font-bold min-w-[32px] min-h-[32px] flex items-center justify-center ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>✕</button>
            </div>
            <img
              src={resolveImageSrc(previewImage) || ''}
              alt="Road Defect Capture"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
