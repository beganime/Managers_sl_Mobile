export const Colors = {
  light: {
    primary: '#164E9A',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#475569',
    border: '#E2E8F0',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    primary: '#60A5FA',
    background: '#07111F',
    card: '#0B1526',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    border: '#1E293B',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
  },
};

export const Radius = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
  pill: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 12,
  },
};

export const Layout = {
  radius: {
    small: Radius.sm,
    medium: Radius.md,
    large: Radius.lg,
    pill: Radius.pill,
  },
  shadows: {
    light: Shadow.card,
    medium: Shadow.floating,
  },
};
