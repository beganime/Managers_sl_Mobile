import { Stack, useRouter, useSegments } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { getToken } from '../src/utils/storage';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const segments = useSegments();
  const router = useRouter();

  // Проверяем наличие токена при старте
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken('access_token');
        // const token = await SecureStore.getItemAsync('access_token');
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
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(app)';
    const isLoginScreen = segments[0] === 'login';
    
    if (!isAuthenticated && !isLoginScreen) {
      // Если не авторизован и не на странице логина -> кидаем на логин
      router.replace('/login');
    } else if (isAuthenticated && isLoginScreen) {
      // Если авторизован, но зашел на логин -> кидаем в приложение
      router.replace('/(app)');
    }
  }, [isAuthenticated, isReady, segments]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}