import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listDailyReports, listWorkdayHistory } from '../../api/attendance';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusPill } from '../../components/ui/StatusPill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem, ApiParams } from '../../types';
import { formatEntityDate, getEntityId, getEntityNumber, getEntityString, stripHtml } from '../../utils/entity';

function isAdminUser(user: ReturnType<typeof useAuth>['user']) {
  return Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
}

function relativeReportDate(value: unknown) {
  if (!value) return 'Дата не указана';

  const source = String(value);
  const date = new Date(`${source}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatEntityDate(source) || source;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays === 2) return 'Позавчера';

  return formatEntityDate(source) || source;
}

export function ReportHistoryScreen() {
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ employee?: string; name?: string }>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const isAdmin = isAdminUser(user);
  const selectedEmployeeId = params.employee ? String(params.employee) : undefined;
  const employeeId = selectedEmployeeId || (!isAdmin && user?.id ? String(user.id) : undefined);
  const employeeName = params.name ? String(params.name) : '';

  const loader = useCallback(
    async ({ limit, offset }: { limit: number; offset: number }) => {
      const historyParams: ApiParams = {
        limit,
        offset,
        search: debouncedSearch || undefined,
      };

      if (employeeId) {
        historyParams.user_id = employeeId;
      }

      try {
        return await listWorkdayHistory(historyParams);
      } catch (requestError) {
        const apiError = toApiError(requestError);
        if (apiError.status !== 404) throw apiError;

        const reportParams: ApiParams = {
          limit,
          offset,
          search: debouncedSearch || undefined,
        };

        if (employeeId) {
          reportParams.employee = employeeId;
          reportParams.user = employeeId;
        }

        return listDailyReports(reportParams);
      }
    },
    [debouncedSearch, employeeId]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader, 50);

  const renderItem = useCallback(({ item }: { item: ApiListItem }) => <ReportCard item={item} />, []);

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getEntityId(item) || index)}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={appTheme.colors.primary}
            colors={[appTheme.colors.primary]}
            onRefresh={refresh}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Header
              title={employeeName ? `Отчёты: ${employeeName}` : isAdmin ? 'Все отчёты' : 'Мои отчёты'}
              subtitle={
                isAdmin && !employeeId
                  ? 'Полная история рабочих отчётов сотрудников.'
                  : 'История рабочих отчётов по дням.'
              }
              showBack
              parentFallback="/(app)/(tabs)/more"
            />

            <Card glass style={styles.hero}>
              <View style={[styles.heroIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Ionicons name="reader-outline" size={24} color={appTheme.colors.primary} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Отчёты всегда под рукой</Text>
                <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
                  Найдено {count} записей. Можно быстро открыть вчерашний, позавчерашний и более ранние отчёты.
                </Text>
              </View>
            </Card>

            <Input
              label="Поиск по отчётам"
              placeholder="Результаты, планы, проблемы"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />

            {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Загружаем отчёты" />
          ) : (
            <EmptyState
              title="Отчётов пока нет"
              message={
                isAdmin && !employeeId
                  ? 'Сервер не вернул рабочие отчёты сотрудников за выбранный период.'
                  : 'Когда рабочий отчёт будет отправлен, он появится здесь.'
              }
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const ReportCard = memo(function ReportCard({ item }: { item: ApiListItem }) {
  const appTheme = useAppTheme();
  const date = getEntityString(item, ['date']);
  const content = stripHtml(getEntityString(item, ['report_text', 'content', 'report', 'comment']));
  const results = stripHtml(getEntityString(item, ['results']));
  const plans = stripHtml(getEntityString(item, ['plans']));
  const problems = stripHtml(getEntityString(item, ['problems']));
  const startedAt = getEntityString(item, ['started_at', 'start_time', 'time_in']);
  const closedAt = getEntityString(item, ['closed_at', 'end_time', 'time_out']);
  const status = getEntityString(item, ['status_display', 'workday_status', 'status'], 'Отправлен');
  const leads = getEntityNumber(item, ['leads_processed'], 0);
  const deals = getEntityNumber(item, ['deals_closed'], 0);

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={[styles.cardDate, { color: appTheme.colors.text }]}>{relativeReportDate(date)}</Text>
          <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>{formatEntityDate(date) || getEntityString(item, ['submitted_at'])}</Text>
        </View>
        <StatusPill label={status} tone="success" />
      </View>

      <View style={styles.timeRow}>
        <StatusPill label={startedAt ? `Начало: ${startedAt}` : 'Начало не указано'} tone={startedAt ? 'primary' : 'muted'} />
        <StatusPill label={closedAt ? `Закрытие: ${closedAt}` : 'Не закрыт'} tone={closedAt ? 'success' : 'warning'} />
      </View>

      {content ? <ReportBlock title="Отчёт" value={content} /> : null}
      {results ? <ReportBlock title="Результаты" value={results} /> : null}
      {plans ? <ReportBlock title="Планы" value={plans} /> : null}
      {problems ? <ReportBlock title="Сложности" value={problems} /> : null}

      <View style={styles.metrics}>
        <Metric label="Лиды" value={leads} />
        <Metric label="Сделки" value={deals} />
      </View>
    </Card>
  );
});

function ReportBlock({ title, value }: { title: string; value: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.block}>
      <Text style={[styles.blockTitle, { color: appTheme.colors.textMuted }]}>{title}</Text>
      <Text style={[styles.blockText, { color: appTheme.colors.text }]}>{value}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.metric, { backgroundColor: appTheme.colors.primarySoft }]}>
      <Text style={[styles.metricValue, { color: appTheme.colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: appTheme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: 116,
  },
  headerStack: {
    gap: theme.spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  heroTextWrap: {
    flex: 1,
    gap: 5,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  card: {
    gap: theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  cardDate: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  block: {
    gap: 5,
  },
  blockTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  blockText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  metrics: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metric: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    padding: theme.spacing.md,
    gap: 3,
  },
  metricValue: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
});
