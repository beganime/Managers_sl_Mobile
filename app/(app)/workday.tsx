import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type Shift = {
  id: number;
  employee?: number;
  employee_name?: string;
  date?: string;
  time_in?: string;
  time_out?: string | null;
  is_active?: boolean;
  hours_worked?: number | string;
  is_auto_closed?: boolean;
  updated_at?: string;
};

type DailyReport = {
  id: number;
  employee?: number;
  employee_name?: string;
  date?: string;
  content?: string;
  income?: string | number;
  expense?: string | number;
  leads_processed?: number;
  deals_closed?: number;
  net_result?: string | number;
  created_at?: string;
  updated_at?: string;
};

type CommonNote = {
  id: string;
  authorId?: number;
  authorName: string;
  text: string;
  createdAt: string;
};

type PersonalNote = {
  id: string;
  text: string;
  createdAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatHours(value?: string | number | null) {
  const n = Number(value || 0);
  return `${n.toFixed(2)} ч`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fullNameOf(user: any) {
  return (
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Пользователь'
  );
}

function asTextNumber(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toNumber(value: string) {
  if (!value?.trim()) return 0;
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function WorkdayScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);

  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [reportContent, setReportContent] = useState('');
  const [reportIncome, setReportIncome] = useState('');
  const [reportExpense, setReportExpense] = useState('');
  const [reportLeads, setReportLeads] = useState('');
  const [reportDeals, setReportDeals] = useState('');

  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [commonNotes, setCommonNotes] = useState<CommonNote[]>([]);
  const [personalNoteText, setPersonalNoteText] = useState('');
  const [commonNoteText, setCommonNoteText] = useState('');

  const personalKey = `workday_personal_notes_${user?.id || 'guest'}`;
  const commonKey = 'workday_common_notes_v1';

  const loadNotes = async () => {
    try {
      const personalRaw = await getToken(personalKey);
      const commonRaw = await getToken(commonKey);
      setPersonalNotes(personalRaw ? JSON.parse(personalRaw) : []);
      setCommonNotes(commonRaw ? JSON.parse(commonRaw) : []);
    } catch {
      setPersonalNotes([]);
      setCommonNotes([]);
    }
  };

  const savePersonalNotes = async (items: PersonalNote[]) => {
    setPersonalNotes(items);
    await saveToken(personalKey, JSON.stringify(items));
  };

  const saveCommonNotes = async (items: CommonNote[]) => {
    setCommonNotes(items);
    await saveToken(commonKey, JSON.stringify(items));
  };

  const applyReportToState = (report: DailyReport | null) => {
    setTodayReport(report);

    if (!report) {
      setReportContent('');
      setReportIncome('');
      setReportExpense('');
      setReportLeads('');
      setReportDeals('');
      return;
    }

    setReportContent(report.content || '');
    setReportIncome(asTextNumber(report.income));
    setReportExpense(asTextNumber(report.expense));
    setReportLeads(asTextNumber(report.leads_processed));
    setReportDeals(asTextNumber(report.deals_closed));
  };

  const loadData = async () => {
    try {
      const today = todayStr();

      const [currentRes, shiftsRes, historyRes] = await Promise.all([
        apiClient.get('timetracking/shifts/current/'),
        apiClient.get(`timetracking/shifts/?date_from=${today}&date_to=${today}`),
        apiClient.get('timetracking/shifts/?date_from=2026-01-01'),
      ]);

      const currentPayload = currentRes.data;
      const current =
        currentPayload?.shift !== undefined
          ? currentPayload.shift
          : currentPayload?.id
            ? currentPayload
            : null;

      const shifts = shiftsRes.data?.results ?? shiftsRes.data ?? [];
      const history = historyRes.data?.results ?? historyRes.data ?? [];

      setCurrentShift(current);
      setTodayShifts(Array.isArray(shifts) ? shifts : []);
      setHistoryShifts(Array.isArray(history) ? history : []);

      try {
        const reportRes = await apiClient.get('reports/daily/today/');
        applyReportToState(reportRes.data);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          applyReportToState(null);
        } else {
          throw error;
        }
      }

      await loadNotes();
    } catch (error) {
      console.error('Ошибка загрузки таймтрекинга', error);
      Alert.alert('Ошибка', 'Не удалось загрузить учёт рабочего времени.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const buildReportPayload = () => ({
    content: reportContent.trim(),
    income: toNumber(reportIncome),
    expense: toNumber(reportExpense),
    leads_processed: Math.max(0, Math.floor(toNumber(reportLeads))),
    deals_closed: Math.max(0, Math.floor(toNumber(reportDeals))),
  });

  const hasAnyReportDraft = useMemo(() => {
    return Boolean(
      reportContent.trim() ||
        reportIncome.trim() ||
        reportExpense.trim() ||
        reportLeads.trim() ||
        reportDeals.trim()
    );
  }, [reportContent, reportIncome, reportExpense, reportLeads, reportDeals]);

  const saveTodayReport = async () => {
    if (!reportContent.trim()) {
      Alert.alert('Нужен отчёт', 'Напиши, что было сделано за день.');
      return;
    }

    setReportSaving(true);
    try {
      const payload = buildReportPayload();
      const res = await apiClient.post('reports/daily/submit_today/', payload);
      const report = res?.data?.report ?? res?.data ?? null;

      if (report) {
        applyReportToState(report);
      }

      Alert.alert('Готово', 'Отчёт за сегодня сохранён.');
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.date?.[0] ||
        'Не удалось сохранить отчёт.';
      Alert.alert('Ошибка', msg);
    } finally {
      setReportSaving(false);
    }
  };

  const startDay = async () => {
    setActionLoading(true);
    try {
      await apiClient.post('timetracking/shifts/start_day/', {});
      await loadData();
      Alert.alert('Готово', 'Рабочий день начат.');
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail || 'Не удалось начать рабочий день.';
      Alert.alert('Ошибка', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const endDay = async () => {
    if (!isAdmin && !reportContent.trim()) {
      Alert.alert('Нужен отчёт', 'Сначала заполни отчёт внутри этой страницы.');
      return;
    }

    setActionLoading(true);
    try {
      let payload: any = {};

      if (!isAdmin) {
        payload = {
          report: buildReportPayload(),
        };
      } else if (hasAnyReportDraft || todayReport?.id) {
        payload = {
          report: buildReportPayload(),
        };
      }

      const res = await apiClient.post('timetracking/shifts/end_day/', payload);

      if (res?.data?.report) {
        applyReportToState(res.data.report);
      } else if (isAdmin && !payload.report) {
        applyReportToState(todayReport);
      }

      await loadData();
      Alert.alert(
        'Готово',
        isAdmin
          ? 'Рабочий день завершён.'
          : 'Рабочий день завершён, отчёт сохранён.'
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.date?.[0] ||
        'Не удалось завершить рабочий день.';
      Alert.alert('Ошибка', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const addPersonalNote = async () => {
    if (!personalNoteText.trim()) return;

    const next: PersonalNote[] = [
      {
        id: `pn_${Date.now()}`,
        text: personalNoteText.trim(),
        createdAt: new Date().toISOString(),
      },
      ...personalNotes,
    ];

    await savePersonalNotes(next);
    setPersonalNoteText('');
  };

  const addCommonNote = async () => {
    if (!commonNoteText.trim()) return;

    const next: CommonNote[] = [
      {
        id: `cn_${Date.now()}`,
        authorId: user?.id,
        authorName: fullNameOf(user),
        text: commonNoteText.trim(),
        createdAt: new Date().toISOString(),
      },
      ...commonNotes,
    ];

    await saveCommonNotes(next);
    setCommonNoteText('');
  };

  const todayStats = useMemo(() => {
    const active = todayShifts.filter((x) => x.is_active).length;
    const total = todayShifts.length;
    const hours = todayShifts.reduce((sum, item) => sum + Number(item.hours_worked || 0), 0);
    return { active, total, hours };
  }, [todayShifts]);

  const reportNet = useMemo(() => {
    return toNumber(reportIncome) - toNumber(reportExpense);
  }, [reportIncome, reportExpense]);

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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Text style={[styles.title, { color: theme.text }]}>Учет времени</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={theme.blue}
          />
        }
      >
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {currentShift?.is_active ? 'Рабочий день активен' : 'Рабочий день не начат'}
              </Text>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                {currentShift?.is_active
                  ? `Пришёл: ${formatDate(currentShift.time_in)}`
                  : 'Нажми кнопку, чтобы начать день'}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: currentShift?.is_active ? '#EAF8EF' : theme.redSoft },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: currentShift?.is_active ? theme.success : theme.red },
                ]}
              >
                {currentShift?.is_active ? 'В ОФИСЕ' : 'НЕ АКТИВЕН'}
              </Text>
            </View>
          </View>

          <View style={styles.actionColumn}>
            {!currentShift?.is_active ? (
              <Pressable onPress={startDay} style={[styles.mainAction, { backgroundColor: theme.success }]}>
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={styles.mainActionText}>Начать день</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable onPress={endDay} style={[styles.mainAction, { backgroundColor: theme.red }]}>
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="stop" size={18} color="#fff" />
                    <Text style={styles.mainActionText}>
                      {isAdmin ? 'Завершить день' : 'Завершить день и отправить отчёт'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{todayStats.total}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Смен сегодня</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{todayStats.active}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Активных</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{todayStats.hours.toFixed(2)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Часы</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Ежедневный отчёт</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            {isAdmin
              ? 'Для администратора отчёт необязателен. Можно завершить день и без него.'
              : 'Отчёт обязателен перед завершением рабочего дня.'}
          </Text>

          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: theme.backgroundSoft,
                borderColor: theme.border,
                minHeight: 120,
                marginTop: 12,
              },
            ]}
          >
            <TextInput
              value={reportContent}
              onChangeText={setReportContent}
              placeholder="Что было сделано за день"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[
                styles.input,
                { color: theme.text, minHeight: 96, textAlignVertical: 'top' },
              ]}
            />
          </View>

          <View style={styles.reportGrid}>
            <View style={styles.reportField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Доход</Text>
              <View style={[styles.smallInputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <TextInput
                  value={reportIncome}
                  onChangeText={setReportIncome}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  style={[styles.smallInput, { color: theme.text }]}
                />
              </View>
            </View>

            <View style={styles.reportField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Расход</Text>
              <View style={[styles.smallInputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <TextInput
                  value={reportExpense}
                  onChangeText={setReportExpense}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  style={[styles.smallInput, { color: theme.text }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.reportGrid}>
            <View style={styles.reportField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Новых заявок</Text>
              <View style={[styles.smallInputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <TextInput
                  value={reportLeads}
                  onChangeText={setReportLeads}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  style={[styles.smallInput, { color: theme.text }]}
                />
              </View>
            </View>

            <View style={styles.reportField}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Закрыто сделок</Text>
              <View style={[styles.smallInputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <TextInput
                  value={reportDeals}
                  onChangeText={setReportDeals}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  style={[styles.smallInput, { color: theme.text }]}
                />
              </View>
            </View>
          </View>

          <View
            style={[
              styles.reportSummary,
              { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.reportSummaryTitle, { color: theme.text }]}>
              Итого за день
            </Text>
            <Text style={[styles.reportSummaryValue, { color: reportNet >= 0 ? theme.success : theme.red }]}>
              {reportNet.toFixed(2)}
            </Text>
          </View>

          <Pressable
            onPress={saveTodayReport}
            style={[styles.smallAction, { backgroundColor: theme.blue }]}
          >
            {reportSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.smallActionText}>
                {todayReport?.id ? 'Обновить отчёт' : 'Сохранить отчёт'}
              </Text>
            )}
          </Pressable>

          {todayReport?.updated_at ? (
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              Последнее обновление: {formatDate(todayReport.updated_at)}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {isAdmin ? 'Команда сегодня' : 'Мои смены сегодня'}
          </Text>

          {todayShifts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Смен пока нет.</Text>
          ) : (
            todayShifts.map((shift) => (
              <View key={shift.id} style={[styles.shiftRow, { borderBottomColor: theme.divider }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.shiftName, { color: theme.text }]}>
                    {shift.employee_name || fullNameOf(user)}
                  </Text>
                  <Text style={[styles.shiftMeta, { color: theme.textSecondary }]}>
                    Приход: {formatDate(shift.time_in)}
                  </Text>
                  <Text style={[styles.shiftMeta, { color: theme.textSecondary }]}>
                    Уход: {shift.time_out ? formatDate(shift.time_out) : '—'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: shift.is_active ? '#EAF8EF' : theme.backgroundSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: shift.is_active ? theme.success : theme.textSecondary },
                      ]}
                    >
                      {shift.is_active ? 'ACTIVE' : 'DONE'}
                    </Text>
                  </View>
                  <Text style={[styles.hoursText, { color: theme.blue }]}>
                    {formatHours(shift.hours_worked)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Мои заметки</Text>

          <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border, minHeight: 92 }]}>
            <TextInput
              value={personalNoteText}
              onChangeText={setPersonalNoteText}
              placeholder="Личные заметки по дню"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[styles.input, { color: theme.text, minHeight: 68, textAlignVertical: 'top' }]}
            />
          </View>

          <Pressable onPress={addPersonalNote} style={[styles.smallAction, { backgroundColor: theme.blue }]}>
            <Text style={styles.smallActionText}>Добавить личную заметку</Text>
          </Pressable>

          <View style={{ gap: 10, marginTop: 14 }}>
            {personalNotes.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Личных заметок пока нет.</Text>
            ) : (
              personalNotes.map((note) => (
                <View
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                >
                  <Text style={[styles.noteText, { color: theme.text }]}>{note.text}</Text>
                  <Text style={[styles.noteMeta, { color: theme.textSecondary }]}>
                    {formatDate(note.createdAt)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Общие заметки</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            У общих заметок всегда видно имя автора.
          </Text>

          <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border, minHeight: 92 }]}>
            <TextInput
              value={commonNoteText}
              onChangeText={setCommonNoteText}
              placeholder="Общая заметка для команды на этом устройстве"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[styles.input, { color: theme.text, minHeight: 68, textAlignVertical: 'top' }]}
            />
          </View>

          <Pressable onPress={addCommonNote} style={[styles.smallAction, { backgroundColor: theme.blue }]}>
            <Text style={styles.smallActionText}>Добавить общую заметку</Text>
          </Pressable>

          <View style={{ gap: 10, marginTop: 14 }}>
            {commonNotes.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Общих заметок пока нет.</Text>
            ) : (
              commonNotes.map((note) => (
                <View
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                >
                  <Text style={[styles.noteAuthor, { color: theme.blue }]}>{note.authorName}</Text>
                  <Text style={[styles.noteText, { color: theme.text }]}>{note.text}</Text>
                  <Text style={[styles.noteMeta, { color: theme.textSecondary }]}>
                    {formatDate(note.createdAt)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>История смен</Text>

          {historyShifts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>История пока пуста.</Text>
          ) : (
            historyShifts.slice(0, 20).map((shift) => (
              <View key={`h-${shift.id}`} style={[styles.shiftRow, { borderBottomColor: theme.divider }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.shiftName, { color: theme.text }]}>
                    {shift.employee_name || fullNameOf(user)}
                  </Text>
                  <Text style={[styles.shiftMeta, { color: theme.textSecondary }]}>
                    {shift.date || '—'}
                  </Text>
                  <Text style={[styles.shiftMeta, { color: theme.textSecondary }]}>
                    {formatDate(shift.time_in)} → {shift.time_out ? formatDate(shift.time_out) : '—'}
                  </Text>
                </View>

                <Text style={[styles.hoursText, { color: theme.blue }]}>
                  {formatHours(shift.hours_worked)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '900' },
  container: { padding: 20, paddingBottom: 120, gap: 14 },

  hero: { borderWidth: 1, borderRadius: 24, padding: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  heroTitle: { fontSize: 18, fontWeight: '900' },
  heroSub: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 11, fontWeight: '900' },
  actionColumn: { marginTop: 16, gap: 10 },
  mainAction: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  mainActionText: { color: '#fff', fontWeight: '900', fontSize: 15, textAlign: 'center' },

  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14 },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  kpiLabel: { marginTop: 6, fontSize: 12, fontWeight: '700' },

  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardSub: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  helperText: { marginTop: 10, fontSize: 12, fontWeight: '600' },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '600' },

  shiftRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftName: { fontSize: 15, fontWeight: '800' },
  shiftMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  hoursText: { marginTop: 8, fontSize: 13, fontWeight: '900', textAlign: 'right' },

  inputWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  input: { fontSize: 15, fontWeight: '600' },

  reportGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reportField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  smallInputWrap: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  smallInput: { fontSize: 15, fontWeight: '700' },

  reportSummary: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportSummaryTitle: { fontSize: 14, fontWeight: '800' },
  reportSummaryValue: { fontSize: 18, fontWeight: '900' },

  smallAction: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  smallActionText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' },

  noteCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
  noteAuthor: { fontSize: 12, fontWeight: '900', marginBottom: 6 },
  noteText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  noteMeta: { marginTop: 8, fontSize: 11, fontWeight: '600' },
});
