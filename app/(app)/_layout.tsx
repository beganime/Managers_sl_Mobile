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
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                ),
                headerTitleStyle: {
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: 18,
                },
                headerTitleAlign: 'center',
                
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    elevation: 0, 
                    borderTopWidth: 0, 
                    backgroundColor: 'transparent',
                    height: Platform.OS === 'ios' ? 85 : 70, 
                },
                tabBarBackground: () => (
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
                ),
                
                tabBarActiveTintColor: '#3b82f6', 
                tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)', 
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: Platform.OS === 'ios' ? 0 : 5,
                }
            }}
        >
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
            {/* Заменили tasks на leaderboard */}
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
        </Tabs>
    );
}