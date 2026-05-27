import { Redirect } from 'expo-router';
import React from 'react';

export default function AppIndexScreen() {
  return <Redirect href={'/(app)/(tabs)' as any} />;
}
