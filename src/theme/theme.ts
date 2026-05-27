export const theme = {
  colors: {
    background: '#F4F7FB',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FBFF',
    border: '#D9E4F2',
    text: '#102033',
    textMuted: '#6C7F95',
    primary: '#143B73',
    primarySoft: '#EAF1FF',
    accent: '#12A150',
    accentSoft: '#E7F8EC',
    danger: '#D9363E',
    dangerSoft: '#FDECEC',
    warning: '#D98B07',
    warningSoft: '#FFF6E5',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#0D2740',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
  },
};

export type AppTheme = typeof theme;
