import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { Radius, Shadow } from '../constants/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function PremiumCard({ children, style, tint = 'light' }: { children: React.ReactNode; style?: ViewStyle; tint?: 'light' | 'dark' }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }, Shadow.card, style]}>
      <BlurView intensity={Platform.OS === 'ios' ? 30 : 50} tint={tint ?? (isDark ? 'dark' : 'light')} style={StyleSheet.absoluteFillObject} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
});
