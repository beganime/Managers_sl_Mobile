import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { Card } from './Card';

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'primary' | 'accent' | 'warning' | 'danger' | 'success';
};

export function StatCard({ label, value, tone = 'primary' }: StatCardProps) {
  const appTheme = useAppTheme();
  const tones = {
    primary: [appTheme.colors.navy900, appTheme.colors.navy800],
    accent: [appTheme.colors.red900, appTheme.colors.red700],
    warning: [appTheme.colors.warning, '#D98B07'],
    danger: [appTheme.colors.danger, appTheme.colors.red800],
    success: [appTheme.colors.success, '#1E9A61'],
  } as const;

  return (
    <Card style={styles.card}>
      <LinearGradient
        colors={tones[tone] as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mark}
      />
      <View style={styles.body}>
        <Text style={[styles.value, { color: appTheme.colors.text }]}>{value}</Text>
        <Text style={[styles.label, { color: appTheme.colors.textMuted }]}>{label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 142,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  mark: {
    width: 44,
    height: 7,
    borderRadius: theme.radius.pill,
  },
  body: {
    gap: 5,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
});
