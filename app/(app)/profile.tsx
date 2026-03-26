import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AppScreen from '../../components/AppScreen';
import BrandMark from '../../components/BrandMark';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import { logout } from '../../src/api/mobile';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

export default function ProfileScreen() {
  const { theme, themeMode, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = useMemo(() => Boolean(user?.is_superuser || user?.role === 'admin'), [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <AppScreen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        <BrandMark compact />
        <PremiumCard>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900' }}>
            {user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Пользователь'}
          </Text>
          <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{user?.email}</Text>
          <Text style={{ color: isAdmin ? theme.red : theme.blue, marginTop: 8, fontWeight: '800' }}>
            {isAdmin ? 'Администратор' : 'Менеджер'}
          </Text>
        </PremiumCard>

        <SectionHeader title="Профиль" subtitle="Личные настройки приложения" />

        <PremiumCard>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Тёмная тема</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Для вечерней работы и контрастного интерфейса</Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
              />
            </View>

            <View style={{ height: 1, backgroundColor: theme.border }} />

            <TouchableOpacity onPress={() => router.push('/(app)/knowledge-base')}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>База знаний</Text>
              <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Скрипты, инструкции, быстрые ответы</Text>
            </TouchableOpacity>

            {isAdmin ? (
              <>
                <View style={{ height: 1, backgroundColor: theme.border }} />
                <TouchableOpacity onPress={() => router.push('/(app)/admin-staff')}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Команда</Text>
                  <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Сотрудники, KPI, управление выплатами</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </PremiumCard>

        <SectionHeader title="Финансы" />
        <PremiumCard>
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.textSecondary }}>Оклад: <Text style={{ color: theme.text, fontWeight: '900' }}>${Number(user?.managersalary?.fixed_salary ?? 0).toFixed(0)}</Text></Text>
            <Text style={{ color: theme.textSecondary }}>Текущий бонус: <Text style={{ color: theme.text, fontWeight: '900' }}>${Number(user?.managersalary?.current_balance ?? 0).toFixed(0)}</Text></Text>
            <Text style={{ color: theme.textSecondary }}>План месяца: <Text style={{ color: theme.text, fontWeight: '900' }}>${Number(user?.managersalary?.monthly_plan ?? 0).toFixed(0)}</Text></Text>
          </View>
        </PremiumCard>

        <TouchableOpacity
          onPress={() => {
            Alert.alert('Выход', 'Подтвердить выход из аккаунта?', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Выйти', style: 'destructive', onPress: handleLogout },
            ]);
          }}
        >
          <PremiumCard style={{ backgroundColor: theme.redSoft }}>
            <Text style={{ color: theme.danger, textAlign: 'center', fontSize: 16, fontWeight: '900' }}>
              {loggingOut ? 'Выходим…' : 'Выйти из аккаунта'}
            </Text>
          </PremiumCard>
        </TouchableOpacity>
      </ScrollView>
    </AppScreen>
  );
}
