import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadow } from '../../constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { CrmIcon, HomeIcon, LibraryIcon, TrophyIcon, UserIcon } from '../../components/icons';

function TabIcon({ route, color }: { route: string; color: string }) {
  switch (route) {
    case 'index':
      return <HomeIcon color={color} size={22} />;
    case 'crm':
      return <CrmIcon color={color} size={22} />;
    case 'leaderboard':
      return <TrophyIcon color={color} size={22} />;
    case 'catalog':
      return <LibraryIcon color={color} size={22} />;
    default:
      return <UserIcon color={color} size={22} />;
  }
}

export default function AppLayout() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 18 : 14);
  const height = 70 + Math.max(insets.bottom - 4, 0);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 4 },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom,
          height,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          borderRadius: 999,
          overflow: 'hidden',
          ...Shadow.floating,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 65}
            tint={isDark ? 'dark' : 'light'}
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: theme.tabBar, borderRadius: 999, borderWidth: 1, borderColor: theme.border },
            ]}
          />
        ),
        tabBarIcon: ({ color }) => <TabIcon route={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Главная' }} />
      <Tabs.Screen name="crm" options={{ title: 'CRM' }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Рейтинг' }} />
      <Tabs.Screen name="catalog" options={{ title: 'Вузы' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />

      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="knowledge-base" options={{ href: null }} />
      <Tabs.Screen name="add-client" options={{ href: null }} />
      <Tabs.Screen name="add-deal" options={{ href: null }} />
      <Tabs.Screen name="create-document" options={{ href: null }} />
      <Tabs.Screen name="payment/create" options={{ href: null }} />
      <Tabs.Screen name="client/[id]" options={{ href: null }} />
      <Tabs.Screen name="deal/[id]" options={{ href: null }} />
      <Tabs.Screen name="university/[id]" options={{ href: null }} />
      <Tabs.Screen name="admin-staff" options={{ href: null }} />
      <Tabs.Screen name="admin-reports" options={{ href: null }} />
      <Tabs.Screen name="admin-payments" options={{ href: null }} />
    </Tabs>
  );
}
