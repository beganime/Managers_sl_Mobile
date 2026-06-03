import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { startWorkday } from '../../api/attendance';
import { extractItems, toApiError } from '../../api/client';
import { getDashboardSummary } from '../../api/dashboard';
import { listNotifications } from '../../api/notifications';
import { listProjectTasks } from '../../api/projects';
import { Card } from '../../components/cards/Card';
import { StatCard } from '../../components/cards/StatCard';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { ApiListItem, DashboardSummary } from '../../types';
import { formatWorkdayStatus, getItemTitle, getUserDisplayName, getUserPosition } from '../../utils/format';
import { ScreenContainer } from '../../components/layout/ScreenContainer';

type DashboardData = DashboardSummary & {
  todayTasks: ApiListItem[];
  notifications: ApiListItem[];
};

export function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [startingDay, setStartingDay] = useState(false);

  const loadDashboard = useCallback(async (): Promise<DashboardData> => {
    const [summary, tasks, notifications] = await Promise.all([
      getDashboardSummary(),
      listProjectTasks({ limit: 3 }).catch(() => []),
      listNotifications({ limit: 3 }).catch(() => []),
    ]);

    return {
      ...summary,
      todayTasks: extractItems<ApiListItem>(tasks),
      notifications: extractItems<ApiListItem>(notifications),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadDashboard);

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

  return (
    <ScreenContainer>
      <Header
        title="Главная"
        eyebrow="Students Life Program for Managers"
        subtitle="ManagerSL ERP/CRM workspace"
      />

      <LinearGradient
        colors={theme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroKicker}>Students Life Program for Managers</Text>
        <Text style={styles.heroTitle}>Здравствуйте, {getUserDisplayName(user)}</Text>
        <Text style={styles.heroPosition}>{getUserPosition(user)}</Text>
        <Text style={styles.heroText}>
          Рабочий день, CRM, задачи и уведомления собраны в одном мобильном кабинете.
        </Text>
      </LinearGradient>

      <Card glass style={styles.workday}>
        <View style={styles.workdayText}>
          <Text style={styles.workdayLabel}>Рабочий день</Text>
          <Text style={styles.workdayStatus}>{formatWorkdayStatus(data.workday)}</Text>
        </View>
        <Button title="Начать день" loading={startingDay} onPress={handleStartDay} />
      </Card>

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
        <QuickAction title="Добавить клиента" onPress={() => router.push('/(app)/crm/clients/create' as any)} />
        <QuickAction title="Добавить доход" onPress={() => router.push('/(app)/finance-v2/incomes/create' as any)} />
        <QuickAction title="Добавить задачу" onPress={() => router.push('/(app)/tasks-v2/create' as any)} />
        <QuickAction title="Мои отчёты" onPress={() => router.push('/(app)/reports-history' as any)} />
      </View>

      <SectionTitle title="Сегодня" subtitle="Календарь, задачи и рабочий день." />

      <Card style={styles.today}>
        <Text style={styles.todayTitle}>Календарные события</Text>
        <Text style={styles.todayText}>События появятся здесь после синхронизации календаря.</Text>
      </Card>

      <Card style={styles.today}>
        <Text style={styles.todayTitle}>Задачи</Text>
        {data.todayTasks.length ? (
          data.todayTasks.map((task) => (
            <Text key={String(task.id)} style={styles.todayText}>• {getItemTitle(task)}</Text>
          ))
        ) : (
          <Text style={styles.todayText}>На сегодня задач не найдено.</Text>
        )}
      </Card>

      <SectionTitle title="Уведомления" />
      <Card style={styles.today}>
        {data.notifications.length ? (
          data.notifications.map((notification) => (
            <Text key={String(notification.id)} style={styles.todayText}>
              • {getItemTitle(notification)}
            </Text>
          ))
        ) : (
          <Text style={styles.todayText}>Новых уведомлений нет.</Text>
        )}
      </Card>
    </ScreenContainer>
  );
}

function QuickAction({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
      <Text style={styles.quickText}>{title}</Text>
    </Pressable>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Header title="Главная" subtitle="ManagerSL ERP/CRM workspace" />
      <View style={styles.skeletonHero} />
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
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
  workday: {
    gap: theme.spacing.md,
  },
  workdayText: {
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
    flexGrow: 1,
    minWidth: 148,
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
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
