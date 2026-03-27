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

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type FilterKey = 'today' | 'week' | 'all';

type ReportItem = {
  id: number;
  employee?: number;
  employee_name?: string;
  date?: string;
  content?: string;
  leads_processed?: number;
  deals_closed?: number;
  income?: number | string;
  income_usd?: number | string;
  total_income?: number | string;
  expense?: number | string;
  expense_usd?: number | string;
  total_expense?: number | string;
  created_at?: string;
};

function stripHtml(value?: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v: number) {
  return `$${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function reportIncome(item: ReportItem) {
  return num(item.income ?? item.income_usd ?? item.total_income);
}

function reportExpense(item: ReportItem) {
  return num(item.expense ?? item.expense_usd ?? item.total_expense);
}

export default function AdminReportsScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('today');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [reportsData, paymentsData] = await Promise.all([
        fetchAllPages('reports/daily/').catch(() => []),
        fetchAllPages('analytics/payments/').catch(() => []),
      ]);

      setReports(reportsData as ReportItem[]);
      setPayments(paymentsData as any[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const filteredReports = useMemo(() => {
    return [...reports]
      .filter((item) => {
        const date = String(item.date || item.created_at || '').slice(0, 10);

        if (filter === 'today') return date === todayStr;
        if (filter === 'week') return date >= weekAgo;
        return true;
      })
      .sort((a, b) =>
        String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || ''))
      );
  }, [filter, reports, todayStr, weekAgo]);

  const stats = useMemo(() => {
    const confirmedPayments = payments.filter((p) => !!p.is_confirmed);
    const turnover = confirmedPayments.reduce(
      (sum, item) => sum + num(item.amount_usd ?? item.amount),
      0
    );

    const income = filteredReports.reduce((sum, item) => sum + reportIncome(item), 0);
    const expense = filteredReports.reduce((sum, item) => sum + reportExpense(item), 0);
    const employees = new Set(
      filteredReports.map((item) => item.employee_name || item.employee).filter(Boolean)
    ).size;

    return {
      turnover,
      income,
      expense,
      balance: income - expense,
      count: filteredReports.length,
      employees,
    };
  }, [filteredReports, payments]);

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
        <Text style={[styles.title, { color: theme.text }]}>Отчёты</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Доход, расход и ежедневные отчёты команды
        </Text>

        <View style={styles.filterRow}>
          {[
            { key: 'today', label: 'Сегодня' },
            { key: 'week', label: '7 дней' },
            { key: 'all', label: 'Все' },
          ].map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key as FilterKey)}
                style={[
                  styles.filterChip,
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

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.count}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Отчётов</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.employees}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Сотрудников</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.success }]}>{money(stats.income)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Доход по отчётам</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.red }]}>{money(stats.expense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Расход по отчётам</Text>
          </View>

          <View style={[styles.kpiWide, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiWideValue, { color: theme.blue }]}>{money(stats.turnover)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Подтверждённый оборот</Text>
          </View>

          <View style={[styles.kpiWide, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text
              style={[
                styles.kpiWideValue,
                { color: stats.balance >= 0 ? theme.success : theme.red },
              ]}
            >
              {money(stats.balance)}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Баланс отчётов</Text>
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 18 }}>
          {filteredReports.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>Отчётов нет.</Text>
            </View>
          ) : (
            filteredReports.map((item) => {
              const expanded = expandedId === item.id;
              const preview = stripHtml(item.content).slice(0, 180);
              const income = reportIncome(item);
              const expense = reportExpense(item);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {item.employee_name || `Сотрудник #${item.employee || item.id}`}
                      </Text>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        {item.date || String(item.created_at || '').slice(0, 10) || 'Без даты'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.pill, { backgroundColor: theme.blueSoft }]}>
                        <Text style={[styles.pillText, { color: theme.blue }]}>
                          +{num(item.leads_processed)} лидов
                        </Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: theme.redSoft, marginTop: 6 }]}>
                        <Text style={[styles.pillText, { color: theme.red }]}>
                          {num(item.deals_closed)} сделок
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.moneyRow}>
                    <Text style={[styles.moneyText, { color: theme.success }]}>Доход: {money(income)}</Text>
                    <Text style={[styles.moneyText, { color: theme.red }]}>Расход: {money(expense)}</Text>
                  </View>

                  {!expanded ? (
                    <Text style={[styles.preview, { color: theme.textSecondary }]}>
                      {preview || '— Нет текста —'}
                    </Text>
                  ) : (
                    <Text style={[styles.preview, { color: theme.text }]}>
                      {stripHtml(item.content) || '— Нет текста —'}
                    </Text>
                  )}
                </Pressable>
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
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  kpiCard: { width: '48%', borderWidth: 1, borderRadius: 20, padding: 16 },
  kpiWide: { width: '100%', borderWidth: 1, borderRadius: 20, padding: 16 },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiWideValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '900' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  moneyText: { fontSize: 13, fontWeight: '900' },
  preview: { marginTop: 12, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});