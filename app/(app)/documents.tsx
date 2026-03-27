import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type DocumentItem = {
  id: number;
  title?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  file?: string;
  file_url?: string;
  document_url?: string;
  pdf?: string;
  client?: number;
  client_data?: { full_name?: string };
};

export default function DocumentsScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchAllPages('documents/generated/');
      setDocuments(data as DocumentItem[]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить документы.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((item) => {
      if (!q) return true;
      return (
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.client_data?.full_name || '').toLowerCase().includes(q) ||
        String(item.status || '').toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [documents, search]);

  const openFile = async (item: DocumentItem) => {
    const url = item.file_url || item.document_url || item.file || item.pdf;
    if (!url) {
      Alert.alert('Файл', 'У этого документа нет URL.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть файл.');
    }
  };

  const updateStatus = async (item: DocumentItem, status: 'approved' | 'rejected') => {
    try {
      try {
        await apiClient.patch(`documents/generated/${item.id}/`, { status });
      } catch {
        await apiClient.post(`documents/generated/${item.id}/${status === 'approved' ? 'approve' : 'reject'}/`, {});
      }

      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось обновить статус документа.');
    }
  };

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
        <Text style={[styles.title, { color: theme.text }]}>Документы</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {isAdmin ? 'Подтверждение документов с мобилки' : 'Просмотр документов'}
        </Text>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по документам"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={{ gap: 12, marginTop: 16 }}>
          {filtered.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>Документы не найдены.</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <View
                key={item.id}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {item.title || `Документ #${item.id}`}
                </Text>

                <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                  Клиент: {item.client_data?.full_name || `#${item.client || '-'}`}
                </Text>

                <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                  Статус: {item.status || 'unknown'}
                </Text>

                <View style={styles.actionsRow}>
                  <Pressable onPress={() => openFile(item)} style={[styles.ghostBtn, { borderColor: theme.border }]}>
                    <Text style={[styles.ghostBtnText, { color: theme.text }]}>Открыть</Text>
                  </Pressable>

                  {isAdmin && (
                    <>
                      <Pressable onPress={() => updateStatus(item, 'approved')} style={[styles.actionBtn, { backgroundColor: theme.success }]}>
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </Pressable>
                      <Pressable onPress={() => updateStatus(item, 'rejected')} style={[styles.actionBtn, { backgroundColor: theme.red }]}>
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  searchBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18 },
  searchInput: { fontSize: 15, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  ghostBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontWeight: '900' },
  actionBtn: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtnText: { color: '#fff', fontWeight: '900' },
});