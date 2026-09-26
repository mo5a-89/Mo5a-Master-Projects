import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Type,
  Palette,
  Sun,
  Moon,
  Globe,
  Check,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Upload,
  Trash2,
  Send,
  Radio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bot,
  Zap,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { telegramBridge } from '../services/TelegramBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, t } = useSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'appearance' | 'telegram'>('appearance');

  // Telegram Bridge state
  const [botToken, setBotToken] = useState(() => {
    try {
      const cfg = localStorage.getItem('rmt_telegram_config');
      if (cfg) {
        const parsed = JSON.parse(cfg);
        return parsed.botToken || '';
      }
      return localStorage.getItem('rmt_telegram_bot_token') || '';
    } catch {
      return '';
    }
  });

  const [chatId, setChatId] = useState(() => {
    try {
      const cfg = localStorage.getItem('rmt_telegram_config');
      if (cfg) {
        const parsed = JSON.parse(cfg);
        return (parsed.authorizedChatIds && parsed.authorizedChatIds[0]) || '';
      }
      return localStorage.getItem('rmt_telegram_chat_id') || '';
    } catch {
      return '';
    }
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    botInfo?: any;
    latencyMs?: number;
    pingSent?: boolean;
    error?: string;
  } | null>(null);

  const [currentLogo, setCurrentLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('rmt_company_logo');
    } catch {
      return null;
    }
  });

  if (!isOpen) return null;

  const fontOptions = [
    {
      id: 'Cairo',
      name: 'خط القاهرة (Cairo - الأساسي)',
      css: "'Cairo', sans-serif",
      sub: 'الخط القياسي المعتمد لمخططات ومواصفات MEP',
      preview: 'مؤسسة صناع الموارد التجارية - RMT',
    },
    {
      id: 'Tajawal',
      name: 'خط تجوال (Tajawal - العصري)',
      css: "'Tajawal', sans-serif",
      sub: 'خط هندسي ناعم ومريح للقراءة السريعة',
      preview: 'مؤسسة صناع الموارد التجارية - RMT',
    },
    {
      id: 'IBM Plex Sans Arabic',
      name: 'آي بي إم بلكس (IBM Plex - التقني)',
      css: "'IBM Plex Sans Arabic', sans-serif",
      sub: 'خط تقني هندسي عالي الدقة (Enterprise Tech)',
      preview: 'مؤسسة صناع الموارد التجارية - RMT',
    },
    {
      id: 'Almarai',
      name: 'خط المراعي (Almarai - المؤسسي)',
      css: "'Almarai', sans-serif",
      sub: 'خط عربي معاصر متوازن جداً للجداول والأرقام',
      preview: 'مؤسسة صناع الموارد التجارية - RMT',
    },
    {
      id: 'Alexandria',
      name: 'خط ألكسندريا (Alexandria - الفاخر)',
      css: "'Alexandria', sans-serif",
      sub: 'خط هندسي عصري فائق الحداثة (Ultra-Modern SaaS)',
      preview: 'مؤسسة صناع الموارد التجارية - RMT',
    },
  ];

  const handleFontSelect = (fontId: string) => {
    let fontCSS = "'Cairo', sans-serif";
    if (fontId === 'Alexandria') fontCSS = "'Alexandria', sans-serif";
    else if (fontId === 'Almarai') fontCSS = "'Almarai', sans-serif";
    else if (fontId === 'Tajawal') fontCSS = "'Tajawal', sans-serif";
    else if (fontId === 'IBM Plex Sans Arabic') fontCSS = "'IBM Plex Sans Arabic', sans-serif";
    else if (fontId === 'Cairo') fontCSS = "'Cairo', sans-serif";

    // 1. Update State
    updateSettings({ fontFamily: fontId as any });

    // 2. Direct Root & Body DOM application
    document.documentElement.style.fontFamily = fontCSS;
    document.body.style.fontFamily = fontCSS;
    document.documentElement.style.setProperty('--app-font-family', fontCSS);

    // 3. Persist to storage
    try {
      localStorage.setItem('rmt_font_family', fontId);
      const raw = localStorage.getItem('rmt_enterprise_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.fontFamily = fontId;
        localStorage.setItem('rmt_enterprise_settings', JSON.stringify(parsed));
      }
    } catch (e) {
      console.error('Failed to persist font choice:', e);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة يجب أن لا يتجاوز 2 ميجابايت لضمان سرعة التحميل');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64String = uploadEvent.target?.result as string;
      if (base64String) {
        setCurrentLogo(base64String);
        try {
          localStorage.setItem('rmt_company_logo', base64String);
          window.dispatchEvent(new Event('rmt_logo_updated'));
        } catch (err) {
          console.error('Failed to store company logo base64:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCurrentLogo(null);
    try {
      localStorage.removeItem('rmt_company_logo');
      window.dispatchEvent(new Event('rmt_logo_updated'));
    } catch {}
  };

  const handleDensitySelect = (density: 'compact' | 'normal' | 'large') => {
    updateSettings({ uiDensity: density });
  };

  // Connection Test & Ping Handler
  const handleRunPingTest = async () => {
    if (!botToken.trim()) {
      setTestResult({
        success: false,
        message: 'يرجى إدخال رمز بوت التليجرام (Telegram Bot Token) أولاً.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Save token and chat id locally
    try {
      telegramBridge.updateToken(botToken.trim());
      const currentConfig = telegramBridge.getConfig();
      currentConfig.botToken = botToken.trim();
      if (chatId.trim()) {
        currentConfig.authorizedChatIds = [chatId.trim()];
      }
      telegramBridge.saveConfigToStorage(currentConfig);
      localStorage.setItem('rmt_telegram_bot_token', botToken.trim());
      if (chatId.trim()) {
        localStorage.setItem('rmt_telegram_chat_id', chatId.trim());
      }
    } catch (e) {
      console.error('Failed to save telegram config:', e);
    }

    try {
      const result = await telegramBridge.testConnection({
        customToken: botToken.trim(),
        chatId: chatId.trim() || undefined,
        sendPingMessage: Boolean(chatId.trim()),
      });

      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `تعذر تنفيذ فحص الاتصال: ${err.message || 'خطأ غير معروف'}`,
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#174A84]/10 dark:bg-sky-950/60 text-[#174A84] dark:text-sky-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                إعدادات المنظومة وتكامل البوت التنفيذي
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                الهوية والمظهر وفحص اتصال Telegram Bot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-[#174A84] text-[#174A84] dark:text-sky-400 dark:border-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>المظهر والهوية المؤسسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'telegram'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400 dark:border-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>فحص اتصال التليجرام (Connection Ping Test)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {activeTab === 'appearance' ? (
            <>
              {/* 1. Custom Company Logo Upload */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
                    شعار المؤسسة المعتمد (Official Corporate Logo)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                    Base64 حفظ فوري
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                      {currentLogo ? (
                        <img src={currentLogo} alt="Uploaded Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-400 font-bold text-center">شعار افتراضي</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {currentLogo ? 'تم تفعيل الشعار المخصص بنجاح' : 'يتم استخدام شعار RMT الافتراضي'}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        يظهر تلقائياً في الشريط العلوي، القائمة الجانبية، ومطبوعات PDF.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>{currentLogo ? 'تغيير الشعار' : 'رفع شعار جديد'}</span>
                    </button>
                    {currentLogo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 transition cursor-pointer"
                        title="استعادة الشعار الافتراضي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Font Selection Engine (4 Real Arabic Fonts) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-[#007A5A] dark:text-emerald-400" />
                    الخط العربي المعتمد (Active Typography Engine)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    تطبيق فوري مباشر
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fontOptions.map((font) => {
                    const isSelected = settings.fontFamily === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => handleFontSelect(font.id)}
                        className={`p-3.5 rounded-xl border text-right transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-[#007A5A] dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-[#007A5A]/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                        }`}
                        style={{ fontFamily: font.css }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {font.name}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#007A5A] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-normal">
                          {font.sub}
                        </p>
                        <div className="p-2 rounded-lg bg-slate-100/70 dark:bg-slate-900/70 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80">
                          {font.preview}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. UI Scale / Density */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  كثافة واجهة المستخدم (UI Density)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'compact', label: 'مضغوط (Compact - 95%)', desc: 'لشاشات اللابتوب الصغيرة' },
                    { id: 'normal', label: 'افتراضي (Standard - 100%)', desc: 'المقاس القياسي الموصى به' },
                    { id: 'large', label: 'موسع (Large - 105%)', desc: 'وضوح فائق وقراءة سهلة' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleDensitySelect(d.id as any)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                        settings.uiDensity === d.id
                          ? 'border-[#174A84] dark:border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-[#174A84] dark:text-sky-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: Dedicated Telegram Connection Test Utility */
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-transparent border border-sky-200 dark:border-sky-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      أداة فحص اتصال البوت التنفيذي (Telegram Connection & Ping Test)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      التحقق من صحة Token وإرسال رسالة Ping تفاعلية فورية لاختبار زمن الاستجابة والتكامل
                    </p>
                  </div>
                </div>
              </div>

              {/* Bot Credentials Form */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-sky-600" />
                      رمز بوت التليجرام (Telegram Bot Token)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">من @BotFather</span>
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="مثال: 7891234567:AAFl0zVv7..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-emerald-600" />
                      معرف المحادثة للاختبار (Chat ID - اختياري لإرسال Ping)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">من @userinfobot</span>
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="مثال: 123456789 أو -100123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRunPingTest}
                    disabled={isTesting}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري فحص الاتصال وإرسال Ping...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>فحص الاتصال وإرسال Ping (Test Connection)</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    {chatId.trim() ? 'سيتم إرسال رسالة تجريبية لتليجرام' : 'سيتم فحص صحة الرمز والاتصال بالخادم'}
                  </span>
                </div>

                {/* Live Test Results Card */}
                {testResult && (
                  <div
                    className={`p-4 rounded-2xl border transition-all animate-in fade-in ${
                      testResult.success
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1.5 flex-1">
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{testResult.success ? 'نجاح اختبار الاتصال والتكامل ✅' : 'فشل الاتصال ⚠️'}</span>
                          {testResult.latencyMs !== undefined && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                              ⚡ {testResult.latencyMs} ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed">{testResult.message}</p>

                        {testResult.botInfo && (
                          <div className="mt-2 p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-900/60 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">اسم البوت:</span>
                              <span className="font-bold text-slate-800 dark:text-white">@{testResult.botInfo.username}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">الاسم المعروض:</span>
                              <span className="font-bold text-slate-800 dark:text-white">{testResult.botInfo.first_name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">معرف البوت ID:</span>
                              <span className="font-bold text-slate-800 dark:text-white">{testResult.botInfo.id}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>RMT Security & Telegram Bridge v2026</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#174A84] hover:bg-[#133c6d] text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            إغلاق وحفظ
          </button>
        </div>
      </div>
    </div>
  );
};
