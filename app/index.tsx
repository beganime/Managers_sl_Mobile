import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../src/context/ThemeContext';

export default function IndexScreen() {
  const { theme } = useTheme();
  const { user, loading } = useCurrentUser();

  if (loading) {
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

  return <Redirect href={user?.id ? '/(app)' : '/login'} />;
}