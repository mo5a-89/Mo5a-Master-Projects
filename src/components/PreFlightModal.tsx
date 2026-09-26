import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  RefreshCw,
  Download,
  HardDrive,
  Cloud,
  PenTool,
  Printer,
  DollarSign,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  runSystemPreFlightAudit,
  executeAutoRepairAll,
  PreFlightAuditReport,
  DiagnosticItemResult,
  DiagnosticStatus,
} from '../services/systemSelfHealing';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';

interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSystemRepaired?: () => void;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  onClose,
  onSystemRepaired,
}) => {
  // Mobile & hardware back-button dismiss
  useModalBackDismiss(onClose);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PreFlightAuditReport | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await runSystemPreFlightAudit();
      setReport(res);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAudit();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAutoRepair = async () => {
    setIsRepairing(true);
    setRepairMessage('جاري تنفيذ الإصلاح الذاتي، تنقية الكاش، وضبط الجداول...');
    try {
      const res = await executeAutoRepairAll();
      setRepairMessage(res.message);
      await fetchAudit();
      if (onSystemRepaired) onSystemRepaired();
    } catch (err) {
      setRepairMessage(`تعذر إتمام الإصلاح الذاتي: ${String(err)}`);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleExportReport = () => {
    if (!report) return;
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmt-system-preflight-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getItemIcon = (category: DiagnosticItemResult['category']) => {
    switch (category) {
      case 'storage':
        return <HardDrive className="w-5 h-5 text-blue-400" />;
      case 'cloud':
        return <Cloud className="w-5 h-5 text-teal-400" />;
      case 'signatures':
        return <PenTool className="w-5 h-5 text-purple-400" />;
      case 'print':
        return <Printer className="w-5 h-5 text-emerald-400" />;
      case 'finance':
        return <DollarSign className="w-5 h-5 text-amber-400" />;
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-indigo-400" />;
      default:
        return <ShieldCheck className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: DiagnosticStatus) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>سليم وموثق (Passed)</span>
          </span>
        );
      case 'healed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تم الإصلاح ذاتياً (Auto-Healed)</span>
          </span>
        );
      case 'requires_input':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>يتطلب تدخل (Requires Input)</span>
          </span>
        );
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0B132B] text-slate-100 rounded-none sm:rounded-3xl shadow-2xl border border-slate-800 max-w-4xl w-full min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title="فحص سلامة النظام والتحقق قبل النشر (System Health & Pre-Publish Audit)"
          subtitle="محرك تشخيصي متقدم ومستقل لفحص 6 محاور حيوية ومنع أي أخطاء أو انهيارات قبل النشر"
          onClose={onClose}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAudit}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="إعادة الفحص اللحظي"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">إعادة الفحص</span>
              </button>

              <button
                type="button"
                onClick={handleExportReport}
                disabled={!report}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="تصدير تقرير السلامة الشامل كملف JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تقرير JSON</span>
              </button>
            </div>
          }
        />

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Executive Overview Banner */}
          <div className="bg-gradient-to-r from-[#0F223D] via-[#0D1C33] to-[#0A1629] border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-white">
                  حالة الجاهزية التشغيلية للمنظومة
                </span>
                {report && (
                  <span
                    className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                      report.overallStatus === 'passed'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60'
                        : report.overallStatus === 'healed'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-700/60'
                        : 'bg-rose-950/90 text-rose-300 border-rose-700/60'
                    }`}
                  >
                    {report.overallStatus === 'passed'
                      ? '🟢 جاهز للنشر بنسبة 100%'
                      : report.overallStatus === 'healed'
                      ? '🟡 مستقر (مع معالجات ذاتية)'
                      : '🔴 يتطلب مراجعة بعض البنود'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                يقوم النظام بالتحقق الآلي المستمر من جداول التخزين، اعتمادات الأختام، محرك طباعة A4، الحسابات المالية وتوافق الجوال.
              </p>
            </div>

            {/* Auto-Repair All Action Button */}
            <button
              type="button"
              onClick={handleAutoRepair}
              disabled={isRepairing}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs sm:text-sm font-black transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Wrench className={`w-4 h-4 ${isRepairing ? 'animate-spin' : ''}`} />
              <span>إصلاح تلقائي لجميع المشاكل (Auto-Repair All)</span>
            </button>
          </div>

          {/* Feedback banner if repair was run */}
          {repairMessage && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-2xl flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">{repairMessage}</span>
            </div>
          )}

          {/* Statistical Metrics Row */}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 font-medium">سليم وموثق</div>
                <div className="text-xl font-black text-emerald-400 mt-1">{report.passedCount}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 font-medium">تم الإصلاح ذاتياً</div>
                <div className="text-xl font-black text-amber-400 mt-1">{report.healedCount}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 font-medium">يتطلب مدخلات</div>
                <div className="text-xl font-black text-rose-400 mt-1">{report.requiresInputCount}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 font-medium">استهلاك الذاكرة</div>
                <div className="text-xl font-black text-blue-400 mt-1">{report.storageUsageKB}</div>
              </div>
            </div>
          )}

          {/* 6-Point Live Interactive Diagnostic Cards */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
              <p className="text-xs font-bold">جاري الفحص الحي الشامل للمنظومة...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {report?.items.map((item) => {
                const isExpanded = expandedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition"
                  >
                    {/* Item Header */}
                    <div
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
                          {getItemIcon(item.category)}
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <span>{item.title}</span>
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.summary}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {getStatusBadge(item.status)}
                        <div className="text-slate-500 hover:text-slate-300">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Diagnostic Expansion */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950/60 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
                        <div className="font-semibold text-slate-400 flex items-center gap-1.5 pt-1">
                          <Info className="w-3.5 h-3.5 text-blue-400" />
                          <span>سجل التحقق والتفاصيل التشغيلية:</span>
                        </div>
                        <ul className="space-y-1.5 pr-4 list-disc text-[11.5px] leading-relaxed text-slate-300">
                          {item.details.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>نظام الحوكمة الصارم يضمن استقرار المنظومة دون شاشة بيضاء أو فقدان للبيانات.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              إغلاق الفحص
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
