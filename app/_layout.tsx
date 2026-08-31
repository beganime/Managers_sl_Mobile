import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef } from 'react';
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
  const handledNotificationId = useRef<string | null>(null);

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

  useEffect(() => {
    if (!isAuthenticated || !navigationState?.key) return;

    const openNotification = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const requestId = response.notification.request.identifier;
      if (handledNotificationId.current === requestId) return;
      handledNotificationId.current = requestId;

      const data = response.notification.request.content.data as Record<string, unknown>;
      const route = typeof data?.route === 'string' ? data.route : '';
      if (route.startsWith('/(app)')) {
        router.push(route as any);
        return;
      }

      const notificationId = data?.notification_id || data?.notificationId;
      if (notificationId) {
        router.push(`/(app)/notifications/${notificationId}` as any);
        return;
      }

      const taskId = data?.task_id || data?.taskId;
      if (taskId) {
        router.push(`/(app)/tasks-v2/${taskId}` as any);
        return;
      }

      router.push('/(app)/notifications' as any);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then(openNotification);
    return () => subscription.remove();
  }, [isAuthenticated, navigationState?.key, router]);

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
