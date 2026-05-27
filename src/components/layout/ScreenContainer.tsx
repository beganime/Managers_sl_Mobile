import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme/theme';

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
  const contentStyle = [styles.content, !padded && styles.noPadding, style];

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient
          colors={theme.gradients.screen as [string, string, ...string[]]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={contentStyle}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />
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
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scrollContent: {
    paddingBottom: 112,
  },
});
