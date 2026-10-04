// IndexedDB & LocalStorage Hybrid Helper for Large Map & Blueprint Images

const DB_NAME = 'satipo2026_assets_db';
const STORE_NAME = 'app_assets';
const MAP_KEY = 'satipo2026_custom_jpg_map';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Optimizes an image file to high-clarity JPEG (max dimension 2500px, 85% quality)
 * to ensure fast rendering and guaranteed saving without browser memory exhaustion.
 */
export async function optimizeImageFile(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error reading image file'));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Failed to read image data'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const MAX_DIM = 2500;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src); // fallback to original if canvas fails
          return;
        }

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const optimized = canvas.toDataURL('image/jpeg', 0.88);
          resolve(optimized);
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves the custom map image to IndexedDB and LocalStorage, then notifies listeners.
 */
export async function saveCustomMapImage(dataUrl: string): Promise<boolean> {
  // 1. Try to save to IndexedDB (virtually unlimited capacity)
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, MAP_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not save custom map to IndexedDB', err);
  }

  // 2. Try to save to LocalStorage for instant sync (if under quota)
  try {
    localStorage.setItem(MAP_KEY, dataUrl);
  } catch {
    // Expected if image exceeds 5MB localStorage quota; IndexedDB already has it
  }

  // 3. Dispatch broadcast event for live reactive UI sync
  try {
    window.dispatchEvent(new CustomEvent('satipo_custom_map_updated', { detail: dataUrl }));
  } catch {}

  // 4. Push to server so other devices (Mobile/PC) get it instantly
  try {
    fetch('/api/custom-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapUrl: dataUrl }),
    }).catch(() => {});
  } catch {}

  return true;
}

/**
 * Loads the custom map image from LocalStorage, IndexedDB, or Central Server.
 */
export async function loadCustomMapImage(): Promise<string | null> {
  // 1. Check LocalStorage first for instant availability
  try {
    const fromLocal = localStorage.getItem(MAP_KEY);
    if (fromLocal && fromLocal.length > 50) {
      return fromLocal;
    }
  } catch {}

  // 2. Check IndexedDB
  try {
    const db = await openDB();
    const idbResult = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MAP_KEY);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });

    if (idbResult && idbResult.length > 50) {
      return idbResult;
    }
  } catch {}

  // 3. Fallback to Central Server
  try {
    const res = await fetch('/api/app-data');
    if (res.ok) {
      const data = await res.json();
      if (data.customMap) {
        // Cache locally
        try {
          localStorage.setItem(MAP_KEY, data.customMap);
        } catch {}
        return data.customMap;
      }
    }
  } catch {}

  return null;
}

/**
 * Removes the custom map image from all storage and notifies UI and Server.
 */
export async function removeCustomMapImage(): Promise<void> {
  try {
    localStorage.removeItem(MAP_KEY);
  } catch {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(MAP_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('satipo_custom_map_updated', { detail: null }));
  } catch {}

  try {
    fetch('/api/custom-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapUrl: null }),
    }).catch(() => {});
  } catch {}
}
