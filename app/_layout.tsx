import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import AnimatedSplash from '../components/AnimatedSplash';
import { ThemeProvider } from '../src/context/ThemeContext';
import { STORAGE_KEYS } from '../src/config/app';
import { getToken } from '../src/utils/storage';

function RootNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const syncAuth = async () => {
      const token = await getToken(STORAGE_KEYS.accessToken);
      if (!mounted) return;
      setIsAuthenticated(Boolean(token));
      setIsReady(true);
    };

    syncAuth();
    return () => { mounted = false; };
  }, [segments]);

  useEffect(() => {
    if (!isReady || showSplash) return;
    const inApp = segments[0] === '(app)';
    const inLogin = segments[0] === 'login';

    if (!isAuthenticated && !inLogin) {
      router.replace('/login');
    } else if (isAuthenticated && !inApp) {
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
