import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type LeadItem = {
  id: number;
  full_name?: string;
  email?: string | null;
  phone?: string;
  country?: string;
  education?: string;
  age?: number | null;
  relation?: string;
  direction?: string;
  student_name?: string;
  parent_name?: string;
  has_passport?: string;
  passport_expiry?: string | null;
  travel_month?: string;
  travel_date?: string | null;
  departure_city?: string;
  arrival_city?: string;
  luggage?: string;
  current_education?: string;
  current_university?: string;
  current_country?: string;
  manager?: number | null;
  manager_name?: string | null;
  manager_email?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type StatusFilter = 'all' | 'new' | 'contacted' | 'converted' | 'rejected';

type DirectionFilter =
  | 'all'
  | 'admission'
  | 'translation'
  | 'umrah'
  | 'visa'
  | 'tickets'
  | 'tours'
  | 'work_visa';

type OrderingValue =
  | '-created_at'
  | 'created_at'
  | '-updated_at'
  | 'updated_at'
  | 'full_name'
  | '-full_name'
  | 'status'
  | '-status'
  | 'direction'
  | '-direction';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'all', label: 'Все', icon: 'layers-outline' },
  { key: 'new', label: 'Новые', icon: 'sparkles-outline' },
  { key: 'contacted', label: 'В работе', icon: 'call-outline' },
  { key: 'converted', label: 'Клиенты', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Отказ', icon: 'close-circle-outline' },
];

const DIRECTION_OPTIONS: Array<{ key: DirectionFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'all', label: 'Все направления', icon: 'grid-outline' },
  { key: 'admission', label: 'Поступление', icon: 'school-outline' },
  { key: 'translation', label: 'Переводы', icon: 'language-outline' },
  { key: 'umrah', label: 'Умра/Хадж', icon: 'moon-outline' },
  { key: 'visa', label: 'Виза', icon: 'document-text-outline' },
  { key: 'tickets', label: 'Билеты', icon: 'airplane-outline' },
  { key: 'tours', label: 'Туры', icon: 'map-outline' },
  { key: 'work_visa', label: 'Рабочие визы', icon: 'briefcase-outline' },
];

const ORDERING_OPTIONS: Array<{ key: OrderingValue; label: string }> = [
  { key: '-created_at', label: 'Новые сверху' },
  { key: 'created_at', label: 'Старые сверху' },
  { key: '-updated_at', label: 'Недавно обновлены' },
  { key: 'updated_at', label: 'Давно обновлены' },
  { key: 'full_name', label: 'А-Я' },
  { key: '-full_name', label: 'Я-А' },
  { key: 'status', label: 'По статусу' },
  { key: 'direction', label: 'По направлению' },
];

function formatDate(value?: string) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
}

function statusLabel(status?: string) {
  const found = STATUS_OPTIONS.find((item) => item.key === status);
  return found?.label || status || '—';
}

function directionLabel(direction?: string) {
  const found = DIRECTION_OPTIONS.find((item) => item.key === direction);
  return found?.label || direction || '—';
}

function leadTitle(lead: LeadItem) {
  return lead.full_name || lead.student_name || lead.parent_name || `Заявка #${lead.id}`;
}

function statusColor(status: string | undefined, theme: any) {
  switch (status) {
    case 'converted':
      return { bg: '#E7F8EC', color: '#157347', icon: 'checkmark-circle' as const };
    case 'contacted':
      return { bg: theme.blueSoft, color: theme.blue, icon: 'call' as const };
    case 'rejected':
      return { bg: theme.redSoft, color: theme.red, icon: 'close-circle' as const };
    default:
      return { bg: '#FFF4E5', color: '#B26A00', icon: 'time' as const };
  }
}

function extractError(error: any) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.status?.[0] ||
    error?.response?.data?.manager?.[0] ||
    'Не удалось выполнить действие.'
  );
}

export default function LeadsScreen() {
  const router = useRouter();
  const { theme, themeMode } = useTheme();

  const dark = themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [ordering, setOrdering] = useState<OrderingValue>('-created_at');

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }, [count]);

  const load = useCallback(
    async (targetPage = page) => {
      try {
        const response = await apiClient.get('leads/mobile/', {
          params: {
            limit: PAGE_SIZE,
            offset: targetPage * PAGE_SIZE,
            search: submittedSearch.trim() || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
            direction: directionFilter === 'all' ? undefined : directionFilter,
            ordering,
          },
        });

        const payload = response.data;
        const results = Array.isArray(payload) ? payload : payload.results ?? [];

        setLeads(results);
        setCount(Array.isArray(payload) ? results.length : payload.count ?? results.length);
        setPage(targetPage);
      } catch (error: any) {
        Alert.alert('Ошибка', extractError(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, submittedSearch, statusFilter, directionFilter, ordering]
  );

  useEffect(() => {
    setLoading(true);
    void load(0);
  }, [submittedSearch, statusFilter, directionFilter, ordering]);

  const onRefresh = () => {
    setRefreshing(true);
    void load(page);
  };

  const applySearch = () => {
    setSubmittedSearch(search.trim());
    setPage(0);
  };

  const clearSearch = () => {
    setSearch('');
    setSubmittedSearch('');
    setPage(0);
  };

  const goPrev = () => {
    if (page <= 0) return;
    void load(page - 1);
  };

  const goNext = () => {
    if (page + 1 >= totalPages) return;
    void load(page + 1);
  };

  const takeLead = async (lead: LeadItem) => {
    try {
      setWorkingId(lead.id);
      await apiClient.post(`leads/mobile/${lead.id}/take/`, {});
      await load(page);
      Alert.alert('Готово', 'Заявка взята в работу.');
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setWorkingId(null);
    }
  };

  const changeStatus = async (lead: LeadItem, status: string) => {
    try {
      setWorkingId(lead.id);
      await apiClient.patch(`leads/mobile/${lead.id}/`, { status });
      await load(page);
      Alert.alert('Готово', 'Статус заявки обновлён.');
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setWorkingId(null);
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
      <View style={styles.bgLayer} pointerEvents="none">
        <View style={[styles.blobOne, { backgroundColor: theme.blueSoft }]} />
        <View style={[styles.blobTwo, { backgroundColor: theme.redSoft }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Заявки</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Фильтр, сортировка, ответственные и пагинация
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.hero,
            {
              backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
              shadowColor: theme.shadow || '#000',
            },
          ]}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={24} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.heroValue, { color: theme.text }]}>{count}</Text>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
              Всего заявок по текущему фильтру
            </Text>
          </View>

          <View style={[styles.pagePill, { backgroundColor: theme.blueSoft }]}>
            <Text style={[styles.pagePillText, { color: theme.blue }]}>
              {page + 1}/{totalPages}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={applySearch}
            placeholder="Поиск: имя, телефон, страна, город"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />

          {!!search && (
            <Pressable onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable onPress={applySearch} style={[styles.searchBtn, { backgroundColor: theme.blue }]}>
          <Text style={styles.searchBtnText}>Применить поиск</Text>
        </Pressable>

        <Text style={[styles.filterTitle, { color: theme.textSecondary }]}>Статус</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {STATUS_OPTIONS.map((item) => {
            const active = statusFilter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setStatusFilter(item.key);
                  setPage(0);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.blue : theme.card,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <Ionicons name={item.icon} size={14} color={active ? '#fff' : theme.text} />
                <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.filterTitle, { color: theme.textSecondary }]}>Направление</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {DIRECTION_OPTIONS.map((item) => {
            const active = directionFilter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setDirectionFilter(item.key);
                  setPage(0);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.blue : theme.card,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <Ionicons name={item.icon} size={14} color={active ? '#fff' : theme.text} />
                <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.filterTitle, { color: theme.textSecondary }]}>Сортировка</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {ORDERING_OPTIONS.map((item) => {
            const active = ordering === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setOrdering(item.key);
                  setPage(0);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.blue : theme.card,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {leads.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="file-tray-outline" size={26} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Заявки не найдены</Text>
          </View>
        ) : (
          leads.map((lead) => {
            const meta = statusColor(lead.status, theme);
            const busy = workingId === lead.id;

            return (
              <View
                key={lead.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
                    borderColor: theme.border,
                    shadowColor: theme.shadow || '#000',
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{leadTitle(lead)}</Text>
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      #{lead.id} · {directionLabel(lead.direction)}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                    <Text style={[styles.statusPillText, { color: meta.color }]}>
                      {statusLabel(lead.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <Text style={[styles.line, { color: theme.textSecondary }]}>
                    Телефон: <Text style={{ color: theme.text }}>{lead.phone || '—'}</Text>
                  </Text>

                  <Text style={[styles.line, { color: theme.textSecondary }]}>
                    Email: <Text style={{ color: theme.text }}>{lead.email || '—'}</Text>
                  </Text>

                  <Text style={[styles.line, { color: theme.textSecondary }]}>
                    Страна:{' '}
                    <Text style={{ color: theme.text }}>
                      {lead.country || lead.current_country || '—'}
                    </Text>
                  </Text>

                  <Text style={[styles.line, { color: theme.textSecondary }]}>
                    Ответственный:{' '}
                    <Text style={{ color: theme.text }}>{lead.manager_name || 'Не назначен'}</Text>
                  </Text>

                  {!!lead.student_name && (
                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Студент: <Text style={{ color: theme.text }}>{lead.student_name}</Text>
                    </Text>
                  )}

                  {!!lead.parent_name && (
                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Родитель: <Text style={{ color: theme.text }}>{lead.parent_name}</Text>
                    </Text>
                  )}

                  {!!lead.departure_city && (
                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Вылет: <Text style={{ color: theme.text }}>{lead.departure_city}</Text>
                    </Text>
                  )}

                  {!!lead.arrival_city && (
                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Прибытие: <Text style={{ color: theme.text }}>{lead.arrival_city}</Text>
                    </Text>
                  )}
                </View>

                <Text style={[styles.dateLine, { color: theme.textMuted }]}>
                  Создано: {formatDate(lead.created_at)} · Обновлено: {formatDate(lead.updated_at)}
                </Text>

                <View style={styles.actionsRow}>
                  {!lead.manager && lead.status !== 'converted' && (
                    <Pressable
                      onPress={() => takeLead(lead)}
                      disabled={busy}
                      style={[styles.actionBtn, { backgroundColor: theme.blue, opacity: busy ? 0.7 : 1 }]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="person-add-outline" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Взять</Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {lead.status !== 'contacted' && lead.status !== 'converted' && (
                    <Pressable
                      onPress={() => changeStatus(lead, 'contacted')}
                      disabled={busy}
                      style={[styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSoft }]}
                    >
                      <Ionicons name="call-outline" size={16} color={theme.blue} />
                      <Text style={[styles.ghostBtnText, { color: theme.blue }]}>В работе</Text>
                    </Pressable>
                  )}

                  {lead.status !== 'converted' && (
                    <Pressable
                      onPress={() => changeStatus(lead, 'converted')}
                      disabled={busy}
                      style={[styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSoft }]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#1AAE6F" />
                      <Text style={[styles.ghostBtnText, { color: '#1AAE6F' }]}>Клиент</Text>
                    </Pressable>
                  )}

                  {lead.status !== 'rejected' && (
                    <Pressable
                      onPress={() => changeStatus(lead, 'rejected')}
                      disabled={busy}
                      style={[styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSoft }]}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={theme.red} />
                      <Text style={[styles.ghostBtnText, { color: theme.red }]}>Отказ</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={styles.paginationRow}>
          <Pressable
            onPress={goPrev}
            disabled={page <= 0}
            style={[
              styles.pageBtn,
              {
                backgroundColor: page <= 0 ? theme.backgroundSoft : theme.card,
                borderColor: theme.border,
                opacity: page <= 0 ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
            <Text style={[styles.pageBtnText, { color: theme.text }]}>Назад</Text>
          </Pressable>

          <Text style={[styles.pageText, { color: theme.textSecondary }]}>
            Страница {page + 1} из {totalPages}
          </Text>

          <Pressable
            onPress={goNext}
            disabled={page + 1 >= totalPages}
            style={[
              styles.pageBtn,
              {
                backgroundColor: page + 1 >= totalPages ? theme.backgroundSoft : theme.card,
                borderColor: theme.border,
                opacity: page + 1 >= totalPages ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.pageBtnText, { color: theme.text }]}>Вперёд</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.text} />
          </Pressable>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -90,
    opacity: 0.55,
  },
  blobTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 260,
    left: -100,
    opacity: 0.35,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 130,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  hero: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(38,116,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroLabel: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  pagePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pagePillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  searchBox: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  searchBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  filterTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  cardMeta: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  infoGrid: {
    marginTop: 10,
    gap: 6,
  },
  line: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  dateLine: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  paginationRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  pageText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
});