import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import AppScreen from '../../components/AppScreen';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import apiClient, { extractResults } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('gamification/leaderboard/');
      setItems(extractResults(res.data));
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
        <SectionHeader title="Рейтинг" subtitle="Активность и результаты команды" />
        {items.length ? items.map((item, index) => (
          <PremiumCard key={item.id ?? index} style={{ backgroundColor: index === 0 ? theme.redSoft : index === 1 ? theme.blueSoft : theme.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{index + 1}. {item.full_name || item.name || item.email || `Сотрудник #${index + 1}`}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 6 }}>
                  Доход: ${Number(item.revenue || item.total_revenue || 0).toFixed(0)} · Активность: {item.activity_score || item.score || 0}
                </Text>
              </View>
              <Text style={{ color: theme.blue, fontWeight: '900' }}>{item.rank || index + 1}</Text>
            </View>
          </PremiumCard>
        )) : <EmptyState title="Рейтинг пока пуст" subtitle="Когда появятся данные по активности, экран заполнится автоматически." />}
      </ScrollView>
    </AppScreen>
  );
}
