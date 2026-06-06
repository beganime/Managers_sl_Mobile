import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
};

export default function AppScreen({ children, scroll = true, contentContainerStyle }: Props) {
  const { theme, isDark } = useTheme();

  const content = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={theme.gradientMain as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.orb, { top: -40, right: -30, backgroundColor: theme.red, opacity: isDark ? 0.10 : 0.08 }]} />
      <View style={[styles.orbLarge, { bottom: 80, left: -90, backgroundColor: theme.blue, opacity: isDark ? 0.10 : 0.08 }]} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentContainerStyle]}>{children}</View>
      )}
    </>
  );

  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120, gap: 16 },
  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
  },
  orbLarge: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
  },
});
