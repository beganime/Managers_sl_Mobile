import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../../src/theme/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} color={color} size={focused ? 21 : 20} />
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
  const useBlur = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: theme.colors.background },
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
          borderColor: theme.colors.glassBorder,
          backgroundColor: useBlur ? 'transparent' : theme.colors.surfaceStrong,
          paddingTop: 7,
          paddingBottom: Platform.OS === 'ios' ? 13 : 8,
          ...theme.shadow.floating,
        },
        tabBarBackground: () =>
          useBlur ? (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView intensity={54} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={styles.tabOverlay} />
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
        name="tasks"
        options={{
          title: 'Задачи',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Задачи" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="checkbox-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Деньги',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Деньги" color={color} focused={focused} />
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
