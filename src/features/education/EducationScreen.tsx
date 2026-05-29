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

import { listPrograms, listUniversities } from '../../api/education';
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
  getStatusLabel,
} from '../../utils/entity';

const educationOptions = [
  { label: 'Вузы', value: 'universities' },
  { label: 'Программы', value: 'programs' },
];

export function EducationScreen() {
  const [mode, setMode] = useState('universities');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      {mode === 'universities' ? (
        <UniversityList mode={mode} onModeChange={setMode} />
      ) : (
        <ProgramList mode={mode} onModeChange={setMode} />
      )}
    </ScreenContainer>
  );
}

function UniversityList({
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
    ({ limit, offset }: { limit: number; offset: number }) =>
      listUniversities({
        limit,
        offset,
        search: debouncedSearch || undefined,
        is_active: true,
      }),
    [debouncedSearch]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderUniversity = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <UniversityCard
        item={item}
        onPress={() => router.push(`/(app)/education/universities/${getEntityId(item)}` as any)}
      />
    ),
    [router]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderUniversity}
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
            title="Вузы"
            eyebrow="Education"
            subtitle="Каталог стран, городов, университетов и программ."
            showBack
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>Students Life Program for Managers</Text>
            <Text style={styles.heroTitle}>Каталог для подбора обучения</Text>
            <Text style={styles.heroText}>Активных вузов: {count}. Данные идут из /api/v1/education/universities/.</Text>
          </Card>

          <SegmentedControl options={educationOptions} value={mode} onChange={onModeChange} />

          <Input
            label="Поиск"
            placeholder="Вуз, страна, город или описание"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем вузы" />
        ) : (
          <EmptyState title="Вузы не найдены" message="Попробуйте изменить поисковый запрос." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function ProgramList({
  mode,
  onModeChange,
}: {
  mode: string;
  onModeChange: (value: string) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [degree, setDegree] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listPrograms({
        limit,
        offset,
        search: debouncedSearch || undefined,
        degree: degree === 'all' ? undefined : degree,
        is_active: true,
      }),
    [debouncedSearch, degree]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderProgram = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <ProgramCard
        item={item}
        onPress={() => router.push(`/(app)/education/programs/${getEntityId(item)}` as any)}
      />
    ),
    [router]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderProgram}
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
            title="Программы"
            eyebrow="Education"
            subtitle="Направления, degrees, intakes и стоимость обучения."
            showBack
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>Programs</Text>
            <Text style={styles.heroTitle}>Программы для CRM-подбора</Text>
            <Text style={styles.heroText}>Найдено {count} программ из /api/v1/education/programs/.</Text>
          </Card>

          <SegmentedControl options={educationOptions} value={mode} onChange={onModeChange} />

          <Input
            label="Поиск"
            placeholder="Программа, факультет, вуз или страна"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <SectionTitle title="Степень" />
          <SegmentedControl
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Bachelor', value: 'bachelor' },
              { label: 'Master', value: 'master' },
              { label: 'PhD', value: 'phd' },
            ]}
            value={degree}
            onChange={setDegree}
          />

          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем программы" />
        ) : (
          <EmptyState title="Программы не найдены" message="Попробуйте изменить фильтры." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const UniversityCard = memo(function UniversityCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const city = getEntityString(item, ['city_name']);
  const country = getEntityString(item, ['country_name']);
  const active = getEntityString(item, ['is_active'], 'true') !== 'false';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Университет')}</Text>
            <Text style={styles.cardSubtitle}>{[city, country].filter(Boolean).join(', ') || 'Локация не указана'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={active ? 'Активен' : 'Неактивен'} tone={active ? 'success' : 'muted'} />
          <StatusPill label={`${getEntityNumber(item, ['programs_count'], 0)} программ`} tone="accent" />
        </View>
      </Card>
    </Pressable>
  );
});

const ProgramCard = memo(function ProgramCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const degree = getEntityString(item, ['degree_display', 'degree']);
  const university = getEntityString(item, ['university_name']);
  const country = getEntityString(item, ['country_name']);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Программа')}</Text>
            <Text style={styles.cardSubtitle}>{[university, country].filter(Boolean).join(' - ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={degree || 'Degree не указан'} tone="primary" />
          <StatusPill
            label={getStatusLabel(getEntityString(item, ['language'], 'language'))}
            tone="accent"
          />
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
    gap: theme.spacing.sm,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
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
