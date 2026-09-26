import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running as an installed standalone PWA, hide or show minimal indicator
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // General browser instructions (Chrome/Edge menu -> Install)
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          title="تثبيت التطبيق على جهازك (PWA)"
          className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-emerald-50 text-[#007A5A] hover:bg-emerald-100 border border-emerald-200 shadow-2xs active:scale-95 ${className}`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs ${className}`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>تثبيت التطبيق (PWA)</span>
        </button>
      )}

      {/* Success Toast */}
      {installSuccess && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-800 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-600 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>تم تثبيت التطبيق بنجاح على شاشتك الرئيسية!</span>
        </div>
      )}

      {/* Installation Guide Modal (for iOS & Browsers where prompt is manual) */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-right space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#007A5A] flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    تثبيت التطبيق على هاتفك المحمول
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    تشغيل مباشر دون الحاجة لمتجر تطبيقات، وتصفح سلس بدون إنترنت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  <span>خطوات التثبيت على أجهزة iPhone / iPad (متصفح Safari):</span>
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 pr-1 leading-relaxed">
                  <li>
                    اضغط على زر <strong className="text-slate-900">المشاركة (Share)</strong>{' '}
                    <Share className="w-3.5 h-3.5 inline-block text-blue-600" /> في أسفل شاشة المتصفح.
                  </li>
                  <li>
                    مرر للأسفل واضغط على{' '}
                    <strong className="text-slate-900">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline-block text-emerald-600" />.
                  </li>
                  <li>
                    اضغط على <strong className="text-slate-900">إضافة (Add)</strong> في أعلى الزاوية.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">
                  خطوات التثبيت على أجهزة Android وأجهزة الكمبيوتر:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 pr-1 leading-relaxed">
                  <li>
                    اضغط على قائمة المتصفح <strong className="text-slate-900">⋮</strong> (أو أيقونة التثبيت في شريط العناوين).
                  </li>
                  <li>
                    اختر <strong className="text-slate-900">تثبيت التطبيق (Install App)</strong> أو <strong className="text-slate-900">إضافة إلى الشاشة الرئيسية</strong>.
                  </li>
                  <li>
                    أكد التثبيت لتشغيل التطبيق كنافذة مستقلة وسريعة كأي تطبيق أصلي.
                  </li>
                </ol>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
