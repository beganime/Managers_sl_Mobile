import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type TabKey = 'universities' | 'programs';
type SortKey = 'name' | 'price_asc' | 'price_desc';

function money(value: any, currency: string) {
  const num = parseFloat(String(value || 0));
  return `${num.toLocaleString('ru-RU')} ${currency || ''}`.trim();
}

function extractPagePayload(data: any) {
  if (Array.isArray(data)) {
    return {
      results: data,
      next: null,
      previous: null,
      count: data.length,
    };
  }

  return {
    results: Array.isArray(data?.results) ? data.results : [],
    next: data?.next || null,
    previous: data?.previous || null,
    count: Number(data?.count || 0),
  };
}

export default function CatalogScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>('universities');
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const [universities, setUniversities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>(['all']);

  const [uniPage, setUniPage] = useState(1);
  const [uniHasNext, setUniHasNext] = useState(true);
  const [uniLoading, setUniLoading] = useState(true);
  const [uniRefreshing, setUniRefreshing] = useState(false);
  const [uniLoadingMore, setUniLoadingMore] = useState(false);
  const [uniCount, setUniCount] = useState(0);

  const [programPage, setProgramPage] = useState(1);
  const [programHasNext, setProgramHasNext] = useState(true);
  const [programLoading, setProgramLoading] = useState(false);
  const [programRefreshing, setProgramRefreshing] = useState(false);
  const [programLoadingMore, setProgramLoadingMore] = useState(false);
  const [programCount, setProgramCount] = useState(0);

  const loadCountries = useCallback(async () => {
    try {
      const response = await apiClient.get('catalog/universities/?page=1&page_size=1000');
      const payload = extractPagePayload(response.data);
      const list = Array.from(
        new Set(payload.results.map((u: any) => u.country).filter(Boolean))
      ).map(String).sort((a, b) => a.localeCompare(b));
      setCountries(['all', ...list]);
    } catch (e) {
      console.log('Countries load error', e);
      setCountries(['all']);
    }
  }, []);

  const loadUniversities = useCallback(
    async (page = 1, replace = false) => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', '12');
      if (search.trim()) params.append('search', search.trim());
      if (countryFilter !== 'all') params.append('country', countryFilter);

      const response = await apiClient.get(`catalog/universities/?${params.toString()}`);
      const payload = extractPagePayload(response.data);

      setUniversities((prev) => (replace ? payload.results : [...prev, ...payload.results]));
      setUniPage(page);
      setUniHasNext(Boolean(payload.next));
      setUniCount(payload.count);
    },
    [search, countryFilter]
  );

  const loadPrograms = useCallback(
    async (page = 1, replace = false) => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', '20');
      if (search.trim()) params.append('search', search.trim());
      if (countryFilter !== 'all') params.append('country', countryFilter);
      if (maxPrice.trim()) params.append('max_price', maxPrice.trim());
      if (sortBy) params.append('sort', sortBy);

      const response = await apiClient.get(`catalog/programs/?${params.toString()}`);
      const payload = extractPagePayload(response.data);

      setPrograms((prev) => (replace ? payload.results : [...prev, ...payload.results]));
      setProgramPage(page);
      setProgramHasNext(Boolean(payload.next));
      setProgramCount(payload.count);
    },
    [search, countryFilter, maxPrice, sortBy]
  );

  const initialLoad = useCallback(async () => {
    setUniLoading(true);
    try {
      await Promise.all([
        loadCountries(),
        loadUniversities(1, true),
      ]);
    } catch (e) {
      console.log('Catalog initial load error', e);
    } finally {
      setUniLoading(false);
    }
  }, [loadCountries, loadUniversities]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  useEffect(() => {
    const reloadUniversities = async () => {
      setUniLoading(true);
      try {
        await loadUniversities(1, true);
      } finally {
        setUniLoading(false);
      }
    };

    reloadUniversities();
  }, [loadUniversities]);

  useEffect(() => {
    if (activeTab !== 'programs') return;

    const reloadPrograms = async () => {
      setProgramLoading(true);
      try {
        await loadPrograms(1, true);
      } finally {
        setProgramLoading(false);
      }
    };

    reloadPrograms();
  }, [activeTab, loadPrograms]);

  const refreshUniversities = async () => {
    setUniRefreshing(true);
    try {
      await Promise.all([loadCountries(), loadUniversities(1, true)]);
    } finally {
      setUniRefreshing(false);
    }
  };

  const refreshPrograms = async () => {
    setProgramRefreshing(true);
    try {
      await loadPrograms(1, true);
    } finally {
      setProgramRefreshing(false);
    }
  };

  const loadMoreUniversities = async () => {
    if (!uniHasNext || uniLoadingMore || uniLoading) return;
    setUniLoadingMore(true);
    try {
      await loadUniversities(uniPage + 1, false);
    } finally {
      setUniLoadingMore(false);
    }
  };

  const loadMorePrograms = async () => {
    if (!programHasNext || programLoadingMore || programLoading) return;
    setProgramLoadingMore(true);
    try {
      await loadPrograms(programPage + 1, false);
    } finally {
      setProgramLoadingMore(false);
    }
  };

  const activeCount = useMemo(() => {
    return activeTab === 'universities' ? uniCount : programCount;
  }, [activeTab, uniCount, programCount]);

  const renderUniversity = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => router.push(`/university/${item.id}` as any)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
        {item.city || 'Без города'} · {item.country || 'Без страны'}
      </Text>
      <Text style={[styles.cardMeta, { color: theme.blue }]}>
        Программ: {item.programs_count || 0}
      </Text>
    </Pressable>
  );

  const renderProgram = ({ item }: { item: any }) => {
    const currency = item.currency?.code || '';
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
          {item.university_name || 'Без вуза'}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
          {item.degree || 'program'} · {item.duration || '—'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Контракт</Text>
          <Text style={[styles.priceValue, { color: theme.text }]}>
            {money(item.tuition_fee, currency)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Услуги</Text>
          <Text style={[styles.priceValue, { color: theme.red }]}>
            {money(item.service_fee, '$')}
          </Text>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View>
      <Text style={[styles.title, { color: theme.text }]}>Каталог вузов</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        Быстрый каталог с серверной пагинацией
      </Text>

      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={activeTab === 'universities' ? 'Поиск по вузам' : 'Поиск по программам'}
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.backgroundSoft }]}>
        <Pressable
          onPress={() => setActiveTab('universities')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'universities' ? theme.surface : 'transparent',
              borderColor: activeTab === 'universities' ? theme.border : 'transparent',
            },
          ]}
        >
          <Text style={{ color: activeTab === 'universities' ? theme.text : theme.textSecondary, fontWeight: '900' }}>
            Вузы
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('programs')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'programs' ? theme.surface : 'transparent',
              borderColor: activeTab === 'programs' ? theme.border : 'transparent',
            },
          ]}
        >
          <Text style={{ color: activeTab === 'programs' ? theme.text : theme.textSecondary, fontWeight: '900' }}>
            Программы
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.section, { color: theme.text }]}>Фильтр по стране</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={styles.chipsRow}>
          {countries.map((country) => {
            const active = countryFilter === country;
            return (
              <Pressable
                key={country}
                onPress={() => setCountryFilter(country)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.blue : theme.surface,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                  {country === 'all' ? 'Все страны' : country}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {activeTab === 'programs' ? (
        <>
          <Text style={[styles.section, { color: theme.text }]}>Цена и сортировка</Text>

          <View style={styles.filtersRow}>
            <View style={[styles.smallInputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="Макс. цена"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                style={[styles.smallInput, { color: theme.text }]}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
                {[
                  { key: 'name', label: 'По названию' },
                  { key: 'price_asc', label: 'Цена ↑' },
                  { key: 'price_desc', label: 'Цена ↓' },
                ].map((s) => {
                  const active = sortBy === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => setSortBy(s.key as SortKey)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.red : theme.surface,
                          borderColor: active ? theme.red : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </>
      ) : null}

      <Text style={[styles.count, { color: theme.textSecondary }]}>
        {activeTab === 'universities'
          ? `Найдено вузов: ${activeCount}`
          : `Найдено программ: ${activeCount}`}
      </Text>
    </View>
  );

  const loading = activeTab === 'universities' ? uniLoading : programLoading;
  const refreshing = activeTab === 'universities' ? uniRefreshing : programRefreshing;
  const loadingMore = activeTab === 'universities' ? uniLoadingMore : programLoadingMore;

  if (loading && (activeTab === 'universities' ? universities.length === 0 : programs.length === 0)) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {activeTab === 'universities' ? (
        <FlatList
          data={universities}
          keyExtractor={(item) => `uni-${item.id}`}
          renderItem={renderUniversity}
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.blue} />
              </View>
            ) : <View style={{ height: 120 }} />
          }
          contentContainerStyle={styles.listContainer}
          onEndReached={loadMoreUniversities}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshUniversities} tintColor={theme.blue} />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(item) => `program-${item.id}`}
          renderItem={renderProgram}
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.blue} />
              </View>
            ) : <View style={{ height: 120 }} />
          }
          contentContainerStyle={styles.listContainer}
          onEndReached={loadMorePrograms}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshPrograms} tintColor={theme.blue} />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 20, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  searchBox: { marginTop: 18, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  searchInput: { fontSize: 15, fontWeight: '600' },
  tabs: { marginTop: 14, borderRadius: 18, padding: 4, flexDirection: 'row', gap: 4 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  section: { fontSize: 16, fontWeight: '900', marginTop: 18, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  filtersRow: { gap: 10 },
  smallInputWrap: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  smallInput: { fontSize: 14, fontWeight: '600' },
  count: { marginTop: 14, marginBottom: 12, fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  priceRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13, fontWeight: '700' },
  priceValue: { fontSize: 14, fontWeight: '900' },
  footerLoader: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
});
