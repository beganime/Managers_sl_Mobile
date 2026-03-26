import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type TabKey = 'universities' | 'programs';
type SortKey = 'name' | 'price_asc' | 'price_desc';

function money(value: any, currency: string) {
  const num = parseFloat(String(value || 0));
  return `${num.toLocaleString('ru-RU')} ${currency || ''}`.trim();
}

export default function CatalogScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('universities');
  const [search, setSearch] = useState('');

  const [universities, setUniversities] = useState<any[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const cached = await getToken('cache_universities_full');
      if (cached) {
        setUniversities(JSON.parse(cached));
        setLoading(false);
      }

      const fullUniversities = await fetchAllPages('catalog/universities/');
      setUniversities(fullUniversities);
      await saveToken('cache_universities_full', JSON.stringify(fullUniversities));
    } catch (e) {
      console.log('Catalog load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allPrograms = useMemo(() => {
    const result: any[] = [];
    universities.forEach((uni) => {
      const programs = Array.isArray(uni.programs) ? uni.programs : [];
      programs.forEach((program: any) => {
        result.push({
          ...program,
          university: uni,
        });
      });
    });
    return result;
  }, [universities]);

  const countries = useMemo(() => {
    const list = Array.from(new Set(universities.map((u) => u.country).filter(Boolean)));
    return ['all', ...list];
  }, [universities]);

  const filteredUniversities = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = [...universities];

    if (countryFilter !== 'all') {
      data = data.filter((u) => u.country === countryFilter);
    }

    if (q) {
      data = data.filter(
        (u) =>
          String(u.name || '').toLowerCase().includes(q) ||
          String(u.city || '').toLowerCase().includes(q) ||
          String(u.country || '').toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return data;
  }, [universities, search, countryFilter]);

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = [...allPrograms];

    if (countryFilter !== 'all') {
      data = data.filter((p) => p.university?.country === countryFilter);
    }

    if (q) {
      data = data.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.university?.name || '').toLowerCase().includes(q) ||
          String(p.degree || '').toLowerCase().includes(q)
      );
    }

    if (maxPrice.trim()) {
      const limit = parseFloat(maxPrice);
      if (!Number.isNaN(limit)) {
        data = data.filter((p) => parseFloat(String(p.tuition_fee || 0)) <= limit);
      }
    }

    if (sortBy === 'name') {
      data.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    if (sortBy === 'price_asc') {
      data.sort((a, b) => parseFloat(String(a.tuition_fee || 0)) - parseFloat(String(b.tuition_fee || 0)));
    }
    if (sortBy === 'price_desc') {
      data.sort((a, b) => parseFloat(String(b.tuition_fee || 0)) - parseFloat(String(a.tuition_fee || 0)));
    }

    return data;
  }, [allPrograms, countryFilter, maxPrice, search, sortBy]);

  if (loading) {
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
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Каталог вузов</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Все вузы подгружаются в фоне и остаются в локальном кэше.
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
            style={[styles.tab, { backgroundColor: activeTab === 'universities' ? theme.surface : 'transparent', borderColor: activeTab === 'universities' ? theme.border : 'transparent' }]}
          >
            <Text style={{ color: activeTab === 'universities' ? theme.text : theme.textSecondary, fontWeight: '900' }}>Вузы</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('programs')}
            style={[styles.tab, { backgroundColor: activeTab === 'programs' ? theme.surface : 'transparent', borderColor: activeTab === 'programs' ? theme.border : 'transparent' }]}
          >
            <Text style={{ color: activeTab === 'programs' ? theme.text : theme.textSecondary, fontWeight: '900' }}>Программы</Text>
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

        {activeTab === 'programs' && (
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
        )}

        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {activeTab === 'universities'
            ? `Найдено вузов: ${filteredUniversities.length}`
            : `Найдено программ: ${filteredPrograms.length}`}
        </Text>

        <View style={{ gap: 12 }}>
          {activeTab === 'universities' &&
            filteredUniversities.map((uni) => (
              <Pressable
                key={uni.id}
                onPress={() => router.push(`/university/${uni.id}` as any)}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>{uni.name}</Text>
                <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                  {uni.city || 'Без города'} · {uni.country || 'Без страны'}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.blue }]}>
                  Программ: {Array.isArray(uni.programs) ? uni.programs.length : 0}
                </Text>
              </Pressable>
            ))}

          {activeTab === 'programs' &&
            filteredPrograms.map((program) => {
              const currency = program.currency?.code || program.university?.local_currency?.code || '';
              return (
                <View
                  key={`${program.university?.id}-${program.id}-${program.name}`}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{program.name}</Text>
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {program.university?.name || 'Без вуза'}
                  </Text>
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {program.degree || 'program'} · {program.duration || '—'}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Контракт</Text>
                    <Text style={[styles.priceValue, { color: theme.text }]}>
                      {money(program.tuition_fee, currency)}
                    </Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Услуги</Text>
                    <Text style={[styles.priceValue, { color: theme.red }]}>
                      {money(program.service_fee, currency)}
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
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
});