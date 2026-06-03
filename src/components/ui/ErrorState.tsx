import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { Button } from './Button';

type ErrorStateProps = {
  title?: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function ErrorState({
  title = 'Не удалось загрузить данные',
  message,
  actionTitle,
  onAction,
}: ErrorStateProps) {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: appTheme.colors.dangerSoft,
          backgroundColor: appTheme.colors.surfaceStrong,
          ...appTheme.shadow.card,
        },
      ]}
    >
      <Text style={[styles.title, { color: appTheme.colors.danger }]}>{title}</Text>
      <Text style={[styles.message, { color: appTheme.colors.textMuted }]}>{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
