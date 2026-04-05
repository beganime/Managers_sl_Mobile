import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type LeaderItem = {
  id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  office_name?: string;
  revenue?: number | string;
  avatar_url?: string | null;
  office?: {
    id?: number;
    city?: string;
  } | null;
  managersalary?: {
    current_month_revenue?: number | string;
  } | null;
  access_profile?: {
    can_be_in_leaderboard?: boolean;
  } | null;
};

const SOFT_TEXT = '#2F2A45';
const SOFT_TEXT_SECONDARY = '#6E668B';
const SOFT_ACCENT = '#7B61FF';

function toRevenue(item: LeaderItem) {
  const value = item?.revenue ?? item?.managersalary?.current_month_revenue ?? 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fullName(item: LeaderItem) {
  const explicit = item.full_name?.trim();
  if (explicit) return explicit;

  const first = item.first_name || '';
  const last = item.last_name || '';
  const joined = `${first} ${last}`.trim();

  return joined || item.email || `Сотрудник #${item.id}`;
}

function officeLabel(item: LeaderItem) {
  return item.office_name || item.office?.city || 'Без офиса';
}

function avatarOf(item: LeaderItem) {
  return item.avatar_url || null;
}

function money(value: number) {
  return `$${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function officeGradient(name: string): [string, string] {
  const gradients: [string, string][] = [
    ['#FFF2F5', '#F7F1FF'],
    ['#EEF4FF', '#F6F0FF'],
    ['#F8F2FF', '#EEF6FF'],
    ['#FFF5F7', '#F2F0FF'],
    ['#EFF7FF', '#F7F1FF'],
    ['#FFF7F1', '#F4F1FF'],
    ['#F3F8FF', '#F2FBF7'],
    ['#FFF1F7', '#EEF4FF'],
    ['#F7F1FF', '#FFF7FC'],
    ['#EEF7FF', '#F6F2FF'],
  ];

  const source = String(name || 'Без офиса');
  let hash = 0;

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash + source.charCodeAt(i) * (i + 1)) % gradients.length;
  }

  return gradients[hash];
}

function initialsFromName(name: string) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function PodiumCard({
  item,
  place,
}: {
  item: LeaderItem & { _rank: number; _revenue: number; _office: string; _name: string };
  place: 1 | 2 | 3;
}) {
  const gradient = officeGradient(item._office);

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.podiumCard, place === 1 && styles.podiumFirst]}
    >
      <View style={styles.podiumTop}>
        <Text style={styles.podiumPlace}>#{place}</Text>

        <View style={styles.officePillSoft}>
          <Text style={styles.officePillSoftText} numberOfLines={1}>
            {item._office}
          </Text>
        </View>
      </View>

      {avatarOf(item) ? (
        <Image source={{ uri: avatarOf(item)! }} style={styles.podiumAvatar} />
      ) : (
        <View style={styles.podiumAvatarFallback}>
          <Text style={styles.podiumAvatarText}>{initialsFromName(item._name)}</Text>
        </View>
      )}

      <Text style={styles.podiumName} numberOfLines={2}>
        {item._name}
      </Text>

      <Text style={styles.podiumRevenue}>{money(item._revenue)}</Text>
    </LinearGradient>
  );
}

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const { user: currentUser } = useCurrentUser();

  const isAdmin = Boolean(
    currentUser?.is_superuser || currentUser?.is_staff || currentUser?.role === 'admin'
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [leaders, setLeaders] = useState<LeaderItem[]>([]);
  const [allUsers, setAllUsers] = useState<LeaderItem[]>([]);
  const [manageMode, setManageMode] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      let ranked: LeaderItem[] = [];

      try {
        const response = await apiClient.get('gamification/leaderboard/');
        ranked = Array.isArray(response.data?.results)
          ? response.data.results
          : Array.isArray(response.data)
          ? response.data
          : [];
      } catch {
        ranked = [];
      }

      let usersList: LeaderItem[] = [];
      try {
        usersList = (await fetchAllPages('users/users/')) as LeaderItem[];
      } catch {
        usersList = [];
      }

      if (!ranked.length && usersList.length) {
        ranked = [...usersList].sort((a, b) => toRevenue(b) - toRevenue(a));
      }

      setLeaders(ranked);
      setAllUsers(usersList);
    } catch {
      setLeaders([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const visibleRanked = useMemo(() => {
    const base = leaders.length ? leaders : allUsers;

    return [...base]
      .filter((item) => item?.access_profile?.can_be_in_leaderboard !== false)
      .map((item) => ({
        ...item,
        _revenue: toRevenue(item),
        _office: officeLabel(item),
        _name: fullName(item),
      }))
      .sort((a, b) => b._revenue - a._revenue)
      .map((item, index) => ({
        ...item,
        _rank: index + 1,
      }));
  }, [leaders, allUsers]);

  const podium = useMemo(() => {
    const first = visibleRanked[0];
    const second = visibleRanked[1];
    const third = visibleRanked[2];

    return [
      second ? { ...second, _podiumPlace: 2 as 2 } : null,
      first ? { ...first, _podiumPlace: 1 as 1 } : null,
      third ? { ...third, _podiumPlace: 3 as 3 } : null,
    ].filter(Boolean) as Array<any>;
  }, [visibleRanked]);

  const myRow = useMemo(() => {
    return visibleRanked.find((item) => item.id === currentUser?.id) || null;
  }, [visibleRanked, currentUser?.id]);

  const rankingUsersForAdmin = useMemo(() => {
    const list = allUsers.length ? allUsers : leaders;

    return [...list]
      .map((item) => ({
        ...item,
        _revenue: toRevenue(item),
        _office: officeLabel(item),
        _name: fullName(item),
        _visible: item?.access_profile?.can_be_in_leaderboard !== false,
      }))
      .sort((a, b) => b._revenue - a._revenue);
  }, [allUsers, leaders]);

  const toggleVisibility = async (item: any) => {
    if (!isAdmin) return;

    const nextValue = !item._visible;
    setSavingUserId(item.id);

    try {
      await apiClient.patch(`users/users/${item.id}/access_profile/`, {
        can_be_in_leaderboard: nextValue,
      });

      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                access_profile: {
                  ...(u.access_profile || {}),
                  can_be_in_leaderboard: nextValue,
                },
              }
            : u
        )
      );

      setLeaders((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                access_profile: {
                  ...(u.access_profile || {}),
                  can_be_in_leaderboard: nextValue,
                },
              }
            : u
        )
      );
    } catch (error: any) {
      Alert.alert(
        'Не удалось изменить видимость',
        error?.response?.data?.detail ||
          'На backend пока нет route users/users/:id/access_profile/ или он ещё не обновлён.'
      );
    } finally {
      setSavingUserId(null);
    }
  };

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Рейтинг</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Мягкие цвета по офисам и управление видимостью
            </Text>
          </View>

          {isAdmin && (
            <Pressable
              onPress={() => setManageMode((v) => !v)}
              style={[
                styles.manageBtn,
                {
                  backgroundColor: manageMode ? theme.blue : theme.card,
                  borderColor: manageMode ? theme.blue : theme.border,
                },
              ]}
            >
              <Ionicons
                name={manageMode ? 'settings' : 'settings-outline'}
                size={16}
                color={manageMode ? '#fff' : theme.text}
              />
              <Text
                style={[
                  styles.manageBtnText,
                  { color: manageMode ? '#fff' : theme.text },
                ]}
              >
                {manageMode ? 'Управление' : 'Настроить'}
              </Text>
            </Pressable>
          )}
        </View>

        {podium.length > 0 && (
          <View style={styles.podiumRow}>
            {podium.map((item) => (
              <PodiumCard key={`podium-${item.id}`} item={item} place={item._podiumPlace} />
            ))}
          </View>
        )}

        {myRow && (
          <LinearGradient
            colors={officeGradient(myRow._office)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.meCard}
          >
            <Text style={styles.meLabel}>Моё место</Text>

            <View style={styles.meRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.meRank}>#{myRow._rank}</Text>
                <Text style={styles.meName} numberOfLines={1}>
                  {myRow._name}
                </Text>
              </View>

              <Text style={styles.meRevenue}>{money(myRow._revenue)}</Text>
            </View>
          </LinearGradient>
        )}

        <View
          style={[
            styles.tableWrap,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Таблица рейтинга</Text>

          {visibleRanked.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              В рейтинге пока никого нет.
            </Text>
          ) : (
            [...visibleRanked]
              .sort((a, b) => a._rank - b._rank)
              .map((item) => {
                const gradient = officeGradient(item._office);
                const isMe = item.id === currentUser?.id;

                return (
                  <LinearGradient
                    key={`row-${item.id}`}
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.rowGradient, isMe && styles.rowGradientMe]}
                  >
                    <View style={styles.rankCell}>
                      <Text style={styles.rankText}>#{item._rank}</Text>
                    </View>

                    {avatarOf(item) ? (
                      <Image source={{ uri: avatarOf(item)! }} style={styles.rowAvatar} />
                    ) : (
                      <View style={styles.rowAvatarFallback}>
                        <Text style={styles.rowAvatarText}>
                          {initialsFromName(item._name)}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item._name}
                      </Text>

                      <View style={styles.officePillSoftSmall}>
                        <Text style={styles.officePillSoftText}>{item._office}</Text>
                      </View>
                    </View>

                    <Text style={styles.rowRevenue}>{money(item._revenue)}</Text>
                  </LinearGradient>
                );
              })
          )}
        </View>

        {isAdmin && manageMode && (
          <View
            style={[
              styles.tableWrap,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Кого показывать в рейтинге
            </Text>

            {rankingUsersForAdmin.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Сотрудники не загружены.
              </Text>
            ) : (
              rankingUsersForAdmin.map((item) => {
                const gradient = officeGradient(item._office);
                const saving = savingUserId === item.id;

                return (
                  <LinearGradient
                    key={`manage-${item.id}`}
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.manageRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manageName}>{item._name}</Text>
                      <Text style={styles.manageMeta}>
                        {item._office} · {money(item._revenue)}
                      </Text>
                    </View>

                    {saving ? (
                      <ActivityIndicator color={SOFT_ACCENT} />
                    ) : (
                      <Switch
                        value={item._visible}
                        onValueChange={() => toggleVisibility(item)}
                      />
                    )}
                  </LinearGradient>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  manageBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  podiumRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  podiumCard: {
    flex: 1,
    borderRadius: 24,
    padding: 14,
    minHeight: 190,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.10)',
  },
  podiumFirst: {
    minHeight: 220,
  },
  podiumTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  podiumPlace: {
    color: SOFT_TEXT,
    fontSize: 22,
    fontWeight: '900',
  },
  officePillSoft: {
    maxWidth: 128,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  officePillSoftSmall: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  officePillSoftText: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
  },
  podiumAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignSelf: 'center',
  },
  podiumAvatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignSelf: 'center',
    backgroundColor: 'rgba(123,97,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  podiumAvatarText: {
    color: SOFT_TEXT,
    fontSize: 22,
    fontWeight: '900',
  },
  podiumName: {
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
  },
  podiumRevenue: {
    color: SOFT_ACCENT,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  meCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.10)',
  },
  meLabel: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meRank: {
    color: SOFT_TEXT,
    fontSize: 28,
    fontWeight: '900',
  },
  meName: {
    marginTop: 4,
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '800',
  },
  meRevenue: {
    color: SOFT_ACCENT,
    fontSize: 22,
    fontWeight: '900',
  },
  tableWrap: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowGradient: {
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  rowGradientMe: {
    borderWidth: 2,
    borderColor: 'rgba(123,97,255,0.18)',
  },
  rankCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: SOFT_TEXT,
    fontSize: 18,
    fontWeight: '900',
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  rowAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(123,97,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  rowAvatarText: {
    color: SOFT_TEXT,
    fontSize: 16,
    fontWeight: '900',
  },
  rowName: {
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },
  rowRevenue: {
    color: SOFT_ACCENT,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  manageRow: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },
  manageName: {
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },
  manageMeta: {
    marginTop: 4,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '700',
  },
});