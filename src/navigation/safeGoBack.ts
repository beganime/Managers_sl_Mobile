import type { Router } from 'expo-router';

export function safeGoBack(router: Router, fallback: string = '/(app)') {
  try {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}

  router.replace(fallback as any);
}