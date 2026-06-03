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

import { listProjects } from '../../api/projects';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
} from '../../utils/entity';
import {
  displayStatus,
  getProjectStatus,
  projectStatusOptions,
  projectStatusTone,
} from './projectHelpers';

export function ProjectsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listProjects({
        limit,
        offset,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      }),
    [debouncedSearch, status]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderProject = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <ProjectRow
        item={item}
        onPress={() => router.push(`/(app)/projects-v2/${getEntityId(item)}` as any)}
      />
    ),
    [router]
  );

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getEntityId(item) || index)}
        renderItem={renderProject}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            onRefresh={refresh}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Header
              title="Проекты"
              subtitle="Проектный контур ManagerSL: статусы, сроки, прогресс и задачи."
              showBack
              parentFallback="/(app)/(tabs)/tasks"
            />

            <Card glass style={styles.hero}>
              <Text style={styles.heroKicker}>Projects v2</Text>
              <Text style={styles.heroTitle}>Все проекты в одном списке</Text>
              <Text style={styles.heroText}>Сейчас доступно {count} проектов.</Text>
              <Button title="Новый проект" onPress={() => router.push('/(app)/projects-v2/create' as any)} />
            </Card>

            <Input
              label="Поиск"
              placeholder="Название, код или описание"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />

            <SectionTitle title="Статус" />
            <SegmentedControl options={projectStatusOptions} value={status} onChange={setStatus} />

            {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Загружаем проекты" />
          ) : (
            <EmptyState title="Проекты не найдены" message="Измените фильтры или создайте новый проект." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const ProjectRow = memo(function ProjectRow({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const status = getProjectStatus(item);
  const progress = getEntityNumber(item, ['progress_percent'], 0);
  const deadline = formatEntityDate(item.deadline);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Проект')}</Text>
            <Text style={styles.cardSubtitle}>
              {getEntityString(item, ['code'], 'Без кода')} - {deadline || 'без срока'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayStatus(status, getEntityString(item, ['status_display']))}
            tone={projectStatusTone(status)}
          />
          <StatusPill label={`${progress}%`} tone="accent" />
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
    fontSize: 22,
    fontWeight: '900',
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
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
