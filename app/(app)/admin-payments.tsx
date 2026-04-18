import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type TabKey = 'payments' | 'expenses' | 'income';

type CurrencyItem = {
  id: number;
  code?: string;
  symbol?: string;
  name?: string;
};

type OfficeItem = {
  id: number;
  city?: string;
  address?: string;
  phone?: string;
};

type PaymentItem = {
  id: number | string;
  deal?: number | string | null;
  amount?: number | string;
  amount_usd?: number | string;
  method?: string;
  is_confirmed?: boolean;
  payment_date?: string;
  manager?: number;
  manager_data?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    office?: {
      city?: string;
    } | null;
  } | null;
};

type ExpenseItem = {
  id: number | string;
  title?: string;
  amount?: number | string;
  amount_usd?: number | string;
  date?: string;
  manager?: number;
  manager_data?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    office?: {
      city?: string;
    } | null;
  } | null;
};

type CashflowItem = {
  id: number | string;
  office?: number;
  office_name?: string;
  created_by_name?: string | null;
  entry_type?: 'income' | 'expense' | string;
  title?: string;
  category?: string;
  category_label?: string;
  comment?: string;
  amount?: number | string;
  amount_usd?: number | string;
  entry_date?: string;
  is_confirmed?: boolean;
};

const GREEN = '#1AAE6F';

const FINANCE_CATEGORIES: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'custom', label: 'Другое', icon: 'apps-outline' },
  { key: 'visa', label: 'Виза', icon: 'document-text-outline' },
  { key: 'air_tickets', label: 'Авиабилеты', icon: 'airplane-outline' },
  { key: 'salary', label: 'Зарплата', icon: 'business-outline' },
  { key: 'office', label: 'Офис', icon: 'home-outline' },
  { key: 'utilities', label: 'Коммуналка', icon: 'flash-outline' },
  { key: 'marketing', label: 'Маркетинг', icon: 'megaphone-outline' },
];

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return `$${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return value;
  }
}

function managerName(item: any) {
  const full = item?.manager_data?.full_name;
  if (full) return full;

  const first = item?.manager_data?.first_name || '';
  const last = item?.manager_data?.last_name || '';
  const joined = `${first} ${last}`.trim();

  return joined || item?.created_by_name || 'Сотрудник';
}

function officeName(item: any) {
  return item?.office_name || item?.manager_data?.office?.city || 'Без офиса';
}

function methodLabel(method?: string) {
  const map: Record<string, string> = {
    cash: 'Наличные',
    card: 'Карта',
    bank: 'Перевод',
  };

  return map[method || ''] || method || '—';
}

function categoryLabel(category?: string) {
  return FINANCE_CATEGORIES.find((item) => item.key === category)?.label || category || 'Другое';
}

function extractError(error: any) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.amount?.[0] ||
    error?.response?.data?.title?.[0] ||
    error?.response?.data?.office?.[0] ||
    error?.response?.data?.currency?.[0] ||
    error?.response?.data?.entry_type?.[0] ||
    'Не удалось выполнить действие.'
  );
}

function KpiCard({
  title,
  value,
  hint,
  theme,
  accent = false,
}: {
  title: string;
  value: string;
  hint: string;
  theme: any;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.kpiCard,
        {
          backgroundColor: accent ? theme.blueSoft : theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.kpiHint, { color: theme.textMuted }]}>{hint}</Text>
    </View>
  );
}

export default function AdminPaymentsScreen() {
  const params = useLocalSearchParams<{
    open?: string;
    title?: string;
    officeId?: string;
  }>();

  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [tab, setTab] = useState<TabKey>('payments');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [legacyExpenses, setLegacyExpenses] = useState<ExpenseItem[]>([]);
  const [cashflow, setCashflow] = useState<CashflowItem[]>([]);

  const [currencies, setCurrencies] = useState<CurrencyItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [cashflowEnabled, setCashflowEnabled] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [fabOpen, setFabOpen] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'income' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('custom');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(null);

  const handledRouteActionRef = useRef<string>('');

  const userOfficeId = user?.office?.id || user?.access_profile?.managed_office?.id || null;

  const resetForm = useCallback(() => {
    setTitle('');
    setAmount('');
    setComment('');
    setSelectedCategory('custom');
    setModalType(null);
    setFabOpen(false);
  }, []);

  const openExpenseModal = useCallback(() => {
    setModalType('expense');
    setTab('expenses');
    setTitle('');
    setAmount('');
    setComment('');
    setSelectedCategory('custom');
    setFabOpen(false);
  }, []);

  const openIncomeModal = useCallback(() => {
    if (!cashflowEnabled) {
      Alert.alert(
        'Доходы пока не готовы',
        'На этом сервере пока не найден endpoint analytics/cashflow/.'
      );
      setFabOpen(false);
      return;
    }

    setModalType('income');
    setTab('income');
    setTitle('');
    setAmount('');
    setComment('');
    setSelectedCategory('custom');
    setFabOpen(false);
  }, [cashflowEnabled]);

  const load = useCallback(async () => {
    try {
      const [paymentsData, expensesData, currenciesData] = await Promise.all([
        fetchAllPages('analytics/payments/').catch(() => []),
        fetchAllPages('analytics/expenses/').catch(() => []),
        fetchAllPages('catalog/currencies/').catch(() => []),
      ]);

      setPayments((paymentsData || []) as PaymentItem[]);
      setLegacyExpenses((expensesData || []) as ExpenseItem[]);
      setCurrencies((currenciesData || []) as CurrencyItem[]);

      const usd =
        (currenciesData || []).find((c: any) => String(c?.code || '').toUpperCase() === 'USD') ||
        (currenciesData || [])[0] ||
        null;

      if (usd?.id && !selectedCurrencyId) {
        setSelectedCurrencyId(Number(usd.id));
      }

      try {
        const [cashflowData, officesData] = await Promise.all([
          fetchAllPages('analytics/cashflow/'),
          fetchAllPages('users/offices/').catch(() => []),
        ]);

        setCashflowEnabled(true);
        setCashflow((cashflowData || []) as CashflowItem[]);
        setOffices((officesData || []) as OfficeItem[]);
      } catch {
        setCashflowEnabled(false);
        setCashflow([]);
        setOffices([]);
      }

      if (!selectedOfficeId && userOfficeId) {
        setSelectedOfficeId(Number(userOfficeId));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCurrencyId, selectedOfficeId, userOfficeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const actionKey = `${params.open || ''}|${params.title || ''}|${params.officeId || ''}|${
      cashflowEnabled ? '1' : '0'
    }`;

    if (!params.open) return;
    if (handledRouteActionRef.current === actionKey) return;

    handledRouteActionRef.current = actionKey;

    if (params.officeId && Number(params.officeId) > 0) {
      setSelectedOfficeId(Number(params.officeId));
    }

    if (params.open === 'expense') {
      setTab('expenses');
      setModalType('expense');
      setFabOpen(false);
      setTitle('');
      setAmount('');
      setComment('');
      setSelectedCategory('custom');
      return;
    }

    if (params.open === 'income') {
      setTab('income');

      if (!cashflowEnabled) {
        Alert.alert(
          'Доходы пока не готовы',
          'На сервере ещё нет analytics/cashflow/ или он недоступен.'
        );
        return;
      }

      const paramTitle = String(params.title || '').trim();
      const salary = paramTitle.toLowerCase() === 'зарплата';

      setModalType('income');
      setFabOpen(false);
      setTitle(paramTitle || '');
      setAmount('');
      setComment(salary ? 'Пополнение баланса офиса' : '');
      setSelectedCategory(salary ? 'salary' : 'custom');
    }
  }, [params.open, params.title, params.officeId, cashflowEnabled]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const confirmPayment = async (item: PaymentItem) => {
    if (!isAdmin) {
      Alert.alert('Ошибка', 'Подтверждать платежи может только администратор.');
      return;
    }

    setWorkingId(String(item.id));
    try {
      const response = await apiClient.post(`analytics/payments/${item.id}/confirm/`, {});
      await load();
      Alert.alert('Готово', response?.data?.detail || `Платёж #${item.id} подтверждён.`);
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setWorkingId(null);
    }
  };

  const submitExpense = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажи название расхода.');
      return;
    }

    if (!amount.trim() || toNumber(amount) <= 0) {
      Alert.alert('Ошибка', 'Укажи корректную сумму расхода.');
      return;
    }

    if (!selectedCurrencyId) {
      Alert.alert('Ошибка', 'Выбери валюту.');
      return;
    }

    setSubmitting(true);

    try {
      if (cashflowEnabled) {
        const officeId = Number(selectedOfficeId || userOfficeId || 0);
        if (!officeId) {
          Alert.alert('Ошибка', 'Не удалось определить офис.');
          return;
        }

        await apiClient.post('analytics/cashflow/', {
          office: officeId,
          entry_type: 'expense',
          title: title.trim(),
          category: selectedCategory,
          comment: comment.trim(),
          amount: toNumber(amount),
          currency: selectedCurrencyId,
          entry_date: new Date().toISOString().slice(0, 10),
        });
      } else {
        await apiClient.post('analytics/expenses/', {
          title: title.trim(),
          amount: toNumber(amount),
          currency: selectedCurrencyId,
          date: new Date().toISOString().slice(0, 10),
        });
      }

      resetForm();
      await load();
      Alert.alert('Готово', 'Расход добавлен.');
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitIncome = async () => {
    if (!cashflowEnabled) {
      Alert.alert(
        'Доходы пока не готовы',
        'На сервере ещё нет analytics/cashflow/ или он недоступен.'
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert('Ошибка', 'Укажи название дохода.');
      return;
    }

    if (!amount.trim() || toNumber(amount) <= 0) {
      Alert.alert('Ошибка', 'Укажи корректную сумму дохода.');
      return;
    }

    if (!selectedCurrencyId) {
      Alert.alert('Ошибка', 'Выбери валюту.');
      return;
    }

    const officeId = Number(selectedOfficeId || userOfficeId || 0);
    if (!officeId) {
      Alert.alert('Ошибка', 'Не удалось определить офис.');
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('analytics/cashflow/', {
        office: officeId,
        entry_type: 'income',
        title: title.trim(),
        category: selectedCategory,
        comment: comment.trim(),
        amount: toNumber(amount),
        currency: selectedCurrencyId,
        entry_date: new Date().toISOString().slice(0, 10),
      });

      resetForm();
      await load();
      Alert.alert('Готово', 'Доход добавлен.');
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const cashflowExpenses = useMemo(() => {
    return cashflow.filter((item) => String(item.entry_type || '').toLowerCase() === 'expense');
  }, [cashflow]);

  const cashflowIncomes = useMemo(() => {
    return cashflow.filter((item) => String(item.entry_type || '').toLowerCase() === 'income');
  }, [cashflow]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (tab === 'payments') {
      return payments.filter((item) => {
        if (!q) return true;
        return (
          String(item.id).includes(q) ||
          String(item.deal || '').includes(q) ||
          methodLabel(item.method).toLowerCase().includes(q) ||
          managerName(item).toLowerCase().includes(q) ||
          officeName(item).toLowerCase().includes(q)
        );
      });
    }

    if (tab === 'expenses') {
      const combined: any[] = cashflowEnabled ? cashflowExpenses : legacyExpenses;

      return combined.filter((item) => {
        if (categoryFilter !== 'all' && cashflowEnabled && item.category !== categoryFilter) return false;

        if (!q) return true;

        return (
          String(item.id).includes(q) ||
          String(item.title || '').toLowerCase().includes(q) ||
          String(item.category_label || categoryLabel(item.category)).toLowerCase().includes(q) ||
          managerName(item).toLowerCase().includes(q) ||
          officeName(item).toLowerCase().includes(q)
        );
      });
    }

    return cashflowIncomes.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      if (!q) return true;

      return (
        String(item.id).includes(q) ||
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.category_label || categoryLabel(item.category)).toLowerCase().includes(q) ||
        String(item.office_name || '').toLowerCase().includes(q) ||
        String(item.created_by_name || '').toLowerCase().includes(q)
      );
    });
  }, [
    tab,
    payments,
    legacyExpenses,
    cashflowEnabled,
    cashflowExpenses,
    cashflowIncomes,
    search,
    categoryFilter,
  ]);

  const totals = useMemo(() => {
    if (tab === 'payments') {
      const pending = payments.filter((x) => !x.is_confirmed);
      const confirmed = payments.filter((x) => !!x.is_confirmed);

      return {
        primary: pending.length,
        secondary: confirmed.length,
        amount: pending.reduce((sum, x) => sum + toNumber(x.amount_usd ?? x.amount), 0),
        secondaryAmount: confirmed.reduce((sum, x) => sum + toNumber(x.amount_usd ?? x.amount), 0),
      };
    }

    if (tab === 'expenses') {
      const expenses = cashflowEnabled ? cashflowExpenses : legacyExpenses;

      return {
        primary: expenses.length,
        secondary: 0,
        amount: expenses.reduce((sum, x: any) => sum + toNumber(x.amount_usd ?? x.amount), 0),
        secondaryAmount: 0,
      };
    }

    return {
      primary: cashflowIncomes.length,
      secondary: 0,
      amount: cashflowIncomes.reduce((sum, x) => sum + toNumber(x.amount_usd ?? x.amount), 0),
      secondaryAmount: 0,
    };
  }, [tab, payments, legacyExpenses, cashflowEnabled, cashflowExpenses, cashflowIncomes]);

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
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Финансы</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                Платежи, расходы, доходы, виза и авиабилеты
              </Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <KpiCard
              title={tab === 'payments' ? 'Ждут' : tab === 'expenses' ? 'Расходов' : 'Доходов'}
              value={String(totals.primary)}
              hint={money(totals.amount)}
              theme={theme}
              accent
            />
            <KpiCard
              title={tab === 'payments' ? 'Подтверждено' : 'Режим'}
              value={tab === 'payments' ? String(totals.secondary) : tab === 'expenses' ? 'Expense' : 'Income'}
              hint={tab === 'payments' ? money(totals.secondaryAmount) : cashflowEnabled ? 'Cashflow online' : 'Legacy'}
              theme={theme}
            />
          </View>

          <View
            style={[
              styles.searchBox,
              {
                borderColor: theme.border,
                backgroundColor: theme.card,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск по операциям"
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {[
              { key: 'payments', label: 'Платежи' },
              { key: 'expenses', label: 'Расходы' },
              { key: 'income', label: 'Доходы' },
            ].map((item) => {
              const active = tab === item.key;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key as TabKey)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
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

          {(tab === 'expenses' || tab === 'income') && cashflowEnabled && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilterRow}>
              <Pressable
                onPress={() => setCategoryFilter('all')}
                style={[
                  styles.categoryFilterChip,
                  {
                    backgroundColor: categoryFilter === 'all' ? theme.blue : theme.surface,
                    borderColor: categoryFilter === 'all' ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text style={[styles.categoryFilterText, { color: categoryFilter === 'all' ? '#fff' : theme.text }]}>
                  Все
                </Text>
              </Pressable>

              {FINANCE_CATEGORIES.map((cat) => {
                const active = categoryFilter === cat.key;

                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCategoryFilter(cat.key)}
                    style={[
                      styles.categoryFilterChip,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Ionicons name={cat.icon} size={14} color={active ? '#fff' : theme.text} />
                    <Text style={[styles.categoryFilterText, { color: active ? '#fff' : theme.text }]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {tab === 'income' && !cashflowEnabled && (
            <View
              style={[
                styles.warningCard,
                {
                  backgroundColor: '#FFF6EA',
                  borderColor: '#F2D4A4',
                },
              ]}
            >
              <Text style={[styles.warningTitle, { color: '#8E5A00' }]}>
                Доходы ещё не подключены на backend
              </Text>
              <Text style={[styles.warningText, { color: '#8E5A00' }]}>
                Свободные доходы вне сделки будут работать сразу, как только на сервере появится `analytics/cashflow/`.
              </Text>
            </View>
          )}

          {visibleItems.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="wallet-outline" size={24} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Записей пока нет</Text>
            </View>
          ) : (
            visibleItems.map((item: any) => {
              const busy = workingId === String(item.id);

              if (tab === 'payments') {
                return (
                  <View
                    key={`payment-${item.id}`}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Платёж #{item.id}</Text>
                        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                          Сделка #{item.deal || '-'} · {methodLabel(item.method)}
                        </Text>
                      </View>

                      <Text style={[styles.amount, { color: theme.text }]}>
                        {money(toNumber(item.amount_usd ?? item.amount))}
                      </Text>
                    </View>

                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      {managerName(item)} · {officeName(item)}
                    </Text>

                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Дата: {formatDate(item.payment_date)}
                    </Text>

                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: item.is_confirmed ? '#E7F8EC' : '#FFF4E5',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: item.is_confirmed ? '#157347' : '#B26A00',
                          },
                        ]}
                      >
                        {item.is_confirmed ? 'CONFIRMED' : 'PENDING'}
                      </Text>
                    </View>

                    {!item.is_confirmed && isAdmin && (
                      <View style={styles.actionsRow}>
                        <Pressable
                          onPress={() => confirmPayment(item)}
                          style={[styles.actionBtn, { backgroundColor: GREEN }]}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.actionBtnText}>Подтвердить</Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              }

              if (tab === 'expenses') {
                const isCashflow = cashflowEnabled;
                const date = isCashflow ? item.entry_date : item.date;

                return (
                  <View
                    key={`expense-${item.id}`}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                          {item.title || `Расход #${item.id}`}
                        </Text>
                        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                          {managerName(item)} · {officeName(item)}
                        </Text>
                      </View>

                      <Text style={[styles.amount, { color: theme.red }]}>
                        - {money(toNumber(item.amount_usd ?? item.amount))}
                      </Text>
                    </View>

                    {isCashflow && (
                      <View style={[styles.categoryPill, { backgroundColor: theme.redSoft }]}>
                        <Text style={[styles.categoryPillText, { color: theme.red }]}>
                          {item.category_label || categoryLabel(item.category)}
                        </Text>
                      </View>
                    )}

                    {!!item.comment && (
                      <Text style={[styles.line, { color: theme.textSecondary }]}>
                        Комментарий: {item.comment}
                      </Text>
                    )}

                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Дата: {formatDate(date)}
                    </Text>
                  </View>
                );
              }

              return (
                <View
                  key={`income-${item.id}`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      shadowColor: theme.shadow,
                    },
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {item.title || `Доход #${item.id}`}
                      </Text>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        {item.created_by_name || 'Сотрудник'} · {item.office_name || 'Офис'}
                      </Text>
                    </View>

                    <Text style={[styles.amount, { color: GREEN }]}>
                      + {money(toNumber(item.amount_usd ?? item.amount))}
                    </Text>
                  </View>

                  <View style={[styles.categoryPill, { backgroundColor: '#E7F8EC' }]}>
                    <Text style={[styles.categoryPillText, { color: '#157347' }]}>
                      {item.category_label || categoryLabel(item.category)}
                    </Text>
                  </View>

                  {!!item.comment && (
                    <Text style={[styles.line, { color: theme.textSecondary }]}>
                      Комментарий: {item.comment}
                    </Text>
                  )}

                  <Text style={[styles.line, { color: theme.textSecondary }]}>
                    Дата: {formatDate(item.entry_date)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.fabWrap} pointerEvents="box-none">
          {fabOpen && (
            <View
              style={[
                styles.fabMenu,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Pressable onPress={openExpenseModal} style={styles.fabMenuItem}>
                <Ionicons name="remove-circle-outline" size={18} color={theme.red} />
                <Text style={[styles.fabMenuText, { color: theme.text }]}>Добавить расход</Text>
              </Pressable>

              <Pressable onPress={openIncomeModal} style={styles.fabMenuItem}>
                <Ionicons name="add-circle-outline" size={18} color={GREEN} />
                <Text style={[styles.fabMenuText, { color: theme.text }]}>Добавить доход</Text>
              </Pressable>

              {isAdmin && cashflowEnabled && (
                <Pressable
                  onPress={() => {
                    setModalType('income');
                    setTab('income');
                    setTitle('Зарплата');
                    setAmount('');
                    setComment('Пополнение баланса офиса');
                    setSelectedCategory('salary');
                    setFabOpen(false);
                  }}
                  style={styles.fabMenuItem}
                >
                  <Ionicons name="business-outline" size={18} color={theme.blue} />
                  <Text style={[styles.fabMenuText, { color: theme.text }]}>
                    Пополнить баланс офиса
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable
            onPress={() => setFabOpen((v) => !v)}
            style={[styles.fab, { backgroundColor: theme.blue }]}
          >
            <Ionicons name={fabOpen ? 'close' : 'add'} size={28} color="#fff" />
          </Pressable>
        </View>

        <Modal visible={!!modalType} transparent animationType="fade" onRequestClose={resetForm}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {modalType === 'expense' ? 'Новый расход' : 'Новый доход'}
              </Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  modalType === 'expense'
                    ? 'Например: виза, билет, офис'
                    : 'Например: виза, авиабилеты'
                }
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.modalInput,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.surface,
                  },
                ]}
              />

              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Сумма"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                style={[
                  styles.modalInput,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.surface,
                  },
                ]}
              />

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Категория</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
                {FINANCE_CATEGORIES.map((category) => {
                  const active = selectedCategory === category.key;

                  return (
                    <Pressable
                      key={category.key}
                      onPress={() => setSelectedCategory(category.key)}
                      style={[
                        styles.selectorChip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={category.icon}
                        size={15}
                        color={active ? '#fff' : theme.text}
                      />
                      <Text style={[styles.selectorChipText, { color: active ? '#fff' : theme.text }]}>
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Комментарий"
                placeholderTextColor={theme.textMuted}
                multiline
                style={[
                  styles.modalInput,
                  styles.modalInputArea,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.surface,
                  },
                ]}
              />

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Валюта</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
                {currencies.map((currency) => {
                  const active = selectedCurrencyId === currency.id;

                  return (
                    <Pressable
                      key={currency.id}
                      onPress={() => setSelectedCurrencyId(currency.id)}
                      style={[
                        styles.selectorChip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.selectorChipText, { color: active ? '#fff' : theme.text }]}>
                        {currency.code || currency.symbol || currency.name || `#${currency.id}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {cashflowEnabled && (
                <>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Офис</Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
                    {(offices.length
                      ? offices
                      : userOfficeId
                      ? [
                          {
                            id: Number(userOfficeId),
                            city: user?.office?.city || user?.access_profile?.managed_office?.city,
                          },
                        ]
                      : []
                    ).map((office) => {
                      const active = selectedOfficeId === office.id;

                      return (
                        <Pressable
                          key={office.id}
                          onPress={() => setSelectedOfficeId(office.id)}
                          style={[
                            styles.selectorChip,
                            {
                              backgroundColor: active ? theme.blue : theme.surface,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.selectorChipText, { color: active ? '#fff' : theme.text }]}>
                            {office.city || `Офис #${office.id}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  onPress={resetForm}
                  style={[
                    styles.modalGhostBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <Text style={[styles.modalGhostText, { color: theme.text }]}>Отмена</Text>
                </Pressable>

                <Pressable
                  onPress={modalType === 'expense' ? submitExpense : submitIncome}
                  style={[
                    styles.modalPrimaryBtn,
                    {
                      backgroundColor: theme.blue,
                      opacity: submitting ? 0.7 : 1,
                    },
                  ]}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Сохранить</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    padding: 20,
    paddingBottom: 140,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  kpiLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    fontWeight: '800',
    fontSize: 13,
  },
  categoryFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingRight: 16,
  },
  categoryFilterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '900',
  },
  warningCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  warningTitle: {
    fontWeight: '900',
    fontSize: 14,
  },
  warningText: {
    marginTop: 6,
    lineHeight: 19,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  line: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  categoryPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    alignItems: 'flex-end',
  },
  fabMenu: {
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    minWidth: 220,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  fabMenuText: {
    fontSize: 14,
    fontWeight: '800',
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,20,30,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInputArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    marginBottom: 12,
  },
  selectorChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalGhostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  modalGhostText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalPrimaryBtn: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});