import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { listClients } from '../../api/crm';
import { ApiListItem, AppUser } from '../../types';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { useAuth } from '../../store/auth';
import { getEntityString, getEntityValue } from '../../utils/entity';
import { clientStatuses } from './constants';
import { CrmListCard, FilterChips, SearchInput } from './components';

function isAdminUser(user: AppUser | null) {
  return Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
}

function getNestedId(item: ApiListItem, key: string) {
  const value = getEntityValue(item, [key]);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return getEntityString(value as Record<string, unknown>, ['id', 'pk']);
}

function getClientManagerId(item: ApiListItem) {
  return (
    getEntityString(item, ['manager_id', 'responsible_id', 'owner_id', 'created_by_id', 'assigned_to_id']) ||
    getNestedId(item, 'manager') ||
    getNestedId(item, 'responsible') ||
    getNestedId(item, 'owner') ||
    getNestedId(item, 'assigned_to')
  );
}

function isSharedWithUser(item: ApiListItem, userId: number) {
  const shared = getEntityValue(item, ['shared_with', 'shared_users', 'watchers']);
  if (!Array.isArray(shared)) return false;

  return shared.some((entry) => {
    if (typeof entry === 'number' || typeof entry === 'string') return String(entry) === String(userId);
    if (entry && typeof entry === 'object') {
      return getEntityString(entry as Record<string, unknown>, ['id', 'pk']) === String(userId);
    }
    return false;
  });
}

function isClientVisibleForManager(item: ApiListItem, userId?: number) {
  if (!userId) return true;
  if (isSharedWithUser(item, userId)) return true;

  const managerId = getClientManagerId(item);
  return managerId ? String(managerId) === String(userId) : true;
}

export function ClientListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) => {
      if (isAdmin) return Promise.resolve([]);

      return listClients({
        limit,
        offset,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
      });
    },
    [debouncedSearch, isAdmin, status]
  );

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);
  const visibleItems = useMemo(
    () => (isAdmin ? [] : items.filter((item) => isClientVisibleForManager(item, user?.id))),
    [isAdmin, items, user?.id]
  );

  return (
    <ScreenContainer scroll={false}>
      <Header title="Клиенты" subtitle="База клиентов ManagerSL." showBack />

      {!isAdmin ? (
        <View style={styles.tools}>
          <SearchInput value={search} onChangeText={setSearch} placeholder="Поиск по ФИО, телефону или email" />
          <FilterChips value={status} items={clientStatuses} onChange={setStatus} />
          <Button title="Создать клиента" onPress={() => router.push('/(app)/crm/clients/create' as any)} />
        </View>
      ) : null}

      {error && !items.length ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}

      <FlatList
        data={visibleItems}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title={isAdmin ? 'Клиенты скрыты для администратора' : 'Клиенты не найдены'}
              message={
                isAdmin
                  ? 'Этот мобильный раздел показывает личную базу менеджера. Администратор управляет клиентами через web cabinet.'
                  : 'Попробуйте изменить поиск или фильтр.'
              }
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.accent} /> : null}
        renderItem={({ item }) => (
          <CrmListCard
            item={item}
            type="client"
            actionLabel="Карточка"
            onPress={() => router.push(`/(app)/crm/clients/${item.id}` as any)}
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
