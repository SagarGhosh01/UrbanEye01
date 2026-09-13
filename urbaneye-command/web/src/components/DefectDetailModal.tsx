import React, { useState, useEffect } from 'react';
import { RoadEvent, EventStatus } from '../types';
import {
  X,
  MapPin,
  Bus,
  Clock,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  FileText,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Trash2,
  Coins,
  Hammer,
} from 'lucide-react';
import { getPotholeCostDetails } from '../utils/potholeEstimates';

interface DefectDetailModalProps {
  event: RoadEvent | null;
  onClose: () => void;
  onUpdateStatus: (eventId: string, status: EventStatus, notes?: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  readOnly?: boolean;
}

export const DefectDetailModal: React.FC<DefectDetailModalProps> = ({
  event,
  onClose,
  onUpdateStatus,
  onDelete,
  readOnly = false,
}) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<EventStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (event) {
      setNotes(event.reviewNotes || '');
      setActionError(null);
      setActionSuccess(null);
    }
  }, [event]);

  if (!event) return null;

  const handleDelete = async () => {
    if (!onDelete || !event) return;
    if (!window.confirm(`Are you sure you want to delete this ${event.type.replace(/_/g, ' ')} defect record?`)) {
      return;
    }
    try {
      setDeleting(true);
      setActionError(null);
      await onDelete(event.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete event:', err);
      setActionError(err.message || 'Failed to delete defect event.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async (targetStatus: EventStatus) => {
    try {
      setSubmitting(true);
      setActiveAction(targetStatus);
      setActionError(null);
      await onUpdateStatus(event.id, targetStatus, notes.trim() ? notes.trim() : undefined);
      setActionSuccess(`Status updated to ${targetStatus.replace(/_/g, ' ')}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Failed to update status from detail panel:', err);
      setActionError(err.message || 'Failed to update status. Please try again.');
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5 animate-ping" />
            NEW DEFECT
          </span>
        );
      case 'ASSIGNED_FOR_REPAIR':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-700 border border-orange-200">
            <Wrench className="w-3 h-3 mr-1" />
            ASSIGNED FOR REPAIR
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            RESOLVED
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-700 border border-blue-200">
            REVIEWED
          </span>
        );
    }
  };

  const imageSrc = event.imageSnippet
    ? event.imageSnippet.startsWith('data:')
      ? event.imageSnippet
      : `data:image/jpeg;base64,${event.imageSnippet}`
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh]">

        {/* Sticky Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {event.type.replace('_', ' ')}
                </h3>
                {getStatusBadge(event.status)}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">ID: {event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close detail modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Image Snippet Preview */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="Defect cropped snapshot"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-xs font-medium">No direct camera crop attached to this event</p>
              </div>
            )}
            <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>{Math.round(event.confidence * 100)}% On-Device AI Conf</span>
            </div>
          </div>

          {/* Telemetry & Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5 mb-1">
                <Bus className="w-3.5 h-3.5 text-blue-600" />
                <span>Reporting Bus</span>
              </span>
              <span className="font-bold text-slate-900 text-sm">{event.busLabel}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Detected At</span>
              </span>
              <span className="font-bold text-slate-900">
                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="block text-[10px] text-slate-400">
                {new Date(event.timestamp).toLocaleDateString()}
              </span>
            </div>

            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium flex items-center justify-between mb-1">
                <span className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  <span>Exact GPS Coordinates</span>
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center space-x-0.5 p-1 min-h-[36px]"
                >
                  <span>Open Map</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {event.latitude.toFixed(6)}° N, {event.longitude.toFixed(6)}° E
              </span>
              {event.district?.name && (
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  District: <strong>{event.district.name}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Pavement Cavity Diameter & PWD Repair Costing Section */}
          {(() => {
            const details = getPotholeCostDetails(event);
            return (
              <div className="bg-amber-500/5 rounded-xl border border-amber-500/25 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold text-xs">
                      Ø
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Cavity Geometry &amp; Repair Estimate</h4>
                      <p className="text-[10px] text-slate-500">Official PWD / NHAI Schedule of Rates Schedule</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${details.severityColor}`}>
                    {details.severity} Pothole
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                      Estimated Diameter
                    </span>
                    <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
                      Ø {details.diameterCm} <span className="text-xs font-semibold text-slate-500 font-sans">cm</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Ground perspective scale</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-xs">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block mb-0.5">
                      Estimated Repair Budget
                    </span>
                    <div className="text-xl font-black text-emerald-600 tracking-tight">
                      {details.formattedCost}
                    </div>
                    <span className="text-[10px] text-slate-400">Material + labor estimate</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 text-[11px] text-slate-600 border-t border-amber-500/15">
                  <div className="flex items-start space-x-1.5">
                    <Hammer className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>Required Work:</strong> {details.recommendedWork}</span>
                  </div>
                  <div className="flex items-start space-x-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Material Infill:</strong> {details.materialEstimate}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Action / Work Order Notes Section */}
          {!readOnly && (
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>PWD Work-Order Reference / Action Notes:</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. WO-PB-2026-402: Dispatched Phagwara PWD Highway Maintenance Sub-division."
                rows={2}
                className="w-full text-base sm:text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          )}

          {/* Feedback messages */}
          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Action Failed</strong>
                <span>{actionError}</span>
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{actionSuccess}</span>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions with Safe Area Inset Support */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3.5">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition min-h-[44px]"
            >
              Close
            </button>
            {onDelete && !readOnly && (
              <button
                onClick={handleDelete}
                disabled={submitting || deleting}
                className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition flex items-center space-x-1.5 disabled:opacity-50 min-h-[44px]"
                title="Remove this test detection event"
              >
                <Trash2 className={`w-3.5 h-3.5 ${deleting ? 'animate-spin' : ''}`} />
                <span>Delete</span>
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center space-x-2">
              {event.status !== 'ASSIGNED_FOR_REPAIR' && event.status !== 'RESOLVED' && (
                <button
                  onClick={() => handleAction('ASSIGNED_FOR_REPAIR')}
                  disabled={submitting}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 min-h-[44px]"
                >
                  <Wrench className={`w-3.5 h-3.5 ${submitting && activeAction === 'ASSIGNED_FOR_REPAIR' ? 'animate-spin' : ''}`} />
                  <span>Assign Work Order</span>
                </button>
              )}

              {event.status !== 'RESOLVED' && (
                <button
                  onClick={() => handleAction('RESOLVED')}
                  disabled={submitting}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#1E7F73] hover:bg-[#186a60] text-white shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 min-h-[44px]"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${submitting && activeAction === 'RESOLVED' ? 'animate-spin' : ''}`} />
                  <span>Mark Resolved</span>
                </button>
              )}

              {event.status === 'RESOLVED' && (
                <button
                  onClick={() => handleAction('NEW')}
                  disabled={submitting}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition min-h-[44px]"
                >
                  Re-open
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
