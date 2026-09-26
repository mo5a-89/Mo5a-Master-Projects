import React, { useState } from 'react';
import { SystemDiscipline, SYSTEM_DEFINITIONS, TermsLibraryItem } from '../types';
import {
  Layers,
  BookOpen,
  Plus,
  Trash2,
  Check,
  Edit2,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface TermsLibraryViewProps {
  termsLibrary: TermsLibraryItem[];
  onUpdateTermsLibrary: (updated: TermsLibraryItem[]) => void;
}

export const TermsLibraryView: React.FC<TermsLibraryViewProps> = ({
  termsLibrary,
  onUpdateTermsLibrary,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<SystemDiscipline | string>(
    termsLibrary?.[0]?.system || 'hvac'
  );
  const [saveAlert, setSaveAlert] = useState(false);

  const activeTerms: TermsLibraryItem =
    (termsLibrary || []).find((t) => t.system === selectedSystem) ||
    termsLibrary[0] || {
      id: 'fallback',
      system: selectedSystem,
      scope: '',
      includes: [],
      excludes: [],
      technicalAssumptions: [],
      testingCommissioning: [],
      warranty: '',
      paymentTerms: [],
      delivery: '',
      validity: '',
      notes: [],
    };

  const handleUpdateActiveTerms = (updatedItem: TermsLibraryItem) => {
    const updatedList = (termsLibrary || []).map((t) =>
      t.system === updatedItem.system ? updatedItem : t
    );
    onUpdateTermsLibrary(updatedList);
    setSaveAlert(true);
    setTimeout(() => setSaveAlert(false), 2500);
  };

  const handleAddInclude = () => {
    const updated = {
      ...activeTerms,
      includes: [...(activeTerms.includes || []), 'New inclusion point for this discipline.'],
    };
    handleUpdateActiveTerms(updated);
  };

  const handleAddExclude = () => {
    const updated = {
      ...activeTerms,
      excludes: [...(activeTerms.excludes || []), 'New exclusion point for this discipline.'],
    };
    handleUpdateActiveTerms(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#007A5A]" />
            <span>مكتبة الشروط والأحكام القياسية (Terms & Conditions Library)</span>
          </h2>
          <p className="text-xs text-slate-500">
            شروط مسبقة الإعداد لكل نظام تخصصي، تُدرج تلقائياً عند تحديد النظام في عرض السعر
          </p>
        </div>

        {saveAlert && (
          <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ التعديلات في المكتبة</span>
          </div>
        )}
      </div>

      {/* Main Grid: Systems List on Left, Active Template Editor on Right */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Systems Column */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 px-3 uppercase tracking-wider block py-1">
            الأنظمة الهندسية (Disciplines)
          </span>

          {SYSTEM_DEFINITIONS.map((sys) => {
            const isSelected = selectedSystem === sys.id;
            return (
              <button
                key={sys.id}
                type="button"
                onClick={() => setSelectedSystem(sys.id)}
                className={`w-full text-left p-3 rounded-lg text-xs transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#007A5A] text-white font-bold shadow-xs'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <p>{sys.nameEn}</p>
                  <p className={`text-[11px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {sys.nameAr}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-200" />}
              </button>
            );
          })}
        </div>

        {/* Template Detail Editor */}
        <div className="md:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                الشروط القياسية لنظام:{' '}
                {SYSTEM_DEFINITIONS.find((s) => s.id === activeTerms.system)?.nameAr ||
                  activeTerms.system}
              </h3>
              <p className="text-xs text-slate-500">
                Default scope inclusions, exclusions, payment milestones, and warranty
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-slate-100 font-mono text-slate-700">
              System: {activeTerms.system}
            </span>
          </div>

          {/* Inclusions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1.1 ما يشمله العرض قياسياً (Default Inclusions):
              </h4>
              <button
                type="button"
                onClick={handleAddInclude}
                className="text-xs text-[#007A5A] font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> إضافة بند
              </button>
            </div>

            <div className="space-y-2">
              {(activeTerms.includes || []).map((inc, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={inc}
                    onChange={(e) => {
                      const updated = [...(activeTerms.includes || [])];
                      updated[i] = e.target.value;
                      handleUpdateActiveTerms({ ...activeTerms, includes: updated });
                    }}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-[#007A5A] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (activeTerms.includes || []).filter((_, idx) => idx !== i);
                      handleUpdateActiveTerms({ ...activeTerms, includes: updated });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Exclusions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1.2 ما يستثنيه العرض قياسياً (Default Exclusions):
              </h4>
              <button
                type="button"
                onClick={handleAddExclude}
                className="text-xs text-[#007A5A] font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> إضافة استثناء
              </button>
            </div>

            <div className="space-y-2">
              {(activeTerms.excludes || []).map((exc, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={exc}
                    onChange={(e) => {
                      const updated = [...(activeTerms.excludes || [])];
                      updated[i] = e.target.value;
                      handleUpdateActiveTerms({ ...activeTerms, excludes: updated });
                    }}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-[#007A5A] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (activeTerms.excludes || []).filter((_, idx) => idx !== i);
                      handleUpdateActiveTerms({ ...activeTerms, excludes: updated });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Terms & Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                مدة الصلاحية القياسية (Default Validity)
              </h4>
              <input
                type="text"
                value={activeTerms.validity}
                onChange={(e) =>
                  handleUpdateActiveTerms({ ...activeTerms, validity: e.target.value })
                }
                className="w-full text-xs p-2 border border-slate-200 rounded outline-none"
              />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                الضمان القياسي (Default Warranty)
              </h4>
              <input
                type="text"
                value={activeTerms.warranty}
                onChange={(e) =>
                  handleUpdateActiveTerms({ ...activeTerms, warranty: e.target.value })
                }
                className="w-full text-xs p-2 border border-slate-200 rounded outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
