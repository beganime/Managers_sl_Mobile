import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type EmptyStateProps = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: appTheme.colors.border,
          backgroundColor: appTheme.colors.surfaceStrong,
        },
      ]}
    >
      <Text style={[styles.title, { color: appTheme.colors.text }]}>{title}</Text>
      {Boolean(message) && <Text style={[styles.message, { color: appTheme.colors.textMuted }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});
