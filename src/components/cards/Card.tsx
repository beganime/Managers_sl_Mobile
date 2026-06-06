import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type CardProps = ViewProps & {
  glass?: boolean;
};

export function Card({ glass = false, style, children, ...props }: CardProps) {
  const appTheme = useAppTheme();
  const dynamicStyle = {
    borderColor: appTheme.colors.glassBorder,
    backgroundColor: glass ? appTheme.colors.glass : appTheme.colors.surface,
    ...appTheme.shadow.card,
  };

  if (glass && Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={appTheme.dark ? 28 : 42}
        tint={appTheme.dark ? 'dark' : 'light'}
        style={[styles.card, dynamicStyle, style]}
        {...props}
      >
        {children}
      </BlurView>
    );
  }

  if (!appTheme.dark) {
    return (
      <LinearGradient
        colors={['#FFFFFF', '#F7FBFF', '#FFF7F8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, dynamicStyle, style]}
        {...props}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, dynamicStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
});
