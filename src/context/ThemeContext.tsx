import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppTheme, darkTheme, lightTheme } from '../theme/theme';
import { getToken, saveToken } from '../utils/storage';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

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

    background: '#07111F',
    backgroundSoft: '#0B1728',
    surface: '#12243D',
    surfaceSoft: '#1A2F4C',
    glass: 'rgba(18,36,61,0.72)',
    glassStrong: 'rgba(18,36,61,0.96)',

    text: '#F5F7FB',
    textSecondary: '#B8C4D6',
    textMuted: '#8395AD',
    textOnDark: '#FFFFFF',

    border: 'rgba(184,196,214,0.18)',
    divider: 'rgba(184,196,214,0.12)',
    shadow: '#000000',

    red: '#E9566A',
    redSoft: 'rgba(233,86,106,0.16)',
    blue: '#6F9EFF',
    blueSoft: 'rgba(111,158,255,0.16)',
    success: '#35C979',
    warning: '#F3B43F',
    danger: '#FF6E73',
    card: '#12243D',
    white: '#FFFFFF',

    gradientMain: ['#07111F', '#0B1728', '#14111E'],
    gradientSurface: ['#12243D', '#1A2F4C'],

    bg: '#07111F',
    bgCard: '#12243D',
    bgGlass: 'rgba(18,36,61,0.72)',
    bgGlass2: 'rgba(26,47,76,0.78)',
    bgInput: 'rgba(18,36,61,0.96)',
    bgChip: '#1A2F4C',
    bgSection: '#0B1728',
    textSub: '#B8C4D6',
    textInvert: '#FFFFFF',
    primary: '#6F9EFF',
    primaryDeep: '#2B63B7',
    accent: '#E9566A',
    purple: '#9A89FF',
    borderGlass: 'rgba(255,255,255,0.12)',
    gradientBg: ['#07111F', '#0B1728', '#14111E'],
  };
}

interface ThemeContextValue {
  theme: ThemePalette;
  appTheme: AppTheme;
  themeMode: ThemeMode;
  themePreference: ThemePreference;
  isDark: boolean;
  setTheme: (mode: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: buildLightTheme(),
  appTheme: lightTheme,
  themeMode: 'light',
  themePreference: 'system',
  isDark: false,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  useEffect(() => {
    getToken('app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemePreference(saved);
      }
    });
  }, []);

  const setTheme = useCallback(async (mode: ThemePreference) => {
    setThemePreference(mode);
    await saveToken('app_theme', mode);
  }, []);

  const themeMode: ThemeMode = useMemo(() => {
    if (themePreference !== 'system') return themePreference;
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }, [systemColorScheme, themePreference]);

  const theme = useMemo(
    () => (themeMode === 'dark' ? buildDarkTheme() : buildLightTheme()),
    [themeMode]
  );
  const appTheme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        appTheme,
        themeMode,
        themePreference,
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
