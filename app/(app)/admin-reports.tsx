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
import Markdown from 'react-native-markdown-display';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
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

type PaymentItem = {
  id: number;
  amount?: number | string;
  amount_usd?: number | string;
  is_confirmed?: boolean;
};

function stripHtml(value?: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/ /g, ' ')
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
  const POSITIVE = theme.success || '#1AAE6F';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<FilterKey>('today');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [aiError, setAiError] = useState('');

  const load = useCallback(async () => {
    try {
      const [reportsData, paymentsData] = await Promise.all([
        fetchAllPages('reports/daily/').catch(() => []),
        fetchAllPages('analytics/payments/').catch(() => []),
      ]);

      setReports((reportsData || []) as ReportItem[]);
      setPayments((paymentsData || []) as PaymentItem[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAiSummary = useCallback(async (selectedFilter: FilterKey) => {
    setAiLoading(true);
    setAiError('');

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const params: Record<string, string> = {};

      if (selectedFilter === 'today') {
        params.date_from = todayStr;
        params.date_to = todayStr;
      } else if (selectedFilter === 'week') {
        params.date_from = weekAgo;
      }

      const response = await apiClient.get('reports/daily/ai_summary/', { params });

      // Для AI мы НЕ используем stripHtml, чтобы сохранить Markdown разметку!
      setAiSummary(response?.data?.summary || '');
      setAiProvider(String(response?.data?.provider || ''));
      setAiError(String(response?.data?.error || ''));
    } catch (error: any) {
      setAiSummary('');
      setAiProvider('');
      setAiError(
        error?.response?.data?.detail ||
          'AI summary пока недоступен. Проверь endpoint reports/daily/ai_summary/.'
      );
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void load();
    } else {
      setLoading(false);
    }
  }, [isAdmin, load]);

  useEffect(() => {
    if (isAdmin) {
      void loadAiSummary(filter);
    }
  }, [filter, isAdmin, loadAiSummary]);

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

  // Стили для Markdown (автоматически подстраиваются под тему)
  const mdStyles = useMemo(
    () =>
      StyleSheet.create({
        body: { color: theme.text, fontSize: 15, lineHeight: 24 },
        heading1: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 16, marginBottom: 8 },
        heading2: { color: theme.text, fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 6 },
        heading3: { color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
        strong: { color: theme.text, fontWeight: '800' },
        em: { color: theme.text, fontStyle: 'italic' },
        bullet_list: { marginTop: 6, marginBottom: 6 },
        ordered_list: { marginTop: 6, marginBottom: 6 },
        paragraph: { marginTop: 6, marginBottom: 6 },
        list_item: { marginTop: 4, marginBottom: 4 },
      }),
    [theme]
  );

  if (!isAdmin) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.text }]}>
            Доступ только для администратора.
          </Text>
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
              void load();
              void loadAiSummary(filter);
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Отчёты</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Доход, расход, daily reports и итоговый AI анализ
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
                <Text
                  style={{
                    color: active ? '#fff' : theme.text,
                    fontWeight: '900',
                    fontSize: 13,
                  }}
                >
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
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(stats.income)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Доход по отчётам</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(stats.expense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Расход по отчётам</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(stats.turnover)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Подтверждённый оборот</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text
              style={[
                styles.kpiValue,
                { color: stats.balance >= 0 ? POSITIVE : theme.red },
              ]}
            >
              {money(stats.balance)}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Баланс отчётов</Text>
          </View>
        </View>

        <View style={[styles.aiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.aiHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiTitle, { color: theme.text }]}>Ответ ИИ</Text>
              <Text style={[styles.aiSub, { color: theme.textSecondary }]}>
                Сводка на основе ваших данных
              </Text>
            </View>

            <Pressable
              onPress={() => void loadAiSummary(filter)}
              style={({ pressed }) => [
                styles.aiRefreshBtn,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={theme.blue} />
              ) : (
                <Text style={[styles.aiRefreshText, { color: theme.blue }]}>Обновить</Text>
              )}
            </Pressable>
          </View>

          {!!aiProvider && (
            <Text style={[styles.aiProvider, { color: theme.blue }]}>
              Провайдер: {aiProvider.toUpperCase()}
            </Text>
          )}

          <View
            style={[
              styles.aiBodyWrap,
              {
                backgroundColor: theme.backgroundSoft,
                borderColor: theme.border,
              },
            ]}
          >
            {aiSummary ? (
              <Markdown style={mdStyles}>
                {aiSummary}
              </Markdown>
            ) : (
              <Text style={[styles.aiBody, { color: theme.text }]}>
                {aiError || 'AI summary пока не получен.'}
              </Text>
            )}
          </View>
        </View>

        {filteredReports.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.preview, { color: theme.textSecondary }]}>Отчётов нет.</Text>
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      {item.employee_name || `Сотрудник #${item.employee || item.id}`}
                    </Text>
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      {item.date || String(item.created_at || '').slice(0, 10) || 'Без даты'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: theme.backgroundSoft,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: theme.blue }]}>
                      +{num(item.leads_processed)} лидов
                    </Text>
                  </View>
                </View>

                <View style={styles.moneyRow}>
                  <Text style={[styles.moneyText, { color: POSITIVE }]}>
                    Доход: {money(income)}
                  </Text>
                  <Text style={[styles.moneyText, { color: theme.red }]}>
                    Расход: {money(expense)}
                  </Text>
                </View>

                <Text style={[styles.moneyText, { color: theme.textSecondary, marginTop: 8 }]}>
                  {num(item.deals_closed)} сделок
                </Text>

                {!expanded ? (
                  <Text style={[styles.preview, { color: theme.textSecondary }]}>
                    {preview || '— Нет текста —'}
                  </Text>
                ) : (
                  <Text style={[styles.preview, { color: theme.textSecondary }]}>
                    {stripHtml(item.content) || '— Нет текста —'}
                  </Text>
                )}
              </Pressable>
            );
          })
        )}
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
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  kpiCard: { width: '48%', borderWidth: 1, borderRadius: 20, padding: 16 },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  aiCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  aiHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  aiSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  aiRefreshBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  aiRefreshText: {
    fontSize: 13,
    fontWeight: '800',
  },
  aiProvider: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '900',
  },
  aiBodyWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  aiBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginTop: 14,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '900' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  moneyText: { fontSize: 13, fontWeight: '900' },
  preview: { marginTop: 12, fontSize: 14, fontWeight: '500', lineHeight: 21 },
});