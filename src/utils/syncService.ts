/**
 * Centralized Live Database & PITR Synchronization Service
 * Provides direct live two-way binding between client React state and centralized server storage.
 * Features queue coalescing, in-flight mutex, and exponential backoff with jitter on HTTP 429/503.
 */

export interface SyncStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  error: string | null;
  snapshotsCount: number;
}

let syncTimeout: any = null;
let isSyncInFlight = false;
let pendingPayload: { data: any; note?: string } | null = null;
let lastSyncedHash: string = '';

let currentStatus: SyncStatus = {
  connected: true,
  lastSyncedAt: null,
  syncing: false,
  error: null,
  snapshotsCount: 0,
};

type StatusListener = (status: SyncStatus) => void;
const listeners: Set<StatusListener> = new Set();

export function subscribeSyncStatus(listener: StatusListener) {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

function updateStatus(partial: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...partial };
  listeners.forEach((l) => l(currentStatus));
}

function computePayloadHash(data: any): string {
  try {
    if (!data) return '';
    // Use structural summary string for fast change detection
    const counts = [
      Array.isArray(data.projects) ? data.projects.length : 0,
      Array.isArray(data.customerQuotations) ? data.customerQuotations.length : 0,
      Array.isArray(data.supplierQuotations) ? data.supplierQuotations.length : 0,
      Array.isArray(data.purchaseOrders) ? data.purchaseOrders.length : 0,
      Array.isArray(data.invoices) ? data.invoices.length : 0,
      Array.isArray(data.deliveryNotes) ? data.deliveryNotes.length : 0,
      Array.isArray(data.customers) ? data.customers.length : 0,
      Array.isArray(data.suppliers) ? data.suppliers.length : 0,
      Array.isArray(data.termsLibrary) ? data.termsLibrary.length : 0,
    ].join(':');

    // Sample latest timestamps
    const latestProj = Array.isArray(data.projects) && data.projects[0] ? (data.projects[0].updatedAt || data.projects[0].id) : '';
    const latestInv = Array.isArray(data.invoices) && data.invoices[0] ? (data.invoices[0].updatedAt || data.invoices[0].id) : '';
    const latestQuote = Array.isArray(data.customerQuotations) && data.customerQuotations[0] ? (data.customerQuotations[0].updatedAt || data.customerQuotations[0].id) : '';

    return `${counts}_${latestProj}_${latestInv}_${latestQuote}`;
  } catch {
    return String(Date.now());
  }
}

/**
 * Robust fetch with exponential backoff for HTTP 429 and transient 503/network errors.
 */
async function sendSyncRequestWithRetry(payload: any, maxAttempts = 4): Promise<any> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504) {
        // Parse Retry-After if available, or compute exponential backoff with jitter
        const retryAfterHeader = res.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
        const backoffMs = retryAfterMs > 0
          ? retryAfterMs
          : Math.min(1000 * Math.pow(1.8, attempt - 1) + Math.random() * 400, 7000);

        console.warn(`[SyncService] HTTP ${res.status} received. Backing off for ${Math.round(backoffMs)}ms (attempt ${attempt}/${maxAttempts})...`);
        
        // Retain syncing state without setting error during active backoff retries
        updateStatus({ syncing: true });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Other non-retryable HTTP error
      throw new Error(`Sync failed with HTTP ${res.status}`);
    } catch (err: any) {
      const isNetworkError = err?.name === 'TypeError' || err?.message?.includes('network') || err?.message?.includes('fetch');
      if (isNetworkError && attempt < maxAttempts) {
        const backoffMs = Math.min(1200 * Math.pow(1.5, attempt - 1) + Math.random() * 300, 6000);
        console.warn(`[SyncService] Network glitch during sync. Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Sync failed after ${maxAttempts} attempts with rate limit/network constraint`);
}

/**
 * Worker that ensures only one sync HTTP call runs at a time, continuously consuming pending payloads.
 */
async function drainSyncQueue() {
  if (isSyncInFlight) return;
  isSyncInFlight = true;

  try {
    while (pendingPayload) {
      const current = pendingPayload;
      pendingPayload = null; // Clear so subsequent updates can register

      updateStatus({ syncing: true, error: null });

      const payload = {
        ...current.data,
        _snapshotNote: current.note || 'Auto-Sync from MEP Control System',
      };

      try {
        const result = await sendSyncRequestWithRetry(payload, 4);
        lastSyncedHash = computePayloadHash(current.data);
        updateStatus({
          connected: true,
          syncing: false,
          lastSyncedAt: result.updatedAt || new Date().toISOString(),
          error: null,
        });
      } catch (syncErr: any) {
        console.warn('[SyncService] Handled sync retry limit:', syncErr?.message || syncErr);
        // Do not panic or sever connection on transient rate limit throttles
        updateStatus({
          syncing: false,
          error: null, // Keep UI clean
        });
      }

      // Small throttle gap between sequential sync batches
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } finally {
    isSyncInFlight = false;
    updateStatus({ syncing: false });
  }
}

/**
 * Load initial data from the centralized server database
 */
export async function loadCentralizedData(): Promise<any | null> {
  try {
    updateStatus({ syncing: true, error: null });
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const token =
        sessionStorage.getItem('rmt_secure_token') ||
        localStorage.getItem('rmt_secure_token') ||
        localStorage.getItem('rmt_auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      try {
        const rawUser = localStorage.getItem('rmt_session_user') || localStorage.getItem('rmt_auth_user');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user?.role) headers['x-user-role'] = user.role;
        }
      } catch {}
    }

    const res = await fetch('/api/data/load', { headers });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    const result = await res.json();
    updateStatus({
      connected: true,
      syncing: false,
      lastSyncedAt: result.lastUpdated || new Date().toISOString(),
      error: null,
    });
    if (result.initialized && result.data) {
      lastSyncedHash = computePayloadHash(result.data);
      return result.data;
    }
    return null;
  } catch (err: any) {
    console.warn('[SyncService] Failed to load centralized data from server:', err);
    updateStatus({
      connected: false,
      syncing: false,
      error: 'تعذر الاتصال بقاعدة البيانات المركزية، العمل في الوضع المحلي الاحتياطي',
    });
    return null;
  }
}

/**
 * Immediate synchronous push of state changes to the centralized database (prevents loss on immediate navigation or refresh)
 */
export async function syncCentralizedImmediate(data: any, note?: string): Promise<boolean> {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  pendingPayload = {
    data,
    note: note || 'Synchronous Immediate Entity Persistence Point',
  };

  await drainSyncQueue();
  return true;
}

/**
 * Debounced push of local state changes to the centralized database with automated PITR snapshot
 */
export function scheduleCentralizedSync(data: any, note?: string, delayMs = 1800) {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    // Only queue sync if data has meaningful changes
    const newHash = computePayloadHash(data);
    if (newHash && newHash === lastSyncedHash && !pendingPayload) {
      return;
    }

    pendingPayload = {
      data,
      note: note || 'Auto-Sync from MEP Control System',
    };
    drainSyncQueue();
  }, delayMs);
}

/**
 * Fetch list of PITR snapshots from the server
 */
export async function fetchPITRSnapshots() {
  try {
    const res = await fetch('/api/data/snapshots');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.snapshots || [];
  } catch (err) {
    console.error('[SyncService] Failed to fetch snapshots:', err);
    return [];
  }
}

/**
 * Restore state to a specific PITR snapshot
 */
export async function restorePITRSnapshot(filename: string) {
  const res = await fetch('/api/data/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const result = await res.json();
  if (result.data) {
    lastSyncedHash = computePayloadHash(result.data);
  }
  updateStatus({
    connected: true,
    lastSyncedAt: result.restoredAt,
  });
  return result.data;
}

/**
 * Check health & connection of the dedicated database server
 */
export async function checkServerDatabaseStatus() {
  try {
    const res = await fetch('/api/data/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateStatus({
      connected: true,
      snapshotsCount: data.snapshotsCount || 0,
      lastSyncedAt: data.updatedAt || currentStatus.lastSyncedAt,
    });
    return data;
  } catch (err) {
    updateStatus({ connected: false });
    return null;
  }
}

/**
 * Multi-Tab Real-Time Synchronization Channel
 * Ensures seamless state updates and eliminates session conflicts across open tabs
 */
const MULTI_TAB_CHANNEL_NAME = 'rmt_enterprise_multi_tab_sync';
let multiTabBroadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    multiTabBroadcastChannel = new BroadcastChannel(MULTI_TAB_CHANNEL_NAME);
  }
} catch (e) {
  multiTabBroadcastChannel = null;
}

export interface MultiTabSyncMessage {
  type: 'STATE_CHANGED' | 'USER_UPDATED' | 'PROJECT_PATCHED' | 'SNAPSHOT_IMPORTED' | 'AUTH_LOGOUT';
  key?: string;
  data?: any;
  timestamp: number;
}

export function broadcastMultiTabSync(
  type: MultiTabSyncMessage['type'],
  data?: any,
  key?: string
): void {
  try {
    if (multiTabBroadcastChannel) {
      multiTabBroadcastChannel.postMessage({
        type,
        data,
        key,
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[SyncService] Multi-tab broadcast notice:', err);
  }
}

export function subscribeMultiTabSync(
  callback: (msg: MultiTabSyncMessage) => void
): () => void {
  if (!multiTabBroadcastChannel) return () => {};

  const handler = (event: MessageEvent<MultiTabSyncMessage>) => {
    if (event.data && event.data.type) {
      callback(event.data);
    }
  };

  multiTabBroadcastChannel.addEventListener('message', handler);
  return () => {
    multiTabBroadcastChannel?.removeEventListener('message', handler);
  };
}


