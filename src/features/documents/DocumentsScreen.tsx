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
  listDocumentApprovals,
  listDocumentTemplates,
  listGeneratedDocuments,
} from '../../api/documents';
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
  formatEntityDate,
  getEntityId,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';
import {
  displayDocumentStatus,
  documentSections,
  documentStatusOptions,
  documentStatusTone,
} from './documentHelpers';

export function DocumentsScreen() {
  const [section, setSection] = useState('templates');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <DocumentList section={section} onSectionChange={setSection} />
    </ScreenContainer>
  );
}

function DocumentList({
  section,
  onSectionChange,
}: {
  section: string;
  onSectionChange: (value: string) => void;
}) {
  const router = useRouter();
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

      if (section === 'generated') return listGeneratedDocuments(params);
      if (section === 'approvals') return listDocumentApprovals(params);
      return listDocumentTemplates({ ...params, is_active: true });
    },
    [debouncedSearch, section, status]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderItem = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <DocumentCard
        item={item}
        section={section}
        onPress={() => router.push(`/(app)/documents-v2/${section}/${getEntityId(item)}` as any)}
      />
    ),
    [router, section]
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
            title="Документы"
            eyebrow="Sprint 4"
            subtitle="Шаблоны, генерация, согласования и ссылки на файлы."
            showBack
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>ERP documents</Text>
            <Text style={styles.heroTitle}>Документы без ручной рутины</Text>
            <Text style={styles.heroText}>
              В текущем разделе {count} записей. Генерация работает через подтверждённый `/api/v1/documents/templates/{'{id}'}/generate/`.
            </Text>
          </Card>

          <SegmentedControl options={documentSections} value={section} onChange={onSectionChange} />

          <Input
            label="Поиск"
            placeholder="Название, клиент, шаблон или сделка"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {section !== 'templates' ? (
            <>
              <SectionTitle title="Статус" />
              <SegmentedControl options={documentStatusOptions} value={status} onChange={setStatus} />
            </>
          ) : null}

          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем документы" />
        ) : (
          <EmptyState title="Записи не найдены" message="Измените поиск или фильтр." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const DocumentCard = memo(function DocumentCard({
  item,
  section,
  onPress,
}: {
  item: ApiListItem;
  section: string;
  onPress: () => void;
}) {
  const status = getEntityString(item, ['status'], section === 'templates' ? 'active' : 'draft');
  const subtitle =
    section === 'templates'
      ? stripHtml(getEntityString(item, ['description'], 'Шаблон документа'))
      : [getEntityString(item, ['template_name', 'document_title']), getEntityString(item, ['client_name'])]
          .filter(Boolean)
          .join(' - ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Документ')}</Text>
            <Text style={styles.cardSubtitle}>{subtitle || 'Без описания'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill
            label={displayDocumentStatus(status, getEntityString(item, ['status_display']))}
            tone={documentStatusTone(status)}
          />
          <StatusPill label={formatEntityDate(item.created_at) || 'Без даты'} tone="muted" />
          {getEntityString(item, ['requires_approval']) === 'true' ? (
            <StatusPill label="Нужно согласование" tone="warning" />
          ) : null}
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
});
