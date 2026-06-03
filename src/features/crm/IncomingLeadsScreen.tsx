import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet } from 'react-native';

import { listIncomingLeads, takeLead } from '../../api/crm';
import { toApiError } from '../../api/client';
import { ApiListItem } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { usePagedResource } from '../../hooks/usePagedResource';
import { getEntityId } from '../../utils/entity';
import { CrmListCard } from './components';

export function IncomingLeadsScreen() {
  const router = useRouter();
  const [takingId, setTakingId] = useState<string | null>(null);
  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listIncomingLeads({ limit, offset, ownership: 'free' }),
    []
  );
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const handleTake = async (item: ApiListItem) => {
    const id = getEntityId(item);
    if (!id) return;

    if (item.manager || item.manager_name) {
      router.push(`/(app)/crm/leads/${id}` as any);
      return;
    }

    setTakingId(String(id));

    try {
      await takeLead(id);
      Alert.alert('Входящая заявка', 'Ответственность взята.');
      refresh();
    } catch (requestError) {
      Alert.alert('Входящая заявка', toApiError(requestError).message);
    } finally {
      setTakingId(null);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <Header
        title="Входящие"
        subtitle="Свободные потенциальные клиенты, которых можно взять в работу."
        showBack
        parentFallback="/(app)/(tabs)/crm"
      />

      {error && !items.length ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getEntityId(item) || index)}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : <EmptyState title="Входящих заявок нет" message="Свободные лиды появятся здесь." />
        }
        ListFooterComponent={loadingMore || takingId ? <ActivityIndicator color={theme.colors.accent} /> : null}
        renderItem={({ item }) => (
          <CrmListCard
            item={item}
            type="lead"
            actionLabel={item.manager || item.manager_name ? 'Открыть' : takingId === String(getEntityId(item)) ? 'Берём...' : 'Взять'}
            onPress={() => {
              void handleTake(item);
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
