import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
  user: CurrentUser;
  onRefresh: () => void;
}

type OfficeData = {
  id?: number | null;
  city?: string;
  address?: string;
  phone?: string;
} | null;

type UserItem = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  office?: OfficeData;
  managersalary?: {
    current_month_revenue?: number | string;
    current_balance?: number | string;
    monthly_plan?: number | string;
  } | null;
};

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

type QuickEntryType = 'income' | 'expense';

type OfficeEmployeeRow = {
  id: number;
  full_name: string;
  email: string;
  revenue_month: number;
  income: number;
  expense: number;
  balance: number;
};

type OfficeFinanceRow = {
  key: string;
  officeId?: number | null;
  office: string;
  address?: string;
  phone?: string;
  deals_income: number;
  extra_income: number;
  expenses: number;
  total_income: number;
  balance: number;
  employees: OfficeEmployeeRow[];
};

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeName(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function officeKeyFromOffice(office?: OfficeData) {
  if (!office) return null;

  if (office.id) return `office:${office.id}`;
  if (office.city) return `city:${normalizeName(office.city)}`;

  return null;
}

function officeKeyFromName(city?: string | null) {
  const normalized = normalizeName(city);
  if (!normalized) return null;
  return `city:${normalized}`;
}

function officeTitleFromKey(key: string) {
  if (key.startsWith('city:')) {
    const raw = key.replace('city:', '');
    return raw || 'Без офиса';
  }
  return 'Офис';
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

  const [users, setUsers] = useState<UserItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [cashflow, setCashflow] = useState<CashflowItem[]>([]);
  const [pendingDocs, setPendingDocs] = useState<DocumentItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentItem[]>([]);
  const [reports, setReports] = useState<DailyReportItem[]>([]);
  const [cashflowEnabled, setCashflowEnabled] = useState(false);

  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [quickEntryType, setQuickEntryType] = useState<QuickEntryType>('income');
  const [quickOfficeKey, setQuickOfficeKey] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersData, paymentsData, documentsData, reportsData, expensesData] =
        await Promise.all([
          fetchAllPages('users/users/').catch(() => []),
          fetchAllPages('analytics/payments/').catch(() => []),
          fetchAllPages('documents/generated/?status=pending').catch(() => []),
          fetchAllPages('reports/daily/').catch(() => []),
          fetchAllPages('analytics/expenses/').catch(() => []),
        ]);

      setUsers((usersData || []) as UserItem[]);
      setPayments((paymentsData || []) as PaymentItem[]);
      setReports((reportsData || []) as DailyReportItem[]);
      setExpenses((expensesData || []) as ExpenseItem[]);
      setPendingDocs((documentsData || []) as DocumentItem[]);

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

  const officeFinance = useMemo<OfficeFinanceRow[]>(() => {
    const officeRegistry = new Map<
      string,
      {
        key: string;
        officeId?: number | null;
        office: string;
        address?: string;
        phone?: string;
      }
    >();

    const userOfficeKeyById = new Map<number, string>();
    const employeeMapByOffice = new Map<string, Map<number, OfficeEmployeeRow>>();

    const ensureOffice = (
      key: string | null,
      info?: {
        officeId?: number | null;
        office?: string;
        address?: string;
        phone?: string;
      }
    ) => {
      if (!key) return;

      if (!officeRegistry.has(key)) {
        officeRegistry.set(key, {
          key,
          officeId: info?.officeId ?? null,
          office: info?.office || officeTitleFromKey(key) || 'Без офиса',
          address: info?.address || '',
          phone: info?.phone || '',
        });
      } else {
        const current = officeRegistry.get(key)!;
        if (info?.officeId && !current.officeId) current.officeId = info.officeId;
        if (info?.office && (!current.office || current.office === 'Без офиса')) current.office = info.office;
        if (info?.address && !current.address) current.address = info.address;
        if (info?.phone && !current.phone) current.phone = info.phone;
      }
    };

    const ensureEmployee = (officeKey: string, userItem: UserItem) => {
      if (!employeeMapByOffice.has(officeKey)) {
        employeeMapByOffice.set(officeKey, new Map<number, OfficeEmployeeRow>());
      }

      const map = employeeMapByOffice.get(officeKey)!;
      if (!map.has(userItem.id)) {
        map.set(userItem.id, {
          id: userItem.id,
          full_name:
            `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim() || userItem.email || `ID ${userItem.id}`,
          email: userItem.email || '',
          revenue_month: num(userItem.managersalary?.current_month_revenue),
          income: 0,
          expense: 0,
          balance: 0,
        });
      }

      return map.get(userItem.id)!;
    };

    users.forEach((u) => {
      const key =
        officeKeyFromOffice(u.office) ||
        officeKeyFromName(u.office?.city) ||
        `user-office-missing:${u.id}`;

      const officeName = u.office?.city || 'Без офиса';

      ensureOffice(key, {
        officeId: u.office?.id ?? null,
        office: officeName,
        address: u.office?.address || '',
        phone: u.office?.phone || '',
      });

      userOfficeKeyById.set(u.id, key);
      ensureEmployee(key, u);
    });

    payments.forEach((p) => {
      const key =
        userOfficeKeyById.get(Number(p.manager || 0)) ||
        officeKeyFromName(p.manager_data?.office?.city) ||
        null;

      ensureOffice(key, {
        office: p.manager_data?.office?.city || 'Без офиса',
      });
    });

    expenses.forEach((e) => {
      const key =
        userOfficeKeyById.get(Number(e.manager || 0)) ||
        officeKeyFromName(e.manager_data?.office?.city) ||
        null;

      ensureOffice(key, {
        office: e.manager_data?.office?.city || 'Без офиса',
      });
    });

    cashflow.forEach((c) => {
      const key =
        (c.office ? `office:${c.office}` : null) ||
        officeKeyFromName(c.office_name) ||
        null;

      ensureOffice(key, {
        officeId: c.office ?? null,
        office: c.office_name || 'Без офиса',
      });
    });

    const bucket = new Map<string, OfficeFinanceRow>();

    officeRegistry.forEach((info, key) => {
      const employees = Array.from(employeeMapByOffice.get(key)?.values() || []);
      bucket.set(key, {
        key,
        officeId: info.officeId ?? null,
        office: info.office || 'Без офиса',
        address: info.address || '',
        phone: info.phone || '',
        deals_income: 0,
        extra_income: 0,
        expenses: 0,
        total_income: 0,
        balance: 0,
        employees,
      });
    });

    const ensureBucket = (key: string | null, officeName?: string) => {
      if (!key) return null;

      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          officeId: key.startsWith('office:') ? Number(key.replace('office:', '')) : null,
          office: officeName || officeTitleFromKey(key) || 'Без офиса',
          address: '',
          phone: '',
          deals_income: 0,
          extra_income: 0,
          expenses: 0,
          total_income: 0,
          balance: 0,
          employees: [],
        });
      }

      return bucket.get(key)!;
    };

    const findEmployee = (officeKey: string | null, userId?: number | null) => {
      if (!officeKey || !userId) return null;
      const office = bucket.get(officeKey);
      if (!office) return null;
      return office.employees.find((x) => x.id === userId) || null;
    };

    payments
      .filter((p) => p.is_confirmed)
      .forEach((p) => {
        const officeKey =
          userOfficeKeyById.get(Number(p.manager || 0)) ||
          officeKeyFromName(p.manager_data?.office?.city) ||
          null;

        const office = ensureBucket(officeKey, p.manager_data?.office?.city || 'Без офиса');
        if (!office) return;

        const amount = num(p.amount_usd || p.amount || 0);
        office.deals_income += amount;

        const employee = findEmployee(officeKey, p.manager ?? null);
        if (employee) {
          employee.income += amount;
        }
      });

    expenses.forEach((e) => {
      const officeKey =
        userOfficeKeyById.get(Number(e.manager || 0)) ||
        officeKeyFromName(e.manager_data?.office?.city) ||
        null;

      const office = ensureBucket(officeKey, e.manager_data?.office?.city || 'Без офиса');
      if (!office) return;

      const amount = num(e.amount_usd ?? e.amount);
      office.expenses += amount;

      const employee = findEmployee(officeKey, e.manager ?? null);
      if (employee) {
        employee.expense += amount;
      }
    });

    cashflow.forEach((c) => {
      const officeKey =
        (c.office ? `office:${c.office}` : null) ||
        officeKeyFromName(c.office_name) ||
        null;

      const office = ensureBucket(officeKey, c.office_name || 'Без офиса');
      if (!office) return;

      const amount = num(c.amount_usd ?? c.amount);
      if (String(c.entry_type || '').toLowerCase() === 'income') {
        office.extra_income += amount;
      } else if (String(c.entry_type || '').toLowerCase() === 'expense') {
        office.expenses += amount;
      }
    });

    return Array.from(bucket.values())
      .map((row) => {
        const employees = [...row.employees]
          .map((emp) => ({
            ...emp,
            balance: emp.income - emp.expense,
          }))
          .sort((a, b) => b.balance - a.balance);

        return {
          ...row,
          employees,
          total_income: row.deals_income + row.extra_income,
          balance: row.deals_income + row.extra_income - row.expenses,
        };
      })
      .sort((a, b) => a.office.localeCompare(b.office, 'ru'));
  }, [users, payments, expenses, cashflow]);

  const officeSelectorOptions = useMemo(() => {
    return officeFinance
      .filter((x) => !!x.officeId)
      .map((x) => ({
        key: x.key,
        officeId: x.officeId as number,
        label: x.office,
      }));
  }, [officeFinance]);

  const openQuickEntry = (type: QuickEntryType) => {
    setQuickEntryType(type);

    const firstOffice = officeSelectorOptions[0];
    setQuickOfficeKey(firstOffice?.key || '');

    setQuickTitle(type === 'income' ? 'Доход офиса' : 'Расход офиса');
    setQuickAmount('');
    setQuickComment('');
    setQuickEntryOpen(true);
  };

  const createQuickEntry = async () => {
    const selectedOffice = officeSelectorOptions.find((x) => x.key === quickOfficeKey);

    if (!selectedOffice?.officeId) {
      Alert.alert('Ошибка', 'Не удалось определить офис для операции.');
      return;
    }

    if (!quickTitle.trim()) {
      Alert.alert('Ошибка', 'Укажи название.');
      return;
    }

    if (!quickAmount.trim() || Number(quickAmount) <= 0) {
      Alert.alert('Ошибка', 'Сумма должна быть больше нуля.');
      return;
    }

    try {
      setQuickSaving(true);

      await apiClient.post('analytics/cashflow/', {
        office: selectedOffice.officeId,
        entry_type: quickEntryType,
        title: quickTitle.trim(),
        amount: quickAmount,
        comment: quickComment.trim(),
        category: '',
        entry_date: new Date().toISOString().slice(0, 10),
      });

      setQuickEntryOpen(false);
      await load();

      Alert.alert(
        'Готово',
        quickEntryType === 'income' ? 'Доход добавлен.' : 'Расход добавлен.'
      );
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.office?.[0] ||
        error?.response?.data?.currency?.[0] ||
        error?.response?.data?.title?.[0] ||
        error?.response?.data?.amount?.[0] ||
        'Не удалось создать операцию.';
      Alert.alert('Ошибка', detail);
    } finally {
      setQuickSaving(false);
    }
  };

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
              <Text style={styles.heroLabel}>Полный доход всех офисов</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroValue}>{money(fullOfficeBalance)}</Text>
              <Text style={styles.heroLabel}>Итоговый баланс</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={[styles.section, { color: theme.text }]}>Быстрые операции</Text>
        <View style={styles.quickFinanceRow}>
          <Pressable
            onPress={() => openQuickEntry('income')}
            style={[styles.quickFinanceCard, { backgroundColor: '#EAF7EF', borderColor: '#CBE9D5' }]}
          >
            <Text style={[styles.quickFinanceTitle, { color: '#157347' }]}>+ Доход офиса</Text>
            <Text style={[styles.quickFinanceSub, { color: '#157347' }]}>
              Быстро добавить доход по офису
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openQuickEntry('expense')}
            style={[styles.quickFinanceCard, { backgroundColor: '#FDECEC', borderColor: '#F6CACA' }]}
          >
            <Text style={[styles.quickFinanceTitle, { color: theme.red }]}>− Расход офиса</Text>
            <Text style={[styles.quickFinanceSub, { color: theme.red }]}>
              Быстро добавить расход по офису
            </Text>
          </Pressable>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingPayments.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут платежи</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{pendingDocs.length}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ждут документы</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(fullOfficeExpense)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Полный расход офисов</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(totalNetDeals)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Net по сделкам</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(todayIncome)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Доход по отчётам сегодня</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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

        <Text style={[styles.section, { color: theme.text }]}>Офисы и сотрудники</Text>
        <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {!cashflowEnabled && (
            <View style={[styles.noticeBox, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                Cashflow не найден или недоступен. Офисы всё равно показаны по сотрудникам, платежам и расходам.
              </Text>
            </View>
          )}

          {officeFinance.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Пока нет данных по офисам.
            </Text>
          ) : (
            officeFinance.map((row, index) => (
              <View
                key={`${row.key}-${index}`}
                style={[
                  styles.officeFinanceCard,
                  {
                    borderColor: theme.divider,
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                <View style={styles.officeFinanceHead}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.officeTitle, { color: theme.text }]}>{row.office}</Text>
                    {!!row.address && (
                      <Text style={[styles.officeMeta, { color: theme.textSecondary }]}>
                        {row.address}
                      </Text>
                    )}
                    {!!row.phone && (
                      <Text style={[styles.officeMeta, { color: theme.textSecondary }]}>
                        {row.phone}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.officeBalance,
                      { color: row.balance >= 0 ? POSITIVE : theme.red },
                    ]}
                  >
                    {money(row.balance)}
                  </Text>
                </View>

                <View style={styles.officeSummaryGrid}>
                  <View style={[styles.officeSummaryCard, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.officeSummaryValue, { color: theme.text }]}>
                      {money(row.total_income)}
                    </Text>
                    <Text style={[styles.officeSummaryLabel, { color: theme.textSecondary }]}>
                      Общий доход офиса
                    </Text>
                  </View>

                  <View style={[styles.officeSummaryCard, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.officeSummaryValue, { color: theme.red }]}>
                      {money(row.expenses)}
                    </Text>
                    <Text style={[styles.officeSummaryLabel, { color: theme.textSecondary }]}>
                      Общий расход офиса
                    </Text>
                  </View>

                  <View style={[styles.officeSummaryCard, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.officeSummaryValue, { color: theme.text }]}>
                      {money(row.deals_income)}
                    </Text>
                    <Text style={[styles.officeSummaryLabel, { color: theme.textSecondary }]}>
                      Доход по сделкам
                    </Text>
                  </View>

                  <View style={[styles.officeSummaryCard, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.officeSummaryValue, { color: POSITIVE }]}>
                      {money(row.extra_income)}
                    </Text>
                    <Text style={[styles.officeSummaryLabel, { color: theme.textSecondary }]}>
                      Прочий доход офиса
                    </Text>
                  </View>
                </View>

                <Text style={[styles.staffSectionTitle, { color: theme.text }]}>
                  Сотрудники офиса
                </Text>

                {row.employees.length === 0 ? (
                  <Text style={[styles.emptyStaffText, { color: theme.textSecondary }]}>
                    Сотрудники не найдены, но финансовые данные по офису есть.
                  </Text>
                ) : (
                  row.employees.map((emp, empIndex) => (
                    <View
                      key={`${row.key}-emp-${emp.id}-${empIndex}`}
                      style={[
                        styles.employeeCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                        },
                      ]}
                    >
                      <View style={styles.employeeHead}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={[styles.employeeName, { color: theme.text }]}>
                            {emp.full_name}
                          </Text>
                          <Text style={[styles.employeeEmail, { color: theme.textSecondary }]}>
                            {emp.email || 'Без email'}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.employeeBalance,
                            { color: emp.balance >= 0 ? POSITIVE : theme.red },
                          ]}
                        >
                          {money(emp.balance)}
                        </Text>
                      </View>

                      <View style={styles.employeeStatsRow}>
                        <View style={[styles.employeeStat, { backgroundColor: theme.backgroundSoft }]}>
                          <Text style={[styles.employeeStatValue, { color: theme.text }]}>
                            {money(emp.income)}
                          </Text>
                          <Text style={[styles.employeeStatLabel, { color: theme.textSecondary }]}>
                            Доход
                          </Text>
                        </View>

                        <View style={[styles.employeeStat, { backgroundColor: theme.backgroundSoft }]}>
                          <Text style={[styles.employeeStatValue, { color: theme.red }]}>
                            {money(emp.expense)}
                          </Text>
                          <Text style={[styles.employeeStatLabel, { color: theme.textSecondary }]}>
                            Расход
                          </Text>
                        </View>

                        <View style={[styles.employeeStat, { backgroundColor: theme.backgroundSoft }]}>
                          <Text style={[styles.employeeStatValue, { color: theme.blue }]}>
                            {money(emp.revenue_month)}
                          </Text>
                          <Text style={[styles.employeeStatLabel, { color: theme.textSecondary }]}>
                            Выручка мес.
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={quickEntryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickEntryOpen(false)}
      >
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {quickEntryType === 'income' ? 'Быстрый доход офиса' : 'Быстрый расход офиса'}
              </Text>

              <Pressable onPress={() => setQuickEntryOpen(false)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Офис</Text>
            <View style={styles.officeChipWrap}>
              {officeSelectorOptions.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Нет офисов с id для быстрого добавления операции.
                </Text>
              ) : (
                officeSelectorOptions.map((office) => {
                  const active = office.key === quickOfficeKey;
                  return (
                    <Pressable
                      key={office.key}
                      onPress={() => setQuickOfficeKey(office.key)}
                      style={[
                        styles.officeChip,
                        {
                          backgroundColor: active ? theme.blue : theme.backgroundSoft,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.officeChipText,
                          { color: active ? '#fff' : theme.text },
                        ]}
                      >
                        {office.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
            <TextInput
              value={quickTitle}
              onChangeText={setQuickTitle}
              placeholder="Например: доход офиса / аренда / расход"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Сумма</Text>
            <TextInput
              value={quickAmount}
              onChangeText={setQuickAmount}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
            <TextInput
              value={quickComment}
              onChangeText={setQuickComment}
              placeholder="Необязательно"
              multiline
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                styles.textarea,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setQuickEntryOpen(false)}
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable
                onPress={createQuickEntry}
                disabled={quickSaving || officeSelectorOptions.length === 0}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: quickEntryType === 'income' ? POSITIVE : theme.red,
                    opacity: quickSaving || officeSelectorOptions.length === 0 ? 0.7 : 1,
                  },
                ]}
              >
                {quickSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Сохранить</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

  quickFinanceRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  quickFinanceCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  quickFinanceTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  quickFinanceSub: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
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
    marginBottom: 12,
  },
  officeFinanceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  officeTitle: {
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
  },
  officeMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  officeBalance: {
    fontSize: 18,
    fontWeight: '900',
  },

  officeSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  officeSummaryCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
  },
  officeSummaryValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  officeSummaryLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  staffSectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyStaffText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  employeeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  employeeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '900',
  },
  employeeEmail: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  employeeBalance: {
    fontSize: 15,
    fontWeight: '900',
  },
  employeeStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  employeeStat: {
    flex: 1,
    minWidth: 90,
    borderRadius: 14,
    padding: 10,
  },
  employeeStatValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  employeeStatLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
  },

  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.35)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
    paddingRight: 12,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 17,
    fontWeight: '800',
  },

  inputLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  officeChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  officeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  officeChipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});