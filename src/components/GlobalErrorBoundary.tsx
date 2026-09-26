import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Download,
  ShieldCheck,
  CheckCircle,
  Wrench,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { generateEmergencyBackupFile } from '../utils/storagePurgeFallback';
import { executeAutoRepairAll, runSystemPreFlightAudit, PreFlightAuditReport } from '../services/systemSelfHealing';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  exportSuccess: boolean;
  isHealing: boolean;
  healingMessage: string | null;
  auditReport: PreFlightAuditReport | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    exportSuccess: false,
    isHealing: false,
    healingMessage: null,
    auditReport: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Intercepted unhandled exception:', error, errorInfo);
    this.setState({ errorInfo });

    // Run autonomous diagnostic in background to assess damage
    runSystemPreFlightAudit()
      .then((report) => {
        this.setState({ auditReport: report });
      })
      .catch((e) => {
        console.warn('[GlobalErrorBoundary] Pre-flight audit failed on crash:', e);
      });
  }

  private handleExportData = () => {
    const success = generateEmergencyBackupFile();
    if (success) {
      this.setState({ exportSuccess: true });
      setTimeout(() => {
        this.setState({ exportSuccess: false });
      }, 5000);
    } else {
      alert('تعذر استخراج البيانات تلقائياً، يرجى إعادة المحاولة.');
    }
  };

  private handleSelfHealAndReload = async () => {
    this.setState({ isHealing: true, healingMessage: 'جاري تنفيذ الإصلاح الذاتي وتطهير الجداول المتضررة...' });
    try {
      const repairResult = await executeAutoRepairAll();
      this.setState({
        isHealing: false,
        healingMessage: repairResult.message || 'تم الإصلاح بنجاح! جاري إعادة بناء الجلسة...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      this.setState({
        isHealing: false,
        healingMessage: 'تم التطهير الجزئي. جاري إعادة التحميل...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      healingMessage: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'حدث استثناء غير متوقع أثناء معالجة الواجهة';
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';
      const fallbackTitle = this.props.fallbackTitle || 'منظومة الحماية الذاتية: تم منع توقف التطبيق';

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-6 font-sans text-slate-100"
        >
          <div className="bg-[#0B132B] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 text-right animate-in fade-in zoom-in-95 duration-200">
            {/* Top Indicator */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center shadow-inner">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {fallbackTitle}
                  </h1>
                  <p className="text-xs text-slate-400">
                    Self-Healing Diagnostic Sentinel & Operational Recovery Engine
                  </p>
                </div>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>الدرع نشط (Zero Blank Screen)</span>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed space-y-2">
              <p className="font-semibold text-white">
                رصد محرك الاستشفاء الذاتي خطأً برمجياً غير متوقع وقام باحتوائه فوراً لحماية بياناتك من الفقدان.
              </p>
              <p className="text-slate-400">
                يمكنك إعادة بناء الجلسة وإصلاح السجلات تلقائياً، أو تصدير نسخة احتياطية فورية كاملة من جميع المشاريع وعروض الأسعار والفواتير.
              </p>
            </div>

            {/* Healing Feedback Message */}
            {this.state.healingMessage && (
              <div className="p-3.5 bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-xs rounded-2xl flex items-center gap-2.5 shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 animate-spin" />
                <span className="font-bold">{this.state.healingMessage}</span>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Self-Heal & Reload */}
              <button
                type="button"
                onClick={this.handleSelfHealAndReload}
                disabled={this.state.isHealing}
                className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition active:scale-98 cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>إعادة بناء الجلسة تلقائياً (Self-Heal & Reload)</span>
              </button>

              {/* Option 2: Emergency Data Dump */}
              <button
                type="button"
                onClick={this.handleExportData}
                className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل نسخة احتياطية فورية (Emergency Data Dump)</span>
              </button>
            </div>

            {/* Secondary Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة والمتابعة</span>
              </button>

              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <span>التفاصيل الفنية للاستثناء</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Technical Error Details Drawer */}
            {this.state.showDetails && (
              <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-slate-400 text-left dir-ltr max-h-48 overflow-y-auto">
                <div className="text-rose-400 font-bold">Error: {errorMessage}</div>
                {errorStack && (
                  <pre className="whitespace-pre-wrap text-[10px] text-slate-500">{errorStack}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
