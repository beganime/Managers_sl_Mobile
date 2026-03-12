// app/(app)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { LayoutAnimation, Platform, StyleSheet, UIManager } from 'react-native';
import { Colors, Layout } from '../constants/theme';

// 1. Включаем LayoutAnimation для Android (на iOS работает "из коробки")
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AppLayout() {
  // 2. Активируем плавность при монтировании главного экрана
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        // Стилизация парящего меню
        tabBarStyle: styles.tabBar,
        // Эффект матового стекла на фоне
        tabBarBackground: () => (
          <BlurView 
            tint="light" 
            intensity={80} 
            style={StyleSheet.absoluteFill} 
          />
        ),
      }}
    >
      {/* Основные экраны с иконками */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Задачи',
          tabBarIcon: ({ color }) => <Ionicons name="checkmark-circle-outline" size={26} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="catalog" 
        options={{ 
          title: 'Каталог',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={26} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="crm" 
        options={{ 
          title: 'CRM',
          tabBarIcon: ({ color }) => <Ionicons name="briefcase-outline" size={26} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Профиль',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={26} color={color} />
        }} 
      />

      {/* Скрываем внутренние экраны из нижнего меню */}
      <Tabs.Screen name="add-client" options={{ href: null }} />
      <Tabs.Screen name="add-deal" options={{ href: null }} />
      <Tabs.Screen name="client/[id]" options={{ href: null }} />
      <Tabs.Screen name="deal/[id]" options={{ href: null }} />
      <Tabs.Screen name="university/[id]" options={{ href: null }} />
      <Tabs.Screen name="payment/create" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: Layout.radius.large,
    borderTopWidth: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)', // Прозрачная подложка для блюра
    ...Layout.shadows.medium, // Подключаем воздушную тень из темы
    overflow: 'hidden', // Обрезаем блюр по радиусу
  }
});