import React from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type ScreenContainerProps = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
};

export function ScreenContainer({
  children,
  scroll = true,
  padded = true,
  style,
}: ScreenContainerProps) {
  const appTheme = useAppTheme();
  const contentStyle = [styles.content, !padded && styles.noPadding, style];

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: appTheme.colors.background }]}>
        <View style={contentStyle}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: appTheme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[contentStyle, styles.scrollContent]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: theme.spacing.lg,
    maxWidth: 1180,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    width: '100%',
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scrollContent: {
    paddingBottom: 112,
  },
});
