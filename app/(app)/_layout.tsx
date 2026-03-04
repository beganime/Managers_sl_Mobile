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
                // Настройки шапки остаются без изменений (простое стекло)
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
                
                // --- ПРЕМИАЛЬНАЯ ПАРЯЩАЯ НАВИГАЦИЯ ---
                tabBarStyle: {
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 25 : 15, // Отступ от нижнего края экрана
                    left: 20, // Отступ слева
                    right: 20, // Отступ справа
                    elevation: 10, // Тень для Android
                    shadowColor: '#0D416D', // Тень для iOS
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    backgroundColor: 'transparent',
                    borderTopWidth: 0, // Убираем стандартную полоску
                    height: 70, // Высота самого островка
                    borderRadius: 35, // Закругления по краям
                    overflow: 'hidden', // Чтобы блюр не вылезал за скругления
                },
                // Задний фон таб-бара делаем матовым стеклом
                tabBarBackground: () => (
                    <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
                ),
                
                // Настройка активных/неактивных элементов
                tabBarActiveTintColor: '#0D416D', 
                tabBarInactiveTintColor: '#94A3B8', 
                tabBarShowLabel: true,
                tabBarItemStyle: {
                    paddingTop: 8,
                    paddingBottom: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '800',
                    marginTop: 2,
                },
                // Прячем таб-бар при открытии клавиатуры на Android
                tabBarHideOnKeyboard: true, 
            }}
        >
            {/* --- ОСНОВНЫЕ ВКЛАДКИ --- */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Дашборд',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "apps" : "apps-outline"} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="crm"
                options={{
                    title: 'CRM',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: 'Рейтинг',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "trophy" : "trophy-outline"} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="catalog"
                options={{
                    title: 'Каталог',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "library" : "library-outline"} size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
                    ),
                }}
            />

            {/* --- СКРЫТЫЕ СТРАНИЦЫ --- */}
            <Tabs.Screen name="client/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="deal/[id]" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-deal" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="create-document" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="add-client" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="payment/create" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="university/[id]" options={{ href: null, headerShown: false }} />
        </Tabs>
    );
}