import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Markdown from 'react-native-markdown-display';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type FilterKey = 'today' | 'week' | 'all';

type UserMini = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role?: string;
};

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
  updated_at?: string;
};

type PaymentItem = {
  id: number;
  amount?: number | string;
  amount_usd?: number | string;
  is_confirmed?: boolean;
};

type EmployeeOption = {
  key: string;
  user: UserMini;
  reportsCount: number;
  lastReportDate?: string;
};

function stripHtml(value?: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

function userName(user?: UserMini | null) {
  if (!user) return 'Неизвестный сотрудник';

  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.email ||
    `Сотрудник #${user.id}`
  );
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (!parts.length) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function localISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

function todayISO() {
  return localISO(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(date: Date) {
  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function firstDayOffsetMonday(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function reportDate(item: ReportItem) {
  return String(item.date || item.created_at || '').slice(0, 10);
}

function reportEmployeeKey(item: ReportItem) {
  return item.employee ? String(item.employee) : `name:${item.employee_name || 'unknown'}`;
}

function prettyDate(value?: string) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function prettyDateTime(value?: string) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function AdminReportsScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const POSITIVE = theme.success || '#1AAE6F';
  const WARNING = theme.warning || '#F59E0B';
  const BLUE_SOFT = theme.blueSoft || `${theme.blue}18`;
  const RED_SOFT = theme.redSoft || `${theme.red}14`;
  const SHADOW = theme.shadow || '#000';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<FilterKey>('today');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [aiError, setAiError] = useState('');

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState<string>('');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [reportsData, paymentsData, usersData] = await Promise.all([
        fetchAllPages('reports/daily/').catch(() => []),
        fetchAllPages('analytics/payments/').catch(() => []),
        fetchAllPages('users/users/?limit=100&offset=0').catch(() => []),
      ]);

      setReports((reportsData || []) as ReportItem[]);
      setPayments((paymentsData || []) as PaymentItem[]);
      setUsers((usersData || []) as UserMini[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAiSummary = useCallback(async (selectedFilter: FilterKey) => {
    setAiLoading(true);
    setAiError('');

    try {
      const todayStr = todayISO();
      const weekAgo = localISO(addDays(new Date(), -7));

      const params: Record<string, string> = {};

      if (selectedFilter === 'today') {
        params.date_from = todayStr;
        params.date_to = todayStr;
      } else if (selectedFilter === 'week') {
        params.date_from = weekAgo;
      }

      const response = await apiClient.get('reports/daily/ai_summary/', { params });

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

  const todayStr = todayISO();
  const weekAgo = localISO(addDays(new Date(), -7));

  const filteredReports = useMemo(() => {
    return [...reports]
      .filter((item) => {
        const date = reportDate(item);

        if (filter === 'today') return date === todayStr;
        if (filter === 'week') return date >= weekAgo;

        return true;
      })
      .sort((a, b) => reportDate(b).localeCompare(reportDate(a)));
  }, [filter, reports, todayStr, weekAgo]);

  const reportEmployees = useMemo<EmployeeOption[]>(() => {
    const map = new Map<string, UserMini>();

    users.forEach((item) => {
      if (!item.id) return;
      map.set(String(item.id), item);
    });

    reports.forEach((item) => {
      const key = reportEmployeeKey(item);

      if (!map.has(key)) {
        map.set(key, {
          id: item.employee || 0,
          full_name: item.employee_name || `Сотрудник #${item.employee || item.id}`,
        });
      }
    });

    return Array.from(map.entries())
      .map(([key, value]) => {
        const employeeReports = reports
          .filter((item) => reportEmployeeKey(item) === key)
          .sort((a, b) => reportDate(b).localeCompare(reportDate(a)));

        return {
          key,
          user: value,
          reportsCount: employeeReports.length,
          lastReportDate: employeeReports[0] ? reportDate(employeeReports[0]) : undefined,
        };
      })
      .filter((item) => item.reportsCount > 0)
      .sort((a, b) => userName(a.user).localeCompare(userName(b.user), 'ru'));
  }, [users, reports]);

  useEffect(() => {
    if (!selectedEmployeeKey && reportEmployees.length > 0) {
      setSelectedEmployeeKey(reportEmployees[0].key);
    }
  }, [reportEmployees, selectedEmployeeKey]);

  const selectedEmployee = useMemo(() => {
    return reportEmployees.find((item) => item.key === selectedEmployeeKey) || reportEmployees[0] || null;
  }, [reportEmployees, selectedEmployeeKey]);

  const employeeReports = useMemo(() => {
    if (!selectedEmployee?.key) return [];

    return reports
      .filter((item) => reportEmployeeKey(item) === selectedEmployee.key)
      .sort((a, b) => reportDate(b).localeCompare(reportDate(a)));
  }, [reports, selectedEmployee?.key]);

  const monthReports = useMemo(() => {
    const currentMonth = monthISO(monthCursor);
    return employeeReports.filter((item) => reportDate(item).startsWith(currentMonth));
  }, [employeeReports, monthCursor]);

  const reportsByDay = useMemo(() => {
    const map = new Map<string, ReportItem[]>();

    monthReports.forEach((item) => {
      const key = reportDate(item);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });

    return map;
  }, [monthReports]);

  const selectedDayReports = useMemo(() => {
    if (!selectedDay) return [];
    return reportsByDay.get(selectedDay) || [];
  }, [reportsByDay, selectedDay]);

  const employeeStats = useMemo(() => {
    const income = monthReports.reduce((sum, item) => sum + reportIncome(item), 0);
    const expense = monthReports.reduce((sum, item) => sum + reportExpense(item), 0);
    const leads = monthReports.reduce((sum, item) => sum + num(item.leads_processed), 0);
    const deals = monthReports.reduce((sum, item) => sum + num(item.deals_closed), 0);

    return {
      reports: monthReports.length,
      income,
      expense,
      balance: income - expense,
      leads,
      deals,
    };
  }, [monthReports]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();

    if (!q) return reportEmployees;

    return reportEmployees.filter((item) => {
      return (
        userName(item.user).toLowerCase().includes(q) ||
        String(item.user.email || '').toLowerCase().includes(q)
      );
    });
  }, [reportEmployees, employeeSearch]);

  const calendarDays = useMemo(() => {
    const blanks = Array.from({ length: firstDayOffsetMonday(monthCursor) }, (_, index) => ({
      type: 'blank' as const,
      key: `blank-${index}`,
    }));

    const days = Array.from({ length: daysInMonth(monthCursor) }, (_, index) => {
      const day = index + 1;
      const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
      const iso = localISO(date);
      const dayReports = reportsByDay.get(iso) || [];

      return {
        type: 'day' as const,
        key: iso,
        day,
        iso,
        reports: dayReports,
      };
    });

    return [...blanks, ...days];
  }, [monthCursor, reportsByDay]);

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

  const mdStyles = useMemo(
    () =>
      StyleSheet.create({
        body: { color: theme.text, fontSize: 15, lineHeight: 24 },
        heading1: {
          color: theme.text,
          fontSize: 20,
          fontWeight: '900',
          marginTop: 16,
          marginBottom: 8,
        },
        heading2: {
          color: theme.text,
          fontSize: 18,
          fontWeight: '800',
          marginTop: 14,
          marginBottom: 6,
        },
        heading3: {
          color: theme.text,
          fontSize: 16,
          fontWeight: '700',
          marginTop: 12,
          marginBottom: 4,
        },
        strong: { color: theme.text, fontWeight: '800' },
        em: { color: theme.text, fontStyle: 'italic' },
        bullet_list: { marginTop: 6, marginBottom: 6 },
        ordered_list: { marginTop: 6, marginBottom: 6 },
        paragraph: { marginTop: 6, marginBottom: 6 },
        list_item: { marginTop: 4, marginBottom: 4 },
      }),
    [theme]
  );

  const openEmployeeArchive = () => {
    setEmployeeModalOpen(true);
    setEmployeePickerOpen(false);
    setSelectedDay(null);
  };

  const closeEmployeeArchive = () => {
    setEmployeeModalOpen(false);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
    setSelectedDay(null);
  };

  const goPrevMonth = () => {
    setSelectedDay(null);
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setSelectedDay(null);
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

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
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: SHADOW,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: BLUE_SOFT }]}>
              <Ionicons name="bar-chart-outline" size={24} color={theme.blue} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Отчёты</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                Контроль daily reports, доходов, расходов и активности сотрудников
              </Text>
            </View>
          </View>

          <Pressable
            onPress={openEmployeeArchive}
            style={[
              styles.employeeHistoryButton,
              {
                backgroundColor: theme.blue,
                shadowColor: SHADOW,
              },
            ]}
          >
            <View style={styles.employeeHistoryLeft}>
              <View style={styles.employeeHistoryIcon}>
                <Ionicons name="calendar-outline" size={22} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.employeeHistoryButtonText}>Архив отчётов сотрудника</Text>
                <Text style={styles.employeeHistoryButtonSub}>
                  Выбор сотрудника · календарь месяца · отчёт по дням
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={21} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {[
            { key: 'today', label: 'Сегодня', icon: 'today-outline' },
            { key: 'week', label: '7 дней', icon: 'calendar-outline' },
            { key: 'all', label: 'Все', icon: 'albums-outline' },
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
                <Ionicons
                  name={item.icon as any}
                  size={15}
                  color={active ? '#fff' : theme.textSecondary}
                />
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
          <KpiCard
            theme={theme}
            icon="document-text-outline"
            label="Отчётов"
            value={String(stats.count)}
            color={theme.blue}
            bg={BLUE_SOFT}
          />
          <KpiCard
            theme={theme}
            icon="people-outline"
            label="Сотрудников"
            value={String(stats.employees)}
            color={WARNING}
            bg={`${WARNING}18`}
          />
          <KpiCard
            theme={theme}
            icon="trending-up-outline"
            label="Доход"
            value={money(stats.income)}
            color={POSITIVE}
            bg={`${POSITIVE}18`}
          />
          <KpiCard
            theme={theme}
            icon="trending-down-outline"
            label="Расход"
            value={money(stats.expense)}
            color={theme.red}
            bg={RED_SOFT}
          />
          <KpiCard
            theme={theme}
            icon="card-outline"
            label="Оборот"
            value={money(stats.turnover)}
            color={theme.text}
            bg={theme.backgroundSoft}
          />
          <KpiCard
            theme={theme}
            icon="wallet-outline"
            label="Баланс"
            value={money(stats.balance)}
            color={stats.balance >= 0 ? POSITIVE : theme.red}
            bg={stats.balance >= 0 ? `${POSITIVE}18` : RED_SOFT}
          />
        </View>

        <View
          style={[
            styles.aiCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: SHADOW,
            },
          ]}
        >
          <View style={styles.aiHeader}>
            <View style={[styles.aiIcon, { backgroundColor: BLUE_SOFT }]}>
              <Ionicons name="sparkles-outline" size={21} color={theme.blue} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.aiTitle, { color: theme.text }]}>Ответ ИИ</Text>
              <Text style={[styles.aiSub, { color: theme.textSecondary }]}>
                Сводка на основе выбранного периода
              </Text>
            </View>

            <Pressable
              onPress={() => void loadAiSummary(filter)}
              style={[
                styles.aiRefreshBtn,
                {
                  backgroundColor: theme.backgroundSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={theme.blue} />
              ) : (
                <Ionicons name="refresh-outline" size={18} color={theme.blue} />
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
              <Text style={[styles.aiBody, { color: theme.textSecondary }]}>
                {aiError || 'AI summary пока не получен.'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Последние отчёты</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Нажми на карточку, чтобы раскрыть полный текст
            </Text>
          </View>
        </View>

        {filteredReports.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="file-tray-outline" size={34} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Отчётов нет</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              За выбранный период сотрудники ещё не отправляли отчёты.
            </Text>
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
                style={[
                  styles.reportCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: expanded ? theme.blue : theme.border,
                    shadowColor: SHADOW,
                  },
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.avatar, { backgroundColor: theme.blue }]}>
                    <Text style={styles.avatarText}>
                      {initials({
                        id: item.employee || 0,
                        full_name: item.employee_name,
                      })}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.employee_name || `Сотрудник #${item.employee || item.id}`}
                    </Text>
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      {prettyDate(reportDate(item))}
                    </Text>
                  </View>

                  <Ionicons
                    name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={21}
                    color={theme.textMuted}
                  />
                </View>

                <View style={styles.reportMiniStats}>
                  <MiniStat theme={theme} label="Лиды" value={String(num(item.leads_processed))} color={theme.blue} bg={BLUE_SOFT} />
                  <MiniStat theme={theme} label="Сделки" value={String(num(item.deals_closed))} color={WARNING} bg={`${WARNING}18`} />
                  <MiniStat theme={theme} label="Доход" value={money(income)} color={POSITIVE} bg={`${POSITIVE}18`} />
                  <MiniStat theme={theme} label="Расход" value={money(expense)} color={theme.red} bg={RED_SOFT} />
                </View>

                <Text style={[styles.preview, { color: theme.textSecondary }]}>
                  {expanded ? stripHtml(item.content) || '— Нет текста —' : preview || '— Нет текста —'}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={employeeModalOpen} animationType="slide" transparent={false} onRequestClose={closeEmployeeArchive}>
        <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.modalHeaderIcon, { backgroundColor: BLUE_SOFT }]}>
              <Ionicons name="calendar-number-outline" size={24} color={theme.blue} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Архив отчётов</Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Выбери сотрудника, месяц и день с отчётом
              </Text>
            </View>

            <Pressable
              onPress={closeEmployeeArchive}
              style={[styles.closeButton, { backgroundColor: theme.backgroundSoft }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.employeeProfileCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: SHADOW,
                },
              ]}
            >
              <Pressable
                onPress={() => setEmployeePickerOpen((v) => !v)}
                style={styles.employeeProfileTop}
              >
                <View style={[styles.bigAvatar, { backgroundColor: theme.blue }]}>
                  <Text style={styles.bigAvatarText}>
                    {initials(selectedEmployee?.user)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectLabel, { color: theme.textMuted }]}>Сотрудник</Text>
                  <Text style={[styles.selectValue, { color: theme.text }]} numberOfLines={1}>
                    {selectedEmployee ? userName(selectedEmployee.user) : 'Нет сотрудников с отчётами'}
                  </Text>
                  <Text style={[styles.selectSub, { color: theme.textSecondary }]}>
                    {selectedEmployee?.reportsCount || 0} отчётов · последний: {prettyDate(selectedEmployee?.lastReportDate)}
                  </Text>
                </View>

                <View style={[styles.dropdownButton, { backgroundColor: theme.backgroundSoft }]}>
                  <Ionicons
                    name={employeePickerOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={19}
                    color={theme.text}
                  />
                </View>
              </Pressable>

              {employeePickerOpen && (
                <View style={[styles.dropdown, { borderColor: theme.border }]}>
                  <View
                    style={[
                      styles.searchInputWrap,
                      {
                        backgroundColor: theme.backgroundSoft,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons name="search-outline" size={17} color={theme.textMuted} />
                    <TextInput
                      value={employeeSearch}
                      onChangeText={setEmployeeSearch}
                      placeholder="Поиск сотрудника"
                      placeholderTextColor={theme.textMuted}
                      style={[styles.employeeSearch, { color: theme.text }]}
                    />
                  </View>

                  {filteredEmployees.length === 0 ? (
                    <Text style={[styles.emptyDropdown, { color: theme.textSecondary }]}>
                      Сотрудники с отчётами не найдены.
                    </Text>
                  ) : (
                    filteredEmployees.map((item) => {
                      const active = selectedEmployeeKey === item.key;

                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            setSelectedEmployeeKey(item.key);
                            setEmployeePickerOpen(false);
                            setEmployeeSearch('');
                            setSelectedDay(null);
                          }}
                          style={[
                            styles.employeeOption,
                            {
                              backgroundColor: active ? BLUE_SOFT : theme.backgroundSoft,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <View style={[styles.smallAvatar, { backgroundColor: active ? theme.blue : theme.textMuted }]}>
                            <Text style={styles.smallAvatarText}>{initials(item.user)}</Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.employeeOptionName, { color: theme.text }]}
                              numberOfLines={1}
                            >
                              {userName(item.user)}
                            </Text>
                            <Text style={[styles.employeeOptionSub, { color: theme.textSecondary }]}>
                              {item.reportsCount} отчётов · последний: {prettyDate(item.lastReportDate)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            <View
              style={[
                styles.monthCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: SHADOW,
                },
              ]}
            >
              <View style={styles.monthHeader}>
                <Pressable onPress={goPrevMonth} style={[styles.monthButton, { backgroundColor: theme.backgroundSoft }]}>
                  <Ionicons name="chevron-back" size={21} color={theme.text} />
                </Pressable>

                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.monthTitle, { color: theme.text }]}>
                    {monthTitle(monthCursor)}
                  </Text>
                  <Text style={[styles.monthSub, { color: theme.textSecondary }]}>
                    {employeeStats.reports} рабочих дней с отчётом
                  </Text>
                </View>

                <Pressable onPress={goNextMonth} style={[styles.monthButton, { backgroundColor: theme.backgroundSoft }]}>
                  <Ionicons name="chevron-forward" size={21} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.employeeStatsGrid}>
                <EmployeeStat theme={theme} label="Дней" value={String(employeeStats.reports)} color={theme.blue} bg={BLUE_SOFT} />
                <EmployeeStat theme={theme} label="Лиды" value={String(employeeStats.leads)} color={WARNING} bg={`${WARNING}18`} />
                <EmployeeStat theme={theme} label="Доход" value={money(employeeStats.income)} color={POSITIVE} bg={`${POSITIVE}18`} />
                <EmployeeStat theme={theme} label="Баланс" value={money(employeeStats.balance)} color={employeeStats.balance >= 0 ? POSITIVE : theme.red} bg={employeeStats.balance >= 0 ? `${POSITIVE}18` : RED_SOFT} />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.blue }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>есть отчёт</Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.border }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>нет отчёта</Text>
                </View>
              </View>

              <View style={styles.weekRow}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((item) => (
                  <Text key={item} style={[styles.weekDay, { color: theme.textMuted }]}>
                    {item}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((item) => {
                  if (item.type === 'blank') {
                    return <View key={item.key} style={styles.calendarDayBlank} />;
                  }

                  const hasReport = item.reports.length > 0;
                  const active = selectedDay === item.iso;
                  const isToday = item.iso === todayStr;

                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        if (!hasReport) return;
                        setSelectedDay(active ? null : item.iso);
                      }}
                      style={[
                        styles.calendarDay,
                        {
                          backgroundColor: active
                            ? theme.blue
                            : hasReport
                              ? BLUE_SOFT
                              : theme.backgroundSoft,
                          borderColor: active
                            ? theme.blue
                            : hasReport
                              ? `${theme.blue}66`
                              : isToday
                                ? WARNING
                                : theme.border,
                          opacity: hasReport ? 1 : 0.58,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          {
                            color: active
                              ? '#fff'
                              : hasReport
                                ? theme.blue
                                : theme.textMuted,
                          },
                        ]}
                      >
                        {item.day}
                      </Text>

                      {hasReport && (
                        <View
                          style={[
                            styles.reportDot,
                            {
                              backgroundColor: active ? '#fff' : theme.blue,
                            },
                          ]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {monthReports.length === 0 && (
                <View style={[styles.noMonthReports, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Ionicons name="file-tray-outline" size={22} color={theme.textMuted} />
                  <Text style={[styles.noMonthReportsText, { color: theme.textSecondary }]}>
                    В этом месяце у сотрудника нет отчётов.
                  </Text>
                </View>
              )}
            </View>

            {selectedDay ? (
              <View style={styles.dayReportsList}>
                <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
                  Отчёт за {prettyDate(selectedDay)}
                </Text>

                {selectedDayReports.map((item) => {
                  const income = reportIncome(item);
                  const expense = reportExpense(item);
                  const balance = income - expense;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.dayReportCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          shadowColor: SHADOW,
                        },
                      ]}
                    >
                      <View style={styles.dayReportHeader}>
                        <View style={[styles.dayIcon, { backgroundColor: BLUE_SOFT }]}>
                          <Ionicons name="document-text-outline" size={21} color={theme.blue} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dayReportTitle, { color: theme.text }]}>
                            Daily report
                          </Text>
                          <Text style={[styles.dayReportSub, { color: theme.textSecondary }]}>
                            Создан: {prettyDateTime(item.created_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dayMetrics}>
                        <MiniStat theme={theme} label="Лиды" value={String(num(item.leads_processed))} color={theme.blue} bg={BLUE_SOFT} />
                        <MiniStat theme={theme} label="Сделки" value={String(num(item.deals_closed))} color={WARNING} bg={`${WARNING}18`} />
                        <MiniStat theme={theme} label="Доход" value={money(income)} color={POSITIVE} bg={`${POSITIVE}18`} />
                        <MiniStat theme={theme} label="Расход" value={money(expense)} color={theme.red} bg={RED_SOFT} />
                        <MiniStat theme={theme} label="Баланс" value={money(balance)} color={balance >= 0 ? POSITIVE : theme.red} bg={balance >= 0 ? `${POSITIVE}18` : RED_SOFT} />
                      </View>

                      <View
                        style={[
                          styles.reportContentBox,
                          {
                            backgroundColor: theme.backgroundSoft,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text style={[styles.reportContentLabel, { color: theme.textMuted }]}>
                          Текст отчёта
                        </Text>
                        <Text style={[styles.reportContent, { color: theme.textSecondary }]}>
                          {stripHtml(item.content) || '— Нет текста отчёта —'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.tipCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="hand-left-outline" size={22} color={theme.blue} />
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                  Нажми на синий день в календаре, чтобы раскрыть отчёт сотрудника.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

function KpiCard({
  theme,
  icon,
  label,
  value,
  color,
  bg,
}: {
  theme: any;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MiniStat({
  theme,
  label,
  value,
  color,
  bg,
}: {
  theme: any;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.miniStat, { backgroundColor: bg }]}>
      <Text style={[styles.miniStatValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.miniStatLabel, { color }]}>{label}</Text>
    </View>
  );
}

function EmployeeStat({
  theme,
  label,
  value,
  color,
  bg,
}: {
  theme: any;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.employeeStat, { backgroundColor: bg, borderColor: bg }]}>
      <Text style={[styles.employeeStatValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.employeeStatLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  denied: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  container: {
    padding: 18,
    paddingBottom: 120,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  employeeHistoryButton: {
    marginTop: 18,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  employeeHistoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  employeeHistoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeHistoryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  employeeHistoryButtonSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  filterChip: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  kpiCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  kpiIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  kpiLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '800',
  },
  aiCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  aiHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  aiIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  aiSub: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: '700',
  },
  aiRefreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiProvider: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '900',
  },
  aiBodyWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  aiBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 15,
    marginTop: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
  },
  reportMiniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  miniStat: {
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '47%',
  },
  miniStatValue: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  miniStatLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  preview: {
    marginTop: 13,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },

  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 100,
  },
  employeeProfileCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  employeeProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bigAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectValue: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
  },
  selectSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownButton: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 14,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  searchInputWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  employeeSearch: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  employeeOption: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  employeeOptionName: {
    fontSize: 14,
    fontWeight: '900',
  },
  employeeOptionSub: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyDropdown: {
    padding: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  monthCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 28,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  monthSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  employeeStatsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  employeeStat: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  employeeStatValue: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  employeeStatLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  legendRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  weekRow: {
    marginTop: 16,
    flexDirection: 'row',
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
  },
  calendarGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  calendarDayBlank: {
    width: `${100 / 7}%`,
    height: 48,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    height: 48,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.92 }],
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '900',
  },
  reportDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  noMonthReports: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noMonthReportsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedDayTitle: {
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
  },
  dayReportsList: {
    marginTop: 16,
    gap: 12,
  },
  dayReportCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  dayReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayReportTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  dayReportSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  dayMetrics: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportContentBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  reportContentLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  reportContent: {
    marginTop: 9,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  tipCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 22,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});