import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/useAppTheme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabBarIcon({
  name,
  color,
  focused,
  center,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
  center?: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.iconWrap,
        center && styles.centerIcon,
        focused && { backgroundColor: appTheme.dark ? 'rgba(255,255,255,0.18)' : appTheme.colors.accentSoft },
      ]}
    >
      <Ionicons name={name} color={center && focused ? appTheme.colors.white : color} size={center ? 22 : focused ? 21 : 20} />
    </View>
  );
}

function TabLabel({ title, color, focused }: { title: string; color: string; focused: boolean }) {
  return (
    <Text numberOfLines={1} style={[styles.label, { color }, focused && styles.labelActive]}>
      {title}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const useBlur = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTheme.dark ? appTheme.colors.white : appTheme.colors.accent,
        tabBarInactiveTintColor: appTheme.dark ? appTheme.colors.screenTextMuted : appTheme.colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: appTheme.colors.background },
        tabBarItemStyle: styles.item,
        tabBarStyle: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: Math.max(insets.bottom, 8),
          height: Platform.OS === 'ios' ? 74 : 66,
          borderRadius: 22,
          borderTopWidth: 0,
          borderWidth: useBlur ? 0 : 1,
          borderColor: appTheme.colors.glassBorder,
          backgroundColor: useBlur ? 'transparent' : appTheme.colors.surfaceStrong,
          paddingTop: 7,
          paddingBottom: Platform.OS === 'ios' ? 13 : 8,
          ...theme.shadow.floating,
        },
        tabBarBackground: () =>
          useBlur ? (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView intensity={appTheme.dark ? 38 : 54} tint={appTheme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
              <View
                style={[
                  styles.tabOverlay,
                  {
                    borderColor: appTheme.colors.glassBorder,
                    backgroundColor: appTheme.dark ? 'rgba(7,17,31,0.72)' : 'rgba(255,255,255,0.66)',
                  },
                ]}
              />
            </View>
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Главная" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="grid-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="CRM" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rating"
        options={{
          title: 'Рейтинг',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Рейтинг" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="trophy-outline" color={color} focused={focused} center />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Финансы',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Финансы" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="wallet-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Ещё',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Ещё" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="menu-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="tasks" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: {
    maxWidth: 76,
    paddingHorizontal: 0,
  },
  iconWrap: {
    minWidth: 34,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIcon: {
    minWidth: 42,
    height: 30,
    borderRadius: 15,
  },
  iconWrapActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  label: {
    maxWidth: 66,
    marginTop: 1,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '900',
  },
  tabOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
});
