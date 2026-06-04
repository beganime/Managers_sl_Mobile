import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  listDeals,
  listExpenses,
  listIncomes,
  listTransactions,
} from '../../api/finance';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatusPill } from '../../components/ui/StatusPill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityId,
  getEntityString,
  getEntityTitle,
} from '../../utils/entity';
import {
  dealStatusOptions,
  displayFinanceStatus,
  financeSections,
  financeStatusTone,
  getMoneyAmount,
  getUsdAmount,
  incomeStatusOptions,
} from './financeHelpers';

export function FinanceScreen() {
  const [section, setSection] = useState('incomes');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <FinanceList section={section} onSectionChange={setSection} />
    </ScreenContainer>
  );
}

function FinanceList({
  section,
  onSectionChange,
}: {
  section: string;
  onSectionChange: (value: string) => void;
}) {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) => {
      const params = {
        limit,
        offset,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      };

      if (section === 'expenses') return listExpenses(params);
      if (section === 'deals') return listDeals(params);
      if (section === 'transactions') return listTransactions(params);
      return listIncomes(params);
    },
    [debouncedSearch, section, status]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderItem = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <FinanceCard
        item={item}
        section={section}
        onPress={() => router.push(`/(app)/finance-v2/${section}/${getEntityId(item)}` as any)}
      />
    ),
    [router, section]
  );

  const statusOptions = section === 'deals' ? dealStatusOptions : incomeStatusOptions;

  return (
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
            title="Финансы"
            eyebrow="Финансовая страничка"
            subtitle="Доходы, расходы, сделки и транзакции."
          />

          <Card glass style={styles.hero}>
            <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>ManagerSL finance</Text>
            <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Деньги под контролем</Text>
            <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
              В текущем разделе найдено {count} записей. Списки работают через pagination, search и pull-to-refresh.
            </Text>
            <View style={styles.heroActions}>
              <Button
                title="Добавить доход"
                onPress={() => router.push('/(app)/finance-v2/incomes/create' as any)}
              />
              <Button
                title="Добавить расход"
                variant="secondary"
                onPress={() => router.push('/(app)/finance-v2/expenses/create' as any)}
              />
            </View>
          </Card>

          <SegmentedControl options={financeSections} value={section} onChange={onSectionChange} />

          <Input
            label="Поиск"
            placeholder="Название, клиент, сделка, комментарий"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {section !== 'transactions' ? (
            <>
              <SectionTitle title="Статус" />
              <SegmentedControl options={statusOptions} value={status} onChange={setStatus} />
            </>
          ) : null}

          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем финансы" />
        ) : (
          <EmptyState
            title="Записи не найдены"
            message="Измените фильтр или создайте новую финансовую запись."
          />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const FinanceCard = memo(function FinanceCard({
  item,
  section,
  onPress,
}: {
  item: ApiListItem;
  section: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const statusKey =
    section === 'deals'
      ? getEntityString(item, ['payment_status'], 'new')
      : section === 'transactions'
        ? getEntityString(item, ['transaction_type'], 'transaction')
        : getEntityString(item, ['status'], getEntityString(item, ['is_confirmed']) === 'true' ? 'confirmed' : 'pending');

  const subtitle = [
    getEntityString(item, ['client_name']),
    getEntityString(item, ['deal_title']),
    getEntityString(item, ['service_title']),
    getEntityString(item, ['cashbox_name']),
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{getEntityTitle(item, 'Финансовая запись')}</Text>
            <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>{subtitle || formatEntityDate(item.date || item.created_at) || 'Без деталей'}</Text>
          </View>
          <Text style={[styles.amount, { color: appTheme.colors.accent }]}>{getMoneyAmount(item)}</Text>
          <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayFinanceStatus(item, ['status', 'payment_status', 'transaction_type'])}
            tone={financeStatusTone(statusKey)}
          />
          <StatusPill label={getUsdAmount(item)} tone="primary" />
          <StatusPill label={formatEntityDate(item.date || item.payment_date || item.created_at) || 'Без даты'} tone="muted" />
        </View>
      </Card>
    </Pressable>
  );
});

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
    gap: theme.spacing.md,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 29,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  itemCard: {
    gap: theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  amount: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '900',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
});
