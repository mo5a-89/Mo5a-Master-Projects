import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { Language, getTranslation, TranslationDictionary } from '../locales/translations';

export interface EnterpriseSettings {
  themeMode: 'light' | 'dark' | 'high_contrast';
  primaryColor: string;
  accentColor: string;
  fontFamily: 'Cairo' | 'IBM Plex Sans Arabic' | 'Tajawal' | 'Almarai' | 'Alexandria' | 'Plus Jakarta Sans';
  uiDensity: 'compact' | 'normal' | 'large';
  language: Language;
  decimalPrecision: number;
  currencyDisplay: string;
}

export const DEFAULT_SETTINGS: EnterpriseSettings = {
  themeMode: 'light',
  primaryColor: '#174A84',
  accentColor: '#007A5A',
  fontFamily: 'Cairo',
  uiDensity: 'normal',
  language: 'ar',
  decimalPrecision: 2,
  currencyDisplay: 'SAR',
};

const STORAGE_KEY = 'rmt_enterprise_settings';

interface SettingsContextType {
  settings: EnterpriseSettings;
  updateSettings: (newSettings: Partial<EnterpriseSettings>) => void;
  saveAndApplySettings: (newSettings?: Partial<EnterpriseSettings>) => void;
  resetSettings: () => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
  isSuperAdminUser: (user: User | null) => boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode; currentUser?: User | null }> = ({
  children,
  currentUser,
}) => {
  const [settings, setSettings] = useState<EnterpriseSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      // Check legacy individual keys
      const theme = (localStorage.getItem('rmt_theme_mode') as any) || DEFAULT_SETTINGS.themeMode;
      const prim = localStorage.getItem('rmt_primary_color') || DEFAULT_SETTINGS.primaryColor;
      const acc = localStorage.getItem('rmt_accent_color') || DEFAULT_SETTINGS.accentColor;
      const font = (localStorage.getItem('rmt_font_family') as any) || DEFAULT_SETTINGS.fontFamily;
      const scale = (localStorage.getItem('rmt_ui_scale') as any) || DEFAULT_SETTINGS.uiDensity;
      const lang = (localStorage.getItem('rmt_language') as any) || DEFAULT_SETTINGS.language;
      return {
        ...DEFAULT_SETTINGS,
        themeMode: theme,
        primaryColor: prim,
        accentColor: acc,
        fontFamily: font,
        uiDensity: scale === 'compact' || scale === 'large' ? scale : 'normal',
        language: lang === 'en' ? 'en' : 'ar',
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Root DOM Engine: Injects CSS variables, Font Family, UI density scale, Dark mode, and Language direction
  const applySettingsToDOM = useCallback((s: EnterpriseSettings) => {
    const root = document.documentElement;
    const body = document.body;
    const rootEl = document.getElementById('root');

    // 1. Language & Direction
    root.setAttribute('lang', s.language);
    root.setAttribute('dir', s.language === 'en' ? 'ltr' : 'rtl');

    // 2. Theme CSS Variables (Navy #174A84 & Emerald #007A5A default)
    root.style.setProperty('--primary', s.primaryColor);
    root.style.setProperty('--accent', s.accentColor);
    root.style.setProperty('--color-primary', s.primaryColor);
    root.style.setProperty('--color-accent', s.accentColor);

    // 3. Font Family
    const fontStack = `'${s.fontFamily}', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`;
    root.style.fontFamily = fontStack;
    body.style.fontFamily = fontStack;
    root.style.setProperty('--app-font-family', fontStack);

    // 4. UI Density (scale-95, scale-100, scale-105)
    if (rootEl) {
      rootEl.classList.remove('scale-95', 'scale-100', 'scale-105', 'origin-top');
      if (s.uiDensity === 'compact') {
        rootEl.classList.add('scale-95', 'origin-top');
        root.style.fontSize = '14px';
      } else if (s.uiDensity === 'large') {
        rootEl.classList.add('scale-105', 'origin-top');
        root.style.fontSize = '16px';
      } else {
        rootEl.classList.add('scale-100');
        root.style.fontSize = '15px';
      }
    }

    // 5. Dark Mode Class on Root
    if (s.themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('high-contrast');
    } else if (s.themeMode === 'high_contrast') {
      root.classList.add('high-contrast');
      root.classList.remove('dark');
    } else {
      root.classList.remove('dark');
      root.classList.remove('high-contrast');
    }
  }, []);

  // Root DOM Engine & LocalStorage sync when settings change
  useEffect(() => {
    applySettingsToDOM(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem('rmt_theme_mode', settings.themeMode);
      localStorage.setItem('rmt_primary_color', settings.primaryColor);
      localStorage.setItem('rmt_accent_color', settings.accentColor);
      localStorage.setItem('rmt_font_family', settings.fontFamily);
      localStorage.setItem('rmt_ui_scale', settings.uiDensity);
      localStorage.setItem('rmt_language', settings.language);
      localStorage.setItem('rmt_decimal_precision', String(settings.decimalPrecision));
      localStorage.setItem('rmt_currency_display', settings.currencyDisplay);
    } catch (e) {
      console.error('Failed to sync settings to storage:', e);
    }
  }, [settings, applySettingsToDOM]);

  const updateSettings = useCallback((newSettings: Partial<EnterpriseSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const saveAndApplySettings = useCallback(
    (newSettings?: Partial<EnterpriseSettings>) => {
      setSettings((prev) => ({ ...prev, ...(newSettings || {}) }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    saveAndApplySettings(DEFAULT_SETTINGS);
  }, [saveAndApplySettings]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      themeMode: prev.themeMode === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setSettings((prev) => {
      if (prev.language === lang) return prev;
      return { ...prev, language: lang };
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      language: prev.language === 'ar' ? 'en' : 'ar',
    }));
  }, []);

  // Super-Admin Shield: Restrict Settings Hub strictly to "مختار أبورزق"
  const isSuperAdminUser = useCallback((user: User | null): boolean => {
    if (!user) return false;
    const name = (user.fullName || user.name || '').trim();
    const email = (user.email || '').toLowerCase().trim();
    const username = (user.username || '').toLowerCase().trim();

    return (
      name.includes('مختار') ||
      name.includes('Mokhtar') ||
      email === 'mok7tar.89@gmail.com' ||
      username === 'mokhtar' ||
      user.role === 'admin'
    );
  }, []);

  const t = getTranslation(settings.language);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        saveAndApplySettings,
        resetSettings,
        toggleTheme,
        toggleLanguage,
        setLanguage,
        t,
        isSuperAdminUser,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

const defaultContextValue: SettingsContextType = {
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  saveAndApplySettings: () => {},
  resetSettings: () => {},
  toggleTheme: () => {},
  toggleLanguage: () => {},
  setLanguage: () => {},
  t: getTranslation(DEFAULT_SETTINGS.language),
  isSuperAdminUser: () => true,
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return defaultContextValue;
  }
  return context;
};
