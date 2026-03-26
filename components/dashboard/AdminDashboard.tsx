import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { CurrentUser } from '../../hooks/useCurrentUser';
import { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
  user: CurrentUser;
  onRefresh: () => void;
}

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

export default function AdminDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [usersData, paymentsData, documentsData] = await Promise.all([
        fetchAllPages('users/users/'),
        fetchAllPages('analytics/payments/'),
        fetchAllPages('documents/generated/'),
      ]);

      setUsers(usersData);
      setPayments(paymentsData);

      const docs = documentsData.filter((doc) => doc.status === 'generated');
      setPendingDocs(docs);

      const pendingPays = paymentsData.filter((p) => !p.is_confirmed);
      setPendingPayments(pendingPays);
    } catch (e) {
      console.log('Admin dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const officeRevenue = useMemo(() => {
    const officeMap = new Map<number, string>();
    users.forEach((u) => {
      officeMap.set(u.id, u.office?.city || 'Без офиса');
    });

    const bucket: Record<string, number> = {};
    payments
      .filter((p) => p.is_confirmed)
      .forEach((p) => {
        const office = officeMap.get(p.manager) || p.manager_data?.office?.city || 'Без офиса';
        const amount = parseFloat(String(p.amount_usd || p.net_income_usd || 0));
        bucket[office] = (bucket[office] || 0) + amount;
      });

    return Object.entries(bucket)
      .map(([office, revenue]) => ({ office, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [users, payments]);

  const totalRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.is_confirmed)
        .reduce((sum, p) => sum + parseFloat(String(p.amount_usd || 0)), 0),
    [payments]
  );

  const totalNet = useMemo(
    () =>
      payments
        .filter((p) => p.is_confirmed)
        .reduce((sum, p) => sum + parseFloat(String(p.net_income_usd || p.amount_usd || 0)), 0),
    [payments]
  );

  const adminActions = [
    { title: 'Сотрудники', route: '/admin-staff', subtitle: 'Добавить, удалить, редактировать' },
    { title: 'Платежи', route: '/admin-payments', subtitle: 'Подтверждение и касса' },
    { title: 'Отчёты', route: '/admin-reports', subtitle: 'Финансы, расходы, аналитика' },
    { title: 'CRM', route: '/crm', subtitle: 'Сделки, клиенты, договоры' },
  ];

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
      <LinearGradient colors={theme.gradientMain as [string, string, ...string[]]} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              onRefresh();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View>
            <Text style={[styles.caption, { color: theme.textSecondary }]}>Администратор</Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {user.first_name} {user.last_name}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: theme.blueSoft }]}>
            <Text style={[styles.badgeText, { color: theme.blue }]}>ADMIN</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalRevenue)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Оборот</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalNet)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Net доход</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingPayments.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут платежи</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingDocs.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут документы</Text>
          </View>
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Быстрые действия</Text>
        <View style={styles.actionsGrid}>
          {adminActions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.route as any)}
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
              <Text style={[styles.actionSub, { color: theme.textSecondary }]}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Доход по офисам</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {officeRevenue.length === 0 ? (
            <Text style={{ color: theme.textSecondary }}>Пока нет подтверждённых платежей.</Text>
          ) : (
            officeRevenue.map((row) => (
              <View key={row.office} style={[styles.row, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{row.office}</Text>
                <Text style={[styles.rowValue, { color: theme.blue }]}>{money(row.revenue)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Требуют подтверждения</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {pendingPayments.slice(0, 5).map((p) => (
            <Pressable key={p.id} onPress={() => router.push('/admin-payments' as any)} style={[styles.row, { borderBottomColor: theme.divider }]}>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Платёж #{p.id}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  Сделка #{p.deal} · {p.method || 'payment'}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.red }]}>
                {money(parseFloat(String(p.amount_usd || 0)))}
              </Text>
            </Pressable>
          ))}

          {pendingDocs.slice(0, 5).map((doc) => (
            <Pressable key={`doc-${doc.id}`} onPress={() => router.push('/documents' as any)} style={[styles.row, { borderBottomColor: theme.divider }]}>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{doc.title || `Документ #${doc.id}`}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>Ожидает одобрения</Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.blue }]}>Открыть</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  badgeText: { fontSize: 12, fontWeight: '900' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  kpiCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 14 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  actionTitle: { fontSize: 16, fontWeight: '900' },
  actionSub: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  panel: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
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
  rowValue: { fontSize: 14, fontWeight: '900' },
});