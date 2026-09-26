import React from 'react';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

interface CompanyLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'geometric' | 'original';
}

/**
 * Authentic Resource Makers Trading Est. (RMT) Logo
 * - 'geometric': Exact sharp angular ribbon monogram (RM) matching corporate reference image.
 * - 'original': Clean high-contrast typographic badge.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = 'h-12 w-auto',
  size,
  variant = 'geometric',
}) => {
  const [customLogo, setCustomLogo] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem('rmt_company_logo');
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    const handleLogoUpdate = () => {
      try {
        setCustomLogo(localStorage.getItem('rmt_company_logo'));
      } catch {}
    };
    window.addEventListener('rmt_logo_updated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);
    return () => {
      window.removeEventListener('rmt_logo_updated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, []);

  if (customLogo) {
    return (
      <img
        src={customLogo}
        alt="Company Logo"
        className={`object-contain ${className}`}
        style={size ? { maxHeight: size, maxWidth: size } : undefined}
      />
    );
  }

  if (variant === 'original') {
    return (
      <div
        className={`inline-flex items-center tracking-tight font-black select-none font-sans ${className}`}
        style={size ? { fontSize: size } : undefined}
      >
        <span className="text-[#00A859]">R</span>
        <span className="text-[#174A84] -ml-0.5">M</span>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 160 120"
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`company-logo-svg ${className}`}
      style={{
        maxHeight: size || undefined,
        maxWidth: typeof size === 'number' ? size : 160,
        flexShrink: 0,
        display: 'inline-block',
      }}
    >
      <defs>
        <linearGradient id="rmt-r-grad-clean" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A859" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="rmt-bridge-grad-clean" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="50%" stopColor="#1E5AA0" />
          <stop offset="100%" stopColor="#174A84" />
        </linearGradient>
      </defs>

      {/* --- LETTER R (Vibrant Green) --- */}
      {/* 1. Left Vertical Stem */}
      <path d="M 16 14 L 32 14 L 32 106 L 16 106 Z" fill="#00A859" />

      {/* 2. Upper Loop with transparent counter cutout */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 32 14 L 70 14 C 82 14 88 20 88 34 C 88 48 82 54 70 54 L 32 54 Z M 32 26 L 66 26 C 72 26 74 28 74 34 C 74 40 72 42 66 42 L 32 42 Z"
        fill="#00A859"
      />

      {/* 3. Diagonal Leg of R */}
      <path d="M 44 54 L 62 54 L 84 106 L 66 106 Z" fill="url(#rmt-r-grad-clean)" />

      {/* 4. Interlocking Ribbon Bridge */}
      <path d="M 66 106 L 84 106 L 106 34 L 88 34 Z" fill="url(#rmt-bridge-grad-clean)" />

      {/* --- LETTER M (Corporate Royal Blue #174A84 / Sky in dark mode) --- */}
      {/* 5. Authentic M with two vertical columns and central V-dip */}
      <path
        d="M 102 34 L 116 78 L 130 34 L 146 34 L 146 106 L 132 106 L 132 60 L 122 94 L 110 94 L 100 60 L 100 106 L 86 106 L 86 34 Z"
        fill="#174A84"
        className="dark:fill-[#38BDF8]"
      />
    </svg>
  );
};

interface CompanyHeaderProps {
  className?: string;
  showDivider?: boolean;
  compact?: boolean;
  align?: 'between' | 'center' | 'start';
}

/**
 * Resource Makers Trading Est. (مؤسسة صناع الموارد التجاريه) Official Letterhead Header
 * Replicates the corporate header with exact typography, registration details,
 * and the vibrant green divider line requested by the user.
 */
export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  className = '',
  showDivider = true,
  compact = false,
}) => {
  const { corporate, companyIdentity } = useMasterEnterpriseStore();
  const nameAr = companyIdentity?.officialArabicName || corporate?.nameAr || 'مؤسسة صناع الموارد التجارية';
  const nameEn = companyIdentity?.officialEnglishName || corporate?.nameEn || 'Sanaa Al Muarad Trading Est. (RMT)';
  const crNumber = companyIdentity?.crNumber || corporate?.crNumber || '2050167793';
  const vatNumber = companyIdentity?.vatNumber || corporate?.vatNumber || '311552664400003';

  return (
    <div className={`w-full bg-white select-text ${className}`} dir="rtl">
      {/* Top Section: Company Details on the RIGHT (يمين), Logo on the LEFT (يسار) */}
      <div className={`flex flex-row items-center justify-between gap-4 ${compact ? 'pb-2.5' : 'pb-4'}`}>
        {/* Right (يمين): Company Title, Address, Contact & Tax Information */}
        <div className="text-right font-sans">
          <h1 className="text-base sm:text-lg font-black tracking-wide text-[#174A84] font-sans leading-tight">
            {nameAr} <span className="text-xs font-bold text-slate-600 font-mono">({nameEn})</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5 leading-snug">
            {companyIdentity?.addressAr || corporate?.addressAr || 'المملكة العربية السعودية - الدمام - حي الأثير'}
          </p>
          <p className="text-[10.5px] sm:text-[11px] text-slate-600 font-medium leading-snug">
            Phone: <span className="font-mono text-slate-800">{companyIdentity?.phone || corporate?.phone || '+966 13 833 2200'}</span> | Email: <span className="text-slate-800">{companyIdentity?.email || corporate?.email || 'info@rmt-sa.com'}</span>
          </p>
          <p className="text-[10.5px] sm:text-[11px] text-slate-700 font-medium font-mono leading-snug tracking-tight">
            CR. NO. <span className="font-bold text-slate-900">{crNumber}</span> &nbsp;&nbsp; VAT NO. <span className="font-bold text-slate-900">{vatNumber}</span>
          </p>
        </div>

        {/* Left (يسار): Authentic Monogram / Uploaded Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {companyIdentity?.logoUrl ? (
            <img
              src={companyIdentity.logoUrl}
              alt="Company Logo"
              className={compact ? 'max-h-11 max-w-[120px] object-contain' : 'max-h-[70px] max-w-[160px] object-contain'}
            />
          ) : (
            <CompanyLogo className={compact ? 'h-11 w-auto' : 'h-14 sm:h-16 w-auto'} />
          )}
        </div>
      </div>

      {/* Official Bottom Green Accent Divider Line */}
      {showDivider && (
        <div className="w-full h-[4px] bg-[#00A859] rounded-full mt-1" />
      )}
    </div>
  );
};
