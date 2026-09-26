/**
 * Attachment Pipeline & Google Drive Storage Manager
 * 
 * Provides:
 * 1. Dedicated binary uploads to Google Drive ("RMT Project Attachments" folder)
 * 2. Attachment Categorization (FINANCIAL_INVOICE, PURCHASE_ORDER, TECHNICAL_DRAWING, DELIVERY_NOTE, SITE_PHOTO)
 * 3. Strict RBAC document masking (Site Engineers are barred from Financial Invoices and POs)
 * 4. Snapshot Payload Protection: Strips inline Base64 payloads > 50KB to keep JSON snapshots lean
 */

import { User, ProjectDocument } from '../types';
import { getGoogleDriveAccessToken } from './googleDriveSync';
import { uploadFileToDrive } from '../services/cloudDriveSync';

export type AttachmentCategory =
  | 'FINANCIAL_INVOICE'
  | 'PURCHASE_ORDER'
  | 'TECHNICAL_DRAWING'
  | 'DELIVERY_NOTE'
  | 'SITE_PHOTO'
  | 'BOQ'
  | 'DWG_CAD'
  | 'CONTRACT'
  | 'SUBMITTAL'
  | 'OTHER';

/**
 * Infer attachment category dynamically by file extension and file name.
 */
export function inferAttachmentCategory(fileName: string, mimeType?: string): AttachmentCategory {
  const name = (fileName || '').toUpperCase();
  const ext = name.split('.').pop() || '';

  // 1. BOQ: .xlsx, .xls, .csv or name containing "BOQ" / كميات / مقايسة
  if (['XLSX', 'XLS', 'CSV'].includes(ext) || name.includes('BOQ') || name.includes('كميات') || name.includes('مقايسة')) {
    return 'BOQ';
  }

  // 2. TECHNICAL_DRAWING: .dwg, .dxf or name containing DRAWING, DWG, DXF, PLAN, مخطط, رسم
  if (
    ['DWG', 'DXF'].includes(ext) ||
    name.includes('DRAWING') ||
    name.includes('DWG') ||
    name.includes('DXF') ||
    name.includes('PLAN') ||
    name.includes('مخطط') ||
    name.includes('رسم')
  ) {
    return 'TECHNICAL_DRAWING';
  }

  // 3. FINANCIAL_INVOICE: name containing INV, فاتورة, مستخلص, INVOICE
  if (name.includes('INV') || name.includes('فاتورة') || name.includes('INVOICE') || name.includes('مستخلص')) {
    return 'FINANCIAL_INVOICE';
  }

  // 4. SUBMITTAL: name containing SUBMITTAL, اعتماد, مواصفة, APPROVAL
  if (name.includes('SUBMITTAL') || name.includes('اعتماد') || name.includes('مواصفة') || name.includes('APPROVAL')) {
    return 'SUBMITTAL';
  }

  // 5. DELIVERY_NOTE: name containing DELIVERY, DN, تسليم, إدخال, GRN
  if (name.includes('DELIVERY') || name.includes('DN-') || name.includes('تسليم') || name.includes('إدخال') || name.includes('GRN')) {
    return 'DELIVERY_NOTE';
  }

  // 6. PURCHASE_ORDER: name containing PO, أمر شراء
  if (name.includes('PO-') || name.includes('PURCHASE') || name.includes('أمر شراء')) {
    return 'PURCHASE_ORDER';
  }

  // Default fallback
  return 'OTHER';
}

export interface UploadedAttachmentMetadata {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  driveUrl: string;
  driveFileId?: string;
  uploadDate: string;
  uploadedAt: string;
  category: AttachmentCategory | string;
  fileSize: string;
  fileType?: string;
  uploadedBy?: string;
  projectId?: string;
}

const ATTACHMENTS_FOLDER_NAME = 'RMT Project Attachments';
let cachedAttachmentsFolderId: string | null = null;

/**
 * Locate or create "RMT Project Attachments" folder in Google Drive
 */
export async function getOrCreateAttachmentsFolder(accessToken: string): Promise<string> {
  if (cachedAttachmentsFolderId) {
    return cachedAttachmentsFolderId;
  }

  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${ATTACHMENTS_FOLDER_NAME}' and trashed = false`
  );
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      cachedAttachmentsFolderId = searchData.files[0].id;
      return searchData.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: ATTACHMENTS_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Centralized repository for project attachments, site drawings, material delivery notes and invoices',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive Attachments folder: HTTP ${createRes.status}`);
  }

  const created = await createRes.json();
  cachedAttachmentsFolderId = created.id;
  return created.id;
}

/**
 * Upload an actual binary file directly to Google Drive
 * Returns only the lightweight metadata to store in MasterEnterpriseStore
 */
export async function uploadAttachmentToDrive(
  file: File | Blob,
  fileName: string,
  category: AttachmentCategory,
  projectId?: string,
  uploadedBy?: string
): Promise<UploadedAttachmentMetadata> {
  const token = await getGoogleDriveAccessToken();
  const timestamp = new Date().toISOString();
  const fileId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const readableSize = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : `${(file.size / 1024).toFixed(1)} KB`;

  const mimeType = file.type || 'application/octet-stream';
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'bin';

  if (!token) {
    try {
      const uploadRes = await uploadFileToDrive(file, fileName);
      return {
        id: uploadRes.fileId || fileId,
        name: fileName,
        fileName: uploadRes.fileName || fileName,
        mimeType,
        driveUrl: uploadRes.fileUrl,
        driveFileId: uploadRes.fileId,
        uploadDate: timestamp.split('T')[0],
        uploadedAt: timestamp,
        category,
        fileSize: readableSize,
        fileType: fileExt,
        uploadedBy,
        projectId,
      };
    } catch (e) {
      console.info('[AttachmentPipeline] Production drive upload fallback notice:', e);
      return {
        id: fileId,
        name: fileName,
        fileName,
        mimeType,
        driveUrl: '',
        uploadDate: timestamp.split('T')[0],
        uploadedAt: timestamp,
        category,
        fileSize: readableSize,
        fileType: fileExt,
        uploadedBy,
        projectId,
      };
    }
  }

  try {
    const folderId = await getOrCreateAttachmentsFolder(token);

    const metadata = {
      name: `${projectId ? `[${projectId}] ` : ''}${fileName}`,
      parents: [folderId],
      description: `RMT Attachment - Category: ${category} - Project: ${projectId || 'General'}`,
      mimeType,
    };

    const boundary = '-------rmt_attachment_upload_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();

    const multipartRequestBody = new Blob(
      [
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        `Content-Type: ${mimeType}\r\n\r\n`,
        fileBuffer,
        closeDelimiter,
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`Google Drive attachment upload failed: HTTP ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();

    // Set permission to reader for anyone with link
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
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
    } catch {
      // Non-blocking permission set
    }

    return {
      id: fileId,
      name: fileName,
      fileName,
      mimeType,
      driveUrl: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
      driveFileId: uploadData.id,
      uploadDate: timestamp.split('T')[0],
      uploadedAt: timestamp,
      category,
      fileSize: readableSize,
      fileType: fileExt,
      uploadedBy,
      projectId,
    };
  } catch (err) {
    console.warn('[AttachmentPipeline] Upload failed, creating offline metadata:', err);
    return {
      id: fileId,
      name: fileName,
      fileName,
      mimeType,
      driveUrl: '',
      uploadDate: timestamp.split('T')[0],
      uploadedAt: timestamp,
      category,
      fileSize: readableSize,
      fileType: fileExt,
      uploadedBy,
      projectId,
    };
  }
}

/**
 * Filter attachments strictly by RBAC role.
 * Site Engineers (role === 'engineer') MUST NOT see FINANCIAL_INVOICE or PURCHASE_ORDER.
 */
export function filterAttachmentsByRBAC<T extends { category?: string }>(
  attachments: T[],
  user: User | null
): T[] {
  if (!Array.isArray(attachments)) return [];
  if (!user) return attachments;

  // Site Engineers and restricted roles cannot view Financial Invoices & Purchase Orders
  if (user.role === 'engineer' || user.role === 'viewer') {
    return attachments.filter((att) => {
      const cat = (att.category || '').toUpperCase();
      const isRestrictedFinancial =
        cat === 'FINANCIAL_INVOICE' ||
        cat === 'PURCHASE_ORDER' ||
        cat === 'PURCHASE ORDERS' ||
        cat === 'INVOICES' ||
        cat === 'COMMERCIAL DOCUMENTS';
      return !isRestrictedFinancial;
    });
  }

  // Super Admin, PM, Procurement, Accountant have full access
  return attachments;
}

/**
 * Snapshot Payload Protection:
 * Recursively cleanses data objects to strip inline Base64 payloads > 50KB (51,200 bytes)
 * before saving to localStorage or Google Drive JSON backups.
 */
export function sanitizeSnapshotPayloadForStorage<T>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const MAX_BASE64_BYTES = 51200; // 50 KB

  function cleanValue(val: any): any {
    if (typeof val === 'string') {
      // Check if string is base64 DataURL or oversized binary string
      if (val.startsWith('data:') && val.length > MAX_BASE64_BYTES) {
        return '[PROTECTED_OFFLOADED_ATTACHMENT_TO_DRIVE]';
      }
      if (val.length > MAX_BASE64_BYTES * 2 && !val.includes(' ') && !val.includes('\n')) {
        return '[PROTECTED_OFFLOADED_ATTACHMENT_TO_DRIVE]';
      }
      return val;
    }

    if (Array.isArray(val)) {
      return val.map((item) => cleanValue(item));
    }

    if (val !== null && typeof val === 'object') {
      const cleanedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        // Strip heavy inline base64 fields specifically
        if (
          (k === 'attachmentData' ||
            k === 'attachedDocData' ||
            k === 'advancePaymentAttachmentData' ||
            k === 'contentData' ||
            k === 'dataUrl') &&
          typeof v === 'string' &&
          v.length > MAX_BASE64_BYTES
        ) {
          cleanedObj[k] = '[OFFLOADED_TO_DRIVE]';
        } else {
          cleanedObj[k] = cleanValue(v);
        }
      }
      return cleanedObj;
    }

    return val;
  }

  return cleanValue(data);
}

export const sanitizeSnapshotPayload = sanitizeSnapshotPayloadForStorage;
