import React, { useState, useEffect } from 'react';
import { Bus, KeyRound, Shield, CheckCircle2, AlertCircle, Loader2, Trash2, Radio, X } from 'lucide-react';
import { api } from '../services/api';
import { District, BusSession } from '../types';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairSuccess: () => void;
  currentDistrict?: District | null;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  onPairSuccess,
  currentDistrict,
}) => {
  const [activeTab, setActiveTab] = useState<'pair' | 'sessions'>('pair');
  const [pin, setPin] = useState('');
  const [busLabel, setBusLabel] = useState('');
  const [routeTag, setRouteTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [sessions, setSessions] = useState<BusSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [unpairingId, setUnpairingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadSessions();
  }, [isOpen, currentDistrict]);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await api.getBusSessions(currentDistrict?.id);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load bus sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  if (!isOpen) return null;

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 6 || !/^\d+$/.test(cleanPin)) {
      setError('Please enter a valid 6-digit numeric PIN from the mobile phone.');
      return;
    }
    if (!busLabel.trim()) {
      setError('Please specify the bus registration or vehicle ID (e.g., PB-08-LPU-001).');
      return;
    }

    try {
      setLoading(true);
      const res = await api.confirmPairing({
        pin: cleanPin,
        busLabel: busLabel.trim(),
        routeTag: routeTag.trim() || undefined,
        targetDistrictId: currentDistrict?.id,
      });
      setSuccessMessage(res.message || 'Bus successfully paired!');
      setPin('');
      setBusLabel('');
      setRouteTag('');
      loadSessions();
      setTimeout(() => {
        onPairSuccess();
        onClose();
        setSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to bind bus session.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = async (sessionId: string) => {
    try {
      setUnpairingId(sessionId);
      setError(null);
      await api.unpairBusSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      await loadSessions();
      onPairSuccess();
    } catch (err: any) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onPairSuccess();
    } finally {
      setUnpairingId(null);
    }
  };

  /* Input styles: at least 16px (text-base) on mobile to prevent iOS Safari auto-zoom */
  const inputCls =
    'bg-slate-900 border-slate-600 text-white placeholder:text-slate-400 focus:border-[#1E7F73] focus:outline-none focus:ring-2 focus:ring-[#1E7F73]/50 min-h-[44px] rounded-xl transition';

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    colorScheme: 'dark',
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full border border-slate-700 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh] pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-0">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="bg-[#0b2545] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight">Bus Patrol Fleet Sensors</h3>
              <p className="text-xs text-slate-300">
                {currentDistrict?.name ? `Jurisdiction: ${currentDistrict.name}` : 'District Patrol Management'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Switcher ─────────────────────────────────── */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 px-4 sm:px-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pair')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 min-h-[40px] transition ${
              activeTab === 'pair'
                ? 'border-[#1E7F73] text-[#1E7F73]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pair New Sensor PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('sessions');
              loadSessions();
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 min-h-[40px] transition flex items-center space-x-1.5 ${
              activeTab === 'sessions'
                ? 'border-[#1E7F73] text-[#1E7F73]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Active Sensors</span>
            <span className="bg-[#1E7F73]/20 text-[#1E7F73] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
              {sessions.length}
            </span>
          </button>
        </div>

        {/* ── Content (Scrollable for small viewport heights like 568px with keyboard) ── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/60 rounded-xl text-xs text-red-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 bg-emerald-900/30 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ── Pair Tab ─────────────────────────────────── */}
          {activeTab === 'pair' ? (
            <div>
              {/* Info banner */}
              <div className="mb-4 p-3 bg-amber-900/25 border border-amber-700/50 rounded-xl text-xs text-amber-200 flex items-start space-x-2.5">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300">Secure PIN Handshake:</strong> The bus operator opens{' '}
                  <em>UrbanEye Mobile</em> on the mounted Android device to generate a 6-digit code. Enter it below to bind telemetry to this district.
                </div>
              </div>

              <form onSubmit={handlePairSubmit} className="space-y-4 text-xs">
                {/* PIN Input (Prominent, numeric keyboard) */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5 flex items-center space-x-1.5">
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>6-Digit Device PIN *</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="748291"
                    className={`w-full text-center text-2xl sm:text-3xl font-mono tracking-widest font-extrabold py-3 px-3 border-2 ${inputCls}`}
                    style={inputStyle}
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-center">
                    Valid for 10 minutes from generation on the phone
                  </p>
                </div>

                {/* Bus Label */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Bus Registration / Fleet ID *
                  </label>
                  <input
                    type="text"
                    value={busLabel}
                    onChange={(e) => setBusLabel(e.target.value)}
                    placeholder="e.g. PB-08-LPU-001 or BEST-408"
                    className={`w-full py-2.5 px-3 border text-sm text-white ${inputCls}`}
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Route Tag */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Transit Route Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={routeTag}
                    onChange={(e) => setRouteTag(e.target.value)}
                    placeholder="e.g. Route 335E (Phagwara to Jalandhar)"
                    className={`w-full py-2.5 px-3 border text-sm text-white ${inputCls}`}
                    style={inputStyle}
                  />
                </div>

                {/* Actions (Sticky or comfortable touch targets) */}
                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-semibold transition min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !pin || !busLabel}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[#1E7F73] hover:bg-[#186a60] disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow-sm transition min-h-[44px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Binding...</span>
                      </>
                    ) : (
                      <>
                        <Bus className="w-4 h-4" />
                        <span>Confirm Pairing</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ── Sessions Tab ──────────────────────────────── */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Active sensor sessions streaming telemetry to this district:
              </p>

              {loadingSessions ? (
                <div className="py-8 flex justify-center items-center text-slate-500 space-x-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading sensors...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-6 bg-slate-900/50 border border-slate-700 rounded-xl text-center text-xs text-slate-500">
                  No active bus sensors paired in this district.
                </div>
              ) : (
                <div className="divide-y divide-slate-700 border border-slate-700 rounded-xl max-h-64 overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 flex items-center justify-between hover:bg-slate-700/40 transition text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-900/40 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                          <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{s.busLabel || 'Unnamed Bus'}</div>
                          <div className="text-[11px] text-slate-400">
                            {s.routeTag ? `${s.routeTag} • ` : ''}
                            Paired{' '}
                            {s.pairedAt
                              ? new Date(s.pairedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'recently'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnpair(s.id)}
                        disabled={unpairingId === s.id}
                        className="px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-900/30 border border-red-700/50 rounded-lg flex items-center space-x-1 transition min-h-[40px] disabled:opacity-50"
                      >
                        {unpairingId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Unpair</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition min-h-[44px]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
