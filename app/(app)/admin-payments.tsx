import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AppScreen from '../../components/AppScreen';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import apiClient, { extractResults } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminPaymentsScreen() {
  const { theme } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get('analytics/payments/', { params: { is_confirmed: false, limit: 100, offset: 0 } });
      setItems(extractResults(response.data));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.blue} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <SectionHeader title="Ожидающие платежи" subtitle="Админ-модуль подтверждения" actionLabel="Назад" onPress={() => router.back()} />
        {items.length ? items.map((payment) => (
          <PremiumCard key={payment.id}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Платёж #{payment.id}</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 6 }}>
              Сделка #{payment.deal} · {payment.method || 'unknown'} · ${Number(payment.amount_usd || payment.amount || 0).toFixed(2)}
            </Text>
          </PremiumCard>
        )) : <EmptyState title="Нет неподтверждённых платежей" subtitle="Когда менеджеры отправят новые оплаты, они появятся здесь." />}
      </ScrollView>
    </AppScreen>
  );
}
