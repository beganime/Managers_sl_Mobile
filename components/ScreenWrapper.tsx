import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';

const { width } = Dimensions.get('window');
const BOTTOM_PADDING = Platform.OS === 'ios' ? 100 : Platform.OS === 'web' ? 80 : 90;

interface Props {
  children: React.ReactNode;
  noPadding?: boolean;
}

export default function ScreenWrapper({ children, noPadding }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.gradientMain as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={[
          styles.circle,
          {
            backgroundColor: theme.blue,
            top: -width * 0.45,
            right: -width * 0.25,
            opacity: theme.mode === 'dark' ? 0.08 : 0.06,
          },
        ]}
      />

      <View
        style={[
          styles.circle,
          {
            backgroundColor: theme.red,
            bottom: -width * 0.55,
            left: -width * 0.3,
            opacity: theme.mode === 'dark' ? 0.08 : 0.05,
          },
        ]}
      />

      <View style={[styles.content, noPadding && styles.noPadding]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  circle: {
    position: 'absolute',
    width: width * 1.15,
    height: width * 1.15,
    borderRadius: (width * 1.15) / 2,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 80 : Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: BOTTOM_PADDING,
  },
  noPadding: {
    paddingBottom: 0,
  },
});