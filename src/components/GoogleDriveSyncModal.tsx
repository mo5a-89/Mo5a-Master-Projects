import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  HardDrive,
  FolderLock,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import {
  signInWithGoogleDrive,
  signOutGoogleDrive,
  saveStateToGoogleDrive,
  listGoogleDriveBackups,
  loadStateFromGoogleDrive,
  subscribeGoogleDriveStatus,
  GoogleDriveSyncStatus,
} from '../utils/googleDriveSync';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: any;
  onStateRestored: (restoredData: any) => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  currentState,
  onStateRestored,
}) => {
  const [driveStatus, setDriveStatus] = useState<GoogleDriveSyncStatus>({
    isConnected: false,
    userEmail: null,
    userName: null,
    lastBackupAt: null,
    isSyncing: false,
    error: null,
    backupFolderId: null,
  });

  const [backupsList, setBackupsList] = useState<Array<{ id: string; name: string; createdTime: string; size: string }>>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeGoogleDriveStatus((st) => setDriveStatus(st));
  }, []);

  useEffect(() => {
    if (isOpen && driveStatus.isConnected) {
      loadBackups();
    }
  }, [isOpen, driveStatus.isConnected]);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const list = await listGoogleDriveBackups();
      setBackupsList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await signInWithGoogleDrive();
      if (!res) {
        // Sign-in was cancelled or closed by user
        return;
      }
      setActionSuccess('تم الاتصال بحساب Google Drive بنجاح');
      setTimeout(() => setActionSuccess(null), 4000);
      loadBackups();
    } catch (err: any) {
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/user-cancelled' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request');
      if (!isCancelled) {
        console.error(err);
      }
    }
  };

  const handleDisconnect = async () => {
    await signOutGoogleDrive();
    setBackupsList([]);
    setActionSuccess('تم تسجيل الخروج من Google Drive');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleSaveNow = async () => {
    try {
      const res = await saveStateToGoogleDrive(currentState, 'نسخة احتياطية يدوية سحابية شاملة');
      setActionSuccess(`تم حفظ النسخة السحابية بنجاح (${new Date(res.backupTime).toLocaleTimeString('ar-SA')})`);
      setTimeout(() => setActionSuccess(null), 5000);
      loadBackups();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRestoreBackup = async (fileId: string) => {
    try {
      const data = await loadStateFromGoogleDrive(fileId);
      if (data) {
        onStateRestored(data);
        setActionSuccess('تمت استعادة البيانات بنجاح من Google Drive واسترجاع كافة التسعيرات والمشاريع!');
        setConfirmRestoreId(null);
        setTimeout(() => {
          setActionSuccess(null);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-l from-[#174A84] to-[#007A5A] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
              <Cloud className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">مزامنة البيانات والحفظ السحابي (Google Drive)</h2>
              <p className="text-xs text-slate-200">
                حفظ كافة التسعيرات المعدلة، أرقام الموردين، والمشاريع المنشورة مباشرة على حساب Google الشخصي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {driveStatus.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{driveStatus.error}</span>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                driveStatus.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
              }`}>
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">حساب التخزين السحابي:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    driveStatus.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {driveStatus.isConnected ? 'متصل ومفعل' : 'غير متصل'}
                  </span>
                </div>
                {driveStatus.isConnected ? (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    {driveStatus.userEmail || driveStatus.userName}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    قم بتسجيل الدخول بحساب Google لحفظ وتأمين بيانات المنظومة ضد أي فقدان
                  </p>
                )}
              </div>
            </div>

            <div>
              {driveStatus.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                >
                  فصل الحساب
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={driveStatus.isSyncing}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-[#007A5A] hover:bg-[#00654b] rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.1 8.9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                    <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.9 6.4C.7 8.8 0 10.4 0 12s.7 3.2 1.9 5.6l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.7-2.1-6.6-4.9L1.7 16.3C3.5 20.2 7.4 23 12 23z" />
                  </svg>
                  <span>تسجيل الدخول بـ Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Sync Actions */}
          {driveStatus.isConnected && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSaveNow}
                disabled={driveStatus.isSyncing}
                className="p-4 bg-emerald-50/70 border border-emerald-200 hover:bg-emerald-100/80 rounded-2xl text-right transition flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 group-hover:scale-105 transition">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">حفظ نسخة سحابية جديدة الآن</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    رفع جميع التسعيرات وتعديلات الهوامش والمشاريع المنشورة فوراً إلى Google Drive
                  </p>
                  {driveStatus.lastBackupAt && (
                    <span className="text-[10px] text-emerald-700 font-mono block mt-1">
                      آخر حفظ: {new Date(driveStatus.lastBackupAt).toLocaleTimeString('ar-SA')}
                    </span>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={loadBackups}
                disabled={loadingBackups}
                className="p-4 bg-blue-50/70 border border-blue-200 hover:bg-blue-100/80 rounded-2xl text-right transition flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2 bg-[#174A84] text-white rounded-xl shrink-0 group-hover:scale-105 transition">
                  <RefreshCw className={`w-5 h-5 ${loadingBackups ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950">تحديث قائمة النسخ السحابية</h4>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    فحص مجلد RMT في Google Drive وعرض النسخ المتاحة للاسترجاع
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Backups List */}
          {driveStatus.isConnected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FolderLock className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-800">
                    النسخ الاحتياطية المحفوظة في Google Drive ({backupsList.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">مجلد: RMT Contracting & MEP System Backups</span>
              </div>

              {loadingBackups ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#007A5A]" />
                  <span>جاري تحميل النسخ السحابية من Google Drive...</span>
                </div>
              ) : backupsList.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  <span>لا توجد نسخ سحابية محفوظة بعد. انقر على &quot;حفظ نسخة سحابية جديدة الآن&quot; أعلاه.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {backupsList.map((b) => {
                    const isConfirming = confirmRestoreId === b.id;
                    const dateFormatted = new Date(b.createdTime).toLocaleString('ar-SA');

                    return (
                      <div
                        key={b.id}
                        className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <HardDrive className="w-4 h-4 text-emerald-700 shrink-0" />
                          <div>
                            <div className="font-mono font-bold text-slate-800 text-[11px] truncate max-w-[240px]">
                              {b.name}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>📅 {dateFormatted}</span>
                              {b.size && <span>• {(Number(b.size) / 1024).toFixed(1)} KB</span>}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRestoreBackup(b.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                              >
                                تأكيد الاستعادة
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] transition cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(b.id)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <DownloadCloud className="w-3.5 h-3.5 text-blue-600" />
                              <span>استعادة هذه النسخة</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Retention & Anti-Data Loss Notice */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-slate-700 text-xs flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#007A5A] mt-0.5 shrink-0" />
            <div>
              <strong className="text-slate-900 block font-bold mb-0.5">ضمان استبقاء البيانات وعدم الفقدان:</strong>
              يتم حفظ كافة تعديلات الأسعار للموردين ونسب الهوامش تلقائياً في التخزين المحلي وقاعدة البيانات المركزية.
              عند ربط حساب Google Drive، يتم عمل نسخ سحابية مباشرة على مساحتك الشخصية لحماية دائمة ومستمرة حتى بعد مسح الذاكرة المؤقتة للمتصفح.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
