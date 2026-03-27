import { Ionicons } from '@expo/vector-icons';
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
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { extractList, fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

function revenueOf(user: any) {
  return parseFloat(
    String(user?.managersalary?.current_month_revenue ?? user?.revenue ?? 0)
  );
}

function fullNameOf(user: any) {
  return (
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Сотрудник'
  );
}

function officeOf(user: any) {
  return user?.office?.city || 'Без офиса';
}

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function Crown({
  place,
  size = 24,
}: {
  place: 1 | 2 | 3;
  size?: number;
}) {
  const color = place === 1 ? '#D4AF37' : place === 2 ? '#C0C0C0' : '#CD7F32';

  return <Ionicons name="crown" size={size} color={color} />;
}

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const { user: currentUser } = useCurrentUser();

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
        ranked = users.sort((a: any, b: any) => revenueOf(b) - revenueOf(a));
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

  const enriched = useMemo(
    () =>
      leaders.map((item, index) => ({
        ...item,
        _rank: index + 1,
        _revenue: revenueOf(item),
      })),
    [leaders]
  );

  const top3 = enriched.slice(0, 3);
  const rest = enriched.slice(3);
  const myRow = enriched.find((item) => item.id === currentUser?.id);

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

        {myRow ? (
          <View
            style={[
              styles.meCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View>
              <Text style={[styles.meCaption, { color: theme.textSecondary }]}>
                Мой результат
              </Text>
              <Text style={[styles.meName, { color: theme.text }]}>
                {fullNameOf(myRow)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.meRank, { color: theme.blue }]}>#{myRow._rank}</Text>
              <Text style={[styles.meRevenue, { color: theme.success }]}>
                {money(myRow._revenue)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.topGrid}>
          {top3.map((user, index) => {
            const place = (index + 1) as 1 | 2 | 3;
            const accent =
              place === 1 ? '#D4AF37' : place === 2 ? '#C0C0C0' : '#CD7F32';

            return (
              <View
                key={user.id || `top-${index}`}
                style={[
                  styles.topCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.topCardHeader}>
                  <View style={styles.crownWrap}>
                    <Crown place={place} size={22} />
                    <Text style={[styles.place, { color: accent }]}>#{place}</Text>
                  </View>

                  {place === 1 ? (
                    <View
                      style={[
                        styles.leaderBadge,
                        { backgroundColor: theme.redSoft },
                      ]}
                    >
                      <Text style={[styles.leaderBadgeText, { color: theme.red }]}>
                        TOP 1
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {fullNameOf(user)}
                </Text>
                <Text style={[styles.office, { color: theme.textSecondary }]} numberOfLines={1}>
                  {officeOf(user)}
                </Text>
                <Text style={[styles.revenue, { color: theme.success }]}>
                  {money(user._revenue)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {rest.length === 0 ? (
            <Text style={[styles.emptyList, { color: theme.textSecondary }]}>
              Пока только топ сотрудников.
            </Text>
          ) : (
            rest.map((user, index) => (
              <View
                key={user.id || `rest-${index}`}
                style={[styles.row, { borderBottomColor: theme.divider }]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    #{index + 4} · {fullNameOf(user)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {officeOf(user)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: theme.blue }]}>
                  {money(revenueOf(user))}
                </Text>
              </View>
            ))
          )}
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

  meCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meCaption: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  meName: { marginTop: 6, fontSize: 17, fontWeight: '900' },
  meRank: { fontSize: 20, fontWeight: '900' },
  meRevenue: { marginTop: 4, fontSize: 14, fontWeight: '900' },

  topGrid: { marginTop: 18, gap: 12 },
  topCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  topCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crownWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  place: { fontSize: 18, fontWeight: '900' },
  leaderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  leaderBadgeText: { fontSize: 11, fontWeight: '900' },
  name: { marginTop: 12, fontSize: 18, fontWeight: '900' },
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
  emptyList: { padding: 18, fontSize: 14 },
});