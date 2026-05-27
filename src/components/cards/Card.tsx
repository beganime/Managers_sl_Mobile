import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';

import { theme } from '../../theme/theme';

type CardProps = ViewProps & {
  glass?: boolean;
};

export function Card({ glass = false, style, children, ...props }: CardProps) {
  if (glass && Platform.OS === 'ios') {
    return (
      <BlurView intensity={42} tint="light" style={[styles.card, styles.blurCard, style]} {...props}>
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[styles.card, glass && styles.glassFallback, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  blurCard: {
    backgroundColor: theme.colors.glass,
  },
  glassFallback: {
    backgroundColor: theme.colors.glass,
  },
});
