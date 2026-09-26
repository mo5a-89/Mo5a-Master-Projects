import React from 'react';
import { CompanyHeader } from './CompanyHeader';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

interface OfficialLetterheadProps {
  children?: React.ReactNode;
  showWatermark?: boolean;
}

export const OfficialLetterhead: React.FC<OfficialLetterheadProps> = ({
  children,
  showWatermark = true,
}) => {
  const { corporate } = useMasterEnterpriseStore();

  return (
    <div className="relative bg-white text-slate-800 shadow-sm border border-slate-200 rounded-sm p-6 sm:p-10 max-w-4xl mx-auto overflow-hidden">
      {/* Background Watermark */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none">
          <span className="font-extrabold text-[220px] tracking-tighter text-[#007A5A]">
            RM
          </span>
        </div>
      )}

      {/* Official Header */}
      <header className="relative pb-2">
        <CompanyHeader showDivider={true} />
      </header>

      {/* Document Content */}
      <main className="relative py-6 min-h-[500px]">{children}</main>

      {/* Official Footer */}
      <footer className="relative mt-8 pt-4 border-t border-slate-200 text-[10px] sm:text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <div className="flex items-center gap-1 font-mono">
          <span className="text-emerald-700">🆔</span>
          <span>C.R {corporate.crNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-cyan-700">📍</span>
          <span>{corporate.poBox || corporate.addressAr || corporate.addressEn}</span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <span className="text-emerald-700">📞</span>
          <span>{corporate.mobiles?.[1] || corporate.mobiles?.[0] || corporate.phone}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sky-700">✉</span>
          <span>{corporate.email}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-700 font-medium">
          <span className="text-indigo-700">🌐</span>
          <span>{corporate.website}</span>
        </div>
      </footer>
    </div>
  );
};

