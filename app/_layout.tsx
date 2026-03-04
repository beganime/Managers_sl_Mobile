// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import AnimatedSplash from '../components/AnimatedSplash';
import { getToken } from '../src/utils/storage';

// Запрещаем автоматическое скрытие нативного сплеш-скрина
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSplashAnimation, setShowSplashAnimation] = useState(true);
  
  const segments = useSegments();
  const router = useRouter();

  // Проверяем наличие токена при старте И при каждом переходе по страницам
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken('access_token');
        setIsAuthenticated(!!token); // Если токен есть - true, если удален - false
      } catch (e) {
        setIsAuthenticated(false);
      } finally {
        if (!isReady) {
          setIsReady(true);
          // Скрываем нативный сплеш-скрин, как только стейт готов при первом запуске
          await SplashScreen.hideAsync();
        }
      }
    };
    
    checkAuth();
  }, [segments]); // <-- Добавили segments сюда. Теперь проверка актуальна всегда.

  // Логика редиректа срабатывает, когда данные загружены и анимация завершена
  useEffect(() => {
    if (!isReady || showSplashAnimation) return;

    const inAuthGroup = segments[0] === '(app)';
    const isLoginScreen = segments[0] === 'login';
    
    if (!isAuthenticated && !isLoginScreen) {
      // Если токена нет, а мы не на странице логина - выкидываем на логин
      router.replace('/login');
    } else if (isAuthenticated && isLoginScreen) {
      // Если токен есть, а мы пытаемся зайти на логин - пускаем в приложение
      router.replace('/(app)');
    }
  }, [isAuthenticated, isReady, showSplashAnimation, segments]);

  // Пока смотрим анимацию — скрываем остальное приложение
  if (showSplashAnimation) {
    return <AnimatedSplash onAnimationFinish={() => setShowSplashAnimation(false)} />;
  }

  // Приложение не успело проверить токен (обычно это миллисекунды)
  if (!isReady) return null; 

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}