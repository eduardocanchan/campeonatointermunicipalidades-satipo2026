import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  MapPin,
  Calendar,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  FileImage,
  Upload,
  Download,
  Tags,
  PlusCircle,
  BookOpen,
  Phone,
  ListPlus,
  FileText,
  Check,
  Trophy,
  RefreshCw,
  Smartphone,
  Laptop,
  Copy,
  Share2,
  HardDriveDownload,
  HardDriveUpload,
  Radio,
  ExternalLink,
  Shapes,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Venue, ScheduleEvent, VenueCategory, GuideInfo, EmergencyContact, BaseZoneConfig } from '../types';
import { DEFAULT_VENUES, DEFAULT_SCHEDULE, DEFAULT_VENUE_CATEGORIES, DEFAULT_GUIDE_INFO, DEFAULT_BASE_ZONE } from '../data/defaultData';
import { saveCustomMapImage, loadCustomMapImage, removeCustomMapImage, optimizeImageFile } from '../utils/mapStorage';
import {
  pushUnifiedDataToServer,
  fetchUnifiedDataFromServer,
  subscribeSyncStatus,
  SyncStatus,
  getDeviceType,
} from '../utils/syncManager';

export interface VenueDraftState {
  editingVenueId: string | null;
  name: string;
  category: string;
  address: string;
  lat: string;
  lng: string;
  description: string;
  facilities: string;
  capacity: string;
}

interface AdminPanelProps {
  venues: Venue[];
  events: ScheduleEvent[];
  venueCategories: VenueCategory[];
  guideInfo: GuideInfo;
  onUpdateVenues: (venues: Venue[]) => void;
  onUpdateEvents: (events: ScheduleEvent[]) => void;
  onUpdateVenueCategories: (categories: VenueCategory[]) => void;
  onUpdateGuideInfo: (guideInfo: GuideInfo) => void;
  onClose: () => void;
  onStartPickCoordinateOnMap: (currentDraft: VenueDraftState) => void;
  onSelectVenueOnMap?: (venue: Venue) => void;
  initialEditingVenueId?: string | null;
  initialTab?: 'venues' | 'categories' | 'guide' | 'mapajpg' | 'json' | 'sync' | 'basezone';
  venueDraft?: VenueDraftState | null;
  onClearDraft?: () => void;
  baseZone: BaseZoneConfig;
  onUpdateBaseZone: (baseZone: BaseZoneConfig) => void;
  onStartEditPolygonOnMap?: (points: [number, number][]) => void;
}

const AdminPanelComponent: React.FC<AdminPanelProps> = ({
  venues,
  events,
  venueCategories,
  guideInfo,
  onUpdateVenues,
  onUpdateEvents,
  onUpdateVenueCategories,
  onUpdateGuideInfo,
  onClose,
  onStartPickCoordinateOnMap,
  onSelectVenueOnMap,
  initialEditingVenueId,
  initialTab = 'venues',
  venueDraft,
  onClearDraft,
  baseZone,
  onUpdateBaseZone,
  onStartEditPolygonOnMap,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'venues' | 'categories' | 'guide' | 'mapajpg' | 'json' | 'sync' | 'basezone'>(initialTab);

  // Base Zone Draft State
  const [baseZoneDraft, setBaseZoneDraft] = useState<BaseZoneConfig>(() => ({
    enabled: baseZone?.enabled ?? true,
    title: baseZone?.title || 'Zona Urbana Base - Satipo',
    message: baseZone?.message || 'Has salido de la zona base. El pasaje es de 3 soles',
    points: baseZone?.points && baseZone.points.length > 0 ? [...baseZone.points] : [...DEFAULT_BASE_ZONE.points],
    strokeColor: baseZone?.strokeColor || '#f59e0b',
    fillColor: baseZone?.fillColor || '#fbbf24',
  }));
  const [isSavingBaseZone, setIsSavingBaseZone] = useState<boolean>(false);
  const [zoneSaveMessage, setZoneSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (baseZone) {
      setBaseZoneDraft({
        enabled: baseZone.enabled ?? true,
        title: baseZone.title || 'Zona Urbana Base - Satipo',
        message: baseZone.message || 'Has salido de la zona base. El pasaje es de 3 soles',
        points: baseZone.points && baseZone.points.length > 0 ? [...baseZone.points] : [...DEFAULT_BASE_ZONE.points],
        strokeColor: baseZone.strokeColor || '#f59e0b',
        fillColor: baseZone.fillColor || '#fbbf24',
      });
    }
  }, [baseZone]);

  // Synchronization & Multi-device state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [adminQrCodeUrl, setAdminQrCodeUrl] = useState<string>('');
  const [copiedAdminLink, setCopiedAdminLink] = useState<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Custom JPG Map Admin State
  const [adminCustomMap, setAdminCustomMap] = useState<string | null>(() => {
    try {
      return localStorage.getItem('satipo2026_custom_jpg_map') || null;
    } catch {
      return null;
    }
  });
  const [isMapSaving, setIsMapSaving] = useState<boolean>(false);
  const [mapSaveError, setMapSaveError] = useState<string | null>(null);
  const [customMapUrlInput, setCustomMapUrlInput] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeSyncStatus(setSyncStatus);
    try {
      const adminUrl = window.location.origin + window.location.pathname + '?admin=true';
      QRCode.toDataURL(adminUrl, {
        width: 450,
        margin: 2,
        color: { dark: '#022c22', light: '#ffffff' },
      })
        .then(setAdminQrCodeUrl)
        .catch(() => {});
    } catch {}

    loadCustomMapImage().then((stored) => {
      if (stored) {
        setAdminCustomMap(stored);
      }
    });

    const handleCustomMapSync = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setAdminCustomMap(customEvent.detail);
    };
    window.addEventListener('satipo_custom_map_updated', handleCustomMapSync);

    return () => {
      unsub();
      window.removeEventListener('satipo_custom_map_updated', handleCustomMapSync);
    };
  }, []);

  // Multi-device sync actions
  const handleForceSyncFromServer = async () => {
    setIsSyncingNow(true);
    setSyncMessage(null);
    try {
      const remote = await fetchUnifiedDataFromServer();
      if (remote) {
        if (Array.isArray(remote.venues) && remote.venues.length > 0) {
          onUpdateVenues(remote.venues);
        }
        if (Array.isArray(remote.events)) {
          onUpdateEvents(remote.events);
        }
        if (Array.isArray(remote.venueCategories)) {
          onUpdateVenueCategories(remote.venueCategories);
        }
        if (remote.guideInfo) {
          onUpdateGuideInfo(remote.guideInfo);
          setGuideForm(remote.guideInfo);
        }
        if (remote.customMap) {
          setAdminCustomMap(remote.customMap);
          saveCustomMapImage(remote.customMap);
        }
        setSyncMessage({ type: 'success', text: '¡Datos recibidos y sincronizados desde el servidor central!' });
      } else {
        setSyncMessage({ type: 'error', text: 'No se pudo contactar con el servidor central.' });
      }
    } catch (e: any) {
      setSyncMessage({ type: 'error', text: 'Error al sincronizar: ' + (e?.message || 'Fallo de red') });
    } finally {
      setIsSyncingNow(false);
      setTimeout(() => setSyncMessage(null), 4500);
    }
  };

  const handlePushAllToServer = async () => {
    setIsSyncingNow(true);
    setSyncMessage(null);
    try {
      const ok = await pushUnifiedDataToServer({
        venues,
        events,
        venueCategories,
        guideInfo,
        customMap: adminCustomMap,
        baseZone: baseZoneDraft,
      });
      if (ok) {
        setSyncMessage({ type: 'success', text: '¡Datos de este dispositivo enviados y unificados a todos los celulares y PCs!' });
      } else {
        setSyncMessage({ type: 'error', text: 'No se pudo replicar al servidor.' });
      }
    } catch (e: any) {
      setSyncMessage({ type: 'error', text: 'Error: ' + (e?.message || 'Fallo de red') });
    } finally {
      setIsSyncingNow(false);
      setTimeout(() => setSyncMessage(null), 4500);
    }
  };

  const handleCopyAdminUrl = () => {
    const adminUrl = window.location.origin + window.location.pathname + '?admin=true';
    navigator.clipboard.writeText(adminUrl);
    setCopiedAdminLink(true);
    setTimeout(() => setCopiedAdminLink(false), 2500);
  };

  const handleExportFullBackup = () => {
    const backupData = {
      sistema: 'Campeonato Intermunicipalidades Satipo 2026',
      fechaExportacion: new Date().toISOString(),
      dispositivoOrigen: getDeviceType(),
      venues,
      events,
      venueCategories,
      guideInfo,
      baseZone: baseZoneDraft,
      customMap: adminCustomMap,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_satipo2026_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed.venues) && parsed.venues.length > 0) {
          onUpdateVenues(parsed.venues);
        }
        if (Array.isArray(parsed.events)) {
          onUpdateEvents(parsed.events);
        }
        if (Array.isArray(parsed.venueCategories)) {
          onUpdateVenueCategories(parsed.venueCategories);
        }
        if (parsed.guideInfo) {
          onUpdateGuideInfo(parsed.guideInfo);
          setGuideForm(parsed.guideInfo);
        }
        if (parsed.baseZone) {
          setBaseZoneDraft(parsed.baseZone);
          onUpdateBaseZone(parsed.baseZone);
        }
        if (parsed.customMap) {
          setAdminCustomMap(parsed.customMap);
          saveCustomMapImage(parsed.customMap);
        }

        await pushUnifiedDataToServer({
          venues: parsed.venues,
          events: parsed.events,
          venueCategories: parsed.venueCategories,
          guideInfo: parsed.guideInfo,
          baseZone: parsed.baseZone || baseZoneDraft,
          customMap: parsed.customMap,
        });

        alert('¡Copia de respaldo importada y replicada a todos los dispositivos con éxito!');
      } catch (err: any) {
        alert('Error al importar el archivo: ' + (err?.message || 'Formato JSON no compatible'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Base Zone Handlers
  const handleSaveBaseZoneConfig = async () => {
    setIsSavingBaseZone(true);
    setZoneSaveMessage(null);
    try {
      onUpdateBaseZone(baseZoneDraft);
      await pushUnifiedDataToServer({ baseZone: baseZoneDraft });
      setZoneSaveMessage('¡Perímetro y alerta de Zona Base guardados y sincronizados!');
    } catch (err: any) {
      setZoneSaveMessage('Guardado en memoria. Error de conexión: ' + (err?.message || ''));
    } finally {
      setIsSavingBaseZone(false);
      setTimeout(() => setZoneSaveMessage(null), 4500);
    }
  };

  const handleStartEditPolygonOnMapClick = () => {
    onStartEditPolygonOnMap?.(baseZoneDraft.points);
  };

  const handleResetPolygonToDefaultUrban = () => {
    setBaseZoneDraft((prev) => ({
      ...prev,
      points: [...DEFAULT_BASE_ZONE.points],
    }));
  };

  const handleFitPolygonToVenues = () => {
    const validVenues = venues.filter((v) => {
      const lat = typeof v.lat === 'number' ? v.lat : parseFloat(String(v.lat));
      const lng = typeof v.lng === 'number' ? v.lng : parseFloat(String(v.lng));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    if (validVenues.length === 0) {
      handleResetPolygonToDefaultUrban();
      return;
    }

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;

    validVenues.forEach((v) => {
      const lat = typeof v.lat === 'number' ? v.lat : parseFloat(String(v.lat));
      const lng = typeof v.lng === 'number' ? v.lng : parseFloat(String(v.lng));
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    // Add a ~600m margin around all sports venues
    const marginLat = 0.0055;
    const marginLng = 0.0065;

    const north = Number((maxLat + marginLat).toFixed(6));
    const south = Number((minLat - marginLat).toFixed(6));
    const east = Number((maxLng + marginLng).toFixed(6));
    const west = Number((minLng - marginLng).toFixed(6));
    const midLng = Number(((west + east) / 2).toFixed(6));

    const fittedPoints: [number, number][] = [
      [north, midLng],
      [Number((north - (north - south) * 0.25).toFixed(6)), east],
      [Number((south + (north - south) * 0.25).toFixed(6)), east],
      [south, midLng],
      [Number((south + (north - south) * 0.25).toFixed(6)), west],
      [Number((north - (north - south) * 0.25).toFixed(6)), west],
    ];

    setBaseZoneDraft((prev) => ({
      ...prev,
      points: fittedPoints,
    }));
  };

  const handleAddManualPoint = () => {
    const last = baseZoneDraft.points[baseZoneDraft.points.length - 1] || [-11.2520, -74.6360];
    const newPoint: [number, number] = [
      Number((last[0] + 0.002).toFixed(6)),
      Number((last[1] + 0.002).toFixed(6)),
    ];
    setBaseZoneDraft((prev) => ({
      ...prev,
      points: [...prev.points, newPoint],
    }));
  };

  const handleUpdatePointCoord = (index: number, coordIdx: 0 | 1, value: string | number) => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return;
    setBaseZoneDraft((prev) => {
      const updated = [...prev.points];
      const current = updated[index];
      if (!current) return prev;
      const pt: [number, number] = [current[0], current[1]];
      pt[coordIdx] = Number(num.toFixed(6));
      updated[index] = pt;
      return { ...prev, points: updated };
    });
  };

  const handleDeletePoint = (index: number) => {
    setBaseZoneDraft((prev) => ({
      ...prev,
      points: prev.points.filter((_, i) => i !== index),
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [mapUploadSuccess, setMapUploadSuccess] = useState<boolean>(false);
  const [venueSuccessMsg, setVenueSuccessMsg] = useState<{ text: string; venue?: Venue } | null>(null);

  // Satipo Location Presets for Quick Venue Creation
  const SATIPO_LOCATION_PRESETS = [
    { name: '📍 Plaza Principal / Centro de Satipo', lat: -11.2522, lng: -74.6386, address: 'Centro de Satipo' },
    { name: '⚽ Estadio Municipal (Av. Leguía)', lat: -11.2558, lng: -74.6391, address: 'Av. Augusto B. Leguía cuadra 8, Satipo' },
    { name: '🏐 Coliseo Municipal (Jr. J.C. Tello)', lat: -11.2530, lng: -74.6360, address: 'Jr. Julio C. Tello s/n, Satipo' },
    { name: '🏆 Complejo Los Cedros', lat: -11.2485, lng: -74.6420, address: 'Av. Los Cedros s/n, Satipo' },
    { name: '🏊 Piscina / Campo Ferial', lat: -11.2565, lng: -74.6450, address: 'Prolongación Jr. Francisco Irazola s/n' },
    { name: '🏛️ Plaza Cívica Intercultural', lat: -11.2515, lng: -74.6375, address: 'Jr. Manuel Prado con Jr. Colonos Fundadores' },
    { name: '🌲 Sector Los Incas / Río Satipo', lat: -11.2590, lng: -74.6340, address: 'Malecón Turístico Río Satipo' },
    { name: '🛣️ Salida Norte (Río Negro)', lat: -11.2420, lng: -74.6380, address: 'Carretera Marginal Norte Km 2' },
    { name: '🛣️ Salida Sur (Mazamari)', lat: -11.2650, lng: -74.6390, address: 'Carretera Marginal Sur Km 1.5' },
    { name: '🌿 Distrito de Río Negro', lat: -11.2167, lng: -74.6500, address: 'Distrito de Río Negro' },
    { name: '🌿 Distrito de Mazamari', lat: -11.3250, lng: -74.5300, address: 'Distrito de Mazamari' },
    { name: '🌿 Distrito de Pangoa', lat: -11.4300, lng: -74.4800, address: 'Distrito de San Martín de Pangoa' },
  ];

  // Venue Form State with dynamic slight offset to avoid stacked default markers
  const [editingVenueId, setEditingVenueId] = useState<string | null>(() => {
    if (venueDraft) return venueDraft.editingVenueId;
    return initialEditingVenueId || null;
  });

  const [venueForm, setVenueForm] = useState<{
    name: string;
    category: string;
    address: string;
    lat: string;
    lng: string;
    description: string;
    facilities: string;
    capacity: string;
  }>(() => {
    if (venueDraft) {
      return {
        name: venueDraft.name,
        category: venueDraft.category || venueCategories[0]?.id || 'estadio',
        address: venueDraft.address,
        lat: venueDraft.lat,
        lng: venueDraft.lng,
        description: venueDraft.description,
        facilities: venueDraft.facilities,
        capacity: venueDraft.capacity,
      };
    }
    return {
      name: '',
      category: venueCategories[0]?.id || 'estadio',
      address: '',
      lat: (-11.2522 - (venues.length * 0.0015)).toFixed(4),
      lng: (-74.6386 + (venues.length * 0.0015)).toFixed(4),
      description: '',
      facilities: 'Fútbol, Atletismo',
      capacity: '1,000 personas',
    };
  });

  // Venue Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('⚽');
  const [newCatColor, setNewCatColor] = useState('emerald');
  const [catSuccessMsg, setCatSuccessMsg] = useState<string | null>(null);

  const PRESET_ICONS = ['⚽', '🏐', '🏀', '🏃', '🏊', '🏆', '🥋', '🏕️', '🏟️', '🏛️', '🎾', '🏓', '🚴', '🎯', '📍', '🌲', '🎪', '🚣', '🥊'];
  const COLOR_OPTIONS = [
    { id: 'emerald', label: 'Verde Esmeralda', badge: 'bg-emerald-600 text-white' },
    { id: 'blue', label: 'Azul Deportivo', badge: 'bg-blue-600 text-white' },
    { id: 'amber', label: 'Ámbar / Dorado', badge: 'bg-amber-600 text-white' },
    { id: 'cyan', label: 'Cian Acuático', badge: 'bg-cyan-600 text-white' },
    { id: 'purple', label: 'Morado', badge: 'bg-purple-600 text-white' },
    { id: 'rose', label: 'Rojo / Carmín', badge: 'bg-rose-600 text-white' },
    { id: 'teal', label: 'Turquesa Selva', badge: 'bg-teal-600 text-white' },
    { id: 'orange', label: 'Naranja Cítrico', badge: 'bg-orange-600 text-white' },
  ];

  // Event Form State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<{
    day: 'day1' | 'day2';
    dateStr: string;
    time: string;
    endTime: string;
    title: string;
    discipline: string;
    category: string;
    venueId: string;
    delegationA: string;
    delegationB: string;
    status: 'scheduled' | 'live' | 'finished';
    phase: string;
    details: string;
  }>({
    day: 'day1',
    dateStr: '18 de Septiembre 2026',
    time: '09:00 AM',
    endTime: '10:30 AM',
    title: '',
    discipline: 'Fútbol 11',
    category: 'Libre Varones',
    venueId: venues[0]?.id || '',
    delegationA: 'Mun. Prov. Satipo',
    delegationB: 'Mun. Dist. Mazamari',
    status: 'scheduled',
    phase: 'Fase de Grupos',
    details: '',
  });

  // JSON editor state
  const [rawJsonType, setRawJsonType] = useState<'venues' | 'categories' | 'schedule' | 'guide'>('venues');
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<boolean>(false);

  // Initialize JSON text
  const handleLoadJsonTab = (type: 'venues' | 'categories' | 'schedule' | 'guide') => {
    setRawJsonType(type);
    if (type === 'venues') {
      setRawJsonText(JSON.stringify(venues, null, 2));
    } else if (type === 'categories') {
      setRawJsonText(JSON.stringify(venueCategories, null, 2));
    } else if (type === 'guide') {
      setRawJsonText(JSON.stringify(guideInfo, null, 2));
    } else {
      setRawJsonText(JSON.stringify(events, null, 2));
    }
    setJsonError(null);
    setJsonSuccess(false);
  };

  // Add Category Handler
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const id = trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');

    if (venueCategories.some((c) => c.id === id)) {
      alert('Ya existe un tipo de sede con un identificador similar.');
      return;
    }

    const newCategory: VenueCategory = {
      id: id || `tipo-${Date.now()}`,
      name: trimmed,
      icon: newCatIcon || '📍',
      color: newCatColor || 'emerald',
    };

    onUpdateVenueCategories([...venueCategories, newCategory]);
    setNewCatName('');
    setCatSuccessMsg(`¡Tipo de sede "${trimmed}" agregado con éxito!`);
    setTimeout(() => setCatSuccessMsg(null), 3500);
  };

  // Delete Category Handler
  const handleDeleteCategory = (catId: string, catName: string) => {
    const venuesUsingThis = venues.filter((v) => v.category === catId);
    let confirmMsg = `¿Eliminar el tipo de sede "${catName}"?`;
    if (venuesUsingThis.length > 0) {
      confirmMsg += `\n\nNota: Hay ${venuesUsingThis.length} sede(s) registradas con este tipo.`;
    }

    if (confirm(confirmMsg)) {
      onUpdateVenueCategories(venueCategories.filter((c) => c.id !== catId));
    }
  };

  // Synchronize incoming venueDraft (e.g. from map picking)
  useEffect(() => {
    if (venueDraft) {
      setEditingVenueId(venueDraft.editingVenueId);
      setVenueForm({
        name: venueDraft.name,
        category: venueDraft.category || venueCategories[0]?.id || 'estadio',
        address: venueDraft.address,
        lat: venueDraft.lat,
        lng: venueDraft.lng,
        description: venueDraft.description,
        facilities: venueDraft.facilities,
        capacity: venueDraft.capacity,
      });
      setActiveAdminTab('venues');
      setVenueSuccessMsg({
        text: `📍 Ubicación fijada desde el mapa: Lat ${venueDraft.lat}, Lng ${venueDraft.lng}. Revisa los datos y pulsa Guardar.`,
      });
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  }, [venueDraft]);

  // If initialEditingVenueId is provided and no venueDraft, initialize form with it
  useEffect(() => {
    if (initialEditingVenueId && !venueDraft) {
      const target = venues.find((v) => v.id === initialEditingVenueId);
      if (target) {
        handleEditVenue(target);
      }
    }
  }, [initialEditingVenueId]);

  // Pick Coordinates from Map (preserves the current draft in App state)
  const handlePickFromMap = () => {
    onStartPickCoordinateOnMap({
      editingVenueId,
      name: venueForm.name,
      category: venueForm.category,
      address: venueForm.address,
      lat: venueForm.lat,
      lng: venueForm.lng,
      description: venueForm.description,
      facilities: venueForm.facilities,
      capacity: venueForm.capacity,
    });
  };

  // Save Venue
  const handleSaveVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueForm.name.trim()) return;

    const latNum = parseFloat(venueForm.lat);
    const lngNum = parseFloat(venueForm.lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('Por favor ingresa coordenadas válidas o usa "Marcar en Mapa".');
      return;
    }

    const facilitiesArr = venueForm.facilities
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    let savedVenueObj: Venue;

    if (editingVenueId) {
      // Update
      const updated = venues.map((v) => {
        if (v.id === editingVenueId) {
          savedVenueObj = {
            ...v,
            name: venueForm.name.trim(),
            category: venueForm.category,
            address: venueForm.address.trim(),
            lat: latNum,
            lng: lngNum,
            description: venueForm.description.trim(),
            facilities: facilitiesArr,
            capacity: venueForm.capacity.trim(),
          };
          return savedVenueObj;
        }
        return v;
      });
      onUpdateVenues(updated);
      setVenueSuccessMsg({
        text: `Sede "${venueForm.name.trim()}" actualizada correctamente con su nueva ubicación.`,
        venue: savedVenueObj!,
      });
      setEditingVenueId(null);
      if (onClearDraft) onClearDraft();
    } else {
      // Create
      savedVenueObj = {
        id: `venue-${Date.now()}`,
        name: venueForm.name.trim(),
        category: venueForm.category,
        address: venueForm.address.trim(),
        lat: latNum,
        lng: lngNum,
        description: venueForm.description.trim(),
        facilities: facilitiesArr,
        capacity: venueForm.capacity.trim(),
      };
      onUpdateVenues([...venues, savedVenueObj]);
      setVenueSuccessMsg({
        text: `¡Sede "${venueForm.name.trim()}" creada y ubicada exitosamente en el mapa!`,
        venue: savedVenueObj,
      });
      if (onClearDraft) onClearDraft();
    }

    // Reset Form for next entry
    const nextOffset = ((venues.length + 1) * 0.0015);
    setVenueForm({
      name: '',
      category: venueCategories[0]?.id || 'estadio',
      address: '',
      lat: (-11.2522 - nextOffset).toFixed(4),
      lng: (-74.6386 + nextOffset).toFixed(4),
      description: '',
      facilities: 'Fútbol, Atletismo',
      capacity: '1,000 personas',
    });
  };

  const handleEditVenue = (venue: Venue) => {
    setEditingVenueId(venue.id);
    const latStr = (venue.lat !== undefined && venue.lat !== null && !isNaN(Number(venue.lat)))
      ? String(venue.lat)
      : '-11.2522';
    const lngStr = (venue.lng !== undefined && venue.lng !== null && !isNaN(Number(venue.lng)))
      ? String(venue.lng)
      : '-74.6386';

    let facilitiesStr = '';
    if (Array.isArray(venue.facilities)) {
      facilitiesStr = venue.facilities.join(', ');
    } else if (typeof venue.facilities === 'string') {
      facilitiesStr = venue.facilities;
    }

    setVenueForm({
      name: venue.name || '',
      category: venue.category || venueCategories[0]?.id || 'estadio',
      address: venue.address || '',
      lat: latStr,
      lng: lngStr,
      description: venue.description || '',
      facilities: facilitiesStr,
      capacity: venue.capacity || '',
    });
    setActiveAdminTab('venues');

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingVenueId(null);
    if (onClearDraft) onClearDraft();
    const nextOffset = ((venues.length + 1) * 0.0015);
    setVenueForm({
      name: '',
      category: venueCategories[0]?.id || 'estadio',
      address: '',
      lat: (-11.2522 - nextOffset).toFixed(4),
      lng: (-74.6386 + nextOffset).toFixed(4),
      description: '',
      facilities: 'Fútbol, Atletismo',
      capacity: '1,000 personas',
    });
  };

  const handleDeleteVenue = (venueId: string) => {
    if (confirm('¿Estás seguro de eliminar esta sede?')) {
      onUpdateVenues(venues.filter((v) => v.id !== venueId));
      if (editingVenueId === venueId) {
        handleCancelEdit();
      }
    }
  };

  // Guide Form State & Handlers
  const [guideForm, setGuideForm] = useState<GuideInfo>(() => guideInfo || DEFAULT_GUIDE_INFO);
  const [newDisciplineText, setNewDisciplineText] = useState<string>('');
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newRecText, setNewRecText] = useState<string>('');
  const [guideSuccessMsg, setGuideSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (guideInfo) {
      setGuideForm(guideInfo);
    }
  }, [guideInfo]);

  const handleAddDiscipline = () => {
    if (!newDisciplineText.trim()) return;
    setGuideForm((prev) => ({
      ...prev,
      disciplines: [...(prev.disciplines || []), newDisciplineText.trim()],
    }));
    setNewDisciplineText('');
  };

  const handleRemoveDiscipline = (index: number) => {
    setGuideForm((prev) => ({
      ...prev,
      disciplines: prev.disciplines.filter((_, i) => i !== index),
    }));
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const newContact: EmergencyContact = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
    };
    setGuideForm((prev) => ({
      ...prev,
      emergencyContacts: [...(prev.emergencyContacts || []), newContact],
    }));
    setNewContactName('');
    setNewContactPhone('');
  };

  const handleRemoveContact = (id: string) => {
    setGuideForm((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((c) => c.id !== id),
    }));
  };

  const handleAddRecommendation = () => {
    if (!newRecText.trim()) return;
    setGuideForm((prev) => ({
      ...prev,
      recommendations: [...(prev.recommendations || []), newRecText.trim()],
    }));
    setNewRecText('');
  };

  const handleRemoveRecommendation = (index: number) => {
    setGuideForm((prev) => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index),
    }));
  };

  const handleSaveGuide = () => {
    onUpdateGuideInfo(guideForm);
    setGuideSuccessMsg('¡Guía Informativa actualizada y guardada con éxito!');
    setTimeout(() => setGuideSuccessMsg(null), 3500);
  };

  const handleResetGuideOnly = () => {
    if (confirm('¿Restablecer la Guía Informativa al texto original de Satipo 2026?')) {
      setGuideForm(DEFAULT_GUIDE_INFO);
      onUpdateGuideInfo(DEFAULT_GUIDE_INFO);
      setGuideSuccessMsg('¡Guía Informativa restablecida a los valores oficiales!');
      setTimeout(() => setGuideSuccessMsg(null), 3000);
    }
  };

  // Save Raw JSON
  const handleSaveRawJson = () => {
    setJsonError(null);
    setJsonSuccess(false);
    try {
      const parsed = JSON.parse(rawJsonText);
      if (rawJsonType === 'guide') {
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('El JSON de la Guía debe ser un objeto { ... }');
        }
        onUpdateGuideInfo(parsed);
        setGuideForm(parsed);
      } else {
        if (!Array.isArray(parsed)) {
          throw new Error('El JSON debe ser un arreglo de elementos [ {...}, {...} ]');
        }

        if (rawJsonType === 'venues') {
          onUpdateVenues(parsed);
        } else if (rawJsonType === 'categories') {
          onUpdateVenueCategories(parsed);
        } else {
          onUpdateEvents(parsed);
        }
      }
      setJsonSuccess(true);
      setTimeout(() => setJsonSuccess(false), 3000);
    } catch (err: any) {
      setJsonError(err.message || 'Formato JSON inválido.');
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = () => {
    if (confirm('¿Restablecer todas las sedes, tipos de sedes, programa y guía oficial de Satipo 2026?')) {
      onUpdateVenues(DEFAULT_VENUES);
      onUpdateVenueCategories(DEFAULT_VENUE_CATEGORIES);
      onUpdateEvents(DEFAULT_SCHEDULE);
      onUpdateGuideInfo(DEFAULT_GUIDE_INFO);
      setGuideForm(DEFAULT_GUIDE_INFO);
      localStorage.removeItem('satipo2026_venues');
      localStorage.removeItem('satipo2026_venue_categories');
      localStorage.removeItem('satipo2026_schedule');
      localStorage.removeItem('satipo2026_guide_info');

      // Replicate reset to server
      pushUnifiedDataToServer({
        venues: DEFAULT_VENUES,
        events: DEFAULT_SCHEDULE,
        venueCategories: DEFAULT_VENUE_CATEGORIES,
        guideInfo: DEFAULT_GUIDE_INFO,
        customMap: adminCustomMap,
      }).catch(() => {});

      alert('¡Datos restablecidos a los valores oficiales por defecto y sincronizados!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 rounded-full bg-slate-700 mx-auto mt-2.5 mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:p-4 border-b border-slate-800/90 bg-slate-950/70 gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 shadow-inner">
              ⚙️
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-black text-slate-100 truncate leading-tight tracking-tight">
                Panel de Administración · Satipo 2026
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate leading-snug">
                Gestiona sedes, tipos de sede, plano y guía oficial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 flex items-center justify-center active:scale-95 transition flex-shrink-0 cursor-pointer border border-slate-700/50"
            title="Cerrar panel de administración"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Navigation Area (Dual-Mode: Full Grid for Mobile, Sleek Pill Bar for Desktop) */}
        <div className="border-b border-slate-800/90 bg-slate-950/80 px-3 py-2.5 sm:px-4 sm:py-2">
          {/* Mobile Grid Layout: ALL 7 options clearly visible at once, touch targets, no hidden overflow */}
          <div className="grid grid-cols-2 gap-1.5 sm:hidden">
            {/* 1. Sedes */}
            <button
              id="tab-admin-venues-m"
              onClick={() => setActiveAdminTab('venues')}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'venues'
                  ? 'bg-emerald-500/25 text-emerald-200 border-2 border-emerald-400 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Sedes</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold flex-shrink-0 ${
                activeAdminTab === 'venues'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {venues.length}
              </span>
            </button>

            {/* 2. Tipos de Sede */}
            <button
              id="tab-admin-categories-m"
              onClick={() => setActiveAdminTab('categories')}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'categories'
                  ? 'bg-emerald-500/25 text-emerald-200 border-2 border-emerald-400 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Tags className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Tipos de Sede</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold flex-shrink-0 ${
                activeAdminTab === 'categories'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {venueCategories.length}
              </span>
            </button>

            {/* 3. Guía Informativa */}
            <button
              id="tab-admin-guide-m"
              onClick={() => setActiveAdminTab('guide')}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'guide'
                  ? 'bg-teal-500/25 text-teal-200 border-2 border-teal-400 shadow-md shadow-teal-950/60 ring-1 ring-teal-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <span className="truncate">Guía Informativa</span>
            </button>

            {/* 4. Zona Base */}
            <button
              id="tab-admin-basezone-m"
              onClick={() => setActiveAdminTab('basezone')}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'basezone'
                  ? 'bg-amber-500/25 text-amber-200 border-2 border-amber-400 shadow-md shadow-amber-950/60 ring-1 ring-amber-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Shapes className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">Zona Base</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {baseZoneDraft.enabled ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Zona activa" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-600" title="Inactiva" />
                )}
                <span className="text-[9px] text-amber-300/80 font-mono">S/.3</span>
              </span>
            </button>

            {/* 5. Plano JPG */}
            <button
              id="tab-admin-mapajpg-m"
              onClick={() => setActiveAdminTab('mapajpg')}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'mapajpg'
                  ? 'bg-amber-500/25 text-amber-200 border-2 border-amber-400 shadow-md shadow-amber-950/60 ring-1 ring-amber-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <FileImage className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">Plano JPG</span>
            </button>

            {/* 6. Carga JSON */}
            <button
              id="tab-admin-json-m"
              onClick={() => {
                setActiveAdminTab('json');
                handleLoadJsonTab('venues');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'json'
                  ? 'bg-emerald-500/25 text-emerald-200 border-2 border-emerald-400 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="truncate">Carga JSON</span>
            </button>

            {/* 7. Sincronizar (Col-span-2 on mobile for full clarity and prominence) */}
            <button
              id="tab-admin-sync-m"
              onClick={() => setActiveAdminTab('sync')}
              className={`col-span-2 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activeAdminTab === 'sync'
                  ? 'bg-sky-500/25 text-sky-200 border-2 border-sky-400 shadow-md shadow-sky-950/60 ring-1 ring-sky-500/40'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 flex-shrink-0 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span className="truncate">Sincronizar (Celular / PC)</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span>Nube Activa</span>
              </span>
            </button>
          </div>

          {/* Desktop Pill Bar: Horizontal row for tablets and desktop screens */}
          <div className="hidden sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:pb-0.5">
            <button
              id="tab-admin-venues"
              onClick={() => setActiveAdminTab('venues')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'venues'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Sedes</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeAdminTab === 'venues'
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {venues.length}
              </span>
            </button>

            <button
              id="tab-admin-categories"
              onClick={() => setActiveAdminTab('categories')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'categories'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Tags className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Tipos de Sede</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeAdminTab === 'categories'
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {venueCategories.length}
              </span>
            </button>

            <button
              id="tab-admin-guide"
              onClick={() => setActiveAdminTab('guide')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'guide'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm shadow-teal-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <span>Guía Informativa</span>
            </button>

            <button
              id="tab-admin-basezone"
              onClick={() => setActiveAdminTab('basezone')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'basezone'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Shapes className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Zona Base</span>
              {baseZoneDraft.enabled ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" title="Zona Base activa"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" title="Zona Base inactiva"></span>
              )}
            </button>

            <button
              id="tab-admin-mapajpg"
              onClick={() => setActiveAdminTab('mapajpg')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'mapajpg'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <FileImage className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Plano JPG</span>
            </button>

            <button
              id="tab-admin-json"
              onClick={() => {
                setActiveAdminTab('json');
                handleLoadJsonTab('venues');
              }}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'json'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Carga JSON</span>
            </button>

            <button
              id="tab-admin-sync"
              onClick={() => setActiveAdminTab('sync')}
              className={`py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                activeAdminTab === 'sync'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm shadow-sky-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin text-sky-400' : 'text-sky-400'} flex-shrink-0`} />
              <span>Sincronizar</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="p-4 overflow-y-auto space-y-6 flex-1 scroll-smooth">
          {/* TAB 1: VENUES MANAGER */}
          {activeAdminTab === 'venues' && (
            <div className="space-y-6">
              {/* Success Notification Banner with Direct Map Navigation */}
              {venueSuccessMsg && (
                <div className="bg-emerald-950/90 border-2 border-emerald-500 p-3.5 rounded-2xl shadow-xl shadow-emerald-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-200 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="font-extrabold text-emerald-100 text-xs leading-snug">
                        {venueSuccessMsg.text}
                      </p>
                      {venueSuccessMsg.venue && (
                        <p className="text-[11px] text-emerald-300 font-mono mt-0.5">
                          Ubicación: Lat {typeof venueSuccessMsg.venue.lat === 'number' ? venueSuccessMsg.venue.lat.toFixed(4) : venueSuccessMsg.venue.lat}, Lng {typeof venueSuccessMsg.venue.lng === 'number' ? venueSuccessMsg.venue.lng.toFixed(4) : venueSuccessMsg.venue.lng}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {venueSuccessMsg.venue && onSelectVenueOnMap && (
                      <button
                        type="button"
                        onClick={() => onSelectVenueOnMap(venueSuccessMsg.venue!)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Ver en Mapa</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVenueSuccessMsg(null)}
                      className="p-1 rounded-lg text-emerald-400 hover:text-emerald-200 hover:bg-emerald-900/60 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Form */}
              <form
                ref={formRef}
                onSubmit={handleSaveVenue}
                className={`p-4 rounded-2xl border transition-all duration-200 space-y-3.5 ${
                  editingVenueId
                    ? 'bg-slate-900/95 border-amber-500 ring-2 ring-amber-500/30 shadow-xl shadow-amber-950/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                {/* Form Header & Edit Indicator */}
                {editingVenueId ? (
                  <div className="flex items-center justify-between bg-amber-950/70 border border-amber-500/50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                        ✏️
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-amber-300">
                          Modo Edición de Sede
                        </h4>
                        <p className="text-[11px] text-amber-100 font-semibold truncate max-w-[240px] sm:max-w-md">
                          Modificando: {venueForm.name || 'Sede seleccionada'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4" />
                      <span>Registrar Nueva Sede</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Completa los datos y ubícala en el mapa
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Nombre de la Sede *
                    </label>
                    <input
                      type="text"
                      required
                      value={venueForm.name}
                      onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                      placeholder="Ej. Estadio Municipal de Satipo"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400 font-semibold block">
                        Tipo de Sede *
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveAdminTab('categories')}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Agregar más tipos</span>
                      </button>
                    </div>
                    <select
                      value={venueForm.category}
                      onChange={(e) => setVenueForm({ ...venueForm, category: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                    >
                      {venueCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon || '📍'} {cat.name}
                        </option>
                      ))}
                      {venueCategories.length === 0 && (
                        <option value="otro">📍 Otro</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Dirección o Referencia
                  </label>
                  <input
                    type="text"
                    value={venueForm.address}
                    onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                    placeholder="Ej. Av. Augusto B. Leguía cuadra 8, Satipo"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* Quick Satipo Location Presets Helper */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ubicaciones Rápidas en Satipo (Autocompletar Coordenadas)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Toca cualquier punto para aplicar</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {SATIPO_LOCATION_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setVenueForm((prev) => ({
                            ...prev,
                            lat: preset.lat.toFixed(6),
                            lng: preset.lng.toFixed(6),
                            address: prev.address.trim() ? prev.address : preset.address,
                          }));
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-200 border border-slate-700/80 rounded-lg text-[10px] font-medium text-slate-300 transition active:scale-95 cursor-pointer text-left truncate max-w-[210px]"
                        title={`${preset.name}\nLat: ${preset.lat}, Lng: ${preset.lng}`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coordinates & Map Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Latitud (Satipo aprox -11.25) *
                    </label>
                    <input
                      type="text"
                      required
                      value={venueForm.lat}
                      onChange={(e) => setVenueForm({ ...venueForm, lat: e.target.value })}
                      placeholder="-11.2558"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Longitud (Satipo aprox -74.63) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={venueForm.lng}
                        onChange={(e) => setVenueForm({ ...venueForm, lng: e.target.value })}
                        placeholder="-74.6391"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={handlePickFromMap}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer transition"
                        title="Hacer clic directamente sobre el mapa de Satipo para fijar la ubicación exacta"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Marcar en Mapa</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Disciplinas / Facilidades (separadas por comas)
                  </label>
                  <input
                    type="text"
                    value={venueForm.facilities}
                    onChange={(e) => setVenueForm({ ...venueForm, facilities: e.target.value })}
                    placeholder="Fútbol Libre, Atletismo, Vóley"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Descripción / Detalles
                  </label>
                  <textarea
                    rows={2}
                    value={venueForm.description}
                    onChange={(e) => setVenueForm({ ...venueForm, description: e.target.value })}
                    placeholder="Detalles sobre canchas, iluminación, accesos..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer ${
                    editingVenueId
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{editingVenueId ? 'Guardar Cambios de la Sede' : 'Guardar Sede'}</span>
                </button>
              </form>

              {/* Venues List Table */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-black uppercase text-slate-400">
                    Sedes Registradas ({venues.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Haz clic en "Editar" para modificar ubicación o datos
                  </span>
                </div>

                <div className="space-y-2">
                  {venues.map((v) => {
                    const isCurrentlyEditing = editingVenueId === v.id;
                    const catInfo = venueCategories.find((c) => c.id === v.category);
                    return (
                      <div
                        key={v.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          isCurrentlyEditing
                            ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-100 truncate">{v.name}</span>
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                              <span>{catInfo?.icon || '📍'}</span>
                              <span>{catInfo?.name || v.category}</span>
                            </span>
                            {isCurrentlyEditing && (
                              <span className="text-[9px] font-black uppercase bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded animate-pulse">
                                Editando ahora
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{v.address}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Coords: {typeof v.lat === 'number' ? v.lat.toFixed(4) : v.lat}, {typeof v.lng === 'number' ? v.lng.toFixed(4) : v.lng}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {onSelectVenueOnMap && (
                            <button
                              type="button"
                              onClick={() => onSelectVenueOnMap(v)}
                              className="px-2 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Ver ubicación en el Mapa Interactivo"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Ver Mapa</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditVenue(v)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                              isCurrentlyEditing
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                            }`}
                            title="Editar Sede"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVenue(v.id)}
                            className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 transition cursor-pointer"
                            title="Eliminar Sede"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VENUE CATEGORIES / TIPOS DE SEDES */}
          {activeAdminTab === 'categories' && (
            <div className="space-y-6">
              {/* Add New Category Form */}
              <form
                onSubmit={handleAddCategory}
                className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Tags className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-black uppercase text-emerald-400">
                    Agregar Nuevo Tipo de Sede
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Nombre del Tipo de Sede *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ej. Campo Deportivo, Polideportivo, Gimnasio"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Color Temático
                    </label>
                    <select
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                    >
                      {COLOR_OPTIONS.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Emoji Selector */}
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                    Seleccionar Ícono / Emoji ({newCatIcon})
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    {PRESET_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewCatIcon(icon)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition ${
                          newCatIcon === icon
                            ? 'bg-emerald-600 scale-110 shadow-md ring-2 ring-emerald-400'
                            : 'bg-slate-800/80 hover:bg-slate-700'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                    <input
                      type="text"
                      maxLength={2}
                      value={newCatIcon}
                      onChange={(e) => setNewCatIcon(e.target.value)}
                      placeholder="Otro"
                      className="w-12 h-8 bg-slate-800 border border-slate-700 rounded-lg text-center text-sm text-white focus:border-emerald-500 outline-none"
                      title="Escribir emoji personalizado"
                    />
                  </div>
                </div>

                {catSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{catSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Guardar Nuevo Tipo de Sede</span>
                </button>
              </form>

              {/* Categories List */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-black uppercase text-slate-400">
                    Tipos de Sede Activos ({venueCategories.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Haz clic en la papelera para eliminar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {venueCategories.map((cat) => {
                    const usageCount = venues.filter((v) => v.category === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0 shadow-inner">
                            {cat.icon || '📍'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-extrabold text-slate-100 truncate">
                              {cat.name}
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              ID: <code className="text-emerald-400 font-mono">{cat.id}</code> • {usageCount} sede(s)
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 transition cursor-pointer flex-shrink-0"
                          title="Eliminar tipo de sede"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JPG MAP MANAGER */}
          {activeAdminTab === 'mapajpg' && (
            <div className="space-y-6">
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-amber-300">
                        Gestor del Plano Oficial en JPG
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Carga el archivo JPG, PNG o imagen satelital oficial del plano de Satipo 2026
                      </p>
                    </div>
                  </div>
                  {adminCustomMap ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Plano Personalizado Activo
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 font-semibold border border-slate-800">
                      Plano Predeterminado
                    </span>
                  )}
                </div>

                {/* Status Messages */}
                {isMapSaving && (
                  <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                    <span>Optimizando y guardando plano de alta resolución en almacenamiento persistente...</span>
                  </div>
                )}

                {mapUploadSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="font-extrabold text-emerald-100">¡Plano guardado exitosamente!</p>
                      <p className="text-[11px] text-emerald-300">
                        El plano oficial ya está activo y disponible inmediatamente en la pestaña "Plano".
                      </p>
                    </div>
                  </div>
                )}

                {mapSaveError && (
                  <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{mapSaveError}</span>
                  </div>
                )}

                {/* Upload Drag & Drop Zone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setIsMapSaving(true);
                      setMapSaveError(null);
                      try {
                        const optimizedData = await optimizeImageFile(file);
                        await saveCustomMapImage(optimizedData);
                        setAdminCustomMap(optimizedData);
                        setMapUploadSuccess(true);
                        setTimeout(() => setMapUploadSuccess(false), 4000);
                      } catch (err: any) {
                        setMapSaveError(err?.message || 'Error al procesar y guardar la imagen del plano.');
                      } finally {
                        setIsMapSaving(false);
                      }
                    }
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-950/10 hover:bg-amber-950/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 group-hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-100">
                      Haz clic para seleccionar o arrastra una imagen JPG/PNG del plano
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Formatos compatibles: JPG, JPEG, PNG, WEBP (Se optimiza y almacena de forma permanente)
                    </p>
                  </div>
                </div>

                {/* Alternative: URL Input */}
                <div className="pt-2">
                  <label className="block text-slate-300 text-xs font-bold mb-1">
                    O ingresa la URL de una imagen en internet
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={customMapUrlInput}
                      onChange={(e) => setCustomMapUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/plano-satipo-2026.jpg"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-amber-500 outline-none"
                    />
                    <button
                      type="button"
                      disabled={!customMapUrlInput.trim() || isMapSaving}
                      onClick={async () => {
                        if (!customMapUrlInput.trim()) return;
                        setIsMapSaving(true);
                        setMapSaveError(null);
                        try {
                          await saveCustomMapImage(customMapUrlInput.trim());
                          setAdminCustomMap(customMapUrlInput.trim());
                          setCustomMapUrlInput('');
                          setMapUploadSuccess(true);
                          setTimeout(() => setMapUploadSuccess(false), 4000);
                        } catch (err: any) {
                          setMapSaveError(err?.message || 'Error al guardar la URL del plano.');
                        } finally {
                          setIsMapSaving(false);
                        }
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar URL</span>
                    </button>
                  </div>
                </div>

                {/* Map Preview & Actions */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Vista Previa del Plano Activo</span>
                    {adminCustomMap && (
                      <button
                        onClick={async () => {
                          if (confirm('¿Restablecer el plano al croquis oficial predeterminado?')) {
                            await removeCustomMapImage();
                            setAdminCustomMap(null);
                            setMapUploadSuccess(false);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Restablecer plano oficial predeterminado</span>
                      </button>
                    )}
                  </div>

                  <div className="w-full h-56 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative group p-2">
                    <img
                      src={adminCustomMap || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><rect width="400" height="250" fill="%230f172a"/><text x="200" y="125" fill="%23fbbf24" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Plano Oficial Satipo 2026 (Predeterminado)</text></svg>'}
                      alt="Preview Plano"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GUÍA INFORMATIVA MANAGER */}
          {activeAdminTab === 'guide' && (
            <div className="space-y-6">
              {/* Success Notification */}
              {guideSuccessMsg && (
                <div className="bg-teal-950/90 border-2 border-teal-500 p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs text-teal-200 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
                  <p className="font-extrabold text-teal-100 text-xs">{guideSuccessMsg}</p>
                </div>
              )}

              {/* 1. Header & Welcome Message Card */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-teal-400 font-extrabold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Mensaje de Bienvenida y Datos Generales</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">
                      Título de Bienvenida
                    </label>
                    <input
                      type="text"
                      value={guideForm.welcomeTitle || ''}
                      onChange={(e) =>
                        setGuideForm((prev) => ({ ...prev, welcomeTitle: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-teal-500 outline-none"
                      placeholder="Ej. ¡Bienvenidos a la Capital Ecológica de la Selva Central!"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">
                      Subtítulo / Nombre del Campeonato
                    </label>
                    <input
                      type="text"
                      value={guideForm.welcomeSubtitle || ''}
                      onChange={(e) =>
                        setGuideForm((prev) => ({ ...prev, welcomeSubtitle: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-teal-500 outline-none"
                      placeholder="Ej. Campeonato Intermunicipalidades Satipo 2026"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">
                      Fechas Oficiales del Evento
                    </label>
                    <input
                      type="text"
                      value={guideForm.eventDates || ''}
                      onChange={(e) =>
                        setGuideForm((prev) => ({ ...prev, eventDates: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-teal-500 outline-none"
                      placeholder="Ej. 18 y 19 de Septiembre de 2026"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-xs font-bold mb-1">
                      Ubicación / Sede
                    </label>
                    <input
                      type="text"
                      value={guideForm.eventLocation || ''}
                      onChange={(e) =>
                        setGuideForm((prev) => ({ ...prev, eventLocation: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-teal-500 outline-none"
                      placeholder="Ej. Satipo, Región Junín, Perú"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-1">
                    Descripción / Mensaje para las Delegaciones
                  </label>
                  <textarea
                    rows={3}
                    value={guideForm.welcomeDescription || ''}
                    onChange={(e) =>
                      setGuideForm((prev) => ({ ...prev, welcomeDescription: e.target.value }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500 outline-none"
                    placeholder="Escribe el mensaje de saludo o información para las delegaciones visitantes..."
                  />
                </div>
              </div>

              {/* 2. Disciplinas Deportivas Oficiales */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Disciplinas Oficiales en Competencia ({guideForm.disciplines?.length || 0})</span>
                  </div>
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {guideForm.disciplines?.map((disc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-200 px-3 py-1 rounded-xl border border-slate-700 text-xs font-medium"
                    >
                      <span>{disc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDiscipline(idx)}
                        className="text-slate-400 hover:text-red-400 transition"
                        title="Eliminar disciplina"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Discipline Input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newDisciplineText}
                    onChange={(e) => setNewDisciplineText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDiscipline();
                      }
                    }}
                    placeholder="Ej. Ciclismo de Montaña, Ajedrez..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddDiscipline}
                    disabled={!newDisciplineText.trim()}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>

              {/* 3. Emergency Contacts */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Teléfonos de Emergencia y Asistencia en Satipo</span>
                </div>

                <div className="space-y-2">
                  {guideForm.emergencyContacts?.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-xs">{contact.name}:</span>
                        <span className="text-emerald-400 font-mono text-xs">{contact.phone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(contact.id)}
                        className="text-slate-400 hover:text-red-400 p-1 rounded-lg hover:bg-slate-800 transition"
                        title="Eliminar contacto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Contact form */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Entidad (Ej. Serenazgo)"
                    className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                  />
                  <input
                    type="text"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="Teléfono / Celular (Ej. 964123456)"
                    className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={!newContactName.trim() || !newContactPhone.trim()}
                    className="sm:col-span-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {/* 4. Recommendations for Delegations */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Recomendaciones para las Delegaciones</span>
                </div>

                <ul className="space-y-2">
                  {guideForm.recommendations?.map((rec, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span className="text-slate-200">{rec}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecommendation(idx)}
                        className="text-slate-400 hover:text-red-400 p-1 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
                        title="Eliminar recomendación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Add Recommendation */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newRecText}
                    onChange={(e) => setNewRecText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRecommendation();
                      }
                    }}
                    placeholder="Escribe una recomendación o norma para las delegaciones..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-sky-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddRecommendation}
                    disabled={!newRecText.trim()}
                    className="px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>

              {/* 5. Additional Notes */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-slate-300 text-xs font-bold">
                  Notas Adicionales o Comunicados de la Comisión
                </label>
                <textarea
                  rows={2}
                  value={guideForm.additionalNotes || ''}
                  onChange={(e) =>
                    setGuideForm((prev) => ({ ...prev, additionalNotes: e.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500 outline-none"
                  placeholder="Ej. Cualquier modificación de fixture se comunicará por el canal oficial..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveGuide}
                  className="w-full sm:flex-1 py-3 bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-teal-950 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios en la Guía Informativa</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetGuideOnly}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer Guía</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: JSON RAW EDITOR / IMPORT */}
          {activeAdminTab === 'json' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleLoadJsonTab('venues')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      rawJsonType === 'venues'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Sedes
                  </button>
                  <button
                    onClick={() => handleLoadJsonTab('categories')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      rawJsonType === 'categories'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Tipos de Sede
                  </button>
                  <button
                    onClick={() => handleLoadJsonTab('guide')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      rawJsonType === 'guide'
                        ? 'bg-teal-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Guía Informativa
                  </button>
                  <button
                    onClick={() => handleLoadJsonTab('schedule')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      rawJsonType === 'schedule'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Programa / Fixture
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawJsonText);
                    alert('¡JSON copiado al portapapeles!');
                  }}
                  className="text-xs text-emerald-400 hover:underline font-semibold"
                >
                  Copiar JSON
                </button>
              </div>

              <textarea
                rows={12}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:border-emerald-500 outline-none"
                placeholder="Pega aquí la estructura JSON válida..."
              />

              {jsonError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{jsonError}</span>
                </div>
              )}

              {jsonSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>¡Datos JSON actualizados y guardados en localStorage con éxito!</span>
                </div>
              )}

              <button
                onClick={handleSaveRawJson}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Aplicar y Guardar Cambios de JSON</span>
              </button>
            </div>
          )}

          {/* TAB 6: UNIFICAR CELULAR / PC (MULTI-DEVICE CLOUD SYNC) */}
          {activeAdminTab === 'sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Feedback toast message */}
              {syncMessage && (
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3 text-xs shadow-lg animate-in zoom-in-95 duration-150 ${
                    syncMessage.type === 'success'
                      ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                      : 'bg-red-950/90 border-red-500 text-red-200'
                  }`}
                >
                  {syncMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{syncMessage.text}</span>
                </div>
              )}

              {/* Status Header Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/70 border border-sky-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                      {getDeviceType() === 'Celular' ? (
                        <Smartphone className="w-6 h-6" />
                      ) : (
                        <Laptop className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="w-2.5 h-2.5 -ml-4.5 rounded-full bg-emerald-400"></span>
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          Sincronización en Vivo Activa
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white mt-0.5">
                        Estás administrando desde: {getDeviceType()}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleForceSyncFromServer}
                      disabled={isSyncingNow}
                      className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-sky-950 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>{isSyncingNow ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Última actualización unificada:</span>
                    <span className="font-bold text-slate-200">
                      {syncStatus?.lastSyncedAt
                        ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Recién iniciado'}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Origen del último cambio:</span>
                    <span className="font-bold text-sky-300">
                      {syncStatus?.lastUpdatedBy || 'Servidor Central'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  💡 <strong>¿Cómo funciona?</strong> Todos los cambios que guardes en sedes, fixture, tipos de sede, plano o guía en este dispositivo se envían al servidor y se replican de inmediato en tu celular, tablet o computadora sin necesidad de recargar la página.
                </p>
              </div>

              {/* SECTION: Scan QR to open Admin mode on Cell Phone */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Abrir Modo Administrador en tu Celular
                    </h4>
                    <p className="text-xs text-slate-400">
                      Escanea este código QR con la cámara de tu teléfono
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  {adminQrCodeUrl ? (
                    <div className="bg-white p-3 rounded-2xl shadow-xl flex-shrink-0">
                      <img
                        src={adminQrCodeUrl}
                        alt="QR Acceso Administrador"
                        className="w-40 h-40 object-contain"
                      />
                      <p className="text-[10px] text-center text-slate-700 font-extrabold mt-1">
                        ADMIN SATIPO 2026
                      </p>
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-800 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-500">
                      Cargando QR...
                    </div>
                  )}

                  <div className="space-y-3 flex-1">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Al escanear el QR o abrir el enlace en tu celular, entrarás con los privilegios de la Comisión Organizadora activados. Podrás editar en vivo mientras recorres las sedes en Satipo.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleCopyAdminUrl}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedAdminLink ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">¡Enlace Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-sky-400" />
                            <span>Copiar Enlace para WhatsApp</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          const adminUrl = window.location.origin + window.location.pathname + '?admin=true';
                          if (navigator.share) {
                            navigator.share({
                              title: 'Acceso Administrador Satipo 2026',
                              text: 'Enlace de acceso a la Comisión Organizadora Satipo 2026',
                              url: adminUrl,
                            }).catch(() => {});
                          } else {
                            handleCopyAdminUrl();
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Compartir Enlace</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Push Local Data or Pull from Server */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Replicación Manual y Difusión
                    </h4>
                    <p className="text-xs text-slate-400">
                      Opciones para forzar la sincronización en ambos sentidos
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handlePushAllToServer}
                    disabled={isSyncingNow}
                    className="p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-emerald-500/40 text-left transition space-y-1.5 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400 text-xs flex items-center gap-1.5">
                        <Upload className="w-4 h-4" />
                        Subir y Replicar Todo
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-emerald-300">
                        Hacia Celulares y PCs &rarr;
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Envía todas las {venues.length} sedes, {events.length} partidos y plano de esta pantalla al servidor para que todos los dispositivos lo tengan idéntico.
                    </p>
                  </button>

                  <button
                    onClick={handleForceSyncFromServer}
                    disabled={isSyncingNow}
                    className="p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-sky-500/40 text-left transition space-y-1.5 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sky-400 text-xs flex items-center gap-1.5">
                        <Download className="w-4 h-4" />
                        Descargar Cambios Recientes
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-sky-300">
                        Desde el Servidor &rarr;
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Trae los últimos datos actualizados en otros teléfonos o computadoras a esta pantalla.
                    </p>
                  </button>
                </div>
              </div>

              {/* SECTION: Offline Full Backup File (JSON Export/Import) */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                    <HardDriveDownload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Copia de Seguridad Completa (Archivo JSON)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Guarda un archivo en tu equipo o transfiérelo a cualquier otro sistema
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleExportFullBackup}
                    className="flex-1 py-3 px-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-purple-500/40 text-purple-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <HardDriveDownload className="w-4 h-4 text-purple-400" />
                    <span>Descargar Archivo de Respaldo (.json)</span>
                  </button>

                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImportFullBackup}
                  />

                  <button
                    onClick={() => backupFileInputRef.current?.click()}
                    className="flex-1 py-3 px-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <HardDriveUpload className="w-4 h-4 text-slate-400" />
                    <span>Restaurar Archivo de Respaldo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ZONA BASE Y ALERTA TARIFARIA */}
          {activeAdminTab === 'basezone' && (
            <div className="space-y-6">
              {/* Notification Banner when saved */}
              {zoneSaveMessage && (
                <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="font-bold">{zoneSaveMessage}</span>
                  </div>
                  <button
                    onClick={() => setZoneSaveMessage(null)}
                    className="text-emerald-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* CARD 1: Configuración General y Alerta */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                      <Shapes className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Zona Base y Supervisión Tarifaria (Satipo)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Supervisa si la ubicación del usuario mediante GPS sale del perímetro urbano fijado.
                      </p>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer select-none bg-slate-950/70 px-3.5 py-2 rounded-2xl border border-slate-800">
                    <span className={`text-xs font-bold ${baseZoneDraft.enabled ? 'text-amber-400' : 'text-slate-400'}`}>
                      {baseZoneDraft.enabled ? 'Función Activada' : 'Función Desactivada'}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={baseZoneDraft.enabled}
                      onChange={(e) => setBaseZoneDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${baseZoneDraft.enabled ? 'bg-amber-500' : 'bg-slate-700'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${baseZoneDraft.enabled ? 'left-5.5' : 'left-0.5'}`} />
                    </div>
                  </label>
                </div>

                {/* Título de la Zona */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Título o Nombre de la Zona:
                  </label>
                  <input
                    type="text"
                    value={baseZoneDraft.title || ''}
                    onChange={(e) => setBaseZoneDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej. Zona Urbana Base - Satipo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Mensaje de Alerta al Salir del Polígono */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Mensaje de Alerta Visual (al salir del perímetro):
                    </label>
                    <button
                      type="button"
                      onClick={() => setBaseZoneDraft((prev) => ({ ...prev, message: 'Has salido de la zona base. El pasaje es de 3 soles' }))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      Restablecer texto original
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={baseZoneDraft.message || ''}
                    onChange={(e) => setBaseZoneDraft((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Has salido de la zona base. El pasaje es de 3 soles"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Vista previa de cómo saldrá la alerta */}
                <div className="pt-2">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Vista previa de la alerta en celulares de visitantes:
                  </span>
                  <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-3 rounded-2xl shadow-md border-2 border-amber-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center flex-shrink-0 shadow">
                        <AlertCircle className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-900 leading-tight">
                          {baseZoneDraft.title || 'Alerta de Zona Base'}
                        </p>
                        <p className="text-xs sm:text-sm font-black leading-tight text-slate-950">
                          {baseZoneDraft.message || 'Has salido de la zona base. El pasaje es de 3 soles'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Dibujo y Vértices del Polígono */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>Polígono de la Zona ({baseZoneDraft.points.length} vértices)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dibuja el perímetro sobre las calles de Satipo haciendo clic en el mapa o ajusta las coordenadas.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartEditPolygonOnMapClick}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer flex-shrink-0"
                  >
                    <Shapes className="w-4 h-4" />
                    <span>✏️ Dibujar / Modificar en el Mapa</span>
                  </button>
                </div>

                {/* Preajustes Rápidos */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleResetPolygonToDefaultUrban}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cargar Casco Urbano Satipo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFitPolygonToVenues}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Envolver Sedes Deportivas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBaseZoneDraft((prev) => ({ ...prev, points: [] }))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar Vértices</span>
                  </button>
                </div>

                {/* Lista de Vértices */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>Coordenadas de los Vértices del Polígono</span>
                    <button
                      type="button"
                      onClick={handleAddManualPoint}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir Vértice</span>
                    </button>
                  </div>

                  {baseZoneDraft.points.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-400 text-xs">
                      No hay puntos definidos. Haz clic en "✏️ Dibujar / Modificar en el Mapa" o pulsa "Cargar Casco Urbano Satipo".
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                      {baseZoneDraft.points.map((pt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-[11px] flex items-center justify-center flex-shrink-0">
                            #{idx + 1}
                          </span>

                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-1">
                              <span className="text-[10px] text-slate-500 font-bold">Lat:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={pt[0]}
                                key={`pt-${idx}-0-${pt[0]}`}
                                onBlur={(e) => handleUpdatePointCoord(idx, 0, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <span className="text-[10px] text-slate-500 font-bold">Lng:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={pt[1]}
                                key={`pt-${idx}-1-${pt[1]}`}
                                onBlur={(e) => handleUpdatePointCoord(idx, 1, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeletePoint(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer flex-shrink-0"
                            title="Eliminar este vértice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Guardar Cambios de Zona Base */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveBaseZoneConfig}
                    disabled={isSavingBaseZone}
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingBaseZone ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Guardar Cambios de Zona Base</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone: Reset Button */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>¿Deseas restaurar la configuración original?</span>
            <button
              onClick={handleResetToDefaults}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Todo por Defecto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminPanel = React.memo(AdminPanelComponent);

