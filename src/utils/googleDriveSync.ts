/**
 * Google Drive Cloud Storage & Continuous Data Retention Service
 * Integrates with 1P Google Workspace Drive API (via Firebase Auth)
 * Scopes: https://www.googleapis.com/auth/drive.file
 * Strictly follows workspace-integration skill: In-memory token management,
 * automated folder creation, snapshot persistence, and document archiving.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeSnapshotPayloadForStorage } from './attachmentPipeline';

// Initialize Firebase App singleton safely
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const provider = new GoogleAuthProvider();
// Required Google Drive Workspace scope
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory token cache (NEVER stored in localStorage or sessionStorage per skill security constraints)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: FirebaseUser | null = null;
let isSigningIn = false;

export interface GoogleDriveSyncStatus {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  lastBackupAt: string | null;
  isSyncing: boolean;
  error: string | null;
  backupFolderId: string | null;
}

let driveStatus: GoogleDriveSyncStatus = {
  isConnected: false,
  userEmail: null,
  userName: null,
  lastBackupAt: null,
  isSyncing: false,
  error: null,
  backupFolderId: null,
};

type DriveStatusListener = (status: GoogleDriveSyncStatus) => void;
const listeners: Set<DriveStatusListener> = new Set();

export function subscribeGoogleDriveStatus(listener: DriveStatusListener) {
  listeners.add(listener);
  listener(driveStatus);
  return () => {
    listeners.delete(listener);
  };
}

function updateDriveStatus(partial: Partial<GoogleDriveSyncStatus>) {
  driveStatus = { ...driveStatus, ...partial };
  listeners.forEach((l) => l(driveStatus));
}

/**
 * Initialize Google Auth listener on application load
 */
export function initGoogleDriveAuth(
  onSuccess?: (user: FirebaseUser, token: string) => void,
  onFailure?: () => void
) {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        updateDriveStatus({
          isConnected: true,
          userEmail: user.email || null,
          userName: user.displayName || null,
        });
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is authenticated in Firebase Auth; token will be obtained upon active interaction
        updateDriveStatus({
          isConnected: false,
          userEmail: user.email || null,
          userName: user.displayName || null,
        });
        if (onFailure) onFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedGoogleUser = null;
      updateDriveStatus({
        isConnected: false,
        userEmail: null,
        userName: null,
        lastBackupAt: null,
      });
      if (onFailure) onFailure();
    }
  });
}

/**
 * Interactive Sign-in with Google to obtain Google Drive access token
 */
export async function signInWithGoogleDrive(): Promise<{ user: FirebaseUser; accessToken: string } | null> {
  try {
    isSigningIn = true;
    updateDriveStatus({ isSyncing: true, error: null });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('لم يتم استلام تصريح وصول Google Drive من الحساب المختار');
    }

    cachedAccessToken = token;
    cachedGoogleUser = result.user;

    updateDriveStatus({
      isConnected: true,
      userEmail: result.user.email || null,
      userName: result.user.displayName || null,
      isSyncing: false,
      error: null,
    });

    return { user: result.user, accessToken: token };
  } catch (err: any) {
    const isCancelled =
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request' ||
      err?.code === 'auth/user-cancelled' ||
      err?.message?.includes('popup-closed-by-user') ||
      err?.message?.includes('cancelled-popup-request') ||
      err?.message?.includes('user-cancelled');

    if (isCancelled) {
      // User closed the popup or cancelled the sign-in prompt - this is standard user action, not a system failure
      updateDriveStatus({
        isConnected: false,
        isSyncing: false,
        error: null,
      });
      return null;
    }

    let friendlyMessage = err?.message || 'فشل الاتصال بحساب Google Drive';
    if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
      friendlyMessage = 'تم حظر النافذة المنبثقة بواسطة المتصفح. يرجى السماح بالنوافذ المنبثقة للموقع لإتمام تسجيل الدخول.';
    } else if (err?.code === 'auth/network-request-failed' || err?.message?.includes('network-request-failed')) {
      friendlyMessage = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    }

    console.warn('[GoogleDrive] Sign-in notice:', friendlyMessage);
    updateDriveStatus({
      isConnected: false,
      isSyncing: false,
      error: friendlyMessage,
    });
    return null;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Disconnect / Sign out from Google Drive
 */
export async function signOutGoogleDrive() {
  try {
    await auth.signOut();
    cachedAccessToken = null;
    cachedGoogleUser = null;
    updateDriveStatus({
      isConnected: false,
      userEmail: null,
      userName: null,
      lastBackupAt: null,
      isSyncing: false,
      error: null,
    });
  } catch (err) {
    console.error('[GoogleDrive] Sign out error:', err);
  }
}

/**
 * Get the current in-memory access token
 */
export async function getGoogleDriveAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

/**
 * Locate or create dedicated folder in user's personal Google Drive
 */
export async function getOrCreateRMTBackupFolder(accessToken: string): Promise<string> {
  if (driveStatus.backupFolderId) {
    return driveStatus.backupFolderId;
  }

  const folderName = 'RMT Contracting & MEP System Backups';

  // 1. Search for existing folder
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error(`Google Drive API search failed: HTTP ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const folderId = searchData.files[0].id;
    updateDriveStatus({ backupFolderId: folderId });
    return folderId;
  }

  // 2. Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated live backups and persistent data retention for Trade Resource Makers Est. Contracting System',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive backup folder: HTTP ${createRes.status}`);
  }

  const createData = await createRes.json();
  updateDriveStatus({ backupFolderId: createData.id });
  return createData.id;
}

/**
 * Backup full application state directly to Google Drive
 */
export async function saveStateToGoogleDrive(
  statePayload: any,
  customNote?: string
): Promise<{ success: boolean; fileId: string; backupTime: string }> {
  const token = await getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('Google Drive غير متصل. يرجى تسجيل الدخول بحساب Google أولاً.');
  }

  updateDriveStatus({ isSyncing: true, error: null });

  try {
    const folderId = await getOrCreateRMTBackupFolder(token);
    const timestamp = new Date().toISOString();
    const safeTime = timestamp.replace(/[:.]/g, '-');
    const fileName = `RMT_Database_Snapshot_${safeTime}.json`;

    const metadata = {
      name: fileName,
      parents: [folderId],
      description: customNote || 'Automated data retention snapshot containing all supplier pricing, quotes, and contracting records',
      mimeType: 'application/json',
    };

    const sanitizedPayload = sanitizeSnapshotPayloadForStorage(statePayload);

    const fullContent = {
      appVersion: '5.0.0-PROD-LOCK',
      exportedAt: timestamp,
      company: 'شركة صناع الموارد التجاريه - Resource Makers Trading (RMT)',
      companyIdentity: {
        officialArabicName: "شركة صناع الموارد التجاريه",
        officialEnglishName: "RMT - Resource Makers Trading Est.",
        crNumber: "2050167793",
        vatNumber: "311552664400003",
        bankName: "Al Rajhi Bank (مصرف الراجحي)",
        iban: "SA7180000450608010001399",
        autoSealAndSignature: true,
        logoUrl: typeof localStorage !== 'undefined' ? localStorage.getItem('rmt_company_logo') || "" : "",
      },
      financialPolicies: {
        defaultVatRate: 15,
        overheadPercentage: 10,
        profitMarginPercentage: 15,
        retentionRate: 5,
      },
      autoNumbering: {
        projectPrefix: "PRJ-",
        quotationPrefix: "CQ-",
        invoicePrefix: "INV-",
        purchaseOrderPrefix: "PO-",
        deliveryNotePrefix: "DN-",
        sequenceDigits: 4,
      },
      menuCustomization: {
        projectsLabel: "المشاريع والعمليات",
        quotationsLabel: "عروض الأسعار والتسعير",
        procurementLabel: "المشتريات والتوريد",
        financeLabel: "المالية والفواتير",
        siteExecutionLabel: "التنفيذ والمتابعة الميدانية",
      },
      note: customNote || 'Automated Google Drive Backup Snapshot',
      data: sanitizedPayload,
    };

    // Multipart upload to Google Drive v3
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fullContent, null, 2) +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`Google Drive upload failed with HTTP ${res.status}`);
    }

    const uploaded = await res.json();

    // 3. Ensure Shared Read Permission for Active Snapshots across devices
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permErr) {
      console.warn('[GoogleDrive] Setting snapshot read permission notice:', permErr);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rmt_latest_drive_snapshot_id', uploaded.id);
      localStorage.setItem('rmt_latest_drive_snapshot_time', timestamp);
    }

    updateDriveStatus({
      isSyncing: false,
      lastBackupAt: timestamp,
      error: null,
    });

    return {
      success: true,
      fileId: uploaded.id,
      backupTime: timestamp,
    };
  } catch (err: any) {
    console.error('[GoogleDrive] Backup failed:', err);
    updateDriveStatus({
      isSyncing: false,
      error: err?.message || 'فشل حفظ النسخة الاحتياطية في Google Drive',
    });
    throw err;
  }
}

/**
 * Fetch the latest snapshot directly from Google Drive
 */
export async function fetchLatestDriveSnapshot(
  accessToken?: string
): Promise<{ data: any; fileId: string; fileName: string; exportedAt: string } | null> {
  const token = accessToken || (await getGoogleDriveAccessToken());
  if (!token) return null;

  try {
    const folderId = await getOrCreateRMTBackupFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType = 'application/json'`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,createdTime,size,description)&pageSize=5`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) return null;
    const json = await res.json();
    const files = json.files || [];
    if (files.length === 0) return null;

    const latestFile = files[0];
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!downloadRes.ok) return null;
    const snapshotJson = await downloadRes.json();
    const payload = snapshotJson.data || snapshotJson;

    return {
      data: payload,
      fileId: latestFile.id,
      fileName: latestFile.name,
      exportedAt: snapshotJson.exportedAt || latestFile.createdTime,
    };
  } catch (err) {
    console.warn('[GoogleDrive] fetchLatestDriveSnapshot notice:', err);
    return null;
  }
}

/**
 * Automated Bootstrap Hydration: Fetches latest snapshot on startup
 */
export async function autoBootstrapDriveHydration(): Promise<{
  hydrated: boolean;
  data: any | null;
  fileId?: string;
  exportedAt?: string;
}> {
  try {
    const token = await getGoogleDriveAccessToken();
    if (!token) {
      return { hydrated: false, data: null };
    }

    const latest = await fetchLatestDriveSnapshot(token);
    if (latest && latest.data) {
      return {
        hydrated: true,
        data: latest.data,
        fileId: latest.fileId,
        exportedAt: latest.exportedAt,
      };
    }
    return { hydrated: false, data: null };
  } catch (err) {
    console.warn('[GoogleDrive] Auto bootstrap hydration notice:', err);
    return { hydrated: false, data: null };
  }
}

// Debounced Background Auto-Sync Engine
let driveAutoSyncTimer: any = null;
let isDriveAutoSyncInFlight = false;
let pendingDriveAutoPayload: { payload: any; note?: string } | null = null;
let lastDriveAutoSyncHash = '';

/**
 * Debounced background save to Google Drive without interrupting user actions
 */
export function scheduleGoogleDriveAutoSync(statePayload: any, note?: string, delayMs = 2500) {
  if (typeof window === 'undefined') return;

  if (driveAutoSyncTimer) {
    clearTimeout(driveAutoSyncTimer);
  }

  pendingDriveAutoPayload = {
    payload: statePayload,
    note: note || 'مزامنة سحابية تلقائية فورية (Continuous Retention)',
  };

  driveAutoSyncTimer = setTimeout(async () => {
    if (!cachedAccessToken) {
      return;
    }
    if (isDriveAutoSyncInFlight) {
      return;
    }

    try {
      isDriveAutoSyncInFlight = true;
      const current = pendingDriveAutoPayload;
      pendingDriveAutoPayload = null;
      if (!current || !current.payload) return;

      const hash = JSON.stringify({
        prjs: current.payload.projects?.length || 0,
        quotes: current.payload.customerQuotations?.length || 0,
        pos: current.payload.purchaseOrders?.length || 0,
        invs: current.payload.invoices?.length || 0,
        dns: current.payload.deliveryNotes?.length || 0,
      });

      if (hash === lastDriveAutoSyncHash) {
        return;
      }

      await saveStateToGoogleDrive(current.payload, current.note);
      lastDriveAutoSyncHash = hash;
      console.info('☁️ [GoogleDrive AutoSync] Background cloud snapshot persisted successfully.');
    } catch (err) {
      console.warn('☁️ [GoogleDrive AutoSync] Background sync notice:', err);
    } finally {
      isDriveAutoSyncInFlight = false;
    }
  }, delayMs);
}

/**
 * List available backups in Google Drive folder
 */
export async function listGoogleDriveBackups(): Promise<Array<{ id: string; name: string; createdTime: string; size: string }>> {
  const token = await getGoogleDriveAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateRMTBackupFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType = 'application/json'`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('[GoogleDrive] List backups error:', err);
    return [];
  }
}

/**
 * Restore state from a specific Google Drive backup file
 */
export async function loadStateFromGoogleDrive(fileId: string): Promise<any> {
  const token = await getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('Google Drive غير متصل');
  }

  updateDriveStatus({ isSyncing: true });
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to download backup: HTTP ${res.status}`);
    }

    const json = await res.json();
    updateDriveStatus({ isSyncing: false });
    return json.data || json;
  } catch (err: any) {
    updateDriveStatus({ isSyncing: false, error: err?.message || 'تعذر استعادة البيانات من Google Drive' });
    throw err;
  }
}
