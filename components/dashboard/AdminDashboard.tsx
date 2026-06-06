import { Ionicons } from '@expo/vector-icons';
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

type AdminAction = {
  title: string;
  route: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
};

type KpiCardItem = {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
};

const PREMIUM_TEXT = '#231F3A';
const PREMIUM_MUTED = '#766F91';
const GREEN = '#1AAE6F';
const ORANGE = '#F59E0B';
const PURPLE = '#7B61FF';
const RED = '#EF4444';
const BLUE = '#3A7AFE';

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function compactMoney(v: number) {
  const value = Number(v || 0);

  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }

  return money(value);
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

function employeeInitials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function officeGradient(index: number): [string, string] {
  const gradients: [string, string][] = [
    ['#F4F7FF', '#FFF3F7'],
    ['#F5F0FF', '#EEF8FF'],
    ['#F1FFF7', '#F5F2FF'],
    ['#FFF7EC', '#F3F1FF'],
    ['#EEF6FF', '#FFF4FB'],
    ['#F7F1FF', '#F2FBF7'],
  ];

  return gradients[index % gradients.length];
}

function balanceColor(value: number, fallbackPositive = GREEN, fallbackNegative = RED) {
  return value >= 0 ? fallbackPositive : fallbackNegative;
}

function MiniIcon({
  icon,
  tint,
  bg,
  size = 38,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconBubble,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 2.7),
          backgroundColor: bg,
        },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tint} />
    </View>
  );
}

function EmployeeAvatar({ name }: { name: string }) {
  return (
    <LinearGradient
      colors={['rgba(123,97,255,0.22)', 'rgba(58,122,254,0.12)']}
      style={styles.employeeAvatar}
    >
      <Text style={styles.employeeAvatarText}>{employeeInitials(name)}</Text>
    </LinearGradient>
  );
}

export default function AdminDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const POSITIVE = theme.success || GREEN;
  const NEGATIVE = theme.red || RED;

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

  const [expandedOffices, setExpandedOffices] = useState<Record<string, boolean>>({});

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
        if (info?.office && (!current.office || current.office === 'Без офиса')) {
          current.office = info.office;
        }
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
            `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim() ||
            userItem.email ||
            `ID ${userItem.id}`,
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
      const key = (c.office ? `office:${c.office}` : null) || officeKeyFromName(c.office_name) || null;

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
      const officeKey = (c.office ? `office:${c.office}` : null) || officeKeyFromName(c.office_name) || null;

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
      .sort((a, b) => b.balance - a.balance);
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
    () => reports.filter((r) => String(r.date || r.created_at || '').slice(0, 10) === today),
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const topEmployees = useMemo(() => {
    return officeFinance
      .flatMap((office) =>
        office.employees.map((emp) => ({
          ...emp,
          office: office.office,
        }))
      )
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3);
  }, [officeFinance]);

  const adminActions: AdminAction[] = [
    {
      title: 'Сотрудники',
      route: '/(app)/admin-staff',
      subtitle: 'Доступы, офисы, планы',
      icon: 'people-outline',
      tint: PURPLE,
      bg: 'rgba(123,97,255,0.13)',
    },
    {
      title: 'Финансы',
      route: '/(app)/admin-payments',
      subtitle: 'Платежи, доходы, расходы',
      icon: 'wallet-outline',
      tint: GREEN,
      bg: 'rgba(26,174,111,0.13)',
    },
    {
      title: 'Отчёты',
      route: '/(app)/admin-reports',
      subtitle: 'Daily reports и AI',
      icon: 'analytics-outline',
      tint: ORANGE,
      bg: 'rgba(245,158,11,0.14)',
    },
    {
      title: 'CRM',
      route: '/(app)/crm',
      subtitle: 'Клиенты, сделки, договоры',
      icon: 'briefcase-outline',
      tint: BLUE,
      bg: 'rgba(58,122,254,0.13)',
    },
  ];

  const kpiCards: KpiCardItem[] = [
    {
      title: 'Платежи',
      value: String(pendingPayments.length),
      subtitle: 'ждут подтверждения',
      icon: 'card-outline',
      tint: ORANGE,
      bg: 'rgba(245,158,11,0.14)',
    },
    {
      title: 'Документы',
      value: String(pendingDocs.length),
      subtitle: 'ждут проверки',
      icon: 'document-text-outline',
      tint: PURPLE,
      bg: 'rgba(123,97,255,0.13)',
    },
    {
      title: 'Расходы',
      value: compactMoney(fullOfficeExpense),
      subtitle: 'все офисы',
      icon: 'trending-down-outline',
      tint: NEGATIVE,
      bg: 'rgba(239,68,68,0.11)',
    },
    {
      title: 'Сделки',
      value: compactMoney(totalNetDeals),
      subtitle: 'чистый доход',
      icon: 'ribbon-outline',
      tint: GREEN,
      bg: 'rgba(26,174,111,0.13)',
    },
    {
      title: 'Сегодня',
      value: compactMoney(todayIncome),
      subtitle: 'доход по отчётам',
      icon: 'sunny-outline',
      tint: BLUE,
      bg: 'rgba(58,122,254,0.13)',
    },
    {
      title: 'Сегодня',
      value: compactMoney(todayExpense),
      subtitle: 'расход по отчётам',
      icon: 'moon-outline',
      tint: NEGATIVE,
      bg: 'rgba(239,68,68,0.11)',
    },
  ];

  const toggleOffice = (key: string) => {
    setExpandedOffices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllOffices = () => {
    const next: Record<string, boolean> = {};
    officeFinance.forEach((office) => {
      next[office.key] = true;
    });
    setExpandedOffices(next);
  };

  const collapseAllOffices = () => {
    setExpandedOffices({});
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
          colors={[theme.blue, '#6D5DFB', '#8F66FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <View style={styles.heroCaptionRow}>
                <Ionicons name="shield-checkmark-outline" size={15} color="rgba(255,255,255,0.86)" />
                <Text style={styles.caption}>Панель администратора</Text>
              </View>

              <Text style={styles.title}>
                {user.first_name} {user.last_name}
              </Text>

              <Text style={styles.heroSub}>Контроль офисов, финансов и команды в одном месте</Text>
            </View>

            <Pressable
              onPress={() => {
                setRefreshing(true);
                void load();
                onRefresh();
              }}
              style={styles.refreshHeroBtn}
            >
              <Ionicons name="refresh-outline" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <View style={styles.heroStatTop}>
                <Ionicons name="cash-outline" size={18} color="rgba(255,255,255,0.86)" />
                <Text style={styles.heroLabel}>Доход</Text>
              </View>
              <Text style={styles.heroValue}>{money(fullOfficeIncome)}</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStat}>
              <View style={styles.heroStatTop}>
                <Ionicons name="pulse-outline" size={18} color="rgba(255,255,255,0.86)" />
                <Text style={styles.heroLabel}>Баланс</Text>
              </View>
              <Text style={styles.heroValue}>{money(fullOfficeBalance)}</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroChip}>
              <Ionicons name="business-outline" size={14} color="#fff" />
              <Text style={styles.heroChipText}>{officeFinance.length} офисов</Text>
            </View>

            <View style={styles.heroChip}>
              <Ionicons name="people-outline" size={14} color="#fff" />
              <Text style={styles.heroChipText}>{users.length} сотрудников</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.section, { color: theme.text }]}>Быстрые операции</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Добавить доход или расход без лишних переходов
            </Text>
          </View>
        </View>

        <View style={styles.quickFinanceRow}>
          <Pressable onPress={() => openQuickEntry('income')} style={styles.quickFinancePress}>
            <LinearGradient
              colors={['#EAFBF3', '#F4FFF9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.quickFinanceCard, { borderColor: '#CBEEDC' }]}
            >
              <MiniIcon icon="add-circle-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" />

              <View style={{ flex: 1 }}>
                <Text style={[styles.quickFinanceTitle, { color: '#157347' }]}>Доход офиса</Text>
                <Text style={[styles.quickFinanceSub, { color: '#157347' }]}>
                  Виза, авиабилеты, услуги
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#157347" />
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => openQuickEntry('expense')} style={styles.quickFinancePress}>
            <LinearGradient
              colors={['#FFF0F0', '#FFF8F8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.quickFinanceCard, { borderColor: '#F7D0D0' }]}
            >
              <MiniIcon icon="remove-circle-outline" tint={NEGATIVE} bg="rgba(239,68,68,0.12)" />

              <View style={{ flex: 1 }}>
                <Text style={[styles.quickFinanceTitle, { color: NEGATIVE }]}>Расход офиса</Text>
                <Text style={[styles.quickFinanceSub, { color: NEGATIVE }]}>
                  Аренда, зарплата, реклама
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={NEGATIVE} />
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.kpiGrid}>
          {kpiCards.map((card, index) => (
            <View
              key={`${card.title}-${index}`}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <View style={styles.kpiTop}>
                <MiniIcon icon={card.icon} tint={card.tint} bg={card.bg} size={34} />
                <Text style={[styles.kpiTitle, { color: theme.textSecondary }]}>{card.title}</Text>
              </View>

              <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>
                {card.value}
              </Text>

              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{card.subtitle}</Text>
            </View>
          ))}
        </View>

        {/* {topEmployees.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.section, { color: theme.text }]}>Лучшие сотрудники</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  По балансу доходов и расходов
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/(app)/leaderboard' as any)}
                style={[styles.lightButton, { backgroundColor: theme.backgroundSoft }]}
              >
                <Ionicons name="trophy-outline" size={16} color={theme.blue} />
                <Text style={[styles.lightButtonText, { color: theme.blue }]}>Рейтинг</Text>
              </Pressable>
            </View>

            <View style={styles.topStaffWrap}>
              {topEmployees.map((emp, index) => (
                <LinearGradient
                  key={`top-employee-${emp.id}-${index}`}
                  colors={index === 0 ? ['#FFF7E8', '#FFF2F8'] : ['#F7F3FF', '#F2F8FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.topStaffCard}
                >
                  <View style={styles.topStaffRank}>
                    <Text style={styles.topStaffRankText}>#{index + 1}</Text>
                  </View>

                  <EmployeeAvatar name={emp.full_name} />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.topStaffName} numberOfLines={1}>
                      {emp.full_name}
                    </Text>
                    <Text style={styles.topStaffOffice} numberOfLines={1}>
                      {emp.office}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.topStaffBalance,
                      { color: balanceColor(emp.balance, GREEN, NEGATIVE) },
                    ]}
                  >
                    {compactMoney(emp.balance)}
                  </Text>
                </LinearGradient>
              ))}
            </View>
          </>
        )} */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.section, { color: theme.text }]}>Быстрые действия</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Основные разделы администратора
            </Text>
          </View>
        </View>

        <View style={styles.actionsGrid}>
          {adminActions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.route as any)}
              style={[
                styles.actionCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <View style={styles.actionTop}>
                <MiniIcon icon={action.icon} tint={action.tint} bg={action.bg} />
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>

              <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
              <Text style={[styles.actionSub, { color: theme.textSecondary }]}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.section, { color: theme.text }]}>Офисы</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Нажми на офис, чтобы раскрыть подробности
            </Text>
          </View>

          <View style={styles.officeHeaderActions}>
            <Pressable
              onPress={expandAllOffices}
              style={[styles.officeHeaderBtn, { backgroundColor: theme.backgroundSoft }]}
            >
              <Ionicons name="chevron-down-circle-outline" size={16} color={theme.blue} />
            </Pressable>

            <Pressable
              onPress={collapseAllOffices}
              style={[styles.officeHeaderBtn, { backgroundColor: theme.backgroundSoft }]}
            >
              <Ionicons name="chevron-up-circle-outline" size={16} color={theme.blue} />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {!cashflowEnabled && (
            <View style={[styles.noticeBox, { backgroundColor: theme.backgroundSoft }]}>
              <MiniIcon icon="information-circle-outline" tint={ORANGE} bg="rgba(245,158,11,0.13)" size={34} />
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                Cashflow не найден или недоступен. Офисы всё равно показаны по сотрудникам, платежам и расходам.
              </Text>
            </View>
          )}

          {officeFinance.length === 0 ? (
            <View style={styles.emptyOfficeBox}>
              <MiniIcon icon="business-outline" tint={theme.blue} bg={theme.blueSoft || 'rgba(58,122,254,0.12)'} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Пока нет данных по офисам.
              </Text>
            </View>
          ) : (
            officeFinance.map((row, index) => {
              const expanded = !!expandedOffices[row.key];
              const gradient = officeGradient(index);
              const officeBalanceTint = balanceColor(row.balance, POSITIVE, NEGATIVE);
              const bestEmployees = row.employees.slice(0, 3);

              return (
                <LinearGradient
                  key={`${row.key}-${index}`}
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.officeFinanceCard}
                >
                  <Pressable onPress={() => toggleOffice(row.key)} style={styles.officePressHeader}>
                    <View style={styles.officeTitleBlock}>
                      <MiniIcon
                        icon="business-outline"
                        tint={PURPLE}
                        bg="rgba(123,97,255,0.13)"
                        size={42}
                      />

                      <View style={{ flex: 1 }}>
                        <View style={styles.officeNameRow}>
                          <Text style={styles.officeTitle} numberOfLines={1}>
                            {row.office}
                          </Text>

                          <View style={styles.employeeCountPill}>
                            <Ionicons name="people-outline" size={12} color={PURPLE} />
                            <Text style={styles.employeeCountText}>{row.employees.length}</Text>
                          </View>
                        </View>

                        <Text style={styles.officeMeta} numberOfLines={1}>
                          {row.address || row.phone || 'Адрес не указан'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.officeRightBlock}>
                      <Text style={[styles.officeBalance, { color: officeBalanceTint }]}>
                        {compactMoney(row.balance)}
                      </Text>

                      <View style={styles.expandBadge}>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={PREMIUM_MUTED}
                        />
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.compactOfficeStats}>
                    <View style={styles.compactStat}>
                      <Ionicons name="arrow-up-circle-outline" size={16} color={GREEN} />
                      <Text style={styles.compactStatLabel}>Доход</Text>
                      <Text style={styles.compactStatValue}>{compactMoney(row.total_income)}</Text>
                    </View>

                    <View style={styles.compactStat}>
                      <Ionicons name="arrow-down-circle-outline" size={16} color={NEGATIVE} />
                      <Text style={styles.compactStatLabel}>Расход</Text>
                      <Text style={[styles.compactStatValue, { color: NEGATIVE }]}>
                        {compactMoney(row.expenses)}
                      </Text>
                    </View>

                    <View style={styles.compactStat}>
                      <Ionicons name="ribbon-outline" size={16} color={BLUE} />
                      <Text style={styles.compactStatLabel}>Сделки</Text>
                      <Text style={styles.compactStatValue}>{compactMoney(row.deals_income)}</Text>
                    </View>
                  </View>

                  {expanded && (
                    <View style={styles.officeExpanded}>
                      <View style={styles.officeInfoStrip}>
                        <View style={styles.officeInfoItem}>
                          <Ionicons name="location-outline" size={16} color={PREMIUM_MUTED} />
                          <Text style={styles.officeInfoText} numberOfLines={2}>
                            {row.address || 'Адрес не указан'}
                          </Text>
                        </View>

                        <View style={styles.officeInfoItem}>
                          <Ionicons name="call-outline" size={16} color={PREMIUM_MUTED} />
                          <Text style={styles.officeInfoText}>{row.phone || 'Телефон не указан'}</Text>
                        </View>
                      </View>

                      <View style={styles.officeSummaryGrid}>
                        <View style={styles.officeSummaryCard}>
                          <MiniIcon icon="cash-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" size={34} />
                          <Text style={styles.officeSummaryValue}>{money(row.total_income)}</Text>
                          <Text style={styles.officeSummaryLabel}>Общий доход</Text>
                        </View>

                        <View style={styles.officeSummaryCard}>
                          <MiniIcon icon="cart-outline" tint={NEGATIVE} bg="rgba(239,68,68,0.11)" size={34} />
                          <Text style={[styles.officeSummaryValue, { color: NEGATIVE }]}>
                            {money(row.expenses)}
                          </Text>
                          <Text style={styles.officeSummaryLabel}>Общий расход</Text>
                        </View>

                        <View style={styles.officeSummaryCard}>
                          <MiniIcon icon="briefcase-outline" tint={BLUE} bg="rgba(58,122,254,0.13)" size={34} />
                          <Text style={styles.officeSummaryValue}>{money(row.deals_income)}</Text>
                          <Text style={styles.officeSummaryLabel}>Доход по сделкам</Text>
                        </View>

                        <View style={styles.officeSummaryCard}>
                          <MiniIcon icon="sparkles-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" size={34} />
                          <Text style={[styles.officeSummaryValue, { color: PURPLE }]}>
                            {money(row.extra_income)}
                          </Text>
                          <Text style={styles.officeSummaryLabel}>Прочий доход</Text>
                        </View>
                      </View>

                      {bestEmployees.length > 0 && (
                        <View style={styles.officeTopBlock}>
                          <View style={styles.blockTitleRow}>
                            <Text style={styles.staffSectionTitle}>Топ сотрудников офиса</Text>
                            <Ionicons name="trophy-outline" size={17} color={ORANGE} />
                          </View>

                          {bestEmployees.map((emp, empIndex) => (
                            <View
                              key={`${row.key}-best-${emp.id}-${empIndex}`}
                              style={styles.officeBestEmployee}
                            >
                              <View style={styles.bestRank}>
                                <Text style={styles.bestRankText}>#{empIndex + 1}</Text>
                              </View>

                              <EmployeeAvatar name={emp.full_name} />

                              <View style={{ flex: 1 }}>
                                <Text style={styles.employeeName} numberOfLines={1}>
                                  {emp.full_name}
                                </Text>
                                <Text style={styles.employeeEmail} numberOfLines={1}>
                                  {emp.email || 'Без email'}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.employeeBalance,
                                  { color: balanceColor(emp.balance, POSITIVE, NEGATIVE) },
                                ]}
                              >
                                {compactMoney(emp.balance)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.blockTitleRow}>
                        <Text style={styles.staffSectionTitle}>Все сотрудники</Text>
                        <Text style={styles.staffCountText}>{row.employees.length}</Text>
                      </View>

                      {row.employees.length === 0 ? (
                        <Text style={styles.emptyStaffText}>
                          Сотрудники не найдены, но финансовые данные по офису есть.
                        </Text>
                      ) : (
                        row.employees.map((emp, empIndex) => (
                          <View
                            key={`${row.key}-emp-${emp.id}-${empIndex}`}
                            style={styles.employeeCard}
                          >
                            <View style={styles.employeeHead}>
                              <EmployeeAvatar name={emp.full_name} />

                              <View style={{ flex: 1 }}>
                                <Text style={styles.employeeName} numberOfLines={1}>
                                  {emp.full_name}
                                </Text>
                                <Text style={styles.employeeEmail} numberOfLines={1}>
                                  {emp.email || 'Без email'}
                                </Text>
                              </View>

                              <View style={styles.employeeBalanceBox}>
                                <Text
                                  style={[
                                    styles.employeeBalance,
                                    { color: balanceColor(emp.balance, POSITIVE, NEGATIVE) },
                                  ]}
                                >
                                  {compactMoney(emp.balance)}
                                </Text>
                                <Text style={styles.employeeBalanceLabel}>баланс</Text>
                              </View>
                            </View>

                            <View style={styles.employeeStatsRow}>
                              <View style={styles.employeeStat}>
                                <Ionicons name="arrow-up-outline" size={14} color={GREEN} />
                                <Text style={styles.employeeStatValue}>{compactMoney(emp.income)}</Text>
                                <Text style={styles.employeeStatLabel}>Доход</Text>
                              </View>

                              <View style={styles.employeeStat}>
                                <Ionicons name="arrow-down-outline" size={14} color={NEGATIVE} />
                                <Text style={[styles.employeeStatValue, { color: NEGATIVE }]}>
                                  {compactMoney(emp.expense)}
                                </Text>
                                <Text style={styles.employeeStatLabel}>Расход</Text>
                              </View>

                              <View style={styles.employeeStat}>
                                <Ionicons name="stats-chart-outline" size={14} color={BLUE} />
                                <Text style={[styles.employeeStatValue, { color: BLUE }]}>
                                  {compactMoney(emp.revenue_month)}
                                </Text>
                                <Text style={styles.employeeStatLabel}>Месяц</Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </LinearGradient>
              );
            })
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
              <View style={styles.modalTitleRow}>
                <MiniIcon
                  icon={quickEntryType === 'income' ? 'add-circle-outline' : 'remove-circle-outline'}
                  tint={quickEntryType === 'income' ? GREEN : NEGATIVE}
                  bg={quickEntryType === 'income' ? 'rgba(26,174,111,0.13)' : 'rgba(239,68,68,0.11)'}
                  size={38}
                />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {quickEntryType === 'income' ? 'Быстрый доход офиса' : 'Быстрый расход офиса'}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Выбери офис и сумму операции
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => setQuickEntryOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
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
                          {
                            color: active ? '#fff' : theme.text,
                          },
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
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
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
                    backgroundColor: quickEntryType === 'income' ? POSITIVE : NEGATIVE,
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 18,
    paddingBottom: 124,
  },

  hero: {
    borderRadius: 30,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#3A2F8F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },

  heroGlowOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -50,
    top: -42,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -38,
    bottom: -38,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  heroCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  caption: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  title: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '900',
    marginTop: 7,
  },

  heroSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },

  refreshHeroBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  heroStats: {
    marginTop: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroStat: {
    flex: 1,
  },

  heroStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  heroDivider: {
    width: 1,
    height: 48,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  heroValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 7,
  },

  heroLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
  },

  heroFooter: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  heroChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionHeader: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },

  section: {
    fontSize: 19,
    fontWeight: '900',
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  iconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickFinanceRow: {
    flexDirection: 'row',
    gap: 12,
  },

  quickFinancePress: {
    flex: 1,
  },

  quickFinanceCard: {
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    justifyContent: 'space-between',
  },

  quickFinanceTitle: {
    marginTop: 11,
    fontSize: 15,
    fontWeight: '900',
  },

  quickFinanceSub: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },

  kpiCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  kpiTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  kpiValue: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
  },

  kpiLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  lightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },

  lightButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },

  topStaffWrap: {
    gap: 10,
  },

  topStaffCard: {
    borderRadius: 22,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  topStaffRank: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
  },

  topStaffRankText: {
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  topStaffName: {
    color: PREMIUM_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },

  topStaffOffice: {
    marginTop: 3,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  topStaffBalance: {
    fontSize: 14,
    fontWeight: '900',
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  actionCard: {
    width: '48%',
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 24,
    padding: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  actionTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '900',
  },

  actionSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },

  officeHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },

  officeHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  panel: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 12,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },

  noticeBox: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },

  emptyOfficeBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },

  officeFinanceCard: {
    borderRadius: 26,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  officePressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  officeTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  officeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  officeTitle: {
    flex: 1,
    color: PREMIUM_TEXT,
    fontSize: 18,
    fontWeight: '900',
  },

  officeMeta: {
    marginTop: 4,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  employeeCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  employeeCountText: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '900',
  },

  officeRightBlock: {
    alignItems: 'flex-end',
    gap: 7,
  },

  officeBalance: {
    fontSize: 18,
    fontWeight: '900',
  },

  expandBadge: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  compactOfficeStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  compactStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  compactStatLabel: {
    marginTop: 5,
    color: PREMIUM_MUTED,
    fontSize: 10.5,
    fontWeight: '800',
  },

  compactStatValue: {
    marginTop: 3,
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  officeExpanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47,42,69,0.08)',
  },

  officeInfoStrip: {
    gap: 8,
  },

  officeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  officeInfoText: {
    flex: 1,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  officeSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },

  officeSummaryCard: {
    width: '48%',
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  officeSummaryValue: {
    marginTop: 10,
    color: PREMIUM_TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  officeSummaryLabel: {
    marginTop: 5,
    color: PREMIUM_MUTED,
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 16,
  },

  officeTopBlock: {
    marginTop: 16,
  },

  blockTitleRow: {
    marginTop: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  staffSectionTitle: {
    color: PREMIUM_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  staffCountText: {
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '900',
  },

  officeBestEmployee: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  bestRank: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: 'rgba(245,158,11,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bestRankText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
  },

  emptyStaffText: {
    color: PREMIUM_MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },

  employeeCard: {
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    padding: 12,
    marginTop: 10,
  },

  employeeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  employeeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  employeeAvatarText: {
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  employeeName: {
    color: PREMIUM_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },

  employeeEmail: {
    marginTop: 3,
    color: PREMIUM_MUTED,
    fontSize: 11.5,
    fontWeight: '700',
  },

  employeeBalanceBox: {
    alignItems: 'flex-end',
  },

  employeeBalance: {
    fontSize: 14,
    fontWeight: '900',
  },

  employeeBalanceLabel: {
    marginTop: 2,
    color: PREMIUM_MUTED,
    fontSize: 10,
    fontWeight: '800',
  },

  employeeStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  employeeStat: {
    flex: 1,
    minWidth: 88,
    borderRadius: 16,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.05)',
  },

  employeeStatValue: {
    marginTop: 5,
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  employeeStatLabel: {
    marginTop: 4,
    color: PREMIUM_MUTED,
    fontSize: 10.5,
    fontWeight: '800',
  },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },

  modalCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },

  modalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },

  modalSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputLabel: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
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
    fontWeight: '900',
  },

  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '700',
  },

  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  secondaryBtn: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },

  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },

  primaryBtn: {
    flex: 1,
    borderRadius: 18,
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
