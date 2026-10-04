import { Venue, RouteData, RouteInstruction } from '../types';

/**
 * Calculates straight line distance using Haversine formula in kilometers
 */
export function calculateDistance(
  lat1: number | string,
  lon1: number | string,
  lat2: number | string,
  lon2: number | string
): number {
  const nLat1 = typeof lat1 === 'number' ? lat1 : parseFloat(String(lat1));
  const nLon1 = typeof lon1 === 'number' ? lon1 : parseFloat(String(lon1));
  const nLat2 = typeof lat2 === 'number' ? lat2 : parseFloat(String(lat2));
  const nLon2 = typeof lon2 === 'number' ? lon2 : parseFloat(String(lon2));

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return 0;

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(nLat2 - nLat1);
  const dLon = deg2rad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(nLat1)) *
      Math.cos(deg2rad(nLat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Formats distance into readable km or meters
 */
export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Formats duration into minutes / hours
 */
export function formatDuration(durationMinutes: number): string {
  const rounded = Math.round(durationMinutes);
  if (rounded < 1) return 'Menos de 1 min';
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

// In-memory route cache to provide instant (0ms) routing on repeated requests
const routeCache = new Map<string, RouteData>();

/**
 * Fetches real terrestrial driving/walking route from OSRM or generates structured route with turn instructions
 */
export async function calculateRoute(
  startLat: number,
  startLng: number,
  destination: Venue
): Promise<RouteData> {
  const endLat = destination.lat;
  const endLng = destination.lng;

  // Key accurate to ~100m
  const cacheKey = `${startLat.toFixed(3)},${startLng.toFixed(3)}->${destination.id}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  // Try real OSRM (Open Source Routing Machine) API with fast 2.5s timeout
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // Coordinates in OSRM GeoJSON are [lng, lat], Leaflet polyline expects [lat, lng]
        const leafletCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const instructions: RouteInstruction[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((step: any) => {
            const maneuver = step.maneuver;
            let text = 'Avance por la vía';
            if (maneuver) {
              if (maneuver.type === 'depart') {
                text = `Inicie la marcha en dirección ${step.name ? `hacia ${step.name}` : 'al destino'}`;
              } else if (maneuver.type === 'arrive') {
                text = `Llegada a ${destination.name}`;
              } else if (maneuver.modifier) {
                const mod = maneuver.modifier;
                if (mod.includes('left')) text = `Gire a la izquierda en ${step.name || 'la siguiente esquina'}`;
                else if (mod.includes('right')) text = `Gire a la derecha en ${step.name || 'la siguiente esquina'}`;
                else if (mod.includes('straight')) text = `Continúe recto por ${step.name || 'la vía principal'}`;
                else text = `Gire en ${step.name || 'la intersección'}`;
              } else if (step.name) {
                text = `Avance por ${step.name}`;
              }
            }
            if (step.distance > 5) {
              instructions.push({
                text,
                distance: step.distance,
                modifier: maneuver?.modifier || 'straight',
              });
            }
          });
        }

        if (instructions.length === 0) {
          instructions.push(
            { text: `Inicie recorrido hacia ${destination.address || destination.name}`, distance: route.distance * 0.4 },
            { text: `Continúe por la arteria vial principal de Satipo`, distance: route.distance * 0.5 },
            { text: `Destino: ${destination.name} a la vista`, distance: route.distance * 0.1 }
          );
        }

        const result: RouteData = {
          coordinates: leafletCoords,
          distanceKm: route.distance / 1000,
          durationMin: Math.max(1, Math.round(route.duration / 60)),
          instructions,
          destinationVenue: destination,
        };

        routeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Network or OSRM timeout fallback
  }

  // Fallback realistic interpolation routing along Satipo grid
  const directDist = calculateDistance(startLat, startLng, endLat, endLng);
  // City driving multiplier ~1.25
  const roadDist = directDist * 1.25;
  const durationMin = Math.max(2, Math.round((roadDist / 25) * 60)); // ~25 km/h urban speed

  // Generate a multi-point path simulating street grid turns
  const midLat1 = startLat + (endLat - startLat) * 0.5;
  const midLng1 = startLng;
  const midLat2 = endLat;
  const midLng2 = startLng + (endLng - startLng) * 0.5;

  const fallbackCoords: [number, number][] = [
    [startLat, startLng],
    [midLat1, midLng1],
    [midLat1, (startLng + endLng) * 0.5],
    [midLat2, midLng2],
    [endLat, endLng],
  ];

  const fallbackInstructions: RouteInstruction[] = [
    {
      text: `Salga desde su ubicación actual en dirección a Jr. Manuel Prado / Centro de Satipo`,
      distance: (roadDist * 1000) * 0.25,
      modifier: 'straight',
    },
    {
      text: `Gire hacia la vía de acceso principal hacia ${destination.address || destination.name}`,
      distance: (roadDist * 1000) * 0.5,
      modifier: 'right',
    },
    {
      text: `Continúe recto hasta el acceso a ${destination.name}`,
      distance: (roadDist * 1000) * 0.25,
      modifier: 'straight',
    },
    {
      text: `Ha llegado a la sede: ${destination.name}`,
      distance: 0,
      modifier: 'arrive',
    },
  ];

  const fallbackResult: RouteData = {
    coordinates: fallbackCoords,
    distanceKm: roadDist,
    durationMin,
    instructions: fallbackInstructions,
    destinationVenue: destination,
  };

  routeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Opens Google Maps Navigation URL
 */
export function openExternalGoogleMaps(lat: number, lng: number, title: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens Apple Maps Navigation URL
 */
export function openExternalAppleMaps(lat: number, lng: number, title?: string) {
  const query = title ? `&q=${encodeURIComponent(title)}` : '';
  const url = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${query}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens Waze Navigation URL
 */
export function openExternalWaze(lat: number, lng: number) {
  const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Calculates initial bearing (heading) from point 1 to point 2 in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(deg2rad(lon2 - lon1)) * Math.cos(deg2rad(lat2));
  const x =
    Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
    Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(lon2 - lon1));
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180) / Math.PI;
  return (bearingDeg + 360) % 360;
}

/**
 * Returns cardinal / intercardinal compass direction
 */
export function getCompassDirection(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || isNaN(degrees)) return '';
  const val = Math.floor((degrees / 22.5) + 0.5);
  const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return arr[val % 16] || '';
}

/**
 * Formats speed from meters/sec or km/h
 */
export function formatSpeed(speedMps: number | null | undefined): string {
  if (speedMps === null || speedMps === undefined || isNaN(speedMps) || speedMps < 0.2) {
    return '0 km/h';
  }
  const kmh = speedMps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}
