import { useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { getClientTimeline } from '../../api/crm';
import { extractItems } from '../../api/client';
import { ApiListItem } from '../../types';
import { Card } from '../../components/cards/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export function ClientTimelineScreen() {
  const appTheme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadTimeline = useCallback(async () => extractItems<ApiListItem>(await getClientTimeline(id)), [id]);
  const { data, loading, error, reload } = useAsyncResource(loadTimeline);

  return (
    <ScreenContainer scroll={false}>
      <Header title="Timeline клиента" subtitle="Активности, заметки и история клиента." showBack />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      <FlatList
        data={data || []}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        ListEmptyComponent={
          loading ? null : <EmptyState title="Истории пока нет" message="Новые активности появятся здесь." />
        }
        renderItem={({ item }) => (
          <Card style={styles.item}>
            <View style={[styles.dot, { backgroundColor: appTheme.colors.accent }]} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: appTheme.colors.text }]}>{String(item.activity_type_display || item.title || 'Событие')}</Text>
              <Text style={[styles.text, { color: appTheme.colors.textMuted }]}>{String(item.description || item.text || item.created_at || '')}</Text>
            </View>
          </Card>
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
  item: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: theme.colors.accent,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  text: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
