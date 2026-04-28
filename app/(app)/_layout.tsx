import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppTabIcon from '../../components/ui/AppTabIcon';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';
import { ensurePushNotificationsRegistered } from '../../src/notifications/pushNotifications';
import { ensureWorkdayRemindersScheduled } from '../../src/notifications/workdayReminders';

const TAB_HEIGHT = Platform.OS === 'ios' ? 86 : 72;
const TAB_BOTTOM = Platform.OS === 'ios' ? 18 : 10;

function canShowFabOnRoute(segments: string[]) {
  if (!segments.length || segments[0] !== '(app)') return false;
  if (segments.length === 1) return true;

  const screen = segments[1];

  return ['index', 'crm', 'leaderboard', 'catalog', 'profile', 'leads', 'projects'].includes(screen);
}

export default function AppTabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const { user } = useCurrentUser();
  const { theme, themeMode } = useTheme();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');
  const dark = themeMode === 'dark';
  const useBlur = Platform.OS === 'ios';

  const [fabOpen, setFabOpen] = useState(false);

  const shouldShowGlobalFab = useMemo(() => {
    return canShowFabOnRoute(segments as string[]);
  }, [segments]);

  const fabBottom = useMemo(() => {
    return TAB_HEIGHT + TAB_BOTTOM + Math.max(insets.bottom, 8) + 14;
  }, [insets.bottom]);

  useEffect(() => {
    ensureWorkdayRemindersScheduled();
  }, []);

  useEffect(() => {
    ensurePushNotificationsRegistered(user?.id);
  }, [user?.id]);

  useEffect(() => {
    setFabOpen(false);
  }, [segments]);

  const openExpenseFromTemplate = () => {
    setFabOpen(false);
    router.push({
      pathname: '/(app)/admin-payments',
      params: { open: 'expense' },
    } as any);
  };

  const openIncomeFromTemplate = () => {
    setFabOpen(false);
    router.push({
      pathname: '/(app)/admin-payments',
      params: { open: 'income' },
    } as any);
  };

  const openOfficeTopUp = () => {
    setFabOpen(false);
    router.push({
      pathname: '/(app)/admin-payments',
      params: {
        open: 'income',
        title: 'Зарплата',
      },
    } as any);
  };

  const openProjects = () => {
    setFabOpen(false);
    router.push('/(app)/projects' as any);
  };

  const openSupport = () => {
    setFabOpen(false);
    router.push('/(app)/support' as any);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
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
            bottom: TAB_BOTTOM + Math.max(insets.bottom - 4, 0),
            height: TAB_HEIGHT,
            borderRadius: 28,
            backgroundColor: useBlur ? 'transparent' : dark ? '#161A26' : '#FFFFFF',
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: dark ? 0.2 : 0.08,
            shadowRadius: 20,
            borderWidth: useBlur ? 0 : 1,
            borderColor: useBlur ? 'transparent' : theme.border,
          },
          tabBarBackground: () =>
            useBlur ? (
              <View style={StyleSheet.absoluteFillObject}>
                <BlurView
                  intensity={dark ? 42 : 72}
                  tint={dark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFillObject}
                />
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.tabShell,
                    {
                      backgroundColor: dark ? 'rgba(22,26,38,0.88)' : 'rgba(255,255,255,0.9)',
                      borderColor: theme.border,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.topHairline,
                    {
                      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
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
                    backgroundColor: dark ? '#161A26' : '#FFFFFF',
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
        <Tabs.Screen name="leads" options={{ href: null, headerShown: false }} />
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
        <Tabs.Screen name="kb-ai" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="projects" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="project/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="support" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="task/[id]" options={{ href: null, headerShown: false }} />
      </Tabs>

      {shouldShowGlobalFab && fabOpen && (
        <Pressable
          onPress={() => setFabOpen(false)}
          style={[
            styles.fabBackdrop,
            {
              backgroundColor: dark ? 'rgba(8,13,22,0.72)' : 'rgba(16,32,51,0.18)',
            },
          ]}
        />
      )}

      {shouldShowGlobalFab && (
        <View pointerEvents="box-none" style={[styles.fabHost, { bottom: fabBottom }]}>
          {fabOpen && (
            <View
              style={[
                styles.fabMenu,
                {
                  backgroundColor: dark ? '#162235' : '#FFFFFF',
                  borderColor: dark ? '#2A3C57' : '#DCE6F1',
                  shadowColor: '#000000',
                },
              ]}
            >
              <FabMenuItem
                title="Проекты"
                subtitle="Задачи, дедлайны, файлы"
                icon="folder-open-outline"
                iconColor={theme.blue}
                iconBg={theme.blueSoft}
                theme={theme}
                onPress={openProjects}
              />

              <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />

              <FabMenuItem
                title="Поддержка"
                subtitle="Написать администратору"
                icon="chatbox-ellipses-outline"
                iconColor={theme.success}
                iconBg={dark ? '#173526' : '#E7F8EC'}
                theme={theme}
                onPress={openSupport}
              />

              <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />

              <FabMenuItem
                title="Добавить расход"
                subtitle="Виза, авиабилеты, офисные расходы"
                icon="remove-circle-outline"
                iconColor={theme.red}
                iconBg={theme.redSoft}
                theme={theme}
                onPress={openExpenseFromTemplate}
              />

              <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />

              <FabMenuItem
                title="Добавить доход"
                subtitle="Виза, авиабилеты или другой доход"
                icon="add-circle-outline"
                iconColor={theme.success}
                iconBg={dark ? '#173526' : '#E7F8EC'}
                theme={theme}
                onPress={openIncomeFromTemplate}
              />

              {isAdmin && (
                <>
                  <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />

                  <FabMenuItem
                    title="Пополнить баланс офиса"
                    subtitle="Только для админов · категория “Зарплата”"
                    icon="business-outline"
                    iconColor={theme.blue}
                    iconBg={theme.blueSoft}
                    theme={theme}
                    onPress={openOfficeTopUp}
                  />
                </>
              )}
            </View>
          )}

          <Pressable
            onPress={() => setFabOpen((v) => !v)}
            style={[
              styles.fab,
              {
                backgroundColor: theme.blue,
                shadowColor: '#000000',
              },
            ]}
          >
            <Ionicons name={fabOpen ? 'close' : 'add'} size={30} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function FabMenuItem({
  title,
  subtitle,
  icon,
  iconColor,
  iconBg,
  theme,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  theme: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fabMenuItem,
        {
          backgroundColor: pressed ? theme.backgroundSoft : theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.fabMenuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.fabMenuTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.fabMenuSub, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9900,
    elevation: 30,
  },
  fabHost: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    zIndex: 9999,
    elevation: 40,
  },
  fabMenu: {
    width: 318,
    borderWidth: 1,
    borderRadius: 28,
    padding: 10,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 18,
  },
  fabMenuItem: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fabDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    marginVertical: 5,
  },
  fabMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuTitle: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  fabMenuSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 14,
  },
});