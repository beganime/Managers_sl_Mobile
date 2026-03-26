import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import AppTabIcon from '../../components/ui/AppTabIcon';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

const TAB_HEIGHT = Platform.OS === 'ios' ? 88 : 76;
const TAB_BOTTOM = Platform.OS === 'ios' ? 18 : 12;

export default function AppTabsLayout() {
  const { user } = useCurrentUser();
  const { theme } = useTheme();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: TAB_BOTTOM,
          height: TAB_HEIGHT,
          borderRadius: 28,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView
            intensity={90}
            tint="light"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 28,
                overflow: 'hidden',
                backgroundColor: theme.glassStrong,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
          />
        ),
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 12 : 10,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 11, fontWeight: focused ? '900' : '700' }}>Главная</Text>
          ),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name="home" color={color} focused={focused} size={22} />,
        }}
      />

      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 11, fontWeight: focused ? '900' : '700' }}>CRM</Text>
          ),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name="crm" color={color} focused={focused} size={22} />,
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: isAdmin ? 'Команда' : 'Рейтинг',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 11, fontWeight: focused ? '900' : '700' }}>
              {isAdmin ? 'Команда' : 'Рейтинг'}
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name="rank" color={color} focused={focused} size={22} />,
        }}
      />

      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Вузы',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 11, fontWeight: focused ? '900' : '700' }}>Вузы</Text>
          ),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name="catalog" color={color} focused={focused} size={22} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 11, fontWeight: focused ? '900' : '700' }}>Профиль</Text>
          ),
          tabBarIcon: ({ color, focused }) => <AppTabIcon name="profile" color={color} focused={focused} size={22} />,
        }}
      />

      <Tabs.Screen name="documents" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="client/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="deal/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="add-deal" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="create-document" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="add-client" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="payment/create" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="university/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="knowledge-base" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-staff" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-reports" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-payments" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="tasks" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}