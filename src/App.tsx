import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Venue, ScheduleEvent, UserLocation, RouteData, VenueCategory, GuideInfo, BaseZoneConfig, isPointInPolygon } from './types';
import { DEFAULT_VENUES, DEFAULT_SCHEDULE, DEFAULT_VENUE_CATEGORIES, DEFAULT_GUIDE_INFO, DEFAULT_BASE_ZONE, SATIPO_CENTER } from './data/defaultData';
import { calculateRoute, calculateBearing, calculateDistance } from './utils/geo';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { InteractiveMap } from './components/InteractiveMap';
import { VenueList } from './components/VenueList';
import { MapImageView } from './components/MapImageView';
import { AdminPanel, VenueDraftState } from './components/AdminPanel';
import { AdminAuthModal } from './components/AdminAuthModal';
import { QRShareModal } from './components/QRShareModal';
import { InfoModal } from './components/InfoModal';
import { GPSActivationModal } from './components/GPSActivationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShieldCheck, LogOut, SlidersHorizontal, Eye, CloudCheck, RefreshCw, Smartphone, Laptop, AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  initializeLiveMultiDeviceSync,
  pushUnifiedDataToServer,
  subscribeSyncStatus,
  SyncStatus,
  getDeviceType,
} from './utils/syncManager';

const DELETED_VENUE_IDS = new Set([
  'venue-estadio-satipo',
  'venue-coliseo-satipo',
  'venue-complejo-cedros',
  'venue-plaza-principal',
  'venue-campo-ferial',
]);

const DELETED_VENUE_NAMES = new Set([
  'plaza principal y centro cívico de satipo',
  'plaza principal y centro civico de satipo',
  'piscina municipal y centro recreacional satipo',
  'complejo deportivo los cedros - satipo',
  'coliseo municipal de satipo',
  'estadio municipal de satipo (mariscal ramón castilla)',
  'estadio municipal de satipo (mariscal ramon castilla)',
]);

const VENUE_ID_REPLACEMENTS: Record<string, string> = {
  'venue-plaza-principal': 'venue-parque-infantil',
  'venue-estadio-satipo': 'venue-estadio-la-florida',
  'venue-coliseo-satipo': 'venue-coliseo-shirampari',
  'venue-complejo-cedros': 'venue-grass-mundialito',
  'venue-campo-ferial': 'venue-complejo-jose-olaya',
};

// Realistic street trajectory through Satipo for testing GPS live navigation
const SIMULATED_SATIPO_TRACK: [number, number][] = [
  [-11.248527, -74.636467], // Parque Infantil / Plaza
  [-11.247670, -74.636942], // Jr. Manuel Prado & Losa
  [-11.246200, -74.637200], // Jr. Manuel Prado norte
  [-11.244800, -74.637450], // Cruce Jr. Colono Fundador
  [-11.243500, -74.637600], // Av. Agricultura
  [-11.242100, -74.637700], // Hacia Las Lomas
  [-11.240800, -74.637750], // Acceso Estadio La Florida
  [-11.239826, -74.637780], // Frente Estadio La Florida
  [-11.239675, -74.638210], // Hatun Yauyos
  [-11.241000, -74.639000], // Retorno por Jr. Francisco Irazola
  [-11.243000, -74.638500], // Jr. Irazola centro
  [-11.245000, -74.638000], // Cruce céntrico
  [-11.247000, -74.637200], // Retorno hacia Plaza
  [-11.248527, -74.636467], // Llegada Plaza
];

function remapEventVenues(list: ScheduleEvent[]): ScheduleEvent[] {
  return list.map((evt) => {
    if (evt && evt.venueId && VENUE_ID_REPLACEMENTS[evt.venueId]) {
      return { ...evt, venueId: VENUE_ID_REPLACEMENTS[evt.venueId] };
    }
    return evt;
  });
}

function filterOutDeletedVenues(list: Venue[]): Venue[] {
  return list
    .filter((v) => {
      if (!v || !v.id) return false;
      if (DELETED_VENUE_IDS.has(v.id)) return false;
      const nameNorm = (v.name || '').trim().toLowerCase();
      if (DELETED_VENUE_NAMES.has(nameNorm)) return false;
      return true;
    })
    .map((v) => {
      const nameLower = (v.name || '').toLowerCase().trim();
      if (v.id === 'venue-losa-parque-infantil' || nameLower.includes('losa parque infantil')) {
        return {
          ...v,
          lat: -11.247670,
          lng: -74.636942,
        };
      }
      if (v.id === 'venue-parque-infantil' || nameLower === 'parque infantil' || nameLower.includes('parque infantil') && !nameLower.includes('losa')) {
        return {
          ...v,
          lat: -11.248527,
          lng: -74.636467,
        };
      }
      if (v.id === 'venue-grass-las-lomas' || nameLower.includes('las lomas')) {
        return {
          ...v,
          lat: -11.239826,
          lng: -74.637780,
        };
      }
      if (v.id === 'venue-campo-hatun-yauyos' || nameLower.includes('hatun yauyos')) {
        return {
          ...v,
          lat: -11.239675,
          lng: -74.638210,
        };
      }
      return v;
    });
}

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // 1. Persistent State for Venues, Schedule, Categories, and Info Guide
  const [venues, setVenues] = useState<Venue[]>(() => {
    try {
      const saved = localStorage.getItem('satipo2026_venues');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid: Venue[] = parsed
            .map((v: any) => ({
              ...v,
              lat: typeof v.lat === 'number' ? v.lat : parseFloat(v.lat),
              lng: typeof v.lng === 'number' ? v.lng : parseFloat(v.lng),
            }))
            .filter((v: any) => v && v.id && v.name && !isNaN(v.lat) && !isNaN(v.lng) && v.lat !== 0 && v.lng !== 0);

          // Clean out deleted venues
          const sanitized = filterOutDeletedVenues(valid);

          // Merge any default venues that are not yet in the local cache
          const existingIds = new Set(sanitized.map((v) => v.id));
          const existingNames = new Set(sanitized.map((v) => v.name.trim().toLowerCase()));
          const missing = DEFAULT_VENUES.filter(
            (def) => !existingIds.has(def.id) && !existingNames.has(def.name.trim().toLowerCase())
          );
          const combined = [...sanitized, ...missing];
          if (combined.length > 0) {
            try { localStorage.setItem('satipo2026_venues', JSON.stringify(combined)); } catch {}
            return combined;
          }
        }
      }
      return DEFAULT_VENUES;
    } catch {
      return DEFAULT_VENUES;
    }
  });

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    try {
      const saved = localStorage.getItem('satipo2026_schedule');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const remapped = remapEventVenues(parsed);
          try { localStorage.setItem('satipo2026_schedule', JSON.stringify(remapped)); } catch {}
          return remapped;
        }
      }
      return DEFAULT_SCHEDULE;
    } catch {
      return DEFAULT_SCHEDULE;
    }
  });

  const [venueCategories, setVenueCategories] = useState<VenueCategory[]>(() => {
    try {
      const saved = localStorage.getItem('satipo2026_venue_categories');
      return saved ? JSON.parse(saved) : DEFAULT_VENUE_CATEGORIES;
    } catch {
      return DEFAULT_VENUE_CATEGORIES;
    }
  });

  const [guideInfo, setGuideInfo] = useState<GuideInfo>(() => {
    try {
      const saved = localStorage.getItem('satipo2026_guide_info');
      return saved ? JSON.parse(saved) : DEFAULT_GUIDE_INFO;
    } catch {
      return DEFAULT_GUIDE_INFO;
    }
  });

  // Real-time synchronization across Mobile & PC
  useEffect(() => {
    const unsubStatus = subscribeSyncStatus(setSyncStatus);
    const unsubSync = initializeLiveMultiDeviceSync((remote) => {
      if (remote.venues && Array.isArray(remote.venues) && remote.venues.length > 0) {
        const cleaned = filterOutDeletedVenues(remote.venues);
        setVenues(cleaned);
        try { localStorage.setItem('satipo2026_venues', JSON.stringify(cleaned)); } catch {}
      }
      if (remote.events && Array.isArray(remote.events)) {
        const remapped = remapEventVenues(remote.events);
        setEvents(remapped);
        try { localStorage.setItem('satipo2026_schedule', JSON.stringify(remapped)); } catch {}
      }
      if (remote.venueCategories && Array.isArray(remote.venueCategories)) {
        setVenueCategories(remote.venueCategories);
        try { localStorage.setItem('satipo2026_venue_categories', JSON.stringify(remote.venueCategories)); } catch {}
      }
      if (remote.guideInfo) {
        setGuideInfo(remote.guideInfo);
        try { localStorage.setItem('satipo2026_guide_info', JSON.stringify(remote.guideInfo)); } catch {}
      }
      if (remote.baseZone && typeof remote.baseZone === 'object') {
        setBaseZone(remote.baseZone);
        try { localStorage.setItem('satipo2026_base_zone', JSON.stringify(remote.baseZone)); } catch {}
      }
    });

    return () => {
      unsubStatus();
      unsubSync();
    };
  }, []);

  // Base Zone (Geofence & Fare Alert System)
  const [baseZone, setBaseZone] = useState<BaseZoneConfig>(() => {
    try {
      const saved = localStorage.getItem('satipo2026_base_zone');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed?.points) &&
          parsed.points.length === DEFAULT_BASE_ZONE.points.length &&
          parsed.points[10]?.[0] === DEFAULT_BASE_ZONE.points[10][0] &&
          parsed.points[10]?.[1] === DEFAULT_BASE_ZONE.points[10][1]
        ) {
          return parsed;
        }
      }
      return DEFAULT_BASE_ZONE;
    } catch {
      return DEFAULT_BASE_ZONE;
    }
  });

  const handleUpdateBaseZone = useCallback((newBaseZone: BaseZoneConfig) => {
    setBaseZone(newBaseZone);
    try {
      localStorage.setItem('satipo2026_base_zone', JSON.stringify(newBaseZone));
    } catch (e) {
      console.error('Error saving base zone to localStorage', e);
    }
    pushUnifiedDataToServer({ baseZone: newBaseZone });
  }, []);

  // Sync to localStorage and Push to Server (Unifying Mobile & PC)
  const handleUpdateVenues = useCallback((newVenues: Venue[]) => {
    setVenues(newVenues);
    try {
      localStorage.setItem('satipo2026_venues', JSON.stringify(newVenues));
    } catch (e) {
      console.error('Error saving venues to localStorage', e);
    }
    pushUnifiedDataToServer({ venues: newVenues });
  }, []);

  const handleUpdateEvents = useCallback((newEvents: ScheduleEvent[]) => {
    setEvents(newEvents);
    try {
      localStorage.setItem('satipo2026_schedule', JSON.stringify(newEvents));
    } catch (e) {
      console.error('Error saving schedule to localStorage', e);
    }
    pushUnifiedDataToServer({ events: newEvents });
  }, []);

  const handleUpdateVenueCategories = useCallback((newCategories: VenueCategory[]) => {
    setVenueCategories(newCategories);
    try {
      localStorage.setItem('satipo2026_venue_categories', JSON.stringify(newCategories));
    } catch (e) {
      console.error('Error saving venue categories to localStorage', e);
    }
    pushUnifiedDataToServer({ venueCategories: newCategories });
  }, []);

  const handleUpdateGuideInfo = useCallback((newGuide: GuideInfo) => {
    setGuideInfo(newGuide);
    try {
      localStorage.setItem('satipo2026_guide_info', JSON.stringify(newGuide));
    } catch (e) {
      console.error('Error saving guide info to localStorage', e);
    }
    pushUnifiedDataToServer({ guideInfo: newGuide });
  }, []);

  // 2. Role & Admin Mode State
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      // Check URL query param first (e.g. ?admin=true or ?admin=1)
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true' || params.get('admin') === '1' || params.get('mode') === 'admin') {
        localStorage.setItem('satipo2026_admin_auth', 'true');
        return true;
      }
      return localStorage.getItem('satipo2026_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);

  const handleLoginAdminSuccess = () => {
    setIsAdminMode(true);
    setShowAdminAuthModal(false);
  };

  const handleLogoutAdmin = () => {
    setIsAdminMode(false);
    try {
      localStorage.removeItem('satipo2026_admin_auth');
    } catch (e) {
      console.error(e);
    }
    if (activeTab === 'admin') {
      setActiveTab('mapa');
    }
  };

  // 3. Navigation & View State
  const [activeTab, setActiveTab] = useState<TabType>('mapa');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // 4. User Geolocation GPS
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);
  const [gpsStatus, setGpsStatus] = useState<
    'granted' | 'prompt' | 'denied' | 'requesting' | 'unavailable'
  >('prompt');

  // Real-Time GPS Tracking & Simulation state
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(true);
  const [isSimulatingGps, setIsSimulatingGps] = useState<boolean>(false);
  const isSimulatingRef = useRef<boolean>(false);
  useEffect(() => {
    isSimulatingRef.current = isSimulatingGps;
  }, [isSimulatingGps]);

  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const deviceHeadingRef = useRef<number | null>(null);
  useEffect(() => {
    deviceHeadingRef.current = deviceHeading;
  }, [deviceHeading]);

  const simWaypointIndexRef = useRef<number>(0);
  const simIntervalRef = useRef<any>(null);

  // 5. Route Navigation
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);

  // 6. Modals & Coordinate Picker
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'venues' | 'categories' | 'guide' | 'mapajpg' | 'json' | 'sync' | 'basezone'>('venues');
  const [adminEditingVenueId, setAdminEditingVenueId] = useState<string | null>(null);
  const [venueDraftState, setVenueDraftState] = useState<VenueDraftState | null>(null);
  const [pickingVenueName, setPickingVenueName] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showGpsModal, setShowGpsModal] = useState<boolean>(false);
  const [userCenterTrigger, setUserCenterTrigger] = useState<number>(0);
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);

  // Polygon Drawing / Editing Mode State (Interactive on Map)
  const [isEditingPolygon, setIsEditingPolygon] = useState<boolean>(false);
  const [polygonDraftPoints, setPolygonDraftPoints] = useState<[number, number][]>([]);

  // Geofence Checking: Is User Outside Base Zone?
  const isUserOutsideBaseZone = useMemo(() => {
    if (!baseZone || !baseZone.enabled || !Array.isArray(baseZone.points) || baseZone.points.length < 3) {
      return false;
    }
    if (!userLocation) return false;
    const lat = typeof userLocation.lat === 'number' ? userLocation.lat : parseFloat(String(userLocation.lat));
    const lng = typeof userLocation.lng === 'number' ? userLocation.lng : parseFloat(String(userLocation.lng));
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return false;

    const inside = isPointInPolygon([lat, lng], baseZone.points);
    return !inside;
  }, [baseZone, userLocation]);

  const handleOpenAdminPanel = useCallback((tab: 'venues' | 'categories' | 'guide' | 'mapajpg' | 'json' | 'sync' | 'basezone' = 'venues') => {
    setAdminInitialTab(tab);
    setAdminEditingVenueId(null);
    setShowAdminModal(true);
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    if (tab === 'admin') {
      handleOpenAdminPanel();
    } else {
      setActiveTab(tab);
    }
  }, [handleOpenAdminPanel]);

  const handleOpenEditVenue = useCallback((venue: Venue) => {
    setAdminInitialTab('venues');
    setAdminEditingVenueId(venue.id);
    setVenueDraftState(null);
    setShowAdminModal(true);
  }, []);

  const handleOpenEditGuide = useCallback(() => {
    setAdminInitialTab('guide');
    setAdminEditingVenueId(null);
    setShowAdminModal(true);
  }, []);

  const handleCloseAdminModal = () => {
    setShowAdminModal(false);
    setAdminEditingVenueId(null);
  };

  // GPS notification toast and active tracking ref
  const [gpsToast, setGpsToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const showGpsToast = useCallback((message: string, type: 'info' | 'success' | 'warning') => {
    setGpsToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setGpsToast(null);
    }, 4500);
  }, []);

  // Alert notification trigger when user exits the base zone
  const hasAlertedOutsideZoneRef = useRef<boolean>(false);

  useEffect(() => {
    if (isUserOutsideBaseZone && baseZone?.enabled) {
      if (!hasAlertedOutsideZoneRef.current) {
        hasAlertedOutsideZoneRef.current = true;
        showGpsToast(baseZone.message || 'Has salido de la zona base. El pasaje es de 3 soles', 'warning');
      }
    } else if (!isUserOutsideBaseZone) {
      hasAlertedOutsideZoneRef.current = false;
    }
  }, [isUserOutsideBaseZone, baseZone, showGpsToast]);

  // Polygon Drawing and Vertex Handlers
  const handleStartEditPolygonOnMap = (currentPoints: [number, number][]) => {
    setPolygonDraftPoints(
      currentPoints && currentPoints.length > 0 ? [...currentPoints] : [...DEFAULT_BASE_ZONE.points]
    );
    setIsEditingPolygon(true);
    setShowAdminModal(false);
    setActiveTab('mapa');
    showGpsToast('✏️ Modo Dibujo: Haz clic en el mapa para añadir vértices a la Zona Base.', 'info');
  };

  const handleAddPolygonPoint = (lat: number, lng: number) => {
    setPolygonDraftPoints((prev) => [...prev, [Number(lat.toFixed(6)), Number(lng.toFixed(6))]]);
  };

  const handleUpdatePolygonPoint = (index: number, lat: number, lng: number) => {
    setPolygonDraftPoints((prev) => {
      const updated = [...prev];
      updated[index] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
      return updated;
    });
  };

  const handleDeletePolygonPoint = (index: number) => {
    setPolygonDraftPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUndoPolygonPoint = () => {
    setPolygonDraftPoints((prev) => prev.slice(0, -1));
  };

  const handleClearPolygonPoints = () => {
    setPolygonDraftPoints([]);
  };

  const handleSavePolygonDraft = () => {
    const updatedZone: BaseZoneConfig = {
      ...baseZone,
      points: polygonDraftPoints,
    };
    handleUpdateBaseZone(updatedZone);
    setIsEditingPolygon(false);
    setAdminInitialTab('basezone');
    setShowAdminModal(true);
    showGpsToast(`¡Perímetro de Zona Base guardado exitosamente con ${polygonDraftPoints.length} vértices!`, 'success');
  };

  const handleCancelPolygonDraft = () => {
    setIsEditingPolygon(false);
    setAdminInitialTab('basezone');
    setShowAdminModal(true);
  };

  // Toggle Simulated GPS movement for testing
  const toggleSimulateGps = useCallback(() => {
    setIsSimulatingGps((prev) => {
      const next = !prev;
      if (next) {
        setIsGpsTracking(true);
        showGpsToast('🚗 Simulación de seguimiento GPS en Satipo: ACTIVA', 'info');
      } else {
        showGpsToast('⏹️ Simulación de GPS detenida', 'info');
      }
      return next;
    });
  }, [showGpsToast]);

  // Real-time Device Orientation (Compass Gyroscope for Mobile Heading)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let compassHeading: number | null = null;
      if ((e as any).webkitCompassHeading !== undefined) {
        compassHeading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        compassHeading = (360 - e.alpha) % 360;
      }
      if (compassHeading !== null && !isNaN(compassHeading)) {
        const rounded = Math.round(compassHeading);
        setDeviceHeading(rounded);
      }
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // GPS Simulation Runner (Smooth real-time movement through Satipo)
  useEffect(() => {
    if (isSimulatingGps) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      simIntervalRef.current = setInterval(() => {
        simWaypointIndexRef.current = (simWaypointIndexRef.current + 1) % SIMULATED_SATIPO_TRACK.length;
        const currentCoord = SIMULATED_SATIPO_TRACK[simWaypointIndexRef.current];
        const nextIndex = (simWaypointIndexRef.current + 1) % SIMULATED_SATIPO_TRACK.length;
        const nextCoord = SIMULATED_SATIPO_TRACK[nextIndex];
        const bearing = calculateBearing(currentCoord[0], currentCoord[1], nextCoord[0], nextCoord[1]);

        setUserLocation({
          lat: currentCoord[0],
          lng: currentCoord[1],
          accuracy: 5,
          heading: Math.round(bearing),
          speed: 4.8, // ~17.3 km/h urban speed
          timestamp: Date.now(),
          isSimulated: true,
        });
      }, 1400);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    }
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulatingGps]);

  // Request GPS Location and activate the mobile phone's GPS hardware
  const requestGPSLocation = useCallback((shouldFly: boolean = false, showModalOnFail: boolean = false) => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      showGpsToast('Tu dispositivo o navegador no cuenta con soporte GPS.', 'warning');
      setUserLocation((prev) => prev || {
        lat: SATIPO_CENTER.lat - 0.0015,
        lng: SATIPO_CENTER.lng - 0.001,
        accuracy: 30,
        heading: null,
        speed: 0,
        isSimulated: true,
      });
      if (showModalOnFail) setShowGpsModal(true);
      return;
    }

    setGpsStatus('requesting');
    if (shouldFly) {
      showGpsToast('📡 Conectando con los satélites GPS...', 'info');
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isSimulatingRef.current) return;
        setGpsStatus('granted');
        setIsGpsTracking(true);
        const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : deviceHeadingRef.current;
        const newLocation: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          isSimulated: false,
        };
        setUserLocation(newLocation);

        if (shouldFly) {
          setUserCenterTrigger(Date.now());
          showGpsToast(
            `📍 GPS en tiempo real conectado (Precisión: ±${Math.round(pos.coords.accuracy)}m)`,
            'success'
          );
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.code, err.message);
        if (err.code === 1) {
          // Permiso denegado
          setGpsStatus('denied');
          if (shouldFly || showModalOnFail) {
            showGpsToast('⚠️ Permiso de GPS denegado en el navegador.', 'warning');
            setShowGpsModal(true);
          }
        } else if (err.code === 2) {
          // Posición no disponible / GPS apagado en el celular
          setGpsStatus('unavailable');
          if (shouldFly || showModalOnFail) {
            showGpsToast('⚠️ GPS apagado. Enciende la Ubicación en los ajustes de tu celular.', 'warning');
            setShowGpsModal(true);
          }
        } else {
          // Timeout
          setGpsStatus('prompt');
          if (shouldFly || showModalOnFail) {
            showGpsToast('⚠️ Buscando satélites GPS. Verifica tener cielo despejado.', 'warning');
            setShowGpsModal(true);
          }
        }

        // Mantener ubicación referencial en Satipo si aún no existe
        setUserLocation((prev) => prev || {
          lat: SATIPO_CENTER.lat - 0.0018,
          lng: SATIPO_CENTER.lng - 0.0012,
          accuracy: 50,
          heading: null,
          speed: 0,
          isSimulated: true,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    // Activar seguimiento continuo en tiempo real (Real-Time GPS Tracking)
    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (isSimulatingRef.current) return;
          setGpsStatus('granted');
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          const speed = pos.coords.speed !== null && !isNaN(pos.coords.speed) ? pos.coords.speed : 0;
          const rawHeading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : null;

          setUserLocation((prev) => {
            let heading = rawHeading;
            if (heading === null && prev && speed && speed > 0.5) {
              heading = calculateBearing(prev.lat, prev.lng, lat, lng);
            } else if (heading === null) {
              heading = deviceHeadingRef.current;
            }

            return {
              lat,
              lng,
              accuracy,
              altitude: pos.coords.altitude,
              heading,
              speed,
              timestamp: pos.timestamp,
              isSimulated: false,
            };
          });
        },
        (err) => {
          console.warn('GPS continuous tracking warning:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
      );
    }
  }, [showGpsToast]);

  useEffect(() => {
    requestGPSLocation(false, false);
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [requestGPSLocation]);

  // Trace Route to selected Venue
  const handleTraceRoute = useCallback(async (venue: Venue) => {
    setSelectedVenue(venue);
    setActiveTab('mapa');

    const loc = userLocationRef.current;
    const originLat = loc ? loc.lat : SATIPO_CENTER.lat;
    const originLng = loc ? loc.lng : SATIPO_CENTER.lng;

    setIsRoutingLoading(true);
    try {
      const routeData = await calculateRoute(originLat, originLng, venue);
      setActiveRoute(routeData);
    } catch (err) {
      console.error('Failed to calculate route', err);
    } finally {
      setIsRoutingLoading(false);
    }
  }, []);

  const handleClearRoute = useCallback(() => {
    setActiveRoute(null);
  }, []);

  // Activa el GPS del celular y centra el mapa en la ubicación actual
  const handleCenterUser = useCallback((forceModal: boolean = false) => {
    setActiveTab('mapa');
    setSelectedVenue(null);
    setIsGpsTracking(true);

    const loc = userLocationRef.current;
    // Si ya contamos con ubicación, centrar inmediatamente para respuesta instantánea
    if (loc) {
      setUserCenterTrigger(Date.now());
    }

    if (forceModal) {
      setShowGpsModal(true);
      requestGPSLocation(true, true);
    } else {
      // Activar el chip GPS del celular y solicitar permiso si es necesario
      requestGPSLocation(true, gpsStatus === 'denied' || gpsStatus === 'unavailable');
    }
  }, [requestGPSLocation, gpsStatus]);

  // Fallback to central plaza in Satipo
  const handleUseDefaultSatipoLocation = useCallback(() => {
    setUserLocation({
      lat: SATIPO_CENTER.lat - 0.0015,
      lng: SATIPO_CENTER.lng - 0.001,
      accuracy: 25,
      isSimulated: true,
      timestamp: Date.now(),
    });
    setUserCenterTrigger(Date.now());
  }, []);

  // Coordinate Picking for Admin
  const handleStartPickCoordinateOnMap = (currentDraft: VenueDraftState) => {
    setVenueDraftState(currentDraft);
    setPickingVenueName(currentDraft.name || (currentDraft.editingVenueId ? 'Sede' : 'Nueva Sede'));
    setShowAdminModal(false);
    setIsPickingLocation(true);
    setActiveTab('mapa');
  };

  const handleLocationPicked = (lat: number, lng: number) => {
    if (venueDraftState) {
      setVenueDraftState({
        ...venueDraftState,
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
      });
    } else {
      setVenueDraftState({
        editingVenueId: adminEditingVenueId,
        name: '',
        category: venueCategories[0]?.id || 'estadio',
        address: '',
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        description: '',
        facilities: 'Fútbol, Atletismo',
        capacity: '1,000 personas',
      });
    }
    setIsPickingLocation(false);
    setShowAdminModal(true);
  };

  const handleCancelPickLocation = () => {
    setIsPickingLocation(false);
    setShowAdminModal(true);
  };

  const handleSelectVenueOnMap = useCallback((venue: Venue) => {
    setSelectedVenue(venue);
    setActiveTab('mapa');
    setShowAdminModal(false);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <Navbar
        userLocation={userLocation}
        gpsStatus={gpsStatus}
        onLocateUser={handleCenterUser}
        onOpenQR={() => setShowQRModal(true)}
        onOpenInfo={() => setShowInfoModal(true)}
        activeTab={activeTab}
        isAdminMode={isAdminMode}
        onOpenAdminAuth={() => setShowAdminAuthModal(true)}
        onOpenAdminPanel={() => setShowAdminModal(true)}
      />

      {/* Admin Mode Top Indicator Banner (Only shown if logged in as Organizer) */}
      {isAdminMode && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="font-bold text-[11px] hidden sm:inline">Modo Comisión Organizadora Activo</span>
            <span className="font-bold text-[11px] sm:hidden">Modo Admin</span>
            {/* Sync Badge */}
            <button
              onClick={() => handleOpenAdminPanel('sync')}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-500/40 text-sky-300 text-[10px] font-semibold hover:bg-sky-900 transition"
              title="Sincronización unificada entre Celular y Computadora"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Celular ↔ PC</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 transition"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Editar Sedes / Fixture</span>
              <span className="sm:hidden">Editar</span>
            </button>
            <button
              onClick={handleLogoutAdmin}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700 transition"
              title="Volver a la vista limpia que ven los atletas al escanear el QR"
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Vista Participante</span>
              <span className="sm:hidden">Salir</span>
            </button>
          </div>
        </div>
      )}

      {/* Routing Loading Toast */}
      {isRoutingLoading && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-pulse border border-emerald-400">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span>Calculando ruta terrestre exacta en Satipo...</span>
        </div>
      )}

      {/* GPS Status Toast Notification */}
      {gpsToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] sm:w-auto px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border text-xs font-bold flex items-center justify-between gap-2.5 animate-in slide-in-from-top duration-200 pointer-events-auto bg-slate-900/95 text-white border-sky-500/50 shadow-sky-950">
          <div className="flex items-center gap-2 min-w-0">
            {gpsToast.type === 'info' && <RefreshCw className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />}
            {gpsToast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            {gpsToast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
            <span className="truncate">{gpsToast.message}</span>
          </div>
          <button
            onClick={() => setGpsToast(null)}
            className="w-5 h-5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center flex-shrink-0 cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Views Container (Fluid scroll for lists, full-height for map and plano) */}
      <main className="flex-1 relative min-h-0 flex flex-col overflow-hidden bg-slate-950">
        {/* Tab 1: Interactive Leaflet Map (Default Participant Guide - always sized in DOM to prevent layout shifts) */}
        <div
          className={`absolute inset-0 w-full h-full flex flex-col ${
            activeTab === 'mapa'
              ? 'z-10 pointer-events-auto'
              : 'z-0 pointer-events-none'
          }`}
        >
          <ErrorBoundary>
            <InteractiveMap
              venues={venues}
              events={events}
              venueCategories={venueCategories}
              selectedVenue={selectedVenue}
              onSelectVenue={setSelectedVenue}
              userLocation={userLocation}
              onTraceRoute={handleTraceRoute}
              activeRoute={activeRoute}
              onClearRoute={handleClearRoute}
              isPickingLocation={isPickingLocation}
              pickingVenueName={pickingVenueName}
              pickingCoordinates={
                venueDraftState?.lat && venueDraftState?.lng
                  ? {
                      lat: parseFloat(venueDraftState.lat),
                      lng: parseFloat(venueDraftState.lng),
                    }
                  : null
              }
              isVisible={activeTab === 'mapa'}
              onLocationPicked={handleLocationPicked}
              onCancelPickLocation={handleCancelPickLocation}
              onCenterUser={() => handleCenterUser(false)}
              userCenterTrigger={userCenterTrigger}
              isLocating={gpsStatus === 'requesting'}
              baseZone={baseZone}
              isUserOutsideBaseZone={isUserOutsideBaseZone}
              isEditingPolygon={isEditingPolygon}
              polygonDraftPoints={polygonDraftPoints}
              onAddPolygonPoint={handleAddPolygonPoint}
              onUpdatePolygonPoint={handleUpdatePolygonPoint}
              onDeletePolygonPoint={handleDeletePolygonPoint}
              onUndoPolygonPoint={handleUndoPolygonPoint}
              onClearPolygonPoints={handleClearPolygonPoints}
              onSavePolygonDraft={handleSavePolygonDraft}
              onCancelPolygonDraft={handleCancelPolygonDraft}
              isGpsTracking={isGpsTracking}
              onToggleGpsTracking={setIsGpsTracking}
              isSimulatingGps={isSimulatingGps}
              onToggleSimulateGps={toggleSimulateGps}
            />
          </ErrorBoundary>
        </div>

        {/* Tab 2: Venues Directory (Clean participant directory, admin buttons conditional) */}
        <div className={`absolute inset-0 w-full h-full overflow-y-auto overscroll-y-contain bg-slate-950 z-20 [webkit-overflow-scrolling:touch] ${activeTab === 'sedes' ? 'block' : 'hidden'}`}>
          <ErrorBoundary>
            <VenueList
              venues={venues}
              events={events}
              venueCategories={venueCategories}
              userLocation={userLocation}
              onSelectVenueOnMap={handleSelectVenueOnMap}
              onTraceRoute={handleTraceRoute}
              onOpenAdmin={handleOpenAdminPanel}
              onEditVenue={handleOpenEditVenue}
              isAdminMode={isAdminMode}
            />
          </ErrorBoundary>
        </div>

        {/* Tab 3: Official JPG Map Viewer (Plano Turístico y Deportivo en JPG) */}
        <div className={`absolute inset-0 w-full h-full z-20 ${activeTab === 'plano' ? 'flex flex-col' : 'hidden'}`}>
          <ErrorBoundary>
            <MapImageView
              venues={venues}
              userLocation={userLocation}
              onSelectVenueOnMap={handleSelectVenueOnMap}
              onTraceRoute={handleTraceRoute}
              isAdminMode={isAdminMode}
            />
          </ErrorBoundary>
        </div>

        {/* Tab 4: Info / Guía del Participante */}
        <div className={`absolute inset-0 w-full h-full overflow-y-auto overscroll-contain z-20 ${activeTab === 'guia' ? 'flex flex-col' : 'hidden'}`}>
          <ErrorBoundary>
            <InfoModal
              isEmbedded={true}
              isAdminMode={isAdminMode}
              guideInfo={guideInfo}
              onOpenAdminAuth={() => setShowAdminAuthModal(true)}
              onOpenAdminPanel={handleOpenAdminPanel}
              onOpenEditGuide={handleOpenEditGuide}
              onLogoutAdmin={handleLogoutAdmin}
            />
          </ErrorBoundary>
        </div>

        {/* Tab 5: Admin Panel direct tab (Only mounted when activeTab is admin) */}
        {isAdminMode && activeTab === 'admin' && (
          <div className="absolute inset-0 w-full h-full overflow-y-auto overscroll-contain pb-28 z-20 flex flex-col">
            <ErrorBoundary>
              <div className="max-w-3xl mx-auto p-4">
                <AdminPanel
                  venues={venues}
                  events={events}
                  venueCategories={venueCategories}
                  guideInfo={guideInfo}
                  onUpdateVenues={handleUpdateVenues}
                  onUpdateEvents={handleUpdateEvents}
                  onUpdateVenueCategories={handleUpdateVenueCategories}
                  onUpdateGuideInfo={handleUpdateGuideInfo}
                  onClose={() => {
                    setActiveTab('mapa');
                    setAdminEditingVenueId(null);
                    setVenueDraftState(null);
                  }}
                  onStartPickCoordinateOnMap={handleStartPickCoordinateOnMap}
                  onSelectVenueOnMap={handleSelectVenueOnMap}
                  initialEditingVenueId={adminEditingVenueId}
                  initialTab={adminInitialTab}
                  venueDraft={venueDraftState}
                  onClearDraft={() => setVenueDraftState(null)}
                  baseZone={baseZone}
                  onUpdateBaseZone={handleUpdateBaseZone}
                  onStartEditPolygonOnMap={handleStartEditPolygonOnMap}
                />
              </div>
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Floating Bottom Thumb Navigation Bar (4 clean tabs for participants, 5 tabs for admin) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        hasActiveRoute={!!activeRoute}
        venueCount={venues.length}
        isAdminMode={isAdminMode}
      />

      {/* Admin Panel Modal (When triggered from buttons or nav) */}
      {showAdminModal && (
        <AdminPanel
          venues={venues}
          events={events}
          venueCategories={venueCategories}
          guideInfo={guideInfo}
          onUpdateVenues={handleUpdateVenues}
          onUpdateEvents={handleUpdateEvents}
          onUpdateVenueCategories={handleUpdateVenueCategories}
          onUpdateGuideInfo={handleUpdateGuideInfo}
          onClose={handleCloseAdminModal}
          onStartPickCoordinateOnMap={handleStartPickCoordinateOnMap}
          onSelectVenueOnMap={handleSelectVenueOnMap}
          initialEditingVenueId={adminEditingVenueId}
          initialTab={adminInitialTab}
          venueDraft={venueDraftState}
          onClearDraft={() => setVenueDraftState(null)}
          baseZone={baseZone}
          onUpdateBaseZone={handleUpdateBaseZone}
          onStartEditPolygonOnMap={handleStartEditPolygonOnMap}
        />
      )}

      {/* Admin PIN Login Modal */}
      <AdminAuthModal
        isOpen={showAdminAuthModal}
        onClose={() => setShowAdminAuthModal(false)}
        onSuccess={handleLoginAdminSuccess}
      />

      {/* QR Share Modal (Generates clean URL for participants, full diffusion suite for admin) */}
      {showQRModal && (
        <QRShareModal
          onClose={() => setShowQRModal(false)}
          isAdminMode={isAdminMode}
        />
      )}

      {/* Info Modal (When opened from Header compass button) */}
      {showInfoModal && (
        <InfoModal
          onClose={() => setShowInfoModal(false)}
          isAdminMode={isAdminMode}
          guideInfo={guideInfo}
          onOpenAdminAuth={() => {
            setShowInfoModal(false);
            setShowAdminAuthModal(true);
          }}
          onOpenAdminPanel={handleOpenAdminPanel}
          onOpenEditGuide={() => {
            setShowInfoModal(false);
            handleOpenEditGuide();
          }}
          onLogoutAdmin={handleLogoutAdmin}
        />
      )}

      {/* GPS Activation & Troubleshooting Modal (Phone & PC) */}
      <GPSActivationModal
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        gpsStatus={gpsStatus}
        userLocation={userLocation}
        onRequestGPS={() => requestGPSLocation(true, false)}
        onUseDefaultLocation={handleUseDefaultSatipoLocation}
        onCenterMapToLocation={() => handleCenterUser(false)}
        isGpsTracking={isGpsTracking}
        onToggleGpsTracking={setIsGpsTracking}
        isSimulatingGps={isSimulatingGps}
        onSimulateGpsMovement={toggleSimulateGps}
      />
    </div>
  );
}
