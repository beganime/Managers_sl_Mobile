import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import AnimatedSplash from '../components/AnimatedSplash';
import { STORAGE_KEYS } from '../src/config/app';
import { ThemeProvider } from '../src/context/ThemeContext';
import { getToken } from '../src/utils/storage';

function RootNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getToken(STORAGE_KEYS.accessToken);
        if (!mounted) return;
        setIsAuthenticated(Boolean(token));
      } catch (e) {
        if (!mounted) return;
        setIsAuthenticated(false);
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || showSplash) return;

    const firstSegment = segments[0];
    const inApp = firstSegment === '(app)';
    const inLogin = firstSegment === 'login';

    if (!isAuthenticated && !inLogin) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && !inApp) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isReady, showSplash, segments, router]);

  if (showSplash) {
    return <AnimatedSplash onAnimationFinish={() => setShowSplash(false)} />;
  }

  if (!isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}