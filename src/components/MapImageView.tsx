import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Upload,
  FileImage,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { Venue, UserLocation } from '../types';
import { saveCustomMapImage, loadCustomMapImage, removeCustomMapImage, optimizeImageFile } from '../utils/mapStorage';

interface MapImageViewProps {
  venues?: Venue[];
  userLocation?: UserLocation | null;
  onTraceRoute?: (venue: Venue) => void;
  onSelectVenueOnMap?: (venue: Venue) => void;
  isAdminMode?: boolean;
}

// Built-in High-Resolution Satipo 2026 Tournament Map Data URI
const RAW_SATIPO_MAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" width="1600" height="1100">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <pattern id="gridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#334155" stroke-width="0.75" opacity="0.35" />
    </pattern>
  </defs>

  <!-- Background Canvas -->
  <rect width="1600" height="1100" fill="url(#bgGrad)" />
  <rect width="1600" height="1100" fill="url(#gridPattern)" />

  <!-- Mountain Contour Accents (Selva Central) -->
  <path d="M 0 350 Q 300 280 650 320 T 1300 240 L 1600 290 L 1600 0 L 0 0 Z" fill="#064e3b" opacity="0.25" />
  <path d="M 0 420 Q 400 340 850 390 T 1600 330 L 1600 0 L 0 0 Z" fill="#065f46" opacity="0.2" />

  <!-- Río Satipo (Waterway) -->
  <path d="M 1600 780 C 1300 740 1050 820 850 720 C 650 620 400 680 0 590 L 0 670 C 400 760 650 700 850 800 C 1050 900 1300 820 1600 860 Z" fill="url(#riverGrad)" opacity="0.85" />
  <text x="520" y="655" fill="#7dd3fc" font-family="sans-serif" font-size="15" font-style="italic" font-weight="bold" letter-spacing="3">~~~ RÍO SATIPO ~~~</text>

  <!-- Main City Blocks Grid & Streets of Satipo -->
  <!-- Av. Raymondi (Main E-W Axis) -->
  <line x1="120" y1="460" x2="1480" y2="460" stroke="#fbbf24" stroke-width="14" stroke-linecap="round" opacity="0.9" />
  <line x1="120" y1="460" x2="1480" y2="460" stroke="#1e293b" stroke-width="4" stroke-dasharray="16, 12" />
  <text x="800" y="445" fill="#fde68a" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="middle" letter-spacing="2">AV. ANTONIO RAYMONDI (EJE PRINCIPAL)</text>

  <!-- Jr. Manuel Prado -->
  <line x1="120" y1="560" x2="1480" y2="560" stroke="#94a3b8" stroke-width="10" opacity="0.6" />
  <text x="800" y="550" fill="#cbd5e1" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">JR. MANUEL PRADO</text>

  <!-- Jr. Francisco Irazola -->
  <line x1="120" y1="360" x2="1480" y2="360" stroke="#94a3b8" stroke-width="10" opacity="0.6" />
  <text x="800" y="350" fill="#cbd5e1" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">JR. FRANCISCO IRAZOLA</text>

  <!-- Jr. Junín -->
  <line x1="120" y1="260" x2="1480" y2="260" stroke="#64748b" stroke-width="8" opacity="0.5" />
  <text x="800" y="250" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="600" text-anchor="middle">JR. JUNÍN</text>

  <!-- Cross Streets (N-S) -->
  <!-- Jr. Colón -->
  <line x1="380" y1="180" x2="380" y2="920" stroke="#94a3b8" stroke-width="9" opacity="0.6" />
  <text x="370" y="210" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="700" transform="rotate(-90 370 210)">JR. COLÓN</text>

  <!-- Jr. Augusto B. Leguía -->
  <line x1="620" y1="180" x2="620" y2="920" stroke="#94a3b8" stroke-width="9" opacity="0.6" />
  <text x="610" y="210" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="700" transform="rotate(-90 610 210)">AV. AUGUSTO B. LEGUÍA</text>

  <!-- Jr. José Gálvez -->
  <line x1="880" y1="180" x2="880" y2="920" stroke="#94a3b8" stroke-width="9" opacity="0.6" />
  <text x="870" y="210" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="700" transform="rotate(-90 870 210)">JR. JOSÉ GÁLVEZ</text>

  <!-- Jr. San Martín -->
  <line x1="1140" y1="180" x2="1140" y2="920" stroke="#94a3b8" stroke-width="9" opacity="0.6" />
  <text x="1130" y="210" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="700" transform="rotate(-90 1130 210)">JR. SAN MARTÍN</text>

  <!-- Highway to Mazamari / Pangoa -->
  <line x1="120" y1="820" x2="1480" y2="820" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" opacity="0.75" />
  <text x="800" y="810" fill="#bae6fd" font-family="sans-serif" font-size="14" font-weight="800" text-anchor="middle">CARRETERA MARGINAL DE LA SELVA (A MAZAMARI / PANGOA)</text>

  <!-- PLAZA PRINCIPAL DE SATIPO (Center Landmark) -->
  <rect x="740" y="410" width="100" height="100" rx="14" fill="#059669" stroke="#34d399" stroke-width="4" opacity="0.9" />
  <text x="790" y="455" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="900" text-anchor="middle">PLAZA</text>
  <text x="790" y="475" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">PRINCIPAL</text>
  <circle cx="790" cy="425" r="5" fill="#fbbf24" />

  <!-- SEDE 1: ESTADIO MUNICIPAL DE SATIPO -->
  <g transform="translate(240, 290)">
    <!-- Stadium Field -->
    <rect x="0" y="0" width="180" height="110" rx="20" fill="#15803d" stroke="#22c55e" stroke-width="4" filter="url(#glow)" />
    <!-- Running Track -->
    <rect x="10" y="10" width="160" height="90" rx="14" fill="#b91c1c" opacity="0.8" />
    <!-- Pitch -->
    <rect x="25" y="20" width="130" height="70" rx="6" fill="#16a34a" />
    <circle cx="90" cy="55" r="16" fill="none" stroke="#ffffff" stroke-width="2" />
    <line x1="90" y1="20" x2="90" y2="90" stroke="#ffffff" stroke-width="2" />
    <!-- Pin Badge -->
    <circle cx="90" cy="-15" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
    <text x="90" y="-8" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" text-anchor="middle">1</text>
    <rect x="-10" y="118" width="200" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
    <text x="90" y="134" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">ESTADIO MUNICIPAL</text>
    <text x="90" y="146" fill="#4ade80" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">Fútbol 11 • Atletismo</text>
  </g>

  <!-- SEDE 2: COLISEO CERRADO SHIRAMPARI -->
  <g transform="translate(1020, 290)">
    <!-- Dome Building -->
    <rect x="0" y="0" width="160" height="110" rx="24" fill="#1e3a8a" stroke="#60a5fa" stroke-width="4" filter="url(#glow)" />
    <ellipse cx="80" cy="55" rx="55" ry="35" fill="#2563eb" />
    <line x1="40" y1="55" x2="120" y2="55" stroke="#fbbf24" stroke-width="3" />
    <!-- Pin Badge -->
    <circle cx="80" cy="-15" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
    <text x="80" y="-8" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" text-anchor="middle">2</text>
    <rect x="-20" y="118" width="200" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
    <text x="80" y="134" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">COLISEO SHIRAMPARI</text>
    <text x="80" y="146" fill="#60a5fa" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">Vóley Mixto • Básquetbol</text>
  </g>

  <!-- SEDE 3: COMPLEJO NATALIO MANCILLA -->
  <g transform="translate(380, 680)">
    <rect x="0" y="0" width="160" height="100" rx="16" fill="#854d0e" stroke="#eab308" stroke-width="4" />
    <rect x="15" y="15" width="60" height="70" rx="4" fill="#ca8a04" />
    <rect x="85" y="15" width="60" height="70" rx="4" fill="#ca8a04" />
    <circle cx="80" cy="-15" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
    <text x="80" y="-8" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" text-anchor="middle">3</text>
    <rect x="-20" y="108" width="200" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
    <text x="80" y="124" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">COMPLEJO N. MANCILLA</text>
    <text x="80" y="136" fill="#facc15" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">Futsal Libre • Máster</text>
  </g>

  <!-- SEDE 4: PISCINA MUNICIPAL SEMIOLÍMPICA -->
  <g transform="translate(1020, 680)">
    <rect x="0" y="0" width="160" height="100" rx="16" fill="#0369a1" stroke="#38bdf8" stroke-width="4" filter="url(#glow)" />
    <!-- Pool lanes -->
    <rect x="15" y="15" width="130" height="70" rx="6" fill="#0284c7" />
    <line x1="15" y1="32" x2="145" y2="32" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8, 4" />
    <line x1="15" y1="50" x2="145" y2="50" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8, 4" />
    <line x1="15" y1="68" x2="145" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8, 4" />
    <circle cx="80" cy="-15" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
    <text x="80" y="-8" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" text-anchor="middle">4</text>
    <rect x="-20" y="108" width="200" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
    <text x="80" y="124" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">PISCINA MUNICIPAL</text>
    <text x="80" y="136" fill="#38bdf8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">Natación 50m • Relevos</text>
  </g>

  <!-- SEDE 5: CENTRO DE CONVENCIONES SATIPO -->
  <g transform="translate(710, 680)">
    <rect x="0" y="0" width="160" height="100" rx="16" fill="#4c1d95" stroke="#a855f7" stroke-width="4" />
    <polygon points="20,75 80,25 140,75" fill="#6b21a8" />
    <circle cx="80" cy="-15" r="22" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
    <text x="80" y="-8" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" text-anchor="middle">5</text>
    <rect x="-20" y="108" width="200" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
    <text x="80" y="124" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">CENTRO CONVENCIONES</text>
    <text x="80" y="136" fill="#c084fc" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">Acreditaciones • Noche Cultural</text>
  </g>

  <!-- HEADER BANNER & TITLES -->
  <rect x="40" y="30" width="1520" height="110" rx="20" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
  <rect x="55" y="45" width="90" height="80" rx="16" fill="#15803d" stroke="#4ade80" stroke-width="2" />
  <text x="100" y="98" font-size="44" text-anchor="middle">🏆</text>

  <text x="165" y="75" fill="#fbbf24" font-family="sans-serif" font-size="16" font-weight="900" letter-spacing="3">PLANO OFICIAL DE SEDES DEPORTIVAS Y TURÍSTICAS</text>
  <text x="165" y="105" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="900" letter-spacing="1">CAMPEONATO INTERMUNICIPALIDADES SATIPO 2026</text>
  <text x="165" y="126" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="600">Provincia de Satipo, Región Junín • 18 y 19 de Septiembre de 2026 • Cobertura Integral Selva Central</text>

  <!-- COMPASS ROSE / ROSA DE LOS VIENTOS (TOP RIGHT) -->
  <g transform="translate(1460, 85)">
    <circle cx="0" cy="0" r="32" fill="#1e293b" stroke="#fbbf24" stroke-width="2" />
    <polygon points="0,-26 6,-6 26,0 6,6 0,26 -6,6 -26,0 -6,-6" fill="#f59e0b" />
    <polygon points="0,-26 0,0 6,-6" fill="#ef4444" />
    <text x="0" y="-30" fill="#ef4444" font-family="sans-serif" font-size="14" font-weight="900" text-anchor="middle">N</text>
    <text x="32" y="5" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">E</text>
    <text x="0" y="42" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">S</text>
    <text x="-38" y="5" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">O</text>
  </g>

  <!-- LEGEND / CONVENCIONES (BOTTOM LEFT) -->
  <rect x="40" y="930" width="1520" height="135" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2" />
  <text x="65" y="960" fill="#38bdf8" font-family="sans-serif" font-size="15" font-weight="900" letter-spacing="1">GUÍA RÁPIDA DE CONVENCIONES:</text>

  <circle cx="80" cy="990" r="12" fill="#ef4444" />
  <text x="80" y="995" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">1</text>
  <text x="100" y="994" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Estadio Municipal (Fútbol/Atletismo)</text>

  <circle cx="430" cy="990" r="12" fill="#ef4444" />
  <text x="430" y="995" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">2</text>
  <text x="450" y="994" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Coliseo Shirampari (Vóley/Básquet)</text>

  <circle cx="780" cy="990" r="12" fill="#ef4444" />
  <text x="780" y="995" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">3</text>
  <text x="800" y="994" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Complejo Natalio Mancilla (Futsal)</text>

  <circle cx="1130" cy="990" r="12" fill="#ef4444" />
  <text x="1130" y="995" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">4</text>
  <text x="1150" y="994" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Piscina Municipal (Natación)</text>

  <circle cx="80" cy="1035" r="12" fill="#ef4444" />
  <text x="80" y="1040" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">5</text>
  <text x="100" y="1039" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Centro de Convenciones</text>

  <rect x="420" y="1025" width="20" height="20" rx="4" fill="#059669" />
  <text x="450" y="1039" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Plaza Principal de Satipo</text>

  <rect x="770" y="1030" width="25" height="10" rx="3" fill="#fbbf24" />
  <text x="805" y="1039" fill="#f1f5f9" font-family="sans-serif" font-size="13" font-weight="bold">Av. Raymondi (Corredor Comercial)</text>

  <rect x="1120" y="1030" width="25" height="10" rx="3" fill="#0284c7" />
  <text x="1155" y="1039" fill="#7dd3fc" font-family="sans-serif" font-size="13" font-weight="bold">Río Satipo y Ecoturismo</text>
</svg>`;

const DEFAULT_SATIPO_MAP_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(RAW_SATIPO_MAP_SVG)}`;

const MapImageViewComponent: React.FC<MapImageViewProps> = ({
  isAdminMode = false,
}) => {
  // Load custom JPG map from localStorage/IndexedDB if available
  const [customMapUrl, setCustomMapUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('satipo2026_custom_jpg_map') || null;
    } catch {
      return null;
    }
  });

  const [activeImageSrc, setActiveImageSrc] = useState<string>(
    customMapUrl || DEFAULT_SATIPO_MAP_SVG
  );

  const [isProcessingMap, setIsProcessingMap] = useState<boolean>(false);

  useEffect(() => {
    loadCustomMapImage().then((stored) => {
      if (stored) {
        setCustomMapUrl(stored);
        setActiveImageSrc(stored);
      }
    });

    const handleCustomMapSync = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      const newUrl = customEvent.detail;
      setCustomMapUrl(newUrl);
      setActiveImageSrc(newUrl || DEFAULT_SATIPO_MAP_SVG);
    };
    window.addEventListener('satipo_custom_map_updated', handleCustomMapSync);
    return () => window.removeEventListener('satipo_custom_map_updated', handleCustomMapSync);
  }, []);

  // Zoom and Pan States
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show notification toast
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.35, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.35, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((prev) => {
      const next = Math.max(0.5, Math.min(4, prev + zoomFactor));
      return parseFloat(next.toFixed(2));
    });
  };

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support (Touch drag & Pinch-to-zoom)
  const [isPinching, setIsPinching] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setIsPinching(false);
      touchDistanceRef.current = null;
      touchStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setIsPinching(true);
      const p1 = e.touches[0];
      const p2 = e.touches[1];
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = scale;
      pinchStartPosRef.current = { ...position };
      pinchStartMidpointRef.current = {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const newX = e.touches[0].clientX - touchStartRef.current.x;
      const newY = e.touches[0].clientY - touchStartRef.current.y;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: newX, y: newY });
      });
    } else if (isPinching && e.touches.length === 2 && touchDistanceRef.current && touchDistanceRef.current > 0) {
      const p1 = e.touches[0];
      const p2 = e.touches[1];
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      const currentDist = Math.hypot(dx, dy);

      if (currentDist > 0) {
        const factor = currentDist / touchDistanceRef.current;
        const newScale = Math.min(Math.max(pinchStartScaleRef.current * factor, 0.4), 6);
        const currentMidX = (p1.clientX + p2.clientX) / 2;
        const currentMidY = (p1.clientY + p2.clientY) / 2;
        const deltaX = currentMidX - pinchStartMidpointRef.current.x;
        const deltaY = currentMidY - pinchStartMidpointRef.current.y;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setScale(parseFloat(newScale.toFixed(3)));
          setPosition({
            x: pinchStartPosRef.current.x + deltaX,
            y: pinchStartPosRef.current.y + deltaY,
          });
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPinching(false);
    touchDistanceRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  // Upload custom map (Admin Only: Drag-and-Drop + File Input)
  const handleFileUpload = async (file: File) => {
    if (!isAdminMode) return;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (.jpg, .jpeg, .png, .webp)');
      return;
    }

    setIsProcessingMap(true);
    try {
      const optimizedData = await optimizeImageFile(file);
      await saveCustomMapImage(optimizedData);
      setCustomMapUrl(optimizedData);
      setActiveImageSrc(optimizedData);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      showToast('✅ ¡Plano oficial guardado y actualizado con éxito!');
    } catch (err: any) {
      showToast('❌ Error al guardar el plano: ' + (err?.message || 'Formato no soportado'));
    } finally {
      setIsProcessingMap(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAdminMode && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isAdminMode) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    if (!isAdminMode) return;
    setIsDragOver(false);
  };

  // Reset / Delete custom map (Admin Only)
  const handleRestoreDefaultMap = async () => {
    if (!isAdminMode) return;
    if (confirm('¿Restablecer el plano al croquis oficial predeterminado?')) {
      await removeCustomMapImage();
      setCustomMapUrl(null);
      setActiveImageSrc(DEFAULT_SATIPO_MAP_SVG);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      showToast('Plano restablecido al diseño predeterminado');
    }
  };

  // Download Map file directly for offline use (Available for everyone)
  const handleDownloadMap = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || 1600;
      canvas.height = img.naturalHeight || 1100;
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        try {
          const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
          const link = document.createElement('a');
          link.download = 'Plano_Satipo_2026.jpg';
          link.href = jpgUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('📥 Descargando plano para uso offline...');
        } catch {
          // Direct link fallback
          const link = document.createElement('a');
          link.download = 'Plano_Satipo_2026.jpg';
          link.href = activeImageSrc;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    };
    img.src = activeImageSrc;
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none ${
        isFullScreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Admin-only Hidden File Input for Image Upload */}
      {isAdminMode && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
      )}

      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20 shadow-md">
        {/* Title & Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
            <FileImage className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                Plano
              </h2>
              {isAdminMode && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin</span>
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              {isAdminMode
                ? 'Como administrador puedes cargar o limpiar el plano. Los participantes solo pueden visualizar y descargar.'
                : 'Usa zoom, arrastra para explorar o descarga la imagen para verla sin señal.'}
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700">
            <button
              id="btn-plano-zoom-out"
              onClick={handleZoomOut}
              title="Alejar (-)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-slate-300 min-w-[42px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              id="btn-plano-zoom-in"
              onClick={handleZoomIn}
              title="Acercar (+)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              id="btn-plano-reset"
              onClick={handleResetZoom}
              title="Restablecer vista (100%)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition border-l border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ADMIN ONLY: Upload / Change Map Button */}
          {isAdminMode && (
            <button
              id="btn-admin-upload-plano"
              onClick={() => fileInputRef.current?.click()}
              title="Cargar nuevo archivo de plano (JPG, PNG, WEBP)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold border border-amber-500/40 transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Cargar Plano</span>
            </button>
          )}

          {/* ADMIN ONLY: Clear / Delete custom map button */}
          {isAdminMode && customMapUrl && (
            <button
              id="btn-admin-clear-plano"
              onClick={handleRestoreDefaultMap}
              title="Limpiar y restablecer plano oficial predeterminado"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-bold transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar Plano</span>
            </button>
          )}

          {/* Download Button (Available for all participants & admin) */}
          <button
            id="btn-download-plano"
            onClick={handleDownloadMap}
            title="Descargar plano en formato imagen para ver sin conexión"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-950 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            id="btn-plano-fullscreen"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Image Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onDragOver={isAdminMode ? handleDragOver : undefined}
        onDragLeave={isAdminMode ? handleDragLeave : undefined}
        onDrop={isAdminMode ? handleDrop : undefined}
        style={{ touchAction: 'none' }}
        className={`flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
          isAdminMode && isDragOver ? 'ring-4 ring-amber-500 bg-amber-950/20' : ''
        }`}
      >
        {/* Admin Drag & Drop Overlay Helper */}
        {isAdminMode && isDragOver && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-amber-400 pointer-events-none">
            <Upload className="w-16 h-16 text-amber-400 animate-bounce mb-3" />
            <h3 className="text-xl font-black text-white">Suelta la imagen del plano aquí</h3>
            <p className="text-sm text-slate-300 mt-1">Se optimizará y guardará de forma permanente</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessingMap && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <Clock className="w-12 h-12 text-amber-400 animate-spin mb-3" />
            <h3 className="text-lg font-black text-white">Guardando y optimizando plano...</h3>
            <p className="text-xs text-slate-300 mt-1">Almacenando en base de datos local permanente</p>
          </div>
        )}

        {/* The Transformed Image Viewport */}
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition: (isDragging || isPinching) ? 'none' : 'transform 0.15s cubic-bezier(0, 0, 0.2, 1)',
            willChange: (isDragging || isPinching) ? 'transform' : 'auto',
          }}
          className="max-w-none max-h-none flex items-center justify-center select-none"
        >
          <img
            src={activeImageSrc}
            alt="Plano Satipo 2026"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => {
              if (activeImageSrc !== DEFAULT_SATIPO_MAP_SVG) {
                setActiveImageSrc(DEFAULT_SATIPO_MAP_SVG);
              }
            }}
            className="w-auto h-auto max-w-[95vw] sm:max-w-[85vw] max-h-[75vh] sm:max-h-[80vh] object-contain rounded-xl shadow-2xl border border-slate-800 shadow-black pointer-events-none drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
};

export const MapImageView = React.memo(MapImageViewComponent);
