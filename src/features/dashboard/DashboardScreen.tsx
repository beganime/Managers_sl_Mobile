import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { closeWorkday, listDailyReports, listWorkdays, startWorkday, submitWorkdayReport } from '../../api/attendance';
import { extractItems, toApiError } from '../../api/client';
import { getDashboardSummary } from '../../api/dashboard';
import { listNotifications } from '../../api/notifications';
import { listProjectTasks } from '../../api/projects';
import { listUsers } from '../../api/users';
import { Card } from '../../components/cards/Card';
import { StatCard } from '../../components/cards/StatCard';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem, DashboardSummary, Workday } from '../../types';
import { formatEntityDate, getEntityId, getEntityString, getEntityValue } from '../../utils/entity';
import { formatWorkdayStatus, getItemTitle, getUserDisplayName, getUserPosition } from '../../utils/format';

type DashboardData = DashboardSummary & {
  todayTasks: ApiListItem[];
  notifications: ApiListItem[];
  reports: ApiListItem[];
  teamMembers: ApiListItem[];
  workdays: ApiListItem[];
};

type QuickTask = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  dueToday: boolean;
};

function isAdminUser(user: ReturnType<typeof useAuth>['user']) {
  return Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
}

function isWorkdayStarted(workday?: Workday | null) {
  const status = String(workday?.status || '').toLowerCase();
  return Boolean(workday?.started_at || ['open', 'started', 'active', 'in_progress'].includes(status));
}

function isWorkdayClosed(workday?: Workday | null) {
  const status = String(workday?.status || '').toLowerCase();
  return Boolean(workday?.closed_at || ['closed', 'finished', 'auto_closed', 'done'].includes(status));
}

function hasWorkdayReport(workday?: Workday | null) {
  const record = (workday || {}) as Record<string, unknown>;
  const reportText = getEntityString(record, ['report', 'report_text', 'daily_report', 'comment']);
  const reportStatus = String(record.report_status || record.has_report || record.report_submitted || '').toLowerCase();
  return Boolean(reportText || ['true', 'submitted', 'sent', 'done'].includes(reportStatus));
}

function getQuickTaskKey(userId?: number) {
  const today = new Date().toISOString().slice(0, 10);
  return `managersl.quickTasks.${userId || 'guest'}.${today}`;
}

function getNestedRecordValue(entity: ApiListItem, key: string, fields: string[]) {
  const nested = getEntityValue(entity, [key]);

  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return '';

  return getEntityString(nested as Record<string, unknown>, fields);
}

function getWorkdayEmployeeId(item: ApiListItem, fallback: string | number) {
  return (
    getEntityString(item, ['employee_id', 'user_id', 'manager_id', 'staff_id']) ||
    getNestedRecordValue(item, 'employee', ['id']) ||
    getNestedRecordValue(item, 'user', ['id']) ||
    fallback
  );
}

function getTeamMemberEmployeeId(item: ApiListItem, fallback: string | number) {
  return (
    getEntityString(item, ['user_id', 'employee_id', 'manager_id', 'staff_id', 'id']) ||
    getNestedRecordValue(item, 'user', ['id']) ||
    getNestedRecordValue(item, 'employee', ['id']) ||
    fallback
  );
}

function getWorkdayEmployeeName(item: ApiListItem) {
  return (
    getEntityString(item, ['employee_name', 'user_name', 'manager_name', 'full_name', 'name', 'email', 'username']) ||
    getNestedRecordValue(item, 'employee', ['full_name', 'name', 'email', 'username']) ||
    getNestedRecordValue(item, 'user', ['full_name', 'name', 'email', 'username']) ||
    'Сотрудник'
  );
}

function getWorkdayOffice(item: ApiListItem) {
  return (
    getEntityString(item, ['office_name', 'office_city', 'office', 'city']) ||
    getNestedRecordValue(item, 'office', ['city', 'name', 'address']) ||
    'Офис не указан'
  );
}

function getWorkdayStartedAt(item: ApiListItem) {
  return getEntityString(item, ['started_at', 'start_time', 'time_in', 'opened_at']);
}

function getWorkdayClosedAt(item: ApiListItem) {
  return getEntityString(item, ['closed_at', 'end_time', 'time_out', 'finished_at']);
}

function getWorkdayReportText(item: ApiListItem) {
  return getEntityString(item, ['report', 'report_text', 'daily_report', 'text', 'comment']);
}

function getWorkdayStatus(item: ApiListItem) {
  return getEntityString(item, ['status', 'workday_status', 'state']);
}

function buildDailyTip(data: DashboardData, admin: boolean, workday?: Workday | null) {
  const unreadCount = data.notifications.filter((item) => {
    const read = getEntityString(item, ['is_read']);
    return read !== 'true' && getEntityString(item, ['status']) !== 'read';
  }).length;

  if (admin) {
    if (data.reports.length === 0) {
      return 'Проверьте задачи, лиды и рабочие отчёты сотрудников.';
    }
    const reportsWithText = data.reports.filter((item) => getEntityString(item, ['report', 'report_text', 'daily_report']));
    if (reportsWithText.length < Math.max(1, Math.floor(data.reports.length / 2))) {
      return 'Несколько сотрудников не отправляют ежедневные отчёты. Рекомендуется напомнить им закрывать день.';
    }
    if (Number(data.stats.leads || 0) < 2) {
      return 'Сегодня мало новых лидов. Проверьте рекламу, сообщения и активность менеджеров.';
    }
    if (unreadCount > 0) {
      return 'Есть непрочитанные уведомления. Проверьте важные сообщения и распределите задачи.';
    }
    return 'Хорошая активность: команда регулярно обновляет рабочие статусы и задачи.';
  }

  if (!isWorkdayStarted(workday)) {
    return 'Поставьте напоминание на 08:00, чтобы не забывать начинать рабочий день.';
  }
  if (!hasWorkdayReport(workday) && isWorkdayStarted(workday) && !isWorkdayClosed(workday)) {
    return 'Поставьте напоминание на 17:00, чтобы отправлять ежедневный отчёт.';
  }
  if (Number(data.stats.leads || 0) < 2) {
    return 'Сегодня мало лидов. Проверьте рекламу, сообщения и follow-up.';
  }
  return 'Хорошая работа! Продолжайте вовремя отмечаться и закрывать задачи.';
}

export function DashboardScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [startingDay, setStartingDay] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
  const [quickTasksLoading, setQuickTasksLoading] = useState(true);

  const quickTaskKey = useMemo(() => getQuickTaskKey(user?.id), [user?.id]);

  const loadDashboard = useCallback(async (): Promise<DashboardData> => {
    const today = new Date().toISOString().slice(0, 10);
    const [summary, tasks, notifications, reports, workdays, teamMembers] = await Promise.all([
      getDashboardSummary(),
      listProjectTasks({ limit: 5 }).catch(() => []),
      listNotifications({ limit: 5 }).catch(() => []),
      listDailyReports({ limit: 50, date: today, date_from: today, date_to: today }).catch(() => []),
      listWorkdays({ limit: 80, date: today, date_from: today, date_to: today }).catch(() => []),
      isAdmin ? listUsers({ limit: 160 }).catch(() => []) : Promise.resolve([]),
    ]);

    return {
      ...summary,
      todayTasks: extractItems<ApiListItem>(tasks),
      notifications: extractItems<ApiListItem>(notifications),
      reports: extractItems<ApiListItem>(reports),
      teamMembers: extractItems<ApiListItem>(teamMembers),
      workdays: extractItems<ApiListItem>(workdays),
    };
  }, [isAdmin]);

  const { data, loading, error, reload } = useAsyncResource(loadDashboard);

  useEffect(() => {
    let mounted = true;

    const loadQuickTasks = async () => {
      setQuickTasksLoading(true);
      try {
        const stored = await AsyncStorage.getItem(quickTaskKey);
        if (mounted) setQuickTasks(stored ? JSON.parse(stored) : []);
      } catch {
        if (mounted) setQuickTasks([]);
      } finally {
        if (mounted) setQuickTasksLoading(false);
      }
    };

    void loadQuickTasks();

    return () => {
      mounted = false;
    };
  }, [quickTaskKey]);

  const saveQuickTasks = useCallback(
    async (next: QuickTask[]) => {
      setQuickTasks(next);
      await AsyncStorage.setItem(quickTaskKey, JSON.stringify(next));
    },
    [quickTaskKey]
  );

  const handleStartDay = async () => {
    setStartingDay(true);

    try {
      await startWorkday();
      await reload();
    } catch (requestError) {
      Alert.alert('Рабочий день', toApiError(requestError).message);
    } finally {
      setStartingDay(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportText.trim()) {
      Alert.alert('Отчёт', 'Напишите короткий отчёт за рабочий день.');
      return;
    }

    setSendingReport(true);

    try {
      await submitWorkdayReport({ report: reportText.trim(), text: reportText.trim() });
      setReportText('');
      await reload();
      Alert.alert('Отчёт', 'Отчёт отправлен.');
    } catch (requestError) {
      Alert.alert('Отчёт', toApiError(requestError).message);
    } finally {
      setSendingReport(false);
    }
  };

  const handleCloseDay = async () => {
    setClosingDay(true);

    try {
      await closeWorkday(reportText.trim() ? { report: reportText.trim(), text: reportText.trim() } : {});
      setReportText('');
      await reload();
    } catch (requestError) {
      Alert.alert('Рабочий день', toApiError(requestError).message);
    } finally {
      setClosingDay(false);
    }
  };

  const addQuickTask = async () => {
    const title = quickTaskTitle.trim();
    if (!title) return;

    const next = [
      {
        id: `${Date.now()}`,
        title,
        done: false,
        createdAt: new Date().toISOString(),
        dueToday: true,
      },
      ...quickTasks,
    ];

    setQuickTaskTitle('');
    await saveQuickTasks(next);
  };

  const toggleQuickTask = async (id: string) => {
    await saveQuickTasks(
      quickTasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    );
  };

  const deleteQuickTask = async (id: string) => {
    await saveQuickTasks(quickTasks.filter((task) => task.id !== id));
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <DashboardSkeleton />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Главная" subtitle="ManagerSL ERP/CRM workspace" />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Главная" subtitle="ManagerSL ERP/CRM workspace" />
        <EmptyState title="Пока нет данных" message="После синхронизации здесь появятся показатели кабинета." />
      </ScreenContainer>
    );
  }

  const dayTip = buildDailyTip(data, isAdmin, data.workday);

  return (
    <ScreenContainer>
      <Header
        title="Главная"
        eyebrow="Students Life Program for Managers"
        subtitle="ManagerSL ERP/CRM workspace"
      />

      <LinearGradient
        colors={appTheme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroKicker}>Students Life Program for Managers</Text>
        <Text style={styles.heroTitle}>Здравствуйте, {getUserDisplayName(user)}</Text>
        <Text style={styles.heroPosition}>{getUserPosition(user)}</Text>
        <Text style={styles.heroText}>
          Рабочий день, CRM, документы, задачи и уведомления собраны в одном мобильном кабинете ManagerSL.
        </Text>
      </LinearGradient>

      <Card glass style={styles.tipCard}>
        <View style={[styles.tipIcon, { backgroundColor: appTheme.colors.accentSoft }]}>
          <Ionicons name="sparkles-outline" size={20} color={appTheme.colors.accent} />
        </View>
        <View style={styles.tipBody}>
          <Text style={[styles.tipTitle, { color: appTheme.colors.text }]}>Совет дня</Text>
          <Text style={[styles.tipText, { color: appTheme.colors.textMuted }]}>{dayTip}</Text>
        </View>
      </Card>

      <WorkdayCard
        workday={data.workday}
        reportText={reportText}
        onReportTextChange={setReportText}
        onStart={handleStartDay}
        onSubmitReport={handleSubmitReport}
        onClose={handleCloseDay}
        onHistory={() => router.push('/(app)/reports-history' as any)}
        starting={startingDay}
        sendingReport={sendingReport}
        closing={closingDay}
      />

      {isAdmin ? (
        <AdminWorkdayTable
          reports={data.reports}
          teamMembers={data.teamMembers}
          workdays={data.workdays}
          onOpenReports={(employeeId, employeeName) =>
            router.push({
              pathname: '/(app)/reports-history',
              params: { employee: String(employeeId), name: employeeName },
            } as any)
          }
        />
      ) : null}

      {data.warnings.length ? (
        <ErrorState
          title="Часть данных недоступна"
          message={data.warnings.slice(0, 2).join('\n')}
          actionTitle="Обновить"
          onAction={reload}
        />
      ) : null}

      <SectionTitle title="Показатели" subtitle="Рабочая сводка по вашему кабинету." />

      <View style={styles.stats}>
        <StatCard label="Мои лиды" value={data.stats.leads} tone="accent" />
        <StatCard label="Мои клиенты" value={data.stats.clients} tone="primary" />
        <StatCard label="Мои задачи" value={data.stats.tasks} tone="warning" />
        <StatCard label="Рейтинг" value={data.stats.rating} tone="success" />
        <StatCard label="Баланс" value={data.stats.balance} tone="primary" />
      </View>

      <SectionTitle title="Быстрые действия" />

      <View style={styles.actions}>
        <QuickAction title="Добавить клиента" icon="person-add-outline" onPress={() => router.push('/(app)/crm/clients/create' as any)} />
        <QuickAction title="Добавить доход" icon="cash-outline" onPress={() => router.push('/(app)/finance-v2/incomes/create' as any)} />
        <QuickAction title="Добавить задачу" icon="add-circle-outline" onPress={() => router.push('/(app)/tasks-v2/create' as any)} />
        <QuickAction title="Мои отчёты" icon="reader-outline" onPress={() => router.push('/(app)/reports-history' as any)} />
      </View>

      <QuickLocalTasks
        loading={quickTasksLoading}
        tasks={quickTasks}
        title={quickTaskTitle}
        onTitleChange={setQuickTaskTitle}
        onAdd={addQuickTask}
        onToggle={toggleQuickTask}
        onDelete={deleteQuickTask}
      />

      <SectionTitle title="Сегодня" subtitle="Календарь, задачи и последние уведомления." />

      <Card glass style={styles.today}>
        <Text style={[styles.todayTitle, { color: appTheme.colors.text }]}>Задачи</Text>
        {data.todayTasks.length ? (
          data.todayTasks.map((task) => (
            <Text key={String(task.id)} style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
              • {getItemTitle(task)}
            </Text>
          ))
        ) : (
          <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>На сегодня задач не найдено.</Text>
        )}
      </Card>

      <Card glass style={styles.today}>
        <Text style={[styles.todayTitle, { color: appTheme.colors.text }]}>Уведомления</Text>
        {data.notifications.length ? (
          data.notifications.map((notification) => (
            <Text key={String(notification.id)} style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
              • {getItemTitle(notification)}
            </Text>
          ))
        ) : (
          <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>Новых уведомлений нет.</Text>
        )}
      </Card>
    </ScreenContainer>
  );
}

function WorkdayCard({
  workday,
  reportText,
  onReportTextChange,
  onStart,
  onSubmitReport,
  onClose,
  onHistory,
  starting,
  sendingReport,
  closing,
}: {
  workday: Workday | null;
  reportText: string;
  onReportTextChange: (value: string) => void;
  onStart: () => void;
  onSubmitReport: () => void;
  onClose: () => void;
  onHistory: () => void;
  starting: boolean;
  sendingReport: boolean;
  closing: boolean;
}) {
  const appTheme = useAppTheme();
  const started = isWorkdayStarted(workday);
  const closed = isWorkdayClosed(workday);
  const reportSent = hasWorkdayReport(workday);

  return (
    <Card glass style={styles.workday}>
      <View style={styles.workdayHeader}>
        <View style={styles.workdayText}>
          <Text style={[styles.workdayLabel, { color: appTheme.colors.textMuted }]}>Рабочий день</Text>
          <Text style={[styles.workdayStatus, { color: appTheme.colors.text }]}>{formatWorkdayStatus(workday)}</Text>
        </View>
        <StatusPill
          label={closed ? 'Закрыт' : started ? 'Открыт' : 'Не начат'}
          tone={closed ? 'muted' : started ? 'success' : 'warning'}
        />
      </View>

      {closed ? (
        <View style={[styles.reportSent, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color={appTheme.colors.primary} />
          <Text style={[styles.reportSentText, { color: appTheme.colors.primary }]}>Рабочий день закрыт</Text>
        </View>
      ) : null}

      {!started && !closed ? (
        <Button title="Начать день" loading={starting} onPress={onStart} />
      ) : null}

      {started && !closed && !reportSent ? (
        <>
          <Input
            label="Отчёт за день"
            placeholder="Коротко напишите, что сделано сегодня"
            value={reportText}
            onChangeText={onReportTextChange}
            multiline
            numberOfLines={4}
          />
          <View style={styles.workdayActions}>
            <Button title="Написать отчёт" loading={sendingReport} onPress={onSubmitReport} style={styles.flexButton} />
            <Button title="Закрыть день" variant="secondary" loading={closing} onPress={onClose} style={styles.flexButton} />
          </View>
        </>
      ) : null}

      {started && !closed && reportSent ? (
        <>
          <View style={[styles.reportSent, { backgroundColor: appTheme.colors.successSoft }]}>
            <Ionicons name="checkmark-done-outline" size={18} color={appTheme.colors.success} />
            <Text style={[styles.reportSentText, { color: appTheme.colors.success }]}>Отчёт отправлен</Text>
          </View>
          <Button title="Закрыть день" variant="secondary" loading={closing} onPress={onClose} />
        </>
      ) : null}

      <Button title="История отчётов" variant="ghost" onPress={onHistory} />
    </Card>
  );
}

function AdminWorkdayTable({
  reports,
  teamMembers,
  workdays,
  onOpenReports,
}: {
  reports: ApiListItem[];
  teamMembers: ApiListItem[];
  workdays: ApiListItem[];
  onOpenReports: (employeeId: string | number, employeeName: string) => void;
}) {
  const appTheme = useAppTheme();
  const rows = useMemo(() => {
    const map = new Map<string, ApiListItem>();

    teamMembers.forEach((member, index) => {
      const employeeId = getTeamMemberEmployeeId(member, `member-${index}`);
      const key = String(employeeId || getWorkdayEmployeeName(member));
      map.set(key, {
        ...member,
        employee_id: employeeId,
        employee_name: getWorkdayEmployeeName(member),
        office_name: getWorkdayOffice(member),
      });
    });

    workdays.forEach((workday, index) => {
      const employeeId = getWorkdayEmployeeId(workday, `workday-${index}`);
      const key = String(employeeId || getWorkdayEmployeeName(workday));
      const previous = map.get(key) || {};
      map.set(key, { ...previous, ...workday, employee_id: employeeId });
    });

    reports.forEach((report, index) => {
      const employeeId = getWorkdayEmployeeId(report, `report-${index}`);
      const key = String(employeeId || getWorkdayEmployeeName(report));
      const previous = map.get(key) || {};
      map.set(key, { ...previous, ...report, employee_id: employeeId });
    });

    return Array.from(map.values());
  }, [reports, teamMembers, workdays]);

  return (
    <Card glass style={styles.adminTable}>
      <View style={styles.tableTop}>
        <View>
          <Text style={[styles.todayTitle, { color: appTheme.colors.text }]}>Рабочий день сегодня</Text>
          <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
            Кто начал день, отправил отчёт и закрыл смену. Нажмите сотрудника, чтобы открыть историю.
          </Text>
        </View>
        <StatusPill label={`${rows.length} сотрудников`} tone="primary" />
      </View>

      {rows.length ? (
        rows.slice(0, 10).map((row, index) => {
          const employeeId = getWorkdayEmployeeId(row, getEntityId(row) || index);
          const employeeName = getWorkdayEmployeeName(row);
          const office = getWorkdayOffice(row);
          const reportText = getWorkdayReportText(row);
          const startedAt = getWorkdayStartedAt(row);
          const closedAt = getWorkdayClosedAt(row);
          const status = getWorkdayStatus(row);

          return (
            <Pressable
              key={`${employeeId}-${index}`}
              onPress={() => onOpenReports(employeeId, employeeName)}
              style={({ pressed }) => [
                styles.tableRow,
                { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceSoft },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.tableName}>
                <Text style={[styles.tableEmployee, { color: appTheme.colors.text }]}>{employeeName}</Text>
                <Text style={[styles.tableOffice, { color: appTheme.colors.textMuted }]}>{office}</Text>
              </View>
              <View style={styles.tablePills}>
                <StatusPill label={startedAt ? 'Начал' : 'Не начал'} tone={startedAt ? 'success' : 'warning'} />
                <StatusPill label={reportText ? 'Отчёт есть' : 'Без отчёта'} tone={reportText ? 'success' : 'muted'} />
                <StatusPill label={closedAt ? 'Закрыл' : 'Открыт'} tone={closedAt ? 'muted' : 'primary'} />
                {status ? <StatusPill label={status} tone="muted" /> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={appTheme.colors.textMuted} />
            </Pressable>
          );
        })
      ) : (
        <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
          Список сотрудников пока не загрузился. Потяните экран вниз, чтобы обновить данные.
        </Text>
      )}
    </Card>
  );
}

function QuickLocalTasks({
  loading,
  tasks,
  title,
  onTitleChange,
  onAdd,
  onToggle,
  onDelete,
}: {
  loading: boolean;
  tasks: QuickTask[];
  title: string;
  onTitleChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Card glass style={styles.quickTasks}>
      <View style={styles.tableTop}>
        <View>
          <Text style={[styles.todayTitle, { color: appTheme.colors.text }]}>Мои быстрые задачи</Text>
          <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
            Локальные задачи на сегодня сохраняются в кеше телефона.
          </Text>
        </View>
      </View>
      <View style={styles.quickTaskInputRow}>
        <View style={styles.quickTaskInput}>
          <Input label="Новая задача" placeholder="Например: позвонить клиенту" value={title} onChangeText={onTitleChange} />
        </View>
        <Pressable onPress={onAdd} style={[styles.addTaskButton, { backgroundColor: appTheme.colors.accent }]}>
          <Ionicons name="add" size={22} color={appTheme.colors.white} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={appTheme.colors.primary} />
      ) : tasks.length ? (
        tasks.map((task) => (
          <View key={task.id} style={[styles.quickTaskRow, { borderColor: appTheme.colors.border }]}>
            <Pressable onPress={() => onToggle(task.id)} style={styles.checkboxHit}>
              <Ionicons
                name={task.done ? 'checkbox' : 'square-outline'}
                size={22}
                color={task.done ? appTheme.colors.success : appTheme.colors.textMuted}
              />
            </Pressable>
            <View style={styles.quickTaskTextWrap}>
              <Text
                style={[
                  styles.quickTaskTitle,
                  { color: task.done ? appTheme.colors.textMuted : appTheme.colors.text },
                  task.done && styles.doneText,
                ]}
              >
                {task.title}
              </Text>
              <Text style={[styles.quickTaskDate, { color: appTheme.colors.textSoft }]}>
                {formatEntityDate(task.createdAt) || 'Сегодня'}
              </Text>
            </View>
            <Pressable onPress={() => onDelete(task.id)} style={styles.deleteTaskButton}>
              <Ionicons name="trash-outline" size={18} color={appTheme.colors.danger} />
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={[styles.todayText, { color: appTheme.colors.textMuted }]}>
          Быстрых задач пока нет. Добавьте короткое напоминание на сегодня.
        </Text>
      )}
    </Card>
  );
}

function QuickAction({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        {
          borderColor: appTheme.colors.border,
          backgroundColor: appTheme.colors.surfaceStrong,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={appTheme.colors.primary} />
      <Text style={[styles.quickText, { color: appTheme.colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

function DashboardSkeleton() {
  const appTheme = useAppTheme();

  return (
    <>
      <Header title="Главная" subtitle="ManagerSL ERP/CRM workspace" />
      <View style={[styles.skeletonHero, { backgroundColor: appTheme.colors.surfaceStrong }]} />
      <View style={styles.skeletonGrid}>
        <View style={[styles.skeletonCard, { backgroundColor: appTheme.colors.surfaceStrong }]} />
        <View style={[styles.skeletonCard, { backgroundColor: appTheme.colors.surfaceStrong }]} />
        <View style={[styles.skeletonCard, { backgroundColor: appTheme.colors.surfaceStrong }]} />
        <View style={[styles.skeletonCard, { backgroundColor: appTheme.colors.surfaceStrong }]} />
      </View>
      <LoadingState title="Синхронизируем кабинет" />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    ...theme.shadow.floating,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroPosition: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  heroText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  tipIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBody: {
    flex: 1,
    gap: 6,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  tipText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  workday: {
    gap: theme.spacing.md,
  },
  workdayHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  workdayText: {
    flex: 1,
    gap: 5,
  },
  workdayLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  workdayStatus: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  workdayActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  flexButton: {
    flex: 1,
    minWidth: 142,
  },
  reportSent: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  reportSentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  adminTable: {
    gap: theme.spacing.md,
  },
  tableTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  tableRow: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  tableName: {
    flex: 1,
    gap: 4,
    minWidth: 120,
  },
  tableEmployee: {
    fontSize: 14,
    fontWeight: '900',
  },
  tableOffice: {
    fontSize: 12,
    fontWeight: '700',
  },
  tablePills: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  quick: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: theme.spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 148,
    paddingHorizontal: theme.spacing.md,
  },
  quickText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  quickTasks: {
    gap: theme.spacing.md,
  },
  quickTaskInputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickTaskInput: {
    flex: 1,
  },
  addTaskButton: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  quickTaskRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  checkboxHit: {
    paddingVertical: theme.spacing.sm,
  },
  quickTaskTextWrap: {
    flex: 1,
    gap: 3,
  },
  quickTaskTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  quickTaskDate: {
    fontSize: 11,
    fontWeight: '800',
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
  deleteTaskButton: {
    padding: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
  today: {
    gap: theme.spacing.sm,
  },
  todayTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  todayText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  skeletonHero: {
    height: 164,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceStrong,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  skeletonCard: {
    flex: 1,
    minWidth: 142,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStrong,
  },
});
