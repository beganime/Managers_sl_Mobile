import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { Card } from './Card';

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'primary' | 'accent' | 'warning' | 'danger' | 'success';
};

const tones = {
  primary: [theme.colors.navy900, theme.colors.navy800],
  accent: [theme.colors.red900, theme.colors.red700],
  warning: [theme.colors.warning, '#D98B07'],
  danger: [theme.colors.danger, theme.colors.red800],
  success: [theme.colors.success, '#1E9A61'],
} as const;

export function StatCard({ label, value, tone = 'primary' }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <LinearGradient
        colors={tones[tone] as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mark}
      />
      <View style={styles.body}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
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
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
});
