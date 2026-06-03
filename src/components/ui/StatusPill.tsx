import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

export type StatusTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusPill({ label, tone = 'primary' }: StatusPillProps) {
  const appTheme = useAppTheme();
  const colors = {
    accent: { backgroundColor: appTheme.colors.accentSoft, color: appTheme.colors.accent },
    danger: { backgroundColor: appTheme.colors.dangerSoft, color: appTheme.colors.danger },
    muted: { backgroundColor: appTheme.colors.surfaceSoft, color: appTheme.colors.textMuted },
    primary: { backgroundColor: appTheme.colors.primarySoft, color: appTheme.colors.primary },
    success: { backgroundColor: appTheme.colors.successSoft, color: appTheme.colors.success },
    warning: { backgroundColor: appTheme.colors.warningSoft, color: appTheme.colors.warning },
  }[tone];

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
