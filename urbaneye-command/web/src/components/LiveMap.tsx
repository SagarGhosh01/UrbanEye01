import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RoadEvent, EventStatus } from '../types';
import { ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { getCategoryPriority, MAX_CATEGORY_PRIORITY } from '../constants/detectionCategories';
import { getPotholeCostDetails } from '../utils/potholeEstimates';

interface LiveMapProps {
  events: RoadEvent[];
  centerLat: number;
  centerLon: number;
  zoom?: number;
  onUpdateStatus?: (eventId: string, status: EventStatus, notes?: string) => void;
  onSelectEvent?: (event: RoadEvent) => void;
  latestEventId?: string | null;
  activeLayerFilters?: {
    defects?: boolean;
    traffic?: boolean;
    incidents?: boolean;
    vruSafety?: boolean;
    predictive?: boolean;
  };
}

const STATUS_METADATA: Record<EventStatus, { bg: string; text: string; label: string; symbol: string }> = {
  NEW: { bg: '#dc2626', text: '#ffffff', label: 'New Defect', symbol: '!' },
  ASSIGNED_FOR_REPAIR: { bg: '#d97706', text: '#ffffff', label: 'Assigned Repair', symbol: '⚙' },
  RESOLVED: { bg: '#1E7F73', text: '#ffffff', label: 'Resolved', symbol: '✓' },
  REVIEWED: { bg: '#475569', text: '#ffffff', label: 'Reviewed', symbol: '•' },
};

export const LiveMap: React.FC<LiveMapProps> = ({
  events,
  centerLat,
  centerLon,
  zoom = 12,
  onUpdateStatus,
  onSelectEvent,
  latestEventId,
  activeLayerFilters = { defects: true, traffic: true, incidents: true, vruSafety: true, predictive: true },
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const vruLayerRef = useRef<L.LayerGroup | null>(null);
  const pulseCircleRef = useRef<L.CircleMarker | null>(null);

  // Layer toggle state
  const [layers, setLayers] = useState({
    defects: activeLayerFilters.defects ?? true,
    traffic: activeLayerFilters.traffic ?? true,
    incidents: activeLayerFilters.incidents ?? true,
    vruSafety: activeLayerFilters.vruSafety ?? true,
    predictive: activeLayerFilters.predictive ?? true,
  });

  // Collapsible legend state
  const [legendOpen, setLegendOpen] = useState(false);


  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: zoom,
        zoomControl: false, // Repositioned zoom control
      });

      // Bottom-right zoom control: thumb-safe for one-handed mobile use & prevents blocking header
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap standard tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    // ResizeObserver & window resize listener for immediate orientation/dimension adaptation
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    let ro: ResizeObserver | null = null;
    if (mapContainerRef.current && window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (ro) ro.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when props change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLon], zoom, { animate: true });
    }
  }, [centerLat, centerLon, zoom]);

  // Handle Latest Event Glow Effect
  useEffect(() => {
    if (!mapInstanceRef.current || !latestEventId) return;
    const latestEv = events.find((e) => e.id === latestEventId);
    if (!latestEv) return;

    mapInstanceRef.current.panTo([latestEv.latitude, latestEv.longitude], { animate: true });

    if (pulseCircleRef.current) {
      pulseCircleRef.current.remove();
    }

    const circle = L.circleMarker([latestEv.latitude, latestEv.longitude], {
      radius: 26,
      fillColor: '#ef4444',
      fillOpacity: 0.3,
      color: '#dc2626',
      weight: 2,
    }).addTo(mapInstanceRef.current);

    pulseCircleRef.current = circle;

    const timer = setTimeout(() => {
      if (pulseCircleRef.current) {
        pulseCircleRef.current.remove();
        pulseCircleRef.current = null;
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [latestEventId, events]);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    events.forEach((event) => {
      const statusMeta = STATUS_METADATA[event.status] || STATUS_METADATA.NEW;
      const isNew = event.status === 'NEW';
      const isLatest = event.id === latestEventId;

      const iconHtml = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${
            isLatest
              ? `<div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background-color: ${statusMeta.bg}; opacity: 0.6; animation: pulse-ring 1.2s infinite;"></div>`
              : isNew
              ? `<div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: ${statusMeta.bg}; opacity: 0.35; animation: pulse-ring 2s infinite;"></div>`
              : ''
          }
          <div style="
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background-color: ${statusMeta.bg};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            transition: transform 0.15s ease-in-out;
          ">
            ${statusMeta.symbol}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-road-marker',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      /**
       * Priority-based z-index layering.
       * Formula: (MAX_PRIORITY - categoryPriority) * 100
       * → priority-1 (Incident) gets offset 1000, priority-11 (Vehicle Flow) gets offset 0.
       * This is generic: any future Phase 2/3 category automatically slots in at the
       * correct visual depth without further changes to this file.
       */
      const categoryPriority = getCategoryPriority(event.type);
      const zOffset = (MAX_CATEGORY_PRIORITY - categoryPriority) * 100;

      const marker = L.marker([event.latitude, event.longitude], {
        icon: customIcon,
        zIndexOffset: zOffset,
      });

      marker.on('click', () => {
        if (onSelectEvent) {
          onSelectEvent(event);
        }
      });

      const dateStr = new Date(event.timestamp).toLocaleString();
      const details = getPotholeCostDetails(event);
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '230px';
      popupDiv.style.fontFamily = 'Inter, -apple-system, sans-serif';

      popupDiv.innerHTML = `
        <div style="padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: ${statusMeta.bg}; text-transform: uppercase;">
              ${event.type.replace('_', ' ')}
            </span>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background-color: #f1f5f9; color: #334155;">
              ${Math.round(event.confidence * 100)}% Conf
            </span>
          </div>

          ${
            event.imageSnippet
              ? `<div style="margin-bottom: 8px; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; max-height: 100px;">
                  <img src="${event.imageSnippet.startsWith('data:') ? event.imageSnippet : `data:image/jpeg;base64,${event.imageSnippet}`}" alt="Camera snippet" style="width: 100%; height: 95px; object-fit: cover; display: block;" />
                </div>`
              : ''
          }

          {/* Cavity & Repair Cost Bar */}
          <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 6px; border: 1px solid #fde68a;">
            <span>Ø ${details.diameterCm} cm (${details.severity})</span>
            <span style="color: #059669; font-weight: 800;">Fix: ${details.formattedCost}</span>
          </div>

          <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
            <strong>Bus:</strong> ${event.busLabel}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">
            <strong>GPS:</strong> ${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
            <strong>Detected:</strong> ${dateStr}
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${statusMeta.bg};">
              ${statusMeta.label}
            </span>
            <button id="btn-view-detail-${event.id}" style="
              background-color: #10233D;
              color: #ffffff;
              border: none;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              min-height: 36px;
            ">
              Action Panel →
            </button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const btn = document.getElementById(`btn-view-detail-${event.id}`);
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            if (onSelectEvent) onSelectEvent(event);
          };
        }
      }, 50);

      marker.bindPopup(popupDiv);
      marker.addTo(layer);
    });
  }, [events, latestEventId, onSelectEvent]);

  return (
    <div className="relative w-full h-full min-h-[360px] sm:min-h-[460px] bg-slate-100 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Right GIS Layer Controls Toggle Panel */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-30 max-w-[calc(100vw-32px)]">
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-2 sm:p-2.5 text-xs text-white space-y-1 sm:space-y-1.5 max-w-[170px] sm:min-w-[180px]">

          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-1 flex items-center justify-between">
            <span>GIS Map Layers</span>
            <Layers className="w-3 h-3 text-teal-400" />
          </div>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.defects}
              onChange={(e) => setLayers({ ...layers, defects: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🛠️ Road Defects</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚗 Traffic Flow</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.incidents}
              onChange={(e) => setLayers({ ...layers, incidents: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚨 Incidents & ANPR</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.vruSafety}
              onChange={(e) => setLayers({ ...layers, vruSafety: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🚶 VRU Safety Risk</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-medium text-slate-200">
            <input
              type="checkbox"
              checked={layers.predictive}
              onChange={(e) => setLayers({ ...layers, predictive: e.target.checked })}
              className="rounded text-teal-500 focus:ring-0"
            />
            <span>🔮 Predictive Risk</span>
          </label>
        </div>
      </div>

      {/* Map Status Legend Overlay: Collapsible on Mobile, Permanent on Desktop */}
      <div className="absolute bottom-4 left-3 sm:left-4 z-[500] max-w-[240px]">
        {legendOpen ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-3 text-xs text-white animate-fade-in">
            <div className="flex items-center justify-between font-semibold text-slate-200 text-[11px] mb-2 pb-1.5 border-b border-white/10">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1E7F73] animate-pulse" />
                <span>Defect Status Overlay</span>
              </div>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label="Collapse legend"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] inline-block shrink-0" />
                <span className="text-slate-200">New Alert</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block shrink-0" />
                <span className="text-slate-200">Assigned</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E7F73] inline-block shrink-0" />
                <span className="text-slate-200">Resolved</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#475569] inline-block shrink-0" />
                <span className="text-slate-200">Reviewed</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-lg active:scale-95 transition min-h-[40px]"
            title="Tap to expand status legend"
            aria-label="Expand defect legend"
          >
            <Layers className="w-3.5 h-3.5 text-[#1E7F73]" />
            <span>Legend</span>
            <ChevronUp className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>
    </div>
  );
};

