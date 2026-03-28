import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  const raw =
    user?.revenue ??
    user?.managersalary?.current_month_revenue ??
    0;

  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
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
  return (
    user?.office?.city ||
    user?.office_name ||
    'Без офиса'
  );
}

function avatarOf(user: any) {
  return user?.avatar_url || user?.avatar || null;
}

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function initialsOf(user: any) {
  const full = fullNameOf(user).trim();
  if (!full) return '?';

  const parts = full.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
}

function crownColor(place: 1 | 2 | 3) {
  if (place === 1) return '#D4AF37';
  if (place === 2) return '#C0C0C0';
  return '#CD7F32';
}

function medalBg(place: 1 | 2 | 3) {
  if (place === 1) return '#FFF7DA';
  if (place === 2) return '#F3F4F6';
  return '#FBE9DD';
}

function rankAccent(place: number, theme: any) {
  if (place === 1) return '#D4AF37';
  if (place === 2) return '#98A2B3';
  if (place === 3) return '#CD7F32';
  return theme.blue;
}

function Avatar({
  user,
  size = 56,
  theme,
}: {
  user: any;
  size?: number;
  theme: any;
}) {
  const uri = avatarOf(user);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSoft,
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.blueSoft || '#EAF1FF',
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { color: theme.blue }]}>
        {initialsOf(user)}
      </Text>
    </View>
  );
}

function TopCard({
  user,
  place,
  theme,
}: {
  user: any;
  place: 1 | 2 | 3;
  theme: any;
}) {
  const accent = crownColor(place);

  return (
    <View
      style={[
        styles.topCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.topHeaderRow}>
        <View
          style={[
            styles.topPlaceBadge,
            { backgroundColor: medalBg(place), borderColor: theme.border },
          ]}
        >
          <MaterialCommunityIcons name="crown" size={22} color={accent} />
          <Text style={[styles.topPlaceText, { color: accent }]}>#{place}</Text>
        </View>

        {place === 1 ? (
          <View style={[styles.topLeaderChip, { backgroundColor: theme.redSoft || '#FFE7E7' }]}>
            <Text style={[styles.topLeaderChipText, { color: theme.red }]}>ЛИДЕР</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.topAvatarWrap}>
        <Avatar user={user} size={74} theme={theme} />
      </View>

      <Text style={[styles.topName, { color: theme.text }]} numberOfLines={1}>
        {fullNameOf(user)}
      </Text>

      <Text style={[styles.topOffice, { color: theme.textSecondary }]} numberOfLines={1}>
        {officeOf(user)}
      </Text>

      <View style={[styles.topRevenueBox, { backgroundColor: theme.backgroundSoft }]}>
        <Text style={[styles.topRevenueLabel, { color: theme.textSecondary }]}>Выручка</Text>
        <Text style={[styles.topRevenueValue, { color: theme.success }]}>
          {money(revenueOf(user))}
        </Text>
      </View>
    </View>
  );
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
      } catch (e) {
        console.log('Leaderboard API fallback', e);
        ranked = [];
      }

      if (!ranked.length) {
        const users = await fetchAllPages('users/users/');
        ranked = users
          .map((u: any) => ({
            ...u,
            revenue: revenueOf(u),
            office_name: officeOf(u),
            avatar_url: avatarOf(u),
            full_name: fullNameOf(u),
          }))
          .sort((a: any, b: any) => revenueOf(b) - revenueOf(a));
      }

      ranked = ranked
        .map((item: any) => ({
          ...item,
          revenue: revenueOf(item),
          office_name: officeOf(item),
          avatar_url: avatarOf(item),
          full_name: fullNameOf(item),
        }))
        .sort((a: any, b: any) => revenueOf(b) - revenueOf(a));

      setLeaders(ranked);
    } catch (e) {
      console.log('Leaderboard load error', e);
      setLeaders([]);
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
        _office: officeOf(item),
        _avatar: avatarOf(item),
        _fullName: fullNameOf(item),
      })),
    [leaders]
  );

  const podiumOrder = useMemo(() => {
    const first = enriched[0];
    const second = enriched[1];
    const third = enriched[2];

    return [
      second ? { ...second, _podiumPlace: 2 as 2 } : null,
      first ? { ...first, _podiumPlace: 1 as 1 } : null,
      third ? { ...third, _podiumPlace: 3 as 3 } : null,
    ].filter(Boolean) as Array<any>;
  }, [enriched]);

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
        <View style={styles.hero}>
          <Text style={[styles.title, { color: theme.text }]}>Рейтинг команды</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Текущий рейтинг сотрудников по выручке за месяц
          </Text>
        </View>

        {myRow ? (
          <View
            style={[
              styles.meCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.meLeft}>
              <Avatar user={myRow} size={56} theme={theme} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.meCaption, { color: theme.textSecondary }]}>
                  Мой результат
                </Text>
                <Text style={[styles.meName, { color: theme.text }]} numberOfLines={1}>
                  {myRow._fullName}
                </Text>
                <Text style={[styles.meOffice, { color: theme.textSecondary }]} numberOfLines={1}>
                  {myRow._office}
                </Text>
              </View>
            </View>

            <View style={styles.meRight}>
              <Text style={[styles.meRank, { color: theme.blue }]}>#{myRow._rank}</Text>
              <Text style={[styles.meRevenue, { color: theme.success }]}>
                {money(myRow._revenue)}
              </Text>
            </View>
          </View>
        ) : null}

        {podiumOrder.length ? (
          <View style={styles.podiumRow}>
            {podiumOrder.map((user) => (
              <View
                key={String(user.id)}
                style={[
                  styles.podiumCol,
                  user._podiumPlace === 1
                    ? styles.podiumColCenter
                    : styles.podiumColSide,
                ]}
              >
                <TopCard
                  user={user}
                  place={user._podiumPlace}
                  theme={theme}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Общий рейтинг</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Все сотрудники
            </Text>
          </View>

          {enriched.length === 0 ? (
            <Text style={[styles.emptyList, { color: theme.textSecondary }]}>
              Данных рейтинга пока нет.
            </Text>
          ) : (
            enriched.map((user, index) => {
              const isTop3 = user._rank <= 3;
              const accent = rankAccent(user._rank, theme);
              const isMe = currentUser?.id === user.id;

              return (
                <View
                  key={user.id || `leader-${index}`}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: theme.divider,
                      backgroundColor: isMe ? theme.backgroundSoft : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <View
                      style={[
                        styles.rankCircle,
                        {
                          backgroundColor: isTop3 ? medalBg(user._rank as 1 | 2 | 3) : theme.backgroundSoft,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      {isTop3 ? (
                        <MaterialCommunityIcons
                          name="crown"
                          size={18}
                          color={accent}
                        />
                      ) : (
                        <Text style={[styles.rankCircleText, { color: theme.text }]}>
                          {user._rank}
                        </Text>
                      )}
                    </View>

                    <Avatar user={user} size={48} theme={theme} />

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                        {user._fullName}
                      </Text>
                      <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                        {user._office}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowRight}>
                    <Text style={[styles.rowRank, { color: accent }]}>#{user._rank}</Text>
                    <Text style={[styles.rowValue, { color: theme.success }]}>
                      {money(user._revenue)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {rest.length > 0 ? (
          <View style={{ height: 8 }} />
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  container: {
    padding: 20,
    paddingBottom: 120,
  },

  hero: {
    marginBottom: 2,
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
  },

  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },

  meCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  meLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },

  meRight: {
    alignItems: 'flex-end',
  },

  meCaption: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  meName: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '900',
  },

  meOffice: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },

  meRank: {
    fontSize: 22,
    fontWeight: '900',
  },

  meRevenue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },

  podiumRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },

  podiumCol: {
    flex: 1,
  },

  podiumColCenter: {
    marginBottom: 0,
  },

  podiumColSide: {
    marginBottom: 12,
  },

  topCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    alignItems: 'center',
  },

  topHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  topPlaceBadge: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  topPlaceText: {
    fontSize: 14,
    fontWeight: '900',
  },

  topLeaderChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  topLeaderChipText: {
    fontSize: 10,
    fontWeight: '900',
  },

  topAvatarWrap: {
    marginTop: 16,
  },

  topName: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  topOffice: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  topRevenueBox: {
    marginTop: 14,
    width: '100%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },

  topRevenueLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  topRevenueValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900',
  },

  sectionCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },

  row: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },

  rowRight: {
    alignItems: 'flex-end',
  },

  rankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rankCircleText: {
    fontSize: 13,
    fontWeight: '900',
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },

  rowRank: {
    fontSize: 13,
    fontWeight: '900',
  },

  rowValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },

  avatarFallback: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '900',
  },

  emptyList: {
    padding: 18,
    fontSize: 14,
  },
});