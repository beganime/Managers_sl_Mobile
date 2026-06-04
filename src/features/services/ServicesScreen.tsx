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

import { listServiceCategories, listServicePrices, listServices } from '../../api/services';
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
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityId,
  getEntityString,
  getEntityTitle,
  getStatusLabel,
} from '../../utils/entity';

const serviceOptions = [
  { label: 'Услуги', value: 'services' },
  { label: 'Категории', value: 'categories' },
  { label: 'Цены', value: 'prices' },
];

export function ServicesScreen() {
  const [mode, setMode] = useState('services');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <ServiceList mode={mode} onModeChange={setMode} />
    </ScreenContainer>
  );
}

function ServiceList({
  mode,
  onModeChange,
}: {
  mode: string;
  onModeChange: (value: string) => void;
}) {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) => {
      const params = {
        limit,
        offset,
        search: debouncedSearch || undefined,
        is_active: true,
      };

      if (mode === 'categories') return listServiceCategories(params);
      if (mode === 'prices') return listServicePrices(params);
      return listServices(params);
    },
    [debouncedSearch, mode]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderItem = useCallback(
    ({ item }: { item: ApiListItem }) => {
      if (mode === 'services') {
        return (
          <ServiceCard
            item={item}
            onPress={() => router.push(`/(app)/services-v2/${getEntityId(item)}` as any)}
          />
        );
      }

      if (mode === 'prices') return <PriceCard item={item} />;

      return <CategoryCard item={item} />;
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
          tintColor={appTheme.colors.primary}
          colors={[appTheme.colors.primary]}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <Header
            title="Услуги"
            eyebrow="Services"
            subtitle="Категории, услуги и прайс-листы ManagerSL."
            showBack
          />

          <Card glass style={styles.hero}>
            <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>ERP services</Text>
            <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Сервисный каталог для сделок</Text>
            <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>В текущем разделе найдено {count} записей.</Text>
          </Card>

          <SegmentedControl options={serviceOptions} value={mode} onChange={onModeChange} />

          <Input
            label="Поиск"
            placeholder="Название, код, категория или валюта"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <SectionTitle title={serviceOptions.find((option) => option.value === mode)?.label || 'Каталог'} />
          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем услуги" />
        ) : (
          <EmptyState title="Записи не найдены" message="Попробуйте изменить поиск или открыть другой раздел." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const ServiceCard = memo(function ServiceCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const active = getEntityString(item, ['is_active'], 'true') !== 'false';
  const publicLabel = getEntityString(item, ['is_public'], 'false') === 'true' ? 'Публичная' : 'Внутренняя';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{getEntityTitle(item, 'Услуга')}</Text>
            <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>
              {[getEntityString(item, ['category_name']), getEntityString(item, ['code'])].filter(Boolean).join(' - ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={active ? 'Активна' : 'Неактивна'} tone={active ? 'success' : 'muted'} />
          <StatusPill label={publicLabel} tone="accent" />
          <StatusPill label={getEntityString(item, ['currency_code'], 'валюта не указана')} tone="primary" />
        </View>
      </Card>
    </Pressable>
  );
});

const CategoryCard = memo(function CategoryCard({ item }: { item: ApiListItem }) {
  const appTheme = useAppTheme();

  return (
    <Card style={styles.itemCard}>
      <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{getEntityTitle(item, 'Категория')}</Text>
      <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>{getEntityString(item, ['description'], 'Описание не заполнено')}</Text>
      <View style={styles.pills}>
        <StatusPill label={getEntityString(item, ['code'], 'без кода')} tone="primary" />
        <StatusPill
          label={getStatusLabel(getEntityString(item, ['is_active'], 'active'))}
          tone="accent"
        />
      </View>
    </Card>
  );
});

const PriceCard = memo(function PriceCard({ item }: { item: ApiListItem }) {
  const appTheme = useAppTheme();

  return (
    <Card style={styles.itemCard}>
      <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{getEntityString(item, ['service_title'], 'Цена услуги')}</Text>
      <Text style={[styles.price, { color: appTheme.colors.accent }]}>
        {[getEntityString(item, ['price', 'amount']), getEntityString(item, ['currency_code', 'currency_symbol'])]
          .filter(Boolean)
          .join(' ')}
      </Text>
      <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>
        {[
          getEntityString(item, ['price_type', 'title']),
          formatEntityDate(item.valid_from),
          formatEntityDate(item.valid_to),
        ]
          .filter(Boolean)
          .join(' - ')}
      </Text>
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
  price: {
    color: theme.colors.accent,
    fontSize: 20,
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
