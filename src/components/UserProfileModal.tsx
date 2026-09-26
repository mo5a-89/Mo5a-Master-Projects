import React, { useState } from 'react';
import { User, ROLE_CONFIGS } from '../types';
import { apiUpdateProfile, apiChangePassword } from '../utils/authService';
import {
  X,
  User as UserIcon,
  Mail,
  Building,
  Briefcase,
  Phone,
  Camera,
  Upload,
  CheckCircle,
  Shield,
  LogOut,
  Save,
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (updatedUser: User) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [fullName, setFullName] = useState(user.fullName);
  const [department, setDepartment] = useState(user.department);
  const [jobTitle, setJobTitle] = useState(user.jobTitle);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  if (!isOpen) return null;

  const roleConfig = ROLE_CONFIGS[user.role] || ROLE_CONFIGS.viewer;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const updated: User = {
      ...user,
      fullName,
      department,
      jobTitle,
      phone,
      avatarUrl,
    };

    try {
      const res = await apiUpdateProfile(updated);
      if (res.success && res.user) {
        onUserUpdated(res.user);
        setSuccessMsg('تم حفظ وتحديث بيانات الملف الشخصي بنجاح!');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      setErrorMsg('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('يجب أن تتكون كلمة المرور من 6 خانات أو أكثر');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين، يرجى التأكد');
      return;
    }

    setIsChangingPass(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiChangePassword(user.id, newPassword);
      if (res.success) {
        if (res.user) {
          onUserUpdated(res.user);
        }
        setSuccessMsg('تم تغيير وتعيين كلمة المرور بنجاح وتحديث جلسة الدخول!');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || 'فشل تحديث كلمة المرور');
      }
    } catch (err) {
      setErrorMsg('حدث خطأ أثناء تحديث كلمة المرور');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div className="bg-[#0B1329] border border-slate-700/80 text-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0F2338] via-[#0B1329] to-[#0F2338]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">إعدادات الحساب والملف الشخصي</h2>
              <p className="text-xs text-slate-400">إدارة الهوية، الصلاحيات، وكلمة المرور المرتبطة بالبريد</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>البيانات الشخصية والمهنية</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'security'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>كلمة المرور والأمان (Password)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'profile' ? (
            <>
              {/* Avatar & Role Preview Card */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="relative group shrink-0">
                  <img
                    src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                    alt={fullName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
                  />
                  <label className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center cursor-pointer text-white text-[10px]">
                    <Camera className="w-5 h-5 mb-0.5 text-emerald-400" />
                    <span>تغيير الصورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1 text-center sm:text-right flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-base font-black text-white">{fullName}</h3>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleConfig.badgeClass}`}>
                      {roleConfig.titleAr}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono">{user.email}</span>
                  </p>
                  <div className="text-[11px] text-emerald-400/90 font-medium">
                    {roleConfig.descriptionAr}
                  </div>
                </div>
              </div>

              {/* Edit Profile Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      الاسم الكامل (Full Name)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      القسم / الإدارة (Department)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      المسمى الوظيفي (Job Title)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      رقم الهاتف (Mobile / Phone)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
                      />
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>
                </div>

                {/* System Info Readonly */}
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>اسم المستخدم للنظام:</span>
                    <span className="font-mono text-white font-bold">{user.username}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>البريد الإلكتروني المعتمد لتسجيل الدخول:</span>
                    <span className="font-mono text-emerald-400 font-bold">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>تاريخ آخر تسجيل دخول:</span>
                    <span className="font-mono text-slate-300">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ar-SA') : 'الآن'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-3.5 py-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-500/30 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      إغلاق
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            /* Security & Password Tab */
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Linked Email Banner */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>البريد الإلكتروني الموثق لاستعادة وتفعيل الحساب:</span>
                </div>
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-mono text-sm font-bold text-white">{user.email}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    موثق ومفعل ✓
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  حسابك مربوط مباشرة بهذا البريد الإلكتروني. في حال فقدان كلمة المرور، يمكنك استعادتها فوراً عبر شاشة تسجيل الدخول بإدخال بريدك الإلكتروني لتوليد رمز الاستعادة.
                </p>
              </div>

              {/* Set New Password */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>تغيير أو تعيين كلمة مرور جديدة:</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    كلمة المرور الجديدة (New Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الجديدة (6 خانات على الأقل)"
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    تأكيد كلمة المرور الجديدة (Confirm Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور للتأكيد"
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Password Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isChangingPass ? 'جاري التحديث...' : 'تحديث كلمة المرور'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
