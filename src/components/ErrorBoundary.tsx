import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  Download,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle,
  Wrench,
} from 'lucide-react';
import {
  diagnoseStorageHealth,
  autoSanitizeLocalStorage,
  generateEmergencyBackupFile,
  purgeCorruptedKeysOnly,
  fullFactoryReset,
  StorageHealthReport,
} from '../utils/storagePurgeFallback';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  isSubBoundary?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  exportSuccess: boolean;
  healthReport: StorageHealthReport | null;
  repairSuccessMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    exportSuccess: false,
    healthReport: null,
    repairSuccessMessage: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null, exportSuccess: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error captured by Global ErrorBoundary:', error, errorInfo);
    
    // Auto-diagnose local storage health upon crash
    const health = diagnoseStorageHealth();
    this.setState({ errorInfo, healthReport: health });

    // If corrupted keys are detected, attempt background non-destructive sanitization
    if (!health.isHealthy && health.corruptedKeys.length > 0) {
      console.warn('Attempting automatic storage sanitization for corrupted keys:', health.corruptedKeys);
      autoSanitizeLocalStorage();
    }
  }

  componentDidMount() {
    // Global defensive event listeners for unhandled errors
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled Promise Rejection caught by defensive listener:', event.reason);
    // Only intercept severe rendering or fatal runtime rejections
    if (event.reason instanceof Error && event.reason.message.includes('fatal')) {
      this.setState({
        hasError: true,
        error: event.reason,
        healthReport: diagnoseStorageHealth(),
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, repairSuccessMessage: null });
  };

  /**
   * Rescue Action: Safely dump all application state and localStorage keys to JSON
   */
  private handleExportData = () => {
    const success = generateEmergencyBackupFile();
    if (success) {
      this.setState({ exportSuccess: true });
      setTimeout(() => {
        this.setState({ exportSuccess: false });
      }, 5000);
    } else {
      alert('تعذر استخراج البيانات تلقائياً، يرجى المحاولة مرة أخرى.');
    }
  };

  /**
   * Automated Local Storage Purge Fallback:
   * Selectively purges only corrupted caches while preserving all valid projects and quotes
   */
  private handleSanitizeStorage = () => {
    const report = autoSanitizeLocalStorage();
    const count = report.repairedKeys.length;
    this.setState({
      healthReport: report,
      repairSuccessMessage:
        count > 0
          ? `تم فحص وإصلاح ${count} سجل تالف بنجاح دون المساس ببياناتك السليمة!`
          : 'تم فحص الذاكرة والتأكد من سلامتها. لا توجد سجلات تالفة.',
    });
  };

  private handlePurgeCorruptedOnly = () => {
    const purged = purgeCorruptedKeysOnly();
    this.setState({
      healthReport: diagnoseStorageHealth(),
      repairSuccessMessage: `تم تفريغ ${purged} مفتاح غير صالح بأمان. يمكنك الآن المتابعة.`,
    });
  };

  private handleResetState = () => {
    if (
      !window.confirm(
        'تحذير: هل أنت متأكد من تفريغ كافة البيانات والعودة للبيانات الافتراضية؟ يُنصح بالضغط على "تصدير نسخة احتياطية" أولاً.'
      )
    ) {
      return;
    }
    fullFactoryReset();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'حدث خطأ غير متوقع أثناء المعالجة';
      const fallbackTitle = this.props.fallbackTitle || 'حماية النظام: تم تفادي توقف التطبيق';
      const corruptedCount = this.state.healthReport?.corruptedKeys.length || 0;

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>الدرع الدفاعي نشط (Zero White Screen Tolerance)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {fallbackTitle}
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                رصد النظام استثناءً غير متوقع وقام باحتوائه فوراً لحماية الجلسة والبيانات. يمكنك استخراج نسخة احتياطية فورية أو معالجة السجلات التالفة بنقرة واحدة.
              </p>
            </div>

            {/* Repair feedback message */}
            {this.state.repairSuccessMessage && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 text-right">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{this.state.repairSuccessMessage}</span>
              </div>
            )}

            {/* Emergency Export Banner */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-right space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>تأمين وحفظ بيانات المشاريع وعروض الأسعار</span>
                </span>
                {this.state.exportSuccess && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    ✓ تم تحميل ملف النسخة الاحتياطية بنجاح
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-400">
                انقر على الزر أدناه لتصدير ملف JSON فوري يحتوي على جميع مشاريعك، الفواتير، عروض الأسعار، والموردين.
              </p>
              <button
                type="button"
                onClick={this.handleExportData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 active:scale-98 cursor-pointer"
                id="emergency-export-data-btn"
              >
                <Download className="w-4 h-4" />
                <span>تصدير نسخة احتياطية من البيانات (Emergency Export)</span>
              </button>
            </div>

            {/* Storage Health & Targeted Purge Fallback Box */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-right space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>نظام فحص وتنقية الذاكرة التالفة (Storage Sanitizer)</span>
                </span>
                {corruptedCount > 0 ? (
                  <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-400 font-bold px-2 py-0.5 rounded">
                    رصد {corruptedCount} سجلات تحتاج تصحيح
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold px-2 py-0.5 rounded">
                    الذاكرة سليمة
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={this.handleSanitizeStorage}
                  className="flex-1 py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  ⚡ فحص وإصلاح الذاكرة تلقائياً
                </button>
                {corruptedCount > 0 && (
                  <button
                    type="button"
                    onClick={this.handlePurgeCorruptedOnly}
                    className="py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    حذف التالف فقط
                  </button>
                )}
              </div>
            </div>

            {/* Error detail for technical inspection */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-right font-mono text-xs text-rose-400 overflow-x-auto max-h-24 text-left dir-ltr">
              <span className="font-semibold text-slate-400">Diagnostic Info: </span>
              {errorMessage}
            </div>

            {/* Recovery actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition shadow-lg shadow-purple-600/20 active:scale-98 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة والمتابعة</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition active:scale-98 cursor-pointer"
              >
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetState}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700/60 text-xs transition active:scale-98 cursor-pointer"
                title="إعادة ضبط المصنع الكامل"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ شامل (Reset)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
