import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type TabKey = 'clients' | 'deals' | 'payments';

function isMineOrShared(item: any, userId: number, isAdmin: boolean) {
  if (isAdmin) return true;
  if (!item) return false;

  if ('manager' in item && item.manager === userId) return true;
  if (item.client_data?.manager === userId) return true;
  if (item.manager_data?.id === userId) return true;

  if (Array.isArray(item.shared_with) && item.shared_with.includes(userId)) return true;
  if (Array.isArray(item.shared_with_data) && item.shared_with_data.some((u: any) => u.id === userId)) return true;

  return false;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    new: 'Новый',
    consultation: 'Консультация',
    documents: 'Документы',
    visa: 'Виза',
    success: 'Успешно',
    rejected: 'Отказ',
    archive: 'Архив',
  };

  return map[String(status || '')] || String(status || 'new');
}

function statusTextColor(status: string | undefined, theme: any) {
  switch (status) {
    case 'success':
      return theme.success;
    case 'rejected':
      return theme.red;
    case 'archive':
      return theme.textMuted;
    case 'consultation':
    case 'documents':
    case 'visa':
    case 'new':
    default:
      return theme.blue;
  }
}

export default function CRMScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('clients');
  const [search, setSearch] = useState('');

  const [clients, setClients] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [clientData, dealData, paymentData] = await Promise.all([
        fetchAllPages('clients/'),
        fetchAllPages('analytics/deals/'),
        fetchAllPages('analytics/payments/'),
      ]);

      setClients(clientData.filter((x) => isMineOrShared(x, user.id, isAdmin)));
      setDeals(dealData.filter((x) => isMineOrShared(x, user.id, isAdmin)));
      setPayments(paymentData.filter((x) => isMineOrShared(x, user.id, isAdmin)));
    } catch (e) {
      console.log('CRM load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  const currentData = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (activeTab === 'clients') {
      return clients.filter(
        (c) =>
          !q ||
          String(c.full_name || '').toLowerCase().includes(q) ||
          String(c.phone || '').toLowerCase().includes(q) ||
          String(c.email || '').toLowerCase().includes(q) ||
          String(c.city || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'deals') {
      return deals.filter(
        (d) =>
          !q ||
          String(d.client_data?.full_name || d.client_name || '').toLowerCase().includes(q) ||
          String(d.service_title || d.custom_service_name || '').toLowerCase().includes(q) ||
          String(d.id).includes(q)
      );
    }

    return payments.filter(
      (p) =>
        !q ||
        String(p.id).includes(q) ||
        String(p.deal).includes(q) ||
        String(p.method || '').toLowerCase().includes(q)
    );
  }, [activeTab, clients, deals, payments, search]);

  const totalPages = Math.max(1, Math.ceil(currentData.length / pageSize));
  const paginated = currentData.slice((page - 1) * pageSize, page * pageSize);

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
            <Text style={[styles.title, { color: theme.text }]}>CRM</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              {isAdmin ? 'Вся база компании' : 'Только мои и shared клиенты'}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push('/documents' as any)}
              style={[
                styles.circleBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.circleBtnText, { color: theme.blue }]}>DOC</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/add-client' as any)}
              style={[styles.primaryBtn, { backgroundColor: theme.blue }]}
            >
              <Text style={styles.primaryBtnText}>+ Клиент</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              activeTab === 'clients'
                ? 'Поиск клиента'
                : activeTab === 'deals'
                  ? 'Поиск сделки'
                  : 'Поиск платежа'
            }
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={[styles.tabs, { backgroundColor: theme.backgroundSoft }]}>
          {(['clients', 'deals', 'payments'] as TabKey[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? theme.surface : 'transparent',
                    borderColor: active ? theme.border : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.text : theme.textSecondary,
                    fontWeight: active ? '900' : '700',
                  }}
                >
                  {tab === 'clients' ? 'Клиенты' : tab === 'deals' ? 'Сделки' : 'Платежи'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.countText, { color: theme.textSecondary }]}>
          Найдено: {currentData.length}
        </Text>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {paginated.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Ничего не найдено.</Text>
          ) : (
            paginated.map((item) => {
              if (activeTab === 'clients') {
                const archived = item.status === 'archive';

                return (
                  <Pressable
                    key={`c-${item.id}`}
                    onPress={() => router.push(`/client/${item.id}` as any)}
                    style={[
                      styles.row,
                      {
                        borderBottomColor: theme.divider,
                        opacity: archived ? 0.55 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        style={[
                          styles.rowTitle,
                          { color: archived ? theme.textSecondary : theme.text },
                        ]}
                      >
                        {item.full_name}
                      </Text>

                      <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                        {item.phone || 'Без телефона'} · {item.city || 'Без города'}
                      </Text>

                      {archived ? (
                        <Text style={[styles.archivedText, { color: theme.textMuted }]}>
                          Неактивный клиент
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: archived ? theme.backgroundSoft : theme.blueSoft,
                          borderColor: archived ? theme.border : theme.blueSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusTextColor(item.status, theme) },
                        ]}
                      >
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                  </Pressable>
                );
              }

              if (activeTab === 'deals') {
                return (
                  <Pressable
                    key={`d-${item.id}`}
                    onPress={() => router.push(`/deal/${item.id}` as any)}
                    style={[styles.row, { borderBottomColor: theme.divider }]}
                  >
                    <View>
                      <Text style={[styles.rowTitle, { color: theme.text }]}>
                        {item.client_data?.full_name || item.client_name || `Сделка #${item.id}`}
                      </Text>
                      <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                        {item.service_title || item.custom_service_name || item.deal_type}
                      </Text>
                    </View>
                    <Text style={[styles.rowValue, { color: theme.blue }]}>
                      ${Math.round(parseFloat(String(item.total_to_pay_usd || 0))).toLocaleString('ru-RU')}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={`p-${item.id}`}
                  onPress={() => router.push('/admin-payments' as any)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  <View>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Платёж #{item.id}</Text>
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Сделка #{item.deal} · {item.method || 'payment'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowValue,
                      { color: item.is_confirmed ? theme.success : theme.red },
                    ]}
                  >
                    ${Math.round(parseFloat(String(item.amount_usd || 0))).toLocaleString('ru-RU')}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.pagination}>
          <Pressable
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[
              styles.pageBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: page <= 1 ? 0.4 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '800' }}>Назад</Text>
          </Pressable>

          <Text style={[styles.pageText, { color: theme.text }]}>
            {page} / {totalPages}
          </Text>

          <Pressable
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={[
              styles.pageBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: page >= totalPages ? 0.4 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '800' }}>Вперёд</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  circleBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  circleBtnText: { fontWeight: '900', fontSize: 12 },
  primaryBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  searchBox: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: { fontSize: 15, fontWeight: '600' },
  tabs: { marginTop: 14, borderRadius: 18, padding: 4, flexDirection: 'row', gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  countText: { marginTop: 14, marginBottom: 10, fontSize: 13, fontWeight: '700' },
  list: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
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
  archivedText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadge: {
    minWidth: 98,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  empty: { padding: 18, fontSize: 14 },
  pagination: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  pageText: { fontSize: 14, fontWeight: '900' },
});