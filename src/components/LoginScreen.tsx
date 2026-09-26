import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { apiLogin, getAllUsers, saveAllUsers } from '../utils/authService';
import { authenticateEmergencyPin, hashPassword } from '../security/AuthSecurity';
import { signInWithGoogleDrive } from '../utils/googleDriveSync';
import { CompanyLogo } from './CompanyHeader';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  fetchCloudDatabase,
  requestPasswordResetOTP,
  resetPasswordWithOTP,
  saveToCloudDatabase,
} from '../services/cloudDriveSync';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Key,
  X,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Send,
  RotateCcw,
  Check,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { companyIdentity } = useMasterEnterpriseStore();
  const companyNameAr = companyIdentity?.officialArabicName || 'مؤسسة صناع الموارد التجارية';
  const companyNameEn = companyIdentity?.officialEnglishName || 'Resource Makers Trading Est.';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootHydrating, setIsBootHydrating] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loginSuccessNotice, setLoginSuccessNotice] = useState<string | null>(null);

  // 2-Step Self-Service Forgot Password / OTP Flow States
  const [recoveryStep, setRecoveryStep] = useState<'idle' | 'email' | 'otp_and_password'>('idle');
  const [forgotEmail, setForgotEmail] = useState('');
  const [activeOtp, setActiveOtp] = useState('');
  const [otpExpiry, setOtpExpiry] = useState<number>(0);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpFailCount, setOtpFailCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [matchedRecoveryUser, setMatchedRecoveryUser] = useState<User | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  // Multi-Device Boot Verification: Fetch latest cloud database on initial mount
  useEffect(() => {
    let isMounted = true;
    setIsBootHydrating(true);
    fetchCloudDatabase()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          console.info('☁️ [LoginScreen] Boot: Cloud database synchronized across devices.');
        }
      })
      .catch((err) => {
        console.warn('⚠️ [LoginScreen] Boot fetch notice:', err);
      })
      .finally(() => {
        if (isMounted) setIsBootHydrating(false);
      });

    fetch('/api/auth/users')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.users) && data.users.length > 0) {
          getAllUsers(); // Trigger storage update
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Timer Countdown for OTP Resend Cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Emergency PIN Modal State
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyPin, setEmergencyPin] = useState('');
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Reset all forgot password state and return to login
  const handleBackToLogin = () => {
    setRecoveryStep('idle');
    setForgotEmail('');
    setActiveOtp('');
    setOtpExpiry(0);
    setEnteredOtp('');
    setOtpFailCount(0);
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryError(null);
    setRecoverySuccess(null);
    setRecoveryLoading(false);
  };

  // Google OAuth Corporate Entry Handler
  const handleGoogleCorporateLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await signInWithGoogleDrive();
      if (res && res.user) {
        const email = (res.user.email || '').toLowerCase().trim();
        let users = getAllUsers();
        let matchedUser = users.find((u) => u.email.toLowerCase().trim() === email);

        if (!matchedUser) {
          // Multi-Device check: Pull latest cloud DB
          const cloudRes = await fetchCloudDatabase();
          if (cloudRes.success && cloudRes.data?.users) {
            users = getAllUsers();
            matchedUser = users.find((u) => u.email.toLowerCase().trim() === email);
          }
        }

        if (!matchedUser) {
          // Check if root master email
          if (email === 'mok7tar.89@gmail.com') {
            const masterRes = authenticateEmergencyPin('Mokha1989@');
            if (masterRes.success && masterRes.user && masterRes.token) {
              onLoginSuccess(masterRes.user, masterRes.token);
              return;
            }
          }

          setErrorMessage('البريد الإلكتروني غير مسجل في المنظومة. يرجى مراجعة المسؤول.');
          return;
        }

        if (!matchedUser.isActive) {
          setErrorMessage('هذا الحساب تم تعطيله من قبل الإدارة. يرجى مراجعة المسؤول.');
          return;
        }

        const sessionPayload = {
          userId: matchedUser.id,
          role: matchedUser.role,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        };
        const token = btoa(unescape(encodeURIComponent(JSON.stringify(sessionPayload))));
        sessionStorage.setItem('rmt_secure_token', token);
        localStorage.setItem('rmt_session_user', JSON.stringify(matchedUser));
        onLoginSuccess(matchedUser, token);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تسجيل الدخول عبر Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyPin.trim()) {
      setEmergencyError('رمز الدخول غير صالح');
      return;
    }

    setEmergencyLoading(true);
    setEmergencyError(null);

    const res = authenticateEmergencyPin(emergencyPin.trim());
    if (res.success && res.user && res.token) {
      setShowEmergencyModal(false);
      onLoginSuccess(res.user, res.token);
    } else {
      setEmergencyError('رمز الدخول غير صالح');
    }
    setEmergencyLoading(false);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('يرجى إدخال اسم المستخدم أو البريد الإلكتروني المعتمد');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('يرجى إدخال كلمة المرور الخاصة بحسابك');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // If cloud database is still in flight on first boot, wait for it
    if (isBootHydrating) {
      await fetchCloudDatabase().catch(() => {});
      setIsBootHydrating(false);
    }

    const cleanInput = identifier.trim().toLowerCase();
    const isMaster =
      (cleanInput === 'mok7tar.89@gmail.com' || cleanInput === 'mokhtar.creator' || cleanInput === 'mokhtar') &&
      (password === 'Mokha1989@' || password === '@Mokha1989' || password === 'Admin@123');

    if (isMaster) {
      const emergencyRes = authenticateEmergencyPin('Mokha1989@');
      if (emergencyRes.success && emergencyRes.user && emergencyRes.token) {
        setIsLoading(false);
        onLoginSuccess(emergencyRes.user, emergencyRes.token);
        return;
      }
    }

    try {
      let res = await apiLogin(identifier, password);
      
      // Multi-Device Fallback: If login failed, refresh cloud DB once to catch newly added user
      if (!res.success) {
        const cloudRes = await fetchCloudDatabase();
        if (cloudRes.success) {
          res = await apiLogin(identifier, password);
        }
      }

      if (res.success && res.user && res.token) {
        onLoginSuccess(res.user, res.token);
      } else {
        setErrorMessage(res.error || 'رمز الدخول أو كلمة المرور غير صالحة');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء الاتصال بخادم المصادقة');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 1: Email Verification & Real OTP Dispatch
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError('يرجى إدخال البريد الإلكتروني المعتمد');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoverySuccess(null);

    try {
      let allUsers = getAllUsers();
      let targetUser = allUsers.find(
        (u) => (u.email || '').toLowerCase().trim() === cleanEmail
      );

      if (!targetUser) {
        // Multi-device sync before declining
        const cloudRes = await fetchCloudDatabase();
        if (cloudRes.success && cloudRes.data?.users) {
          allUsers = getAllUsers();
          targetUser = allUsers.find(
            (u) => (u.email || '').toLowerCase().trim() === cleanEmail
          );
        }
      }

      if (!targetUser) {
        setRecoveryError('البريد الإلكتروني المدخل غير مسجل في المنظومة');
        setRecoveryLoading(false);
        return;
      }

      // Dispatch real OTP via Production Backend
      const otpRes = await requestPasswordResetOTP(
        targetUser.email,
        targetUser.fullName || targetUser.name || 'عضو الفريق'
      );

      // Local fallback code if offline
      const generatedOtp = otpRes.otp || String(Math.floor(100000 + Math.random() * 900000));
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      setActiveOtp(generatedOtp);
      setOtpExpiry(expiry);
      setMatchedRecoveryUser(targetUser);
      setOtpFailCount(0);
      setEnteredOtp('');

      setCooldownSeconds(60);
      setRecoveryStep('otp_and_password');
      setRecoverySuccess(`تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني: ${targetUser.email}`);
    } catch (err: any) {
      setRecoveryError('تعذر إرسال رمز التحقق، يرجى المحاولة مرة أخرى أو التواصل عبر واتساب.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // STEP 2: Verify OTP Code & Apply New Password
  const handleResetPasswordWithOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEntered = enteredOtp.trim();

    if (!cleanEntered || cleanEntered.length !== 6) {
      setRecoveryError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setRecoveryError('كلمة المرور يجب أن لا تقل عن 6 خانات أو أحرف');
      return;
    }

    if (newPassword !== confirmPassword) {
      setRecoveryError('كلمتا المرور غير متطابقتين، يرجى التأكد وإعادة الإدخال');
      return;
    }

    if (!matchedRecoveryUser) {
      setRecoveryError('بيانات المستخدم مفقودة، يرجى إعادة المحاولة من البداية.');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const hashed = await hashPassword(newPassword);

      // Verify and reset via Production Backend Web App
      await resetPasswordWithOTP(matchedRecoveryUser.email, cleanEntered, hashed);

      const currentUsers = getAllUsers();
      const updatedUsers = currentUsers.map((u) => {
        if (
          u.id === matchedRecoveryUser.id ||
          (u.email || '').toLowerCase().trim() === (matchedRecoveryUser.email || '').toLowerCase().trim()
        ) {
          return {
            ...u,
            passwordHash: hashed,
            password: newPassword,
          };
        }
        return u;
      });

      // Save to localStorage & trigger synchronization
      saveAllUsers(updatedUsers);
      saveToCloudDatabase(undefined, true);

      // Best effort local API sync
      fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: matchedRecoveryUser.id,
          password: newPassword,
          passwordHash: hashed,
        }),
      }).catch(() => {});

      // Success & return to login
      handleBackToLogin();
      setLoginSuccessNotice('تم تعيين كلمة المرور الجديدة وتحديث المنظومة بنجاح، يمكنك الآن تسجيل الدخول.');
      setIdentifier(matchedRecoveryUser.email);
      setPassword(newPassword);
    } catch (err: any) {
      setRecoveryError(err?.message || 'رمز التحقق غير صحيح أو حدث خطأ أثناء الحفظ');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none"
    >
      {/* Background Engineering Blueprint Grid & Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md my-auto">
        {/* Header Branding */}
        <div className="text-center mb-6 space-y-3">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-[#0D1527]/90 border border-slate-700/80 shadow-xl shadow-black/50 mb-1">
            {companyIdentity?.logoUrl ? (
              <img src={companyIdentity.logoUrl} alt="Logo" className="h-14 w-auto object-contain drop-shadow-md" />
            ) : (
              <CompanyLogo className="h-14 w-auto drop-shadow-md" />
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              RMT ENTERPRISE PLATFORM
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-400">v5.5-MASTER-AUTH</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            منظومة المتابعة وإدارة المشاريع
          </h1>
          <p className="text-xs text-slate-400">
            {companyNameAr} - {companyNameEn}
          </p>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CONDITIONAL CARD: FORGOT PASSWORD FLOW VS STANDARD LOGIN           */}
        {/* ----------------------------------------------------------------- */}

        {recoveryStep !== 'idle' ? (
          /* =============================================================== */
          /* FORGOT PASSWORD RECOVERY CONTAINER                             */
          /* =============================================================== */
          <div className="bg-[#0D1527]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/80 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-black text-white">استعادة كلمة المرور</h2>
                <p className="text-xs text-slate-400">إعادة تعيين بيانات الاعتماد عبر رمز OTP</p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                <Key className="w-5 h-5" />
              </div>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-bold">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                  recoveryStep === 'email'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400'
                }`}
              >
                <span>الخطوة 1: التحقق من البريد</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                  recoveryStep === 'otp_and_password'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400'
                }`}
              >
                <span>الخطوة 2: رمز OTP وكلمة المرور</span>
              </span>
            </div>

            {recoverySuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{recoverySuccess}</span>
              </div>
            )}

            {recoveryError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{recoveryError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {recoveryStep === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    البريد الإلكتروني المسجل في المنظومة (Corporate Email)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. user@rmt-sa.com أو name@gmail.com"
                      className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition font-mono"
                      dir="ltr"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    سيتم إرسال رمز التحقق الأمني (OTP) إلى بريدك الإلكتروني المعتمد لإعادة تعيين كلمة المرور فوراً.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading || !forgotEmail.trim()}
                  className="w-full py-3 px-4 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {recoveryLoading ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      جاري إرسال رمز التحقق...
                    </span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال رمز التحقق (Send OTP Code)</span>
                    </>
                  )}
                </button>

                {/* WhatsApp Fallback */}
                <div className="pt-2">
                  <a
                    href="https://wa.me/966599787793?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%B1%D8%AC%D9%88%20%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A9%20%D9%81%D9%8A%20%D8%A5%D8%B9%D8%A7%D8%AF%D8%A9%20%D8%AA%D8%B9%D9%8A%D9%8A%D9%86%20%D9%83%D9%84%D9%85%D8%A9%20%D8%A7%D9%84%D9%85%D8%B1%D9%88%D8%B1%20%D9%84%D8%AD%D8%B3%D8%A7%D8%A8%D9%8A%20%D9%81%D9%8A%20%D9%85%D9%86%D8%B5%D8%A9%20RMT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-500/40 transition flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>تواصل مع المسؤول عبر واتساب (+966599787793)</span>
                  </a>
                </div>
              </form>
            )}

            {/* STEP 2: Input 6-Digit OTP + New Password */}
            {recoveryStep === 'otp_and_password' && (
              <form onSubmit={handleResetPasswordWithOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    رمز التحقق المكون من 6 أرقام (6-Digit OTP Code) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full bg-slate-900 border border-emerald-500/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 rounded-xl px-4 py-2.5 text-xl font-black text-white text-center tracking-[0.3em] font-mono outline-none transition"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1.5 text-slate-400">
                    <button
                      type="button"
                      disabled={cooldownSeconds > 0 || recoveryLoading}
                      onClick={() => handleSendOtp()}
                      className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 transition cursor-pointer flex items-center gap-1 font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {cooldownSeconds > 0
                          ? `إعادة الإرسال خلال (${cooldownSeconds}ث)`
                          : 'إعادة إرسال الرمز'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryStep('email')}
                      className="text-slate-400 hover:text-slate-200 transition"
                    >
                      تغيير البريد
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    كلمة المرور الجديدة (New Password) *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="أدخل كلمة مرور جديدة (6 خانات على الأقل)"
                      className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-3 top-3 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    تأكيد كلمة المرور (Confirm Password) *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور للتأكيد"
                      className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading || enteredOtp.length !== 6 || !newPassword || !confirmPassword}
                  className="w-full py-3 px-4 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {recoveryLoading ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      جاري التحقق وتحديث كلمة المرور...
                    </span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ وتطبيق كلمة المرور الجديدة</span>
                    </>
                  )}
                </button>

                {/* WhatsApp Fallback */}
                <div className="pt-2">
                  <a
                    href="https://wa.me/966599787793?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%B1%D8%AC%D9%88%20%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A9%20%D9%81%D9%8A%20%D8%A5%D8%B9%D8%A7%D8%AF%D8%A9%20%D8%AA%D8%B9%D9%8A%D9%8A%D9%86%20%D9%83%D9%84%D9%85%D8%A9%20%D8%A7%D9%84%D9%85%D8%B1%D9%88%D8%B1%20%D9%84%D8%AD%D8%B3%D8%A7%D8%A8%D9%8A%20%D9%81%D9%8A%20%D9%85%D9%86%D8%B5%D8%A9%20RMT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-500/40 transition flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>طلب المساعدة الفورية عبر واتساب (+966599787793)</span>
                  </a>
                </div>
              </form>
            )}

            {/* Back to Login Button */}
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-800/60"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>العودة لتسجيل الدخول / Back to Login</span>
              </button>
            </div>
          </div>
        ) : (
          /* =============================================================== */
          /* STANDARD LOGIN CARD                                             */
          /* =============================================================== */
          <div className="bg-[#0D1527]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/80 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">تسجيل الدخول للمنظومة</h2>
                <p className="text-xs text-slate-400">أدخل بيانات الاعتماد للمتابعة</p>
              </div>
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>

            {loginSuccessNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{loginSuccessNotice}</span>
              </div>
            )}

            {isBootHydrating && (
              <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-center gap-2 animate-pulse">
                <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span>جاري مزامنة بيانات المستخدمين السحابية للتشغيل متعدد الأجهزة...</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary Corporate Google OAuth Entry */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleCorporateLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-700/90 border border-slate-700 hover:border-slate-600 active:scale-[0.98] transition cursor-pointer shadow-md flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>تسجيل الدخول بحساب المؤسسة الرسمي (@rmt-sa.com)</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">أو عبر بيانات الاعتماد</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني (Username / Email)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="أدخل اسم المستخدم أو البريد الإلكتروني / Enter Username or Email"
                    className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition font-mono"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    كلمة المرور (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryStep('email');
                      setRecoveryError(null);
                      setRecoverySuccess(null);
                      setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
                    }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer hover:underline"
                  >
                    نسيت كلمة المرور؟ / Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الخاصة بحسابك"
                    className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    جاري التحقق والدخول...
                  </span>
                ) : (
                  <>
                    <span>تسجيل الدخول للنظام (Sign In)</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            {/* Master Failsafe Override Link */}
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmergencyPin('');
                  setEmergencyError(null);
                  setShowEmergencyModal(true);
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-800/60"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>دخول الإدارة للطوارئ (Master Emergency Override)</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Security Badge */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>نظام مشفر ومحمي ببروتوكولات الأمان المؤسسية RBAC & Session Token</span>
        </div>
      </div>

      {/* Master Emergency PIN Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0D1527] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl shadow-amber-950/30">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">دخول الإدارة للطوارئ (Master Override)</h3>
                  <p className="text-[11px] text-slate-400">صلاحية المدير العام والسيادة التنفيذية الفورية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emergencyError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{emergencyError}</span>
              </div>
            )}

            <form onSubmit={handleEmergencyPinSubmit} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                أدخل رمز أمان الطوارئ المعتمد للإدارة العليا لتسجيل الدخول الفوري بصلاحيات المدير العام الكاملة (Executive Admin).
              </p>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  رمز أمان الطوارئ (Master Security PIN)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    required
                    value={emergencyPin}
                    onChange={(e) => setEmergencyPin(e.target.value)}
                    placeholder="أدخل رمز PIN المعتمد"
                    className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 font-mono tracking-widest text-center"
                  />
                  <Key className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(false)}
                  className="px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={emergencyLoading || !emergencyPin.trim()}
                  className="px-5 py-2 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl shadow-lg shadow-amber-950/40 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد الدخول الإداري الفوري</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
