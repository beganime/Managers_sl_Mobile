import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';

export type StatusTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

const toneStyles: Record<StatusTone, { backgroundColor: string; color: string }> = {
  accent: { backgroundColor: theme.colors.accentSoft, color: theme.colors.accent },
  danger: { backgroundColor: theme.colors.dangerSoft, color: theme.colors.danger },
  muted: { backgroundColor: theme.colors.surfaceSoft, color: theme.colors.textMuted },
  primary: { backgroundColor: theme.colors.primarySoft, color: theme.colors.primary },
  success: { backgroundColor: theme.colors.successSoft, color: theme.colors.success },
  warning: { backgroundColor: theme.colors.warningSoft, color: theme.colors.warning },
};

export function StatusPill({ label, tone = 'primary' }: StatusPillProps) {
  const colors = toneStyles[tone];

  return (
    <View style={[styles.wrap, { backgroundColor: colors.backgroundColor }]}>
      <Text style={[styles.text, { color: colors.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '900',
  },
});
