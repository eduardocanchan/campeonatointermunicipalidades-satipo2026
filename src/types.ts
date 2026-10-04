export type SportCategory = 
  | 'futbol'
  | 'voley'
  | 'basquet'
  | 'futsal'
  | 'atletismo'
  | 'natacion'
  | 'protocolar'
  | 'cultural';

export interface VenueCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface Venue {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  facilities: string[];
  capacity?: string;
  photoUrl?: string;
  contactPhone?: string;
}

export type EventStatus = 'scheduled' | 'live' | 'finished';

export interface ScheduleEvent {
  id: string;
  day: 'day1' | 'day2';
  dateStr: string; // '18 de Septiembre 2026'
  time: string; // '08:30 AM'
  endTime?: string;
  title: string;
  discipline: string; // 'Fútbol Libre', 'Vóley Mixto', etc.
  category: string; // 'Varones', 'Damas', 'Máster', 'Libre', 'Institucional'
  venueId: string;
  delegationA?: string;
  delegationB?: string;
  status: EventStatus;
  score?: string;
  details: string;
  phase?: string; // 'Inauguración', 'Fase de Grupos', 'Semifinal', 'Gran Final', 'Premiación'
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null; // Direction in degrees (0-360)
  speed?: number | null; // Speed in m/s
  timestamp?: number;
  isSimulated?: boolean;
}

export interface RouteInstruction {
  text: string;
  distance: number; // in meters
  modifier?: string; // 'left', 'right', 'straight', etc.
}

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng]
  distanceKm: number;
  durationMin: number;
  instructions: RouteInstruction[];
  destinationVenue: Venue;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface GuideInfo {
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeDescription: string;
  eventDates: string;
  eventLocation: string;
  disciplines: string[];
  emergencyContacts: EmergencyContact[];
  recommendations: string[];
  additionalNotes?: string;
}

export interface BaseZoneConfig {
  enabled: boolean;
  message: string;
  title?: string;
  points: [number, number][]; // Array of [lat, lng]
  strokeColor?: string;
  fillColor?: string;
}

/**
 * Checks if a point [lat, lng] is inside a polygon using ray-casting algorithm
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  if (!vs || vs.length < 3) return false;
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
