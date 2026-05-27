import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, saveToken } from '../utils/storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  mode: ThemeMode;

  background: string;
  backgroundSoft: string;
  surface: string;
  surfaceSoft: string;
  glass: string;
  glassStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textOnDark: string;

  border: string;
  divider: string;
  shadow: string;

  red: string;
  redSoft: string;
  blue: string;
  blueSoft: string;
  success: string;
  warning: string;
  danger: string;
  card: string;
  white: string;

  gradientMain: string[];
  gradientSurface: string[];

  // legacy aliases чтобы старые экраны не умерли
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
  purple: string;
  borderGlass: string;
  gradientBg: string[];
}

function buildLightTheme(): ThemePalette {
  return {
    mode: 'light',

    background: '#F7F9FC',
    backgroundSoft: '#EEF3FA',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FBFF',
    glass: 'rgba(255,255,255,0.72)',
    glassStrong: 'rgba(255,255,255,0.9)',

    text: '#102033',
    textSecondary: '#4A607A',
    textMuted: '#7E93AB',
    textOnDark: '#FFFFFF',

    border: '#DCE6F1',
    divider: '#E8EEF6',
    shadow: '#0D2740',

    red: '#C62828',
    redSoft: '#FDECEC',
    blue: '#1E5EFF',
    blueSoft: '#EAF1FF',
    success: '#12A150',
    warning: '#D98B07',
    danger: '#D9363E',
    card: '#FFFFFF',
    white: '#FFFFFF',

    gradientMain: ['#F7F9FC', '#EEF4FF', '#FFF6F6'],
    gradientSurface: ['#FFFFFF', '#F8FBFF'],

    bg: '#F7F9FC',
    bgCard: '#FFFFFF',
    bgGlass: 'rgba(255,255,255,0.72)',
    bgGlass2: 'rgba(255,255,255,0.56)',
    bgInput: 'rgba(255,255,255,0.92)',
    bgChip: '#F3F7FC',
    bgSection: '#EEF3FA',
    textSub: '#4A607A',
    textInvert: '#FFFFFF',
    primary: '#1E5EFF',
    primaryDeep: '#103D96',
    accent: '#12A150',
    purple: '#715CFF',
    borderGlass: 'rgba(255,255,255,0.95)',
    gradientBg: ['#F7F9FC', '#EEF4FF', '#FFF6F6'],
  };
}

function buildDarkTheme(): ThemePalette {
  return {
    mode: 'dark',

    background: '#0E1724',
    backgroundSoft: '#132033',
    surface: '#162235',
    surfaceSoft: '#1B2A40',
    glass: 'rgba(22,34,53,0.76)',
    glassStrong: 'rgba(22,34,53,0.92)',

    text: '#F3F7FF',
    textSecondary: '#B9C6D8',
    textMuted: '#8DA0B8',
    textOnDark: '#FFFFFF',

    border: '#2A3C57',
    divider: '#23344E',
    shadow: '#000000',

    red: '#FF5A5F',
    redSoft: '#3B1E22',
    blue: '#69A1FF',
    blueSoft: '#1C2C4A',
    success: '#35C979',
    warning: '#F3B43F',
    danger: '#FF6E73',
    card: '#162235',
    white: '#FFFFFF',

    gradientMain: ['#0E1724', '#132033', '#1B2433'],
    gradientSurface: ['#162235', '#1A2940'],

    bg: '#0E1724',
    bgCard: '#162235',
    bgGlass: 'rgba(22,34,53,0.76)',
    bgGlass2: 'rgba(22,34,53,0.58)',
    bgInput: 'rgba(22,34,53,0.92)',
    bgChip: '#223249',
    bgSection: '#132033',
    textSub: '#B9C6D8',
    textInvert: '#FFFFFF',
    primary: '#69A1FF',
    primaryDeep: '#69A1FF',
    accent: '#35C979',
    purple: '#9A89FF',
    borderGlass: 'rgba(255,255,255,0.08)',
    gradientBg: ['#0E1724', '#132033', '#1B2433'],
  };
}

interface ThemeContextValue {
  theme: ThemePalette;
  themeMode: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: buildLightTheme(),
  themeMode: 'light',
  isDark: false,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    getToken('app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setThemeMode(saved);
      }
    });
  }, []);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    await saveToken('app_theme', mode);
  }, []);

  const theme = useMemo(
    () => (themeMode === 'dark' ? buildDarkTheme() : buildLightTheme()),
    [themeMode]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDark: themeMode === 'dark',
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
