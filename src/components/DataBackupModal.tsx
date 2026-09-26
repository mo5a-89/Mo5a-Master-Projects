import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  FileJson,
  Search,
  HardDrive,
  Server,
  Smartphone,
  Copy,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  Project,
  CustomerQuotation,
  SupplierQuotation,
  PurchaseOrder,
  Invoice,
  DeliveryNote,
  Customer,
  Supplier,
  TermsLibraryItem,
  User,
} from '../types';
import { normalizeProject } from '../utils/projectValidation';
import {
  getAllCheckpoints,
  createCheckpoint,
  restoreCheckpointById,
  StateCheckpoint,
} from '../utils/snapshotManager';
import { sanitizeAppState } from '../utils/dataSanitizer';
import {
  useMasterEnterpriseStore,
  commitMasterEnterpriseState,
  getMasterEnterpriseState,
} from '../store/masterEnterpriseStore';
import { sanitizeSnapshotPayload } from '../utils/attachmentPipeline';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: {
    projects: Project[];
    customerQuotations: CustomerQuotation[];
    supplierQuotations: SupplierQuotation[];
    purchaseOrders: PurchaseOrder[];
    invoices: Invoice[];
    deliveryNotes: DeliveryNote[];
    customers: Customer[];
    suppliers: Supplier[];
    termsLibrary: TermsLibraryItem[];
    users?: User[];
    systemSettings?: Record<string, any>;
  };
  onRestoreData: (restored: {
    projects?: Project[];
    customerQuotations?: CustomerQuotation[];
    supplierQuotations?: SupplierQuotation[];
    purchaseOrders?: PurchaseOrder[];
    invoices?: Invoice[];
    deliveryNotes?: DeliveryNote[];
    customers?: Customer[];
    suppliers?: Supplier[];
    termsLibrary?: TermsLibraryItem[];
    users?: User[];
    systemSettings?: Record<string, any>;
  }) => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onRestoreData,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'checkpoints' | 'export_guide'>('backup');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{ key: string; size: string; count: number; sample: string }[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [checkpoints, setCheckpoints] = useState<StateCheckpoint[]>([]);
  const [checkpointNote, setCheckpointNote] = useState<string>('');

  const loadCheckpoints = () => {
    setCheckpoints(getAllCheckpoints());
  };

  const handleCreateManualCheckpoint = () => {
    const note = checkpointNote.trim() || 'نقطة استرجاع يدوية مخصصة';
    const cp = createCheckpoint(note, currentData);
    if (cp) {
      loadCheckpoints();
      setCheckpointNote('');
      setStatusMessage({
        type: 'success',
        text: `تم إنشاء نقطة استرجاع جديدة بنجاح (${cp.reason})!`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'تعذر إنشاء نقطة الاسترجاع.',
      });
    }
  };

  const handleRestoreCheckpoint = (cp: StateCheckpoint) => {
    if (!window.confirm(`هل أنت متأكد من استرجاع النظام إلى نقطة: "${cp.reason}" (${new Date(cp.timestamp).toLocaleString('ar-SA')})؟`)) {
      return;
    }

    const data = restoreCheckpointById(cp.id);
    if (data) {
      onRestoreData(data);
      setStatusMessage({
        type: 'success',
        text: `تم استرجاع النظام بنجاح إلى نقطة "${cp.reason}".`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'تعذر تطبيق نقطة الاسترجاع المحددة.',
      });
    }
  };

  const copyToClipboard = (cmd: string, id: string) => {
    try {
      navigator.clipboard.writeText(cmd);
      setCopiedCommand(id);
      setTimeout(() => setCopiedCommand(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Scan localStorage for any relevant keys
  const scanStorage = () => {
    try {
      const results: { key: string; size: string; count: number; sample: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        let count = 0;
        let sample = '';
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            count = parsed.length;
            sample = parsed[0]?.name || parsed[0]?.companyName || parsed[0]?.projectName || parsed[0]?.id || '';
          } else if (typeof parsed === 'object' && parsed !== null) {
            count = Object.keys(parsed).length;
            sample = 'كائن بيانات';
          }
        } catch {
          sample = raw.slice(0, 30);
        }

        const sizeInKB = (new Blob([raw]).size / 1024).toFixed(1) + ' KB';
        results.push({ key, size: sizeInKB, count, sample });
      }
      setScanResults(results);
    } catch (e) {
      console.error('Scan error:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanStorage();
      loadCheckpoints();
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Export current workspace to downloadable JSON file
  const handleExportBackup = () => {
    try {
      const normalizedProjects = currentData.projects
        ? currentData.projects.map((p) => normalizeProject(p))
        : [];

      // Extract system settings from localStorage or props
      const activeSystemSettings = currentData.systemSettings || {
        theme_mode: localStorage.getItem('rmt_theme_mode') || 'light',
        primary_color: localStorage.getItem('rmt_primary_color') || '#174A84',
        accent_color: localStorage.getItem('rmt_accent_color') || '#007A5A',
        font_family: localStorage.getItem('rmt_font_family') || 'Cairo',
        ui_scale: localStorage.getItem('rmt_ui_scale') || 'normal',
        language: localStorage.getItem('rmt_language') || 'ar',
        decimal_precision: localStorage.getItem('rmt_decimal_precision') || '2',
        currency_display: localStorage.getItem('rmt_currency_display') || 'SAR',
        session_timeout: localStorage.getItem('rmt_session_timeout') || '60',
        strict_audit: localStorage.getItem('rmt_strict_audit') || 'true',
      };

      // Extract active users list from localStorage or currentData
      let activeUsers = currentData.users;
      if (!activeUsers) {
        try {
          const rawUsers = localStorage.getItem('rmt_users');
          if (rawUsers) activeUsers = JSON.parse(rawUsers);
        } catch {
          // ignore
        }
      }

      const currentStore = getMasterEnterpriseState();
      const backupPayload = sanitizeSnapshotPayload({
        exportedAt: new Date().toISOString(),
        appName: 'شركة صناع الموارد التجاريه - Resource Makers Trading (RMT)',
        version: '5.0.0-PROD-LOCK',
        companyIdentity: currentStore.companyIdentity,
        financialPolicies: currentStore.financialPolicies,
        autoNumbering: currentStore.autoNumbering,
        navigationPillars: currentStore.navigationPillars,
        menuCustomization: currentStore.menuCustomization,
        data: {
          ...currentData,
          projects: normalizedProjects,
          users: activeUsers,
          systemSettings: activeSystemSettings,
        },
      });

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `RMT_Projects_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: 'تم تنزيل ملف النسخة الاحتياطية بنجاح شاملاً المشاريع، عروض الأسعار، الفواتير، المستخدمين وإعدادات النظام.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'حدث خطأ أثناء تصدير ملف النسخ الاحتياطي.',
      });
    }
  };

  // Import JSON file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);

        // Check if it's our full backup format or direct data
        const importedData = parsed.data || parsed;

        if (
          !importedData.projects &&
          !importedData.customerQuotations &&
          !importedData.purchaseOrders &&
          !importedData.invoices
        ) {
          throw new Error('الملف لا يحتوي على بيانات مشاريع أو عروض صالحة');
        }

        // Sanitize imported state to heal broken relational links and deduplicate quotes
        const { sanitizedData, report } = sanitizeAppState(importedData);

        // Normalize any projects inside sanitizedData
        const safeProjects =
          sanitizedData.projects && Array.isArray(sanitizedData.projects)
            ? sanitizedData.projects.map((p: any) => normalizeProject(p))
            : undefined;

        // Persist imported system settings if available
        if (sanitizedData.systemSettings && typeof sanitizedData.systemSettings === 'object') {
          Object.entries(sanitizedData.systemSettings).forEach(([k, v]) => {
            if (v !== undefined) {
              const keyName = k.startsWith('rmt_') ? k : `rmt_${k}`;
              localStorage.setItem(keyName, typeof v === 'string' ? v : JSON.stringify(v));
            }
          });
        }

        // Persist users if present
        if (sanitizedData.users && Array.isArray(sanitizedData.users)) {
          localStorage.setItem('rmt_users', JSON.stringify(sanitizedData.users));
        }

        // Force explicit Master Enterprise Store update and hydration on import
        if (
          parsed.companyIdentity ||
          parsed.menuCustomization ||
          parsed.navigationPillars ||
          parsed.financialPolicies ||
          parsed.autoNumbering
        ) {
          commitMasterEnterpriseState({
            ...(parsed.companyIdentity ? {
              companyIdentity: parsed.companyIdentity,
              corporate: {
                ...parsed.companyIdentity,
                nameAr: parsed.companyIdentity.officialArabicName,
                nameEn: parsed.companyIdentity.officialEnglishName,
                tradeNameEn: parsed.companyIdentity.officialEnglishName,
                bankIban: parsed.companyIdentity.iban,
                bankAccountName: parsed.companyIdentity.officialArabicName,
                autoSignatures: parsed.companyIdentity.autoSealAndSignature,
              },
            } : {}),
            ...(parsed.menuCustomization ? { menuCustomization: parsed.menuCustomization } : {}),
            ...(parsed.navigationPillars ? { navigationPillars: parsed.navigationPillars } : {}),
            ...(parsed.financialPolicies ? { financialPolicies: parsed.financialPolicies, financial: parsed.financialPolicies } : {}),
            ...(parsed.autoNumbering ? { autoNumbering: parsed.autoNumbering, numbering: parsed.autoNumbering } : {}),
          });
        }

        const payloadToRestore = {
          ...sanitizedData,
          ...(safeProjects ? { projects: safeProjects } : {}),
        };

        onRestoreData(payloadToRestore);
        const reportNotes = !report.isClean ? ` (تم تصحيح ${report.actionsTaken.length} رابط علائقي تلقائياً)` : '';
        setStatusMessage({
          type: 'success',
          text: `تمت استعادة وهدرجة البيانات بنجاح! تم استيراد ${safeProjects?.length || sanitizedData.projects?.length || 0} مشاريع و ${sanitizedData.invoices?.length || 0} فواتير مع تحديث الإعدادات فوراً${reportNotes}.`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'فشل استيراد الملف: تأكد من صيغة ملف الـ JSON الصحيحة.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Restore a specific raw key from localStorage into the store if available
  const handleRestoreKey = (keyName: string) => {
    try {
      const raw = localStorage.getItem(keyName);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (keyName.includes('project')) {
        const normalized = Array.isArray(parsed) ? parsed.map((p: any) => normalizeProject(p)) : parsed;
        onRestoreData({ projects: normalized });
        setStatusMessage({ type: 'success', text: `تم استعادة سجلات المشاريع من المفتاح "${keyName}".` });
      } else if (keyName.includes('invoice')) {
        onRestoreData({ invoices: parsed });
        setStatusMessage({ type: 'success', text: `تم استعادة سجلات الفواتير من المفتاح "${keyName}".` });
      } else if (keyName.includes('purchase_order')) {
        onRestoreData({ purchaseOrders: parsed });
        setStatusMessage({ type: 'success', text: `تم استعادة أوامر الشراء من المفتاح "${keyName}".` });
      } else if (keyName.includes('customer_quotation')) {
        onRestoreData({ customerQuotations: parsed });
        setStatusMessage({ type: 'success', text: `تم استعادة عروض الأسعار من المفتاح "${keyName}".` });
      } else {
        setStatusMessage({ type: 'info', text: `هذا المفتاح غير معروف تلقائياً، يمكنك تصديره أولاً.` });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'تعذر قراءة بيانات هذا المفتاح.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">إدارة وحفظ النسخ الاحتياطية واسترجاع البيانات</h2>
              <p className="text-xs text-slate-500">حفظ كافة أعمالك ومشاريعك على جهازك واستعادتها في أي وقت</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>حفظ واسترجاع البيانات (Backup / Restore)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('checkpoints');
              loadCheckpoints();
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'checkpoints'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>نقاط الاسترجاع التلقائية والـ Checkpoints</span>
            {checkpoints.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full font-mono">
                {checkpoints.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export_guide')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'export_guide'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>دليل الاستضافة والتصدير (Self-Hosting & Export)</span>
          </button>
        </div>

        {/* Tab 1: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            {/* Status Notification */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-sm ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Backup & Restore Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export / Download */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>تصدير نسخة احتياطية كاملة (JSON)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  قم بتنزيل ملف كامل يحتوي على جميع مشاريعك وعروضك وفواتيرك الحالية لحفظها على جهازك بشكل دائم وآمن.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-98 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل النسخة الاحتياطية الآن</span>
                </button>
              </div>

              {/* Import / Restore */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>استيراد ملف نسخة احتياطية</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  إذا كان لديك ملف احتياطي سابق (.json)، يمكنك رفعه هنا لاسترجاع كافة المشاريع والفواتير فوراً.
                </p>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-98 cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>اختيار ملف واستعادة البيانات</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Local Storage Inspector */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <HardDrive className="w-4 h-4 text-slate-600" />
                  <span>محتويات ذاكرة المتصفح الحالية ({scanResults.length} مفاتيح)</span>
                </div>
                <button
                  type="button"
                  onClick={scanStorage}
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة فحص الذاكرة</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto divide-y divide-slate-200/60">
                {scanResults.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    لا توجد مفاتيح مسجلة في ذاكرة هذا المتصفح.
                  </div>
                ) : (
                  scanResults.map((item) => (
                    <div key={item.key} className="py-2 px-2 flex items-center justify-between gap-2 text-xs">
                      <div className="overflow-hidden">
                        <span className="font-mono font-semibold text-slate-700 block truncate">{item.key}</span>
                        <span className="text-[11px] text-slate-500">
                          الحجم: {item.size} | السجلات: {item.count} {item.sample ? `(${item.sample})` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreKey(item.key)}
                        className="shrink-0 px-2.5 py-1 text-[11px] bg-slate-200 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 rounded-md transition font-medium cursor-pointer"
                      >
                        تطبيق السجل
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Automated Checkpoints & Rollback */}
        {activeTab === 'checkpoints' && (
          <div className="space-y-6">
            {/* Status Notification */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-sm ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Create on-demand checkpoint */}
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-purple-950">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>إنشاء نقطة استرجاع فورية (Pre-Execution Snapshot)</span>
                </div>
                <button
                  type="button"
                  onClick={loadCheckpoints}
                  className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث السجل</span>
                </button>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                يقوم النظام تلقائياً بإنشاء نقطة حفظ قبل أي تعديل رئيسي. يمكنك أيضاً حفظ نقطة فحص يدوية الآن لحماية الحالة الحالية للمشاريع وعروض الأسعار والفواتير.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="وصف سبب الحفظ (مثال: قبل تعديل تسعيرة مشروع برج الرياض)"
                  value={checkpointNote}
                  onChange={(e) => setCheckpointNote(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={handleCreateManualCheckpoint}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>حفظ نقطة الآن</span>
                </button>
              </div>
            </div>

            {/* List of Checkpoints */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  سجل نقاط الاسترجاع المحفوظة ({checkpoints.length} نقاط متوفرة)
                </span>
                <span className="text-[11px] text-slate-500">استرجاع فوري بضغطة زر بدون فقدان للبيانات</span>
              </div>

              {checkpoints.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">لم يتم تسجيل نقاط فحص حتى الآن.</p>
                  <p className="text-[11px] text-slate-400">سيتم توليدها تلقائياً عند إجراء العمليات أو بالضغط على زر الحفظ أعلاه.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={cp.id}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        idx === 0
                          ? 'bg-purple-50/40 border-purple-200 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded">
                              الأحدث (Latest)
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900">{cp.reason}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>🕒 {new Date(cp.timestamp).toLocaleString('ar-SA')}</span>
                          <span>📁 {cp.entityCounts?.projects || 0} مشاريع</span>
                          <span>📄 {cp.entityCounts?.customerQuotations || 0} عروض أسعار</span>
                          <span>🧾 {cp.entityCounts?.invoices || 0} فواتير</span>
                          <span>📦 {cp.entityCounts?.purchaseOrders || 0} أوامر شراء</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreCheckpoint(cp)}
                        className="px-3.5 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 hover:border-purple-600 text-xs font-bold rounded-lg transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>استرجاع إلى هذه النقطة</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Private Hosting & Export Guide */}
        {activeTab === 'export_guide' && (
          <div className="space-y-5 text-right">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 space-y-1">
                <div className="font-bold text-sm text-emerald-950">
                  نظام مستقل 100% قابل للاستضافة الذاتية والتشغيل السحابي والداخلي
                </div>
                <p>
                  تم بناء هذا التطبيق باستخدام React 18 + Vite + PWA وهو مهيأ بالكامل للتشغيل على أي خادم محلي (Localhost)، شبكة داخلية (Intranet)، أو استضافة سحابية خاصة (VPS / Nginx / Docker) بدون أي اشتراطات خارجية.
                </p>
              </div>
            </div>

            {/* Step 1: Exporting Code */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-white">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-mono">1</span>
                <span>تصدير الكود المصدري (Export Code)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                من واجهة Google AI Studio، افتح القائمة الجانبية أو خيارات المشروع (Settings) واختر:
              </p>
              <ul className="text-xs text-slate-700 list-disc list-inside space-y-1 pr-2">
                <li><strong>Export to ZIP:</strong> لتنزيل المشروع كاملاً بملف مضغوط فوراً على جهازك.</li>
                <li><strong>Export to GitHub:</strong> لربط ونقل الكود إلى مستودع GitHub خاص بك لمزامنة التحديثات.</li>
              </ul>
            </div>

            {/* Step 2: Running Locally */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-mono">2</span>
                <span>خطوات التثبيت والتشغيل المحلي (Node.js)</span>
              </div>
              <p className="text-xs text-slate-600">
                بعد فك الضغط، افتح موجه الأوامر (Terminal) في مجلد المشروع ونفذ الأوامر التالية:
              </p>
              
              <div className="relative bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono dir-ltr text-left">
                <button
                  type="button"
                  onClick={() => copyToClipboard('npm install\nnpm run build\nnpm run preview', 'step2')}
                  className="absolute top-2.5 right-2.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCommand === 'step2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCommand === 'step2' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
                <p className="text-slate-400 mb-1"># 1. تثبيت الحزم والمكتبات</p>
                <p className="text-emerald-400">npm install</p>
                <p className="text-slate-400 mt-2 mb-1"># 2. بناء ملفات الإنتاج</p>
                <p className="text-emerald-400">npm run build</p>
                <p className="text-slate-400 mt-2 mb-1"># 3. معاينة وتشغيل الإنتاج محلياً</p>
                <p className="text-emerald-400">npm run preview</p>
              </div>
            </div>

            {/* Step 3: Nginx / Docker Setup */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-mono">3</span>
                <span>النشر عبر خادم Nginx أو Docker للشبكة الداخلية</span>
              </div>
              <p className="text-xs text-slate-600">
                مجلد <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">dist/</code> الناتج هو تطبيق SPA ثابت فائق السرعة. إعداد Nginx الموصى به:
              </p>
              <div className="relative bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono dir-ltr text-left">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`server {
    listen 80;
    server_name rmt.local;
    root /var/www/rmt-app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`, 'nginx')}
                  className="absolute top-2.5 right-2.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCommand === 'nginx' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCommand === 'nginx' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
                <pre className="text-emerald-300 text-[11px] overflow-x-auto leading-relaxed">
{`server {
    listen 80;
    server_name rmt.local;
    root /var/www/rmt-app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`}
                </pre>
              </div>
            </div>

            {/* Step 4: Mobile Installation */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-white">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>تثبيت التطبيق على الجوال (Mobile PWA)</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <p>
                  <strong>على أجهزة Android:</strong> اضغط على زر "تثبيت التطبيق" الظاهر في أعلى الشاشة أو من قائمة المتصفح (⋮) واختر <em>"تثبيت التطبيق"</em> أو <em>"إضافة إلى الشاشة الرئيسية"</em>.
                </p>
                <p>
                  <strong>على أجهزة iPhone / iPad:</strong> افتح الرابط في متصفح Safari، اضغط على زر المشاركة <span className="font-bold">(Share ⎋)</span> بالأسفل، ثم اختر <em>"إضافة إلى الصفحة الرئيسية (Add to Home Screen)"</em>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
