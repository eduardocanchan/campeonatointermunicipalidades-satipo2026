import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Edit2,
  ArrowUpDown
} from 'lucide-react';
import { Venue, UserLocation, ScheduleEvent, VenueCategory } from '../types';
import { calculateDistance, formatDistance, openExternalGoogleMaps, openExternalAppleMaps } from '../utils/geo';

interface VenueListProps {
  venues: Venue[];
  events: ScheduleEvent[];
  venueCategories: VenueCategory[];
  userLocation: UserLocation | null;
  onSelectVenueOnMap: (venue: Venue) => void;
  onTraceRoute: (venue: Venue) => void;
  onOpenAdmin: () => void;
  onEditVenue?: (venue: Venue) => void;
  isAdminMode?: boolean;
}

const CATEGORY_PRIORITY: Record<string, number> = {
  estadio: 1,
  coliseo: 2,
  complejo: 3,
  piscina: 4,
  plaza: 5,
  otro: 99,
};

type SortOption = 'category' | 'name' | 'distance';

interface VenueCardProps {
  venue: Venue;
  catInfo?: VenueCategory;
  distFormatted: string | null;
  onSelectVenueOnMap: (venue: Venue) => void;
  onTraceRoute: (venue: Venue) => void;
  onOpenAdmin: () => void;
  onEditVenue?: (venue: Venue) => void;
  isAdminMode: boolean;
}

const VenueCard: React.FC<VenueCardProps> = React.memo(({
  venue,
  catInfo,
  distFormatted,
  onSelectVenueOnMap,
  onTraceRoute,
  onOpenAdmin,
  onEditVenue,
  isAdminMode,
}) => {
  return (
    <div
      id={`card-venue-${venue.id}`}
      className="w-full bg-slate-900 border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between overflow-hidden min-w-0 [content-visibility:auto] [contain-intrinsic-size:0_260px]"
    >
      <div className="min-w-0">
        {/* Category Badge & Distance Header */}
        <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0 max-w-[60%]">
            <span>{catInfo?.icon || '📍'}</span>
            <span className="truncate">{catInfo?.name || venue.category}</span>
          </span>
          {distFormatted && (
            <span
              className="text-[11px] font-mono font-bold text-emerald-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800/90 flex items-center gap-1 shrink-0"
              title="Distancia en línea recta desde tu ubicación GPS"
            >
              <Navigation className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{distFormatted}</span>
            </span>
          )}
        </div>

        {/* Title & Address */}
        <h3 className="text-base sm:text-lg font-black text-slate-100 leading-snug mb-1 break-words">
          {venue.name}
        </h3>
        <p className="text-xs text-slate-400 flex items-start gap-1.5 mb-2 leading-relaxed break-words">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="min-w-0">{venue.address}</span>
        </p>

        {/* Description */}
        <p className="text-xs text-slate-300 mb-2.5 leading-relaxed break-words">
          {venue.description}
        </p>

        {/* Facilities / Sports Tags */}
        {venue.facilities && venue.facilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {venue.facilities.map((fac, idx) => (
              <span
                key={idx}
                className="text-[10px] sm:text-[11px] font-medium bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800/80 leading-normal"
              >
                {fac}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions Block framed for mobile */}
      <div className="space-y-2 pt-2 mt-auto border-t border-slate-800/80">
        <div className="grid grid-cols-2 gap-2">
          <button
            id={`btn-route-venue-${venue.id}`}
            onClick={() => onTraceRoute(venue)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition touch-manipulation min-h-[40px]"
          >
            <Navigation className="w-3.5 h-3.5 fill-white/20 shrink-0" />
            <span className="truncate">Cómo llegar</span>
          </button>

          <button
            id={`btn-map-venue-${venue.id}`}
            onClick={() => onSelectVenueOnMap(venue)}
            className="w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition touch-manipulation min-h-[40px]"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Ver en Mapa</span>
          </button>
        </div>

        {/* External Navigation GPS Link */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-500 font-medium">GPS externo:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openExternalGoogleMaps(venue.lat, venue.lng, venue.name)}
              className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 text-xs font-semibold py-0.5 px-1 cursor-pointer"
              title="Abrir en Google Maps"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => openExternalAppleMaps(venue.lat, venue.lng, venue.name)}
              className="text-slate-300 hover:text-white hover:underline flex items-center gap-1 text-xs font-semibold py-0.5 px-1 cursor-pointer"
              title="Abrir en Apple Maps"
            >
              <span>Apple Maps</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Admin Quick Edit Action */}
        {isAdminMode && (
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                if (onEditVenue) {
                  onEditVenue(venue);
                } else {
                  onOpenAdmin();
                }
              }}
              className="w-full py-2 px-3 bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Editar esta Sede (Administrador)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

VenueCard.displayName = 'VenueCard';

export const VenueList: React.FC<VenueListProps> = React.memo(({
  venues,
  events: _events,
  venueCategories,
  userLocation,
  onSelectVenueOnMap,
  onTraceRoute,
  onOpenAdmin,
  onEditVenue,
  isAdminMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('category');

  // Ordenar las categorías en un orden lógico oficial: Estadio -> Coliseo -> Complejo -> Piscina -> Plaza -> Otro
  const sortedVenueCategories = useMemo(() => {
    return [...(venueCategories || [])].sort((a, b) => {
      const prioA = CATEGORY_PRIORITY[a.id] ?? 50;
      const prioB = CATEGORY_PRIORITY[b.id] ?? 50;
      if (prioA !== prioB) return prioA - prioB;
      return (a.name || '').localeCompare(b.name || '', 'es');
    });
  }, [venueCategories]);

  // Diccionario O(1) para búsqueda rápida de categorías
  const categoryMap = useMemo(() => {
    const map = new Map<string, VenueCategory>();
    (venueCategories || []).forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    return map;
  }, [venueCategories]);

  const categories = useMemo(() => {
    return [
      { id: 'all', label: 'Todas las Sedes', icon: '✨', count: (venues || []).length },
      ...sortedVenueCategories.map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon || '📍',
        count: (venues || []).filter((v) => v.category === c.id).length,
      })),
    ];
  }, [venues, sortedVenueCategories]);

  // Memoizar el cálculo de distancias aproximadas (recalcula solo cuando cambia ubicación por más de ~11m)
  const distMap = useMemo(() => {
    if (!userLocation) return new Map<string, string>();
    const map = new Map<string, string>();
    const uLat = userLocation.lat;
    const uLng = userLocation.lng;
    for (const v of venues || []) {
      const d = calculateDistance(uLat, uLng, v.lat, v.lng);
      map.set(v.id, formatDistance(d));
    }
    return map;
  }, [
    venues,
    userLocation ? Number(userLocation.lat.toFixed(4)) : null,
    userLocation ? Number(userLocation.lng.toFixed(4)) : null,
  ]);

  // Filtrar y ordenar sedes con memoización eficiente
  const sortedVenues = useMemo(() => {
    const query = (searchTerm || '').trim().toLowerCase();

    const filtered = (venues || []).filter((venue) => {
      if (!venue) return false;
      const matchesCategory = selectedCategory === 'all' || venue.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!query) return true;

      const name = (venue.name || '').toLowerCase();
      const desc = (venue.description || '').toLowerCase();
      const addr = (venue.address || '').toLowerCase();
      const facilities = Array.isArray(venue.facilities) ? venue.facilities : [];

      return (
        name.includes(query) ||
        desc.includes(query) ||
        addr.includes(query) ||
        facilities.some((f) => typeof f === 'string' && f.toLowerCase().includes(query))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'distance' && userLocation) {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distA - distB;
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'es');
      }
      const prioA = CATEGORY_PRIORITY[a.category] ?? 50;
      const prioB = CATEGORY_PRIORITY[b.category] ?? 50;
      if (prioA !== prioB) return prioA - prioB;
      return (a.name || '').localeCompare(b.name || '', 'es');
    });
  }, [
    venues,
    searchTerm,
    selectedCategory,
    sortBy,
    sortBy === 'distance' && userLocation ? Number(userLocation.lat.toFixed(4)) : null,
    sortBy === 'distance' && userLocation ? Number(userLocation.lng.toFixed(4)) : null,
  ]);

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-4 pb-28 text-slate-100 space-y-3 sm:space-y-4">
      {/* Top Header & Search Panel */}
      <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                Guía de Sedes Oficiales
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-100 leading-tight">
              Escenarios Deportivos de Satipo 2026
            </h2>
          </div>
          {isAdminMode && (
            <button
              id="btn-admin-venues-shortcut"
              onClick={onOpenAdmin}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900/80 active:scale-95 text-xs font-bold text-amber-300 border border-amber-500/40 transition shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Administrar Sedes</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="search-venues-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar sede, disciplina o dirección..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-xs text-slate-400 hover:text-white rounded-full bg-slate-800"
              title="Borrar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Filtrar por tipo de recinto:
            </span>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
              >
                Ver todas ({venues.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`btn-category-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 touch-manipulation cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold ring-2 ring-emerald-400/40'
                      : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/90 border border-slate-700/60'
                  }`}
                >
                  <span className="text-sm leading-none">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-700 text-emerald-100'
                        : 'bg-slate-900/90 text-slate-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Controls Bar */}
        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider">Ordenar sedes por:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              id="sort-btn-category"
              onClick={() => setSortBy('category')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition touch-manipulation cursor-pointer flex items-center gap-1 ${
                sortBy === 'category'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Tipo de recinto</span>
            </button>
            <button
              id="sort-btn-name"
              onClick={() => setSortBy('name')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition touch-manipulation cursor-pointer flex items-center gap-1 ${
                sortBy === 'name'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Nombre A-Z</span>
            </button>
            {userLocation && (
              <button
                id="sort-btn-distance"
                onClick={() => setSortBy('distance')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition touch-manipulation cursor-pointer flex items-center gap-1 ${
                  sortBy === 'distance'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>Más cercanos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Venues Grid with Hardware Accelerated Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {sortedVenues.length === 0 ? (
          <div className="col-span-full text-center py-10 px-4 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
            <MapPin className="w-9 h-9 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">No se encontraron sedes con ese criterio.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="mt-3 text-xs text-emerald-400 underline font-semibold"
            >
              Restablecer filtros de búsqueda
            </button>
          </div>
        ) : (
          sortedVenues.map((venue) => {
            const catInfo = categoryMap.get(venue.category);
            const distFormatted = distMap.get(venue.id) || null;

            return (
              <VenueCard
                key={venue.id}
                venue={venue}
                catInfo={catInfo}
                distFormatted={distFormatted}
                onSelectVenueOnMap={onSelectVenueOnMap}
                onTraceRoute={onTraceRoute}
                onOpenAdmin={onOpenAdmin}
                onEditVenue={onEditVenue}
                isAdminMode={isAdminMode}
              />
            );
          })
        )}
      </div>
    </div>
  );
});

VenueList.displayName = 'VenueList';
