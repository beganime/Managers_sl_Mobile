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
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type FilterKey = 'pending' | 'confirmed' | 'offline' | 'all';

type PaymentItem = {
  id: number | string;
  deal?: number | string | null;
  amount?: number | string;
  amount_usd?: number | string;
  currency?: number | string | null;
  currency_data?: { code?: string; symbol?: string } | null;
  method?: string;
  is_confirmed?: boolean;
  created_at?: string;
  payment_date?: string;
  updated_at?: string;
  manager?: number;
  manager_data?: {
    first_name?: string;
    last_name?: string;
    office?: { city?: string } | null;
  } | null;
  isOffline?: boolean;
};

const OFFLINE_KEY = 'offline_payments';

function amountOf(item: PaymentItem) {
  return Number(item.amount_usd ?? item.amount ?? 0) || 0;
}

function money(value: number) {
  return `$${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function managerName(item: PaymentItem) {
  const first = item.manager_data?.first_name || '';
  const last = item.manager_data?.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || 'Менеджер';
}

function methodLabel(method?: string) {
  const map: Record<string, string> = {
    cash: 'Наличные',
    card: 'Карта',
    bank: 'Перевод',
  };
  return map[method || ''] || method || 'unknown';
}

export default function AdminPaymentsScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [items, setItems] = useState<PaymentItem[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<PaymentItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('pending');

  const readOffline = useCallback(async () => {
    try {
      const raw = await getToken(OFFLINE_KEY);
      return raw ? (JSON.parse(raw) as PaymentItem[]) : [];
    } catch {
      return [];
    }
  }, []);

  const saveOffline = useCallback(async (queue: PaymentItem[]) => {
    setOfflineQueue(queue);
    await saveToken(OFFLINE_KEY, JSON.stringify(queue));
  }, []);

  const load = useCallback(async () => {
    try {
      const [serverItems, queue] = await Promise.all([
        fetchAllPages('analytics/payments/').catch(() => []),
        readOffline(),
      ]);

      const normalizedQueue = queue.map((item) => ({ ...item, isOffline: true }));
      setItems([...(serverItems as PaymentItem[]), ...normalizedQueue]);
      setOfflineQueue(queue);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readOffline]);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const syncOffline = useCallback(async () => {
    const queue = await readOffline();

    if (!queue.length) {
      Alert.alert('Синхронизация', 'Локальных платежей нет.');
      return;
    }

    const remaining: PaymentItem[] = [];

    for (const item of queue) {
      try {
        if (!item.deal || String(item.deal).startsWith('temp_')) {
          remaining.push(item);
          continue;
        }

        await apiClient.post('analytics/payments/', {
          deal: Number(item.deal),
          amount: Number(item.amount ?? item.amount_usd ?? 0),
          method: item.method || 'cash',
          currency: item.currency ? Number(item.currency) : undefined,
        });
      } catch {
        remaining.push(item);
      }
    }

    await saveOffline(remaining);
    await load();

    Alert.alert(
      'Синхронизация',
      remaining.length
        ? 'Часть платежей осталась в локальной очереди.'
        : 'Все локальные платежи отправлены.'
    );
  }, [load, readOffline, saveOffline]);

  const confirmPayment = async (item: PaymentItem) => {
    if (!isAdmin) {
      Alert.alert('Ошибка', 'Подтверждать платежи может только администратор.');
      return;
    }

    if (item.isOffline) {
      Alert.alert('Ошибка', 'Оффлайн-платёж сначала нужно синхронизировать.');
      return;
    }

    if (!item.id || typeof item.id !== 'number') {
      Alert.alert('Ошибка', 'Некорректный ID платежа.');
      return;
    }

    setWorkingId(String(item.id));
    try {
      const response = await apiClient.post(`analytics/payments/${item.id}/confirm/`, {});

      await load();

      Alert.alert(
        'Готово',
        response?.data?.detail || `Платёж #${item.id} подтверждён.`
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.payment?.detail ||
        'Не удалось подтвердить платёж.';
      Alert.alert('Ошибка', msg);
    } finally {
      setWorkingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const isOffline = !!item.isOffline;
      const isConfirmed = !!item.is_confirmed;
      const isPending = !isOffline && !isConfirmed;

      if (filter === 'pending' && !isPending) return false;
      if (filter === 'confirmed' && !isConfirmed) return false;
      if (filter === 'offline' && !isOffline) return false;

      if (!q) return true;

      return (
        String(item.id).includes(q) ||
        String(item.deal ?? '').includes(q) ||
        String(item.method || '').toLowerCase().includes(q) ||
        managerName(item).toLowerCase().includes(q) ||
        String(item.manager_data?.office?.city || '').toLowerCase().includes(q)
      );
    });
  }, [filter, items, search]);

  const totals = useMemo(() => {
    const pending = items.filter((x) => !x.isOffline && !x.is_confirmed);
    const confirmed = items.filter((x) => !!x.is_confirmed);
    const offline = items.filter((x) => !!x.isOffline);

    return {
      pendingCount: pending.length,
      confirmedCount: confirmed.length,
      offlineCount: offline.length,
      pendingSum: pending.reduce((sum, x) => sum + amountOf(x), 0),
    };
  }, [items]);

  if (!isAdmin) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.text }]}>Доступ только для администратора.</Text>
        </View>
      </ScreenWrapper>
    );
  }

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
        <View style={styles.head}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Платежи</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Ждут подтверждения: {totals.pendingCount} · {money(totals.pendingSum)}
            </Text>
          </View>

          <Pressable onPress={syncOffline} style={[styles.primaryBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.primaryBtnText}>Sync offline</Text>
          </Pressable>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totals.pendingCount}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Pending</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totals.confirmedCount}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Confirmed</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totals.offlineCount}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Offline</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по ID, сделке, офису, менеджеру"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={styles.chipsRow}>
            {[
              { key: 'pending', label: 'Ждут' },
              { key: 'confirmed', label: 'Подтверждённые' },
              { key: 'offline', label: 'Оффлайн' },
              { key: 'all', label: 'Все' },
            ].map((item) => {
              const active = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key as FilterKey)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ gap: 12, marginTop: 16 }}>
          {filteredItems.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>Платежи не найдены.</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const offline = !!item.isOffline;
              const busy = workingId === String(item.id);

              return (
                <View
                  key={String(item.id)}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        Платёж #{item.id}
                      </Text>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        Сделка #{item.deal || '-'} · {methodLabel(item.method)}
                      </Text>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        {managerName(item)} · {item.manager_data?.office?.city || 'Без офиса'}
                      </Text>
                    </View>

                    <View>
                      <Text style={[styles.amount, { color: theme.blue }]}>{money(amountOf(item))}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: offline
                              ? theme.redSoft
                              : item.is_confirmed
                              ? '#EAF8EF'
                              : '#FFF4E8',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: offline
                                ? theme.red
                                : item.is_confirmed
                                ? theme.success
                                : theme.warning,
                            },
                          ]}
                        >
                          {offline ? 'OFFLINE' : item.is_confirmed ? 'CONFIRMED' : 'PENDING'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {!offline && !item.is_confirmed && (
                    <View style={styles.actionsRow}>
                      <Pressable
                        disabled={busy}
                        onPress={() => confirmPayment(item)}
                        style={[styles.actionBtn, { backgroundColor: theme.success }]}
                      >
                        <Text style={styles.actionBtnText}>
                          {busy ? 'Подтверждение...' : 'Подтвердить'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  denied: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  primaryBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14 },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  kpiLabel: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  searchBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18 },
  searchInput: { fontSize: 15, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 5, fontSize: 13, fontWeight: '600' },
  amount: { fontSize: 18, fontWeight: '900', textAlign: 'right' },
  statusPill: { marginTop: 10, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900' },
});