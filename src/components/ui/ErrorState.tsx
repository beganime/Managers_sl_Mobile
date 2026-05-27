import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
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
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.dangerSoft,
    backgroundColor: theme.colors.surfaceStrong,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  title: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
