import { BlurView } from 'expo-blur';
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

  return (
    <View style={[styles.card, dynamicStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
});
