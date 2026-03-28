import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import apiClient from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { getToken } from '../../../src/utils/storage';

type RelativeData = {
  full_name?: string;
  relation_type?: string;
  phone?: string;
  work_place?: string;
};

type ClientFormState = {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  dob: string;
  status: string;
  citizenship: string;
  is_priority: boolean;

  passport_local_num: string;
  passport_inter_num: string;
  passport_issued_by: string;
  passport_issued_date: string;
  address_registration: string;

  is_partner_client: boolean;
  partner_name: string;
  has_discount: boolean;
  discount_amount: string;

  current_tasks: string;
  comments: string;

  relative_full_name: string;
  relative_relation_type: string;
  relative_phone: string;
  relative_work_place: string;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый', icon: 'sparkles-outline' as const },
  { value: 'consultation', label: 'Консультация', icon: 'chatbubble-ellipses-outline' as const },
  { value: 'documents', label: 'Сбор документов', icon: 'document-text-outline' as const },
  { value: 'visa', label: 'Виза', icon: 'airplane-outline' as const },
  { value: 'success', label: 'Успешно', icon: 'checkmark-circle-outline' as const },
  { value: 'rejected', label: 'Отказ', icon: 'close-circle-outline' as const },
  { value: 'archive', label: 'Архив', icon: 'archive-outline' as const },
];

function safeValue(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function cleanNullable(value: string) {
  const v = String(value || '').trim();
  return v ? v : null;
}

function normalizeDecimal(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    new: 'Новый',
    consultation: 'Консультация',
    documents: 'Сбор документов',
    visa: 'Виза',
    success: 'Успешно',
    rejected: 'Отказ',
    archive: 'Архив',
  };
  return map[status || ''] || status || '—';
}

function statusTone(status?: string, theme?: any) {
  const map: Record<string, { bg: string; color: string }> = {
    new: { bg: theme?.blueSoft || '#EAF1FF', color: theme?.blue || '#3366FF' },
    consultation: { bg: '#F2EAFF', color: '#7A3EF0' },
    documents: { bg: '#FFF5D9', color: '#B7791F' },
    visa: { bg: '#FFE9D9', color: '#C05621' },
    success: { bg: '#EAF8EF', color: theme?.success || '#138A4B' },
    rejected: { bg: theme?.redSoft || '#FFE7E7', color: theme?.red || '#D64545' },
    archive: { bg: '#EEF1F4', color: '#667085' },
  };
  return map[status || ''] || { bg: theme?.blueSoft || '#EAF1FF', color: theme?.blue || '#3366FF' };
}

function getBlock(text: string, blockTitle: string) {
  if (!text) return '';
  const escaped = blockTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n\\n===|$)`, 'i');
  const match = text.match(regex);
  return match?.[1]?.trim() || '';
}

function removeStructuredBlocks(text: string) {
  if (!text) return '';
  return text
    .replace(/\n\n=== RELATIVE ===[\s\S]*?(?=\n\n===|$)/g, '')
    .replace(/\n\n=== CONTRACT NOTES ===[\s\S]*?(?=\n\n===|$)/g, '')
    .replace(/\n\n=== DOC PREP ===[\s\S]*?(?=\n\n===|$)/g, '')
    .replace(/=== RELATIVE ===[\s\S]*?(?=\n\n===|$)/g, '')
    .replace(/=== CONTRACT NOTES ===[\s\S]*?(?=\n\n===|$)/g, '')
    .replace(/=== DOC PREP ===[\s\S]*?(?=\n\n===|$)/g, '')
    .trim();
}

function parseRelativeFromComments(text: string): RelativeData | null {
  const block = getBlock(text || '', '=== RELATIVE ===');
  if (!block) return null;

  const getField = (label: string) => {
    const regex = new RegExp(`${label}:\\s*(.*)`, 'i');
    return block.match(regex)?.[1]?.trim() || '';
  };

  const data: RelativeData = {
    full_name: getField('ФИО'),
    relation_type: getField('Кем приходится'),
    phone: getField('Телефон'),
    work_place: getField('Место работы'),
  };

  const hasAny = Object.values(data).some((v) => String(v || '').trim() && String(v).trim() !== '-');
  return hasAny ? data : null;
}

function flattenServerError(data: any): string {
  if (!data) return 'Не удалось сохранить изменения.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map((x) => String(x)).join('\n');

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
        if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
        return `${key}: ${String(value)}`;
      })
      .join('\n');
  }

  return 'Не удалось сохранить изменения.';
}

function InfoRow({
  theme,
  icon,
  label,
  value,
  divider = true,
}: {
  theme: any;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
        ]}
      >
        <Ionicons name={icon} size={18} color={theme.blue} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function SectionCard({
  theme,
  title,
  children,
}: {
  theme: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </>
  );
}

function EditInput({
  theme,
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
}: {
  theme: any;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}) {
  return (
    <View style={styles.editField}>
      <Text style={[styles.editLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.editInputWrap,
          {
            backgroundColor: theme.backgroundSoft,
            borderColor: theme.border,
            minHeight: multiline ? 100 : 54,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCorrect={false}
          style={[
            styles.editInput,
            {
              color: theme.text,
              minHeight: multiline ? 76 : 22,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [form, setForm] = useState<ClientFormState | null>(null);

  const isOfflineClient = Boolean(client?.isOffline);
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const initials = useMemo(() => {
    const name = String(client?.full_name || '').trim();
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [client]);

  const parsedRelative = useMemo(() => {
    if (client?.relative) return client.relative;
    return parseRelativeFromComments(String(client?.comments || ''));
  }, [client]);

  const plainComments = useMemo(() => {
    return removeStructuredBlocks(String(client?.comments || ''));
  }, [client]);

  const docPrepBlock = useMemo(() => {
    return getBlock(String(client?.current_tasks || ''), '=== DOC PREP ===');
  }, [client]);

  const plainTasks = useMemo(() => {
    return removeStructuredBlocks(String(client?.current_tasks || ''));
  }, [client]);

  const contractNotes = useMemo(() => {
    return getBlock(String(client?.comments || ''), '=== CONTRACT NOTES ===');
  }, [client]);

  const sharedWithNames = useMemo(() => {
    const arr = Array.isArray(client?.shared_with_data) ? client.shared_with_data : [];
    if (!arr.length) return '—';
    return arr
      .map((u: any) => u?.full_name || `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.email || 'Пользователь')
      .join(', ');
  }, [client]);

  const tone = statusTone(client?.status, theme);

  const hydrateForm = useCallback((data: any) => {
    const rel = data?.relative || parseRelativeFromComments(String(data?.comments || '')) || {};
    setForm({
      full_name: String(data?.full_name || ''),
      phone: String(data?.phone || ''),
      email: String(data?.email || ''),
      city: String(data?.city || ''),
      dob: String(data?.dob || ''),
      status: String(data?.status || 'new'),
      citizenship: String(data?.citizenship || 'Туркменистан'),
      is_priority: Boolean(data?.is_priority),

      passport_local_num: String(data?.passport_local_num || ''),
      passport_inter_num: String(data?.passport_inter_num || ''),
      passport_issued_by: String(data?.passport_issued_by || ''),
      passport_issued_date: String(data?.passport_issued_date || ''),
      address_registration: String(data?.address_registration || ''),

      is_partner_client: Boolean(data?.is_partner_client),
      partner_name: String(data?.partner_name || ''),
      has_discount: Boolean(data?.has_discount),
      discount_amount: String(data?.discount_amount ?? ''),

      current_tasks: plainTasks || String(data?.current_tasks || ''),
      comments: plainComments || String(data?.comments || ''),

      relative_full_name: String(rel?.full_name || ''),
      relative_relation_type: String(rel?.relation_type || ''),
      relative_phone: String(rel?.phone || ''),
      relative_work_place: String(rel?.work_place || ''),
    });
  }, [plainComments, plainTasks]);

  const loadClient = useCallback(async () => {
    try {
      if (id && String(id).startsWith('temp_')) {
        const offlineClients = JSON.parse((await getToken('offline_clients')) || '[]');
        const found = offlineClients.find((c: any) => String(c.id) === String(id));
        if (found) {
          setClient(found);
          hydrateForm(found);
          return;
        }
      }

      const response = await apiClient.get(`clients/${id}/`);
      setClient(response.data);
      hydrateForm(response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиента', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку клиента.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydrateForm, id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient])
  );

  const setField = <K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const openPhone = async () => {
    const phone = String(client?.phone || '').trim();
    if (!phone) return;
    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
  };

  const openEmail = async () => {
    const email = String(client?.email || '').trim();
    if (!email) return;
    const url = `mailto:${email}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
  };

  const buildPayload = () => {
    if (!form) return null;

    const hasAnyRelative =
      form.relative_full_name.trim() ||
      form.relative_relation_type.trim() ||
      form.relative_phone.trim() ||
      form.relative_work_place.trim();

    return {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: cleanNullable(form.email),
      city: form.city.trim(),
      dob: cleanNullable(form.dob),
      status: form.status,
      citizenship: form.citizenship.trim() || 'Туркменистан',
      is_priority: form.is_priority,

      passport_local_num: form.passport_local_num.trim(),
      passport_inter_num: form.passport_inter_num.trim(),
      passport_issued_by: form.passport_issued_by.trim(),
      passport_issued_date: cleanNullable(form.passport_issued_date),
      address_registration: form.address_registration.trim(),

      is_partner_client: form.is_partner_client,
      partner_name: form.is_partner_client ? form.partner_name.trim() : '',
      has_discount: form.has_discount,
      discount_amount: form.has_discount ? normalizeDecimal(form.discount_amount) : 0,

      current_tasks: form.current_tasks.trim(),
      comments: form.comments.trim(),

      relative: hasAnyRelative
        ? {
            full_name: form.relative_full_name.trim(),
            relation_type: form.relative_relation_type.trim(),
            phone: form.relative_phone.trim(),
            work_place: form.relative_work_place.trim(),
          }
        : null,
    };
  };

  const doSave = async () => {
    if (!form || !client) return;

    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      Alert.alert('Ошибка', 'ФИО, телефон и город обязательны.');
      return;
    }

    if (form.email.trim() && !form.email.includes('@')) {
      Alert.alert('Ошибка', 'Проверь email.');
      return;
    }

    if (form.is_partner_client && !form.partner_name.trim()) {
      Alert.alert('Ошибка', 'Укажи название партнёра.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const response = await apiClient.patch(`clients/${client.id}/`, payload);
      setClient(response.data);
      hydrateForm(response.data);
      setEditMode(false);
      Alert.alert('Готово', 'Клиент успешно обновлён.');
    } catch (error: any) {
      Alert.alert('Ошибка сервера', flattenServerError(error?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async () => {
    if (!form || !client) return;

    const oldStatus = String(client.status || 'new');
    const newStatus = String(form.status || 'new');

    if (oldStatus === 'new' && newStatus !== 'new') {
      Alert.alert(
        'Подтвердите смену статуса',
        `Менеджеру важно понимать, что клиент переводится из статуса "Новый" в статус "${statusLabel(newStatus)}". Сохранить изменение?`,
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Сохранить', onPress: doSave },
        ]
      );
      return;
    }

    await doSave();
  };

  const quickSetStatus = async (newStatus: string) => {
    if (!client || isOfflineClient) return;
    if (String(client.status || '') === String(newStatus || '')) return;

    setStatusSaving(true);
    try {
      const response = await apiClient.post(`clients/${client.id}/set-status/`, {
        status: newStatus,
      });

      setClient(response.data);
      hydrateForm(response.data);
    } catch (error: any) {
      Alert.alert('Ошибка', flattenServerError(error?.response?.data));
    } finally {
      setStatusSaving(false);
    }
  };

  const askQuickSetStatus = (newStatus: string) => {
    if (!client) return;

    const oldStatus = String(client.status || 'new');
    if (oldStatus === 'new' && newStatus !== 'new') {
      Alert.alert(
        'Сменить статус клиента?',
        `Отметить клиента как "${statusLabel(newStatus)}"?`,
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Да', onPress: () => quickSetStatus(newStatus) },
        ]
      );
      return;
    }

    quickSetStatus(newStatus);
  };

  const archiveClient = async () => {
    if (!client || isOfflineClient) return;

    Alert.alert(
      'Архивировать клиента?',
      'Клиент не удалится навсегда. Он перейдёт в статус "Архив" и будет отображаться как неактивный.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Архивировать',
          style: 'destructive',
          onPress: async () => {
            setArchiving(true);
            try {
              const response = await apiClient.delete(`clients/${client.id}/`);
              const archivedClient = response?.data?.client || null;

              if (archivedClient) {
                setClient(archivedClient);
                hydrateForm(archivedClient);
              } else {
                await loadClient();
              }

              setEditMode(false);
              Alert.alert('Готово', 'Клиент переведён в архив.');
            } catch (error: any) {
              Alert.alert('Ошибка', flattenServerError(error?.response?.data));
            } finally {
              setArchiving(false);
            }
          },
        },
      ]
    );
  };

  const restoreClient = async () => {
    if (!client || isOfflineClient) return;

    setStatusSaving(true);
    try {
      const response = await apiClient.post(`clients/${client.id}/restore/`, {
        status: 'consultation',
      });
      setClient(response.data);
      hydrateForm(response.data);
      Alert.alert('Готово', 'Клиент восстановлен из архива.');
    } catch (error: any) {
      Alert.alert('Ошибка', flattenServerError(error?.response?.data));
    } finally {
      setStatusSaving(false);
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

  if (!client || !form) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.red }]}>Клиент не найден</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const isArchived = String(client?.status || '') === 'archive';

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/crm' as any)}
          style={[
            styles.backBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {editMode ? 'Редактирование клиента' : 'Карточка клиента'}
        </Text>

        <Pressable
          onPress={() => {
            if (isOfflineClient) {
              Alert.alert('Недоступно', 'Оффлайн-клиента нельзя редактировать до синхронизации.');
              return;
            }

            if (editMode) {
              hydrateForm(client);
              setEditMode(false);
            } else {
              setEditMode(true);
            }
          }}
          style={[
            styles.editBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name={editMode ? 'close-outline' : 'create-outline'}
            size={20}
            color={theme.text}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadClient();
            }}
            tintColor={theme.blue}
          />
        }
      >
        <View
          style={[
            styles.mainCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: isArchived ? 0.7 : 1,
            },
          ]}
        >
          <View style={[styles.avatarPlaceholder, { backgroundColor: isArchived ? '#98A2B3' : theme.blue }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={[styles.clientName, { color: theme.text }]}>
            {client.is_priority ? '⭐ ' : ''}
            {safeValue(client.full_name)}
          </Text>

          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.color }]}>
              {client.isOffline ? 'OFFLINE CLIENT' : statusLabel(client.status)}
            </Text>
          </View>

          {!editMode ? (
            <>
              <View style={styles.quickActions}>
                <Pressable
                  onPress={openPhone}
                  style={[
                    styles.quickBtn,
                    { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="call-outline" size={18} color={theme.blue} />
                  <Text style={[styles.quickBtnText, { color: theme.text }]}>Позвонить</Text>
                </Pressable>

                <Pressable
                  onPress={openEmail}
                  style={[
                    styles.quickBtn,
                    { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color={theme.blue} />
                  <Text style={[styles.quickBtnText, { color: theme.text }]}>Email</Text>
                </Pressable>
              </View>

              <Text style={[styles.quickStatusTitle, { color: theme.textSecondary }]}>
                Быстрая смена статуса
              </Text>

              <View style={styles.quickStatusWrap}>
                {STATUS_OPTIONS.map((item) => {
                  const active = String(client.status || '') === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      disabled={statusSaving}
                      onPress={() => askQuickSetStatus(item.value)}
                      style={[
                        styles.quickStatusChip,
                        {
                          backgroundColor: active ? theme.blue : theme.backgroundSoft,
                          borderColor: active ? theme.blue : theme.border,
                          opacity: statusSaving ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={active ? '#fff' : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.quickStatusChipText,
                          { color: active ? '#fff' : theme.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {statusSaving ? (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator size="small" color={theme.blue} />
                  <Text style={[styles.inlineLoaderText, { color: theme.textSecondary }]}>
                    Обновляем статус...
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.editHint, { color: theme.textSecondary }]}>
              Здесь можно обновить данные клиента. Если статус меняется с “Новый” на другой, перед сохранением будет предупреждение.
            </Text>
          )}

          {client.isOffline ? (
            <Text style={[styles.offlineHint, { color: theme.textSecondary }]}>
              Этот клиент сохранён локально и ждёт синхронизации.
            </Text>
          ) : null}

          {isArchived ? (
            <Text style={[styles.archivedHint, { color: theme.textMuted }]}>
              Этот клиент находится в архиве и считается неактивным.
            </Text>
          ) : null}
        </View>

        {editMode ? (
          <>
            <SectionCard theme={theme} title="Редактирование: основная информация">
              <View style={styles.editCardBody}>
                <EditInput
                  theme={theme}
                  label="ФИО"
                  value={form.full_name}
                  onChangeText={(v) => setField('full_name', v)}
                  placeholder="Введите ФИО"
                />
                <EditInput
                  theme={theme}
                  label="Телефон"
                  value={form.phone}
                  onChangeText={(v) => setField('phone', v)}
                  placeholder="+993..."
                  keyboardType="phone-pad"
                />
                <EditInput
                  theme={theme}
                  label="Email"
                  value={form.email}
                  onChangeText={(v) => setField('email', v)}
                  placeholder="mail@example.com"
                  keyboardType="email-address"
                />
                <EditInput
                  theme={theme}
                  label="Город"
                  value={form.city}
                  onChangeText={(v) => setField('city', v)}
                  placeholder="Ашхабад"
                />
                <EditInput
                  theme={theme}
                  label="Дата рождения"
                  value={form.dob}
                  onChangeText={(v) => setField('dob', v)}
                  placeholder="YYYY-MM-DD"
                />
                <EditInput
                  theme={theme}
                  label="Гражданство"
                  value={form.citizenship}
                  onChangeText={(v) => setField('citizenship', v)}
                  placeholder="Туркменистан"
                />

                <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Статус клиента</Text>
                <View style={styles.chipsWrap}>
                  {STATUS_OPTIONS.map((item) => {
                    const active = form.status === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => setField('status', item.value)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.blue : theme.backgroundSoft,
                            borderColor: active ? theme.blue : theme.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={active ? '#fff' : theme.textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? '#fff' : theme.text },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>Приоритетный клиент</Text>
                    <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                      Помогает не потерять клиента среди остальных
                    </Text>
                  </View>
                  <Switch value={form.is_priority} onValueChange={(v) => setField('is_priority', v)} />
                </View>
              </View>
            </SectionCard>

            <SectionCard theme={theme} title="Редактирование: паспорт и регистрация">
              <View style={styles.editCardBody}>
                <EditInput
                  theme={theme}
                  label="Загранпаспорт"
                  value={form.passport_inter_num}
                  onChangeText={(v) => setField('passport_inter_num', v)}
                  placeholder="Номер загранпаспорта"
                />
                <EditInput
                  theme={theme}
                  label="Внутренний паспорт"
                  value={form.passport_local_num}
                  onChangeText={(v) => setField('passport_local_num', v)}
                  placeholder="Серия / номер"
                />
                <EditInput
                  theme={theme}
                  label="Кем выдан"
                  value={form.passport_issued_by}
                  onChangeText={(v) => setField('passport_issued_by', v)}
                  placeholder="Например: МВД Туркменистана"
                />
                <EditInput
                  theme={theme}
                  label="Дата выдачи"
                  value={form.passport_issued_date}
                  onChangeText={(v) => setField('passport_issued_date', v)}
                  placeholder="YYYY-MM-DD"
                />
                <EditInput
                  theme={theme}
                  label="Адрес регистрации"
                  value={form.address_registration}
                  onChangeText={(v) => setField('address_registration', v)}
                  placeholder="Адрес регистрации"
                  multiline
                />
              </View>
            </SectionCard>

            <SectionCard theme={theme} title="Редактирование: родственник">
              <View style={styles.editCardBody}>
                <EditInput
                  theme={theme}
                  label="ФИО родственника"
                  value={form.relative_full_name}
                  onChangeText={(v) => setField('relative_full_name', v)}
                  placeholder="ФИО"
                />
                <EditInput
                  theme={theme}
                  label="Кем приходится"
                  value={form.relative_relation_type}
                  onChangeText={(v) => setField('relative_relation_type', v)}
                  placeholder="Отец / мать / брат / сестра"
                />
                <EditInput
                  theme={theme}
                  label="Телефон родственника"
                  value={form.relative_phone}
                  onChangeText={(v) => setField('relative_phone', v)}
                  placeholder="+993..."
                  keyboardType="phone-pad"
                />
                <EditInput
                  theme={theme}
                  label="Место работы"
                  value={form.relative_work_place}
                  onChangeText={(v) => setField('relative_work_place', v)}
                  placeholder="Где работает родственник"
                />
              </View>
            </SectionCard>

            <SectionCard theme={theme} title="Редактирование: партнёрство и скидка">
              <View style={styles.editCardBody}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>Клиент от партнёра</Text>
                  </View>
                  <Switch value={form.is_partner_client} onValueChange={(v) => setField('is_partner_client', v)} />
                </View>

                <EditInput
                  theme={theme}
                  label="Название партнёра"
                  value={form.partner_name}
                  onChangeText={(v) => setField('partner_name', v)}
                  placeholder="Название партнёра"
                />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>Есть скидка</Text>
                  </View>
                  <Switch value={form.has_discount} onValueChange={(v) => setField('has_discount', v)} />
                </View>

                <EditInput
                  theme={theme}
                  label="Размер скидки"
                  value={form.discount_amount}
                  onChangeText={(v) => setField('discount_amount', v)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </SectionCard>

            <SectionCard theme={theme} title="Редактирование: работа менеджера">
              <View style={styles.editCardBody}>
                <EditInput
                  theme={theme}
                  label="Текущие задачи"
                  value={form.current_tasks}
                  onChangeText={(v) => setField('current_tasks', v)}
                  placeholder="Что делается по клиенту"
                  multiline
                />
                <EditInput
                  theme={theme}
                  label="Комментарии"
                  value={form.comments}
                  onChangeText={(v) => setField('comments', v)}
                  placeholder="Важные комментарии"
                  multiline
                />
              </View>
            </SectionCard>

            <View style={styles.actionsWrap}>
              <Pressable
                onPress={saveClient}
                disabled={saving}
                style={[styles.actionBtn, { backgroundColor: theme.success }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Сохранить изменения</Text>
                  </>
                )}
              </Pressable>

              {!isArchived ? (
                <Pressable
                  onPress={archiveClient}
                  disabled={archiving}
                  style={[styles.actionBtn, { backgroundColor: theme.red }]}
                >
                  {archiving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="archive-outline" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Удалить клиента</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={restoreClient}
                  disabled={statusSaving}
                  style={[styles.actionBtn, { backgroundColor: theme.blue }]}
                >
                  {statusSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Восстановить из архива</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <SectionCard theme={theme} title="Основная информация">
              <InfoRow theme={theme} icon="call" label="Телефон" value={safeValue(client.phone)} />
              <InfoRow theme={theme} icon="mail" label="Email" value={safeValue(client.email)} />
              <InfoRow theme={theme} icon="calendar" label="Дата рождения" value={safeValue(client.dob)} />
              <InfoRow theme={theme} icon="location" label="Город" value={safeValue(client.city)} />
              <InfoRow theme={theme} icon="flag" label="Гражданство" value={safeValue(client.citizenship)} />
              <InfoRow theme={theme} icon="layers" label="Статус" value={statusLabel(client.status)} />
              <InfoRow
                theme={theme}
                icon="star"
                label="Приоритет"
                value={client.is_priority ? 'Да' : 'Нет'}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Паспорт и регистрация">
              <InfoRow
                theme={theme}
                icon="card"
                label="Загранпаспорт"
                value={safeValue(client.passport_inter_num)}
              />
              <InfoRow
                theme={theme}
                icon="document-text"
                label="Внутренний паспорт"
                value={safeValue(client.passport_local_num)}
              />
              <InfoRow
                theme={theme}
                icon="shield-checkmark"
                label="Кем выдан"
                value={safeValue(client.passport_issued_by)}
              />
              <InfoRow
                theme={theme}
                icon="calendar-outline"
                label="Дата выдачи"
                value={safeValue(client.passport_issued_date)}
              />
              <InfoRow
                theme={theme}
                icon="home"
                label="Адрес регистрации"
                value={safeValue(client.address_registration)}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Родственник / контактное лицо">
              <InfoRow
                theme={theme}
                icon="person"
                label="ФИО"
                value={safeValue(parsedRelative?.full_name)}
              />
              <InfoRow
                theme={theme}
                icon="people"
                label="Кем приходится"
                value={safeValue(parsedRelative?.relation_type)}
              />
              <InfoRow
                theme={theme}
                icon="call"
                label="Телефон"
                value={safeValue(parsedRelative?.phone)}
              />
              <InfoRow
                theme={theme}
                icon="business"
                label="Место работы"
                value={safeValue(parsedRelative?.work_place)}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Партнёрство и скидка">
              <InfoRow
                theme={theme}
                icon="people"
                label="Клиент от партнёра"
                value={client.is_partner_client ? 'Да' : 'Нет'}
              />
              <InfoRow
                theme={theme}
                icon="business"
                label="Партнёр"
                value={safeValue(client.partner_name)}
              />
              <InfoRow
                theme={theme}
                icon="pricetag"
                label="Есть скидка"
                value={client.has_discount ? 'Да' : 'Нет'}
              />
              <InfoRow
                theme={theme}
                icon="cash"
                label="Размер скидки"
                value={safeValue(client.discount_amount)}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Работа менеджера">
              <InfoRow
                theme={theme}
                icon="checkmark-done"
                label="Текущие задачи"
                value={safeValue(plainTasks)}
              />
              <InfoRow
                theme={theme}
                icon="folder-open"
                label="Подготовка документов"
                value={safeValue(docPrepBlock)}
              />
              <InfoRow
                theme={theme}
                icon="chatbubbles"
                label="Комментарии"
                value={safeValue(plainComments)}
              />
              <InfoRow
                theme={theme}
                icon="document-attach"
                label="Заметки по договору"
                value={safeValue(contractNotes)}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Ответственный и доступы">
              <InfoRow
                theme={theme}
                icon="person-circle"
                label="Основной менеджер"
                value={safeValue(client?.manager_data?.full_name || client?.manager)}
              />
              <InfoRow
                theme={theme}
                icon="people-circle"
                label="Shared access"
                value={sharedWithNames}
                divider={false}
              />
            </SectionCard>

            <SectionCard theme={theme} title="Системная информация">
              <InfoRow theme={theme} icon="finger-print" label="ID клиента" value={safeValue(client.id)} />
              <InfoRow theme={theme} icon="time" label="Создан" value={formatDateTime(client.created_at)} />
              <InfoRow
                theme={theme}
                icon="refresh"
                label="Обновлён"
                value={formatDateTime(client.updated_at)}
                divider={false}
              />
            </SectionCard>

            <View style={styles.actionsWrap}>
              {!isArchived ? (
                <>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/add-deal',
                        params: {
                          clientId: String(client.id),
                          clientName: String(client.full_name || ''),
                        },
                      } as any)
                    }
                    style={[styles.actionBtn, { backgroundColor: theme.blue }]}
                  >
                    <Ionicons name="briefcase" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Создать сделку</Text>
                  </Pressable>

                  <Pressable
                    onPress={archiveClient}
                    disabled={archiving}
                    style={[styles.actionBtn, { backgroundColor: theme.red }]}
                  >
                    {archiving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="archive-outline" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Удалить клиента</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={restoreClient}
                  disabled={statusSaving}
                  style={[styles.actionBtn, { backgroundColor: theme.blue }]}
                >
                  {statusSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Восстановить из архива</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  errorText: { fontSize: 16, textAlign: 'center', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  mainCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 28,
    marginBottom: 20,
    borderWidth: 1,
  },
  avatarPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  clientName: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  quickBtn: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickStatusTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickStatusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  quickStatusChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatusChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  inlineLoader: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineLoaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editHint: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  archivedHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  editCardBody: {
    padding: 16,
  },
  editField: {
    marginBottom: 14,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  editInputWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editInput: {
    fontSize: 15,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  chip: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  switchRow: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  switchSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  actionsWrap: {
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});