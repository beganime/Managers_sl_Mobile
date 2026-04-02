import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { user, reload } = useCurrentUser();

  const [booting, setBooting] = useState(true);

  const isAuthRoute = useMemo(() => {
    return pathname === '/login' || pathname === '/';
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await reload();
      } catch (e) {
        console.log('root layout reload failed', e);
      } finally {
        if (mounted) setBooting(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [reload]);

  useEffect(() => {
    if (booting) return;

    const isLoggedIn = !!user?.id;

    if (isLoggedIn && isAuthRoute) {
      router.replace('/(app)');
      return;
    }

    if (!isLoggedIn && !isAuthRoute) {
      router.replace('/login');
    }
  }, [booting, user, isAuthRoute, router]);

  if (booting) {
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
      <RootNavigator />
    </ThemeProvider>
  );
}