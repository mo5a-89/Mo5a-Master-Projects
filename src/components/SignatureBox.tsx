import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Check, PenTool, Sparkles, X, RefreshCw } from 'lucide-react';
import {
  getSavedSignature,
  saveSignature,
  removeSignature,
  processSignatureImage,
} from '../utils/signatureStorage';

interface SignatureBoxProps {
  personName?: string;
  personTitle?: string;
  roleKey?: string;
  signatureUrl?: string;
  onSignatureChange?: (newUrl: string) => void;
  label?: string;
  placeholderText?: string;
  editable?: boolean;
  className?: string;
  heightClass?: string; // e.g. 'h-14' or 'h-12'
  align?: 'center' | 'left' | 'right';
  showPersonInfo?: boolean;
}

export const SignatureBox: React.FC<SignatureBoxProps> = ({
  personName,
  personTitle,
  roleKey,
  signatureUrl,
  onSignatureChange,
  label,
  placeholderText,
  editable = true,
  className = '',
  heightClass = 'h-14',
  align = 'center',
  showPersonInfo = true,
}) => {
  // Determine effective role key for fallback lookups
  const effectiveKey = roleKey || (personName ? personName.trim() : 'custom_signature');

  // Enterprise Governance Key mapping
  const getStrictGovernanceKey = (key: string): string | null => {
    const k = key.toLowerCase();
    if (k.includes('prepared') || k.includes('procurement') || k.includes('مشتريات')) return 'rmt_sig_prepared';
    if (k.includes('reviewed') || k.includes('projects') || k.includes('مشاريع') || k.includes('مكتب فني')) return 'rmt_sig_reviewed';
    if (k.includes('approved') || k.includes('general_manager') || k.includes('تنفيذي') || k.includes('مدير عام')) return 'rmt_sig_approved';
    if (k.includes('seal') || k.includes('stamp') || k.includes('ختم')) return 'rmt_company_seal';
    return null;
  };

  // Local state for active signature
  const [currentSignature, setCurrentSignature] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempImage, setTempImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoTransparent, setAutoTransparent] = useState(true);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSig = () => {
    if (signatureUrl) {
      setCurrentSignature(signatureUrl);
      return;
    }
    const strictKey = getStrictGovernanceKey(effectiveKey);
    if (strictKey) {
      const strictVal = localStorage.getItem(strictKey);
      if (strictVal) {
        setCurrentSignature(strictVal);
        return;
      }
    }
    if (effectiveKey) {
      const saved = getSavedSignature(effectiveKey);
      if (saved) {
        setCurrentSignature(saved);
      } else {
        setCurrentSignature('');
      }
    }
  };

  // Sync with prop or localStorage
  useEffect(() => {
    loadSig();

    const handleSigUpdated = () => loadSig();
    window.addEventListener('storage', handleSigUpdated);
    window.addEventListener('rmt_signatures_updated', handleSigUpdated);

    return () => {
      window.removeEventListener('storage', handleSigUpdated);
      window.removeEventListener('rmt_signatures_updated', handleSigUpdated);
    };
  }, [signatureUrl, effectiveKey]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      setIsProcessing(true);
      try {
        const processed = await processSignatureImage(rawDataUrl, {
          makeBackgroundTransparent: autoTransparent,
          convertToBlueInk: true,
          maxWidth: 400,
          maxHeight: 160,
        });
        setTempImage(processed);
      } catch (err) {
        console.error('Error processing signature image', err);
        setTempImage(rawDataUrl);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Re-process when transparency toggle changes
  const handleToggleTransparency = async (enabled: boolean) => {
    setAutoTransparent(enabled);
    if (!tempImage) return;
    setIsProcessing(true);
    try {
      const processed = await processSignatureImage(tempImage, {
        makeBackgroundTransparent: enabled,
        convertToBlueInk: true,
        maxWidth: 400,
        maxHeight: 160,
      });
      setTempImage(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm and apply signature
  const handleApplySignature = () => {
    if (!tempImage) return;
    setCurrentSignature(tempImage);

    if (onSignatureChange) {
      onSignatureChange(tempImage);
    }

    if (saveAsDefault && effectiveKey) {
      saveSignature(effectiveKey, tempImage, personName, personTitle);
      const strictKey = getStrictGovernanceKey(effectiveKey);
      if (strictKey) {
        localStorage.setItem(strictKey, tempImage);
        window.dispatchEvent(new CustomEvent('rmt_signatures_updated'));
      }
    }

    setIsModalOpen(false);
    setTempImage('');
  };

  // Remove signature
  const handleRemoveSignature = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentSignature('');
    if (onSignatureChange) {
      onSignatureChange('');
    }
    if (effectiveKey) {
      removeSignature(effectiveKey);
      const strictKey = getStrictGovernanceKey(effectiveKey);
      if (strictKey) {
        localStorage.removeItem(strictKey);
        window.dispatchEvent(new CustomEvent('rmt_signatures_updated'));
      }
    }
    setIsModalOpen(false);
    setTempImage('');
  };

  return (
    <div className={`signature-box-container text-xs ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {label && (
        <div className="font-bold text-slate-800 mb-1 leading-tight">
          {label}
        </div>
      )}

      {showPersonInfo && (personName || personTitle) && (
        <div className="mb-1 text-[11px]">
          {personName && <div className="font-bold text-slate-900">{personName}</div>}
          {personTitle && <div className="text-slate-500">{personTitle}</div>}
        </div>
      )}

      {/* Signature Rendering Area */}
      <div
        className={`relative ${heightClass} flex items-center justify-center border-b border-dashed border-slate-400 mx-auto max-w-[220px] transition-all ${
          editable ? 'hover:border-emerald-500 group cursor-pointer' : ''
        }`}
        onClick={() => editable && setIsModalOpen(true)}
        title={editable ? 'انقر لرفع أو تعديل التوقيع المعتمد' : undefined}
      >
        {currentSignature ? (
          <div className="relative w-full h-full flex items-center justify-center p-1">
            <img
              src={currentSignature}
              alt={personName ? `توقيع ${personName}` : 'التوقيع المعتمد'}
              className="max-h-full max-w-[170px] w-auto object-contain pointer-events-none select-none filter contrast-125"
            />
            {editable && (
              <div className="no-print absolute inset-0 bg-slate-900/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                  className="px-2 py-1 bg-white text-slate-800 rounded text-[10px] font-bold shadow-xs hover:bg-slate-100 flex items-center gap-1"
                >
                  <PenTool className="w-3 h-3 text-emerald-600" />
                  <span>تغيير</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold shadow-xs hover:bg-red-700 flex items-center gap-1"
                  title="حذف التوقيع"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Screen View (when no signature yet) */}
            <div className="no-print flex items-center justify-center gap-1.5 text-slate-400 group-hover:text-emerald-600 text-[11px] font-medium py-1 px-2 rounded hover:bg-emerald-50/50 transition">
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>{placeholderText || 'رفع صورة التوقيع'}</span>
            </div>

            {/* Print View Fallback (When no digital signature is present) */}
            <div className="hidden print:flex items-center justify-center text-[10px] text-slate-400 italic">
              (الختم والتوقيع الرسمي)
            </div>
          </>
        )}
      </div>

      {/* Signature Upload & Formatting Modal */}
      {isModalOpen && (
        <div
          className="no-print fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
          dir="rtl"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    رفع واعتماد التوقيع الرقمي
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {personName || label || 'توقيع معتمد للمستندات الرسمية'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload & Drop Area */}
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                className="hidden"
                id={`sig-upload-${effectiveKey}`}
              />

              <label
                htmlFor={`sig-upload-${effectiveKey}`}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/70 hover:bg-emerald-50/30 transition group text-center"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100/70 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  انقر لاختيار صورة التوقيع من جهازك
                </div>
                <div className="text-[10px] text-slate-500">
                  صورة ورقة موقعة، صورة مسحوبة بجوال، أو توقيع PNG/JPG
                </div>
              </label>

              {/* Live Preview Box */}
              {(tempImage || currentSignature) && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5" />
                      معاينة التوقيع بعد التنسيق التلقائي
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ارتفاع متناسق ومعاير
                    </span>
                  </div>

                  {/* Checkerboard Pattern for Transparency Check */}
                  <div
                    className="h-20 w-full rounded-lg border border-slate-300 flex items-center justify-center p-2 bg-white relative overflow-hidden"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>جاري معالجة وتنسيق التوقيع...</span>
                      </div>
                    ) : (
                      <img
                        src={tempImage || currentSignature}
                        alt="معاينة التوقيع"
                        className="max-h-full max-w-full object-contain filter contrast-125"
                      />
                    )}
                  </div>

                  {/* Smart Transparency Toggle */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoTransparent}
                      onChange={(e) => handleToggleTransparency(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>إزالة خلفية الورقة البيضاء تلقائياً (شفافية ذكية)</span>
                  </label>

                  {/* Save as Default Checkbox */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>
                      حفظ كتوقيع افتراضي لهذا المنصب ({personName || label || 'المسؤول'})
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                {currentSignature && (
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 py-1.5 px-2 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف التوقيع الحالي</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setTempImage('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplySignature}
                  disabled={!tempImage}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#007A5A] hover:bg-[#00664b] text-white flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>اعتماد التوقيع</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
