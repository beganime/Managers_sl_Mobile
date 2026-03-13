// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import AnimatedSplash from '../components/AnimatedSplash';
import { getToken } from '../src/utils/storage';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSplashAnimation, setShowSplashAnimation] = useState(true);
  
  const segments = useSegments();
  const router = useRouter();

  // Проверяем наличие токена при старте
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken('access_token');
        setIsAuthenticated(!!token);
      } catch (e) {
        setIsAuthenticated(false);
      } finally {
        setIsReady(true);
      }
    };
    checkAuth();
  }, []);

  // Логика редиректа
  useEffect(() => {
    if (!isReady || showSplashAnimation) return;

    const inAuthGroup = segments[0] === '(app)';
    const isLoginScreen = segments[0] === 'login';
    
    if (!isAuthenticated && !isLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && isLoginScreen) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isReady, showSplashAnimation, segments]);

  // Пока смотрим анимацию — скрываем остальное приложение
  if (showSplashAnimation) {
    return <AnimatedSplash onAnimationFinish={() => setShowSplashAnimation(false)} />;
  }

  if (!isReady) return null; 

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* Здесь используем Stack, а не Tabs! */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}