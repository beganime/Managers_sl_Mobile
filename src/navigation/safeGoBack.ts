import type { Router } from 'expo-router';
import { Platform } from 'react-native';

export function safeGoBack(router: Router, fallback: string = '/(app)/profile') {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
  } catch {}

  try {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}

  router.replace(fallback as any);
}