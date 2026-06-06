import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  name?: string;
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

const FINANCE_CATEGORIES: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
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

function officeLabel(office: OfficeItem) {
  return office.city || office.name || `Офис #${office.id}`;
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  theme,
  accent = 'blue',
}: {
  title: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
  accent?: 'blue' | 'green' | 'red';
}) {
  const color = accent === 'green' ? theme.success : accent === 'red' ? theme.red : theme.blue;
  const bg = accent === 'green' ? '#E7F8EC' : accent === 'red' ? theme.redSoft : theme.blueSoft;

  return (
    <View
      style={[
        styles.kpiCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
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

  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const dark = themeMode === 'dark';
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
      Alert.alert('Доходы пока не готовы', 'На этом сервере раздел аналитики пока недоступен.');
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
      openExpenseModal();
      return;
    }

    if (params.open === 'income') {
      setTab('income');

      if (!cashflowEnabled) {
        Alert.alert('Доходы пока не готовы', 'На сервере ещё нет analytics/cashflow/ или он недоступен.');
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
  }, [params.open, params.title, params.officeId, cashflowEnabled, openExpenseModal]);

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
      Alert.alert('Доходы пока не готовы', 'На сервере ещё нет analytics/cashflow/ или он недоступен.');
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
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: dark ? '#162235' : '#FFFFFF',
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.text }]}>Финансы</Text>
                <Text style={[styles.sub, { color: theme.textSecondary }]}>
                  Платежи, расходы, доходы, виза и авиабилеты
                </Text>
              </View>

              <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="wallet-outline" size={24} color={theme.blue} />
              </View>
            </View>

            <View style={styles.kpiRow}>
              <KpiCard
                title={tab === 'payments' ? 'Ждут' : tab === 'expenses' ? 'Расходов' : 'Доходов'}
                value={String(totals.primary)}
                hint={money(totals.amount)}
                icon={tab === 'expenses' ? 'trending-down-outline' : tab === 'income' ? 'trending-up-outline' : 'time-outline'}
                theme={theme}
                accent={tab === 'expenses' ? 'red' : tab === 'income' ? 'green' : 'blue'}
              />

              <KpiCard
                title={tab === 'payments' ? 'Подтверждено' : 'Режим'}
                value={tab === 'payments' ? String(totals.secondary) : tab === 'expenses' ? 'Expense' : 'Income'}
                hint={tab === 'payments' ? money(totals.secondaryAmount) : cashflowEnabled ? 'Cashflow online' : 'Legacy'}
                icon={tab === 'payments' ? 'checkmark-circle-outline' : 'server-outline'}
                theme={theme}
                accent={tab === 'payments' ? 'green' : 'blue'}
              />
            </View>
          </View>

          <View
            style={[
              styles.searchBox,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
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
              { key: 'payments', label: 'Платежи', icon: 'card-outline' },
              { key: 'expenses', label: 'Расходы', icon: 'remove-circle-outline' },
              { key: 'income', label: 'Доходы', icon: 'add-circle-outline' },
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
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={15}
                    color={active ? '#fff' : theme.text}
                  />
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
                  backgroundColor: dark ? '#332711' : '#FFF6EA',
                  borderColor: dark ? '#735315' : '#F2D4A4',
                },
              ]}
            >
              <Text style={[styles.warningTitle, { color: dark ? '#FFD37A' : '#8E5A00' }]}>
                Доходы ещё не подключены на backend
              </Text>
              <Text style={[styles.warningText, { color: dark ? '#FFE0A3' : '#8E5A00' }]}>
                Свободные доходы вне сделки будут работать сразу, как только на сервере появится analytics/cashflow/.
              </Text>
            </View>
          )}

          {visibleItems.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="wallet-outline" size={26} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Записей пока нет</Text>
            </View>
          ) : (
            visibleItems.map((item: any) => {
              const busy = workingId === String(item.id);

              if (tab === 'payments') {
                return (
                  <FinanceCard
                    key={`payment-${item.id}`}
                    theme={theme}
                    icon="card-outline"
                    iconColor={theme.blue}
                    iconBg={theme.blueSoft}
                    title={`Платёж #${item.id}`}
                    subtitle={`Сделка #${item.deal || '-'} · ${methodLabel(item.method)}`}
                    amount={money(toNumber(item.amount_usd ?? item.amount))}
                    amountColor={theme.text}
                    lines={[`${managerName(item)} · ${officeName(item)}`, `Дата: ${formatDate(item.payment_date)}`]}
                  >
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
                        <Pressable onPress={() => confirmPayment(item)} style={[styles.actionBtn, { backgroundColor: GREEN }]}>
                          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Подтвердить</Text>}
                        </Pressable>
                      </View>
                    )}
                  </FinanceCard>
                );
              }

              if (tab === 'expenses') {
                const isCashflow = cashflowEnabled;
                const date = isCashflow ? item.entry_date : item.date;

                return (
                  <FinanceCard
                    key={`expense-${item.id}`}
                    theme={theme}
                    icon="remove-circle-outline"
                    iconColor={theme.red}
                    iconBg={theme.redSoft}
                    title={item.title || `Расход #${item.id}`}
                    subtitle={`${managerName(item)} · ${officeName(item)}`}
                    amount={`- ${money(toNumber(item.amount_usd ?? item.amount))}`}
                    amountColor={theme.red}
                    lines={[
                      ...(item.comment ? [`Комментарий: ${item.comment}`] : []),
                      `Дата: ${formatDate(date)}`,
                    ]}
                  >
                    {isCashflow && (
                      <View style={[styles.categoryPill, { backgroundColor: theme.redSoft }]}>
                        <Text style={[styles.categoryPillText, { color: theme.red }]}>
                          {item.category_label || categoryLabel(item.category)}
                        </Text>
                      </View>
                    )}
                  </FinanceCard>
                );
              }

              return (
                <FinanceCard
                  key={`income-${item.id}`}
                  theme={theme}
                  icon="add-circle-outline"
                  iconColor={theme.success}
                  iconBg={dark ? '#173526' : '#E7F8EC'}
                  title={item.title || `Доход #${item.id}`}
                  subtitle={`${item.created_by_name || 'Сотрудник'} · ${item.office_name || 'Офис'}`}
                  amount={`+ ${money(toNumber(item.amount_usd ?? item.amount))}`}
                  amountColor={theme.success}
                  lines={[
                    ...(item.comment ? [`Комментарий: ${item.comment}`] : []),
                    `Дата: ${formatDate(item.entry_date)}`,
                  ]}
                >
                  <View style={[styles.categoryPill, { backgroundColor: dark ? '#173526' : '#E7F8EC' }]}>
                    <Text style={[styles.categoryPillText, { color: theme.success }]}>
                      {item.category_label || categoryLabel(item.category)}
                    </Text>
                  </View>
                </FinanceCard>
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
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Pressable
                onPress={openExpenseModal}
                style={({ pressed }) => [
                  styles.fabMenuItem,
                  { backgroundColor: pressed ? theme.backgroundSoft : theme.surface },
                ]}
              >
                <View style={[styles.fabMenuIcon, { backgroundColor: theme.redSoft }]}>
                  <Ionicons name="remove-circle-outline" size={19} color={theme.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fabMenuTitle, { color: theme.text }]}>Добавить расход</Text>
                  <Text style={[styles.fabMenuSub, { color: theme.textSecondary }]}>Виза, билеты, офис</Text>
                </View>
              </Pressable>

              <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />

              <Pressable
                onPress={openIncomeModal}
                style={({ pressed }) => [
                  styles.fabMenuItem,
                  { backgroundColor: pressed ? theme.backgroundSoft : theme.surface },
                ]}
              >
                <View style={[styles.fabMenuIcon, { backgroundColor: dark ? '#173526' : '#E7F8EC' }]}>
                  <Ionicons name="add-circle-outline" size={19} color={theme.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fabMenuTitle, { color: theme.text }]}>Добавить доход</Text>
                  <Text style={[styles.fabMenuSub, { color: theme.textSecondary }]}>Пополнение или услуга</Text>
                </View>
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => setFabOpen((v) => !v)} style={[styles.fab, { backgroundColor: theme.blue }]}>
            <Ionicons name={fabOpen ? 'close' : 'add'} size={28} color="#fff" />
          </Pressable>
        </View>

        <FinanceModal
          visible={modalType !== null}
          type={modalType}
          dark={dark}
          theme={theme}
          currencies={currencies}
          offices={offices}
          isAdmin={isAdmin}
          title={title}
          setTitle={setTitle}
          amount={amount}
          setAmount={setAmount}
          comment={comment}
          setComment={setComment}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedCurrencyId={selectedCurrencyId}
          setSelectedCurrencyId={setSelectedCurrencyId}
          selectedOfficeId={selectedOfficeId}
          setSelectedOfficeId={setSelectedOfficeId}
          submitting={submitting}
          onClose={resetForm}
          onSubmit={modalType === 'income' ? submitIncome : submitExpense}
        />
      </View>
    </ScreenWrapper>
  );
}

function FinanceCard({
  theme,
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  amount,
  amountColor,
  lines,
  children,
}: {
  theme: any;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  amount: string;
  amountColor: string;
  lines: string[];
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>

        <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text>
      </View>

      {children}

      {lines.map((line) => (
        <Text key={line} style={[styles.line, { color: theme.textSecondary }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function FinanceModal({
  visible,
  type,
  dark,
  theme,
  currencies,
  offices,
  isAdmin,
  title,
  setTitle,
  amount,
  setAmount,
  comment,
  setComment,
  selectedCategory,
  setSelectedCategory,
  selectedCurrencyId,
  setSelectedCurrencyId,
  selectedOfficeId,
  setSelectedOfficeId,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  type: 'expense' | 'income' | null;
  dark: boolean;
  theme: any;
  currencies: CurrencyItem[];
  offices: OfficeItem[];
  isAdmin: boolean;
  title: string;
  setTitle: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedCurrencyId: number | null;
  setSelectedCurrencyId: (value: number | null) => void;
  selectedOfficeId: number | null;
  setSelectedOfficeId: (value: number | null) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isIncome = type === 'income';
  const accent = isIncome ? theme.success : theme.red;
  const accentBg = isIncome ? (dark ? '#173526' : '#E7F8EC') : theme.redSoft;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.modalHeader,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.modalIcon, { backgroundColor: accentBg }]}>
            <Ionicons name={isIncome ? 'add-circle-outline' : 'remove-circle-outline'} size={24} color={accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {isIncome ? 'Добавить доход' : 'Добавить расход'}
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Фон теперь непрозрачный, поля читаются нормально
            </Text>
          </View>

          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isIncome ? 'Например: Виза / Пополнение офиса' : 'Например: Авиабилеты / Офис'}
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Сумма</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>Категория</Text>
          <View style={styles.optionWrap}>
            {FINANCE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.key;

              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? accent : theme.surface,
                      borderColor: active ? accent : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={cat.icon} size={15} color={active ? '#fff' : theme.text} />
                  <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>Валюта</Text>
          <View style={styles.optionWrap}>
            {currencies.map((currency) => {
              const active = selectedCurrencyId === currency.id;

              return (
                <Pressable
                  key={currency.id}
                  onPress={() => setSelectedCurrencyId(currency.id)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>
                    {currency.code || currency.symbol || currency.name || `#${currency.id}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isAdmin && offices.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Офис</Text>
              <View style={styles.optionWrap}>
                {offices.map((office) => {
                  const active = selectedOfficeId === office.id;

                  return (
                    <Pressable
                      key={office.id}
                      onPress={() => setSelectedOfficeId(office.id)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>
                        {officeLabel(office)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Комментарий к операции"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.textarea, { color: theme.text }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: accent, opacity: submitting ? 0.7 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="save-outline" size={18} color="#fff" />
            )}
            <Text style={styles.submitText}>{submitting ? 'Сохранение...' : 'Сохранить'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 132,
    gap: 14,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    minHeight: 128,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 23,
    fontWeight: '900',
  },
  kpiLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  kpiHint: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 22,
    minHeight: 54,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  chipsRow: {
    gap: 10,
    paddingRight: 8,
  },
  chip: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  categoryFilterRow: {
    gap: 8,
    paddingRight: 8,
  },
  categoryFilterChip: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '900',
  },
  warningCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  warningText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 15,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  amount: {
    fontSize: 15,
    fontWeight: '900',
    maxWidth: 110,
    textAlign: 'right',
  },
  line: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  actionBtn: {
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 108,
    alignItems: 'flex-end',
    zIndex: 50,
  },
  fabMenu: {
    width: 282,
    borderWidth: 1,
    borderRadius: 24,
    padding: 8,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  fabMenuItem: {
    minHeight: 66,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
  },
  fabMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  fabMenuSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  fabDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  modalRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 58 : 26,
  },
  modalHeader: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 28,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  modalClose: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    gap: 13,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    minHeight: 28,
    fontSize: 15,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 92,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  optionChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  optionText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  submitBtn: {
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
