/**
 * Corporate Brand Assets & Permanent Identity Store
 * مؤسسة صناع الموارد التجارية (Resource Makers Trading Est. - RMT)
 * 
 * CR: 2050167793 | VAT: 311552664400003 | Dammam, KSA
 * 
 * Embeds permanent base64/SVG assets for executive signatures, official seal,
 * and corporate brand identity.
 */

export const APP_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export const CORPORATE_IDENTITY = {
  companyNameAr: 'مؤسسة صناع الموارد التجارية',
  companyNameEn: 'Sanaa Al Muarad Trading Est. (RMT)',
  crNumber: '2050167793',
  vatNumber: '311552664400003',
  addressAr: 'المملكة العربية السعودية - الدمام - حي الأثير - شارع الملك سعود',
  addressEn: 'Dammam, Eastern Province, Kingdom of Saudi Arabia',
  phone: '+966 13 833 2200',
  email: 'info@rmt-sa.com',
  officialDomain: 'rmt-sa.com',
  website: 'https://rmt-sa.com',
  city: 'الدمام (Dammam)',
  postalCode: '32415',
};

// Permanent Executive Signatures (High-Contrast Clean Vector Data URLs)
export const DEFAULT_PREPARED_SIGNATURE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><path d="M20 55 C40 20, 60 70, 80 35 C95 10, 110 65, 130 40 C145 25, 160 55, 180 30 M120 45 L200 45" fill="none" stroke="%231e40af" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><text x="110" y="68" font-family="sans-serif" font-size="11" font-weight="bold" fill="%231e3a8a">M. Al-Brahim</text></svg>';

export const DEFAULT_REVIEWED_SIGNATURE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M25 60 C35 15, 65 20, 75 55 C85 80, 105 15, 125 45 C145 70, 165 20, 195 50 C210 30, 230 65, 245 40 M60 62 L225 58" fill="none" stroke="%23007A5A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="115" y="78" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23065f46">Eng. Mokhtar Yousef</text></svg>';

export const DEFAULT_APPROVED_SIGNATURE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90" width="280" height="90"><path d="M30 65 C50 10, 90 25, 110 60 C130 90, 150 15, 180 45 C200 65, 230 15, 260 55 M80 68 L250 62" fill="none" stroke="%231e3a8a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><text x="130" y="82" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23172554">Abdullah Al-Moaili</text></svg>';

// Official Corporate Circular Seal (ختم المؤسسة المعتمد)
export const DEFAULT_COMPANY_SEAL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220"><circle cx="110" cy="110" r="102" fill="none" stroke="%231e3a8a" stroke-width="3.5" stroke-dasharray="6,3"/><circle cx="110" cy="110" r="92" fill="none" stroke="%23007A5A" stroke-width="2.5"/><circle cx="110" cy="110" r="62" fill="none" stroke="%231e3a8a" stroke-width="1.5"/><path id="seal-top-path" d="M 30,110 A 80,80 0 0,1 190,110" fill="none"/><path id="seal-bot-path" d="M 190,110 A 80,80 0 0,1 30,110" fill="none"/><text font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="%231e3a8a" letter-spacing="1.5"><textPath href="%23seal-top-path" startOffset="50%" text-anchor="middle">مؤسسة صناع الموارد التجارية</textPath></text><text font-family="Arial, sans-serif" font-size="9.5" font-weight="bold" fill="%23007A5A" letter-spacing="1"><textPath href="%23seal-bot-path" startOffset="50%" text-anchor="middle">C.R: 2050167793 - VAT: 311552664400003</textPath></text><g transform="translate(110,110) scale(0.65) translate(-80,-60)"><path d="M 40,20 L 75,20 C 95,20 110,32 110,48 C 110,62 98,72 82,75 L 115,105 L 85,105 L 58,78 L 40,78 L 40,105 L 15,105 L 15,20 Z M 40,42 L 40,58 L 72,58 C 80,58 86,54 86,50 C 86,45 80,42 72,42 Z" fill="%2300A859"/><path d="M 85,20 L 110,20 L 132,65 L 155,20 L 180,20 L 180,105 L 155,105 L 155,50 L 138,85 L 125,85 L 108,50 L 108,105 L 85,105 Z" fill="%23174A84"/></g></svg>';

export const DEFAULT_CORPORATE_ASSETS: Record<string, string> = {
  rmt_sig_prepared: DEFAULT_PREPARED_SIGNATURE,
  rmt_sig_reviewed: DEFAULT_REVIEWED_SIGNATURE,
  rmt_sig_approved: DEFAULT_APPROVED_SIGNATURE,
  rmt_company_seal: DEFAULT_COMPANY_SEAL,
};

/**
 * Resolves a corporate asset key from localStorage or falls back immediately to hardcoded constant
 */
export function getCorporateAsset(key: keyof typeof DEFAULT_CORPORATE_ASSETS | string): string {
  try {
    const val = localStorage.getItem(key);
    if (val && val.trim() && val.startsWith('data:image/')) {
      return val;
    }
  } catch {}
  return DEFAULT_CORPORATE_ASSETS[key] || '';
}
