import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, saveToken } from '../utils/storage';
import { STORAGE_KEYS } from '../config/app';

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  mode: ThemeMode;

  background: string;
  backgroundSoft: string;
  surface: string;
  glass: string;
  glassStrong: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  white: string;
  red: string;
  redSoft: string;
  blue: string;
  blueSoft: string;
  green: string;
  yellow: string;
  danger: string;
  shadow: string;
  overlay: string;
  tabBar: string;
  gradientMain: [string, string, string];
  gradientRed: [string, string];
  gradientBlue: [string, string];

  // legacy aliases for existing screens
  bg: string;
  bgCard: string;
  bgGlass: string;
  bgGlass2: string;
  bgInput: string;
  bgChip: string;
  bgSection: string;
  textSub: string;
  textInvert: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  warning: string;
  purple: string;
  borderGlass: string;
  gradientBg: string[];
}

const lightTheme: ThemePalette = {
  mode: 'light',
  background: '#F8FAFC',
  backgroundSoft: '#FFFFFF',
  surface: 'rgba(255,255,255,0.84)',
  glass: 'rgba(255,255,255,0.72)',
  glassStrong: 'rgba(255,255,255,0.90)',
  border: 'rgba(15,23,42,0.08)',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  red: '#C81E1E',
  redSoft: '#FFF1F2',
  blue: '#164E9A',
  blueSoft: '#EFF6FF',
  green: '#059669',
  yellow: '#D97706',
  danger: '#DC2626',
  shadow: 'rgba(15,23,42,0.16)',
  overlay: 'rgba(15,23,42,0.16)',
  tabBar: 'rgba(255,255,255,0.86)',
  gradientMain: ['#FFFFFF', '#F8FAFC', '#EFF6FF'],
  gradientRed: ['#FFF5F5', '#FEE2E2'],
  gradientBlue: ['#F8FBFF', '#DBEAFE'],

  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgGlass: 'rgba(255,255,255,0.72)',
  bgGlass2: 'rgba(255,255,255,0.54)',
  bgInput: 'rgba(255,255,255,0.90)',
  bgChip: '#F1F5F9',
  bgSection: '#F8FAFC',
  textSub: '#475569',
  textInvert: '#FFFFFF',
  primary: '#164E9A',
  primaryDeep: '#0F3D78',
  accent: '#059669',
  warning: '#D97706',
  purple: '#7C3AED',
  borderGlass: 'rgba(255,255,255,0.9)',
  gradientBg: ['#FFFFFF', '#F8FAFC', '#EFF6FF'],
};

const darkTheme: ThemePalette = {
  mode: 'dark',
  background: '#07111F',
  backgroundSoft: '#0B1526',
  surface: 'rgba(11,21,38,0.86)',
  glass: 'rgba(15,23,42,0.74)',
  glassStrong: 'rgba(15,23,42,0.90)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  red: '#F87171',
  redSoft: '#2A1113',
  blue: '#60A5FA',
  blueSoft: '#0B2240',
  green: '#34D399',
  yellow: '#FBBF24',
  danger: '#F87171',
  shadow: 'rgba(0,0,0,0.40)',
  overlay: 'rgba(0,0,0,0.42)',
  tabBar: 'rgba(11,21,38,0.88)',
  gradientMain: ['#07111F', '#0B1526', '#102242'],
  gradientRed: ['#2A1113', '#4C1D1D'],
  gradientBlue: ['#0B1526', '#0F2545'],

  bg: '#07111F',
  bgCard: '#0B1526',
  bgGlass: 'rgba(15,23,42,0.74)',
  bgGlass2: 'rgba(15,23,42,0.60)',
  bgInput: 'rgba(15,23,42,0.90)',
  bgChip: '#1E293B',
  bgSection: '#0B1526',
  textSub: '#CBD5E1',
  textInvert: '#07111F',
  primary: '#60A5FA',
  primaryDeep: '#3B82F6',
  accent: '#34D399',
  warning: '#FBBF24',
  purple: '#A78BFA',
  borderGlass: 'rgba(255,255,255,0.10)',
  gradientBg: ['#07111F', '#0B1526', '#102242'],
};

type ThemeContextShape = {
  theme: ThemePalette;
  isDark: boolean;
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextShape>({
  theme: lightTheme,
  isDark: false,
  themeMode: 'light',
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    getToken(STORAGE_KEYS.theme).then((saved) => {
      if (saved === 'dark' || saved === 'light') setThemeMode(saved);
    });
  }, []);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    await saveToken(STORAGE_KEYS.theme, mode);
  }, []);

  const value = useMemo(() => {
    const isDark = themeMode === 'dark';
    return { theme: isDark ? darkTheme : lightTheme, isDark, themeMode, setTheme };
  }, [themeMode, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
