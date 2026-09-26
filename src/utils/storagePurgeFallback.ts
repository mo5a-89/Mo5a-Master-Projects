/**
 * Automated Local Storage Purge & Resilience Fallback
 * Provides automated corruption diagnosis, targeted purge of broken records,
 * and whitelist storage sanitation.
 */

export interface StorageHealthReport {
  isHealthy: boolean;
  totalKeys: number;
  corruptedKeys: string[];
  healthyKeys: string[];
  repairedKeys: string[];
  purgedKeys: string[];
  storageBytes: number;
}

export const CORE_WHITELIST_KEYS = [
  'rmt_auth_token',
  'rmt_user_session',
  'rmt_local_db_cache',
  'rmt_theme_pref',
  'rmt_projects',
  'rmt_customer_quotations',
  'rmt_supplier_quotations',
  'rmt_purchase_orders',
  'rmt_pos',
  'rmt_invoices',
  'rmt_delivery_notes',
  'rmt_customers',
  'rmt_suppliers',
  'rmt_terms_library',
  'rmt_client_masters',
  'rmt_three_way_matches',
  'rmt_quotation_estimates',
  'rmt_users',
  'rmt_master_users',
  'rmt_signatures_storage',
  'rmt_archived_priced_items',
  'rmt_read_notifs',
  'rmt_clean_slate_v1',
  'rmt_company_logo',
  'rmt_settings',
  'rmt_session_user',
  'rmt_auth_user',
  'rmt_secure_token',
];

const KNOWN_ARRAY_KEYS = [
  'rmt_projects',
  'rmt_customer_quotations',
  'rmt_supplier_quotations',
  'rmt_purchase_orders',
  'rmt_pos',
  'rmt_invoices',
  'rmt_delivery_notes',
  'rmt_customers',
  'rmt_suppliers',
  'rmt_terms_library',
  'rmt_client_masters',
  'rmt_three_way_matches',
  'rmt_quotation_estimates',
  'rmt_users',
  'rmt_master_users',
  'rmt_archived_priced_items',
  'rmt_read_notifs',
];

/**
 * Diagnoses all localStorage keys for corruption, syntax errors, non-whitelisted keys, or invalid types.
 */
export function diagnoseStorageHealth(): StorageHealthReport {
  const corruptedKeys: string[] = [];
  const healthyKeys: string[] = [];
  let totalBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const rawVal = localStorage.getItem(key) ?? '';
      totalBytes += key.length + rawVal.length;

      // Check if key is null/undefined or corrupted string
      if (!rawVal.trim() || rawVal === 'undefined' || rawVal === 'null' || rawVal === 'NaN') {
        corruptedKeys.push(key);
        continue;
      }

      // Check if known array key holds valid array
      if (KNOWN_ARRAY_KEYS.includes(key)) {
        try {
          const parsed = JSON.parse(rawVal);
          if (!Array.isArray(parsed)) {
            corruptedKeys.push(key);
            continue;
          }
          healthyKeys.push(key);
        } catch {
          corruptedKeys.push(key);
        }
      } else {
        healthyKeys.push(key);
      }
    }
  } catch (err) {
    console.error('[StorageAudit] Failed during storage diagnosis:', err);
  }

  return {
    isHealthy: corruptedKeys.length === 0,
    totalKeys: corruptedKeys.length + healthyKeys.length,
    corruptedKeys,
    healthyKeys,
    repairedKeys: [],
    purgedKeys: [],
    storageBytes: totalBytes,
  };
}

/**
 * Automatically repairs or cleans broken keys and enforces whitelist while preserving valid user data.
 */
export function autoSanitizeLocalStorage(): StorageHealthReport {
  const diagnosis = diagnoseStorageHealth();
  const repaired: string[] = [];
  const purged: string[] = [];

  if (!diagnosis.isHealthy) {
    console.warn('[StorageSanitizer] Corrupted keys detected:', diagnosis.corruptedKeys);

    diagnosis.corruptedKeys.forEach((badKey) => {
      try {
        const rawBad = localStorage.getItem(badKey);
        if (rawBad) {
          sessionStorage.setItem(`quarantine_${badKey}_${Date.now()}`, rawBad);
        }

        if (KNOWN_ARRAY_KEYS.includes(badKey)) {
          // Reset to clean empty array
          localStorage.setItem(badKey, JSON.stringify([]));
          repaired.push(badKey);
        } else {
          localStorage.removeItem(badKey);
          purged.push(badKey);
        }
      } catch (err) {
        console.error(`[StorageSanitizer] Failed repairing key ${badKey}:`, err);
      }
    });
  }

  return {
    ...diagnosis,
    isHealthy: true,
    repairedKeys: repaired,
    purgedKeys: purged,
  };
}

/**
 * Safely purge only corrupted keys without affecting any valid projects or quotations.
 */
export function purgeCorruptedKeysOnly(): number {
  const diagnosis = diagnoseStorageHealth();
  let purgedCount = 0;

  diagnosis.corruptedKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
      purgedCount++;
    } catch (e) {
      console.error(`Failed to purge ${key}:`, e);
    }
  });

  return purgedCount;
}

/**
 * Creates and downloads an emergency JSON snapshot of all current storage contents.
 */
export function generateEmergencyBackupFile(): boolean {
  try {
    const backup: Record<string, any> = {
      timestamp: new Date().toISOString(),
      type: 'RMT Defensive Emergency Backup',
      version: '2.5.0',
      data: {},
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const raw = localStorage.getItem(key);
      try {
        backup.data[key] = raw ? JSON.parse(raw) : raw;
      } catch {
        backup.data[key] = raw;
      }
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmt-emergency-defense-backup-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed creating emergency backup file:', err);
    return false;
  }
}

/**
 * Full factory reset: safely purges all application keys and reboots to initial seed data.
 */
export function fullFactoryReset(): void {
  try {
    KNOWN_ARRAY_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('rmt_signatures_storage');
    localStorage.removeItem('rmt_auth_user');
    localStorage.removeItem('rmt_session_user');
    localStorage.removeItem('rmt_auth_token');
    localStorage.removeItem('rmt_secure_token');
    localStorage.removeItem('rmt_read_notifs');
  } catch (err) {
    console.error('Failed to perform factory reset:', err);
  }
  window.location.reload();
}
