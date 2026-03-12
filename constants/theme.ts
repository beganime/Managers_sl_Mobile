// constants/theme.ts

export const Colors = {
  light: {
    primary: '#007AFF', // Классический iOS синий
    background: '#F2F2F7', // Мягкий серый фон как в системных настройках iOS
    card: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
  },
  dark: {
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    border: '#38383A',
    success: '#32D74B',
    danger: '#FF453A',
    warning: '#FF9F0A',
  }
};

export const Layout = {
  radius: {
    small: 8,
    medium: 16,
    large: 24, // Увеличенные радиусы для "воздушности"
    pill: 9999,
  },
  shadows: {
    // Мягкая тень для карточек
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    // Более глубокая тень для парящих элементов (как TabBar)
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 5,
    }
  }
};