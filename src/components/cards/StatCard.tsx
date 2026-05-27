import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { Card } from './Card';

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'primary' | 'accent' | 'warning' | 'danger';
};

const tones = {
  primary: [theme.colors.primary, theme.colors.primarySoft],
  accent: [theme.colors.accent, theme.colors.accentSoft],
  warning: [theme.colors.warning, theme.colors.warningSoft],
  danger: [theme.colors.danger, theme.colors.dangerSoft],
} as const;

export function StatCard({ label, value, tone = 'primary' }: StatCardProps) {
  const [color, backgroundColor] = tones[tone];

  return (
    <Card style={styles.card}>
      <View style={[styles.dot, { backgroundColor }]} />
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 142,
    gap: 7,
  },
  dot: {
    width: 32,
    height: 6,
    borderRadius: theme.radius.pill,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
