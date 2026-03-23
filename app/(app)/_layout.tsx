// app/(app)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

// ✅ Высота навбара с учётом safe area
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 65 : 60;
const TAB_BAR_BOTTOM = Platform.OS === 'ios' ? 20 : 12;

export default function AppLayout() {
    return (
        <Tabs
            screenOptions={{
                headerTransparent: true,
                headerBackground: () => (
                    <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                ),
                headerTitleStyle: {
                    color: '#0F172A',
                    fontWeight: '900',
                    fontSize: 18,
                },
                headerTitleAlign: 'center',

                // ✅ ИСПРАВЛЕНИЕ: Корректный парящий таббар без обрезки
                tabBarStyle: {
                    position: 'absolute',
                    bottom: TAB_BAR_BOTTOM,
                    left: 16,
                    right: 16,
                    elevation: 8,
                    shadowColor: '#0D416D',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    height: TAB_BAR_HEIGHT,
                    borderRadius: TAB_BAR_HEIGHT / 2,
                    overflow: 'hidden',
                },
                tabBarBackground: () => (
                    <BlurView
                        intensity={70}
                        tint="light"
                        style={[StyleSheet.absoluteFillObject, { borderRadius: TAB_BAR_HEIGHT / 2, overflow: 'hidden' }]}
                    />
                ),

                tabBarActiveTintColor: '#0D416D',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarShowLabel: true,
                tabBarItemStyle: {
                    paddingTop: 6,
                    paddingBottom: Platform.OS === 'ios' ? 6 : 8,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '800',
                    marginTop: 1,
                },
                tabBarHideOnKeyboard: true,
            }}
        >
            {/* ОСНОВНЫЕ ВКЛАДКИ */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Главная',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'apps' : 'apps-outline'} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="crm"
                options={{
                    title: 'CRM',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: 'Рейтинг',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="catalog"
                options={{
                    title: 'Каталог',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'person-circle' : 'person-circle-outline'}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            {/* СКРЫТЫЕ СТРАНИЦЫ */}
            <Tabs.Screen name="documents" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="client/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="deal/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-deal" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="create-document" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-client" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="payment/create" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="university/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="knowledge-base"   options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="admin-staff"      options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="admin-reports"    options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="admin-payments"   options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="tasks"            options={{ href: null, headerShown: false }} />
        </Tabs>
    );
}