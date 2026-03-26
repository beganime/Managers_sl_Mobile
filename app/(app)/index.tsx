import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AppScreen from '../../components/AppScreen';
import BrandMark from '../../components/BrandMark';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import { getDashboard } from '../../src/api/mobile';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

function Stat({ title, value, caption, color }: { title: string; value: string | number; caption: string; color: string }) {
  const { theme } = useTheme();
  return (
    <PremiumCard style={{ flex: 1, minWidth: '47%' }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color + '18', marginBottom: 12 }} />
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 8 }}>{value}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{caption}</Text>
    </PremiumCard>
  );
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const data = await getDashboard();
      setDashboard(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = useMemo(() => {
    return Boolean(user?.is_superuser || user?.role === 'admin');
  }, [user]);

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.blue} />
      </AppScreen>
    );
  }

  const metrics = dashboard?.metrics ?? {};

  return (
    <AppScreen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <BrandMark />
        <PremiumCard>
          <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Добро пожаловать</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', marginTop: 8 }}>
            {user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'ManagerSL'}
          </Text>
          <Text style={{ color: theme.textSecondary, marginTop: 8, lineHeight: 20 }}>
            {isAdmin ? 'Контроль бизнеса, финансов и команды в одном месте.' : 'Рабочий день, клиенты, сделки и задачи — без лишнего шума.'}
          </Text>
        </PremiumCard>

        <SectionHeader title="Сводка" subtitle="То, что важно прямо сейчас" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {isAdmin ? (
            <>
              <Stat title="Выручка" value={`$${Number(metrics.period_revenue_usd ?? 0).toFixed(0)}`} caption="Текущий период" color={theme.green} />
              <Stat title="Прибыль" value={`$${Number(metrics.period_profit_usd ?? 0).toFixed(0)}`} caption="Чистый результат" color={theme.blue} />
              <Stat title="Клиенты" value={metrics.clients_total ?? 0} caption="Вся база" color={theme.red} />
              <Stat title="Ожидают" value={metrics.pending_payments ?? 0} caption="Платежи на подтверждение" color={theme.yellow} />
            </>
          ) : (
            <>
              <Stat title="Клиенты" value={dashboard?.counts?.clients ?? metrics.clients_total ?? 0} caption="Доступные вам" color={theme.blue} />
              <Stat title="Сделки" value={dashboard?.counts?.deals ?? metrics.active_deals ?? 0} caption="Ваш портфель" color={theme.red} />
              <Stat title="Задачи" value={dashboard?.counts?.tasks ?? metrics.open_tasks ?? 0} caption="Активные задачи" color={theme.green} />
              <Stat title="Оплаты" value={dashboard?.counts?.pending_payments ?? 0} caption="Ждут подтверждения" color={theme.yellow} />
            </>
          )}
        </View>

        <SectionHeader title="Быстрые переходы" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            { label: 'Клиенты', onPress: () => router.push('/(app)/crm'), color: theme.blueSoft },
            { label: 'Задачи', onPress: () => router.push('/(app)/tasks'), color: theme.redSoft },
            { label: 'Вузы', onPress: () => router.push('/(app)/catalog'), color: theme.blueSoft },
            { label: 'Документы', onPress: () => router.push('/(app)/documents'), color: theme.redSoft },
          ].map((item) => (
            <TouchableOpacity key={item.label} onPress={item.onPress} style={{ flexBasis: '47%' }}>
              <PremiumCard style={{ backgroundColor: item.color }}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>{item.label}</Text>
              </PremiumCard>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="Последние элементы" />
        {(dashboard?.recent?.clients?.length || dashboard?.recent?.tasks?.length || dashboard?.recent?.deals?.length) ? (
          <View style={{ gap: 12 }}>
            {(dashboard?.recent?.clients ?? []).slice(0, 3).map((item: any) => (
              <PremiumCard key={`client-${item.id}`}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{item.full_name || item.client__full_name || `Клиент #${item.id}`}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 6 }}>{item.phone || item.status || item.city || 'Без дополнительной информации'}</Text>
              </PremiumCard>
            ))}
            {(dashboard?.recent?.tasks ?? []).slice(0, 2).map((item: any) => (
              <PremiumCard key={`task-${item.id}`}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{item.title || `Задача #${item.id}`}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 6 }}>{item.status || 'todo'} · {item.priority || 'medium'}</Text>
              </PremiumCard>
            ))}
          </View>
        ) : (
          <EmptyState title="Пока пусто" subtitle="После первой синхронизации здесь появятся клиенты, задачи и сделки." />
        )}
      </ScrollView>
    </AppScreen>
  );
}
