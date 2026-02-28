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
                // Включаем стеклянный хэдер
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
                
                // Включаем стеклянный нижний бар
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    elevation: 0, // Убираем тень на Android
                    borderTopWidth: 0, // Убираем полоску сверху
                    backgroundColor: 'transparent',
                    height: Platform.OS === 'ios' ? 85 : 70, // Чуть больше высоты для iOS из-за челки
                },
                tabBarBackground: () => (
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
                ),
                
                // Цвета иконок
                tabBarActiveTintColor: '#3b82f6', // Электрический синий для активной вкладки
                tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)', // Полупрозрачный белый для неактивных
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
                    tabBarIcon: ({ color, size }) => <Ionicons name="analytics" size={size} color={color} />,
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
                name="tasks"
                options={{
                    title: 'Задачи',
                    tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-circle" size={size} color={color} />,
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