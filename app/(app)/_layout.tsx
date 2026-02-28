import { Stack } from 'expo-router';

export default function AppLayout() {
  // Здесь позже можно добавить Drawer или BottomTabs
  return <Stack screenOptions={{ headerShown: false }} />;
}