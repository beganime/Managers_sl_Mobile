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
import apiClient, { buildAbsoluteFileUrl, fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type DocumentItem = {
  id: number;
  title?: string;
  status?: 'draft' | 'generated' | 'pending' | 'approved' | 'error' | 'rejected' | string;
  created_at?: string;
  updated_at?: string;

  file?: string | null;
  file_url?: string | null;
  original_file_url?: string | null;
  review_file_url?: string | null;

  approved_file_url?: string | null;
  approved_pdf_url?: string | null;
  watermarked_file_url?: string | null;
  pdf_file_url?: string | null;

  can_download?: boolean;
  template_name?: string | null;
  manager_name?: string | null;
  deal_client_name?: string | null;
  rejection_reason?: string | null;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'error';

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
  if (raw === 'error') return 'error';
  if (raw === 'rejected') return 'error';
  if (raw === 'generated') return 'pending';
  if (raw === 'draft') return 'pending';
  if (raw === 'pending') return 'pending';

  return raw || 'pending';
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
    case 'error':
      return {
        label: 'Ошибка',
        bg: '#FDECEC',
        color: theme.red,
        icon: 'warning' as const,
      };
    default:
      return {
        label: 'На проверке',
        bg: '#FFF4E5',
        color: '#B26A00',
        icon: 'time' as const,
      };
  }
}

function rawDocumentUrl(item: DocumentItem) {
  return (
    item.original_file_url ||
    item.review_file_url ||
    item.file_url ||
    item.file ||
    null
  );
}

function approvedDocumentUrl(item: DocumentItem) {
  return (
    item.approved_file_url ||
    item.approved_pdf_url ||
    item.watermarked_file_url ||
    item.pdf_file_url ||
    null
  );
}

async function openExternalUrl(url: string | null, emptyMessage: string) {
  const absoluteUrl = buildAbsoluteFileUrl(url);

  if (!absoluteUrl) {
    Alert.alert('Файл', emptyMessage);
    return;
  }

  try {
    await Linking.openURL(absoluteUrl);
  } catch {
    Alert.alert('Ошибка', 'Не удалось открыть файл.');
  }
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const dark = themeMode === 'dark';
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось загрузить документы.'
      );
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

      const statusOk = statusFilter === 'all' ? true : status === statusFilter;
      if (!statusOk) return false;

      if (!q) return true;

      return (
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.template_name || '').toLowerCase().includes(q) ||
        String(item.deal_client_name || '').toLowerCase().includes(q) ||
        String(item.manager_name || '').toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        String(status).includes(q)
      );
    });
  }, [documents, search, statusFilter]);

  const openRawFile = async (item: DocumentItem) => {
    await openExternalUrl(
      rawDocumentUrl(item),
      'У документа пока нет файла без водяного знака.'
    );
  };

  const openApprovedFile = async (item: DocumentItem) => {
    const status = normalizeStatus(item.status);

    if (status !== 'approved' && !item.can_download) {
      Alert.alert(
        'PDF ещё не готов',
        'PDF с водяным знаком можно скачать только после Approve.'
      );
      return;
    }

    await openExternalUrl(
      approvedDocumentUrl(item),
      'PDF с водяным знаком ещё не создан. Нажми Approve или проверь backend watermark.'
    );
  };

  const approve = async (item: DocumentItem) => {
    try {
      setProcessingId(item.id);
      await apiClient.post(`documents/generated/${item.id}/approve/`, {});
      await load();
      Alert.alert('Готово', 'Документ одобрен. PDF с водяным знаком создан.');
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось одобрить документ.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const regenerate = async (item: DocumentItem) => {
    try {
      setProcessingId(item.id);
      const response = await apiClient.post(`documents/generated/${item.id}/regenerate/`, {});
      await load();

      Alert.alert(
        'Готово',
        response?.data?.detail || 'Документ перегенерирован.'
      );
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось перегенерировать документ.'
      );
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
      <View style={styles.bgLayer} pointerEvents="none">
        <View style={[styles.blobOne, { backgroundColor: theme.blueSoft }]} />
        <View style={[styles.blobTwo, { backgroundColor: theme.redSoft }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Документы</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              {isAdmin
                ? 'Проверка без водяного знака и Approve PDF с водяным знаком'
                : 'Созданные документы и их статус'}
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
            styles.heroCard,
            {
              backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
              shadowColor: theme.shadow || '#000',
            },
          ]}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="document-text" size={24} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.heroValue, { color: theme.text }]}>{filtered.length}</Text>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
              Документов по текущему фильтру
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
              shadowColor: theme.shadow || '#000',
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
            { key: 'error', label: 'С ошибкой' },
          ].map((item) => {
            const active = statusFilter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => setStatusFilter(item.key as StatusFilter)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? theme.blue
                      : dark
                      ? 'rgba(20,24,36,0.94)'
                      : 'rgba(255,255,255,0.96)',
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
                backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
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
            const hasRaw = Boolean(rawDocumentUrl(item));
            const hasApproved = Boolean(approvedDocumentUrl(item));

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: dark ? 'rgba(20,24,36,0.94)' : 'rgba(255,255,255,0.96)',
                    borderColor: theme.border,
                    shadowColor: theme.shadow || '#000',
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

                <Text style={[styles.cardLine, { color: theme.textSecondary }]}>
                  Обновлён: {formatDate(item.updated_at)}
                </Text>

                {!!item.rejection_reason && status === 'error' && (
                  <Text style={[styles.hint, { color: theme.red }]}>
                    Причина: {item.rejection_reason}
                  </Text>
                )}

                {status !== 'approved' && (
                  <Text style={[styles.hint, { color: theme.textMuted }]}>
                    До Approve можно открыть файл без водяного знака для проверки. PDF с водяным знаком появится после Approve.
                  </Text>
                )}

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => openRawFile(item)}
                    style={[
                      styles.ghostBtn,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundSoft,
                        opacity: hasRaw ? 1 : 0.65,
                      },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={16} color={theme.text} />
                    <Text style={[styles.ghostBtnText, { color: theme.text }]}>
                      Проверить без watermark
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openApprovedFile(item)}
                    style={[
                      styles.ghostBtn,
                      {
                        borderColor: status === 'approved' ? theme.blue : theme.border,
                        backgroundColor: status === 'approved' ? theme.blueSoft : theme.backgroundSoft,
                        opacity: status === 'approved' && hasApproved ? 1 : 0.72,
                      },
                    ]}
                  >
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color={status === 'approved' ? theme.blue : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.ghostBtnText,
                        { color: status === 'approved' ? theme.blue : theme.textMuted },
                      ]}
                    >
                      PDF с watermark
                    </Text>
                  </Pressable>

                  {status !== 'approved' && (
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

                  {isAdmin && status === 'pending' && (
                    <Pressable
                      onPress={() => approve(item)}
                      disabled={isProcessing}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: theme.success || '#1AAE6F',
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
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -90,
    opacity: 0.55,
  },
  blobTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 210,
    left: -100,
    opacity: 0.35,
  },
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
  heroCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(38,116,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroLabel: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
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
    borderRadius: 28,
    padding: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
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