import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { CurrentUserProvider, useCurrentUser } from '../hooks/useCurrentUser';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  const { theme } = useTheme();
  const { user, hydrated } = useCurrentUser();

  const isAuthRoute = useMemo(() => {
    return pathname === '/' || pathname === '/login';
  }, [pathname]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!hydrated) return;

    const isLoggedIn = Boolean(user?.id);

    if (isLoggedIn && isAuthRoute) {
      router.replace('/(app)');
      return;
    }

    if (!isLoggedIn && !isAuthRoute) {
      router.replace('/login');
    }
  }, [hydrated, isAuthRoute, navigationState?.key, router, user?.id]);

  if (!navigationState?.key || !hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.blue} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CurrentUserProvider>
        <RootNavigator />
      </CurrentUserProvider>
    </ThemeProvider>
  );
}