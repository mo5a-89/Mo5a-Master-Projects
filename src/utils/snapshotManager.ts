/**
 * Automated Snapshot & Rollback Governance Protocol
 * Generates pre-execution state checkpoints before high-impact actions,
 * stores historical snapshots, and provides instant lossless rollbacks.
 */

import { syncCentralizedImmediate } from './syncService';

export interface StateCheckpoint {
  id: string;
  timestamp: string;
  reason: string;
  checksum: string;
  entityCounts: {
    projects: number;
    customerQuotations: number;
    supplierQuotations: number;
    purchaseOrders: number;
    invoices: number;
    deliveryNotes: number;
  };
  data: any;
}

const CHECKPOINTS_STORAGE_KEY = 'rmt_state_checkpoints';
const MAX_LOCAL_CHECKPOINTS = 12;

/**
 * Generate a quick structural checksum of state data
 */
function computeChecksum(data: any): string {
  try {
    const pLen = data.projects?.length || 0;
    const qLen = data.customerQuotations?.length || 0;
    const sqLen = data.supplierQuotations?.length || 0;
    const poLen = data.purchaseOrders?.length || 0;
    const invLen = data.invoices?.length || 0;
    const dLen = data.deliveryNotes?.length || 0;
    return `chk_${pLen}_${qLen}_${sqLen}_${poLen}_${invLen}_${dLen}_${Date.now()}`;
  } catch {
    return `chk_${Date.now()}`;
  }
}

/**
 * Load all recorded checkpoints from local storage
 */
export function getAllCheckpoints(): StateCheckpoint[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CHECKPOINTS_STORAGE_KEY) : null;
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[SnapshotManager] Failed reading checkpoints:', err);
    return [];
  }
}

/**
 * Get the most recent stable checkpoint
 */
export function getLatestCheckpoint(): StateCheckpoint | null {
  const all = getAllCheckpoints();
  return all.length > 0 ? all[0] : null;
}

/**
 * Create a new pre-execution snapshot checkpoint
 */
export function createCheckpoint(reason: string, stateData: any): StateCheckpoint | null {
  if (!stateData) return null;

  try {
    const clonedData = JSON.parse(JSON.stringify(stateData));
    const checkpoint: StateCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      reason,
      checksum: computeChecksum(stateData),
      entityCounts: {
        projects: clonedData.projects?.length || 0,
        customerQuotations: clonedData.customerQuotations?.length || 0,
        supplierQuotations: clonedData.supplierQuotations?.length || 0,
        purchaseOrders: clonedData.purchaseOrders?.length || 0,
        invoices: clonedData.invoices?.length || 0,
        deliveryNotes: clonedData.deliveryNotes?.length || 0,
      },
      data: clonedData,
    };

    const existing = getAllCheckpoints();
    const updated = [checkpoint, ...existing.slice(0, MAX_LOCAL_CHECKPOINTS - 1)];

    if (typeof localStorage !== 'undefined') localStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(updated));
    console.log(`🛡️ [SnapshotManager] Created checkpoint "${reason}" (${checkpoint.id})`);

    // Asynchronously push snapshot checkpoint to the server
    syncCentralizedImmediate(clonedData, `Automated Pre-Execution Checkpoint: ${reason}`).catch((e) =>
      console.warn('[SnapshotManager] Server backup sync notice:', e)
    );

    return checkpoint;
  } catch (err) {
    console.error('[SnapshotManager] Failed creating checkpoint:', err);
    return null;
  }
}

/**
 * Execute an operation safely wrapped with an automated pre-execution snapshot and auto-rollback on failure
 */
export async function withSafeExecutionSnapshot<T>(
  reason: string,
  currentState: any,
  operation: () => Promise<T> | T,
  onRollback?: (restoredState: any) => void
): Promise<{ success: boolean; result?: T; error?: any }> {
  // Step 1: Pre-Execution Checkpoint
  const checkpoint = createCheckpoint(reason, currentState);

  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    console.error(`🛡️ [SnapshotManager] Execution error in "${reason}". Triggering automated instant rollback...`, error);
    
    // Step 2: Automated Rollback to the snapshot checkpoint
    if (checkpoint && checkpoint.data) {
      if (onRollback) {
        onRollback(checkpoint.data);
      }
      applyStateToLocalStorage(checkpoint.data);
      console.log(`🛡️ [SnapshotManager] Successfully executed rollback to checkpoint "${checkpoint.id}"`);
    }

    return { success: false, error };
  }
}

/**
 * Safely applies snapshot data back to localStorage without corruption
 */
export function applyStateToLocalStorage(data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  const keyMap: Record<string, string> = {
    projects: 'rmt_projects',
    customerQuotations: 'rmt_customer_quotations',
    supplierQuotations: 'rmt_supplier_quotations',
    purchaseOrders: 'rmt_purchase_orders',
    invoices: 'rmt_invoices',
    deliveryNotes: 'rmt_delivery_notes',
    customers: 'rmt_customers',
    suppliers: 'rmt_suppliers',
    termsLibrary: 'rmt_terms_library',
  };

  try {
    Object.entries(keyMap).forEach(([propKey, storageKey]) => {
      if (data[propKey] !== undefined) {
        localStorage.setItem(storageKey, JSON.stringify(data[propKey]));
      }
    });
    return true;
  } catch (err) {
    console.error('[SnapshotManager] Failed applying snapshot to storage:', err);
    return false;
  }
}

/**
 * Restore specific checkpoint by ID
 */
export function restoreCheckpointById(checkpointId: string): any | null {
  const all = getAllCheckpoints();
  const target = all.find((cp) => cp.id === checkpointId);
  if (!target || !target.data) return null;

  applyStateToLocalStorage(target.data);
  return target.data;
}

/**
 * Export full system state into a persistent JSON snapshot string
 */
export function exportSystemSnapshot(currentState?: any): string {
  let exportData = currentState;

  if (!exportData && typeof localStorage !== 'undefined') {
    exportData = {
      projects: JSON.parse(localStorage.getItem('rmt_projects') || '[]'),
      customerQuotations: JSON.parse(localStorage.getItem('rmt_customer_quotations') || '[]'),
      supplierQuotations: JSON.parse(localStorage.getItem('rmt_supplier_quotations') || '[]'),
      purchaseOrders: JSON.parse(localStorage.getItem('rmt_purchase_orders') || '[]'),
      invoices: JSON.parse(localStorage.getItem('rmt_invoices') || '[]'),
      deliveryNotes: JSON.parse(localStorage.getItem('rmt_delivery_notes') || '[]'),
      customers: JSON.parse(localStorage.getItem('rmt_customers') || '[]'),
      suppliers: JSON.parse(localStorage.getItem('rmt_suppliers') || '[]'),
      termsLibrary: JSON.parse(localStorage.getItem('rmt_terms_library') || '[]'),
      clientMasters: JSON.parse(localStorage.getItem('rmt_client_masters') || '[]'),
    };
  }

  const payload = {
    app: 'RMT-ERP-Enterprise',
    version: '4.8.0',
    exportedAt: new Date().toISOString(),
    checksum: computeChecksum(exportData),
    data: exportData,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Download system snapshot as a physical JSON backup file
 */
export function downloadSnapshotAsFile(currentState?: any, fileName?: string): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const jsonStr = exportSystemSnapshot(currentState);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = fileName || `RMT_Enterprise_Snapshot_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[SnapshotManager] Failed downloading snapshot file:', err);
    return false;
  }
}

/**
 * Import and validate JSON snapshot, creating a safeguard checkpoint before applying
 */
export function importSystemSnapshot(
  jsonContent: string,
  currentState?: any
): { success: boolean; data?: any; error?: string } {
  try {
    if (!jsonContent || typeof jsonContent !== 'string') {
      return { success: false, error: 'الملف المدخل فارغ أو غير صالح' };
    }

    const parsed = JSON.parse(jsonContent);
    const incomingData = parsed.data || parsed;

    if (!incomingData || typeof incomingData !== 'object') {
      return { success: false, error: 'هيكل بيانات النسخة الاحتياطية غير متوافق' };
    }

    // Step 1: Pre-execution safeguard checkpoint of current state
    if (currentState) {
      createCheckpoint('Pre-Import Backup Checkpoint', currentState);
    }

    // Step 2: Apply to persistent localStorage
    const applied = applyStateToLocalStorage(incomingData);
    if (!applied) {
      return { success: false, error: 'فشل تطبيق البيانات إلى التخزين المحلي' };
    }

    // Step 3: Trigger centralized server sync
    syncCentralizedImmediate(incomingData, 'Manual Snapshot JSON Import').catch((e) =>
      console.warn('[SnapshotManager] Server sync notice on import:', e)
    );

    // Step 4: Dispatch window event for live reload across application
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rmt_snapshot_imported', { detail: incomingData }));
    }

    return { success: true, data: incomingData };
  } catch (err: any) {
    console.error('[SnapshotManager] Import snapshot error:', err);
    return { success: false, error: err.message || 'فشل قراءة ملف النسخة الاحتياطية' };
  }
}

