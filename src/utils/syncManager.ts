// Client-Side Cloud Sync & Multi-Device Unification Engine
import { Venue, ScheduleEvent, VenueCategory, GuideInfo, BaseZoneConfig } from '../types';
import { saveCustomMapImage, loadCustomMapImage } from './mapStorage';

export interface UnifiedSyncPayload {
  venues?: Venue[];
  events?: ScheduleEvent[];
  venueCategories?: VenueCategory[];
  guideInfo?: GuideInfo;
  baseZone?: BaseZoneConfig;
  customMap?: string | null;
  updatedBy?: string;
  sourceDevice?: string;
  timestamp?: number;
  version?: number;
}

export interface SyncStatus {
  state: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: Date | null;
  lastUpdatedBy: string;
  connectedDevices: number;
  deviceType: 'Celular' | 'Computadora' | 'Tablet';
}

// Identify user device type
export function getDeviceType(): 'Celular' | 'Computadora' | 'Tablet' {
  if (typeof window === 'undefined') return 'Computadora';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    return 'Tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'Celular';
  }
  return 'Computadora';
}

let lastAppliedVersion = 0;
let lastAppliedTimestamp = 0;

let syncStatusListeners: ((status: SyncStatus) => void)[] = [];
let currentSyncStatus: SyncStatus = {
  state: 'syncing',
  lastSyncedAt: null,
  lastUpdatedBy: 'Iniciando',
  connectedDevices: 1,
  deviceType: getDeviceType(),
};

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  syncStatusListeners.push(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((l) => l !== listener);
  };
}

function notifyStatus(partial: Partial<SyncStatus>) {
  currentSyncStatus = { ...currentSyncStatus, ...partial };
  for (const listener of syncStatusListeners) {
    listener(currentSyncStatus);
  }
}

/**
 * Sends updated state to server to unify across Mobile and PC
 */
export async function pushUnifiedDataToServer(payload: UnifiedSyncPayload): Promise<boolean> {
  notifyStatus({ state: 'syncing' });
  const device = getDeviceType();

  try {
    const response = await fetch('/api/app-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        updatedBy: `${device} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.version) {
      lastAppliedVersion = Math.max(lastAppliedVersion, data.version);
    }
    notifyStatus({
      state: 'synced',
      lastSyncedAt: new Date(),
      lastUpdatedBy: data.updatedBy || `Este ${device}`,
    });
    return true;
  } catch (err) {
    console.warn('[SyncManager] Failed to push to server, saved locally:', err);
    notifyStatus({
      state: 'offline',
      lastSyncedAt: new Date(),
      lastUpdatedBy: `Local (${device})`,
    });
    return false;
  }
}

/**
 * Pushes custom map blueprint specifically
 */
export async function pushCustomMapToServer(mapUrl: string | null): Promise<boolean> {
  const device = getDeviceType();
  try {
    const response = await fetch('/api/custom-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapUrl,
        updatedBy: `Plano desde ${device} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches latest unified dataset from server
 */
export async function fetchUnifiedDataFromServer(): Promise<UnifiedSyncPayload | null> {
  try {
    const res = await fetch('/api/app-data', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('[SyncManager] Server fetch failed:', err);
    return null;
  }
}

/**
 * Sets up Live Server-Sent Events (SSE) connection to auto-update instantly
 * when changes occur on another mobile phone or PC
 */
export function initializeLiveMultiDeviceSync(
  onRemoteUpdate: (data: UnifiedSyncPayload) => void
): () => void {
  let eventSource: EventSource | null = null;
  let pollingInterval: any = null;
  let isUnmounted = false;

  const applyIncomingPayload = (payload: UnifiedSyncPayload, sourceLabel?: string) => {
    if (!payload || typeof payload !== 'object') return;
    const version = payload.version ?? (payload as any).lastUpdated ?? 0;
    const timestamp = payload.timestamp ?? (payload as any).lastUpdated ?? 0;

    // If we have already applied this version or timestamp, skip to avoid UI stutter and re-render loops
    if (version > 0 && version <= lastAppliedVersion && timestamp <= lastAppliedTimestamp) {
      return;
    }

    if (version > 0) {
      lastAppliedVersion = Math.max(lastAppliedVersion, version);
    }
    if (timestamp > 0) {
      lastAppliedTimestamp = Math.max(lastAppliedTimestamp, timestamp);
    }

    onRemoteUpdate(payload);

    // Update custom map storage if changed
    if (payload.customMap !== undefined && payload.customMap) {
      saveCustomMapImage(payload.customMap);
    }

    notifyStatus({
      state: 'synced',
      lastSyncedAt: new Date(),
      lastUpdatedBy: payload.updatedBy || sourceLabel || 'Servidor',
    });
  };

  // 1. Initial Sync from Server
  fetchUnifiedDataFromServer().then((remoteData) => {
    if (isUnmounted || !remoteData) return;
    applyIncomingPayload(remoteData, remoteData.updatedBy || 'Servidor');
  });

  // 2. Establish SSE Connection
  function connectSSE() {
    if (typeof EventSource === 'undefined') return;

    try {
      eventSource = new EventSource('/api/app-data/stream');

      eventSource.onopen = () => {
        notifyStatus({ state: 'synced' });
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'APP_DATA_UPDATED' || parsed.type === 'CONNECTED') {
            const payload: UnifiedSyncPayload = parsed.data;
            if (payload) {
              applyIncomingPayload(payload, parsed.sourceDevice);
            }
          }
        } catch {
          // Ignore parse error
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected, fallback gracefully to periodic polling
        eventSource?.close();
        eventSource = null;
        notifyStatus({ state: 'offline' });
        setTimeout(() => {
          if (!isUnmounted && !eventSource) {
            connectSSE();
          }
        }, 8000);
      };
    } catch {
      notifyStatus({ state: 'offline' });
    }
  }

  connectSSE();

  // 3. Fallback Polling (30s) only if SSE is not connected or window regains focus
  pollingInterval = setInterval(() => {
    if (document.visibilityState === 'visible' && !eventSource) {
      fetchUnifiedDataFromServer().then((remote) => {
        if (!isUnmounted && remote) {
          applyIncomingPayload(remote);
        }
      });
    }
  }, 30000);

  // Sync on window focus / visibility change
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchUnifiedDataFromServer().then((remote) => {
        if (!isUnmounted && remote) {
          applyIncomingPayload(remote);
        }
      });
    }
  };
  window.addEventListener('visibilitychange', handleVisibility);

  return () => {
    isUnmounted = true;
    eventSource?.close();
    clearInterval(pollingInterval);
    window.removeEventListener('visibilitychange', handleVisibility);
  };
}
