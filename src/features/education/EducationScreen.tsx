import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { extractItems, toApiError } from '../../api/client';
import { listCities, listCountries, listPrograms, listUniversities } from '../../api/education';
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
import { ApiListItem, EntityId } from '../../types';
import {
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  getStatusLabel,
  stripHtml,
} from '../../utils/entity';

type EducationMode = 'countries' | 'cities' | 'universities' | 'programs';

type FilterState = {
  selectedCountry?: EntityId;
  selectedCity?: EntityId;
};

const educationOptions = [
  { label: 'Страны', value: 'countries' },
  { label: 'Города', value: 'cities' },
  { label: 'Вузы', value: 'universities' },
  { label: 'Программы', value: 'programs' },
];

export function EducationScreen() {
  const [mode, setMode] = useState<EducationMode>('countries');
  const [filters, setFilters] = useState<FilterState>({});
  const filterOptions = useEducationFilterOptions(filters.selectedCountry);

  const updateMode = useCallback((value: string) => {
    setMode(value as EducationMode);
  }, []);

  const selectCountry = useCallback((countryId?: EntityId) => {
    setFilters({ selectedCountry: countryId, selectedCity: undefined });
  }, []);

  const selectCity = useCallback((cityId?: EntityId) => {
    setFilters((current) => ({ ...current, selectedCity: cityId }));
  }, []);

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      {mode === 'countries' ? (
        <CountryList
          filterOptions={filterOptions}
          mode={mode}
          onModeChange={updateMode}
          onSelectCountry={(countryId) => {
            selectCountry(countryId);
            setMode('cities');
          }}
        />
      ) : null}

      {mode === 'cities' ? (
        <CityList
          filterOptions={filterOptions}
          filters={filters}
          mode={mode}
          onModeChange={updateMode}
          onSelectCity={(cityId) => {
            selectCity(cityId);
            setMode('universities');
          }}
          onSelectCountry={selectCountry}
        />
      ) : null}

      {mode === 'universities' ? (
        <UniversityList
          filterOptions={filterOptions}
          filters={filters}
          mode={mode}
          onModeChange={updateMode}
          onSelectCity={selectCity}
          onSelectCountry={selectCountry}
        />
      ) : null}

      {mode === 'programs' ? (
        <ProgramList
          filterOptions={filterOptions}
          filters={filters}
          mode={mode}
          onModeChange={updateMode}
          onSelectCountry={selectCountry}
        />
      ) : null}
    </ScreenContainer>
  );
}

function useEducationFilterOptions(selectedCountry?: EntityId) {
  const [countries, setCountries] = useState<ApiListItem[]>([]);
  const [cities, setCities] = useState<ApiListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCountries = useCallback(async () => {
    const payload = await listCountries({ limit: 120, offset: 0, is_active: true });
    setCountries(extractItems<ApiListItem>(payload));
  }, []);

  const loadCities = useCallback(async () => {
    const payload = await listCities({
      limit: 180,
      offset: 0,
      country: selectedCountry,
      is_active: true,
    });
    setCities(extractItems<ApiListItem>(payload));
  }, [selectedCountry]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadCountries(), loadCities()]);
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }, [loadCities, loadCountries]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    countries,
    cities,
    loading,
    error,
    reload,
  };
}

type FilterOptions = ReturnType<typeof useEducationFilterOptions>;

function CountryList({
  filterOptions,
  mode,
  onModeChange,
  onSelectCountry,
}: {
  filterOptions: FilterOptions;
  mode: EducationMode;
  onModeChange: (value: string) => void;
  onSelectCountry: (countryId?: EntityId) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listCountries({
        limit,
        offset,
        search: debouncedSearch || undefined,
        is_active: true,
      }),
    [debouncedSearch]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderCountry = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <CountryCard item={item} onPress={() => onSelectCountry(getEntityId(item))} />
    ),
    [onSelectCountry]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderCountry}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          onRefresh={() => {
            void filterOptions.reload();
            refresh();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <CatalogHeader
            count={count}
            endpoint="/api/v1/education/countries/"
            mode={mode}
            subtitle="Страны, города, университеты и программы из backend education."
            title="Каталог обучения"
            onModeChange={onModeChange}
          />

          <Input
            label="Поиск"
            placeholder="Страна, код или описание"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем страны" />
        ) : (
          <EmptyState title="Страны не найдены" message="Добавьте страны в backend admin или измените поиск." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function CityList({
  filterOptions,
  filters,
  mode,
  onModeChange,
  onSelectCity,
  onSelectCountry,
}: {
  filterOptions: FilterOptions;
  filters: FilterState;
  mode: EducationMode;
  onModeChange: (value: string) => void;
  onSelectCity: (cityId?: EntityId) => void;
  onSelectCountry: (countryId?: EntityId) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listCities({
        limit,
        offset,
        search: debouncedSearch || undefined,
        country: filters.selectedCountry,
        is_active: true,
      }),
    [debouncedSearch, filters.selectedCountry]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderCity = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <CityCard item={item} onPress={() => onSelectCity(getEntityId(item))} />
    ),
    [onSelectCity]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderCity}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          onRefresh={() => {
            void filterOptions.reload();
            refresh();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <CatalogHeader
            count={count}
            endpoint="/api/v1/education/cities/"
            mode={mode}
            subtitle="Города фильтруются по стране и сразу используются в каталоге вузов."
            title="Города обучения"
            onModeChange={onModeChange}
          />

          <FilterRail
            items={filterOptions.countries}
            label="Страна"
            selectedId={filters.selectedCountry}
            allTitle="Все страны"
            onSelect={onSelectCountry}
          />

          <Input
            label="Поиск"
            placeholder="Город или страна"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {filterOptions.error ? <ErrorState message={filterOptions.error} actionTitle="Обновить фильтры" onAction={filterOptions.reload} /> : null}
          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем города" />
        ) : (
          <EmptyState title="Города не найдены" message="Добавьте города в backend admin или выберите другую страну." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function UniversityList({
  filterOptions,
  filters,
  mode,
  onModeChange,
  onSelectCity,
  onSelectCountry,
}: {
  filterOptions: FilterOptions;
  filters: FilterState;
  mode: EducationMode;
  onModeChange: (value: string) => void;
  onSelectCity: (cityId?: EntityId) => void;
  onSelectCountry: (countryId?: EntityId) => void;
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
        country: filters.selectedCountry,
        city: filters.selectedCity,
        is_active: true,
      }),
    [debouncedSearch, filters.selectedCity, filters.selectedCountry]
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
          onRefresh={() => {
            void filterOptions.reload();
            refresh();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <CatalogHeader
            count={count}
            endpoint="/api/v1/education/universities/"
            mode={mode}
            subtitle="Вузы показываются по выбранной стране и городу из backend education."
            title="Вузы"
            onModeChange={onModeChange}
          />

          <FilterRail
            items={filterOptions.countries}
            label="Страна"
            selectedId={filters.selectedCountry}
            allTitle="Все страны"
            onSelect={onSelectCountry}
          />
          <FilterRail
            items={filterOptions.cities}
            label="Город"
            selectedId={filters.selectedCity}
            allTitle="Все города"
            onSelect={onSelectCity}
          />

          <Input
            label="Поиск"
            placeholder="Вуз, страна, город или описание"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {filterOptions.error ? <ErrorState message={filterOptions.error} actionTitle="Обновить фильтры" onAction={filterOptions.reload} /> : null}
          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем вузы" />
        ) : (
          <EmptyState title="Вузы не найдены" message="Попробуйте изменить страну, город или поисковый запрос." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function ProgramList({
  filterOptions,
  filters,
  mode,
  onModeChange,
  onSelectCountry,
}: {
  filterOptions: FilterOptions;
  filters: FilterState;
  mode: EducationMode;
  onModeChange: (value: string) => void;
  onSelectCountry: (countryId?: EntityId) => void;
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
        country: filters.selectedCountry,
        degree: degree === 'all' ? undefined : degree,
        is_active: true,
      }),
    [debouncedSearch, degree, filters.selectedCountry]
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
          onRefresh={() => {
            void filterOptions.reload();
            refresh();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <CatalogHeader
            count={count}
            endpoint="/api/v1/education/programs/"
            mode={mode}
            subtitle="Программы, fees, intakes и документы идут из backend education."
            title="Программы"
            onModeChange={onModeChange}
          />

          <FilterRail
            items={filterOptions.countries}
            label="Страна"
            selectedId={filters.selectedCountry}
            allTitle="Все страны"
            onSelect={onSelectCountry}
          />

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

          {filterOptions.error ? <ErrorState message={filterOptions.error} actionTitle="Обновить фильтры" onAction={filterOptions.reload} /> : null}
          {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем программы" />
        ) : (
          <EmptyState title="Программы не найдены" message="Попробуйте изменить страну, degree или поиск." />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function CatalogHeader({
  count,
  endpoint,
  mode,
  subtitle,
  title,
  onModeChange,
}: {
  count: number;
  endpoint: string;
  mode: EducationMode;
  subtitle: string;
  title: string;
  onModeChange: (value: string) => void;
}) {
  return (
    <>
      <Header title={title} eyebrow="Education" subtitle={subtitle} showBack />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>Students Life Program for Managers</Text>
        <Text style={styles.heroTitle}>Каталог для подбора обучения</Text>
        <Text style={styles.heroText}>
          Найдено записей: {count}. Данные идут из {endpoint}.
        </Text>
      </Card>

      <SegmentedControl options={educationOptions} value={mode} onChange={onModeChange} />
    </>
  );
}

function FilterRail({
  allTitle,
  items,
  label,
  selectedId,
  onSelect,
}: {
  allTitle: string;
  items: ApiListItem[];
  label: string;
  selectedId?: EntityId;
  onSelect: (id?: EntityId) => void;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        <FilterChip active={!selectedId} title={allTitle} onPress={() => onSelect(undefined)} />
        {items.map((item) => {
          const id = getEntityId(item);

          return (
            <FilterChip
              key={String(id)}
              active={Boolean(selectedId && id && String(selectedId) === String(id))}
              title={getEntityTitle(item, 'Фильтр')}
              subtitle={getEntityString(item, ['country_name', 'code'])}
              onPress={() => onSelect(id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  active,
  subtitle,
  title,
  onPress,
}: {
  active: boolean;
  subtitle?: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.filterChipSub, active && styles.filterChipSubActive]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const CountryCard = memo(function CountryCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const code = getEntityString(item, ['code']);
  const description = stripHtml(getEntityString(item, ['description']));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.iconBubble}>
            <Ionicons name="flag-outline" size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Страна')}</Text>
            <Text style={styles.cardSubtitle}>{description || 'Описание страны пока не заполнено.'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={code || 'Код не указан'} tone="primary" />
          <StatusPill label="Открыть города" tone="accent" />
        </View>
      </Card>
    </Pressable>
  );
});

const CityCard = memo(function CityCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const country = getEntityString(item, ['country_name']);
  const description = stripHtml(getEntityString(item, ['description']));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.iconBubble}>
            <Ionicons name="business-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Город')}</Text>
            <Text style={styles.cardSubtitle}>{[country, description].filter(Boolean).join(' - ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={styles.pills}>
          <StatusPill label={country || 'Страна не указана'} tone="primary" />
          <StatusPill label="Открыть вузы" tone="accent" />
        </View>
      </Card>
    </Pressable>
  );
});

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
          <View style={styles.iconBubble}>
            <Ionicons name="school-outline" size={20} color={theme.colors.accent} />
          </View>
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
          <View style={styles.iconBubble}>
            <Ionicons name="library-outline" size={20} color={theme.colors.primary} />
          </View>
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
  filterBlock: {
    gap: theme.spacing.sm,
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  filterRail: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  filterChip: {
    minWidth: 104,
    maxWidth: 190,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 3,
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterChipSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipSubActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  itemCard: {
    gap: theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
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
