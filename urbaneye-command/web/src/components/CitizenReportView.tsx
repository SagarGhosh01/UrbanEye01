import React, { useState, useEffect, useRef } from 'react';
import { User, RoadEvent, EventStatus } from '../types';
import { api } from '../services/api';
import { resolveImageSrc } from '../utils/imageUtils';
import {
  Camera,
  Upload,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Info,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import L from 'leaflet';

interface CitizenReportViewProps {
  user: User;
  onReportSubmitted?: (event: RoadEvent) => void;
}

// Custom Leaflet Pin Icon
const pinIcon = L.divIcon({
  className: 'custom-citizen-pin',
  html: `<div class="w-8 h-8 rounded-full bg-teal-500 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Interactive Native Leaflet Map Component for Manual Coordinate Pinning
const CitizenMapPicker: React.FC<{
  position: [number, number];
  onPositionChange: (pos: [number, number]) => void;
}> = ({ position, onPositionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(position, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(position, { icon: pinIcon, draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const latlng = marker.getLatLng();
      onPositionChange([latlng.lat, latlng.lng]);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView(position);
      markerRef.current.setLatLng(position);
    }
  }, [position]);

  return <div ref={containerRef} className="w-full h-full" />;
};

// Client-Side Canvas Image Compression (Optimizes high-res phone camera photos)
const compressImageFile = (file: File, maxDim = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      } else {
        reject(new Error('Canvas context unavailable'));
      }
    };
    img.onerror = (err) => reject(err);
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const CitizenReportView: React.FC<CitizenReportViewProps> = ({ user, onReportSubmitted }) => {
  // State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number }>({
    lat: 31.2536,
    lon: 75.7037,
  });
  const [gpsStatus, setGpsStatus] = useState<'LOCATING' | 'FIXED' | 'MANUAL'>('LOCATING');
  const [manualMapOpen, setManualMapOpen] = useState(false);
  const [suggestedType, setSuggestedType] = useState<string>('POTHOLE');

  // AI & Submission State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    noDefect?: boolean;
    message?: string;
    event?: RoadEvent;
  } | null>(null);

  // History State
  const [myReports, setMyReports] = useState<RoadEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Initial Geolocation Lookup & Restore Cached Phone Photo
  useEffect(() => {
    fetchGps();
    loadMyReports();

    // Check device local storage for temporary cached photo
    try {
      const cachedPhoto = localStorage.getItem('urbaneye_recent_citizen_photo');
      if (cachedPhoto) {
        setSelectedImage(cachedPhoto);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchGps = () => {
    setGpsStatus('LOCATING');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGpsStatus('FIXED');
        },
        (err) => {
          console.warn('GPS lookup notice:', err.message);
          setGpsLocation({ lat: 31.2536, lon: 75.7037 });
          setGpsStatus('MANUAL');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setGpsLocation({ lat: 31.2536, lon: 75.7037 });
      setGpsStatus('MANUAL');
    }
  };

  const loadMyReports = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getMyCitizenReports();
      setMyReports(res.reports || []);
    } catch (err) {
      console.error('Failed to load my citizen reports:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle Image Selection with Automatic Canvas Compression & Temporary Local Storage
  const processImageFile = async (file: File) => {
    setAnalysisResult(null);
    try {
      const compressedB64 = await compressImageFile(file, 1280);
      setSelectedImage(compressedB64);
      // Cache photo temporarily on user's device
      try {
        localStorage.setItem('urbaneye_recent_citizen_photo', compressedB64);
      } catch {
        // quota exceeded fallback
      }
    } catch (err) {
      console.warn('Fallback reading uncompressed file:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const b64 = event.target?.result as string;
        if (b64) {
          setSelectedImage(b64);
          try {
            localStorage.setItem('urbaneye_recent_citizen_photo', b64);
          } catch {}
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  // Submit Photo for Real AI Analysis & Permanent Server Disk Storage
  const handleSubmitReport = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await api.submitCitizenReport({
        imageSnippet: selectedImage,
        latitude: gpsLocation.lat,
        longitude: gpsLocation.lon,
        type: suggestedType,
      });

      setAnalysisResult(res);

      if (res.success && res.event) {
        setMyReports((prev) => [res.event!, ...prev]);
        // Clear cached photo from device storage once successfully submitted
        try {
          localStorage.removeItem('urbaneye_recent_citizen_photo');
        } catch {}
        if (onReportSubmitted) onReportSubmitted(res.event);
      }
    } catch (err: any) {
      setAnalysisResult({
        noDefect: true,
        message: err.message || 'Failed to submit citizen report. Please try again.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearSelectedPhoto = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    try {
      localStorage.removeItem('urbaneye_recent_citizen_photo');
    } catch {}
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">NEW ALERT</span>;
      case 'REVIEWED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-700 text-slate-300 border border-slate-600">REVIEWED</span>;
      case 'ASSIGNED_FOR_REPAIR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">ASSIGNED REPAIR</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">RESOLVED</span>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-8 animate-fade-in">
      {/* Citizen Header Banner */}
      <div className="bg-gradient-to-r from-[#0b2545] via-[#102a4d] to-[#1E7F73] p-6 rounded-2xl border border-teal-500/30 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-teal-400/20 border border-teal-300/40 text-teal-200 text-xs font-mono font-bold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
            <span>Citizen Reporter Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Report Road Hazards & Track Repair Lifecycle</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Upload photos of road defects. UrbanEye's AI automatically analyzes damage severity, geotags the location, saves photos to server storage, and dispatches real-time alerts to municipal road authorities.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700 text-center">
            <div className="text-xs text-slate-400 font-medium">My Submissions</div>
            <div className="text-xl font-black text-teal-400">{myReports.length}</div>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700 text-center">
            <div className="text-xs text-slate-400 font-medium">Reporter ID</div>
            <div className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{user.name || user.email}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left, Map Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Photo Capture & Submission */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm sm:text-base flex items-center space-x-2">
              <Camera className="w-4 h-4 text-teal-400" />
              <span>Capture & Upload Defect Photo</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">STEP 1 OF 2</span>
          </div>

          {/* Hidden Inputs for Direct Phone Camera vs Gallery Upload */}
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {!selectedImage ? (
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-950/40 space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Camera className="w-7 h-7" />
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-200">Capture Road Defect Photo</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Photos are compressed on your phone and permanently stored in server disk storage for authority verification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 font-extrabold text-xs text-white shadow-lg flex items-center justify-center space-x-2 transition active:scale-98"
                >
                  <Camera className="w-4 h-4 text-teal-200" />
                  <span>Take Phone Camera Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-extrabold text-xs text-slate-200 shadow-md flex items-center justify-center space-x-2 transition active:scale-98"
                >
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <span>Choose from Gallery</span>
                </button>
              </div>

              <div className="inline-flex items-center space-x-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
                <Sparkles className="w-3 h-3" />
                <span>AI Perception Model verifies real defect photos</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-[320px] bg-black flex items-center justify-center">
                <img src={selectedImage} alt="Selected preview" className="w-full h-full object-contain max-h-[320px]" />
                <button
                  type="button"
                  onClick={clearSelectedPhoto}
                  className="absolute top-3 right-3 bg-red-600/90 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg transition"
                  title="Remove Image"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Temporarily Stored on Device</span>
                </div>
              </div>
            </div>
          )}

          {/* Location & Hazard Classification Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Defect Category (Optional Suggestion)
              </label>
              <select
                value={suggestedType}
                onChange={(e) => setSuggestedType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
              >
                <option value="POTHOLE">Pothole / Road Depression</option>
                <option value="LONGITUDINAL_CRACK">Road Crack (Longitudinal/Net)</option>
                <option value="SURFACE_DAMAGE">Surface Wear / Rutting</option>
                <option value="WATERLOGGING">Waterlogging / Drainage Failure</option>
                <option value="MISSING_DIVIDER">Missing / Broken Divider</option>
                <option value="FADED_ZEBRA_CROSSING">Faded Zebra Crossing</option>
                <option value="DAMAGED_SIGNBOARD">Damaged Traffic Signboard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span>GPS Location</span>
                <button
                  type="button"
                  onClick={fetchGps}
                  className="text-[10px] text-teal-400 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh GPS</span>
                </button>
              </label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span className="truncate">
                    {gpsLocation.lat.toFixed(5)}, {gpsLocation.lon.toFixed(5)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                    gpsStatus === 'FIXED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {gpsStatus}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setManualMapOpen((prev) => !prev)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Pin Map</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Leaflet Map Picker (Toggleable) */}
          {manualMapOpen && (
            <div className="border border-teal-500/40 rounded-xl p-2 bg-slate-950 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-teal-300 px-1">
                <span>Tap or Drag Marker on Map to Set Coordinates</span>
                <button onClick={() => setManualMapOpen(false)} className="text-slate-400 hover:text-white">Close</button>
              </div>
              <div className="h-56 rounded-lg overflow-hidden border border-slate-800">
                <CitizenMapPicker
                  position={[gpsLocation.lat, gpsLocation.lon]}
                  onPositionChange={([lat, lon]) => {
                    setGpsLocation({ lat, lon });
                    setGpsStatus('MANUAL');
                  }}
                />
              </div>
            </div>
          )}

          {/* AI Analysis Feedback Box */}
          {analysisResult && (
            <div className={`p-4 rounded-xl border animate-fade-in ${
              analysisResult.noDefect
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-start space-x-3">
                {analysisResult.noDefect ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm">
                    {analysisResult.noDefect ? 'No Defect Detected' : 'Report Registered on Command Portal!'}
                  </h4>
                  <p className="text-xs text-slate-300">{analysisResult.message || 'Report analyzed and saved to server storage.'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="button"
            disabled={!selectedImage || isAnalyzing}
            onClick={handleSubmitReport}
            className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm shadow-xl flex items-center justify-center space-x-2 transition active:scale-98 ${
              !selectedImage || isAnalyzing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>Running AI Perception & Saving Photo to Server...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Submit Defect Report & Broadcast to Authority Dashboard</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Submitted Reports & Status Timeline */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
            <h3 className="font-extrabold text-sm sm:text-base flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>My Reports & Repair Status</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">{myReports.length} TOTAL</span>
          </div>

          {loadingHistory ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
              <span className="text-xs text-slate-400 font-semibold">Loading report history...</span>
            </div>
          ) : myReports.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-3 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
              <Info className="w-8 h-8 text-slate-600" />
              <div className="text-xs text-slate-400">
                No defect reports submitted yet. Capture or upload a photo to start tracking.
              </div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {myReports.map((report) => (
                <div
                  key={report.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-950 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-teal-300 uppercase tracking-tight">
                        {report.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        {report.source || 'Citizen Report'}
                      </span>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-16 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                      <img
                        src={resolveImageSrc(report.imageSnippet)}
                        alt="Report snippet"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5 text-xs">
                      <div className="text-slate-300 truncate font-semibold">
                        {report.district?.name || 'Kapurthala'} District
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-teal-400" />
                        <span>{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(report.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Depth / Cost Display (N/A if uncomputable) */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <div>
                      Depth: <span className="font-bold text-slate-200">{report.depthCm ? `${report.depthCm} cm` : 'N/A'}</span>
                    </div>
                    <div>
                      Fix Cost: <span className="font-bold text-emerald-400">{report.estimatedRepairCost ? `₹${report.estimatedRepairCost.toLocaleString('en-IN')}` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
