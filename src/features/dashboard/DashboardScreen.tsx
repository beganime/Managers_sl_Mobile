import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDashboardSummary } from '../../api/dashboard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatCard } from '../../components/cards/StatCard';
import { theme } from '../../theme/theme';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { formatWorkdayStatus, getUserDisplayName } from '../../utils/format';

export function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const loadDashboard = useCallback(() => getDashboardSummary(), []);
  const { data, loading, error, reload } = useAsyncResource(loadDashboard);

  if (loading && !data) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Готовим дашборд" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Дашборд" subtitle="Стартовая панель ManagerSL" />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Дашборд" subtitle="Стартовая панель ManagerSL" />
        <EmptyState title="Пока нет данных" message="После синхронизации здесь появятся показатели." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title={`Здравствуйте, ${getUserDisplayName(user)}`}
        subtitle="Короткая сводка по рабочему дню, CRM, задачам и финансам."
      />

      <Card style={styles.workday}>
        <Text style={styles.workdayLabel}>Рабочий день</Text>
        <Text style={styles.workdayStatus}>{formatWorkdayStatus(data.workday)}</Text>
      </Card>

      {data.warnings.length ? (
        <ErrorState
          title="Часть данных недоступна"
          message={data.warnings.slice(0, 2).join('\n')}
          actionTitle="Обновить"
          onAction={reload}
        />
      ) : null}

      <SectionTitle title="Статистика" subtitle="Данные собраны через новые /api/v1 endpoints." />

      <View style={styles.stats}>
        <StatCard label="Лиды" value={data.stats.leads} tone="primary" />
        <StatCard label="Клиенты" value={data.stats.clients} tone="accent" />
        <StatCard label="Задачи" value={data.stats.tasks} tone="warning" />
        <StatCard label="Сделки" value={data.stats.deals} tone="primary" />
      </View>

      <SectionTitle title="Быстрые действия" />

      <View style={styles.actions}>
        <Button title="Открыть CRM" variant="secondary" onPress={() => router.push('/(app)/(tabs)/crm' as any)} />
        <Button title="Задачи" variant="secondary" onPress={() => router.push('/(app)/(tabs)/tasks' as any)} />
        <Button title="Финансы" variant="secondary" onPress={() => router.push('/(app)/(tabs)/finance' as any)} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  workday: {
    gap: theme.spacing.sm,
  },
  workdayLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
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
    gap: theme.spacing.md,
  },
});
