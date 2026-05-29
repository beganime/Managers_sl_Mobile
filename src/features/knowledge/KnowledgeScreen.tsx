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

import { listKnowledgeArticles, listKnowledgeCategories } from '../../api/knowledge';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
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
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';

const knowledgeOptions = [
  { label: 'Статьи', value: 'articles' },
  { label: 'Категории', value: 'categories' },
];

export function KnowledgeScreen() {
  const [mode, setMode] = useState('articles');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <KnowledgeList mode={mode} onModeChange={setMode} />
    </ScreenContainer>
  );
}

function KnowledgeList({
  mode,
  onModeChange,
}: {
  mode: string;
  onModeChange: (value: string) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) => {
      const params = {
        limit,
        offset,
        search: debouncedSearch || undefined,
      };

      if (mode === 'categories') return listKnowledgeCategories(params);
      return listKnowledgeArticles(params);
    },
    [debouncedSearch, mode]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderItem = useCallback(
    ({ item }: { item: ApiListItem }) => {
      if (mode === 'categories') return <CategoryCard item={item} />;

      return (
        <ArticleCard
          item={item}
          onPress={() => router.push(`/(app)/knowledge/articles/${getEntityId(item)}` as any)}
        />
      );
    },
    [mode, router]
  );

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
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <Header
            title="База знаний"
            eyebrow="Knowledge"
            subtitle="Категории и статьи из /api/v1/knowledge/."
            showBack
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>ManagerSL knowledge base</Text>
            <Text style={styles.heroTitle}>Ответы, регламенты и инструкции рядом</Text>
            <Text style={styles.heroText}>
              В разделе {count} записей. Используется подтверждённый endpoint /api/v1/knowledge/categories/.
            </Text>
          </Card>

          <SegmentedControl options={knowledgeOptions} value={mode} onChange={onModeChange} />

          <Input
            label="Поиск"
            placeholder="Название, содержание, теги или категория"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <SectionTitle title={mode === 'articles' ? 'Статьи' : 'Категории'} />
          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем базу знаний" />
        ) : (
          <EmptyState title="Записи не найдены" message="Попробуйте изменить поиск." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const ArticleCard = memo(function ArticleCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Статья')}</Text>
            <Text style={styles.cardSubtitle}>
              {stripHtml(getEntityString(item, ['summary', 'content'], 'Описание не заполнено'))}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={getEntityString(item, ['category_name'], 'Без категории')} tone="primary" />
          <StatusPill label={getEntityString(item, ['status_display', 'status'], 'Статус не указан')} tone="accent" />
          <StatusPill label={`${getEntityNumber(item, ['views_count'], 0)} просмотров`} tone="muted" />
        </View>
      </Card>
    </Pressable>
  );
});

const CategoryCard = memo(function CategoryCard({ item }: { item: ApiListItem }) {
  return (
    <Card style={styles.itemCard}>
      <Text style={styles.cardTitle}>{getEntityTitle(item, 'Категория')}</Text>
      <Text style={styles.cardSubtitle}>
        {stripHtml(getEntityString(item, ['description'])) || getEntityString(item, ['parent_name'], 'Корневая категория')}
      </Text>
      <View style={styles.pills}>
        <StatusPill label={`${getEntityNumber(item, ['articles_count'], 0)} статей`} tone="accent" />
        <StatusPill label={getEntityString(item, ['code'], 'без кода')} tone="primary" />
      </View>
    </Card>
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
    gap: theme.spacing.sm,
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
    lineHeight: 28,
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
    lineHeight: 21,
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
