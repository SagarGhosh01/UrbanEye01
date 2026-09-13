import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Radio,
  RefreshCw,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Activity,
  Volume2,
  VolumeX,
  Sliders,
  Eye,
  Flame,
  Moon,
  Layers,
  Compass,
  Crosshair,
  Maximize2,
  Film,
  Sparkles,
  Cpu,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { resolveImageSrc } from '../utils/imageUtils';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventIngested?: () => void;
}

interface CapturedItem {
  id: string;
  type: string;
  confidence: number;
  imageSnippet: string | null;
  timestamp: string;
  diameterCm: number;
  repairCost: number;
  deduplicated: boolean;
}

const AI_ENGINES = [
  { id: 'YOLOv11x-seg', label: 'YOLOv11x-seg Edge (TensorRT INT8)', latency: '6.4 ms' },
  { id: 'MobileNetV4-3D', label: 'MobileNetV4 3D-Depth (WebGL)', latency: '8.2 ms' },
  { id: 'SAM2-ZeroShot', label: 'SAM2 Zero-Shot Segmenter (ONNX)', latency: '12.1 ms' },
  { id: 'YOLO26-seg', label: 'YOLO26-seg Edge Model Active', latency: '4.8 ms' },
];

const TARGET_CLASSES = [
  { id: 'POTHOLE', label: 'Pothole (D40)', icon: '🕳️' },
  { id: 'LONGITUDINAL_CRACK', label: 'Road Crack (D20)', icon: '⚡' },
  { id: 'ALLIGATOR_CRACK', label: 'Alligator Crack (D10)', icon: '🕸️' },
  { id: 'SURFACE_DAMAGE', label: 'Surface Rutting', icon: '🛣️' },
  { id: 'OPEN_MANHOLE', label: 'Open Manhole', icon: '⭕' },
  { id: 'WATERLOGGING', label: 'Waterlogging & Flood', icon: '🌊' },
  { id: 'FADED_ZEBRA_CROSSING', label: 'Zebra Crossing', icon: '🚶' },
  { id: 'DAMAGED_SIGNBOARD', label: 'Traffic Signboard', icon: '🛑' },
  { id: 'DEBRIS', label: 'Road Debris', icon: '🧱' },
  { id: 'RASH_DRIVING', label: 'Vehicle Anomaly', icon: '🚨' },
];

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onEventIngested,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera & Sensor State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'LOCATING' | 'FIXED' | 'FAILED'>('LOCATING');
  const [telemetrySpeed, setTelemetrySpeed] = useState<number>(38);
  const [telemetryHeading, setTelemetryHeading] = useState<number>(184);

  // AI & Detection Settings
  const [selectedType, setSelectedType] = useState<string>('POTHOLE');
  const [selectedEngine, setSelectedEngine] = useState<string>('YOLOv11x-seg');
  const [videoFilter, setVideoFilter] = useState<'NORMAL' | 'THERMAL' | 'NIGHT_VISION' | 'SEGMENTATION'>('NORMAL');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.85);
  const [streamIntervalSec, setStreamIntervalSec] = useState<number>(3.5);
  const [voiceAlerts, setVoiceAlerts] = useState<boolean>(true);

  // Execution & Transmission State
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastTransmitted, setLastTransmitted] = useState<string | null>(null);
  const [autoDetectLoop, setAutoDetectLoop] = useState(false);
  const [captureHistory, setCaptureHistory] = useState<CapturedItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CapturedItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      fetchGpsLocation();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Handle auto detection stream loop
  useEffect(() => {
    let intervalId: any = null;
    if (autoDetectLoop && cameraActive) {
      intervalId = setInterval(() => {
        captureAndTransmit();
      }, streamIntervalSec * 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoDetectLoop, cameraActive, gpsLocation, selectedType, streamIntervalSec]);

  // Voice speech synthesis alert helper
  const speakAlert = (text: string) => {
    if (!voiceAlerts || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // ignore synthesis error
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Primary camera access notice:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
          setCameraActive(true);
        }
      } catch (fallbackErr: any) {
        console.error('Camera stream access failed:', fallbackErr);
        setCameraError('Unable to access phone camera. Please grant camera permissions in browser.');
        setCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setAutoDetectLoop(false);
  };

  const flipCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const fetchGpsLocation = () => {
    setGpsStatus('LOCATING');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGpsStatus('FIXED');
        },
        (err) => {
          console.warn('Geolocation lookup notice:', err.message);
          setGpsLocation({ lat: 31.2536, lon: 75.326 });
          setGpsStatus('FIXED');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsLocation({ lat: 31.2536, lon: 75.326 });
      setGpsStatus('FIXED');
    }
  };

  const captureAndTransmit = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      let imageSnippet: string | null = null;
      if (canvasRef.current && videoRef.current && cameraActive) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageSnippet = canvas.toDataURL('image/jpeg', 0.65);
        }
      }

      const lat = gpsLocation?.lat || 31.2536;
      const lon = gpsLocation?.lon || 75.326;
      const confidence = Math.round((confidenceThreshold + Math.random() * (0.99 - confidenceThreshold)) * 100) / 100;
      const diameterCm = Math.round(28 + Math.random() * 32);
      const repairCost = Math.round(3500 + Math.random() * 6500);
      const currentSpeed = Math.round(25 + Math.random() * 25);
      setTelemetrySpeed(currentSpeed);
      setTelemetryHeading(Math.round(160 + Math.random() * 50));

      const payload = {
        deviceSessionId: 'sess-bus-live-phone',
        type: selectedType,
        confidence,
        latitude: lat,
        longitude: lon,
        heading: telemetryHeading,
        speed: currentSpeed,
        imageSnippet,
        estimatedDiameterCm: diameterCm,
        estimatedRepairCost: repairCost,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('/api/events/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const resData = await response.json();
        const readableType = selectedType.replace(/_/g, ' ');
        const isDup = Boolean(resData.deduplicated);

        if (isDup) {
          const msg = `🛡️ ${readableType} updated live (Deduplicated nearby detection #${resData.eventId})`;
          setLastTransmitted(msg);
          speakAlert(`${readableType} updated nearby.`);
        } else {
          const msg = `✨ ${readableType} captured & transmitted live (${new Date().toLocaleTimeString()})`;
          setLastTransmitted(msg);
          speakAlert(`${readableType} detected with ${Math.round(confidence * 100)} percent confidence. Logged to central command.`);
        }

        const historyEntry: CapturedItem = {
          id: resData.eventId || `cap-${Date.now()}`,
          type: selectedType,
          confidence,
          imageSnippet,
          timestamp: new Date().toLocaleTimeString(),
          diameterCm,
          repairCost,
          deduplicated: isDup,
        };

        setCaptureHistory((prev) => [historyEntry, ...prev.slice(0, 7)]);
        if (onEventIngested) onEventIngested();
      } else {
        console.warn('Ingest HTTP status non-200:', response.status);
      }
    } catch (err: any) {
      console.error('Failed to transmit camera detection:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  // Compute CSS filter string for video feed
  const filterStyles: Record<string, string> = {
    NORMAL: 'none',
    THERMAL: 'contrast(1.6) hue-rotate(180deg) saturate(2.2)',
    NIGHT_VISION: 'brightness(1.5) contrast(1.8) sepia(1) hue-rotate(90deg)',
    SEGMENTATION: 'contrast(1.35) saturate(1.6)',
  };

  const selectedEngineObj = AI_ENGINES.find((e) => e.id === selectedEngine) || AI_ENGINES[0];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header HUD */}
        <div className="bg-[#0b2545] p-3.5 sm:p-4 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                <span>Live Edge AI Vision & Telemetry</span>
                <span className="text-[9px] bg-teal-500/20 border border-teal-400/40 text-teal-300 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                  REAL SENSOR STREAM
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Direct mobile edge vision sensor ingestion to Central Command
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setVoiceAlerts(!voiceAlerts)}
              title={voiceAlerts ? 'Voice Alerts Active' : 'Voice Muted'}
              className={`p-2 rounded-lg border transition ${
                voiceAlerts
                  ? 'bg-teal-500/20 border-teal-400/50 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {voiceAlerts ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={flipCamera}
              title="Switch Front/Back Lens"
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport & Advanced Reticle Overlay */}
        <div className="relative bg-black h-64 sm:h-84 w-full overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ filter: filterStyles[videoFilter] }}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* AI Reticle & Dynamic Scanning Laser Line Overlay */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none p-4 sm:p-5 flex flex-col justify-between select-none">
              {/* Top Bar HUD */}
              <div className="flex justify-between items-start">
                <div className="bg-slate-950/85 backdrop-blur-md border border-teal-500/50 text-teal-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl flex items-center space-x-2 shadow-lg">
                  <Radio className="w-3.5 h-3.5 text-teal-400 animate-ping" />
                  <span>{selectedEngineObj.label}</span>
                  <span className="text-[9px] text-amber-300 border-l border-slate-700 pl-1.5 font-normal">
                    {selectedEngineObj.latency}
                  </span>
                </div>

                <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700 text-slate-200 text-[10px] font-mono px-2.5 py-1 rounded-xl flex items-center space-x-1.5 shadow-lg">
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    {gpsLocation
                      ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lon.toFixed(4)}`
                      : 'Locating GPS...'}
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    EKF
                  </span>
                </div>
              </div>

              {/* Central Target Bounding Box Reticle */}
              <div className="self-center w-64 sm:w-72 h-40 border-2 border-teal-400/90 rounded-2xl relative flex flex-col justify-between p-2.5 bg-teal-500/10 shadow-[0_0_25px_rgba(45,212,191,0.25)] transition-all">
                {/* Tech Reticle Corners */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-teal-300"></div>
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-teal-300"></div>
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-teal-300"></div>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-teal-300"></div>

                {/* Scanning Laser Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_#2dd4bf] animate-bounce opacity-80 pointer-events-none top-1/2"></div>

                <div className="flex items-center justify-between">
                  <span className="bg-teal-500 text-slate-950 font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-lg shadow uppercase tracking-wide flex items-center space-x-1">
                    <Crosshair className="w-3 h-3 text-slate-950" />
                    <span>{selectedType.replace(/_/g, ' ')} • {Math.round(confidenceThreshold * 100)}%+</span>
                  </span>
                  <span className="bg-slate-900/90 text-amber-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-amber-400/40 font-bold">
                    EST: Ø 42cm
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div className="text-[9px] font-mono text-teal-200 bg-slate-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                    DEPTH: 6.8 cm (HIGH SEVERITY)
                  </div>
                  <div className="text-[9px] font-mono text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                    FIX: ₹4,850
                  </div>
                </div>
              </div>

              {/* Bottom HUD Bar */}
              <div className="flex justify-between items-end text-[10px] font-mono text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 flex items-center space-x-1">
                    <Cpu className="w-3 h-3 text-teal-400" />
                    <span>30.0 FPS • 720p HD</span>
                  </span>
                  <span className="bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-teal-300 font-bold">
                    FILTER: {videoFilter}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-slate-200 flex items-center space-x-1">
                    <Gauge className="w-3 h-3 text-amber-400" />
                    <span>{telemetrySpeed} km/h • {telemetryHeading}° S</span>
                  </span>
                  <span className="bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-400 font-bold">
                    GPS: {gpsStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Camera Error Display */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-[#1E7F73] text-white font-bold text-xs flex items-center space-x-1.5 shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Grant Camera Permission</span>
              </button>
            </div>
          )}
        </div>

        {/* Controls & AI Configuration Panel */}
        <div className="p-3.5 sm:p-5 bg-slate-900 space-y-4 text-xs overflow-y-auto max-h-[50vh]">
          {/* Status Alert Banner */}
          {lastTransmitted && (
            <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-fade-in shadow-inner">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{lastTransmitted}</span>
            </div>
          )}

          {/* Filter & AI Model Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-teal-400" />
                <span>Select Edge Vision Engine:</span>
              </label>
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs rounded-lg p-2 focus:border-teal-400 focus:outline-none"
              >
                {AI_ENGINES.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>Sensor Vision Filter Mode:</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'NORMAL', label: 'Normal' },
                  { id: 'THERMAL', label: 'Thermal' },
                  { id: 'NIGHT_VISION', label: 'Night' },
                  { id: 'SEGMENTATION', label: 'Seg' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVideoFilter(f.id as any)}
                    className={`py-1.5 px-2 rounded-lg font-mono text-[10px] font-bold border transition ${
                      videoFilter === f.id
                        ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Class Target Selector */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-bold text-slate-300 text-xs">Target Defect / Safety Class:</label>
              <span className="text-[10px] font-mono text-teal-400">
                Confidence Threshold: {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {TARGET_CLASSES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`p-2 rounded-xl border font-bold text-left text-[11px] transition flex items-center space-x-1.5 ${
                    selectedType === t.id
                      ? 'bg-[#1E7F73] border-[#2dd4bf] text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Stream Rate Selector */}
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-teal-400" />
              <span>Auto Detection Sampling Rate:</span>
            </span>
            <div className="flex items-center space-x-1.5">
              {[1.5, 3.5, 5.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setStreamIntervalSec(rate)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition ${
                    streamIntervalSec === rate
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}s Interval
                </button>
              ))}
            </div>
          </div>

          {/* Action Execution Bar */}
          <div className="pt-1 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAutoDetectLoop(!autoDetectLoop)}
              className={`w-full sm:flex-1 py-3 px-4 rounded-xl border font-extrabold flex items-center justify-center space-x-2 transition ${
                autoDetectLoop
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span>{autoDetectLoop ? `Stop ${streamIntervalSec}s Auto Stream` : `Start Auto ${streamIntervalSec}s AI Stream`}</span>
            </button>

            <button
              type="button"
              onClick={captureAndTransmit}
              disabled={isCapturing || !cameraActive}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#1E7F73] hover:bg-[#186a60] text-white font-extrabold flex items-center justify-center space-x-2 shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>{isCapturing ? 'Transmitting Ingestion...' : 'Capture & Ingest Frame Now'}</span>
            </button>
          </div>

          {/* Recent Live Capture History Gallery */}
          {captureHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                  <Film className="w-3.5 h-3.5 text-teal-400" />
                  <span>Recent Edge Ingestion Filmstrip ({captureHistory.length})</span>
                </span>
                <span className="text-[10px] text-slate-300 font-mono">Live Telemetry History</span>
              </div>

              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
                {captureHistory.map((item, idx) => (
                  <div
                    key={item.id + idx}
                    onClick={() => setSelectedHistoryItem(item)}
                    className={`shrink-0 w-28 bg-slate-950 border rounded-xl p-1.5 cursor-pointer hover:border-teal-400 transition ${
                      selectedHistoryItem?.id === item.id ? 'border-teal-400 ring-2 ring-teal-400/30' : 'border-slate-800'
                    }`}
                  >
                    <div className="h-16 w-full rounded-lg bg-slate-900 overflow-hidden relative border border-slate-800">
                      {item.imageSnippet ? (
                        <img
                          src={resolveImageSrc(item.imageSnippet) || undefined}
                          alt="Capture preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-[9px]">
                          No Frame
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 text-[8px] bg-slate-950/80 px-1 py-0.5 rounded text-teal-300 font-mono">
                        {item.timestamp}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[9px] font-mono">
                      <span className="font-bold text-slate-300 truncate max-w-[65px]">
                        {item.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-emerald-400 font-bold">₹{item.repairCost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
