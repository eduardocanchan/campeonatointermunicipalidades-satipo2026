import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation,
  Compass,
  Layers,
  MapPin,
  X,
  ExternalLink,
  Sparkles,
  Route,
  CheckCircle2,
  Clock,
  Info,
  Maximize2,
  Minimize2,
  Car,
  Check,
  Loader2,
  Plus,
  Minus,
  AlertTriangle,
  Shapes,
  Undo2,
  Trash2,
  LocateFixed,
} from 'lucide-react';
import { Venue, RouteData, UserLocation, ScheduleEvent, VenueCategory, BaseZoneConfig } from '../types';
import { SATIPO_CENTER } from '../data/defaultData';
import { openExternalGoogleMaps, openExternalAppleMaps } from '../utils/geo';

interface InteractiveMapProps {
  venues: Venue[];
  events: ScheduleEvent[];
  venueCategories?: VenueCategory[];
  selectedVenue: Venue | null;
  onSelectVenue: (venue: Venue | null) => void;
  userLocation: UserLocation | null;
  onTraceRoute: (destination: Venue) => void;
  activeRoute: RouteData | null;
  onClearRoute: () => void;
  isPickingLocation: boolean;
  pickingVenueName?: string;
  pickingCoordinates?: { lat: number; lng: number } | null;
  isVisible?: boolean;
  onLocationPicked: (lat: number, lng: number) => void;
  onCancelPickLocation: () => void;
  onCenterUser: () => void;
  userCenterTrigger?: number;
  isLocating?: boolean;
  baseZone?: BaseZoneConfig;
  isUserOutsideBaseZone?: boolean;
  isEditingPolygon?: boolean;
  polygonDraftPoints?: [number, number][];
  onAddPolygonPoint?: (lat: number, lng: number) => void;
  onUpdatePolygonPoint?: (index: number, lat: number, lng: number) => void;
  onDeletePolygonPoint?: (index: number) => void;
  onUndoPolygonPoint?: () => void;
  onClearPolygonPoints?: () => void;
  onSavePolygonDraft?: () => void;
  onCancelPolygonDraft?: () => void;
  isGpsTracking?: boolean;
  onToggleGpsTracking?: (active: boolean) => void;
  isSimulatingGps?: boolean;
  onToggleSimulateGps?: () => void;
}

const InteractiveMapComponent: React.FC<InteractiveMapProps> = ({
  venues,
  events,
  venueCategories = [],
  selectedVenue,
  onSelectVenue,
  userLocation,
  onTraceRoute,
  activeRoute,
  onClearRoute,
  isPickingLocation,
  pickingVenueName = 'Sede',
  pickingCoordinates,
  isVisible = true,
  onLocationPicked,
  onCancelPickLocation,
  onCenterUser,
  userCenterTrigger,
  isLocating = false,
  baseZone,
  isUserOutsideBaseZone = false,
  isEditingPolygon = false,
  polygonDraftPoints = [],
  onAddPolygonPoint,
  onUpdatePolygonPoint,
  onDeletePolygonPoint,
  onUndoPolygonPoint,
  onClearPolygonPoints,
  onSavePolygonDraft,
  onCancelPolygonDraft,
  isGpsTracking = true,
  onToggleGpsTracking,
  isSimulatingGps = false,
  onToggleSimulateGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const baseZoneLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonEditLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const venueMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const pickingMarkerRef = useRef<L.Marker | null>(null);

  // Tracking state
  const [isTrackingPaused, setIsTrackingPaused] = useState<boolean>(false);

  // OpenStreetMap is default as requested
  const [mapType, setMapType] = useState<'osm' | 'streets' | 'satellite' | 'terrain'>('osm');
  const [isLayerDropdownOpen, setIsLayerDropdownOpen] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isZoneAlertDismissed, setIsZoneAlertDismissed] = useState<boolean>(false);

  const layerMenuRef = useRef<HTMLDivElement>(null);

  // Close layer dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(event.target as Node)) {
        setIsLayerDropdownOpen(false);
      }
    };
    if (isLayerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLayerDropdownOpen]);

  // OpenStreetMap first, Calles HD eliminated
  const MAP_LAYERS = [
    { id: 'osm', name: 'OpenStreetMap (Calles)', icon: '🌐', desc: 'Calles detalladas y actualizadas de Satipo' },
    { id: 'streets', name: 'Calles (Google)', icon: '🗺️', desc: 'Mapa oficial de avenidas y jirones' },
    { id: 'satellite', name: 'Satélite con Calles', icon: '🛰️', desc: 'Vista satelital híbrida' },
    { id: 'terrain', name: 'Relieve', icon: '⛰️', desc: 'Topografía de la selva central' },
  ] as const;

  // Helper to create reliable Tile Layer with fallback
  const createTileLayer = (type: 'osm' | 'streets' | 'satellite' | 'terrain') => {
    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let subdomains: string[] | string = ['a', 'b', 'c'];
    let attribution = '&copy; OpenStreetMap contributors';
    let maxZoom = 19;

    if (type === 'osm') {
      // OpenStreetMap Official Cartography (default)
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = ['a', 'b', 'c'];
      attribution = '&copy; OpenStreetMap contributors';
      maxZoom = 19;
    } else if (type === 'streets') {
      // Google Maps Standard Roadmap (Streets, Avenues, Blocks)
      url = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      subdomains = ['0', '1', '2', '3'];
      attribution = '&copy; Google Maps Satipo';
      maxZoom = 21;
    } else if (type === 'satellite') {
      // Google Maps Hybrid (Satellite imagery with street & place labels)
      url = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      subdomains = ['0', '1', '2', '3'];
      attribution = '&copy; Google Satellite';
      maxZoom = 21;
    } else if (type === 'terrain') {
      // Google Maps Terrain / Relief
      url = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      subdomains = ['0', '1', '2', '3'];
      attribution = '&copy; Google Maps Relieve';
      maxZoom = 20;
    }

    const tile = L.tileLayer(url, {
      subdomains,
      attribution,
      maxZoom,
      keepBuffer: 3,
      updateWhenIdle: true,
      updateWhenZooming: false,
    });

    return tile;
  };

  // Initialize Map with Street Tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map with fluid mobile touch and wide zoom limits (can zoom out smoothly)
    const map = L.map(mapContainerRef.current, {
      center: [SATIPO_CENTER.lat, SATIPO_CENTER.lng],
      zoom: SATIPO_CENTER.zoom,
      minZoom: 6,
      maxZoom: 19,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      touchZoom: true,
      bounceAtZoomLimits: false,
      wheelDebounceTime: 40,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      // @ts-ignore - tap: false fixes mobile touch gesture interference in Leaflet
      tap: false,
    });

    // Zero-lag mobile touch interceptor:
    // Instantly completes any pending animation on touchstart so subsequent pinches register immediately (0ms delay)
    const container = mapContainerRef.current;
    const handleTouchStartCapture = () => {
      if ((map as any)._animatingZoom && typeof (map as any)._onZoomTransitionEnd === 'function') {
        (map as any)._onZoomTransitionEnd();
      }
    };
    container.addEventListener('touchstart', handleTouchStartCapture, { capture: true, passive: true });

    // Initial Street Roadmap Layer (OpenStreetMap default)
    const initialTile = createTileLayer('osm').addTo(map);
    tileLayerRef.current = initialTile;

    // Layers
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    baseZoneLayerRef.current = L.layerGroup().addTo(map);
    polygonEditLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);
    map.setView([SATIPO_CENTER.lat, SATIPO_CENTER.lng], 13.5);

    // Immediate and delayed resize to accommodate dynamic container layout
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);
    const timer3 = setTimeout(() => map.invalidateSize(), 800);

    return () => {
      container.removeEventListener('touchstart', handleTouchStartCapture, { capture: true });
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
      baseZoneLayerRef.current = null;
      polygonEditLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Safe invalidate size helper that avoids visual jumps/shifts
  const safeInvalidateSize = () => {
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;
    const currentSize = map.getSize();
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Only invalidate if the physical pixel dimensions actually changed, with zero panning/animation
    if (w > 0 && h > 0 && (Math.abs(currentSize.x - w) > 2 || Math.abs(currentSize.y - h) > 2)) {
      map.invalidateSize({ pan: false, animate: false });
    }
  };

  // Safe resize only when visibility turns true or fullscreen changes
  useEffect(() => {
    if (!isVisible) return;
    safeInvalidateSize();
  }, [isVisible, isFullScreen]);

  // Responsive ResizeObserver for Map Container (debounced to avoid layout thrashing during mobile touch gestures)
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    let resizeTimer: any = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            safeInvalidateSize();
          }, 150);
        }
      }
    });
    observer.observe(mapContainerRef.current);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [mapReady, isFullScreen]);

  // Handle Tile Type changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newTile = createTileLayer(mapType).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [mapType]);

  // Handle Location Picking Focus and Visual Target Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    if (isPickingLocation) {
      const validLat = pickingCoordinates?.lat && !isNaN(pickingCoordinates.lat) ? pickingCoordinates.lat : SATIPO_CENTER.lat;
      const validLng = pickingCoordinates?.lng && !isNaN(pickingCoordinates.lng) ? pickingCoordinates.lng : SATIPO_CENTER.lng;

      mapInstanceRef.current.flyTo([validLat, validLng], 17, { duration: 0.8 });

      const pickIconHtml = `
        <div class="relative flex flex-col items-center justify-end" style="width: 48px; height: 60px;">
          <!-- Pulsing Target Ring on the street -->
          <div class="absolute bottom-1 w-10 h-10 rounded-full bg-amber-400/40 animate-ping -translate-x-1/2 left-1/2"></div>
          <div class="absolute bottom-2 w-5 h-2 rounded-full bg-slate-950/70 -translate-x-1/2 left-1/2"></div>
          <!-- Big Animated Target Pin -->
          <div class="relative z-10 flex flex-col items-center drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] animate-bounce">
            <div class="px-2.5 py-1 rounded-xl bg-amber-400 border-2 border-slate-950 text-slate-950 text-[10px] font-black uppercase whitespace-nowrap shadow-lg mb-0.5">
              ${pickingVenueName || 'Nueva Ubicación'}
            </div>
            <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-300 p-0.5 border-2 border-slate-950 shadow-xl flex items-center justify-center text-slate-950">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-950 -mt-0.5"></div>
          </div>
        </div>
      `;

      const pickIcon = L.divIcon({
        html: pickIconHtml,
        className: 'target-pin-icon',
        iconSize: [48, 60],
        iconAnchor: [24, 56],
      });

      if (pickingMarkerRef.current) {
        pickingMarkerRef.current.setLatLng([validLat, validLng]);
        pickingMarkerRef.current.setIcon(pickIcon);
      } else {
        const marker = L.marker([validLat, validLng], { icon: pickIcon, zIndexOffset: 3000 });
        marker.addTo(mapInstanceRef.current);
        pickingMarkerRef.current = marker;
      }
    } else {
      if (pickingMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(pickingMarkerRef.current);
        pickingMarkerRef.current = null;
      }
    }
  }, [isPickingLocation, pickingCoordinates, pickingVenueName, mapReady]);

  // Handle Click Listener for Location Picking
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickingLocation) {
        onLocationPicked(e.latlng.lat, e.latlng.lng);
      } else if (isEditingPolygon && onAddPolygonPoint) {
        onAddPolygonPoint(e.latlng.lat, e.latlng.lng);
      }
    };

    mapInstanceRef.current.on('click', handleMapClick);
    return () => {
      mapInstanceRef.current?.off('click', handleMapClick);
    };
  }, [isPickingLocation, onLocationPicked, isEditingPolygon, onAddPolygonPoint]);

  // When userCenterTrigger fires, resume GPS tracking auto-follow
  useEffect(() => {
    if (userCenterTrigger) {
      setIsTrackingPaused(false);
    }
  }, [userCenterTrigger]);

  // Detect manual user drag on map to pause auto-following
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    const handleUserDrag = () => {
      setIsTrackingPaused(true);
    };

    map.on('dragstart', handleUserDrag);
    return () => {
      map.off('dragstart', handleUserDrag);
    };
  }, [mapReady]);

  // Update User GPS Marker & Accuracy Circle (Real-time Geolocation with Heading, Speed & Auto-follow)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    if (userLocation) {
      const lat = typeof userLocation.lat === 'number' ? userLocation.lat : parseFloat(String(userLocation.lat));
      const lng = typeof userLocation.lng === 'number' ? userLocation.lng : parseFloat(String(userLocation.lng));
      if (isNaN(lat) || isNaN(lng)) return;

      const isOutsideAlert = Boolean(isUserOutsideBaseZone && baseZone?.enabled);
      const hasHeading = typeof userLocation.heading === 'number' && !isNaN(userLocation.heading);
      const headingDeg = hasHeading ? (userLocation.heading! + 360) % 360 : 0;
      const accuracy = Math.max(6, Math.min(300, userLocation.accuracy || 20));

      // 1. Update or create the translucent GPS Accuracy Halo (Circle)
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setLatLng([lat, lng]);
        userAccuracyCircleRef.current.setRadius(accuracy);
        userAccuracyCircleRef.current.setStyle({
          color: isOutsideAlert ? '#f59e0b' : '#38bdf8',
          fillColor: isOutsideAlert ? '#f59e0b' : '#0284c7',
        });
      } else {
        const circle = L.circle([lat, lng], {
          radius: accuracy,
          color: isOutsideAlert ? '#f59e0b' : '#38bdf8',
          weight: 1.5,
          opacity: 0.8,
          dashArray: '4, 4',
          fillColor: isOutsideAlert ? '#f59e0b' : '#0284c7',
          fillOpacity: 0.12,
          interactive: false,
        });
        circle.addTo(mapInstanceRef.current);
        userAccuracyCircleRef.current = circle;
      }

      // 2. High-precision GPS Marker with Directional Vision Beam
      let userIconHtml = '';

      if (hasHeading) {
        // Active Directional Heading Mode (Google Maps / Apple Maps style)
        userIconHtml = `
          <div class="relative flex items-center justify-center" style="width: 52px; height: 52px;">
            <!-- Directional Vision Beam / Heading Cone -->
            <div class="gps-heading-cone" style="transform: rotate(${headingDeg}deg);"></div>

            <!-- Expanding Radar Wave -->
            <div class="absolute w-8 h-8 rounded-full ${
              isOutsideAlert ? 'bg-amber-400/30' : 'bg-sky-400/25'
            } animate-gps-radar"></div>

            <!-- Directional Navigation Arrow / Puck -->
            <div class="relative z-10 w-9 h-9 rounded-full ${
              isOutsideAlert ? 'bg-amber-500' : 'bg-sky-500'
            } p-0.5 border-2 border-white shadow-xl shadow-sky-950/70 flex items-center justify-center transition-transform" style="transform: rotate(${headingDeg}deg);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="white" class="drop-shadow-sm">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            
            ${
              isOutsideAlert
                ? `<div class="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-amber-500 border border-slate-950 text-slate-950 text-[7.5px] font-black uppercase whitespace-nowrap shadow animate-pulse">
                    Fuera de Zona
                  </div>`
                : ''
            }
          </div>
        `;
      } else {
        // Omnidirectional / Stationary Mode with Pulsing Radar Halo
        userIconHtml = `
          <div class="relative flex flex-col items-center justify-end" style="width: 48px; height: 56px;">
            <!-- Ground soft shadow -->
            <div class="absolute bottom-1 w-7 h-2 rounded-full bg-slate-950/60 -translate-x-1/2 left-1/2"></div>
            <!-- Radar Pulse Ring -->
            <div class="absolute bottom-0.5 w-8 h-8 rounded-full border-2 ${
              isOutsideAlert
                ? 'border-amber-400/90 bg-amber-400/30'
                : 'border-sky-400/60 bg-sky-400/20'
            } -translate-x-1/2 left-1/2 animate-gps-soft"></div>
            <!-- Standing Person Pin with Head, Body & Legs -->
            <div class="relative z-10 flex flex-col items-center">
              ${
                isOutsideAlert
                  ? `<div class="px-1.5 py-0.5 rounded-md bg-amber-500 border border-slate-950 text-slate-950 text-[8px] font-black uppercase whitespace-nowrap shadow mb-0.5 animate-pulse">
                      Fuera de Zona
                    </div>`
                  : ''
              }
              <div class="w-9 h-9 rounded-full ${
                isOutsideAlert ? 'bg-amber-500' : 'bg-sky-500'
              } p-0.5 border-2 border-white shadow-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" fill="white">
                  <circle cx="12" cy="4" r="2.3"/>
                  <path d="M14.5 8h-5C8.7 8 8 8.7 8 9.5v4a1 1 0 0 0 2 0V11h.5v9a1.5 1.5 0 0 0 3 0v-9h.5v2.5a1 1 0 0 0 2 0v-4c0-.8-.7-1.5-1.5-1.5z"/>
                </svg>
              </div>
              <!-- Pointer pointing directly to the GPS coordinate -->
              <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${
                isOutsideAlert ? 'border-t-amber-500' : 'border-t-sky-500'
              } -mt-0.5"></div>
            </div>
          </div>
        `;
      }

      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'user-gps-icon',
        iconSize: hasHeading ? [52, 52] : [48, 56],
        iconAnchor: hasHeading ? [26, 26] : [24, 52],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
        userMarkerRef.current.setIcon(userIcon);
      } else {
        const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });
        marker.addTo(mapInstanceRef.current);
        userMarkerRef.current = marker;
      }

      // Auto-Follow / Real-Time GPS Tracking Camera (Only if user has not manually dragged away)
      if (isGpsTracking && !isTrackingPaused) {
        mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.6 });
      }
    }
  }, [
    userLocation?.lat,
    userLocation?.lng,
    userLocation?.heading,
    userLocation?.accuracy,
    isUserOutsideBaseZone,
    baseZone?.enabled,
    mapReady,
    isGpsTracking,
    isTrackingPaused,
  ]);

  // Render Base Zone Polygon (Standard view)
  useEffect(() => {
    if (!mapInstanceRef.current || !baseZoneLayerRef.current || !mapReady) return;

    baseZoneLayerRef.current.clearLayers();

    // Do not show the static polygon if we are currently editing the polygon
    if (isEditingPolygon) return;

    if (baseZone && baseZone.enabled && Array.isArray(baseZone.points) && baseZone.points.length >= 3) {
      const validPoints: [number, number][] = baseZone.points.filter(
        (p) => Array.isArray(p) && p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])
      );

      if (validPoints.length >= 3) {
        const polygon = L.polygon(validPoints, {
          color: baseZone.strokeColor || '#f59e0b',
          weight: 2.5,
          opacity: 0.85,
          dashArray: '6, 6',
          fillColor: baseZone.fillColor || '#fbbf24',
          fillOpacity: 0.12,
          interactive: true,
        });

        polygon.bindTooltip(
          `<div class="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded shadow">${
            baseZone.title || 'Zona Urbana Base'
          }</div>`,
          { direction: 'center', permanent: false }
        );

        polygon.bindPopup(`
          <div class="p-2 text-slate-900 font-sans max-w-xs">
            <div class="flex items-center gap-1.5 font-bold text-xs text-amber-700 uppercase mb-1">
              <span>🛡️ ${baseZone.title || 'Zona Base Satipo'}</span>
            </div>
            <p class="text-xs text-slate-600 mb-2 leading-relaxed">
              Perímetro oficial de tarifa urbana estándar en Satipo. Desplazamientos fuera de este límite aplican tarifa de 3 soles u otros acuerdos.
            </p>
            <div class="p-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold">
              ${baseZone.message || 'Has salido de la zona base. El pasaje es de 3 soles'}
            </div>
          </div>
        `);

        polygon.addTo(baseZoneLayerRef.current);
      }
    }
  }, [baseZone, isEditingPolygon, mapReady]);

  // Render Editable Polygon & Draggable Vertex Markers (Drawing / Edit mode)
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonEditLayerRef.current || !mapReady) return;

    polygonEditLayerRef.current.clearLayers();

    if (!isEditingPolygon) return;

    const points = polygonDraftPoints || [];

    // 1. Draw connecting polyline / polygon preview
    if (points.length >= 3) {
      const draftPoly = L.polygon(points, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '5, 5',
        fillColor: '#fbbf24',
        fillOpacity: 0.22,
        interactive: false,
      });
      draftPoly.addTo(polygonEditLayerRef.current);
    } else if (points.length === 2) {
      const draftLine = L.polyline(points, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '5, 5',
        interactive: false,
      });
      draftLine.addTo(polygonEditLayerRef.current);
    }

    // 2. Add draggable markers for each vertex
    points.forEach((pt, idx) => {
      const vertexIconHtml = `
        <div class="relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none" style="width: 32px; height: 32px;">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border-2 border-slate-950 shadow-xl flex items-center justify-center text-slate-950 font-black text-xs hover:scale-110 active:scale-95 transition">
            ${idx + 1}
          </div>
        </div>
      `;

      const vertexIcon = L.divIcon({
        html: vertexIconHtml,
        className: 'polygon-vertex-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([pt[0], pt[1]], {
        icon: vertexIcon,
        draggable: true,
        zIndexOffset: 3500 + idx,
      });

      let wasDragged = false;

      marker.on('dragstart', () => {
        wasDragged = true;
      });

      marker.on('dragend', (e) => {
        setTimeout(() => {
          wasDragged = false;
        }, 350);
        const newLatLng = e.target.getLatLng();
        onUpdatePolygonPoint?.(idx, Number(newLatLng.lat.toFixed(6)), Number(newLatLng.lng.toFixed(6)));
      });

      marker.bindTooltip(`Vértice #${idx + 1} (Arrastra para mover o haz clic para eliminar)`, {
        direction: 'top',
        offset: [0, -16],
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (wasDragged) return;
        onDeletePolygonPoint?.(idx);
      });

      marker.addTo(polygonEditLayerRef.current!);
    });
  }, [isEditingPolygon, polygonDraftPoints, mapReady, onUpdatePolygonPoint, onDeletePolygonPoint]);

  // Update Venue Markers with Radial Overlap Dispersion
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !mapReady) return;

    markersLayerRef.current.clearLayers();
    venueMarkersRef.current = {};

    // Group venues by close/identical coordinates (within ~15m)
    const coordGroups: { [key: string]: Venue[] } = {};
    venues.forEach((v) => {
      const lat = typeof v.lat === 'number' ? v.lat : parseFloat(String(v.lat));
      const lng = typeof v.lng === 'number' ? v.lng : parseFloat(String(v.lng));
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(v);
    });

    venues.forEach((venue) => {
      const rawLat = typeof venue.lat === 'number' ? venue.lat : parseFloat(String(venue.lat));
      const rawLng = typeof venue.lng === 'number' ? venue.lng : parseFloat(String(venue.lng));

      if (isNaN(rawLat) || isNaN(rawLng) || rawLat === 0 || rawLng === 0) return;

      const key = `${rawLat.toFixed(4)},${rawLng.toFixed(4)}`;
      const group = coordGroups[key] || [venue];
      let lat = rawLat;
      let lng = rawLng;

      // If multiple venues share the exact same location, radially offset them so each is individually visible!
      if (group.length > 1) {
        const idx = group.findIndex((v) => v.id === venue.id);
        if (idx >= 0) {
          const angle = (2 * Math.PI * idx) / group.length;
          const offsetDist = 0.00024; // ~26 meters spread in Satipo
          lat = rawLat + Math.sin(angle) * offsetDist;
          lng = rawLng + Math.cos(angle) * offsetDist;
        }
      }

      const catInfo = venueCategories.find((c) => c.id === venue.category);

      const categoryColor =
        venue.category === 'estadio'
          ? 'bg-emerald-600 ring-emerald-300'
          : venue.category === 'coliseo'
          ? 'bg-blue-600 ring-blue-300'
          : venue.category === 'complejo'
          ? 'bg-amber-600 ring-amber-300'
          : venue.category === 'piscina'
          ? 'bg-cyan-600 ring-cyan-300'
          : venue.category === 'plaza'
          ? 'bg-purple-600 ring-purple-300'
          : 'bg-teal-600 ring-teal-300';

      const iconLabel = catInfo?.icon || (
        venue.category === 'estadio'
          ? '⚽'
          : venue.category === 'coliseo'
          ? '🏐'
          : venue.category === 'complejo'
          ? '🏆'
          : venue.category === 'piscina'
          ? '🏊'
          : venue.category === 'plaza'
          ? '🏛️'
          : '📍'
      );

      const isSelected = selectedVenue?.id === venue.id;

      // Clean and compact display name so it fits neatly over the icon pin
      const cleanVenueName = venue.name
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*-\s*Satipo/gi, '')
        .replace(/\s*de\s*Satipo/gi, '')
        .replace(/\s*Satipo/gi, '')
        .trim();

      const markerHtml = `
        <div class="flex flex-col items-center justify-end pointer-events-auto cursor-pointer group transition-transform duration-200 ${isSelected ? 'scale-115 z-50' : 'hover:scale-110'}" style="width: 62px;">
          <!-- Venue Name Tag without black box -->
          <div class="relative flex flex-col items-center max-w-[62px] mb-0.5 pointer-events-none">
            <div class="font-black text-[7px] sm:text-[7.5px] leading-[8px] tracking-tight text-center select-none ${
              isSelected ? 'text-amber-800' : 'text-slate-950'
            }" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 2.5px #fff, 0 1px 2px rgba(0,0,0,0.35); filter: drop-shadow(0 0.5px 1px rgba(255,255,255,0.95));">
              ${cleanVenueName}
            </div>
          </div>

          <!-- Pin Icon with Category Badge -->
          <div class="relative flex flex-col items-center">
            <div class="w-6 h-6 rounded-xl ${categoryColor} ring-1.5 ring-white/90 flex items-center justify-center text-white shadow-md shadow-black/50">
              <span class="text-[11px] leading-none">${iconLabel}</span>
            </div>
            <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 border-r border-b border-slate-700 -mt-0.5 shadow-sm"></div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'venue-marker-custom',
        iconSize: [62, 44],
        iconAnchor: [31, 42],
        popupAnchor: [0, -42],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div class="p-3 font-sans text-slate-100 min-w-[170px] max-w-[210px] space-y-2.5 text-center">
          <h3 class="text-xs font-black text-white leading-snug px-1">
            ${venue.name}
          </h3>
          <button
            id="btn-trace-${venue.id}"
            onclick="window.dispatchEvent(new CustomEvent('trace-venue-route', { detail: '${venue.id}' }))"
            class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            <span>Trazar ruta</span>
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 220, className: 'satipo-custom-popup' });

      marker.on('click', () => {
        onSelectVenue(venue);
      });

      marker.addTo(markersLayerRef.current!);
      venueMarkersRef.current[venue.id] = marker;
    });
  }, [mapReady, venues, venueCategories, onSelectVenue]);

  const lastSelectedVenueIdRef = useRef<string | null>(null);

  // Handle selectedVenue programmatic zoom & popup open (only when a new venue is actually chosen)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    if (!selectedVenue) {
      lastSelectedVenueIdRef.current = null;
      return;
    }

    if (selectedVenue.id !== lastSelectedVenueIdRef.current) {
      lastSelectedVenueIdRef.current = selectedVenue.id;
      const lat = typeof selectedVenue.lat === 'number' ? selectedVenue.lat : parseFloat(String(selectedVenue.lat));
      const lng = typeof selectedVenue.lng === 'number' ? selectedVenue.lng : parseFloat(String(selectedVenue.lng));
      if (isNaN(lat) || isNaN(lng)) return;

      mapInstanceRef.current.panTo([lat, lng], { animate: true });
      const targetMarker = venueMarkersRef.current[selectedVenue.id];
      if (targetMarker) {
        setTimeout(() => {
          try {
            targetMarker.openPopup();
          } catch {}
        }, 300);
      }
    }
  }, [selectedVenue, mapReady]);

  // Global Custom Event Listeners for HTML Popups
  useEffect(() => {
    const handleTraceEvent = (e: any) => {
      const venueId = e.detail;
      const venue = venues.find((v) => v.id === venueId);
      if (venue) {
        mapInstanceRef.current?.closePopup();
        onTraceRoute(venue);
      }
    };

    window.addEventListener('trace-venue-route', handleTraceEvent);

    return () => {
      window.removeEventListener('trace-venue-route', handleTraceEvent);
    };
  }, [venues, onTraceRoute]);

  const lastFittedRouteRef = useRef<any>(null);

  // Draw or clear Active Route in authentic Google Maps Navigation Style
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    if (!activeRoute) {
      lastFittedRouteRef.current = null;
      return;
    }

    if (activeRoute && activeRoute.coordinates.length > 0) {
      try {
        mapInstanceRef.current.closePopup();

        // 1. Google Maps Outer Dark Blue Route Casing
        const routeCasing = L.polyline(activeRoute.coordinates, {
          color: '#185abc',
          weight: 9,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        });

        // 2. Google Maps Navigation Core Blue Line (#4285F4)
        const routeLine = L.polyline(activeRoute.coordinates, {
          color: '#4285F4',
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        });

        // 3. Inner Directional Pulse Highlight Line
        const routeInnerGlow = L.polyline(activeRoute.coordinates, {
          color: '#d2e3fc',
          weight: 2,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '2, 14',
        });

        routeLayerRef.current.addLayer(routeCasing);
        routeLayerRef.current.addLayer(routeLine);
        routeLayerRef.current.addLayer(routeInnerGlow);

        // Fit bounds only when a new route is created, not on tab switches
        if (activeRoute !== lastFittedRouteRef.current) {
          lastFittedRouteRef.current = activeRoute;
          const bounds = L.latLngBounds(activeRoute.coordinates);
          if (bounds.isValid()) {
            const isMobile = window.innerWidth < 640;
            mapInstanceRef.current.fitBounds(bounds, {
              paddingTopLeft: isMobile ? [85, 20] : [60, 40],
              paddingBottomRight: isMobile ? [20, 160] : [40, 110],
              maxZoom: 16,
            });
          }
        }
      } catch (e) {
        console.warn('Leaflet fitBounds safe bypass:', e);
      }
    }
  }, [activeRoute]);

  const initialFitDoneRef = useRef<boolean>(false);

  const handleCenterSatipo = (animate: boolean = true) => {
    if (!mapInstanceRef.current) return;

    const validCoords = venues
      .map((v) => [
        typeof v.lat === 'number' ? v.lat : parseFloat(String(v.lat)),
        typeof v.lng === 'number' ? v.lng : parseFloat(String(v.lng)),
      ] as [number, number])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        const isMobile = window.innerWidth < 640;
        mapInstanceRef.current.fitBounds(bounds, {
          paddingTopLeft: isMobile ? [40, 18] : [50, 30],
          paddingBottomRight: isMobile ? [30, 18] : [40, 30],
          maxZoom: 13.5,
          animate,
        });
        return;
      }
    }

    mapInstanceRef.current.setView([SATIPO_CENTER.lat, SATIPO_CENTER.lng], 13.5, {
      animate,
    });
  };

  // Auto-fit all venues on initial load once map and venues are ready
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !isVisible || initialFitDoneRef.current) return;
    if (venues.length > 0 && !activeRoute && !selectedVenue) {
      const timer = setTimeout(() => {
        if (mapInstanceRef.current && !initialFitDoneRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false, animate: false });
          handleCenterSatipo(false);
          initialFitDoneRef.current = true;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapReady, isVisible, venues.length, activeRoute, selectedVenue]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleFlyToUser = (targetZoom: number = 16) => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      const lat = typeof userLocation.lat === 'number' ? userLocation.lat : parseFloat(String(userLocation.lat));
      const lng = typeof userLocation.lng === 'number' ? userLocation.lng : parseFloat(String(userLocation.lng));
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current.flyTo([lat, lng], targetZoom, {
          duration: 0.9,
        });
        return;
      }
    }
    handleCenterSatipo(true);
  };

  const lastHandledTriggerRef = useRef<number>(userCenterTrigger || 0);

  // Only trigger flyTo when userCenterTrigger was explicitly updated (e.g. user clicked GPS button)
  useEffect(() => {
    if (userCenterTrigger && userCenterTrigger > lastHandledTriggerRef.current) {
      lastHandledTriggerRef.current = userCenterTrigger;
      handleFlyToUser(16);
    }
  }, [userCenterTrigger]);

  const handleFitAllVenues = () => {
    handleCenterSatipo(true);
  };

  return (
    <div className={`relative w-full h-full min-h-[350px] ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-950' : ''} ${isPickingLocation ? 'cursor-crosshair' : ''}`}>
      {/* The Leaflet Map Container with Street Maps background */}
      <div ref={mapContainerRef} className={`w-full h-full z-0 bg-[#f2efe9] ${isPickingLocation ? 'cursor-crosshair' : ''}`} />

      {/* Mode Alert for Location Picker (Admin Mode) */}
      {isPickingLocation && (
        <div className="absolute top-3 left-3 right-3 z-30 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 font-medium border-2 border-amber-300 ring-4 ring-amber-500/30 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-bold flex-shrink-0 animate-bounce">
              <MapPin className="w-4.5 h-4.5 fill-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-xs text-slate-950 uppercase truncate">
                Fijando Ubicación: {pickingVenueName || 'Sede'}
              </h4>
              <p className="text-[11px] text-slate-900 font-semibold leading-tight mt-0.5">
                Haz clic en cualquier punto del mapa en Satipo para colocar la sede exactamente aquí.
              </p>
            </div>
          </div>
          <button
            onClick={onCancelPickLocation}
            className="text-xs bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl shadow cursor-pointer transition flex-shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Mode Bar for Polygon Drawing / Editing (Admin Mode) */}
      {isEditingPolygon && (
        <div className="absolute top-2 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-30 animate-in slide-in-from-top duration-200">
          <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500 rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-black/80 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black flex-shrink-0 shadow">
                  <Shapes className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wide truncate">
                    Modo Dibujo: Perímetro Zona Base
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Haz clic en el mapa para añadir puntos. Arrastra los números para ajustarlos.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold whitespace-nowrap flex-shrink-0">
                {polygonDraftPoints.length} vértices
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onUndoPolygonPoint}
                  disabled={polygonDraftPoints.length === 0}
                  className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Deshacer último vértice"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Deshacer</span>
                </button>

                <button
                  onClick={onClearPolygonPoints}
                  disabled={polygonDraftPoints.length === 0}
                  className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Borrar todos los vértices"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpiar</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={onCancelPolygonDraft}
                  className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={onSavePolygonDraft}
                  disabled={polygonDraftPoints.length < 3}
                  className="h-8 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Polígono</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Alert Banner for GPS Location Outside Base Zone */}
      {!isEditingPolygon && !isPickingLocation && baseZone?.enabled && isUserOutsideBaseZone && (
        <>
          {!isZoneAlertDismissed ? (
            <div className="absolute top-2.5 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-lg z-30 animate-in slide-in-from-top duration-300">
              <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-2xl border-2 border-amber-300 ring-4 ring-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center flex-shrink-0 shadow">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-black tracking-wider text-slate-900 leading-tight">
                      {baseZone.title || 'Alerta de Zona Base Satipo'}
                    </p>
                    <p className="text-xs sm:text-sm font-black leading-tight text-slate-950">
                      {baseZone.message || 'Has salido de la zona base. El pasaje es de 3 soles'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsZoneAlertDismissed(true)}
                  className="p-1 rounded-lg text-slate-900 hover:bg-amber-600/30 active:scale-95 transition flex-shrink-0 cursor-pointer"
                  title="Minimizar aviso"
                  aria-label="Minimizar aviso"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsZoneAlertDismissed(false)}
              className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-full shadow-xl border border-amber-300 flex items-center gap-1.5 active:scale-95 transition cursor-pointer animate-in fade-in"
              title="Toca para expandir el aviso"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Fuera de Zona Base (S/ 3.00)</span>
            </button>
          )}
        </>
      )}

      {/* Floating Controls (Top Left) */}
      <div className={`absolute left-2 sm:left-3 z-20 flex flex-col items-start gap-1 transition-all duration-200 ${isPickingLocation || isEditingPolygon ? 'top-26 sm:top-24' : isUserOutsideBaseZone && baseZone?.enabled && !isZoneAlertDismissed ? 'top-22 sm:top-20' : 'top-1.5'}`}>
        {/* Quick Venue Badge Count */}
        <button
          onClick={handleFitAllVenues}
          title="Toca para ver y encuadrar todas las sedes en el mapa"
          className="inline-flex items-center gap-1.5 bg-slate-900 text-sky-300 hover:text-sky-100 hover:bg-slate-800 text-xs px-2.5 py-1 rounded-xl border border-sky-500/30 shadow-md font-semibold w-fit transition active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{venues.length} Sedes</span>
        </button>

        {/* Ergonomic Mobile Zoom Controls (+ and -) */}
        <div className="flex flex-col bg-slate-900/95 border border-slate-700/80 rounded-xl overflow-hidden shadow-md">
          <button
            id="btn-map-zoom-in"
            onClick={handleZoomIn}
            title="Acercar mapa (+)"
            aria-label="Acercar mapa"
            className="w-9 h-9 sm:w-9.5 sm:h-9.5 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 active:scale-95 transition border-b border-slate-800 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
          <button
            id="btn-map-zoom-out"
            onClick={handleZoomOut}
            title="Alejar mapa (-)"
            aria-label="Alejar mapa"
            className="w-9 h-9 sm:w-9.5 sm:h-9.5 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 active:scale-95 transition cursor-pointer"
          >
            <Minus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Map Layers Dropdown Button (Mapa Base) */}
        <div ref={layerMenuRef} className="relative">
          <button
            id="btn-toggle-layers-dropdown"
            onClick={() => setIsLayerDropdownOpen((prev) => !prev)}
            title="Mapa Base"
            aria-label="Mapa Base"
            className={`w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-xl bg-slate-900/95 border shadow-md flex items-center justify-center active:scale-95 transition cursor-pointer ${
              isLayerDropdownOpen
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/40'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 border-slate-700'
            }`}
          >
            <Layers className="w-4.5 h-4.5" />
          </button>

          {/* Dropdown Menu Popup (Opens to the right of the button) */}
          {isLayerDropdownOpen && (
            <div className="absolute left-11 top-0 w-60 bg-slate-900 border border-slate-700/90 rounded-2xl p-1.5 shadow-2xl z-30 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between border-b border-slate-800 pb-1.5 mb-0.5">
                <span>Mapa Base</span>
                <span className="text-emerald-400 font-bold text-[9px]">Satipo 2026</span>
              </div>
              {MAP_LAYERS.map((layer) => {
                const isActive = mapType === layer.id;
                return (
                  <button
                    key={layer.id}
                    id={`btn-tile-${layer.id}`}
                    onClick={() => {
                      setMapType(layer.id);
                      setIsLayerDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600/25 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                      <span className="text-base flex-shrink-0">{layer.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-none truncate">{layer.name}</p>
                        <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5 truncate">
                          {layer.desc}
                        </p>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Fullscreen Toggle (Pantalla completa) */}
        <button
          id="btn-map-fullscreen"
          onClick={() => setIsFullScreen(!isFullScreen)}
          title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-xl bg-slate-900/95 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 shadow-md flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Action Buttons (Bottom Right of Map, above bottom nav) */}
      <div className={`absolute right-3 z-20 flex flex-col items-end gap-1 transition-all duration-200 ${activeRoute ? 'bottom-28 sm:bottom-15' : 'bottom-15 sm:bottom-15'}`}>
        {/* Center Satipo City / Fit all venues */}
        <button
          id="btn-center-satipo"
          onClick={() => handleCenterSatipo(true)}
          title="Centrar mapa y encuadrar todas las sedes"
          aria-label="Centrar mapa y encuadrar todas las sedes"
          className="w-10 h-10 rounded-xl bg-slate-900/95 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 border border-emerald-500/40 shadow-xl flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          <Compass className="w-5 h-5 text-emerald-400" />
        </button>

        {/* Ubicación Actual (Activa el GPS del celular y reanuda seguimiento) */}
        <button
          id="btn-center-user"
          onClick={() => {
            setIsTrackingPaused(false);
            if (onToggleGpsTracking) onToggleGpsTracking(true);
            handleFlyToUser(16);
            onCenterUser();
          }}
          title="Ubicación actual y seguimiento GPS continuo"
          aria-label="Ubicación actual y seguimiento GPS continuo"
          className="h-10 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white border border-sky-400/50 shadow-2xl flex items-center gap-2 transition cursor-pointer font-bold select-none group"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-sky-200 flex-shrink-0" />
          ) : (
            <Navigation className="w-4 h-4 fill-white/20 transition-transform group-hover:scale-110 flex-shrink-0" />
          )}
          <span className="text-xs font-bold tracking-tight whitespace-nowrap">
            {isLocating ? 'Activando GPS...' : 'Ubicación actual'}
          </span>
          {userLocation && !userLocation.isSimulated && !isLocating && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-300/60 animate-pulse flex-shrink-0"
              title="GPS Activo en vivo"
            />
          )}
        </button>
      </div>

      {/* Floating Resume Tracking Pill (When user has moved the map manually) */}
      {isTrackingPaused && userLocation && !isPickingLocation && !isEditingPolygon && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-200 animate-in slide-in-from-bottom duration-200 ${activeRoute ? 'bottom-28 sm:bottom-18' : 'bottom-16 sm:bottom-18'}`}>
          <button
            id="btn-resume-gps-tracking"
            onClick={() => {
              setIsTrackingPaused(false);
              if (onToggleGpsTracking) onToggleGpsTracking(true);
              handleFlyToUser(16);
            }}
            className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-extrabold text-xs flex items-center gap-2 shadow-2xl border border-sky-300 ring-4 ring-sky-500/30 transition cursor-pointer"
            title="Volver a centrar y seguir tu movimiento automáticamente"
          >
            <LocateFixed className="w-4 h-4 animate-pulse flex-shrink-0" />
            <span>Reanudar seguimiento GPS</span>
          </button>
        </div>
      )}

      {/* Route Navigation Card - En una sola fila sin Waze ni Pasos */}
      {activeRoute && (
        <div className="absolute bottom-15 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-md md:max-w-lg z-30 animate-in slide-in-from-bottom duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-2 sm:px-3 sm:py-2 shadow-2xl shadow-black/80 flex items-center justify-between gap-2 text-slate-100">
            {/* Sede de Destino */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-bold text-emerald-400 flex-shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black truncate text-white leading-tight">
                  {activeRoute.destinationVenue.name}
                </h4>
              </div>
            </div>

            {/* Acciones en la misma fila: Google Maps, Apple Maps y Cerrar Ruta */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                id="btn-open-google-maps"
                onClick={() =>
                  openExternalGoogleMaps(
                    activeRoute.destinationVenue.lat,
                    activeRoute.destinationVenue.lng,
                    activeRoute.destinationVenue.name
                  )
                }
                className="h-7 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-[11px] flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap"
                title="Abrir navegación en Google Maps"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span>Google Maps</span>
              </button>

              <button
                id="btn-open-apple-maps"
                onClick={() =>
                  openExternalAppleMaps(
                    activeRoute.destinationVenue.lat,
                    activeRoute.destinationVenue.lng,
                    activeRoute.destinationVenue.name
                  )
                }
                className="h-7 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white border border-slate-700 font-semibold text-[11px] flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap"
                title="Abrir navegación en Apple Maps"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span>Apple Maps</span>
              </button>

              <button
                id="btn-close-route"
                onClick={onClearRoute}
                className="w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-red-900/80 active:scale-95 text-slate-400 hover:text-red-200 border border-slate-700/80 flex items-center justify-center transition cursor-pointer flex-shrink-0"
                title="Cerrar y cancelar ruta"
                aria-label="Cerrar ruta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Route Instructions Overlay */}
    </div>
  );
};

export const InteractiveMap = React.memo(InteractiveMapComponent);

