import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

export function LoadingState({ title = 'Загружаем данные' }: { title?: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={appTheme.dark ? appTheme.colors.screenText : appTheme.colors.primary} />
      <Text style={[styles.text, { color: appTheme.dark ? appTheme.colors.screenTextMuted : appTheme.colors.textMuted }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  text: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
