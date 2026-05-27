import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { listLeads } from '../../api/crm';
import { ApiListItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { CrmListCard, FilterChips, SearchInput } from './components';
import { leadStatuses } from './constants';

export function LeadListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listLeads({
        limit,
        offset,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
      }),
    [debouncedSearch, status]
  );

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  return (
    <ScreenContainer scroll={false}>
      <Header title="Лиды" subtitle="Поиск, статусы и конвертация в клиента." showBack />

      <View style={styles.tools}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Поиск по имени, телефону или email" />
        <FilterChips value={status} items={leadStatuses} onChange={setStatus} />
        <Button title="Создать лид" onPress={() => router.push('/(app)/crm/leads/create' as any)} />
      </View>

      {error && !items.length ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState title="Лиды не найдены" message="Попробуйте изменить поиск или фильтр." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.accent} /> : null}
        renderItem={({ item }) => (
          <CrmListCard
            item={item}
            type="lead"
            actionLabel="Карточка"
            onPress={() => router.push(`/(app)/crm/leads/${item.id}` as any)}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tools: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  list: {
    gap: theme.spacing.md,
    paddingBottom: 128,
  },
});
