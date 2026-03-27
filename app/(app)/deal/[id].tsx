// app/(app)/deal/[id].tsx
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

function money(v: any) {
  const n = Number(v || 0);
  return `$${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function safeValue(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function paymentStatusLabel(status?: string) {
  const map: Record<string, string> = {
    unpaid: 'Не оплачено',
    partial: 'Частично',
    paid: 'Оплачено',
  };
  return map[status || ''] || status || '—';
}

function dealTypeLabel(type?: string) {
  const map: Record<string, string> = {
    university: 'Поступление',
    service: 'Услуга',
  };
  return map[type || ''] || type || '—';
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

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const outstanding = useMemo(() => {
    if (!deal) return 0;
    return Math.max(
      0,
      Number(deal.total_to_pay_usd || 0) - Number(deal.paid_amount_usd || 0)
    );
  }, [deal]);

  const loadDeal = async () => {
    try {
      if (id && String(id).startsWith('temp_')) {
        const offlineDeals = JSON.parse((await getToken('offline_deals')) || '[]');
        const found = offlineDeals.find((d: any) => String(d.id) === String(id));
        if (found) {
          setDeal(found);
          return;
        }
      }

      const response = await apiClient.get(`analytics/deals/${id}/`);
      setDeal(response.data);
    } catch (error) {
      console.error('Ошибка загрузки сделки', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку сделки.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeal();
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

  if (!deal) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.red }]}>Сделка не найдена</Text>
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

        <Text style={[styles.headerTitle, { color: theme.text }]}>Карточка сделки</Text>

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
              loadDeal();
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
          <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons
              name={deal.deal_type === 'university' ? 'school' : 'briefcase'}
              size={28}
              color={theme.blue}
            />
          </View>

          <Text style={[styles.dealTitle, { color: theme.text }]}>
            Сделка #{safeValue(deal.id)}
          </Text>

          <Text style={[styles.dealSubtitle, { color: theme.textSecondary }]}>
            {deal.client_data?.full_name || 'Клиент'} · {dealTypeLabel(deal.deal_type)}
          </Text>

          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: theme.blueSoft }]}>
              <Text style={[styles.badgeText, { color: theme.blue }]}>
                {paymentStatusLabel(deal.payment_status)}
              </Text>
            </View>

            {deal.isOffline ? (
              <View style={[styles.badge, { backgroundColor: theme.redSoft }]}>
                <Text style={[styles.badgeText, { color: theme.red }]}>OFFLINE</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Основное
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <InfoRow
            theme={theme}
            icon="person"
            label="Клиент"
            value={safeValue(deal.client_data?.full_name)}
          />
          <InfoRow
            theme={theme}
            icon="call"
            label="Телефон клиента"
            value={safeValue(deal.client_data?.phone)}
          />
          <InfoRow
            theme={theme}
            icon="business"
            label="Менеджер"
            value={safeValue(
              deal.manager_data?.full_name ||
                [deal.manager_data?.first_name, deal.manager_data?.last_name]
                  .filter(Boolean)
                  .join(' ')
            )}
          />
          <InfoRow
            theme={theme}
            icon="layers"
            label="Тип сделки"
            value={dealTypeLabel(deal.deal_type)}
            divider={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Услуга / программа
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {deal.deal_type === 'university' ? (
            <>
              <InfoRow
                theme={theme}
                icon="school"
                label="Университет"
                value={safeValue(deal.university_name)}
              />
              <InfoRow
                theme={theme}
                icon="book"
                label="Программа"
                value={safeValue(deal.program_name)}
                divider={false}
              />
            </>
          ) : (
            <>
              <InfoRow
                theme={theme}
                icon="briefcase"
                label="Название услуги"
                value={safeValue(deal.service_title || deal.custom_service_name)}
              />
              <InfoRow
                theme={theme}
                icon="document-text"
                label="Описание услуги"
                value={safeValue(deal.custom_service_desc)}
                divider={false}
              />
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Финансы
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <InfoRow
            theme={theme}
            icon="cash"
            label="Цена для клиента"
            value={money(deal.price_client)}
          />
          <InfoRow
            theme={theme}
            icon="trending-up"
            label="Ожидаемая выручка"
            value={money(deal.expected_revenue_usd)}
          />
          <InfoRow
            theme={theme}
            icon="wallet"
            label="Всего к оплате"
            value={money(deal.total_to_pay_usd)}
          />
          <InfoRow
            theme={theme}
            icon="card"
            label="Оплачено"
            value={money(deal.paid_amount_usd)}
          />
          <InfoRow
            theme={theme}
            icon="hourglass"
            label="Остаток"
            value={money(outstanding)}
            divider={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Платежи
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {!deal.payments || !deal.payments.length ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Платежей пока нет.
              </Text>
            </View>
          ) : (
            deal.payments.map((p: any, index: number) => (
              <View
                key={String(p.id)}
                style={[
                  styles.paymentRow,
                  index !== deal.payments.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.divider,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentTitle, { color: theme.text }]}>
                    {money(p.amount_usd || p.amount)}
                  </Text>
                  <Text style={[styles.paymentMeta, { color: theme.textSecondary }]}>
                    {p.method || '—'} · {p.payment_date || p.updated_at || '—'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.payBadge,
                    {
                      backgroundColor: p.is_confirmed ? '#EAF8EF' : '#FFF4E8',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.payBadgeText,
                      { color: p.is_confirmed ? theme.success : theme.warning },
                    ]}
                  >
                    {p.is_confirmed ? 'CONFIRMED' : 'PENDING'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.actionsWrap}>
          {!String(deal.id).startsWith('temp_') && (
            <>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(app)/payment/create',
                    params: { dealId: String(deal.id) },
                  } as any)
                }
                style={[styles.actionBtn, { backgroundColor: theme.success }]}
              >
                <Ionicons name="card" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Добавить платёж</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(app)/create-document',
                    params: {
                      dealId: String(deal.id),
                      clientName: String(deal.client_data?.full_name || ''),
                    },
                  } as any)
                }
                style={[styles.secondaryBtn, { backgroundColor: theme.blue }]}
              >
                <Ionicons name="document-text" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Создать документ</Text>
              </Pressable>
            </>
          )}
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
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dealTitle: { fontSize: 22, fontWeight: '900' },
  dealSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroBadges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
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
  emptyState: {
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  paymentTitle: { fontSize: 15, fontWeight: '800' },
  paymentMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  payBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  payBadgeText: { fontSize: 11, fontWeight: '900' },
  actionsWrap: { gap: 12 },
  actionBtn: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});