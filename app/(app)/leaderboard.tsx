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

type KpiQuality = {
  key: string;
  label: string;
  score: number;
  max_score: number;
  value: number | string;
  hint?: string;
};

type AttendanceDay = {
  id?: number;
  date?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  hours_worked?: number;
  is_closed?: boolean;
  is_auto_closed?: boolean;
  is_active?: boolean;
};

type LeaderItem = {
  id: number;
  rank?: number;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  social_contacts?: string;
  office_name?: string;
  revenue?: number | string;
  expense?: number | string;
  net_profit?: number | string;
  total_score?: number | string;
  avatar_url?: string | null;
  work_status?: string;
  is_effective?: boolean;
  office?: {
    id?: number;
    city?: string;
    address?: string;
    phone?: string;
  } | null;
  managersalary?: {
    current_month_revenue?: number | string;
    monthly_plan?: number | string;
  } | null;
  access_profile?: {
    can_be_in_leaderboard?: boolean;
    can_view_office_dashboard?: boolean;
    managed_office?: any;
  } | null;
  kpi?: {
    total_score?: number | string;
    income_usd?: number | string;
    expense_usd?: number | string;
    net_profit_usd?: number | string;
    qualities?: KpiQuality[];
    counts?: {
      clients_total?: number;
      clients_period?: number;
      leads?: number;
      deals?: number;
      present_days?: number;
      closed_workdays?: number;
      forgot_to_close?: number;
      shifts?: number;
      hours?: number;
    };
    period?: {
      date_from?: string;
      date_to?: string;
    };
  };
  details?: {
    period?: {
      date_from?: string;
      date_to?: string;
    };
    income_usd?: number | string;
    expense_usd?: number | string;
    net_profit_usd?: number | string;
    payment_amount_usd?: number | string;
    payment_net_income_usd?: number | string;
    office_income_usd?: number | string;
    office_expense_usd?: number | string;
    old_expenses_usd?: number | string;
    current_month_revenue?: number | string;
    monthly_plan?: number | string;
    clients_total_count?: number;
    clients_period_count?: number;
    leads_count?: number;
    deals_count?: number;
    present_days_count?: number;
    shifts_count?: number;
    closed_workdays_count?: number;
    forgot_to_close_count?: number;
    total_hours?: number | string;
    attendance_days?: AttendanceDay[];
  };
};

type RankedLeader = LeaderItem & {
  _rank: number;
  _score: number;
  _income: number;
  _expense: number;
  _net: number;
  _office: string;
  _name: string;
  _visible: boolean;
};

const SOFT_TEXT = '#2F2A45';
const SOFT_TEXT_SECONDARY = '#6E668B';
const SOFT_ACCENT = '#7B61FF';
const SUCCESS = '#1AAE6F';
const WARNING = '#F59E0B';
const DANGER = '#EF4444';

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toRevenue(item: LeaderItem) {
  return toNumber(
    item?.revenue ??
      item?.kpi?.income_usd ??
      item?.details?.income_usd ??
      item?.managersalary?.current_month_revenue ??
      0
  );
}

function toExpense(item: LeaderItem) {
  return toNumber(item?.expense ?? item?.kpi?.expense_usd ?? item?.details?.expense_usd ?? 0);
}

function toNet(item: LeaderItem) {
  return toNumber(item?.net_profit ?? item?.kpi?.net_profit_usd ?? item?.details?.net_profit_usd ?? 0);
}

function toScore(item: LeaderItem) {
  const direct = toNumber(item?.total_score ?? item?.kpi?.total_score);
  if (direct > 0) return direct;

  const revenue = toRevenue(item);
  return revenue > 0 ? Math.min(35, revenue / 100) : 0;
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

function phoneOf(item: LeaderItem) {
  return item.phone || item.social_contacts || item.office?.phone || 'Не указан';
}

function money(value: number | string | undefined | null) {
  const n = toNumber(value);
  return `$${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function numberLabel(value: number | string | undefined | null) {
  return toNumber(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
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

function shortDate(value?: string | null) {
  if (!value) return '—';

  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}`;
  }

  return value;
}

function formatPeriod(item: LeaderItem) {
  const period = item.kpi?.period || item.details?.period;
  const from = period?.date_from;
  const to = period?.date_to;

  if (!from && !to) return 'Текущий период';
  return `${from || '—'} — ${to || '—'}`;
}

function qualityPercent(q: KpiQuality) {
  const score = toNumber(q.score);
  const max = toNumber(q.max_score);

  if (max <= 0) return 0;

  const p = Math.round((score / max) * 100);
  return Math.max(0, Math.min(100, p));
}

function statusLabel(status?: string) {
  if (status === 'vacation') return 'В отпуске';
  if (status === 'sick') return 'На больничном';
  return 'Работает';
}

function MetricPill({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.metricPill}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function KpiBar({ quality }: { quality: KpiQuality }) {
  const percent = qualityPercent(quality);
  const score = toNumber(quality.score);
  const isPenalty = score < 0;

  return (
    <View style={styles.qualityBox}>
      <View style={styles.qualityHeader}>
        <Text style={styles.qualityLabel}>{quality.label}</Text>
        <Text style={[styles.qualityScore, isPenalty && { color: DANGER }]}>
          {score > 0 ? '+' : ''}
          {numberLabel(score)} б.
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${isPenalty ? 0 : percent}%`,
              backgroundColor: isPenalty ? DANGER : SOFT_ACCENT,
            },
          ]}
        />
      </View>

      <Text style={styles.qualityHint} numberOfLines={2}>
        {quality.hint || `Значение: ${quality.value}`}
      </Text>
    </View>
  );
}

function AvatarBlock({ item, size = 46 }: { item: LeaderItem; size?: number }) {
  const name = fullName(item);
  const avatar = avatarOf(item);

  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(123,97,255,0.08)',
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
        },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: size >= 54 ? 19 : 15 }]}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

function ExpandedDetails({ item }: { item: RankedLeader }) {
  const counts = item.kpi?.counts || {};
  const details = item.details || {};
  const qualities = item.kpi?.qualities || [];
  const days = details.attendance_days || [];

  return (
    <View style={styles.expandedBox}>
      <View style={styles.contactGrid}>
        <View style={styles.contactItem}>
          <Text style={styles.contactLabel}>Почта</Text>
          <Text style={styles.contactValue} numberOfLines={1}>
            {item.email || 'Не указана'}
          </Text>
        </View>

        <View style={styles.contactItem}>
          <Text style={styles.contactLabel}>Номер / контакты</Text>
          <Text style={styles.contactValue} numberOfLines={1}>
            {phoneOf(item)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricPill icon="cash-outline" label="Доход" value={money(item._income)} color={SUCCESS} />
        <MetricPill icon="card-outline" label="Расход" value={money(item._expense)} color={DANGER} />
        <MetricPill icon="trending-up-outline" label="Итог" value={money(item._net)} color={SOFT_ACCENT} />
        <MetricPill
          icon="people-outline"
          label="Клиенты"
          value={`${details.clients_total_count ?? counts.clients_total ?? 0}`}
          color={SOFT_ACCENT}
        />
        <MetricPill
          icon="reader-outline"
          label="Заявки"
          value={`${details.leads_count ?? counts.leads ?? 0}`}
          color={WARNING}
        />
        <MetricPill
          icon="briefcase-outline"
          label="Сделки"
          value={`${details.deals_count ?? counts.deals ?? 0}`}
          color={SUCCESS}
        />
        <MetricPill
          icon="business-outline"
          label="Приходы"
          value={`${details.present_days_count ?? counts.present_days ?? 0} дн.`}
          color={SOFT_ACCENT}
        />
        <MetricPill
          icon="checkmark-done-outline"
          label="Закрыл день"
          value={`${details.closed_workdays_count ?? counts.closed_workdays ?? 0} раз`}
          color={SUCCESS}
        />
        <MetricPill
          icon="alert-circle-outline"
          label="Забыл закрыть"
          value={`${details.forgot_to_close_count ?? counts.forgot_to_close ?? 0} раз`}
          color={DANGER}
        />
        <MetricPill
          icon="time-outline"
          label="Часы"
          value={`${numberLabel(details.total_hours ?? counts.hours ?? 0)} ч.`}
          color={SOFT_ACCENT}
        />
      </View>

      {qualities.length > 0 && (
        <View style={styles.qualitiesWrap}>
          <Text style={styles.detailsTitle}>Оценки качества KPI</Text>

          {qualities.map((q) => (
            <KpiBar key={`${item.id}-${q.key}`} quality={q} />
          ))}
        </View>
      )}

      <View style={styles.attendanceWrap}>
        <View style={styles.detailsTitleRow}>
          <Text style={styles.detailsTitle}>Приходы в офис</Text>
          <Text style={styles.periodText}>{formatPeriod(item)}</Text>
        </View>

        {days.length === 0 ? (
          <Text style={styles.noDaysText}>За период приходов не найдено.</Text>
        ) : (
          days.slice(0, 10).map((day) => (
            <View key={`${item.id}-day-${day.id || day.date}`} style={styles.dayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayDate}>{shortDate(day.date)}</Text>
                <Text style={styles.dayTime}>
                  {day.time_in || '—'} → {day.time_out || 'не закрыт'}
                </Text>
              </View>

              <View
                style={[
                  styles.dayBadge,
                  {
                    backgroundColor: day.is_closed
                      ? 'rgba(26,174,111,0.12)'
                      : 'rgba(239,68,68,0.10)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayBadgeText,
                    {
                      color: day.is_closed ? SUCCESS : DANGER,
                    },
                  ]}
                >
                  {day.is_closed ? 'закрыт' : 'не закрыт'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

      if (isAdmin) {
        try {
          const response = await apiClient.get('gamification/leaderboard/?include_hidden=1');
          usersList = Array.isArray(response.data?.results)
            ? response.data.results
            : Array.isArray(response.data)
            ? response.data
            : [];
        } catch {
          usersList = [];
        }
      }

      if (!usersList.length) {
        try {
          usersList = (await fetchAllPages('users/users/')) as LeaderItem[];
        } catch {
          usersList = [];
        }
      }

      if (!ranked.length && usersList.length) {
        ranked = [...usersList].sort((a, b) => toScore(b) - toScore(a));
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
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const visibleRanked = useMemo<RankedLeader[]>(() => {
    const base = leaders.length ? leaders : allUsers;

    return [...base]
      .filter((item) => item?.access_profile?.can_be_in_leaderboard !== false)
      .map((item) => ({
        ...item,
        _score: toScore(item),
        _income: toRevenue(item),
        _expense: toExpense(item),
        _net: toNet(item),
        _office: officeLabel(item),
        _name: fullName(item),
        _visible: item?.access_profile?.can_be_in_leaderboard !== false,
        _rank: Number(item.rank || 0),
      }))
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return b._income - a._income;
      })
      .map((item, index) => ({
        ...item,
        _rank: item.rank || index + 1,
      }));
  }, [leaders, allUsers]);

  const myRow = useMemo(() => {
    return visibleRanked.find((item) => item.id === currentUser?.id) || null;
  }, [visibleRanked, currentUser?.id]);

  const rankingUsersForAdmin = useMemo<RankedLeader[]>(() => {
    const list = allUsers.length ? allUsers : leaders;

    return [...list]
      .map((item) => ({
        ...item,
        _score: toScore(item),
        _income: toRevenue(item),
        _expense: toExpense(item),
        _net: toNet(item),
        _office: officeLabel(item),
        _name: fullName(item),
        _visible: item?.access_profile?.can_be_in_leaderboard !== false,
        _rank: Number(item.rank || 0),
      }))
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return b._income - a._income;
      });
  }, [allUsers, leaders]);

  const toggleVisibility = async (item: RankedLeader) => {
    if (!isAdmin) return;

    const nextValue = !item._visible;
    setSavingUserId(item.id);

    try {
      await apiClient.patch(`users/users/${item.id}/access_profile/`, {
        can_be_in_leaderboard: nextValue,
      });

      await load();
    } catch (error: any) {
      Alert.alert(
        'Не удалось изменить видимость',
        error?.response?.data?.detail ||
          'Проверь backend route users/users/:id/access_profile/ и права администратора.'
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
            <Text style={[styles.title, { color: theme.text }]}>Рейтинг KPI</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Таблица сотрудников, баллы, офис, доходы, расходы и рабочие дни
            </Text>
          </View>

          {isAdmin && (
            <Pressable
              onPress={() => setManageMode((v) => !v)}
              style={[
                styles.manageBtn,
                {
                  backgroundColor: manageMode ? theme.blue : theme.surface,
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
                  {
                    color: manageMode ? '#fff' : theme.text,
                  },
                ]}
              >
                {manageMode ? 'Настройка' : 'Кого показывать'}
              </Text>
            </Pressable>
          )}
        </View>

        {myRow && (
          <LinearGradient
            colors={officeGradient(myRow._office)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.meCard}
          >
            <Text style={styles.meLabel}>Моё место</Text>

            <View style={styles.meRow}>
              <View style={styles.meLeft}>
                <AvatarBlock item={myRow} size={54} />

                <View style={{ flex: 1 }}>
                  <Text style={styles.meRank}>#{myRow._rank}</Text>
                  <Text style={styles.meName} numberOfLines={1}>
                    {myRow._name}
                  </Text>
                  <Text style={styles.meOffice} numberOfLines={1}>
                    {myRow._office}
                  </Text>
                </View>
              </View>

              <View style={styles.meScoreBox}>
                <Text style={styles.meScore}>{numberLabel(myRow._score)}</Text>
                <Text style={styles.meScoreLabel}>баллов</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        <View
          style={[
            styles.tableWrap,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Таблица рейтинга</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                Нажмите на сотрудника, чтобы открыть детали
              </Text>
            </View>

            <View style={[styles.totalBadge, { backgroundColor: theme.blueSoft }]}>
              <Text style={[styles.totalBadgeText, { color: theme.blue }]}>
                {visibleRanked.length}
              </Text>
            </View>
          </View>

          {visibleRanked.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              В рейтинге пока никого нет.
            </Text>
          ) : (
            visibleRanked.map((item) => {
              const gradient = officeGradient(item._office);
              const expanded = expandedId === item.id;
              const isMe = item.id === currentUser?.id;

              return (
                <LinearGradient
                  key={`row-${item.id}`}
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.rowGradient, isMe && styles.rowGradientMe]}
                >
                  <Pressable
                    onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                    style={styles.rowPressable}
                  >
                    <View style={styles.rankCell}>
                      <Text style={styles.rankText}>#{item._rank}</Text>
                    </View>

                    <AvatarBlock item={item} />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item._name}
                      </Text>

                      <View style={styles.rowMeta}>
                        <View style={styles.officePillSoftSmall}>
                          <Text style={styles.officePillSoftText} numberOfLines={1}>
                            {item._office}
                          </Text>
                        </View>

                        <Text style={styles.statusText} numberOfLines={1}>
                          {statusLabel(item.work_status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.scoreCell}>
                      <Text style={styles.scoreValue}>{numberLabel(item._score)}</Text>
                      <Text style={styles.scoreLabel}>KPI</Text>
                    </View>

                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={SOFT_TEXT_SECONDARY}
                    />
                  </Pressable>

                  {expanded && <ExpandedDetails item={item} />}
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
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Редактировать видимость в рейтинге
            </Text>

            <Text style={[styles.sectionSub, { color: theme.textSecondary, marginBottom: 12 }]}>
              Не все сотрудники должны участвовать в рейтинге. Здесь можно выключить лишних.
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
                    <AvatarBlock item={item} size={42} />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.manageName}>{item._name}</Text>
                      <Text style={styles.manageMeta}>
                        {item._office} · {numberLabel(item._score)} KPI · {money(item._income)}
                      </Text>
                    </View>

                    {saving ? (
                      <ActivityIndicator color={SOFT_ACCENT} />
                    ) : (
                      <Switch value={item._visible} onValueChange={() => toggleVisibility(item)} />
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

  meCard: {
    borderRadius: 26,
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
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },

  meLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  meRank: {
    color: SOFT_TEXT,
    fontSize: 24,
    fontWeight: '900',
  },

  meName: {
    marginTop: 2,
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  meOffice: {
    marginTop: 3,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '800',
  },

  meScoreBox: {
    minWidth: 76,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.76)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.10)',
  },

  meScore: {
    color: SOFT_ACCENT,
    fontSize: 20,
    fontWeight: '900',
  },

  meScoreLabel: {
    marginTop: 1,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
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

  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  totalBadge: {
    minWidth: 38,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  totalBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },

  emptyText: {
    fontSize: 14,
    fontWeight: '700',
  },

  rowGradient: {
    borderRadius: 22,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  rowGradientMe: {
    borderWidth: 2,
    borderColor: 'rgba(123,97,255,0.20)',
  },

  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  rankCell: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rankText: {
    color: SOFT_TEXT,
    fontSize: 17,
    fontWeight: '900',
  },

  avatarFallback: {
    backgroundColor: 'rgba(123,97,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  avatarFallbackText: {
    color: SOFT_TEXT,
    fontWeight: '900',
  },

  rowName: {
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  rowMeta: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  officePillSoftSmall: {
    alignSelf: 'flex-start',
    maxWidth: 145,
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

  statusText: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
  },

  scoreCell: {
    minWidth: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  scoreValue: {
    color: SOFT_ACCENT,
    fontSize: 15,
    fontWeight: '900',
  },

  scoreLabel: {
    marginTop: 1,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '900',
  },

  expandedBox: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.70)',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  contactGrid: {
    gap: 8,
  },

  contactItem: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  contactLabel: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  contactValue: {
    marginTop: 4,
    color: SOFT_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  metricsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  metricPill: {
    width: '48%',
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricLabel: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '800',
  },

  metricValue: {
    marginTop: 2,
    color: SOFT_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  qualitiesWrap: {
    marginTop: 14,
    gap: 8,
  },

  detailsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },

  detailsTitle: {
    color: SOFT_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  periodText: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '800',
  },

  qualityBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  qualityLabel: {
    flex: 1,
    color: SOFT_TEXT,
    fontSize: 12,
    fontWeight: '900',
  },

  qualityScore: {
    color: SOFT_ACCENT,
    fontSize: 12,
    fontWeight: '900',
  },

  progressTrack: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(47,42,69,0.08)',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
  },

  qualityHint: {
    marginTop: 7,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },

  attendanceWrap: {
    marginTop: 14,
    gap: 8,
  },

  noDaysText: {
    color: SOFT_TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
  },

  dayRow: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  dayDate: {
    color: SOFT_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  dayTime: {
    marginTop: 3,
    color: SOFT_TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
  },

  dayBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  dayBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  manageRow: {
    borderRadius: 20,
    padding: 12,
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
    fontSize: 12,
    fontWeight: '700',
  },
});