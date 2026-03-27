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

type OfficeItem = {
  id: number;
  city?: string;
  address?: string;
  monthly_revenue?: number | string;
  employee_count?: number;
};

type UserItem = {
  id: number;
  role?: string;
  office?: {
    id?: number;
    city?: string;
    address?: string;
  } | null;
};

type PaymentItem = {
  id: number;
  deal?: number;
  manager?: number;
  amount_usd?: number | string;
  net_income_usd?: number | string;
  method?: string;
  is_confirmed?: boolean;
};

type ExpenseItem = {
  id: number;
  manager?: number | null;
  title?: string;
  amount_usd?: number | string;
};

type DocumentItem = {
  id: number;
  title?: string;
  status?: string;
};

type OfficeCard = {
  id: number;
  title: string;
  address: string;
  income: number;
  expense: number;
  employees: number;
};

function parseAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function money(value?: string | number | null) {
  const amount = parseAmount(value);
  return `$${amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return {
    date_from: format(start),
    date_to: format(now),
  };
}

export default function AdminDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [pendingDocs, setPendingDocs] = useState<DocumentItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentItem[]>([]);

  const load = useCallback(async () => {
    try {
      const { date_from, date_to } = currentMonthRange();

      const [usersResult, officesResult, paymentsResult, expensesResult, documentsResult] = await Promise.allSettled([
        fetchAllPages('users/users/'),
        fetchAllPages('users/offices/'),
        fetchAllPages(`analytics/payments/?date_from=${date_from}&date_to=${date_to}`),
        fetchAllPages(`analytics/expenses/?date_from=${date_from}&date_to=${date_to}`),
        fetchAllPages('documents/generated/'),
      ]);

      const safeUsers = usersResult.status === 'fulfilled' ? ((usersResult.value as UserItem[]) || []) : [];
      const safeOffices = officesResult.status === 'fulfilled' ? ((officesResult.value as OfficeItem[]) || []) : [];
      const safePayments = paymentsResult.status === 'fulfilled' ? ((paymentsResult.value as PaymentItem[]) || []) : [];
      const safeExpenses = expensesResult.status === 'fulfilled' ? ((expensesResult.value as ExpenseItem[]) || []) : [];
      const safeDocuments = documentsResult.status === 'fulfilled' ? ((documentsResult.value as DocumentItem[]) || []) : [];

      setUsers(safeUsers);
      setOffices(safeOffices);
      setPayments(safePayments);
      setExpenses(safeExpenses);
      setPendingDocs(safeDocuments.filter((doc) => doc.status === 'generated'));
      setPendingPayments(safePayments.filter((payment) => !payment.is_confirmed));
    } catch (error) {
      console.log('Admin dashboard load error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const officeCards = useMemo<OfficeCard[]>(() => {
    const managerOfficeMap = new Map<number, number | null>();
    const employeeCountMap = new Map<number, number>();
    const fallbackIncomeMap = new Map<number, number>();
    const expenseMap = new Map<number, number>();

    users.forEach((staff) => {
      const officeId = staff.office?.id ?? null;
      managerOfficeMap.set(staff.id, officeId);

      if (officeId) {
        employeeCountMap.set(officeId, (employeeCountMap.get(officeId) || 0) + 1);
      }
    });

    payments
      .filter((payment) => payment.is_confirmed)
      .forEach((payment) => {
        const officeId = payment.manager ? managerOfficeMap.get(payment.manager) : null;
        if (!officeId) return;

        fallbackIncomeMap.set(officeId, (fallbackIncomeMap.get(officeId) || 0) + parseAmount(payment.amount_usd));
      });

    expenses.forEach((expense) => {
      const officeId = expense.manager ? managerOfficeMap.get(expense.manager) : null;
      if (!officeId) return;

      expenseMap.set(officeId, (expenseMap.get(officeId) || 0) + parseAmount(expense.amount_usd));
    });

    return offices
      .map((office) => {
        const incomeFromOffice = parseAmount(office.monthly_revenue);
        const fallbackIncome = fallbackIncomeMap.get(office.id) || 0;

        return {
          id: office.id,
          title: office.city || `Офис #${office.id}`,
          address: office.address || 'Адрес не указан',
          income: incomeFromOffice > 0 ? incomeFromOffice : fallbackIncome,
          expense: expenseMap.get(office.id) || 0,
          employees: Number(office.employee_count ?? employeeCountMap.get(office.id) ?? 0),
        };
      })
      .sort((a, b) => b.income - a.income);
  }, [expenses, offices, payments, users]);

  const totalIncome = useMemo(() => officeCards.reduce((sum, office) => sum + office.income, 0), [officeCards]);
  const totalExpense = useMemo(() => officeCards.reduce((sum, office) => sum + office.expense, 0), [officeCards]);
  const totalEmployees = useMemo(() => officeCards.reduce((sum, office) => sum + office.employees, 0), [officeCards]);

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
        showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View>
            <Text style={[styles.caption, { color: theme.textMuted }]}>Администратор</Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {user.first_name} {user.last_name}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: theme.redSoft }]}>
            <Text style={[styles.badgeText, { color: theme.red }]}>ADMIN</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <LinearGradient colors={theme.gradientSurface as [string, string]} style={[styles.kpiCard, { borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalIncome)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Доход офисов</Text>
          </LinearGradient>

          <LinearGradient colors={theme.gradientSurface as [string, string]} style={[styles.kpiCard, { borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalExpense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Расход офисов</Text>
          </LinearGradient>

          <LinearGradient colors={theme.gradientSurface as [string, string]} style={[styles.kpiCard, { borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totalEmployees}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Сотрудники</Text>
          </LinearGradient>

          <LinearGradient colors={theme.gradientSurface as [string, string]} style={[styles.kpiCard, { borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingPayments.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Ждут подтверждения</Text>
          </LinearGradient>
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Быстрые действия</Text>
        <View style={styles.actionsGrid}>
          {adminActions.map((action) => (
            <Pressable
              key={action.route}
              onPress={() => router.push(action.route as any)}
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Офисы</Text>
        {officeCards.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Пока нет офисов или финансовых данных по ним.</Text>
          </View>
        ) : (
          officeCards.map((office) => {
            const net = office.income - office.expense;

            return (
              <View key={office.id} style={[styles.officeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.officeHead}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.officeTitle, { color: theme.text }]}>{office.title}</Text>
                    <Text style={[styles.officeAddress, { color: theme.textMuted }]}>{office.address}</Text>
                  </View>

                  <View style={[styles.netPill, { backgroundColor: net >= 0 ? theme.blueSoft : theme.redSoft }]}>
                    <Text style={[styles.netPillText, { color: net >= 0 ? theme.blue : theme.red }]}>{money(net)}</Text>
                  </View>
                </View>

                <View style={styles.officeStatsRow}>
                  <View style={[styles.officeStat, { backgroundColor: theme.backgroundSoft }]}> 
                    <Text style={[styles.officeStatLabel, { color: theme.textMuted }]}>Доход</Text>
                    <Text style={[styles.officeStatValue, { color: theme.text }]}>{money(office.income)}</Text>
                  </View>

                  <View style={[styles.officeStat, { backgroundColor: theme.backgroundSoft }]}> 
                    <Text style={[styles.officeStatLabel, { color: theme.textMuted }]}>Расход</Text>
                    <Text style={[styles.officeStatValue, { color: theme.text }]}>{money(office.expense)}</Text>
                  </View>

                  <View style={[styles.officeStat, { backgroundColor: theme.backgroundSoft }]}> 
                    <Text style={[styles.officeStatLabel, { color: theme.textMuted }]}>Сотрудники</Text>
                    <Text style={[styles.officeStatValue, { color: theme.text }]}>{office.employees}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <Text style={[styles.section, { color: theme.text }]}>Требуют подтверждения</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {pendingPayments.length === 0 ? (
            <Text style={[styles.emptyInline, { color: theme.textMuted }]}>Нет неподтверждённых платежей.</Text>
          ) : (
            pendingPayments.slice(0, 5).map((payment) => (
              <Pressable
                key={`payment-${payment.id}`}
                onPress={() => router.push('/admin-payments' as any)}
                style={[styles.row, { borderBottomColor: theme.divider }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Платёж #{payment.id}</Text>
                  <Text style={[styles.rowMeta, { color: theme.textMuted }]}>Сделка #{payment.deal} · {payment.method || 'payment'}</Text>
                </View>
                <Text style={[styles.rowValue, { color: theme.text }]}>{money(payment.amount_usd)}</Text>
              </Pressable>
            ))
          )}

          {pendingDocs.slice(0, 5).map((doc) => (
            <Pressable
              key={`doc-${doc.id}`}
              onPress={() => router.push('/documents' as any)}
              style={[styles.row, { borderBottomColor: theme.divider }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{doc.title || `Документ #${doc.id}`}</Text>
                <Text style={[styles.rowMeta, { color: theme.textMuted }]}>Ожидает одобрения</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
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
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  kpiLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
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
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  officeCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  officeHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  officeTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  officeAddress: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  netPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  netPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  officeStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  officeStat: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
  },
  officeStatLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  officeStatValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
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
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyInline: {
    padding: 16,
    fontSize: 14,
    fontWeight: '600',
  },
});
