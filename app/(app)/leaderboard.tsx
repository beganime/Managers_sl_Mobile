import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient, { extractList, fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

function revenueOf(user: any) {
  return parseFloat(
    String(
      user?.managersalary?.current_month_revenue ??
      user?.revenue ??
      0
    )
  );
}

export default function LeaderboardScreen() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [leaders, setLeaders] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      let ranked: any[] = [];

      try {
        const response = await apiClient.get('gamification/leaderboard/');
        ranked = extractList(response.data);
      } catch {
        ranked = [];
      }

      if (!ranked.length) {
        const users = await fetchAllPages('users/users/');
        ranked = users.sort((a, b) => revenueOf(b) - revenueOf(a));
      }

      setLeaders(ranked);
    } catch (e) {
      console.log('Leaderboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const top3 = useMemo(() => leaders.slice(0, 3), [leaders]);
  const rest = useMemo(() => leaders.slice(3), [leaders]);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Рейтинг команды</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Если серверный рейтинг пуст, экран строится из текущей месячной выручки сотрудников.
        </Text>

        <View style={styles.topGrid}>
          {top3.map((user, index) => (
            <View key={user.id || `${index}`} style={[styles.topCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.place, { color: index === 0 ? theme.red : theme.blue }]}>#{index + 1}</Text>
              <Text style={[styles.name, { color: theme.text }]}>
                {user.first_name || user.email || 'Сотрудник'}
              </Text>
              <Text style={[styles.office, { color: theme.textSecondary }]}>
                {user.office?.city || 'Без офиса'}
              </Text>
              <Text style={[styles.revenue, { color: theme.success }]}>
                ${revenueOf(user).toLocaleString('ru-RU')}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {rest.map((user, index) => (
            <View key={user.id || `rest-${index}`} style={[styles.row, { borderBottomColor: theme.divider }]}>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  #{index + 4} · {user.first_name || user.email}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  {user.office?.city || 'Без офиса'}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.blue }]}>
                ${revenueOf(user).toLocaleString('ru-RU')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  topGrid: { marginTop: 18, gap: 12 },
  topCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  place: { fontSize: 18, fontWeight: '900' },
  name: { marginTop: 8, fontSize: 18, fontWeight: '900' },
  office: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  revenue: { marginTop: 10, fontSize: 16, fontWeight: '900' },
  list: { marginTop: 18, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  rowValue: { fontSize: 13, fontWeight: '900' },
});