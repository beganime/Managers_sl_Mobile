import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.bar, { backgroundColor: appTheme.dark ? appTheme.colors.red700 : appTheme.colors.accent }]} />
        <Text style={[styles.title, { color: appTheme.dark ? appTheme.colors.screenText : appTheme.colors.text }]}>
          {title}
        </Text>
      </View>
      {Boolean(subtitle) && (
        <Text style={[styles.subtitle, { color: appTheme.dark ? appTheme.colors.screenTextMuted : appTheme.colors.textMuted }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bar: {
    width: 5,
    height: 20,
    borderRadius: theme.radius.pill,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
