// src/context/ThemeContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getToken, saveToken } from '../utils/storage';

// ─── Палитра ─────────────────────────────────────────────────────────────────

export const LIGHT: ThemePalette = {
    mode: 'light',

    // Фоны
    bg:         '#F8FAFC',
    bgCard:     '#FFFFFF',
    bgGlass:    'rgba(255,255,255,0.65)',
    bgGlass2:   'rgba(255,255,255,0.45)',
    bgInput:    'rgba(255,255,255,0.85)',
    bgChip:     '#F2F2F7',
    bgSection:  '#F1F5F9',

    // Текст
    text:       '#0F172A',
    textSub:    '#64748B',
    textMuted:  '#94A3B8',
    textInvert: '#FFFFFF',

    // Бренд
    primary:    '#007AFF',
    primaryDeep:'#0D416D',
    accent:     '#10b981',
    danger:     '#ef4444',
    warning:    '#f59e0b',
    purple:     '#8b5cf6',

    // Границы и тени
    border:     '#E2E8F0',
    borderGlass:'rgba(255,255,255,0.9)',
    shadow:     '#000',

    // Градиент фона
    gradientBg: ['#F8FAFC', '#F1F5F9', '#E2E8F0'] as string[],
};

export const DARK: ThemePalette = {
    mode: 'dark',

    bg:         '#0F172A',
    bgCard:     '#1E293B',
    bgGlass:    'rgba(30,41,59,0.80)',
    bgGlass2:   'rgba(30,41,59,0.55)',
    bgInput:    'rgba(30,41,59,0.90)',
    bgChip:     '#334155',
    bgSection:  '#1E293B',

    text:       '#F1F5F9',
    textSub:    '#94A3B8',
    textMuted:  '#64748B',
    textInvert: '#0F172A',

    primary:    '#3B82F6',
    primaryDeep:'#60A5FA',
    accent:     '#34D399',
    danger:     '#F87171',
    warning:    '#FBBF24',
    purple:     '#A78BFA',

    border:     '#334155',
    borderGlass:'rgba(255,255,255,0.08)',
    shadow:     '#000',

    gradientBg: ['#0F172A', '#1E293B', '#0F172A'] as string[],
};

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePalette {
    mode:        'light' | 'dark';
    bg:          string;
    bgCard:      string;
    bgGlass:     string;
    bgGlass2:    string;
    bgInput:     string;
    bgChip:      string;
    bgSection:   string;
    text:        string;
    textSub:     string;
    textMuted:   string;
    textInvert:  string;
    primary:     string;
    primaryDeep: string;
    accent:      string;
    danger:      string;
    warning:     string;
    purple:      string;
    border:      string;
    borderGlass: string;
    shadow:      string;
    gradientBg:  string[];
}

interface ThemeCtx {
    theme:      ThemePalette;
    themeMode:  ThemeMode;
    isDark:     boolean;
    setTheme:   (mode: ThemeMode) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeCtx>({
    theme:     LIGHT,
    themeMode: 'system',
    isDark:    false,
    setTheme:  () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme           = useColorScheme();
    const [themeMode, setMode]   = useState<ThemeMode>('system');

    // Загружаем сохранённый выбор
    useEffect(() => {
        getToken('app_theme').then(saved => {
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                setMode(saved);
            }
        });
    }, []);

    const setTheme = useCallback(async (mode: ThemeMode) => {
        setMode(mode);
        await saveToken('app_theme', mode);
    }, []);

    const isDark =
        themeMode === 'dark' ||
        (themeMode === 'system' && systemScheme === 'dark');

    const theme = isDark ? DARK : LIGHT;

    return (
        <ThemeContext.Provider value={{ theme, themeMode, isDark, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}