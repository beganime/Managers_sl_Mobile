import { Redirect } from 'expo-router';
import React from 'react';

import { LoadingState } from '../src/components/ui/LoadingState';
import { ScreenContainer } from '../src/components/layout/ScreenContainer';
import { useAuth } from '../src/store/auth';

export default function IndexScreen() {
  const { isAuthenticated, status } = useAuth();

  if (status === 'loading') {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Проверяем сессию" />
      </ScreenContainer>
    );
  }

  return <Redirect href={(isAuthenticated ? '/(app)/(tabs)' : '/login') as any} />;
}
