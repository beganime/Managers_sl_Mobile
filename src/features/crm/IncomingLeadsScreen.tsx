import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { listLeads } from '../../api/crm';
import { ApiListItem } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { usePagedResource } from '../../hooks/usePagedResource';
import { CrmListCard } from './components';

export function IncomingLeadsScreen() {
  const router = useRouter();
  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listLeads({ limit, offset, status: 'new' }),
    []
  );
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const showOwnershipInfo = () => {
    Alert.alert(
      'Скоро будет доступно',
      'Backend endpoint для действия "Взять ответственность" пока не подключён: POST /api/v1/crm/leads/{id}/take/.'
    );
  };

  return (
    <ScreenContainer scroll={false}>
      <Header
        title="Входящие"
        subtitle="Новые потенциальные клиенты. Действие ответственности задокументировано для backend."
        showBack
      />

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
          loading ? null : <EmptyState title="Входящих заявок нет" message="Новые лиды появятся здесь." />
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.accent} /> : null}
        renderItem={({ item }) => (
          <CrmListCard
            item={item}
            type="lead"
            actionLabel="Взять"
            onPress={() => {
              if (item.manager || item.manager_name) {
                router.push(`/(app)/crm/leads/${item.id}` as any);
              } else {
                showOwnershipInfo();
              }
            }}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.md,
    paddingBottom: 128,
  },
});
