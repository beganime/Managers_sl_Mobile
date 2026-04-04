import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  status?: 'draft' | 'generated' | 'pending' | 'approved' | 'rejected' | 'error' | string;
  created_at?: string;
  updated_at?: string;
  file?: string;
  file_url?: string;
  approved_file_url?: string | null;
  can_download?: boolean;
  rejection_reason?: string;
  template_name?: string;
  manager_name?: string;
  deal_client_name?: string;
};

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
}

function normalizeStatus(value?: string) {
  const raw = String(value || '').toLowerCase();

  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'generated') return 'pending';
  if (raw === 'pending') return 'pending';
  if (raw === 'error') return 'error';
  return raw || 'draft';
}

function statusMeta(status: string, theme: any) {
  switch (status) {
    case 'approved':
      return {
        label: 'Одобрен',
        bg: '#E7F8EC',
        color: '#157347',
        icon: 'checkmark-circle' as const,
      };
    case 'rejected':
      return {
        label: 'Отклонён',
        bg: '#FDECEC',
        color: theme.red,
        icon: 'close-circle' as const,
      };
    case 'pending':
      return {
        label: 'На проверке',
        bg: '#FFF4E5',
        color: '#B26A00',
        icon: 'time' as const,
      };
    case 'error':
      return {
        label: 'Ошибка',
        bg: '#FDECEC',
        color: theme.red,
        icon: 'warning' as const,
      };
    default:
      return {
        label: 'Черновик',
        bg: theme.backgroundSoft,
        color: theme.textSecondary,
        icon: 'document-text' as const,
      };
  }
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const path =
        statusFilter === 'all'
          ? 'documents/generated/'
          : `documents/generated/?status=${statusFilter}`;

      const data = await fetchAllPages(path);
      setDocuments((data || []) as DocumentItem[]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить документы.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return documents.filter((item) => {
      const status = normalizeStatus(item.status);

      const matchesStatus =
        statusFilter === 'all' ? true : status === statusFilter;

      if (!matchesStatus) return false;
      if (!q) return true;

      return (
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.template_name || '').toLowerCase().includes(q) ||
        String(item.deal_client_name || '').toLowerCase().includes(q) ||
        String(item.manager_name || '').toLowerCase().includes(q) ||
        String(status || '').toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [documents, search, statusFilter]);

  const openFile = async (item: DocumentItem) => {
    const url = item.can_download
      ? item.approved_file_url || item.file_url || item.file
      : item.file_url || item.file;

    if (!url) {
      Alert.alert('Файл', 'У этого документа пока нет файла.');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть файл.');
    }
  };

  const approve = async (item: DocumentItem) => {
    try {
      setProcessingId(item.id);
      await apiClient.post(`documents/generated/${item.id}/approve/`, {});
      await load();
      Alert.alert('Готово', 'Документ одобрен.');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось одобрить документ.');
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (item: DocumentItem) => {
    Alert.prompt?.(
      'Отклонить документ',
      'Укажи причину отклонения',
      async (reason) => {
        try {
          setProcessingId(item.id);
          await apiClient.post(`documents/generated/${item.id}/reject/`, {
            reason: String(reason || '').trim(),
          });
          await load();
          Alert.alert('Готово', 'Документ отклонён.');
        } catch (error: any) {
          Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось отклонить документ.');
        } finally {
          setProcessingId(null);
        }
      }
    );

    if (!Alert.prompt) {
      Alert.alert(
        'Отклонить документ',
        'На Android системный prompt может быть недоступен. Если нужно, потом добавим отдельное модальное окно для причины.'
      );
    }
  };

  const regenerate = async (item: DocumentItem) => {
    try {
      setProcessingId(item.id);
      await apiClient.post(`documents/generated/${item.id}/regenerate/`, {});
      await load();
      Alert.alert('Готово', 'Документ перегенерирован и снова отправлен на проверку.');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось перегенерировать документ.');
    } finally {
      setProcessingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load();
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Документы</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              {isAdmin
                ? 'Проверка, одобрение и просмотр документов'
                : 'Созданные документы и статус одобрения'}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/(app)/create-document' as any)}
            style={[styles.createBtn, { backgroundColor: theme.blue }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Создать</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по документам"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {[
            { key: 'all', label: 'Все' },
            { key: 'pending', label: 'На проверке' },
            { key: 'approved', label: 'Одобрены' },
            { key: 'rejected', label: 'Отклонены' },
          ].map((item) => {
            const active = statusFilter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => setStatusFilter(item.key as any)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.blue : theme.card,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#fff' : theme.text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="document-text-outline" size={24} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Документы не найдены
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const status = normalizeStatus(item.status);
            const meta = statusMeta(status, theme);
            const isProcessing = processingId === item.id;

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      {item.title || `Документ #${item.id}`}
                    </Text>

                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      {item.template_name || 'Шаблон не указан'}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                    <Text style={[styles.statusPillText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                {!!item.deal_client_name && (
                  <Text style={[styles.cardLine, { color: theme.textSecondary }]}>
                    Клиент: {item.deal_client_name}
                  </Text>
                )}

                {!!item.manager_name && (
                  <Text style={[styles.cardLine, { color: theme.textSecondary }]}>
                    Менеджер: {item.manager_name}
                  </Text>
                )}

                <Text style={[styles.cardLine, { color: theme.textSecondary }]}>
                  Создан: {formatDate(item.created_at)}
                </Text>

                {status === 'rejected' && !!item.rejection_reason && (
                  <View
                    style={[
                      styles.reasonBox,
                      {
                        backgroundColor: '#FFF1F1',
                        borderColor: '#FFD5D5',
                      },
                    ]}
                  >
                    <Text style={[styles.reasonTitle, { color: theme.red }]}>
                      Причина отклонения
                    </Text>
                    <Text style={[styles.reasonText, { color: theme.red }]}>
                      {item.rejection_reason}
                    </Text>
                  </View>
                )}

                {!item.can_download && status !== 'approved' && (
                  <Text style={[styles.hint, { color: theme.textMuted }]}>
                    Скачивание будет доступно только после одобрения администратором.
                  </Text>
                )}

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => openFile(item)}
                    style={[
                      styles.ghostBtn,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundSoft,
                      },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={16} color={theme.text} />
                    <Text style={[styles.ghostBtnText, { color: theme.text }]}>
                      {item.can_download ? 'Открыть / скачать' : 'Открыть'}
                    </Text>
                  </Pressable>

                  {!isAdmin && status !== 'approved' && (
                    <Pressable
                      onPress={() => regenerate(item)}
                      disabled={isProcessing}
                      style={[
                        styles.ghostBtn,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.backgroundSoft,
                          opacity: isProcessing ? 0.7 : 1,
                        },
                      ]}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={theme.blue} />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={16} color={theme.blue} />
                          <Text style={[styles.ghostBtnText, { color: theme.blue }]}>
                            Перегенерировать
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {isAdmin && status !== 'approved' && (
                    <Pressable
                      onPress={() => approve(item)}
                      disabled={isProcessing}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: theme.success,
                          opacity: isProcessing ? 0.7 : 1,
                        },
                      ]}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {isAdmin && status !== 'rejected' && status !== 'approved' && (
                    <Pressable
                      onPress={() => reject(item)}
                      disabled={isProcessing}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: theme.red,
                          opacity: isProcessing ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  createBtn: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  filtersRow: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  cardMeta: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  cardLine: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  reasonBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostBtnText: {
    fontWeight: '900',
    fontSize: 13,
  },
  actionBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
});