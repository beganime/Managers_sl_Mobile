import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../../components/AppScreen';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import { STORAGE_KEYS } from '../../src/config/app';
import { getUniversities } from '../../src/api/mobile';
import { useTheme } from '../../src/context/ThemeContext';

const PAGE_SIZE = 15;

export default function CatalogScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [universities, setUniversities] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getUniversities({ limit: 300, offset: 0 });
      setUniversities(res.items);
      await AsyncStorage.setItem(STORAGE_KEYS.cachedUniversities, JSON.stringify(res.items));
      setIsOffline(false);
    } catch {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.cachedUniversities);
      setUniversities(cached ? JSON.parse(cached) : []);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return universities;
    return universities.filter((uni) => [uni.name, uni.city, uni.country].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [search, universities]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <AppScreen scroll={false} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.blue} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <View style={{ gap: 16 }}>
        <SectionHeader title="Вузы" subtitle={isOffline ? 'Данные из локального кэша' : 'Каталог направлений и университетов'} />

        <PremiumCard>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по вузу, городу, стране"
            placeholderTextColor={theme.textMuted}
            style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}
          />
        </PremiumCard>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {pageItems.length ? pageItems.map((uni) => (
            <TouchableOpacity key={uni.id} onPress={() => router.push(`/(app)/university/${uni.id}` as any)}>
              <PremiumCard>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>{uni.name}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 6 }}>{[uni.city, uni.country].filter(Boolean).join(', ') || 'Локация не указана'}</Text>
                {uni.description ? <Text numberOfLines={2} style={{ color: theme.textMuted, marginTop: 8 }}>{uni.description}</Text> : null}
              </PremiumCard>
            </TouchableOpacity>
          )) : <EmptyState title="Каталог пуст" subtitle="Сначала синхронизируй данные с сервером." />}
        </ScrollView>

        <PremiumCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity disabled={safePage <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              <Text style={{ color: safePage <= 1 ? theme.textMuted : theme.blue, fontWeight: '800' }}>Назад</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.text, fontWeight: '800' }}>Страница {safePage} / {totalPages}</Text>
            <TouchableOpacity disabled={safePage >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <Text style={{ color: safePage >= totalPages ? theme.textMuted : theme.blue, fontWeight: '800' }}>Вперёд</Text>
            </TouchableOpacity>
          </View>
        </PremiumCard>
      </View>
    </AppScreen>
  );
}
