import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import AppTabIcon from '../../components/ui/AppTabIcon';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';
import { ensureWorkdayRemindersScheduled } from '../../src/notifications/workdayReminders';

const TAB_HEIGHT = Platform.OS === 'ios' ? 86 : 72;
const TAB_BOTTOM = Platform.OS === 'ios' ? 18 : 10;

export default function AppTabsLayout() {
  const { user } = useCurrentUser();
  const { theme, themeMode } = useTheme();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');
  const dark = themeMode === 'dark';
  const useBlur = Platform.OS === 'ios';

  useEffect(() => {
    ensureWorkdayRemindersScheduled();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: dark ? '#FFFFFF' : theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: TAB_BOTTOM,
          height: TAB_HEIGHT,
          borderRadius: 28,
          backgroundColor: useBlur
            ? 'transparent'
            : dark
            ? 'rgba(15,23,35,0.98)'
            : 'rgba(255,255,255,0.98)',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: dark ? 0.22 : 0.1,
          shadowRadius: 20,
          borderWidth: useBlur ? 0 : 1,
          borderColor: useBlur ? 'transparent' : theme.border,
        },
        tabBarBackground: () =>
          useBlur ? (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView
                intensity={dark ? 45 : 80}
                tint={dark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.tabShell,
                  {
                    backgroundColor: dark ? 'rgba(15,23,35,0.82)' : 'rgba(255,255,255,0.82)',
                    borderColor: theme.border,
                  },
                ]}
              />
              <View
                style={[
                  styles.topHairline,
                  {
                    backgroundColor: dark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.7)',
                  },
                ]}
              />
            </View>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                styles.androidTabBg,
                {
                  backgroundColor: dark ? 'rgba(15,23,35,0.98)' : 'rgba(255,255,255,0.98)',
                  borderColor: theme.border,
                },
              ]}
            />
          ),
        tabBarItemStyle: {
          paddingTop: 7,
          paddingBottom: Platform.OS === 'ios' ? 11 : 10,
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
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
              Главная
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppTabIcon name="home" color={color} focused={focused} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
              CRM
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppTabIcon name="crm" color={color} focused={focused} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: isAdmin ? 'Команда' : 'Рейтинг',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
              {isAdmin ? 'Команда' : 'Рейтинг'}
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppTabIcon name="rank" color={color} focused={focused} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Вузы',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
              Вузы
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppTabIcon name="catalog" color={color} focused={focused} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
              Профиль
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AppTabIcon name="profile" color={color} focused={focused} size={22} />
          ),
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
      <Tabs.Screen name="workday" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    borderRadius: 28,
    borderWidth: 1,
  },
  topHairline: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    height: 1,
    borderRadius: 999,
  },
  androidTabBg: {
    borderRadius: 28,
    borderWidth: 1,
  },
});