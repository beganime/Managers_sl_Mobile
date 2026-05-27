import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';

import { LoadingState } from '../../src/components/ui/LoadingState';
import { ScreenContainer } from '../../src/components/layout/ScreenContainer';
import { useAuth } from '../../src/store/auth';

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, status } = useAuth();

  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) {
      router.replace('/login' as any);
    }
  }, [isAuthenticated, router, status]);

  if (status === 'loading') {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Открываем кабинет" />
      </ScreenContainer>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
