import React, { useState, useEffect, useMemo } from 'react';
import { telegramBridge, TelegramExecutionLog } from '../services/TelegramBridge';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Zap,
  Search,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ExternalLink,
  Copy,
  Check,
  Send,
  Download,
  Filter,
  Layers,
  Terminal,
  Clock,
  Radio,
} from 'lucide-react';

interface TelegramExecutionLogsViewerProps {
  onNavigateTab?: (tab: string, paramId?: string) => void;
  className?: string;
  maxLogs?: number;
}

export const TelegramExecutionLogsViewer: React.FC<TelegramExecutionLogsViewerProps> = ({
  onNavigateTab,
  className = '',
  maxLogs = 20,
}) => {
  const [logs, setLogs] = useState<TelegramExecutionLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'report' | 'file'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Subscribe to real-time logs from TelegramBridge
  useEffect(() => {
    const unsubscribe = telegramBridge.subscribeLogs((updatedLogs) => {
      setLogs(updatedLogs.slice(0, maxLogs));
    });

    // Auto-refresh interval if enabled
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        setLogs(telegramBridge.getExecutionLogs(maxLogs));
      }, 5000);
    }

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [maxLogs, autoRefresh]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    const updated = telegramBridge.getExecutionLogs(maxLogs);
    setLogs(updated);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleClearLogs = () => {
    if (window.confirm('هل أنت متأكد من تفريغ سجل العمليات والأخطاء لـ TelegramBridge؟')) {
      telegramBridge.clearExecutionLogs();
      setLogs([]);
    }
  };

  const handleSendTestPing = async () => {
    setIsTestingPing(true);
    try {
      await telegramBridge.sendPing();
      setLogs(telegramBridge.getExecutionLogs(maxLogs));
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleCopyJSON = (log: TelegramExecutionLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telegram_bridge_execution_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (filterStatus === 'success' && log.status !== 'success') return false;
      if (filterStatus === 'error' && log.status !== 'error' && log.status !== 'warning') return false;
      if (filterStatus === 'report' && log.action !== 'report_dispatch') return false;
      if (filterStatus === 'file' && log.action !== 'file_transformation') return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesDetails = log.details.toLowerCase().includes(q);
        const matchesAction = (log.actionNameAr || log.action).toLowerCase().includes(q);
        const matchesDoc = log.deliverableInfo?.documentNumber?.toLowerCase().includes(q);
        const matchesChat = String(log.targetChat || '').toLowerCase().includes(q);
        return matchesTitle || matchesDetails || matchesAction || matchesDoc || matchesChat;
      }
      return true;
    });
  }, [logs, filterStatus, searchQuery]);

  // Status counters
  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error' || l.status === 'warning').length;

  const getStatusBadge = (status: TelegramExecutionLog['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>ناجحة</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            <span>فشل / خطأ</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>تحذير</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Activity className="w-3 h-3" />
            <span>معلومات</span>
          </span>
        );
    }
  };

  const formatLogTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'الآن';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      const diffHours = Math.floor(diffMin / 60);
      return `منذ ${diffHours} ساعة`;
    } catch {
      return '';
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Header Bar */}
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-[#174A84] text-white shadow-sm">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                سجل تنفيذات وعمليات تليجرام (Telegram Execution Logs)
              </h3>
              <span className="text-[10px] font-mono bg-[#174A84]/10 dark:bg-sky-500/20 text-[#174A84] dark:text-sky-300 px-2 py-0.5 rounded-full font-bold">
                آخر {logs.length} عملية
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              مراقبة حية لكافة أوامر البوت، فحوصات الاتصال Ping، إرسال التقارير، والأخطاء الفنية
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <button
            type="button"
            onClick={handleSendTestPing}
            disabled={isTestingPing}
            className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="إرسال فحص اتصال تجريبي لتسجيل عملية جديدة"
          >
            {isTestingPing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>فحص اتصال (Ping)</span>
          </button>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition active:scale-95 cursor-pointer"
            title="تحديث السجل"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition active:scale-95 cursor-pointer disabled:opacity-40"
            title="تصدير السجل بتنسيق JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-500 transition active:scale-95 cursor-pointer disabled:opacity-40"
            title="تفريغ السجل"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
            title="التحديث التلقائي كل 5 ثوانٍ"
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse text-emerald-500' : ''}`} />
            <span>{autoRefresh ? 'مباشر (Live)' : 'إيقاف'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-[#174A84] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            الكل ({logs.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('success')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterStatus === 'success'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>الناجحة ({successCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('error')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterStatus === 'error'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>الأخطاء ({errorCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('report')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'report'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
            }`}
          >
            التقارير
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('file')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'file'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            المستندات
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في السجلات..."
            className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Logs Content List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[500px] overflow-y-auto [scrollbar-width:thin]">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">
              لا توجد سجلات تطابق الفلتر الحالي
            </h4>
            <p className="text-[11px] text-slate-400">
              يمكنك الضغط على "فحص اتصال (Ping)" أو تنفيذ أي أمر لتسجيل حركة جديدة.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className={`p-3.5 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/50 ${
                  log.status === 'error' ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                }`}
              >
                {/* Main Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">{getStatusBadge(log.status)}</div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {log.title}
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.actionNameAr || log.action}
                        </span>

                        {log.latencyMs !== undefined && (
                          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                            ⚡ {log.latencyMs} ms
                          </span>
                        )}

                        {log.targetChat && (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            Chat: {log.targetChat}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                        {log.details}
                      </p>

                      {/* Deliverable Badge if any */}
                      {log.deliverableInfo && (
                        <div className="pt-1 flex items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>المستند: {log.deliverableInfo.documentNumber}</span>
                            {log.deliverableInfo.grandTotal && (
                              <span className="font-mono">
                                ({log.deliverableInfo.grandTotal.toLocaleString('en-US')} ر.س)
                              </span>
                            )}
                          </div>

                          {onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => {
                                const t = log.deliverableInfo?.type;
                                if (t === 'quotation') onNavigateTab('quotations');
                                else if (t === 'invoice') onNavigateTab('invoices');
                                else if (t === 'purchase_order') onNavigateTab('purchase_orders');
                                else onNavigateTab('dashboard');
                              }}
                              className="text-[10px] text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>فتح</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & Toggle */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400" title={log.timestamp}>
                      <Clock className="w-3 h-3" />
                      <span>{formatLogTime(log.timestamp)}</span>
                      <span className="text-[9px] text-slate-500">({getRelativeTime(log.timestamp)})</span>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyJSON(log)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                        title="نسخ سجل العملية JSON"
                      >
                        {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                        title={isExpanded ? 'إخفاء التفاصيل الفنية' : 'عرض التفاصيل الفنية و JSON'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <span>البيانات التقنية التفصيلية (Raw Execution Payload):</span>
                      <span className="font-mono text-[10px] text-slate-400">ID: {log.id}</span>
                    </div>

                    <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto leading-relaxed border border-slate-800 dir-ltr text-left">
                      {JSON.stringify(
                        {
                          id: log.id,
                          timestamp: log.timestamp,
                          action: log.action,
                          actionNameAr: log.actionNameAr,
                          status: log.status,
                          title: log.title,
                          details: log.details,
                          latencyMs: log.latencyMs,
                          targetChat: log.targetChat,
                          deliverableInfo: log.deliverableInfo,
                          rawMetadata: log.rawMetadata,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Summary */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>العمليات المعروضة: <strong>{filteredLogs.length}</strong> من أصل <strong>{logs.length}</strong></span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">سعة الذاكرة المحلية: <strong>200 عملية</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>TelegramBridge v2026 Live</span>
        </div>
      </div>
    </div>
  );
};
