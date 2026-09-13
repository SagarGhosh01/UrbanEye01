import React, { useState, useEffect } from 'react';
import { IncidentRecord, TrackedVehicle, AlertStatus, IncidentCategory } from '../types';
import { intelligenceService } from '../services/intelligenceService';
import { AlertTriangle, Car, ShieldAlert, Eye, Search, CheckCircle2, Clock, MapPin, Navigation, FileText, ChevronRight, X } from 'lucide-react';

interface IncidentResponseViewProps {
  districtId?: string;
  onSelectOnMap?: (lat: number, lon: number, title: string) => void;
}

export const IncidentResponseView: React.FC<IncidentResponseViewProps> = ({ districtId, onSelectOnMap }) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [summary, setSummary] = useState({
    totalIncidentsToday: 4,
    pendingAlerts: 2,
    plateDetectionRatePercent: 75,
    activeTrackedVehicles: 14,
  });
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [trackedVehicles, setTrackedVehicles] = useState<TrackedVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorityNotes, setAuthorityNotes] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [districtId, filterCategory, filterStatus]);

  const loadData = async () => {
    const res = await intelligenceService.getIncidents(
      districtId,
      filterStatus !== 'ALL' ? (filterStatus as AlertStatus) : undefined,
      filterCategory !== 'ALL' ? filterCategory : undefined
    );
    if (res.status === 'SUCCESS') {
      setIncidents(res.incidents || []);
      if (res.summary) setSummary(res.summary);
    }
    const tracksRes = await intelligenceService.getTrackedVehicles(searchQuery);
    if (tracksRes.status === 'SUCCESS') {
      setTrackedVehicles(tracksRes.tracks || []);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: AlertStatus) => {
    setUpdatingId(id);
    await intelligenceService.updateIncidentStatus(id, newStatus, authorityNotes);
    setUpdatingId(null);
    if (selectedIncident && selectedIncident.id === id) {
      setSelectedIncident({ ...selectedIncident, status: newStatus, authorityNotes });
    }
    loadData();
  };

  const getCategoryBadge = (category: IncidentCategory) => {
    switch (category) {
      case 'ACCIDENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">💥 ACCIDENT</span>;
      case 'HIT_AND_RUN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">🚨 HIT & RUN</span>;
      case 'RASH_DRIVING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚡ RASH DRIVING</span>;
      case 'DANGEROUS_DRIVING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">⚠️ DANGEROUS DRIVING</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">🚗 VEHICLE ANOMALY</span>;
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse"/> PENDING</span>;
      case 'ACKNOWLEDGED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Eye className="w-3 h-3"/> ACKNOWLEDGED</span>;
      case 'ACTIONED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Navigation className="w-3 h-3"/> ACTIONED</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> CLOSED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">INCIDENTS TODAY</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.totalIncidentsToday}</div>
            <div className="text-[11px] text-red-400 mt-0.5 font-medium">Critical Event Mesh</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">PENDING ALERTS</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{summary.pendingAlerts}</div>
            <div className="text-[11px] text-amber-300/80 mt-0.5 font-medium">Requires Officer Review</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">ANPR PLATE RECOGNITION</div>
            <div className="text-2xl font-bold text-teal-400 mt-1">{summary.plateDetectionRatePercent}%</div>
            <div className="text-[11px] text-teal-300/80 mt-0.5 font-medium">Optical Plate Extraction</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#10233D] border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">ACTIVE TRACKED VEHICLES</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{summary.activeTrackedVehicles}</div>
            <div className="text-[11px] text-blue-300/80 mt-0.5 font-medium">Multi-Frame Trajectory</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Navigation className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Incident Log & Tracked Vehicle Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Response Feed */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Incident & ANPR Alert Feed
              </h3>
              <p className="text-xs text-slate-400">Real-time edge camera accident detection & dangerous vehicle telemetry</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="ACCIDENT">Accidents</option>
                <option value="HIT_AND_RUN">Hit & Run</option>
                <option value="RASH_DRIVING">Rash Driving</option>
                <option value="DANGEROUS_DRIVING">Dangerous Driving</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ACTIONED">Actioned</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/50 rounded-xl border border-slate-800">
                No incidents found matching the selected filters.
              </div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(inc.category)}
                      {getStatusBadge(inc.status)}
                      <span className="text-xs font-mono text-slate-400">ID: {inc.id}</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedIncident(inc);
                        setAuthorityNotes(inc.authorityNotes || '');
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1E7F73] hover:bg-[#186a60] text-white flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Evidence
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">License Plate:</span>
                      <div className="font-mono font-bold mt-0.5">
                        {inc.plateText ? (
                          <span className="text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                            {inc.plateText}
                          </span>
                        ) : (
                          <span className="text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 text-[11px]">
                            Plate Not Detected
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400">Vehicle Type:</span>
                      <div className="font-semibold text-white mt-0.5">{inc.vehicleType}</div>
                    </div>

                    <div>
                      <span className="text-slate-400">Speed / Conf:</span>
                      <div className="font-semibold text-white mt-0.5">
                        {inc.speedKmh} km/h ({(inc.confidence * 100).toFixed(0)}%)
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400">Camera Source:</span>
                      <div className="font-semibold text-slate-300 mt-0.5">{inc.busLabel}</div>
                    </div>
                  </div>

                  {onSelectOnMap && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        Coords: {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                      </span>
                      <button
                        onClick={() => onSelectOnMap(inc.latitude, inc.longitude, `${inc.category} (${inc.vehicleType})`)}
                        className="text-[#1E7F73] hover:underline font-semibold flex items-center gap-1"
                      >
                        Locate on GIS Map <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tracked Vehicle Trajectories Panel */}
        <div className="p-5 rounded-2xl bg-[#10233D] border border-slate-800 space-y-4">
          <div>
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-400" />
              Vehicle Trajectory Search
            </h3>
            <p className="text-xs text-slate-400">Track vehicle history across camera mesh</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Plate (e.g. PB-09) or Type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="space-y-3">
            {trackedVehicles.map((trk) => (
              <div key={trk.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-blue-300">{trk.trackId}</span>
                  {trk.plateText ? (
                    <span className="font-mono text-teal-300 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/20 text-[11px]">
                      {trk.plateText}
                    </span>
                  ) : (
                    <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px]">
                      Plate Not Detected
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between">
                  <span>{trk.vehicleType} • {trk.speedKmh} km/h</span>
                  <span className="text-slate-400 text-[11px]">{trk.lastSeenBus}</span>
                </div>

                {onSelectOnMap && trk.trajectory.length > 0 && (
                  <button
                    onClick={() => onSelectOnMap(trk.trajectory[0][0], trk.trajectory[0][1], `Track: ${trk.trackId}`)}
                    className="w-full py-1 text-[11px] font-semibold text-center rounded bg-slate-800 hover:bg-slate-700 text-teal-300 transition"
                  >
                    View Trajectory Overlay on Map
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence Inspection Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#10233D] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">

            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              {getCategoryBadge(selectedIncident.category)}
              <h3 className="text-lg font-bold text-white">Incident Evidence File</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Snapshot Display */}
              <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                <Car className="w-12 h-12 text-slate-600 mb-2" />
                <span className="text-xs text-slate-400 font-mono">Camera Frame Snippet</span>
                <span className="text-[10px] text-teal-400 font-mono mt-1">Bus Sensor: {selectedIncident.busLabel}</span>
                
                {/* Simulated Bounding Box Overlay */}
                <div className="absolute top-4 left-6 right-6 bottom-6 border-2 border-red-500/80 rounded flex items-start p-1">
                  <span className="bg-red-500 text-white font-mono text-[9px] px-1 rounded">
                    {selectedIncident.vehicleType} ({(selectedIncident.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">License Plate:</span>
                    {selectedIncident.plateText ? (
                      <span className="font-mono font-bold text-teal-300">{selectedIncident.plateText}</span>
                    ) : (
                      <span className="font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px]">
                        Plate Not Detected
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vehicle Classification:</span>
                    <span className="font-semibold text-white">{selectedIncident.vehicleType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Measured Velocity:</span>
                    <span className="font-semibold text-white">{selectedIncident.speedKmh} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Detection Confidence:</span>
                    <span className="font-semibold text-teal-400">{(selectedIncident.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="font-mono text-slate-300">{new Date(selectedIncident.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 mb-1">Authority Action Status:</div>
                  {getStatusBadge(selectedIncident.status)}
                </div>
              </div>
            </div>

            {/* Officer Action Routing */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1E7F73]" />
                Secure Authority Alert Routing
              </h4>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Dispatch / Authority Review Notes:</label>
                <textarea
                  value={authorityNotes}
                  onChange={(e) => setAuthorityNotes(e.target.value)}
                  placeholder="Enter dispatch notes, patrol unit assignment, or challan ID..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'ACKNOWLEDGED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/80 hover:bg-amber-600 text-white transition"
                >
                  Acknowledge Alert
                </button>
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'ACTIONED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/80 hover:bg-blue-600 text-white transition"
                >
                  Dispatch Patrol Unit
                </button>
                <button
                  disabled={updatingId === selectedIncident.id}
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'CLOSED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600 text-white transition"
                >
                  Resolve & Close File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
