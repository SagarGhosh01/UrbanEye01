import React, { useState, useEffect, useCallback } from 'react';
import { User, State, District, RoadEvent, AnalyticsStats, EventStatus } from './types';
import { api } from './services/api';
import { subscribeToDistrict } from './services/socket';
import { Header, ActiveTabType } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { DefectTable } from './components/DefectTable';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { PairingModal } from './components/PairingModal';
import { NationalOverviewView } from './components/NationalOverviewView';
import { StateOverviewView } from './components/StateOverviewView';
import { DefectDetailModal } from './components/DefectDetailModal';
import { TrafficIntelligenceView } from './components/TrafficIntelligenceView';
import { IncidentResponseView } from './components/IncidentResponseView';
import { SafetyIntelligenceView } from './components/SafetyIntelligenceView';
import { PredictiveIntelligenceView } from './components/PredictiveIntelligenceView';
import { Login } from './pages/Login';
import { LandingPage } from './pages/LandingPage';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { RefreshCw, Radio, BellRing, Sparkles, ArrowLeft, ShieldAlert, Activity } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
};

const AppInner: React.FC = () => {
  const { isDark } = useTheme();
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('urbaneye_token'));
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(false);

  // Navigation / Scope State
  const [viewMode, setViewMode] = useState<'NATIONAL' | 'STATE' | 'DISTRICT'>('DISTRICT');
  const [dashboardTab, setDashboardTab] = useState<ActiveTabType>('DEFECTS');
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);


const defaultStats: AnalyticsStats = {
  totalEvents: 0,
  byStatus: { new: 0, reviewed: 0, assigned: 0, resolved: 0 },
  byType: { pothole: 0, roadCrack: 0, surfaceDamage: 0, waterlogging: 0, vehicleFlow: 0 },
  activeBusesCount: 0,
  roadHealthScore: 100,
  totalRepairCost: 0,
};

// Data State
  const [events, setEvents] = useState<RoadEvent[]>([]);
  const [stats, setStats] = useState<AnalyticsStats>(defaultStats);
  const [loadingData, setLoadingData] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [latestLiveAlert, setLatestLiveAlert] = useState<RoadEvent | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<RoadEvent | null>(null);

  // Helper constructors for fallback geography states
  const createFallbackDistrict = useCallback((u: User): District => {
    const distId = u.districtId || 'dist-kapurthala';
    const name = u.districtName || 'Kapurthala';
    return {
      id: distId,
      name,
      code: name.toUpperCase().replace(/\s+/g, '_'),
      stateId: u.stateId || 'state-punjab',
      centerLat: distId.includes('mumbai') ? 19.0760 : distId.includes('bengaluru') ? 12.9716 : 31.2536,
      centerLon: distId.includes('mumbai') ? 72.8777 : distId.includes('bengaluru') ? 77.5946 : 75.7037,
    };
  }, []);

  const createFallbackState = useCallback((u: User): State => {
    const stId = u.stateId || 'state-punjab';
    const name = u.stateName || 'Punjab';
    return {
      id: stId,
      name,
      code: u.stateCode || 'PB',
      centerLat: stId.includes('maharashtra') ? 19.7515 : stId.includes('karnataka') ? 15.3173 : 31.1471,
      centerLon: 75.3412,
    };
  }, []);

  // 1. Initial Profile Check
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (e: any) {
        console.warn('Session check notice:', e?.message || e);
        // Only clear session if user profile is not set and error is explicitly unauthorized
        if (!user && e?.message?.toLowerCase().includes('unauthorized')) {
          localStorage.removeItem('urbaneye_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  // 2. Adjust View Mode based on Role
  useEffect(() => {
    if (!user) return;

    if (user.role === 'DISTRICT_HEAD') {
      setViewMode('DISTRICT');
      if (!activeDistrict || activeDistrict.id !== user.districtId) {
        setActiveDistrict(createFallbackDistrict(user));
      }
      if (user.districtId) {
        api.getDistrict(user.districtId).then((d) => {
          if (d) setActiveDistrict(d);
        }).catch(console.error);
      }
    } else if (user.role === 'STATE_ADMIN') {
      setViewMode('STATE');
      if (!selectedState || selectedState.id !== user.stateId) {
        setSelectedState(createFallbackState(user));
      }
      if (user.stateId) {
        api.getStates().then((sts) => {
          const myState = sts.find((s) => s.id === user.stateId);
          if (myState) {
            setSelectedState(myState);
          }
        }).catch(console.error);
      }
    } else if (user.role === 'NATIONAL_ADMIN') {
      setViewMode('NATIONAL');
    }
  }, [user, createFallbackDistrict, createFallbackState]);

  // 3. Load District Data (Events & Stats)
  const refreshDistrictData = useCallback(async () => {
    if (!activeDistrict) return;
    setLoadingData(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.getEvents({ districtId: activeDistrict.id, limit: 100 }),
        api.getEventStats(activeDistrict.id),
      ]);
      setEvents(eventsRes.events);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load district data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [activeDistrict]);

  useEffect(() => {
    if (activeDistrict) {
      refreshDistrictData();
    }
  }, [activeDistrict, refreshDistrictData]);

  // 4. Real-Time Socket Subscription (Pushes live events into map, feed, and counters)
  useEffect(() => {
    if (!activeDistrict) return;

    const cleanup = subscribeToDistrict(
      activeDistrict.id,
      (newEvent) => {
        console.log('⚡ Received Live Road Event:', newEvent);
        // Prepend event immediately to feed and map without page refresh
        setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
        setLatestLiveAlert(newEvent);

        // Instantly increment summary counters live
        setStats((prev) => {
          if (!prev) return prev;
          const isNew = newEvent.status === 'NEW';
          return {
            ...prev,
            totalEvents: prev.totalEvents + 1,
            byStatus: {
              ...prev.byStatus,
              new: isNew ? prev.byStatus.new + 1 : prev.byStatus.new,
            },
            byType: {
              ...prev.byType,
              pothole: newEvent.type === 'POTHOLE' ? prev.byType.pothole + 1 : prev.byType.pothole,
              roadCrack: newEvent.type === 'ROAD_CRACK' ? prev.byType.roadCrack + 1 : prev.byType.roadCrack,
              surfaceDamage: newEvent.type === 'SURFACE_DAMAGE' ? prev.byType.surfaceDamage + 1 : prev.byType.surfaceDamage,
              waterlogging: newEvent.type === 'WATERLOGGING' ? prev.byType.waterlogging + 1 : prev.byType.waterlogging,
              vehicleFlow: newEvent.type === 'VEHICLE_FLOW' ? prev.byType.vehicleFlow + 1 : prev.byType.vehicleFlow,
            },
          };
        });

        // Also sync authoritative computed stats from server
        api.getEventStats(activeDistrict.id).then(setStats).catch(console.error);

        // Auto-dismiss notification toast after 6s
        setTimeout(() => setLatestLiveAlert((curr) => (curr?.id === newEvent.id ? null : curr)), 6000);
      },
      (updatedEvent) => {
        setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
        if (selectedEventForDetail?.id === updatedEvent.id) {
          setSelectedEventForDetail(updatedEvent);
        }
        api.getEventStats(activeDistrict.id).then(setStats).catch(console.error);
      },
      activeDistrict.code,
      (deleted) => {
        setEvents((prev) => prev.filter((e) => e.id !== deleted.id));
        if (selectedEventForDetail?.id === deleted.id) {
          setSelectedEventForDetail(null);
        }
        api.getEventStats(activeDistrict.id).then(setStats).catch(console.error);
      }
    );

    return () => {
      cleanup();
    };
  }, [activeDistrict, selectedEventForDetail?.id]);

  // Status Change Handler with optimistic update and server persistence
  const handleUpdateStatus = async (eventId: string, status: EventStatus, notes?: string) => {
    const res = await api.updateEventStatus(eventId, status, notes);
    setEvents((prev) => prev.map((e) => (e.id === eventId ? res.event : e)));
    if (selectedEventForDetail?.id === eventId) {
      setSelectedEventForDetail(res.event);
    }
    if (activeDistrict) {
      const freshStats = await api.getEventStats(activeDistrict.id);
      setStats(freshStats);
    }
  };

  // Delete Individual Event Handler
  const handleDeleteEvent = async (eventId: string) => {
    await api.deleteEvent(eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (selectedEventForDetail?.id === eventId) {
      setSelectedEventForDetail(null);
    }
    if (activeDistrict) {
      const freshStats = await api.getEventStats(activeDistrict.id);
      setStats(freshStats);
    }
  };

  // Purge / Clear All Events for District
  const handlePurgeEvents = async () => {
    if (!activeDistrict) return;
    await api.purgeEvents(activeDistrict.id);
    setEvents([]);
    setSelectedEventForDetail(null);
    const freshStats = await api.getEventStats(activeDistrict.id);
    setStats(freshStats);
  };

  // Switch persona handler for rapid review
  const handleSwitchUser = async (targetEmail: string) => {
    try {
      const res = await api.login(targetEmail, 'UrbanEye@2026');
      localStorage.setItem('urbaneye_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setSelectedEventForDetail(null);
    } catch (err) {
      console.error('Persona switch failed:', err);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('urbaneye_token');
    setToken(null);
    setUser(null);
    setActiveDistrict(null);
    setSelectedState(null);
    setEvents([]);
    setSelectedEventForDetail(null);
    setIsLoginView(false);
  };

  // Loading Screen
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-xs ${isDark ? 'bg-[#07162c] text-white' : 'bg-slate-100 text-slate-800'}`}>
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-semibold tracking-wider text-slate-300">Loading UrbanEye Command Center...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated -> Landing Page or Login View
  if (!user) {
    if (isLoginView) {
      return (
        <Login
          onLoginSuccess={(u, t) => {
            setUser(u);
            setToken(t);
            setIsLoginView(false);
            if (u.role === 'DISTRICT_HEAD') {
              setViewMode('DISTRICT');
              setActiveDistrict(createFallbackDistrict(u));
            } else if (u.role === 'STATE_ADMIN') {
              setViewMode('STATE');
              setSelectedState(createFallbackState(u));
            } else if (u.role === 'NATIONAL_ADMIN') {
              setViewMode('NATIONAL');
            }
          }}
          onBack={() => setIsLoginView(false)}
        />
      );
    }
    return <LandingPage onLoginClick={() => setIsLoginView(true)} />;
  }

  // Breadcrumbs Generator
  const breadcrumbs: { label: string; onClick?: () => void }[] = [];
  if (user.role === 'NATIONAL_ADMIN') {
    breadcrumbs.push({
      label: 'National Overview (All India)',
      onClick: viewMode !== 'NATIONAL' ? () => setViewMode('NATIONAL') : undefined,
    });
    if (selectedState && viewMode !== 'NATIONAL') {
      breadcrumbs.push({
        label: selectedState.name,
        onClick: viewMode === 'DISTRICT' ? () => setViewMode('STATE') : undefined,
      });
    }
    if (activeDistrict && viewMode === 'DISTRICT') {
      breadcrumbs.push({ label: activeDistrict.name });
    }
  } else if (user.role === 'STATE_ADMIN') {
    breadcrumbs.push({
      label: `${user.stateName || 'State'} Command`,
      onClick: viewMode === 'DISTRICT' ? () => setViewMode('STATE') : undefined,
    });
    if (activeDistrict && viewMode === 'DISTRICT') {
      breadcrumbs.push({ label: activeDistrict.name });
    }
  } else {
    breadcrumbs.push({ label: `${user.districtName || 'District'} Authority` });
  }

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col font-sans ${isDark ? 'bg-[#07162c] text-white' : 'bg-[#f4f6f8] text-slate-900'}`}>
      {/* Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onOpenPairing={() => setIsPairingModalOpen(true)}
        onSwitchUser={handleSwitchUser}
        activeBusCount={stats?.activeBusesCount || 0}
        currentBreadcrumbs={breadcrumbs}
        activeTab={dashboardTab}
        onTabChange={setDashboardTab}
      />

      {/* Live Toast for Incoming Edge Detection */}
      {latestLiveAlert && (
        <div
          onClick={() => setSelectedEventForDetail(latestLiveAlert)}
          className="fixed top-16 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 max-w-sm mx-auto bg-slate-900 text-white rounded-xl shadow-2xl p-3.5 border-l-4 border-red-500 flex items-start space-x-3 cursor-pointer hover:bg-slate-800 transition"
        >
          <div className="w-8 h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 animate-pulse" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>LIVE EDGE DETECTION</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <p className="text-white font-medium mt-0.5">
              {latestLiveAlert.type.replace('_', ' ')} ({Math.round(latestLiveAlert.confidence * 100)}% conf)
            </p>
            <p className="text-[11px] text-slate-300">
              Bus {latestLiveAlert.busLabel} • {new Date(latestLiveAlert.timestamp).toLocaleTimeString()}
            </p>
            <span className="text-[10px] text-blue-400 font-semibold underline mt-1 block">
              Click to Open Action Panel →
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full max-w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-5 overflow-x-hidden">
        {/* VIEW 1: National Admin View */}
        {viewMode === 'NATIONAL' && (
          <NationalOverviewView
            onSelectState={async (st) => {
              setSelectedState(st);
              setViewMode('STATE');
            }}
            onSelectDistrict={(dist) => {
              setActiveDistrict(dist);
              setViewMode('DISTRICT');
            }}
          />
        )}

        {/* VIEW 2: State Admin View */}
        {viewMode === 'STATE' && selectedState && (
          <StateOverviewView
            state={selectedState}
            onSelectDistrict={(d) => {
              setActiveDistrict(d);
              setViewMode('DISTRICT');
            }}
            onBack={() => setViewMode('NATIONAL')}
            canGoBack={user.role === 'NATIONAL_ADMIN'}
          />
        )}

        {/* VIEW 3: District Dashboard (District Head's Scoped Workspace) */}
        {viewMode === 'DISTRICT' && activeDistrict && (
          <div>
            {/* Top District Bar */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                {(user.role === 'STATE_ADMIN' || user.role === 'NATIONAL_ADMIN') && (
                  <button
                    onClick={() =>
                      setViewMode(user.role === 'STATE_ADMIN' ? 'STATE' : selectedState ? 'STATE' : 'NATIONAL')
                    }
                    className={`p-2 rounded-lg border transition ${isDark ? 'border-slate-600 hover:bg-slate-700 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}
                    title="Return to Higher Level"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h1 className={`text-xl font-black tracking-tight flex items-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span>{activeDistrict.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ml-2 ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                      {activeDistrict.code}
                    </span>
                  </h1>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Live transit telemetry, continuous edge-AI defect mapping & municipal work order registry.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={refreshDistrictData}
                  disabled={loadingData}
                  className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition flex items-center space-x-1.5 shadow-sm active:scale-95 ${isDark ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'}`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>

            {/* View Mode Segmented Switcher for Mobile/Tablet */}
            <div className="flex lg:hidden items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs mb-4">
              <button
                type="button"
                onClick={() => setDashboardTab('DEFECTS')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg font-bold transition ${
                  dashboardTab === 'DEFECTS'
                    ? 'bg-[#1E7F73] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Road Defects</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardTab('TRAFFIC')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg font-bold transition ${
                  dashboardTab === 'TRAFFIC'
                    ? 'bg-[#1E7F73] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
                <span>Traffic Intelligence</span>
              </button>
            </div>

            {/* TAB CONTENT: DEFECTS | TRAFFIC | INCIDENTS | SAFETY | PREDICTIVE */}
            {dashboardTab === 'TRAFFIC' ? (
              <TrafficIntelligenceView district={activeDistrict} />
            ) : dashboardTab === 'INCIDENTS' ? (
              <IncidentResponseView districtId={activeDistrict.id} />
            ) : dashboardTab === 'SAFETY' ? (
              <SafetyIntelligenceView districtId={activeDistrict.id} />
            ) : dashboardTab === 'PREDICTIVE' ? (
              <PredictiveIntelligenceView districtId={activeDistrict.id} />
            ) : (
              <>

                {/* Analytics Stats Grid */}
                <AnalyticsPanel stats={stats} districtName={activeDistrict.name} />

                {/* Live Map & Defect Feed Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
                  {/* Map Column (8 cols) */}
                  <div className="lg:col-span-8 flex flex-col">
                    <div className={`p-3 rounded-t-lg border border-b-0 flex items-center justify-between text-xs font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <div className="flex items-center space-x-2">
                        <Radio className="w-4 h-4 text-[#1E7F73] animate-pulse" />
                        <span className="truncate">Real-Time Geospatial Defect Distribution</span>
                      </div>
                      <span className="text-[10px] text-[#1E7F73] bg-[#1E7F73]/10 px-2 py-0.5 rounded font-mono shrink-0">
                        Leaflet GIS Active
                      </span>
                    </div>

                    <div className="h-[380px] sm:h-[450px] w-full rounded-b-lg border overflow-hidden relative shadow-inner">
                      <LiveMap
                        events={events}
                        centerLat={activeDistrict.centerLat}
                        centerLon={activeDistrict.centerLon}
                        zoom={12}
                        onUpdateStatus={handleUpdateStatus}
                        onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                        latestEventId={latestLiveAlert?.id}
                      />
                    </div>
                  </div>

                  {/* Realtime Detection Activity Stream (4 cols) */}
                  <div className="lg:col-span-4 flex flex-col">
                    <div className={`p-3 rounded-t-lg border border-b-0 flex items-center justify-between text-xs font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <div className="flex items-center space-x-2">
                        <Radio className="w-4 h-4 text-emerald-500 animate-ping" />
                        <span>Live Telemetry Stream</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                        {events.length} Events
                      </span>
                    </div>

                    <div className={`flex-1 rounded-b-lg border p-3 overflow-y-auto max-h-[380px] sm:max-h-[450px] space-y-2.5 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                      {events.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                          <Radio className="w-8 h-8 mb-2 opacity-50 animate-pulse text-[#1E7F73]" />
                          <p className="text-xs font-semibold text-slate-300">Listening on Mesh Socket</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                            Pair a mobile phone sensor to stream live road defect telemetry into this command view.
                          </p>
                          <button
                            onClick={() => setIsPairingModalOpen(true)}
                            className="mt-3 px-3 py-1.5 text-xs font-bold rounded bg-[#1E7F73] text-white hover:bg-[#186a60] transition shadow-sm"
                          >
                            + Pair Bus Sensor
                          </button>
                        </div>
                      ) : (
                        events.slice(0, 15).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => setSelectedEventForDetail(ev)}
                            className={`pt-2 first:pt-0 flex items-start space-x-2.5 text-xs p-1.5 rounded cursor-pointer transition ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}
                          >
                            {ev.imageSnippet ? (
                              <img
                                src={ev.imageSnippet.startsWith('data:') ? ev.imageSnippet : `data:image/jpeg;base64,${ev.imageSnippet}`}
                                alt="Crop"
                                className="w-12 h-10 object-cover rounded border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className={`w-12 h-10 rounded border border-dashed shrink-0 flex items-center justify-center text-[10px] ${isDark ? 'bg-slate-700 border-slate-600 text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                                Crop
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {ev.type.replace('_', ' ')}
                                </span>
                                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Bus: <strong>{ev.busLabel}</strong> • {Math.round(ev.confidence * 100)}% conf
                              </div>
                              <div className={`flex items-center justify-between text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                <span>{ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}</span>
                                <span className={`font-bold uppercase text-[9px] ${
                                  ev.status === 'RESOLVED'
                                    ? 'text-emerald-600'
                                    : ev.status === 'ASSIGNED_FOR_REPAIR'
                                    ? 'text-orange-600'
                                    : 'text-red-600'
                                }`}>
                                  {ev.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Defect Management Register Table */}
                <DefectTable
                  events={events}
                  onUpdateStatus={handleUpdateStatus}
                  onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                  onDeleteEvent={handleDeleteEvent}
                  onPurgeEvents={handlePurgeEvents}
                  isLoading={loadingData}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Bus Pairing Modal */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onPairSuccess={() => {
          if (activeDistrict) refreshDistrictData();
        }}
        currentDistrict={activeDistrict}
      />

      {/* Defect Action / Detail Modal */}
      <DefectDetailModal
        event={selectedEventForDetail}
        onClose={() => setSelectedEventForDetail(null)}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDeleteEvent}
        readOnly={user.role === 'STATE_ADMIN' && false}
      />
    </div>
  );
};

