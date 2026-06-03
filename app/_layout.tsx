import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemeProvider } from '../src/context/ThemeContext';
import { useAppTheme } from '../src/theme/useAppTheme';
import { AuthProvider, useAuth } from '../src/store/auth';

function RootNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, status } = useAuth();
  const theme = useAppTheme();

  const isAuthRoute = useMemo(() => pathname === '/' || pathname === '/login', [pathname]);

  useEffect(() => {
    if (!navigationState?.key || status === 'loading') return;

    if (isAuthenticated && isAuthRoute) {
      router.replace('/(app)/(tabs)' as any);
      return;
    }

    if (!isAuthenticated && !isAuthRoute) {
      router.replace('/login' as any);
    }
  }, [isAuthenticated, isAuthRoute, navigationState?.key, router, status]);

  if (!navigationState?.key || status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
