import React, { useState, useEffect } from 'react';
import { Upload, Trash2, CheckCircle2, ShieldCheck, FileCheck, Stamp, AlertCircle } from 'lucide-react';

export interface SignatureRoleConfig {
  key: string;
  titleAr: string;
  titleEn: string;
  defaultPersonName: string;
  defaultPersonTitle: string;
  description: string;
  isStamp?: boolean;
}

export const GOVERNANCE_SIGNATURE_SLOTS: SignatureRoleConfig[] = [
  {
    key: 'rmt_sig_prepared',
    titleAr: 'مسؤول المشتريات والتسعير (إعداد المستند)',
    titleEn: 'Procurement Officer (Prepared By)',
    defaultPersonName: 'Medhat Al Brahim',
    defaultPersonTitle: 'Procurement Officer',
    description: 'التوقيع المعتمد لإعداد أوامر الشراء ومطابقة عروض الموردين وجداول الكميات.',
  },
  {
    key: 'rmt_sig_reviewed',
    titleAr: 'مدير عام المشاريع والمكتب الفني (المراجعة)',
    titleEn: 'Projects Manager (Reviewed By)',
    defaultPersonName: 'Eng. Mokhtar Yousef',
    defaultPersonTitle: 'Projects Manager',
    description: 'التوقيع المعتمد للمراجعة الفنية واعتماد العروض التجارية والمخططات الهندسية.',
  },
  {
    key: 'rmt_sig_approved',
    titleAr: 'المدير التنفيذي / المدير العام (الاعتماد النهائي)',
    titleEn: 'General Manager (Approved By)',
    defaultPersonName: 'Abdullah Al Moaili',
    defaultPersonTitle: 'General Manager',
    description: 'التوقيع التنفيذي النهائي المعتمد لإصدار أوامر الشراء وتوقيع العقود والمستخلصات.',
  },
  {
    key: 'rmt_company_seal',
    titleAr: 'الختم الرسمي للمؤسسة',
    titleEn: 'Official Company Seal / Stamp',
    defaultPersonName: 'مؤسسة صناع الموارد التجارية',
    defaultPersonTitle: 'س.ت 2050167793 - الرقم الضريبي 311552664400003',
    description: 'الختم المعتمد للمؤسسة لطباعته وتضمينه رقمياً على الوثائق والمستندات الرسمية.',
    isStamp: true,
  },
];

interface GovernanceSignaturesProps {
  onSignatureUpdated?: () => void;
  className?: string;
}

export const GovernanceSignatures: React.FC<GovernanceSignaturesProps> = ({
  onSignatureUpdated,
  className = '',
}) => {
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadSignatures = () => {
    const loaded: Record<string, string> = {};
    GOVERNANCE_SIGNATURE_SLOTS.forEach((slot) => {
      const val = localStorage.getItem(slot.key);
      if (val) loaded[slot.key] = val;
    });
    setSignatures(loaded);
  };

  useEffect(() => {
    loadSignatures();

    const handleStorageChange = () => {
      loadSignatures();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('rmt_signatures_updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('rmt_signatures_updated', handleStorageChange);
    };
  }, []);

  const notifyChange = () => {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('rmt_signatures_updated'));
    if (onSignatureUpdated) onSignatureUpdated();
  };

  /**
   * Mandatory Base64 file converter as specified in enterprise governance protocol
   */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size limit (max 5MB for base64 storage)
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف كبير جداً. يرجى اختيار صورة أقل من 5 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      try {
        localStorage.setItem(key, base64);
        setSignatures((prev) => ({ ...prev, [key]: base64 }));
        notifyChange();
        setToastMsg('تم حفظ التوقيع المعتمد بنجاح وتحديث كافة المستندات والطباعة');
        setTimeout(() => setToastMsg(null), 3000);
      } catch (err) {
        console.error('Failed to save signature to localStorage', err);
        alert('حدث خطأ أثناء حفظ الملف محلياً. يرجى التأكد من مساحة المتصفح.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemove = (key: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التوقيع / الختم؟')) {
      localStorage.removeItem(key);
      setSignatures((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      notifyChange();
      setToastMsg('تم إزالة التوقيع بنجاح');
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  return (
    <div className={`space-y-6 ${className}`} dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>إدارة التواقيع المعتمدة والأختام الرسمية (Governance Signatures)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-700 font-mono">
                Base64 Real Attachments
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              ربط فوري للتواقيع الحقيقية والأختام الرسمية لكافة مستندات أوامر الشراء (PO)، العروض التجارية (Commercial Proposals)، وسندات الاستلام (GRN).
            </p>
          </div>
        </div>

        {toastMsg && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs rounded-lg animate-fade-in font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Grid of 4 Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {GOVERNANCE_SIGNATURE_SLOTS.map((slot) => {
          const sigUrl = signatures[slot.key];

          return (
            <div
              key={slot.key}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div>
                {/* Slot Top Meta */}
                <div className="flex items-start justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl text-white ${
                        slot.isStamp ? 'bg-amber-600' : 'bg-[#1e3a8a]'
                      }`}
                    >
                      {slot.isStamp ? <Stamp className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight">
                        {slot.titleAr}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {slot.titleEn}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-[9px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                    {slot.key}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 mb-4 leading-relaxed">
                  {slot.description}
                </p>

                {/* Signature Preview Canvas */}
                <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50/70 p-3 mb-4 flex items-center justify-center min-h-[100px]">
                  {sigUrl ? (
                    <div className="relative group max-h-24 flex items-center justify-center">
                      <img
                        src={sigUrl}
                        alt={slot.titleAr}
                        className="max-h-24 max-w-[200px] object-contain drop-shadow-xs"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                      <div className="text-slate-400 text-xs font-medium">
                        بانتظار رفع {slot.isStamp ? 'الختم الرسمي' : 'التوقيع المعتمد'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        PNG / JPG بخلفية شفافة أو بيضاء
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload & Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleUpload(e, slot.key)}
                    className="hidden"
                  />
                  <div className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{sigUrl ? 'استبدال الملف' : 'رفع التوقيع (Base64)'}</span>
                  </div>
                </label>

                {sigUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemove(slot.key)}
                    className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
                    title="حذف التوقيع"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GovernanceSignatures;
