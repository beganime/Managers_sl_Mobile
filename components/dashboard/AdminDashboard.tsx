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

type PaymentItem = {
  id: number;
  deal?: number | string | null;
  manager?: number | null;
  method?: string;
  amount?: number | string;
  amount_usd?: number | string;
  net_income_usd?: number | string;
  is_confirmed?: boolean;
  manager_data?: {
    office?: {
      city?: string;
    } | null;
  } | null;
};

type ExpenseItem = {
  id: number;
  title?: string;
  amount?: number | string;
  amount_usd?: number | string;
  date?: string;
  manager?: number | null;
  manager_data?: {
    office?: {
      city?: string;
    } | null;
  } | null;
};

type CashflowItem = {
  id: number;
  office?: number | null;
  office_name?: string;
  created_by_name?: string | null;
  entry_type?: 'income' | 'expense' | string;
  title?: string;
  category?: string;
  comment?: string;
  amount?: number | string;
  amount_usd?: number | string;
  entry_date?: string;
  is_confirmed?: boolean;
};

type DocumentItem = {
  id: number;
  title?: string;
  status?: string;
};

type DailyReportItem = {
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

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function officeOfPayment(payment: PaymentItem, officeMap: Map<number, string>) {
  return (
    officeMap.get(Number(payment.manager || 0)) ||
    payment.manager_data?.office?.city ||
    'Без офиса'
  );
}

function officeOfExpense(expense: ExpenseItem, officeMap: Map<number, string>) {
  return (
    officeMap.get(Number(expense.manager || 0)) ||
    expense.manager_data?.office?.city ||
    'Без офиса'
  );
}

function officeOfCashflow(item: CashflowItem) {
  return item.office_name || 'Без офиса';
}

function reportIncome(item: DailyReportItem) {
  return num(item.income ?? item.income_usd ?? item.total_income);
}

function reportExpense(item: DailyReportItem) {
  return num(item.expense ?? item.expense_usd ?? item.total_expense);
}

export default function AdminDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const POSITIVE = theme.success || '#1AAE6F';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [cashflow, setCashflow] = useState<CashflowItem[]>([]);
  const [pendingDocs, setPendingDocs] = useState<DocumentItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentItem[]>([]);
  const [reports, setReports] = useState<DailyReportItem[]>([]);
  const [cashflowEnabled, setCashflowEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersData, paymentsData, documentsData, reportsData, expensesData] =
        await Promise.all([
          fetchAllPages('users/users/').catch(() => []),
          fetchAllPages('analytics/payments/').catch(() => []),
          fetchAllPages('documents/generated/').catch(() => []),
          fetchAllPages('reports/daily/').catch(() => []),
          fetchAllPages('analytics/expenses/').catch(() => []),
        ]);

      setUsers((usersData || []) as any[]);
      setPayments((paymentsData || []) as PaymentItem[]);
      setReports((reportsData || []) as DailyReportItem[]);
      setExpenses((expensesData || []) as ExpenseItem[]);

      const docs = ((documentsData || []) as DocumentItem[]).filter((doc) => {
        const status = String(doc.status || '').toLowerCase();
        return status === 'generated' || status === 'pending';
      });
      setPendingDocs(docs);

      const pendingPays = ((paymentsData || []) as PaymentItem[]).filter((p) => !p.is_confirmed);
      setPendingPayments(pendingPays);

      try {
        const cashflowData = await fetchAllPages('analytics/cashflow/');
        setCashflow((cashflowData || []) as CashflowItem[]);
        setCashflowEnabled(true);
      } catch {
        setCashflow([]);
        setCashflowEnabled(false);
      }
    } catch (e) {
      console.log('Admin dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const officeMap = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u: any) => {
      map.set(Number(u.id), u.office?.city || 'Без офиса');
    });
    return map;
  }, [users]);

  const totalRevenueDeals = useMemo(
    () =>
      payments
        .filter((p) => p.is_confirmed)
        .reduce((sum, p) => sum + num(p.amount_usd || p.amount || 0), 0),
    [payments]
  );

  const totalNetDeals = useMemo(
    () =>
      payments
        .filter((p) => p.is_confirmed)
        .reduce((sum, p) => sum + num(p.net_income_usd || p.amount_usd || 0), 0),
    [payments]
  );

  const totalOfficeExpenses = useMemo(
    () => expenses.reduce((sum, x) => sum + num(x.amount_usd ?? x.amount), 0),
    [expenses]
  );

  const totalCashflowIncome = useMemo(
    () =>
      cashflow
        .filter((x) => String(x.entry_type || '').toLowerCase() === 'income')
        .reduce((sum, x) => sum + num(x.amount_usd ?? x.amount), 0),
    [cashflow]
  );

  const totalCashflowExpense = useMemo(
    () =>
      cashflow
        .filter((x) => String(x.entry_type || '').toLowerCase() === 'expense')
        .reduce((sum, x) => sum + num(x.amount_usd ?? x.amount), 0),
    [cashflow]
  );

  const fullOfficeIncome = useMemo(
    () => totalRevenueDeals + totalCashflowIncome,
    [totalRevenueDeals, totalCashflowIncome]
  );

  const fullOfficeExpense = useMemo(
    () => totalOfficeExpenses + totalCashflowExpense,
    [totalOfficeExpenses, totalCashflowExpense]
  );

  const fullOfficeBalance = useMemo(
    () => fullOfficeIncome - fullOfficeExpense,
    [fullOfficeIncome, fullOfficeExpense]
  );

  const officeFinance = useMemo(() => {
    const bucket: Record<
      string,
      {
        office: string;
        deals_income: number;
        extra_income: number;
        expenses: number;
      }
    > = {};

    payments
      .filter((p) => p.is_confirmed)
      .forEach((p) => {
        const office = officeOfPayment(p, officeMap);
        if (!bucket[office]) {
          bucket[office] = {
            office,
            deals_income: 0,
            extra_income: 0,
            expenses: 0,
          };
        }
        bucket[office].deals_income += num(p.amount_usd || p.amount || 0);
      });

    expenses.forEach((e) => {
      const office = officeOfExpense(e, officeMap);
      if (!bucket[office]) {
        bucket[office] = {
          office,
          deals_income: 0,
          extra_income: 0,
          expenses: 0,
        };
      }
      bucket[office].expenses += num(e.amount_usd ?? e.amount);
    });

    cashflow.forEach((c) => {
      const office = officeOfCashflow(c);
      if (!bucket[office]) {
        bucket[office] = {
          office,
          deals_income: 0,
          extra_income: 0,
          expenses: 0,
        };
      }

      if (String(c.entry_type || '').toLowerCase() === 'income') {
        bucket[office].extra_income += num(c.amount_usd ?? c.amount);
      } else if (String(c.entry_type || '').toLowerCase() === 'expense') {
        bucket[office].expenses += num(c.amount_usd ?? c.amount);
      }
    });

    return Object.values(bucket)
      .map((row) => ({
        ...row,
        total_income: row.deals_income + row.extra_income,
        balance: row.deals_income + row.extra_income - row.expenses,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8);
  }, [payments, expenses, cashflow, officeMap]);

  const today = new Date().toISOString().slice(0, 10);

  const todayReports = useMemo(
    () =>
      reports.filter((r) => String(r.date || r.created_at || '').slice(0, 10) === today),
    [reports, today]
  );

  const todayIncome = useMemo(
    () => todayReports.reduce((sum, r) => sum + reportIncome(r), 0),
    [todayReports]
  );

  const todayExpense = useMemo(
    () => todayReports.reduce((sum, r) => sum + reportExpense(r), 0),
    [todayReports]
  );

  const adminActions = [
    {
      title: 'Сотрудники',
      route: '/(app)/admin-staff',
      subtitle: 'Доступы, офисы, рейтинг, планы',
    },
    {
      title: 'Финансы',
      route: '/(app)/admin-payments',
      subtitle: 'Платежи, доходы, расходы',
    },
    {
      title: 'Отчёты',
      route: '/(app)/admin-reports',
      subtitle: 'Daily reports и AI summary',
    },
    {
      title: 'CRM',
      route: '/(app)/crm',
      subtitle: 'Сделки, клиенты, договоры',
    },
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
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
              onRefresh();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[theme.blue, '#5B86E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={styles.caption}>Администратор</Text>
              <Text style={styles.title}>
                {user.first_name} {user.last_name}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>ADMIN</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>{money(fullOfficeIncome)}</Text>
              <Text style={styles.heroLabel}>Полный доход офисов</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>{money(fullOfficeBalance)}</Text>
              <Text style={styles.heroLabel}>Итоговый баланс</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingPayments.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут платежи</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingDocs.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут документы</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(fullOfficeExpense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Полный расход офисов</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalNetDeals)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Net по сделкам</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(todayIncome)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Доход по отчётам сегодня</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(todayExpense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Расход по отчётам сегодня</Text>
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

        <Text style={[styles.section, { color: theme.text }]}>Финансы по офисам</Text>
        <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {!cashflowEnabled && (
            <View style={[styles.noticeBox, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                Свободные доходы/расходы из cashflow не найдены. Сейчас в сводке учтены сделки и расходы, которые доступны на backend.
              </Text>
            </View>
          )}

          {officeFinance.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Пока нет финансовых данных по офисам.
            </Text>
          ) : (
            officeFinance.map((row, index) => (
              <View
                key={`${row.office}-${index}`}
                style={[
                  styles.officeFinanceCard,
                  {
                    borderColor: theme.divider,
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                <View style={styles.officeFinanceHead}>
                  <Text style={[styles.officeTitle, { color: theme.text }]}>{row.office}</Text>
                  <Text
                    style={[
                      styles.officeBalance,
                      { color: row.balance >= 0 ? POSITIVE : theme.red },
                    ]}
                  >
                    {money(row.balance)}
                  </Text>
                </View>

                <View style={styles.officeFinanceRow}>
                  <Text style={[styles.officeFinanceLabel, { color: theme.textSecondary }]}>
                    Сделки
                  </Text>
                  <Text style={[styles.officeFinanceValue, { color: theme.text }]}>
                    {money(row.deals_income)}
                  </Text>
                </View>

                <View style={styles.officeFinanceRow}>
                  <Text style={[styles.officeFinanceLabel, { color: theme.textSecondary }]}>
                    Прочие доходы
                  </Text>
                  <Text style={[styles.officeFinanceValue, { color: POSITIVE }]}>
                    {money(row.extra_income)}
                  </Text>
                </View>

                <View style={styles.officeFinanceRow}>
                  <Text style={[styles.officeFinanceLabel, { color: theme.textSecondary }]}>
                    Расходы
                  </Text>
                  <Text style={[styles.officeFinanceValue, { color: theme.red }]}>
                    {money(row.expenses)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Требуют подтверждения</Text>
        <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {pendingPayments.slice(0, 5).map((p, idx) => (
            <Pressable
              key={`p-${p.id}`}
              onPress={() => router.push('/(app)/admin-payments' as any)}
              style={[
                styles.row,
                {
                  borderBottomColor: theme.divider,
                  borderBottomWidth:
                    idx === pendingPayments.slice(0, 5).length - 1 && pendingDocs.slice(0, 5).length === 0 ? 0 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Платёж #{p.id}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  Сделка #{p.deal || '-'} · {p.method || 'payment'}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.blue }]}>
                {money(num(p.amount_usd || 0))}
              </Text>
            </Pressable>
          ))}

          {pendingDocs.slice(0, 5).map((doc, idx) => (
            <Pressable
              key={`d-${doc.id}`}
              onPress={() => router.push('/(app)/documents' as any)}
              style={[
                styles.row,
                {
                  borderBottomColor: theme.divider,
                  borderBottomWidth: idx === pendingDocs.slice(0, 5).length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {doc.title || `Документ #${doc.id}`}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  Ожидает одобрения
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.blue }]}>Открыть</Text>
            </Pressable>
          ))}

          {pendingPayments.length === 0 && pendingDocs.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Сейчас ничего не ждёт подтверждения.
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  hero: {
    borderRadius: 26,
    padding: 18,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  heroStat: {
    flex: 1,
  },
  heroValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 22,
  },
  kpiCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  section: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 26,
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  actionSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  panel: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    padding: 16,
  },
  noticeBox: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  officeFinanceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  officeFinanceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  officeTitle: {
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  officeBalance: {
    fontSize: 16,
    fontWeight: '900',
  },
  officeFinanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  officeFinanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  officeFinanceValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  row: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  rowValue: { fontSize: 14, fontWeight: '900' },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});