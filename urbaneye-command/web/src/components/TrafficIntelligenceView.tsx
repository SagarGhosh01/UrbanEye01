import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrafficRouteSegment, BottleneckAlert, TrafficIntelligenceStats, District } from '../types';
import { getTrafficRoutes, getTrafficStats, getActiveBottlenecks } from '../services/trafficService';
import { RouteAnalysisModal } from './RouteAnalysisModal';
import { useTheme } from '../contexts/ThemeContext';
import {
  Car,
  Activity,
  AlertTriangle,
  Clock,
  Bus,
  Layers,
  MapPin,
  TrendingUp,
  SlidersHorizontal,
  ArrowRight,
  Zap,
  ShieldAlert,
  Navigation,
  Compass,
} from 'lucide-react';

interface TrafficIntelligenceViewProps {
  district?: District | null;
}

// Helper to calculate polyline center
function getPolylineCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [31.378, 75.385];
  const midIdx = Math.floor(coords.length / 2);
  return coords[midIdx];
}

export const TrafficIntelligenceView: React.FC<TrafficIntelligenceViewProps> = ({ district }) => {
  const { isDark } = useTheme();
  const [routes, setRoutes] = useState<TrafficRouteSegment[]>([]);
  const [stats, setStats] = useState<TrafficIntelligenceStats | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckAlert[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TrafficRouteSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisModalTarget, setAnalysisModalTarget] = useState<{ routeId: string; routeName: string } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Load Traffic Telemetry
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [rData, sData, bData] = await Promise.all([
          getTrafficRoutes(district?.id),
          getTrafficStats(district?.id),
          getActiveBottlenecks(district?.id),
        ]);
        setRoutes(rData);
        setStats(sData);
        setBottlenecks(bData);
        if (rData.length > 0) {
          setSelectedRoute(rData[0]);
        }
      } catch (err) {
        console.error('Failed to load traffic intelligence:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [district]);

  // Color Mapping Helper
  const getTrafficColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return '#22c55e'; // Green
      case 'MODERATE':
        return '#eab308'; // Amber
      case 'HEAVY':
        return '#f97316'; // Orange
      case 'SEVERE':
        return '#ef4444'; // Red
      default:
        return '#3b82f6';
    }
  };

  // Initialize Map & Render Polylines
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] = district?.centerLat && district?.centerLon
      ? [district.centerLat, district.centerLon]
      : [31.378, 75.385];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      routesLayerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = routesLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Render Routes as Polyline Overlays
    routes.forEach((route) => {
      const isSelected = selectedRoute?.id === route.id;
      const color = getTrafficColor(route.trafficLevel);

      const polyline = L.polyline(route.coordinates, {
        color: color,
        weight: isSelected ? 8 : 5,
        opacity: isSelected ? 0.95 : 0.75,
      });

      polyline.bindTooltip(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong>${route.name}</strong><br/>
          Traffic Level: <span style="color:${color}; font-weight: bold;">${route.trafficLevel}</span><br/>
          Flow: ${route.vehiclesPerMin} vehicles/min | Delay: +${route.estimatedDelayMin} min
        </div>
      `);

      polyline.on('click', () => {
        setSelectedRoute(route);
        map.flyTo(getPolylineCenter(route.coordinates), 14, { duration: 1 });
      });

      polyline.addTo(layerGroup);

      // Render Active Bottleneck Pulse Marker
      if (route.bottleneckStatus === 'ACTIVE') {
        const center = getPolylineCenter(route.coordinates);
        const icon = L.divIcon({
          className: 'custom-bottleneck-marker',
          html: `<div style="position: relative; display: flex; items-center: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #ef4444; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 22px; height: 22px; border-radius: 50%; background: #dc2626; border: 2px solid #ffffff; color: white; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(220,38,38,0.5);">⚠</div>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker(center, { icon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 2px;">
            <strong style="color: #dc2626;">⚠ ACTIVE BOTTLENECK</strong><br/>
            <span>${route.name} (${route.junctionTag})</span><br/>
            Speed: ${route.avgSpeedKmh} km/h (Normal: ${route.normalSpeedKmh} km/h)<br/>
            <strong>Delay: +${route.estimatedDelayMin} min</strong>
          </div>
        `);
        marker.on('click', () => {
          setSelectedRoute(route);
        });
        marker.addTo(layerGroup);
      }
    });

  }, [routes, selectedRoute, district, isDark]);

  const handleRouteClick = (route: TrafficRouteSegment) => {
    setSelectedRoute(route);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(getPolylineCenter(route.coordinates), 14, { duration: 1 });
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <Activity className="w-8 h-8 text-[#1E7F73] animate-spin" />
          <span className="text-sm font-medium text-slate-400">Loading Live Traffic Intelligence...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: VEHICLES DETECTED */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">VEHICLES DETECTED</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-[#2dd4bf]">
              <Car className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight">{stats.vehiclesDetectedToday.toLocaleString()}</span>
            <span className="text-xs font-bold text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded-full">Today</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Real-time edge camera frame count</p>
        </div>

        {/* KPI 2: TRAFFIC DENSITY */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">TRAFFIC DENSITY</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight">{stats.trafficDensityPercent}%</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full uppercase">
              {stats.densityLevel}
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full" style={{ width: `${stats.trafficDensityPercent}%` }} />
          </div>
        </div>

        {/* KPI 3: ACTIVE BOTTLENECKS */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">ACTIVE BOTTLENECKS</span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-red-400">
              0{stats.activeBottlenecksCount}
            </span>
            <span className="text-xs font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Across monitored bus routes</p>
        </div>

        {/* KPI 4: AVG. ROUTE DELAY */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AVG. ROUTE DELAY</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-amber-300">
              +{stats.avgRouteDelayMinutes} min
            </span>
            <span className="text-xs font-medium text-slate-400">vs Normal</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Compared with baseline flow</p>
        </div>
      </div>

      {/* 2. Main Grid: Map & Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: GIS Traffic Density Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`rounded-2xl border overflow-hidden relative shadow-lg ${
            isDark ? 'bg-[#0f1f38] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            {/* Map Header Overlay */}
            <div className="p-4 border-b flex items-center justify-between bg-slate-900/90 backdrop-blur-md border-slate-800 text-white z-10 relative">
              <div className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-[#2dd4bf]" />
                <span className="font-bold text-sm tracking-tight">Live GIS Traffic Density Map</span>
              </div>

              {/* Traffic Level Legend */}
              <div className="flex items-center space-x-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate
                </span>
                <span className="flex items-center gap-1 text-orange-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Heavy
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Severe
                </span>
              </div>
            </div>

            {/* Leaflet Native Canvas */}
            <div ref={mapContainerRef} className="h-[440px] w-full relative z-0" />
          </div>

          {/* Road Telemetry Detail Inspection Drawer when clicked */}
          {selectedRoute && (
            <div className={`p-5 rounded-2xl border transition-all ${
              isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base sm:text-lg">{selectedRoute.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      selectedRoute.trafficLevel === 'SEVERE' || selectedRoute.trafficLevel === 'HEAVY'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      Traffic Level: {selectedRoute.trafficLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Segment Tag: {selectedRoute.junctionTag} • Sensor Update: {selectedRoute.lastUpdated}</p>
                </div>

                {selectedRoute.bottleneckStatus === 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/70 text-red-300 border border-red-800 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Bottleneck Status: ACTIVE
                  </span>
                )}
              </div>

              {/* Grid of Road Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Vehicles Detected</span>
                  <div className="text-xl font-extrabold font-mono text-teal-400 mt-1">{selectedRoute.vehiclesPerMin} <span className="text-xs font-normal text-slate-400">/min</span></div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Average Speed</span>
                  <div className="text-xl font-extrabold font-mono text-white mt-1">{selectedRoute.avgSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span></div>
                  <div className="text-[10px] text-slate-400">Normal: {selectedRoute.normalSpeedKmh} km/h</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Estimated Delay</span>
                  <div className="text-xl font-extrabold font-mono text-amber-400 mt-1">+{selectedRoute.estimatedDelayMin} <span className="text-xs font-normal text-slate-400">min</span></div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Edge Buses</span>
                  <div className="text-xs font-bold text-slate-200 mt-1 truncate">{selectedRoute.detectedByBuses.length} Fleet Nodes</div>
                  <div className="text-[10px] text-teal-400 truncate">{selectedRoute.detectedByBuses.join(', ')}</div>
                </div>
              </div>

              {/* Road Specific Vehicle Classification Progress Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Primary Vehicle Mix on {selectedRoute.name}:</span>
                <div className="grid grid-cols-5 gap-2 mt-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Cars</span>
                    <span className="font-bold text-teal-300">{selectedRoute.vehicleClassification.cars}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">2-Wheelers</span>
                    <span className="font-bold text-indigo-300">{selectedRoute.vehicleClassification.twoWheelers}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Buses</span>
                    <span className="font-bold text-amber-300">{selectedRoute.vehicleClassification.buses}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Trucks</span>
                    <span className="font-bold text-orange-300">{selectedRoute.vehicleClassification.trucks}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Other</span>
                    <span className="font-bold text-slate-300">{selectedRoute.vehicleClassification.other}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Vehicle Classification & Active Bottlenecks */}
        <div className="space-y-6">
          {/* Panel A: Vehicle Classification Breakdown */}
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-[#2dd4bf]" />
              <h3 className="font-bold text-sm tracking-wide uppercase">Vehicle Classification</h3>
            </div>

            <div className="space-y-3.5">
              {/* Cars */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-teal-400" /> Cars</span>
                  <span className="font-mono text-teal-400">{stats.classification.cars}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-teal-400 h-full rounded-full" style={{ width: `${stats.classification.cars}%` }} />
                </div>
              </div>

              {/* Two Wheelers */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-indigo-400" /> Two-Wheelers</span>
                  <span className="font-mono text-indigo-400">{stats.classification.twoWheelers}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${stats.classification.twoWheelers}%` }} />
                </div>
              </div>

              {/* Buses */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Bus className="w-3.5 h-3.5 text-amber-400" /> Buses</span>
                  <span className="font-mono text-amber-400">{stats.classification.buses}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${stats.classification.buses}%` }} />
                </div>
              </div>

              {/* Trucks */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-orange-400" /> Trucks</span>
                  <span className="font-mono text-orange-400">{stats.classification.trucks}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-orange-400 h-full rounded-full" style={{ width: `${stats.classification.trucks}%` }} />
                </div>
              </div>

              {/* Other */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Other / Commercial</span>
                  <span className="font-mono text-slate-400">{stats.classification.other}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${stats.classification.other}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Panel B: Active Bottlenecks Feed */}
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-[#0f1f38] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <h3 className="font-bold text-sm tracking-wide uppercase">Active Bottleneck Feed</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                {bottlenecks.length} Active
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {bottlenecks.map((btn) => (
                <div
                  key={btn.id}
                  className="p-3.5 rounded-xl bg-red-950/20 border border-red-800/40 hover:border-red-600 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-white flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        {btn.routeName}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{btn.junctionTag}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 uppercase">
                      {btn.densityLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-red-900/40">
                    <div>
                      <span className="text-slate-400 block">Speed:</span>
                      <span className="font-bold font-mono text-white">{btn.currentSpeedKmh} km/h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Delay:</span>
                      <span className="font-bold font-mono text-amber-400">+{btn.delayMinutes} min</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1">
                    <span className="font-semibold text-slate-300">Detected by: </span>
                    <span className="text-teal-300">{btn.detectedByBuses.join(', ')}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetRoute = routes.find((r) => r.name === btn.routeName);
                        if (targetRoute) {
                          handleRouteClick(targetRoute);
                        }
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center space-x-1 transition active:scale-95"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>View on Map</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysisModalTarget({ routeId: btn.id, routeName: btn.routeName });
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 transition border border-slate-700 active:scale-95"
                    >
                      <span>Analyze</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Route Intelligence & Diversion Modal */}
      <RouteAnalysisModal
        isOpen={!!analysisModalTarget}
        routeId={analysisModalTarget?.routeId || null}
        routeName={analysisModalTarget?.routeName || null}
        onClose={() => setAnalysisModalTarget(null)}
      />
    </div>
  );
};
