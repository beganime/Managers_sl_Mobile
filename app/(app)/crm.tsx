import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../../components/AppScreen';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import { STORAGE_KEYS } from '../../src/config/app';
import { getClients } from '../../src/api/mobile';
import { useTheme } from '../../src/context/ThemeContext';

const PAGE_SIZE = 20;

export default function CrmScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getClients({ limit: 200, offset: 0 });
      setItems(res.items);
      await AsyncStorage.setItem(STORAGE_KEYS.cachedClients, JSON.stringify(res.items));
      setIsOffline(false);
    } catch {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.cachedClients);
      setItems(cached ? JSON.parse(cached) : []);
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
    if (!query) return items;
    return items.filter((item) =>
      [item.full_name, item.phone, item.email, item.city]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        <SectionHeader
          title="CRM"
          subtitle={isOffline ? 'Офлайн-режим: показан локальный кэш' : 'Клиентская база Students Life'}
          actionLabel="Добавить"
          onPress={() => router.push('/(app)/add-client')}
        />

        <PremiumCard>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по имени, телефону, email, городу"
            placeholderTextColor={theme.textMuted}
            style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}
          />
        </PremiumCard>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ gap: 12 }}
        >
          {pageItems.length ? pageItems.map((client) => (
            <TouchableOpacity key={client.id} onPress={() => router.push(`/(app)/client/${client.id}` as any)}>
              <PremiumCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>{client.full_name}</Text>
                    <Text style={{ color: theme.textSecondary, marginTop: 6 }}>{client.phone || 'Телефон не указан'}</Text>
                    <Text style={{ color: theme.textMuted, marginTop: 4 }}>{client.city || 'Город не указан'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.blue, fontWeight: '800' }}>{client.status || 'new'}</Text>
                    <Text style={{ color: theme.textMuted, marginTop: 8 }}>#{client.id}</Text>
                  </View>
                </View>
              </PremiumCard>
            </TouchableOpacity>
          )) : <EmptyState title="Клиентов не найдено" subtitle="Попробуй другой запрос или сначала синхронизируй базу." />}
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
