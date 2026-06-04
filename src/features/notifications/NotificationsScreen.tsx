import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { toApiError } from '../../api/client';
import { listNotifications, markAllNotificationsRead } from '../../api/notifications';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
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
  stripHtml,
} from '../../utils/entity';

const notificationFilters = [
  { label: 'Все', value: 'all' },
  { label: 'Новые', value: 'unread' },
  { label: 'Прочитано', value: 'read' },
];

function notificationTone(item: ApiListItem) {
  const priority = getEntityString(item, ['priority']);
  const status = getEntityString(item, ['status']);

  if (priority === 'urgent' || priority === 'high') return 'danger';
  if (status === 'read' || getEntityString(item, ['is_read']) === 'true') return 'muted';
  return 'accent';
}

export function NotificationsScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listNotifications({
        limit,
        offset,
        search: debouncedSearch || undefined,
        unread: filter === 'unread' ? true : filter === 'read' ? false : undefined,
      }),
    [debouncedSearch, filter]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const markAllRead = async () => {
    setMarkingAll(true);

    try {
      const result = await markAllNotificationsRead();
      await refresh();
      Alert.alert('Уведомления', `Прочитано: ${result.updated || 0}`);
    } catch (requestError) {
      Alert.alert('Уведомления', toApiError(requestError).message);
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <NotificationCard
        item={item}
        onPress={() => router.push(`/(app)/notifications/${getEntityId(item)}` as any)}
      />
    ),
    [router]
  );

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
              title="Уведомления"
              eyebrow="Уведомления и события"
              subtitle="Лента событий, unread-фильтр и отметка прочтения."
              showBack
            />

            <Card glass style={styles.hero}>
              <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>ERP notifications</Text>
              <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Важное не теряется</Text>
              <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
                В текущей ленте {count} уведомлений. Pull-to-refresh и mark-read подключены.
              </Text>
              <Button
                title="Прочитать всё"
                variant="secondary"
                loading={markingAll}
                onPress={markAllRead}
              />
            </Card>

            <SegmentedControl options={notificationFilters} value={filter} onChange={setFilter} />

            <Input
              label="Поиск"
              placeholder="Заголовок, текст или отправитель"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />

            {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Загружаем уведомления" />
          ) : (
            <EmptyState title="Уведомлений нет" message="Когда появятся события, они будут здесь." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const NotificationCard = memo(function NotificationCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const isRead = getEntityString(item, ['is_read']) === 'true' || getEntityString(item, ['status']) === 'read';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card
        style={[
          styles.itemCard,
          !isRead && { borderColor: appTheme.colors.accentSoft },
        ]}
      >
        <View style={styles.cardTop}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isRead ? appTheme.colors.primarySoft : appTheme.colors.accentSoft },
            ]}
          >
            <Ionicons
              name={isRead ? 'mail-open-outline' : 'mail-unread-outline'}
              size={20}
              color={isRead ? appTheme.colors.textMuted : appTheme.colors.accent}
            />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{getEntityTitle(item, 'Уведомление')}</Text>
            <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>
              {stripHtml(getEntityString(item, ['body', 'message', 'text'])) || 'Без текста'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={getEntityString(item, ['type_display', 'notification_type'], 'Событие')} tone={notificationTone(item)} />
          <StatusPill label={getEntityString(item, ['priority_display', 'priority'], 'Обычный')} tone="primary" />
          <StatusPill label={formatEntityDate(item.created_at) || 'Без даты'} tone="muted" />
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
  itemCard: {
    gap: theme.spacing.md,
  },
  unreadCard: {
    borderColor: theme.colors.accentSoft,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  iconUnread: {
    backgroundColor: theme.colors.accentSoft,
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
});
