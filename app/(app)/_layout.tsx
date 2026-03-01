// app/(app)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

export default function AppLayout() {
    return (
        <Tabs
            screenOptions={{
                headerTransparent: true,
                headerBackground: () => (
                    // Светлое стекло для шапки
                    <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                ),
                headerTitleStyle: {
                    color: '#0F172A', // Темный цвет заголовка
                    fontWeight: '900',
                    fontSize: 18,
                },
                headerTitleAlign: 'center',
                
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    elevation: 0, 
                    borderTopWidth: 1, 
                    borderTopColor: 'rgba(255, 255, 255, 0.7)', // Легкая белая граница сверху
                    backgroundColor: 'transparent',
                    height: Platform.OS === 'ios' ? 85 : 70, 
                },
                tabBarBackground: () => (
                    // Светлое стекло для нижней панели
                    <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
                ),
                
                tabBarActiveTintColor: '#0D416D', // Фирменный цвет для активной иконки
                tabBarInactiveTintColor: '#94A3B8', // Серо-голубой для неактивных иконок
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '800',
                    marginBottom: Platform.OS === 'ios' ? 0 : 5,
                }
            }}
        >
            {/* --- ОСНОВНЫЕ ВКЛАДКИ --- */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Дашборд',
                    tabBarIcon: ({ color, size }) => <Ionicons name="apps" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="crm"
                options={{
                    title: 'CRM',
                    tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: 'Рейтинг',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="catalog"
                options={{
                    title: 'Каталог',
                    tabBarIcon: ({ color, size }) => <Ionicons name="library" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
                }}
            />

            {/* --- СКРЫТЫЕ СТРАНИЦЫ (ОСТАВЛЕНО ТОЛЬКО href: null) --- */}
            <Tabs.Screen name="client/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="deal/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-deal" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-client" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="payment/create" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="university/[id]" options={{ href: null, headerShown: false }} />
        </Tabs>
    );
}