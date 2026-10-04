import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_VENUES, DEFAULT_SCHEDULE, DEFAULT_VENUE_CATEGORIES, DEFAULT_GUIDE_INFO, DEFAULT_BASE_ZONE } from './src/data/defaultData';

const app = express();
const PORT = 3000;

// High body limits so high-resolution custom map blueprints (JPG/PNG) can be uploaded and synced seamlessly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Data storage file path
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface UnifiedAppState {
  venues: any[];
  events: any[];
  venueCategories: any[];
  guideInfo: any;
  baseZone: any;
  customMap: string | null;
  lastUpdated: number;
  updatedBy?: string;
  version: number;
}

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

function remapEventVenues(events: any[]): any[] {
  return events.map((evt) => {
    if (evt && evt.venueId && VENUE_ID_REPLACEMENTS[evt.venueId]) {
      return { ...evt, venueId: VENUE_ID_REPLACEMENTS[evt.venueId] };
    }
    return evt;
  });
}

function filterDeletedVenues(list: any[]): any[] {
  return list
    .filter((v: any) => {
      if (!v || !v.id) return false;
      if (DELETED_VENUE_IDS.has(v.id)) return false;
      const nameNorm = (v.name || '').trim().toLowerCase();
      if (DELETED_VENUE_NAMES.has(nameNorm)) return false;
      return true;
    })
    .map((v: any) => {
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

// Initial memory state
let appState: UnifiedAppState = {
  venues: DEFAULT_VENUES,
  events: DEFAULT_SCHEDULE,
  venueCategories: DEFAULT_VENUE_CATEGORIES,
  guideInfo: DEFAULT_GUIDE_INFO,
  baseZone: DEFAULT_BASE_ZONE,
  customMap: null,
  lastUpdated: Date.now(),
  updatedBy: 'initial',
  version: 1,
};

// Load saved data from disk if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const diskVenues = Array.isArray(parsed.venues) && parsed.venues.length > 0 ? parsed.venues : [];
    const validDiskVenues = filterDeletedVenues(diskVenues);
    const diskIds = new Set(validDiskVenues.map((v: any) => v.id));
    const diskNames = new Set(validDiskVenues.map((v: any) => v.name?.trim().toLowerCase()));
    const missingVenues = DEFAULT_VENUES.filter(
      (def) => !diskIds.has(def.id) && !diskNames.has(def.name.trim().toLowerCase())
    );
    const finalVenues = filterDeletedVenues([...validDiskVenues, ...missingVenues]);

    appState = {
      venues: finalVenues.length > 0 ? finalVenues : DEFAULT_VENUES,
      events: remapEventVenues(Array.isArray(parsed.events) ? parsed.events : DEFAULT_SCHEDULE),
      venueCategories: Array.isArray(parsed.venueCategories) ? parsed.venueCategories : DEFAULT_VENUE_CATEGORIES,
      guideInfo: parsed.guideInfo || DEFAULT_GUIDE_INFO,
      baseZone: parsed.baseZone || DEFAULT_BASE_ZONE,
      customMap: parsed.customMap || null,
      lastUpdated: parsed.lastUpdated || Date.now(),
      updatedBy: parsed.updatedBy || 'disk-cache',
      version: (parsed.version || 1) + 1,
    };
    persistStateToDisk();
    console.log('[Satipo2026 Sync Server] Loaded app state from disk with', finalVenues.length, 'venues. Version:', appState.version);
  } else {
    // Write initial state to disk
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), 'utf-8');
    console.log('[Satipo2026 Sync Server] Initialized default app state file.');
  }
} catch (err) {
  console.error('[Satipo2026 Sync Server] Error reading state file:', err);
}

function persistStateToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Satipo2026 Sync Server] Error writing state file:', err);
  }
}

// Active Server-Sent Events (SSE) connections for live multi-device push
const sseClients = new Set<express.Response>();

function broadcastStateUpdate(sourceDevice = 'unknown') {
  const payload = JSON.stringify({
    type: 'APP_DATA_UPDATED',
    data: appState,
    sourceDevice,
    timestamp: Date.now(),
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// API Routes FIRST

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now(), clientsConnected: sseClients.size });
});

// 2. GET current unified state
app.get('/api/app-data', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState);
});

// Alias for sync
app.get('/api/sync', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState);
});

// Granular REST GET endpoints
app.get('/api/venues', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState.venues);
});

app.get('/api/events', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState.events);
});

app.get('/api/categories', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState.venueCategories);
});

app.get('/api/guide', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState.guideInfo);
});

app.get('/api/base-zone', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(appState.baseZone);
});

// 3. POST update unified state (from Phone or PC Admin)
app.post('/api/app-data', (req, res) => {
  try {
    const { venues, events, venueCategories, guideInfo, baseZone, customMap, updatedBy } = req.body;

    let hasChanges = false;

    if (Array.isArray(venues) && venues.length > 0) {
      appState.venues = filterDeletedVenues(venues);
      hasChanges = true;
    }
    if (Array.isArray(events)) {
      appState.events = remapEventVenues(events);
      hasChanges = true;
    }
    if (Array.isArray(venueCategories)) {
      appState.venueCategories = venueCategories;
      hasChanges = true;
    }
    if (guideInfo && typeof guideInfo === 'object') {
      appState.guideInfo = guideInfo;
      hasChanges = true;
    }
    if (baseZone && typeof baseZone === 'object') {
      appState.baseZone = baseZone;
      hasChanges = true;
    }
    if (customMap !== undefined) {
      appState.customMap = customMap;
      hasChanges = true;
    }

    if (hasChanges) {
      appState.version += 1;
      appState.lastUpdated = Date.now();
      appState.updatedBy = updatedBy || 'admin';
      persistStateToDisk();
      broadcastStateUpdate(appState.updatedBy);
    }

    res.json({
      success: true,
      version: appState.version,
      lastUpdated: appState.lastUpdated,
      updatedBy: appState.updatedBy,
    });
  } catch (err: any) {
    console.error('Error saving app-data:', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// 4. POST custom map image / blueprint specifically
app.post('/api/custom-map', (req, res) => {
  try {
    const { mapUrl, updatedBy } = req.body;
    appState.customMap = mapUrl || null;
    appState.version += 1;
    appState.lastUpdated = Date.now();
    appState.updatedBy = updatedBy || 'admin-map';
    persistStateToDisk();
    broadcastStateUpdate(appState.updatedBy);

    res.json({
      success: true,
      customMap: appState.customMap,
      version: appState.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 5. DELETE reset to factory defaults
app.post('/api/app-data/reset-defaults', (req, res) => {
  try {
    appState = {
      venues: DEFAULT_VENUES,
      events: DEFAULT_SCHEDULE,
      venueCategories: DEFAULT_VENUE_CATEGORIES,
      guideInfo: DEFAULT_GUIDE_INFO,
      baseZone: DEFAULT_BASE_ZONE,
      customMap: null,
      lastUpdated: Date.now(),
      updatedBy: 'reset-defaults',
      version: appState.version + 1,
    };
    persistStateToDisk();
    broadcastStateUpdate('reset-defaults');
    res.json({ success: true, message: 'Restablecido a valores predeterminados', state: appState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 6. SSE Stream for Live Realtime multi-device synchronization
app.get('/api/app-data/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send immediate initial sync
  const initialPayload = JSON.stringify({
    type: 'CONNECTED',
    data: appState,
    timestamp: Date.now(),
  });
  res.write(`data: ${initialPayload}\n\n`);

  sseClients.add(res);

  // Heartbeat every 25 seconds to keep connection open through proxies
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatInterval);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    sseClients.delete(res);
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Satipo2026] Servidor unificado ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
