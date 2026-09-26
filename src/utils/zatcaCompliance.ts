/**
 * ZATCA (Zakat, Tax and Customs Authority - KSA) Compliance & Validation Engine
 * 
 * Enforces:
 * 1. 15-Digit VAT Number Standard (Must start with '3' and end with '3', exactly 15 digits).
 * 2. TLV (Tag-Length-Value) Base64 Encoded QR Code Generation for e-Invoicing & Progress Billing.
 */

export interface ZatcaValidationResult {
  isValid: boolean;
  error?: string;
  formattedVat?: string;
}

/**
 * Validates a Saudi ZATCA VAT / Tax Identification Number
 * Rules:
 * - Exactly 15 digits
 * - Starts with '3'
 * - Ends with '3'
 * - Digits only
 */
export function validateZatcaVatNumber(vatNumber?: string | null): ZatcaValidationResult {
  if (!vatNumber || typeof vatNumber !== 'string') {
    return {
      isValid: false,
      error: 'الرقم الضريبي مطلوب ويجب ألا يكون فارغاً.',
    };
  }

  const clean = vatNumber.replace(/\D/g, '');

  if (clean.length !== 15) {
    return {
      isValid: false,
      error: `الرقم الضريبي يجب أن يتكون من 15 رقماً بالضبط (الحالي: ${clean.length} رقم).`,
    };
  }

  if (!clean.startsWith('3')) {
    return {
      isValid: false,
      error: 'الرقم الضريبي النظامي في المملكة يجب أن يبدأ بالرقم 3.',
    };
  }

  if (!clean.endsWith('3')) {
    return {
      isValid: false,
      error: 'الرقم الضريبي النظامي في المملكة يجب أن ينتهي بالرقم 3.',
    };
  }

  return {
    isValid: true,
    formattedVat: clean,
  };
}

export interface ZatcaQrParams {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601 or YYYY-MM-DDTHH:mm:ssZ
  totalWithVat: number | string;
  vatAmount: number | string;
}

/**
 * Generates ZATCA Standard TLV (Tag-Length-Value) Byte Buffer and returns Base64 string
 * Tag 1: Seller's Name
 * Tag 2: VAT Registration Number
 * Tag 3: Time Stamp (ISO 8601)
 * Tag 4: Invoice Total (with VAT)
 * Tag 5: VAT Total
 */
export function generateZatcaTlvBase64(params: ZatcaQrParams): string {
  try {
    const encoder = new TextEncoder();

    const tlvTags: { tag: number; value: string }[] = [
      { tag: 1, value: params.sellerName || 'شركة صناع الموارد التجاريه' },
      { tag: 2, value: params.vatNumber || '311552664400003' },
      { tag: 3, value: params.timestamp || new Date().toISOString() },
      { tag: 4, value: Number(params.totalWithVat || 0).toFixed(2) },
      { tag: 5, value: Number(params.vatAmount || 0).toFixed(2) },
    ];

    const byteChunks: Uint8Array[] = [];

    for (const item of tlvTags) {
      const valBytes = encoder.encode(item.value);
      const header = new Uint8Array([item.tag, valBytes.length]);
      byteChunks.push(header);
      byteChunks.push(valBytes);
    }

    const totalLength = byteChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const fullBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of byteChunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert Uint8Array to Binary String for btoa
    let binary = '';
    const len = fullBuffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(fullBuffer[i]);
    }

    return btoa(binary);
  } catch (err) {
    console.error('[ZATCA Engine] Failed to encode TLV Base64 QR code:', err);
    return '';
  }
}
