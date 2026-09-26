import React, { useState, useEffect } from 'react';
import { User, UserRole, ROLE_CONFIGS } from '../types';
import { X, Shield, UserPlus, Trash2, Mail, Phone, Key, Lock, CheckCircle2, AlertCircle, Copy, Check, MessageSquare, ExternalLink, Globe } from 'lucide-react';
import { buildAppUrl, getPlatformBaseUrl } from '../utils/dynamicRouter';
import { getAllUsers } from '../utils/authService';

interface ProjectPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentUser: User;
}

export const ProjectPermissionsModal: React.FC<ProjectPermissionsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentUser,
}) => {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('engineer');
  const [appUrl, setAppUrl] = useState<string>(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const [sharing, setSharing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    tempPassword: string;
    url?: string;
    welcomeMessage?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchPermissions();
    }
  }, [isOpen, projectId]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/permissions`);
      const data = await res.json();
      if (data.success) {
        setPermissions(data.permissions || []);
      }
    } catch (err) {
      console.error('Failed to load project permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSharing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setCreatedCredentials(null);

    try {
      const res = await fetch('/api/projects/permissions/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email,
          phone,
          role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم إنشاء وتفعيل الصلاحية واعتماد بيانات الدخول بنجاح!`);
        if (data.credentials) {
          const directUrl = `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/?tab=projects&project=${projectId}`;
          setCreatedCredentials({
            ...data.credentials,
            url: directUrl,
          });
        }
        setEmail('');
        setPhone('');
        fetchPermissions();
        // Immediately sync user list locally
        getAllUsers();
      } else {
        setErrorMsg(data.error || 'فشل منح الصلاحية');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = async (permissionId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في سحب وحذف هذه الصلاحية نهائياً؟')) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/projects/permissions/admin-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionId,
          adminUserId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'تم حذف الصلاحية بنجاح بواسطة المشرف.');
        fetchPermissions();
      } else {
        setErrorMsg(data.error || 'فشل حذف الصلاحية');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ في الاتصال بالخادم');
    }
  };

  if (!isOpen) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">إدارة صلاحيات وفريق المشروع</h2>
              <p className="text-xs text-slate-400 truncate max-w-md">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Newly created credentials box */}
          {createdCredentials && (
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-teal-500/20 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>بيانات الاعتماد ورابط الدخول المعتمد (جاهز للإرسال):</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveUrl = `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/?tab=projects&project=${projectId}`;
                      const msg = createdCredentials.welcomeMessage || `السلام عليكم ورحمة الله وبركاته،\nتم تفعيل حسابكم في منصة إدارة مشاريع مؤسسة صناع الموارد التجارية (RMT):\n\n▪️ اسم المستخدم: ${createdCredentials.username}\n▪️ كلمة المرور: ${createdCredentials.tempPassword}\n▪️ رابط الدخول للمنصة:\n${effectiveUrl}`;
                      navigator.clipboard.writeText(msg);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم نسخ الرسالة بالكامل' : 'نسخ الرسالة والرابط'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const effectiveUrl = `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/?tab=projects&project=${projectId}`;
                      const msg = createdCredentials.welcomeMessage || `السلام عليكم ورحمة الله وبركاته،\nتم تفعيل حسابكم في منصة إدارة مشاريع مؤسسة صناع الموارد التجارية (RMT):\n\n▪️ اسم المستخدم: ${createdCredentials.username}\n▪️ كلمة المرور: ${createdCredentials.tempPassword}\n▪️ رابط الدخول للمنصة:\n${effectiveUrl}`;
                      const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
                      const waUrl = cleanPhone
                        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
                        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                      window.open(waUrl, '_blank');
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>إرسال واتساب</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div>اسم المستخدم: <span className="text-teal-400 font-bold">{createdCredentials.username}</span></div>
                <div>كلمة المرور: <span className="text-amber-400 font-bold">{createdCredentials.tempPassword}</span></div>
              </div>

              {/* Direct Live URL Display */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-teal-400" />
                    <span>رابط الدخول المباشر للمنصة والمشروع (الرابط الفعال):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveUrl = `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/?tab=projects&project=${projectId}`;
                      navigator.clipboard.writeText(createdCredentials.url || effectiveUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="text-[10px] text-teal-400 hover:text-teal-300 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'تم نسخ الرابط' : 'نسخ الرابط'}</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 break-all select-all bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                  {createdCredentials.url || `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/?tab=projects&project=${projectId}`}
                </div>
              </div>
            </div>
          )}

          {/* Add / Share Form */}
          <form onSubmit={handleShare} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-teal-400" />
              <span>منح وصلاحية جديدة لمستخدم جديد على المشروع</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">البريد الإلكتروني *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@rmt-mep.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">رقم الجوال (اختياري)</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 5..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">صلاحية الرتبة *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="admin">مشرف عام (Admin)</option>
                  <option value="pm">مدير مشاريع (PM)</option>
                  <option value="procurement">مسؤول مشتريات (Procurement)</option>
                  <option value="engineer">مهندس موقع (Engineer)</option>
                  <option value="viewer">مشاهد / مدقق (Viewer)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={sharing}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{sharing ? 'جاري الإصدار...' : 'حفظ وإرسال بيانات الدخول'}</span>
              </button>
            </div>
          </form>

          {/* Permissions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>فريق العمل وصلاحيات المشروع الحالية</span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{permissions.length}</span>
            </h3>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">جاري تحميل الصلاحيات...</div>
            ) : permissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                لا توجد صلاحيات مخصصة مسجلة لهذا المشروع حتى الآن.
              </div>
            ) : (
              <div className="space-y-2">
                {permissions.map((p) => {
                  const roleConfig = ROLE_CONFIGS[p.role as UserRole] || ROLE_CONFIGS.viewer;
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{p.email}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${roleConfig.badgeClass}`}>
                            {roleConfig.titleAr}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          {p.phone && <span>📞 {p.phone}</span>}
                          {p.username && <span className="font-mono">👤 {p.username}</span>}
                          <span className="text-[10px] text-slate-500">تم التحديث: {new Date(p.updated_at || Date.now()).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition cursor-pointer"
                        title="حذف الصلاحية (مقتصر على المشرف)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
