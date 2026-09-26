/**
 * Signature Storage and Image Formatting Utility
 * Handles persistent signature images with automatic transparency processing,
 * size normalization, and role-based signature binding.
 */

export interface PersonSignature {
  id: string;
  roleKey: string;
  personName: string;
  personTitle: string;
  signatureImage?: string; // Base64 Data URL
  isCustom?: boolean;
  department?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface SavedSignature extends PersonSignature {}

const STORAGE_KEY_PREFIX = 'rmt_signature_';
const REGISTRY_STORAGE_KEY = 'rmt_signatures_registry';

/**
 * Standard system default signature persons / roles
 */
export const DEFAULT_SIGNATURE_ROLES: PersonSignature[] = [
  {
    id: 'projects_manager',
    roleKey: 'projects_manager',
    personName: 'Eng. Mokhtar Yousef',
    personTitle: 'مدير عام المشاريع والمكتب الفني',
    department: 'إدارة المشاريع والهندسة',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'general_manager',
    roleKey: 'general_manager',
    personName: 'الإدارة العامة والمدير التنفيذي',
    personTitle: 'المدير التنفيذي / الإدارة العامة',
    department: 'الإدارة العليا',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'finance_accounts',
    roleKey: 'finance_accounts',
    personName: 'الإدارة المالية والمحاسبة',
    personTitle: 'Finance & Accounts Lead (الإدارة المالية والمحاسبة)',
    department: 'الشؤون المالية والمحاسبة',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'procurement_manager',
    roleKey: 'procurement_manager',
    personName: 'مدير إدارة المشتريات والتوريدات',
    personTitle: 'مسؤول المشتريات وسلاسل الإمداد',
    department: 'المشتريات واللوجستيات',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dispatcher',
    roleKey: 'dispatcher',
    personName: 'مسؤول التجهيز والتسليم الميداني',
    personTitle: 'أمين المستودع ومشرف سندات الاستلام',
    department: 'المستودعات والعمليات',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'client_acceptance',
    roleKey: 'client_acceptance',
    personName: 'ممثل واستشاري العميل المعتمد',
    personTitle: 'المفوض بالتوقيع والاستلام',
    department: 'طرف العميل / الاستشاري',
    isCustom: false,
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Clean white/off-white background from signature image using Canvas
 * Makes scanned pen signatures on paper appear cleanly transparent
 */
export async function processSignatureImage(
  dataUrl: string,
  options: {
    makeBackgroundTransparent?: boolean;
    convertToBlueInk?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    threshold?: number; // 0 - 255 brightness threshold for white paper removal
  } = {}
): Promise<string> {
  const {
    makeBackgroundTransparent = true,
    convertToBlueInk = true,
    maxWidth = 400,
    maxHeight = 160,
    threshold = 220,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate constrained dimensions with proper aspect ratio
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      if (makeBackgroundTransparent) {
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

            // If the pixel is near white/light grey, make it transparent
            if (brightness > threshold) {
              data[i + 3] = 0; // Alpha = 0
            } else {
              // Enhance ink contrast
              const alphaFactor = Math.min(255, (255 - brightness) * 1.5);
              data[i + 3] = Math.max(data[i + 3], alphaFactor);

              // Standardize to uniform high-resolution executive blue ink (#1e40af - RGB 30, 64, 175)
              if (convertToBlueInk) {
                // Preserve stroke depth/shading while shifting base hue to royal blue
                const darkness = 1 - (brightness / 255);
                data[i] = Math.round(25 + 10 * (1 - darkness)); // R ~ 25-35
                data[i + 1] = Math.round(55 + 20 * (1 - darkness)); // G ~ 55-75
                data[i + 2] = Math.round(160 + 50 * (1 - darkness)); // B ~ 160-210 (Vibrant Blue Ink)
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
        } catch {
          // If security or canvas read fails, fallback gracefully
        }
      }

      resolve(canvas.toDataURL('image/png', 0.95));
    };

    img.onerror = () => reject(new Error('Failed to load signature image'));
    img.src = dataUrl;
  });
}

export function sanitizeSignatureKey(key: string): string {
  if (!key) return 'default';
  return encodeURIComponent(key.trim().toLowerCase());
}

/**
 * Get saved signature by role or person name
 */
export function getSavedSignature(roleOrNameKey: string): string | null {
  if (!roleOrNameKey) return null;
  const sanitizedKey = sanitizeSignatureKey(roleOrNameKey);
  try {
    const directVal = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sanitizedKey}`);
    if (directVal) return directVal;
    // Fallback legacy ASCII replace
    const legacyKey = roleOrNameKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${legacyKey}`);
  } catch {
    return null;
  }
}

/**
 * Save signature to local registry
 */
export function saveSignature(
  roleOrNameKey: string,
  dataUrl: string,
  personName?: string,
  personTitle?: string
): void {
  if (!roleOrNameKey || !dataUrl) return;
  const sanitizedKey = sanitizeSignatureKey(roleOrNameKey);
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${sanitizedKey}`, dataUrl);

    // Update signature registry list
    const registry = getAllSignatures();
    const existingIndex = registry.findIndex((s) => s.roleKey === sanitizedKey || s.roleKey === roleOrNameKey);
    const item: SavedSignature = {
      id: sanitizedKey,
      roleKey: sanitizedKey,
      personName: personName || roleOrNameKey,
      personTitle: personTitle || '',
      signatureImage: dataUrl,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      registry[existingIndex] = item;
    } else {
      registry.push(item);
    }
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Failed to save signature to localStorage', e);
  }
}

/**
 * Remove saved signature
 */
export function removeSignature(roleOrNameKey: string): void {
  if (!roleOrNameKey) return;
  const sanitizedKey = sanitizeSignatureKey(roleOrNameKey);
  const legacyKey = roleOrNameKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sanitizedKey}`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${legacyKey}`);
    const registry = getAllSignatures().filter((s) => s.roleKey !== sanitizedKey && s.roleKey !== legacyKey);
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Failed to remove signature', e);
  }
}

/**
 * Get all registered signature persons (defaults combined with custom added persons)
 */
export function getAllPersonSignatures(): PersonSignature[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    const savedList: PersonSignature[] = raw ? JSON.parse(raw) : [];

    // Combine defaults with saved entries, preserving any customization
    const result: PersonSignature[] = DEFAULT_SIGNATURE_ROLES.map((defaultRole) => {
      const match = savedList.find((s) => s.id === defaultRole.id || s.roleKey === defaultRole.roleKey);
      const storedSig = getSavedSignature(defaultRole.roleKey);
      if (match) {
        return {
          ...defaultRole,
          ...match,
          signatureImage: match.signatureImage || storedSig || undefined,
        };
      }
      return {
        ...defaultRole,
        signatureImage: storedSig || undefined,
      };
    });

    // Append custom added persons
    savedList.forEach((saved) => {
      if (saved.isCustom && !result.some((r) => r.id === saved.id)) {
        const storedSig = getSavedSignature(saved.roleKey || saved.id);
        result.push({
          ...saved,
          signatureImage: saved.signatureImage || storedSig || undefined,
        });
      }
    });

    return result;
  } catch {
    return DEFAULT_SIGNATURE_ROLES;
  }
}

/**
 * Backwards compatible alias for getAllPersonSignatures
 */
export function getAllSignatures(): SavedSignature[] {
  return getAllPersonSignatures();
}

/**
 * Save or update a person signature record
 */
export function savePersonSignatureRecord(person: PersonSignature): void {
  try {
    const all = getAllPersonSignatures();
    const existingIndex = all.findIndex((p) => p.id === person.id);

    if (existingIndex >= 0) {
      all[existingIndex] = {
        ...all[existingIndex],
        ...person,
        updatedAt: new Date().toISOString(),
      };
    } else {
      all.push({
        ...person,
        createdAt: person.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Save individual signature image if provided
    if (person.signatureImage) {
      saveSignature(person.roleKey || person.id, person.signatureImage, person.personName, person.personTitle);
    }

    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save person signature record', e);
  }
}

/**
 * Delete a custom person signature record
 */
export function deletePersonSignatureRecord(personId: string): void {
  try {
    const all = getAllPersonSignatures();
    const target = all.find((p) => p.id === personId);
    if (target) {
      removeSignature(target.roleKey || target.id);
    }
    const remaining = all.filter((p) => p.id !== personId);
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.error('Failed to delete person signature record', e);
  }
}
