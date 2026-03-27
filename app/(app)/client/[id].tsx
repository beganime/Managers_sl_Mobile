// app/(app)/client/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { getToken } from '../../../src/utils/storage';

function safeValue(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
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

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const initials = useMemo(() => {
    const name = String(client?.full_name || '').trim();
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [client]);

  const loadClient = async () => {
    try {
      if (id && String(id).startsWith('temp_')) {
        const offlineClients = JSON.parse((await getToken('offline_clients')) || '[]');
        const found = offlineClients.find((c: any) => String(c.id) === String(id));
        if (found) {
          setClient(found);
          return;
        }
      }

      const response = await apiClient.get(`clients/${id}/`);
      setClient(response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиента', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку клиента.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadClient();
  }, [id]);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!client) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.red }]}>Клиент не найден</Text>
        </View>
      </ScreenWrapper>
    );
  }

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

        <Text style={[styles.headerTitle, { color: theme.text }]}>Карточка клиента</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.blue }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={[styles.clientName, { color: theme.text }]}>
            {client.is_priority ? '⭐ ' : ''}
            {safeValue(client.full_name)}
          </Text>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: client.isOffline ? theme.redSoft : theme.blueSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: client.isOffline ? theme.red : theme.blue },
              ]}
            >
              {client.isOffline ? 'OFFLINE CLIENT' : statusLabel(client.status)}
            </Text>
          </View>

          {client.isOffline ? (
            <Text style={[styles.offlineHint, { color: theme.textSecondary }]}>
              Этот клиент сохранён локально и ждёт синхронизации.
            </Text>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Основная информация
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <InfoRow theme={theme} icon="call" label="Телефон" value={safeValue(client.phone)} />
          <InfoRow theme={theme} icon="mail" label="Email" value={safeValue(client.email)} />
          <InfoRow theme={theme} icon="calendar" label="Дата рождения" value={safeValue(client.dob)} />
          <InfoRow
            theme={theme}
            icon="location"
            label="Город / Гражданство"
            value={`${safeValue(client.city)} / ${safeValue(client.citizenship)}`}
            divider={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Паспорт и договор
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
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
            label="Кем выдан / Дата"
            value={`${safeValue(client.passport_issued_by)} ${
              client.passport_issued_date ? `(${client.passport_issued_date})` : ''
            }`}
          />
          <InfoRow
            theme={theme}
            icon="home"
            label="Прописка"
            value={safeValue(client.address_registration)}
            divider={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Партнёрский блок
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <InfoRow
            theme={theme}
            icon="people"
            label="От партнёра"
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
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Работа менеджера
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <InfoRow
            theme={theme}
            icon="checkmark-done"
            label="Текущие задачи"
            value={safeValue(client.current_tasks)}
          />
          <InfoRow
            theme={theme}
            icon="chatbubbles"
            label="Комментарии"
            value={safeValue(client.comments)}
            divider={false}
          />
        </View>

        <View style={styles.actionsWrap}>
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
        </View>

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
  offlineHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
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